/* Leña — 30_game.js
   State, balance, upgrades, tree lifecycle, selling, prestige, achievements,
   offline progress, save/load. Pure logic: no drawing here. */
(function () {
  'use strict';
  const L = window.Lena;
  const G = (L.game = {});

  L.SPECIES = [
    { id: 'pine', at: 0, hp: 12, value: 1 },
    { id: 'birch', at: 15, hp: 60, value: 3 },
    { id: 'oak', at: 40, hp: 400, value: 12 },
    { id: 'maple', at: 80, hp: 3000, value: 45 },
    { id: 'redwood', at: 140, hp: 25000, value: 180 },
    { id: 'ancient', at: 220, hp: 250000, value: 900 },
    { id: 'ironwood', at: 320, hp: 3e6, value: 5000 },
    { id: 'worldtree', at: 450, hp: 5e7, value: 40000 },
  ];
  L.UPG = {
    axe: { base: 25, growth: 2.6, max: 26, icon: 'axe', tab: 'chop' },
    sharpen: { base: 80, growth: 5, max: 10, icon: 'whetstone', tab: 'chop' },
    hire: { base: 30, growth: 1.27, max: 300, icon: 'worker', tab: 'crew' },
    training: { base: 200, growth: 5, max: 24, icon: 'book', tab: 'crew' },
    coffee: { base: 1500, growth: 7, max: 12, icon: 'coffee', tab: 'crew' },
    growth: { base: 60, growth: 3.5, max: 12, icon: 'sapling', tab: 'forest' },
    market: { base: 150, growth: 3, max: 30, icon: 'scale', tab: 'trade' },
    merchant: { base: 300, growth: 3.6, max: 12, icon: 'wagon', tab: 'trade' },
    mill: { base: 800, growth: 4.5, max: 15, icon: 'mill', tab: 'trade' },
  };
  L.TABS = { chop: ['axe', 'sharpen'], crew: ['hire', 'training', 'coffee'], trade: ['market', 'merchant', 'mill'], forest: ['growth'] };
  L.PRESTIGE_MIN = 1e6;

  G.newState = () => ({
    version: 1,
    coins: 0, earnedRun: 0, lifetimeEarned: 0, acorns: 0, forests: 0,
    logs: 0, logValue: 0, planks: 0, plankValue: 0,
    up: { axe: 0, sharpen: 0, hire: 0, training: 0, coffee: 0, growth: 0, market: 0, merchant: 0, mill: 0 },
    felled: 0, lifetimeFelled: 0, taps: 0, crits: 0, bestSpecies: 0,
    tree: null, merchantT: 0, playTime: 0, lastSeen: Date.now(),
    ach: {}, flags: {}, buyMode: 1,
  });

  G.speciesFor = (n) => { let s = L.SPECIES[0]; for (const sp of L.SPECIES) if (n >= sp.at) s = sp; return s; };
  G.nextSpecies = (n) => L.SPECIES.find((sp) => sp.at > n) || null;
  G.hpFor = (n) => { const sp = G.speciesFor(n); return sp.hp * Math.pow(1.06, n - sp.at); };
  G.logsFor = (n) => { const sp = G.speciesFor(n); return 6 + Math.floor((n - sp.at) / 8); };
  G.cost = (id, lvl) => L.UPG[id].base * Math.pow(L.UPG[id].growth, lvl);
  G.costN = (id, n) => { const S = L.state; let c = 0; for (let i = 0; i < n; i++) { if (S.up[id] + i >= L.UPG[id].max) break; c += G.cost(id, S.up[id] + i); } return c; };
  G.affordableN = (id) => { const S = L.state; let n = 0, c = 0; while (S.up[id] + n < L.UPG[id].max) { const cc = G.cost(id, S.up[id] + n); if (c + cc > S.coins) break; c += cc; n++; if (n >= 1000) break; } return n; };
  G.buyCount = (id) => { const S = L.state; const left = L.UPG[id].max - S.up[id]; if (S.buyMode === 'max') return Math.max(1, Math.min(left, G.affordableN(id))); return Math.min(left, S.buyMode); };

  // ---- derived multipliers ---------------------------------------------------------------
  G.d = {};
  G.derive = function () {
    const S = L.state, u = S.up, d = G.d;
    d.achCount = Object.keys(S.ach).length;
    d.global = (1 + 0.1 * S.acorns) * (1 + 0.02 * d.achCount);
    d.axe = Math.pow(2, u.axe) * d.global;
    d.crit = 0.04 * u.sharpen;
    d.crewEach = 0.6 * d.axe * Math.pow(1.5, u.training) * Math.pow(1.15, u.coffee);
    d.crew = u.hire * d.crewEach;
    d.regrow = 4 * Math.pow(0.8, u.growth);
    d.sell = Math.pow(1.25, u.market) * d.global;
    d.merchant = u.merchant ? 20 * Math.pow(0.85, u.merchant - 1) : 0;
    d.mill = u.mill ? Math.pow(1.6, u.mill - 1) : 0;
    return d;
  };

  // ---- tree lifecycle ---------------------------------------------------------------------
  G.spawnTree = function (state) {
    const S = L.state, n = S.felled, sp = G.speciesFor(n);
    S.tree = { n, species: sp.id, hp: G.hpFor(n), maxHp: G.hpFor(n), state: state || 'up', t: 0, seed: n * 7 + S.forests * 13 };
  };
  G.stockValue = () => (L.state.logValue + L.state.plankValue * 5) * G.d.sell;

  G.damage = function (amount, src) {
    const S = L.state, T = S.tree; if (!T || T.state !== 'up') return 0;
    T.hp -= amount;
    if (T.hp <= 0) { T.hp = 0; G.fell(); }
    return amount;
  };
  G.fell = function () {
    const S = L.state, T = S.tree, sp = G.speciesFor(T.n);
    const logs = G.logsFor(T.n);
    S.logs += logs; S.logValue += logs * sp.value;
    S.felled += 1; S.lifetimeFelled += 1;
    T.state = 'falling'; T.t = 0;
    const spIdx = L.SPECIES.indexOf(sp); if (spIdx > S.bestSpecies) S.bestSpecies = spIdx;
    L.emit('fell', { logs, species: sp.id, n: T.n });
    G.checkAch();
  };
  G.chop = function () {
    const S = L.state; if (!S.tree || S.tree.state !== 'up') return null;
    const crit = Math.random() < G.d.crit; const dmg = G.d.axe * (crit ? 4 : 1);
    S.taps += 1; if (crit) S.crits += 1;
    G.damage(dmg, 'tap');
    return { dmg, crit };
  };

  // ---- tick ----------------------------------------------------------------------------------
  G.tick = function (dt, silent) {
    const S = L.state, d = G.d, T = S.tree;
    S.playTime += dt;
    if (T.state === 'falling') { T.t += dt; if (T.t >= 1.0) { G.spawnTree('grow'); if (!silent) L.emit('regrow'); } }
    else if (T.state === 'grow') { T.t += dt; if (T.t >= d.regrow) { T.state = 'up'; T.t = 0; if (!silent) L.emit('treeUp', T); } }
    else if (d.crew > 0) G.damage(d.crew * dt, 'crew');
    if (d.mill > 0 && S.logs > 0) { const conv = Math.min(S.logs, d.mill * dt); const frac = conv / S.logs; const v = S.logValue * frac; S.logs -= conv; S.logValue -= v; S.planks += conv; S.plankValue += v; if (S.logs < 1e-6) { S.logs = 0; S.logValue = 0; } }
    if (d.merchant > 0) { S.merchantT += dt; if (S.merchantT >= d.merchant) { S.merchantT = 0; if (S.logs + S.planks > 0.5) G.sell(true, silent); } }
  };
  G.sell = function (auto, silent) {
    const S = L.state; const v = G.stockValue(); if (v <= 0) return 0;
    S.coins += v; S.earnedRun += v; S.lifetimeEarned += v;
    S.logs = 0; S.logValue = 0; S.planks = 0; S.plankValue = 0;
    if (!silent) L.emit('sell', { coins: v, auto });
    G.checkAch();
    return v;
  };
  G.buy = function (id, n) {
    const S = L.state, u = L.UPG[id]; n = n || G.buyCount(id);
    const cost = G.costN(id, n); if (n <= 0 || S.coins < cost || S.up[id] >= u.max) return false;
    S.coins -= cost; S.up[id] = Math.min(u.max, S.up[id] + n);
    G.derive(); L.emit('buy', { id, n }); G.checkAch();
    return true;
  };

  // ---- prestige ------------------------------------------------------------------------------
  G.prestigeGain = () => (L.state.earnedRun >= L.PRESTIGE_MIN ? Math.floor(3 * Math.sqrt(L.state.earnedRun / L.PRESTIGE_MIN)) : 0);
  G.prestige = function () {
    const S = L.state, gain = G.prestigeGain(); if (gain <= 0) return false;
    S.acorns += gain; S.forests += 1;
    S.coins = 0; S.earnedRun = 0; S.logs = 0; S.logValue = 0; S.planks = 0; S.plankValue = 0; S.felled = 0; S.merchantT = 0;
    for (const k in S.up) S.up[k] = 0;
    G.derive(); G.spawnTree('up'); G.checkAch();
    L.emit('prestige', { gain });
    return true;
  };

  // ---- achievements ------------------------------------------------------------------------------
  L.ACH = [
    ['first', (S) => S.lifetimeFelled >= 1], ['felled10', (S) => S.lifetimeFelled >= 10], ['felled100', (S) => S.lifetimeFelled >= 100], ['felled1000', (S) => S.lifetimeFelled >= 1000], ['felled10000', (S) => S.lifetimeFelled >= 10000],
    ['taps100', (S) => S.taps >= 100], ['taps1000', (S) => S.taps >= 1000], ['taps10000', (S) => S.taps >= 10000],
    ['coins1k', (S) => S.lifetimeEarned >= 1e3], ['coins100k', (S) => S.lifetimeEarned >= 1e5], ['coins10m', (S) => S.lifetimeEarned >= 1e7], ['coins1b', (S) => S.lifetimeEarned >= 1e9],
    ['crew1', (S) => S.up.hire >= 1], ['crew10', (S) => S.up.hire >= 10], ['crew50', (S) => S.up.hire >= 50], ['mill', (S) => S.up.mill >= 1], ['wagon', (S) => S.up.merchant >= 1],
    ['oak', (S) => S.bestSpecies >= 2], ['redwood', (S) => S.bestSpecies >= 4], ['worldtree', (S) => S.bestSpecies >= 7], ['forest1', (S) => S.forests >= 1], ['forest5', (S) => S.forests >= 5], ['crit', (S) => S.crits >= 1],
  ];
  G.checkAch = function () {
    const S = L.state; let any = false;
    for (const [id, fn] of L.ACH) if (!S.ach[id] && fn(S)) { S.ach[id] = Date.now(); any = true; L.emit('ach', id); }
    if (any) G.derive();
  };

  // ---- offline ------------------------------------------------------------------------------------
  G.simulateOffline = function (seconds) {
    const S = L.state; seconds = Math.min(seconds, 8 * 3600); if (seconds < 5) return null;
    const felled0 = S.lifetimeFelled, coins0 = S.coins;
    const steps = Math.ceil(seconds); const dt = seconds / steps;
    for (let i = 0; i < steps; i++) G.tick(dt, true);
    G.checkAch();
    return { seconds, trees: S.lifetimeFelled - felled0, coins: S.coins - coins0, pile: S.logs + S.planks };
  };

  // ---- save / load ----------------------------------------------------------------------------------
  G.save = function () { try { L.state.lastSeen = Date.now(); localStorage.setItem(L.SAVE_KEY, JSON.stringify(L.state)); return true; } catch (e) { return false; } };
  G.load = function () { try { const raw = localStorage.getItem(L.SAVE_KEY); if (!raw) return null; const s = Object.assign(G.newState(), JSON.parse(raw)); s.up = Object.assign(G.newState().up, s.up || {}); return s; } catch (e) { return null; } };
  G.clear = function () { try { localStorage.removeItem(L.SAVE_KEY); } catch (e) { /* ignore */ } };
  G.settings = { lang: 'en', music: true, sound: true };
  G.loadSettings = function () { try { const raw = localStorage.getItem(L.SETTINGS_KEY); if (raw) Object.assign(G.settings, JSON.parse(raw)); else if (/^es/i.test(navigator.language || '')) G.settings.lang = 'es'; } catch (e) { /* ignore */ } L.setLang(G.settings.lang); };
  G.saveSettings = function () { try { localStorage.setItem(L.SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) { /* ignore */ } };

  G.boot = function () {
    const loaded = G.load();
    L.state = loaded || G.newState();
    G.derive();
    if (!L.state.tree) G.spawnTree('up');
    let offline = null;
    if (loaded) { const away = (Date.now() - (loaded.lastSeen || Date.now())) / 1000; if (away > 30) offline = G.simulateOffline(away); }
    return offline;
  };
})();
