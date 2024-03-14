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
import HTMLHandler from "./htmlHandler";
import Filter from "./filter";
import RoomProcessor from "./roomProcessor";
import Writer from "./writer";
import * as parse5 from "parse5";
import Decimal from "decimal.js";
import Room from "./room";
import GroupandAppy from "./groupandAppy";

// Assuming the structure of your options object based on the provided code
interface QueryOptions {
	COLUMNS: string[];
	ORDER?: string; // Optional
}
interface GroupedResult {
	[key: string]: any;
}
type NumericKeysOfRoom = "lat" | "lon" | "seats";
type KeysOfRoom = keyof Room;

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

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID"));
		}

		// check for previous datasets
		try {
			await fs.promises.access(this.dataDir + "datasets.json");
			this.datasets = await fs.readJSON("././data/datasets.json", {throws: false});
		} catch (e) {
			// doesn't matter
		}

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
					dataset = await RoomProcessor.processRoomsDataset(id, unzippedContent, this.writer);
					break;
				default:
					return Promise.reject(new InsightError("Unsupported dataset kind."));
			}

			// add dataset to dataset dict
			this.datasets[id] = dataset;

			// write dataset dict to folder for persistence on crash
			await this.writer.writeDict();

			// return array of all added datasets
			return Promise.resolve(Object.keys(this.datasets));
		} catch (error) {
			return Promise.reject(new InsightError(`Failed to add dataset: ${error}`));
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
			// console.log("invalid dataset");
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

	// INPUT: course JSON object
	// DOES: goes through each section and turns it into a section TS class
	// 		 then puts section into array of sections for the course
	// OUTPUT: returns the array of sections for a course
	private createSections(course: any): Section[] {
		let sections: Section[] = [];

		for (let section of course.result) {
			let sectionObject = new Section(section);
			sections.push(sectionObject);
		}

		return sections;
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
			let course = JSON.parse(str);
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

	// INPUT: a course JSON object
	// DOES: checks the "result" entry of the object and for each item:
	// checks to see if it has all the keys needed to query a section
	// immediately returns false if "result" section is empty
	// OUTPUT: returns false if it is an invalid section
	//		   returns true for a valid section
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
		let insightResults: InsightResult[] = this.applyOptions(filteredResults, options);
		if (query.TRANSFORMATIONS) {
			const groupKeys = query.TRANSFORMATIONS.GROUP;
			const applyRules = query.TRANSFORMATIONS.APPLY;
			const groups = GroupandAppy.groupData(insightResults as [], groupKeys);
			const transformedResults = GroupandAppy.transform(groups, applyRules);
			insightResults = this.convertTransformedResults(transformedResults, options);
		}
		// Apply ORDER (sort results)
		if (options.ORDER) {
			insightResults = this.sortResults(insightResults, options.ORDER);
		}
		return insightResults;
	}

	private convertTransformedResults(transformedResults: Map<string, any>, options: QueryOptions): InsightResult[] {
		let results: InsightResult[] = [];
		transformedResults.forEach((value, key) => {
			let resultEntry: InsightResult = {};
			options.COLUMNS.forEach((column) => {
				if (Object.prototype.hasOwnProperty.call(value, column)) {
					// This approach safely checks for the property
					resultEntry[column] = value[column];
				} else {
					// Handling group columns or other cases as necessary
					// Adjust based on your specific implementation details
				}
			});

			results.push(resultEntry);
		});
		return results;
	}

	private applyOptions(filteredResults: Section[], options: QueryOptions): InsightResult[] {
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
		return projectedResults;
	}

	private sortResults(results: InsightResult[], order: any): InsightResult[] {
		// Check if 'order' is a string (single key sort) or object (potential multi-key sort)
		const keys = (typeof order === "string") ? [order] : order.keys;
		const direction = (typeof order === "string") ? "UP" : order.dir;

		// Determine the sort direction multiplier to invert the comparison for descending order
		const dirMultiplier = (direction === "UP") ? 1 : -1;
		// Sorting function that can handle multiple keys
		const multiKeySort = (a: InsightResult, b: InsightResult) => {
			for (const key of keys) {
				// In case of nested properties, you may need to modify this accessor
				if (a[key] < b[key]) {
					return -1 * dirMultiplier;
				} else if (a[key] > b[key]) {
					return 1 * dirMultiplier;
				}
				// If values are equal, continue to the next key
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
