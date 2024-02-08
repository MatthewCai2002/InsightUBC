import {IInsightFacade, InsightDatasetKind, InsightError} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives, readFileQueries} from "../TestUtil";
import {before} from "mocha";
import JSZip from "jszip";

use(chaiAsPromised);

export interface ITestQuery {
	title: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("courses_test.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		before(async function () {
			// This block runs once and loads the datasets.
			sections = await getContentFromArchives("courses_test.zip");

			// Just in case there is anything hanging around from a previous run of the test suite
			await clearDisk();
		});

		beforeEach(async function () {
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});

		it("reject with  an empty dataset id", async function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Reject with empty ID, valid section", function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Reject with invalid ID, invalid section", async function () {
			sections = await getContentFromArchives("courses_invalid.zip");
			const result = facade.addDataset(" ", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Reject with invalid ID, valid section", function () {
			const result = facade.addDataset(" ", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Reject with valid ID, invalid section", async function () {
			sections = await getContentFromArchives("courses_invalid.zip");
			const result = facade.addDataset("1", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Reject with invalid Kind", function () {
			const result = facade.addDataset("1", sections, InsightDatasetKind.Rooms);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("Accept with valid ID", async function () {
			console.log();
			const result = facade.addDataset("1", sections, InsightDatasetKind.Sections);
			// const list = facade.listDatasets();
			//
			// await expect(list).to.eventually.be.an("array").with.lengthOf(1);
			return expect(result).to.eventually.have.members(["1"]);
		});

		it("Accept with different ID", async function () {
			await facade.addDataset("1", sections, InsightDatasetKind.Sections);

			const result = facade.addDataset("2", sections, InsightDatasetKind.Sections);
			// const list = facade.listDatasets();
			//
			// await expect(list).to.eventually.be.an("array").with.lengthOf(2);
			return expect(result).to.eventually.have.members(["1","2"]);
		});
	});

	// describe("ProcessDataset", function () {
	// 	beforeEach(function () {
	// 		// This section resets the insightFacade instance
	// 		// This runs before each test
	// 		facade = new InsightFacade();
	// 	});
	//
	// 	afterEach(async function () {
	// 		// This section resets the data directory (removing any cached data)
	// 		// This runs after each test, which should make each test independent of the previous one
	// 		await clearDisk();
	// 	});
	//
	// 	it("Reject with 1 invalid course", async function () {
	// 		sections = await getContentFromArchives("courses_1_invalid.zip");
	//
	// 		const zip = new JSZip();
	// 		const decodedContent = Buffer.from(sections, "base64");
	// 		const unzippedContent = await zip.loadAsync(decodedContent, {base64: true});
	//
	// 		const res = await facade.processCoursesDataset("1", unzippedContent);
	// 		return expect(res).to.deep.equal(['{"result":[],"rank":0}']);
	// 	});
	//
	// 	it("Accept with valid dataset, valid and invalid courses", async function () {
	// 		sections = await getContentFromArchives("courses_test.zip");
	//
	// 		const zip = new JSZip();
	// 		const decodedContent = Buffer.from(sections, "base64");
	// 		const unzippedContent = await zip.loadAsync(decodedContent, {base64: true});
	//
	// 		const res = await facade.processCoursesDataset("1", unzippedContent);
	// 		return expect(res).to.deep.equal(['{"result":[],"rank":0}']);
	// 	});
	// });

	/*
	 * This test suite dynamically generates tests from the JSON files in test/resources/queries.
	 * You can and should still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery", function () {
		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [facade.addDataset("sections", sections, InsightDatasetKind.Sections)];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		describe("valid queries", function () {
			let validQueries: ITestQuery[];
			try {
				validQueries = readFileQueries("valid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			validQueries.forEach(function (test: any) {
				it(`${test.title}`, function () {
					return facade
						.performQuery(test.input)
						.then((result) => {
							assert.fail("Write your assertions here!");
						})
						.catch((err: any) => {
							assert.fail(`performQuery threw unexpected error: ${err}`);
						});
				});
			});
		});

		describe("invalid queries", function () {
			let invalidQueries: ITestQuery[];

			try {
				invalidQueries = readFileQueries("invalid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			invalidQueries.forEach(function (test: any) {
				it(`${test.title}`, function () {
					return facade
						.performQuery(test.input)
						.then((result) => {
							assert.fail(`performQuery resolved when it should have rejected with ${test.expected}`);
						})
						.catch((err: any) => {
							if (test.expected === "InsightError") {
								expect(err).to.be.instanceOf(InsightError);
							} else {
								assert.fail("Query threw unexpected error");
							}
						});
				});
			});
		});
	});
});
