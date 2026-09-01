/* Cafetal — 40_entities.js
   Player, NPC customers, Rosa, cat, hens. A* pathfinding on the tile grid. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp, lerp } = C.math;
  const T = C.TILE, MW = C.MAP_W, MH = C.MAP_H;
  const W = C.world, SP = C.sprites;
  const E = (C.entities = { player: null, npcs: [], animals: [], rosa: null, cat: null });

  // ---- A* --------------------------------------------------------------------------------
  C.pathfind = function (sx, sy, tx, ty, allowTarget) {
    if (sx === tx && sy === ty) return [];
    if (!W.inMap(tx, ty)) return null;
    const passable = (x, y) => W.walkable(x, y) || (allowTarget && x === tx && y === ty);
    if (!passable(tx, ty)) return null;
    const open = [], came = new Map(), gS = new Map();
    const key = (x, y) => y * MW + x, h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const sk = key(sx, sy);
    open.push({ x: sx, y: sy, f: h(sx, sy) }); gS.set(sk, 0);
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.x, cur.y);
      if (cur.x === tx && cur.y === ty) {
        const path = []; let k = ck;
        while (k !== sk) { path.push([k % MW, Math.floor(k / MW)]); k = came.get(k); }
        return path.reverse();
      }
      if (closed.has(ck)) continue; closed.add(ck);
      const g0 = gS.get(ck);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!W.inMap(nx, ny) || !passable(nx, ny)) continue;
        const nk = key(nx, ny); if (closed.has(nk)) continue;
        const g = g0 + 1;
        if (g < (gS.has(nk) ? gS.get(nk) : 1e9)) { gS.set(nk, g); came.set(nk, ck); open.push({ x: nx, y: ny, f: g + h(nx, ny) }); }
      }
    }
    return null;
  };

  // ---- generic mover -----------------------------------------------------------------------
  function makeMover(tx, ty, speed) {
    return { x: tx * T + 8, y: ty * T + 16, tx, ty, dir: 0, frame: 0, animT: 0, path: null, speed, onArrive: null, moving: false, bubble: null, bubbleT: 0 };
  }
  function tileOf(m) { return [Math.floor(m.x / T), Math.floor((m.y - 1) / T)]; }
  E.tileOf = tileOf;

  E.moveTo = function (m, tx, ty, onArrive, allowTarget) {
    const [cx, cy] = tileOf(m);
    const path = C.pathfind(cx, cy, tx, ty, allowTarget);
    if (!path) { m.path = null; m.onArrive = null; return false; }
    m.path = path.length ? path : null; m.onArrive = onArrive || null;
    if (!m.path && m.onArrive) { const f = m.onArrive; m.onArrive = null; f(); }
    return true;
  };
  E.stop = function (m) { m.path = null; m.onArrive = null; m.moving = false; };

  E.updateMover = function (m, dt) {
    if (m.bubble) { m.bubbleT -= dt; if (m.bubbleT <= 0) m.bubble = null; }
    if (!m.path || m.path.length === 0) {
      m.moving = false; m.animT = 0; m.frame = 0; m.path = null;
      if (m.onArrive) { const f = m.onArrive; m.onArrive = null; f(); }
      return;
    }
    const [nx, ny] = m.path[0];
    const gx = nx * T + 8, gy = ny * T + 16;
    const dx = gx - m.x, dy = gy - m.y, d = Math.hypot(dx, dy);
    const stepLen = m.speed * dt;
    if (Math.abs(dx) > Math.abs(dy)) m.dir = dx > 0 ? 2 : 1; else m.dir = dy > 0 ? 0 : 3;
    m.moving = true; m.animT += dt;
    m.frame = 1 + (Math.floor(m.animT * 7) % 2);
    if (d <= stepLen) {
      m.x = gx; m.y = gy; m.tx = nx; m.ty = ny; m.path.shift();
      if (m.path.length === 0) { m.moving = false; m.frame = 0; if (m.onArrive) { const f = m.onArrive; m.onArrive = null; m.path = null; f(); } }
    } else { m.x += (dx / d) * stepLen; m.y += (dy / d) * stepLen; }
  };

  // ---- player -------------------------------------------------------------------------------
  E.initPlayer = function (tx, ty) {
    const p = makeMover(tx, ty, 78);
    p.kind = 'player'; p.look = SP.PLAYER;
    E.player = p;
    return p;
  };
  E.say = function (m, text, secs) { m.bubble = text; m.bubbleT = secs || 3; };

  // ---- Rosa (vendor) -------------------------------------------------------------------------
  E.initStatics = function () {
    E.rosa = { kind: 'rosa', x: 37 * T + 8, y: 24 * T + 16, dir: 0, frame: 0, look: SP.ROSA, bubble: null, bubbleT: 0, idle: 0 };
    E.cat = { kind: 'cat', x: 11 * T + 8, y: 13 * T + 14, frame: 0, t: 0, bubble: null, bubbleT: 0 };
    E.animals = [];
    if (C.state.upgrades.hens) E.spawnHens();
  };
  E.spawnHens = function () {
    E.animals = E.animals.filter((a) => a.kind !== 'hen');
    for (let i = 0; i < 3; i++) {
      const h = makeMover(35 + i * 3, 23, 22); h.kind = 'hen'; h.wait = Math.random() * 3; h.dirX = 0; E.animals.push(h);
    }
  };

  // ---- customers -----------------------------------------------------------------------------
  // npc: {def, state:'arrive'|'wait'|'leave'|'pass', order, patience, spot}
  E.spawnCustomer = function (def, order, passOnly) {
    const startX = Math.random() < 0.6 ? MW - 1 : 0;
    const m = makeMover(startX, 28, 44 + Math.random() * 10);
    m.kind = 'npc'; m.def = def; m.look = { skin: def.skin, hair: def.hair, shirt: def.shirt, pants: def.pants, hat: def.hat };
    m.order = order; m.state = passOnly ? 'pass' : 'arrive'; m.patience = 0; m.waited = 0; m.served = false;
    E.npcs.push(m);
    if (passOnly) {
      const endX = startX === 0 ? MW - 1 : 0;
      E.moveTo(m, endX, 28 + (Math.random() < 0.5 ? 0 : 1), () => { m.dead = true; });
      if (Math.random() < 0.5) E.say(m, C.npcLine(def.lines[Math.floor(Math.random() * def.lines.length)]), 4);
      return m;
    }
    // choose a free queue spot
    const taken = new Set(E.npcs.filter((n) => n !== m && n.spot).map((n) => n.spot.join(',')));
    let spot = W.customerSpots.find((s) => !taken.has(s.join(','))) || W.customerSpots[W.customerSpots.length - 1];
    m.spot = spot;
    const ok = E.moveTo(m, spot[0], spot[1], () => {
      m.state = 'wait'; m.dir = 3; m.patience = 55 + (C.state.upgrades.lights ? 30 : 0) + Math.random() * 15;
      const lines = C.NPC_LINES.generic_order;
      E.say(m, C.npcLine(lines[Math.floor(Math.random() * lines.length)]).replace('{drink}', C.t('drink_' + order)), 5);
      C.audio.sfx('bell');
    });
    if (!ok) { m.dead = true; }
    return m;
  };
  E.leaveCustomer = function (m, line) {
    m.state = 'leave'; m.spot = null;
    if (line) E.say(m, line, 3.5);
    const endX = Math.random() < 0.5 ? MW - 1 : 0;
    const ok = E.moveTo(m, endX, 28 + (Math.random() < 0.5 ? 0 : 1), () => { m.dead = true; });
    if (!ok) m.dead = true;
  };
  E.waitingCustomers = () => E.npcs.filter((n) => n.state === 'wait');
  E.customerAt = function (tx, ty) { return E.npcs.find((n) => !n.dead && Math.abs(n.tx - tx) <= 0 && Math.abs(n.ty - ty) <= 0 && n.state !== 'pass') || E.npcs.find((n) => !n.dead && n.state === 'wait' && Math.abs(n.tx - tx) <= 1 && Math.abs(n.ty - ty) <= 1); };

  // ---- update all --------------------------------------------------------------------------
  E.update = function (dt) {
    E.updateMover(E.player, dt);
    for (const n of E.npcs) {
      E.updateMover(n, dt);
      if (n.state === 'wait') {
        n.waited += dt;
        if (n.waited > n.patience) {
          E.leaveCustomer(n, C.npcLine(C.NPC_LINES.tired[0]));
          C.emit('customerLeft', n);
        }
      }
    }
    E.npcs = E.npcs.filter((n) => !n.dead);
    // rosa idle
    if (E.rosa) { E.rosa.bubbleT -= dt; if (E.rosa.bubbleT <= 0) E.rosa.bubble = null; }
    // cat
    if (E.cat) { E.cat.t += dt; if (E.cat.t > 9) { E.cat.t = 0; E.cat.frame = E.cat.frame ? 0 : 1; } E.cat.bubbleT -= dt; if (E.cat.bubbleT <= 0) E.cat.bubble = null; }
    // hens
    for (const h of E.animals) {
      if (h.kind !== 'hen') continue;
      if (!h.path || h.path.length === 0) {
        h.wait -= dt;
        if (h.wait <= 0) {
          h.wait = 1.5 + Math.random() * 4;
          const z = W.henZone, tx = z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1)), ty = z.y0 + Math.floor(Math.random() * (z.y1 - z.y0 + 1));
          if (W.walkable(tx, ty) && Math.random() < 0.7) E.moveTo(h, tx, ty);
          else if (Math.random() < 0.15) C.audio.sfx('cluck');
        }
      }
      E.updateMover(h, dt);
    }
  };

  // Everything drawable with a base y for painter sorting.
  E.drawables = function () {
    const out = [];
    const p = E.player;
    out.push({ baseY: p.y, draw: (g, ox, oy) => drawHuman(g, p, ox, oy) });
    for (const n of E.npcs) out.push({ baseY: n.y, draw: (g, ox, oy) => drawHuman(g, n, ox, oy) });
    if (E.rosa) out.push({ baseY: E.rosa.y, draw: (g, ox, oy) => drawHuman(g, E.rosa, ox, oy) });
    if (E.cat && C.state.upgrades.cat) out.push({ baseY: E.cat.y, draw: (g, ox, oy) => g.drawImage(SP.cat(E.cat.frame), Math.round(E.cat.x - 8 - ox), Math.round(E.cat.y - 12 - oy)) });
    for (const h of E.animals) out.push({ baseY: h.y, draw: (g, ox, oy) => g.drawImage(SP.chicken(h.frame ? 1 : 0, h.dir === 1 ? 1 : 0), Math.round(h.x - 6 - ox), Math.round(h.y - 12 - oy)) });
    return out;
  };
  function drawHuman(g, m, ox, oy) {
    const img = SP.humanoid(m.look, m.dir, m.frame);
    // soft shadow
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(Math.round(m.x - 5 - ox), Math.round(m.y - 2 - oy), 10, 2);
    g.drawImage(img, Math.round(m.x - 8 - ox), Math.round(m.y - 20 - oy));
  }
})();
