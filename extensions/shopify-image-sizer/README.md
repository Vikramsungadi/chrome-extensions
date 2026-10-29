# Image Sizer for Shopify

Measure any storefront image and get the sizes to export at **1x / 1.5x / 2x**, then save each one under a reference name and share the list with the team.

## Install
1. From the repo root run `./build.sh shopify-image-sizer`
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/shopify-image-sizer`
3. After code changes, re-run the build and press ↻ on the extension card

## Use
**On the page:** click the toolbar icon → **Inspect images** (or <kbd>⌃⇧M</kbd> on Mac, <kbd>Alt+Shift+M</kbd> elsewhere).
- Hover an image to see its rendered size and the 1x / 1.5x / 2x export sizes. Click a size to copy it.
- **Click** the image to lock it (clicks never follow links while inspecting), then **＋ Add reference** (or press <kbd>+</kbd>), type a name and press Enter.
- <kbd>Esc</kbd> exits.

**In DevTools:** Elements panel → **Image Size** sidebar (next to Styles). Select any element; if it's a wrapper, the first image inside is used. Type a name and click **Add**.

**Share:** the popup lists saved references for *This page* or *All pages*. Click a name to rename it.
- **Copy text**: grouped by page, ready for Slack or Jira
- **Copy CSV** / **Download CSV**: for Google Sheets or Excel (includes section, selector and image URL so devs can map each reference)

Sizes depend on the viewport, so each reference records the viewport width. Capture mobile sizes with the DevTools device toolbar (e.g. 390px) and name them accordingly (`Hero – mobile`).

## What's measured
- `<img>` / `<picture>` (content box), video posters, inline SVG and CSS `background-image` (padding box). Hover sees through transparent overlays such as link `::after` layers.
- Export sizes are rounded **up**, so an export is never a pixel short.
- **File**: the real pixel size of the loaded file (re-decoded, because `naturalWidth` is divided by the srcset density). Shown against the rendered width: *Upscaled* < 1x, *Soft on retina* < 2x, *Sharp* 2–4x, *Oversized* > 4x.
- Shopify section key (`template--…__hero`) and a short CSS selector.

## Layout
```
manifest.json
src/measure.js        measurement (shared by inspector + DevTools pane; no extension APIs)
src/inspector.js      on-page inspector (injected, toggles)
src/background.js     shortcut + save messages
src/lib/captures.js   storage (chrome.storage.local) + text / CSV export
src/lib/tab.js        inject / detect inspector
src/ui/captures.*     saved-reference list (popup + pane)
src/popup/            popup
src/devtools/         Elements sidebar pane
```
Polaris tokens, icons and DOM helpers come from `../../shared`, mounted at `src/shared/` by `build.sh`.
