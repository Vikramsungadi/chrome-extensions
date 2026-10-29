// Image inspector. Injected as a classic script into the ISOLATED world right after measure.js;
// injecting it again toggles it off.
(() => {
  const existing = document.querySelector('sizer-image-inspector');
  if (existing) {
    existing.__destroy();
    return;
  }

  const host = document.createElement('sizer-image-inspector');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
      .layer { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
      .box { position: fixed; outline: 2px solid #005bd3; background: rgba(0, 91, 211, .08); pointer-events: none; }
      .box.locked { outline-style: dashed; }
      .size-tag { position: absolute; right: 0; bottom: 0; padding: 1px 6px; background: #005bd3; color: #fff; font: 600 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; border-radius: 4px 0 0 0; white-space: nowrap; }
      .card {
        position: fixed; width: 300px; padding: 10px; pointer-events: all;
        background: #fff; border-radius: 12px; font-size: 12px; line-height: 16px; color: #303030;
        box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 8px 16px -4px rgba(26,26,26,.24), 0 1px 0 0 rgba(204,204,204,.5) inset;
        display: flex; flex-direction: column; gap: 8px;
      }
      .head { display: flex; align-items: flex-start; gap: 6px; }
      .title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .title strong { font-size: 13px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .title small { color: #616161; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
      .scale { all: unset; cursor: copy; display: flex; flex-direction: column; padding: 6px 8px; border-radius: 8px; background: #f7f7f7; box-shadow: 0 0 0 1px #e3e3e3 inset; }
      .scale:hover { background: #f0f0f0; }
      .scale span { color: #616161; font-size: 11px; font-weight: 550; }
      .scale b { font: 650 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
      .meta { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; color: #616161; font-size: 11px; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 8px; background: #e3e3e3; color: #4a4a4a; font-weight: 550; font-size: 11px; }
      .badge.success { background: #affebf; color: #014b40; }
      .badge.attention { background: #ffef9d; color: #4f4700; }
      .badge.critical { background: #fedad9; color: #8e1f0b; }
      .badge.info { background: #e0f0ff; color: #00527c; }
      .actions { display: flex; gap: 4px; }
      .save { display: flex; gap: 4px; }
      input {
        flex: 1; min-width: 0; height: 28px; padding: 4px 8px; font-size: 12px; color: #303030; background: #fdfdfd;
        border: 1px solid #8a8a8a; border-radius: 8px; outline: none;
      }
      input:focus { outline: 2px solid #005bd3; outline-offset: 1px; }
      button {
        all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        height: 28px; padding: 0 10px; border-radius: 8px; font-weight: 550; white-space: nowrap; color: #303030;
        background: #fff; box-shadow: 0 -1px 0 0 #b5b5b5 inset, 0 0 0 1px rgba(0,0,0,.1) inset, 0 .5px 0 1.5px #fff inset;
      }
      button:hover { background: #f7f7f7; }
      button:active { box-shadow: 0 2px 1px 0 rgba(26,26,26,.2) inset; background: #f0f0f0; }
      button.primary { color: #fff; background: #303030; box-shadow: 0 -1px 0 1px rgba(0,0,0,.8) inset, 0 0 0 1px #303030 inset, 0 .5px 0 1.5px rgba(255,255,255,.25) inset; }
      button.primary:hover { background: #1a1a1a; }
      button.icon { padding: 0 6px; color: #616161; box-shadow: none; }
      button.add { flex: 1; }
      .hint { position: fixed; right: 16px; bottom: 16px; background: #303030; color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px; pointer-events: none; opacity: .92; }
      [hidden] { display: none !important; }
    </style>
    <div class="layer">
      <div class="box" hidden><span class="size-tag"></span></div>
      <div class="card" hidden>
        <div class="head">
          <div class="title"><strong></strong><small></small></div>
          <button data-act="lock" class="icon" title="Lock selection (click the image)">🔓</button>
          <button data-act="close" class="icon" title="Close (Esc)">✕</button>
        </div>
        <div class="grid"></div>
        <div class="meta"></div>
        <div class="actions">
          <button data-act="add" class="add primary" title="Save with a reference name (+)">＋ Add reference</button>
          <button data-act="copy" title="Copy sizes as text">Copy</button>
        </div>
        <form class="save" hidden>
          <input name="ref" placeholder="Reference name, e.g. Hero banner – desktop" autocomplete="off" maxlength="120">
          <button class="primary" type="submit">Save</button>
        </form>
      </div>
      <div class="hint">Image sizer · <b>click</b> lock · <b>+</b> add · <b>Esc</b> exit<span class="count"></span></div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = sel => shadow.querySelector(sel);
  const box = $('.box');
  const card = $('.card');
  const form = $('.save');
  const input = form.elements.ref;
  let current = null; // { source, m, file }
  let locked = false;
  let captures = [];
  let raf = 0;

  const fileSizes = new Map(); // src -> Promise<{ w, h } | null>
  const fileSize = src => {
    if (!fileSizes.has(src)) fileSizes.set(src, sizerFileSize(src));
    return fileSizes.get(src);
  };

  const dims = ({ w, h }) => `${w} × ${h}`;
  const pageKey = url => { const u = new URL(url); return u.origin + u.pathname.replace(/\/$/, ''); };
  const savedFor = m => captures.filter(c => pageKey(c.page.url) === pageKey(m.page.url) && c.selector === m.selector && c.src === m.src);

  chrome.storage.local.get('captures').then(({ captures: list = [] }) => { captures = list; renderCount(); });
  const onStorage = (changes, area) => {
    if (area !== 'local' || !changes.captures) return;
    captures = changes.captures.newValue || [];
    renderCount();
    if (current) render();
  };
  chrome.storage.onChanged.addListener(onStorage);

  function renderCount() {
    const here = captures.filter(c => pageKey(c.page.url) === pageKey(location.href)).length;
    $('.count').textContent = here ? ` · ${here} saved here` : '';
  }

  function position() {
    raf = 0;
    if (!current) return;
    const r = current.source.el.getBoundingClientRect();
    Object.assign(box.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
    // Below the image if it fits, else above, else pinned to the viewport bottom.
    const h = card.offsetHeight;
    const w = card.offsetWidth;
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = r.top - h - 8 >= 8 ? r.top - h - 8 : innerHeight - h - 8;
    const left = Math.max(Math.min(r.left, innerWidth - w - 8), 8);
    Object.assign(card.style, { top: `${Math.max(top, 8)}px`, left: `${left}px` });
  }
  const schedule = () => { raf ||= requestAnimationFrame(position); };

  function select(source) {
    if (current?.source.el === source.el) return;
    const m = sizerMeasure(source);
    current = { source, m, file: undefined };
    hideForm();
    box.hidden = card.hidden = false;
    render();
    const target = current;
    fileSize(m.src).then(file => {
      if (target !== current) return;
      current.file = file;
      render();
    });
  }

  // Re-measure on scroll/resize so a locked image follows layout changes (responsive breakpoints).
  function remeasure() {
    if (!current) return;
    current.m = sizerMeasure(current.source);
    render();
  }

  function render() {
    const { m, file } = current;
    const label = { img: 'Image', background: 'Background image', svg: 'Inline SVG', video: 'Video poster' }[m.kind];
    const saved = savedFor(m);
    $('.title strong').textContent = saved.length ? saved.map(c => c.name).join(', ') : `${label} · ${m.width} × ${m.height}`;
    $('.title small').textContent = m.src ? decodeURIComponent(new URL(m.src).pathname.split('/').pop()) : m.alt || m.selector;
    $('.title small').title = m.src || m.selector;
    $('.size-tag').textContent = `${m.width} × ${m.height}`;

    $('.grid').replaceChildren(...m.scales.map(s => {
      const cell = document.createElement('button');
      cell.className = 'scale';
      cell.title = `Copy ${s.w}×${s.h}`;
      cell.dataset.copy = `${s.w}×${s.h}`;
      cell.innerHTML = `<span>${s.label}</span><b>${dims(s)}</b>`;
      return cell;
    }));

    const meta = $('.meta');
    meta.replaceChildren();
    const badge = (text, tone = '') => meta.append(Object.assign(document.createElement('span'), { className: `badge ${tone}`, textContent: text }));
    if (saved.length) badge('Saved', 'info');
    badge(m.aspect);
    if (file) badge(`File ${file.w} × ${file.h}`);
    const quality = sizerQuality(file, m.width);
    if (quality) badge(quality.text, quality.tone);
    if (m.fit && !['fill', 'auto', 'normal'].includes(m.fit)) badge(m.fit);
    meta.append(`@ ${m.viewport}px viewport${m.section ? ` · ${m.section.split('__').pop()}` : ''}`);
    schedule();
  }

  function showForm() {
    if (!current) return;
    lock(true);
    $('.actions').hidden = true;
    form.hidden = false;
    input.value = '';
    input.focus();
    schedule();
  }

  function hideForm() {
    form.hidden = true;
    $('.actions').hidden = false;
    schedule();
  }

  function lock(on) {
    locked = on;
    $('[data-act="lock"]').textContent = locked ? '🔒' : '🔓';
    box.classList.toggle('locked', locked);
  }

  // Remembers the real label so overlapping flashes never restore another flash's text.
  function flash(button, text) {
    button.dataset.label ??= button.textContent;
    button.textContent = text;
    clearTimeout(button.flashTimer);
    button.flashTimer = setTimeout(() => (button.textContent = button.dataset.label), 1200);
  }

  const copy = (button, text) => navigator.clipboard.writeText(text).then(() => flash(button, 'Copied'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name || !current) return input.focus();
    const res = await chrome.runtime.sendMessage({ action: 'saveCapture', capture: { ...current.m, name, file: current.file ?? null } })
      .catch(error => ({ ok: false, error: String(error) }));
    hideForm();
    flash($('[data-act="add"]'), res.ok ? `Saved “${name}”` : 'Save failed');
  });

  // Typing in the name field must not reach the store's own shortcuts.
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') hideForm();
  });

  shadow.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !current) return;
    if (button.dataset.copy) return copy(button.querySelector('b'), button.dataset.copy);
    const { m } = current;
    const act = {
      add: showForm,
      copy: () => copy(button, `${m.width}×${m.height} px (${m.aspect}) @ ${m.viewport}px — ${m.scales.map(s => `${s.label} ${s.w}×${s.h}`).join(' · ')}`),
      lock: () => lock(!locked),
      close: destroy
    }[button.dataset.act];
    act?.();
  });

  // Topmost image under the pointer; elementsFromPoint sees through transparent overlays and links.
  function sourceAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === host) continue;
      const source = sizerSource(el);
      if (source) return source;
    }
    return null;
  }

  let pending = 0;
  let lastMove = null;
  function onMouseMove(event) {
    if (locked || event.composedPath().includes(host)) return clearTimeout(pending);
    lastMove = event;
    // Hover intent: wait for the pointer to settle so reaching the card never re-targets.
    clearTimeout(pending);
    pending = setTimeout(() => {
      const source = sourceAt(lastMove.clientX, lastMove.clientY);
      if (source) select(source);
    }, current ? 120 : 0);
  }

  // While inspecting, page clicks select instead of following links or opening sliders.
  function onClick(event) {
    if (event.composedPath().includes(host)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type !== 'click') return;
    clearTimeout(pending);
    const source = sourceAt(event.clientX, event.clientY);
    if (!source) return lock(false);
    if (locked && current?.source.el === source.el) return lock(false);
    lock(false);
    select(source);
    lock(true);
  }

  function onKey(event) {
    if (event.composedPath().includes(input)) return;
    if (event.key === 'Escape') return destroy();
    if ((event.key === '+' || event.key === '=') && !/input|textarea|select/i.test(event.target.tagName)) {
      event.preventDefault();
      showForm();
    }
  }

  const blocked = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick'];
  document.addEventListener('mousemove', onMouseMove, true);
  blocked.forEach(type => document.addEventListener(type, onClick, true));
  document.addEventListener('keydown', onKey, true);
  addEventListener('scroll', schedule, { passive: true, capture: true });
  addEventListener('resize', remeasure, { passive: true });

  function destroy() {
    clearTimeout(pending);
    document.removeEventListener('mousemove', onMouseMove, true);
    blocked.forEach(type => document.removeEventListener(type, onClick, true));
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', schedule, { capture: true });
    removeEventListener('resize', remeasure);
    chrome.storage.onChanged.removeListener(onStorage);
    host.remove();
    chrome.runtime.sendMessage({ action: 'inspectorClosed' }).catch(() => {});
  }
  host.__destroy = destroy;
})();
