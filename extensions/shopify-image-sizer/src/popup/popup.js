import { $, el, copy, download, toast } from '../shared/ui.js';
import { icon } from '../shared/polaris-icons.js';
import { getCaptures, onCapturesChanged, pageKey, removeCaptures, toCSV, toText } from '../lib/captures.js';
import { getActiveTab, inspectorActive, toggleInspector } from '../lib/tab.js';
import { renderGroups } from '../ui/captures.js';

const state = { tab: null, scope: 'page', captures: [], clearArmed: false };

document.querySelectorAll('[data-icon]').forEach(node => node.insertAdjacentHTML('afterbegin', icon(node.dataset.icon)));

const visible = () => state.scope === 'all'
  ? state.captures
  : state.captures.filter(c => pageKey(c.page.url) === pageKey(state.tab?.url || ''));

function render() {
  const here = state.captures.filter(c => pageKey(c.page.url) === pageKey(state.tab?.url || '')).length;
  $('#count-page').textContent = here || '';
  $('#count-all').textContent = state.captures.length || '';
  document.querySelectorAll('[data-scope]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.scope === state.scope)));

  const list = visible();
  renderGroups($('#groups'), list, { showPage: state.scope === 'all' });
  $('#empty').hidden = list.length > 0;
  $('#export').hidden = list.length === 0;
  disarmClear();
}

function disarmClear() {
  state.clearArmed = false;
  $('#clear').textContent = state.scope === 'all' ? 'Clear all' : 'Clear this page';
}

document.querySelectorAll('[data-scope]').forEach(tab => tab.addEventListener('click', () => {
  state.scope = tab.dataset.scope;
  render();
}));

document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => {
  const list = visible();
  const stamp = new Date().toISOString().slice(0, 10);
  ({
    text: () => copy(toText(list), `Copied ${list.length} references`),
    csv: () => copy(toCSV(list), `Copied CSV · ${list.length} rows`),
    download: () => download(`image-sizes-${stamp}.csv`, `\uFEFF${toCSV(list)}`, 'text/csv') // BOM: Excel reads it as UTF-8
  })[button.dataset.export]();
}));

// Two-step clear instead of confirm(), which closes the popup.
$('#clear').addEventListener('click', async () => {
  if (!state.clearArmed) {
    state.clearArmed = true;
    $('#clear').textContent = `Click again to delete ${visible().length}`;
    return;
  }
  const list = visible();
  await removeCaptures(list.map(c => c.id));
  toast(`Deleted ${list.length}`);
});

$('#toggle').addEventListener('click', async () => {
  try {
    const on = await toggleInspector(state.tab.id);
    if (on) window.close(); // get out of the way so the page can be hovered
    else setToggle(false);
  } catch {
    toast('Can’t inspect this page', true);
  }
});

function setToggle(on) {
  $('#toggle-label').textContent = on ? 'Stop inspecting' : 'Inspect images';
}

onCapturesChanged(captures => {
  state.captures = captures;
  render();
});

(async () => {
  state.tab = await getActiveTab();
  const [captures, active, commands] = await Promise.all([
    getCaptures(), inspectorActive(state.tab.id), chrome.commands.getAll()
  ]);
  state.captures = captures;
  setToggle(active);
  const shortcut = commands.find(c => c.name === 'toggle-inspector')?.shortcut;
  if (shortcut) {
    const keys = shortcut.includes('+') ? shortcut.split('+') : [...shortcut];
    $('#shortcut').replaceChildren(...keys.map(k => el('kbd', { className: 'k', textContent: k })));
  }
  // Nothing saved here yet but saved elsewhere: start on "All pages".
  if (!visible().length && captures.length) state.scope = 'all';
  render();
})();
