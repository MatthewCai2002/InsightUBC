export default class Section {
	public readonly uuid: string;
	public readonly id: string;
	public readonly title: string;
	public readonly instructor: string;
	public readonly dept: string;
	public readonly year: number;
	public readonly avg: number;
	public readonly pass: number;
	public readonly fail: number;
	public readonly audit: number;

	constructor(sectionJSON: any) {
		this.uuid = String(sectionJSON.id);
		this.id = String(sectionJSON.Course);
		this.title = String(sectionJSON.Title);
		this.instructor = String(sectionJSON.Professor);
		this.dept = String(sectionJSON.Subject);
		this.year = Number(sectionJSON.Year);
		this.avg = Number(sectionJSON.Avg);
		this.pass = Number(sectionJSON.Pass);
		this.fail = Number(sectionJSON.Fail);
		this.audit = Number(sectionJSON.Audit);
	}
}
