import { MarkdownPostProcessorContext } from "obsidian";
import {
	generateFigletText,
	createFigletHtml,
	getAvailableFonts,
	type FigletSettings,
	type FigletStyleOptions,
} from "./generator";

/**
 * Find font name with correct casing (case-insensitive lookup)
 */
function findFontName(inputName: string): string {
	const lowerInput = inputName.toLowerCase();
	const fonts = getAvailableFonts();
	const match = fonts.find((f) => f.toLowerCase() === lowerInput);
	return match || inputName; // Return original if no match (will fall back to Standard)
}

interface FigletCodeBlockOptions {
	font?: string;
	color?: string;
	colors?: string[];
	fontSize?: number;
	lineHeight?: number;
	centered?: boolean;
	opacity?: number;
	multiCenter?: boolean;
}

/**
 * Parse color list from string (space or comma separated)
 */
function parseColors(value: string): string[] {
	// Split by comma or space, filter empty, trim each
	return value
		.split(/[,\s]+/)
		.map((c) => c.trim())
		.filter((c) => c.length > 0);
}

/**
 * Parse the YAML-style front matter from the code block content
 * Format:
 * ```sfb-figlet
 * font: 3d
 * color: #5C7CFA
 * colors: #FF6188 #FC9867 #FFD866 #A9DC76 #78DCE8 #5C7CFA #AB9DF2
 * font-size: 12
 * line-height: 1.2
 * centered: false
 * ---
 * Text to render
 * ```
 */
function parseCodeBlock(source: string): { options: FigletCodeBlockOptions; text: string } {
	const lines = source.split("\n");
	const options: FigletCodeBlockOptions = {};
	let textStartIndex = 0;

	// Check if there's a YAML front matter section (ends with ---)
	const separatorIndex = lines.findIndex((line) => line.trim() === "---");

	if (separatorIndex > 0) {
		// Parse YAML-style options before the separator
		for (let i = 0; i < separatorIndex; i++) {
			const rawLine = lines[i];
			if (!rawLine) continue;
			const line = rawLine.trim();
			if (!line) continue;

			const colonIndex = line.indexOf(":");
			if (colonIndex > 0) {
				const key = line.slice(0, colonIndex).trim().toLowerCase().replace(/-/g, "");
				const value = line.slice(colonIndex + 1).trim();

				switch (key) {
					case "font":
						options.font = value;
						break;
					case "color":
						options.color = value;
						break;
					case "colors":
						options.colors = parseColors(value);
						break;
					case "fontsize":
						options.fontSize = parseFloat(value);
						break;
					case "lineheight":
						options.lineHeight = parseFloat(value);
						break;
					case "centered":
						options.centered = value.toLowerCase() === "true";
						break;
					case "opacity":
					case "figletopacity":
						options.opacity = parseFloat(value);
						break;
					case "multicenter":
						options.multiCenter = value.toLowerCase() === "true";
						break;
				}
			}
		}
		textStartIndex = separatorIndex + 1;
	} else {
		// No separator - check if first line looks like options (contains ":")
		// Otherwise treat entire content as text
		const firstLine = lines[0]?.trim() || "";
		if (firstLine.includes(":") && !firstLine.includes(" ")) {
			// Might be options without separator - be strict, require ---
			// Treat everything as text
			textStartIndex = 0;
		}
	}

	// Everything after the separator (or everything if no separator) is the text
	const text = lines.slice(textStartIndex).join("\n").trim();

	return { options, text };
}

/**
 * Create a post-processor for sfb-figlet code blocks
 * @param getSettings - Function to get current figlet settings (for defaults)
 */
export function createFigletCodeBlockProcessor(getSettings: () => FigletSettings) {
	return async (
		source: string,
		el: HTMLElement,
		_ctx: MarkdownPostProcessorContext,
	): Promise<void> => {
		const { options, text } = parseCodeBlock(source);
		const settings = getSettings();

		if (!text) {
			el.createEl("div", {
				text: "No text provided for figlet",
				cls: "sfb-figlet-error",
			});
			return;
		}

		const font = options.font ? findFontName(options.font) : "Standard";

		// Determine colors: YAML colors > YAML color > default
		let colors: string[] | undefined;
		if (options.colors && options.colors.length > 0) {
			colors = options.colors;
		} else if (options.color === "rainbow" || options.color === "gradient") {
			// Special keyword to use default gradient colors
			colors = settings.gradientColors;
		}

		// Merge YAML overrides with settings defaults
		const styleOptions: FigletStyleOptions = {
			color: colors ? undefined : options.color,
			colors: colors,
			fontSize: options.fontSize ?? settings.fontSize,
			lineHeight: options.lineHeight ?? settings.lineHeight,
			centered: options.centered ?? settings.centered,
			opacity: options.opacity,
		};

		try {
			// Show loading state
			const loadingEl = el.createEl("div", {
				text: "Generating...",
				cls: "sfb-figlet-loading",
			});

			// Multi-center mode: each line rendered and centered independently
			if (options.multiCenter) {
				const textLines = text.split("\n").filter((line) => line.trim().length > 0);
				const htmlParts: string[] = [];

				for (const line of textLines) {
					const figletText = await generateFigletText(line.trim(), font);
					const html = createFigletHtml(figletText, styleOptions);
					htmlParts.push(html);
				}

				// Remove loading state
				loadingEl.remove();

				// Wrap all in a container
				el.empty();
				const wrapper = el.createDiv({ cls: "sfb-figlet-multi-center" });
				for (const part of htmlParts) {
					const temp = createDiv();
					temp.innerHTML = part; // eslint-disable-line @microsoft/sdl/no-inner-html -- sanitized figlet HTML
					while (temp.firstChild) {
						wrapper.appendChild(temp.firstChild);
					}
				}
			} else {
				const figletText = await generateFigletText(text, font);

				// Remove loading state
				loadingEl.remove();

				// Create the figlet display
				const html = createFigletHtml(figletText, styleOptions);
				el.empty();
				const temp = createDiv();
				temp.innerHTML = html; // eslint-disable-line @microsoft/sdl/no-inner-html -- sanitized figlet HTML
				while (temp.firstChild) {
					el.appendChild(temp.firstChild);
				}
			}
		} catch (err) {
			el.createEl("div", {
				text: `Error generating figlet: ${String(err)}`,
				cls: "sfb-figlet-error",
			});
		}
	};
}
