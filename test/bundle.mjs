import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { figletFontsPlugin } from "../scripts/figlet-fonts-plugin.mjs";

export const root = fileURLToPath(new URL("..", import.meta.url));

// The plugin runs in a browser window; node has the same globals minus the name.
globalThis.window ??= globalThis;

/** esbuild plugin: swap import specifiers (as written in src) for test files. */
function replaceImports(replacements) {
	return {
		name: "replace-imports",
		setup(build) {
			build.onResolve({ filter: /.*/ }, (args) =>
				Object.prototype.hasOwnProperty.call(replacements, args.path)
					? { path: replacements[args.path] }
					: undefined,
			);
		},
	};
}

/**
 * Bundle src modules the way the plugin build does (browser figlet, fonts
 * embedded, no fonts folder on disk) and import them. `names` are files under
 * src/ without the extension; `replacements` maps an import specifier used in
 * src to a test file to bundle in its place. Returns the modules in order.
 */
export async function loadSrc(names, replacements = {}) {
	const outdir = mkdtempSync(join(tmpdir(), "figlet-test-"));
	await esbuild.build({
		entryPoints: names.map((n) => join(root, `src/${n}.ts`)),
		bundle: true,
		format: "esm",
		platform: "browser",
		outdir,
		outExtension: { ".js": ".mjs" },
		alias: { obsidian: join(root, "test/obsidian-stub.mjs") },
		plugins: [replaceImports(replacements), figletFontsPlugin()],
		logLevel: "silent",
	});
	return Promise.all(names.map((n) => import(pathToFileURL(join(outdir, `${n}.mjs`)).href)));
}
