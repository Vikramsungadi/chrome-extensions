# Chrome extensions

Shopify dev tools as Chrome extensions that share one design system.

```
shared/                 Polaris tokens (polaris.css), icons, DOM helpers (ui.js)
extensions/<name>/      one extension each: manifest.json, icons/, src/
build.sh                builds extensions/<name> + shared → dist/<name>/
```

```bash
./build.sh                      # build all into dist/<name>/ ("Load unpacked" that folder)
./build.sh shopify-image-sizer  # build one
./build.sh --zip                # also dist/<name>-<version>.zip for the Chrome Web Store
```

Inside an extension, shared files are referenced as `src/shared/…` (e.g. `../shared/polaris.css` from `src/popup/`). Chrome can't load files from outside the extension folder, so always load the built `dist/<name>/`, not the source folder.

| Extension | What it does |
| --- | --- |
| [shopify-dev-toolkit](extensions/shopify-dev-toolkit) | Preview links + QR, theme editor, admin, markets, section inspector |
| [shopify-image-sizer](extensions/shopify-image-sizer) | Image size inspector: 1x / 1.5x / 2x export sizes, named references, share as text / CSV |
| [shopify-tab-dedupe](extensions/shopify-tab-dedupe) | One tab per store for preview / editor / code / admin; new links replace the matching tab; store switcher |
