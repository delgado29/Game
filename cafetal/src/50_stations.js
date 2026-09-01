/* Cafetal — 50_stations.js
   Pulper, drying patio, roaster mini-game, recipes and brewing. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp } = C.math;
  const ST = (C.stations = {});

  C.RECIPES = {
    espresso: { needs: { roast_dark: 1 }, price: 18, rep: 0 },
    americano: { needs: { roast_medium: 1 }, price: 16, rep: 0 },
    latte: { needs: { roast_medium: 1, milk: 1 }, price: 26, rep: 0 },
    cappuccino: { needs: { roast_dark: 1, milk: 1 }, price: 28, rep: 10 },
    olla: { needs: { roast_dark: 1, panela: 1, cinnamon: 1 }, price: 32, rep: 20 },
    cold_brew: { needs: { roast_light: 2 }, price: 30, rep: 35 },
    mocha: { needs: { roast_dark: 1, milk: 1, cocoa: 1 }, price: 38, rep: 50 },
    mint_tea: { needs: { mint: 1, panela: 1 }, price: 20, rep: 70 },
  };
  ST.unlockedRecipes = () => Object.keys(C.RECIPES).filter((id) => C.state.rep >= C.RECIPES[id].rep);
  ST.missingFor = function (id) {
    const inv = C.state.inventory, out = [];
    for (const it in C.RECIPES[id].needs) { const need = C.RECIPES[id].needs[it], have = inv[it] || 0; if (have < need) out.push({ item: it, n: need - have }); }
    return out;
  };
  ST.brew = function (id) {
    if (ST.missingFor(id).length) return false;
    for (const it in C.RECIPES[id].needs) C.econ.remove(it, C.RECIPES[id].needs[it]);
    return true;
  };

  // ---- pulper -----------------------------------------------------------------------------
  ST.pulp = function () {
    const n = C.econ.count('cherry');
    if (!n) return 0;
    C.econ.remove('cherry', n); C.econ.add('parchment', n);
    return n;
  };

  // ---- patio ------------------------------------------------------------------------------
  ST.patioCap = () => (C.state.upgrades.patio2 ? 40 : 20);
  ST.DRY_DAYS = 2;
  // returns {action:'collect'|'load'|'full'|'empty'|'none', n}
  ST.patioInteract = function () {
    const p = C.state.patio, cap = ST.patioCap();
    if (p.n > 0 && p.dry) { const n = p.n; C.econ.add('green', n); p.n = 0; p.days = 0; p.dry = false; return { action: 'collect', n }; }
    const have = C.econ.count('parchment');
    const room = cap - p.n;
    if (have > 0 && room > 0) { const n = Math.min(have, room); C.econ.remove('parchment', n); p.n += n; return { action: 'load', n }; }
    if (have > 0 && room <= 0) return { action: 'full', n: 0 };
    if (p.n > 0) return { action: 'status', n: p.n };
    return { action: 'empty', n: 0 };
  };
  C.on('newDay', () => {
    const p = C.state.patio;
    if (p.n > 0 && !p.dry) {
      const raining = C.state.weather === 'rain' || C.state.weather === 'snow';
      if (!raining || C.state.upgrades.roof) { p.days += 1; if (p.days >= ST.DRY_DAYS) p.dry = true; }
    }
  });

  // ---- roaster ------------------------------------------------------------------------------
  ST.roastCap = () => (C.state.upgrades.roaster2 ? 20 : 10);
  ST.ROAST_WINDOWS = { light: [0.30, 0.44], medium: [0.52, 0.66], dark: [0.72, 0.86] };
  ST.ROAST_DURATION = 5.2; // seconds of holding to reach 1.0
  ST.roast = null;
  ST.startRoast = function (level) {
    const n = Math.min(C.econ.count('green'), ST.roastCap());
    if (n <= 0) return null;
    C.econ.remove('green', n);
    ST.roast = { level, n, t: 0, holding: false, done: false, result: null, popT: 0 };
    return ST.roast;
  };
  ST.updateRoast = function (dt) {
    const r = ST.roast; if (!r || r.done) return;
    if (r.holding) {
      r.t = clamp(r.t + dt / ST.ROAST_DURATION, 0, 1);
      r.popT -= dt;
      if (r.t > 0.35 && r.popT <= 0) { r.popT = 0.08 + Math.random() * 0.25 * (1.2 - r.t); C.audio.sfx('pop'); }
      if (r.t >= 1) ST.releaseRoast();
    }
  };
  ST.releaseRoast = function () {
    const r = ST.roast; if (!r || r.done) return null;
    r.done = true; r.holding = false;
    const [a, b] = ST.ROAST_WINDOWS[r.level], mid = (a + b) / 2, half = (b - a) / 2;
    let grade, yieldN;
    if (r.t < a) { grade = 'under'; yieldN = Math.max(1, Math.floor(r.n * 0.7)); }
    else if (r.t <= b) { grade = Math.abs(r.t - mid) <= half * 0.45 ? 'perfect' : 'good'; yieldN = grade === 'perfect' ? r.n + 2 : r.n; }
    else if (r.t <= b + 0.08) { grade = 'good'; yieldN = r.n; }
    else { grade = 'burnt'; yieldN = Math.max(1, Math.floor(r.n * 0.4)); }
    C.econ.add('roast_' + r.level, yieldN);
    r.result = { grade, n: yieldN };
    C.state.stats.roasts = (C.state.stats.roasts || 0) + 1;
    if (grade === 'perfect') C.state.stats.perfectRoasts = (C.state.stats.perfectRoasts || 0) + 1;
    return r.result;
  };
  // bean colour along the roast bar
  ST.roastColor = function (t) {
    const stops = [[0, '#9fbf6a'], [0.25, '#c9b06a'], [0.4, '#b98a4a'], [0.58, '#8a5a30'], [0.78, '#4a2e1e'], [0.9, '#2a1a10'], [1, '#111']];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; return C.color.mix(c0, c1, (t - t0) / (t1 - t0)); }
    return '#111';
  };

  // ---- fishing ---------------------------------------------------------------------------------
  ST.fish = null;
  ST.startFishing = function () { ST.fish = { t: 0, bite: 1.2 + Math.random() * 3.2, window: 0.75, state: 'wait', result: null }; return ST.fish; };
  ST.updateFishing = function (dt) {
    const f = ST.fish; if (!f || f.state === 'done') return;
    f.t += dt;
    if (f.state === 'wait' && f.t >= f.bite) { f.state = 'bite'; C.audio.sfx('splash'); }
    if (f.state === 'bite' && f.t >= f.bite + f.window) { f.state = 'done'; f.result = 'missed'; }
  };
  ST.tapFishing = function () {
    const f = ST.fish; if (!f) return null;
    if (f.state === 'bite') { f.state = 'done'; f.result = 'caught'; C.econ.add('fish', 1); C.audio.sfx('reel'); C.audio.sfx('harvest'); return 'caught'; }
    if (f.state === 'wait') { f.state = 'done'; f.result = 'missed'; return 'missed'; }
    return null;
  };
})();
