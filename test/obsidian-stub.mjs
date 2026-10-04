// Minimal stand-in for the "obsidian" module, which only exists inside the app.
export class App {}
export class Modal {}
export class Notice {}

export class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	update() {}
}

export class SettingPage {
	constructor() {
		this.containerEl = { empty() {} };
	}
}
