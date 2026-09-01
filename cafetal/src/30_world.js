/* Cafetal — 30_world.js
   Map generation, ground/soil/crops, objects & collision, time, weather, seasons. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp } = C.math;
  const T = C.TILE, MW = C.MAP_W, MH = C.MAP_H;
  const SP = C.sprites;
  const W = (C.world = {});

  const G = (C.G = { GRASS: 0, DIRT: 1, WATER: 2, SAND: 3, WOOD: 4, STONE: 5, CONCRETE: 6, PORCH: 7 });
  W.idx = (x, y) => y * MW + x;
  W.inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;

  W.ground = new Uint8Array(MW * MH);
  W.gvar = new Uint8Array(MW * MH);
  W.soil = new Uint8Array(MW * MH);      // 0 none, 1 tilled dry, 2 tilled wet
  W.solid = new Uint8Array(MW * MH);     // static object collision
  W.crops = new Map();                   // idx -> crop
  W.forage = new Map();                  // idx -> 'mint' | 'flower'
  W.objects = [];
  W.lights = [];                         // {x,y,r,color,flicker}
  W.farmZone = { x0: 14, y0: 7, x1: 31, y1: 20 };
  W.forageSpots = [[15, 4], [19, 4], [24, 4], [29, 4], [33, 5], [35, 14], [43, 14], [44, 20], [3, 17], [3, 7], [14, 24], [18, 24], [28, 24], [31, 23], [42, 24], [35, 3], [4, 30], [40, 31]];
  W.customerSpots = [[22, 28], [24, 28], [20, 28], [26, 29], [18, 29], [28, 28]];
  W.henZone = { x0: 33, y0: 20, x1: 44, y1: 25 };

  // ---- crop definitions ------------------------------------------------------------
  C.CROPS = {
    coffee: { seed: 'coffee_seed', product: 'cherry', stageDays: [0, 1, 2, 4, 5, 6], regrowTo: 3, yieldMin: 3, yieldMax: 5, perennial: true, tall: true },
    tomato: { seed: 'tomato_seed', product: 'tomato', stageDays: [0, 1, 2, 3, 4], regrowTo: 2, yieldMin: 2, yieldMax: 4, perennial: false },
    corn: { seed: 'corn_seed', product: 'corn', stageDays: [0, 1, 2, 3, 5], regrowTo: -1, yieldMin: 2, yieldMax: 3, perennial: false, tall: true },
    sunflower: { seed: 'sunflower_seed', product: 'sunflower', stageDays: [0, 1, 2, 3, 4], regrowTo: -1, yieldMin: 1, yieldMax: 2, perennial: false, tall: true },
  };
  W.cropStage = function (crop) {
    const d = C.CROPS[crop.type].stageDays; let s = 0;
    for (let i = 0; i < d.length; i++) if (crop.days >= d[i]) s = i;
    return s;
  };
  W.cropRipe = (crop) => W.cropStage(crop) === C.CROPS[crop.type].stageDays.length - 1;

  // ---- helpers -----------------------------------------------------------------------
  W.season = () => C.SEASONS[C.state.time.season];
  W.isFarm = (x, y) => { const f = W.farmZone; return x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1 && W.ground[W.idx(x, y)] === G.GRASS; };
  W.blocked = function (x, y) {
    if (!W.inMap(x, y)) return true;
    const i = W.idx(x, y);
    if (W.solid[i]) return true;
    const g = W.ground[i];
    if (g === G.WATER) return true;
    const c = W.crops.get(i);
    if (c && C.CROPS[c.type].tall && W.cropStage(c) >= 2) return true;
    return false;
  };
  W.walkable = (x, y) => !W.blocked(x, y);

  function setGround(x, y, g) { if (W.inMap(x, y)) W.ground[W.idx(x, y)] = g; }
  function markSolid(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (W.inMap(i, j)) W.solid[W.idx(i, j)] = 1; }

  // Object factory. px/py = pixel draw position; baseY = pixel y used for painter sorting.
  function addObj(o) {
    o.id = C.uid();
    if (o.px === undefined) o.px = o.tx * T;
    if (o.py === undefined) o.py = o.ty * T;
    if (o.baseY === undefined) o.baseY = (o.ty + (o.h || 1)) * T;
    if (o.solidW) markSolid(o.tx + (o.solidX || 0), o.ty + (o.solidY || 0), o.solidW, o.solidH);
    W.objects.push(o);
    return o;
  }
  W.addObj = addObj;

  // ---- build --------------------------------------------------------------------------
  W.build = function () {
    W.objects.length = 0; W.solid.fill(0); W.lights.length = 0;
    const seed = 1337;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = W.idx(x, y);
      W.ground[i] = G.GRASS;
      const n = C.noise2(x / 3, y / 3, seed);
      W.gvar[i] = n < 0.35 ? 0 : n < 0.6 ? 1 : n < 0.85 ? 2 : 3;
    }
    // road & paths
    for (let x = 0; x < MW; x++) { setGround(x, 28, G.DIRT); setGround(x, 29, G.DIRT); }
    for (let y = 14; y <= 27; y++) setGround(9, y, G.DIRT);
    for (let x = 9; x <= 40; x++) setGround(x, 22, G.DIRT);
    for (let y = 22; y <= 27; y++) setGround(37, y, G.DIRT);
    for (let x = 7; x <= 11; x++) setGround(x, 13, G.PORCH);
    for (let x = 20; x <= 24; x++) setGround(x, 25, G.STONE);
    for (let x = 19; x <= 25; x++) setGround(x, 27, G.STONE);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) W.gvar[W.idx(x, y)] = W.ground[W.idx(x, y)] === G.DIRT ? C.hash2(x, y, 5) * 3 | 0 : W.gvar[W.idx(x, y)];
    // pond
    for (let y = 4; y <= 14; y++) for (let x = 33; x <= 45; x++) {
      const dx = (x + 0.5 - 39.5) / 4.6, dy = (y + 0.5 - 9.5) / 3.6, d = dx * dx + dy * dy;
      if (d <= 1.45 && W.ground[W.idx(x, y)] === G.GRASS) setGround(x, y, G.SAND);
    }
    for (let y = 4; y <= 14; y++) for (let x = 33; x <= 45; x++) {
      const dx = (x + 0.5 - 39.5) / 4.0, dy = (y + 0.5 - 9.5) / 3.0, d = dx * dx + dy * dy;
      if (d <= 1) setGround(x, y, G.WATER);
    }
    // border forest
    const isRoad = (x, y) => y === 28 || y === 29;
    const treeAt = (x, y, kind) => addObj({ kind: 'tree', tx: x, ty: y, w: 1, h: 1, seed: (x * 31 + y * 17) | 0, tkind: kind, px: x * T - 4, py: y * T - 16, baseY: (y + 1) * T, solidW: 1, solidH: 1 });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (isRoad(x, y)) continue;
      const edge = y <= 2 || y >= 33 || x <= 1 || x >= 46;
      const fringe = y === 3 || y === 32 || x === 2 || x === 45;
      const h = C.hash2(x, y, 9);
      if (edge || (fringe && h < 0.45)) {
        if (W.ground[W.idx(x, y)] !== G.GRASS) continue;
        if (edge && h < 0.18) continue; // gaps in the deep forest look natural
        treeAt(x, y, h > 0.8 ? 'pine' : 'leaf');
      }
    }
    for (const [x, y, k] of [[16, 4, 'leaf'], [30, 5, 'pine'], [33, 24, 'leaf'], [44, 17, 'leaf'], [3, 25, 'pine'], [4, 9, 'leaf'], [14, 30, 'leaf'], [31, 31, 'pine'], [42, 31, 'leaf'], [4, 15, 'leaf'], [22, 31, 'leaf'], [45, 24, 'pine'], [12, 4, 'pine'], [26, 3, 'leaf']]) treeAt(x, y, k);

    // house (7x7 sprite at tiles 6,6; footprint rows 8..12)
    addObj({ kind: 'house', tx: 6, ty: 6, w: 7, h: 7, solidX: 0, solidY: 2, solidW: 7, solidH: 5, interact: 'house', stand: [9, 13], name: 'house', baseY: 13 * T });
    // shed with roaster (5x5 at 5,15; footprint rows 17..19)
    addObj({ kind: 'shed', tx: 5, ty: 15, w: 5, h: 5, solidX: 0, solidY: 2, solidW: 5, solidH: 3, interact: 'roaster', stand: [7, 20], name: 'roaster', baseY: 20 * T });
    // pulper
    addObj({ kind: 'pulper', tx: 12, ty: 20, w: 1, h: 1, py: 20 * T - 8, solidW: 1, solidH: 1, interact: 'pulper', stand: [12, 21], name: 'pulper' });
    // patio (6x4 at 34,16)
    addObj({ kind: 'patio', tx: 34, ty: 16, w: 6, h: 4, py: 16 * T - 16, solidW: 6, solidH: 4, interact: 'patio', stand: [36, 20], name: 'patio' });
    // café counter (5x3 at 20,25; rows 26..27 solid)
    addObj({ kind: 'counter', tx: 20, ty: 25, w: 5, h: 3, solidX: 0, solidY: 1, solidW: 5, solidH: 2, interact: 'counter', stand: [22, 25], name: 'cafe' });
    // Rosa's cart (3x3 at 36,25; rows 26..27 solid)
    addObj({ kind: 'cart', tx: 36, ty: 25, w: 3, h: 3, solidX: 0, solidY: 1, solidW: 3, solidH: 2, interact: 'shop', stand: [37, 28], name: 'shop' });
    // mailbox
    addObj({ kind: 'mailbox', tx: 11, ty: 14, w: 1, h: 1, py: 14 * T - 8, solidW: 1, solidH: 1, interact: 'mailbox', stand: [10, 14], name: 'mailbox' });
    // well
    addObj({ kind: 'well', tx: 4, ty: 24, w: 2, h: 2, py: 24 * T - 8, solidW: 2, solidH: 2 });
    // sign by the counter
    addObj({ kind: 'sign', tx: 19, ty: 26, w: 1, h: 1, py: 26 * T - 8, solidW: 1, solidH: 1 });
    // lanterns along the road
    for (const x of [17, 27, 34, 43, 6]) { addObj({ kind: 'lantern', tx: x, ty: 27, w: 1, h: 1, py: 27 * T - 8, solidW: 1, solidH: 1 }); W.lights.push({ x: x * T + 8, y: 27 * T + 4, r: 34, color: '#ffcc66', kind: 'lantern' }); }
    // flower pots by the porch
    addObj({ kind: 'pot', tx: 6, ty: 13, w: 1, h: 1, seed: 3 }); addObj({ kind: 'pot', tx: 12, ty: 13, w: 1, h: 1, seed: 8 });
    // fences around the farm
    const fz = W.farmZone;
    const fence = (x, y, k) => { if (W.ground[W.idx(x, y)] !== G.GRASS) return; addObj({ kind: 'fence', fk: k, tx: x, ty: y, w: 1, h: 1, solidW: 1, solidH: 1 }); };
    for (let x = fz.x0 - 1; x <= fz.x1 + 1; x++) { if (x !== 21 && x !== 22 && x !== 23) fence(x, fz.y1 + 1, 'h'); if (x !== 22 && x !== 23) fence(x, fz.y0 - 1, 'h'); }
    for (let y = fz.y0; y <= fz.y1; y++) { if (y !== 13 && y !== 14) fence(fz.x0 - 1, y, 'v'); if (y !== 13 && y !== 14) fence(fz.x1 + 1, y, 'v'); }
    // bushes & rocks & decoration flowers
    const r = C.rng(4242);
    for (let i = 0; i < 40; i++) {
      const x = 2 + r.int(MW - 4), y = 3 + r.int(MH - 6);
      if (!freeGrass(x, y)) continue;
      const k = r();
      if (k < 0.35) addObj({ kind: 'bush', tx: x, ty: y, w: 1, h: 1, seed: r.int(999), solidW: 1, solidH: 1 });
      else if (k < 0.55) addObj({ kind: 'rock', tx: x, ty: y, w: 1, h: 1, seed: r.int(999), solidW: 1, solidH: 1 });
      else if (k < 0.7) addObj({ kind: 'stump', tx: x, ty: y, w: 1, h: 1, solidW: 1, solidH: 1 });
      else addObj({ kind: 'dflower', tx: x, ty: y, w: 1, h: 1, seed: r.int(999) });
    }
    // reeds and lilies around the pond
    for (let y = 4; y <= 14; y++) for (let x = 33; x <= 45; x++) {
      const g = W.ground[W.idx(x, y)], hh = C.hash2(x, y, 21);
      if (g === G.SAND && hh < 0.25) addObj({ kind: 'reeds', tx: x, ty: y, w: 1, h: 1 });
      if (g === G.WATER && hh > 0.8) addObj({ kind: 'lily', tx: x, ty: y, w: 1, h: 1 });
    }
    // house lights
    W.lights.push({ x: 6 * T + 21, y: 6 * T + 64, r: 26, color: '#ffd080', kind: 'window' }, { x: 6 * T + 91, y: 6 * T + 64, r: 26, color: '#ffd080', kind: 'window' },
      { x: 6 * T + 21, y: 6 * T + 86, r: 26, color: '#ffd080', kind: 'window' }, { x: 6 * T + 91, y: 6 * T + 86, r: 26, color: '#ffd080', kind: 'window' },
      { x: 6 * T + 72, y: 6 * T + 68, r: 30, color: '#ffe0a0', kind: 'porch' },
      { x: 5 * T + 40, y: 15 * T + 62, r: 28, color: '#ff9a40', kind: 'roaster' },
      { x: 22 * T + 8, y: 26 * T, r: 44, color: '#ffd8a0', kind: 'cafe' },
      { x: 37 * T + 8, y: 26 * T, r: 30, color: '#ffd8a0', kind: 'cart' });
    W.rebuildUpgrades();
  };
  function freeGrass(x, y) {
    if (!W.inMap(x, y) || W.solid[W.idx(x, y)] || W.ground[W.idx(x, y)] !== G.GRASS) return false;
    if (W.isFarm(x, y)) return false;
    const fz = W.farmZone; if (x >= fz.x0 - 1 && x <= fz.x1 + 1 && y >= fz.y0 - 1 && y <= fz.y1 + 1) return false;
    if (y >= 21 && y <= 30 && x >= 8 && x <= 41) return false; // keep the lane and road area clear
    if (x >= 5 && x <= 13 && y >= 5 && y <= 15) return false;   // house yard
    if (x >= 4 && x <= 13 && y >= 15 && y <= 21) return false;  // shed
    if (x >= 33 && x <= 45 && y >= 3 && y <= 15) return false;  // pond
    if (x >= 33 && x <= 40 && y >= 15 && y <= 20) return false; // patio
    if (W.forageSpots.some(([fx, fy]) => fx === x && fy === y)) return false;
    return true;
  }

  // Upgrade-dependent objects are (re)built when purchases change.
  W.rebuildUpgrades = function () {
    W.objects = W.objects.filter((o) => !o.upgrade);
    const up = C.state.upgrades;
    // clear solid for upgrade footprints then re-mark
    for (const [x, y, w, h] of [[41, 21, 2, 2], [14, 23, 2, 1]]) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) W.solid[W.idx(i, j)] = 0;
    if (up.hens) addObj({ kind: 'coop', upgrade: true, tx: 41, ty: 21, w: 2, h: 2, py: 21 * T - 8, solidW: 2, solidH: 2, interact: 'coop', name: 'coop' });
    if (up.bench) addObj({ kind: 'bench', upgrade: true, tx: 14, ty: 23, w: 2, h: 1, solidW: 2, solidH: 1 });
    W.lights = W.lights.filter((l) => l.kind !== 'fairy');
    if (up.lights) for (let i = 0; i < 5; i++) W.lights.push({ x: 20 * T + 8 + i * 16, y: 25 * T + 2, r: 16, color: ['#ffd060', '#ff8080', '#80e0ff', '#c0ff80', '#ffd060'][i], kind: 'fairy' });
  };

  // ---- interaction lookup -----------------------------------------------------------------
  W.objectAt = function (tx, ty) {
    for (let i = W.objects.length - 1; i >= 0; i--) {
      const o = W.objects[i];
      if (tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h) return o;
    }
    return null;
  };
  W.interactableAt = function (tx, ty) {
    // Prefer objects with an interact type, including their full sprite footprint.
    for (let i = W.objects.length - 1; i >= 0; i--) {
      const o = W.objects[i];
      if (!o.interact) continue;
      if (tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h) return o;
    }
    return null;
  };
  // nearest walkable neighbour of a tile (for objects without a stand spot)
  W.nearestStand = function (tx, ty, fromX, fromY) {
    let best = null, bd = 1e9;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (!W.walkable(x, y)) continue;
      const d = Math.abs(x - fromX) + Math.abs(y - fromY);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  };

  // ---- time & weather ------------------------------------------------------------------------
  W.tick = function (dt) {
    const t = C.state.time;
    t.hour += dt * ((C.DAY_END_HOUR - C.DAY_START_HOUR) / C.DAY_SECONDS);
    if (t.hour >= C.DAY_END_HOUR) { t.hour = C.DAY_END_HOUR; C.emit('midnight'); }
  };
  W.daylight = function () { // 0 night .. 1 full day
    const h = C.state.time.hour;
    if (h < 6) return 0.3;
    if (h < 7.5) return 0.3 + 0.7 * (h - 6) / 1.5;
    if (h < 17.5) return 1;
    if (h < 20.5) return 1 - (h - 17.5) / 3;
    return 0;
  };
  W.rollWeather = function (seasonIdx, rnd) {
    const r = rnd();
    switch (C.SEASONS[seasonIdx]) {
      case 'spring': return r < 0.42 ? 'clear' : r < 0.62 ? 'cloudy' : 'rain';
      case 'summer': return r < 0.6 ? 'clear' : r < 0.78 ? 'cloudy' : 'rain';
      case 'autumn': return r < 0.4 ? 'clear' : r < 0.68 ? 'cloudy' : 'rain';
      default: return r < 0.35 ? 'clear' : r < 0.6 ? 'cloudy' : 'snow';
    }
  };
  W.isRaining = () => C.state.weather === 'rain';

  // Morning: advance day, weather, crops, forage. Emits 'newDay'.
  W.newDay = function () {
    const S = C.state, t = S.time;
    t.day += 1; t.hour = C.DAY_START_HOUR;
    const seasonBefore = t.season;
    t.season = Math.floor((t.day - 1) / C.SEASON_DAYS) % 4;
    t.year = Math.floor((t.day - 1) / (C.SEASON_DAYS * 4)) + 1;
    const newSeason = seasonBefore !== t.season;
    S.weather = S.forecast || W.rollWeather(t.season, Math.random);
    S.forecast = W.rollWeather(t.season, Math.random);
    if (t.day === 2) S.weather = 'clear';
    const winter = W.season() === 'winter';
    if (newSeason && winter) { // annual crops wither at first frost
      for (const [i, c] of [...W.crops]) if (!C.CROPS[c.type].perennial) W.crops.delete(i);
    }
    const rain = S.weather === 'rain';
    // crops grow if they were watered yesterday (or rain today counts for today, applied now for simplicity)
    for (const [i, c] of W.crops) {
      const grew = c.watered || W.soil[i] === 2;
      if (grew && !(winter && c.type === 'coffee')) c.days += 1;
      c.watered = false;
    }
    // soil dries, then rain / sprinkler wet it again
    for (let i = 0; i < W.soil.length; i++) if (W.soil[i] === 2) W.soil[i] = 1;
    if (rain || S.upgrades.sprinkler) {
      for (let i = 0; i < W.soil.length; i++) if (W.soil[i] === 1) W.soil[i] = 2;
      for (const [, c] of W.crops) c.watered = true;
    }
    // forage respawn
    if (!winter) for (const [x, y] of W.forageSpots) { const i = W.idx(x, y); if (!W.forage.has(i) && Math.random() < 0.35) W.forage.set(i, Math.random() < 0.5 ? 'mint' : 'flower'); }
    else W.forage.clear();
    C.emit('newDay', { newSeason });
  };

  // ---- farming actions ---------------------------------------------------------------------
  W.till = function (x, y) { if (!W.isFarm(x, y) || W.blocked(x, y) || W.soil[W.idx(x, y)]) return false; W.soil[W.idx(x, y)] = 1; return true; };
  W.water = function (x, y) { const i = W.idx(x, y); if (!W.soil[i]) return false; W.soil[i] = 2; const c = W.crops.get(i); if (c) c.watered = true; return true; };
  W.plant = function (x, y, type) { const i = W.idx(x, y); if (!W.soil[i] || W.crops.has(i)) return false; W.crops.set(i, { type, days: 0, watered: W.soil[i] === 2 }); return true; };
  W.harvest = function (x, y) {
    const i = W.idx(x, y), c = W.crops.get(i); if (!c || !W.cropRipe(c)) return null;
    const def = C.CROPS[c.type], n = def.yieldMin + Math.floor(Math.random() * (def.yieldMax - def.yieldMin + 1));
    if (def.regrowTo >= 0) { c.days = def.stageDays[def.regrowTo]; c.watered = W.soil[i] === 2; } else W.crops.delete(i);
    return { item: def.product, n };
  };
})();
