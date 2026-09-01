/* Cafetal — 80_save.js
   Game state creation, localStorage save/load, settings. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const W = C.world;
  const SV = (C.save = {});

  SV.newState = function () {
    return {
      version: 1,
      time: { day: 1, hour: C.DAY_START_HOUR + 0.5, season: 0, year: 1 },
      weather: 'clear', forecast: 'clear',
      coins: 120, rep: 0,
      inventory: { tomato_seed: 6, coffee_seed: 3, roast_medium: 4, roast_dark: 3, milk: 3 },
      upgrades: { sprinkler: false, roof: false, patio2: false, roaster2: false, cat: false, lights: false, bench: false, hens: false, rod: false },
      patio: { n: 0, days: 0, dry: false },
      flags: { tutorial: 0 },
      mail: [],
      stats: { served: 0, earned: 0, daysPlayed: 1, roasts: 0, perfectRoasts: 0 },
      today: { customers: 0, served: 0, earned: 0, eggs: 0 },
      player: { tx: 9, ty: 14 },
      schedule: null,
      tool: 'hand',
    };
  };

  SV.serialize = function () {
    const S = C.state;
    S.player = { tx: C.entities.player.tx, ty: C.entities.player.ty };
    const soil = [];
    for (let i = 0; i < W.soil.length; i++) if (W.soil[i]) soil.push([i, W.soil[i]]);
    const crops = [...W.crops].map(([i, c]) => [i, c.type, c.days, c.watered ? 1 : 0]);
    const forage = [...W.forage];
    return JSON.stringify({ state: S, soil, crops, forage, savedAt: Date.now() });
  };
  SV.applyWorld = function (data) {
    W.soil.fill(0); W.crops.clear(); W.forage.clear();
    for (const [i, v] of data.soil || []) W.soil[i] = v;
    for (const [i, type, days, watered] of data.crops || []) if (C.CROPS[type]) W.crops.set(i, { type, days, watered: !!watered });
    for (const [i, t] of data.forage || []) W.forage.set(i, t);
  };
  SV.save = function () {
    try { localStorage.setItem(C.SAVE_KEY, SV.serialize()); return true; } catch (e) { return false; }
  };
  SV.hasSave = function () { try { return !!localStorage.getItem(C.SAVE_KEY); } catch (e) { return false; } };
  SV.load = function () {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY); if (!raw) return null;
      const data = JSON.parse(raw);
      const fresh = SV.newState();
      // merge to keep forward-compat with new fields
      const S = Object.assign(fresh, data.state);
      S.upgrades = Object.assign(fresh.upgrades, data.state.upgrades || {});
      S.stats = Object.assign(fresh.stats, data.state.stats || {});
      S.flags = Object.assign(fresh.flags, data.state.flags || {});
      S.patio = Object.assign(fresh.patio, data.state.patio || {});
      return { state: S, world: data };
    } catch (e) { return null; }
  };
  SV.clear = function () { try { localStorage.removeItem(C.SAVE_KEY); } catch (e) { /* ignore */ } };

  SV.settings = { lang: 'en', music: true, sound: true };
  SV.loadSettings = function () {
    try { const raw = localStorage.getItem(C.SETTINGS_KEY); if (raw) Object.assign(SV.settings, JSON.parse(raw)); } catch (e) { /* ignore */ }
    if (!localStorage.getItem(C.SETTINGS_KEY) && /^es/i.test(navigator.language || '')) SV.settings.lang = 'es';
    C.setLang(SV.settings.lang);
  };
  SV.saveSettings = function () { try { localStorage.setItem(C.SETTINGS_KEY, JSON.stringify(SV.settings)); } catch (e) { /* ignore */ } };
})();
