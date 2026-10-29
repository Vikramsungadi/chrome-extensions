// A "slot" is the one tab a URL belongs in: one per store per kind (preview, theme editor, code
// editor, admin), or one per exact URL elsewhere. Pure functions so they can be tested without Chrome.

export const KINDS = {
  preview: 'Preview',
  editor: 'Theme editor',
  code: 'Code editor',
  admin: 'Admin'
};

const PREVIEW_PARAMS = ['preview_theme_id', 'preview_key'];

/** Admin path after the store ("themes/123/editor", "products") → kind. */
function adminKind(path) {
  if (/^themes\/\d+\/editor/.test(path)) return 'editor';
  if (/^themes\/\d+(\/|$)/.test(path)) return 'code';
  return 'admin';
}

/**
 * Slot for `url`, or null when it should never be merged (chrome://, about:blank, unknown sites
 * when `exact` is off).
 *   hosts: { [storefrontHost]: storeHandle | '' }: custom domains learned from preview links / linked in the popup
 *   exact: merge exact duplicate URLs (ignoring #hash) on any other site
 */
export function slotFor(url, { hosts = {}, exact = false } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname;
  const path = u.pathname.replace(/^\/+/, '');

  // admin.shopify.com/store/<handle>/…
  if (host === 'admin.shopify.com') {
    const [, store, rest = ''] = path.match(/^store\/([^/]+)\/?(.*)$/) || [];
    if (store) return slot(adminKind(rest), store);
  }

  // <handle>.myshopify.com/admin/… (redirects to admin.shopify.com) or its storefront
  const myshopify = host.match(/^([^.]+)\.myshopify\.com$/);
  if (myshopify) {
    const [, rest] = path.match(/^admin\/?(.*)$/) || [];
    if (rest !== undefined) return slot(adminKind(rest), myshopify[1]);
    return slot('preview', myshopify[1]);
  }

  const isPreview = PREVIEW_PARAMS.some(p => u.searchParams.has(p)) || host.endsWith('.shopifypreview.com');
  if (isPreview || host in hosts) return slot('preview', hosts[host] || host);

  if (!exact) return null;
  u.hash = '';
  return { key: `url:${u.href}`, kind: 'url', store: null };
}

const slot = (kind, store) => ({ key: `${kind}:${store}`, kind, store });

/**
 * Storefront host → store handle learned from a redirect, e.g. vahro.myshopify.com/?preview_theme_id=1
 * → vahro.com/?preview_theme_id=1 teaches { 'vahro.com': 'vahro' }. Returns null when nothing to learn.
 */
export function learnFromRedirect(fromUrl, toUrl) {
  try {
    const from = new URL(fromUrl);
    const to = new URL(toUrl);
    const handle = from.hostname.match(/^([^.]+)\.myshopify\.com$/)?.[1];
    if (!handle || from.pathname.startsWith('/admin') || to.hostname === from.hostname) return null;
    if (to.hostname.endsWith('shopify.com')) return null;
    return { host: to.hostname, store: handle };
  } catch {
    return null;
  }
}

/** Groups tabs by slot. Only slots holding more than one tab are duplicates. */
export function groupTabs(tabs, options) {
  const groups = new Map();
  for (const tab of tabs) {
    const s = slotFor(tab.url || tab.pendingUrl || '', options);
    if (!s) continue;
    if (!groups.has(s.key)) groups.set(s.key, { ...s, tabs: [] });
    groups.get(s.key).tabs.push(tab);
  }
  // The tab to keep comes first: the active one, else the most recently used.
  for (const g of groups.values()) g.tabs.sort((a, b) => (b.active - a.active) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
  return [...groups.values()];
}
