import { groupTabs, learnFromRedirect, slotFor } from './lib/slots.js';
import { colorFor, groupFor } from './lib/groups.js';
import { closeDuplicates, getSettings, rememberHost, saveSettings } from './lib/settings.js';

// Tabs that have not committed their first http(s) page yet. Only these are merged, so navigating
// inside a tab you already use is never hijacked. Mirrored to storage.session because the
// service worker can sleep between a tab's creation and its first navigation.
const fresh = new Set();
const keepSeparate = new Set(); // tab ids opened via "Open link in new tab (keep separate)"
let pendingSeparate = [];       // URLs about to be opened that way (tab id not known yet)
const lastUrl = new Map();      // tab id -> URL of its latest top-frame navigation (for redirect learning)
const ownGroups = new Map();    // Chrome tab group id -> groupFor() key ("store:redwolf", "rule:GA") for groups TabEase created

const restored = chrome.storage.session.get(['fresh', 'keepSeparate', 'ownGroups']).then(s => {
  (s.fresh || []).forEach(id => fresh.add(id));
  (s.keepSeparate || []).forEach(id => keepSeparate.add(id));
  (s.ownGroups || []).forEach(entry => Array.isArray(entry) && ownGroups.set(...entry));
});
const persist = () => chrome.storage.session.set({ fresh: [...fresh], keepSeparate: [...keepSeparate], ownGroups: [...ownGroups] });

chrome.tabs.onCreated.addListener(tab => {
  fresh.add(tab.id);
  persist();
});

chrome.tabs.onRemoved.addListener(tabId => {
  fresh.delete(tabId);
  keepSeparate.delete(tabId);
  lastUrl.delete(tabId);
  persist();
  scheduleBadge();
});

chrome.webNavigation.onBeforeNavigate.addListener(async details => {
  if (details.frameId !== 0) return;
  await restored;
  const { tabId, url } = details;
  lastUrl.set(tabId, url);
  const separate = pendingSeparate.indexOf(url);
  if (separate !== -1) {
    pendingSeparate.splice(separate, 1);
    keepSeparate.add(tabId);
    fresh.delete(tabId);
    return persist();
  }
  if (!fresh.has(tabId) || keepSeparate.has(tabId)) return;
  const settings = await getSettings();
  if (!settings.enabled) return;
  const target = slotFor(url, settings);
  if (!target) return;

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.incognito) return;
  const candidates = await chrome.tabs.query(settings.allWindows ? { windowType: 'normal' } : { windowId: tab.windowId });
  const existing = groupTabs(candidates.filter(t => t.id !== tabId && !keepSeparate.has(t.id) && t.incognito === tab.incognito), settings)
    .find(g => g.key === target.key)?.tabs[0];
  if (!existing) return;

  // Replace: the existing tab takes the new URL (unless it is already there) and the new tab goes away.
  fresh.delete(tabId);
  persist();
  const same = (existing.url || '').split('#')[0] === url.split('#')[0];
  // A background-opened tab (⌘-click) updates its slot quietly; a foreground one brings it forward.
  await chrome.tabs.update(existing.id, { ...(same ? {} : { url }), ...(tab.active ? { active: true } : {}) });
  if (tab.active) await chrome.windows.update(existing.windowId, { focused: true });
  await chrome.tabs.remove(tabId).catch(() => {});
  flashBadge(existing.id);
});

chrome.webNavigation.onCommitted.addListener(async details => {
  if (details.frameId !== 0) return;
  const { tabId, url, transitionQualifiers = [] } = details;
  const previous = lastUrl.get(tabId);
  lastUrl.set(tabId, url);
  if (/^https?:/.test(url) && fresh.delete(tabId)) persist();

  // Learn custom storefront domains: myshopify preview link → server-redirected to vahro.com.
  if (previous && transitionQualifiers.some(q => q.endsWith('redirect'))) {
    const learned = learnFromRedirect(previous, url);
    if (learned) await rememberHost(learned.host, learned.store);
  }
  const u = new URL(url);
  if (u.searchParams.has('preview_theme_id')) await rememberHost(u.hostname);
});

// ---------- "keep separate" escape hatch ----------
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'open-separate', title: 'Open link in new tab (keep separate)', contexts: ['link'] });
  updateBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'open-separate') return;
  pendingSeparate.push(info.linkUrl);
  await chrome.tabs.create({ url: info.linkUrl, index: tab.index + 1, openerTabId: tab.id, active: false });
});

// ---------- toolbar badge: number of duplicate tabs ----------
let badgeTimer = 0;
function scheduleBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 400);
}

async function updateBadge() {
  const settings = await getSettings();
  const groups = groupTabs(await chrome.tabs.query({ windowType: 'normal' }), settings);
  const dupes = groups.reduce((n, g) => n + g.tabs.length - 1, 0);
  await chrome.action.setBadgeBackgroundColor({ color: '#c70a24' });
  await chrome.action.setBadgeText({ text: !settings.enabled ? 'off' : dupes ? String(dupes) : '' });
  if (!settings.enabled) await chrome.action.setBadgeBackgroundColor({ color: '#8a8a8a' });
}

// Brief "↺" on the tab that absorbed a new one, so the merge is noticeable.
async function flashBadge(tabId) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#005bd3' });
  await chrome.action.setBadgeText({ tabId, text: '↺' });
  setTimeout(async () => {
    // null text drops the tab override so the global duplicate count shows again.
    await chrome.action.setBadgeText({ tabId, text: null }).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#c70a24' }).catch(() => {});
  }, 1500);
}

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (!change.url) return;
  scheduleBadge();
  queueGroup(tab, await getSettings());
});
chrome.storage.onChanged.addListener((changes, area) => {
  scheduleBadge();
  if (area === 'sync' && ['grouping', 'groupStores', 'groups', 'storeGroups', 'hosts'].some(k => k in changes)) groupAll();
});
chrome.runtime.onStartup.addListener(updateBadge);

// ---------- Chrome tab groups: one per store, plus custom URL rules ----------
// Work is chained per window so two tabs opening at once never create two groups with the same name.
const groupQueues = new Map();

function queueGroup(tab, settings) {
  const run = (groupQueues.get(tab.windowId) || Promise.resolve()).then(() => applyGroup(tab.id, settings)).catch(() => {});
  groupQueues.set(tab.windowId, run);
  return run;
}

// A group is TabEase's when it created it or it carries a rule's or saved store group's name. Groups you made stay untouched.
const isOurs = (group, settings) => ownGroups.has(group.id)
  || settings.groups.some(r => r.name?.trim() === group.title)
  || Object.values(settings.storeGroups).some(g => g.title === group.title);

async function applyGroup(tabId, settings) {
  if (!settings.grouping) return;
  await restored;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.pinned || tab.incognito) return;
  const target = groupFor(tab.url || tab.pendingUrl || '', settings);
  const current = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? null : await chrome.tabGroups.get(tab.groupId).catch(() => null);
  if (current && !isOurs(current, settings)) return;
  if (!target) {
    if (current) await chrome.tabs.ungroup(tab.id);
    return;
  }
  if (current?.title === target.title) {
    if (current.color !== target.color) await chrome.tabGroups.update(current.id, { color: target.color });
    return;
  }
  const [existing] = await chrome.tabGroups.query({ windowId: tab.windowId, title: target.title });
  if (existing) {
    await chrome.tabs.group({ groupId: existing.id, tabIds: tab.id });
    if (!ownGroups.has(existing.id)) {
      ownGroups.set(existing.id, target.key);
      persist();
    }
    return;
  }
  const groupId = await chrome.tabs.group({ tabIds: tab.id, createProperties: { windowId: tab.windowId } });
  await chrome.tabGroups.update(groupId, { title: target.title, color: target.color, collapsed: false });
  // Registered only once named, so the blank grey group Chrome creates first is never saved as your edit.
  ownGroups.set(groupId, target.key);
  persist();
}

async function groupAll() {
  const settings = await getSettings();
  if (!settings.grouping) return;
  const tabs = await chrome.tabs.query({ windowType: 'normal' });
  await Promise.all(tabs.map(tab => queueGroup(tab, settings)));
}

// You renamed or recoloured a TabEase group in the tab strip: remember it, so it comes back that way.
chrome.tabGroups.onUpdated.addListener(async group => {
  await restored;
  const key = ownGroups.get(group.id);
  if (!key || !group.title) return;
  const settings = await getSettings();
  const id = key.slice(key.indexOf(':') + 1);
  if (key.startsWith('store:')) {
    const saved = settings.storeGroups[id] || {};
    if ((saved.title || id) === group.title && (saved.color || colorFor(id)) === group.color) return;
    await saveSettings({ storeGroups: { ...settings.storeGroups, [id]: { title: group.title, color: group.color } } });
    return;
  }
  const rule = settings.groups.find(r => r.name?.trim() === id);
  if (!rule || (id === group.title && (rule.color || colorFor(id)) === group.color)) return;
  ownGroups.set(group.id, `rule:${group.title}`);
  persist();
  await saveSettings({ groups: settings.groups.map(r => (r === rule ? { ...r, name: group.title, color: group.color } : r)) });
});

chrome.tabGroups.onRemoved.addListener(group => {
  if (ownGroups.delete(group.id)) persist();
});

// Popup / shortcut: close all duplicates.
async function cleanUp() {
  const settings = await getSettings();
  const closed = await closeDuplicates(groupTabs(await chrome.tabs.query({ windowType: 'normal' }), settings));
  scheduleBadge();
  return closed;
}

chrome.commands.onCommand.addListener(command => {
  if (command === 'close-duplicates') cleanUp();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'closeDuplicates') return false;
  cleanUp().then(closed => sendResponse({ ok: true, closed }), error => sendResponse({ ok: false, error: String(error) }));
  return true;
});
