import {IInsightFacade, InsightDatasetKind, InsightError, NotFoundError} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives, readFileQueries} from "../TestUtil";
import {after, before} from "mocha";
import TestValidator from "../testValidator";
import * as fs from "fs-extra";

use(chaiAsPromised);

export interface ITestQuery {
	title: string; // title of the test case
	input: unknown; // the query under test
	errorExpected: boolean; // if the query is expected to throw an error
	expectedErrorClass: string;
	expected: any; // the expected result
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;
	let validator: TestValidator;
	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	before(async function () {
		// This block runs once and loads the datasets.

		sections = await getContentFromArchives("pair.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});
	describe("AddDataset", function () {
		before(async function () {
			sections = await getContentFromArchives("pair.zip");
		});
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
			sections = await getContentFromArchives("pair.zip");
		});

		afterEach(async function () {
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

		it("Accept adding valid dataset", async function () {
			const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.deep.equal(["ubc"]);
		});

		it("Accept adding valid rooms", async function () {
			sections = await getContentFromArchives("campus.zip");
			const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Rooms);
			return expect(result).to.deep.equal(["ubc"]);
		});
	});

	// describe("Add dataset, no clearDisk", function () {
	// 	before(async function () {
	// 		await clearDisk();
	// 		sections = await getContentFromArchives("pair.zip");
	// 	});
	//
	// 	beforeEach(async function () {
	// 		facade = new InsightFacade();
	// 	});
	//
	// 	// after(async function () {
	// 	// 	await clearDisk();
	// 	// });
	//
	// 	it("add 2 datasets", async function () {
	// 		await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
	// 		const result = await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
	//
	// 		return expect(result).to.deep.equal(["ubc", "ubc2"]);
	// 	});
	// });

	/*
	 * This test suite dynamically generates tests from the JSON files in test/resources/queries.
	 * You can and should still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("List Dataset", function () {
		before(async function () {
			sections = await getContentFromArchives("pair.zip");
		});
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		it("should return an empty array when no datasets have been added", async function () {
			try {
				const result = await facade.listDatasets();
				expect(result).to.be.an("array").that.is.empty;
			} catch (error) {
				expect.fail("Should not have thrown any error");
			}
		});
		it("should list datasets correctly when one dataset has been added", async function () {
			const expectedRows = 64612;
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				// trying to add the dataset
				const result = await facade.listDatasets();
				// set the result to the listDataset
				expect(result).to.deep.equal([{id: "ubc", kind: InsightDatasetKind.Sections, numRows: expectedRows}]);
				// expect the result to be include the validID in the dataset. Needs to be one more becasue we added another
				// row, since we start with 64612
			} catch (error) {
				expect.fail("Should not have thrown any error");
			}
		});
		it("should list datasets correctly after removing a dataset", async function () {
			const expectedRowsUbc = 64612;
			const expectedRowsUbc2 = 64612;
			try {
				// Add two datasets
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);

				// Remove one dataset
				await facade.removeDataset("ubc");

				// List datasets and verify
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([
					{id: "ubc2", kind: InsightDatasetKind.Sections, numRows: expectedRowsUbc2},
				]);
			} catch (error) {
				expect.fail("Should not have thrown any error");
			}
		});
		it("should list multiple datasets correctly", async function () {
			const expectedRow1 = 64612; // from the UBC course page
			const expectedRow2 = 64612;
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([
					{id: "ubc", kind: InsightDatasetKind.Sections, numRows: expectedRow1},
					{id: "ubc2", kind: InsightDatasetKind.Sections, numRows: expectedRow2},
					// would need to be incremented by 1 becasue we added one more
				]);
			} catch (error) {
				expect.fail("Should not have thrown any error");
			}
		});
	});
	describe("remove Dataset", function () {
		before(async function () {
			sections = await getContentFromArchives("pair.zip");
		});
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		it("should remove a dataset that exists", async function () {
			try {
				await facade.addDataset("validId", sections, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("validId");
				expect(result).to.equal("validId");
			} catch (error) {
				expect.fail("Should not have thrown any error");
			}
		});
		// Test Case: Removing Non-existent Dataset
		it("should reject removing a dataset that does not exist", async function () {
			try {
				await facade.removeDataset("nonExistentId");
				expect.fail("Should have thrown NotFoundError");
			} catch (error) {
				expect(error).to.be.instanceOf(NotFoundError);
			}
		});
		it("should reject removing a dataset with an ID of only whitespace", async function () {
			try {
				await facade.removeDataset("    ");
				expect.fail("Should have thrown InsightError");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});
		it("should reject removing a dataset with an ID containing an underscore", async function () {
			try {
				await facade.removeDataset("invalid_id");
				expect.fail("Should have thrown InsightError");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});
		//
		it("should reject removing a dataset with an empty string ID", async function () {
			try {
				await facade.removeDataset("");
				expect.fail("Should have thrown InsightError");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});
		// all of the removeDatasets were made using the first addDataset and keeping the same template
	});

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
							console.log(result);
							expect(result).to.deep.members(test.expected);
						})
						.catch((err: any) => {
							assert.fail(`performQuery threw unexpected error: ${err}`);
						});
				});
			});
		});

		describe("EBNF queries", function () {
			let validQueries: ITestQuery[];
			try {
				validQueries = readFileQueries("EBNF");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			validQueries.forEach(function (test: any) {
				it(`${test.title}`, function () {
					return facade
						.performQuery(test.input)
						.then((result) => {
							expect(result).to.deep.members(test.expected);
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
							expect(err.constructor.name).to.equal(test.expected);
						});
				});
			});
		});
	});
});
