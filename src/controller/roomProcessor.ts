import JSZip from "jszip";
import {InsightError} from "./IInsightFacade";

export default class RoomProcessor {

	public static async readBuildingFile(href: string, zip: JSZip): Promise<string> {
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
