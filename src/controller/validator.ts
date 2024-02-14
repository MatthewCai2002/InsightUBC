import {InsightError} from "./IInsightFacade";

export default class Validator {
	private validKeywords: string[] = ["WHERE", "OPTIONS", "COLUMNS", "ORDER",
		"IS", "NOT", "AND", "OR", "LT", "GT", "EQ"];

	private mFields: string[] = ["year", "avg", "pass", "fail", "audit"];
	private sFields: string[] = ["uuid", "id", "title", "instructor", "dept"];

	public validateQuery(query: any): any {
		// Initialize a dictionary for tracking dataset references
		let dbRefSet: Set<string> = new Set<string>();

		// Ensure the query contains both WHERE and OPTIONS clauses
		if (!("WHERE" in query)) {
			throw new InsightError("Query must contain WHERE.");
		}

		if (!("OPTIONS" in query)) {
			throw new InsightError("Query must contain OPTIONS.");
		}

		// Validate WHERE and OPTIONS clauses
		const validWhere = this.validateWhere(query.WHERE, dbRefSet);
		const validOpt = this.validateOptions(query.OPTIONS, dbRefSet);
		// Check if the query references one or fewer datasets
		if (dbRefSet.size > 1) {
			return false; // Invalid if multiple datasets are referenced
		}
		let res = {
			valid: validWhere && validOpt,
			id: dbRefSet.values()
		};
		return res;
	}

	public validateWhere(currQuery: any, dbRefSet: Set<string>): boolean {
		// get filter key word
		const key = Object.keys(currQuery)[0];

		// check if it's a valid keyword
		if (!(this.validKeywords.includes(key))) {
			return false;
		}

		// WHERE only has 1 nested obj
		// just call appropriate validator for the nested obj
		return this.callValidator(currQuery, dbRefSet);
	}

	public callValidator(query: any, dbRefSet: Set<string>): boolean {
		const key = Object.keys(query)[0];
		switch (key) {
			// these 2 take lists of filters
			case "AND":
				return this.validateListQuery(query.AND, dbRefSet);
			case "OR":
				return this.validateListQuery(query.OR, dbRefSet);

			// this can have nested filters
			case "NOT":
				return this.callValidator(query.NOT, dbRefSet);

			// these ones can't have nested filters (base case)
			case "IS":
				return this.validateIs(query.IS, dbRefSet);
			case "LT":
			case "GT":
			case "EQ":
				return this.validateInequality(query, dbRefSet);
			default:
				// can't have string just on it's own in a where
				// must be nested inside one of the above filters
				return false;
		}
		return false;
	}

	private validateInequality(query: any, dbRefSet: Set<string>) {
		console.log(query);
		let mKey = Object.keys(query)[0];
		let nestedObj = query[mKey];

		mKey = Object.keys(nestedObj)[0];

		const keyParts: string[] = mKey.split("_");

		// get mKey components
		const idStr = keyParts[0];
		const mField = keyParts[1];

		// need to check if ID string is valid (a string of 0+ characters except _)
		if (idStr.includes("_")) {
			return false;
		}

		// check if sField is valid (sField is inside valid sField)
		if (!this.mFields.includes(mField)) {
			return false;
		}

		if (!(typeof nestedObj[mKey] === "number")) {
			return false;
		}

		dbRefSet.add(idStr);
		return true;
	}

	public validateListQuery(queryArray: any, dbRefSet: Set<string>): boolean {
		// check if value is a list
		let validQueries: boolean[] = [];
		if (!Array.isArray(queryArray)) {
			return false;
		}

		// for each query in queryArrays
		// call validator
		for (const q of queryArray) {
			validQueries.push(this.callValidator(q, dbRefSet));
		}

		if (validQueries.every((valid) => valid)) {
			return true;
		}
		return false;
	}

	public validateIs(query: any, dbRefSet: Set<string>): boolean {
		const sKey = Object.keys(query)[0];
		let val = query[sKey];

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
			let inputString = val;
			if (inputString[0] === "*") {
				inputString = inputString.slice(1, inputString.length);
			}

			if (inputString[inputString.length - 1] === "*") {
				inputString = inputString.slice(0, inputString.length - 1);
			}

			// input string has * then invalid
			if (inputString.includes("*")) {
				return false;
			}
		}
		// update dbRefSet with the dataset this is referencing (id string)
		dbRefSet.add(idStr);
		return true;
	}

	public validateOptions(options: any, dbRefSet: Set<string>): boolean {
		// Check for required components in OPTIONS
		if (!options.COLUMNS || !Array.isArray(options.COLUMNS)) {
			return false; // Invalid if COLUMNS is missing or not an array
		}

		// Optionally, validate ORDER if present
		if (options.ORDER && !options.COLUMNS.includes(options.ORDER)) {
			return false; // Invalid if ORDER references a field not in COLUMNS
		}

		// check all fields in columns
		let  validFields = this.sFields.concat(this.mFields);
		for (let key of options.COLUMNS) {
			const keyParts: string[] = key.split("_");

			// get sKey components
			const idStr = keyParts[0];
			const field = keyParts[1];

			// need to check if ID string is valid (a string of 0+ characters except _)
			if (idStr.includes("_")) {
				return false;
			}

			// check if field is a valid field
			if (!validFields.includes(field)) {
				return false;
			}

			dbRefSet.add(idStr);
		}

		if (options.ORDER) {
			const key = options.ORDER;
			const keyParts: string[] = key.split("_");
			// get sKey components
			const idStr = keyParts[0];
			const field = keyParts[1];
			// need to check if ID string is valid (a string of 0+ characters except _)
			if (idStr.includes("_")) {
				return false;
			}
			// check if field is a valid field
			if (!validFields.includes(field)) {
				return false;
			}

			dbRefSet.add(idStr);
		}
		// Ensure all fields in COLUMNS are valid and potentially check against dbRefSet
		// Placeholder for field validation logic
		return true;
	}
}
