// Saved measurements ("captures") live in chrome.storage.local under `captures`, newest last.
// Shape: measurement from sizerMeasure() plus
//   { id, name, createdAt, file: { w, h } | null }

const KEY = 'captures';

export async function getCaptures() {
  const { [KEY]: captures = [] } = await chrome.storage.local.get(KEY);
  return captures;
}

async function write(captures) {
  await chrome.storage.local.set({ [KEY]: captures });
  return captures;
}

export async function addCapture(capture) {
  const saved = { ...capture, id: crypto.randomUUID(), name: capture.name.trim(), createdAt: Date.now() };
  await write([...(await getCaptures()), saved]);
  return saved;
}

export async function updateCapture(id, patch) {
  return write((await getCaptures()).map(c => (c.id === id ? { ...c, ...patch } : c)));
}

export async function removeCaptures(ids) {
  const drop = new Set(ids);
  return write((await getCaptures()).filter(c => !drop.has(c.id)));
}

export function onCapturesChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) callback(changes[KEY].newValue || []);
  });
}

/** Captures of the same page share a key; query strings (preview_theme_id, variant…) are ignored. */
export function pageKey(url) {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function groupByPage(captures) {
  const groups = new Map();
  for (const c of captures) {
    const key = pageKey(c.page.url);
    if (!groups.has(key)) groups.set(key, { key, title: c.page.title, url: c.page.url, items: [] });
    groups.get(key).items.push(c);
  }
  return [...groups.values()];
}

const dims = ({ w, h }) => `${w}×${h}`;
export const scaleLine = c => c.scales.map(s => `${s.label} ${dims(s)}`).join(' · ');

/** Plain text for Slack / Jira / chat. */
export function toText(captures) {
  return groupByPage(captures).map(group => {
    const lines = [`*${group.title || group.key}*`, group.key];
    for (const c of group.items) {
      lines.push(`• ${c.name} — ${c.width}×${c.height} px (${c.aspect}) @ ${c.viewport}px viewport`);
      lines.push(`   ${scaleLine(c)}`);
      const extra = [c.file && `current file ${dims(c.file)}`, c.section && `section ${c.section.split('__').pop()}`].filter(Boolean);
      if (extra.length) lines.push(`   ${extra.join(' · ')}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

const CSV_COLUMNS = [
  ['Reference', c => c.name],
  ['Page', c => c.page.title],
  ['URL', c => c.page.url],
  ['Viewport (px)', c => c.viewport],
  ['Rendered W', c => c.width],
  ['Rendered H', c => c.height],
  ['Aspect', c => c.aspect],
  ...['1x', '1.5x', '2x'].map(label => [label, c => { const s = c.scales.find(x => x.label === label); return s && dims(s); }]),
  ['Current file', c => (c.file ? dims(c.file) : '')],
  ['Type', c => c.kind],
  ['Section', c => c.section],
  ['Selector', c => c.selector],
  ['Image URL', c => c.src || '']
];

/** CSV for Google Sheets / Excel. */
export function toCSV(captures) {
  const header = CSV_COLUMNS.map(([name]) => name);
  const cell = value => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...captures.map(c => CSV_COLUMNS.map(([, get]) => get(c)))]
    .map(row => row.map(cell).join(','))
    .join('\n');
}
