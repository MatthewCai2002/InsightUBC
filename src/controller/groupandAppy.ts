import Room from "./room";
type NumericKeysOfRoom = "lat" | "lon" | "seats";
type KeysOfRoom = keyof Room;

// make this work with sections as well.
interface IGroupable {
	[key: string]: string | number;
}
export default class GroupAndApply {
	public static groupData<T extends IGroupable>(items: T[], keys: Array<keyof T>): Map<string, T[]> {
		// Takes in an array of items, of type T (room/specs), and an array of keys with them.
		const groups = new Map<string, T[]>();
		// has an empty map to hold the items here. Each key is a string. Store the grouped items based off the keys
		items.forEach((item) => {
			// goes through each item
			const groupKey = keys.map((key) => `${String(key)}:${item[key]}`).join("|");
			// based off the specifc key, makes a ne identifier of groupKey, and they convert each key into a string.
			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			// if there is one already, then it makes a new one. if not, it adds it to the current group.
			groups.get(groupKey)?.push(item);
			// finds the array that has the required groupKey and adds the current item to it.
		});
		return groups;
		// return the group that we want.
	}

	public static transform<T extends IGroupable>(groups: Map<string, T[]>, operations: {
		[NewName: string]: {operation: string, field: keyof T}
		// along with the one above, takes in a string/numer so it can work for rooms and sections
		// the groups: Map takes in a group from before, and the operation is the one below. It does the operation below
		// to the group
	}): Map<string, any> {
		let result = new Map<string, any>();
		// new map that stores the final resuls that will be returned
		groups.forEach((items, groupKey) => {
			let groupResult: {[NewName: string]: any} = {};
			// goes through for each item.
			for (const NewName in operations) {
				// for the current operation happening
				const {operation, field} = operations[NewName];
				let values = items.map((item) => item[field] as number); //
				let operationResult: number;
				switch (operation) {
					case "max":
						operationResult = Math.max(...values);
						break;
					case "min":
						operationResult = Math.min(...values);
						break;
					case "avg":
						operationResult = values.reduce((acc, value) => acc + value, 0) / items.length;
						groupResult[NewName] = Number(operationResult.toFixed(2));
						// find the average
						break;
					case "sum":
						operationResult = values.reduce((acc, value) => acc + value, 0);
						groupResult[NewName] = Number(operationResult.toFixed(2));
						// find the sum
						break;
					case "count":
						operationResult = new Set(values).size;
						groupResult[NewName] = operationResult;
						break;
					default:
						throw new Error(`Unsupported operation: ${operation}`);
				}
			}
			result.set(groupKey, groupResult);
			// stores whatever we have in the result
		});

		return result;
	}
}

