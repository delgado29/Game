/* Hojarasca — 70_main.js  Loop, player movement, tools, interactions, camera, rendering, lighting. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const { clamp, lerp } = H.math;
  const T = H.TILE, MW = H.MAP_W, MH = H.MAP_H, A = H.art, W = H.world, LV = H.leaves, G = H.game, UI = H.ui;
  const MN = (H.main = { mode: 'title', scale: 3, dpr: 1, cssW: 0, cssH: 0, cam: { x: 0, y: 0 }, player: null });
  let canvas, g, worldCv, worldG, lightCv, lightG, lastNow = 0, autosaveT = 0, particles = [], gustT = 45, gust = { x: 0, y: 0, t: 0 }, gatePromptT = 0, pickT = 0;
  H.time = 0;

  MN.init = function () {
    canvas = document.getElementById('game'); g = canvas.getContext('2d');
    G.loadSettings(); H.audio.setMusic(G.settings.music); H.audio.setSound(G.settings.sound);
    worldCv = H.canvas(320, 240); worldG = H.ctx2d(worldCv); lightCv = H.canvas(320, 240); lightG = H.ctx2d(lightCv);
    W.build();
    G.start(G.load());
    MN.player = { x: H.state.player.x, y: H.state.player.y, dir: 0, frame: 0, animT: 0, vx: 0, vy: 0, aim: Math.PI / 2, cellar: !!H.state.inCellar, active: false };
    MN.resize();
    window.addEventListener('resize', MN.resize); window.addEventListener('orientationchange', () => setTimeout(MN.resize, 120)); if (window.visualViewport) window.visualViewport.addEventListener('resize', MN.resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (MN.mode === 'play') G.save(); H.audio.suspend(); } else H.audio.resume(); });
    window.addEventListener('pagehide', () => { if (MN.mode === 'play') G.save(); });
    UI.bindInput(canvas); bindEvents();
    UI.open('title');
    requestAnimationFrame(loop);
  };
  MN.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), cw = window.innerWidth, ch = window.innerHeight;
    MN.dpr = dpr; MN.cssW = cw; MN.cssH = ch; canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    MN.scale = clamp(Math.round(Math.min(cw, ch) / (T * 15)), 2, 6);
    worldCv.width = Math.min(Math.ceil(cw / MN.scale) + 1, MW * T); worldCv.height = Math.min(Math.ceil(ch / MN.scale) + 1, MH * T); lightCv.width = worldCv.width; lightCv.height = worldCv.height; worldG.imageSmoothingEnabled = false;
    try { let probe = document.getElementById('safeprobe'); if (!probe) { probe = document.createElement('div'); probe.id = 'safeprobe'; probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)'; document.body.appendChild(probe); } const cs = getComputedStyle(probe); UI.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; } catch (e) { /* ignore */ }
    UI.resize(cw, ch);
  };
  MN.newGame = function () { G.clear(); G.start(null); const p = MN.player; p.x = H.state.player.x; p.y = H.state.player.y; p.cellar = false; UI.modal = null; MN.mode = 'play'; particles = []; G.save(); setTimeout(() => UI.hint(H.t('hint_move')), 800); };
  MN.continueGame = function () { UI.modal = null; MN.mode = 'play'; };
  MN.toggleLang = function () { const s = G.settings; s.lang = H.lang === 'es' ? 'en' : 'es'; H.setLang(s.lang); G.saveSettings(); H.audio.sfx('tap'); };
  MN.worldToScreen = (wx, wy) => [(wx - MN.cam.x) * MN.scale, (wy - MN.cam.y) * MN.scale];

  function bindEvents() {
    H.on('dump', (v) => { UI.toast(H.t('dumped', { n: v }), 'coin'); H.audio.sfx('dump'); const p = MN.player; for (let i = 0; i < 8; i++) burst(p.x, p.y - 8, '#ffd860', 1); if (!H.state.flags.hintShop) { H.state.flags.hintShop = 1; setTimeout(() => UI.hint(H.t('hint_shop')), 600); } });
    H.on('sold', (d) => { if (Math.random() < 0.15) H.audio.sfx('coin'); const i = d.i; burst(LV.X[i], LV.Y[i], '#ffd860', 1); });
    H.on('buy', () => G.save());
    H.on('gate', (id) => { H.audio.sfx(id === 'cellar' ? 'hatch' : 'gate'); G.save(); if (!H.state.flags.hintGate) H.state.flags.hintGate = 1; });
    H.on('zoneDone', (id) => { if (id !== 'cellar') { UI.open('zone', { id }); H.audio.sfx('zone'); } G.save(); });
    H.on('ending', () => { setTimeout(() => { UI.open('ending'); H.audio.sfx('ending'); }, 800); });
  }

  // ---- interactions ----------------------------------------------------------------------------------
  MN.interact = function (side) {
    if (MN.mode !== 'play' || UI.modal) return; const p = MN.player, S = H.state, tx = (p.x / T) | 0, ty = (p.y / T) | 0;
    const near = (ox, oy, r) => Math.hypot(ox * T + 8 - p.x, oy * T + 8 - p.y) < r;
    for (const b of W.BINS) if (S.bins[b.id] && near(b.tx, b.ty, 30)) { if (S.bag > 0) G.dump(); UI.open('shop'); H.audio.sfx('tap'); return; }
    for (const gt of W.GATES) if (gt.orient !== 'hatch' && near(gt.tx, gt.ty, 30) && !S.gates[gt.id]) { UI.open('gate', { id: gt.id }); return; }
    if (!p.cellar && near(W.HATCH.tx, W.HATCH.ty, 26)) { if (S.gates.cellar) { MN.teleport(W.CELLAR_IN.tx, W.CELLAR_IN.ty, true); H.audio.sfx('hatch'); } else UI.open('gate', { id: 'cellar' }); return; }
    if (p.cellar && near(W.LADDER.tx, W.LADDER.ty, 26)) { MN.teleport(W.HATCH_OUT.tx, W.HATCH_OUT.ty, false); H.audio.sfx('hatch'); return; }
    for (const v of W.VENTS) if (!S.vents[v.id] && near(v.tx, v.ty, 24) && G.zoneUnlocked(v.zone)) { UI.open('shop', { tab: 'yard' }); return; }
    // otherwise: a quick hand grab burst
    if (S.tool === 'hand') { const ids = LV.near(p.x, p.y, G.d.handR * 1.6, 6); for (const i of ids) if (G.pickup(i)) burst(LV.X[i], LV.Y[i], '#e08a30', 1); if (ids.length) H.audio.sfx('rustle'); }
  };
  MN.teleport = function (tx, ty, cellar) { const p = MN.player; p.x = tx * T + 8; p.y = ty * T + 12; p.cellar = cellar; MN.cam.x = clamp(p.x - worldCv.width / 2, 0, MW * T - worldCv.width); MN.cam.y = clamp(p.y - worldCv.height / 2, 0, MH * T - worldCv.height); G.save(); };

  // ---- update ------------------------------------------------------------------------------------------
  function loop(now) { const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now; H.time += dt; update(dt); render(dt); requestAnimationFrame(loop); }
  function update(dt) {
    UI.update(dt); const S = H.state, p = MN.player, d = G.d;
    const playing = MN.mode === 'play' && !UI.modal;
    if (playing) {
      S.stats.time += dt;
      // movement
      const L = UI.left; let mx = 0, my = 0;
      if (L && L.mag > 0.08) { mx = L.dx * d.speed; my = L.dy * d.speed; }
      p.vx = mx; p.vy = my;
      if (mx || my) { moveWithCollision(p, mx * dt, my * dt); p.animT += dt; p.frame = 1 + (Math.floor(p.animT * 7) % 2); }
      else { p.frame = 0; p.animT = 0; }
      // aim & tool
      const R = UI.right; p.active = !!R && (R.mag > 0.15 || R.kb);
      if (R && R.mag > 0.15) p.aim = Math.atan2(R.dy, R.dx); else if (mx || my) p.aim = Math.atan2(my, mx);
      const a = p.aim; p.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : (Math.sin(a) > 0 ? 0 : 3);
      // gusts
      gustT -= dt; if (gustT <= 0) { gustT = 40 + Math.random() * 50; gust = { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 30, t: 3 }; UI.toast(H.t('wind'), 'wind'); H.audio.sfx('gust'); }
      if (gust.t > 0) gust.t -= dt;
      const wind = gust.t > 0 ? { x: gust.x * Math.min(1, gust.t), y: gust.y * Math.min(1, gust.t) } : { x: 0, y: 0 };
      // leaves
      const tool = S.tool === 'rake' && !S.up.rake ? 'hand' : S.tool === 'blower' && !S.up.blower ? 'hand' : S.tool;
      LV.update(dt, { px: p.x, py: p.y - 4, tool, aim: p.aim, active: p.active, mvx: p.vx, mvy: p.vy, blower: d.blower, rake: { w: d.rakeW }, vents: G.activeVents(), bins: G.activeBins(), wind });
      // hand pickup while walking / holding
      if (tool === 'hand') { pickT += dt * d.handRate; if (pickT >= 1) { const n = Math.floor(pickT); pickT -= n; const ids = LV.near(p.x, p.y - 2, d.handR, n); let got = 0; for (const i of ids) if (G.pickup(i)) { got++; burst(LV.X[i], LV.Y[i], '#e08a30', 1); } if (got) H.audio.sfx('rustle'); else if (ids.length && S.bag >= d.bagCap) { if (!S.flags.fullWarned || H.time - S.flags.fullWarned > 6) { S.flags.fullWarned = H.time; UI.toast(H.t('bag_full'), 'bag'); H.audio.sfx('full'); if (!S.flags.hintDump) { S.flags.hintDump = 1; UI.hint(H.t('hint_dump')); } } } } }
      // auto-dump when brushing a bin
      for (const b of W.BINS) if (S.bins[b.id] && S.bag > 0 && Math.hypot(b.tx * T + 8 - p.x, b.ty * T + 8 - p.y) < 18) G.dump();
      // gate prompt when walking into a locked gate
      gatePromptT -= dt; if (gatePromptT <= 0) for (const gt of W.GATES) { if (S.gates[gt.id] || gt.orient === 'hatch') continue; if (Math.hypot(gt.tx * T + 8 - p.x, gt.ty * T + 8 - p.y) < 20 && (mx || my)) { gatePromptT = 4; UI.open('gate', { id: gt.id }); if (!S.flags.hintGate) { S.flags.hintGate = 1; } break; } }
      // blower particles & vent sparkle
      if (tool === 'blower' && p.active && d.blower.power > 0 && Math.random() < 0.8) { for (let i = 0; i < 2; i++) { const ang = p.aim + (Math.random() - 0.5) * d.blower.cone * 0.8, sp = 60 + Math.random() * 80 * d.blower.power; particles.push({ x: p.x + Math.cos(p.aim) * 10, y: p.y - 6 + Math.sin(p.aim) * 10, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.35 + Math.random() * 0.3, t: 0, c: 'rgba(255,240,210,0.35)', s: 2 }); } }
      for (const v of G.activeVents()) if (Math.random() < 0.25 && Math.abs(v.x - p.x) < 200 && Math.abs(v.y - p.y) < 160) { const ang = Math.random() * 6.28, r = v.r * 0.9; particles.push({ x: v.x + Math.cos(ang) * r, y: v.y + Math.sin(ang) * r, vx: -Math.cos(ang) * 40, vy: -Math.sin(ang) * 40, life: 0.6, t: 0, c: 'rgba(200,220,255,0.35)', s: 1 }); }
      // audio env
      H.audio.env.blower = tool === 'blower' && p.active && d.blower.power > 0 ? 1 : 0; H.audio.env.blowerPower = S.up.blower; H.audio.env.rake = tool === 'rake' && p.active && (mx || my) ? 1 : 0;
      let vn = 0; for (const v of G.activeVents()) if (Math.hypot(v.x - p.x, v.y - p.y) < 120) vn = 1; H.audio.env.vent = vn;
      autosaveT += dt; if (autosaveT > 15) { autosaveT = 0; G.save(); }
    }
    H.audio.env.night = nightAmount(); H.audio.update(dt);
    // camera
    const tx = clamp(p.x - worldCv.width / 2, 0, MW * T - worldCv.width), ty = clamp(p.y - 8 - worldCv.height / 2, p.cellar ? 49 * T : 0, MH * T - worldCv.height);
    const k = 1 - Math.exp(-dt * 6); MN.cam.x = lerp(MN.cam.x, tx, k); MN.cam.y = lerp(MN.cam.y, ty, k);
    for (const pt of particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; } particles = particles.filter((pt) => pt.t < pt.life);
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }
  function moveWithCollision(p, dx, dy) {
    const free = (x, y) => { const x0 = ((x - 4) / T) | 0, x1 = ((x + 4) / T) | 0, y0 = ((y - 2) / T) | 0, y1 = ((y + 1) / T) | 0; return !W.blocked(x0, y0) && !W.blocked(x1, y0) && !W.blocked(x0, y1) && !W.blocked(x1, y1); };
    if (free(p.x + dx, p.y)) p.x += dx; if (free(p.x, p.y + dy)) p.y += dy;
  }
  function burst(x, y, c, n) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.4, t: 0, c, s: 1 }); }
  function nightAmount() { if (MN.player && MN.player.cellar) return 1; const c = (H.state ? H.state.stats.time : 0) % 1200 / 1200; if (c < 0.55) return 0; if (c < 0.68) return (c - 0.55) / 0.13; if (c < 0.9) return 1; return 1 - (c - 0.9) / 0.1; }

  // ---- render ---------------------------------------------------------------------------------------------
  function render(dt) {
    const S = H.state, p = MN.player, wg = worldG, wv = worldCv.width, wh = worldCv.height, ox = Math.round(MN.cam.x), oy = Math.round(MN.cam.y), tiles = A.tiles();
    wg.globalCompositeOperation = 'source-over'; wg.fillStyle = '#1a1410'; wg.fillRect(0, 0, wv, wh);
    const x0 = Math.max(0, (ox / T) | 0), y0 = Math.max(0, (oy / T) | 0), x1 = Math.min(MW - 1, Math.ceil((ox + wv) / T)), y1 = Math.min(MH - 1, Math.ceil((oy + wh) / T)), wf = (H.time * 3 | 0) % 4;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = W.idx(tx, ty), gnd = W.ground[i], px = tx * T - ox, py = ty * T - oy; let img;
      switch (gnd) { case H.G.GRASS: img = tiles.grass[W.gvar[i]]; break; case H.G.PATH: img = tiles.path; break; case H.G.CONCRETE: img = tiles.concrete; break; case H.G.WATER: img = tiles.water[(wf + ((tx + ty) & 1) * 2) % 4]; break; case H.G.DECK: img = tiles.deck; break; case H.G.GLASS: img = tiles.glass; break; case H.G.STONE: img = tiles.stone; break; case H.G.SOIL: img = tiles.soil; break; case H.G.SAND: img = tiles.sand; break; case H.G.ROAD: img = tiles.road; break; case H.G.PORCH: img = tiles.porch; break; case H.G.SIDEWALK: img = tiles.sidewalk; break; case H.G.RUG: img = tiles.rug; break; default: img = tiles.void; }
      wg.drawImage(img, px, py);
      if (gnd === H.G.ROAD && ty === 46 && tx % 4 < 2) { wg.fillStyle = '#d8d0a0'; wg.fillRect(px, py + 7, T, 2); }
    }
    // tree shadows (low sun from the west)
    wg.fillStyle = 'rgba(20,10,0,0.18)';
    for (const t of W.trees) { const sx = t.tx * T + 8 - ox, sy = t.ty * T + 14 - oy; if (sx < -40 || sy < -20 || sx > wv + 40 || sy > wh + 20) continue; wg.beginPath(); wg.ellipse(sx + 10, sy, 18, 6, 0, 0, 7); wg.fill(); }
    // vent suction rings
    for (const v of G.activeVents()) { const vx = v.x - ox, vy = v.y - oy; if (vx < -40 || vy < -40 || vx > wv + 40 || vy > wh + 40) continue; wg.strokeStyle = 'rgba(200,220,255,0.18)'; wg.lineWidth = 1; wg.beginPath(); wg.arc(vx, vy, v.r * (0.6 + 0.4 * ((H.time * 0.7) % 1)), 0, 7); wg.stroke(); }
    // leaves
    LV.draw(wg, ox, oy, wv, wh);
    // objects + player, painter sorted
    const list = [];
    for (const o of W.objects) { const px = o.px - ox, py = o.py - oy; if (px > wv + 8 || py > wh + 8 || px + o.w * T + 40 < -8 || py + o.h * T + 48 < -8) continue; list.push({ baseY: o.baseY, draw: () => drawObject(wg, o, px, py) }); }
    list.push({ baseY: p.y, draw: () => drawPlayer(wg, p, ox, oy) });
    list.sort((a, b) => a.baseY - b.baseY); for (const it of list) it.draw();
    // particles & blower cone
    for (const pt of particles) { wg.globalAlpha = Math.max(0, 1 - pt.t / pt.life); wg.fillStyle = pt.c; wg.fillRect(Math.round(pt.x - ox), Math.round(pt.y - oy), pt.s, pt.s); } wg.globalAlpha = 1;
    // lighting
    drawLighting(wg, ox, oy);
    // blit + UI
    const dpr = MN.dpr, sc = MN.scale; g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = '#1a1410'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(worldCv, 0, 0, wv, wh, 0, 0, Math.round(wv * sc * dpr), Math.round(wh * sc * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0); UI.draw(g, dt);
  }
  function drawObject(wg, o, px, py) {
    const S = H.state;
    switch (o.kind) {
      case 'tree': wg.drawImage(A.tree(o.tkind, o.seed), px, py); break;
      case 'house': wg.drawImage(A.house(), px, py); break;
      case 'greenhouse': wg.drawImage(A.greenhouse(), px, py); break;
      case 'shed': wg.drawImage(A.shed(), px, py); break;
      case 'car': wg.drawImage(A.car(), px, py); break;
      case 'sandbox': wg.drawImage(A.sandbox(), px, py); break;
      case 'poolladder': wg.drawImage(A.poolLadder(), px, py); break;
      case 'deckchair': wg.drawImage(A.deckChair(), px, py); break;
      case 'fence': wg.drawImage(A.fence(o.fk), px, py); break;
      case 'gate': wg.drawImage(A.gate(!!S.gates[o.gate.id]), px, py); break;
      case 'hatch': wg.drawImage(A.hatch(), px, py); break;
      case 'ladder': wg.drawImage(A.ladder(), px, py); break;
      case 'hedge': wg.drawImage(A.hedge(), px, py); break;
      case 'bush': wg.drawImage(A.bush(o.seed), px, py); break;
      case 'mailbox': wg.drawImage(A.mailbox(), px, py); break;
      case 'pot': wg.drawImage(A.pot(o.seed), px, py); break;
      case 'lantern': wg.drawImage(A.lantern(nightAmount() > 0.3), px, py); break;
      case 'bin': if (S.bins[o.bin.id]) wg.drawImage(A.bin(false), px, py); else { wg.globalAlpha = 0.35; wg.drawImage(A.bin(false), px, py); wg.globalAlpha = 1; } break;
      case 'vent': if (S.vents[o.vent.id]) wg.drawImage(A.vent((H.time * 6 | 0) % 2), px, py); else if (G.zoneUnlocked(o.vent.zone)) wg.drawImage(A.ventOff(), px, py); break;
      case 'table': wg.drawImage(A.table(), px, py); break;
      case 'chair': wg.drawImage(A.chair(), px, py); break;
      case 'stove': wg.drawImage(A.stove(), px, py); break;
      default: break;
    }
  }
  function drawPlayer(wg, p, ox, oy) {
    const S = H.state, x = Math.round(p.x - ox), y = Math.round(p.y - oy), tool = S.tool;
    wg.fillStyle = 'rgba(0,0,0,0.2)'; wg.fillRect(x - 5, y - 1, 10, 2);
    const toolImg = tool === 'rake' && S.up.rake ? A.rakeTool(p.dir) : tool === 'blower' && S.up.blower ? A.blowerTool(p.dir) : null;
    const tp = p.dir === 0 ? [x - 12, y - 10] : p.dir === 3 ? [x - 12, y - 30] : p.dir === 2 ? [x - 2, y - 22] : [x - 22, y - 22];
    if (toolImg && p.dir === 3) wg.drawImage(toolImg, tp[0], tp[1]);
    wg.drawImage(A.human(A.PLAYER, p.dir, p.frame), x - 8, y - 20);
    if (toolImg && p.dir !== 3) wg.drawImage(toolImg, tp[0], tp[1]);
    if (tool === 'blower' && p.active && G.d.blower.power > 0) { const a = p.aim, r = G.d.blower.range, c = G.d.blower.cone / 2; wg.fillStyle = 'rgba(255,255,255,0.08)'; wg.beginPath(); wg.moveTo(x + Math.cos(a) * 8, y - 4 + Math.sin(a) * 8); wg.arc(x, y - 4, r, a - c, a + c); wg.closePath(); wg.fill(); }
    if (tool === 'rake' && p.active && G.d.rakeW > 0) { const a = p.aim, w = G.d.rakeW * T; wg.strokeStyle = 'rgba(255,255,255,0.25)'; wg.lineWidth = 1; wg.beginPath(); wg.moveTo(x + Math.cos(a) * 12 - Math.sin(a) * w / 2, y - 4 + Math.sin(a) * 12 + Math.cos(a) * w / 2); wg.lineTo(x + Math.cos(a) * 12 + Math.sin(a) * w / 2, y - 4 + Math.sin(a) * 12 - Math.cos(a) * w / 2); wg.stroke(); }
  }
  function drawLighting(wg, ox, oy) {
    const night = nightAmount(), wv = worldCv.width, wh = worldCv.height; const dusk = night > 0 && night < 1 ? 4 * night * (1 - night) : 0;
    if (dusk > 0.01) { wg.fillStyle = `rgba(255,140,60,${0.14 * dusk})`; wg.fillRect(0, 0, wv, wh); }
    if (night < 0.02) return;
    const lg = lightG; lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, wv, wh); lg.fillStyle = `rgba(14,18,50,${0.66 * night})`; lg.fillRect(0, 0, wv, wh);
    lg.globalCompositeOperation = 'destination-out';
    const lights = W.lights.concat([{ x: MN.player.x, y: MN.player.y - 8, r: 26, color: '#ffffff' }]);
    for (const L of lights) { const lx = L.x - ox, ly = L.y - oy; if (lx < -80 || ly < -80 || lx > wv + 80 || ly > wh + 80) continue; const r = L.r * (1 + 0.04 * Math.sin(H.time * 6 + lx)); const gr = lg.createRadialGradient(lx, ly, 0, lx, ly, r); gr.addColorStop(0, `rgba(0,0,0,${0.95 * night})`); gr.addColorStop(0.5, `rgba(0,0,0,${0.6 * night})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.fillRect(lx - r, ly - r, r * 2, r * 2); }
    wg.drawImage(lightCv, 0, 0);
    wg.globalCompositeOperation = 'lighter';
    for (const L of W.lights) { const lx = L.x - ox, ly = L.y - oy; if (lx < -80 || ly < -80 || lx > wv + 80 || ly > wh + 80) continue; const r = L.r * 0.8, gr = wg.createRadialGradient(lx, ly, 0, lx, ly, r); gr.addColorStop(0, H.color.rgba(L.color, 0.28 * night)); gr.addColorStop(1, H.color.rgba(L.color, 0)); wg.fillStyle = gr; wg.fillRect(lx - r, ly - r, r * 2, r * 2); }
    wg.globalCompositeOperation = 'source-over';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', MN.init); else MN.init();
})();
