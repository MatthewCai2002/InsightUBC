import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
} from "./IInsightFacade";
import * as fs from "fs-extra";
import JSZip from "jszip";
import Section from "./section";
import Validator from "./validator";
import Filter from "./filter";
import RoomProcessor from "./roomProcessor";
import Writer from "./writer";
import Room from "./room";
import GroupandAppy from "./groupandAppy";

// Assuming the structure of your options object based on the provided code
interface QueryOptions {
	COLUMNS: string[];
	ORDER?: string; // Optional
}

export default class InsightFacade  implements IInsightFacade {
	private fileFields: string[] = [
		"id",
		"Course",
		"Title",
		"Professor",
		"Subject",
		"Year",
		"Avg",
		"Pass",
		"Fail",
		"Audit",
	];

	protected readonly dataDir = "./data/";
	private datasets: {[id: string]: InsightDataset} = {};
	private writer: Writer = new Writer(this.dataDir, this.datasets);
	private roomsProcessor = new RoomProcessor();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID"));
		}

		// check for previous datasets
		await this.readDatasets();
		console.log(Object.keys(this.datasets));

		// init writer
		this.writer.setDatasets(this.datasets);

		if (id in this.datasets) {
			return Promise.reject(new InsightError("Dataset with the same ID already exists"));
		}

		try {
			let dataset: InsightDataset;

			// unzip dataset
			const zip = new JSZip();
			const decodedContent = Buffer.from(content, "base64");
			const unzippedContent = await zip.loadAsync(decodedContent, {base64: true});

			// process dataset
			switch (kind) {
				case InsightDatasetKind.Sections:
					dataset = await this.processCoursesDataset(id, unzippedContent);
					break;
				case InsightDatasetKind.Rooms:
					dataset = await this.roomsProcessor.processRoomsDataset(id, unzippedContent, this.writer);
					break;
				default:
					return Promise.reject(new InsightError("Unsupported dataset kind."));
			}

			// add dataset to dataset dict
			this.datasets[id] = dataset;

			// write dataset dict to folder for persistence on crash
			this.writer.setDatasets(this.datasets);
			await this.writer.writeDict();

			// return array of all added datasets
			return Promise.resolve(Object.keys(this.datasets));
		} catch (error) {
			console.log(error);
			return Promise.reject(new InsightError(`Failed to add dataset: ${error}`));
		}
	}

	private async readDatasets() {
		try {
			await fs.promises.access(this.dataDir + "datasets.json");
			this.datasets = await fs.readJSON("././data/datasets.json", {throws: false});
		} catch (e) {
			// doesn't matter
		}
	}

	private async processCoursesDataset(id: string, zip: JSZip): Promise<InsightDataset> {
		const promises: Array<Promise<string>> = [];
		// for each course file, read its contents
		// and push it onto an array of promises
		zip.forEach((relativePath, file) => {
			const jsonPromise = file.async("text");
			promises.push(jsonPromise);
		});

		// resolve all promises to get an array of course JSON strings
		let jsonStrings = await Promise.all(promises);

		// validate Dataset
		// add valid sections to dataset
		let datasetObj: any = {};
		if (!this.isValidDataset(jsonStrings, datasetObj)) {
			throw new InsightError("Invalid Dataset");
		}

		// write datasetOBJ to json file in ./src/controller/data/ dir
		await this.writer.writeDataset(datasetObj, id);

		// create InsightDataset obj and fill in proper values
		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Sections,
			numRows: Object.keys(datasetObj).length,
		};

		return dataset;
	}

	// adds sections to a dataset JSON obj
	private updateDatasetObj(datasetObj: any, section: Section): void {
		datasetObj[section.uuid] = section;
	}

	// validates dataset
	private isValidDataset(jsonStrings: string[], dataset: any): boolean {
		let validCourses: boolean[] = [];

		// go through each course and validate it
		for (let str of jsonStrings) {
			// if string is empty then skip it
			if (!str) {
				continue;
			}

			let course;
			try {
				course = JSON.parse(str);
			} catch (e) {
				throw new InsightError("not sections dataset");
			}
			let validCourse = this.isValidCourse(course, dataset);
			validCourses.push(validCourse);
		}

		// if every course is invalid then dataset is invalid
		if (validCourses.every((course) => !course)) {
			// console.log("invalid dataset");
			return false;
		}
		return true;
	}

	private isValidCourse(course: any, dataset: any): boolean {
		// sections are contained within results
		let validSections: boolean[] = [];
		const results: any[] = course.result;

		// handle empty sections
		if (results.length < 1) {
			return false;
		}
		// check if all sections of a course are valid or not
		results.forEach((section: any) => {
			let validSection = this.isValidSection(section, dataset);
			validSections.push(validSection);
		});
		// if all sections of a course are invalid then course is invalid
		if (validSections.every((valid) => !valid)) {
			return false;
		}
		return true;
	}

	// validate a single section
	// checks to see if a section has all validFields
	private isValidSection(section: any, dataset: any): boolean {
		this.fileFields.forEach((field: string) => {
			if (!(field in section)) {
				return false;
			}
		});

		// add valid section to dataset
		let sectionObj = new Section(section);
		this.updateDatasetObj(dataset, sectionObj);
		return true;
	}

	public async removeDataset(id: string): Promise<string> {
		// Validate the dataset ID
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID."));
		}

		await this.readDatasets();

		// Check if the dataset exists
		if (!this.datasets[id]) {
			return Promise.reject(new NotFoundError("Dataset not found."));
		}

		try {
			// Remove the dataset from the internal dictionary
			delete this.datasets[id];
			// Attempt to delete the dataset file from the disk
			const datasetPath = `${this.dataDir}/${id}.json`;
			await fs.remove(datasetPath);
			this.writer.setDatasets(this.datasets);
			await this.writer.writeDict();

			return Promise.resolve(id);
		} catch (error) {
			return Promise.reject(new InsightError(`Failed to remove dataset ${id}: ${error}`));
		}
	}

	public async performQuery(query: any): Promise<InsightResult[]> {
		const validator: Validator = new Validator();
		const filterer: Filter = new Filter();
		const options: QueryOptions = query.OPTIONS;
		const valid: any = validator.validateQuery(query);
		const datasetId = valid.id;
		if (!datasetId) {
			throw new InsightError("Dataset ID could not be determined from the query.");
		}
		const dataset = await this.loadDataset(datasetId);
		let filteredResults = filterer.filterByWhereClause(dataset, query.WHERE);
		let groupedArray: InsightResult[] = [];
		if (query.TRANSFORMATIONS) {
			const applyRules = query.TRANSFORMATIONS.APPLY;
			const groupKeys = query.TRANSFORMATIONS.GROUP;
			const groups = GroupandAppy.groupData(filteredResults as [], groupKeys, );
			const transformedResults = GroupandAppy.transform(groups, applyRules);
			groupedArray = GroupandAppy.convertTransformedResults(transformedResults);
		}
		// replace with GroupedArray
		let insightResults: InsightResult[];
		if (groupedArray.length > 0) {
			insightResults = groupedArray;
		} else {
			insightResults = this.applyOptions(filteredResults, options);
		}
		if (options.ORDER) {
			insightResults = this.sortResults(insightResults, options.ORDER);
		}
		return insightResults;
	}


	private applyOptions(filteredResults: any[], options: QueryOptions): InsightResult[] {
		const projectedResults: InsightResult[] = filteredResults.map((item: any) => {
			const projectedItem: InsightResult = {};
			options.COLUMNS.forEach((column) => {
				const parts = column.split("_");
				const datasetID = parts[0];
				const field = parts[1];
				// Make sure the column is a key of Section
				if (field in item.value) {
					const key = `${datasetID}_${field}` as keyof InsightResult;
					// Use type assertion for column to be treated as keyof Section
					const itemKey = field as keyof Section;
					projectedItem[key] = item.value[itemKey];
				}
			});
			return projectedItem;
		});

		// Sort results if ORDER is specified
		if (options.ORDER) {
			// if array
			if (typeof options.ORDER !== "string") {
				let order: any = options.ORDER;
				const keys = order.keys;
				for (let key of keys) {
					this.handleKey(key, projectedResults);
				}
			} else {
				// if string
				const parts = options.ORDER.split("_");
				const datasetID = parts[0];
				const field = parts[1];
				const orderField = `${datasetID}_${field}` as keyof InsightResult;
				projectedResults.sort((a, b) => {
					const aValue = a[orderField];
					const bValue = b[orderField];
					// Check if the values are strings for localeCompare or numbers for subtraction
					if (typeof aValue === "string" && typeof bValue === "string") {
						return aValue.localeCompare(bValue);
					} else if (typeof aValue === "number" && typeof bValue === "number") {
						return aValue - bValue;
					}
					return 0; // Fallback in case of a type mismatch or undefined values
				});
			}
		}
		return projectedResults;
	}

	//
	private handleKey(key: any, projectedResults: InsightResult[]) {
		const parts = key.split("_");
		const datasetID = parts[0];
		const field = parts[1];
		let orderField: string | number;
		if (field === undefined) {
			orderField = `${datasetID}` as keyof InsightResult;
		} else {
			orderField = `${datasetID}_${field}` as keyof InsightResult;
		}
		projectedResults.sort((a, b) => {
			const aValue = a[orderField];
			const bValue = b[orderField];
			// Check if the values are strings for localeCompare or numbers for subtraction
			if (typeof aValue === "string" && typeof bValue === "string") {
				return aValue.localeCompare(bValue);
			} else if (typeof aValue === "number" && typeof bValue === "number") {
				return aValue - bValue;
			}
			return 0; // Fallback in case of a type mismatch or undefined values
		});
	}

	//
	private sortResults(results: InsightResult[], order: any): InsightResult[] {
		// Check if 'order' is a string (single key sort) or object (potential multi-key sort)
		const keys = (typeof order === "string") ? [order] : order.keys;
		const direction = (typeof order === "string") ? "UP" : order.dir;
		// Determine the sort direction multiplier to invert the comparison for descending order
		const dirMultiplier = (direction === "UP") ? 1 : -1;
		// 5. Define a comparator function for the sort method, capable of handling sorting by multiple keys as defined in the 'keys' array.
		const multiKeySort = (a: InsightResult, b: InsightResult) => {
			// 6. Iterate over each sorting key.
			for (const key of keys) {
				// 8. Compare the values for the current key in both elements. If the first value is less, return -1 (or 1 for descending order). If the first value is greater, return 1 (or -1 for descending).
				if (a[key] < b[key]) {
					return -1 * dirMultiplier;
				} else if (a[key] > b[key]) {
					return 1 * dirMultiplier;
				}
			}
			// All keys are equal
			return 0;
		};
		// Perform the sort
		return results.sort(multiKeySort);
	}

	public async loadDataset(datasetId: string): Promise<any> {
		// loads the dataset in
		try {
			let dataset = await fs.readJSON(`././data/${datasetId}.json`, {throws: false});
			return Object.entries(dataset).map(([key, value]) => ({key, value}));
		} catch (error) {
			console.error(`Failed to load dataset ${datasetId}: ${error}`);
			throw new InsightError(`Failed to load dataset ${datasetId}: ${error}`);
		}
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// and an object with kind and numRows as the value
		await this.readDatasets();

		const datasetList: InsightDataset[] = Object.keys(this.datasets).map((id) => {
			const dataset = this.datasets[id];
			return {
				id: id, // Dataset ID from the dictionary key
				kind: dataset.kind, // Assuming the kind is directly stored in the dataset object
				numRows: dataset.numRows,
			};
		});
		return Promise.resolve(datasetList);
	}
}
