// DOM helpers for extension pages built on polaris.css. Mounted at src/shared/ by build.sh.

export const $ = sel => document.querySelector(sel);

export function el(tag, props = {}, ...children) {
  const { html, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (html) node.innerHTML = html;
  node.append(...children.filter(c => c != null && c !== false));
  return node;
}

/** Shows a Polaris toast in the page's `#toast` element. */
let toastTimer;
export function toast(message, isError = false) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

export async function copy(text, message = 'Copied') {
  await navigator.clipboard.writeText(text);
  toast(message);
}

/** Starts a download of `text` as a file. */
export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  el('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
