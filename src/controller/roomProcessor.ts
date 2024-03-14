import JSZip from "jszip";
import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import HTMLHandler from "./htmlHandler";
import Room from "./room";
import * as parse5 from "parse5";
import Writer from "./writer";
import {Document} from "parse5/dist/tree-adapters/default";

// TODO:
// Change room.ts so its not cooked
// write invalid tests in Insight.spec.ts
// call the geolocator
// get the elements that are not td
// get span fild content
// get div field content
// save the link for more info. Grab the Href and sve that
//


export default class RoomProcessor {
	private http = require("http");
	public async processRoomsDataset(id: string, zip: JSZip, writer: Writer): Promise<InsightDataset> {
		// check if index.htm is here, if it is open it, if not error
		let indexDocument = await this.extractIndexHTM(zip);

		// get building links, codes, and addresses
		let links: any[] = HTMLHandler.findAllElementsByClassAndTag(indexDocument,
			"views-field-title", "td");
		let codes: any[] = HTMLHandler.findAllElementsByClassAndTag(indexDocument,
			"views-field-field-building-code", "td");
		let addresses: any[] = HTMLHandler.findAllElementsByClassAndTag(indexDocument,
			"views-field-field-building-address", "td");

		if (links.length <= 0 || codes.length <= 0 || addresses.length <= 0) {
			throw new InsightError("Invalid index.htm");
		}

		if (links.length !== codes.length && links.length !== addresses.length) {
			throw new InsightError("Invalid index.htm");
		}

		let datasetObj: any = {};

		// iterate over each room and process them
		let nullCount = await this.handleRooms(links, codes, addresses, zip, datasetObj);

		if (nullCount === links.length || Object.keys(datasetObj).length === 0) {
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

	private async handleRooms(links: any[], codes: any[], addresses: any[], zip: JSZip, datasetObj: any) {
		let nullCount = 0;
		let geoLocations = await this.getGeoLoctions(addresses);

		for (let i = 0; i < links.length; i++) {
			const link = links[i];
			const code = codes[i];
			const address = addresses[i];
			const geoLocation = geoLocations[i];

			if ("error" in geoLocation) {
				continue;
			}

			// get the href, code, and address
			let href: string | null = HTMLHandler.getHref(link);
			let codeString: string | null = HTMLHandler.getTextFromTD(code);
			let addressString: string | null = HTMLHandler.getTextFromTD(address);

			// check if null
			if (codeString === null || href === null || addressString === null) {
				nullCount++;
				continue;
			}

			// remove white space and other characters
			codeString = codeString.trim();
			addressString = addressString.trim();

			// create initial room obj
			let initRoom: any = {};
			initRoom["shortname"] = code;
			initRoom["address"] = address;
			initRoom["lat"] = geoLocation.lat;
			initRoom["lon"] = geoLocation.lon;

			this.readBuildingFile(href, zip)
				.then((building: string) => {
					const room: Room | null = this.processRoom(building, initRoom);
					if (room === null) {
						return;
					}

					this.updateDatasetObj(datasetObj, room);
				}, (rejected) => {
					// do other things
				});
		}
		return nullCount;
	}

	private processRoom(building: string, room: any): Room | null{
		//	pass this file to parse5 to get building room page
		let buildingDocument = parse5.parse(building);

		// get room number, capacity,furniture type, and room type
		let roomNum: any[] = HTMLHandler.findAllElementsByClassAndTag(buildingDocument,
			"views-field-field-room-number", "td");
		let capacity: any[] = HTMLHandler.findAllElementsByClassAndTag(buildingDocument,
			"views-field-field-room-capacity", "td");
		let furnType: any[] = HTMLHandler.findAllElementsByClassAndTag(buildingDocument,
			"views-field-field-room-furniture", "td");
		let roomType: any[] = HTMLHandler.findAllElementsByClassAndTag(buildingDocument,
			"views-field-field-room-type", "td");
		let moreInfo: any[] = HTMLHandler.findAllElementsByClassAndTag(buildingDocument,
			"views-field-nothing", "td");
		let fullname: Document | null = HTMLHandler.findElementByClassAndTag(buildingDocument,
			"field-content", "span");

		// if can't find then rooms table doesn't exist -> return null
		if (roomNum.length <= 0 ||
			capacity.length <= 0 ||
			furnType.length <= 0 ||
			roomType.length <= 0 ||
			moreInfo.length <= 0) {
			return null;
		}

		if (roomNum.length !== capacity.length &&
			roomNum.length !== furnType.length &&
			roomNum.length !== roomType.length &&
			roomNum.length !== moreInfo.length) {
			return null;
		}

		// for each row create a rooms object
		// save rooms object to dataset
		return new Room(room);
	}

	private async getGeoLoctions(addresses: any[]) {
		let fetches = [];
		for (let address of addresses) {
			let addressString: string | null = HTMLHandler.getTextFromTD(address);

			// check if null
			if (addressString === null) {
				continue;
			}

			// remove white space and other characters
			addressString = addressString.trim();
			let url = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team175/" +
				encodeURIComponent(addressString);

			let res: Promise<Response> = fetch(url);
			fetches.push(res);
		}

		let responses: Response[] = await Promise.all(fetches);
		let geoPromises: any[] = [];
		responses.forEach((res: any) => {
			const toJsonPromise = res.json();
			geoPromises.push(toJsonPromise);
		});

		return await Promise.all(geoPromises);
	}

	private async extractIndexHTM(zip: JSZip) {
		let jsonPromise: string;
		const indexFile = zip.file("index.htm");
		if (indexFile) {
			jsonPromise = await indexFile.async("text");
		} else {
			throw new InsightError("File 'index.htm' not found in the ZIP archive.");
		}

		let indexDocument: any = parse5.parse(jsonPromise);
		return indexDocument;
	}

	private async readBuildingFile(href: string, zip: JSZip): Promise<string> {
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

	private updateDatasetObj(datasetObj: any, room: Room | null): void {
		if (room == null) {
			return;
		}
		datasetObj[room.shortname] = room;
	}
}
