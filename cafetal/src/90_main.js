/* Cafetal — 90_main.js
   Game loop, camera, world rendering (ground, sorted sprites, weather, lighting),
   tap-to-act logic, sleep/day cycle, autosave. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp, lerp } = C.math;
  const T = C.TILE, MW = C.MAP_W, MH = C.MAP_H;
  const SP = C.sprites, W = C.world, E = C.entities, EC = C.econ, ST = C.stations, UI = C.ui;
  const GM = (C.game = { mode: 'title', scale: 3, dpr: 1, cssW: 0, cssH: 0, cam: { x: 0, y: 0 }, time: 0 });

  let canvas, g, worldCv, worldG, lightCv, lightG;
  let particles = [], fireflies = [], drops = [], leaves = [];
  let fade = 0, fadeDir = 0, sleeping = false, autosaveT = 0, tapMark = null, pendingSummary = null;
  let lastNow = 0;

  // ---- setup ------------------------------------------------------------------------------
  GM.init = function () {
    canvas = document.getElementById('game');
    g = canvas.getContext('2d');
    C.save.loadSettings();
    C.audio.setMusic(C.save.settings.music); C.audio.setSound(C.save.settings.sound);
    worldCv = C.canvas(320, 240); worldG = C.ctx2d(worldCv);
    lightCv = C.canvas(320, 240); lightG = C.ctx2d(lightCv);
    GM.resize();
    window.addEventListener('resize', GM.resize);
    window.addEventListener('orientationchange', () => setTimeout(GM.resize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', GM.resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (GM.mode === 'play') C.save.save(); C.audio.suspend(); } else C.audio.resume(); });
    // load save (so the title screen shows the player's farm) or start fresh
    const loaded = C.save.load();
    GM.setup(loaded);
    UI.bindInput(canvas);
    UI.open('title');
    C.on('midnight', () => { if (!sleeping) { UI.toast(C.t('midnight'), 'moon'); GM.sleep(); } });
    requestAnimationFrame(loop);
  };
  GM.setup = function (loaded) {
    C.state = loaded ? loaded.state : C.save.newState();
    W.build();
    if (loaded) C.save.applyWorld(loaded.world);
    else { W.soil.fill(0); W.crops.clear(); W.forage.clear(); for (let y = 15; y <= 17; y++) for (let x = 15; x <= 18; x++) W.soil[W.idx(x, y)] = 1; for (const [x, y] of W.forageSpots.slice(0, 6)) W.forage.set(W.idx(x, y), Math.random() < 0.5 ? 'mint' : 'flower'); }
    const p = C.state.player || { tx: 9, ty: 14 };
    E.initPlayer(W.walkable(p.tx, p.ty) ? p.tx : 9, W.walkable(p.tx, p.ty) ? p.ty : 14);
    E.initStatics(); E.npcs = [];
    if (!C.state.schedule) EC.scheduleDay();
    EC.checkLetters();
    GM.cam.x = clamp(E.player.x - worldCv.width / 2, 0, MW * T - worldCv.width);
    GM.cam.y = clamp(E.player.y - worldCv.height / 2, 0, MH * T - worldCv.height);
    initAmbientParticles();
  };
  GM.newGame = function () {
    C.save.clear(); UI.modal = null; GM.setup(null); GM.mode = 'play'; sleeping = false; fade = 0; fadeDir = 0;
    C.save.save();
    setTimeout(() => { if (GM.mode === 'play' && !UI.modal) { const key = EC.readMail(); if (key) { UI.open('letter', { key }); C.audio.sfx('letter'); } } }, 1200);
    setTimeout(() => UI.hint(EC.currentHint()), 4000);
  };
  GM.continueGame = function () { UI.modal = null; GM.mode = 'play'; const h = EC.currentHint(); if (h) UI.hint(h); };
  GM.toggleLang = function () { const s = C.save.settings; s.lang = s.lang === 'es' ? 'en' : 'es'; C.setLang(s.lang); C.save.saveSettings(); if (UI.hintText) UI.hintText = EC.currentHint(); };

  GM.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = window.innerWidth, ch = window.innerHeight;
    GM.dpr = dpr; GM.cssW = cw; GM.cssH = ch;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    GM.scale = clamp(Math.round(Math.min(cw, ch) / (T * 17)), 2, 6);
    const ww = Math.ceil(cw / GM.scale) + 1, wh = Math.ceil(ch / GM.scale) + 1;
    worldCv.width = Math.min(ww, MW * T); worldCv.height = Math.min(wh, MH * T);
    lightCv.width = worldCv.width; lightCv.height = worldCv.height;
    worldG.imageSmoothingEnabled = false; lightG.imageSmoothingEnabled = false;
    UI.resize(cw, ch);
    // safe-area probe
    try {
      let probe = document.getElementById('safeprobe');
      if (!probe) { probe = document.createElement('div'); probe.id = 'safeprobe'; probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)'; document.body.appendChild(probe); }
      const cs = getComputedStyle(probe);
      UI.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    } catch (e) { /* ignore */ }
  };

  // ---- coordinate helpers -------------------------------------------------------------------
  GM.worldToScreen = (wx, wy) => [(wx - GM.cam.x) * GM.scale, (wy - GM.cam.y) * GM.scale];
  GM.screenToWorld = (sx, sy) => [GM.cam.x + sx / GM.scale, GM.cam.y + sy / GM.scale];
  GM.screenToTile = (sx, sy) => { const [wx, wy] = GM.screenToWorld(sx, sy); return [Math.floor(wx / T), Math.floor(wy / T)]; };

  // ---- loop ----------------------------------------------------------------------------------
  function loop(now) {
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now;
    GM.time += dt;
    update(dt);
    render(dt);
    requestAnimationFrame(loop);
  }

  function update(dt) {
    UI.update(dt);
    const playing = GM.mode === 'play';
    if (playing && !UI.pausesTime() && !sleeping) {
      W.tick(dt);
      E.update(dt);
      EC.update(dt);
      autosaveT += dt; if (autosaveT > 25) { autosaveT = 0; C.save.save(); }
    } else if (playing && UI.modal && UI.modal.type === 'order') {
      E.update(dt); // customers keep waiting while you decide
    }
    // camera follow
    const p = E.player;
    const tx = clamp(p.x - worldCv.width / 2, 0, MW * T - worldCv.width), ty = clamp(p.y - 6 - worldCv.height / 2, 0, MH * T - worldCv.height);
    const k = 1 - Math.exp(-dt * 5);
    GM.cam.x = lerp(GM.cam.x, tx, k); GM.cam.y = lerp(GM.cam.y, ty, k);
    // fade
    if (fadeDir) { fade = clamp(fade + fadeDir * dt * 1.6, 0, 1); if (fade === 1 && fadeDir > 0) { fadeDir = 0; onFadedOut(); } if (fade === 0 && fadeDir < 0) fadeDir = 0; }
    updateParticles(dt);
    // audio env
    const night = 1 - W.daylight();
    C.audio.env.rain = C.state.weather === 'rain' ? 1 : 0; C.audio.env.night = night; C.audio.env.snow = C.state.weather === 'snow' ? 1 : 0;
    C.audio.update(dt);
    if (tapMark) { tapMark.t += dt; if (tapMark.t > 0.5) tapMark = null; }
  }

  // ---- sleep / day cycle ------------------------------------------------------------------------
  GM.sleep = function () {
    if (sleeping) return; sleeping = true; E.stop(E.player); GM.pending = null;
    C.audio.sfx('sleep'); fadeDir = 1; UI.modal = null;
  };
  function onFadedOut() {
    const today = { ...C.state.today };
    W.newDay();
    E.npcs = [];
    const p = E.player; p.x = 9 * T + 8; p.y = 13 * T + 16; p.tx = 9; p.ty = 13; p.dir = 0; p.path = null;
    GM.cam.x = clamp(p.x - worldCv.width / 2, 0, MW * T - worldCv.width); GM.cam.y = clamp(p.y - worldCv.height / 2, 0, MH * T - worldCv.height);
    initAmbientParticles();
    C.save.save();
    UI.open('summary', today);
  }
  GM.afterSummary = function () {
    sleeping = false; fadeDir = -1;
    if (C.state.mail.length && !UI.modal) { setTimeout(() => { if (!UI.modal) { UI.toast(C.t('letter'), 'letter'); } }, 800); }
  };

  // ---- input: world taps --------------------------------------------------------------------------
  GM.pending = null;
  GM.cancelAction = function () { GM.pending = null; E.stop(E.player); };
  GM.onWorldDown = function () { };
  GM.onWorldDrag = function () { };
  GM.onWorldDragEnd = function () { };

  function face(m, tx, ty) { const dx = tx - m.tx, dy = ty - m.ty; if (Math.abs(dx) > Math.abs(dy)) m.dir = dx > 0 ? 2 : 1; else if (dy !== 0) m.dir = dy > 0 ? 0 : 3; }
  function goThen(stand, fn, tx, ty) {
    const p = E.player;
    if (!stand) { C.audio.sfx('error'); return false; }
    const ok = E.moveTo(p, stand[0], stand[1], () => { face(p, tx, ty); fn(); });
    if (!ok) C.audio.sfx('error');
    else EC.tutorialAdvance('hint_tap_move');
    return ok;
  }
  function standFor(tx, ty) { return W.nearestStand(tx, ty, E.player.tx, E.player.ty) || (W.walkable(tx, ty) ? [tx, ty] : null); }

  GM.onWorldTap = function (sx, sy) {
    if (GM.mode !== 'play' || sleeping) return;
    const [tx, ty] = GM.screenToTile(sx, sy);
    if (!W.inMap(tx, ty)) return;
    tapMark = { x: sx, y: sy, t: 0 };
    const S = C.state, tool = S.tool, p = E.player, i = W.idx(tx, ty);
    C.audio.sfx('tap');
    // customers
    const cust = E.customerAt(tx, ty);
    if (cust && cust.state === 'wait') { GM.tapCustomer(cust); return; }
    // cat & hens
    if (S.upgrades.cat && Math.abs(E.cat.x - (tx * T + 8)) < 10 && Math.abs(E.cat.y - (ty * T + 14)) < 12) { C.audio.sfx('meow'); E.say(E.cat, '♥', 1.5); burst(E.cat.x, E.cat.y - 10, '#f06a8a', 6); return; }
    const hen = E.animals.find((h) => h.tx === tx && h.ty === ty); if (hen) { C.audio.sfx('cluck'); burst(hen.x, hen.y - 8, '#f4f4f0', 4); }
    // interactables
    const obj = W.interactableAt(tx, ty);
    if (obj) { goThen(obj.stand || standFor(tx, ty), () => GM.interact(obj), tx, ty); return; }
    // fishing
    if (W.ground[i] === C.G.WATER) { if (S.upgrades.rod) goThen(standFor(tx, ty), () => UI.open('fishing'), tx, ty); else goThen(standFor(tx, ty), () => { }, tx, ty); return; }
    // forage on the ground
    if (W.forage.has(i)) { goThen([tx, ty], () => pickForage(tx, ty), tx, ty); return; }
    // crops
    const crop = W.crops.get(i);
    if (crop && (tool === 'hand' || tool.endsWith('_seed') || tool === 'hoe')) {
      if (W.cropRipe(crop)) { goThen(standFor(tx, ty), () => harvest(tx, ty), tx, ty); return; }
      if (tool === 'water') { /* fallthrough */ } else { goThen(standFor(tx, ty), () => { }, tx, ty); return; }
    }
    if (tool === 'hoe') {
      if (!W.isFarm(tx, ty)) { if (Math.abs(tx - p.tx) + Math.abs(ty - p.ty) < 3) UI.toast(C.t('not_farmland')); goThen(standFor(tx, ty), () => { }, tx, ty); return; }
      if (W.soil[i]) { goThen(standFor(tx, ty), () => { }, tx, ty); return; }
      goThen(standFor(tx, ty), () => { if (W.till(tx, ty)) { C.audio.sfx('hoe'); burst(tx * T + 8, ty * T + 8, '#7a5232', 8); EC.tutorialAdvance('hint_hoe'); } }, tx, ty); return;
    }
    if (tool === 'water') {
      if (!W.soil[i]) { goThen(standFor(tx, ty), () => { }, tx, ty); return; }
      goThen(standFor(tx, ty), () => { if (W.water(tx, ty)) { C.audio.sfx('water'); burst(tx * T + 8, ty * T + 6, '#7ab0e0', 8, true); EC.tutorialAdvance('hint_water'); } }, tx, ty); return;
    }
    if (tool.endsWith('_seed')) {
      if (!W.soil[i] || W.crops.has(i)) { goThen(standFor(tx, ty), () => { }, tx, ty); return; }
      if (!EC.has(tool)) { UI.toast(C.t('no_seeds')); C.audio.sfx('error'); return; }
      goThen(standFor(tx, ty), () => {
        if (!EC.has(tool)) return;
        const type = C.ITEMS[tool].crop;
        if (W.plant(tx, ty, type)) { EC.remove(tool, 1); C.audio.sfx('plant'); burst(tx * T + 8, ty * T + 8, '#5cb84a', 6); EC.tutorialAdvance('hint_seed'); if (!EC.has(tool)) S.tool = 'hand'; }
      }, tx, ty); return;
    }
    // plain walk
    goThen(standFor(tx, ty), () => { }, tx, ty);
  };

  GM.tapCustomer = function (n) {
    const stand = [22, 25], p = E.player;
    if (Math.abs(p.tx - stand[0]) <= 1 && p.ty === stand[1]) { UI.open('order'); return; }
    goThen(stand, () => UI.open('order'), n.tx, n.ty);
  };
  GM.serveCustomer = function (n) {
    const res = EC.serve(n);
    if (!res) { C.audio.sfx('error'); return; }
    C.audio.sfx('pour');
    UI.toast(C.t('served', { coins: res.coins + res.tip }) + (res.tip ? `  (+${res.tip} ${C.t('tip')})` : ''), 'coin');
    steam(21 * T, 26 * T + 4);
    EC.tutorialAdvance('hint_cafe');
    if (!E.waitingCustomers().length) UI.close();
  };

  GM.interact = function (obj) {
    const S = C.state;
    switch (obj.interact) {
      case 'house': UI.open('sleep'); break;
      case 'roaster': if (EC.count('green') <= 0) { UI.toast(C.t('roaster_none'), 'green'); C.audio.sfx('error'); } else { UI.open('roaster'); EC.tutorialAdvance('hint_roaster'); } break;
      case 'pulper': { const n = ST.pulp(); if (n) { C.audio.sfx('crank'); UI.toast(C.t('pulper_done', { n }), 'parchment'); burst(obj.tx * T + 8, obj.ty * T + 4, '#d42a2a', 6); EC.tutorialAdvance('hint_pulper'); } else { UI.toast(C.t('pulper_none'), 'cherry'); C.audio.sfx('error'); } break; }
      case 'patio': {
        const r = ST.patioInteract(), p = S.patio;
        if (r.action === 'collect') { UI.toast(C.t('patio_collect', { n: r.n }), 'green'); C.audio.sfx('harvest'); }
        else if (r.action === 'load') { UI.toast(C.t('patio_loaded', { n: r.n }), 'parchment'); C.audio.sfx('plant'); EC.tutorialAdvance('hint_patio'); }
        else if (r.action === 'full') { UI.toast(C.t('patio_full')); C.audio.sfx('error'); }
        else if (r.action === 'status') { const raining = (S.weather === 'rain' || S.weather === 'snow') && !S.upgrades.roof; UI.toast(raining ? C.t('patio_rain') : C.t('patio_status', { n: p.n, max: ST.patioCap(), days: Math.max(0, ST.DRY_DAYS - p.days) }), 'parchment'); }
        else UI.toast(C.t('patio_empty'));
        break;
      }
      case 'counter': UI.open('order'); break;
      case 'shop': UI.open('shop'); E.say(E.rosa, C.lang === 'es' ? '¡Buenas! ¿Qué se te ofrece?' : 'Hello there! What can I get you?', 3); break;
      case 'mailbox': { const key = EC.readMail(); if (key) { UI.open('letter', { key }); C.audio.sfx('letter'); } else C.audio.sfx('back'); break; }
      case 'coop': C.audio.sfx('cluck'); UI.toast(C.t('coop'), 'hens'); break;
      default: break;
    }
  };

  function harvest(tx, ty) {
    const r = W.harvest(tx, ty); if (!r) return;
    EC.add(r.item, r.n); C.audio.sfx('harvest');
    UI.toast(C.t('harvested', { n: r.n, name: EC.itemName(r.item) }), r.item);
    burst(tx * T + 8, ty * T + 4, r.item === 'cherry' ? '#e04040' : r.item === 'tomato' ? '#e04a30' : r.item === 'corn' ? '#f0d060' : '#f0c020', 10);
    if (r.item === 'cherry') EC.tutorialAdvance('hint_coffee_done');
  }
  function pickForage(tx, ty) {
    const i = W.idx(tx, ty), t = W.forage.get(i); if (!t) return;
    W.forage.delete(i); EC.add(t, 1); C.audio.sfx('harvest');
    UI.toast(t === 'egg' ? C.t('picked_egg') : C.t('foraged', { name: EC.itemName(t) }), t);
    burst(tx * T + 8, ty * T + 8, t === 'mint' ? '#6ad06a' : t === 'egg' ? '#f8f0e0' : '#f06a8a', 6);
  }

  // ---- particles --------------------------------------------------------------------------------
  function burst(x, y, color, n, drip) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 12 + Math.random() * 30; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (drip ? 0 : 20), life: 0.5 + Math.random() * 0.4, t: 0, color, size: 1 + (Math.random() < 0.4 ? 1 : 0), grav: drip ? 90 : 60 }); }
  }
  function steam(x, y) { for (let i = 0; i < 10; i++) particles.push({ x: x + Math.random() * 12, y: y, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 10, life: 1.2 + Math.random(), t: -i * 0.08, color: 'rgba(255,255,255,0.7)', size: 2, grav: -6, steam: true }); }
  GM.burst = burst;
  function initAmbientParticles() {
    fireflies = []; leaves = []; drops = [];
    const r = C.rng(C.state.time.day * 31);
    for (let i = 0; i < 34; i++) fireflies.push({ x: r.range(3, MW - 3) * T, y: r.range(3, MH - 3) * T, ph: r() * 6.28, sp: 0.6 + r() * 0.8, r: 6 + r() * 12 });
    for (let i = 0; i < 90; i++) drops.push({ x: r() * 400, y: r() * 300, s: 130 + r() * 90 });
    for (let i = 0; i < 16; i++) leaves.push({ x: r() * 400, y: r() * 300, vx: 6 + r() * 10, ph: r() * 6.28, c: r.pick(['#d08a3a', '#c86a3a', '#e0a840']) });
  }
  function updateParticles(dt) {
    for (const p of particles) { p.t += dt; if (p.t < 0) continue; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    particles = particles.filter((p) => p.t < p.life);
    const wv = worldCv.width, wh = worldCv.height;
    if (C.state.weather === 'rain') for (const d of drops) { d.y += d.s * dt; d.x -= d.s * 0.25 * dt; if (d.y > wh + 4) { d.y = -6; d.x = Math.random() * (wv + 40); } if (d.x < -4) d.x += wv + 40; }
    if (C.state.weather === 'snow') for (const d of drops) { d.y += d.s * 0.18 * dt; d.x += Math.sin(GM.time * 1.5 + d.s) * 8 * dt; if (d.y > wh + 4) { d.y = -6; d.x = Math.random() * (wv + 40); } }
    if (W.season() === 'autumn') for (const l of leaves) { l.x += l.vx * dt; l.y += (12 + Math.sin(GM.time * 2 + l.ph) * 6) * dt; if (l.y > wh + 4) { l.y = -6; l.x = Math.random() * wv; } if (l.x > wv + 4) l.x = -4; }
  }

  // ---- render -------------------------------------------------------------------------------------
  function render(dt) {
    const S = C.state; if (!S) return;
    const ox = Math.round(GM.cam.x), oy = Math.round(GM.cam.y);
    const wv = worldCv.width, wh = worldCv.height;
    const season = W.season(), tiles = SP.tiles(season);
    const wg = worldG;
    wg.globalCompositeOperation = 'source-over';
    wg.fillStyle = '#2a3a22'; wg.fillRect(0, 0, wv, wh);
    // ground
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T));
    const x1 = Math.min(MW - 1, Math.ceil((ox + wv) / T)), y1 = Math.min(MH - 1, Math.ceil((oy + wh) / T));
    const wf = Math.floor(GM.time * 3) % 4, raining = S.weather === 'rain';
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = W.idx(tx, ty), gnd = W.ground[i], px = tx * T - ox, py = ty * T - oy;
      let img;
      switch (gnd) {
        case C.G.GRASS: img = tiles.grass[W.gvar[i]]; break;
        case C.G.DIRT: img = tiles.dirt[W.gvar[i] % 3]; break;
        case C.G.WATER: img = tiles.water[(wf + ((tx + ty) & 1) * 2) % 4]; break;
        case C.G.SAND: img = tiles.sand; break;
        case C.G.WOOD: img = tiles.wood; break;
        case C.G.STONE: img = tiles.stone; break;
        case C.G.CONCRETE: img = tiles.concrete; break;
        case C.G.PORCH: img = tiles.porch; break;
        default: img = tiles.grass[0];
      }
      wg.drawImage(img, px, py);
      if (W.soil[i]) wg.drawImage(W.soil[i] === 2 ? tiles.soilWet : tiles.soil, px, py);
      if (raining && (gnd === C.G.GRASS || gnd === C.G.DIRT) && !W.soil[i] && C.hash2(tx, ty, 77) < 0.1) wg.drawImage(tiles.puddle, px, py);
      const f = W.forage.get(i);
      if (f === 'mint') wg.drawImage(SP.mint(), px, py); else if (f === 'flower') wg.drawImage(SP.flower(i), px, py); else if (f === 'egg') wg.drawImage(SP.icon('egg'), px + 4, py + 5, 8, 8);
    }
    // farm zone hint when using hoe
    if (S.tool === 'hoe') { const fz = W.farmZone; wg.strokeStyle = 'rgba(255,240,180,0.35)'; wg.lineWidth = 1; wg.strokeRect(fz.x0 * T - ox + 0.5, fz.y0 * T - oy + 0.5, (fz.x1 - fz.x0 + 1) * T - 1, (fz.y1 - fz.y0 + 1) * T - 1); }
    // drawables
    const list = [];
    const night = 1 - W.daylight();
    for (const o of W.objects) {
      const px = o.px - ox, py = o.py - oy;
      if (px > wv + 8 || py > wh + 8 || px + o.w * T + 16 < -8 || py + o.h * T + 32 < -8) continue;
      list.push({ baseY: o.baseY, draw: () => drawObject(wg, o, px, py, season, night) });
    }
    for (const [i, c] of W.crops) {
      const tx = i % MW, ty = Math.floor(i / MW);
      if (tx < x0 - 1 || tx > x1 + 1 || ty < y0 - 1 || ty > y1 + 1) continue;
      const st = W.cropStage(c);
      list.push({ baseY: (ty + 1) * T, draw: () => wg.drawImage(SP.crop(c.type, st), tx * T - ox, ty * T - oy - 8) });
    }
    for (const d of E.drawables()) list.push({ baseY: d.baseY, draw: () => d.draw(wg, ox, oy) });
    list.sort((a, b) => a.baseY - b.baseY);
    for (const d of list) d.draw();
    // particles
    for (const p of particles) { if (p.t < 0) continue; const a = 1 - p.t / p.life; wg.globalAlpha = p.steam ? a * 0.7 : a; wg.fillStyle = p.color; wg.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.size, p.size); }
    wg.globalAlpha = 1;
    // seasonal ambience
    if (season === 'autumn' && !raining) for (const l of leaves) { wg.fillStyle = l.c; wg.fillRect(Math.round(l.x), Math.round(l.y), 2, 1); }
    if (season === 'summer' && night > 0.5) { wg.globalCompositeOperation = 'lighter'; for (const f of fireflies) { const b = 0.5 + 0.5 * Math.sin(GM.time * f.sp * 3 + f.ph); if (b < 0.3) continue; const fx = f.x + Math.sin(GM.time * f.sp + f.ph) * f.r - ox, fy = f.y + Math.cos(GM.time * f.sp * 0.7 + f.ph) * f.r * 0.5 - oy; if (fx < 0 || fy < 0 || fx > wv || fy > wh) continue; wg.fillStyle = `rgba(200,255,120,${b * 0.9})`; wg.fillRect(Math.round(fx), Math.round(fy), 1, 1); wg.fillStyle = `rgba(200,255,120,${b * 0.25})`; wg.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3); } wg.globalCompositeOperation = 'source-over'; }
    // weather
    if (raining) { wg.strokeStyle = 'rgba(200,225,255,0.55)'; wg.lineWidth = 1; wg.beginPath(); for (const d of drops) { wg.moveTo(d.x, d.y); wg.lineTo(d.x - 1, d.y + 4); } wg.stroke(); }
    if (S.weather === 'snow') { wg.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of drops) wg.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    // lighting
    drawLighting(wg, ox, oy, night);
    // blit world -> screen
    const dpr = GM.dpr, sc = GM.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a2418'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(worldCv, 0, 0, wv, wh, 0, 0, Math.round(wv * sc * dpr), Math.round(wh * sc * dpr));
    // UI layer in CSS px
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (tapMark) { const a = 1 - tapMark.t / 0.5; g.strokeStyle = `rgba(255,240,200,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(tapMark.x, tapMark.y, 8 + tapMark.t * 40, 0, 7); g.stroke(); }
    UI.draw(g, dt);
    if (fade > 0) { g.fillStyle = `rgba(4,6,10,${fade})`; g.fillRect(0, 0, GM.cssW, GM.cssH); if (UI.modal && UI.modal.type === 'summary') UI.draw(g, 0); }
  }

  function drawObject(wg, o, px, py, season, night) {
    const S = C.state;
    switch (o.kind) {
      case 'tree': wg.drawImage(SP.tree(o.seed, season, o.tkind), px, py); break;
      case 'house': wg.drawImage(SP.house(), px, py); break;
      case 'shed': wg.drawImage(SP.shed(), px, py); if (ST.roast && ST.roast.holding) { wg.fillStyle = `rgba(255,${120 + Math.random() * 80 | 0},40,0.5)`; wg.fillRect(px + 34, py + 56, 12, 8); } break;
      case 'pulper': wg.drawImage(SP.pulper(), px, py); break;
      case 'patio': wg.drawImage(SP.patio(o.w, o.h, S.upgrades.roof), px, py); if (S.patio.n > 0) wg.drawImage(SP.parchmentDots(Math.min(S.patio.n, 40), o.w, o.h, S.patio.dry), px, py + 16); break;
      case 'counter': wg.drawImage(SP.counter(), px, py); wg.drawImage(SP.awning(S.upgrades.lights), px, py - 14); break;
      case 'cart': wg.drawImage(SP.cart(), px, py); break;
      case 'mailbox': wg.drawImage(SP.mailbox(S.mail.length > 0), px, py); break;
      case 'well': wg.drawImage(SP.well(), px, py); break;
      case 'sign': wg.drawImage(SP.sign(), px, py); break;
      case 'lantern': wg.drawImage(SP.lantern(night > 0.3), px, py); break;
      case 'pot': wg.drawImage(SP.pot(o.seed), px, py); break;
      case 'fence': wg.drawImage(SP.fence(o.fk), px, py); break;
      case 'bush': wg.drawImage(SP.bush(o.seed, season), px, py); break;
      case 'rock': wg.drawImage(SP.rock(o.seed), px, py); break;
      case 'stump': wg.drawImage(SP.stump(), px, py); break;
      case 'dflower': if (season !== 'winter') wg.drawImage(SP.flower(o.seed), px, py); break;
      case 'reeds': wg.drawImage(SP.reeds(), px, py); break;
      case 'lily': wg.drawImage(SP.lily(), px, py + Math.round(Math.sin(GM.time * 1.5 + o.tx) * 1)); break;
      case 'coop': wg.drawImage(SP.coop(), px, py); break;
      case 'bench': wg.drawImage(SP.bench(), px, py); break;
      default: break;
    }
  }

  function drawLighting(wg, ox, oy, night) {
    const S = C.state, wv = worldCv.width, wh = worldCv.height;
    const d = W.daylight(), dusk = 4 * d * (1 - d);
    const gloomy = S.weather === 'rain' ? 0.16 : S.weather === 'snow' ? 0.08 : S.weather === 'cloudy' ? 0.06 : 0;
    if (dusk > 0.01) { wg.fillStyle = `rgba(255,140,60,${0.16 * dusk})`; wg.fillRect(0, 0, wv, wh); }
    if (night < 0.02 && !gloomy) return;
    const lg = lightG;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, wv, wh);
    lg.fillStyle = `rgba(14,18,50,${0.68 * night + gloomy})`; lg.fillRect(0, 0, wv, wh);
    if (night > 0.05) {
      lg.globalCompositeOperation = 'destination-out';
      for (const L of W.lights) {
        const lx = L.x - ox, ly = L.y - oy; if (lx < -60 || ly < -60 || lx > wv + 60 || ly > wh + 60) continue;
        if (L.kind === 'roaster' && !(ST.roast && ST.roast.holding)) { if (night < 0.5) continue; }
        const r = L.r * (1 + 0.04 * Math.sin(GM.time * 6 + lx));
        const gr = lg.createRadialGradient(lx, ly, 0, lx, ly, r);
        gr.addColorStop(0, `rgba(0,0,0,${0.95 * night})`); gr.addColorStop(0.5, `rgba(0,0,0,${0.6 * night})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = gr; lg.fillRect(lx - r, ly - r, r * 2, r * 2);
      }
      // player carries a little glow at night
      const p = E.player, plx = p.x - ox, ply = p.y - 8 - oy, pr = 22;
      const pg = lg.createRadialGradient(plx, ply, 0, plx, ply, pr); pg.addColorStop(0, `rgba(0,0,0,${0.5 * night})`); pg.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = pg; lg.fillRect(plx - pr, ply - pr, pr * 2, pr * 2);
    }
    wg.drawImage(lightCv, 0, 0);
    if (night > 0.05) {
      wg.globalCompositeOperation = 'lighter';
      for (const L of W.lights) {
        const lx = L.x - ox, ly = L.y - oy; if (lx < -60 || ly < -60 || lx > wv + 60 || ly > wh + 60) continue;
        if (L.kind === 'roaster' && !(ST.roast && ST.roast.holding) && night < 0.5) continue;
        const r = L.r * 0.8, gr = wg.createRadialGradient(lx, ly, 0, lx, ly, r);
        gr.addColorStop(0, C.color.rgba(L.color, 0.28 * night)); gr.addColorStop(1, C.color.rgba(L.color, 0));
        wg.fillStyle = gr; wg.fillRect(lx - r, ly - r, r * 2, r * 2);
      }
      wg.globalCompositeOperation = 'source-over';
    }
  }

  // ---- boot -----------------------------------------------------------------------------------
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', GM.init); else GM.init();
})();
