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
	// Mixing numbers and percentages is invalid CSS: the stop renders transparent
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
	// Out-of-range channels clamp to 0-255, as CSS does
	["negative and exponent numbers", "rgb(2.55e2 -10 0)", "rgb(0, -1, 300)"],
	["the none keyword", "rgb(255 none 0)", "rgb(none 0 255 / none)"],
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

test("mixed number and percentage channels render transparent instead of blending", () => {
	const colors = spanColors(generator.createFigletHtml(ART, { colors: ["rgb(100%, 0, 0)", "rgb(0, 0, 255)"] }));
	assert.deepEqual([...new Set(colors)], ["transparent", "rgb(0, 0, 255)"]);
});

test("malformed rgb() is rejected, not passed to the style attribute", () => {
	for (const bad of ["rgb(1 / 2 / 3)", "rgb(1, 2 3)", "rgb(none, 0, 0)", "rgb(none% 0 0)", "rgb(1 2 3 4)", "rgb(1e2 -5 +.5e-1%)", "rgb(1\n2\n3)", "rgb(1,\n2, 3)"]) {
		const colors = spanColors(generator.createFigletHtml(ART, { colors: [bad, "rgb(0, 0, 255)"] }));
		assert.ok(!colors.includes(bad), `${bad} reached the style attribute`);
	}
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
