import {InsightError} from "./IInsightFacade";
import {isArgumentsObject} from "node:util/types";

// In the columns, only see "maxseats, max", at what point do you know what dataset

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

	private mFields: string[] = ["year", "avg", "pass", "fail", "audit", "lat", "lon", "seats"];
	private sFields: string[] = ["uuid", "id", "title", "instructor", "dept", "fullname", "shortname", "number",
		"name", "dept" , "address", "type", "furniture", "href"];

	public validateQuery(query: any): any {
		if (!query || !query.WHERE || !query.OPTIONS) {
			throw new InsightError("Query must contain WHERE and OPTIONS.");
		}

		let dbRefSet: Set<string> = new Set<string>();
		let applyKeys: Set<string> = new Set<string>();

		this.validateWhere(query.WHERE, dbRefSet);
		if (query.TRANSFORMATIONS) {
			applyKeys = this.validateTransformations(query.TRANSFORMATIONS, dbRefSet);
		}
		this.validateOptions(query.OPTIONS, applyKeys, dbRefSet);

		if (dbRefSet.size !== 1) {
			throw new InsightError("Query must reference exactly one dataset.");
		}

		return {
			valid: true,
			id: [...dbRefSet][0],
		};
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

	private validateTransformations(transformations: any, dbRefSet: Set<string>): Set<string> {
		if (!transformations.GROUP || !Array.isArray(transformations.GROUP)) {
			throw new InsightError("TRANSFORMATIONS must contain a GROUP array.");
		}
		if (!transformations.APPLY || !Array.isArray(transformations.APPLY)) {
			throw new InsightError("TRANSFORMATIONS must contain an APPLY array.");
		}

		transformations.GROUP.forEach((groupKey: string) => {
			if (!this.isValidField(groupKey, dbRefSet)) {
				throw new InsightError(`Invalid GROUP key: ${groupKey}`);
			}
		});

		let applyKeys = new Set<string>();
		transformations.APPLY.forEach((rule: any) => {
			const applyKey = Object.keys(rule)[0];
			console.log(applyKey);
			if (applyKeys.has(applyKey)) {
				throw new InsightError(`Duplicate APPLY key: ${applyKey}`);
			}
			applyKeys.add(applyKey);
			// Further APPLY rule validation logic can be added here.
		});

		return applyKeys;
	}

	private isValidField(field: string, dbRefSet: Set<string>): boolean {
		// Split the field into components (id and field name) and validate them.
		// Update dbRefSet with the dataset ID if the field is valid.
		// Return true if the field is valid, false otherwise.
		const parts = field.split("_");
		if (parts.length === 2) {
			const [id, fieldName] = parts;
			const isValidMField = this.mFields.includes(fieldName);
			const isValidSField = this.sFields.includes(fieldName);
			if (isValidMField || isValidSField) {
				dbRefSet.add(id);
				return true;
			}
		}
		return false;
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

	private validateOptions(options: any, applyKeys: Set<string>, dbRefSet: Set<string>): boolean {
		if (!options.COLUMNS || !Array.isArray(options.COLUMNS)) {
			throw new InsightError("OPTIONS must contain a COLUMNS array.");
		}
		if (!options.COLUMNS || !Array.isArray(options.COLUMNS)) {
			throw new InsightError("Invalid COLUMNS");
		}
		options.COLUMNS.forEach((column: string) => {
			if (!this.isValidField(column, dbRefSet) && !applyKeys.has(column)) {
				throw new InsightError(`Invalid field in COLUMNS: ${column}`);
			}
		});
		if (!("COLUMNS" in options) || !Array.isArray(options.COLUMNS) || options.COLUMNS.length === 0) {
			throw new InsightError("OPTIONS must contain a non-empty COLUMNS array.");
		}
		const validFields = new Set([...this.sFields, ...this.mFields, ...applyKeys]);
		// need to pass in the new name into the fields?
		for (let key of options.COLUMNS) {
			let idStr: string | null = null; // Use null or empty string '' as appropriate for your logic
			let field: string = ""; // Assume empty string, adjust based on your handling
			const keyParts: string[] = key.split("_");
			// If the key is a single word (alias from APPLY or a direct field name)
			if (keyParts.length === 1) {
				field = keyParts[0]; // Treat the single word as a field name or alias
			} else if (keyParts.length === 2) {
				// Standard case with datasetId_fieldName
				idStr = keyParts[0];
				field = keyParts[1];
			}
			// check if field is a valid field
			if (!validFields.has(field)) {
				throw new InsightError("Invalid field");
			}
			if (idStr) {
				dbRefSet.add(idStr);
			}
		}

		// // check key in ORDER
		// if (options.ORDER) {
		// 	const key = options.ORDER;
		// 	// currentlly having key= Object {dir = "DOWN", heys: Array{1}}
		// 	const keyParts: string[] = key;
		//
		// 	// if length > 2 then underscore must be in idStr
		// 	if (keyParts.length > 2) {
		// 		throw new InsightError("Invalid ID String");
		// 	}
		//
		// 	// get sKey components
		// 	const idStr = keyParts[0];
		// 	const field = keyParts[1];
		//
		// 	// check if field is a valid field
		// 	if (!validFields.has(field)) {
		// 		throw new InsightError("Invalid ID field");
		// 	}
		// 	dbRefSet.add(idStr);
		// }
		// // if (dbRefSet.size > 1) {
		// // 	throw new InsightError("References to multiple Datasets");
		// // }

		return true;
	}
}
