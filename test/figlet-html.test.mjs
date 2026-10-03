import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSrc, root } from "./bundle.mjs";
import { FakeElement } from "./fake-dom.mjs";

const [generator] = await loadSrc(["generator"]);

// HTML the plugin inserted into notes before the DOM refactor. Inserted HTML
// lives on in users' notes, so its format must not change.
const golden = JSON.parse(readFileSync(join(root, "test/fixtures/figlet-html.json"), "utf8"));

for (const [label, { options, html }] of Object.entries(golden.cases)) {
	test(`createFigletHtml keeps its output: ${label}`, () => {
		assert.equal(generator.createFigletHtml(golden.art, options ?? undefined), html);
	});

	test(`renderFiglet builds the same element as the HTML: ${label}`, () => {
		const parent = new FakeElement("div");
		generator.renderFiglet(parent, golden.art, options ?? undefined);
		assert.equal(parent.children.length, 1);
		assert.equal(parent.children[0].toHtml(), html);
	});
}

test("text is escaped in the HTML, not interpreted", () => {
	const html = generator.createFigletHtml('<img src=x onerror="alert(1)">');
	assert.doesNotMatch(html, /<img/);
	assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});
