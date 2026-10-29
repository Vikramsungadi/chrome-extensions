// Keeps the preview bar hidden across reloads. The stores where it was hidden are saved in
// chrome.storage.local, and a registered content script re-hides it on every load of those stores.
// Injecting on load needs host access to the store, which the popup requests per store.

const KEY = 'previewBarHiddenOrigins'; // ['https://store.com/*', …]
const SCRIPT_ID = 'hide-preview-bar';

export const originPattern = url => `${new URL(url).origin}/*`;

export const canPersistPreviewBar = url => chrome.permissions.contains({ origins: [originPattern(url)] });

/** Saves whether the preview bar should stay hidden on this store. */
export async function rememberPreviewBar(url, hidden) {
  const pattern = originPattern(url);
  const { [KEY]: origins = [] } = await chrome.storage.local.get(KEY);
  const next = origins.filter(o => o !== pattern);
  if (hidden) next.push(pattern);
  await chrome.storage.local.set({ [KEY]: next });
}

let syncing = Promise.resolve();

/** Registers the content script for saved stores the extension has access to. Runs one at a time. */
export function syncPreviewBarScript() {
  syncing = syncing.then(async () => {
    const { [KEY]: origins = [] } = await chrome.storage.local.get(KEY);
    const matches = [];
    for (const origin of origins) if (await chrome.permissions.contains({ origins: [origin] })) matches.push(origin);
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    if (!matches.length) return;
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID, matches, js: ['src/hide-preview-bar.js'], runAt: 'document_start', persistAcrossSessions: true
    }]);
  }).catch(error => console.error('Preview bar sync failed', error));
  return syncing;
}
