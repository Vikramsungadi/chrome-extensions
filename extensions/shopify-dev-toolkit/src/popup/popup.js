import { fetchJson, scanPage, switchLocalization, togglePreviewBar } from '../lib/page.js';
import { getActiveTab, getContext, runInTab, toggleInspector } from '../lib/tab.js';
import {
  ADMIN_NAV, adminLink, adminSearchLink, adminUrl, codeEditorLink, countryName, debugInfo, exitPreviewLink, flag,
  isLiveTheme, languageName, linkedStoreLink, liveLink, marketLinks, previewLink, resourceJsonLinks, themeEditorLink
} from '../lib/links.js';
import { getSettings } from '../lib/storage.js';
import { qrPng, qrSvg } from '../lib/qr.js';
import { icon } from '../vendor/polaris-icons.js';

const $ = sel => document.querySelector(sel);

function el(tag, props = {}, ...children) {
  const { html, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (html) node.innerHTML = html;
  node.append(...children.filter(c => c != null && c !== false));
  return node;
}

const state = { tab: null, ctx: null, settings: null, markets: [], qr: null, shortcuts: {} };

// ---------- helpers ----------
let toastTimer;
function toast(message, isError = false) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

async function copy(text, message = 'Copied') {
  await navigator.clipboard.writeText(text);
  toast(message);
}

const openTab = url => chrome.tabs.create({ url, index: state.tab.index + 1, openerTabId: state.tab.id });

function kbd(command) {
  const shortcut = state.shortcuts[command];
  if (!shortcut) return null;
  const keys = shortcut.includes('+') ? shortcut.split('+') : [...shortcut];
  return el('span', { className: 'inline', style: '--gap:2px' }, ...keys.map(k => el('kbd', { className: 'k', textContent: k })));
}

/**
 * One Polaris ActionList row.
 * opts: { icon, label, help, href, onClick, command, critical, disabled, prefix, suffix, divider }
 */
function action(opts) {
  const tag = opts.href ? 'a' : 'button';
  const node = el(tag, { className: `action${opts.critical ? ' critical' : ''}` });
  if (opts.href) Object.assign(node, { href: opts.href, target: '_blank' });
  if (opts.disabled) node.setAttribute('aria-disabled', 'true');
  if (opts.prefix) node.append(opts.prefix);
  else if (opts.icon) node.insertAdjacentHTML('beforeend', icon(opts.icon));
  node.append(el('span', { className: 'label-text' },
    opts.label,
    opts.help ? el('span', { className: 'help-text', textContent: opts.help }) : null
  ));
  const suffix = opts.suffix || kbd(opts.command) || (opts.href ? el('span', { html: icon('external') }) : null);
  if (suffix) node.append(el('span', { className: 'suffix' }, suffix));
  if (opts.onClick) {
    node.addEventListener('click', async event => {
      event.preventDefault();
      try { await opts.onClick(event); } catch (error) { console.error(error); toast(error.message || 'Something went wrong', true); }
    });
  }
  return el('li', { className: opts.divider ? 'divider-before' : '' }, node);
}

function iconButton(name, title, onClick) {
  return el('button', {
    className: 'icon-btn', title, ariaLabel: title, html: icon(name),
    onclick: event => { event.preventDefault(); event.stopPropagation(); onClick(); }
  });
}

// ---------- header ----------
function renderHeader() {
  const { ctx } = state;
  $('#theme-name').textContent = ctx.theme.name || 'Unknown theme';
  $('#theme-name').title = ctx.theme.name || '';
  const roles = { main: ['Live', 'success'], development: ['Development', 'info'], unpublished: ['Unpublished', 'attention'], demo: ['Demo', 'attention'] };
  const [label, tone] = roles[ctx.theme.role] || [ctx.theme.role || 'Unknown', ''];
  Object.assign($('#theme-role'), { textContent: label, className: `badge dot ${tone}`, hidden: false });
  $('#info-btn').hidden = false;
}

function marketLabel(country, language) {
  return [country && `${flag(country)} ${countryName(country)}`, language && languageName(language)].filter(Boolean).join(' · ');
}

// ---------- info ----------
function renderInfo() {
  const { ctx } = state;
  const rows = [
    ['Store', ctx.shop],
    ['Theme', ctx.theme.name],
    ['Theme ID', ctx.theme.id],
    ['Role', ctx.theme.role],
    ['Based on', [ctx.theme.schemaName, ctx.theme.schemaVersion].filter(Boolean).join(' ')],
    ['Market', marketLabel(ctx.country, ctx.locale)],
    ['Currency', ctx.currency && `${ctx.currency}${ctx.currencyRate && ctx.currencyRate !== '1.0' ? ` (rate ${ctx.currencyRate})` : ''}`],
    ['Market root', ctx.routesRoot],
    ['Template', ctx.pageType],
    [ctx.resourceType ? `${ctx.resourceType[0].toUpperCase()}${ctx.resourceType.slice(1)} ID` : 'Resource', ctx.resourceId],
    ['Sections', ctx.sections]
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  $('#details').replaceChildren(...rows.flatMap(([k, v]) => [
    el('dt', { textContent: k }),
    el('dd', { textContent: String(v), title: 'Click to copy', onclick: () => copy(String(v), `${k} copied`) })
  ]));
  $('#info-actions').replaceChildren(
    action({ icon: 'bug', label: 'Copy debug info', help: 'Store, theme, market and URL for bug reports', command: 'copy-debug-info', onClick: () => copy(debugInfo(ctx), 'Debug info copied') })
  );
}

// ---------- preview ----------
function thisPageQr() {
  const { ctx, settings } = state;
  return { href: previewLink(ctx, settings.alwaysAddPreviewParam), label: marketLabel(ctx.country, ctx.locale) || 'This page', isThisPage: true };
}

function renderPreview() {
  const { ctx } = state;
  state.qr = thisPageQr();
  renderQr();

  const live = isLiveTheme(ctx);
  const resource = ctx.resourceId ? ctx.resourceType : null;
  $('#preview-actions').replaceChildren(
    action({ icon: 'paint', label: 'Customize in theme editor', href: themeEditorLink(ctx), command: 'open-theme-editor' }),
    action({ icon: resource ? (resource === 'article' ? 'blog' : resource) : 'store', label: resource ? `Edit ${resource} in admin` : 'Open admin', href: adminLink(ctx), command: 'open-admin' }),
    action({ icon: 'code', label: 'Edit code', href: codeEditorLink(ctx), command: 'open-code-editor' }),
    action({ icon: 'view', label: 'View live theme', href: liveLink(ctx), disabled: live, divider: true }),
    action({
      icon: 'exit', label: 'Exit preview', disabled: live,
      onClick: async () => { await chrome.tabs.update(state.tab.id, { url: exitPreviewLink(ctx) }); window.close(); }
    })
  );

  const quick = ADMIN_NAV.flatMap(g => g.items).filter(i => ['products', 'collections'].includes(i.path));
  $('#quick-nav').replaceChildren(...quick.map(item => navRow(item)));
}

function renderQr() {
  const { qr } = state;
  $('#qr').innerHTML = qrSvg(qr.href);
  $('#qr').title = qr.href;
  $('#qr-caption').textContent = qr.label;
  $('#qr-caption').title = qr.href;
  $('#qr-reset').hidden = !!qr.isThisPage;
  $('#copy-btn').lastChild.textContent = qr.isThisPage ? 'Copy link' : 'Copy this link';
}

function showQrFor(href, label) {
  state.qr = { href, label };
  renderQr();
  selectTab('preview');
}

// ---------- admin ----------
function navRow(item) {
  const { ctx } = state;
  const row = action({ icon: item.icon, label: item.label, href: adminUrl(ctx, item.path), suffix: el('span') });
  if (item.add) {
    const add = iconButton('plus', `New ${item.label.toLowerCase().replace(/s$/, '')}`, () => openTab(adminUrl(ctx, item.add)));
    add.classList.add('add');
    row.append(add);
  }
  return row;
}

function renderAdmin() {
  const { ctx } = state;
  if (ctx.resourceId) {
    $('#this-page').hidden = false;
    const type = ctx.resourceType;
    $('#this-page-list').replaceChildren(
      action({ icon: type === 'article' ? 'blog' : type, label: `This ${type}`, help: `ID ${ctx.resourceId}`, href: adminLink(ctx) })
    );
  }

  const items = [];
  for (const { group, items: links } of ADMIN_NAV) {
    items.push(el('li', { className: 'group-label', textContent: group }));
    for (const item of links) items.push(navRow(item));
  }
  $('#admin-nav').replaceChildren(...items);

  const placeholders = { orders: 'Search orders, e.g. #1042', products: 'Search products', customers: 'Search customers', collections: 'Search collections', draft_orders: 'Search draft orders' };
  const scope = $('#admin-scope');
  try { scope.value = localStorage.getItem('sdt-scope') || 'orders'; } catch {}
  const syncPlaceholder = () => ($('#admin-query').placeholder = placeholders[scope.value]);
  syncPlaceholder();
  scope.addEventListener('change', () => {
    syncPlaceholder();
    try { localStorage.setItem('sdt-scope', scope.value); } catch {}
    $('#admin-query').focus();
  });
  $('#admin-search').addEventListener('submit', event => {
    event.preventDefault();
    const q = $('#admin-query').value.trim();
    openTab(q ? adminSearchLink(ctx, scope.value, q) : adminUrl(ctx, scope.value));
  });
}

// ---------- markets ----------
function marketRow({ prefix, label, help, href, current, qrLabel }) {
  const row = action({
    prefix, label, help, href,
    suffix: current ? el('span', { className: 'badge info', textContent: 'Current' }) : el('span')
  });
  row.append(el('span', { className: 'row-actions' },
    iconButton('qr', 'Show QR', () => showQrFor(href, qrLabel)),
    iconButton('copy', 'Copy link', () => copy(href, 'Link copied'))
  ));
  return row;
}

function renderMarkets() {
  const { ctx, markets, settings } = state;
  $('#markets-count').textContent = markets.length || '';
  $('#markets-title').textContent = markets.length ? `${markets.length} market URLs for this page` : 'Market URLs';
  $('#market-empty').hidden = markets.length > 0;
  $('[data-action="copy-all-markets"]').hidden = !markets.length;

  $('#market-list').replaceChildren(...markets.map(m => {
    const u = new URL(m.href);
    return marketRow({
      prefix: el('span', { className: 'flag', textContent: flag(m.region) }),
      label: m.country ? `${m.country} · ${m.language}` : m.language,
      help: `${m.hreflang} · ${u.host}${u.pathname}`,
      href: m.href,
      current: m.isCurrent,
      qrLabel: m.country ? `${flag(m.region)} ${m.country} · ${m.language}` : m.language
    });
  }));

  $('#linked-card').hidden = !settings.linkedStores.length;
  $('#linked-list').replaceChildren(...settings.linkedStores.map(store => {
    const href = linkedStoreLink(ctx, store);
    return marketRow({
      prefix: el('span', { className: 'flag', html: icon('store') }),
      label: store.label,
      help: new URL(store.url).host,
      href,
      current: new URL(store.url).host === new URL(ctx.origin).host,
      qrLabel: store.label
    });
  }));

  // Switcher suggestions: what the theme's selectors offer plus what hreflang reveals.
  const countries = new Set([...ctx.countries, ...markets.map(m => m.region).filter(Boolean)]);
  const languages = new Set([...ctx.languages, ...markets.map(m => m.hreflang.split('-')[0])]);
  $('#country-options').replaceChildren(...[...countries].sort().map(c => el('option', { value: c, textContent: countryName(c) })));
  $('#language-options').replaceChildren(...[...languages].sort().map(l => el('option', { value: l, textContent: languageName(l) })));
  $('#switch-country').title = `Current: ${ctx.country || '?'}`;
  $('#switch-language').title = `Current: ${ctx.locale || '?'}`;

  $('#switcher').addEventListener('submit', async event => {
    event.preventDefault();
    const country = $('#switch-country').value.trim().toUpperCase();
    const language = $('#switch-language').value.trim();
    if (!country && !language) return toast('Enter a country or language code', true);
    await runInTab(state.tab.id, switchLocalization, [country || null, language || null]);
    window.close();
  });
}

// ---------- tools ----------
function renderTools() {
  const { ctx } = state;
  $('#tool-actions').replaceChildren(
    action({
      icon: 'section', label: 'Section inspector', command: 'toggle-section-highlighter',
      onClick: async () => {
        const on = await toggleInspector(state.tab.id, ctx);
        if (on) window.close(); else toast('Section inspector off');
      }
    }),
    action({
      icon: 'hide', label: ctx.previewBarHidden ? 'Show preview bar' : 'Hide preview bar', command: 'toggle-preview-bar',
      onClick: async () => {
        ctx.previewBarHidden = await runInTab(state.tab.id, togglePreviewBar);
        renderTools();
        toast(ctx.previewBarHidden ? 'Preview bar hidden' : 'Preview bar shown');
      }
    }),
    action({
      icon: 'refresh', label: 'Reload without cache',
      onClick: async () => {
        const u = new URL(ctx.url);
        u.searchParams.set('_cb', Date.now());
        await chrome.tabs.update(state.tab.id, { url: u.toString() });
        window.close();
      }
    }),
    action({ icon: 'keyboard', label: 'Keyboard shortcuts', divider: true, suffix: el('span', { html: icon('chevron') }), onClick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }),
    action({ icon: 'settings', label: 'Settings', suffix: el('span', { html: icon('chevron') }), onClick: () => chrome.runtime.openOptionsPage() })
  );

  $('#data-actions').replaceChildren(
    ...resourceJsonLinks(ctx).map(l => action({ icon: 'data', label: l.label, href: l.href })),
    action({
      icon: 'cart', label: 'Copy cart JSON', divider: true,
      onClick: async () => {
        const res = await runInTab(state.tab.id, fetchJson, [`${ctx.routesRoot}cart.js`]);
        if (!res?.ok) return toast(`cart.js failed (${res?.status})`, true);
        await copy(JSON.stringify(JSON.parse(res.body), null, 2), 'Cart JSON copied');
      }
    }),
    action({
      icon: 'delete', label: 'Clear cart', critical: true,
      onClick: async () => {
        const res = await runInTab(state.tab.id, fetchJson, [`${ctx.routesRoot}cart/clear.js`, 'POST']);
        if (!res?.ok) return toast(`Clear failed (${res?.status})`, true);
        toast('Cart cleared, reloading');
        setTimeout(() => chrome.tabs.reload(state.tab.id), 600);
      }
    })
  );
}

function renderScan(issues) {
  const rows = [
    ['Liquid errors', issues.liquidErrors.length, 'critical', issues.liquidErrors],
    ['Missing translations', issues.missingTranslations.length, 'critical', issues.missingTranslations],
    ['Broken images', issues.brokenImages, 'critical'],
    ['Images without alt', issues.imagesWithoutAlt, 'attention'],
    ['Duplicate IDs', issues.duplicateIds.length, 'attention', issues.duplicateIds]
  ];
  const list = $('#scan-results');
  list.hidden = false;
  list.replaceChildren(...rows.map(([label, count, tone, details]) => action({
    icon: count ? 'alert' : 'check',
    label,
    help: details?.length ? details[0] : null,
    suffix: el('span', { className: `badge ${count ? tone : 'success'}`, textContent: count ? String(count) : 'OK' }),
    onClick: details?.length ? () => copy(details.join('\n'), `${label} copied`) : null
  })));

  const highlightable = issues.liquidErrors.length + issues.missingTranslations.length + issues.brokenImages;
  if (highlightable) {
    list.append(action({
      icon: 'view', label: 'Highlight on page', divider: true,
      onClick: async () => { await runInTab(state.tab.id, scanPage, [true]); window.close(); }
    }));
  }
  $('#scan-btn').textContent = 'Run again';
}

// ---------- static actions ----------
const ACTIONS = {
  options: () => chrome.runtime.openOptionsPage(),
  info: () => selectTab($('[data-panel="info"]').hidden ? 'info' : 'preview'),
  'copy-preview': () => copy(state.qr.href, 'Preview link copied'),
  'qr-reset': () => { state.qr = thisPageQr(); renderQr(); },
  async 'qr-download'() {
    const blob = await qrPng(state.qr.href, 512, `${state.ctx.theme.name} · ${state.qr.label}`);
    const a = el('a', { href: URL.createObjectURL(blob), download: `preview-${state.ctx.storeHandle}-${state.ctx.theme.id}.png` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async 'qr-copy'() {
    const blob = await qrPng(state.qr.href, 512);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('QR image copied');
  },
  'copy-all-markets': () => copy(state.markets.map(m => `${m.hreflang}\t${m.href}`).join('\n'), `Copied ${state.markets.length} market links`),
  async scan() {
    renderScan(await runInTab(state.tab.id, scanPage, [false]));
  }
};

function selectTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.panel').forEach(p => (p.hidden = p.dataset.panel !== name));
  $('#info-btn').classList.toggle('active', name === 'info');
  if (name === 'admin') $('#admin-query').focus();
  if (name !== 'info') try { localStorage.setItem('sdt-tab', name); } catch {}
}

document.addEventListener('click', async event => {
  const tab = event.target.closest('.tab');
  if (tab) return selectTab(tab.dataset.tab);

  const trigger = event.target.closest('[data-action]');
  if (!trigger || !ACTIONS[trigger.dataset.action]) return;
  event.preventDefault();
  try {
    await ACTIONS[trigger.dataset.action]();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Something went wrong', true);
  }
});


// ---------- boot ----------
async function init() {
  document.querySelectorAll('[data-icon]').forEach(node => node.insertAdjacentHTML('afterbegin', icon(node.dataset.icon)));
  document.body.focus(); // keep Chrome from drawing a focus ring on the first tab

  const [tab, settings, commands] = await Promise.all([getActiveTab(), getSettings(), chrome.commands.getAll()]);
  Object.assign(state, { tab, settings });
  commands.forEach(c => { if (c.shortcut) state.shortcuts[c.name] = c.shortcut; });
  state.ctx = tab?.id ? await getContext(tab.id) : null;
  $('#loading').hidden = true;

  if (!state.ctx?.theme.id) {
    $('#empty').hidden = false;
    return;
  }

  state.markets = marketLinks(state.ctx);
  renderHeader();
  renderInfo();
  renderPreview();
  renderAdmin();
  renderMarkets();
  renderTools();
  $('#app').hidden = false;

  let saved = null;
  try { saved = localStorage.getItem('sdt-tab'); } catch {}
  if (saved && document.querySelector(`[data-panel="${saved}"]`)) selectTab(saved);
}

init();
