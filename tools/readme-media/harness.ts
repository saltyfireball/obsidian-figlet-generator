// Runs the real plugin in a browser page: installs Obsidian's DOM helpers,
// loads FigletGeneratorPlugin against the stub app, and exposes window.figlet
// so the capture script can render code blocks, open the modal and show the
// settings tab.

import { App } from "./obsidian-stub";
import FigletGeneratorPlugin from "../../src/main";

interface ElOpts {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string | number | boolean>;
	title?: string;
	type?: string;
	value?: string;
	placeholder?: string;
}

function applyOpts(el: HTMLElement, o?: ElOpts | string): void {
	if (!o) return;
	if (typeof o === "string") {
		el.className = o;
		return;
	}
	if (o.cls) el.classList.add(...(Array.isArray(o.cls) ? o.cls : o.cls.split(" ")).filter(Boolean));
	if (o.text !== undefined) el.textContent = o.text;
	if (o.title) el.title = o.title;
	if (o.type) el.setAttribute("type", o.type);
	if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
	if (o.placeholder) el.setAttribute("placeholder", o.placeholder);
	for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, String(v));
}

function installDomHelpers(): void {
	const N = Node.prototype as unknown as Record<string, unknown>;
	const E = Element.prototype as unknown as Record<string, unknown>;
	const create = function (this: HTMLElement, tag: string, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		const el = this.ownerDocument.createElement(tag);
		applyOpts(el, o);
		this.appendChild(el);
		cb?.(el);
		return el;
	};
	N.createEl = create;
	N.createDiv = function (this: HTMLElement, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		return create.call(this, "div", o, cb);
	};
	N.createSpan = function (this: HTMLElement, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		return create.call(this, "span", o, cb);
	};
	N.empty = function (this: Node) {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	N.setText = function (this: Node, t: string) {
		this.textContent = t;
	};
	N.appendText = function (this: Node, t: string) {
		this.appendChild(document.createTextNode(t));
	};
	E.addClass = function (this: Element, ...c: string[]) {
		this.classList.add(...c);
	};
	E.removeClass = function (this: Element, ...c: string[]) {
		this.classList.remove(...c);
	};
	E.toggleClass = function (this: Element, c: string, v?: boolean) {
		this.classList.toggle(c, v);
	};
	E.setCssStyles = function (this: HTMLElement, styles: Record<string, string>) {
		Object.assign(this.style, styles);
	};
	E.setCssProps = function (this: HTMLElement, props: Record<string, string>) {
		for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v);
	};
	E.setAttr = function (this: Element, k: string, v: string) {
		this.setAttribute(k, v);
	};
	const W = window as unknown as Record<string, unknown>;
	W.activeDocument = document;
	W.activeWindow = window;
}

installDomHelpers();

const app = new App();
const plugin = new FigletGeneratorPlugin(app as never, { id: "figlet-generator" } as never);

async function start(settings?: Record<string, unknown>): Promise<void> {
	if (settings) await plugin.saveData(settings);
	plugin.load();
	// onload is async (loadSettings); give it a tick to finish.
	await new Promise((r) => setTimeout(r, 0));
}

// Renders one sfb-figlet block into `el`, the way Obsidian's reading view does.
async function render(el: HTMLElement, source: string): Promise<void> {
	const proc = (plugin as unknown as { processors: Map<string, Function> }).processors.get("sfb-figlet")!;
	el.addClass("block-language-sfb-figlet");
	await proc(source, el, { sourcePath: "Notes/Figlet.md" });
}

// Opens the insert modal against a fake editor; returns what Insert wrote.
function openModal(selection = ""): { inserted: string[] } {
	const result = { inserted: [] as string[] };
	const editor = {
		getSelection: () => selection,
		replaceSelection: (t: string) => result.inserted.push(t),
	};
	window.figletAPI!.openModal(app as never, plugin, editor);
	return result;
}

function showSettings(el: HTMLElement): void {
	const tab = (plugin as unknown as { settingTab: { containerEl: HTMLElement; display(): void } }).settingTab;
	el.appendChild(tab.containerEl);
	tab.display();
}

(window as unknown as Record<string, unknown>).figlet = { start, render, openModal, showSettings };
