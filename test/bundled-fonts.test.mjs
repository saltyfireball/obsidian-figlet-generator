import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSrc, root } from "./bundle.mjs";

const [generator, bundledFonts] = await loadSrc(["generator", "bundled-fonts"]);

test("renders Standard without a fonts folder", async () => {
	const art = await generator.generateFigletText("Hi", "Standard");
	assert.ok(art.split("\n").length >= 4, `expected multi-line art, got: ${JSON.stringify(art)}`);
	assert.match(art, /\|/);
});

test("every listed font is bundled as a valid figlet font", async () => {
	const list = JSON.parse(readFileSync(join(root, "src/font-list.json"), "utf8"));
	for (const font of list) {
		const data = await bundledFonts.readBundledFont(font);
		assert.match(data ?? "", /^\uFEFF?[ft]lf2a/, `font ${font} is missing or not a figlet font`);
	}
});

test("an unknown font falls back to Standard", async () => {
	const fallback = await generator.generateFigletText("Hi", "No Such Font");
	const standard = await generator.generateFigletText("Hi", "Standard");
	assert.equal(fallback, standard);
});
