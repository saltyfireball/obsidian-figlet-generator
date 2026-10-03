import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where the bundled fonts come from. The fonts module is virtual, so the
 * esbuild metafile does not show this path: the build passes it to
 * licenseNotices so figlet is credited for its fonts on their own.
 */
export const figletFontsDir = "node_modules/figlet/fonts";

/**
 * esbuild plugin: serves `virtual:figlet-fonts`, a map of font name to its
 * gzipped .flf as base64, built from src/font-list.json. The community
 * directory ships only main.js, manifest.json and styles.css, so the fonts
 * have to live inside main.js.
 */
export function figletFontsPlugin() {
	return {
		name: "figlet-fonts",
		setup(build) {
			build.onResolve({ filter: /^virtual:figlet-fonts$/ }, (args) => ({
				path: args.path,
				namespace: "figlet-fonts",
			}));
			build.onLoad({ filter: /.*/, namespace: "figlet-fonts" }, () => {
				const listPath = join(root, "src/font-list.json");
				const fontsDir = join(root, figletFontsDir);
				const names = JSON.parse(readFileSync(listPath, "utf8"));
				const fonts = {};
				for (const name of names) {
					const flf = readFileSync(join(fontsDir, `${name}.flf`));
					fonts[name] = gzipSync(flf, { level: 9 }).toString("base64");
				}
				return {
					// The comment survives minify (legal comment) so a reader of
					// main.js can tell this blob is font data, not code.
					contents: `/*! Figlet fonts: each value is a gzipped .flf font file from the figlet npm package, base64 encoded. Built by scripts/figlet-fonts-plugin.mjs; see README "About the font data in main.js". */\nexport default ${JSON.stringify(fonts)};`,
					loader: "js",
					watchFiles: [listPath],
				};
			});
		},
	};
}
