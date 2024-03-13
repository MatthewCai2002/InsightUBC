
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

	public static findAllElementsByClassAndTag(node: any, className: string, tag: string, elements: any[]): void {
		if (node.attrs &&
			node.attrs.find((attr: any) => attr.name === "class" && attr.value.includes(className)) &&
			node.nodeName === tag) {
			elements.push(node);
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				this.findAllElementsByClassAndTag(childNode, className, tag, elements);
			}
		}
	}
}


