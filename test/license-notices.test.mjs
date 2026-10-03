import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { figletFontsDir } from "../scripts/figlet-fonts-plugin.mjs";
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

/** Write node_modules/<rel> with a package.json and a LICENSE under a temp root. */
function fakePackage(base, rel, name, version) {
	const dir = join(base, "node_modules", rel);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, license: "MIT" }));
	writeFileSync(join(dir, "LICENSE"), `license of ${name} ${version}`);
}

const fixture = mkdtempSync(join(tmpdir(), "license-notices-"));
fakePackage(fixture, "parent", "parent", "1.0.0");
fakePackage(fixture, "parent/node_modules/child", "child", "2.0.0");
fakePackage(fixture, "child", "child", "1.0.0");
fakePackage(fixture, "@scope/pkg/node_modules/@scope/inner", "@scope/inner", "3.0.0");

test("a file under nested node_modules is credited to the nested package", () => {
	const notices = licenseNotices(["node_modules/parent/node_modules/child/index.js"], fixture);
	assert.ok(notices.includes("child@2.0.0"));
	assert.ok(notices.includes("license of child 2.0.0"));
	assert.ok(!notices.includes("parent@"));
});

test("two versions of one package each get their own notice", () => {
	const notices = licenseNotices(
		["node_modules/child/index.js", "node_modules/parent/node_modules/child/index.js"],
		fixture,
	);
	assert.ok(notices.includes("license of child 1.0.0"));
	assert.ok(notices.includes("license of child 2.0.0"));
});

test("a nested scoped package keeps its scope", () => {
	const notices = licenseNotices(["node_modules/@scope/pkg/node_modules/@scope/inner/x.js"], fixture);
	assert.ok(notices.includes("@scope/inner@3.0.0"));
});

test("the fonts folder alone credits figlet, without figlet's code", () => {
	const notices = licenseNotices(["figlet-fonts:virtual:figlet-fonts", `${figletFontsDir}/`], root);
	assert.ok(notices.includes("figlet@"));
});
