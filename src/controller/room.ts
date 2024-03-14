export default class Room {
	public readonly fullname: string;
	public readonly shortname: string;
	public readonly number: string;
	public readonly name: string;
	public readonly address: string;
	public readonly lat: number;
	public readonly lon: number;
	public readonly seats: number;
	public readonly type: string;
	public readonly furniture: string;
	public readonly href: string;

	constructor(roomJSON: any) {
		this.fullname = String(roomJSON.fullname);
		this.shortname = String(roomJSON.shortname);
		this.number = String(roomJSON.number);
		this.name = String(roomJSON.name);
		this.address = String(roomJSON.address);
		this.lat = Number(roomJSON.lat);
		this.lon = Number(roomJSON.lon);
		this.seats = Number(roomJSON.seats);
		this.type = String(roomJSON.type);
		this.furniture = String(roomJSON.furniture);
		this.href = String(roomJSON.href);
	}
}
