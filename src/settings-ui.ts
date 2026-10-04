import { PluginSettingTab, SettingPage } from "obsidian";
import type { App, Plugin, Setting, SettingDefinitionItem } from "obsidian";
import { AVAILABLE_FONTS, DEFAULT_FAVORITE_FONTS, DEFAULT_GRADIENT_COLORS } from "./generator";
import type { FigletSettings } from "./generator";

export interface FigletPlugin extends Plugin {
	settings: FigletSettings & { codeBlockId: string };
	saveSettings(): Promise<void>;
}

/** Split the gradient textarea into colors: any run of whitespace separates them. */
function parseColorList(value: string): string[] {
	return value.split(/\s+/).filter((c) => c.length > 0);
}

/**
 * The settings tab, built from Obsidian 1.13's declarative definitions so every
 * setting appears in Obsidian's settings search. The font picker and the code
 * block examples are custom pages, reached from entries that are searchable too.
 */
export class FigletSettingTab extends PluginSettingTab {
	plugin: FigletPlugin;
	private swatchesEl: HTMLElement | null = null;

	constructor(app: App, plugin: FigletPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const settings = this.plugin.settings;
		return [
			{
				type: "group",
				heading: "Code block",
				items: [
					{
						name: "Code block language ID",
						desc: "The language identifier for figlet code blocks, such as sfb-figlet. Changing this requires a plugin reload.",
						control: {
							type: "text",
							key: "codeBlockId",
							placeholder: "sfb-figlet",
							defaultValue: "sfb-figlet",
							validate: (value) => (value.trim() ? undefined : "Enter a language ID."),
						},
					},
				],
			},
			{
				type: "group",
				heading: "Display",
				items: [
					{
						name: "Font size",
						desc: "Default font size in pixels for figlet output",
						control: {
							type: "number",
							key: "fontSize",
							defaultValue: 10,
							min: 1,
							max: 100,
							validate: (value) => (value > 0 ? undefined : "Enter a size above 0."),
						},
					},
					{
						name: "Line height",
						desc: "Default line height for figlet output (1 = tight, 1.5 = normal)",
						control: {
							type: "number",
							key: "lineHeight",
							defaultValue: 1,
							min: 0.5,
							max: 3,
							step: 0.1,
							validate: (value) => (value > 0 ? undefined : "Enter a line height above 0."),
						},
					},
					{
						name: "Center output",
						desc: "Center figlet output horizontally",
						control: { type: "toggle", key: "centered", defaultValue: true },
					},
				],
			},
			{
				type: "group",
				heading: "Rainbow / gradient colors",
				cls: "fg-figlet-gradient-group",
				items: [
					{
						name: "Preview",
						desc: "Colors used for 'color: rainbow' or 'color: gradient'. A list of colors in a code block uses its own colors.",
						searchable: false,
						render: (setting: Setting) => {
							this.swatchesEl = setting.controlEl.createDiv("fg-figlet-gradient-preview");
							this.renderSwatches(settings.gradientColors ?? DEFAULT_GRADIENT_COLORS);
							return () => {
								this.swatchesEl = null;
							};
						},
					},
					{
						name: "Gradient colors",
						desc: "Space-separated list of colors for rainbow/gradient mode",
						aliases: ["rainbow"],
						control: {
							type: "textarea",
							key: "gradientColors",
							placeholder: "For example: #ff6188 #fc9867 #ffd866",
							// Three rows: the default seven colors wrap onto a third line
							rows: 3,
							validate: (value) => (parseColorList(value).length > 0 ? undefined : "Enter at least one color."),
						},
					},
					{
						name: "Reset to default colors",
						action: () => {
							void this.setControlValue("gradientColors", DEFAULT_GRADIENT_COLORS.join(" ")).then(() => this.update());
						},
					},
				],
			},
			{
				type: "group",
				heading: "Fonts",
				items: [
					{
						type: "page",
						name: "Favorite fonts",
						desc: "Favorites appear at the top of the font list when generating ASCII art.",
						displayValue: () => `${settings.favoriteFonts?.length ?? 0} favorites`,
						page: () => new FavoriteFontsPage(this.plugin, () => this.update()),
					},
					{
						type: "page",
						name: "Code block usage",
						desc: "Copyable examples and the options for figlet code blocks",
						page: () => new CodeBlockUsagePage(this.plugin),
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "gradientColors") {
			return (this.plugin.settings.gradientColors ?? DEFAULT_GRADIENT_COLORS).join(" ");
		}
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		if (key === "gradientColors" && typeof value === "string") {
			const colors = parseColorList(value);
			settings.gradientColors = colors;
			this.renderSwatches(colors);
		} else if (key === "codeBlockId" && typeof value === "string") {
			settings.codeBlockId = value.trim();
		} else {
			settings[key] = value;
		}
		await this.plugin.saveSettings();
	}

	private renderSwatches(colors: string[]): void {
		const el = this.swatchesEl;
		if (!el) return;
		el.empty();
		for (const color of colors) {
			el.createSpan({ cls: "fg-figlet-gradient-swatch" }).setCssStyles({ backgroundColor: color });
		}
	}
}

/** Pick favorite fonts: search, star or unstar, reset or clear. */
class FavoriteFontsPage extends SettingPage {
	constructor(
		private plugin: FigletPlugin,
		private onChange: () => void,
	) {
		super();
		this.title = "Favorite fonts";
	}

	display(): void {
		this.containerEl.empty();
		renderFavoriteFonts(this.containerEl, this.plugin);
	}

	/** Refresh the tab's "N favorites" value once, when the page closes, not on every click. */
	hide(): void {
		super.hide();
		this.onChange();
	}
}

/** Copyable code block examples and the table of code block options. */
class CodeBlockUsagePage extends SettingPage {
	constructor(private plugin: FigletPlugin) {
		super();
		this.title = "Code block usage";
	}

	display(): void {
		this.containerEl.empty();
		renderCodeBlockUsage(this.containerEl, this.plugin);
	}
}

function renderCodeBlockUsage(section: HTMLElement, plugin: FigletPlugin): void {
	const codeBlockId = plugin.settings.codeBlockId ?? "sfb-figlet";

	section.createEl("p", {
		text: `Use ${codeBlockId} code blocks to render ASCII art inline in your notes:`,
		cls: "fg-hint",
	});

	const exampleContainer = section.createDiv("fg-figlet-example");

	const createCopyableExample = (code: string) => {
		const wrapper = exampleContainer.createDiv("fg-figlet-code-wrapper");
		const pre = wrapper.createEl("pre", { cls: "fg-figlet-code-example" });
		pre.createEl("code", { text: code });

		const copyBtn = wrapper.createEl("button", {
			cls: "fg-figlet-copy-btn",
			attr: { type: "button", title: "Copy to clipboard" },
		});
		copyBtn.textContent = "Copy";
		copyBtn.addEventListener("click", () => { void (async () => {
			await navigator.clipboard.writeText(code);
			copyBtn.textContent = "Copied!";
			window.setTimeout(() => {
				copyBtn.textContent = "Copy";
			}, 1500);
		})(); });
	};

	createCopyableExample(`\`\`\`${codeBlockId}\nfont: Banner\ncolor: #5C7CFA\n---\nHello World\n\`\`\``);

	section.createEl("p", {
		text: "Use 'color: rainbow' for a gradient effect, or specify custom colors:",
		cls: "fg-hint",
	});

	createCopyableExample(`\`\`\`${codeBlockId}\nfont: Slant\ncolor: rainbow\n---\nRainbow!\n\`\`\``);

	createCopyableExample(`\`\`\`${codeBlockId}\nfont: Big\ncolors: #FF6188 #FC9867 #FFD866 #A9DC76 #78DCE8\nopacity: 0.8\n---\nCustom Colors\n\`\`\``);

	section.createEl("p", {
		text: "Use 'multi-center: true' to center each line independently:",
		cls: "fg-hint",
	});

	createCopyableExample(`\`\`\`${codeBlockId}\nfont: Thick\ncolor: rainbow\nmulti-center: true\n---\nLinux\nCommands\n\`\`\``);

	const optionsTable = section.createDiv("fg-figlet-options-table");
	optionsTable.createEl("h3", { text: "Available options" });
	const table = optionsTable.createEl("table");
	const headerRow = table.createEl("tr");
	headerRow.createEl("th", { text: "Option" });
	headerRow.createEl("th", { text: "Description" });
	headerRow.createEl("th", { text: "Default" });

	const optionsList = [
		["font", "Figlet font name (e.g., Banner, 3d, Slant)", "Standard"],
		["color", "Single color or 'rainbow' for gradient", "inherit"],
		["colors", "Space-separated list for custom gradient", "(none)"],
		["font-size", "Font size in pixels", String(plugin.settings.fontSize ?? 10)],
		["line-height", "Line height multiplier", String(plugin.settings.lineHeight ?? 1)],
		["centered", "Center output (true/false)", String(plugin.settings.centered ?? true)],
		["opacity", "Text opacity (0-1)", "1"],
		["multi-center", "Center each line independently (true/false)", "false"],
	];

	optionsList.forEach(([opt, desc, def]) => {
		const row = table.createEl("tr");
		row.createEl("td", { text: opt, cls: "fg-code" });
		row.createEl("td", { text: desc });
		row.createEl("td", { text: def, cls: "fg-code" });
	});
}

function renderFavoriteFonts(section: HTMLElement, plugin: FigletPlugin): void {
	const save = () => {
		void plugin.saveSettings();
	};

	const actionsRow = section.createDiv("fg-figlet-actions-row");

	const resetBtn = actionsRow.createEl("button", {
		text: "Reset to defaults",
		cls: "fg-figlet-reset-btn",
	});
	resetBtn.addEventListener("click", () => {
		plugin.settings.favoriteFonts = [...DEFAULT_FAVORITE_FONTS];
		save();
		updateCount();
		renderFontList(searchInput.value);
	});

	const clearBtn = actionsRow.createEl("button", {
		text: "Clear all favorites",
		cls: "fg-figlet-clear-btn",
	});
	clearBtn.addEventListener("click", () => {
		plugin.settings.favoriteFonts = [];
		save();
		updateCount();
		renderFontList(searchInput.value);
	});

	const searchRow = section.createDiv("fg-figlet-search-row");
	const searchInput = searchRow.createEl("input", {
		type: "text",
		placeholder: "Search fonts...",
		cls: "fg-figlet-search-input",
	});

	const countEl = section.createDiv("fg-figlet-count");

	const fontList = section.createDiv("fg-figlet-font-list");

	const updateCount = () => {
		const favCount = plugin.settings.favoriteFonts?.length || 0;
		countEl.textContent = `${favCount} favorites / ${AVAILABLE_FONTS.length} total fonts`;
	};

	const toggleFavorite = (font: string, isFavorite: boolean) => {
		const favorites = plugin.settings.favoriteFonts || [];
		if (isFavorite) {
			plugin.settings.favoriteFonts = favorites.filter((f) => f !== font);
		} else if (!favorites.includes(font)) {
			plugin.settings.favoriteFonts = [...favorites, font];
		}
		save();
		updateCount();
		renderFontList(searchInput.value);
	};

	const renderFontList = (filter: string = "") => {
		fontList.empty();
		const lowerFilter = filter.toLowerCase();
		const favorites = plugin.settings.favoriteFonts || [];

		const favoriteFonts = AVAILABLE_FONTS.filter(
			(font) => favorites.includes(font) && font.toLowerCase().includes(lowerFilter)
		);
		const otherFonts = AVAILABLE_FONTS.filter(
			(font) => !favorites.includes(font) && font.toLowerCase().includes(lowerFilter)
		);

		if (favoriteFonts.length > 0) {
			const favHeader = fontList.createDiv("fg-figlet-list-header");
			favHeader.textContent = `Favorites (${favoriteFonts.length})`;
			favoriteFonts.forEach((font) => createFontItem(fontList, font, true, toggleFavorite));
		}

		if (otherFonts.length > 0) {
			const otherHeader = fontList.createDiv("fg-figlet-list-header");
			otherHeader.textContent = `All Fonts (${otherFonts.length})`;
			otherFonts.forEach((font) => createFontItem(fontList, font, false, toggleFavorite));
		}

		if (favoriteFonts.length === 0 && otherFonts.length === 0) {
			fontList.createDiv("fg-figlet-empty").textContent = "No fonts match your search.";
		}
	};

	searchInput.addEventListener("input", () => {
		renderFontList(searchInput.value);
	});

	updateCount();
	renderFontList();
}

function createFontItem(
	container: HTMLElement,
	font: string,
	isFavorite: boolean,
	toggleFavorite: (font: string, isFavorite: boolean) => void,
): void {
	const item = container.createDiv("fg-figlet-font-item");

	const starBtn = item.createEl("button", {
		cls: `fg-figlet-star-btn ${isFavorite ? "is-favorite" : ""}`,
		attr: { type: "button", title: isFavorite ? "Remove from favorites" : "Add to favorites" },
	});
	starBtn.textContent = isFavorite ? "(*)" : "( )";
	starBtn.addEventListener("click", () => toggleFavorite(font, isFavorite));

	item.createSpan({ text: font, cls: "fg-figlet-font-name" });
}
