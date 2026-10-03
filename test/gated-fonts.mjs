// Stand-in for src/bundled-fonts.ts: every read waits on a gate the test
// opens, so many reads finish in the same tick, the way a note full of
// figlet blocks can load in Obsidian.
export async function readBundledFont(name) {
	await globalThis.__figletFontGate;
	return globalThis.__figletReadFont(name);
}
