import {InsightError} from "./IInsightFacade";

export default class Validator {
	private validKeywords: string[] = ["WHERE", "OPTIONS", "COLUMNS", "ORDER",
		"IS", "NOT", "AND", "OR", "LT", "GT", "EQ"];

	private mFields: string[] = ["year", "avg", "pass", "fail", "audit"];
	private sFields: string[] = ["uuid", "id", "title", "instructor", "dept"];

	public validateQuery(query: any): boolean {
		// Initialize a dictionary for tracking dataset references
		let dbRefDict: any = {};

		// Ensure the query contains both WHERE and OPTIONS clauses
		if (!("WHERE" in query) || !("OPTIONS" in query)) {
			throw new InsightError("Query must contain WHERE or OPTIONS clauses.");
		}

		// Validate WHERE and OPTIONS clauses
		const validWhere = this.validateWhere(query.WHERE, dbRefDict);
		const validOpt = this.validateOptions(query.OPTIONS, dbRefDict);
		// Check if the query references one or fewer datasets
		if (Object.keys(dbRefDict).length > 1) {
			return false; // Invalid if multiple datasets are referenced
		}
		return validWhere && validOpt;
	}

	private validateWhere(currQuery: any, dbRefDict: any): boolean {
		// get filter key word
		const key = Object.keys(currQuery)[0];

		// check if it's a valid keyword
		if (!(this.validKeywords.includes(key))) {
			return false;
		}

		// WHERE only has 1 nested obj
		// call appropriate validator
		this.callValidator(currQuery, dbRefDict);

		return true;
	}

	private callValidator(query: any, dbRefDict: any): boolean {
		const key = Object.keys(query)[0];
		switch (key) {
			// these 2 take lists of filters
			case "AND":
				return this.validateListQuery(query.AND, dbRefDict);
			case "OR":
				return this.validateListQuery(query.OR, dbRefDict);

			// this can have nested filters
			case "NOT": break;

			// these ones can't have nested filters (base case)
			case "IS":
				this.validateIs(query.IS, dbRefDict);
				break;
			case "LT": break;
			case "GT": break;
			case "EQ": break;
			default:
				// can't have string just on it's own in a where
				// must be nested inside one of the above filters
				return false;
		}
		return false;
	}

	private validateListQuery(queryArray: any, dbRefDict: any): boolean {
		// check if value is a list
		let validQueries: boolean[] = [];
		if (!Array.isArray(queryArray)) {
			return false;
		}
		// for each query in queryArrays
		// 	-> get key of the query
		//  -> call validator
		for (const q of queryArray) {
			validQueries.push(this.callValidator(q, dbRefDict));
		}

		if (validQueries.every((valid) => !valid)) {
			return true;
		}
		return false;
	}

	private validateIs(query: any, dbRefDict: any): boolean {
		// IS query is just sKey: value
		// need to check if value (inputString + *) is valid (input string is a string of 0+ characters except *
		// BUT can have * before or after the input string)
		// check if value goes with sKey
		// update dbRefDict with the dataset this is referencing (id string)
		const sKey = Object.keys(query)[0];
		const val = query.key;

		const keyParts: string[] = sKey.split("_");

		// get sKey components
		const idStr = keyParts[0];
		const sField = keyParts[1];

		// need to check if ID string is valid (a string of 0+ characters except _)
		if (idStr.includes("_")) {
			return false;
		}

		// check if sField is valid (sField is inside valid sField)
		if (!this.sFields.includes(sField)) {
			return false;
		}

		// check if val is a string
		// need to check for wild cards too
		if (typeof val !== "string") {
			return false;
		} else {
			// check if it has wildcards
			if (val[0] === "*" || val[val.length - 1] === "*") {
				// handle wild cards
			}
		}
		return true;
	}

	private validateOptions(options: any, dbRefDict: any): boolean {
		// Check for required components in OPTIONS
		if (!options.COLUMNS || !Array.isArray(options.COLUMNS)) {
			return false; // Invalid if COLUMNS is missing or not an array
		}
		// Optionally, validate ORDER if present
		if (options.ORDER && !options.COLUMNS.includes(options.ORDER)) {
			return false; // Invalid if ORDER references a field not in COLUMNS
		}
		// Ensure all fields in COLUMNS are valid and potentially check against dbRefDict
		// Placeholder for field validation logic
		return true;
	}
}
