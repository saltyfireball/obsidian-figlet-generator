import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build a legal comment holding the license of every npm package bundled
 * into the output. `inputs` are the input paths from an esbuild metafile;
 * packages are found by their node_modules folder, so whatever esbuild
 * pulled in is covered without a hand-kept list. A file under nested
 * node_modules is credited to the innermost package, the one it belongs to.
 */
export function licenseNotices(inputs, root = process.cwd()) {
	const dirs = new Set();
	for (const input of inputs) {
		// Greedy: the last node_modules segment names the owning package
		const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input);
		if (match) dirs.add(match[1]);
	}
	if (dirs.size === 0) return "";

	const sections = [...dirs]
		.map((rel) => {
			const dir = join(root, rel);
			const { name, version, license } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
			const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
			const text = file ? readFileSync(join(dir, file), "utf8").trim() : `License: ${license}`;
			return { id: `${name}@${version}`, text };
		})
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
		// Two copies of the same version carry the same license
		.filter((s, i, all) => i === 0 || all[i - 1].id !== s.id)
		.map((s) => `${s.id}\n\n${s.text}`);

	// A license text must not end the comment early
	const body = sections.join("\n\n---\n\n").replace(/\*\//g, "* /");
	return `/*! Third-party software bundled in this file:\n\n${body}\n*/\n`;
}
