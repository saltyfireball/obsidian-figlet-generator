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

test("font pickers list miniwi, which has no capitalised twin", () => {
	assert.ok(generator.getAvailableFonts().includes("miniwi"));
});

test("font pickers hide only lowercase fonts that alias another font", () => {
	const list = JSON.parse(readFileSync(join(root, "src/font-list.json"), "utf8"));
	const shown = new Set(generator.getAvailableFonts());
	for (const font of list) {
		if (shown.has(font)) continue;
		const twin = list.find((f) => f !== font && f.toLowerCase() === font.toLowerCase());
		assert.ok(twin && shown.has(twin), `font ${font} is hidden but has no listed twin`);
	}
});

// figlet 1.12 fixed this glyph (1.10 drew it differently). The fonts ship
// inside main.js, so a figlet upgrade that changes them must show up here.
test("3D-ASCII draws lowercase y as figlet 1.12 does", async () => {
	const art = await generator.generateFigletText("y", "3D-ASCII");
	assert.equal(
		art,
		"  ___    ___ \n |\\  \\  /  /|\n \\ \\  \\/  / /\n  \\ \\    / / \n   \\/   / /  \n __/   / /   \n|\\____/ /    \n\\|____|/     \n             \n             ",
	);
});
