import JSZip from "jszip";
import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import HTMLHandler from "./htmlHandler";
import * as parse5 from "parse5";
import Writer from "./writer";


export default class RoomProcessor {

	public static async processRoomsDataset(id: string, zip: JSZip, writer: Writer): Promise<InsightDataset> {
		// check if index.htm is here, if it is open it, if not error
		let jsonPromise: string;
		const indexFile = zip.file("index.htm");
		if (indexFile) {
			jsonPromise = await indexFile.async("text");
		} else {
			throw new InsightError("File 'index.htm' not found in the ZIP archive.");
		}

		// use parsed object to find all <td> with href's that link to rooms
		let elements: any[] = [];
		let indexDocument: any = parse5.parse(jsonPromise);
		HTMLHandler.findAllElementsByClassAndTag(indexDocument, "views-field-title", "td", elements);
		if (elements.length <= 0) {
			throw new InsightError("Invalid index.htm");
		}
		let datasetObj: any = {};

		// iterate over each room and process them
		let nullCount = 0;
		for (const element of elements) {
			let href = HTMLHandler.getHref(element);

			if (href === null) {
				nullCount++;
				continue;
			}

			this.readBuildingFile(href, zip)
				.then((building: string) => {
					this.processRoom(building, datasetObj);
				}, (rejected) => {
					// do other things
				});

		}

		if (nullCount === elements.length) {
			throw new InsightError("Invalid rooms dataset");
		}
		// organiziation of saved data will be like courses
		// json file for each building

		await writer.writeDataset(datasetObj, id);

		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Sections,
			numRows: Object.keys(datasetObj).length,
		};

		return dataset;
	}

	private static processRoom(building: string, dataset: any) {
		//	pass this file to parse5 to get building room page
		let elements: any[] = [];
		let buildingDocument = parse5.parse(building);
		HTMLHandler.findAllElementsByClassAndTag(buildingDocument, "views-field-title", "td", elements);
		if (elements.length <= 0) {
			return;
		}
		let datasetObj: any = {};
		// find valid rooms table. if can't find then doesn't exist -> return
		// create rooms object
		// save rooms object to dataset
	}

	private static async readBuildingFile(href: string, zip: JSZip): Promise<string> {
		// remove any prefixes
		if (href.startsWith("./")) {
			href = href.slice(2, href.length);
		} else if (href.startsWith(".")) {
			href = href.slice(1, href.length);
		}

		let jsonPromise;
		const buildingFile = zip.file(href);
		if (buildingFile) {
			jsonPromise = buildingFile.async("text");
		} else {
			throw new InsightError(`File ${href} not found in the ZIP archive.`);
		}

		return jsonPromise;
	}
}
