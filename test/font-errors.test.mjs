import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadSrc, root } from "./bundle.mjs";

const [generator] = await loadSrc(["generator"], {
	"./bundled-fonts": join(root, "test/broken-fonts.mjs"),
});

test("a Standard font that fails to decode is named as such, with the cause", async () => {
	await assert.rejects(generator.generateFigletText("Hi", "Big"), (err) => {
		assert.equal(err.message, "Figlet: the Standard font failed to decode");
		assert.equal(err.cause?.message, "invalid gzip data");
		return true;
	});
});
