import { Plugin, App, type Editor } from "obsidian";
import {
	generateFigletText,
	createFigletHtml,
	DEFAULT_FIGLET_SETTINGS,
	DEFAULT_GRADIENT_COLORS,
	type FigletSettings,
	type FigletStyleOptions,
} from "./generator";
import { FigletModal } from "./modal";
import { createFigletCodeBlockProcessor } from "./codeblock";
import { FigletSettingTab } from "./settings-ui";

interface FigletPluginSettings extends FigletSettings {
	codeBlockId: string;
}

const DEFAULT_SETTINGS: FigletPluginSettings = {
	...DEFAULT_FIGLET_SETTINGS,
	codeBlockId: "sfb-figlet",
};

// Extend window for the global API
declare global {
	interface Window {
		figletAPI?: {
			generateText(text: string, font?: string): Promise<string>;
			createHtml(text: string, options?: FigletStyleOptions): string;
			defaultGradientColors: string[];
			openModal(app: App, plugin: unknown, editor: unknown): void;
		};
	}
}

export default class FigletGeneratorPlugin extends Plugin {
	settings!: FigletPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register code block processor using configurable ID
		this.registerMarkdownCodeBlockProcessor(
			this.settings.codeBlockId,
			createFigletCodeBlockProcessor(() => this.settings, this.app),
		);

		// Register insert-figlet command
		this.addCommand({
			id: "insert-figlet",
			name: "Insert figlet ASCII art",
			editorCallback: (editor) => {
				new FigletModal(this.app, this, editor).open();
			},
		});

		// Set global API for cross-plugin use
		window.figletAPI = {
			generateText: generateFigletText,
			createHtml: createFigletHtml,
			defaultGradientColors: DEFAULT_GRADIENT_COLORS,
			openModal: (_app: App, _plugin: unknown, editor: unknown) => {
				new FigletModal(this.app, this, editor as Editor).open();
			},
		};

		// Add settings tab
		this.addSettingTab(new FigletSettingTab(this.app, this));
	}

	onunload() {
		// Remove global API
		delete window.figletAPI;
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<FigletPluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
