/* Hojarasca — 50_game.js  State, economy, upgrades, zones, gates, dumping, ending, save/load. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const T = H.TILE, W = H.world, LV = H.leaves;
  const G = (H.game = {});
  H.UPG = {
    bag: { caps: [10, 25, 60, 150, 400, 1000], costs: [15, 50, 150, 400, 1000], icon: 'bag' },
    rake: { w: [0, 1.5, 2.2, 3, 4], costs: [40, 120, 300, 700], icon: 'rake' },
    blower: { power: [0, 1, 1.5, 2.2, 3.2, 4.5], range: [0, 3.5, 4.5, 5.5, 6.5, 8], cone: [0, 50, 55, 60, 70, 80], costs: [150, 400, 900, 1800, 3500], icon: 'blower' },
    shoes: { speed: [70, 85, 100, 120], costs: [60, 200, 500], icon: 'shoes' },
    gloves: { r: [12, 18, 26], rate: [5, 9, 15], costs: [50, 150], icon: 'gloves' },
  };
  G.newState = () => ({ version: 1, coins: 0, bag: 0, bagValue: 0, tool: 'hand', up: { bag: 0, rake: 0, blower: 0, shoes: 0, gloves: 0 }, vents: {}, gates: {}, bins: { b_front: true }, zones: {}, stats: { leaves: 0, coins: 0, time: 0, dumps: 0, blown: 0 }, flags: {}, player: { x: 30 * T, y: 31 * T }, inCellar: false, ending: false, seed: (Math.random() * 1e9) | 0 });
  G.d = {};
  G.derive = function () {
    const S = H.state, u = S.up, U = H.UPG, d = G.d, z = S.zones;
    d.bagCap = U.bag.caps[u.bag] * (z.green && z.green.done ? 2 : 1);
    d.speed = U.shoes.speed[u.shoes] * (z.drive && z.drive.done ? 1.15 : 1);
    d.handR = U.gloves.r[u.gloves]; d.handRate = U.gloves.rate[u.gloves];
    d.rakeW = U.rake.w[u.rake];
    d.blower = { power: U.blower.power[u.blower] * (z.back && z.back.done ? 1.3 : 1), range: U.blower.range[u.blower] * T, cone: (U.blower.cone[u.blower] * Math.PI) / 180 };
    d.ventR = 2.6 * T * (z.pool && z.pool.done ? 1.5 : 1);
    d.valueMult = z.front && z.front.done ? 1.25 : 1;
    return d;
  };
  G.leafValue = (i) => W.ZONES[LV.ZONE[i]].value * G.d.valueMult;

  // ---- leaf collection ----------------------------------------------------------------------------
  G.pickup = function (i) { const S = H.state; if (S.bag >= G.d.bagCap) return false; LV.collect(i, 'hand'); return true; };
  LV.onCollect = function (i, how) {
    const S = H.state, v = G.leafValue(i);
    S.stats.leaves += 1;
    if (how === 'hand') { S.bag += 1; S.bagValue += v; }
    else { S.coins += v; S.stats.coins += v; H.emit('sold', { i, v, how }); }
    G.zoneCheck(LV.ZONE[i]);
  };
  G.dump = function () { const S = H.state; if (S.bag <= 0) return 0; const v = Math.round(S.bagValue); S.coins += v; S.stats.coins += v; S.stats.dumps += 1; S.bag = 0; S.bagValue = 0; H.emit('dump', v); return v; };

  // ---- shop ------------------------------------------------------------------------------------------
  G.nextCost = (id) => { const u = H.UPG[id], lv = H.state.up[id]; return lv < u.costs.length ? u.costs[lv] : null; };
  G.buy = function (id) { const S = H.state, cost = G.nextCost(id); if (cost === null || S.coins < cost) return false; S.coins -= cost; S.up[id] += 1; G.derive(); if (id === 'rake' && S.up.rake === 1) S.tool = 'rake'; if (id === 'blower' && S.up.blower === 1) S.tool = 'blower'; H.emit('buy', id); return true; };
  G.buyVent = function (id) { const S = H.state, v = W.VENTS.find((x) => x.id === id); if (!v || S.vents[id] || S.coins < v.cost) return false; S.coins -= v.cost; S.vents[id] = true; H.emit('buy', id); return true; };
  G.buyBin = function (id) { const S = H.state, b = W.BINS.find((x) => x.id === id); if (!b || S.bins[id] || S.coins < b.cost) return false; S.coins -= b.cost; S.bins[id] = true; H.emit('buy', id); return true; };
  G.zoneUnlocked = (zid) => zid === 'front' || !!H.state.gates[zid];
  G.canOpenGate = function (id) { const S = H.state, g = W.GATES.find((x) => x.id === id); if (!g || S.gates[id]) return { ok: false }; if (id === 'cellar') { const all = W.ZONES.filter((z) => z.id !== 'cellar').every((z) => G.zoneProgress(z.id) >= 0.95); if (!all) return { ok: false, reason: 'cellar' }; } return { ok: S.coins >= g.cost, cost: g.cost }; };
  G.openGate = function (id) { const S = H.state, g = W.GATES.find((x) => x.id === id); const c = G.canOpenGate(id); if (!c.ok) return false; S.coins -= g.cost; S.gates[id] = true; H.emit('gate', id); return true; };
  G.activeVents = () => W.VENTS.filter((v) => H.state.vents[v.id]).map((v) => ({ x: v.tx * T + 8, y: v.ty * T + 8, r: G.d.ventR }));
  G.activeBins = () => W.BINS.filter((b) => H.state.bins[b.id]).map((b) => ({ x: b.tx * T + 8, y: b.ty * T + 8, r: 13 }));

  // ---- zones ------------------------------------------------------------------------------------------
  G.zoneProgress = function (zid) { const z = H.state.zones[zid]; if (!z || !z.total) return 0; return 1 - LV.countAlive(W.zoneIdx(zid)) / z.total; };
  G.totalProgress = function () { let tot = 0, left = 0; for (const z of W.ZONES) { const s = H.state.zones[z.id]; if (!s) continue; tot += s.total; left += LV.countAlive(W.zoneIdx(z.id)); } return tot ? 1 - left / tot : 0; };
  G.zoneCheck = function (zi) { const z = W.ZONES[zi], s = H.state.zones[z.id]; if (!s || s.done) return; if (LV.countAlive(zi) === 0) { s.done = true; G.derive(); H.emit('zoneDone', z.id); if (z.id === 'cellar') { H.state.ending = true; H.emit('ending'); } } };
  G.spawnAll = function () { LV.clear(); const rng = H.rng(H.state.seed); W.ZONES.forEach((z, zi) => { LV.spawnZone(zi, rng); H.state.zones[z.id] = { total: LV.countAlive(zi), done: false }; }); };

  // ---- save -------------------------------------------------------------------------------------------
  G.save = function () { try { const S = H.state; S.player = { x: H.main.player.x, y: H.main.player.y }; S.inCellar = H.main.player.cellar; localStorage.setItem(H.SAVE_KEY, JSON.stringify({ state: S, leaves: LV.serialize() })); return true; } catch (e) { return false; } };
  G.hasSave = () => { try { return !!localStorage.getItem(H.SAVE_KEY); } catch (e) { return false; } };
  G.load = function () { try { const raw = localStorage.getItem(H.SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); const s = Object.assign(G.newState(), d.state); s.up = Object.assign(G.newState().up, d.state.up || {}); s.stats = Object.assign(G.newState().stats, d.state.stats || {}); return { state: s, leaves: d.leaves }; } catch (e) { return null; } };
  G.clear = () => { try { localStorage.removeItem(H.SAVE_KEY); } catch (e) { /* ignore */ } };
  G.settings = { lang: 'en', music: true, sound: true };
  G.loadSettings = function () { try { const raw = localStorage.getItem(H.SETTINGS_KEY); if (raw) Object.assign(G.settings, JSON.parse(raw)); else if (/^es/i.test(navigator.language || '')) G.settings.lang = 'es'; } catch (e) { /* ignore */ } H.setLang(G.settings.lang); };
  G.saveSettings = () => { try { localStorage.setItem(H.SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) { /* ignore */ } };
  G.start = function (loaded) { H.state = loaded ? loaded.state : G.newState(); if (loaded) LV.restore(loaded.leaves); else G.spawnAll(); G.derive(); };
})();
