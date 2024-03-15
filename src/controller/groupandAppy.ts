import Room from "./room";
import Section from "./section";
type NumericKeysOfRoom = "lat" | "lon" | "seats";
type KeysOfRoom = keyof Room;

// make this work with sections as well.
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
			}).join("|");
			// if we are grouping two things, the value needs to be concatonated so its unique.
			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			// Add this new object to the appropriate group
			groups.get(groupKey)?.push(item);
		});
		return groups;
	}

	// after grouping by, get a double array, then you find the maximum value, and then return an array of maximum values.

	// map the names to the grouped values, when you are doing hte group by

	//

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
				let operationObject = operations[0][Object.keys(operations[0])[0]];
				let correctKey = Object.keys(operationObject)[0];
				let operationResult: number;
				let field = Object.values(operationObject)[0];
				let values = items.map((item) => item[field] as number); //
				switch (correctKey) {
					case "MAX":
						operationResult = Math.max(...values);
						break;
					case "MIN":
						operationResult = Math.min(...values);
						break;
					case "AVG":
						operationResult = values.reduce((acc, value) => acc + value, 0) / items.length;
						groupResult[NewName] = Number(operationResult.toFixed(2));
						// find the average
						break;
					case "SUM":
						operationResult = values.reduce((acc, value) => acc + value, 0);
						groupResult[NewName] = Number(operationResult.toFixed(2));
						// find the sum
						break;
					case "COUNT":
						operationResult = new Set(values).size;
						groupResult[NewName] = operationResult;
						break;
					default:
						throw new Error(`Unsupported operation: ${correctKey}`);
				}
			}
			result.set(groupKey, groupResult);
			// stores whatever we have in the result
		});

		// edge case with noNew Name
		return result;
	}
}

