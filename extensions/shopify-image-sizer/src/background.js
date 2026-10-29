import { addCapture } from './lib/captures.js';
import { toggleInspector } from './lib/tab.js';

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-inspector' || !tab?.id) return;
  await toggleInspector(tab.id).catch(error => console.warn('Cannot inspect this tab', error));
});

// Messages from the page inspector (isolated content script).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    saveCapture: async () => ({ ok: true, capture: await addCapture(request.capture) }),
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
