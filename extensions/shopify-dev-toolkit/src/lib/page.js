// Functions in this file are serialized and executed inside the tab via
// chrome.scripting.executeScript, so each must be fully self-contained:
// no imports, no closures over module scope.

/** Reads storefront context from window.Shopify & friends. Runs in the MAIN world. */
export function probePage() {
  const S = window.Shopify;
  if (!S || !S.shop) return null;

  const st = window.__st || {};
  const meta = window.ShopifyAnalytics?.meta || {};
  const theme = S.theme || {};
  const boomr = window.BOOMR || {};

  const alternates = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map(l => ({ hreflang: l.getAttribute('hreflang'), href: l.href }))
    .filter(a => a.hreflang && a.hreflang !== 'x-default');

  // Collect countries/languages offered by the theme's localization forms (Dawn-style lists and <select>s).
  const countries = new Set();
  const languages = new Set();
  const classify = value => {
    if (!value) return;
    if (/^[A-Z]{2}$/.test(value)) countries.add(value);
    else if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value)) languages.add(value);
  };
  document.querySelectorAll('form[action$="/localization"], localization-form, [data-localization-form]').forEach(form => {
    form.querySelectorAll('[data-value]').forEach(el => classify(el.dataset.value));
    form.querySelectorAll('select[name="country_code"] option, select[name="language_code"] option, select[name="locale_code"] option')
      .forEach(o => classify(o.value));
  });

  const sections = [...document.querySelectorAll('.shopify-section[id^="shopify-section-"]')].length;

  return {
    shop: S.shop,
    storeHandle: S.shop.replace(/\.myshopify\.com$/, ''),
    origin: location.origin,
    url: location.href,
    pathname: location.pathname,
    search: location.search,
    routesRoot: S.routes?.root || '/',
    locale: S.locale || document.documentElement.lang || null,
    country: S.country || null,
    currency: S.currency?.active || null,
    currencyRate: S.currency?.rate || null,
    designMode: !!S.designMode,
    theme: {
      id: theme.id || null,
      name: theme.name || null,
      role: theme.role || null,
      schemaName: theme.schema_name || boomr.themeName || null,
      schemaVersion: theme.schema_version || boomr.themeVersion || null,
      themeStoreId: theme.theme_store_id || null
    },
    pageType: st.p || meta.page?.pageType || null,
    resourceType: st.rtyp || null,
    resourceId: st.rid || null,
    alternates,
    countries: [...countries],
    languages: [...languages],
    sections,
    previewBarHidden: !!document.getElementById('__sdt-hide-preview-bar')
  };
}

/** Small in-page toast. */
export function toastInPage(message) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#303030;color:#fff;font:500 13px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:8px 14px;border-radius:10px;box-shadow:0 8px 16px -4px rgba(0,0,0,.3);transition:opacity .2s';
  host.textContent = message;
  document.documentElement.appendChild(host);
  setTimeout(() => { host.style.opacity = '0'; setTimeout(() => host.remove(), 250); }, 1800);
}

/** Switches country / language on the current domain via Shopify's /localization endpoint. */
export function switchLocalization(countryCode, languageCode) {
  const root = window.Shopify?.routes?.root || '/';
  let returnTo = location.pathname;
  if (root !== '/' && returnTo.startsWith(root)) returnTo = '/' + returnTo.slice(root.length);
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/localization';
  const fields = { form_type: 'localization', utf8: '✓', _method: 'put', return_to: returnTo + location.search };
  if (countryCode) fields.country_code = countryCode;
  if (languageCode) fields.language_code = languageCode;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Hides or shows the Shopify preview bar. Returns the new hidden state. */
export function togglePreviewBar(force) {
  const id = '__sdt-hide-preview-bar';
  const existing = document.getElementById(id);
  const hide = typeof force === 'boolean' ? force : !existing;
  if (hide && !existing) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '#preview-bar-iframe,#PBarNextFrameWrapper,#PBarNextFrame,#preview-bar-container{display:none!important}';
    document.documentElement.appendChild(style);
  } else if (!hide && existing) {
    existing.remove();
  }
  return hide;
}

/** Scans the rendered page for common theme QA issues. Optionally outlines them. */
export function scanPage(highlight) {
  const issues = { liquidErrors: [], missingTranslations: [], brokenImages: 0, imagesWithoutAlt: 0, duplicateIds: [] };
  const flagged = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node; (node = walker.nextNode());) {
    const text = node.textContent;
    if (/Liquid (syntax )?error/i.test(text)) {
      issues.liquidErrors.push(text.trim().slice(0, 160));
      flagged.push(node.parentElement);
    } else if (/translation missing/i.test(text)) {
      issues.missingTranslations.push(text.trim().slice(0, 160));
      flagged.push(node.parentElement);
    }
  }
  // Missing translations also leak into attributes (placeholders, aria-labels).
  document.querySelectorAll('[placeholder*="ranslation missing"], [aria-label*="ranslation missing"], [title*="ranslation missing"]').forEach(el => {
    issues.missingTranslations.push(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('title'));
    flagged.push(el);
  });

  document.querySelectorAll('img').forEach(img => {
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) { issues.brokenImages++; flagged.push(img); }
    if (!img.hasAttribute('alt')) issues.imagesWithoutAlt++;
  });

  const seen = new Map();
  document.querySelectorAll('[id]').forEach(el => seen.set(el.id, (seen.get(el.id) || 0) + 1));
  issues.duplicateIds = [...seen].filter(([id, n]) => n > 1 && id).map(([id, n]) => `${id} ×${n}`).slice(0, 25);

  document.querySelectorAll('[data-sdt-issue]').forEach(el => { el.style.outline = ''; el.removeAttribute('data-sdt-issue'); });
  if (highlight && flagged.length) {
    flagged.forEach(el => { el.dataset.sdtIssue = ''; el.style.outline = '2px dashed #e51c00'; });
    flagged[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return issues;
}

/** Fetches a storefront JSON endpoint from the page's origin (cart.js, product.js, …). */
export async function fetchJson(path, method = 'GET') {
  const res = await fetch(path, { method, headers: { Accept: 'application/json' } });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

/** Hands context to the isolated-world section inspector before its script file is injected. */
export function setInspectorContext(ctx) {
  window.__sdtContext = ctx;
}
