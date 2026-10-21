import { probePage, setInspectorContext } from './page.js';

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

/** Runs a self-contained function in the tab and returns its result. */
export async function runInTab(tabId, func, args = [], world = 'MAIN') {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args, world });
  return res?.result;
}

/** Storefront context for the tab, or null when it is not a Shopify storefront. */
export async function getContext(tabId) {
  try {
    return await runInTab(tabId, probePage);
  } catch {
    return null; // chrome:// pages, web store, etc.
  }
}

/** Toggles the section inspector. Returns true when it is now on. */
export async function toggleInspector(tabId, ctx) {
  await runInTab(tabId, setInspectorContext, [ctx], 'ISOLATED');
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/inspector.js'] });
  const active = await runInTab(tabId, () => !!document.querySelector('sdt-section-inspector'), [], 'ISOLATED');
  await chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#008060' });
  return active;
}
