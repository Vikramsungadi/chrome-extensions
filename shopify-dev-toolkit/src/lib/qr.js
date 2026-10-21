import qrcode from '../vendor/qrcode.js';

function encode(text) {
  const qr = qrcode(0, 'M'); // auto version, medium error correction
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}

/** Crisp SVG (one path) with a quiet zone of `margin` modules. */
export function qrSvg(text, margin = 1) {
  const qr = encode(text);
  const n = qr.getModuleCount();
  const size = n + margin * 2;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) d += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** PNG blob at roughly `px` pixels square, with an optional caption underneath. */
export async function qrPng(text, px = 512, caption = '') {
  const qr = encode(text);
  const n = qr.getModuleCount();
  const margin = 4;
  const cell = Math.max(1, Math.floor(px / (n + margin * 2)));
  const size = cell * (n + margin * 2);
  const captionHeight = caption ? 48 : 0;
  const canvas = new OffscreenCanvas(size, size + captionHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
    }
  }
  if (caption) {
    ctx.fillStyle = '#303030';
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption, size / 2, size + 28, size - 24);
  }
  return canvas.convertToBlob({ type: 'image/png' });
}
