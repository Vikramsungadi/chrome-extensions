# Chrome Web Store submission — copy/paste sheet

Package (from the repo root): `./build.sh --zip shopify-dev-toolkit` → `dist/shopify-dev-toolkit-<version>.zip`
Bump `version` in `manifest.json` before every new upload.

---

## Store listing tab

**Name** (from manifest): Theme Dev Toolkit for Shopify

**Summary** (from manifest, ≤132 chars):
Shortcuts for Shopify theme developers: preview links with QR, theme editor, admin, markets, section inspector and QA tools.

**Category:** Developer Tools
**Language:** English

**Description:**
```
A toolkit for developers building Shopify themes, especially stores that sell in several markets.

PREVIEW
• Copy the preview link for the page you're on, with the theme and variant kept
• Scan a QR code to open the same preview on your phone
• Jump to the theme editor on the same template, the admin page for the product or collection you're viewing, or the code editor
• View the live theme or exit preview in one click

MARKETS
• See every market URL for the current page (en-us, en-ae, …) with the preview theme kept, and copy them all at once
• Switch country and language the same way the storefront's own selector does
• Link separate regional stores and open the same page on each one

ADMIN
• Search orders, products, customers, collections and drafts
• Quick links to admin sections, with one-click "new" buttons
• Keyboard jump menu: press Ctrl+A, then a letter — P products, O orders, C collections, D discounts, F content, M metafields, T themes, S settings and more
• Add Shift to create new (Shift+P = new product), or press Ctrl+A twice to edit the product or collection you're viewing

SECTION INSPECTOR
• Hover any section to see the real section file behind it, even if the section was renamed in the theme editor or is a market-specific template
• Open the file in the admin code editor or in VS Code / Cursor / Windsurf, at the right line

QA TOOLS
• Scan the page for Liquid errors, missing translations, broken images, missing alt text and duplicate IDs
• Hide the preview bar, reload without cache, copy debug info for bug reports
• Open product / collection / cart JSON, copy or clear the cart

Keyboard shortcuts for the common actions; change them at chrome://extensions/shortcuts.

Not affiliated with or endorsed by Shopify Inc. "Shopify" is a trademark of Shopify Inc.
```

**Graphics** (in `store/`):
- Icon: `icons/icon128.png` (128×128, already in the package)
- Screenshots (1280×800, upload in this order):
  1. `store/screenshot-1-preview.png`: preview link + QR
  2. `store/screenshot-5-admin-keys.png`: Ctrl+A jump menu
  3. `store/screenshot-2-admin.png`: Admin tab
  4. `store/screenshot-3-markets.png`: market URLs
  5. `store/screenshot-4-tools.png`: QA tools
- Small promo tile (440×280): `store/promo-small.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee.png`

**Homepage URL:** https://github.com/Vikramsungadi/chrome-extensions
**Support URL:** https://github.com/Vikramsungadi/chrome-extensions/issues

---

## Privacy practices tab

**Single purpose:**
```
Speeds up Shopify theme development by turning the store page you're viewing into quick links and inspection tools: preview links and QR codes, theme editor/admin/code links, market URLs, and a section inspector.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | Reads store details (shop, theme ID, market) from the tab only when the user opens the popup or presses a shortcut, to build preview, editor and admin links. |
| `scripting` | Runs the code that reads `window.Shopify` on the active tab, and shows the section inspector, the admin jump menu, preview-bar hiding and the QA scan when the user starts them. |
| `storage` | Saves the user's settings (editor choice, linked stores, local repo paths), optional Admin API tokens, and a temporary cache of theme files. |
| `offscreen` | Copies links to the clipboard when the user presses a keyboard shortcut. Chrome only allows a web page to write to the clipboard right after the user interacts with it, so the copy runs in a hidden extension page instead. |
| `declarativeContent` | Shows the coloured toolbar icon only on pages that contain Shopify sections, without reading page content. |
| Host permission (optional): `https://*.myshopify.com/*`, `https://admin.shopify.com/*` | Requested only when the user turns on "Theme access" in Settings. Lets the section inspector read the theme's JSON templates from the Shopify admin to show which section file renders each part of the page. No other hosts are accessed. |
| Host permission (optional): `https://*/*`, one store at a time | Requested for a single store only when the user hides the Shopify preview bar from the popup, so it stays hidden on reload. The extension then injects a one-line stylesheet into that store's pages; nothing is read or sent. |

**Remote code:** No, I am not using remote code. (All JavaScript is in the package; the QR library and icons are bundled.)

**Data usage (check these):**
- ☑ Authentication information: optional Admin API tokens the user enters, stored locally and sent only to that store's Shopify Admin API
- ☑ Website content: store and theme details read from the page, processed locally

Certify all three:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/Vikramsungadi/chrome-extensions/blob/main/extensions/shopify-dev-toolkit/PRIVACY.md
(This link works only after the current changes are pushed.)

---

## Distribution tab
- **Visibility:** Private (only your Google Workspace domain) / Unlisted / Public
- **Regions:** all
