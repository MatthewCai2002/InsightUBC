import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, InsightResult} from "./IInsightFacade";
import * as fs from "fs-extra";
import JSZip from "jszip";

interface CourseSection {
	[key: string]: any; // Define more specific type based on spec requirements
}
export default class InsightFacade implements IInsightFacade {
	private datasets: {[id: string]: InsightDataset} = {};
	private readonly dataDir = "./data";

	constructor() {
		console.log("InsightFacade::init()");
		fs.ensureDirSync(this.dataDir);
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!id.trim() || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid dataset ID."));
		}
		if (this.datasets[id]) {
			return Promise.reject(new InsightError("Dataset with the same ID already exists."));
		}

		try {
			const zip = new JSZip();
			const decodedContent = Buffer.from(content, "base64");
			const unzippedContent = await zip.loadAsync(decodedContent);
			let dataset: InsightDataset;

			switch (kind) {
				case InsightDatasetKind.Sections:
					dataset = await this.processCoursesDataset(id, unzippedContent);
					break;
				default:
					return Promise.reject(new InsightError("Unsupported dataset kind."));
			}

			this.datasets[id] = dataset;
			await fs.writeJson(`${this.dataDir}/${id}.json`, dataset);
			return Promise.resolve(Object.keys(this.datasets));
		} catch (error) {
			return Promise.reject(new InsightError(`Failed to add dataset: ${error}`));
		}
	}

	private async processCoursesDataset(id: string, zip: JSZip): Promise<InsightDataset> {
		let numRows = 0;
		const sections: CourseSection[] = [];

		// Iterate over each file in the zip
		await Promise.all(Object.keys(zip.files).map(async (fileName) => {
			if (fileName.endsWith(".json")) {
				const fileContent = await zip.file(fileName)!.async("string");
				const jsonContent = JSON.parse(fileContent);

				// Assuming jsonContent is an array of course sections
				jsonContent.forEach((section: CourseSection) => {
					// Validate section based on spec
					if (this.isValidSection(section)) {
						sections.push(section);
						numRows++;
					}
				});
			}
		}));

		// Convert sections to a format suitable for querying
		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Sections,
			numRows
		};

		// Optionally, process sections array further if needed
		// Save the processed dataset to disk or keep it in memory as required

		return dataset;
	}

	private isValidSection(section: CourseSection): boolean {
		// Implement validation logic based on spec
		// Check required fields, data types, etc.
		return true; // Placeholder implementation
	}


	public async removeDataset(id: string): Promise<string> {
		return Promise.reject("Not implemented.");
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
		// Implement query validation logic based on your spec
		return true; // Placeholder
	}

	private extractDatasetId(query: any): string | null {
		// Extract and return the dataset ID from the query
		return "datasetId"; // Placeholder
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
		return Promise.reject("Not implemented.");
	}
}
