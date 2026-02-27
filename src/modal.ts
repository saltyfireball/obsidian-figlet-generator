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

		// Color input (simple text field instead of palette grid)
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

		// Preview area
		const previewRow = contentEl.createDiv("fg-figlet-preview-row");
		previewRow.createEl("label", { text: "Preview" });
		const previewContainer = previewRow.createDiv("fg-figlet-preview");
		const previewPre = previewContainer.createEl("pre");

		// Update preview function
		const updatePreview = async () => {
			const text = textInput.value.trim();
			const font = fontSelect.value;

			if (!text) {
				previewPre.textContent = "(enter text above)";
				previewPre.setCssStyles({ color: "" });
				return;
			}

			try {
				const figletText = await generateFigletText(text, font);
				previewPre.textContent = figletText;
				previewPre.setCssStyles({ color: selectedColor || "" });
			} catch {
				previewPre.textContent = `Error: Font "${font}" may not be available`;
				previewPre.setCssStyles({ color: "var(--text-error)" });
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
				const figletText = await generateFigletText(text, font);

				// Determine if rainbow/gradient
				let colors: string[] | undefined;
				if (selectedColor === "rainbow" || selectedColor === "gradient") {
					colors = this.plugin.settings.gradientColors;
				}

				const styleOptions: FigletStyleOptions = {
					color: colors ? undefined : (selectedColor || undefined),
					colors: colors,
					fontSize: this.plugin.settings.fontSize ?? 10,
					lineHeight: this.plugin.settings.lineHeight ?? 1,
					centered: this.plugin.settings.centered ?? true,
				};
				const html = createFigletHtml(figletText, styleOptions);

				// Insert or replace selection
				this.editor.replaceSelection(html);

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

	onClose() {
		this.contentEl.empty();
	}
}
