/* Cafetal — 60_economy.js
   Items, inventory, shop, customers, reputation, letters and tutorial hints. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const E = C.entities, W = C.world;
  const EC = (C.econ = {});

  C.ITEMS = {
    coffee_seed: { sell: 0, cat: 'seed', crop: 'coffee' }, tomato_seed: { sell: 0, cat: 'seed', crop: 'tomato' }, corn_seed: { sell: 0, cat: 'seed', crop: 'corn' }, sunflower_seed: { sell: 0, cat: 'seed', crop: 'sunflower' },
    cherry: { sell: 8, cat: 'coffee' }, parchment: { sell: 10, cat: 'coffee' }, green: { sell: 15, cat: 'coffee' },
    roast_light: { sell: 25, cat: 'coffee' }, roast_medium: { sell: 25, cat: 'coffee' }, roast_dark: { sell: 25, cat: 'coffee' },
    tomato: { sell: 12, cat: 'crop' }, corn: { sell: 30, cat: 'crop' }, sunflower: { sell: 25, cat: 'crop' }, egg: { sell: 10, cat: 'crop' }, fish: { sell: 35, cat: 'crop' },
    milk: { sell: 2, cat: 'pantry' }, panela: { sell: 2, cat: 'pantry' }, cinnamon: { sell: 3, cat: 'pantry' }, cocoa: { sell: 4, cat: 'pantry' },
    mint: { sell: 6, cat: 'forage' }, flower: { sell: 8, cat: 'forage' },
  };
  C.ITEM_ORDER = ['coffee_seed', 'tomato_seed', 'corn_seed', 'sunflower_seed', 'cherry', 'parchment', 'green', 'roast_light', 'roast_medium', 'roast_dark', 'tomato', 'corn', 'sunflower', 'egg', 'fish', 'milk', 'panela', 'cinnamon', 'cocoa', 'mint', 'flower'];
  C.SHOP = {
    seeds: [{ id: 'coffee_seed', price: 40 }, { id: 'tomato_seed', price: 8 }, { id: 'corn_seed', price: 12 }, { id: 'sunflower_seed', price: 10 }],
    pantry: [{ id: 'milk', price: 5 }, { id: 'panela', price: 4 }, { id: 'cinnamon', price: 6 }, { id: 'cocoa', price: 8 }],
    upgrades: [
      { id: 'sprinkler', price: 600, icon: 'sprinkler' }, { id: 'roof', price: 350, icon: 'roof' }, { id: 'patio2', price: 300, icon: 'patio2' }, { id: 'roaster2', price: 500, icon: 'roaster2' },
      { id: 'hens', price: 220, icon: 'hens' }, { id: 'rod', price: 120, icon: 'rod' }, { id: 'cat', price: 250, icon: 'cat' }, { id: 'lights', price: 200, icon: 'lights' }, { id: 'bench', price: 150, icon: 'bench' },
    ],
  };
  EC.itemName = (id) => C.t('item_' + id);

  // ---- inventory ---------------------------------------------------------------------------
  EC.count = (id) => C.state.inventory[id] || 0;
  EC.add = function (id, n) { const inv = C.state.inventory; inv[id] = (inv[id] || 0) + n; C.emit('inventory', { id, n }); };
  EC.remove = function (id, n) { const inv = C.state.inventory; inv[id] = Math.max(0, (inv[id] || 0) - n); if (!inv[id]) delete inv[id]; C.emit('inventory', { id, n: -n }); };
  EC.has = (id, n) => EC.count(id) >= (n || 1);
  EC.bagList = () => C.ITEM_ORDER.filter((id) => EC.count(id) > 0).map((id) => ({ id, n: EC.count(id) }));

  // ---- money ---------------------------------------------------------------------------------
  EC.earn = function (n) { C.state.coins += n; C.state.stats.earned += n; C.state.today.earned += n; };
  EC.spend = function (n) { if (C.state.coins < n) return false; C.state.coins -= n; return true; };
  EC.buy = function (id, price, n) { n = n || 1; if (!EC.spend(price * n)) return false; EC.add(id, n); C.audio.sfx('coin'); return true; };
  EC.sell = function (id, n) { const it = C.ITEMS[id]; if (!it || !it.sell || EC.count(id) < n) return 0; EC.remove(id, n); EC.earn(it.sell * n); C.audio.sfx('coin'); return it.sell * n; };
  EC.buyUpgrade = function (id) {
    const u = C.SHOP.upgrades.find((x) => x.id === id); if (!u || C.state.upgrades[id]) return false;
    if (!EC.spend(u.price)) return false;
    C.state.upgrades[id] = true; C.audio.sfx('unlock');
    W.rebuildUpgrades();
    if (id === 'hens') E.spawnHens();
    if (id === 'sprinkler') { for (let i = 0; i < W.soil.length; i++) if (W.soil[i] === 1) W.soil[i] = 2; for (const [, c] of W.crops) c.watered = true; }
    return true;
  };

  // ---- reputation & unlocks --------------------------------------------------------------------
  EC.gainRep = function (n) {
    const before = C.state.rep; C.state.rep += n;
    const newly = Object.keys(C.RECIPES).filter((id) => C.RECIPES[id].rep > before && C.RECIPES[id].rep <= C.state.rep);
    for (const id of newly) { C.ui.toast(C.t('unlock_recipe', { drink: C.t('drink_' + id) }), 'star'); C.audio.sfx('unlock'); }
    EC.checkLetters();
  };
  EC.repLevel = () => Math.min(5, Math.floor(C.state.rep / 20)); // 0..5 hearts

  EC.checkLetters = function () {
    const S = C.state, f = S.flags;
    const thresholds = [[0, 'letter_1'], [15, 'letter_2'], [40, 'letter_3'], [80, 'letter_4']];
    for (const [rep, key] of thresholds) if (S.rep >= rep && !f[key]) { f[key] = 'pending'; if (!S.mail.includes(key)) S.mail.push(key); }
  };
  EC.readMail = function () { const S = C.state; if (!S.mail.length) return null; const key = S.mail.shift(); S.flags[key] = 'read'; return key; };

  // ---- customers ---------------------------------------------------------------------------------
  EC.scheduleDay = function () {
    const S = C.state, rep = S.rep;
    const count = Math.min(9, 2 + Math.floor(rep / 12) + (Math.random() < 0.5 ? 1 : 0));
    const defs = C.rng(S.time.day * 977).shuffle(C.NPC_DEFS.slice());
    const sched = [];
    for (let i = 0; i < count; i++) {
      const def = defs[i % defs.length];
      const hour = 8 + Math.random() * 10.5;
      sched.push({ id: def.id, hour, spawned: false, pass: false });
    }
    // a couple of passers-by for life on the road
    for (let i = 0; i < 2; i++) sched.push({ id: defs[(count + i) % defs.length].id, hour: 7 + Math.random() * 12, spawned: false, pass: true });
    sched.sort((a, b) => a.hour - b.hour);
    S.schedule = sched;
    S.today = { customers: 0, served: 0, earned: 0, eggs: 0 };
  };
  EC.pickOrder = function (def) {
    const unlocked = C.stations.unlockedRecipes();
    if (unlocked.includes(def.fav) && Math.random() < 0.6) return def.fav;
    return unlocked[Math.floor(Math.random() * unlocked.length)];
  };
  EC.update = function (dt) {
    const S = C.state;
    if (!S.schedule) return;
    for (const s of S.schedule) {
      if (s.spawned || S.time.hour < s.hour) continue;
      s.spawned = true;
      const def = C.NPC_DEFS.find((d) => d.id === s.id);
      if (s.pass) { E.spawnCustomer(def, null, true); continue; }
      if (E.waitingCustomers().length >= W.customerSpots.length) continue;
      E.spawnCustomer(def, EC.pickOrder(def), false);
      S.today.customers += 1;
    }
  };
  // Serve a waiting customer. Returns {coins, tip} or null.
  EC.serve = function (npc) {
    const id = npc.order;
    if (!C.stations.brew(id)) return null;
    const rec = C.RECIPES[id];
    const speed = 1 - Math.min(1, npc.waited / npc.patience);
    const tip = Math.round(speed * 4 + Math.min(6, C.state.rep / 15) + (id === npc.def.fav ? 3 : 0));
    EC.earn(rec.price + tip);
    npc.served = true;
    C.state.stats.served += 1; C.state.today.served += 1;
    EC.gainRep(2 + (id === npc.def.fav ? 1 : 0));
    const th = C.NPC_LINES.thanks;
    const line = Math.random() < 0.4 ? C.npcLine(npc.def.lines[Math.floor(Math.random() * npc.def.lines.length)]) : C.npcLine(th[Math.floor(Math.random() * th.length)]);
    E.leaveCustomer(npc, line);
    C.audio.sfx('coin');
    return { coins: rec.price, tip };
  };
  EC.refuse = function (npc) { E.leaveCustomer(npc, C.npcLine(C.NPC_LINES.sorry[Math.floor(Math.random() * 2)])); };

  // ---- morning chores driven by upgrades ---------------------------------------------------
  C.on('newDay', () => {
    const S = C.state;
    if (S.upgrades.hens) {
      const z = W.henZone; let laid = 0;
      for (let tries = 0; tries < 12 && laid < 2; tries++) {
        const x = z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1)), y = z.y0 + Math.floor(Math.random() * (z.y1 - z.y0 + 1));
        const i = W.idx(x, y);
        if (W.walkable(x, y) && !W.forage.has(i) && W.ground[i] === C.G.GRASS) { W.forage.set(i, 'egg'); laid++; }
      }
    }
    EC.scheduleDay();
    EC.checkLetters();
    S.stats.daysPlayed += 1;
  });

  // ---- tutorial hints (soft, in order) ------------------------------------------------------
  const HINTS = ['hint_tap_move', 'hint_hoe', 'hint_seed', 'hint_water', 'hint_cafe', 'hint_coffee_done', 'hint_pulper', 'hint_patio', 'hint_roaster'];
  EC.tutorialStep = () => C.state.flags.tutorial || 0;
  EC.tutorialAdvance = function (stepDone) {
    const f = C.state.flags; const cur = f.tutorial || 0;
    if (HINTS[cur] === stepDone) { f.tutorial = cur + 1; if (f.tutorial < HINTS.length) setTimeout(() => C.ui.hint(C.t(HINTS[f.tutorial])), 900); else C.ui.toast(C.t('tutorial_done'), 'check'); }
  };
  EC.currentHint = () => (EC.tutorialStep() < HINTS.length ? C.t(HINTS[EC.tutorialStep()]) : null);
})();
