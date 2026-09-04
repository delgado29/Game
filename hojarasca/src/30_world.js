/* Hojarasca — 30_world.js  The property: ground, zones, buildings, fences, gates, vents, bins, trees, collision. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const T = H.TILE, MW = H.MAP_W, MH = H.MAP_H, A = H.art;
  const W = (H.world = {});
  const G = (H.G = { GRASS: 0, PATH: 1, CONCRETE: 2, WATER: 3, DECK: 4, GLASS: 5, STONE: 6, SOIL: 7, SAND: 8, ROAD: 9, PORCH: 10, SIDEWALK: 11, VOID: 12, RUG: 13 });
  W.idx = (x, y) => y * MW + x; W.inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  W.ground = new Uint8Array(MW * MH); W.gvar = new Uint8Array(MW * MH); W.solid = new Uint8Array(MW * MH); W.zoneMap = new Int8Array(MW * MH).fill(-1);
  W.objects = []; W.trees = []; W.lights = [];
  // zones: index order matters (progress arrays)
  W.ZONES = [
    { id: 'front', rects: [[2, 28, 40, 42]], leaves: 1100, types: [0, 0, 1, 1, 2, 3], value: 1, bonus: 'front' },
    { id: 'drive', rects: [[42, 28, 61, 42], [39, 15, 61, 26]], leaves: 650, types: [1, 2, 2, 3, 3], value: 2, bonus: 'drive' },
    { id: 'back', rects: [[19, 2, 40, 13], [2, 2, 3, 13], [2, 12, 18, 13], [2, 15, 20, 26]], leaves: 2000, types: [0, 1, 1, 2, 3, 3], value: 3, bonus: 'back' },
    { id: 'pool', rects: [[42, 2, 61, 13]], leaves: 1000, types: [0, 1, 2, 2, 3], value: 4, bonus: 'pool' },
    { id: 'green', rects: [[5, 4, 16, 10]], leaves: 650, types: [2, 2, 3, 1], value: 6, bonus: 'green' },
    { id: 'cellar', rects: [[3, 51, 14, 56]], leaves: 200, types: [4], value: 20, bonus: 'cellar' },
  ];
  W.GATES = [
    { id: 'drive', tx: 41, ty: 35, orient: 'v', zone: 'drive', cost: 200 },
    { id: 'back', tx: 10, ty: 27, orient: 'h', zone: 'back', cost: 600 },
    { id: 'pool', tx: 50, ty: 14, orient: 'h', zone: 'pool', cost: 1400 },
    { id: 'green', tx: 10, ty: 11, orient: 'h', zone: 'green', cost: 2400 },
    { id: 'cellar', tx: 36, ty: 28, orient: 'hatch', zone: 'cellar', cost: 4000 },
  ];
  W.VENTS = [
    { id: 'v_front1', zone: 'front', tx: 10, ty: 31, cost: 80 }, { id: 'v_front2', zone: 'front', tx: 30, ty: 41, cost: 80 },
    { id: 'v_drive1', zone: 'drive', tx: 50, ty: 20, cost: 150 }, { id: 'v_drive2', zone: 'drive', tx: 56, ty: 38, cost: 150 },
    { id: 'v_back1', zone: 'back', tx: 26, ty: 4, cost: 250 }, { id: 'v_back2', zone: 'back', tx: 8, ty: 20, cost: 250 }, { id: 'v_back3', zone: 'back', tx: 37, ty: 12, cost: 250 },
    { id: 'v_pool1', zone: 'pool', tx: 44, ty: 11, cost: 400 }, { id: 'v_pool2', zone: 'pool', tx: 59, ty: 11, cost: 400 },
    { id: 'v_green1', zone: 'green', tx: 8, ty: 6, cost: 500 }, { id: 'v_green2', zone: 'green', tx: 14, ty: 8, cost: 500 },
    { id: 'v_cellar', zone: 'cellar', tx: 8, ty: 53, cost: 600 },
  ];
  W.BINS = [
    { id: 'b_front', tx: 24, ty: 28, cost: 0, zone: 'front' },
    { id: 'b_back', tx: 20, ty: 6, cost: 300, zone: 'back' },
    { id: 'b_pool', tx: 43, ty: 12, cost: 600, zone: 'pool' },
  ];
  W.HATCH = { tx: 36, ty: 28 }; W.CELLAR_IN = { tx: 12, ty: 53 }; W.LADDER = { tx: 13, ty: 52 }; W.HATCH_OUT = { tx: 36, ty: 29 };
  W.zoneIdx = (id) => W.ZONES.findIndex((z) => z.id === id);
  W.zoneAt = (tx, ty) => (W.inMap(tx, ty) ? W.zoneMap[W.idx(tx, ty)] : -1);

  function setG(x, y, g) { if (W.inMap(x, y)) W.ground[W.idx(x, y)] = g; }
  function fillG(x0, y0, x1, y1, g) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setG(x, y, g); }
  function markSolid(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (W.inMap(x, y)) W.solid[W.idx(x, y)] = 1; }
  function addObj(o) { if (o.px === undefined) o.px = o.tx * T; if (o.py === undefined) o.py = o.ty * T; if (o.baseY === undefined) o.baseY = (o.ty + (o.h || 1)) * T; if (o.solid) markSolid(o.tx + (o.sx || 0), o.ty + (o.sy || 0), o.tx + (o.sx || 0) + o.sw - 1, o.ty + (o.sy || 0) + o.sh - 1); W.objects.push(o); return o; }
  W.addObj = addObj;
  const fence = (x, y, k) => addObj({ kind: 'fence', fk: k, tx: x, ty: y, w: 1, h: 1, solid: true, sw: 1, sh: 1 });
  const tree = (x, y, kind) => { const o = addObj({ kind: 'tree', tkind: kind, seed: x * 31 + y, tx: x, ty: y, w: 1, h: 1, px: x * T - 12, py: y * T - 34, baseY: (y + 1) * T, solid: true, sw: 1, sh: 1 }); W.trees.push(o); return o; };

  W.build = function () {
    W.objects.length = 0; W.trees.length = 0; W.lights.length = 0; W.solid.fill(0); W.zoneMap.fill(-1);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = W.idx(x, y); W.ground[i] = y >= 44 ? G.VOID : G.GRASS; W.gvar[i] = (H.hash(x, y, 3) * 4) | 0; }
    // street
    fillG(0, 44, MW - 1, 44, G.SIDEWALK); fillG(0, 45, MW - 1, 48, G.ROAD); for (let x = 0; x < MW; x += 3) setG(x, 46, G.ROAD);
    // house, porch, path, driveway
    fillG(26, 27, 33, 27, G.PORCH); fillG(29, 28, 30, 42, G.PATH); fillG(42, 27, 48, 43, G.CONCRETE);
    // pool deck & water
    fillG(42, 2, 61, 13, G.DECK); fillG(46, 5, 56, 9, G.WATER);
    // greenhouse floor + beds, sandbox
    fillG(5, 4, 16, 10, G.GLASS); for (const y of [5, 7, 9]) fillG(6, y, 15, y, G.SOIL);
    fillG(24, 12, 27, 13, G.SAND);
    // cellar room
    fillG(3, 51, 14, 56, G.STONE); fillG(6, 54, 9, 55, G.RUG);
    // zone map
    W.ZONES.forEach((z, zi) => { for (const [x0, y0, x1, y1] of z.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (W.inMap(x, y)) W.zoneMap[W.idx(x, y)] = zi; });
    // perimeter fence + inner fences
    for (let x = 1; x <= 62; x++) { fence(x, 1, 'h'); fence(x, 43, 'h'); }
    for (let y = 2; y <= 42; y++) { fence(1, y, 'v'); fence(62, y, 'v'); }
    for (let y = 28; y <= 42; y++) if (y !== 35) fence(41, y, 'v');          // front | drive
    for (let x = 2; x <= 21; x++) if (x !== 10) fence(x, 27, 'h');            // front | west passage
    for (let x = 39; x <= 61; x++) if (x !== 50) fence(x, 14, 'h');           // drive passage | pool
    for (let y = 2; y <= 13; y++) fence(41, y, 'v');                          // back | pool (no gate)
    // gates (solid until opened; solidity resolved in W.blocked)
    for (const gt of W.GATES) if (gt.orient !== 'hatch') addObj({ kind: 'gate', gate: gt, tx: gt.tx, ty: gt.ty, w: 1, h: 1, py: gt.ty * T - 4 });
    addObj({ kind: 'hatch', tx: W.HATCH.tx, ty: W.HATCH.ty, w: 1, h: 1, px: W.HATCH.tx * T - 2, py: W.HATCH.ty * T, baseY: W.HATCH.ty * T + 2 });
    addObj({ kind: 'ladder', tx: W.LADDER.tx, ty: W.LADDER.ty, w: 1, h: 1, px: W.LADDER.tx * T + 2, py: W.LADDER.ty * T - 8, baseY: W.LADDER.ty * T + 2 });
    // house 16x12 footprint at (22,15); sprite 16x15 drawn from y=12
    addObj({ kind: 'house', tx: 22, ty: 15, w: 16, h: 12, px: 22 * T, py: 12 * T, baseY: 27 * T, solid: true, sw: 16, sh: 12 });
    W.lights.push({ x: 22 * T + 142, y: 12 * T + 210, r: 40, color: '#ffd080' }, { x: 22 * T + 28, y: 12 * T + 80, r: 28, color: '#ffd080' }, { x: 22 * T + 108, y: 12 * T + 80, r: 28, color: '#ffd080' });
    // greenhouse building at (4,3) 14x9 ; walls solid except door (10,11)
    addObj({ kind: 'greenhouse', tx: 4, ty: 3, w: 14, h: 9, px: 4 * T, py: 3 * T - 8, baseY: 12 * T, solid: false });
    for (let x = 4; x <= 17; x++) { W.solid[W.idx(x, 3)] = 1; if (x !== 10) W.solid[W.idx(x, 11)] = 1; }
    for (let y = 3; y <= 11; y++) { W.solid[W.idx(4, y)] = 1; W.solid[W.idx(17, y)] = 1; }
    for (const y of [5, 7, 9]) markSolid(6, y, 15, y);
    W.lights.push({ x: 10 * T + 8, y: 7 * T, r: 60, color: '#c0ffe0' });
    // shed, car, sandbox, pool props
    addObj({ kind: 'shed', tx: 33, ty: 8, w: 4, h: 4, py: 8 * T - 16, solid: true, sy: 1, sw: 4, sh: 3 });
    addObj({ kind: 'car', tx: 43, ty: 34, w: 4, h: 4, py: 34 * T - 8, solid: true, sw: 4, sh: 4 });
    addObj({ kind: 'sandbox', tx: 24, ty: 12, w: 4, h: 2, baseY: 12 * T + 1 });
    addObj({ kind: 'poolladder', tx: 46, ty: 4, w: 1, h: 1, py: 4 * T + 6 });
    addObj({ kind: 'deckchair', tx: 58, ty: 5, w: 1, h: 1, solid: true, sw: 1, sh: 1 }); addObj({ kind: 'deckchair', tx: 58, ty: 7, w: 1, h: 1, solid: true, sw: 1, sh: 1 });
    for (let y = 5; y <= 9; y++) for (let x = 46; x <= 56; x++) W.solid[W.idx(x, y)] = 2; // 2 = water: blocks player, not leaves
    // cellar walls
    for (let x = 2; x <= 15; x++) { W.solid[W.idx(x, 50)] = 1; W.solid[W.idx(x, 57)] = 1; } for (let y = 50; y <= 57; y++) { W.solid[W.idx(2, y)] = 1; W.solid[W.idx(15, y)] = 1; }
    addObj({ kind: 'table', tx: 6, ty: 52, w: 2, h: 1, py: 52 * T - 8, solid: true, sw: 2, sh: 1 }); addObj({ kind: 'chair', tx: 9, ty: 52, w: 1, h: 1, py: 52 * T - 6, solid: true, sw: 1, sh: 1 }); addObj({ kind: 'stove', tx: 4, ty: 52, w: 1, h: 1, py: 52 * T - 12, solid: true, sw: 1, sh: 1 });
    W.lights.push({ x: 4 * T + 10, y: 52 * T + 8, r: 44, color: '#ff9a40' }, { x: 7 * T, y: 52 * T, r: 30, color: '#ffe0a0' });
    // trees & hedges
    for (const [x, y, k] of [[8, 33, 'maple'], [17, 39, 'maple'], [35, 38, 'oak'], [57, 31, 'birch'], [30, 7, 'oak'], [22, 11, 'birch'], [38, 4, 'maple'], [4, 20, 'birch'], [12, 22, 'maple'], [60, 3, 'pine'], [43, 3, 'pine'], [30, 3, 'birch'], [5, 40, 'oak'], [52, 24, 'maple']]) tree(x, y, k);
    for (let x = 3; x < 62; x += 4) tree(x + ((x * 7) % 3), 0, (x % 8 === 3) ? 'pine' : 'oak');
    for (let y = 4; y < 42; y += 5) { tree(0, y, 'pine'); tree(63, y + 2, 'maple'); }
    for (let y = 16; y <= 25; y++) addObj({ kind: 'hedge', tx: 61, ty: y, w: 1, h: 1, py: y * T - 4, solid: true, sw: 1, sh: 1 });
    for (let x = 43; x <= 60; x += 3) addObj({ kind: 'bush', seed: x, tx: x, ty: 27, w: 1, h: 1, solid: true, sw: 1, sh: 1 });
    addObj({ kind: 'mailbox', tx: 32, ty: 41, w: 1, h: 1, py: 41 * T - 8, solid: true, sw: 1, sh: 1 });
    addObj({ kind: 'pot', seed: 3, tx: 25, ty: 27, w: 1, h: 1 }); addObj({ kind: 'pot', seed: 8, tx: 34, ty: 27, w: 1, h: 1 });
    for (const [x, y] of [[20, 40], [40, 20], [45, 26], [22, 26]]) { addObj({ kind: 'lantern', tx: x, ty: y, w: 1, h: 1, py: y * T - 8, solid: true, sw: 1, sh: 1 }); W.lights.push({ x: x * T + 8, y: y * T + 4, r: 34, color: '#ffcc66' }); }
    // bins & vents
    for (const b of W.BINS) addObj({ kind: 'bin', bin: b, tx: b.tx, ty: b.ty, w: 1, h: 1, px: b.tx * T - 1, py: b.ty * T - 8, solid: true, sw: 1, sh: 1 });
    for (const v of W.VENTS) addObj({ kind: 'vent', vent: v, tx: v.tx, ty: v.ty, w: 1, h: 1, baseY: v.ty * T + 1 });
  };

  // ---- collision ------------------------------------------------------------------------------------
  W.gateOpen = (id) => !!(H.state && H.state.gates[id]);
  W.gateAt = (tx, ty) => W.GATES.find((g) => g.tx === tx && g.ty === ty && g.orient !== 'hatch');
  W.blocked = function (tx, ty) { if (!W.inMap(tx, ty)) return true; const s = W.solid[W.idx(tx, ty)]; if (s) return true; const g = W.gateAt(tx, ty); return !!(g && !W.gateOpen(g.id)); };
  W.leafBlocked = function (tx, ty) { if (!W.inMap(tx, ty)) return true; const s = W.solid[W.idx(tx, ty)]; if (s === 1) return true; const g = W.gateAt(tx, ty); return !!(g && !W.gateOpen(g.id)); };
  W.isWater = (tx, ty) => W.inMap(tx, ty) && W.ground[W.idx(tx, ty)] === G.WATER;
  W.leafSpawnable = (tx, ty) => W.inMap(tx, ty) && W.solid[W.idx(tx, ty)] !== 1 && !W.gateAt(tx, ty) && !W.BINS.some((b) => Math.abs(b.tx - tx) <= 1 && Math.abs(b.ty - ty) <= 1);
})();
