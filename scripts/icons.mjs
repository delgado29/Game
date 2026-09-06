// Generates SIGNAL's app icons: a 32x32 pixel-art lattice tower on a ridge under a dusk sky,
// red beacon lit, upscaled nearest-neighbour. Uses the shared PNG encoder.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, pixelCanvas } from './png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 32;
const { px, set, rect, disc, roundedBg } = pixelCanvas(S);

// dusk gradient: deep blue -> violet -> orange band at the horizon
roundedBg((x, y) => { const t = y / S; return t < 0.25 ? '#141a33' : t < 0.45 ? '#2a2550' : t < 0.6 ? '#6a3a5a' : t < 0.7 ? '#c8623e' : '#1a2a22'; });
// stars
for (const [x, y] of [[3, 3], [9, 6], [26, 2], [20, 5], [29, 8], [14, 2]]) set(x, y, '#e8e4ff');
// distant ridge and near ridge
for (let x = 0; x < S; x++) { const h = 21 + Math.round(2 * Math.sin(x * 0.4) + 1.5 * Math.sin(x * 0.9 + 2)); rect(x, h, 1, S - h, '#1a2a22'); }
for (let x = 0; x < S; x++) { const h = 25 + Math.round(1.5 * Math.sin(x * 0.6 + 1)); rect(x, h, 1, S - h, '#0f1a15'); }
// tower: tapering lattice on the ridge
const base = 26, top = 4, cx = 16;
for (let y = top; y <= base; y++) {
  const w = Math.max(1, Math.round(((y - top) / (base - top)) * 4));
  set(cx - w, y, '#c9ccd2'); set(cx + w, y, '#9a9ea8');
  if ((y - top) % 3 === 0) rect(cx - w, y, 2 * w + 1, 1, '#b0b4bc');
  if ((y - top) % 3 === 1 && w > 1) { set(cx - w + 1, y, '#7a7e88'); set(cx + w - 1, y, '#7a7e88'); }
}
// antenna mast and dishes
rect(cx, 1, 1, 3, '#d8dbe0'); rect(cx - 3, 12, 2, 2, '#e0e4ea'); rect(cx + 2, 15, 2, 2, '#e0e4ea');
// red beacon with glow
set(cx, 1, '#ff4a3a'); set(cx - 1, 1, 'rgba(255,80,60,0.45)'); set(cx + 1, 1, 'rgba(255,80,60,0.45)'); set(cx, 0, 'rgba(255,80,60,0.45)');
// the van's headlights, tiny, at the base
set(cx - 7, 27, '#ffe8a0'); set(cx - 6, 27, '#ffe8a0'); rect(cx - 8, 26, 4, 2, '#3a4a58'); rect(cx - 8, 25, 3, 1, '#4a5a68');

mkdirSync(join(root, 'public', 'icons'), { recursive: true });
for (const size of [32, 180, 192, 512]) { const out = join(root, 'public', 'icons', `icon-${size}.png`); writeFileSync(out, encodePNG(px, S, size)); console.log('wrote', out); }
