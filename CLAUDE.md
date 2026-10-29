# Chrome extensions repo

Shopify dev tools as Manifest V3 Chrome extensions. Each extension has its own `CLAUDE.md` with its specific rules; this file covers what they share.

## Build and run
- No bundler, no npm. `./build.sh [name…]` copies `extensions/<name>/` plus `shared/` into `dist/<name>/` and runs `node --check` on every JS file. `--zip` also writes a Web Store zip.
- Always load `dist/<name>/` in `chrome://extensions`, never the source folder: the source has no `src/shared/` (Chrome can't read files outside the extension folder).
- After any change: run `./build.sh <name>`. It fails if the manifest `description` is over 132 characters.
- There is no test runner. Logic that doesn't touch Chrome APIs lives in pure modules (`src/lib/*.js`) so it can be checked with a throwaway `node` script that imports it.

## Shared code (`shared/`)
- `polaris.css` (Polaris tokens + component classes: `card`, `btn`, `field`, `select`, `checkbox`, `action-list`, `badge`, `toast`…), `polaris-icons.js` (`icon(name)`), `ui.js` (`$`, `el`, `toast`, `copy`, `download`).
- Referenced from extension code as `src/shared/…` (e.g. `../shared/ui.js` from `src/popup/`). Changing `shared/` affects every extension; rebuild all.
- Build UI from these classes and helpers; don't add a framework or another CSS library.

## Conventions
- ES modules everywhere (`"type": "module"` service workers). Plain DOM via `el()`.
- Settings that should follow the user go in `chrome.storage.sync` behind a `getSettings()` / `saveSettings()` pair with a `DEFAULT_SETTINGS` object and a shape comment at the top of the file; keep that comment current. Per-device data goes in `chrome.storage.local`; per-browser-session state in `chrome.storage.session` (service workers sleep, so module variables are not durable).
- Service-worker listeners must be registered at top level, synchronously.
- Each extension's README has a **Layout** block listing its files; update it when adding a file.
- New permissions must be justified in that extension's store listing doc if it has one.

## Releases
Every new feature or fix ships as a GitHub release. To release, bump `version` in that extension's `manifest.json` (minor for a feature, patch for a fix) and push to `main`. [.github/workflows/release.yml](.github/workflows/release.yml) then builds the zip and creates the release `<folder>-v<version>` (e.g. `shopify-tab-dedupe-v1.2.0`). Its notes are the commit subjects touching that extension since its last release, so write commit subjects that read well as release notes. Don't create tags or releases by hand; a version whose tag already exists is skipped. After pushing, check the run with `gh run list -R Vikramsungadi/chrome-extensions`.
- Commits go to `main` on `github.com/Vikramsungadi/chrome-extensions`, pushed as the **Vikramsungadi** account (gh's active account may be a different one).
