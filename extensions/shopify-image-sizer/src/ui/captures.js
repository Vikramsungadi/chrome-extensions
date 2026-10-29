// Saved-reference list, shared by the popup and the DevTools pane.
import { el, copy, toast } from '../shared/ui.js';
import { icon } from '../shared/polaris-icons.js';
import { groupByPage, removeCaptures, toText, updateCapture } from '../lib/captures.js';

function iconButton(name, title, onClick) {
  return el('button', {
    className: 'icon-btn', title, ariaLabel: title, html: icon(name),
    onclick: event => { event.stopPropagation(); onClick(); }
  });
}

/** Click-to-rename reference name. */
function nameButton(capture) {
  const button = el('button', { className: 'name truncate', textContent: capture.name, title: 'Rename' });
  button.onclick = () => {
    const input = el('input', { className: 'field sm', value: capture.name, maxLength: 120 });
    const done = async save => {
      const name = input.value.trim();
      if (save && name && name !== capture.name) await updateCapture(capture.id, { name });
      else input.replaceWith(button); // a save re-renders the list instead
    };
    input.onkeydown = event => {
      if (event.key === 'Enter') done(true);
      if (event.key === 'Escape') { event.preventDefault(); done(false); }
    };
    input.onblur = () => done(true);
    button.replaceWith(input);
    input.select();
  };
  return button;
}

function captureRow(c) {
  const sub = [`${c.width} × ${c.height}`, c.aspect, `@ ${c.viewport}px`, c.file && `file ${c.file.w}×${c.file.h}`].filter(Boolean).join(' · ');
  return el('li', { className: 'capture' },
    el('div', { className: 'capture-head' },
      nameButton(c),
      el('span', { className: 'row-actions' },
        iconButton('copy', 'Copy', () => copy(toText([c]), `Copied “${c.name}”`)),
        iconButton('delete', 'Delete', async () => { await removeCaptures([c.id]); toast(`Deleted “${c.name}”`); })
      )
    ),
    el('p', { className: 'subdued small truncate', textContent: sub, title: c.src || c.selector }),
    el('div', { className: 'chips' }, ...c.scales.map(s => el('button', {
      className: 'chip', title: `Copy ${s.w}×${s.h}`,
      onclick: () => copy(`${s.w}×${s.h}`, `Copied ${s.label} ${s.w}×${s.h}`)
    }, el('span', { textContent: s.label }), el('b', { textContent: `${s.w}×${s.h}` }))))
  );
}

/** One card per page. `showPage` false hides the page header (single-page views). */
export function renderGroups(container, captures, { showPage = true } = {}) {
  container.replaceChildren(...groupByPage(captures).map(group => el('div', { className: 'card flush' },
    showPage ? el('div', { className: 'group-head' },
      el('div', { className: 'grow' },
        el('p', { className: 'heading-sm truncate', textContent: group.title || group.key }),
        el('a', { className: 'small truncate', href: group.url, target: '_blank', textContent: group.key.replace(/^https?:\/\//, '') })
      ),
      iconButton('copy', 'Copy this page', () => copy(toText(group.items), `Copied ${group.items.length} from this page`))
    ) : null,
    el('ul', { className: 'list captures' }, ...group.items.map(captureRow))
  )));
}
