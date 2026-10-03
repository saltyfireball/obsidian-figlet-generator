import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, constants } from "node:zlib";
import { loadSrc } from "./bundle.mjs";

const [{ gunzip }] = await loadSrc(["inflate"]);

// Deterministic pseudo-random bytes, so failures reproduce
function noise(n, seed = 1) {
	const out = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		seed = (seed * 1103515245 + 12345) >>> 0;
		out[i] = seed >>> 24;
	}
	return out;
}

const text = new TextEncoder().encode("figlet ".repeat(5000) + "the quick brown fox");

const CASES = {
	"stored blocks (level 0)": gzipSync(text, { level: 0 }),
	"fixed Huffman (short input)": gzipSync(new TextEncoder().encode("abc"), { strategy: constants.Z_FIXED }),
	"fixed Huffman (long input)": gzipSync(text, { strategy: constants.Z_FIXED }),
	"dynamic Huffman": gzipSync(text, { level: 9 }),
	"incompressible data": gzipSync(noise(70000)),
	"empty input": gzipSync(new Uint8Array(0)),
};

const ORIGINALS = {
	"fixed Huffman (short input)": new TextEncoder().encode("abc"),
	"incompressible data": noise(70000),
	"empty input": new Uint8Array(0),
};

for (const [label, gz] of Object.entries(CASES)) {
	test(`gunzip: ${label}`, () => {
		assert.deepEqual(Buffer.from(gunzip(new Uint8Array(gz))), Buffer.from(ORIGINALS[label] ?? text));
	});
}

test("gunzip rejects data that is not gzip", () => {
	assert.throws(() => gunzip(new TextEncoder().encode("not gzip data at all")), /not gzip/);
});

test("gunzip rejects truncated data", () => {
	const gz = gzipSync(text, { level: 9 });
	assert.throws(() => gunzip(new Uint8Array(gz.subarray(0, gz.length >> 1))), /inflate/);
});
