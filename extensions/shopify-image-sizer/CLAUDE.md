# Image Sizer for Shopify

Measures storefront images (rendered size, file size, 1x / 1.5x / 2x export sizes) from an on-page inspector or a DevTools Elements sidebar pane, saves named references, and exports them as text / CSV.

Build: `./build.sh shopify-image-sizer` from the repo root. User-facing docs: [README.md](README.md).

## Where things live
- `src/measure.js`: all measurement logic, shared by the inspector and the DevTools pane.
- `src/inspector.js`: on-page inspector, injected on demand (custom element `sizer-image-inspector`).
- `src/lib/tab.js`: injects / detects / toggles the inspector via `chrome.scripting`.
- `src/lib/captures.js`: saved references in `chrome.storage.local` under `captures` (newest last), plus text / CSV export.
- `src/ui/captures.*`: saved-reference list used by both the popup and the DevTools pane.
- `src/devtools/`: Elements sidebar pane ("Image Size").

## Rules that are easy to break
- **`measure.js` must stay injectable.** It is injected as a file before `inspector.js` and is also fetched as text and evaluated against `$0` in the DevTools pane. So: no extension APIs, no imports/exports, and only `function` declarations at top level (it may be injected into the same page more than once; `const`/`let`/`class` would throw on re-declaration). Prefix globals with `sizer`.
- Export sizes are rounded **up**, so an export is never a pixel short.
- The file's real pixel size is re-decoded from the URL, because `naturalWidth` is divided by the srcset density.
- Sizes depend on the viewport; every capture records the viewport width. Keep that when changing the capture shape, and keep the CSV columns (section, selector, image URL) that devs use to map references.
- Permissions are `activeTab` + `scripting` only. Injection works after a user gesture (popup click or shortcut); don't add broad host permissions for it.
- When the inspector closes it messages the background (`inspectorClosed`) to clear the badge; keep that message working when changing the inspector.

## Checking changes
Build, reload the unpacked extension, then on a storefront: run the inspector (⌃⇧M / Alt+Shift+M) over an `<img>`, a `<picture>` with srcset and a CSS background; check the DevTools pane with a wrapper element selected; save a reference and export CSV.
