import { toastInPage, togglePreviewBar } from './lib/page.js';
import { getActiveTab, getContext, runInTab, toggleInspector } from './lib/tab.js';
import { adminKeyMenu, codeEditorLink, debugInfo, marketLinks, previewLink, storeHandleFrom, themeEditorLink } from './lib/links.js';
import { EDITORS, getSettings } from './lib/storage.js';
import { resolveSection } from './lib/resolver.js';
import { canPersistPreviewBar, rememberPreviewBar, syncPreviewBarScript } from './lib/preview-bar.js';

const toast = (tabId, message) => runInTab(tabId, toastInPage, [message]).catch(() => {});
const OFFSCREEN = 'src/offscreen/offscreen.html';

/** Copies via the offscreen document, then confirms on the page only if the copy really happened. */
async function copy(tabId, text, message) {
  const [existing] = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (!existing) {
    await chrome.offscreen.createDocument({ url: OFFSCREEN, reasons: ['CLIPBOARD'], justification: 'Copy links from keyboard shortcuts' })
      .catch(error => { if (!String(error).includes('Only a single offscreen')) throw error; });
  }
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'copy', text });
  await toast(tabId, res?.ok ? message : 'Copy failed. Try the popup\'s Copy button');
}
const open = (tab, url) => chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });

const COMMANDS = {
  async 'copy-preview-link'(tab, ctx) {
    const { alwaysAddPreviewParam } = await getSettings();
    await copy(tab.id, previewLink(ctx, alwaysAddPreviewParam), 'Preview link copied');
  },
  'open-theme-editor': (tab, ctx) => open(tab, themeEditorLink(ctx)),
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
  async 'toggle-preview-bar'(tab, ctx) {
    const hidden = await runInTab(tab.id, togglePreviewBar);
    await rememberPreviewBar(ctx.url, hidden);
    if (!hidden) return toast(tab.id, 'Preview bar shown');
    await toast(tab.id, await canPersistPreviewBar(ctx.url)
      ? 'Preview bar hidden on every reload'
      : 'Preview bar hidden. Hide it once from the popup to keep it hidden on reload');
  },
  'copy-debug-info': (tab, ctx) => copy(tab.id, debugInfo(ctx), 'Debug info copied')
};

/** ⌃A: shows the admin key menu (works on storefronts and on admin.shopify.com). */
async function showAdminKeys(tab) {
  const ctx = /^https:\/\/admin\.shopify\.com\//.test(tab.url || '') ? null : await getContext(tab.id);
  const handle = storeHandleFrom(ctx, tab.url);
  if (!handle) return toast(tab.id, 'Open a Shopify store or its admin first');
  await runInTab(tab.id, menu => { window.__sdtAdminKeys = menu; }, [adminKeyMenu(handle, ctx)], 'ISOLATED');
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/admin-keys.js'] });
}

/** The same shortcuts on admin.shopify.com pages. */
async function ADMIN_COMMANDS(command, tab, handle) {
  const themes = `https://admin.shopify.com/store/${handle}/themes`;
  if (command === 'copy-preview-link') return copy(tab.id, tab.url, 'Admin link copied');
  if (command === 'open-theme-editor' || command === 'open-code-editor') return open(tab, themes);
  if (command === 'copy-debug-info') return copy(tab.id, `Store:  ${handle}\nURL:    ${tab.url}\nBrowser: ${navigator.userAgent}`, 'Debug info copied');
  return toast(tab.id, 'Theme Dev Toolkit: open a store page (storefront) for this shortcut');
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  tab ??= await getActiveTab();
  if (!tab?.id) return;
  if (command === 'open-admin') {
    return showAdminKeys(tab).catch(error => {
      console.error('Admin keys failed', error);
      toast(tab.id, `Admin shortcut failed: ${error.message}`);
    });
  }
  if (!COMMANDS[command]) return;
  try {
    // Admin pages have no storefront context; give the shortcuts an admin meaning where one exists.
    const adminHandle = storeHandleFrom(null, tab.url);
    if (adminHandle) return await ADMIN_COMMANDS(command, tab, adminHandle);
    const ctx = await getContext(tab.id);
    if (!ctx) return toast(tab.id, 'Theme Dev Toolkit: this page isn\'t a Shopify store');
    await COMMANDS[command](tab, ctx);
  } catch (error) {
    console.error(`Command ${command} failed`, error);
    await toast(tab.id, `${command} failed: ${error.message}`);
  }
});

// Messages from the section inspector (isolated content script) and popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    // External protocol (vscode://, cursor://) must be opened from a tab update, not window.open.
    openExternal: () => chrome.tabs.update(sender.tab.id, { url: request.url }),
    openTab: () => chrome.tabs.create({ url: request.url, index: sender.tab.index + 1, openerTabId: sender.tab.id }),
    navigate: () => chrome.tabs.update(sender.tab.id, { url: request.url }),
    openOptions: () => request.hash
      ? chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/options.html#${request.hash}`) })
      : chrome.runtime.openOptionsPage(),
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

chrome.runtime.onInstalled.addListener(() => { registerIconRules(); syncPreviewBarScript(); });

// Keep the preview-bar content script in step with the saved stores and granted host access.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.previewBarHiddenOrigins) syncPreviewBarScript();
});
chrome.permissions.onAdded.addListener(syncPreviewBarScript);
chrome.permissions.onRemoved.addListener(syncPreviewBarScript);
