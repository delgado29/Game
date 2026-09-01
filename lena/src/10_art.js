/* Leña — 10_art.js
   Procedural pixel art: trees per species, lumberjacks with axes, stump, sapling,
   sawmill, wagon, log pile, parallax backdrops, UI icons. */
(function () {
  'use strict';
  const L = window.Lena;
  const Col = L.color;

  function sprite(w, h, fn) {
    const cv = L.canvas(w, h), g = L.ctx2d(cv);
    const P = {
      w, h, g, cv,
      px(x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
      hline(x, y, w, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, 1); },
      vline(x, y, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, h | 0); },
      disc(cx, cy, r, c) { g.fillStyle = c; for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1); } },
      ellipse(cx, cy, rx, ry, c) { g.fillStyle = c; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1); } },
      tri(cx, top, w, h, c) { g.fillStyle = c; for (let y = 0; y < h; y++) { const ww = Math.round((y / h) * w); g.fillRect(Math.round(cx - ww / 2), top + y, Math.max(1, ww), 1); } },
      line(x0, y0, x1, y1, c) { g.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } },
      blit(img, x, y) { g.drawImage(img, x | 0, y | 0); },
    };
    fn(P, g);
    return cv;
  }
  L.sprite = sprite;
  const A = (L.art = {});
  const cache = new Map();
  const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
  A.memo = memo;

  // ---- species visuals ------------------------------------------------------------------
  A.SPECIES_LOOK = {
    pine: { trunk: '#6b4a2b', leaf: ['#2f6e3a', '#3f8a4a', '#245a30'], shape: 'pine', h: 64, w: 40 },
    birch: { trunk: '#e8e6dc', leaf: ['#7cc45c', '#9ad67a', '#5aa64a'], shape: 'round', h: 74, w: 40, marks: '#3a3a3a' },
    oak: { trunk: '#5a3a20', leaf: ['#3f8f3a', '#5aa64a', '#2f7a30'], shape: 'round', h: 84, w: 70 },
    maple: { trunk: '#6b4a2b', leaf: ['#d0602a', '#e88a3a', '#b84a2a'], shape: 'round', h: 88, w: 66 },
    redwood: { trunk: '#8a3a2a', leaf: ['#2f6e3a', '#3f8a4a', '#1f5a2a'], shape: 'pine', h: 124, w: 52 },
    ancient: { trunk: '#4a3a2a', leaf: ['#2a6a3a', '#4a9a5a', '#1a4a2a'], shape: 'round', h: 112, w: 110, vines: true },
    ironwood: { trunk: '#3a4a5a', leaf: ['#4a6a7a', '#6a8a9a', '#2a4a5a'], shape: 'pine', h: 120, w: 60 },
    worldtree: { trunk: '#5a4a6a', leaf: ['#7a5aa0', '#a08ad0', '#5a3a80'], shape: 'round', h: 136, w: 122, glow: '#e0d0ff' },
  };

  // Tree canvas: base pivot is bottom-centre. Returns canvas with .baseX/.baseY.
  A.tree = function (species, seed) {
    return memo('tree' + species + seed, () => {
      const k = A.SPECIES_LOOK[species], r = L.rng(seed * 131 + 7);
      const w = k.w + 8, h = k.h + 6;
      const cv = sprite(w, h, (P) => {
        const cx = w / 2, base = h - 1;
        const tw = Math.max(4, Math.round(k.w * (k.shape === 'pine' ? 0.14 : 0.18)));
        const trunkTop = k.shape === 'pine' ? base - Math.round(k.h * 0.35) : base - Math.round(k.h * 0.55);
        // trunk with shading
        P.rect(cx - tw / 2, trunkTop, tw, base - trunkTop + 1, k.trunk);
        P.rect(cx - tw / 2, trunkTop, Math.max(1, tw / 3), base - trunkTop + 1, Col.shade(k.trunk, 0.8));
        P.rect(cx + tw / 2 - 1, trunkTop, 1, base - trunkTop + 1, Col.lighten(k.trunk, 0.15));
        // roots flare
        P.rect(cx - tw / 2 - 2, base - 2, tw + 4, 3, k.trunk); P.rect(cx - tw / 2 - 3, base, tw + 6, 1, Col.shade(k.trunk, 0.8));
        if (k.marks) for (let y = trunkTop + 4; y < base - 4; y += 5 + r.int(4)) P.rect(cx - tw / 2 + r.int(tw - 1), y, 2, 1, k.marks);
        if (k.shape === 'pine') {
          const layers = 4 + Math.round(k.h / 30);
          const top = base - k.h + 2;
          for (let i = layers - 1; i >= 0; i--) {
            const y0 = top + (i * (trunkTop - top)) / layers + 2;
            const lw = k.w * (0.35 + 0.65 * (i + 1) / layers), lh = (trunkTop - top) / layers * 1.6 + 4;
            P.tri(cx + r.int(3) - 1, y0, lw, lh, k.leaf[i % 2]);
            P.tri(cx - lw * 0.15, y0 + 2, lw * 0.55, lh * 0.8, k.leaf[2]);
          }
          P.tri(cx, top - 2, 6, 8, k.leaf[1]);
        } else {
          const cy = trunkTop - k.h * 0.2, rx = k.w / 2, ry = k.h * 0.3;
          // branches
          for (let i = 0; i < 4; i++) { const dir = i % 2 ? 1 : -1; P.line(cx, trunkTop + 6 + i * 4, cx + dir * (rx * 0.5 + r.int(rx * 0.3)), cy + r.int(ry * 0.8) - ry * 0.4, k.trunk); }
          P.ellipse(cx, cy, rx, ry, k.leaf[2]);
          const blobs = 5 + Math.round(k.w / 12);
          for (let i = 0; i < blobs; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.7; P.ellipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * 0.35 + r.int(rx * 0.2), ry * 0.35 + r.int(ry * 0.2), k.leaf[r.chance(0.5) ? 0 : 1]); }
          for (let i = 0; i < blobs * 3; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.9; P.px(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, Col.lighten(k.leaf[1], 0.25)); }
          if (k.vines) for (let i = 0; i < 6; i++) { const x = cx - rx * 0.6 + r.int(rx * 1.2); P.vline(x, cy + ry * 0.6, 6 + r.int(10), k.leaf[2]); }
          if (k.glow) for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.9; P.px(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, k.glow); }
        }
      });
      cv.baseX = w / 2; cv.baseY = h - 1;
      return cv;
    });
  };
  A.stump = (species) => memo('stump' + species, () => { const k = A.SPECIES_LOOK[species]; const tw = Math.max(6, Math.round(k.w * 0.2)); return sprite(tw + 6, 9, (P) => { P.rect(3, 3, tw, 6, k.trunk); P.rect(3, 3, 2, 6, Col.shade(k.trunk, 0.8)); P.ellipse(3 + tw / 2, 3, tw / 2, 1.6, '#d8b878'); P.ellipse(3 + tw / 2, 3, tw / 4, 0.8, '#b89058'); P.rect(1, 7, tw + 4, 2, Col.shade(k.trunk, 0.85)); }); });
  A.sapling = (species, stage) => memo('sap' + species + stage, () => { const k = A.SPECIES_LOOK[species]; return sprite(16, 20, (P) => { const h = 4 + stage * 4; P.vline(8, 19 - h, h, k.trunk); P.ellipse(6, 19 - h, 2 + stage, 1.5 + stage * 0.5, k.leaf[1]); P.ellipse(10, 18 - h - stage, 2 + stage, 1.5 + stage * 0.5, k.leaf[0]); P.px(8, 17 - h - stage, k.leaf[1]); }); });

  // ---- characters -------------------------------------------------------------------------
  // dir: 1 left 2 right. frame: 0 idle, 1 raise, 2 chop
  A.human = function (cfg, dir, frame) {
    return memo('hum' + JSON.stringify(cfg) + dir + frame, () => sprite(16, 20, (P) => {
      const { skin, hair, shirt, pants, hat } = cfg; const shirtD = Col.shade(shirt, 0.8), skinD = Col.shade(skin, 0.85);
      const lean = frame === 2 ? 1 : 0;
      P.rect(5, 14, 3, 4, pants); P.rect(8, 14, 3, 4, pants); P.rect(5, 18, 6, 1, '#3a2a20');
      P.rect(4 + lean, 9, 8, 5, shirt); P.rect(4 + lean, 13, 8, 1, shirtD); P.rect(6 + lean, 9, 1, 5, Col.shade(shirt, 0.7)); P.rect(9 + lean, 9, 1, 5, Col.shade(shirt, 0.7)); // plaid-ish
      P.rect(4 + lean, 2, 8, 7, skin); P.rect(4 + lean, 8, 8, 1, skinD);
      P.rect(4 + lean, 1, 8, 2, hair); if (dir === 1) { P.rect(11 + lean, 2, 2, 5, hair); P.px(5 + lean, 5, '#222'); } else { P.rect(3 + lean, 2, 2, 5, hair); P.px(10 + lean, 5, '#222'); }
      P.rect(6 + lean, 6, 4, 2, Col.shade(hair, 0.9)); // beard
      if (hat) { P.rect(2 + lean, 2, 12, 1, Col.shade(hat, 0.8)); P.rect(4 + lean, 0, 8, 2, hat); }
      // arms: raised or chopping
      const fx = dir === 2 ? 1 : -1;
      if (frame === 1) { P.rect(8 + fx * 2 + lean, 3, 2, 6, shirt); P.rect(8 + fx * 2 + lean, 2, 2, 2, skin); }
      else if (frame === 2) { P.rect(8 + fx * 4 + lean, 10, 3, 2, shirt); P.rect(8 + fx * 6 + lean, 10, 2, 2, skin); }
      else { P.rect(dir === 2 ? 12 : 3, 9, 1, 4, shirt); P.rect(dir === 2 ? 3 : 12, 9, 1, 4, shirt); }
    }));
  };
  A.axe = (frame) => memo('axe' + frame, () => sprite(14, 14, (P) => {
    if (frame === 1) { P.rect(6, 4, 2, 10, '#8a5a30'); P.rect(4, 0, 6, 5, '#b8c0c8'); P.rect(3, 1, 2, 3, '#d8e0e8'); P.rect(9, 0, 1, 5, '#6a727a'); }
    else { P.rect(0, 6, 10, 2, '#8a5a30'); P.rect(9, 3, 5, 7, '#b8c0c8'); P.rect(12, 2, 2, 9, '#d8e0e8'); P.rect(9, 9, 5, 1, '#6a727a'); }
  }));
  A.PLAYER = { skin: '#e8b898', hair: '#4a2a1a', shirt: '#c83a2a', pants: '#3a4a6a', hat: '#e9d8a6' };
  A.CREW = [
    { skin: '#c68b5a', hair: '#2a1a1a', shirt: '#2a6a9a', pants: '#3a3a4a', hat: '#d84a3a' },
    { skin: '#8a5a3a', hair: '#1a1a1a', shirt: '#4a8a3a', pants: '#2a3a5a', hat: '#e8c060' },
    { skin: '#f0c8a8', hair: '#c85a2a', shirt: '#e8a030', pants: '#5a4a3a', hat: null },
    { skin: '#d8a888', hair: '#8a8a9a', shirt: '#7a3a6a', pants: '#3a2a3a', hat: '#3a3a3a' },
    { skin: '#b87a5a', hair: '#4a3a2a', shirt: '#3a8a9a', pants: '#2a2a2a', hat: '#5a7a3a' },
    { skin: '#e8c0a0', hair: '#f0d070', shirt: '#a04a4a', pants: '#4a5a8a', hat: '#f0f0f0' },
  ];

  // ---- buildings & props ------------------------------------------------------------------
  A.mill = () => memo('mill', () => sprite(52, 40, (P) => {
    const wood = '#8a6238', woodD = '#6a4a2a';
    P.rect(4, 16, 44, 24, wood); for (let x = 4; x < 48; x += 5) P.vline(x, 16, 24, woodD);
    for (let y = 0; y < 16; y++) { const inset = Math.max(0, 6 - y / 2); P.hline(inset, y + 2, 52 - inset * 2, y % 3 ? '#9aa4aa' : '#7a848a'); }
    P.rect(8, 22, 12, 18, '#2a1e14'); // open door
    P.rect(24, 24, 20, 4, '#5a5a5a'); // saw table
    P.rect(30, 34, 14, 6, '#c8a068'); P.rect(30, 34, 14, 1, '#e0c080'); // plank stack
  }));
  A.blade = (f) => memo('blade' + f, () => sprite(16, 16, (P) => { P.disc(8, 8, 6.5, '#b8c0c8'); P.disc(8, 8, 2, '#4a4a4a'); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + f * 0.2; P.px(8 + Math.cos(a) * 7.2, 8 + Math.sin(a) * 7.2, '#e8f0f8'); P.px(8 + Math.cos(a + 0.3) * 5, 8 + Math.sin(a + 0.3) * 5, '#8a929a'); } }));
  A.wagon = () => memo('wagon', () => sprite(40, 24, (P) => {
    P.rect(4, 8, 30, 10, '#8a6238'); P.rect(4, 8, 30, 2, '#a8784a'); P.rect(4, 17, 30, 1, '#5a3a20');
    for (let i = 0; i < 4; i++) { P.ellipse(10 + i * 6, 8, 3, 2, '#b08050'); P.disc(10 + i * 6, 8, 1, '#e0c080'); }
    P.ellipse(10 + 6, 4, 3, 2, '#b08050'); P.ellipse(10 + 12, 4, 3, 2, '#b08050');
    P.disc(11, 19, 4, '#3a2a1a'); P.disc(29, 19, 4, '#3a2a1a'); P.disc(11, 19, 1.5, '#a8a8a8'); P.disc(29, 19, 1.5, '#a8a8a8');
    P.rect(34, 12, 6, 2, '#5a3a20');
  }));
  A.pile = (level) => memo('pile' + level, () => sprite(40, 24, (P) => {
    const rows = Math.min(5, level); let n = 0;
    for (let r = 0; r < rows; r++) { const cnt = 6 - r; for (let i = 0; i < cnt; i++) { const x = 2 + r * 3 + i * 6, y = 20 - r * 4; P.rect(x, y, 6, 4, '#a8784a'); P.rect(x, y, 6, 1, '#c8a068'); P.ellipse(x + 5, y + 2, 1.5, 1.5, '#d8b878'); n++; } }
  }));
  A.acorn = () => memo('acornsp', () => sprite(10, 12, (P) => { P.ellipse(5, 7, 3.5, 4, '#a8783a'); P.rect(1, 2, 8, 3, '#6a4a2a'); P.rect(2, 1, 6, 1, '#6a4a2a'); P.px(4, 0, '#6a4a2a'); P.px(3, 6, '#d0a060'); }));

  // ---- parallax backdrops ------------------------------------------------------------------
  A.hills = (w, h, seed, color, base, amp) => sprite(w, h, (P) => { const r = L.rng(seed); const a = r() * 6.28, b = r() * 6.28; for (let x = 0; x < w; x++) { const y = base + Math.sin(x / (18 + seed % 7) + a) * amp + Math.sin(x / 7 + b) * amp * 0.3; P.rect(x, Math.round(y), 1, h - Math.round(y), color); } });
  A.treeline = (w, h, seed, color, base) => sprite(w, h, (P) => { const r = L.rng(seed); for (let x = 0; x < w; x += 4 + r.int(4)) { const th = 8 + r.int(14), top = base - th; P.tri(x + 2, top, 6 + r.int(3), th + 2, color); } P.rect(0, base, w, h - base, color); });

  // ---- icons (16x16) -----------------------------------------------------------------------
  const icons = {
    coin: (P) => { P.disc(8, 8, 5.5, '#e0a020'); P.disc(8, 8, 4, '#f8d050'); P.rect(7, 5, 2, 6, '#e0a020'); },
    log: (P) => { P.rect(2, 5, 11, 6, '#a8784a'); P.rect(2, 5, 11, 1, '#c8a068'); P.ellipse(13, 8, 2, 3, '#d8b878'); P.px(13, 8, '#a8784a'); },
    plank: (P) => { P.rect(2, 4, 12, 3, '#d8b070'); P.rect(2, 9, 12, 3, '#d8b070'); P.rect(2, 4, 12, 1, '#f0d090'); P.rect(2, 9, 12, 1, '#f0d090'); P.px(5, 5, '#b89050'); P.px(10, 10, '#b89050'); },
    acorn: (P) => P.blit(A.acorn(), 3, 2),
    axe: (P) => { P.line(3, 13, 11, 5, '#8a5a30'); P.line(4, 13, 12, 5, '#a8784a'); P.rect(9, 1, 5, 6, '#b8c0c8'); P.rect(8, 2, 2, 4, '#d8e0e8'); P.rect(13, 1, 1, 6, '#6a727a'); },
    whetstone: (P) => { P.rect(3, 6, 10, 5, '#8a8a90'); P.rect(3, 6, 10, 1, '#b0b0b8'); P.rect(3, 10, 10, 1, '#5a5a60'); P.px(6, 8, '#c8c8d0'); P.line(10, 2, 13, 5, '#d8e0e8'); },
    worker: (P) => { P.rect(5, 2, 6, 5, '#e8b898'); P.rect(4, 1, 8, 2, '#d84a3a'); P.rect(4, 7, 8, 5, '#2a6a9a'); P.rect(5, 12, 2, 3, '#3a3a4a'); P.rect(9, 12, 2, 3, '#3a3a4a'); P.px(6, 4, '#222'); P.px(9, 4, '#222'); },
    book: (P) => { P.rect(3, 3, 10, 11, '#8a3a2a'); P.rect(5, 2, 9, 11, '#f4e8d0'); P.rect(7, 4, 5, 1, '#8a8a8a'); P.rect(7, 6, 5, 1, '#8a8a8a'); P.rect(7, 8, 3, 1, '#8a8a8a'); },
    coffee: (P) => { P.rect(3, 5, 9, 8, '#f4f4f4'); P.rect(4, 6, 7, 3, '#4a2a1a'); P.rect(12, 7, 2, 4, '#f4f4f4'); P.rect(3, 13, 9, 1, '#d0d0d0'); P.px(6, 2, '#c0c0c0'); P.px(8, 3, '#c0c0c0'); },
    sapling: (P) => { P.rect(5, 10, 6, 4, '#7a5232'); P.vline(8, 4, 6, '#4a9a3a'); P.ellipse(6, 5, 2, 1.5, '#6ad06a'); P.ellipse(10, 3, 2, 1.5, '#5cb84a'); },
    scale: (P) => { P.rect(7, 2, 2, 11, '#8a6a3a'); P.rect(2, 4, 12, 1, '#8a6a3a'); P.rect(1, 8, 5, 2, '#c8a068'); P.rect(10, 8, 5, 2, '#c8a068'); P.line(2, 5, 3, 8, '#8a6a3a'); P.line(13, 5, 12, 8, '#8a6a3a'); P.rect(5, 13, 6, 1, '#8a6a3a'); },
    wagon: (P) => { P.rect(2, 6, 11, 5, '#8a6238'); P.rect(2, 6, 11, 1, '#a8784a'); P.disc(4, 12, 2, '#3a2a1a'); P.disc(11, 12, 2, '#3a2a1a'); P.ellipse(5, 6, 2, 1.5, '#b08050'); P.ellipse(9, 6, 2, 1.5, '#b08050'); },
    mill: (P) => { P.rect(2, 7, 12, 8, '#8a6238'); for (let y = 0; y < 6; y++) P.hline(2 + (5 - y), 2 + y, 12 - (5 - y) * 2, y % 2 ? '#9aa4aa' : '#7a848a'); P.disc(10, 11, 2.5, '#b8c0c8'); P.px(10, 11, '#4a4a4a'); },
    stats: (P) => { P.rect(2, 9, 3, 5, '#7cc45c'); P.rect(6, 6, 3, 8, '#7cc45c'); P.rect(10, 2, 3, 12, '#7cc45c'); },
    trophy: (P) => { P.rect(5, 2, 6, 6, '#f8d050'); P.rect(4, 2, 8, 1, '#e0a020'); P.rect(7, 8, 2, 3, '#e0a020'); P.rect(5, 11, 6, 2, '#e0a020'); P.px(3, 3, '#f8d050'); P.px(12, 3, '#f8d050'); P.px(3, 5, '#f8d050'); P.px(12, 5, '#f8d050'); },
    settings: (P) => { P.disc(8, 8, 5, '#e8e8e8'); P.disc(8, 8, 2, '#4a4a4a'); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) P.rect(x - 1, y - 1, 3, 3, '#e8e8e8'); },
    sound_on: (P) => { P.rect(3, 6, 3, 4, '#e8e8e8'); P.rect(6, 4, 2, 8, '#e8e8e8'); P.px(8, 3, '#e8e8e8'); P.px(8, 12, '#e8e8e8'); P.px(11, 5, '#e8e8e8'); P.px(12, 7, '#e8e8e8'); P.px(12, 8, '#e8e8e8'); P.px(11, 10, '#e8e8e8'); },
    sound_off: (P) => { P.rect(3, 6, 3, 4, '#e8e8e8'); P.rect(6, 4, 2, 8, '#e8e8e8'); P.px(8, 3, '#e8e8e8'); P.px(8, 12, '#e8e8e8'); P.line(10, 5, 14, 10, '#e05a4a'); P.line(14, 5, 10, 10, '#e05a4a'); },
    check: (P) => { P.line(3, 8, 6, 11, '#6ad06a'); P.line(6, 11, 13, 4, '#6ad06a'); P.line(3, 9, 6, 12, '#6ad06a'); P.line(6, 12, 13, 5, '#6ad06a'); },
    x: (P) => { P.line(4, 4, 12, 12, '#e05a4a'); P.line(12, 4, 4, 12, '#e05a4a'); P.line(5, 4, 12, 11, '#e05a4a'); P.line(11, 4, 4, 11, '#e05a4a'); },
    lock: (P) => { P.rect(4, 7, 8, 7, '#8a8a90'); P.rect(5, 3, 6, 5, 'rgba(0,0,0,0)'); P.rect(5, 3, 1, 5, '#b0b0b8'); P.rect(10, 3, 1, 5, '#b0b0b8'); P.rect(5, 3, 6, 1, '#b0b0b8'); P.px(8, 10, '#3a3a3a'); },
    tree: (P) => { P.rect(7, 10, 2, 5, '#6b4a2b'); P.tri(8, 1, 12, 10, '#3f8a4a'); P.tri(8, 4, 8, 7, '#2f6e3a'); },
    forest: (P) => { P.rect(3, 11, 2, 4, '#6b4a2b'); P.tri(4, 4, 8, 8, '#3f8a4a'); P.rect(10, 10, 2, 5, '#6b4a2b'); P.tri(11, 1, 10, 10, '#2f6e3a'); },
    zzz: (P) => { P.rect(3, 10, 4, 1, '#fff'); P.line(6, 10, 3, 13, '#fff'); P.rect(3, 13, 4, 1, '#fff'); P.rect(9, 4, 5, 1, '#fff'); P.line(13, 4, 9, 8, '#fff'); P.rect(9, 8, 5, 1, '#fff'); },
    lang: (P) => { P.rect(2, 3, 12, 9, '#f4f4f4'); P.rect(2, 3, 12, 1, '#c8c8c8'); P.rect(4, 5, 3, 1, '#4a4a4a'); P.rect(4, 7, 8, 1, '#4a4a4a'); P.rect(4, 9, 6, 1, '#4a4a4a'); },
    star: (P) => { P.px(8, 3, '#fff'); P.px(8, 13, '#fff'); P.rect(6, 7, 5, 3, '#f8d050'); P.rect(7, 5, 3, 7, '#f8d050'); P.px(5, 8, '#f8d050'); P.px(11, 8, '#f8d050'); },
  };
  A.icon = (name) => memo('icon:' + name, () => sprite(16, 16, (P) => { const f = icons[name]; if (f) f(P); else P.rect(3, 3, 10, 10, '#f0f'); }));
})();
