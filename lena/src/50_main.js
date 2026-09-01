/* Leña — 50_main.js
   Scene rendering (sky, parallax, tree, crew, mill, wagon, particles), input,
   game loop, save/offline glue. */
(function () {
  'use strict';
  const L = window.Lena;
  const { clamp, lerp, easeInCubic, easeOutCubic } = L.math;
  const A = L.art, G = L.game, UI = L.ui;
  const MN = (L.main = {});

  let canvas, g, sceneCv, sceneG, scale = 3, dpr = 1, cssW = 0, cssH = 0;
  let backdrop = null; // {hills1, hills2, treeline, w, h}
  let particles = [], flyers = [], stars = [], fireflies = [], clouds = [], birds = [];
  let wobble = 0, shake = 0, playerSwing = 0, fallDir = 1, thudDone = false, wagonAnim = -1, bladeAngle = 0, lastNow = 0, autosaveT = 0, time = 0;
  const crew = []; // visual crew slots

  MN.init = function () {
    canvas = document.getElementById('game'); g = canvas.getContext('2d');
    G.loadSettings(); L.audio.setMusic(G.settings.music); L.audio.setSound(G.settings.sound);
    const offline = G.boot();
    sceneCv = L.canvas(300, 200); sceneG = L.ctx2d(sceneCv);
    MN.resize();
    window.addEventListener('resize', MN.resize);
    window.addEventListener('orientationchange', () => setTimeout(MN.resize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', MN.resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { G.save(); L.audio.suspend(); } else { L.audio.resume(); const away = (Date.now() - L.state.lastSeen) / 1000; if (away > 30) { const o = G.simulateOffline(away); if (o && o.trees > 0) UI.open('offline', o); } L.state.lastSeen = Date.now(); } });
    window.addEventListener('pagehide', () => G.save());
    UI.bindInput(canvas);
    bindEvents();
    if (offline && (offline.trees > 0 || offline.coins > 0)) UI.open('offline', offline);
    if (!L.state.flags.hint) { UI.hintText = L.t('hint_first'); L.state.flags.hint = 1; }
    for (let i = 0; i < 6; i++) crew.push({ phase: Math.random() * 6.28, speed: 0.9 + Math.random() * 0.4, last: 1 });
    requestAnimationFrame(loop);
  };

  MN.resize = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 3); cssW = window.innerWidth; cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    try {
      let probe = document.getElementById('safeprobe');
      if (!probe) { probe = document.createElement('div'); probe.id = 'safeprobe'; probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)'; document.body.appendChild(probe); }
      const cs = getComputedStyle(probe); UI.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    } catch (e) { /* ignore */ }
    UI.resize(cssW, cssH);
    const sc = UI.layout.scene;
    scale = clamp(Math.min(Math.round(sc.h / 200), Math.floor(sc.w / 200)), 2, 5);
    sceneCv.width = Math.ceil(sc.w / scale); sceneCv.height = Math.ceil(sc.h / scale); sceneG.imageSmoothingEnabled = false;
    const w = sceneCv.width, h = sceneCv.height, gy = h - 26;
    backdrop = { w, h, gy, hills1: A.hills(w, h, 11, '#3b5d6b', gy - Math.round(h * 0.32), Math.round(h * 0.06)), hills2: A.hills(w, h, 23, '#2f4d52', gy - Math.round(h * 0.2), Math.round(h * 0.045)), treeline: A.treeline(w, h, 37, '#1e3a34', gy - 10), treeline2: A.treeline(w, h, 53, '#263f36', gy - 2) };
    const r = L.rng(99); stars = []; for (let i = 0; i < 60; i++) stars.push([r() * w, r() * (gy - 60), r()]);
    clouds = []; for (let i = 0; i < 4; i++) clouds.push({ x: r() * w, y: 10 + r() * Math.max(10, gy - 120), s: 0.7 + r() * 0.8, v: 2 + r() * 3 });
    birds = []; for (let i = 0; i < 3; i++) birds.push({ x: r() * w, y: 20 + r() * Math.max(10, gy * 0.4), v: 8 + r() * 8, ph: r() * 6.28 });
    fireflies = []; for (let i = 0; i < 14; i++) fireflies.push({ x: r() * w, y: gy - 10 - r() * 40, ph: r() * 6.28, sp: 0.5 + r() });
  };

  // ---- events ---------------------------------------------------------------------------------
  function bindEvents() {
    L.on('fell', (d) => { L.audio.sfx('crack'); fallDir = d.n % 2 ? -1 : 1; thudDone = false; leavesBurst(); });
    L.on('treeUp', (T) => { const sp = G.speciesFor(T.n); if (L.state.flags.lastSpecies !== sp.id) { if (L.state.flags.lastSpecies) { UI.toast(L.t('new_species', { name: L.t('sp_' + sp.id) }), 'tree'); L.audio.sfx('newtree'); } L.state.flags.lastSpecies = sp.id; } else L.audio.sfx('grow'); });
    L.on('sell', (d) => { if (d.auto) { wagonAnim = 0; L.audio.sfx('wagon'); } L.audio.sfx('sell'); const sc = UI.layout.scene; coinFlyers(d.auto ? sc.x + sc.w / 2 : MN.lastSell[0], d.auto ? sc.y + sc.h - 60 : MN.lastSell[1], Math.min(14, 4 + Math.log10(d.coins + 1) * 2)); });
    L.on('ach', (id) => { UI.toast(L.t('ach_unlocked', { name: L.t('a_' + id) }), 'trophy'); L.audio.sfx('ach'); });
    L.on('prestige', (d) => { UI.toast(`+${d.gain} ${L.t('acorns')}`, 'acorn'); L.audio.sfx('prestige'); particles = []; for (let i = 0; i < 40; i++) leavesBurst(); UI.tab = 'chop'; UI.scroll = {}; });
    L.on('buy', () => { G.save(); });
  }
  MN.lastSell = [0, 0];
  MN.sellTap = function (x, y) { MN.lastSell = [x, y]; const v = G.sell(false); if (v > 0) UI.float(x, y - 30, '+' + L.fmt(v), UI.PAL.coin, 20); };
  MN.chopAt = function (x, y) {
    const res = G.chop();
    const sc = UI.layout.scene, T = L.state.tree;
    if (!res) { if (T.state === 'grow') UI.float(x, y - 20, '…', UI.PAL.soft, 14); return; }
    playerSwing = 0.14; wobble = 1; shake = res.crit ? 3 : 1.2;
    L.audio.sfx(res.crit ? 'crit' : 'chop');
    chips(res.crit ? 12 : 6);
    const tx = sc.x + sc.w / 2 + (Math.random() - 0.5) * 40, ty = sc.y + sc.h - 26 * scale - 60 - Math.random() * 40;
    UI.float(tx, ty, (res.crit ? L.t('crit') + ' ' : '') + L.fmt(res.dmg), res.crit ? '#ffb040' : '#fff', res.crit ? 20 : 15);
    UI.hintText = UI.hintText && L.state.taps > 12 ? null : UI.hintText;
  };
  MN.resetAll = function () { G.clear(); L.state = G.newState(); G.derive(); G.spawnTree('up'); UI.modal = null; UI.tab = 'chop'; UI.scroll = {}; G.save(); };

  // ---- particles ------------------------------------------------------------------------------------
  function chips(n) { const b = backdrop, T = L.state.tree, cv = A.tree(T.species, T.seed); const x = b.w / 2, y = b.gy - 6 - Math.random() * Math.min(20, cv.height * 0.3); for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, g: 160, life: 0.5 + Math.random() * 0.4, t: 0, c: Math.random() < 0.5 ? '#e0b878' : '#a8784a', s: 1 + (Math.random() < 0.3 ? 1 : 0) }); }
  function leavesBurst() { const b = backdrop, T = L.state.tree, k = A.SPECIES_LOOK[T.species], cv = A.tree(T.species, T.seed); for (let i = 0; i < 14; i++) particles.push({ x: b.w / 2 + (Math.random() - 0.5) * cv.width * 0.8, y: b.gy - cv.height * (0.4 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 30, vy: -10 + Math.random() * 10, g: 25, life: 1.2 + Math.random(), t: 0, c: k.leaf[Math.floor(Math.random() * 3)], s: 1, leaf: true }); }
  function sawdust() { const b = backdrop; particles.push({ x: b.w - 34 + Math.random() * 8, y: b.gy - 12, vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 15, g: 60, life: 0.5, t: 0, c: '#e8d0a0', s: 1 }); }
  function coinFlyers(x, y, n) { const sc = UI.layout.scene; const pn = UI.layout.panel, tx = pn.x + (UI.layout.landscape ? 0 : UI.safe.l) + 30, ty = pn.y + (UI.layout.landscape ? UI.safe.t : 0) + 30; for (let i = 0; i < n; i++) flyers.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 20, tx, ty, t: -i * 0.04, dur: 0.55 + Math.random() * 0.2 }); }

  // ---- loop ------------------------------------------------------------------------------------------
  function loop(now) {
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now; time += dt;
    update(dt); render(dt); requestAnimationFrame(loop);
  }
  function update(dt) {
    const S = L.state, T = S.tree;
    UI.update(dt);
    if (!UI.modal) G.tick(dt);
    const prevState = T.state;
    if (T.state === 'falling' && T.t >= 0.86 && !thudDone) { thudDone = true; shake = 6; L.audio.sfx('thud'); }
    wobble = Math.max(0, wobble - dt * 4); shake = Math.max(0, shake - dt * 14); playerSwing = Math.max(0, playerSwing - dt);
    if (wagonAnim >= 0) { wagonAnim += dt; if (wagonAnim > 2.6) wagonAnim = -1; }
    const milling = G.d.mill > 0 && S.logs > 0.01; if (milling) { bladeAngle += dt * 14; if (Math.random() < 0.4) sawdust(); }
    L.audio.env.saw = milling ? 1 : 0; L.audio.env.night = nightAmount(); L.audio.update(dt);
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt + (p.leaf ? Math.sin(p.t * 6) * 8 * dt : 0); p.y += p.vy * dt; }
    particles = particles.filter((p) => p.t < p.life && p.y < backdrop.gy + 4);
    for (const f of flyers) f.t += dt; flyers = flyers.filter((f) => f.t < f.dur);
    // crew visual swing edges spawn chips
    if (T.state === 'up' && S.up.hire > 0) for (let i = 0; i < Math.min(6, S.up.hire); i++) { const c = crew[i]; const ph = (time * c.speed + c.phase) % 1; const fr = ph < 0.22 ? 2 : 1; if (fr === 2 && c.last === 1 && Math.random() < 0.7) chips(2); c.last = fr; }
    autosaveT += dt; if (autosaveT > 10) { autosaveT = 0; G.save(); }
  }
  function dayPhase() { return (L.state.playTime % 480) / 480; }
  function nightAmount() { const p = dayPhase(); if (p < 0.55) return 0; if (p < 0.65) return (p - 0.55) / 0.1; if (p < 0.9) return 1; return 1 - (p - 0.9) / 0.1; }

  // ---- render ------------------------------------------------------------------------------------------
  const SKY = [
    [0.0, '#f2a35a', '#f6d08a'], [0.12, '#7fbfe8', '#d6ecf5'], [0.5, '#6fb4e0', '#cfe6f2'], [0.6, '#e07a5a', '#f2c08a'], [0.68, '#1a2340', '#3a4a6a'], [0.9, '#101830', '#26304a'], [1.0, '#f2a35a', '#f6d08a'],
  ];
  function skyColors(p) { for (let i = 1; i < SKY.length; i++) if (p <= SKY[i][0]) { const [t0, a0, b0] = SKY[i - 1], [t1, a1, b1] = SKY[i]; const t = (p - t0) / (t1 - t0); return [L.color.mix(a0, a1, t), L.color.mix(b0, b1, t)]; } return ['#6fb4e0', '#cfe6f2']; }

  function render(dt) {
    const S = L.state, T = S.tree, b = backdrop, w = b.w, h = b.h, gy = b.gy, wg = sceneG, night = nightAmount(), p = dayPhase();
    const [top, bot] = skyColors(p);
    const grad = wg.createLinearGradient(0, 0, 0, gy); grad.addColorStop(0, top); grad.addColorStop(1, bot); wg.fillStyle = grad; wg.fillRect(0, 0, w, h);
    // sun / moon
    const sa = p < 0.62 ? (p / 0.62) * Math.PI : ((p - 0.62) / 0.38) * Math.PI; const sx = w * 0.15 + Math.cos(Math.PI - sa) * w * 0.35 + w * 0.35, sy = gy - 20 - Math.sin(sa) * (gy - 40);
    if (p < 0.62) { wg.fillStyle = '#fff2b0'; wg.beginPath(); wg.arc(sx, sy, 7, 0, 7); wg.fill(); } else { wg.fillStyle = '#f0ecd8'; wg.beginPath(); wg.arc(sx, sy, 6, 0, 7); wg.fill(); wg.fillStyle = top; wg.beginPath(); wg.arc(sx + 3, sy - 2, 5, 0, 7); wg.fill(); }
    for (const c of clouds) { c.x += c.v * dt; if (c.x > w + 40) c.x = -40; const cx0 = Math.round(c.x), cy0 = Math.round(c.y); wg.fillStyle = `rgba(255,255,255,${0.85 - night * 0.6})`; wg.beginPath(); wg.ellipse(cx0, cy0, 16 * c.s, 5 * c.s, 0, 0, 7); wg.ellipse(cx0 - 8 * c.s, cy0 + 2, 9 * c.s, 4 * c.s, 0, 0, 7); wg.ellipse(cx0 + 9 * c.s, cy0 + 1, 10 * c.s, 4.5 * c.s, 0, 0, 7); wg.fill(); }
    if (night < 0.5) for (const bd of birds) { bd.x += bd.v * dt; if (bd.x > w + 10) { bd.x = -10; bd.y = 20 + Math.random() * Math.max(10, gy * 0.4); } const fl = Math.sin(time * 6 + bd.ph) > 0 ? 1 : 0; wg.fillStyle = `rgba(40,50,60,${0.8 - night})`; wg.fillRect(Math.round(bd.x) - 2, Math.round(bd.y) - fl, 2, 1); wg.fillRect(Math.round(bd.x), Math.round(bd.y) - fl, 2, 1); wg.fillRect(Math.round(bd.x) - 3, Math.round(bd.y) - fl + 1, 1, 1); wg.fillRect(Math.round(bd.x) + 2, Math.round(bd.y) - fl + 1, 1, 1); }
    if (night > 0) { wg.fillStyle = `rgba(255,255,255,${0.9 * night})`; for (const [x, y, tw] of stars) if (Math.sin(time * 2 + tw * 10) > -0.5) wg.fillRect(Math.round(x), Math.round(y), 1, 1); }
    wg.drawImage(b.hills1, 0, 0); wg.drawImage(b.hills2, 0, 0); wg.drawImage(b.treeline, 0, 0); wg.drawImage(b.treeline2, 0, 0);
    // ground
    wg.fillStyle = '#4f8a3a'; wg.fillRect(0, gy, w, 6); wg.fillStyle = '#3f6e30'; wg.fillRect(0, gy + 6, w, 4); wg.fillStyle = '#5a3a22'; wg.fillRect(0, gy + 10, w, h - gy - 10);
    for (let x = 0; x < w; x += 7) { const hh = L.hash(x, 1, 3); wg.fillStyle = '#5c9a44'; wg.fillRect(x + Math.floor(hh * 4), gy - 2 - Math.floor(hh * 2), 1, 2 + Math.floor(hh * 2)); }
    // mill
    if (S.up.mill) { wg.drawImage(A.mill(), w - 58, gy - 38); wg.save(); wg.translate(w - 24, gy - 14); wg.rotate(bladeAngle); wg.drawImage(A.blade(0), -8, -8); wg.restore(); }
    // wagon
    if (S.up.merchant) { let wx = 6; if (wagonAnim >= 0) { const t = wagonAnim / 2.6; wx = 6 + easeInCubic(Math.min(1, t * 1.2)) * (w + 60); } wg.drawImage(A.wagon(), Math.round(wx), gy - 22); }
    // wood pile
    const level = S.logs + S.planks > 0 ? Math.min(5, Math.ceil(Math.log10(S.logs + S.planks + 1) * 1.6)) : 0;
    if (level > 0) wg.drawImage(A.pile(level), Math.round(w / 2) - 92, gy - 22);
    // tree / stump / sapling
    const cx = Math.round(w / 2);
    const tcv = A.tree(T.species, T.seed);
    if (T.state === 'up') {
      wg.save(); wg.translate(cx, gy); wg.rotate(Math.sin(time * 40) * 0.04 * wobble); wg.drawImage(tcv, -tcv.baseX, -tcv.baseY); wg.restore();
    } else if (T.state === 'falling') {
      const t = T.t; const ang = easeInCubic(Math.min(1, t / 0.86)) * Math.PI / 2 * fallDir; const alpha = t > 0.86 ? 1 - (t - 0.86) / 0.14 : 1;
      wg.drawImage(A.stump(T.species), cx - A.stump(T.species).width / 2, gy - 8);
      wg.save(); wg.globalAlpha = alpha; wg.translate(cx, gy - 4); wg.rotate(ang); wg.drawImage(tcv, -tcv.baseX, -tcv.baseY + 4); wg.restore();
    } else {
      const stage = clamp(Math.floor((T.t / G.d.regrow) * 4), 0, 3);
      wg.drawImage(A.sapling(T.species, stage), cx - 8, gy - 19);
    }
    // player & crew
    const pl = A.human(A.PLAYER, 2, playerSwing > 0 ? 2 : T.state === 'up' ? 1 : 0); const px = cx - 16 - Math.round(tcv.width * 0.12);
    wg.drawImage(pl, px - 8, gy - 20); if (T.state === 'up') wg.drawImage(A.axe(playerSwing > 0 ? 2 : 1), px + (playerSwing > 0 ? 6 : 2), gy - (playerSwing > 0 ? 14 : 26));
    const slots = [1, -1, 1, -1, 1, -1]; const nCrew = Math.min(6, S.up.hire);
    for (let i = 0; i < nCrew; i++) {
      const c = crew[i], side = slots[i], dist = 14 + Math.round(tcv.width * 0.12) + 13 * Math.floor(i / 2) + (side < 0 ? 26 : 0), x = cx + side * dist, dir = side > 0 ? 1 : 2;
      const ph = (time * c.speed + c.phase) % 1, fr = T.state === 'up' ? (ph < 0.22 ? 2 : 1) : 0;
      wg.save(); if (dir === 1) { wg.translate(x * 2, 0); wg.scale(-1, 1); }
      wg.drawImage(A.human(A.CREW[i % A.CREW.length], 2, fr), x - 8, gy - 20); if (fr) wg.drawImage(A.axe(fr), x + (fr === 2 ? 6 : 2), gy - (fr === 2 ? 14 : 26));
      wg.restore();
    }
    if (S.up.hire > 6) { wg.fillStyle = 'rgba(0,0,0,0.35)'; wg.fillRect(cx + 60, gy - 30, 22, 9); wg.fillStyle = '#fff'; wg.font = '7px monospace'; wg.textBaseline = 'top'; wg.fillText('+' + (S.up.hire - 6), cx + 62, gy - 29); }
    // particles
    for (const pt of particles) { wg.globalAlpha = Math.max(0, 1 - pt.t / pt.life); wg.fillStyle = pt.c; wg.fillRect(Math.round(pt.x), Math.round(pt.y), pt.s, pt.s); } wg.globalAlpha = 1;
    // night tint + fireflies + lanterns
    if (night > 0.02) { wg.fillStyle = `rgba(10,16,40,${0.42 * night})`; wg.fillRect(0, 0, w, h); wg.globalCompositeOperation = 'lighter'; for (const f of fireflies) { const bl = 0.5 + 0.5 * Math.sin(time * f.sp * 3 + f.ph); if (bl < 0.3) continue; wg.fillStyle = `rgba(200,255,120,${bl * night})`; wg.fillRect(Math.round(f.x + Math.sin(time * f.sp + f.ph) * 8), Math.round(f.y + Math.cos(time * f.sp * 0.7) * 4), 1, 1); } const lg = wg.createRadialGradient(cx - 22, gy - 10, 0, cx - 22, gy - 10, 40); lg.addColorStop(0, `rgba(255,190,90,${0.35 * night})`); lg.addColorStop(1, 'rgba(255,190,90,0)'); wg.fillStyle = lg; wg.fillRect(cx - 62, gy - 50, 80, 60); wg.globalCompositeOperation = 'source-over'; }
    // blit
    const sc = UI.layout.scene;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#16212a'; g.fillRect(0, 0, canvas.width, canvas.height);
    const shx = (Math.random() - 0.5) * shake * dpr, shy = (Math.random() - 0.5) * shake * dpr;
    g.drawImage(sceneCv, 0, 0, w, h, Math.round(sc.x * dpr + shx), Math.round(sc.y * dpr + shy), Math.round(w * scale * dpr), Math.round(h * scale * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // coin flyers (CSS layer)
    for (const f of flyers) { if (f.t < 0) continue; const t = easeOutCubic(Math.min(1, f.t / f.dur)); const x = lerp(f.x, f.tx, t), y = lerp(f.y, f.ty, t) - Math.sin(t * Math.PI) * 40; g.imageSmoothingEnabled = false; g.drawImage(A.icon('coin'), x - 10, y - 10, 20, 20); }
    UI.draw(g, dt);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', MN.init); else MN.init();
})();
