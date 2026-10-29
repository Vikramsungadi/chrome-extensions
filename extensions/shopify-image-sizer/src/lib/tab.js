export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

/** Whether the inspector is open in the tab. False for pages scripts can't run on (chrome://, web store). */
export function inspectorActive(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!document.querySelector('sizer-image-inspector')
  }).then(([res]) => !!res?.result, () => false);
}

/** Toggles the image inspector. Returns true when it is now on. */
export async function toggleInspector(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/measure.js', 'src/inspector.js'] });
  const active = await inspectorActive(tabId);
  await chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#005bd3' });
  return active;
}
