import { Modal, Notice } from "obsidian";
import type { App, Editor } from "obsidian";
import type { FigletSettings } from "./generator";
import {
	generateFigletText,
	createFigletHtml,
	AVAILABLE_FONTS,
	type FigletStyleOptions,
} from "./generator";

export interface FigletModalPlugin {
	app: App;
	settings: FigletSettings;
	saveSettings(): Promise<void>;
}

type OutputMode = "html" | "codeblock";

export class FigletModal extends Modal {
	private plugin: FigletModalPlugin;
	private editor: Editor;
	private initialText: string;

	constructor(app: App, plugin: FigletModalPlugin, editor: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
		this.initialText = editor.getSelection() || "";
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("fg-figlet-modal");

		contentEl.createEl("h2", { text: "Figlet font generator" });

		// Text input
		const textRow = contentEl.createDiv("fg-figlet-input-row");
		textRow.createEl("label", { text: "Text" });
		const textInput = textRow.createEl("input", {
			type: "text",
			value: this.initialText,
			placeholder: "Enter text to convert...",
			cls: "fg-figlet-text-input",
		});

		// Color input
		const colorRow = contentEl.createDiv("fg-figlet-input-row");
		colorRow.createEl("label", { text: "Color" });
		const colorDesc = colorRow.createEl("div", {
			cls: "fg-figlet-hint",
		});
		colorDesc.textContent = "Hex (#ff6188), CSS name (red), or 'rainbow' for gradient. Leave empty for default";
		let selectedColor = this.plugin.settings.lastUsedColor || "";
		const colorInput = colorRow.createEl("input", {
			type: "text",
			value: selectedColor,
			placeholder: "#FF6188 or rainbow",
			cls: "fg-figlet-text-input",
		});
		colorInput.addEventListener("input", () => {
			selectedColor = colorInput.value.trim();
			void updatePreview();
		});

		// Font selection
		const fontRow = contentEl.createDiv("fg-figlet-font-row");
		fontRow.createEl("label", { text: "Font" });
		const fontSelect = fontRow.createEl("select", {
			cls: "fg-figlet-font-select",
		});

		// Get favorites and sort fonts
		const favorites = this.plugin.settings.favoriteFonts || [];
		const lastUsedFont = this.plugin.settings.lastUsedFont || "Standard";

		// Create optgroups for favorites and all fonts
		if (favorites.length > 0) {
			const favGroup = fontSelect.createEl("optgroup", { attr: { label: "Favorites" } });
			favorites.forEach((font) => {
				if (AVAILABLE_FONTS.includes(font)) {
					favGroup.createEl("option", { text: font, value: font });
				}
			});
		}

		const allGroup = fontSelect.createEl("optgroup", { attr: { label: "All Fonts" } });
		AVAILABLE_FONTS.forEach((font) => {
			allGroup.createEl("option", { text: font, value: font });
		});

		// Set initial selection
		fontSelect.value = lastUsedFont;

		// Output mode toggle
		const modeRow = contentEl.createDiv("fg-figlet-input-row");
		modeRow.createEl("label", { text: "Output" });
		const modeContainer = modeRow.createDiv("fg-figlet-mode-toggle");
		let outputMode: OutputMode = "codeblock";

		const codeblockBtn = modeContainer.createEl("button", {
			text: "Code block",
			cls: "fg-mode-btn fg-mode-active",
		});
		const htmlBtn = modeContainer.createEl("button", {
			text: "HTML",
			cls: "fg-mode-btn",
		});

		const setMode = (mode: OutputMode) => {
			outputMode = mode;
			if (mode === "codeblock") {
				codeblockBtn.addClass("fg-mode-active");
				htmlBtn.removeClass("fg-mode-active");
			} else {
				htmlBtn.addClass("fg-mode-active");
				codeblockBtn.removeClass("fg-mode-active");
			}
		};

		codeblockBtn.addEventListener("click", () => setMode("codeblock"));
		htmlBtn.addEventListener("click", () => setMode("html"));

		// Preview area - renders actual HTML output
		const previewRow = contentEl.createDiv("fg-figlet-preview-row");
		previewRow.createEl("label", { text: "Preview" });
		const previewContainer = previewRow.createDiv("fg-figlet-preview");

		// Update preview function - renders full HTML with colors/gradients
		const updatePreview = async () => {
			const text = textInput.value.trim();
			const font = fontSelect.value;

			if (!text) {
				previewContainer.empty();
				previewContainer.createEl("pre").textContent = "(enter text above)";
				return;
			}

			try {
				const figletText = await generateFigletText(text, font);
				const styleOptions = this.buildStyleOptions(selectedColor);
				const html = createFigletHtml(figletText, styleOptions);

				// Render the actual HTML into the preview
				previewContainer.empty();
				const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
				const nodes = parsed.body.firstElementChild?.childNodes;
				if (nodes) {
					for (const node of Array.from(nodes)) {
						previewContainer.appendChild(document.importNode(node, true));
					}
				}
			} catch {
				previewContainer.empty();
				const pre = previewContainer.createEl("pre");
				pre.textContent = `Error: Font "${font}" may not be available`;
				pre.setCssStyles({ color: "var(--text-error)" });
			}
		};

		// Event listeners for preview updates
		textInput.addEventListener("input", () => { void updatePreview(); });
		fontSelect.addEventListener("change", () => { void updatePreview(); });

		// Initial preview
		void updatePreview();

		// Action buttons
		const actions = contentEl.createDiv("fg-modal-actions");

		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const insertBtn = actions.createEl("button", {
			text: "Insert",
			cls: "mod-cta",
		});

		insertBtn.addEventListener("click", () => { void (async () => {
			const text = textInput.value.trim();
			const font = fontSelect.value;

			if (!text) {
				new Notice("Please enter some text");
				return;
			}

			try {
				if (outputMode === "codeblock") {
					const codeBlock = this.buildCodeBlock(text, font, selectedColor);
					this.editor.replaceSelection(codeBlock);
				} else {
					const figletText = await generateFigletText(text, font);
					const styleOptions = this.buildStyleOptions(selectedColor);
					const html = createFigletHtml(figletText, styleOptions);
					this.editor.replaceSelection(html);
				}

				// Save last used settings
				this.plugin.settings.lastUsedFont = font;
				this.plugin.settings.lastUsedColor = selectedColor;
				await this.plugin.saveSettings();

				this.close();
			} catch (err) {
				new Notice(`Failed to generate figlet text: ${String(err)}`);
			}
		})(); });
	}

	private buildStyleOptions(selectedColor: string): FigletStyleOptions {
		let colors: string[] | undefined;
		if (selectedColor === "rainbow" || selectedColor === "gradient") {
			colors = this.plugin.settings.gradientColors;
		}

		return {
			color: colors ? undefined : (selectedColor || undefined),
			colors: colors,
			fontSize: this.plugin.settings.fontSize ?? 10,
			lineHeight: this.plugin.settings.lineHeight ?? 1,
			centered: this.plugin.settings.centered ?? true,
		};
	}

	private buildCodeBlock(text: string, font: string, color: string): string {
		const settings = this.plugin.settings;
		const lines: string[] = [];
		lines.push("```sfb-figlet");
		lines.push(`font: ${font}`);

		if (color === "rainbow" || color === "gradient") {
			lines.push(`colors: ${settings.gradientColors.join(" ")}`);
		} else if (color) {
			lines.push(`color: ${color}`);
		}

		lines.push(`font-size: ${settings.fontSize ?? 10}`);
		lines.push(`line-height: ${settings.lineHeight ?? 1}`);
		lines.push(`centered: ${settings.centered ?? true}`);
		lines.push("---");
		lines.push(text);
		lines.push("```");

		return lines.join("\n");
	}

	onClose() {
		this.contentEl.empty();
	}
}
