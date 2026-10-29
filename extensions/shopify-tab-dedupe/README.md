# TabEase

One tab per store for each of **Preview**, **Theme editor**, **Code editor** and **Admin**. When a link opens a new tab for a slot that is already open, the existing tab navigates to the new link and the new tab closes. Three stores means at most twelve tabs, never two "vahro admin" tabs. Tabs are also collected into **Chrome tab groups**: one per store, plus any groups you define.

## Install
1. From the repo root run `./build.sh shopify-tab-dedupe`
2. `chrome://extensions` → **Load unpacked** → `dist/shopify-tab-dedupe`

## How it decides
| URL | Slot |
| --- | --- |
| `admin.shopify.com/store/vahro/themes/123/editor` | Theme editor · vahro |
| `admin.shopify.com/store/vahro/themes/123?key=…` | Code editor · vahro |
| `admin.shopify.com/store/vahro/…` (anything else) | Admin · vahro |
| `vahro.myshopify.com/admin/…` | same as above (it redirects there) |
| `vahro.myshopify.com/…`, `…?preview_theme_id=`, `*.shopifypreview.com`, known storefront domains | Preview · vahro |
| any other site (optional, on by default) | the exact URL, ignoring `#hash` |

- Only **new tabs** are merged. Navigating inside a tab you're already using is never redirected.
- A foreground new tab brings the existing tab forward. A ⌘-click (background) tab updates the existing tab quietly.
- **Custom domains** are learned automatically: when `vahro.myshopify.com/?preview_theme_id=…` redirects to `vahro.com`, `vahro.com` becomes vahro's preview. If a domain wasn't learned, use **Link to store…** on its card in the popup.

## Tab groups
- **Per store** (on by default): every redwolf tab (preview, theme editor, code editor, admin, custom domain) goes into a `redwolf` group.
- **Custom groups**: in the popup, use **Add group** and give it a name, a colour and comma-separated patterns. For example:

  | Name | Patterns |
  | --- | --- |
  | GA | `tagmanager.google.com, analytics.google.com` |
  | REDWOLF | `redwolf*` |

- A pattern matches a store handle, a domain (including its subdomains), or domain + path (`shopify.dev/docs*`). `*` is a wildcard. Custom groups win over store groups, and the first matching rule wins.
- A tab that navigates away from a group's sites leaves the group. Groups you made yourself are never changed, and pinned tabs stay ungrouped.

## Popup: store switcher
- Shortcut <kbd>⌃⇧T</kbd> (Mac) / <kbd>Alt+Shift+T</kbd> opens it. Type `red ed` and press Enter to jump to Redwolf's theme editor.
- Shows every store's slots, which one you're on, and a **+N** badge on duplicates. **Close duplicates** keeps the active (or most recently used) tab of each slot.
- The toolbar badge shows the number of duplicate tabs, and flashes ↺ when a tab was merged.
- Tabs in custom groups get their own card, so `ga` + Enter jumps to Tag Manager.
- The switch in the top bar pauses merging.

**Need two tabs anyway?** Right-click a link → **Open link in new tab (keep separate)**. That tab is never merged or reused.

## Layout
```
src/lib/slots.js      URL → slot rules (pure)
src/lib/groups.js     URL → tab group rules (pure)
src/lib/settings.js   synced settings + learned storefront domains
src/background.js     new-tab interception, tab grouping, redirect learning, badge, context menu
src/popup/            store switcher
```
