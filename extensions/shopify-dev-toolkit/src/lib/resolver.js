// Resolves a rendered section (e.g. "template--123__hero_licensed") to its real section *type*
// by reading the theme's JSON templates / section groups through the Admin API.
// The storefront only exposes the instance key, which can be renamed freely in the theme editor.

const API_VERSION = '2025-01';
// Optional host permissions, granted from the settings page ("Enable theme access").
export const THEME_ACCESS = { origins: ['https://*.myshopify.com/*', 'https://admin.shopify.com/*'] };
const LIST_TTL = 5 * 60 * 1000;

async function getToken(shop) {
  const { tokens = {} } = await chrome.storage.local.get('tokens');
  return tokens[shop] || null;
}

/** GET an Admin REST path, with the store's token if set, otherwise the logged-in admin session. */
async function adminGet(shop, path) {
  const token = await getToken(shop);
  const fail = (code, message) => Object.assign(new Error(message), { code });
  if (!(await chrome.permissions.contains(THEME_ACCESS))) throw fail('permission', 'Theme access is off');
  let res;
  try {
    res = token
      ? await fetch(`https://${shop}/admin/api/${API_VERSION}/${path}`, { headers: { 'X-Shopify-Access-Token': token, Accept: 'application/json' } })
      // No token: use the signed-in admin session on admin.shopify.com (where /admin/*.json redirects to).
      // A redirect here means "not signed in" (login page), so don't follow it.
      : await fetch(`https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/, '')}/${path}`, { credentials: 'include', redirect: 'manual', headers: { Accept: 'application/json' } });
  } catch {
    throw token
      ? fail('network', 'Could not reach the Admin API. Reload the extension to grant store access')
      : fail('auth', 'Sign in to admin or add an Admin API token');
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
    throw token
      ? fail('api', res.status === 403 ? 'Token is missing the read_themes scope' : 'Token rejected')
      : fail('auth', 'Sign in to admin or add an Admin API token');
  }
  if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) {
    throw fail(token ? 'api' : 'auth', token ? `Admin API error ${res.status}` : 'Admin session did not return JSON, add an Admin API token');
  }
  return res.json();
}

async function cached(key, ttl, load) {
  const hit = (await chrome.storage.session.get(key))[key];
  if (hit && (!ttl || Date.now() - hit.at < ttl)) return hit.value;
  const value = await load();
  await chrome.storage.session.set({ [key]: { at: Date.now(), value } });
  return value;
}

const listKeys = (shop, themeId) => cached(`keys:${themeId}`, LIST_TTL, async () =>
  (await adminGet(shop, `themes/${themeId}/assets.json?fields=key`)).assets.map(a => a.key));

const readAsset = (shop, themeId, key) => cached(`asset:${themeId}:${key}`, LIST_TTL, async () =>
  (await adminGet(shop, `themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`)).asset.value);

function parseThemeJson(raw) {
  try {
    return JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\//, ''));
  } catch {
    return null;
  }
}

function lineOf(raw, key) {
  const idx = raw.indexOf(`"${key}": {`) >= 0 ? raw.indexOf(`"${key}": {`) : raw.indexOf(`"${key}":`);
  return idx < 0 ? 1 : raw.slice(0, idx).split('\n').length;
}

function slug(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}

/** Context handles the current market might use in "*.context.<handle>.json". */
function marketHandles(country) {
  if (!country) return [];
  let name = null;
  try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(country); } catch {}
  return [country.toLowerCase(), slug(name)].filter(Boolean);
}

/**
 * @param {{ shop, themeId, sectionId, pageType, country }} req  sectionId without the "shopify-section-" prefix
 * @returns {{ ok: true, matches: [{ type, file, line, disabled, context }] } | { ok: false, code, error }}
 */
export async function resolveSection({ shop, themeId, sectionId, pageType, country }) {
  const [prefix, key] = sectionId.includes('__') ? sectionId.split('__') : [null, sectionId];
  if (!prefix) {
    // Static section rendered with {% section 'name' %}: the id *is* the type.
    return { ok: true, matches: [{ type: sectionId, file: null, line: 1, disabled: false, context: null, static: true }] };
  }

  try {
    const keys = await listKeys(shop, themeId);
    const isGroup = prefix.startsWith('sections--');
    const family = file => file.split('/').pop().split('.')[0]; // templates/index.context.in.json -> index
    let candidates = isGroup
      ? keys.filter(k => /^sections\/[^/]+\.json$/.test(k))
      : keys.filter(k => /^templates\/(?:customers\/)?[^/]+\.json$/.test(k));
    // Check the current template's family (base + alternates + market contexts) first.
    if (!isGroup && pageType) {
      const base = pageType === 'home' ? 'index' : pageType;
      candidates = [...candidates.filter(k => family(k) === base), ...candidates.filter(k => family(k) !== base)];
    }

    const matches = [];
    for (const file of candidates) {
      // Once a family has matched, don't read unrelated templates.
      if (!isGroup && matches.length && family(file) !== family(matches[0].file)) break;
      const raw = await readAsset(shop, themeId, file);
      const section = parseThemeJson(raw)?.sections?.[key];
      if (!section) continue;
      const context = file.match(/\.context\.([^.]+)\.json$/)?.[1] || null;
      // Context files (index.context.in.json) only hold overrides; the type lives in the base template.
      let type = section.type;
      if (!type && context) {
        const base = file.replace(/\.context\.[^.]+\.json$/, '.json');
        type = parseThemeJson(await readAsset(shop, themeId, base).catch(() => ''))?.sections?.[key]?.type;
      }
      matches.push({ type: type || null, file, line: lineOf(raw, key), disabled: !!section.disabled, context });
    }

    if (!matches.length) return { ok: false, code: 'missing', error: `"${key}" not found in theme JSON` };
    // Last resort: borrow the type from any other match of the same key.
    const known = matches.find(m => m.type)?.type;
    matches.forEach(m => { m.type ||= known; });
    if (!known) return { ok: false, code: 'missing', error: `No type for "${key}" in ${matches[0].file}` };

    // The rendered section is never disabled; prefer the current market's context file.
    const handles = marketHandles(country);
    const score = m => (m.disabled ? 0 : 4) + (m.context && handles.includes(m.context) ? 2 : 0) + (m.context ? 0 : 1);
    matches.sort((a, b) => score(b) - score(a));
    return { ok: true, matches };
  } catch (error) {
    return { ok: false, code: error.code || 'error', error: error.message };
  }
}
