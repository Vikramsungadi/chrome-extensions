# TabEase (folder: shopify-tab-dedupe)

Keeps one tab per Shopify store "slot" (preview, theme editor, code editor, admin) and puts tabs into Chrome tab groups (one per store, plus user-defined URL-pattern groups). The folder name is kept for `build.sh`; the product name is **TabEase** (manifest, popup title, README).

Build: `./build.sh shopify-tab-dedupe` from the repo root. User-facing docs: [README.md](README.md).

## Where things live
- `src/lib/slots.js`: URL → slot (`{ key, kind, store }`). Pure.
- `src/lib/groups.js`: URL → tab group (`{ key, title, color }`). Pure. Custom rules first (first match wins), then the store group if `groupStores` is on.
- `src/lib/settings.js`: synced settings; the shape comment at the top is the source of truth.
- `src/background.js`: new-tab merging (`webNavigation.onBeforeNavigate`), redirect learning of custom storefront domains, badge, "keep separate" context menu, tab grouping.
- `src/popup/`: store switcher, custom group editor, toggles.

## Rules that are easy to break
- **Only brand-new tabs are merged.** A tab is "fresh" until it commits its first http(s) page. Never redirect navigation inside a tab the user is already using.
- **Never touch tab groups the user made.** A group is TabEase's only if it's in `ownGroups` (group id → `groupFor` key, kept in `storage.session`) or its title matches a custom rule name or a saved `storeGroups` title.
- **Register a new group in `ownGroups` only after `tabGroups.update` sets its title/colour.** `tabGroups.onUpdated` saves any rename/recolour of an owned group as the user's edit (`storeGroups` for stores, the rule itself for custom groups). Registering earlier would save Chrome's blank grey group as an edit.
- Grouping work is chained per window (`queueGroup`) so two tabs opening together don't create two groups with the same name.
- Pinned and incognito tabs are never grouped or merged.
- `hosts` maps custom storefront domains to store handles (`redwolf.in` → `redwolf-india`). They're learned from myshopify → custom-domain redirects or linked in the popup. A domain without a store maps to `''` and is then its own "store".
- Changing `grouping`, `groupStores`, `groups`, `storeGroups` or `hosts` regroups every open tab (`storage.onChanged` → `groupAll`).

## Checking changes
Write a scratch node script that imports `src/lib/groups.js` / `slots.js` and asserts `groupFor` / `slotFor` on sample URLs (admin.shopify.com/store/<h>/…, <h>.myshopify.com, custom domains, `chrome://`). Then build and reload the unpacked extension; the grouping and merge behaviour can only be confirmed in Chrome.
