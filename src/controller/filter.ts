import Section from "./section";
import {InsightResult} from "./IInsightFacade";

export default class Filter {
	public filterByWhereClause(dataset: Section[], whereClause: any): Section[] {
		// Explicit typing for operator and conditions helps with code clarity and type checking
		// MADE ESLINT SUPRESSIONS
		if (Object.keys(whereClause).length === 0) {
			return dataset;
		}

		// const keyWord: string = Object.keys(whereClause)[0];
		// const nestedQuery: any = whereClause[keyWord]; // Consider defining a type for conditions
		// let results: Section[] = [];
		// const notResults: Section[] = [];
		return this.callFilter(whereClause, dataset);
		// switch (keyWord) {
		// 	case "AND":
		// 		// Here, TypeScript knows conditions must be an array, so we can avoid explicit 'any' typing
		// 		return nestedQuery.reduce(
		// 			(result: Section[], condition: any) => this.filterByWhereClause(result, condition),
		// 			dataset
		// 		);
		// 	case "OR":
		// 		nestedQuery.forEach((condition: any) => {
		// 			const conditionResults: Section[] = this.filterByWhereClause(dataset, condition);
		// 			results = [...results, ...conditionResults.filter((item) => !results.includes(item))];
		// 		});
		// 		return results;
		// 	case "NOT":
		// 		return dataset.filter((item) => !notResults.includes(item));
		// 	default:
		// 		return this.handleComparisonOperations(dataset, keyWord, nestedQuery);
		// }
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
			case "NOT":
				return this.callFilter(query.NOT, dataset);

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
		const field = Object.keys(query)[0] as keyof Section; // Safely access the property key
		const value: string = query[field] as string; // Ensure the value is treated as a string

		// Convert wildcard pattern to regex for comparison
		const pattern = value.replace(/\*/g, ".*"); // Convert wildcard (*) to regex equivalent (.*)
		const regex = new RegExp(`^${pattern}$`, "i"); // 'i' for case-insensitive match

		return dataset.filter((section) => {
			const sectionValue = section[field];
			// Ensure the value being compared is a string
			return typeof sectionValue === "string" && regex.test(sectionValue);
		});
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

	private handleComparisonOperations(dataset: any[], operator: string, condition: any): any[] {
		const field = Object.keys(condition)[0];
		const value = condition[field];

		return dataset.filter((section) => {
			switch (operator) {
				case "GT":
					return section[field] > value;
				case "LT":
					return section[field] < value;
				case "EQ":
					return section[field] === value;
				case "IS":
					return new RegExp(`^${value.replace(/\*/g, ".*")}$`).test(section[field]);
				default:
					return true; // Or handle invalid operator
			}
		});
	}


}
