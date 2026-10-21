// Section inspector. Injected as a classic script into the ISOLATED world;
// injecting it again toggles it off. Context comes from window.__sdtContext.
(() => {
  const existing = document.querySelector('sdt-section-inspector');
  if (existing) {
    existing.__destroy();
    return;
  }

  const ctx = window.__sdtContext;
  if (!ctx) return;

  const ADMIN = `https://admin.shopify.com/store/${ctx.storeHandle}/themes/${ctx.theme.id}`;

  // shopify-section-template--123__hero_licensed -> { key: hero_licensed, ... }
  // The key is only the instance name (renamable in the editor); the real type is resolved via the Admin API.
  function describeSection(el) {
    const raw = el.id.replace(/^shopify-section-/, '');
    const [prefix, key = raw] = raw.split('__');
    const isGroup = prefix.startsWith('sections--');
    // Generated keys end in a random mixed-case suffix; static keys (header, main) do not.
    const parts = key.split('_');
    if (parts.length > 1 && /[A-Z]/.test(parts.at(-1)) && /^[A-Za-z0-9]{4,}$/.test(parts.at(-1))) parts.pop();
    const guess = parts.join('-');
    const blocks = el.querySelectorAll('[data-block-id], [id^="Block-"], [class*="block-"]').length;
    return { id: raw, key, guess, isGroup, blocks, status: 'loading', match: null, error: null };
  }

  const host = document.createElement('sdt-section-inspector');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
      .layer { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
      .box { position: fixed; outline: 2px solid #005bd3; background: rgba(0, 91, 211, .06); transition: all .08s ease-out; pointer-events: none; }
      .bar {
        position: fixed; display: flex; align-items: center; gap: 4px; padding: 4px; pointer-events: all;
        background: #fff; border-radius: 12px; font-size: 12px; line-height: 16px; color: #303030;
        box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 4px 6px -2px rgba(26,26,26,.2), 0 1px 0 0 rgba(204,204,204,.5) inset;
        max-width: calc(100vw - 16px);
      }
      .name { display: flex; flex-direction: column; padding: 2px 8px; min-width: 0; }
      .name strong { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .name small { color: #616161; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .badge { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 8px; background: #e3e3e3; color: #4a4a4a; font-weight: 550; font-size: 11px; }
      button {
        all: unset; cursor: pointer; padding: 4px 8px; border-radius: 8px; font-weight: 550; white-space: nowrap; color: #303030;
        background: #fff; box-shadow: 0 -1px 0 0 #b5b5b5 inset, 0 0 0 1px rgba(0,0,0,.1) inset, 0 .5px 0 1.5px #fff inset;
      }
      button:hover { background: #f7f7f7; }
      button:active { box-shadow: 0 2px 1px 0 rgba(26,26,26,.2) inset; background: #f0f0f0; }
      button.primary { color: #fff; background: #303030; box-shadow: 0 -1px 0 1px rgba(0,0,0,.8) inset, 0 0 0 1px #303030 inset, 0 .5px 0 1.5px rgba(255,255,255,.25) inset; }
      button.primary:hover { background: #1a1a1a; }
      button.icon { padding: 4px 6px; color: #616161; box-shadow: none; }
      button[disabled] { color: #b5b5b5; background: #f7f7f7; box-shadow: none; pointer-events: none; }
      .badge.warn { background: #ffef9d; color: #4f4700; }
      .badge.info { background: #e0f0ff; color: #00527c; }
      .name small a { color: #005bd3; cursor: pointer; text-decoration: underline; }
      .hint { position: fixed; right: 16px; bottom: 16px; background: #303030; color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px; pointer-events: none; opacity: .9; }
    </style>
    <div class="layer">
      <div class="box" hidden></div>
      <div class="bar" hidden>
        <div class="name"><strong></strong><small></small></div>
        <button data-act="code" class="primary" title="Open section file in admin code editor">Code</button>
        <button data-act="local" title="Open section file in local editor">Local</button>
        <button data-act="json" title="Open the template / group JSON at this section (local repo if set, else admin)">JSON</button>
        <button data-act="copy" title="Copy section ID">Copy ID</button>
        <button data-act="lock" class="icon" title="Lock selection (L)">🔓</button>
        <button data-act="close" class="icon" title="Close (Esc)">✕</button>
      </div>
      <div class="hint">Section inspector · ${ctx.sections} sections · <b>L</b> lock · <b>Esc</b> exit</div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = sel => shadow.querySelector(sel);
  const box = $('.box');
  const bar = $('.bar');
  let current = null;
  let info = null;
  let locked = false;
  let raf = 0;

  function position() {
    raf = 0;
    if (!current) return;
    const r = current.getBoundingClientRect();
    Object.assign(box.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
    // Keep the bar inside the section (pinned to its visible top) so reaching it never crosses a neighbour.
    const barTop = Math.min(Math.max(r.top, 0) + 8, Math.max(r.bottom - bar.offsetHeight - 8, 8));
    Object.assign(bar.style, { top: `${barTop}px`, left: `${Math.max(Math.min(r.left + 8, innerWidth - bar.offsetWidth - 8), 8)}px` });
  }
  const schedule = () => { raf ||= requestAnimationFrame(position); };

  const resolved = new Map(); // section id -> resolver response

  function select(el) {
    if (!el || el === current) return;
    current = el;
    info = describeSection(el);
    box.hidden = bar.hidden = false;
    render();
    schedule();
    resolve(info);
  }

  async function resolve(target) {
    let res = resolved.get(target.id);
    if (!res) {
      res = await chrome.runtime.sendMessage({
        action: 'resolveSection', shop: ctx.shop, themeId: ctx.theme.id, sectionId: target.id, pageType: ctx.pageType, country: ctx.country
      }).catch(error => ({ ok: false, code: 'error', error: String(error) }));
      if (res.ok || res.code === 'missing') resolved.set(target.id, res);
    }
    if (target !== info) return; // user moved on
    Object.assign(info, res.ok
      ? { status: 'ok', match: res.matches[0], others: res.matches.slice(1) }
      : { status: 'error', error: res });
    render();
  }

  function render() {
    const name = $('.name strong');
    const sub = $('.name small');
    const m = info.match;
    name.replaceChildren(info.status === 'ok' ? `${m.type}.liquid` : `${info.guess}.liquid`);
    sub.replaceChildren();
    const badge = (text, cls = '') => name.insertAdjacentHTML('beforeend', `<span class="badge ${cls}">${text}</span>`);

    if (info.status === 'loading') {
      badge('resolving…');
      sub.append(info.key);
    } else if (info.status === 'ok') {
      if (info.isGroup) badge('group');
      if (m.context) badge(`market: ${m.context}`, 'info');
      const differs = info.others?.some(o => !o.disabled && o.type !== m.type);
      if (differs) badge('varies by market', 'warn');
      sub.append(`${info.key} · ${m.file || 'static section'}${info.blocks ? ` · ~${info.blocks} blocks` : ''}`);
    } else {
      badge('guess', 'warn');
      const { code, error } = info.error;
      if (code === 'auth' || code === 'api' || code === 'network') {
        const link = Object.assign(document.createElement('a'), { textContent: code === 'auth' ? 'Add Admin API token' : 'Fix in settings' });
        link.onclick = () => chrome.runtime.sendMessage({ action: 'openOptions' });
        sub.append(`${info.key} · ${error} · `, link);
      } else {
        sub.append(`${info.key} · ${error}`);
      }
    }

    const ok = info.status === 'ok';
    $('[data-act="code"]').disabled = !ok;
    $('[data-act="local"]').disabled = !ok;
    $('[data-act="json"]').disabled = !ok || !m.file;
    schedule();
  }

  // Hover intent: only switch after the pointer settles, and never while it is over the bar.
  let pending = 0;
  function onMouseOver(event) {
    clearTimeout(pending);
    if (locked || event.composedPath().includes(host)) return;
    const target = event.target.closest?.('.shopify-section[id^="shopify-section-"]');
    if (!target || target === current) return;
    if (!current) return select(target);
    pending = setTimeout(() => select(target), 150);
  }

  function onKey(event) {
    if (event.key === 'Escape') destroy();
    if (event.key.toLowerCase() === 'l' && !/input|textarea|select/i.test(event.target.tagName)) toggleLock();
  }

  function toggleLock() {
    locked = !locked;
    $('[data-act="lock"]').textContent = locked ? '🔒' : '🔓';
    box.style.outlineStyle = locked ? 'dashed' : 'solid';
  }

  function flash(button, text) {
    const original = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = original), 1200);
  }

  async function repoPath() {
    const { repos = {} } = await chrome.storage.sync.get('repos');
    if (repos[ctx.shop]) return repos[ctx.shop];
    let repo = prompt(`Local repo path for ${ctx.shop}\n(e.g. /Users/you/code/theme). You can change it later in extension settings:`);
    if (!repo) return null;
    repo = repo.trim().replace(/\/$/, '');
    await chrome.storage.sync.set({ repos: { ...repos, [ctx.shop]: repo } });
    return repo;
  }

  async function openLocal(button, file, line = 1) {
    const repo = await repoPath();
    if (!repo) return;
    flash(button, 'Opening…');
    chrome.runtime.sendMessage({ action: 'openInEditor', repo, file, line });
  }

  const openAdmin = file => chrome.runtime.sendMessage({ action: 'openTab', url: `${ADMIN}?key=${encodeURIComponent(file)}` });

  shadow.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || !info) return;
    const m = info.match;
    const sectionFile = m && `sections/${m.type}.liquid`;
    const act = {
      code: () => openAdmin(sectionFile),
      local: () => openLocal(button, sectionFile),
      json: async () => {
        const { repos = {} } = await chrome.storage.sync.get('repos');
        if (repos[ctx.shop]) openLocal(button, m.file, m.line);
        else openAdmin(m.file);
      },
      copy: () => navigator.clipboard.writeText(info.id).then(() => flash(button, 'Copied')),
      lock: toggleLock,
      close: destroy
    }[button.dataset.act];
    act?.();
  });

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('keydown', onKey, true);
  addEventListener('scroll', schedule, { passive: true, capture: true });
  addEventListener('resize', schedule, { passive: true });

  bar.addEventListener('mouseenter', () => clearTimeout(pending));

  function destroy() {
    clearTimeout(pending);
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', schedule, { capture: true });
    removeEventListener('resize', schedule);
    host.remove();
    chrome.runtime.sendMessage({ action: 'inspectorClosed' }).catch(() => {});
  }
  host.__destroy = destroy;
})();
