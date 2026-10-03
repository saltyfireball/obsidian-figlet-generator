import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadSrc, root } from "./bundle.mjs";

globalThis.__figletReadFont = (name) => {
	const path = join(root, "node_modules/figlet/fonts", `${name}.flf`);
	return existsSync(path) ? readFileSync(path, "utf8") : null;
};

const [generator] = await loadSrc(["generator"], { "./bundled-fonts": join(root, "test/gated-fonts.mjs") });

const FONTS = ["Standard", "Big", "Slant", "Banner", "Doom", "Small", "Block", "ANSI Shadow"];

function openGate() {
	globalThis.__figletFontGate = Promise.resolve();
}

async function renderTogether(fonts, text) {
	let release;
	globalThis.__figletFontGate = new Promise((r) => (release = r));
	const pending = fonts.map((font) => generator.generateFigletText(text, font));
	release();
	return Promise.all(pending);
}

test("renders that load fonts in the same tick each get their own font", async () => {
	openGate();
	const expected = [];
	for (const font of FONTS) expected.push(await generator.generateFigletText("Race", font));

	const together = await renderTogether(FONTS, "Race");

	together.forEach((art, i) => assert.equal(art, expected[i], `render in ${FONTS[i]}`));
});

test("renders in the same font in the same tick all succeed", async () => {
	openGate();
	const expected = await generator.generateFigletText("Same", "Big");

	const together = await renderTogether(Array(6).fill("Big"), "Same");

	for (const art of together) assert.equal(art, expected);
});
