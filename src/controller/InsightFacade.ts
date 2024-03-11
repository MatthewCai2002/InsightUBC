import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError, ResultTooLargeError,
} from "./IInsightFacade";
import * as fs from "fs-extra";
import JSZip from "jszip";
import Section from "./section";
import Validator from "./validator";
import Filter from "./filter";

// Assuming the structure of your options object based on the provided code
interface QueryOptions {
	COLUMNS: string[];
	ORDER?: string; // Optional
}

export default class InsightFacade implements IInsightFacade {
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

	private datasets: {[id: string]: InsightDataset} = {};
	private readonly dataDir = "./data/";

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID"));
		}

		try {
			await fs.promises.access(this.dataDir + "datasets.json");
			this.datasets = await fs.readJSON("././data/datasets.json", {throws: false});
		} catch (e) {
			// doesn't matter
		}

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
				default:
					return Promise.reject(new InsightError("Unsupported dataset kind."));
			}

			// add dataset to dataset dict
			this.datasets[id] = dataset;

			// write dataset dict to folder for persistence on crash
			await this.writeDict();

			// return array of all added datasets
			// console.log(Object.keys(this.datasets));
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
		if (!this.isValidDataset(jsonStrings)) {
			// console.log("invalid dataset");
			throw new InsightError("Invalid Dataset");
		}
		// console.log("valid dataset");

		let datasetObj: any = {};
		// setup dataset JSON obj to write later

		// for each course
		for (let str of jsonStrings) {
			// if string is empty then skip it
			if (!str) {
				continue;
			}

			let course: any = {};

			try {
				course = JSON.parse(str);
			} catch (e) {
				// if not a JSON file then throw error
				throw new InsightError("unsupported file type");
			}

			// convert all sections of a course to TS classes
			let sections = this.createSections(course);

			// add sections to dataset JSON object to be written later
			this.updateDatasetObj(datasetObj, sections);
		}

		// write datasetOBJ to json file in ./src/controller/data/ dir
		await this.writeDataset(datasetObj, id);

		// create InsightDataset obj and fill in proper values
		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Sections,
			numRows: Object.keys(datasetObj).length,
		};

		return dataset;
	}

	// writes a dataset to a JSON file
	private async writeDataset(datasetObj: any, id: string) {
		// check if data directory exists
		try {
			// Check if the directory exists; if not, try to create it
			await fs.promises.stat(this.dataDir).catch(async () => {
				console.log(`Directory '${this.dataDir}' does not exist.`);
				await fs.promises.mkdir(this.dataDir);
				console.log(`Directory '${this.dataDir}' created successfully.`);
			});

			// Prepare the dataset JSON string
			const datasetJSONString = JSON.stringify(datasetObj, null, 2);

			// Write the file
			await fs.promises.writeFile(this.dataDir + id + ".json", datasetJSONString, "utf-8");
			console.log("File has been written successfully.");
		} catch (e) {
			console.error("Error writing to file or creating directory:", e);
		}
	}

	private async writeDict() {
		// check if data directory exists
		try {
			// Check if the directory exists; if not, try to create it
			await fs.promises.stat(this.dataDir).catch(async () => {
				console.log(`Directory '${this.dataDir}' does not exist.`);
				await fs.promises.mkdir(this.dataDir);
				console.log(`Directory '${this.dataDir}' created successfully.`);
			});

			// Prepare the dataset JSON string
			const datasetJSONString = JSON.stringify(this.datasets, null, 2);

			// Write the file
			await fs.promises.writeFile("./data/datasets.json", datasetJSONString, "utf-8");
			console.log("File has been written successfully.");
		} catch (e) {
			console.error("Error writing to file or creating directory:", e);
		}
	}

	// adds sections to a dataset JSON obj
	private updateDatasetObj(datasetObj: any, sections: Section[]): void {
		for (let section of sections) {
			datasetObj[section.uuid] = section;
		}
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
	private isValidDataset(jsonStrings: string[]): boolean {
		let validCourses: boolean[] = [];

		// go through each course and validate it
		for (let str of jsonStrings) {
			// if string is empty then skip it
			if (!str) {
				continue;
			}
			let course = JSON.parse(str);
			let validCourse = this.isValidCourse(course);
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
	private isValidCourse(course: any): boolean {
		// sections are contained within results
		let validSections: boolean[] = [];
		const results: any[] = course.result;

		// handle empty sections
		if (results.length < 1) {
			return false;
		}
		// check if all sections of a course are valid or not
		// for each section check if it's valid
		results.forEach((section: any) => {
			let validSection = this.isValidSection(section);
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
	private isValidSection(section: any): boolean {
		this.fileFields.forEach((field: string) => {
			if (!(field in section)) {
				return false;
			}
		});
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
		const filteredResults = filterer.filterByWhereClause(dataset, query.WHERE);
		const insightResults: InsightResult[] = this.applyOptions(filteredResults, options);

		return insightResults;
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
