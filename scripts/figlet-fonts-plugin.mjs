import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
				const fontsDir = join(root, "node_modules/figlet/fonts");
				const names = JSON.parse(readFileSync(listPath, "utf8"));
				const fonts = {};
				for (const name of names) {
					const flf = readFileSync(join(fontsDir, `${name}.flf`));
					fonts[name] = gzipSync(flf, { level: 9 }).toString("base64");
				}
				return {
					contents: `export default ${JSON.stringify(fonts)};`,
					loader: "js",
					watchFiles: [listPath],
				};
			});
		},
	};
}
