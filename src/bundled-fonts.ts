import fonts from "virtual:figlet-fonts";
import { gunzipSync } from "fflate";

/**
 * Read a font bundled into main.js. Fonts are stored gzipped as base64 (see
 * scripts/figlet-fonts-plugin.mjs) and only decompressed when a render asks
 * for them.
 */
export function readBundledFont(name: string): Promise<string | null> {
	if (!Object.prototype.hasOwnProperty.call(fonts, name)) return Promise.resolve(null);

	const binary = window.atob(fonts[name]);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

	return Promise.resolve(new TextDecoder().decode(gunzipSync(bytes)));
}
