// Generates Cafetal's PWA / home-screen icons: 32x32 pixel art, upscaled nearest-neighbour.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, pixelCanvas } from '../scripts/png.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const S = 32;
const { px, set, rect, disc, roundedBg } = pixelCanvas(S);

roundedBg((x, y) => { const t = y / S; return t < 0.5 ? (t < 0.25 ? '#f6c66a' : '#f2a35a') : '#3f8a4a'; });
for (let x = 0; x < S; x++) { const h = 15 + Math.round(3 * Math.sin(x / 5)); rect(x, h, 1, S - h, '#3f8a4a'); const h2 = 19 + Math.round(2 * Math.sin(x / 3 + 1)); rect(x, h2, 1, S - h2, '#2f6e3a'); }
disc(24.5, 7.5, 3.6, '#fff1a8');
rect(9, 16, 14, 10, '#fbf5e6'); rect(9, 25, 14, 2, '#d8c8a8'); rect(23, 18, 3, 5, '#fbf5e6'); rect(24, 19, 1, 3, '#3f8a4a');
rect(10, 17, 12, 3, '#4a2a1a'); rect(10, 17, 12, 1, '#6a4a2a');
rect(7, 27, 18, 2, '#e8d8b8');
for (const [x, y] of [[13, 13], [13, 12], [14, 11], [14, 10], [18, 13], [18, 12], [17, 11], [17, 10], [16, 9]]) set(x, y, 'rgba(255,255,255,0.85)');
disc(6.5, 24.5, 1.6, '#d42a2a'); disc(4.5, 22.5, 1.4, '#ef4040'); set(5, 21, '#4a9a3a'); set(6, 20, '#4a9a3a');

mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of [32, 180, 192, 512]) { const out = join(root, 'icons', `icon-${size}.png`); writeFileSync(out, encodePNG(px, S, size)); console.log('wrote', out); }
