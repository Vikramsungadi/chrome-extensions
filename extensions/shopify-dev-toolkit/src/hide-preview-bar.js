// Registered content script: re-hides the preview bar on stores where it was hidden.
// Same <style> as togglePreviewBar in lib/page.js, so the toggle can show it again.
if (!document.getElementById('__sdt-hide-preview-bar')) {
  const style = document.createElement('style');
  style.id = '__sdt-hide-preview-bar';
  style.textContent = '#preview-bar-iframe,#PBarNextFrameWrapper,#PBarNextFrame,#preview-bar-container{display:none!important}';
  document.documentElement.appendChild(style);
}
