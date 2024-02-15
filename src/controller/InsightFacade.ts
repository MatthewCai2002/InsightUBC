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
		// Continue with query processing on the loaded dataset...
		// This would involve filtering the dataset based on the WHERE clause,
		// applying any transformations, and then selecting/sorting based on OPTIONS.
		// const res = this.transformToInsightResult(filteredResults);
		return insightResults;
	}

	private applyOptions(filteredResults: Section[], options: QueryOptions): InsightResult[] {
		const projectedResults: InsightResult[] = filteredResults.map((item) => {
			const projectedItem: InsightResult = {};
			options.COLUMNS.forEach((column) => {
				// Make sure the column is a key of Section
				if (column in item) {
					const key = `sections_${column}` as keyof InsightResult;
					// Use type assertion for column to be treated as keyof Section
					const itemKey = column as keyof Section;
					projectedItem[key] = item[itemKey];
				}
			});
			return projectedItem;
		});

		// Sort results if ORDER is specified
		if (options.ORDER) {
			const orderKey = `sections_${options.ORDER}` as keyof InsightResult;
			projectedResults.sort((a, b) => {
				// Assuming all sortable values are numbers for simplicity
				// You may need additional logic here to handle different types
				return (a[orderKey] as any) - (b[orderKey] as any);
			});
		}
		return projectedResults;
	}

	// public transformToInsightResult(dataset: Section[]): InsightResult[] {
	// 	return dataset.map((section: any) => {
	// 		// Create a new object that conforms to the InsightResult interface
	// 		let result: InsightResult = {};
	//
	// 		// Iterate over the properties of the section.value object
	// 		for (const [key, value] of Object.entries(section.value)) {
	// 			// Assign each key-value pair to the result object
	// 			result[key] = value;
	// 		}
	//
	// 		// Return the transformed result
	// 		return result;
	// 	});
	// }

	private async loadDataset(datasetId: string): Promise<any> {
		// loads the dataset in
		const datasetPath = this.dataDir + datasetId + ".json"; // Assuming this.dataDir is './data/'
		try {
			const dataset = await fs.readJson(datasetPath);
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

// TODO: determine the dataset to query using ID
//		1. dataset JSON files in./data/ are named with their ID
//			a. can iterate through all files in ./data/ to find a JSON file with name == ID
//		2. load that JSON file
// takes in an already parsed JSON object
// makes sure that the query is valid

// TODO: query through dataset to find data that matches query
//		1. this will be done recursively
//			a. idea is that we will recurse until a leaf clause (just a clause with no nested clauses)
//			-> then filter through all sections using just the leaf clause
//			-> then return the result of this filtering (array) to the callee
//			-> this means that we pass filtered data to the higher level clauses
//			-> then the higher level clauses will apply their own filter
//			-> essentially layering filters on top of each other
//			-> eventually we return back up to the WHERE clause which is when we finish querying
//		2. need a function to handle every EBNF keyword
//			a. ie: handleWhere would be the highest level function
//				which calls the other filtering functions appropriately depending
//				depending on what clauses are in the where (might need a switch statement to do this)
//		3. we have a top level function which takes in a query obj
//			handles any preprocessing needed, formatting, calling handlers, returning the final result etc
//				will also need to handle test queries with an expected field in the JSON file
//				^^^ this part might not be right and might be handled by the test suite actually
//			a. should call handleWhere, handleOptions etc
// TODO: validate Query recursively.
//		 1. check if the query follows EBNF
//			- all queries need to have a WHERE clause
//			a. (ie: query has a WHERE clause, and looks like WHERE: {EQ: ubc.id is 1}} or something)
//				- as we check through where and options we must check for db references
//			b. need to check if current keyword is an EBNF keyword
//			c. need to check if current word is being used correctly
//				- ie: IS: {ubc.id: 1} is how you use the IS keyword
//				      but IS: [{ubc.id: 1}, {ubc.id: 2}] isn't.
//				- this part will have to be done recursively
//					-> curr word is only valid of all children are valid
//					-> need to check if chlidren are valid
//					-> keep recursing until a leaf node (a clause with no nested clauses)
//					-> return up the call stack until curr.
//					-> if curr and all its children are valid then curr is valid
//		 2. check if the query references 1 DB.
//		 	a. (ie: ubc.id is 1 is fine but ubc.id is ubc2.id isn't)
//			b. maybe we could have a dictionary with all the DBs seen so far and length should be < 2
//				- then as we recurse through the query we can just check the length of this each time
//		 3. cannot check for the 5000 result limit initially, so check it as we find results.
//			a. put results into an array and at the end of performQuery if arr.length > 5000 then return invalid
