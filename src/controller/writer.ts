import * as fs from "fs-extra";
import {InsightDataset} from "./IInsightFacade";

export default class Writer {
	private dataDir: string = "";
	private datasets: {[id: string]: InsightDataset} = {};

	constructor(dataDir: string, datasets: {[id: string]: InsightDataset}) {
		this.dataDir = dataDir;
		this.datasets = datasets;
	}

	public setDatasets(datasets: {[id: string]: InsightDataset}) {
		this.datasets = datasets;
	}

	// writes a dataset to a JSON file
	public async writeDataset(datasetObj: any, id: string) {
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

	public async writeDict() {
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
}
