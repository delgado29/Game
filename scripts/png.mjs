// Minimal dependency-free PNG encoder used by the per-game icon generators.
// encodePNG(pixels, srcSize, outSize): pixels is an array of srcSize*srcSize
// CSS colour strings (hex '#rrggbb' or 'rgba(r,g,b,a)') or null for transparent.
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function encodePNG(px, S, size) {
  const scale = size / S;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = px[Math.floor(y / scale) * S + Math.floor(x / scale)];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (!c) { raw[o + 3] = 0; continue; }
      let rgb, a = 255;
      if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); rgb = m.slice(0, 3); a = Math.round(m[3] * 255); } else rgb = hex(c);
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Tiny pixel canvas helpers shared by icon scripts.
export function pixelCanvas(S) {
  const px = new Array(S * S).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) px[y * S + x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
  const disc = (cx, cy, r, c) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) set(x, y, c); } };
  const roundedBg = (fn) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const corner = (Math.min(x, S - 1 - x) === 0 && Math.min(y, S - 1 - y) <= 1) || (Math.min(y, S - 1 - y) === 0 && Math.min(x, S - 1 - x) <= 1); if (!corner) set(x, y, fn(x, y)); } };
  return { px, set, rect, disc, roundedBg };
}
