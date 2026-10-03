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

// Filter to only show "display name" fonts: a font starting with a lowercase
// letter is hidden when it is an alias of another font differing only in case
function isDisplayFont(font: string): boolean {
	const firstChar = font.charAt(0);
	// Keep fonts starting with uppercase or numbers
	if (firstChar >= "A" && firstChar <= "Z") return true;
	if (firstChar >= "0" && firstChar <= "9") return true;
	// Keep a lowercase font with no other spelling (miniwi)
	const lower = font.toLowerCase();
	return !ALL_FONT_FILES.some((f) => f !== font && f.toLowerCase() === lower);
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

/** A bundled font: its data, or why it could not be read. */
type FontRead = { data: string } | { missing: true } | { error: unknown };

/**
 * Read a font bundled into main.js, telling a missing font apart from one
 * that failed to decode
 */
async function readFont(fontName: string): Promise<FontRead> {
	try {
		const data = await readBundledFont(fontName);
		return data === null ? { missing: true } : { data };
	} catch (error) {
		return { error };
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
	let read = await readFont(font);
	if (!("data" in read)) {
		if ("error" in read) {
			console.warn(`Figlet: font "${font}" failed to decode, falling back to Standard`, read.error);
		} else {
			console.warn(`Figlet: font "${font}" not found, falling back to Standard`);
		}
		font = "Standard";
		read = await readFont(font);
		if ("error" in read) throw new Error("Figlet: the Standard font failed to decode", { cause: read.error });
		if (!("data" in read)) throw new Error("Figlet: the Standard font is missing from the bundle");
	}

	try {
		figletLib.parseFont(font, read.data);
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

	// Channels are all numbers (0-255) or all percentages, as CSS requires
	const num = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*[\d.]+%?\s*)?\)$/i.exec(color);
	if (num) {
		return [num[1], num[2], num[3]].map((c) => Math.min(255, Math.round(Number(c)))) as Rgb;
	}
	const pct = /^rgba?\(\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*[\d.]+%?\s*)?\)$/i.exec(color);
	if (pct) {
		return [pct[1], pct[2], pct[3]].map((c) => Math.min(255, Math.round((Number(c) * 255) / 100))) as Rgb;
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

/** A run of characters drawn in one color (no color: inherit). */
interface FigletSegment {
	text: string;
	color?: string;
}

/**
 * Everything needed to draw figlet output, independent of how it is drawn:
 * as DOM nodes on screen, or as an HTML string inserted into a note.
 * Style values keep their insertion order, which is the order in the HTML.
 */
interface FigletLayout {
	classes: string[];
	containerStyles: [string, string][];
	preStyles: [string, string][];
	lines: FigletSegment[][];
}

/**
 * Drop trailing blank lines and the trailing spaces figlet pads lines with
 */
function trimFigletLines(figletText: string): string[] {
	const lines = figletText.split("\n");
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}
	return lines.map((l) => l.trimEnd());
}

/**
 * Split each line into runs of one color, each character colored by its
 * horizontal position (colored spans work in PDF export, unlike CSS
 * background-clip)
 */
function gradientSegments(lines: string[], colors: string[]): FigletSegment[][] {
	const maxLineLength = Math.max(...lines.map((l) => l.length));
	return lines.map((line) => {
		const segments: FigletSegment[] = [];
		for (let i = 0; i < line.length; i++) {
			const position = maxLineLength > 1 ? i / (maxLineLength - 1) : 0;
			const color = getGradientColor(colors, position);
			const last = segments[segments.length - 1];
			if (last && last.color === color) {
				last.text += line[i];
			} else {
				segments.push({ text: line[i], color });
			}
		}
		return segments;
	});
}

function layoutFiglet(figletText: string, options?: FigletStyleOptions): FigletLayout {
	// Normalize: if colors has exactly 1 entry, treat as single color
	if (options?.colors && options.colors.length === 1) {
		options = { ...options, color: options.colors[0], colors: undefined };
	}
	// Sanitize colors to prevent CSS injection
	const gradient = options?.colors && options.colors.length > 1 ? options.colors.map(sanitizeColor) : null;

	const classes = ["sfb-figlet-display"];
	if (gradient) classes.push("sfb-figlet-gradient");

	const containerStyles: [string, string][] = [
		["display", "flex"],
		["padding", "5px 0"],
	];
	if (options?.centered === false) {
		containerStyles.push(["justify-content", "flex-start"]);
		classes.push("sfb-figlet-left");
	} else {
		containerStyles.push(["justify-content", "center"]);
	}

	// Base pre styles for export compatibility
	const preStyles: [string, string][] = [
		["margin", "0"],
		["padding", "5px 0"],
		["border", "none"],
		["font-family", "monospace"],
		["white-space", "pre"],
		["display", "inline-block"],
	];
	if (!gradient && options?.color) {
		preStyles.push(["color", sanitizeColor(options.color)]);
	}
	preStyles.push(["font-size", `${options?.fontSize ?? 10}px`]);
	preStyles.push(["line-height", `${options?.lineHeight ?? 1}`]);
	if (options?.opacity !== undefined && options.opacity !== 1) {
		preStyles.push(["opacity", `${options.opacity}`]);
	}

	const lines = trimFigletLines(figletText);
	return {
		classes,
		containerStyles,
		preStyles,
		lines: gradient
			? gradientSegments(lines, gradient)
			: [[{ text: lines.join("\n") }]],
	};
}

// Text keeps double quotes as-is, matching HTML inserted by earlier versions
function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function styleAttr(styles: [string, string][]): string {
	return escapeHtml(styles.map(([k, v]) => `${k}: ${v}`).join("; ")).replace(/"/g, "&quot;");
}

/**
 * Create the HTML output for figlet text, for inserting into a note or for
 * other plugins through the API. To show figlet output on screen, use
 * renderFiglet instead.
 */
export function createFigletHtml(
	figletText: string,
	options?: FigletStyleOptions,
): string {
	const layout = layoutFiglet(figletText, options);
	const content = layout.lines
		.map((segments) =>
			segments
				.map((s) =>
					s.color === undefined
						? escapeHtml(s.text)
						: `<span style="${styleAttr([["color", s.color]])}">${escapeHtml(s.text)}</span>`,
				)
				.join(""),
		)
		.join("\n");
	return `<div class="${layout.classes.join(" ")}" style="${styleAttr(layout.containerStyles)}"><pre style="${styleAttr(layout.preStyles)}">${content}</pre></div>`;
}

// setCssStyles takes camelCase keys (fontSize, not font-size)
function toCssStyles(styles: [string, string][]): Partial<CSSStyleDeclaration> {
	const out: Record<string, string> = {};
	for (const [k, v] of styles) out[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
	return out as Partial<CSSStyleDeclaration>;
}

/**
 * Render figlet text into an element with Obsidian's DOM helpers. Produces
 * the same structure and styles as createFigletHtml.
 */
export function renderFiglet(
	parent: HTMLElement,
	figletText: string,
	options?: FigletStyleOptions,
): HTMLDivElement {
	const layout = layoutFiglet(figletText, options);
	const container = parent.createDiv({ cls: layout.classes });
	container.setCssStyles(toCssStyles(layout.containerStyles));
	const pre = container.createEl("pre");
	pre.setCssStyles(toCssStyles(layout.preStyles));

	layout.lines.forEach((segments, i) => {
		if (i > 0) pre.appendText("\n");
		for (const s of segments) {
			if (s.color === undefined) {
				pre.appendText(s.text);
			} else {
				pre.createSpan({ text: s.text }).setCssStyles({ color: s.color });
			}
		}
	});
	return container;
}

/**
 * Get list of available fonts for display
 */
export function getAvailableFonts(): string[] {
	return AVAILABLE_FONTS;
}
