import { copyInPage, toastInPage, togglePreviewBar } from './lib/page.js';
import { getActiveTab, getContext, runInTab, toggleInspector } from './lib/tab.js';
import { adminLink, codeEditorLink, debugInfo, marketLinks, previewLink, themeEditorLink } from './lib/links.js';
import { EDITORS, getSettings } from './lib/storage.js';
import { resolveSection } from './lib/resolver.js';

const toast = (tabId, message) => runInTab(tabId, toastInPage, [message]).catch(() => {});
const copy = (tabId, text, message) => runInTab(tabId, copyInPage, [text, message]);
const open = (tab, url) => chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });

const COMMANDS = {
  async 'copy-preview-link'(tab, ctx) {
    const { alwaysAddPreviewParam } = await getSettings();
    await copy(tab.id, previewLink(ctx, alwaysAddPreviewParam), 'Preview link copied');
  },
  'open-theme-editor': (tab, ctx) => open(tab, themeEditorLink(ctx)),
  'open-admin': (tab, ctx) => open(tab, adminLink(ctx)),
  'open-code-editor': (tab, ctx) => open(tab, codeEditorLink(ctx)),
  async 'toggle-section-highlighter'(tab, ctx) {
    const on = await toggleInspector(tab.id, ctx);
    await toast(tab.id, on ? 'Section inspector on — Esc to exit' : 'Section inspector off');
  },
  async 'copy-market-links'(tab, ctx) {
    const links = marketLinks(ctx);
    if (!links.length) return toast(tab.id, 'No market alternates (hreflang) on this page');
    const text = links.map(m => `${m.hreflang}\t${m.href}`).join('\n');
    await copy(tab.id, text, `Copied ${links.length} market links`);
  },
  async 'toggle-preview-bar'(tab) {
    const hidden = await runInTab(tab.id, togglePreviewBar);
    await toast(tab.id, hidden ? 'Preview bar hidden' : 'Preview bar shown');
  },
  'copy-debug-info': (tab, ctx) => copy(tab.id, debugInfo(ctx), 'Debug info copied')
};

chrome.commands.onCommand.addListener(async (command, tab) => {
  tab ??= await getActiveTab();
  if (!tab?.id || !COMMANDS[command]) return;
  const ctx = await getContext(tab.id);
  if (!ctx) return toast(tab.id, 'Not a Shopify storefront');
  try {
    await COMMANDS[command](tab, ctx);
  } catch (error) {
    console.error(`Command ${command} failed`, error);
    await toast(tab.id, 'Something went wrong — see extension console');
  }
});

// Messages from the section inspector (isolated content script) and popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    // External protocol (vscode://, cursor://) must be opened from a tab update, not window.open.
    openExternal: () => chrome.tabs.update(sender.tab.id, { url: request.url }),
    openTab: () => chrome.tabs.create({ url: request.url, index: sender.tab.index + 1, openerTabId: sender.tab.id }),
    openOptions: () => chrome.runtime.openOptionsPage(),
    resolveSection: () => resolveSection(request),
    openInEditor: () => openInEditor(sender.tab.id, request),
    inspectorClosed: () => chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' })
  };
  const handler = handlers[request.action];
  if (!handler) return false;
  Promise.resolve(handler()).then(
    result => sendResponse(result && typeof result === 'object' && 'ok' in result ? result : { ok: true }),
    error => sendResponse({ ok: false, error: String(error) })
  );
  return true;
});

/**
 * Opens repo-relative `file` (at `line`) in the local editor. The repo folder is opened first so the
 * editor focuses the window that already has it, instead of dropping the file into the last-used window.
 */
async function openInEditor(tabId, { repo, file, line = 1 }) {
  const { editor } = await getSettings();
  const scheme = (EDITORS[editor] || EDITORS.vscode).scheme;
  const root = repo.replace(/\/$/, '');
  await chrome.tabs.update(tabId, { url: `${scheme}://file${encodeURI(root)}` });
  await new Promise(resolve => setTimeout(resolve, 700));
  await chrome.tabs.update(tabId, { url: `${scheme}://file${encodeURI(`${root}/${file}`)}:${line}:1` });
}

// Colour the toolbar icon on pages that look like a Shopify storefront.
async function registerIconRules() {
  const imageData = {};
  for (const size of [16, 32, 48]) imageData[size] = await loadImageData(`/icons/icon${size}.png`);
  const rule = {
    conditions: [new chrome.declarativeContent.PageStateMatcher({ css: ['.shopify-section'] })],
    actions: [new chrome.declarativeContent.SetIcon({ imageData })]
  };
  await chrome.declarativeContent.onPageChanged.removeRules();
  await chrome.declarativeContent.onPageChanged.addRules([rule]);
}

async function loadImageData(path) {
  const bitmap = await createImageBitmap(await (await fetch(path)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

chrome.runtime.onInstalled.addListener(registerIconRules);
