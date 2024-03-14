import JSZip from "jszip";
import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import HTMLHandler from "./htmlHandler";
import Room from "./room";
import * as parse5 from "parse5";
import Writer from "./writer";
import {Document} from "parse5/dist/tree-adapters/default";
import http from "http";

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

		const datasetObj = await this.processAllBuildings(links, codes, addresses, zip);

		if (Object.keys(datasetObj).length === 0) {
			throw new InsightError("Invalid rooms dataset");
		}

		await writer.writeDataset(datasetObj, id);

		const dataset: InsightDataset = {
			id,
			kind: InsightDatasetKind.Rooms,
			numRows: Object.keys(datasetObj).length,
		};

		return dataset;
	}

	private async processAllBuildings(links: any[], codes: any[], addresses: any[], zip: JSZip): Promise<any> {
		let datasetObj: any = {};
		let geoLocations: any[];
		try {
			geoLocations = await this.getGeoLocations(addresses);
		} catch (e) {
			throw new InsightError("invalid dataset");
		}

		if (geoLocations.length === 0) {
			throw new InsightError("invalid dataset");
		}

		let buildingPromises: any[] = [];
		let baseRooms: any[] = [];

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
			let codeString: string | null = this.getText(code);
			let addressString: string | null = this.getText(address);

			// check if null
			if (codeString === null || href === null || addressString === null) {
				continue;
			}

			// create initial room obj
			let baseRoom: any = {};
			baseRoom["shortname"] = codeString;
			baseRoom["address"] = addressString;
			baseRoom["lat"] = geoLocation.lat;
			baseRoom["lon"] = geoLocation.lon;

			baseRooms.push(baseRoom);
			buildingPromises.push(this.readBuildingFile(href, zip));
		}

		let buildings = await Promise.all(buildingPromises);

		for (let i = 0; i < baseRooms.length; i++) {
			const building = buildings[i];
			const baseRoom = baseRooms[i];
			this.processBuilding(building, baseRoom, datasetObj);
		}

		return datasetObj;
	}

	private processBuilding(building: string, baseRoom: any, datasetObj: any): void{
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
		let fullname: Document | null = HTMLHandler.findElementByClassAndTag(buildingDocument,
			"field-content", "span");

		// if can't find then rooms table doesn't exist -> return null
		if (roomNum.length <= 0 ||
			capacity.length <= 0 ||
			furnType.length <= 0 ||
			roomType.length <= 0 ||
			fullname === null) {
			return;
		}


		if (roomNum.length !== capacity.length &&
			roomNum.length !== furnType.length &&
			roomNum.length !== roomType.length) {
			return;
		}

		let fullnameString: string | null = this.getText(fullname);

		if (fullnameString === null) {
			return;
		}

		baseRoom["fullname"] = fullnameString;

		// for each row create a rooms object
		for (let i = 0; i < roomNum.length; i++) {
			let roomObj = {...baseRoom};

			// extract info
			const roomNumDoc = roomNum[i];
			const capacityDoc = capacity[i];
			const furnTypeDoc = furnType[i];
			const roomTypeDoc = roomType[i];

			const capacityStr: string | null = this.getText(capacityDoc);
			const furnTypeStr: string | null = this.getText(furnTypeDoc);
			const roomTypeStr: string | null = this.getText(roomTypeDoc);

			if (capacityStr === null || furnTypeStr === null || roomTypeStr === null) {
				continue;
			}

			roomObj["type"] = roomTypeStr;
			roomObj["furniture"] = furnTypeStr;
			roomObj["seats"] = parseInt(capacityStr, 10);
			this.handleRoomNum(roomNumDoc, roomObj);
			roomObj["name"] = roomObj.shortname + "_" + roomObj.number;

			// create new room
			const room = new Room(roomObj);

			// push into dataset
			this.updateDatasetObj(datasetObj, room);
		}
	}


	private handleRoomNum(roomNumDoc: Document, room: any): void {
		const aTag = HTMLHandler.findElementByTag(roomNumDoc, "a");
		const href = HTMLHandler.getHref(aTag);
		const text = this.getText(aTag);

		room["href"] = href;
		room["number"] = text;
	}

	private getText(node: any): string | null{
		let untrimmedString: string | null = HTMLHandler.getTextFromElement(node);

		// propagate null
		if ( untrimmedString === null) {
			return null;
		}

		// remove white space and other characters
		return untrimmedString.trim();
	}

	private async getGeoLocations(addresses: any[]) {
		let fetches = [];
		for (let address of addresses) {
			let addressString: string | null = this.getText(address);

			// check if null
			if (addressString === null) {
				continue;
			}

			// remove white space and other characters
			let url = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team175/" +
				encodeURIComponent(addressString);

			// let res: Promise<Response> = fetch(url);
			let res = this.getGeoPromise(url);
			fetches.push(res);

		}

		let responses: string[] = await Promise.all(fetches);
		let geoLocations: any[] = [];
		responses.forEach((res: any) => {
			const toJson = JSON.parse(res);
			geoLocations.push(toJson);
		});

		return geoLocations;
	}

	private getGeoPromise(url: string) {
		return new Promise<string>((resolve, reject) => {
			const request = http.get(url, (response: http.IncomingMessage) => {
				let data = "";

				// A chunk of data has been received
				response.on("data", (chunk) => {
					data += chunk;
				});

				// The whole response has been received
				response.on("end", () => {
					resolve(data);
				});
			});

			// Handle errors
			request.on("error", (error) => {
				reject(error);
			});
		});
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
		datasetObj[room.name] = room;
	}
}
