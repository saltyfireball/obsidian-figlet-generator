import { Plugin, PluginSettingTab, App } from "obsidian";
import {
	initFiglet,
	generateFigletText,
	createFigletHtml,
	DEFAULT_FIGLET_SETTINGS,
	DEFAULT_GRADIENT_COLORS,
	type FigletSettings,
} from "./generator";
import { FigletModal } from "./modal";
import { createFigletCodeBlockProcessor } from "./codeblock";
import { renderFigletTab } from "./settings-ui";

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
			createHtml(text: string, options: Record<string, unknown>): string;
			defaultGradientColors: string[];
		};
	}
}

export default class FigletGeneratorPlugin extends Plugin {
	settings!: FigletPluginSettings;

	async onload() {
		await this.loadSettings();

		// Initialize figlet with plugin directory for font loading
		if (this.manifest.dir) {
			initFiglet(this.app, this.manifest.dir);
		}

		// Register code block processor using configurable ID
		this.registerMarkdownCodeBlockProcessor(
			this.settings.codeBlockId,
			createFigletCodeBlockProcessor(() => this.settings),
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

class FigletSettingTab extends PluginSettingTab {
	plugin: FigletGeneratorPlugin;

	constructor(app: App, plugin: FigletGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		renderFigletTab({ plugin: this.plugin, contentEl: containerEl });
	}
}
