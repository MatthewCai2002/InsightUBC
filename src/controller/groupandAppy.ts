import Room from "./room";
import Section from "./section";
import {InsightError, InsightResult} from "./IInsightFacade";
type NumericKeysOfRoom = "lat" | "lon" | "seats";
type KeysOfRoom = keyof Room;

// make this work with sections as well.
interface QueryOptions {
	COLUMNS: string[];
	ORDER?: string; // Optional
}
interface IGroupable {
	[key: string]: string | number;
}
export default class GroupAndApply {
	public static groupData<T extends IGroupable>(
		items: any[],
		keys: Array<keyof T>,
	): Map<string, any[]> { // Adjust the return type accordingly
		const groups = new Map<string, any[]>();
		// the groups map is the keythat they all shhare. For example: room_shortname: LSC. The value is a list of
		// everything that has that key. (for example the HEBB address etc)
		items.forEach((item) => {
			// iterates over all the values
			const groupKey = keys.map((key ) => {
				const correctKey = (key as string).split("_");
				const field = correctKey[1];
				return `${String(key)}:${item["value"][field]}`;
			}).join(":");
			// if we are grouping two things, the value needs to be concatonated so its unique.
			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			// Add this new object to the appropriate group
			groups.get(groupKey)?.push(item);
		});
		return groups;
	}


	public static transform<T extends IGroupable>(groups: Map<string, T[]>, operations: Array<{
		[NewName: string]: {operation: string, field: keyof T}

	}>): Map<string, any> {
		let result = new Map<string, any>();
		// new map that stores the final resuls that will be returned
		// items is the list of courses
		groups.forEach((items: any[], groupKey) => {
			let groupResult: {[NewName: string]: any} = {};
			// goes through for each item.
			for (const NewName in operations) {
				// for the current operation happening
				let keyObject = operations[NewName];
				let operationObject = keyObject[Object.keys(operations[NewName])[0]];
				let correctKey = Object.keys(operationObject)[0];
				let resultKey = Object.keys(operations[NewName])[0]; // have to fix
				let operationResult: number;
				let fullKey: any = Object.values(operationObject)[0];
				const splitKey = fullKey.split("_");
				const field = splitKey[1];
				let values = items.map((item) => item.value[field]);
				if (correctKey !== "COUNT" && values.some((value) => typeof value === "string")) {
					throw new InsightError("Encountered a string value where a numeric value was expected.");
				}
				switch (correctKey) {
					case "MAX":
						operationResult = Math.max(...values);
						groupResult[resultKey] = Number(operationResult);
						break;
					case "MIN":
						operationResult = Math.min(...values);
						groupResult[resultKey] = Number(operationResult);
						break;
					case "AVG":
						operationResult = values.reduce((acc, value) => acc + value, 0) / items.length;
						groupResult[resultKey] = Number(operationResult.toFixed(2));
						break;
					case "SUM":
						operationResult = values.reduce((acc, value) => acc + value, 0);
						groupResult[resultKey] = Number(operationResult.toFixed(2));
						break;
					case "COUNT":
						operationResult = new Set(values).size;
						groupResult[resultKey] = Number(operationResult.toFixed(2));
						break;
					default:
						throw new Error(`Unsupported operation: ${correctKey}`);
				}
			}
			result.set(groupKey, groupResult);
		});
		// edge case with noNew Name
		return result;
	}

	public static convertTransformedResults(transformedResults: Map<string, any>): InsightResult[] {
		let results: InsightResult[] = [];
		transformedResults.forEach((value, key) => {
			let resultEntry: InsightResult = {};
			const parts = key.split(":");
			const firstHalf = parts[0];
			const secondHalf = parts[1];
			resultEntry[firstHalf] = secondHalf;
			resultEntry = {...resultEntry, ...value};

			results.push(resultEntry);
		});
		return results;
	}
}

