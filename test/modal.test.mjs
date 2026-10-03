import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSrc } from "./bundle.mjs";

const [modal, generator] = await loadSrc(["modal", "generator"]);

const settings = { ...generator.DEFAULT_FIGLET_SETTINGS, codeBlockId: "my-figlet" };

test("the inserted code block uses the language ID from settings", () => {
	const block = modal.buildCodeBlock(settings, "Hi", "Big", "");
	assert.equal(block.split("\n")[0], "```my-figlet");
});

test("the inserted code block falls back to sfb-figlet without a language ID", () => {
	const block = modal.buildCodeBlock({ ...settings, codeBlockId: undefined }, "Hi", "Big", "");
	assert.equal(block.split("\n")[0], "```sfb-figlet");
});

test("rainbow writes out the palette from settings", () => {
	const block = modal.buildCodeBlock(settings, "Hi", "Big", "rainbow");
	assert.ok(block.includes(`colors: ${settings.gradientColors.join(" ")}`));
});
