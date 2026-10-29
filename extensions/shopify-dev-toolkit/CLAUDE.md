# Theme Dev Toolkit for Shopify

Popup + keyboard shortcuts for Shopify theme developers: preview links and QR codes, theme/code editor and admin links, market URLs, a section inspector that opens the right file, QA tools. Published on the Chrome Web Store.

Build: `./build.sh shopify-dev-toolkit` (add `--zip` for a store upload). User-facing docs: [README.md](README.md).

## Where things live
- `src/background.js`: commands, messaging, toolbar icon rules (`declarativeContent`).
- `src/lib/page.js`: functions run inside the tab.
- `src/lib/links.js`: all URL builders (preview, editor, admin, markets) and `ADMIN_NAV`, the admin key-menu letters (the popup's Admin tab reads the same list).
- `src/lib/resolver.js`: section instance key → section type via the Admin API (theme JSON templates and section groups), cached per session.
- `src/lib/preview-bar.js` + `src/hide-preview-bar.js`: keeps the preview bar hidden on reload for stores the user allowed.
- `src/admin-keys.js`: the ⌃A admin key menu. `src/inspector.js`: section inspector.
- `src/offscreen/`: clipboard writes for shortcuts. `src/options/`: settings page. `src/vendor/qrcode.js`: bundled QR library (don't edit).
- `store/`: Web Store listing text (`LISTING.md`), screenshots, promo tiles. `PRIVACY.md`: privacy policy.

## Rules that are easy to break
- **Functions in `src/lib/page.js` are serialized into the tab** by `chrome.scripting.executeScript`. Each must be fully self-contained: no imports, no references to module scope, arguments passed via `args`.
- **Shortcut copies go through the offscreen document.** A page may only write to the clipboard right after a user interaction, and an extension shortcut doesn't count. Don't replace it with `navigator.clipboard` in the page.
- **Host access is optional and narrow.** Theme access (`*.myshopify.com`, `admin.shopify.com`) is requested only from Settings. Preview-bar persistence requests `https://<store>/*` for one store at a time. Never request `https://*/*` up front. Any new permission or host needs a justification row in `store/LISTING.md`, and data handling must still match `PRIVACY.md`.
- `chrome.permissions.request` must be the first `await` in its click handler, or Chrome drops the user gesture and the request fails.
- Admin API tokens live in `chrome.storage.local` (`tokens`, per shop), never in sync storage. Settings are in `chrome.storage.sync` (`src/lib/storage.js`).
- Market logic: the theme editor link strips the market subfolder from `previewPath`; preview links keep variant/query params. Check both with a market subfolder URL (e.g. `/en-us/products/x`) after touching `links.js`.
- Chrome allows at most 4 default shortcuts (`suggested_key`); the rest are set by the user at `chrome://extensions/shortcuts`.

## Releasing
Bump `version` in `manifest.json` for every upload, run `./build.sh --zip shopify-dev-toolkit`, and update `store/LISTING.md` when features or permissions change. `store/HANDOFF-PROMPT.md` is a prompt for filling in the Web Store dashboard; keep its zip filename in sync with the version.
