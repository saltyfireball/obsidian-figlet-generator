// Captures the README screenshots and GIFs into assets/media/ by driving the
// real plugin in headless Chromium.
//
//   node tools/readme-media/build.mjs
//   NODE_PATH=/opt/homebrew/lib/node_modules node tools/readme-media/capture.mjs [scene...]

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const here = fileURLToPath(new URL(".", import.meta.url));
const out = join(here, "../../assets/media");
const pageUrl = pathToFileURL(join(here, "page.html")).href;
mkdirSync(out, { recursive: true });

const RAINBOW = "#FF6188 #FC9867 #FFD866 #A9DC76 #78DCE8 #AB9DF2";

const FONTS = [
	["Standard", "#78DCE8"],
	["Big", "#FF6188"],
	["Slant", "#A9DC76"],
	["ANSI Shadow", "#AB9DF2"],
	["Doom", "#FC9867"],
	["Banner3", "#FFD866"],
	["Small", "#78DCE8"],
	["Graffiti", "#FF6188"],
	["Larry 3D", "#A9DC76"],
	["Isometric1", "#AB9DF2"],
	["Ogre", "#FC9867"],
	["Bloody", "#FF6188"],
];

// Wide fonts get a shorter word so the gallery columns stay even.
const WORD = { Isometric1: "Iso", Banner3: "Ban", Graffiti: "Graf", "Larry 3D": "3D" };

// --- page helpers ---------------------------------------------------------

async function openPage(browser, { width = 960, height = 900, video = false, theme = "dark", settings } = {}) {
	const ctxOpts = { viewport: { width, height }, deviceScaleFactor: video ? 1 : 2 };
	let videoDir = null;
	if (video) {
		videoDir = mkdtempSync(join(tmpdir(), "figlet-media-"));
		ctxOpts.recordVideo = { dir: videoDir, size: { width, height } };
	}
	const context = await browser.newContext(ctxOpts);
	const page = await context.newPage();
	page.on("pageerror", (e) => console.error("pageerror:", e.message));
	page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
	await page.goto(pageUrl);
	await page.evaluate(
		async ({ theme, settings }) => {
			document.body.className = "theme-" + theme;
			await window.figlet.start(settings);
		},
		{ theme, settings },
	);
	return { page, context, videoDir };
}

// Fills #root as a note. Blocks: { h1 }, { h2 }, { p }, { source } for a
// rendered sfb-figlet block, { pair: source } for the source next to its
// render, or { grid: [[label, source]...], cols } for a gallery.
async function note(page, blocks, { maxWidth } = {}) {
	await page.evaluate(
		async ({ blocks, maxWidth }) => {
			const root = document.getElementById("root");
			root.className = "markdown-preview-view";
			if (maxWidth) root.style.maxWidth = maxWidth + "px";
			for (const b of blocks) {
				if (b.h1) root.createEl("h1", { text: b.h1 });
				else if (b.h2) root.createEl("h2", { text: b.h2 });
				else if (b.p) root.createEl("p", { text: b.p });
				else if (b.source) await window.figlet.render(root.createDiv(), b.source);
				else if (b.pair) {
					const row = root.createDiv({ cls: "pair" });
					row.createEl("pre", { cls: "source", text: "```sfb-figlet\n" + b.pair + "\n```" });
					await window.figlet.render(row.createDiv(), b.pair);
				} else if (b.grid) {
					const grid = root.createDiv({ cls: "grid" });
					grid.style.gridTemplateColumns = `repeat(${b.cols}, minmax(0, 1fr))`;
					for (const [label, source] of b.grid) {
						const cell = grid.createDiv({ cls: "cell" });
						cell.createEl("h3", { text: label });
						await window.figlet.render(cell.createDiv(), source);
					}
				}
			}
		},
		{ blocks, maxWidth },
	);
	await page.waitForTimeout(400);
}

async function addCursor(page) {
	await page.evaluate(() => {
		const c = document.createElement("div");
		c.id = "fake-cursor";
		c.style.cssText =
			"position:fixed;left:0;top:0;width:22px;height:22px;z-index:9999;pointer-events:none;" +
			"transition:transform 0.45s ease;transform:translate(-40px,-40px)";
		c.innerHTML =
			'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l16 11-7 1.5L9.5 21z" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>';
		document.body.appendChild(c);
	});
}

async function moveTo(page, selector) {
	const b = await page.locator(selector).first().boundingBox();
	const x = b.x + Math.min(b.width / 2, 60);
	const y = b.y + b.height / 2;
	await page.evaluate(
		({ x, y }) => (document.getElementById("fake-cursor").style.transform = `translate(${x - 4}px, ${y - 2}px)`),
		{ x, y },
	);
	await page.waitForTimeout(500);
	return { x, y };
}

async function clickOn(page, selector, pause = 400) {
	const { x, y } = await moveTo(page, selector);
	await page.mouse.click(x, y);
	await page.waitForTimeout(pause);
}

async function typeInto(page, selector, text, delay = 90) {
	await clickOn(page, selector, 200);
	await page.locator(selector).first().fill("");
	await page.locator(selector).first().pressSequentially(text, { delay });
}

async function shot(page, name, selector = "#root") {
	await page.locator(selector).screenshot({ path: join(out, name) });
	console.log("wrote", name);
}

// Ends a recorded scene and converts the cropped video to an optimised GIF.
async function finishGif({ page, context, videoDir }, name, selector = "#root", { fps = 12, width = 760, skip = 0.8 } = {}) {
	const b = await page.locator(selector).boundingBox();
	const vp = page.viewportSize();
	b.height = Math.min(b.height, vp.height - b.y);
	b.width = Math.min(b.width, vp.width - b.x);
	await context.close();
	const webm = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith(".webm")));
	const crop = `crop=${Math.floor(b.width)}:${Math.floor(b.height)}:${Math.floor(b.x)}:${Math.floor(b.y)}`;
	const filters = `${crop},fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
	// The first frames are a blank page before the note renders.
	execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(skip), "-i", webm, "-filter_complex", filters, "-loop", "0", join(out, name)]);
	rmSync(videoDir, { recursive: true, force: true });
	console.log("wrote", name);
}

// --- scenes ---------------------------------------------------------------

const scenes = {
	async hero(browser) {
		const { page } = await openPage(browser, { width: 1000 });
		await note(page, [
			{ source: `font: ANSI Shadow\ncolor: rainbow\nfont-size: 9\n---\nFIGLET` },
			{ source: `font: Small\ncolor: #78DCE8\n---\nASCII art in your notes` },
		]);
		await shot(page, "hero.png");
	},

	async fonts(browser) {
		const { page } = await openPage(browser, { width: 1240, height: 1200 });
		await note(
			page,
			[{ grid: FONTS.map(([f, c]) => [f, `font: ${f}\ncolor: ${c}\nfont-size: 7\n---\n${WORD[f] ?? f.split(" ")[0]}`]), cols: 3 }],
			{ maxWidth: 1200 },
		);
		await shot(page, "fonts.png");
	},

	async colors(browser) {
		const { page } = await openPage(browser, { width: 1100, height: 1100 });
		await note(
			page,
			[
				{ pair: "font: Big\ncolor: #5C7CFA\n---\nSolid" },
				{ pair: "font: Big\ncolors: #FF0000 #FFFF00 #00FF00\n---\nGradient" },
				{ pair: "font: Big\ncolor: rainbow\n---\nRainbow" },
			],
			{ maxWidth: 1060 },
		);
		await shot(page, "colors.png");
	},

	async options(browser) {
		const { page } = await openPage(browser, { width: 1100, height: 1700 });
		await note(
			page,
			[
				{ pair: "font: Standard\ncolor: #A9DC76\nfont-size: 14\n---\nBigger" },
				{ pair: "font: Standard\ncolor: #A9DC76\nopacity: 0.4\n---\nFaded" },
				{ pair: "font: Standard\ncolor: #FC9867\ncentered: false\n---\nLeft" },
				{ pair: "font: Standard\ncolor: #AB9DF2\n---\nHi\nthere, friend" },
				{ pair: "font: Standard\ncolor: #AB9DF2\nmulti-center: true\n---\nHi\nthere, friend" },
			],
			{ maxWidth: 1060 },
		);
		await shot(page, "options.png");
	},

	async light(browser) {
		const { page } = await openPage(browser, { width: 1000, theme: "light" });
		await note(page, [
			{ h1: "Project notes" },
			{ source: `font: Doom\ncolors: #E91E63 #9C27B0 #3F51B5\n---\nRoadmap` },
			{ p: "Works with light themes too: colors come from your code block, the rest from the theme." },
		]);
		await shot(page, "light-theme.png");
	},

	async modal(browser) {
		const { page } = await openPage(browser, { width: 1000, height: 1000 });
		await page.evaluate(() => window.figlet.openModal());
		await page.locator(".fg-figlet-text-input").first().fill("Hello");
		await page.locator(".fg-figlet-text-input").nth(1).fill("rainbow");
		await page.locator(".fg-figlet-font-select").selectOption("Slant");
		await page.locator(".fg-figlet-text-input").first().dispatchEvent("input");
		await page.waitForTimeout(600);
		await shot(page, "modal.png", ".modal");
	},

	async modalgif(browser) {
		const rec = await openPage(browser, { width: 1000, height: 1000, video: true });
		const { page } = rec;
		await page.evaluate(() => window.figlet.openModal());
		await addCursor(page);
		await page.waitForTimeout(500);
		await typeInto(page, ".fg-figlet-text-input >> nth=0", "Notes", 140);
		await page.waitForTimeout(700);
		await typeInto(page, ".fg-figlet-text-input >> nth=1", "rainbow", 90);
		await page.waitForTimeout(900);
		for (const font of ["Big", "Slant", "ANSI Shadow", "Doom"]) {
			await moveTo(page, ".fg-figlet-font-select");
			await page.locator(".fg-figlet-font-select").selectOption(font);
			await page.waitForTimeout(1100);
		}
		await clickOn(page, ".fg-mode-btn >> nth=1", 900);
		await clickOn(page, ".fg-mode-btn >> nth=0", 600);
		await moveTo(page, "button.mod-cta, .fg-figlet-insert-btn, button:has-text('Insert')");
		await page.waitForTimeout(800);
		await finishGif(rec, "modal.gif", ".modal", { width: 640 });
	},

	async settings(browser) {
		const { page } = await openPage(browser, { width: 900, height: 1600 });
		await page.evaluate(() => window.figlet.showSettings(document.getElementById("root")));
		await page.waitForTimeout(500);
		// The full tab lists every font; keep the top sections only.
		const b = await page.locator("#root").boundingBox();
		const t = await page.locator("#root textarea").first().boundingBox();
		const height = t.y + t.height + 24 - b.y;
		await page.screenshot({ path: join(out, "settings.png"), clip: { x: b.x, y: b.y, width: b.width, height } });
		console.log("wrote settings.png");
	},

	// Typing in the code block source re-renders the art, as in Obsidian.
	async live(browser) {
		const rec = await openPage(browser, { width: 1100, height: 520, video: true, settings: { fontSize: 14 } });
		const { page } = rec;
		await page.evaluate(() => {
			const root = document.getElementById("root");
			root.className = "markdown-preview-view";
			root.style.maxWidth = "1060px";
			const row = root.createDiv({ cls: "pair" });
			row.createEl("pre", { cls: "source", attr: { id: "src" } });
			row.createDiv({ attr: { id: "art" } });
		});
		await addCursor(page);
		const show = async (src) => {
			await page.evaluate(async (src) => {
				document.getElementById("src").textContent = "```sfb-figlet\n" + src + "\n```";
				const art = document.getElementById("art");
				const next = document.createElement("div");
				await window.figlet.render(next, src);
				art.replaceChildren(next);
			}, src);
		};
		const steps = [
			"font: Standard\n---\nHi",
			"font: Standard\ncolor: #FF6188\n---\nHi",
			"font: Big\ncolor: #FF6188\n---\nHi",
			"font: Big\ncolor: rainbow\n---\nHi",
			"font: Big\ncolor: rainbow\n---\nHi there",
			"font: ANSI Shadow\ncolor: rainbow\nfont-size: 11\n---\nHi there",
		];
		await show(steps[0]);
		await page.waitForTimeout(900);
		for (const s of steps.slice(1)) {
			await show(s);
			await page.waitForTimeout(1300);
		}
		await page.waitForTimeout(800);
		await finishGif(rec, "live-edit.gif", "#root", { width: 860 });
	},
};

const browser = await chromium.launch();
const wanted = process.argv.slice(2);
for (const [name, run] of Object.entries(scenes)) {
	if (wanted.length && !wanted.includes(name)) continue;
	await run(browser);
}
await browser.close();
