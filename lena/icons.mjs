// Generates Leña's icons: a 32x32 pixel-art axe in a pine stump, upscaled nearest-neighbour.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, pixelCanvas } from '../scripts/png.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const S = 32;
const { px, set, rect, disc, roundedBg } = pixelCanvas(S);

// dusk sky over dark pines
roundedBg((x, y) => { const t = y / S; return t < 0.2 ? '#f2a35a' : t < 0.42 ? '#d86a4a' : t < 0.6 ? '#1f3a3a' : '#16302a'; });
for (let i = 0; i < 7; i++) { const cx = 2 + i * 5, top = 9 + ((i * 7) % 5); for (let y = top; y < 22; y++) { const w = Math.min(3, Math.floor((y - top) / 3)); rect(cx - w, y, w * 2 + 1, 1, i % 2 ? '#1c3d34' : '#173229'); } }
// ground & stump
rect(0, 22, S, 10, '#3a2a1e'); rect(0, 22, S, 1, '#4a3a2a');
rect(9, 17, 14, 8, '#7a5230'); rect(9, 16, 14, 2, '#c8a068'); rect(11, 16, 10, 1, '#a8804a'); rect(9, 24, 14, 1, '#5a3a20');
// axe: handle diagonal, steel head
for (let i = 0; i < 12; i++) { set(21 - i, 4 + i, '#8a5a30'); set(22 - i, 4 + i, '#a8784a'); }
rect(19, 2, 6, 7, '#b8c0c8'); rect(18, 3, 2, 5, '#d8e0e8'); rect(24, 2, 2, 7, '#8a929a'); rect(19, 8, 6, 1, '#6a727a');
// wood chips
set(7, 15, '#e0b878'); set(25, 14, '#e0b878'); set(6, 19, '#c8a068');

mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of [32, 180, 192, 512]) { const out = join(root, 'icons', `icon-${size}.png`); writeFileSync(out, encodePNG(px, S, size)); console.log('wrote', out); }
