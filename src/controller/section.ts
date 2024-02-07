
export default class Section {
	private uuid: string;
	private id: string ;
	private title: string;
	private instructor: string;
	private department: string;
	private year: number;
	private avg: number;
	private pass: number;
	private fail: number;
	private audit: number;

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
