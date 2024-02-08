import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "./IInsightFacade";
import * as fs from "fs-extra";
import JSZip from "jszip";
import Section from "./section";

export default class InsightFacade implements IInsightFacade {
	private validFields: string[] = ["id", "Course", "Title", "Professor", "Subject",
		"Year", "Avg", "Pass", "Fail", "Audit"];


	private datasets: {[id: string]: InsightDataset} = {};
	private readonly dataDir = "./data/";

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID"));
		}
		if (this.datasets[id]) {
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

			// return array of all added datasets
			console.log(Object.keys(this.datasets));
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
			// parse course into JSON object

			// if string is empty then skip it
			if(!str) {
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
		this.writeDataset(datasetObj, id);

		// create InsightDataset obj and fill in proper values
		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Sections,
			numRows: Object.keys(datasetObj).length
		};

		return dataset;
	}

	// writes a dataset to a JSON file
	private writeDataset(datasetObj: any, id: string) {
		// check if data directory exists
		fs.promises.stat(this.dataDir)
			.then((stats) => {
				// if the data directory exists then write to it
				if (stats.isDirectory()) {
					const datasetJSONString = JSON.stringify(datasetObj, null, 2);
					fs.writeFile(this.dataDir + id + ".json", datasetJSONString, "utf-8", (err) => {
						if (err) {
							console.error("Error writing to file:", err);
						} else {
							console.log("File has been written successfully.");
						}
					});
				} else {
					console.log(`'${this.dataDir}' is not a directory.`);
				}
			}).catch((err) => {
			// make data dir if it doesn't exist
				fs.promises.mkdir(this.dataDir)
					.then(() => {
						console.log(`Directory '${this.dataDir}' created successfully.`);
					})
					.catch((e) => {
						console.error("Error creating directory:", e);
					});
				console.log(`Directory '${this.dataDir}' does not exist.`);
			});
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
			if(!str) {
				continue;
			}

			let course = JSON.parse(str);
			let validCourse = this.isValidCourse(course);
			validCourses.push(validCourse);
		}

		// if every course is invalid then dataset is invalid
		if (validCourses.every((course) => !course)) {
			console.log("invalid dataset");
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
		this.validFields.forEach((field: string) => {
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
		// Step 1: Validate the query
		if (!this.isValidQuery(query)) {
			return Promise.reject(new InsightError("Query is not valid."));
		}
		// Step 2: Determine the dataset ID to query
		const datasetId = this.extractDatasetId(query);
		if (!datasetId || !this.datasets[datasetId]) {
			return Promise.reject(new InsightError("Dataset ID is not found or not loaded."));
		}
		// Load the dataset from disk or memory as needed
		const dataset = await this.loadDataset(datasetId);
		// Step 3: Parse the query to an intermediate representation (e.g., AST)
		const parsedQuery = this.parseQuery(query);
		// Step 4: Execute the query against the dataset
		const results = this.executeQuery(dataset, parsedQuery);
		// Step 5: Return the results
		return Promise.resolve(results);
	}

	private isValidQuery(query: any): boolean {
		// Example: Check if the query has WHERE and OPTIONS sections
		if (!query || !query.WHERE || !query.OPTIONS) {
			return false;
		}
		// Add more specific validations based on your query format
		return true;
	}

	private extractDatasetId(query: any): string | null {
		// Example: Assuming dataset ID is specified in the OPTIONS section
		if (query && query.OPTIONS && query.OPTIONS.datasetId) {
			return query.OPTIONS.datasetId;
		}
		return null;
	}

	private async loadDataset(datasetId: string): Promise<any> {
		// Load and return the dataset from disk or memory
		// This assumes datasets are stored as JSON files in a `dataDir` directory
		try {
			const datasetPath = `${this.dataDir}/${datasetId}.json`;
			return await fs.readJson(datasetPath);
		} catch (error) {
			throw new InsightError(`Failed to load dataset ${datasetId}: ${error}`);
		}
	}

	private parseQuery(query: any): any {
		// Convert the query to an intermediate form, such as an Abstract Syntax Tree (AST)
		// This is highly dependent on your query format and requirements
		return {}; // Placeholder
	}

	private executeQuery(dataset: any, parsedQuery: any): InsightResult[] {
		// Execute the parsed query against the dataset
		// You'll need to implement the logic for filtering data based on the query
		return []; // Placeholder
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// made with chatgpt
		// and an object with kind and numRows as the value
		const datasetList: InsightDataset[] = Object.keys(this.datasets).map((id) => {
			const dataset = this.datasets[id];
			return {
				id: id, // Dataset ID from the dictionary key
				kind: dataset.kind, // Assuming the kind is directly stored in the dataset object
				numRows: dataset.numRows
			};
		});
		return Promise.resolve(datasetList);
	}

}
