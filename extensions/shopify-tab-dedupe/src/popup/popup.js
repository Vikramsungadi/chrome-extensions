import { $, el, toast } from '../shared/ui.js';
import { icon } from '../shared/polaris-icons.js';
import { KINDS, groupTabs, slotFor } from '../lib/slots.js';
import { COLORS, groupFor, parsePatterns } from '../lib/groups.js';
import { getSettings, saveSettings } from '../lib/settings.js';

const KIND_ICONS = { preview: 'view', editor: 'paint', code: 'code', admin: 'store' };
const state = { settings: null, groups: [], custom: [], filter: '' };

document.querySelectorAll('[data-icon]').forEach(node => node.insertAdjacentHTML('afterbegin', icon(node.dataset.icon)));

async function load() {
  state.settings = await getSettings();
  const tabs = await chrome.tabs.query({ windowType: 'normal' });
  state.groups = groupTabs(tabs, state.settings);
  state.custom = customGroups(tabs);
  render();
  renderRules();
}

/** Non-Shopify tabs that match a custom group rule ("GA" → tagmanager.google.com), by group. */
function customGroups(tabs) {
  const map = new Map();
  const options = { ...state.settings, groupStores: false };
  for (const tab of tabs) {
    const url = tab.url || tab.pendingUrl || '';
    if (slotFor(url, state.settings)?.store) continue; // Shopify tabs are listed under their store
    const group = groupFor(url, options);
    if (!group) continue;
    if (!map.has(group.title)) map.set(group.title, []);
    map.get(group.title).push(tab);
  }
  return [...map].map(([title, tabs]) => ({ title, tabs }));
}

async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

/** Shopify slots grouped per store, most recently used store first. */
function stores() {
  const map = new Map();
  for (const g of state.groups) {
    if (g.kind === 'url') continue;
    if (!map.has(g.store)) map.set(g.store, { store: g.store, slots: {}, lastAccessed: 0 });
    const entry = map.get(g.store);
    entry.slots[g.kind] = g;
    entry.lastAccessed = Math.max(entry.lastAccessed, ...g.tabs.map(t => t.lastAccessed || 0));
  }
  return [...map.values()].sort((a, b) => b.lastAccessed - a.lastAccessed);
}

// "vahro ed" matches the Vahro theme editor row: every word must hit the store, kind or tab title.
function matches(...parts) {
  const words = state.filter.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = parts.join(' ').toLowerCase();
  return words.every(w => haystack.includes(w));
}

function slotRow(store, kind, group) {
  const [tab] = group.tabs;
  const extra = group.tabs.length - 1;
  const button = el('button', { className: 'action', onclick: () => focusTab(tab), html: icon(KIND_ICONS[kind]) },
    el('span', { className: 'label-text' }, KINDS[kind], el('span', { className: 'help-text', textContent: tab.title || tab.url })),
    extra ? el('span', { className: 'badge critical', textContent: `+${extra}`, title: `${extra} duplicate tab${extra > 1 ? 's' : ''}` }) : null,
    tab.active ? el('span', { className: 'badge info', textContent: 'Here' }) : null
  );
  return el('li', {}, button);
}

function tabRow(tab) {
  const button = el('button', { className: 'action', onclick: () => focusTab(tab), html: icon('globe') },
    el('span', { className: 'label-text' }, tab.title || tab.url, el('span', { className: 'help-text', textContent: new URL(tab.url || tab.pendingUrl).hostname })),
    tab.active ? el('span', { className: 'badge info', textContent: 'Here' }) : null
  );
  return el('li', {}, button);
}

/** Storefront domains not tied to an admin store yet can be linked so they group (and merge) with it. */
function linkSelect(entry, handles) {
  const select = el('select', { className: 'select sm link', title: 'Group this storefront with an admin store' },
    el('option', { value: '', textContent: 'Link to store…' }),
    ...handles.map(h => el('option', { value: h, textContent: h }))
  );
  select.onchange = async () => {
    await saveSettings({ hosts: { ...state.settings.hosts, [entry.store]: select.value } });
    toast(`${entry.store} → ${select.value}`);
    load();
  };
  return select;
}

function render() {
  const { settings } = state;
  $('#enabled').checked = settings.enabled;
  $('#enabled-label').textContent = settings.enabled ? 'On' : 'Off';
  document.querySelectorAll('[data-setting]').forEach(box => (box.checked = settings[box.dataset.setting]));

  const dupes = state.groups.reduce((n, g) => n + g.tabs.length - 1, 0);
  $('#dupes').hidden = !dupes;
  $('#dupes-text').textContent = `${dupes} duplicate tab${dupes > 1 ? 's' : ''} open`;

  const all = stores();
  const handles = all.map(s => s.store).filter(s => !s.includes('.'));
  const cards = all.map(entry => {
    const rows = Object.keys(KINDS)
      .filter(kind => entry.slots[kind] && matches(entry.store, KINDS[kind], kind, entry.slots[kind].tabs[0].title))
      .map(kind => slotRow(entry.store, kind, entry.slots[kind]));
    if (!rows.length) return null;
    const unlinked = entry.store.includes('.') && handles.length;
    return el('div', { className: 'card flush' },
      el('div', { className: 'store-head' },
        el('p', { className: 'heading-sm grow truncate', textContent: entry.store }),
        unlinked ? linkSelect(entry, handles) : null
      ),
      el('ul', { className: 'action-list' }, ...rows)
    );
  }).filter(Boolean);
  for (const group of state.custom) {
    const rows = group.tabs.filter(tab => matches(group.title, tab.title, tab.url)).map(tabRow);
    if (rows.length) cards.push(el('div', { className: 'card flush' },
      el('div', { className: 'store-head' }, el('p', { className: 'heading-sm grow truncate', textContent: group.title })),
      el('ul', { className: 'action-list' }, ...rows)
    ));
  }
  $('#stores').replaceChildren(...cards);
  const any = all.length + state.custom.length > 0;
  $('#empty').hidden = any;
  if (any && !cards.length) $('#stores').append(el('p', { className: 'subdued small', textContent: 'No tab matches.' }));
}

// ---------- custom tab group rules ----------
async function saveRules(groups, message) {
  state.settings = await saveSettings({ groups });
  if (message) toast(message);
}

// Rows are only rebuilt on load / add / delete, so tabbing between fields keeps focus.
function renderRules() {
  $('#rules').replaceChildren(...state.settings.groups.map((rule, index) => {
    const update = patch => saveRules(state.settings.groups.map((r, i) => (i === index ? { ...r, ...patch } : r)), 'Group saved');
    const name = el('input', { className: 'field sm name', value: rule.name || '', placeholder: 'Name, e.g. GA', onchange: () => update({ name: name.value.trim() }) });
    const color = el('select', { className: 'select sm color', title: 'Group colour', onchange: () => update({ color: color.value }) },
      ...COLORS.map(c => el('option', { value: c, textContent: c[0].toUpperCase() + c.slice(1), selected: c === rule.color }))
    );
    const patterns = el('input', {
      className: 'field sm', value: (rule.patterns || []).join(', '), placeholder: 'tagmanager.google.com, ga4.com',
      onchange: () => update({ patterns: parsePatterns(patterns.value) })
    });
    const remove = el('button', {
      className: 'icon-btn', title: 'Delete group', html: icon('delete'),
      onclick: async () => {
        await saveRules(state.settings.groups.filter((r, i) => i !== index), `Deleted ${rule.name || 'group'}`);
        renderRules();
      }
    });
    return el('div', { className: 'rule stack', style: '--gap:6px' }, el('div', { className: 'inline' }, name, color, remove), patterns);
  }));
}

$('#add-rule').addEventListener('click', async () => {
  const { groups } = state.settings;
  await saveRules([...groups, { name: '', color: COLORS[(groups.length + 1) % COLORS.length], patterns: [] }]);
  renderRules();
  $('#rules .rule:last-child .name').focus();
});

$('#filter').addEventListener('input', event => {
  state.filter = event.target.value;
  render();
});

// Enter jumps to the first match, so the shortcut + a few letters + Enter switches tabs.
$('#filter').addEventListener('keydown', event => {
  if (event.key === 'Enter') $('#stores .action')?.click();
});

$('#enabled').addEventListener('change', async event => {
  state.settings = await saveSettings({ enabled: event.target.checked });
  render();
});

document.querySelectorAll('[data-setting]').forEach(box => box.addEventListener('change', async () => {
  await saveSettings({ [box.dataset.setting]: box.checked });
  load();
}));

$('#close-dupes').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ action: 'closeDuplicates' });
  toast(res.ok ? `Closed ${res.closed} tab${res.closed === 1 ? '' : 's'}` : 'Could not close tabs', !res.ok);
  load();
});

load();
