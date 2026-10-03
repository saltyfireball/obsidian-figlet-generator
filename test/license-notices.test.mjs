import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { licenseNotices } from "../scripts/license-notices.mjs";
import { root } from "./bundle.mjs";

test("names each bundled package with its full license text", () => {
	const notices = licenseNotices(["node_modules/figlet/dist/node-figlet.mjs", "src/main.ts"], root);
	const { version } = JSON.parse(readFileSync(join(root, "node_modules/figlet/package.json"), "utf8"));
	const license = readFileSync(join(root, "node_modules/figlet/LICENSE.txt"), "utf8").trim();
	assert.ok(notices.startsWith("/*!"), "must be a legal comment so minify keeps it");
	assert.ok(notices.includes(`figlet@${version}`));
	assert.ok(notices.includes(license));
});

test("lists a package once however many of its files are bundled", () => {
	const notices = licenseNotices(["node_modules/figlet/a.js", "node_modules/figlet/b.js"], root);
	assert.equal(notices.split("figlet@").length - 1, 1);
});

test("is empty when nothing comes from node_modules", () => {
	assert.equal(licenseNotices(["src/main.ts"], root), "");
});
