// Pure URL builders. Input is the object returned by probePage().

const ADMIN = 'https://admin.shopify.com/store';

const ADMIN_RESOURCE_PATHS = {
  product: 'products',
  collection: 'collections',
  page: 'pages',
  article: 'content/articles',
  blog: 'content/blogs'
};

/** Path without the market subfolder, e.g. /en-us/products/x -> /products/x */
export function stripMarketRoot(pathname, routesRoot = '/') {
  if (routesRoot !== '/' && pathname.startsWith(routesRoot)) return '/' + pathname.slice(routesRoot.length);
  if (routesRoot !== '/' && pathname === routesRoot.replace(/\/$/, '')) return '/';
  return pathname;
}

export function isLiveTheme(ctx) {
  return ctx.theme.role === 'main';
}

/** Adds preview_theme_id to any storefront URL (skipped for the live theme unless forced). */
export function withPreview(url, ctx, force = false) {
  const u = new URL(url);
  if (ctx.theme.id && (force || !isLiveTheme(ctx))) u.searchParams.set('preview_theme_id', ctx.theme.id);
  return u.toString();
}

export function previewLink(ctx, force = false) {
  return withPreview(ctx.url, ctx, force);
}

export function liveLink(ctx) {
  const u = new URL(ctx.url);
  u.searchParams.delete('preview_theme_id');
  return u.toString();
}

/** Link that drops the preview cookie and returns to the live theme. */
export function exitPreviewLink(ctx) {
  const u = new URL(ctx.url);
  u.searchParams.set('preview_theme_id', '');
  return u.toString();
}

export function themeEditorLink(ctx) {
  const base = `${ADMIN}/${ctx.storeHandle}/themes/${ctx.theme.id}/editor`;
  const previewPath = stripMarketRoot(ctx.pathname, ctx.routesRoot);
  return `${base}?previewPath=${encodeURIComponent(previewPath)}`;
}

export function codeEditorLink(ctx, file) {
  const base = `${ADMIN}/${ctx.storeHandle}/themes/${ctx.theme.id}`;
  return file ? `${base}?key=${encodeURIComponent(file)}` : base;
}

export function adminLink(ctx) {
  const path = ADMIN_RESOURCE_PATHS[ctx.resourceType];
  return path && ctx.resourceId
    ? `${ADMIN}/${ctx.storeHandle}/${path}/${ctx.resourceId}`
    : `${ADMIN}/${ctx.storeHandle}/themes`;
}

export function adminUrl(ctx, path = '') {
  return `${ADMIN}/${ctx.storeHandle}${path ? `/${path}` : ''}`;
}

export function adminSearchLink(ctx, scope, query) {
  return `${adminUrl(ctx, scope)}?query=${encodeURIComponent(query.replace(/^#/, ''))}`;
}

/** Admin destinations, grouped like the admin sidebar. `add` is the "create new" path. */
export const ADMIN_NAV = [
  { group: 'Sales', items: [
    { label: 'Orders', icon: 'order', path: 'orders' },
    { label: 'Drafts', icon: 'draft', path: 'draft_orders', add: 'draft_orders/new' },
    { label: 'Customers', icon: 'customer', path: 'customers', add: 'customers/new' },
    { label: 'Discounts', icon: 'discount', path: 'discounts' }
  ] },
  { group: 'Catalog', items: [
    { label: 'Products', icon: 'product', path: 'products', add: 'products/new' },
    { label: 'Collections', icon: 'collection', path: 'collections', add: 'collections/new' },
    { label: 'Inventory', icon: 'inventory', path: 'products/inventory' },
    { label: 'Gift cards', icon: 'giftcard', path: 'gift_cards' }
  ] },
  { group: 'Content', items: [
    { label: 'Metaobjects', icon: 'metaobject', path: 'content/metaobjects' },
    { label: 'Files', icon: 'file', path: 'content/files' },
    { label: 'Menus', icon: 'menu', path: 'content/menus' },
    { label: 'Blog posts', icon: 'blog', path: 'content/articles' },
    { label: 'Pages', icon: 'page', path: 'pages', add: 'pages/new' }
  ] },
  { group: 'Store', items: [
    { label: 'Home', icon: 'home', path: '' },
    { label: 'Themes', icon: 'theme', path: 'themes' },
    { label: 'Markets', icon: 'markets', path: 'markets' },
    { label: 'Preferences', icon: 'preferences', path: 'online_store/preferences' },
    { label: 'Analytics', icon: 'analytics', path: 'analytics' },
    { label: 'Apps', icon: 'apps', path: 'apps' },
    { label: 'Settings', icon: 'settings', path: 'settings' }
  ] }
];

export function resourceJsonLinks(ctx) {
  const links = [{ label: 'cart.js', href: `${ctx.origin}${ctx.routesRoot}cart.js` }];
  const clean = ctx.pathname.replace(/\/$/, '');
  if (ctx.pageType === 'product') {
    links.unshift({ label: 'product.js', href: `${ctx.origin}${clean}.js` }, { label: 'product.json', href: `${ctx.origin}${clean}.json` });
  } else if (ctx.pageType === 'collection') {
    links.unshift({ label: 'products.json', href: `${ctx.origin}${clean}/products.json` });
  }
  return links;
}

const displayNames = {
  language: new Intl.DisplayNames(['en'], { type: 'language' }),
  region: new Intl.DisplayNames(['en'], { type: 'region' })
};

export function describeLocale(tag) {
  const [lang, region] = tag.split('-');
  const language = safe(() => displayNames.language.of(lang)) || lang;
  const country = region ? safe(() => displayNames.region.of(region.toUpperCase())) || region : null;
  return { language, country, region: region?.toUpperCase() || null };
}

export function countryName(code) {
  return safe(() => displayNames.region.of(code)) || code;
}

export function languageName(code) {
  return safe(() => displayNames.language.of(code)) || code;
}

export function flag(code) {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)));
}

/**
 * One entry per market URL for this page, from hreflang alternates.
 * Keeps the current query string (variant, filters…) and appends the preview theme.
 */
export function marketLinks(ctx) {
  const current = new URL(ctx.url);
  const seen = new Set();
  return ctx.alternates
    .map(alt => {
      const u = new URL(alt.href);
      current.searchParams.forEach((v, k) => { if (k !== 'preview_theme_id') u.searchParams.set(k, v); });
      const href = withPreview(u.toString(), ctx);
      const info = describeLocale(alt.hreflang);
      return { hreflang: alt.hreflang, href, ...info, isCurrent: u.origin + u.pathname === current.origin + current.pathname };
    })
    .filter(m => !seen.has(m.href) && seen.add(m.href));
}

/** Same page on another (linked) store, e.g. a separate expansion store per region. */
export function linkedStoreLink(ctx, store) {
  const u = new URL(stripMarketRoot(ctx.pathname, ctx.routesRoot) + ctx.search, store.url);
  u.searchParams.delete('preview_theme_id');
  if (store.previewThemeId) u.searchParams.set('preview_theme_id', store.previewThemeId);
  return u.toString();
}

export function debugInfo(ctx) {
  return [
    `Store:     ${ctx.shop}`,
    `URL:       ${previewLink(ctx, true)}`,
    `Theme:     ${ctx.theme.name} (#${ctx.theme.id}, ${ctx.theme.role})`,
    `Base:      ${ctx.theme.schemaName || '?'} ${ctx.theme.schemaVersion || ''}`.trimEnd(),
    `Market:    ${ctx.country || '?'} · ${ctx.locale || '?'} · ${ctx.currency || '?'}${ctx.routesRoot !== '/' ? ` · root ${ctx.routesRoot}` : ''}`,
    `Template:  ${ctx.pageType || '?'}${ctx.resourceId ? ` (${ctx.resourceType} ${ctx.resourceId})` : ''}`,
    `Browser:   ${navigator.userAgent}`
  ].join('\n');
}

function safe(fn) {
  try { return fn(); } catch { return null; }
}
