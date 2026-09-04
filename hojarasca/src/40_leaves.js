/* Hojarasca — 40_leaves.js  Leaf particle simulation in flat typed arrays. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const T = H.TILE, W = H.world, A = H.art;
  const LV = (H.leaves = {});
  const MAX = 6400;
  const X = new Float32Array(MAX), Y = new Float32Array(MAX), VX = new Float32Array(MAX), VY = new Float32Array(MAX), ROT = new Float32Array(MAX);
  const TYPE = new Uint8Array(MAX), ZONE = new Int8Array(MAX), ALIVE = new Uint8Array(MAX), FLY = new Uint8Array(MAX);
  LV.X = X; LV.Y = Y; LV.VX = VX; LV.VY = VY; LV.TYPE = TYPE; LV.ZONE = ZONE; LV.ALIVE = ALIVE;
  LV.n = 0; LV.onCollect = null; LV.blownCount = 0;
  LV.clear = () => { LV.n = 0; ALIVE.fill(0); };
  LV.add = (x, y, type, zone) => { if (LV.n >= MAX) return -1; const i = LV.n++; X[i] = x; Y[i] = y; VX[i] = 0; VY[i] = 0; ROT[i] = Math.random() * 4; TYPE[i] = type; ZONE[i] = zone; ALIVE[i] = 1; FLY[i] = 0; return i; };
  LV.spawnZone = function (zi, rng) {
    const z = W.ZONES[zi]; let placed = 0, tries = 0;
    const trees = W.trees.filter((t) => W.zoneAt(t.tx, t.ty + 1) === zi || W.zoneAt(t.tx - 2, t.ty + 2) === zi);
    while (placed < z.leaves && tries++ < z.leaves * 30) {
      let tx, ty;
      if (trees.length && rng.chance(0.55)) { const t = rng.pick(trees); tx = Math.round(t.tx + rng.gauss() * 2.2); ty = Math.round(t.ty + 1 + Math.abs(rng.gauss()) * 1.8); }
      else { const r = rng.pick(z.rects); tx = r[0] + rng.int(r[2] - r[0] + 1); ty = r[1] + rng.int(r[3] - r[1] + 1); }
      if (W.zoneAt(tx, ty) !== zi || !W.leafSpawnable(tx, ty)) continue;
      LV.add(tx * T + rng() * T, ty * T + rng() * T, rng.pick(z.types), zi); placed++;
    }
  };
  LV.countAlive = function (zi) { let n = 0; for (let i = 0; i < LV.n; i++) if (ALIVE[i] && (zi === undefined || ZONE[i] === zi)) n++; return n; };
  LV.collect = function (i, how) { if (!ALIVE[i]) return; ALIVE[i] = 0; if (LV.onCollect) LV.onCollect(i, how); };

  // ctx: {px,py, tool, aim, active, mvx, mvy, blower:{power,range,cone}, rake:{w}, vents:[{x,y,r}], bins:[{x,y,r}], wind:{x,y}}
  LV.update = function (dt, c) {
    const fr = Math.pow(0.82, dt * 60), frW = Math.pow(0.95, dt * 60);
    const blow = c.tool === 'blower' && c.active && c.blower.power > 0;
    const rake = c.tool === 'rake' && c.active && c.rake.w > 0;
    const cosA = Math.cos(c.aim), sinA = Math.sin(c.aim);
    const range = c.blower.range, halfCone = c.blower.cone / 2, power = c.blower.power;
    const rw = c.rake.w * T, rd = T * 1.3;
    const moving = Math.hypot(c.mvx, c.mvy) > 2;
    let raked = 0;
    for (let i = 0; i < LV.n; i++) {
      if (!ALIVE[i]) continue;
      let vx = VX[i], vy = VY[i];
      const dx = X[i] - c.px, dy = Y[i] - c.py;
      if (blow) {
        const d = Math.hypot(dx, dy);
        if (d < range && d > 2) {
          const ang = Math.atan2(dy, dx), diff = Math.abs(H.math.angDiff(ang, c.aim));
          if (diff < halfCone) {
            const f = power * (1 - d / range) * (1 - (diff / halfCone) * 0.6) * 900 * dt;
            vx += cosA * f + (Math.random() - 0.5) * f * 0.5; vy += sinA * f + (Math.random() - 0.5) * f * 0.5;
            ROT[i] += dt * 20; if (!FLY[i]) { FLY[i] = 1; LV.blownCount++; }
          }
        }
      }
      if (rake && moving) {
        // leaves in the rectangle in front of the player (along aim) move with the player
        const along = dx * cosA + dy * sinA, side = -dx * sinA + dy * cosA;
        if (along > -2 && along < rd + 4 && Math.abs(side) < rw / 2 && raked < 400) { vx = c.mvx * 1.05 + (Math.random() - 0.5) * 6; vy = c.mvy * 1.05 + (Math.random() - 0.5) * 6; raked++; }
      }
      // vents
      for (let k = 0; k < c.vents.length; k++) { const v = c.vents[k]; const ex = v.x - X[i], ey = v.y - Y[i]; const d = Math.hypot(ex, ey); if (d < v.r) { if (d < 5) { LV.collect(i, 'vent'); break; } const f = (1 - d / v.r) * 380 * dt + 40 * dt; vx += (ex / d) * f; vy += (ey / d) * f; ROT[i] += dt * 8; } }
      if (!ALIVE[i]) continue;
      // bins: leaves pushed into a bin are sold
      for (let k = 0; k < c.bins.length; k++) { const b = c.bins[k]; if (Math.abs(X[i] - b.x) < b.r && Math.abs(Y[i] - b.y) < b.r && Math.hypot(vx, vy) > 8) { LV.collect(i, 'bin'); break; } }
      if (!ALIVE[i]) continue;
      // wind & water
      const tx = (X[i] / T) | 0, ty = (Y[i] / T) | 0;
      const water = W.isWater(tx, ty);
      if (c.wind.x || c.wind.y) { vx += c.wind.x * dt * (water ? 2 : 1); vy += c.wind.y * dt * (water ? 2 : 1); }
      if (water) { vx += Math.sin(H.time * 0.7 + i) * 3 * dt; vy += Math.cos(H.time * 0.5 + i * 0.3) * 3 * dt; }
      vx *= water ? frW : fr; vy *= water ? frW : fr;
      if (Math.abs(vx) < 0.05) vx = 0; if (Math.abs(vy) < 0.05) vy = 0;
      if (vx || vy) {
        let nx = X[i] + vx * dt, ny = Y[i] + vy * dt;
        if (W.leafBlocked((nx / T) | 0, ty)) { nx = X[i]; vx = -vx * 0.2; }
        if (W.leafBlocked(((nx / T) | 0), (ny / T) | 0)) { ny = Y[i]; vy = -vy * 0.2; }
        X[i] = nx; Y[i] = ny;
        if (ROT[i] > 4) ROT[i] -= 4;
      } else FLY[i] = 0;
      VX[i] = vx; VY[i] = vy;
    }
  };
  // hand pickup: returns indices within radius, up to max
  LV.near = function (px, py, r, max) { const out = []; const r2 = r * r; for (let i = 0; i < LV.n && out.length < max; i++) { if (!ALIVE[i]) continue; const dx = X[i] - px, dy = Y[i] - py; if (dx * dx + dy * dy < r2) out.push(i); } return out; };
  LV.draw = function (g, ox, oy, vw, vh) {
    const x0 = ox - 4, y0 = oy - 4, x1 = ox + vw + 4, y1 = oy + vh + 4;
    for (let i = 0; i < LV.n; i++) {
      if (!ALIVE[i]) continue; const x = X[i], y = Y[i]; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const fr = (ROT[i] | 0) & 3; const lift = FLY[i] && (Math.abs(VX[i]) + Math.abs(VY[i]) > 30) ? 2 : 0;
      if (lift) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect((x - ox) | 0, (y - oy + 1) | 0, 3, 1); }
      g.drawImage(A.leaf(TYPE[i], fr), (x - ox - 2) | 0, (y - oy - 2 - lift) | 0);
    }
  };
  LV.serialize = function () { const out = []; for (let i = 0; i < LV.n; i++) if (ALIVE[i]) out.push(Math.round(X[i] * 2), Math.round(Y[i] * 2), TYPE[i] * 8 + (ZONE[i] & 7)); return out; };
  LV.restore = function (arr) { LV.clear(); for (let k = 0; k + 2 < arr.length; k += 3) LV.add(arr[k] / 2, arr[k + 1] / 2, (arr[k + 2] / 8) | 0, arr[k + 2] & 7); };
})();
