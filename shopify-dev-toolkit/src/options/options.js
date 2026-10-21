import { EDITORS, getSettings, saveSettings } from '../lib/storage.js';

const $ = sel => document.querySelector(sel);

function field(label, value, placeholder, cls = '') {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<label class="label small"></label><input class="field ${cls}">`;
  wrap.querySelector('label').textContent = label;
  Object.assign(wrap.querySelector('input'), { value: value || '', placeholder });
  return wrap;
}

function removeButton() {
  const b = document.createElement('button');
  b.className = 'btn plain';
  b.textContent = 'Remove';
  b.onclick = () => b.parentElement.remove();
  return b;
}

function addStoreRow(store = {}) {
  const row = document.createElement('div');
  row.className = 'row store';
  row.append(
    field('Label', store.label, 'UAE'),
    field('Storefront URL', store.url, 'https://ae.example.com'),
    field('Preview theme ID', store.previewThemeId, 'optional', 'mono'),
    removeButton()
  );
  $('#stores').append(row);
}

function addRepoRow(shop = '', path = '') {
  const row = document.createElement('div');
  row.className = 'row repo';
  row.append(
    field('Shop', shop, 'store.myshopify.com', 'mono'),
    field('Repo path', path, '/Users/you/code/theme', 'mono'),
    removeButton()
  );
  $('#repos').append(row);
}

function addTokenRow(shop = '', token = '') {
  const row = document.createElement('div');
  row.className = 'row repo token';
  const tokenField = field('Access token', token, 'shpat_…', 'mono');
  tokenField.querySelector('input').type = 'password';
  row.append(field('Shop', shop, 'store.myshopify.com', 'mono'), tokenField, removeButton());
  $('#tokens').append(row);
}

const normalizeShop = shop => {
  const host = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return host.includes('.') ? host : `${host}.myshopify.com`;
};

const values = row => [...row.querySelectorAll('input')].map(i => i.value.trim());

async function save() {
  const linkedStores = [];
  for (const row of document.querySelectorAll('.row.store')) {
    const [label, url, previewThemeId] = values(row);
    if (!label && !url) continue;
    try {
      linkedStores.push({ label: label || new URL(url).host, url: new URL(url).origin, ...(previewThemeId && { previewThemeId }) });
    } catch {
      return status(`Invalid URL: ${url || '(empty)'}`, true);
    }
  }
  const repos = {};
  for (const row of document.querySelectorAll('.row.repo:not(.token)')) {
    const [shop, path] = values(row);
    if (shop && path) repos[normalizeShop(shop)] = path.replace(/\/$/, '');
  }
  const tokens = {};
  for (const row of document.querySelectorAll('.row.token')) {
    const [shop, token] = values(row);
    if (shop && token) tokens[normalizeShop(shop)] = token;
  }
  await chrome.storage.local.set({ tokens });
  await chrome.storage.session.clear(); // drop cached theme files fetched with old credentials
  await saveSettings({
    editor: $('#editor').value,
    alwaysAddPreviewParam: $('#always-preview').checked,
    linkedStores,
    repos
  });
  status('Saved');
}

function status(text, isError = false) {
  $('#status').textContent = text;
  $('#status').style.color = isError ? 'var(--p-critical-text)' : '';
  if (!isError) setTimeout(() => ($('#status').textContent = ''), 2000);
}

async function init() {
  const settings = await getSettings();
  $('#editor').append(...Object.entries(EDITORS).map(([value, { label }]) => new Option(label, value, false, value === settings.editor)));
  $('#always-preview').checked = settings.alwaysAddPreviewParam;
  settings.linkedStores.forEach(addStoreRow);
  Object.entries(settings.repos).forEach(([shop, path]) => addRepoRow(shop, path));

  $('#add-store').onclick = () => addStoreRow();
  const { tokens = {} } = await chrome.storage.local.get('tokens');
  Object.entries(tokens).forEach(([shop, token]) => addTokenRow(shop, token));

  $('#add-repo').onclick = () => addRepoRow();
  $('#add-token').onclick = () => addTokenRow();
  $('#save').onclick = save;
}

init();
