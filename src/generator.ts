import figletLib from "figlet";
import { readBundledFont } from "./bundled-fonts";
import fontList from "./font-list.json";

/**
 * Sanitize a CSS color value to prevent injection
 * Only allows safe color formats: hex, rgb/rgba, hsl/hsla, named colors
 */
function sanitizeColor(color: string): string {
	const trimmed = color.trim();
	// Allow hex colors
	if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return trimmed;
	// Allow rgb/rgba
	if (/^rgba?\(\s*[\d.,\s%]+\)$/i.test(trimmed)) return trimmed;
	// Allow hsl/hsla
	if (/^hsla?\(\s*[\d.,\s%deg]+\)$/i.test(trimmed)) return trimmed;
	// Allow CSS named colors (basic set) and CSS variables
	if (/^[a-zA-Z]+$/.test(trimmed) || /^var\(--[\w-]+\)$/.test(trimmed)) return trimmed;
	// Default to transparent for invalid values
	return "transparent";
}

// All font names. Each one is bundled from figlet/fonts/<name>.flf at build time
// (scripts/figlet-fonts-plugin.mjs), so the list and the bundle cannot drift.
const ALL_FONT_FILES: string[] = fontList;

// Filter to only show "display name" fonts (exclude lowercase/underscore aliases)
// These are duplicates with nicer formatting
function isDisplayFont(font: string): boolean {
	const firstChar = font.charAt(0);
	// Keep fonts starting with uppercase or numbers
	if (firstChar >= "A" && firstChar <= "Z") return true;
	if (firstChar >= "0" && firstChar <= "9") return true;
	// Exclude lowercase aliases (they have uppercase equivalents)
	return false;
}

// Fonts shown in the UI (filtered to remove duplicates)
export const AVAILABLE_FONTS = ALL_FONT_FILES.filter(isDisplayFont).sort();

/**
 * Map a font name to its listed spelling, ignoring case
 */
function resolveFontName(input: string): string {
	if (ALL_FONT_FILES.includes(input)) return input;
	const lower = input.toLowerCase();
	const match = ALL_FONT_FILES.find((f) => f.toLowerCase() === lower);
	return match ?? input;
}

/**
 * Read a font bundled into main.js, or null if it is missing or unreadable
 */
async function readFont(fontName: string): Promise<string | null> {
	try {
		const fontData = await readBundledFont(fontName);
		if (fontData === null) {
			console.warn(`Figlet: font "${fontName}" not found, falling back to Standard`);
		}
		return fontData;
	} catch (err) {
		console.warn(`Figlet: font "${fontName}" failed to load, falling back to Standard`, err);
		return null;
	}
}

/**
 * Unload all fonts from memory
 */
function unloadFonts(): void {
	const lib = figletLib as unknown as Record<string, unknown>;
	if (typeof lib.clearLoadedFonts === "function") {
		(lib.clearLoadedFonts as () => void)();
	}
}

// Default favorite fonts
export const DEFAULT_FAVORITE_FONTS = [
	"Standard",
	"Banner",
	"Big",
	"Slant",
	"Small",
	"ANSI Shadow",
	"Block",
	"Doom",
	"Epic",
	"Graffiti",
];

// Default rainbow gradient colors
export const DEFAULT_GRADIENT_COLORS = [
	"#FF6188",
	"#FC9867",
	"#FFD866",
	"#A9DC76",
	"#78DCE8",
	"#5C7CFA",
	"#AB9DF2",
];

export interface FigletSettings {
	enabled: boolean;
	favoriteFonts: string[];
	lastUsedFont: string;
	lastUsedColor: string;
	// Display styling
	fontSize: number;
	lineHeight: number;
	centered: boolean;
	// Gradient colors for rainbow mode
	gradientColors: string[];
}

export const DEFAULT_FIGLET_SETTINGS: FigletSettings = {
	enabled: true,
	favoriteFonts: DEFAULT_FAVORITE_FONTS,
	lastUsedFont: "Standard",
	lastUsedColor: "",
	// Display styling defaults
	fontSize: 10,
	lineHeight: 1,
	centered: true,
	gradientColors: DEFAULT_GRADIENT_COLORS,
};

export interface FigletStyleOptions {
	color?: string;
	colors?: string[]; // Multiple colors for gradient effect
	fontSize?: number;
	lineHeight?: number;
	centered?: boolean;
	opacity?: number; // 0-1, defaults to 1
}

/**
 * Check if a font name resolves to an available font
 */
export function isFontAvailable(fontName: string): boolean {
	const resolved = resolveFontName(fontName);
	return ALL_FONT_FILES.some((f) => f.toLowerCase() === resolved.toLowerCase());
}

/**
 * Generate figlet text asynchronously
 * Reads the font, then parses, renders and unloads it in one synchronous step.
 * Renders run concurrently (one per code block), and each one unloads every
 * font, so nothing may await between parsing a font and rendering with it.
 */
export async function generateFigletText(
	text: string,
	font: string = "Standard",
): Promise<string> {
	font = resolveFontName(font);
	let fontData = await readFont(font);
	if (fontData === null) {
		font = "Standard";
		fontData = await readFont(font);
		if (fontData === null) throw new Error("Figlet: the Standard font is missing from the bundle");
	}

	try {
		figletLib.parseFont(font, fontData);
		return figletLib.textSync(text, { font });
	} finally {
		// Unload fonts after generation to free memory
		unloadFonts();
	}
}

type Rgb = [number, number, number];

/**
 * Parse a hex (#rgb, #rgba, #rrggbb, #rrggbbaa) or rgb()/rgba() color into
 * its red, green and blue channels. Alpha is dropped. Returns null for
 * anything else (named colors, var(--x), hsl), which cannot be mixed here.
 */
function parseRgb(color: string): Rgb | null {
	const hex = /^#([0-9a-f]{3,8})$/i.exec(color)?.[1];
	if (hex && (hex.length === 3 || hex.length === 4)) {
		return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as Rgb;
	}
	if (hex && (hex.length === 6 || hex.length === 8)) {
		return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
	}

	const fn = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*[\d.]+%?\s*)?\)$/i.exec(color);
	if (fn) {
		return [fn[1], fn[2], fn[3]].map((c) => Math.min(255, Math.round(Number(c)))) as Rgb;
	}
	return null;
}

function toHex([r, g, b]: Rgb): string {
	return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Get color at position along gradient. Stops that all parse to RGB are
 * blended smoothly; otherwise each position takes its nearest stop, so named
 * colors and CSS variables still band across the text instead of breaking.
 */
function getGradientColor(colors: string[], position: number): string {
	if (colors.length === 1) return colors[0];

	const scaledPos = Math.min(Math.max(position, 0), 1) * (colors.length - 1);
	const index = Math.min(Math.floor(scaledPos), colors.length - 2);
	const factor = scaledPos - index;

	const from = parseRgb(colors[index]);
	const to = parseRgb(colors[index + 1]);
	if (!from || !to) return colors[Math.round(scaledPos)];

	return toHex(from.map((c, i) => Math.round(c + (to[i] - c) * factor)) as Rgb);
}

/**
 * Create gradient text using colored spans (works in PDF unlike CSS background-clip)
 * Splits each line into character segments with interpolated colors
 */
function createGradientHtml(
	figletText: string,
	options: FigletStyleOptions,
): string {
	// Sanitize colors to prevent CSS injection
	const colors = options.colors!.map(sanitizeColor);
	const fontSize = options.fontSize ?? 10;
	const lineHeight = options.lineHeight ?? 1;
	const centered = options.centered !== false;

	const lines = figletText.split("\n");

	// Remove empty trailing lines
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}

	// Trim trailing whitespace from each line (figlet pads with spaces)
	const trimmedLines = lines.map((l) => l.trimEnd());
	const maxLineLength = Math.max(...trimmedLines.map((l) => l.length));

	// Build colored lines - each character gets its color based on horizontal position
	const coloredLines = trimmedLines.map((line) => {
		if (line.length === 0) return "";

		let result = "";
		let currentColor = "";
		let currentChars = "";

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			// Calculate position along gradient (0 to 1)
			const position = maxLineLength > 1 ? i / (maxLineLength - 1) : 0;
			const color = getGradientColor(colors, position);

			if (color === currentColor) {
				currentChars += char;
			} else {
				// Flush previous segment
				if (currentChars) {
					const escaped = currentChars
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;");
					result += `<span style="color: ${currentColor}">${escaped}</span>`;
				}
				currentColor = color;
				currentChars = char;
			}
		}

		// Flush final segment
		if (currentChars) {
			const escaped = currentChars
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			result += `<span style="color: ${currentColor}">${escaped}</span>`;
		}

		return result;
	});

	const opacity = options.opacity ?? 1;

	const preStyles = [
		"margin: 0",
		"padding: 5px 0",
		"border: none",
		"font-family: monospace",
		"white-space: pre",
		"display: inline-block",
		`font-size: ${fontSize}px`,
		`line-height: ${lineHeight}`,
	];

	if (opacity !== 1) {
		preStyles.push(`opacity: ${opacity}`);
	}

	const containerStyles = ["display: flex", "padding: 5px 0"];
	const containerClasses = ["sfb-figlet-display", "sfb-figlet-gradient"];

	if (centered) {
		containerStyles.push("justify-content: center");
	} else {
		containerStyles.push("justify-content: flex-start");
		containerClasses.push("sfb-figlet-left");
	}

	const content = coloredLines.join("\n");

	return `<div class="${containerClasses.join(" ")}" style="${containerStyles.join("; ")}"><pre style="${preStyles.join("; ")}">${content}</pre></div>`;
}

/**
 * Create the HTML output for figlet text
 */
export function createFigletHtml(
	figletText: string,
	options?: FigletStyleOptions,
): string {
	// Normalize: if colors has exactly 1 entry, treat as single color
	if (options?.colors && options.colors.length === 1) {
		options = { ...options, color: options.colors[0], colors: undefined };
	}

	// Use colored spans for gradient - works in PDF unlike CSS background-clip
	if (options?.colors && options.colors.length > 1) {
		return createGradientHtml(figletText, options);
	}

	const preStyles: string[] = [];
	const containerStyles: string[] = [];
	const containerClasses = ["sfb-figlet-display"];

	// Base pre styles for export compatibility
	preStyles.push("margin: 0");
	preStyles.push("padding: 5px 0");
	preStyles.push("border: none");
	preStyles.push("font-family: monospace");
	preStyles.push("white-space: pre");
	preStyles.push("display: inline-block");

	// Container styles for export
	containerStyles.push("display: flex");
	containerStyles.push("padding: 5px 0");

	if (options?.color) {
		preStyles.push(`color: ${sanitizeColor(options.color)}`);
	}

	if (options?.fontSize !== undefined) {
		preStyles.push(`font-size: ${options.fontSize}px`);
	} else {
		preStyles.push("font-size: 10px");
	}

	if (options?.lineHeight !== undefined) {
		preStyles.push(`line-height: ${options.lineHeight}`);
	} else {
		preStyles.push("line-height: 1");
	}

	if (options?.opacity !== undefined && options.opacity !== 1) {
		preStyles.push(`opacity: ${options.opacity}`);
	}

	if (options?.centered === false) {
		containerStyles.push("justify-content: flex-start");
		containerClasses.push("sfb-figlet-left");
	} else {
		containerStyles.push("justify-content: center");
	}

	const preStyleAttr = ` style="${preStyles.join("; ")}"`;
	const containerStyleAttr = ` style="${containerStyles.join("; ")}"`;
	const classAttr = containerClasses.join(" ");

	// Remove empty trailing lines and trim trailing whitespace from each line
	const lines = figletText.split("\n");
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}

	const escapedText = lines
		.map((l) => l.trimEnd())
		.join("\n")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	return `<div class="${classAttr}"${containerStyleAttr}><pre${preStyleAttr}>${escapedText}</pre></div>`;
}

/**
 * Get list of available fonts for display
 */
export function getAvailableFonts(): string[] {
	return AVAILABLE_FONTS;
}
