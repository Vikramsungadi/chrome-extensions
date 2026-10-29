// Settings follow the user (chrome.storage.sync). Shape:
// {
//   enabled: boolean,           // merge new tabs into their slot
//   exact: boolean,             // also merge exact duplicate URLs on non-Shopify sites
//   allWindows: boolean,        // look for the existing tab in every window, not just the new tab's
//   hosts: { [storefrontHost]: storeHandle | '' },  // custom storefront domains (learned or linked)
//   grouping: boolean,          // put matching tabs into Chrome tab groups
//   groupStores: boolean,       // one group per Shopify store
//   groups: [{ name, color, patterns: string[] }],  // custom groups, first match wins
//   storeGroups: { [store]: { title, color } }      // store groups renamed / recoloured in Chrome's tab strip
// }

export const DEFAULT_SETTINGS = { enabled: true, exact: true, allWindows: true, hosts: {}, grouping: true, groupStores: true, groups: [], storeGroups: {} };

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
  return getSettings();
}

/** Records a storefront host. Never overwrites a store the user linked by hand with ''. */
export async function rememberHost(host, store = '') {
  const { hosts } = await getSettings();
  if (host in hosts && (hosts[host] === store || !store)) return;
  await saveSettings({ hosts: { ...hosts, [host]: store } });
}

/** Closes every duplicate, keeping the active / most recently used tab of each slot. Returns the count. */
export async function closeDuplicates(groups) {
  const extra = groups.flatMap(g => g.tabs.slice(1).map(t => t.id));
  if (extra.length) await chrome.tabs.remove(extra);
  return extra.length;
}
