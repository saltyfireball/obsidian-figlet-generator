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
	"percentage rgb()": ["rgb(100%, 0%, 0%)", "rgb(0%, 0%, 100%)"],
	// Mixing numbers and percentages is invalid CSS: it bands by design
	"mixed rgb() channels": ["rgb(100%, 0, 0)", "rgb(0, 0, 255)"],
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

test("percentage rgb() blends the same as numeric rgb()", () => {
	const pct = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(100%, 0%, 0%)", "rgba(0%, 0%, 100%, 50%)"] }));
	const num = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(255, 0, 0)", "rgb(0, 0, 255)"] }));
	assert.deepEqual(pct, num);
	assert.ok(pct.length > 2, "expected a blend, not two bands");
});

for (const [label, from, to] of [
	["space-separated numbers", "rgb(255 0 0)", "rgb(0 0 255 / 50%)"],
	["space-separated percentages", "rgb(100% 0% 0%)", "rgba(0% 0% 100% / .5)"],
	["percentages without a leading zero", "rgb(100%, .0%, 0%)", "rgb(.0%, 0%, 100%)"],
]) {
	test(`${label} blend the same as comma-separated numbers`, () => {
		const got = spanColors(generator.createFigletHtml(ART, { colors: [from, to] }));
		const num = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(255, 0, 0)", "rgb(0, 0, 255)"] }));
		assert.deepEqual(got, num);
	});
}

test("a percentage below 1% without a leading zero blends", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(.5%, 0%, 0%)", "rgb(0%, 0%, 100%)"] }));
	assert.ok(colors.length > 2, "expected a blend, not two bands");
	assert.equal(colors[0], "#010000");
});

test("mixed number and percentage channels band instead of blending", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(100%, 0, 0)", "rgb(0, 0, 255)"] }));
	assert.deepEqual([...new Set(colors)], ["rgb(100%, 0, 0)", "rgb(0, 0, 255)"]);
});

test("fractional percentages round to the nearest channel value", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(50%, 50%, 50%)", "rgb(50%, 50%, 50%)"] }));
	assert.equal(colors[0], "#808080");
});

test("hex gradient runs from the first color to the last", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["#ff0000", "#0000ff"] }));
	assert.equal(colors[0], "#ff0000");
	assert.equal(colors[colors.length - 1], "#0000ff");
});
