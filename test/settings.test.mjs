import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSrc } from "./bundle.mjs";

const [ui, generator] = await loadSrc(["settings-ui", "generator"]);

function makeTab() {
	const plugin = {
		settings: { ...generator.DEFAULT_FIGLET_SETTINGS, codeBlockId: "sfb-figlet" },
		saves: 0,
		async saveSettings() {
			this.saves++;
		},
	};
	return { tab: new ui.FigletSettingTab({}, plugin), plugin };
}

function controls(tab) {
	return tab
		.getSettingDefinitions()
		.flatMap((group) => group.items ?? [])
		.filter((item) => item.control)
		.map((item) => item.control);
}

test("every control key is a real setting", () => {
	const { tab, plugin } = makeTab();
	const keys = controls(tab).map((c) => c.key);
	assert.ok(keys.length >= 5);
	for (const key of keys) assert.ok(key in plugin.settings, `${key} is not in the settings`);
});

test("gradient colors show as one space-joined string", () => {
	const { tab, plugin } = makeTab();
	assert.equal(tab.getControlValue("gradientColors"), plugin.settings.gradientColors.join(" "));
});

test("gradient colors are stored as a list and saved", async () => {
	const { tab, plugin } = makeTab();
	await tab.setControlValue("gradientColors", "#f00  #00f");
	assert.deepEqual(plugin.settings.gradientColors, ["#f00", "#00f"]);
	assert.equal(plugin.saves, 1);
});

test("the code block ID is trimmed", async () => {
	const { tab, plugin } = makeTab();
	await tab.setControlValue("codeBlockId", " x ");
	assert.equal(plugin.settings.codeBlockId, "x");
});

test("plain settings are stored as given", async () => {
	const { tab, plugin } = makeTab();
	await tab.setControlValue("fontSize", 14);
	assert.equal(plugin.settings.fontSize, 14);
});

test("validators reject empty or non-positive input", () => {
	const { tab } = makeTab();
	const byKey = Object.fromEntries(controls(tab).map((c) => [c.key, c]));
	assert.ok(byKey.codeBlockId.validate(""));
	assert.ok(byKey.codeBlockId.validate("   "));
	assert.equal(byKey.codeBlockId.validate("sfb-figlet"), undefined);
	assert.ok(byKey.fontSize.validate(0));
	assert.ok(byKey.lineHeight.validate(0));
	assert.ok(byKey.gradientColors.validate("  "));
	assert.equal(byKey.gradientColors.validate("#f00"), undefined);
});

function findItem(tab, name) {
	return tab
		.getSettingDefinitions()
		.flatMap((group) => group.items ?? [])
		.find((item) => item.name === name);
}

test("Reset to default colors restores the palette, saves and updates the tab", async () => {
	const { tab, plugin } = makeTab();
	let updates = 0;
	tab.update = () => updates++;
	plugin.settings.gradientColors = ["#000"];
	findItem(tab, "Reset to default colors").action();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(plugin.settings.gradientColors, generator.DEFAULT_GRADIENT_COLORS);
	assert.equal(plugin.saves, 1);
	assert.equal(updates, 1);
});

test("the Code block usage entry does not show the language ID", () => {
	const { tab, plugin } = makeTab();
	const before = findItem(tab, "Code block usage").desc;
	plugin.settings.codeBlockId = "other-id";
	assert.equal(findItem(tab, "Code block usage").desc, before);
	assert.ok(!before.includes("sfb-figlet"));
});

test("the setting pages open with their titles", () => {
	const { tab } = makeTab();
	assert.equal(findItem(tab, "Favorite fonts").page().title, "Favorite fonts");
	assert.equal(findItem(tab, "Code block usage").page().title, "Code block usage");
});

test("the favorites page updates the tab when it closes, not before", () => {
	const { tab } = makeTab();
	let updates = 0;
	tab.update = () => updates++;
	const page = findItem(tab, "Favorite fonts").page();
	assert.equal(updates, 0);
	page.hide();
	assert.equal(updates, 1);
});

test("the favorites count reflects the current favorites", () => {
	const { tab, plugin } = makeTab();
	plugin.settings.favoriteFonts = ["Big", "Slant"];
	assert.equal(findItem(tab, "Favorite fonts").displayValue(), "2 favorites");
});
