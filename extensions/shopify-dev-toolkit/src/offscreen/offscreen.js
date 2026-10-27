// Hidden page that writes to the clipboard for keyboard shortcuts.
// A web page may only write to the clipboard right after the user interacts with it, which an
// extension shortcut doesn't count as, so copies run here instead (Chrome's documented pattern).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen' || request.action !== 'copy') return false;
  const clip = document.getElementById('clip');
  clip.value = request.text;
  clip.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  clip.value = '';
  sendResponse({ ok });
  return false;
});
