// Generates the PWA / home-screen icons as PNG files with no dependencies:
// draws a 32x32 pixel-art icon in memory, upscales it (nearest neighbour) and
// encodes PNGs by hand (zlib from node core + a CRC32 table).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- pixel art (32x32) ---------------------------------------------------------------
const S = 32;
const px = new Array(S * S).fill(null);
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) px[y * S + x] = c; };
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
const disc = (cx, cy, r, c) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) set(x, y, c); } };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// background: rounded square, green hills, warm sky
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const corner = (x < 3 && y < 3) || (x > S - 4 && y < 3) || (x < 3 && y > S - 4) || (x > S - 4 && y > S - 4);
  const inCorner = corner && ((Math.min(x, S - 1 - x) === 0 && Math.min(y, S - 1 - y) <= 1) || (Math.min(y, S - 1 - y) === 0 && Math.min(x, S - 1 - x) <= 1));
  if (inCorner) continue; // transparent corner pixels (masked by iOS anyway)
  const t = y / S;
  set(x, y, t < 0.5 ? (t < 0.25 ? '#f6c66a' : '#f2a35a') : '#3f8a4a');
}
// hills
for (let x = 0; x < S; x++) { const h = 15 + Math.round(3 * Math.sin(x / 5)); rect(x, h, 1, S - h, '#3f8a4a'); const h2 = 19 + Math.round(2 * Math.sin(x / 3 + 1)); rect(x, h2, 1, S - h2, '#2f6e3a'); }
// sun
disc(24.5, 7.5, 3.6, '#fff1a8');
// cup
rect(9, 16, 14, 10, '#fbf5e6'); rect(9, 25, 14, 2, '#d8c8a8'); rect(23, 18, 3, 5, '#fbf5e6'); rect(24, 19, 1, 3, '#3f8a4a');
rect(10, 17, 12, 3, '#4a2a1a'); rect(10, 17, 12, 1, '#6a4a2a');
// saucer
rect(7, 27, 18, 2, '#e8d8b8');
// steam
for (const [x, y] of [[13, 13], [13, 12], [14, 11], [14, 10], [18, 13], [18, 12], [17, 11], [17, 10], [16, 9]]) set(x, y, 'rgba(255,255,255,0.85)');
// coffee cherries
disc(6.5, 24.5, 1.6, '#d42a2a'); disc(4.5, 22.5, 1.4, '#ef4040'); set(5, 21, '#4a9a3a'); set(6, 20, '#4a9a3a');

// ---- PNG encoder -----------------------------------------------------------------------
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size) {
  const scale = size / S;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const c = px[Math.floor(y / scale) * S + Math.floor(x / scale)];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (!c) { raw[o + 3] = 0; continue; }
      let rgb, a = 255;
      if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); rgb = m.slice(0, 3); a = Math.round(m[3] * 255); } else rgb = hex(c);
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of [32, 180, 192, 512]) { const out = join(root, 'icons', `icon-${size}.png`); writeFileSync(out, encodePNG(size)); console.log('wrote', out); }
