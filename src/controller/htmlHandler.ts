import {Document} from "parse5/dist/tree-adapters/default";
export default class HTMLHandler {
	public static getHref(node: any): string | null {
		if (node.attrs &&
			node.nodeName === "a") {
			let hrefAttr = node.attrs.find((attr: any) => attr.name === "href");
			return hrefAttr.value;
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.getHref(childNode);
				if (result) {
					return result;
				}
			}
		}

		return null;
	}

	public static findElementByClassAndTag(node: any, className: string, tag: string): Document | null {
		if (node.attrs &&
			node.attrs.find((attr: any) => attr.name === "class" && attr.value.includes(className)) &&
			node.nodeName === tag) {
			return node;
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result: Document | null = this.findElementByClassAndTag(childNode, className, tag);
				if (result) {
					return result;
				}
			}
		}

		return null;
	}

	public static findElementByTag(node: any, tag: string): Document | null {
		if (node.nodeName === tag) {
			return node;
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result: Document | null = this.findElementByTag(childNode, tag);
				if (result) {
					return result;
				}
			}
		}

		return null;
	}

	public static findAllElementsByClassAndTag(node: any, className: string, tag: string): any[] {
		let elements: any = [];
		this.findAllElementsHelper(node, className, tag, elements);
		return elements;
	}

	private static findAllElementsHelper(node: any, className: string, tag: string, elements: any[]) {
		if (node.attrs &&
			node.attrs.find((attr: any) => attr.name === "class" && attr.value.includes(className)) &&
			node.nodeName === tag) {
			elements.push(node);
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				this.findAllElementsHelper(childNode, className, tag, elements);
			}
		}
	}

	public static getTextFromElement(node: any): string | null {
		const tag: string = "#text";
		if (node.nodeName === tag) {
			return node.value;
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result: string | null = this.getTextFromElement(childNode);
				if (result) {
					return result;
				}
			}
		}

		return null;
	}
}


