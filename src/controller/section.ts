export default class Section {
	public readonly uuid: string;
	public readonly id: string;
	public readonly title: string;
	public readonly instructor: string;
	public readonly department: string;
	public readonly year: number;
	public readonly avg: number;
	public readonly pass: number;
	public readonly fail: number;
	public readonly audit: number;

	constructor(sectionJSON: any) {
		this.uuid = sectionJSON.id;
		this.id = sectionJSON.Course;
		this.title = sectionJSON.Title;
		this.instructor = sectionJSON.Professor;
		this.department = sectionJSON.Subject;
		this.year = sectionJSON.Year;
		this.avg = sectionJSON.Avg;
		this.pass = sectionJSON.Pass;
		this.fail = sectionJSON.Fail;
		this.audit = sectionJSON.Audit;
	}
}
