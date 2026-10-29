// Image measurement, shared by the page inspector (injected as a file before inspector.js) and the
// DevTools pane (fetched as text and evaluated against $0). No extension APIs, and only function
// declarations at top level so it can be injected into the same page more than once.

/** Export scales the team designs for. */
function sizerScales() {
  return [1, 1.5, 2];
}

/** The image an element paints, or null: <img>/<picture>, video poster, inline SVG or a CSS background. */
function sizerSource(el) {
  if (!el || el.nodeType !== 1) return null;
  const tag = el.localName;
  if (tag === 'picture') return sizerSource(el.querySelector('img'));
  if (tag === 'img') return { el, kind: 'img', src: el.currentSrc || el.src };
  if (tag === 'video') return el.poster || el.currentSrc ? { el, kind: 'video', src: el.poster || el.currentSrc } : null;
  if (tag === 'svg' && !el.parentElement?.closest('svg')) return { el, kind: 'svg', src: null };
  if (tag === 'html' || tag === 'body') return null; // page backgrounds would match everywhere
  const bg = getComputedStyle(el).backgroundImage;
  const url = bg && bg !== 'none' && bg.match(/url\(["']?(.*?)["']?\)/);
  return url ? { el, kind: 'background', src: new URL(url[1], document.baseURI).href } : null;
}

/** For DevTools: the selected element itself, else the first image inside it (wrappers are often selected). */
function sizerFind(el) {
  const own = sizerSource(el);
  if (own || !el?.querySelectorAll) return own;
  const visible = found => found && found.el.getBoundingClientRect().width > 0;
  for (const child of el.querySelectorAll('img, video, svg')) {
    const found = sizerSource(child);
    if (visible(found)) return found;
  }
  // Background images: capped so selecting <body> doesn't style-scan the whole page.
  for (const child of [...el.querySelectorAll('*')].slice(0, 500)) {
    const found = sizerSource(child);
    if (visible(found)) return found;
  }
  return null;
}

/** Nearest common ratio (16:9, 4:5…) within 1%, else w/h as "2.35:1". */
function sizerAspect(w, h) {
  if (!w || !h) return '';
  const ratios = [[1, 1], [4, 3], [3, 4], [3, 2], [2, 3], [16, 9], [9, 16], [4, 5], [5, 4], [21, 9], [2, 1], [1, 2], [3, 1]];
  const near = ratios.find(([a, b]) => Math.abs(w / h - a / b) / (a / b) < 0.01);
  return near ? `${near[0]}:${near[1]}` : w >= h ? `${(w / h).toFixed(2)}:1` : `1:${(h / w).toFixed(2)}`;
}

/** Short, human-readable CSS path, anchored on the nearest id (Shopify section ids are stable). */
function sizerSelector(el) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1 && parts.length < 4; node = node.parentElement) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const classes = [...node.classList].filter(c => !/^(is-|js-|lazy|loaded|animate)/.test(c)).slice(0, 2);
    parts.unshift(node.localName + classes.map(c => `.${CSS.escape(c)}`).join(''));
  }
  return parts.join(' > ');
}

/** Measures what `source` (from sizerSource) occupies on screen and the sizes to export for it. */
function sizerMeasure(source) {
  const { el, kind, src } = source;
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const px = name => parseFloat(cs[name]) || 0;
  // Images fill the content box; backgrounds paint the padding box. Borders never hold pixels.
  let width = rect.width - px('borderLeftWidth') - px('borderRightWidth');
  let height = rect.height - px('borderTopWidth') - px('borderBottomWidth');
  if (kind !== 'background') {
    width -= px('paddingLeft') + px('paddingRight');
    height -= px('paddingTop') + px('paddingBottom');
  }
  width = Math.max(0, Math.round(width * 10) / 10);
  height = Math.max(0, Math.round(height * 10) / 10);
  // Round up (ignoring float noise) so an export is never a pixel short.
  const up = n => Math.ceil(n - 0.01);
  const section = el.closest('.shopify-section[id^="shopify-section-"]');
  return {
    kind,
    src: src && !src.startsWith('data:') ? src : null,
    alt: el.getAttribute('alt') || el.getAttribute('aria-label') || '',
    width,
    height,
    aspect: sizerAspect(width, height),
    scales: sizerScales().map(s => ({ label: `${s}x`, w: up(width * s), h: up(height * s) })),
    fit: kind === 'background' ? cs.backgroundSize : cs.objectFit,
    section: section ? section.id.replace(/^shopify-section-/, '') : '',
    selector: sizerSelector(el),
    viewport: innerWidth,
    dpr: devicePixelRatio,
    page: { url: location.href, title: document.title }
  };
}

/**
 * Real pixel size of the loaded file. <img>.naturalWidth is already divided by the srcset density,
 * so the URL is decoded again on its own. Resolves null for inline SVG or a file that fails to load.
 */
function sizerFileSize(src) {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** How the file compares to the rendered width: { tone, text } for a badge. */
function sizerQuality(file, width) {
  if (!file || !width) return null;
  const ratio = file.w / width;
  const x = `${Math.round(ratio * 10) / 10}x`;
  if (ratio < 1) return { tone: 'critical', text: `Upscaled · file ${x}` };
  if (ratio < 2) return { tone: 'attention', text: `Soft on retina · file ${x}` };
  if (ratio > 4) return { tone: 'attention', text: `Oversized · file ${x}` };
  return { tone: 'success', text: `Sharp · file ${x}` };
}
