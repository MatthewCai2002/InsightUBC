import Section from "./section";
import {InsightError, InsightResult, ResultTooLargeError} from "./IInsightFacade";

export default class Filter {
	public filterByWhereClause(dataset: Section[], whereClause: any): Section[] {
		// Explicit typing for operator and conditions helps with code clarity and type checking
		if (Object.keys(whereClause).length === 0) {
			return dataset;
		}
		const res = this.callFilter(whereClause, dataset);
		if (res.length > 5000) {
			throw new ResultTooLargeError("result has over 5000 items");
		}
		return res;
	}

	private callFilter(query: any, dataset: Section[]): Section[] {
		const key = Object.keys(query)[0];
		switch (key) {
			// these 2 take lists of filters
			case "AND":
				return this.handleListQuery(query.AND, dataset, "AND");
			case "OR":
				return this.handleListQuery(query.OR, dataset, "OR");
			// this can have nested filters
			case "NOT": {
				const notConditionResult = this.callFilter(query.NOT, dataset);
				// Return the sections that are in the original dataset but not in the notConditionResult
				return dataset.filter((section) => !notConditionResult.includes(section));
			}
			// return this.callFilter(query.NOT, dataset);

			// these ones can't have nested filters (base case)
			case "IS":
				return this.handleIs(query.IS, dataset);
			case "LT":
			case "GT":
			case "EQ":
				return this.handleInequality(query, dataset);
			default:
				// can't have string just on it's own in a where
				// must be nested inside one of the above filters
				return [];
		}
	}

	private handleListQuery(conditions: any[], dataset: Section[], operator: string): Section[] {
		if (operator === "AND") {
			// For AND, every condition must be true for a section to be included
			return conditions.reduce((acc: Section[], condition) => {
				// Ensure that acc is filtered by each condition
				return acc.filter((section) => this.callFilter(condition, [section]).length > 0);
			}, dataset); // dataset is the initial value, ensuring acc starts as an array
		} else if (operator === "OR") {
			// For OR, a section must meet at least one condition to be included
			let result = new Set<Section>(); // Use a Set to avoid duplicates
			conditions.forEach((condition) => {
				this.callFilter(condition, dataset).forEach((section) => result.add(section));
			});
			return Array.from(result); // Convert the Set back to an array
		}
		return []; // If operator is neither AND nor OR, return an empty array
	}

	private handleIs(query: any, dataset: Section[]): Section[] {
		const key = Object.keys(query)[0] as keyof Section; // Safely access the property key
		const value: string = query[key] as string; // Ensure the value is treated as a string
		const parts = key.split("_");
		const field = parts[1];
		// Convert wildcard pattern to regex for comparison
		const pattern = value.replace(/\*/g, ".*"); // Convert wildcard (*) to regex equivalent (.*)
		const regex = new RegExp(`^${pattern}$`, "i"); // 'i' for case-insensitive match
		let res = dataset.filter((section: any) => {
			const sectionValue = section.value[field];
			// Ensure the value being compared is a string
			return typeof sectionValue === "string" && regex.test(sectionValue);
		});

		return res;
	}

	private handleInequality(query: any, dataset: Section[]): Section[] {
		const operator = Object.keys(query)[0];
		const condition = query[operator];
		const mKey = Object.keys(condition)[0];
		const keyParts = mKey.split("_");
		const field = keyParts[1];
		const value = condition[mKey];
		let res = dataset.filter((section: any) => {
			switch (operator) {
				case "GT":
					return section.value[field] > value;
				case "LT":
					return section.value[field] < value;
				case "EQ":
					return section.value[field] === value;
				default:
					return false;
			}
		});

		return res;
	}
}
