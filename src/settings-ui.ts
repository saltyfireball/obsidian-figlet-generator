import { Setting } from "obsidian";
import type { Plugin } from "obsidian";
import { AVAILABLE_FONTS, DEFAULT_FAVORITE_FONTS, DEFAULT_GRADIENT_COLORS } from "./generator";
import type { FigletSettings } from "./generator";

interface FigletPlugin extends Plugin {
	settings: FigletSettings & { codeBlockId?: string };
	saveSettings(): Promise<void>;
}

interface RenderFigletTabArgs {
	plugin: FigletPlugin;
	contentEl: HTMLElement;
}

export function renderFigletTab({ plugin, contentEl }: RenderFigletTabArgs): void {
	const existingSection = contentEl.querySelector(".fg-figlet-section");
	if (existingSection) {
		existingSection.remove();
	}

	const section = contentEl.createDiv("fg-figlet-section");
	new Setting(section).setName("Figlet generator").setHeading();

	// Code Block ID Setting
	new Setting(section).setName("Code block").setHeading();

	new Setting(section)
		.setName("Code block language ID")
		.setDesc("The language identifier for figlet code blocks, such as sfb-figlet. Changing this requires a plugin reload.")
		.addText((text) => {
			text
				.setPlaceholder("Enter block ID")
				.setValue(plugin.settings.codeBlockId ?? "sfb-figlet")
				.onChange((value) => {
					const trimmed = value.trim();
					if (trimmed.length > 0) {
						plugin.settings.codeBlockId = trimmed;
						void plugin.saveSettings();
					}
				});
			text.inputEl.setCssStyles({ width: "200px" });
		});

	// Display Settings Section
	new Setting(section).setName("Display").setHeading();

	new Setting(section)
		.setName("Font size")
		.setDesc("Default font size in pixels for figlet output")
		.addText((text) => {
			text
				.setPlaceholder("10")
				.setValue(String(plugin.settings.fontSize ?? 10))
				.onChange((value) => {
					const num = parseFloat(value);
					if (!isNaN(num) && num > 0) {
						plugin.settings.fontSize = num;
						void plugin.saveSettings();
					}
				});
			text.inputEl.type = "number";
			text.inputEl.min = "1";
			text.inputEl.max = "100";
			text.inputEl.setCssStyles({ width: "80px" });
		});

	new Setting(section)
		.setName("Line height")
		.setDesc("Default line height for figlet output (1 = tight, 1.5 = normal)")
		.addText((text) => {
			text
				.setPlaceholder("1")
				.setValue(String(plugin.settings.lineHeight ?? 1))
				.onChange((value) => {
					const num = parseFloat(value);
					if (!isNaN(num) && num > 0) {
						plugin.settings.lineHeight = num;
						void plugin.saveSettings();
					}
				});
			text.inputEl.type = "number";
			text.inputEl.min = "0.5";
			text.inputEl.max = "3";
			text.inputEl.step = "0.1";
			text.inputEl.setCssStyles({ width: "80px" });
		});

	new Setting(section)
		.setName("Center output")
		.setDesc("Center figlet output horizontally")
		.addToggle((toggle) => {
			toggle
				.setValue(plugin.settings.centered ?? true)
				.onChange((value) => {
					plugin.settings.centered = value;
					void plugin.saveSettings();
				});
		});

	// Gradient Colors Section
	new Setting(section).setName("Rainbow / gradient colors").setHeading();
	section.createEl("p", {
		text: "Colors used when 'color: rainbow' is set, or when using the 'colors:' option.",
		cls: "fg-hint",
	});

	const gradientColors = plugin.settings.gradientColors ?? DEFAULT_GRADIENT_COLORS;

	// Color preview row
	const colorPreviewRow = section.createDiv("fg-figlet-gradient-preview");

	const updatePreviewSwatches = (colors: string[]) => {
		colorPreviewRow.empty();
		colors.forEach((color) => {
			const swatch = colorPreviewRow.createEl("span", { cls: "fg-figlet-gradient-swatch" });
			swatch.setCssStyles({ backgroundColor: color });
		});
	};

	updatePreviewSwatches(gradientColors);

	let gradientTextArea: HTMLTextAreaElement;

	new Setting(section)
		.setName("Gradient colors")
		.setDesc("Space-separated list of colors for rainbow/gradient mode")
		.addTextArea((text) => {
			gradientTextArea = text.inputEl;
			text
				.setPlaceholder("#ff6188 #fc9867 #ffd866 ...")
				.setValue(gradientColors.join(" "))
				.onChange((value) => {
					const colors = value.split(/\s+/).filter((c) => c.trim().length > 0);
					if (colors.length > 0) {
						plugin.settings.gradientColors = colors;
						void plugin.saveSettings();
						updatePreviewSwatches(colors);
					}
				});
			text.inputEl.rows = 2;
			text.inputEl.setCssStyles({ width: "100%", fontFamily: "var(--font-monospace)" });
		});

	const resetGradientBtn = section.createEl("button", {
		text: "Reset to default colors",
		cls: "fg-figlet-reset-gradient-btn",
	});
	resetGradientBtn.addEventListener("click", () => {
		plugin.settings.gradientColors = [...DEFAULT_GRADIENT_COLORS];
		void plugin.saveSettings();
		gradientTextArea.value = DEFAULT_GRADIENT_COLORS.join(" ");
		updatePreviewSwatches(DEFAULT_GRADIENT_COLORS);
	});

	// Code Block Example Section
	const codeBlockId = plugin.settings.codeBlockId ?? "sfb-figlet";

	new Setting(section).setName("Code block usage").setHeading();
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
			setTimeout(() => {
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
	new Setting(optionsTable).setName("Available options").setHeading();
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

	// Favorites Section
	new Setting(section).setName("Favorite fonts").setHeading();
	section.createEl("p", {
		text: "Favorites appear at the top of the font list when generating ASCII art.",
		cls: "fg-hint",
	});

	const actionsRow = section.createDiv("fg-figlet-actions-row");

	const resetBtn = actionsRow.createEl("button", {
		text: "Reset to defaults",
		cls: "fg-figlet-reset-btn",
	});
	resetBtn.addEventListener("click", () => {
		plugin.settings.favoriteFonts = [...DEFAULT_FAVORITE_FONTS];
		void plugin.saveSettings();
		renderFigletTab({ plugin, contentEl });
	});

	const clearBtn = actionsRow.createEl("button", {
		text: "Clear all favorites",
		cls: "fg-figlet-clear-btn",
	});
	clearBtn.addEventListener("click", () => {
		plugin.settings.favoriteFonts = [];
		void plugin.saveSettings();
		renderFigletTab({ plugin, contentEl });
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

			favoriteFonts.forEach((font) => {
				createFontItem(fontList, font, true, plugin, searchInput, renderFontList, updateCount);
			});
		}

		if (otherFonts.length > 0) {
			const otherHeader = fontList.createDiv("fg-figlet-list-header");
			otherHeader.textContent = `All Fonts (${otherFonts.length})`;

			otherFonts.forEach((font) => {
				createFontItem(fontList, font, false, plugin, searchInput, renderFontList, updateCount);
			});
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
	plugin: FigletPlugin,
	searchInput: HTMLInputElement,
	renderFontList: (filter: string) => void,
	updateCount: () => void,
): void {
	const item = container.createDiv("fg-figlet-font-item");

	const starBtn = item.createEl("button", {
		cls: `fg-figlet-star-btn ${isFavorite ? "is-favorite" : ""}`,
		attr: { type: "button", title: isFavorite ? "Remove from favorites" : "Add to favorites" },
	});
	starBtn.textContent = isFavorite ? "(*)" : "( )";

	starBtn.addEventListener("click", () => {
		const favorites = plugin.settings.favoriteFonts || [];
		if (isFavorite) {
			plugin.settings.favoriteFonts = favorites.filter((f) => f !== font);
		} else {
			if (!favorites.includes(font)) {
				plugin.settings.favoriteFonts = [...favorites, font];
			}
		}
		void plugin.saveSettings();
		updateCount();
		renderFontList(searchInput.value);
	});

	item.createEl("span", { text: font, cls: "fg-figlet-font-name" });
}
