# Shopify Dev Toolkit

Rewrite of "Shortcuts for Shopify" (`okamfjilkpkpcdckebmcglnjpgolccmi`) — market-aware, Polaris-styled, no build step.

## Install
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Disable the old "Shortcuts for Shopify" so the keyboard shortcuts don't clash

## Features
**Preview** — preview link (keeps variant/query params), QR code for any market/linked-store URL (download / copy PNG), theme editor (market subfolder stripped from `previewPath`), resource-aware admin link, code editor, view live, exit preview.

**Admin** — search orders / products / customers / collections / drafts (`#1042` works), admin sidebar destinations (orders, products, collections, inventory, metaobjects, files, menus, themes, markets, settings…) with quick “new” buttons, and the current page's resource.

**Markets** — current country / language / currency / routes root; every market URL for the current page (from `hreflang`) with preview theme kept: open, copy, QR, copy all; country/language switcher via `/localization` (for markets sharing a domain); linked stores (separate regional stores) opening the same page.

**Tools** — section inspector (resolves each section's real type from theme JSON via the Admin API — instance keys renamed in the editor and per-market `*.context.<market>.json` templates are handled; opens the section file or the template JSON at the right line in admin or VS Code / Cursor / Windsurf, focusing the window that has the repo; copy section ID; lock with `L`, `Esc` to exit), hide preview bar, copy debug info, cache-bust reload, QA scan (Liquid errors, missing translations, broken images, missing alt, duplicate IDs), product/collection/cart JSON, clear cart.

## Section types (Admin API)
The storefront only exposes a section's instance key (e.g. `hero_licensed`), not its type (`splide-slider`). To resolve it, add a per-store Admin API token with `read_themes` in **Settings → Admin API tokens** (e.g. from `admin-token-cli`). Without a token the extension uses your signed-in session on admin.shopify.com; if that fails, the inspector shows the key as a *guess* and disables the file buttons.

## Shortcuts
| Command | macOS | Windows / Linux |
|---|---|---|
| Copy preview link | ⌃C | Ctrl+Shift+Q |
| Open theme editor | ⌃E | Ctrl+Shift+E |
| Open admin | ⌃A | Alt+A |
| Toggle section inspector | ⌃I | Ctrl+Shift+H |
| Toggle preview bar | — (suggested ⌃H) | — |
| Open code editor | — (suggested ⌃⇧E) | — |
| Open popup | — (suggested ⌃⇧S) | — |
| Copy market links, copy debug info | — | — |

Chrome allows at most 4 default shortcuts per extension; set the rest at `chrome://extensions/shortcuts`.
Defaults only apply on a fresh install. An existing install keeps whatever is already assigned.

## Layout
```
manifest.json
src/background.js        commands + messaging + toolbar icon rules
src/inspector.js         section inspector (injected, toggles)
src/lib/page.js          functions executed inside the tab
src/lib/links.js         URL builders (preview, editor, admin, markets)
src/lib/qr.js            QR → SVG / PNG
src/lib/storage.js       synced settings
src/lib/resolver.js      section key -> type lookup (Admin API, cached per session)
src/popup/               popup (polaris.css = shared Polaris tokens)
src/options/             settings: linked stores, repo paths, editor
src/vendor/qrcode.js     qrcode-generator 1.4.4 (MIT, Kazuhiko Arase)
src/vendor/polaris-icons.js  subset of @shopify/polaris-icons 9.3.1 (see LICENSE-polaris-icons.md)
```
