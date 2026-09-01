/* Cafetal — 10_sprites.js
   Procedural pixel art. Nothing is loaded from disk: every tile, character,
   crop, building, animal and icon is drawn into an offscreen canvas at startup. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp, lerp } = C.math;
  const Col = C.color;
  const T = C.TILE;

  // ---- tiny pixel drawing kit --------------------------------------------
  function sprite(w, h, fn) {
    const cv = C.canvas(w, h);
    const g = C.ctx2d(cv);
    const P = {
      w, h, g, cv,
      px(x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
      hline(x, y, w, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, 1); },
      vline(x, y, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, h | 0); },
      disc(cx, cy, r, c) {
        g.fillStyle = c;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
          }
      },
      ellipse(cx, cy, rx, ry, c) {
        g.fillStyle = c;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
          }
      },
      line(x0, y0, x1, y1, c) {
        g.fillStyle = c;
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          g.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      blit(img, x, y) { g.drawImage(img, x | 0, y | 0); },
      outline(c) { // 1px outline around all opaque pixels
        const id = g.getImageData(0, 0, w, h), d = id.data, out = [];
        const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (solid(x, y)) continue;
          if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out.push([x, y]);
        }
        g.fillStyle = c; for (const [x, y] of out) g.fillRect(x, y, 1, 1);
      },
    };
    fn(P, g);
    return cv;
  }
  C.sprite = sprite;

  const SP = (C.sprites = {});
  const cache = new Map();
  function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }
  SP.memo = memo;

  // ---- palettes -----------------------------------------------------------
  SP.season = {
    spring: { grass: ['#6db150', '#63a848', '#73b858'], grassDark: '#4f8c3a', leaf: ['#5da84a', '#7cc45c', '#4b9139'], blossom: '#f4b6d0', dirt: '#b08a5a' },
    summer: { grass: ['#5fa845', '#57a03e', '#66b04c'], grassDark: '#47843a', leaf: ['#3f8f3a', '#5aa64a', '#2f7a30'], blossom: null, dirt: '#b08a5a' },
    autumn: { grass: ['#9fa84a', '#97a044', '#a8b052'], grassDark: '#7a8438', leaf: ['#d08a3a', '#c86a3a', '#e0a840'], blossom: null, dirt: '#a8825a' },
    winter: { grass: ['#dfe6e8', '#d6dee0', '#e6ecee'], grassDark: '#b8c4c8', leaf: ['#8a9a8a', '#a8b8a8', '#7a8a7a'], blossom: '#ffffff', dirt: '#9a8a7a' },
  };

  // ---- ground tiles ---------------------------------------------------------
  // returns {grass:[cv..], dirt:[cv..], soil, soilWet, water:[frames], sand, wood, stone, concrete, snow}
  SP.tiles = function (season) {
    return memo('tiles:' + season, () => {
      const pal = SP.season[season];
      const t = {};
      t.grass = [0, 1, 2, 3].map((v) => sprite(T, T, (P) => {
        const r = C.rng(100 + v);
        P.rect(0, 0, T, T, pal.grass[0]);
        for (let i = 0; i < 26; i++) P.px(r.int(T), r.int(T), pal.grass[1 + r.int(2)]);
        for (let i = 0; i < 4 + v; i++) { const x = r.int(T), y = r.int(T - 2); P.vline(x, y, 2, pal.grassDark); }
        if (season === 'spring' && v === 3) { P.px(r.int(T), r.int(T), '#fff'); P.px(r.int(T), r.int(T), '#f8e070'); }
        if (season === 'autumn' && v >= 2) { P.px(r.int(T), r.int(T), '#d08a3a'); }
      }));
      t.dirt = [0, 1, 2].map((v) => sprite(T, T, (P) => {
        const r = C.rng(200 + v);
        P.rect(0, 0, T, T, pal.dirt);
        for (let i = 0; i < 18; i++) P.px(r.int(T), r.int(T), Col.shade(pal.dirt, 0.9));
        for (let i = 0; i < 6; i++) P.px(r.int(T), r.int(T), Col.lighten(pal.dirt, 0.15));
        if (season === 'winter') for (let i = 0; i < 10; i++) P.px(r.int(T), r.int(T), '#eef2f4');
      }));
      t.soil = sprite(T, T, (P) => {
        const r = C.rng(300);
        P.rect(0, 0, T, T, '#7a5232');
        for (let y = 1; y < T; y += 4) P.hline(0, y, T, '#6a4428');
        for (let i = 0; i < 12; i++) P.px(r.int(T), r.int(T), '#8a6040');
      });
      t.soilWet = sprite(T, T, (P) => {
        const r = C.rng(301);
        P.rect(0, 0, T, T, '#4e3420');
        for (let y = 1; y < T; y += 4) P.hline(0, y, T, '#432c1a');
        for (let i = 0; i < 10; i++) P.px(r.int(T), r.int(T), '#5c3e28');
      });
      t.water = [0, 1, 2, 3].map((f) => sprite(T, T, (P) => {
        const base = season === 'winter' ? '#6a9ab8' : '#4a8fc0';
        P.rect(0, 0, T, T, base);
        const r = C.rng(400);
        for (let i = 0; i < 5; i++) {
          const x = (r.int(T) + f * 2) % T, y = (r.int(T) + f) % T;
          P.hline(x, y, 3, Col.lighten(base, 0.25)); P.px(x + 1, y, Col.lighten(base, 0.45));
        }
        for (let i = 0; i < 4; i++) P.px(r.int(T), r.int(T), Col.shade(base, 0.85));
      }));
      t.sand = sprite(T, T, (P) => { const r = C.rng(500); P.rect(0, 0, T, T, '#d8c48a'); for (let i = 0; i < 14; i++) P.px(r.int(T), r.int(T), '#c8b47a'); });
      t.wood = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#a8784a'); for (let y = 0; y < T; y += 4) P.hline(0, y, T, '#8a5e38'); P.px(3, 2, '#6a4a2a'); P.px(11, 10, '#6a4a2a'); });
      t.stone = sprite(T, T, (P) => { const r = C.rng(600); P.rect(0, 0, T, T, '#9a9a94'); P.hline(0, 7, T, '#7a7a74'); P.vline(7, 0, 8, '#7a7a74'); P.vline(3, 8, 8, '#7a7a74'); P.vline(12, 8, 8, '#7a7a74'); for (let i = 0; i < 6; i++) P.px(r.int(T), r.int(T), '#aaaaa4'); });
      t.concrete = sprite(T, T, (P) => { const r = C.rng(700); P.rect(0, 0, T, T, '#c9c2b4'); for (let i = 0; i < 12; i++) P.px(r.int(T), r.int(T), '#bcb5a6'); P.hline(0, 0, T, '#b0a898'); P.vline(0, 0, T, '#b0a898'); });
      t.porch = sprite(T, T, (P) => { P.rect(0, 0, T, T, '#b98a5a'); for (let x = 0; x < T; x += 4) P.vline(x, 0, T, '#9a6e44'); });
      t.puddle = sprite(T, T, (P) => { P.ellipse(8, 8, 6, 4, 'rgba(90,140,200,0.55)'); P.ellipse(7, 7, 3, 1.5, 'rgba(200,230,255,0.35)'); });
      return t;
    });
  };

  // ---- humanoid characters ------------------------------------------------
  // cfg: {skin,hair,shirt,pants,hat,shoes}, dir: 0 down 1 left 2 right 3 up, frame: 0..2 (0 idle)
  SP.humanoid = function (cfg, dir, frame) {
    const key = 'hum:' + JSON.stringify(cfg) + dir + frame;
    return memo(key, () => sprite(16, 20, (P) => {
      const skin = cfg.skin, hair = cfg.hair, shirt = cfg.shirt, pants = cfg.pants, shoes = cfg.shoes || '#3a2a20';
      const hairD = Col.shade(hair, 0.75), shirtD = Col.shade(shirt, 0.8), skinD = Col.shade(skin, 0.85);
      const bob = frame === 0 ? 0 : (frame === 1 ? -1 : 0);
      const lA = frame === 1 ? -1 : frame === 2 ? 1 : 0; // leg offset
      // legs
      P.rect(5, 14 + bob, 3, 4, pants); P.rect(8, 14 + bob, 3, 4, pants);
      if (dir === 1 || dir === 2) { P.rect(5, 14 + bob + lA, 3, 4, pants); P.rect(8, 14 + bob - lA, 3, 4, pants); }
      else { P.rect(5, 14 + bob + lA, 3, 4, pants); P.rect(8, 14 + bob - lA, 3, 4, pants); }
      P.rect(5, 18 + bob + (dir < 3 ? lA : 0), 3, 1, shoes); P.rect(8, 18 + bob - (dir < 3 ? lA : 0), 3, 1, shoes);
      P.rect(5, 18 + bob, 6, 1, shoes);
      // body
      P.rect(4, 9 + bob, 8, 5, shirt);
      P.rect(4, 13 + bob, 8, 1, shirtD);
      // arms
      const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      P.rect(3, 9 + bob + swing, 1, 4, shirt); P.rect(12, 9 + bob - swing, 1, 4, shirt);
      P.px(3, 13 + bob + swing, skin); P.px(12, 13 + bob - swing, skin);
      // head
      P.rect(4, 2 + bob, 8, 7, skin);
      P.rect(4, 8 + bob, 8, 1, skinD);
      // hair
      P.rect(4, 1 + bob, 8, 2, hair); P.rect(3, 2 + bob, 1, 4, hair); P.rect(12, 2 + bob, 1, 4, hair);
      P.rect(4, 3 + bob, 8, 1, hairD);
      if (dir === 3) { P.rect(4, 3 + bob, 8, 5, hair); P.rect(4, 7 + bob, 8, 1, hairD); }
      // face
      if (dir === 0) { P.px(6, 5 + bob, '#222'); P.px(9, 5 + bob, '#222'); P.px(7, 7 + bob, skinD); P.px(8, 7 + bob, skinD); }
      if (dir === 1) { P.px(5, 5 + bob, '#222'); P.rect(11, 2 + bob, 2, 5, hair); }
      if (dir === 2) { P.px(10, 5 + bob, '#222'); P.rect(3, 2 + bob, 2, 5, hair); }
      // hat
      if (cfg.hat) {
        const hat = cfg.hat, hatD = Col.shade(hat, 0.8);
        P.rect(2, 2 + bob, 12, 1, hatD); P.rect(4, 0 + bob, 8, 2, hat); P.rect(4, 1 + bob, 8, 1, hatD);
      }
      // apron for the barista look
      if (cfg.apron) { P.rect(5, 11 + bob, 6, 3, cfg.apron); P.px(5, 10 + bob, cfg.apron); P.px(10, 10 + bob, cfg.apron); }
    }));
  };

  // ---- crops ----------------------------------------------------------------
  // Each crop: canvas 16x24 (bottom 16 rows over the tile, top 8 overhang)
  SP.crop = function (type, stage, wet) {
    return memo('crop:' + type + stage, () => sprite(16, 24, (P) => {
      const g1 = '#3f9a3a', g2 = '#5cb84a', g3 = '#2f7a2c';
      const base = 24; // ground line at bottom
      if (stage === 0) { // sprout
        P.vline(8, base - 4, 3, g1); P.px(7, base - 4, g2); P.px(9, base - 5, g2); return;
      }
      if (type === 'tomato') {
        const h = [0, 6, 9, 11, 11][stage];
        P.vline(8, base - h, h, g3); P.vline(7, base - h + 2, 2, g3);
        for (let i = 0; i < stage * 2 + 1; i++) { const y = base - 2 - i * 2, x = 8 + (i % 2 ? 2 : -2); P.rect(x - 1, y - 1, 3, 2, i % 2 ? g1 : g2); }
        if (stage === 3) { P.px(6, base - 7, '#f8e050'); P.px(11, base - 9, '#f8e050'); }
        if (stage === 4) { P.disc(6, base - 7, 1.5, '#d83a2a'); P.disc(11, base - 9, 1.5, '#e04a30'); P.disc(9, base - 4, 1.3, '#d83a2a'); P.px(6, base - 8, '#fff'); }
      } else if (type === 'corn') {
        const h = [0, 8, 13, 18, 21][stage];
        P.vline(8, base - h, h, '#6aa83a'); P.vline(7, base - h + 3, h - 3, '#5a983a');
        for (let i = 1; i < stage + 2; i++) { const y = base - i * 4; P.line(8, y, 8 - 4, y - 3, g2); P.line(8, y - 2, 8 + 4, y - 5, g1); }
        if (stage >= 3) { P.rect(10, base - 12, 3, 6, '#e8d060'); P.rect(10, base - 13, 3, 2, '#c8b850'); }
        if (stage === 4) { P.rect(4, base - 14, 3, 6, '#f0d868'); P.px(5, base - 15, '#8a6a3a'); P.px(11, base - 14, '#8a6a3a'); P.rect(6, base - 22, 4, 3, '#d8c870'); }
      } else if (type === 'sunflower') {
        const h = [0, 7, 12, 17, 20][stage];
        P.vline(8, base - h, h, '#4a8a3a');
        for (let i = 1; i < stage + 1; i++) { const y = base - i * 4; P.rect(4, y, 4, 2, g2); P.rect(9, y - 2, 4, 2, g1); }
        if (stage === 3) { P.disc(8, base - h, 2.5, '#6a8a3a'); P.px(8, base - h - 3, '#e8c040'); }
        if (stage === 4) { P.disc(8, base - h, 5, '#f0c020'); P.disc(8, base - h, 2.8, '#6a4020'); P.px(7, base - h - 1, '#8a5a30'); }
      } else if (type === 'coffee') {
        // coffee tree: 0 seedling 1 small 2 bush 3 tree 4 flowering 5 ripe
        if (stage === 1) { P.vline(8, base - 6, 6, '#6a4a2a'); P.disc(8, base - 7, 2.5, g3); P.px(7, base - 8, g2); return; }
        const dark = '#2d6b2a', mid = '#3e8a36', lit = '#58a648';
        P.rect(7, base - 12, 2, 12, '#6a4a2a');
        if (stage === 2) { P.ellipse(8, base - 10, 5, 5, dark); P.ellipse(7, base - 11, 3, 3, mid); P.px(9, base - 13, lit); }
        else {
          P.ellipse(8, base - 13, 7, 8, dark); P.ellipse(6, base - 14, 4, 5, mid); P.ellipse(10, base - 11, 4, 4, mid); P.px(5, base - 17, lit); P.px(11, base - 14, lit); P.px(8, base - 19, lit);
          if (stage === 4) { for (const [x, y] of [[4, 12], [10, 17], [12, 11], [7, 9], [9, 15], [5, 8]]) { P.px(x, base - y, '#fff'); P.px(x + 1, base - y, '#fff5f8'); } }
          if (stage === 5) { for (const [x, y] of [[4, 12], [10, 17], [12, 11], [7, 9], [9, 15], [5, 8], [11, 14], [6, 16]]) { P.px(x, base - y, '#d42a2a'); P.px(x + 1, base - y, '#ef4040'); P.px(x, base - y + 1, '#a01c1c'); P.px(x + 1, base - y + 1, '#d42a2a'); } }
        }
      }
    }));
  };

  // ---- trees, bushes, flora --------------------------------------------------
  SP.tree = function (seed, season, kind) { // kind: 'leaf' | 'pine'
    return memo('tree:' + seed + season + kind, () => sprite(24, 32, (P) => {
      const r = C.rng(seed);
      const pal = SP.season[season];
      const trunk = '#6b4a2b', trunkD = '#4e3620';
      if (kind === 'pine') {
        P.rect(11, 22, 2, 10, trunk); P.px(11, 26, trunkD);
        const c1 = season === 'winter' ? '#5f7f6a' : '#2f6e3a', c2 = season === 'winter' ? '#7d9d88' : '#3f8a4a';
        for (let i = 0; i < 4; i++) { const y = 8 + i * 5, w = 4 + i * 2.2; P.ellipse(12, y + 2, w, 3, i % 2 ? c1 : c2); }
        P.rect(11, 3, 2, 5, c2); P.px(12, 2, c2);
        if (season === 'winter') for (let i = 0; i < 4; i++) { const y = 10 + i * 5; P.hline(12 - i * 2 - 2, y, 4 + i * 4, '#f4f8fa'); }
        return;
      }
      P.rect(10, 20, 4, 12, trunk); P.vline(10, 20, 12, trunkD); P.px(12, 27, trunkD);
      const leaf = pal.leaf;
      const blobs = [[12, 12, 9, 8], [7 + r.int(3), 15, 6, 5], [15 + r.int(3), 14, 6, 5], [12, 7 + r.int(2), 6, 5]];
      blobs.forEach((b, i) => P.ellipse(b[0], b[1], b[2], b[3], leaf[i % 2 ? 1 : 0]));
      P.ellipse(10, 10, 4, 3, leaf[2]);
      for (let i = 0; i < 6; i++) P.px(4 + r.int(16), 6 + r.int(12), leaf[2]);
      for (let i = 0; i < 5; i++) P.px(4 + r.int(16), 5 + r.int(10), Col.lighten(leaf[1], 0.15));
      if (pal.blossom) for (let i = 0; i < 7; i++) P.px(5 + r.int(14), 6 + r.int(12), pal.blossom);
      if (season === 'winter') { P.ellipse(12, 6, 6, 2, '#f4f8fa'); P.ellipse(8, 11, 3, 1.5, '#f4f8fa'); }
      if (season === 'autumn') { P.px(3 + r.int(4), 24 + r.int(6), '#d08a3a'); P.px(16 + r.int(5), 26 + r.int(5), '#c86a3a'); }
    }));
  };

  SP.bush = (seed, season) => memo('bush' + seed + season, () => sprite(16, 16, (P) => {
    const r = C.rng(seed); const leaf = SP.season[season].leaf;
    P.ellipse(8, 10, 7, 5, leaf[0]); P.ellipse(6, 9, 4, 3, leaf[1]); P.px(10, 7, leaf[2]); P.px(4, 11, leaf[2]);
    if (season !== 'winter') for (let i = 0; i < 3; i++) P.px(3 + r.int(10), 7 + r.int(6), r.chance(0.5) ? '#e04a3a' : Col.lighten(leaf[1], 0.2));
  }));
  SP.flower = (seed) => memo('flower' + seed, () => sprite(16, 16, (P) => {
    const r = C.rng(seed); const cols = ['#f06a8a', '#f8d050', '#ffffff', '#b08af0', '#f89050'];
    for (let i = 0; i < 3; i++) { const x = 3 + r.int(10), y = 6 + r.int(7); P.vline(x, y, 4, '#4a9a3a'); const c = r.pick(cols); P.px(x - 1, y - 1, c); P.px(x + 1, y - 1, c); P.px(x, y - 2, c); P.px(x, y, c); P.px(x, y - 1, '#f8e070'); }
  }));
  SP.mint = () => memo('mint', () => sprite(16, 16, (P) => {
    for (let i = 0; i < 4; i++) { const x = 3 + i * 3, y = 8 + (i % 2) * 2; P.vline(x, y, 5, '#3a8a3a'); P.rect(x - 1, y - 2, 3, 3, '#6ad06a'); P.px(x, y - 2, '#a0f0a0'); }
  }));
  SP.rock = (seed) => memo('rock' + seed, () => sprite(16, 16, (P) => {
    const r = C.rng(seed); P.ellipse(8, 10, 5 + r.int(2), 4, '#8a8a84'); P.ellipse(7, 9, 3, 2, '#a4a49e'); P.px(6, 8, '#bcbcb6'); P.hline(4, 13, 8, '#6a6a64');
  }));
  SP.stump = () => memo('stump', () => sprite(16, 16, (P) => { P.rect(4, 8, 8, 6, '#6b4a2b'); P.ellipse(8, 8, 4.5, 2.5, '#a8804a'); P.ellipse(8, 8, 2.5, 1.2, '#8a6a3a'); }));
  SP.lily = () => memo('lily', () => sprite(16, 16, (P) => { P.ellipse(7, 8, 4, 3, '#3f9a4a'); P.px(9, 6, '#4a8fc0'); P.px(10, 8, '#f890b0'); P.px(11, 7, '#f890b0'); }));
  SP.reeds = () => memo('reeds', () => sprite(16, 16, (P) => { for (let i = 0; i < 4; i++) { const x = 3 + i * 3; P.vline(x, 4 + (i % 2) * 2, 10, '#6a9a4a'); P.rect(x, 3 + (i % 2) * 2, 1, 3, '#8a6a3a'); } }));

  // ---- buildings & stations ------------------------------------------------
  SP.house = () => memo('house', () => sprite(7 * T, 7 * T, (P) => {
    // 7 tiles wide, 7 tall (top 1.5 tiles = roof overhang). Ground footprint rows 2..6.
    const wall = '#efe2c4', wallD = '#d8c8a4', roof = '#b8503a', roofD = '#8e3a2a', roofL = '#d0685a', wood = '#7a5230';
    P.rect(4, 40, 104, 68, wall);
    P.rect(4, 100, 104, 8, wallD); // base shadow
    // roof
    for (let y = 0; y < 44; y++) { const inset = Math.max(0, 8 - y / 2); P.hline(inset, y + 2, 112 - inset * 2, y % 4 === 0 ? roofD : (y % 4 === 2 ? roofL : roof)); }
    P.hline(0, 46, 112, roofD); P.hline(0, 45, 112, roofD);
    // windows
    const win = (x, y) => { P.rect(x, y, 14, 12, wood); P.rect(x + 2, y + 2, 10, 8, '#8ac0e0'); P.vline(x + 6, y + 2, 8, wood); P.hline(x + 2, y + 6, 10, wood); P.rect(x - 1, y + 12, 16, 2, '#c8b48a'); };
    win(14, 58); win(84, 58); win(14, 80); win(84, 80);
    // door
    P.rect(46, 74, 20, 34, wood); P.rect(48, 76, 16, 30, '#8a6238'); P.px(60, 92, '#f0d060'); P.rect(48, 76, 16, 2, '#6a4a2a');
    // chimney
    P.rect(84, 0, 10, 20, '#8a7a6a'); P.rect(84, 0, 10, 3, '#6a5a4a');
    // porch light
    P.rect(70, 66, 4, 5, '#3a3a3a'); P.px(71, 68, '#ffe080'); P.px(72, 68, '#ffe080');
    // flower boxes
    P.rect(12, 92, 18, 4, wood); P.px(14, 90, '#f06a8a'); P.px(18, 90, '#f8d050'); P.px(22, 90, '#f06a8a'); P.px(26, 90, '#ffffff');
    P.rect(82, 92, 18, 4, wood); P.px(84, 90, '#f8d050'); P.px(88, 90, '#f06a8a'); P.px(92, 90, '#ffffff'); P.px(96, 90, '#f8d050');
  }));

  SP.shed = () => memo('shed', () => sprite(5 * T, 5 * T, (P) => {
    const wood = '#8a6238', woodD = '#6a4a2a', tin = '#9aa4aa', tinD = '#7a848a';
    P.rect(4, 28, 72, 52, wood);
    for (let x = 4; x < 76; x += 6) P.vline(x, 28, 52, woodD);
    for (let y = 0; y < 28; y++) { const inset = Math.max(0, 6 - y / 2); P.hline(inset, y + 2, 80 - inset * 2, y % 3 === 0 ? tinD : tin); }
    P.hline(0, 30, 80, tinD);
    // open front (dark interior) with roaster inside
    P.rect(22, 44, 36, 36, '#3a2a1e');
    // roaster: drum on a stand
    P.rect(30, 70, 20, 8, '#4a4a4a'); P.ellipse(40, 62, 9, 7, '#6a6a70'); P.ellipse(40, 62, 6, 4, '#8a8a90'); P.disc(40, 62, 2, '#ff9a30');
    P.rect(48, 52, 4, 10, '#5a5a5a'); P.px(49, 50, '#8a8a8a');
    P.rect(26, 74, 4, 6, '#d8b88a'); P.rect(52, 74, 4, 6, '#d8b88a'); // sacks
    // sign
    P.rect(56, 34, 18, 8, '#e8d8b8'); P.px(60, 37, '#3a2a1e'); P.px(63, 37, '#3a2a1e'); P.px(66, 37, '#3a2a1e'); P.px(69, 37, '#3a2a1e');
  }));

  // Counter body: 5x3 tiles. Row 0 = open space with posts (player stands here), rows 1-2 = counter.
  SP.counter = () => memo('counter', () => sprite(5 * T, 3 * T, (P) => {
    const wood = '#a06a3a', woodD = '#7a4a2a';
    // posts
    P.rect(1, 0, 3, 30, woodD); P.rect(76, 0, 3, 30, woodD);
    // counter body
    P.rect(0, 20, 80, 24, wood); P.rect(0, 18, 80, 3, '#c8905a'); P.rect(0, 44, 80, 4, woodD);
    for (let x = 6; x < 80; x += 12) P.vline(x, 24, 18, woodD);
    // espresso machine
    P.rect(8, 8, 14, 12, '#c0c0c8'); P.rect(9, 5, 12, 4, '#a0a0a8'); P.px(12, 12, '#ff4040'); P.rect(14, 15, 4, 4, '#3a3a3a'); P.px(19, 10, '#4a4a4a');
    // cups
    P.rect(58, 12, 5, 6, '#fff'); P.rect(65, 12, 5, 6, '#fff'); P.px(63, 14, '#fff'); P.px(70, 14, '#fff');
    P.rect(58, 10, 12, 1, '#c8b8a8');
    // chalkboard on the counter front
    P.rect(30, 24, 20, 14, '#2a3a2a'); P.rect(31, 25, 18, 12, '#1f2e22'); P.hline(33, 28, 8, '#e8e0c0'); P.hline(33, 31, 12, '#e8e0c0'); P.hline(33, 34, 6, '#f0d070');
  }));
  // Awning: drawn on the overlay layer above everything. 80 x 18.
  SP.awning = (lights) => memo('awning' + !!lights, () => sprite(5 * T, 18, (P) => {
    const cream = '#f4e8d0';
    P.hline(0, 1, 80, '#7a4a2a');
    for (let x = 0; x < 80; x += 8) P.rect(x, 2, 8, 12, (x / 8) % 2 ? '#e05a4a' : cream);
    for (let x = 0; x < 80; x += 8) P.rect(x, 13, 8, 3, (x / 8) % 2 ? '#c04a3a' : '#e0d4b8');
    for (let x = 4; x < 80; x += 8) P.px(x, 16, (x / 8 | 0) % 2 ? '#c04a3a' : '#e0d4b8');
    if (lights) { for (let x = 6; x < 80; x += 8) { P.px(x, 17, ['#ffd060', '#ff8080', '#80e0ff', '#c0ff80'][((x - 6) / 8) % 4]); P.px(x, 16, '#3a3a3a'); } }
  }));

  SP.cart = () => memo('cart', () => sprite(3 * T, 3 * T, (P) => {
    const wood = '#a06a3a', woodD = '#7a4a2a';
    // canopy
    for (let x = 0; x < 48; x += 6) P.rect(x, 2, 6, 10, (x / 6) % 2 ? '#e8a030' : '#f4e8d0');
    P.hline(0, 12, 48, woodD);
    P.rect(4, 12, 2, 20, woodD); P.rect(42, 12, 2, 20, woodD);
    P.rect(2, 26, 44, 14, wood); P.rect(2, 24, 44, 3, '#c8905a');
    P.disc(10, 44, 4, '#4a3a2a'); P.disc(38, 44, 4, '#4a3a2a'); P.disc(10, 44, 1.5, '#8a7a6a'); P.disc(38, 44, 1.5, '#8a7a6a');
    // goods
    P.rect(8, 18, 6, 6, '#e8d8a0'); P.rect(16, 18, 6, 6, '#d8b060'); P.rect(24, 18, 6, 6, '#c8a878'); P.rect(32, 19, 8, 5, '#f0f0f0');
    P.px(10, 20, '#d83a2a'); P.px(18, 20, '#3a8a3a'); P.px(26, 20, '#8a4a2a');
  }));

  SP.pulper = () => memo('pulper', () => sprite(T, 24, (P) => {
    P.rect(3, 10, 10, 12, '#6a6a70'); P.rect(2, 4, 12, 7, '#8a8a90'); P.rect(4, 2, 8, 3, '#9a9aa0'); P.rect(5, 1, 6, 2, '#b8332a');
    P.rect(13, 8, 2, 6, '#4a4a4a'); P.px(14, 7, '#c8c8c8'); P.rect(0, 20, 16, 4, '#5a4a3a'); P.px(6, 16, '#d83a2a'); P.px(8, 17, '#d83a2a');
  }));

  SP.patio = (w, h, roof) => memo('patio' + w + h + roof, () => sprite(w * T, h * T + 16, (P) => {
    // low wall
    const oy = 16;
    P.rect(0, oy, w * T, h * T, '#c9c2b4');
    P.rect(0, oy, w * T, 3, '#8a7a6a'); P.rect(0, oy + h * T - 3, w * T, 3, '#8a7a6a');
    P.rect(0, oy, 3, h * T, '#8a7a6a'); P.rect(w * T - 3, oy, 3, h * T, '#8a7a6a');
    if (roof) {
      for (const x of [2, w * T - 5]) for (const y of [oy + 4, oy + h * T - 10]) P.rect(x, y, 3, 6, '#5a4a3a');
      for (let y = 0; y < 12; y++) P.hline(0, y + 2, w * T, y % 3 === 0 ? '#7a848a' : 'rgba(154,164,170,0.75)');
    }
  }));
  SP.parchmentDots = (n, w, h, dry) => memo('pd' + n + w + h + dry, () => sprite(w * T, h * T, (P) => {
    const r = C.rng(77);
    for (let i = 0; i < n; i++) { const x = 5 + r.int(w * T - 10), y = 5 + r.int(h * T - 10); P.rect(x, y, 2, 1, dry ? '#a8c87a' : '#e8d8a8'); }
  }));

  SP.coop = () => memo('coop', () => sprite(2 * T, 2 * T + 8, (P) => {
    const wood = '#9a6a3a', woodD = '#7a4a2a';
    P.rect(2, 16, 28, 22, wood); for (let x = 2; x < 30; x += 5) P.vline(x, 16, 22, woodD);
    for (let y = 0; y < 14; y++) { const inset = Math.max(0, 6 - y / 2); P.hline(inset, y + 4, 32 - inset * 2, y % 3 ? '#b8503a' : '#8e3a2a'); }
    P.rect(12, 26, 8, 12, '#3a2a1e'); P.rect(20, 34, 12, 4, '#c8a878');
  }));

  SP.fence = (kind) => memo('fence' + kind, () => sprite(T, T, (P) => {
    const w = '#c8a068', d = '#9a7a4a';
    if (kind === 'h' || kind === 'x') { P.rect(0, 6, 16, 2, w); P.rect(0, 11, 16, 2, w); }
    if (kind === 'v' || kind === 'x') { P.rect(7, 0, 2, 16, w); }
    P.rect(6, 3, 4, 11, w); P.rect(6, 3, 4, 1, '#e0c080'); P.rect(6, 13, 4, 1, d);
  }));
  SP.lantern = (on) => memo('lantern' + on, () => sprite(T, 24, (P) => {
    P.rect(7, 8, 2, 16, '#4a4a4a'); P.rect(5, 2, 6, 7, '#3a3a3a'); P.rect(6, 3, 4, 5, on ? '#ffe080' : '#a0a0a0'); P.px(7, 0, '#3a3a3a'); P.px(8, 1, '#3a3a3a');
  }));
  SP.bench = () => memo('bench', () => sprite(2 * T, T, (P) => {
    P.rect(2, 4, 28, 3, '#a8784a'); P.rect(2, 9, 28, 3, '#a8784a'); P.rect(3, 12, 2, 4, '#5a4a3a'); P.rect(27, 12, 2, 4, '#5a4a3a'); P.rect(2, 1, 28, 2, '#a8784a');
  }));
  SP.mailbox = (flag) => memo('mailbox' + flag, () => sprite(T, 24, (P) => {
    P.rect(7, 12, 2, 12, '#6a4a2a'); P.rect(3, 5, 10, 8, '#4a6a9a'); P.rect(3, 4, 10, 1, '#6a8aba'); P.px(11, 9, '#f0d060');
    if (flag) { P.rect(13, 3, 1, 7, '#d83a2a'); P.rect(13, 3, 3, 3, '#d83a2a'); }
  }));
  SP.pot = (seed) => memo('pot' + seed, () => sprite(T, T, (P) => {
    P.rect(4, 9, 8, 6, '#b8603a'); P.rect(3, 8, 10, 2, '#d07a4a'); const r = C.rng(seed); const c = r.pick(['#f06a8a', '#f8d050', '#ffffff', '#b08af0']);
    P.rect(5, 5, 6, 4, '#4a9a3a'); P.px(6, 4, c); P.px(9, 3, c); P.px(8, 6, c);
  }));
  SP.sign = () => memo('sign', () => sprite(T, 24, (P) => {
    P.rect(7, 10, 2, 14, '#6a4a2a'); P.rect(1, 2, 14, 9, '#e8d8b8'); P.rect(1, 2, 14, 1, '#c8b898');
    P.rect(4, 5, 5, 4, '#6a4a2a'); P.px(9, 6, '#6a4a2a'); P.px(3, 4, '#f4f4f4'); P.px(5, 3, '#f4f4f4');
  }));
  SP.well = () => memo('well', () => sprite(2 * T, 2 * T + 8, (P) => {
    P.rect(4, 24, 24, 12, '#8a8a84'); P.rect(4, 22, 24, 3, '#a4a49e'); P.rect(8, 26, 16, 6, '#2a4a6a');
    P.rect(6, 8, 2, 16, '#6a4a2a'); P.rect(24, 8, 2, 16, '#6a4a2a'); for (let y = 0; y < 8; y++) P.hline(4 + Math.max(0, 3 - y / 2), y + 2, 24 - Math.max(0, 3 - y / 2) * 2, y % 3 ? '#b8503a' : '#8e3a2a');
  }));

  // ---- animals ------------------------------------------------------------------
  SP.chicken = (frame, dir) => memo('chk' + frame + dir, () => sprite(12, 12, (P) => {
    const fl = dir === 1;
    const X = (x) => (fl ? 11 - x : x);
    P.ellipse(X(6), 7, 4, 3, '#f4f4f0'); P.rect(X(2), 5, 2, 3, '#e0e0d8');
    P.rect(X(8), 3, 3, 4, '#f4f4f0'); P.px(X(11), 5, '#f0a030'); P.px(X(9), 2, '#e03030'); P.px(X(9), 4, '#222');
    P.rect(X(5), 10 + (frame ? 1 : 0), 1, 2, '#f0a030'); P.rect(X(7), 10 + (frame ? 0 : 1), 1, 2, '#f0a030');
  }));
  SP.cat = (frame) => memo('cat' + frame, () => sprite(16, 12, (P) => {
    const g = '#8a8a90', d = '#6a6a70';
    if (frame === 0) { // sleeping curl
      P.ellipse(8, 7, 7, 4, g); P.ellipse(5, 6, 3, 2.5, d); P.px(2, 4, g); P.px(4, 3, g); P.hline(11, 9, 4, d); P.px(3, 6, '#222');
    } else { // sitting
      P.ellipse(8, 8, 4, 3.5, g); P.rect(6, 2, 5, 5, g); P.px(6, 1, g); P.px(10, 1, g); P.px(7, 4, '#5ad0a0'); P.px(9, 4, '#5ad0a0'); P.rect(12, 6, 3, 1, d); P.px(14, 5, d); P.px(14, 4, d);
    }
  }));
  SP.fish = () => memo('fishsp', () => sprite(12, 6, (P) => { P.ellipse(6, 3, 4, 2, '#8ab0c8'); P.px(1, 2, '#6a90a8'); P.px(1, 4, '#6a90a8'); P.px(8, 2, '#222'); }));

  // ---- item & tool icons (16x16) ------------------------------------------------
  const icons = {
    hand: (P) => { P.rect(5, 4, 7, 9, '#e8b898'); P.rect(4, 6, 1, 5, '#e8b898'); P.rect(12, 6, 1, 5, '#e8b898'); for (let i = 0; i < 4; i++) P.vline(5 + i * 2, 2 + (i === 1 || i === 2 ? 0 : 1), 3, '#e8b898'); P.rect(5, 12, 7, 2, '#c85a3a'); },
    hoe: (P) => { P.line(3, 13, 12, 4, '#a8784a'); P.line(4, 13, 13, 4, '#8a5e38'); P.rect(11, 2, 4, 3, '#8a8a90'); P.rect(13, 2, 2, 6, '#8a8a90'); },
    water: (P) => { P.rect(3, 6, 8, 7, '#5a8ac0'); P.rect(4, 5, 6, 1, '#7aaad8'); P.rect(11, 8, 3, 2, '#5a8ac0'); P.px(14, 7, '#5a8ac0'); P.rect(5, 3, 4, 2, '#5a8ac0'); P.px(2, 8, '#a0d0f0'); P.px(1, 10, '#a0d0f0'); },
    bag: (P) => { P.rect(3, 6, 10, 8, '#b08a5a'); P.rect(3, 6, 10, 2, '#8a6a3a'); P.rect(6, 3, 4, 3, '#8a6a3a'); P.px(7, 4, '#3a2a1a'); P.px(8, 4, '#3a2a1a'); },
    coin: (P) => { P.disc(8, 8, 5.5, '#e0a020'); P.disc(8, 8, 4, '#f8d050'); P.rect(7, 5, 2, 6, '#e0a020'); },
    heart: (P) => { P.disc(5.5, 6, 3, '#e04a5a'); P.disc(10.5, 6, 3, '#e04a5a'); P.rect(3, 7, 10, 2, '#e04a5a'); P.rect(4, 9, 8, 2, '#e04a5a'); P.rect(6, 11, 4, 1, '#e04a5a'); P.px(7, 12, '#e04a5a'); P.px(8, 12, '#e04a5a'); P.px(5, 5, '#f8a0b0'); },
    seedbag: (P, c) => { P.rect(4, 5, 8, 9, '#e8d8b8'); P.rect(5, 3, 6, 2, '#c8b898'); P.rect(6, 2, 4, 1, '#a89878'); P.disc(8, 10, 2, c); },
    coffee_seed: (P) => { P.rect(5, 8, 6, 7, '#b8603a'); P.rect(4, 7, 8, 2, '#d07a4a'); P.vline(8, 2, 6, '#3a8a3a'); P.ellipse(6, 4, 2, 1.5, '#4a9a3a'); P.ellipse(10, 3, 2, 1.5, '#5aa84a'); },
    tomato_seed: (P) => icons.seedbag(P, '#d83a2a'),
    corn_seed: (P) => icons.seedbag(P, '#f0d060'),
    sunflower_seed: (P) => icons.seedbag(P, '#3a3a3a'),
    cherry: (P) => { P.disc(6, 9, 3, '#d42a2a'); P.disc(11, 7, 3, '#ef4040'); P.px(5, 8, '#ff8080'); P.px(10, 6, '#ff8080'); P.line(6, 6, 9, 2, '#4a8a3a'); P.line(11, 4, 9, 2, '#4a8a3a'); P.ellipse(8, 2, 2, 1, '#5aa84a'); },
    parchment: (P) => { for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [8, 12]]) { P.ellipse(x + 1, y + 1, 2, 1.5, '#e8d8a8'); P.px(x + 1, y + 1, '#c8b888'); } },
    green: (P) => { for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [8, 12]]) { P.ellipse(x + 1, y + 1, 2, 1.5, '#a8c87a'); P.px(x + 1, y + 1, '#7a9a4a'); } },
    roast_light: (P) => { for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [8, 12]]) { P.ellipse(x + 1, y + 1, 2, 1.5, '#a8744a'); P.px(x + 1, y + 1, '#6a4a2a'); } },
    roast_medium: (P) => { for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [8, 12]]) { P.ellipse(x + 1, y + 1, 2, 1.5, '#7a4a2a'); P.px(x + 1, y + 1, '#4a2a1a'); } },
    roast_dark: (P) => { for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [8, 12]]) { P.ellipse(x + 1, y + 1, 2, 1.5, '#4a2e1e'); P.px(x + 1, y + 1, '#2a1a10'); } },
    tomato: (P) => { P.disc(8, 9, 5, '#d83a2a'); P.px(6, 7, '#ff8070'); P.rect(6, 3, 4, 2, '#4a9a3a'); P.px(8, 2, '#4a9a3a'); },
    corn: (P) => { P.rect(6, 2, 4, 11, '#f0d060'); P.rect(5, 5, 6, 6, '#f0d060'); for (let y = 3; y < 12; y += 2) for (let x = 6; x < 10; x += 2) P.px(x + (y % 4 === 1 ? 1 : 0), y, '#d8b040'); P.rect(4, 8, 2, 7, '#6aa83a'); P.rect(10, 9, 2, 6, '#6aa83a'); },
    sunflower: (P) => { P.disc(8, 8, 6, '#f0c020'); P.disc(8, 8, 3, '#6a4020'); P.px(7, 7, '#8a5a30'); },
    egg: (P) => { P.ellipse(8, 8, 4, 5, '#f8f0e0'); P.px(6, 5, '#ffffff'); },
    milk: (P) => { P.rect(5, 5, 6, 10, '#f8f8f8'); P.rect(6, 2, 4, 3, '#e0e0e0'); P.rect(5, 9, 6, 3, '#6aa0e0'); },
    panela: (P) => { P.rect(4, 6, 8, 7, '#b87a3a'); P.rect(4, 5, 8, 2, '#d09a5a'); P.px(6, 8, '#d09a5a'); },
    cinnamon: (P) => { P.rect(4, 3, 3, 11, '#a8603a'); P.rect(9, 2, 3, 11, '#b8704a'); P.px(5, 4, '#d09060'); P.px(10, 3, '#d09060'); },
    cocoa: (P) => { P.rect(4, 4, 8, 9, '#6a3a2a'); P.rect(4, 4, 8, 2, '#8a5a3a'); P.px(6, 8, '#8a5a3a'); },
    mint: (P) => SP.mint().width && P.blit(SP.mint(), 0, 0),
    flower: (P) => P.blit(SP.flower(5), 0, 0),
    fish: (P) => { P.ellipse(8, 8, 5, 2.5, '#8ab0c8'); P.px(2, 6, '#6a90a8'); P.px(2, 10, '#6a90a8'); P.px(11, 7, '#222'); P.px(7, 6, '#b0d0e0'); },
    cup: (P, c, foam) => { P.rect(3, 5, 9, 8, '#f4f4f4'); P.rect(4, 6, 7, 3, c); P.rect(12, 7, 2, 4, '#f4f4f4'); P.rect(3, 13, 9, 1, '#d0d0d0'); if (foam) P.rect(4, 6, 7, 1, '#fff8e8'); P.px(6, 2, '#c0c0c0'); P.px(8, 3, '#c0c0c0'); },
    espresso: (P) => icons.cup(P, '#3a2418'),
    americano: (P) => icons.cup(P, '#4a3020'),
    latte: (P) => icons.cup(P, '#c8a070', true),
    cappuccino: (P) => icons.cup(P, '#a88050', true),
    cold_brew: (P) => { P.rect(4, 3, 8, 11, '#c8e0f0'); P.rect(5, 6, 6, 7, '#5a3a20'); P.px(6, 7, '#f0f0f0'); P.px(9, 9, '#f0f0f0'); P.line(10, 1, 8, 6, '#e05a4a'); },
    olla: (P) => { P.ellipse(8, 9, 5, 4, '#b8603a'); P.rect(5, 4, 6, 3, '#3a2418'); P.rect(4, 3, 8, 2, '#d07a4a'); P.px(13, 8, '#b8603a'); },
    mocha: (P) => icons.cup(P, '#5a3a2a', true),
    mint_tea: (P) => icons.cup(P, '#a8c860'),
    settings: (P) => { P.disc(8, 8, 5, '#e8e8e8'); P.disc(8, 8, 2, '#4a4a4a'); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) P.rect(x - 1, y - 1, 3, 3, '#e8e8e8'); },
    sound_on: (P) => { P.rect(3, 6, 3, 4, '#e8e8e8'); P.rect(6, 4, 2, 8, '#e8e8e8'); P.px(8, 3, '#e8e8e8'); P.px(8, 12, '#e8e8e8'); P.px(11, 5, '#e8e8e8'); P.px(12, 7, '#e8e8e8'); P.px(12, 8, '#e8e8e8'); P.px(11, 10, '#e8e8e8'); },
    sound_off: (P) => { P.rect(3, 6, 3, 4, '#e8e8e8'); P.rect(6, 4, 2, 8, '#e8e8e8'); P.px(8, 3, '#e8e8e8'); P.px(8, 12, '#e8e8e8'); P.line(10, 5, 14, 10, '#e05a4a'); P.line(14, 5, 10, 10, '#e05a4a'); },
    sun: (P) => { P.disc(8, 8, 4, '#f8d050'); for (const [x, y] of [[8, 1], [8, 15], [1, 8], [15, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) P.px(x, y, '#f8d050'); },
    cloud: (P) => { P.ellipse(6, 9, 4, 3, '#e8e8f0'); P.ellipse(10, 8, 4, 3.5, '#f4f4f8'); P.rect(3, 9, 11, 3, '#e8e8f0'); },
    rain: (P) => { icons.cloud(P); P.px(5, 13, '#7ab0e0'); P.px(8, 14, '#7ab0e0'); P.px(11, 13, '#7ab0e0'); },
    snow: (P) => { icons.cloud(P); P.px(5, 13, '#fff'); P.px(8, 14, '#fff'); P.px(11, 13, '#fff'); },
    moon: (P) => { P.disc(8, 8, 5, '#f0e8c0'); P.disc(10, 7, 4.2, 'rgba(0,0,0,0)'); P.g.globalCompositeOperation = 'destination-out'; P.disc(10.5, 6.5, 4, '#000'); P.g.globalCompositeOperation = 'source-over'; },
    star: (P) => { P.px(8, 3, '#fff'); P.px(8, 13, '#fff'); P.rect(6, 7, 5, 3, '#f8d050'); P.rect(7, 5, 3, 7, '#f8d050'); P.px(5, 8, '#f8d050'); P.px(11, 8, '#f8d050'); },
    letter: (P) => { P.rect(2, 4, 12, 9, '#f8f4e8'); P.line(2, 4, 8, 9, '#c8b898'); P.line(14, 4, 8, 9, '#c8b898'); P.rect(2, 4, 12, 1, '#c8b898'); },
    zzz: (P) => { P.rect(3, 10, 4, 1, '#fff'); P.line(6, 10, 3, 13, '#fff'); P.rect(3, 13, 4, 1, '#fff'); P.rect(9, 4, 5, 1, '#fff'); P.line(13, 4, 9, 8, '#fff'); P.rect(9, 8, 5, 1, '#fff'); },
    rod: (P) => { P.line(2, 14, 12, 3, '#8a6a3a'); P.line(12, 3, 13, 10, '#c0c0c0'); P.px(13, 11, '#c0c0c0'); P.px(12, 12, '#c0c0c0'); },
    check: (P) => { P.line(3, 8, 6, 11, '#6ad06a'); P.line(6, 11, 13, 4, '#6ad06a'); P.line(3, 9, 6, 12, '#6ad06a'); P.line(6, 12, 13, 5, '#6ad06a'); },
    x: (P) => { P.line(4, 4, 12, 12, '#e05a4a'); P.line(12, 4, 4, 12, '#e05a4a'); P.line(5, 4, 12, 11, '#e05a4a'); P.line(11, 4, 4, 11, '#e05a4a'); },
    sprinkler: (P) => { P.rect(7, 8, 2, 7, '#8a8a90'); P.rect(5, 6, 6, 3, '#6a6a70'); P.px(3, 4, '#a0d0f0'); P.px(12, 4, '#a0d0f0'); P.px(1, 7, '#a0d0f0'); P.px(14, 7, '#a0d0f0'); P.px(8, 2, '#a0d0f0'); },
    roof: (P) => { for (let y = 0; y < 8; y++) P.hline(2 + Math.max(0, 4 - y), y + 3, 12 - Math.max(0, 4 - y) * 2, y % 3 ? '#9aa4aa' : '#7a848a'); P.rect(3, 11, 2, 4, '#5a4a3a'); P.rect(11, 11, 2, 4, '#5a4a3a'); },
    patio2: (P) => { P.rect(2, 4, 12, 9, '#c9c2b4'); P.rect(2, 4, 12, 1, '#8a7a6a'); P.rect(2, 12, 12, 1, '#8a7a6a'); P.px(5, 7, '#e8d8a8'); P.px(9, 9, '#e8d8a8'); P.px(7, 10, '#e8d8a8'); },
    roaster2: (P) => { P.ellipse(8, 8, 6, 5, '#6a6a70'); P.ellipse(8, 8, 4, 3, '#8a8a90'); P.disc(8, 8, 1.5, '#ff9a30'); P.rect(4, 13, 8, 2, '#4a4a4a'); },
    cat: (P) => P.blit(SP.cat(1), 0, 2),
    lights: (P) => { P.line(1, 5, 14, 5, '#3a3a3a'); for (let i = 0; i < 4; i++) P.rect(2 + i * 4, 6, 2, 3, ['#ffd060', '#ff8080', '#80e0ff', '#c0ff80'][i]); },
    bench: (P) => { P.rect(2, 5, 12, 2, '#a8784a'); P.rect(2, 9, 12, 2, '#a8784a'); P.rect(3, 11, 1, 3, '#5a4a3a'); P.rect(12, 11, 1, 3, '#5a4a3a'); },
    hens: (P) => P.blit(SP.chicken(0, 0), 2, 2),
    home: (P) => { P.rect(3, 8, 10, 7, '#efe2c4'); for (let y = 0; y < 5; y++) P.hline(2 + (4 - y), 3 + y, 12 - (4 - y) * 2, '#b8503a'); P.rect(7, 11, 3, 4, '#7a5230'); },
    pause: (P) => { P.rect(4, 3, 3, 10, '#e8e8e8'); P.rect(9, 3, 3, 10, '#e8e8e8'); },
    lang: (P) => { P.rect(2, 3, 12, 9, '#f4f4f4'); P.rect(2, 3, 12, 1, '#c8c8c8'); P.rect(4, 5, 3, 1, '#4a4a4a'); P.rect(4, 7, 8, 1, '#4a4a4a'); P.rect(4, 9, 6, 1, '#4a4a4a'); },
  };
  SP.icon = (name) => memo('icon:' + name, () => sprite(16, 16, (P) => { const f = icons[name]; if (f) f(P); else { P.rect(3, 3, 10, 10, '#f0f'); } }));
  SP.hasIcon = (name) => !!icons[name];

  // ---- player look -----------------------------------------------------------------
  SP.PLAYER = { skin: '#e8b898', hair: '#4a2a1a', shirt: '#c85a3a', pants: '#3a4a6a', hat: '#e9d8a6', apron: '#f0e8d8' };
  SP.ROSA = { skin: '#c88a6a', hair: '#2a1a1a', shirt: '#e08a40', pants: '#5a3a5a', hat: null, apron: '#f4f4f4' };
})();
