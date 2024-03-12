export default class Section {
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
		this.fullname = String(roomJSON.id);
		this.shortname = String(roomJSON.Course);
		this.number = String(roomJSON.Title);
		this.name = String(roomJSON.Professor);
		this.address = String(roomJSON.Subject);
		// Check if the section should be marked as occurring in 1900
		this.lat = roomJSON.Section === "overall" ? 1900 : Number(roomJSON.Year);
		this.lon = Number(roomJSON.Avg);
		this.seats = Number(roomJSON.Pass);
		this.type = String(roomJSON.Fail);
		this.furniture = String(roomJSON.Audit);
		this.href = String(roomJSON.Audit);
	}
}
