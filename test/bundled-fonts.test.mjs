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

test("every listed font decodes to exactly its source file", async () => {
	const list = JSON.parse(readFileSync(join(root, "src/font-list.json"), "utf8"));
	for (const font of list) {
		const data = await bundledFonts.readBundledFont(font);
		// TextDecoder drops a leading byte-order mark, as reading the file did
		const source = readFileSync(join(root, "node_modules/figlet/fonts", `${font}.flf`), "utf8").replace(/^\uFEFF/, "");
		assert.ok(data === source, `font ${font} does not match node_modules/figlet/fonts/${font}.flf`);
		assert.match(data, /^[ft]lf2a/, `font ${font} is not a figlet font`);
	}
});

test("works without DecompressionStream (older iOS)", async () => {
	const saved = globalThis.DecompressionStream;
	delete globalThis.DecompressionStream;
	try {
		const art = await generator.generateFigletText("Hi", "Big");
		assert.ok(art.split("\n").length >= 4);
	} finally {
		globalThis.DecompressionStream = saved;
	}
});

test("an unknown font falls back to Standard", async () => {
	const fallback = await generator.generateFigletText("Hi", "No Such Font");
	const standard = await generator.generateFigletText("Hi", "Standard");
	assert.equal(fallback, standard);
});
