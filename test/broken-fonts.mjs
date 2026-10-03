// Stand-in for src/bundled-fonts.ts: every font is in the bundle but fails
// to decode, the way a corrupt gzip entry would.
export async function readBundledFont() {
	throw new Error("invalid gzip data");
}
