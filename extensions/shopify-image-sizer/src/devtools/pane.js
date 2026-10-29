import { $, el, copy, toast } from '../shared/ui.js';
import { icon } from '../shared/polaris-icons.js';
import { addCapture, getCaptures, onCapturesChanged, pageKey, toText } from '../lib/captures.js';
import { renderGroups } from '../ui/captures.js';

const { inspectedWindow, panels, network } = chrome.devtools;
const state = { measurement: null, file: null, pageUrl: '', captures: [] };

document.querySelectorAll('[data-icon]').forEach(node => node.insertAdjacentHTML('afterbegin', icon(node.dataset.icon)));

const evalInPage = expression => new Promise((resolve, reject) => {
  inspectedWindow.eval(expression, (result, error) => (error ? reject(error) : resolve(result)));
});

// measure.js runs inside the inspected page, wrapped so it leaves no globals behind.
const measureSource = fetch('../measure.js').then(res => res.text());

async function measure() {
  const source = await measureSource;
  const [measurement, pageUrl] = await Promise.all([
    evalInPage(`(() => {\n${source}\nconst found = sizerFind($0);\nreturn found ? sizerMeasure(found) : null;\n})()`).catch(() => null),
    evalInPage('location.href').catch(() => '')
  ]);
  state.measurement = measurement;
  state.pageUrl = pageUrl;
  state.file = undefined;
  renderSelected();
  renderSaved();
  if (measurement?.src) {
    const file = await sizerFileSize(measurement.src);
    if (state.measurement !== measurement) return; // selection moved on
    state.file = file;
    renderSelected();
  }
}

function renderSelected() {
  const m = state.measurement;
  $('#none').hidden = !!m;
  $('#selected').hidden = !m;
  if (!m) return;
  const label = { img: 'Image', background: 'Background image', svg: 'Inline SVG', video: 'Video poster' }[m.kind];
  $('#title').textContent = `${label} · ${m.width} × ${m.height}`;
  $('#file').textContent = m.src ? decodeURIComponent(new URL(m.src).pathname.split('/').pop()) : m.selector;
  $('#file').title = m.src || m.selector;

  $('#scales').replaceChildren(...m.scales.map(s => el('button', {
    className: 'chip', title: `Copy ${s.w}×${s.h}`,
    onclick: () => copy(`${s.w}×${s.h}`, `Copied ${s.label} ${s.w}×${s.h}`)
  }, el('span', { textContent: s.label }), el('b', { textContent: `${s.w}×${s.h}` }))));

  const badge = (text, tone = '') => el('span', { className: `badge ${tone}`, textContent: text });
  const quality = sizerQuality(state.file, m.width);
  $('#meta').replaceChildren(
    badge(m.aspect),
    state.file ? badge(`File ${state.file.w} × ${state.file.h}`) : null,
    quality ? badge(quality.text, quality.tone) : null,
    m.fit && !['fill', 'auto', 'normal'].includes(m.fit) ? badge(m.fit) : null,
    el('span', { className: 'subdued small', textContent: `@ ${m.viewport}px viewport${m.section ? ` · ${m.section.split('__').pop()}` : ''}` })
  );
}

function renderSaved() {
  const here = state.captures.filter(c => pageKey(c.page.url) === pageKey(state.pageUrl));
  $('#saved-head').hidden = !here.length;
  $('#saved-count').textContent = here.length;
  renderGroups($('#groups'), here, { showPage: false });
}

$('#save').addEventListener('submit', async event => {
  event.preventDefault();
  const input = event.target.elements.ref;
  const name = input.value.trim();
  if (!name || !state.measurement) return;
  await addCapture({ ...state.measurement, name, file: state.file ?? null });
  input.value = '';
  toast(`Saved “${name}”`);
});

$('#copy-page').addEventListener('click', () => {
  const here = state.captures.filter(c => pageKey(c.page.url) === pageKey(state.pageUrl));
  copy(toText(here), `Copied ${here.length} references`);
});

$('#refresh').addEventListener('click', measure);

onCapturesChanged(captures => {
  state.captures = captures;
  renderSaved();
});

panels.elements.onSelectionChanged.addListener(measure);
network.onNavigated.addListener(() => setTimeout(measure, 500));

getCaptures().then(captures => {
  state.captures = captures;
  measure();
});
