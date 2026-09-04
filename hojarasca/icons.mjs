// Hojarasca icons: a red maple leaf on a lawn, 32x32 pixel art upscaled.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, pixelCanvas } from '../scripts/png.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const S = 32;
const { px, set, rect, disc, roundedBg } = pixelCanvas(S);
roundedBg((x, y) => ((x * 7 + y * 13) % 11 < 2 ? '#5a9a44' : '#4f8a3a'));
// scattered small leaves
for (const [x, y, c] of [[4, 5, '#e08a3a'], [26, 6, '#d8b040'], [6, 26, '#c85a2a'], [27, 25, '#e0a040'], [15, 3, '#d8b040'], [3, 15, '#c85a2a'], [28, 15, '#e08a3a']]) { rect(x, y, 2, 2, c); set(x + 1, y - 1, c); }
// big maple leaf
const red = '#d84a2a', dark = '#a83820', light = '#f07a40';
const leaf = ['....1........1....', '...111......111...', '...1111....1111...', '....11111111111...', '..1111111111111...', '.11111111111111...', '1111111111111111..', '.111111111111111..', '..11111111111111..', '..1111111111111...', '....111111111.....', '......11111.......', '.......111........', '.......111........', '.......111........'];
leaf.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') set(7 + i, 8 + j, (i + j) % 5 === 0 ? light : red); });
for (let j = 8; j < 21; j++) set(15, j, dark);
for (let i = 0; i < 5; i++) { set(12 - i, 12 + i, dark); set(18 + i, 12 + i, dark); }
mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of [32, 180, 192, 512]) { const out = join(root, 'icons', `icon-${size}.png`); writeFileSync(out, encodePNG(px, S, size)); console.log('wrote', out); }
