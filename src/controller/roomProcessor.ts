import JSZip from "jszip";
import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import HTMLHandler from "./htmlHandler";
import * as parse5 from "parse5";
import Writer from "./writer";
// TODO:
// Change room.ts so its not cooked
// write invalid tests in Insight.spec.ts
// call the geolocator
// get the elements that are not td
// get span fild content
// get div field content
// get the room number
// get the capacity
// the furtnite type
// room type
// save the link for more info. Grab the Href and sve that
//


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
		let title: any[] = [];
		let buildingCode: any[] = [];
		let address: any[] = [];
		let indexDocument: any = parse5.parse(jsonPromise);
		// the building Name
		HTMLHandler.findAllElementsByClassAndTag(indexDocument, "views-field-title", "td", title);
		// the Code
		HTMLHandler.findAllElementsByClassAndTag(indexDocument, "views-field-field-building-code", "td", buildingCode);
		// the address
		HTMLHandler.
			findAllElementsByClassAndTag(indexDocument, "views-field-field-building-address", "td", address);
		if (title.length <= 0) {
			throw new InsightError("Invalid index.htm");
		}
		if (buildingCode.length <= 0) {
			throw new InsightError("Invalid index.htm");
		}
		if (address.length <= 0) {
			throw new InsightError("Invalid index.htm");
		}
		let datasetObj: any = {};
		// iterate over each room and process them
		let nullCount = 0;
		for (const element of title) {
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

		if (nullCount === title.length) {
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
