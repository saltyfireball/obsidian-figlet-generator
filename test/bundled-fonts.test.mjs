import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));

// The plugin runs in a browser window; node has the same globals minus the name.
globalThis.window ??= globalThis;

// Bundle the generator the way the plugin build does (browser figlet, no fonts
// folder on disk) so the test sees exactly what a fresh install sees.
async function loadModules() {
	const pluginPath = join(root, "scripts/figlet-fonts-plugin.mjs");
	const plugins = existsSync(pluginPath)
		? [(await import(pathToFileURL(pluginPath).href)).figletFontsPlugin()]
		: [];
	const outdir = mkdtempSync(join(tmpdir(), "figlet-test-"));
	await esbuild.build({
		entryPoints: [join(root, "src/generator.ts"), join(root, "src/bundled-fonts.ts")],
		bundle: true,
		format: "esm",
		platform: "browser",
		outdir,
		outExtension: { ".js": ".mjs" },
		alias: { obsidian: join(root, "test/obsidian-stub.mjs") },
		plugins,
		logLevel: "silent",
	});
	return Promise.all(
		["generator.mjs", "bundled-fonts.mjs"].map((f) => import(pathToFileURL(join(outdir, f)).href)),
	);
}

const [generator, bundledFonts] = await loadModules();

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
