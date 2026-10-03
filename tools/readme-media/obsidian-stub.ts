// Just enough of the Obsidian API for the plugin to run in a plain browser
// page, so the README media can be captured headlessly. Not shipped.

export class App {
	metadataCache = { getFileCache: () => null };
	vault = { getAbstractFileByPath: () => null };
}

export class Component {
	load(): void {
		this.onload();
	}
	onload(): void {}
	onunload(): void {}
}

type BlockProcessor = (source: string, el: HTMLElement, ctx: unknown) => void | Promise<void>;

export class Plugin extends Component {
	processors = new Map<string, BlockProcessor>();
	commands: unknown[] = [];
	settingTab: PluginSettingTab | null = null;
	private data: unknown = null;
	constructor(
		public app: App,
		public manifest: unknown,
	) {
		super();
	}
	async loadData(): Promise<unknown> {
		return this.data;
	}
	async saveData(d: unknown): Promise<void> {
		this.data = d;
	}
	addSettingTab(tab: PluginSettingTab): void {
		this.settingTab = tab;
	}
	addCommand(c: unknown): void {
		this.commands.push(c);
	}
	registerMarkdownCodeBlockProcessor(lang: string, fn: BlockProcessor): void {
		this.processors.set(lang, fn);
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement = document.createElement("div");
	constructor(
		public app: App,
		public plugin: Plugin,
	) {
		this.containerEl.className = "vertical-tab-content";
	}
	display(): void {}
}

// Renders into document.body like Obsidian's .modal-container.
export class Modal {
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	constructor(public app: App) {
		this.containerEl = document.createElement("div");
		this.containerEl.className = "modal-container";
		this.containerEl.createDiv({ cls: "modal-bg" });
		this.modalEl = this.containerEl.createDiv({ cls: "modal" });
		this.modalEl.createDiv({ cls: "modal-close-button" });
		this.titleEl = this.modalEl.createDiv({ cls: "modal-title" });
		this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
	}
	open(): void {
		document.body.appendChild(this.containerEl);
		this.onOpen();
	}
	close(): void {
		this.onClose();
		this.containerEl.remove();
	}
	onOpen(): void {}
	onClose(): void {}
}

export class Notice {
	constructor(message: string) {
		console.log("Notice:", message);
	}
}

// The settings rows, shaped like Obsidian's .setting-item markup.
export class Setting {
	settingEl: HTMLElement;
	private nameEl: HTMLElement;
	private descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
		const info = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.nameEl = info.createDiv({ cls: "setting-item-name" });
		this.descEl = info.createDiv({ cls: "setting-item-description" });
		this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
	}
	setName(name: string): this {
		this.nameEl.setText(name);
		return this;
	}
	setDesc(desc: string | DocumentFragment): this {
		if (typeof desc === "string") this.descEl.setText(desc);
		else this.descEl.appendChild(desc);
		return this;
	}
	setHeading(): this {
		this.settingEl.addClass("setting-item-heading");
		return this;
	}
	setClass(c: string): this {
		this.settingEl.addClass(c);
		return this;
	}
	addText(cb: (t: TextInput) => void): this {
		cb(new TextInput(this.controlEl, "input"));
		return this;
	}
	addTextArea(cb: (t: TextInput) => void): this {
		cb(new TextInput(this.controlEl, "textarea"));
		return this;
	}
	addToggle(cb: (t: Toggle) => void): this {
		cb(new Toggle(this.controlEl));
		return this;
	}
	addButton(cb: (b: Button) => void): this {
		cb(new Button(this.controlEl));
		return this;
	}
}

class TextInput {
	inputEl: HTMLInputElement;
	constructor(parent: HTMLElement, tag: "input" | "textarea") {
		this.inputEl = parent.createEl(tag, tag === "input" ? { type: "text" } : {}) as HTMLInputElement;
	}
	setPlaceholder(p: string): this {
		this.inputEl.placeholder = p;
		return this;
	}
	setValue(v: string): this {
		this.inputEl.value = v;
		return this;
	}
	getValue(): string {
		return this.inputEl.value;
	}
	onChange(cb: (v: string) => void): this {
		this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
		return this;
	}
}

class Toggle {
	toggleEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.toggleEl = parent.createDiv({ cls: "checkbox-container" });
	}
	setValue(v: boolean): this {
		this.toggleEl.toggleClass("is-enabled", v);
		return this;
	}
	onChange(): this {
		return this;
	}
}

class Button {
	buttonEl: HTMLButtonElement;
	constructor(parent: HTMLElement) {
		this.buttonEl = parent.createEl("button") as HTMLButtonElement;
	}
	setButtonText(t: string): this {
		this.buttonEl.setText(t);
		return this;
	}
	setCta(): this {
		this.buttonEl.addClass("mod-cta");
		return this;
	}
	onClick(cb: () => void): this {
		this.buttonEl.addEventListener("click", cb);
		return this;
	}
}
