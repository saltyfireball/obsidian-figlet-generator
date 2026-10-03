# Figlet Generator

![OAuth](https://img.shields.io/badge/oauth-sign%20in%20with%20fax-fff?style=flat&logo=auth0&logoColor=FFFFFF&label=OAuth&labelColor=5B595C&color=FF6188) ![DNS](https://img.shields.io/badge/dns-its%20always%20dns-fff?style=flat&logo=cloudflare&logoColor=FFFFFF&label=DNS&labelColor=5B595C&color=AB9DF2) ![Profile Song](https://img.shields.io/badge/profile%20song-autoplaying-fff?style=flat&logo=myspace&logoColor=FFFFFF&label=profile%20song&labelColor=5B595C&color=FF6188) ![Secret Menu](https://img.shields.io/badge/secret%20menu-unlocked-fff?style=flat&logo=ubereats&logoColor=FFFFFF&label=secret%20menu&labelColor=5B595C&color=AB9DF2) ![Framework](https://img.shields.io/badge/framework-whatever%20is%20newest-fff?style=flat&logo=react&logoColor=FFFFFF&label=framework&labelColor=5B595C&color=FC9867) ![Wallpaper](https://img.shields.io/badge/wallpaper-windows%20xp%20bliss-fff?style=flat&logo=windows&logoColor=FFFFFF&label=wallpaper&labelColor=5B595C&color=5C7CFA) ![Cursor Theme](https://img.shields.io/badge/cursor-neon%20banana-fff?style=flat&logo=gnometerminal&logoColor=FFFFFF&label=cursor%20theme&labelColor=5B595C&color=78DCE8) ![Sock Drawer](https://img.shields.io/badge/sock%20drawer-solo%20socks%20only-fff?style=flat&logo=adidas&logoColor=FFFFFF&label=sock%20drawer&labelColor=5B595C&color=FF6188) ![Free Trial](https://img.shields.io/badge/free%20trial-used%2011%20emails-fff?style=flat&logo=gmail&logoColor=FFFFFF&label=free%20trial&labelColor=5B595C&color=FFD866)

<p align="center">
  <img src="assets/header.svg" width="600" />
</p>

Generate and display ASCII art text using Figlet fonts in Obsidian: 326 bundled fonts, solid colors, gradients, and sizing options, from a code block or an insert dialog.

**Author:** saltyfireball

<p align="center">
  <img src="assets/media/hero.png" width="700" alt="Rainbow FIGLET title in ANSI Shadow above a smaller blue subtitle" />
</p>

## Features

### Code blocks that render as ASCII art

Write options on top, a `---` line, then your text. The block re-renders as you edit it.

````
```sfb-figlet
font: Big
color: rainbow
---
Hi there
```
````

<p align="center">
  <img src="assets/media/live-edit.gif" width="760" alt="Editing a code block: the font, color and text change and the art updates" />
</p>

### 326 fonts

Every font from the Figlet font library ships inside the plugin, so nothing extra needs installing. Font names ignore case: `font: ansi shadow` works.

<p align="center">
  <img src="assets/media/fonts.png" width="760" alt="A grid of twelve fonts: Standard, Big, Slant, ANSI Shadow, Doom, Banner3, Small, Graffiti, Larry 3D, Isometric1, Ogre, Bloody" />
</p>

### Solid colors, gradients and rainbow

One color, a list of colors for a gradient, or `rainbow` for the palette in settings.

<p align="center">
  <img src="assets/media/colors.png" width="760" alt="Code blocks next to their output: a solid blue word, a red-yellow-green gradient, and a rainbow" />
</p>

````
```sfb-figlet
font: Big
colors: #FF0000 #FFFF00 #00FF00
---
Gradient
```
````

### Size, opacity and alignment

<p align="center">
  <img src="assets/media/options.png" width="760" alt="Code blocks showing font-size, opacity, centered: false, and two lines with and without multi-center" />
</p>

`multi-center: true` centers each line on its own; without it the lines keep their left edges and the block is centered as a whole.

### Insert dialog

Run **Insert figlet ASCII art** from the command palette to type text, pick a color and font, watch the preview, and insert either an `sfb-figlet` code block or plain HTML.

<p align="center">
  <img src="assets/media/modal.gif" width="640" alt="The insert dialog: typing Notes, setting rainbow, and switching fonts with the preview updating" />
</p>

### Light themes

Colors come from your code block; everything else follows the theme.

<p align="center">
  <img src="assets/media/light-theme.png" width="700" alt="A gradient Roadmap title in a light-theme note" />
</p>

### Cross-plugin API

Other plugins can generate ASCII art through `window.figletAPI`.

```typescript
const ascii = await window.figletAPI.generateText('Hello', 'Banner');
const html = window.figletAPI.createHtml(ascii, { color: '#FF0000' });
```

## Installation

### Obsidian Community Plugin (pending)

This plugin has been submitted for review to the Obsidian community plugin directory. Once approved, you will be able to install it directly from **Settings > Community plugins > Browse** by searching for "Figlet Generator".

### Using BRAT

You can install this plugin right now using the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin:

1. Install BRAT from **Settings > Community plugins > Browse** (search for "BRAT" by TfTHacker)
2. Open the BRAT settings
3. Under the **Beta plugins** section, click **Add beta plugin**

   ![BRAT beta plugin list](assets/brat_example_beta_plugin_list.png)

4. In the overlay, enter this plugin's repository: `https://github.com/saltyfireball/obsidian-figlet-generator` (or just `saltyfireball/obsidian-figlet-generator`)

   ![BRAT add beta plugin](assets/brat_example_beta_modal.png)

5. Leave the version set to latest

   ![BRAT beta plugin filled](assets/brat_example_beta_modal_filled.png)

6. Click **Add plugin**

### Manual

1. Download the latest release from the [Releases](https://github.com/saltyfireball/obsidian-figlet-generator/releases) page
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/figlet-generator/` directory
3. Enable the plugin in **Settings > Community plugins**

## Usage

### Insert dialog

1. Open the command palette (Ctrl/Cmd + P)
2. Search for "Insert figlet ASCII art"
3. Enter your text
4. Optionally set a color (hex, CSS name, or `rainbow`) and pick a font
5. Choose **Code block** or **HTML** output
6. Click **Insert**

### Code blocks

Create a code block with language ID `sfb-figlet` (configurable in settings). Options go above the `---` line, text below it:

````
```sfb-figlet
font: Big
color: #FF6B6B
font-size: 12
line-height: 1.2
centered: true
opacity: 0.8
---
Your Text Here
```
````

#### Code block options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `font` | string | Standard | Name of the Figlet font to use (case does not matter) |
| `color` | string | inherit | A single color, several space/comma-separated colors, or `rainbow`/`gradient` for the palette in settings |
| `colors` | string | - | Same as `color`; the two are interchangeable |
| `font-size` | number | 10 | Font size in pixels |
| `line-height` | number | 1 | Line height multiplier |
| `centered` | boolean | true | Center the output |
| `opacity` | number | 1 | Opacity from 0 to 1 |
| `multi-center` | boolean | false | Center each line independently |

`color` and `colors` accept the same values:

| Example | Result |
|---------|--------|
| `color: #5C7CFA` | Single color |
| `color: #FF0000 #FFFF00 #00FF00` | 3-color gradient |
| `color: rainbow` or `color: gradient` | Palette from settings |

#### Examples

````
```sfb-figlet
font: Banner
color: #5C7CFA
---
My Notes
```
````

````
```sfb-figlet
font: Lean
color: #4CAF50
font-size: 11
---
Introduction
```
````

````
```sfb-figlet
font: Slant
color: #FF6188 #FC9867 #FFD866 #A9DC76 #78DCE8
---
Inline Multi-Color
```
````

````
```sfb-figlet
font: Standard
multi-center: true
---
Centered
Lines
```
````

### Cross-plugin API

#### `generateText(text: string, font?: string): Promise<string>`

Returns the ASCII art as plain text.

```typescript
const ascii = await window.figletAPI.generateText('Hello', 'Banner');
```

#### `createHtml(figletText: string, options: FigletHtmlOptions): string`

Wraps ASCII art from `generateText` in styled HTML. The font is chosen in `generateText`; `createHtml` only styles it.

```typescript
const ascii = await window.figletAPI.generateText("Hello", "Standard");
const html = window.figletAPI.createHtml(ascii, {
    color: "#FF0000",
    fontSize: 12,
    lineHeight: 1.2,
    centered: true,
    opacity: 0.8,
});
```

#### `defaultGradientColors`

The plugin's default gradient palette.

```typescript
console.log(window.figletAPI.defaultGradientColors);
// ['#FF6188', '#FC9867', '#FFD866', '#A9DC76', '#78DCE8', '#5C7CFA', '#AB9DF2']
```

#### `FigletHtmlOptions`

```typescript
interface FigletHtmlOptions {
    color?: string;
    colors?: string[]; // two or more for a gradient
    fontSize?: number;
    lineHeight?: number;
    centered?: boolean;
    opacity?: number; // 0 to 1
}
```

## Settings

<p align="center">
  <img src="assets/media/settings.png" width="640" alt="The settings tab: code block language ID, font size, line height, center output, and gradient colors" />
</p>

- **Code block language ID** - The language identifier for code blocks (default: `sfb-figlet`; reload the plugin after changing it)
- **Font size** - Default font size in pixels (default: 10)
- **Line height** - Default line height multiplier (default: 1)
- **Center output** - Center output by default (default: on)
- **Gradient colors** - The palette for `rainbow` and `gradient`
- **Favorite fonts** - Fonts listed first in the insert dialog

## Troubleshooting

### Code block not rendering

- Check that the language ID matches your settings (default: `sfb-figlet`)
- Put your text after the `---` line

### Font not found

- Check the spelling against the font list in the insert dialog or settings
- Use `Standard` if unsure

### API not available

- Make sure Figlet Generator is installed and enabled
- Check the developer console for errors

## Limitations

- Very large text may be slow to render
- Some fonts do not include every character

## About the font data in main.js

Most of `main.js` (about 1.5 MB) is font data, not code. At build time, [`scripts/figlet-fonts-plugin.mjs`](scripts/figlet-fonts-plugin.mjs) reads each font listed in [`src/font-list.json`](src/font-list.json) from the [figlet](https://www.npmjs.com/package/figlet) package's `fonts/` folder, gzips it and embeds it as a base64 string, because the community directory installs only `main.js`, `manifest.json` and `styles.css`. Each string decodes back to the original `.flf` text file when a font is first used, and the tests check that every one matches its source file byte for byte. Nothing in it is executable code.

## Making the README media

The screenshots and GIFs in `assets/media/` come from the real plugin in headless Chromium. See `tools/readme-media/capture.mjs`.

## License

[MIT](LICENSE)
