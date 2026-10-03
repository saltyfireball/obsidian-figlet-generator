import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSrc } from "./bundle.mjs";

const [generator] = await loadSrc(["generator"]);

const ART = "ABCDEFGHIJ\nABCDEFGHIJ";

function spanColors(html) {
	return [...html.matchAll(/<span style="color: ([^"]*)">/g)].map((m) => m[1]);
}

const ACCEPTED_INPUTS = {
	"six-digit hex": ["#FF0000", "#0000FF"],
	"three-digit hex": ["#f00", "#00f"],
	"eight-digit hex": ["#FF0000FF", "#0000FFFF"],
	"rgb()": ["rgb(255, 0, 0)", "rgb(0, 0, 255)"],
	"named colors": ["red", "blue"],
	"CSS variables": ["var(--text-accent)", "var(--text-error)"],
	"mixed": ["red", "#00f", "rgb(0, 255, 0)"],
};

for (const [label, colors] of Object.entries(ACCEPTED_INPUTS)) {
	test(`gradient from ${label} has no NaN colors`, () => {
		const html = generator.createFigletHtml(ART, { colors });
		assert.doesNotMatch(html, /NaN/);
		for (const color of spanColors(html)) {
			assert.ok(color.length > 0, "empty span color");
		}
	});
}

test("short hex interpolates the same as long hex", () => {
	const short = spanColors(generator.createFigletHtml(ART, { colors: ["#f00", "#00f"] }));
	const long = spanColors(generator.createFigletHtml(ART, { colors: ["#ff0000", "#0000ff"] }));
	assert.deepEqual(short, long);
});

test("hex gradient runs from the first color to the last", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["#ff0000", "#0000ff"] }));
	assert.equal(colors[0], "#ff0000");
	assert.equal(colors[colors.length - 1], "#0000ff");
});
