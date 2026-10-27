// Admin key menu. Injected (ISOLATED world) when the admin shortcut fires: shows the letters,
// then the next key picks a destination (⌃A → P = Products, ⇧P = new product).
// Injecting again while it is open means "⌃A twice" → the resource on screen.
// Menu data comes from window.__sdtAdminKeys (see adminKeyMenu in lib/links.js).
(() => {
  const existing = document.querySelector('sdt-admin-keys');
  if (existing) {
    existing.__pick('Enter', false);
    return;
  }

  const menu = window.__sdtAdminKeys;
  if (!menu) return;
  const onAdmin = location.hostname === 'admin.shopify.com';

  const host = document.createElement('sdt-admin-keys');
  const shadow = host.attachShadow({ mode: 'open' });
  const groups = [...new Set(menu.items.map(i => i.group))];
  const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, sans-serif; }
      .scrim { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; background: rgba(0,0,0,.18); }
      .panel {
        width: min(560px, calc(100vw - 32px)); padding: 14px; border-radius: 16px; background: #fff; color: #303030;
        font-size: 13px; line-height: 20px;
        box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 20px 40px -8px rgba(26,26,26,.35);
      }
      header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 10px; }
      header strong { font-weight: 650; font-size: 14px; }
      header span { color: #616161; font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px; }
      .group { grid-column: 1 / -1; padding: 6px 4px 2px; color: #616161; font-size: 12px; font-weight: 550; }
      button {
        all: unset; display: flex; align-items: center; gap: 8px; padding: 4px; border-radius: 8px; cursor: pointer;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      button:hover { background: #f1f1f1; }
      kbd {
        display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 5px; flex: none;
        font: 650 12px/1 inherit; color: #303030; background: #fff; border-radius: 6px;
        box-shadow: 0 -1px 0 0 #b5b5b5 inset, 0 0 0 1px #e3e3e3 inset;
      }
      .resource { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e3e3e3; }
      footer { margin-top: 10px; padding: 0 4px; color: #616161; font-size: 12px; }
    </style>
    <div class="scrim">
      <div class="panel" role="dialog" aria-label="Go to admin">
        <header><strong>Go to admin</strong><span>${esc(menu.handle)}</span></header>
        <div class="grid">
          ${groups.map(g => `<div class="group">${esc(g)}</div>` + menu.items.filter(i => i.group === g).map(i =>
            `<button data-key="${i.key}"><kbd>${i.key.toUpperCase()}</kbd>${esc(i.label)}</button>`).join('')).join('')}
        </div>
        ${menu.resource ? `<div class="resource"><button data-key="Enter"><kbd>↵</kbd>${esc(menu.resource.label)} <span style="color:#616161">(or A)</span></button></div>` : ''}
        <footer>⇧ + letter creates new · Esc closes</footer>
      </div>
    </div>`;
  document.documentElement.appendChild(host);

  const close = () => {
    removeEventListener('keydown', onKey, true);
    host.remove();
  };

  function go(url) {
    close();
    // On admin pages, move within the tab; from a storefront, open next to it.
    chrome.runtime.sendMessage({ action: onAdmin ? 'navigate' : 'openTab', url });
  }

  function pick(key, shift) {
    if (key === 'Escape') return close();
    if ((key === 'Enter' || key === 'a') && menu.resource) return go(menu.resource.url);
    const item = menu.items.find(i => i.key === key);
    if (!item) return false;
    go(shift && item.addUrl ? item.addUrl : item.url);
  }
  host.__pick = pick;

  function onKey(event) {
    // Holding ⌃ through the whole chord (⌃A then ⌃P) works too.
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key) || event.metaKey) return;
    const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key;
    if (pick(key, event.shiftKey) === false) return;
    event.preventDefault();
    event.stopPropagation();
  }

  addEventListener('keydown', onKey, true);
  shadow.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) pick(button.dataset.key, event.shiftKey);
    else if (event.target.classList.contains('scrim')) close();
  });
})();
