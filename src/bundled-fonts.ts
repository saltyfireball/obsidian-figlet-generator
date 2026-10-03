import fonts from "virtual:figlet-fonts";

/**
 * Read a font bundled into main.js. Fonts are stored gzipped as base64 and
 * only decompressed when a render asks for them.
 */
export async function readBundledFont(name: string): Promise<string | null> {
	if (!Object.prototype.hasOwnProperty.call(fonts, name)) return null;

	const binary = window.atob(fonts[name]);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return new Response(stream).text();
}
