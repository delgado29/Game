/* Hojarasca — 10_art.js  Procedural pixel art: autumn tiles, house, greenhouse, trees, props, leaves, player, icons. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const Col = H.color, T = H.TILE;
  function sprite(w, h, fn) {
    const cv = H.canvas(w, h), g = H.ctx2d(cv);
    const P = { w, h, g, cv,
      px(x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
      hline(x, y, w, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, 1); },
      vline(x, y, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, h | 0); },
      disc(cx, cy, r, c) { g.fillStyle = c; for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1); } },
      ellipse(cx, cy, rx, ry, c) { g.fillStyle = c; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1); } },
      tri(cx, top, w, h, c) { g.fillStyle = c; for (let y = 0; y < h; y++) { const ww = Math.round((y / h) * w); g.fillRect(Math.round(cx - ww / 2), top + y, Math.max(1, ww), 1); } },
      line(x0, y0, x1, y1, c) { g.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } },
      blit(img, x, y) { g.drawImage(img, x | 0, y | 0); } };
    fn(P, g); return cv;
  }
  H.sprite = sprite;
  const A = (H.art = {});
  const cache = new Map(); const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); }; A.memo = memo;

  // ---- ground tiles -----------------------------------------------------------------------------
  A.tiles = () => memo('tiles', () => {
    const t = {};
    t.grass = [0, 1, 2, 3].map((v) => sprite(T, T, (P) => { const r = H.rng(100 + v); P.rect(0, 0, T, T, '#7a9a48'); for (let i = 0; i < 24; i++) P.px(r.int(T), r.int(T), r.chance(0.5) ? '#88a850' : '#6e8c40'); for (let i = 0; i < 4 + v; i++) { const x = r.int(T), y = r.int(T - 2); P.vline(x, y, 2, '#5e7c36'); } if (v === 3) P.px(r.int(T), r.int(T), '#c8b060'); }));
    t.path = sprite(T, T, (P) => { const r = H.rng(200); P.rect(0, 0, T, T, '#b8a888'); P.rect(1, 1, 6, 6, '#c8b898'); P.rect(9, 1, 6, 6, '#c0b090'); P.rect(1, 9, 6, 6, '#c0b090'); P.rect(9, 9, 6, 6, '#c8b898'); for (let i = 0; i < 6; i++) P.px(r.int(T), r.int(T), '#a89878'); });
    t.concrete = sprite(T, T, (P) => { const r = H.rng(300); P.rect(0, 0, T, T, '#a8a49c'); for (let i = 0; i < 14; i++) P.px(r.int(T), r.int(T), '#9c9890'); P.hline(0, 0, T, '#948f86'); P.vline(0, 0, T, '#948f86'); });
    t.water = [0, 1, 2, 3].map((f) => sprite(T, T, (P) => { P.rect(0, 0, T, T, '#4aa0c8'); const r = H.rng(400); for (let i = 0; i < 5; i++) { const x = (r.int(T) + f * 2) % T, y = (r.int(T) + f) % T; P.hline(x, y, 3, '#7ac0e0'); P.px(x + 1, y, '#a8dcf0'); } }));
    t.deck = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#b08a5a'); for (let y = 0; y < T; y += 4) P.hline(0, y, T, '#8e6c42'); P.px(3, 2, '#7a5a34'); P.px(11, 10, '#7a5a34'); });
    t.glass = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#bfe0d8'); P.rect(1, 1, 14, 14, '#cfeae2'); P.hline(0, 0, T, '#8ab0a8'); P.vline(0, 0, T, '#8ab0a8'); P.px(3, 3, '#e8f8f4'); });
    t.stone = sprite(T, T, (P) => { const r = H.rng(600); P.rect(0, 0, T, T, '#5a5a62'); P.hline(0, 7, T, '#46464e'); P.vline(7, 0, 8, '#46464e'); P.vline(3, 8, 8, '#46464e'); P.vline(12, 8, 8, '#46464e'); for (let i = 0; i < 5; i++) P.px(r.int(T), r.int(T), '#66666e'); });
    t.soil = sprite(T, T, (P) => { const r = H.rng(700); P.rect(0, 0, T, T, '#6a4a30'); for (let i = 0; i < 10; i++) P.px(r.int(T), r.int(T), '#7a5a3a'); for (let i = 0; i < 3; i++) { const x = 2 + r.int(12); P.vline(x, 6 + r.int(4), 4, '#4a8a3a'); P.px(x - 1, 6 + r.int(3), '#6ab04a'); } });
    t.sand = sprite(T, T, (P) => { const r = H.rng(800); P.rect(0, 0, T, T, '#e0cc90'); for (let i = 0; i < 12; i++) P.px(r.int(T), r.int(T), '#d0bc80'); });
    t.road = sprite(T, T, (P) => { const r = H.rng(900); P.rect(0, 0, T, T, '#4a4a50'); for (let i = 0; i < 8; i++) P.px(r.int(T), r.int(T), '#54545a'); });
    t.sidewalk = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#bab6ae'); P.hline(0, 0, T, '#a4a098'); P.vline(0, 0, T, '#a4a098'); });
    t.porch = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#c09a68'); for (let x = 0; x < T; x += 4) P.vline(x, 0, T, '#a07c50'); });
    t.void = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#1a1410'); });
    t.rug = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#8a3a3a'); P.rect(2, 2, 12, 12, '#a84a4a'); P.rect(4, 4, 8, 8, '#8a3a3a'); });
    return t;
  });

  // ---- leaves ---------------------------------------------------------------------------------------
  A.LEAF_COLORS = [['#d8502a', '#f07a40'], ['#e08a30', '#f0aa50'], ['#d8b040', '#f0d060'], ['#8a5a2a', '#a8743a'], ['#e8c040', '#fff0a0']]; // red, orange, yellow, brown, golden
  A.leaf = (type, frame) => memo('leaf' + type + frame, () => sprite(5, 5, (P) => {
    const [a, b] = A.LEAF_COLORS[type];
    if (frame === 0) { P.rect(1, 1, 3, 3, a); P.px(2, 1, b); P.px(1, 4, Col.shade(a, 0.8)); }
    else if (frame === 1) { P.rect(0, 2, 5, 1, a); P.rect(1, 1, 3, 3, a); P.px(3, 1, b); P.px(0, 2, Col.shade(a, 0.8)); }
    else if (frame === 2) { P.rect(2, 0, 1, 5, a); P.rect(1, 1, 3, 3, a); P.px(1, 3, b); P.px(2, 0, Col.shade(a, 0.8)); }
    else { P.px(1, 1, a); P.px(2, 2, a); P.px(3, 3, a); P.px(3, 1, a); P.px(1, 3, a); P.px(2, 1, b); P.px(2, 3, a); P.px(1, 2, a); P.px(3, 2, a); }
  }));

  // ---- trees, bushes --------------------------------------------------------------------------------
  A.tree = (kind, seed) => memo('tree' + kind + seed, () => sprite(40, 48, (P) => {
    const r = H.rng(seed * 17 + 3);
    const trunk = kind === 'birch' ? '#e6e2d6' : '#6b4a2b', trunkD = kind === 'birch' ? '#9a968a' : '#4e3620';
    P.rect(18, 30, 4, 18, trunk); P.vline(18, 30, 18, trunkD); if (kind === 'birch') for (let y = 32; y < 46; y += 4) P.rect(19 + r.int(2), y, 2, 1, '#3a3a3a');
    if (kind === 'pine') { const c1 = '#2f6e3a', c2 = '#3f8a4a'; for (let i = 0; i < 5; i++) { const y = 6 + i * 6, w = 8 + i * 5; P.tri(20, y, w, 10, i % 2 ? c1 : c2); } P.tri(20, 2, 4, 6, c2); return; }
    const pal = kind === 'maple' ? ['#d0602a', '#e88a3a', '#b84a2a'] : kind === 'oak' ? ['#c8862a', '#e0a840', '#a86a20'] : ['#d8b040', '#f0d060', '#b89030'];
    const blobs = [[20, 18, 15, 12], [12 + r.int(4), 22, 9, 7], [26 + r.int(4), 21, 9, 7], [20, 10 + r.int(3), 10, 7]];
    blobs.forEach((b, i) => P.ellipse(b[0], b[1], b[2], b[3], pal[i % 2 ? 1 : 0]));
    P.ellipse(16, 15, 6, 4, pal[2]);
    for (let i = 0; i < 16; i++) P.px(6 + r.int(28), 8 + r.int(20), pal[2]);
    for (let i = 0; i < 12; i++) P.px(6 + r.int(28), 6 + r.int(18), Col.lighten(pal[1], 0.2));
    // bare patches: autumn thinning
    for (let i = 0; i < 6; i++) { const x = 8 + r.int(24), y = 8 + r.int(18); P.px(x, y, trunkD); }
  }));
  A.bush = (seed) => memo('bush' + seed, () => sprite(16, 16, (P) => { const r = H.rng(seed); P.ellipse(8, 10, 7, 5, '#4f7a3a'); P.ellipse(6, 9, 4, 3, '#6a9a4a'); P.px(10, 7, '#3a6a2a'); for (let i = 0; i < 3; i++) P.px(3 + r.int(10), 7 + r.int(6), '#e08a30'); }));
  A.hedge = () => memo('hedge', () => sprite(16, 20, (P) => { P.rect(1, 4, 14, 16, '#3f6e30'); P.rect(1, 4, 14, 2, '#5a8a44'); for (let i = 0; i < 12; i++) P.px(2 + H.hash(i, 1, 4) * 12 | 0, 6 + H.hash(i, 2, 4) * 12 | 0, '#4f7e38'); P.rect(1, 19, 14, 1, '#2e5222'); }));

  // ---- buildings ------------------------------------------------------------------------------------
  A.house = () => memo('house', () => sprite(16 * T, 15 * T, (P) => {
    const wall = '#f0e4c8', wallD = '#d8c8a4', roof = '#8a4a3a', roofD = '#6a3628', roofL = '#a45a48', wood = '#6a4a2a', win = '#8ac0e0';
    const W = 16 * T, wallTop = 56, base = 15 * T;
    P.rect(4, wallTop, W - 8, base - wallTop, wall); P.rect(4, base - 6, W - 8, 6, wallD);
    for (let y = 0; y < wallTop; y++) { const inset = Math.max(0, 10 - y / 3); P.hline(inset, y + 4, W - inset * 2, y % 4 === 0 ? roofD : y % 4 === 2 ? roofL : roof); }
    P.hline(0, wallTop + 2, W, roofD); P.hline(0, wallTop + 1, W, roofD);
    const winf = (x, y) => { P.rect(x, y, 16, 14, wood); P.rect(x + 2, y + 2, 12, 10, win); P.vline(x + 8, y + 2, 10, wood); P.hline(x + 2, y + 7, 12, wood); P.rect(x - 1, y + 14, 18, 2, '#c8b48a'); };
    winf(20, 72); winf(60, 72); winf(100, 72); winf(20, 120); winf(100, 120);
    // door
    P.rect(112 - 2, 200, 22, 40, wood); P.rect(112, 202, 18, 36, '#8a6238'); P.px(126, 220, '#f0d060');
    // garage on the east side
    P.rect(176, 150, 72, 90, '#c8c0b0'); P.rect(180, 156, 64, 80, '#a8a098'); for (let y = 160; y < 236; y += 10) P.hline(180, y, 64, '#8a847c'); P.rect(176, 148, 72, 3, '#7a746c');
    // chimney, porch lamp
    P.rect(40, 0, 12, 24, '#8a7a6a'); P.rect(40, 0, 12, 3, '#6a5a4a');
    P.rect(140, 206, 4, 6, '#3a3a3a'); P.px(141, 208, '#ffe080'); P.px(142, 208, '#ffe080');
    // ivy on the west wall
    for (let i = 0; i < 40; i++) P.px(6 + (H.hash(i, 7, 9) * 10 | 0), wallTop + 10 + (H.hash(i, 8, 9) * 160 | 0), i % 3 ? '#4f7a3a' : '#c8862a');
  }));
  A.greenhouse = () => memo('greenhouse', () => sprite(14 * T, 10 * T + 24, (P) => {
    const frame = '#8ab0a8', glass = 'rgba(190,230,222,0.55)', frameD = '#5a8078';
    const W = 14 * T, Hh = 10 * T + 24;
    // roof (transparent-ish glass) then walls
    for (let y = 0; y < 24; y++) { const inset = Math.max(0, 12 - y / 2); P.hline(inset, y, W - inset * 2, y % 6 === 0 ? frame : glass); }
    P.rect(0, 24, W, Hh - 24, glass);
    for (let x = 0; x < W; x += 16) P.vline(x, 20, Hh - 20, frame); P.vline(W - 1, 20, Hh - 20, frame);
    for (let y = 24; y < Hh; y += 16) P.hline(0, y, W, frame);
    P.rect(0, Hh - 3, W, 3, frameD);
    // door gap at bottom centre (cols 6..7)
    P.rect(6 * T + 2, Hh - 22, 28, 22, '#4a7a6a'); P.rect(6 * T + 4, Hh - 20, 24, 18, glass); P.px(6 * T + 25, Hh - 12, '#f0d060');
  }));
  A.shed = () => memo('shed', () => sprite(4 * T, 4 * T, (P) => { const wood = '#8a6238', woodD = '#6a4a2a'; P.rect(2, 20, 60, 44, wood); for (let x = 2; x < 62; x += 5) P.vline(x, 20, 44, woodD); for (let y = 0; y < 20; y++) { const inset = Math.max(0, 6 - y / 2); P.hline(inset, y + 2, 64 - inset * 2, y % 3 ? '#9aa4aa' : '#7a848a'); } P.rect(26, 40, 14, 24, '#3a2a1e'); P.rect(6, 28, 12, 10, '#8ac0e0'); }));
  A.car = () => memo('car', () => sprite(4 * T, 4 * T + 8, (P) => { const body = '#c8443a', bodyD = '#8a2e28', bodyL = '#e06a5a'; P.rect(6, 16, 52, 44, body); P.rect(6, 16, 52, 3, bodyL); P.rect(10, 4, 44, 14, bodyD); P.rect(12, 20, 40, 14, '#6a8aa8'); P.rect(12, 40, 40, 12, '#6a8aa8'); P.rect(6, 56, 52, 6, bodyD); P.rect(2, 14, 6, 12, '#2a2a2a'); P.rect(56, 14, 6, 12, '#2a2a2a'); P.rect(2, 46, 6, 12, '#2a2a2a'); P.rect(56, 46, 6, 12, '#2a2a2a'); P.rect(20, 60, 24, 4, '#e0e0e0'); P.px(10, 60, '#ffe080'); P.px(52, 60, '#ffe080'); }));
  A.bin = (open) => memo('bin' + open, () => sprite(18, 24, (P) => { P.rect(2, 8, 14, 16, '#4a6a4a'); P.rect(2, 8, 14, 2, '#5a7a5a'); P.vline(5, 10, 14, '#3a5a3a'); P.vline(9, 10, 14, '#3a5a3a'); P.vline(13, 10, 14, '#3a5a3a'); P.rect(0, 5, 18, 4, open ? '#3a5a3a' : '#5a7a5a'); if (open) { P.rect(1, 1, 16, 4, '#5a7a5a'); P.rect(3, 6, 12, 3, '#1a2a1a'); } P.rect(3, 22, 12, 2, '#2a3a2a'); P.px(8, 14, '#c8c8c8'); P.px(9, 14, '#c8c8c8'); }));
  A.vent = (f) => memo('vent' + f, () => sprite(16, 16, (P) => { P.rect(1, 1, 14, 14, '#4a4a4a'); P.rect(2, 2, 12, 12, '#2a2a2a'); for (let y = 3; y < 14; y += 3) P.hline(3, y + ((f + y / 3) % 2 | 0), 10, '#6a6a6a'); P.rect(1, 1, 14, 1, '#7a7a7a'); P.rect(1, 1, 1, 14, '#7a7a7a'); }));
  A.ventOff = () => memo('ventoff', () => sprite(16, 16, (P) => { P.rect(2, 2, 12, 12, 'rgba(0,0,0,0.25)'); P.rect(3, 3, 10, 10, '#6a6a5a'); P.rect(5, 5, 6, 6, '#8a8a7a'); }));
  A.hatch = () => memo('hatch', () => sprite(20, 16, (P) => { P.rect(0, 2, 20, 14, '#5a4a3a'); P.rect(2, 4, 16, 10, '#7a6a5a'); P.hline(2, 8, 16, '#5a4a3a'); P.rect(8, 6, 4, 2, '#c8c8c8'); P.rect(0, 0, 20, 2, '#6a5a4a'); }));
  A.ladder = () => memo('ladder', () => sprite(12, 24, (P) => { P.vline(2, 0, 24, '#a8784a'); P.vline(9, 0, 24, '#a8784a'); for (let y = 2; y < 24; y += 5) P.hline(3, y, 6, '#c8a068'); }));
  A.fence = (kind) => memo('fence' + kind, () => sprite(T, T, (P) => { const w = '#d8d0c0', d = '#a8a090'; if (kind === 'h' || kind === 'x') { P.rect(0, 5, 16, 2, w); P.rect(0, 10, 16, 2, w); } if (kind === 'v' || kind === 'x') P.rect(7, 0, 2, 16, w); P.rect(6, 2, 4, 12, w); P.rect(6, 2, 4, 1, '#f0ece0'); P.rect(6, 13, 4, 1, d); if (kind === 'v' || kind === 'x') P.px(7, 0, '#f0ece0'); }));
  A.gate = (open) => memo('gate' + open, () => sprite(16, 20, (P) => { const w = '#c8a068', d = '#8a6a3a'; P.rect(1, 0, 3, 20, d); P.rect(12, 0, 3, 20, d); if (!open) { P.rect(3, 6, 10, 2, w); P.rect(3, 12, 10, 2, w); P.line(3, 14, 12, 6, w); P.rect(7, 4, 2, 12, '#3a3a3a'); } else { P.rect(3, 6, 4, 2, w); P.rect(3, 12, 4, 2, w); } P.rect(1, 0, 3, 1, '#e0c080'); P.rect(12, 0, 3, 1, '#e0c080'); }));
  A.lantern = (on) => memo('lantern' + on, () => sprite(16, 24, (P) => { P.rect(7, 8, 2, 16, '#4a4a4a'); P.rect(5, 2, 6, 7, '#3a3a3a'); P.rect(6, 3, 4, 5, on ? '#ffe080' : '#a0a0a0'); }));
  A.mailbox = () => memo('mailbox', () => sprite(16, 24, (P) => { P.rect(7, 12, 2, 12, '#6a4a2a'); P.rect(3, 5, 10, 8, '#4a6a9a'); P.rect(3, 4, 10, 1, '#6a8aba'); P.px(11, 9, '#f0d060'); P.rect(13, 3, 1, 7, '#d83a2a'); }));
  A.pot = (seed) => memo('pot' + seed, () => sprite(T, T, (P) => { P.rect(4, 9, 8, 6, '#b8603a'); P.rect(3, 8, 10, 2, '#d07a4a'); const r = H.rng(seed); const c = r.pick(['#e08a30', '#f0c040', '#ffffff']); P.rect(5, 5, 6, 4, '#4a8a3a'); P.px(6, 4, c); P.px(9, 3, c); }));
  A.table = () => memo('table', () => sprite(32, 24, (P) => { P.rect(2, 8, 28, 4, '#8a6238'); P.rect(2, 12, 28, 1, '#6a4a2a'); P.rect(4, 12, 3, 12, '#6a4a2a'); P.rect(25, 12, 3, 12, '#6a4a2a'); P.rect(8, 2, 6, 6, '#c8c8c8'); P.rect(9, 0, 4, 2, '#a8a8a8'); P.px(14, 4, '#a8a8a8'); P.rect(20, 4, 5, 4, '#e8c040'); P.px(22, 3, '#8a6a2a'); }));
  A.chair = () => memo('chair', () => sprite(16, 22, (P) => { P.rect(2, 0, 12, 10, '#8a3a3a'); P.rect(3, 1, 10, 8, '#a84a4a'); P.rect(2, 10, 12, 5, '#8a6238'); P.rect(3, 15, 2, 7, '#6a4a2a'); P.rect(11, 15, 2, 7, '#6a4a2a'); }));
  A.stove = () => memo('stove', () => sprite(20, 28, (P) => { P.rect(2, 8, 16, 20, '#3a3a3a'); P.rect(4, 12, 12, 8, '#1a1a1a'); P.rect(6, 14, 8, 4, '#ff8a30'); P.px(8, 15, '#ffd060'); P.rect(8, 0, 4, 8, '#4a4a4a'); }));
  A.sandbox = () => memo('sandbox', () => sprite(4 * T, 2 * T, (P) => { P.rect(0, 0, 64, 32, '#a8784a'); P.rect(3, 3, 58, 26, '#e0cc90'); P.rect(20, 14, 8, 6, '#d84a2a'); P.px(40, 20, '#4a90d0'); P.px(12, 22, '#4a90d0'); }));
  A.poolLadder = () => memo('poolladder', () => sprite(12, 20, (P) => { P.vline(2, 0, 20, '#d8e0e8'); P.vline(9, 0, 20, '#d8e0e8'); P.hline(3, 4, 6, '#d8e0e8'); P.hline(3, 10, 6, '#d8e0e8'); P.hline(3, 16, 6, '#d8e0e8'); }));
  A.deckChair = () => memo('deckchair', () => sprite(20, 16, (P) => { P.rect(2, 4, 16, 8, '#f0e0b0'); P.rect(2, 4, 16, 2, '#e05a4a'); P.rect(2, 8, 16, 2, '#e05a4a'); P.rect(2, 12, 2, 4, '#8a6238'); P.rect(16, 12, 2, 4, '#8a6238'); }));

  // ---- player & tools ---------------------------------------------------------------------------------
  A.PLAYER = { skin: '#e8b898', hair: '#4a2a1a', shirt: '#c8843a', pants: '#3a4a6a', hat: '#8a3a2a' };
  A.human = (cfg, dir, frame) => memo('hum' + dir + frame, () => sprite(16, 20, (P) => {
    const { skin, hair, shirt, pants, hat } = cfg; const shirtD = Col.shade(shirt, 0.8), skinD = Col.shade(skin, 0.85);
    const bob = frame === 1 ? -1 : 0, lA = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    P.rect(5, 14 + bob + lA, 3, 4, pants); P.rect(8, 14 + bob - lA, 3, 4, pants); P.rect(5, 18 + bob, 6, 1, '#3a2a20');
    P.rect(4, 9 + bob, 8, 5, shirt); P.rect(4, 13 + bob, 8, 1, shirtD); P.rect(6, 9 + bob, 1, 5, Col.shade(shirt, 0.7)); P.rect(9, 9 + bob, 1, 5, Col.shade(shirt, 0.7));
    const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0; P.rect(3, 9 + bob + swing, 1, 4, shirt); P.rect(12, 9 + bob - swing, 1, 4, shirt); P.px(3, 13 + bob + swing, skin); P.px(12, 13 + bob - swing, skin);
    P.rect(4, 2 + bob, 8, 7, skin); P.rect(4, 8 + bob, 8, 1, skinD);
    P.rect(4, 1 + bob, 8, 2, hair); P.rect(3, 2 + bob, 1, 4, hair); P.rect(12, 2 + bob, 1, 4, hair);
    if (dir === 3) P.rect(4, 3 + bob, 8, 5, hair);
    if (dir === 0) { P.px(6, 5 + bob, '#222'); P.px(9, 5 + bob, '#222'); }
    if (dir === 1) { P.px(5, 5 + bob, '#222'); P.rect(11, 2 + bob, 2, 5, hair); }
    if (dir === 2) { P.px(10, 5 + bob, '#222'); P.rect(3, 2 + bob, 2, 5, hair); }
    if (hat) { P.rect(2, 2 + bob, 12, 1, Col.shade(hat, 0.8)); P.rect(4, 0 + bob, 8, 2, hat); }
  }));
  // tool sprites drawn relative to the player, per facing dir
  A.rakeTool = (dir) => memo('rake' + dir, () => sprite(24, 24, (P) => { const h = '#a8784a', m = '#8a8a90'; if (dir === 0) { P.rect(11, 2, 2, 14, h); P.rect(6, 16, 12, 3, m); for (let x = 6; x < 18; x += 2) P.px(x, 19, m); } else if (dir === 3) { P.rect(11, 8, 2, 14, h); P.rect(6, 4, 12, 3, m); for (let x = 6; x < 18; x += 2) P.px(x, 3, m); } else if (dir === 2) { P.rect(2, 11, 14, 2, h); P.rect(16, 6, 3, 12, m); for (let y = 6; y < 18; y += 2) P.px(19, y, m); } else { P.rect(8, 11, 14, 2, h); P.rect(5, 6, 3, 12, m); for (let y = 6; y < 18; y += 2) P.px(4, y, m); } }));
  A.blowerTool = (dir) => memo('blower' + dir, () => sprite(24, 24, (P) => { const b = '#e05a2a', bd = '#a83a1a', tube = '#3a3a3a'; if (dir === 0) { P.rect(8, 6, 8, 8, b); P.rect(8, 6, 8, 2, bd); P.rect(11, 14, 3, 8, tube); P.rect(10, 21, 5, 2, '#5a5a5a'); } else if (dir === 3) { P.rect(8, 10, 8, 8, b); P.rect(8, 10, 8, 2, bd); P.rect(11, 2, 3, 8, tube); P.rect(10, 1, 5, 2, '#5a5a5a'); } else if (dir === 2) { P.rect(4, 8, 8, 8, b); P.rect(4, 8, 8, 2, bd); P.rect(12, 11, 10, 3, tube); P.rect(21, 10, 2, 5, '#5a5a5a'); } else { P.rect(12, 8, 8, 8, b); P.rect(12, 8, 8, 2, bd); P.rect(2, 11, 10, 3, tube); P.rect(1, 10, 2, 5, '#5a5a5a'); } }));

  // ---- icons -------------------------------------------------------------------------------------------
  const icons = {
    coin: (P) => { P.disc(8, 8, 5.5, '#e0a020'); P.disc(8, 8, 4, '#f8d050'); P.rect(7, 5, 2, 6, '#e0a020'); },
    leaf: (P) => { P.ellipse(8, 8, 5, 4, '#d8502a'); P.line(3, 12, 13, 4, '#a83820'); P.px(12, 3, '#4a8a3a'); P.px(4, 12, '#a83820'); },
    hand: (P) => { P.rect(5, 4, 7, 9, '#e8b898'); P.rect(4, 6, 1, 5, '#e8b898'); P.rect(12, 6, 1, 5, '#e8b898'); for (let i = 0; i < 4; i++) P.vline(5 + i * 2, 2 + (i === 1 || i === 2 ? 0 : 1), 3, '#e8b898'); P.rect(5, 12, 7, 2, '#c8843a'); },
    rake: (P) => { P.line(3, 13, 11, 3, '#a8784a'); P.rect(9, 1, 6, 3, '#8a8a90'); for (let x = 9; x < 15; x += 2) P.px(x, 4, '#8a8a90'); },
    blower: (P) => { P.rect(3, 5, 7, 7, '#e05a2a'); P.rect(3, 5, 7, 2, '#a83a1a'); P.rect(10, 7, 5, 3, '#3a3a3a'); P.px(15, 6, '#a0d0f0'); P.px(15, 10, '#a0d0f0'); },
    bag: (P) => { P.rect(3, 6, 10, 8, '#6a5a4a'); P.rect(3, 6, 10, 2, '#4a3a2a'); P.rect(6, 3, 4, 3, '#4a3a2a'); P.px(7, 9, '#d8502a'); P.px(9, 10, '#e08a30'); },
    shoes: (P) => { P.rect(2, 8, 12, 5, '#e05a4a'); P.rect(2, 12, 12, 2, '#f0f0f0'); P.rect(8, 5, 6, 4, '#e05a4a'); P.px(4, 10, '#fff'); P.px(6, 10, '#fff'); },
    gloves: (P) => { P.rect(4, 5, 8, 8, '#d8b040'); P.rect(3, 7, 1, 4, '#d8b040'); P.rect(12, 7, 1, 4, '#d8b040'); for (let i = 0; i < 4; i++) P.vline(4 + i * 2, 3, 3, '#d8b040'); P.rect(4, 12, 8, 2, '#a88020'); },
    vent: (P) => { P.rect(2, 2, 12, 12, '#4a4a4a'); for (let y = 4; y < 13; y += 3) P.hline(4, y, 8, '#8a8a8a'); },
    bin: (P) => { P.rect(4, 5, 8, 9, '#4a6a4a'); P.rect(3, 3, 10, 2, '#5a7a5a'); P.vline(6, 7, 6, '#3a5a3a'); P.vline(9, 7, 6, '#3a5a3a'); },
    gate: (P) => { P.rect(2, 2, 2, 12, '#8a6a3a'); P.rect(12, 2, 2, 12, '#8a6a3a'); P.rect(4, 5, 8, 2, '#c8a068'); P.rect(4, 10, 8, 2, '#c8a068'); P.rect(7, 4, 2, 8, '#3a3a3a'); },
    settings: (P) => { P.disc(8, 8, 5, '#e8e8e8'); P.disc(8, 8, 2, '#4a4a4a'); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) P.rect(x - 1, y - 1, 3, 3, '#e8e8e8'); },
    check: (P) => { P.line(3, 8, 6, 11, '#6ad06a'); P.line(6, 11, 13, 4, '#6ad06a'); P.line(3, 9, 6, 12, '#6ad06a'); P.line(6, 12, 13, 5, '#6ad06a'); },
    x: (P) => { P.line(4, 4, 12, 12, '#e05a4a'); P.line(12, 4, 4, 12, '#e05a4a'); P.line(5, 4, 12, 11, '#e05a4a'); P.line(11, 4, 4, 11, '#e05a4a'); },
    lock: (P) => { P.rect(4, 7, 8, 7, '#8a8a90'); P.rect(5, 3, 1, 5, '#b0b0b8'); P.rect(10, 3, 1, 5, '#b0b0b8'); P.rect(5, 3, 6, 1, '#b0b0b8'); P.px(8, 10, '#3a3a3a'); },
    star: (P) => { P.px(8, 3, '#fff'); P.px(8, 13, '#fff'); P.rect(6, 7, 5, 3, '#f8d050'); P.rect(7, 5, 3, 7, '#f8d050'); P.px(5, 8, '#f8d050'); P.px(11, 8, '#f8d050'); },
    golden: (P) => { P.ellipse(8, 8, 5, 4, '#e8c040'); P.line(3, 12, 13, 4, '#a88020'); P.px(12, 3, '#4a8a3a'); P.px(6, 6, '#fff0a0'); },
    wind: (P) => { P.line(2, 5, 10, 5, '#d0e0f0'); P.px(11, 4, '#d0e0f0'); P.line(3, 9, 13, 9, '#d0e0f0'); P.px(14, 8, '#d0e0f0'); P.line(4, 13, 9, 13, '#d0e0f0'); P.px(10, 12, '#d0e0f0'); },
    house: (P) => { P.rect(3, 8, 10, 7, '#f0e4c8'); for (let y = 0; y < 5; y++) P.hline(2 + (4 - y), 3 + y, 12 - (4 - y) * 2, '#8a4a3a'); P.rect(7, 11, 3, 4, '#6a4a2a'); },
    lang: (P) => { P.rect(2, 3, 12, 9, '#f4f4f4'); P.rect(2, 3, 12, 1, '#c8c8c8'); P.rect(4, 5, 3, 1, '#4a4a4a'); P.rect(4, 7, 8, 1, '#4a4a4a'); P.rect(4, 9, 6, 1, '#4a4a4a'); },
    trophy: (P) => { P.rect(5, 2, 6, 6, '#f8d050'); P.rect(4, 2, 8, 1, '#e0a020'); P.rect(7, 8, 2, 3, '#e0a020'); P.rect(5, 11, 6, 2, '#e0a020'); },
  };
  A.icon = (name) => memo('icon:' + name, () => sprite(16, 16, (P) => { const f = icons[name]; if (f) f(P); else P.rect(3, 3, 10, 10, '#f0f'); }));
})();
