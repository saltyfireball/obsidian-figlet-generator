// Just enough of Obsidian's HTMLElement helpers (createEl, createDiv,
// createSpan, appendText, setCssStyles) to run renderFiglet in node, plus a
// serializer that writes HTML the way createFigletHtml does.

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export class FakeElement {
	constructor(tag) {
		this.tag = tag;
		this.classes = [];
		this.styles = [];
		this.children = [];
	}

	createEl(tag, o = {}) {
		const el = new FakeElement(tag);
		if (o.cls) el.classes.push(...(Array.isArray(o.cls) ? o.cls : o.cls.split(" ")));
		if (o.text !== undefined) el.appendText(o.text);
		this.children.push(el);
		return el;
	}

	createDiv(o) {
		return this.createEl("div", o);
	}

	createSpan(o) {
		return this.createEl("span", o);
	}

	appendText(text) {
		this.children.push(text);
	}

	setCssStyles(styles) {
		for (const [k, v] of Object.entries(styles)) this.styles.push([kebab(k), v]);
	}

	toHtml() {
		const cls = this.classes.length ? ` class="${this.classes.join(" ")}"` : "";
		const style = this.styles.length ? ` style="${escape(this.styles.map(([k, v]) => `${k}: ${v}`).join("; "))}"` : "";
		const inner = this.children.map((c) => (typeof c === "string" ? escape(c) : c.toHtml())).join("");
		return `<${this.tag}${cls}${style}>${inner}</${this.tag}>`;
	}
}
