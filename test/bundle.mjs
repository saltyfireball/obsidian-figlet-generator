import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { figletFontsPlugin } from "../scripts/figlet-fonts-plugin.mjs";

export const root = fileURLToPath(new URL("..", import.meta.url));

// The plugin runs in a browser window; node has the same globals minus the name.
globalThis.window ??= globalThis;

/**
 * Bundle src modules the way the plugin build does (browser figlet, fonts
 * embedded, no fonts folder on disk) and import them. Takes names under src/
 * without the extension, returns the modules in the same order.
 */
export async function loadSrc(...names) {
	const outdir = mkdtempSync(join(tmpdir(), "figlet-test-"));
	await esbuild.build({
		entryPoints: names.map((n) => join(root, `src/${n}.ts`)),
		bundle: true,
		format: "esm",
		platform: "browser",
		outdir,
		outExtension: { ".js": ".mjs" },
		alias: { obsidian: join(root, "test/obsidian-stub.mjs") },
		plugins: [figletFontsPlugin()],
		logLevel: "silent",
	});
	return Promise.all(names.map((n) => import(pathToFileURL(join(outdir, `${n}.mjs`)).href)));
}
