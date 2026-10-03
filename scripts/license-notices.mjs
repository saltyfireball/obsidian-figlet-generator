import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build a legal comment holding the license of every npm package bundled
 * into the output. `inputs` are the input paths from an esbuild metafile;
 * packages are found by their node_modules folder, so whatever esbuild
 * pulled in is covered without a hand-kept list.
 */
export function licenseNotices(inputs, root = process.cwd()) {
	const packages = new Set();
	for (const input of inputs) {
		const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
		if (match) packages.add(match[1]);
	}
	if (packages.size === 0) return "";

	const sections = [...packages].sort().map((name) => {
		const dir = join(root, "node_modules", name);
		const { version, license } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
		const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
		const text = file ? readFileSync(join(dir, file), "utf8").trim() : `License: ${license}`;
		return `${name}@${version}\n\n${text}`;
	});

	// A license text must not end the comment early
	const body = sections.join("\n\n---\n\n").replace(/\*\//g, "* /");
	return `/*! Third-party software bundled in this file:\n\n${body}\n*/\n`;
}
