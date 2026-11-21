// Draws the app icons as PNG files (no image libraries needed).
// Usage: node scripts/make-icons.mjs   → writes apps/web/public/icons/*.png
// The robot matches components/Logo.astro: cardboard-brown tile, cream robot head.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x8a, 0x4b, 0x14]; // --color-accent (light mode)
const FG = [0xff, 0xfa, 0xf2]; // --color-bg (light mode)

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Robot drawn on a 32-unit grid (same geometry as Logo.astro), as a coverage test per point.
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inRoundedRectOutline(px, py, x, y, w, h, r, half) {
  // distance from point to the rounded rectangle's outline
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const insideCore = px > x + r && px < x + w - r && py > y + r && py < y + h - r;
  if (insideCore) {
    const d = Math.min(px - x, x + w - px, py - y, y + h - py);
    return d <= half;
  }
  return Math.abs(Math.hypot(px - cx, py - cy) - r) <= half;
}

function robot(u, v) {
  const s = 1.25; // half stroke width
  const lines = [
    [16, 3, 16, 8],
    [12, 21, 20, 21],
    [9, 25, 9, 29],
    [23, 25, 23, 29]
  ];
  if (lines.some(([a, b, c, d]) => distToSegment(u, v, a, b, c, d) <= s)) return true;
  if (inRoundedRectOutline(u, v, 5, 8, 22, 17, 4, s)) return true;
  if (Math.hypot(u - 16, v - 3) <= 1.5 + s) return true;
  if (Math.hypot(u - 12, v - 16) <= 2) return true;
  if (Math.hypot(u - 20, v - 16) <= 2) return true;
  return false;
}

/** scale: how much of the tile the 32-unit robot fills (maskable icons need a safe zone). */
function icon(size, scale) {
  const unit = (size * scale) / 32;
  const offset = (size - 32 * unit) / 2;
  return png(size, (x, y) => (robot((x - offset) / unit, (y - offset) / unit) ? FG : BG));
}

const out = new URL('../apps/web/public/icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), icon(192, 0.8));
writeFileSync(new URL('icon-512.png', out), icon(512, 0.8));
writeFileSync(new URL('icon-maskable-512.png', out), icon(512, 0.6));
writeFileSync(new URL('apple-touch-icon.png', out), icon(180, 0.75));
console.log('Icons written to apps/web/public/icons/');
