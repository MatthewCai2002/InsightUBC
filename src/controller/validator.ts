import {InsightError} from "./IInsightFacade";
import {isArgumentsObject} from "node:util/types";

export default class Validator {
	private validKeywords: string[] = [
		"WHERE",
		"OPTIONS",
		"COLUMNS",
		"ORDER",
		"IS",
		"NOT",
		"AND",
		"OR",
		"LT",
		"GT",
		"EQ",
	];

	private applyField: any = {};

	private mFields: string[] = ["year", "avg", "pass", "fail", "audit", "lat", "lon", "seats"];
	private sFields: string[] = ["uuid", "id", "title", "instructor", "dept", "fullname", "shortname", "number",
		"name", "dept" , "address", "type", "furniture", "href"];

	constructor (applyField: any) {
		this.applyField = applyField;
	}


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

		if (dbRefSet.size === 0) {
			throw new InsightError("No dataset specified in the query.");
		}

		let res = {
			valid: validWhere && validOpt,
			id: [...dbRefSet][0],
		};
		return res;
	}

	public validateWhere(currQuery: any, dbRefSet: Set<string>): boolean {
		// get filter key word
		const key = Object.keys(currQuery)[0];

		// check if it's a valid keyword
		if (!this.validKeywords.includes(key)) {
			throw new InsightError("Invalid keyword");
		}

		if (Object.keys(currQuery).length > 1) {
			throw new InsightError("invalid WHERE");
		}

		// WHERE only has 1 nested obj
		// just call appropriate validator for the nested obj
		let valid: boolean = this.callValidator(currQuery, dbRefSet);
		if (dbRefSet.size > 1) {
			throw new InsightError("References to multiple Datasets");
		}
		return valid;
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
				throw new InsightError("Invalid keyword");
		}
	}

	private validateInequality(query: any, dbRefSet: Set<string>) {
		let mKey = Object.keys(query)[0];
		let nestedObj = query[mKey];

		mKey = Object.keys(nestedObj)[0];

		const keyParts: string[] = mKey.split("_");

		// if length > 2 then underscore must be in idStr
		if (keyParts.length > 2) {
			throw new InsightError("Invalid ID String");
		}

		// get mKey components
		const idStr = keyParts[0];
		const mField = keyParts[1];

		// check if mfield is valid
		if (!this.mFields.includes(mField)) {
			throw new InsightError("invalid field");
		}

		if (!(typeof nestedObj[mKey] === "number")) {
			throw new InsightError("invalid input");
		}

		dbRefSet.add(idStr);
		return true;
	}

	public validateListQuery(queryArray: any, dbRefSet: Set<string>): boolean {
		// check if value is a list
		let validQueries: boolean[] = [];
		if (!Array.isArray(queryArray)) {
			throw new InsightError("Invalid query string");
		}

		// for each query in queryArrays
		// call validator
		for (const q of queryArray) {
			validQueries.push(this.callValidator(q, dbRefSet));
		}

		if (validQueries.every((valid) => valid)) {
			return true;
		}
		throw new InsightError("Invalid query string");
	}

	public validateIs(query: any, dbRefSet: Set<string>): boolean {
		const sKey = Object.keys(query)[0];
		let val = query[sKey];

		const keyParts: string[] = sKey.split("_");

		// get sKey components
		const idStr = keyParts[0];
		const sField = keyParts[1];

		// if length > 2 then underscore must be in idStr
		if (keyParts.length > 2) {
			throw new InsightError("Invalid ID String");
		}

		// check if sField is valid (sField is inside valid sField)
		if (!this.sFields.includes(sField)) {
			throw new InsightError("invalid sField");
		}

		// check if val is a string
		// need to check for wild cards too
		if (typeof val !== "string") {
			throw new InsightError("Invalid query string");
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
				throw new InsightError("invalid inputs tring");
			}
		}
		// update dbRefSet with the dataset this is referencing (id string)
		dbRefSet.add(idStr);
		return true;
	}

	public validateOptions(options: any, dbRefSet: Set<string>): boolean {
		// Check for required components in OPTIONS
		if (!options.COLUMNS || !Array.isArray(options.COLUMNS)) {
			throw new InsightError("Invalid COLUMNS");
		}
		if (!("COLUMNS" in options) || !Array.isArray(options.COLUMNS) || options.COLUMNS.length === 0) {
			throw new InsightError("OPTIONS must contain a non-empty COLUMNS array.");
		}

		// // Optionally, validate ORDER if present
		// if (options.ORDER && !options.COLUMNS.includes(options.ORDER)) {
		// 	throw new InsightError("references in ORDER missing in WHERE");
		// }


		// check all fields in columns
		let validFields = this.sFields.concat(this.mFields);
		// need to pass in the new name into the fields?
		for (let key of options.COLUMNS) {
			const keyParts: string[] = key.split("_");
			// get key components
			const idStr = keyParts[0];
			const field = keyParts[1];

			// if length > 2 then underscore must be in idStr
			if (keyParts.length > 2) {
				throw new InsightError("Invalid ID String");
			}

			// check if field is a valid field
			if (!validFields.includes(field)) {
				throw new InsightError("Invalid field");
			}

			dbRefSet.add(idStr);
		}

		// check key in ORDER
		if (options.ORDER) {
			const key = options.ORDER;
			const keyParts: string[] = key.split("_");

			// if length > 2 then underscore must be in idStr
			if (keyParts.length > 2) {
				throw new InsightError("Invalid ID String");
			}

			// get sKey components
			const idStr = keyParts[0];
			const field = keyParts[1];

			// check if field is a valid field
			if (!validFields.includes(field)) {
				throw new InsightError("Invalid ID field");
			}

			dbRefSet.add(idStr);
		}
		if (dbRefSet.size > 1) {
			throw new InsightError("References to multiple Datasets");
		}

		return true;
	}
}
