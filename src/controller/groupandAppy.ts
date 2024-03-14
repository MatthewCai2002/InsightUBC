import Room from "./room";
type NumericKeysOfRoom = "lat" | "lon" | "seats";
type KeysOfRoom = keyof Room;

export default class GroupandAppy {
	public static groupData(rooms: Room[], keys: KeysOfRoom[]): Map<string, Room[]> {
		const groups = new Map<string, Room[]>();
		rooms.forEach((room) => {
			const groupKey = keys.map((key) => `${key}:${room[key]}`).join("|");
			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey)?.push(room);
		});
		return groups;
	}

// Transform grouped data based on operations
	public static transform(groups: Map<string, Room[]>, operations: {
		[key: string]:
			{operation: string, field: KeysOfRoom}
	}): Map<string, any> {
		let result = new Map<string, any>();
		groups.forEach((rooms, groupKey) => {
			let groupResult: {[alias: string]: any} = {};
			for (const [alias, {operation, field}] of Object.entries(operations)) {
				switch (operation) {
					case "max":
						groupResult[alias] = Math.max(...rooms.map((room) => room[field] as number));
						break;
					case "min":
						groupResult[alias] = Math.min(...rooms.map((room) => room[field] as number));
						break;
					case "avg": {
						const avg = rooms.reduce((acc, room) => acc +
							(room[field] as number), 0) / rooms.length;
						groupResult[alias] = Number(avg.toFixed(2));
						break;
					}
					case "sum": {
						const sum = rooms.reduce((acc, room) => acc + (room[field] as number), 0);
						groupResult[alias] = Number(sum.toFixed(2));
						break;
					}
					case "count": {
						const uniqueValues = new Set(rooms.map((room) => room[field]));
						groupResult[alias] = uniqueValues.size;
						break;
					}
					default:
						throw new Error(`Unsupported operation: ${operation}`);
				}
			}
			result.set(groupKey, groupResult);
		});

		return result;
	}
}
