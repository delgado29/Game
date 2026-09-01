/* Cafetal — 70_ui.js
   Touch input, HUD, hotbar, toasts, speech bubbles and modal panels.
   Immediate-mode: every frame redraws and re-registers hit rectangles. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const { clamp, lerp } = C.math;
  const SP = C.sprites, E = C.entities, W = C.world, EC = C.econ, ST = C.stations;
  const UI = (C.ui = {});

  UI.safe = { t: 0, r: 0, b: 0, l: 0 };
  UI.modal = null;
  UI.toasts = [];
  UI.hintText = null;
  let hits = [], pressed = null, pressedT = 0;
  let cssW = 0, cssH = 0, narrow = false;
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';
  const PAL = { panel: '#f6ecd8', panelD: '#e6d6b8', ink: '#3a2a1e', inkSoft: '#7a6a5a', accent: '#c85a3a', accentD: '#a04a2e', green: '#5a9a4a', border: '#a06a3a', dim: 'rgba(12,10,8,0.55)', hud: 'rgba(30,22,16,0.72)', hudInk: '#f6ecd8' };
  UI.PAL = PAL;

  // ---- drawing helpers ------------------------------------------------------------------
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  UI.rr = rr;
  function text(g, s, x, y, size, color, align, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y); }
  UI.text = text;
  function textW(g, s, size, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; return g.measureText(s).width; }
  function icon(g, name, x, y, size) { const im = SP.icon(name); g.imageSmoothingEnabled = false; g.drawImage(im, x, y, size, size); }
  UI.icon = icon;
  function wrap(g, s, maxW, size, weight) {
    g.font = `${weight || 500} ${size}px ${FONT}`; const out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; }
      out.push(line);
    }
    return out;
  }
  function hit(x, y, w, h, fn, id) { hits.push({ x, y, w, h, fn, id: id || fn }); }
  UI.hit = hit;

  // button: returns nothing; registers hit
  function btn(g, id, x, y, w, h, label, opts) {
    opts = opts || {};
    const isPressed = pressed === id && pressedT > 0;
    const disabled = !!opts.disabled;
    const bg = disabled ? '#c8bca8' : opts.kind === 'secondary' ? PAL.panelD : opts.kind === 'green' ? PAL.green : PAL.accent;
    const fg = disabled ? '#8a8078' : opts.kind === 'secondary' ? PAL.ink : '#fff8ec';
    g.save();
    if (isPressed) { g.translate(0, 1); }
    rr(g, x, y + 2, w, h, 12); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
    rr(g, x, y, w, h, 12); g.fillStyle = bg; g.fill();
    if (!disabled) { rr(g, x + 1, y + 1, w - 2, h / 2, 10); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); }
    let tx = x + w / 2;
    if (opts.icon) { const sz = Math.min(28, h - 12); icon(g, opts.icon, x + 10, y + (h - sz) / 2, sz); tx = x + 10 + sz + (w - 10 - sz) / 2; }
    if (label) text(g, label, tx, y + h / 2, opts.size || 16, fg, 'center', 700);
    g.restore();
    if (!disabled) hit(x, y, w, h, opts.fn, id);
  }
  UI.btn = btn;

  function panel(g, x, y, w, h, title, onClose) {
    rr(g, x, y + 4, w, h, 18); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
    rr(g, x, y, w, h, 18); g.fillStyle = PAL.panel; g.fill();
    g.lineWidth = 3; g.strokeStyle = PAL.border; rr(g, x, y, w, h, 18); g.stroke();
    if (title) { text(g, title, x + 20, y + 28, 22, PAL.ink, 'left', 800); }
    if (onClose) {
      const bx = x + w - 46, by = y + 12;
      rr(g, bx, by, 34, 34, 10); g.fillStyle = PAL.panelD; g.fill(); icon(g, 'x', bx + 5, by + 5, 24);
      hit(bx - 6, by - 6, 46, 46, onClose, 'close');
    }
  }

  // ---- toasts & hints ----------------------------------------------------------------
  UI.toast = function (msg, iconName) { UI.toasts.push({ msg, icon: iconName, t: 0, life: 2.8 }); if (UI.toasts.length > 4) UI.toasts.shift(); };
  UI.hint = function (msg) { UI.hintText = msg; UI.hintT = 0; };

  // ---- input ---------------------------------------------------------------------------
  let down = null;
  UI.bindInput = function (canvas) {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); C.audio.init();
      const [x, y] = pos(e); down = { x, y, t: C.now(), id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const h = hitAt(x, y); pressed = h ? h.id : null; pressedT = 0.2;
      if (UI.modal && UI.modal.onDown) UI.modal.onDown(x, y, h);
      if (!UI.modal && !h) C.game.onWorldDown(x, y);
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => { e.preventDefault(); if (!down) return; const [x, y] = pos(e); if (UI.modal) UI.onMove(x, y); else C.game.onWorldDrag(x, y, down); }, { passive: false });
    const up = (e) => {
      e.preventDefault(); if (!down) return;
      const [x, y] = pos(e); const d = down; down = null;
      const moved = Math.hypot(x - d.x, y - d.y), dt = C.now() - d.t;
      if (UI.modal && UI.modal.onUp) UI.modal.onUp(x, y);
      if (moved < 14 && dt < 700) UI.tap(x, y);
      else C.game.onWorldDragEnd && C.game.onWorldDragEnd(x, y, d, moved);
      pressed = null;
    };
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', (e) => { down = null; pressed = null; if (UI.modal && UI.modal.onUp) UI.modal.onUp(-1, -1); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  function hitAt(x, y) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
  UI.tap = function (x, y) {
    const h = hitAt(x, y);
    if (h) { if (h.fn) h.fn(x, y); return; }
    if (UI.modal) { if (UI.modal.onTapOutside) UI.modal.onTapOutside(x, y); return; }
    if (UI.hintText && y > cssH - 150 - UI.safe.b) { /* falls through to world */ }
    C.game.onWorldTap(x, y);
  };

  // ---- HUD -----------------------------------------------------------------------------
  UI.TOOLS = ['hand', 'hoe', 'water', 'coffee_seed', 'tomato_seed', 'corn_seed', 'sunflower_seed', 'bag'];
  UI.hotbarHeight = () => (narrow ? 62 : 74);

  function drawHUD(g) {
    const S = C.state, s = UI.safe;
    const top = s.t + 8;
    // left card: clock + day
    const lx = s.l + 10;
    const wIcon = S.weather === 'rain' ? 'rain' : S.weather === 'snow' ? 'snow' : S.weather === 'cloudy' ? 'cloud' : (W.daylight() < 0.3 ? 'moon' : 'sun');
    const clock = C.formatTime(S.time.hour), dayStr = `${C.t('day')} ${S.time.day} · ${C.t('season_' + W.season())}`;
    const cw = Math.max(textW(g, clock, 20, 800), textW(g, dayStr, 13, 600)) + 58;
    rr(g, lx, top, cw, 54, 14); g.fillStyle = PAL.hud; g.fill();
    icon(g, wIcon, lx + 10, top + 11, 32);
    text(g, clock, lx + 50, top + 18, 20, PAL.hudInk, 'left', 800);
    text(g, dayStr, lx + 50, top + 40, 13, '#e0d0b8', 'left', 600);
    // right card: coins, rep, settings
    const coinStr = String(S.coins);
    const rw = textW(g, coinStr, 20, 800) + 44 + 5 * 20 + 20 + 44;
    const rx = cssW - s.r - 10 - rw;
    rr(g, rx, top, rw, 54, 14); g.fillStyle = PAL.hud; g.fill();
    icon(g, 'coin', rx + 8, top + 8, 26);
    text(g, coinStr, rx + 40, top + 21, 20, '#ffe08a', 'left', 800);
    // hearts row (bottom half)
    const lvl = EC.repLevel();
    for (let i = 0; i < 5; i++) { g.globalAlpha = i < lvl ? 1 : 0.28; icon(g, 'heart', rx + 8 + i * 20, top + 32, 18); }
    g.globalAlpha = 1;
    text(g, String(S.rep), rx + 8 + 5 * 20 + 4, top + 41, 12, '#e0d0b8', 'left', 600);
    // settings button
    const gx = rx + rw - 40, gy = top + 9;
    rr(g, gx, gy, 36, 36, 10); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill(); icon(g, 'settings', gx + 6, gy + 6, 24);
    hit(gx - 4, gy - 4, 44, 44, () => { C.audio.sfx('tap'); UI.open('settings'); }, 'settings');
    // mail badge
    if (S.mail.length) { const mx = lx + cw + 10; rr(g, mx, top + 8, 40, 40, 12); g.fillStyle = PAL.hud; g.fill(); icon(g, 'letter', mx + 6, top + 14, 28); g.fillStyle = '#e04a4a'; g.beginPath(); g.arc(mx + 34, top + 14, 6, 0, 7); g.fill(); }
  }

  function drawHotbar(g) {
    const S = C.state, s = UI.safe;
    const size = narrow ? 48 : 58, gap = narrow ? 5 : 8;
    const n = UI.TOOLS.length, totalW = n * size + (n - 1) * gap;
    const x0 = (cssW - totalW) / 2, y0 = cssH - s.b - size - 10;
    rr(g, x0 - 10, y0 - 8, totalW + 20, size + 16, 18); g.fillStyle = PAL.hud; g.fill();
    UI.TOOLS.forEach((tool, i) => {
      const x = x0 + i * (size + gap), sel = S.tool === tool;
      const isSeed = tool.endsWith('_seed'); const cnt = isSeed ? EC.count(tool) : 0;
      rr(g, x, y0, size, size, 12); g.fillStyle = sel ? 'rgba(255,220,150,0.95)' : 'rgba(255,255,255,0.12)'; g.fill();
      if (sel) { g.lineWidth = 3; g.strokeStyle = '#ffb060'; rr(g, x, y0, size, size, 12); g.stroke(); }
      const isz = Math.round(size * 0.66);
      g.globalAlpha = isSeed && !cnt ? 0.35 : 1;
      icon(g, tool === 'bag' ? 'bag' : tool, x + (size - isz) / 2, y0 + (size - isz) / 2 - (isSeed ? 3 : 0), isz);
      g.globalAlpha = 1;
      if (isSeed) { rr(g, x + size - 26, y0 + size - 20, 22, 16, 6); g.fillStyle = cnt ? '#3a2a1e' : '#5a5048'; g.fill(); text(g, String(cnt), x + size - 15, y0 + size - 12, 11, '#fff', 'center', 800); }
      hit(x, y0, size, size, () => {
        C.audio.sfx('tap');
        if (tool === 'bag') { UI.open('bag'); return; }
        S.tool = tool; C.game.cancelAction();
      }, 'tool' + i);
    });
  }

  function drawToasts(g, dt) {
    const s = UI.safe; let y = s.t + 74;
    for (const t of UI.toasts) {
      t.t += dt;
      const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.5 ? Math.max(0, (t.life - t.t) / 0.5) : 1;
      const w = textW(g, t.msg, 15, 700) + (t.icon ? 58 : 28);
      g.globalAlpha = a;
      const x = (cssW - w) / 2;
      rr(g, x, y, w, 36, 12); g.fillStyle = PAL.hud; g.fill();
      if (t.icon) icon(g, t.icon, x + 12, y + 6, 24);
      text(g, t.msg, x + (t.icon ? 44 : 14), y + 18, 15, PAL.hudInk, 'left', 700);
      g.globalAlpha = 1;
      y += 42;
    }
    UI.toasts = UI.toasts.filter((t) => t.t < t.life);
  }
  function drawHint(g, dt) {
    if (!UI.hintText || UI.modal) return;
    UI.hintT = (UI.hintT || 0) + dt;
    const lines = wrap(g, UI.hintText, Math.min(cssW - 80, 440), 14, 600);
    const w = Math.min(cssW - 60, 460), h = lines.length * 18 + 18;
    const x = (cssW - w) / 2, y = cssH - UI.safe.b - UI.hotbarHeight() - h - 12;
    g.globalAlpha = Math.min(1, UI.hintT / 0.3);
    rr(g, x, y, w, h, 12); g.fillStyle = 'rgba(246,236,216,0.94)'; g.fill();
    icon(g, 'star', x + 8, y + h / 2 - 10, 20);
    lines.forEach((l, i) => text(g, l, x + 34, y + 14 + i * 18, 14, PAL.ink, 'left', 600));
    g.globalAlpha = 1;
    hit(x, y, w, h, () => { UI.hintText = null; }, 'hint');
  }

  // speech bubbles above entities (world -> screen via game)
  function drawBubbles(g) {
    const list = [...E.npcs, E.player, E.rosa, E.cat].filter((m) => m && m.bubble);
    for (const m of list) {
      const [sx, sy] = C.game.worldToScreen(m.x, m.y - 22);
      const lines = wrap(g, m.bubble, 200, 13, 600);
      const w = Math.max(...lines.map((l) => textW(g, l, 13, 600))) + 20, h = lines.length * 16 + 12;
      let x = clamp(sx - w / 2, 6, cssW - w - 6), y = sy - h - 8;
      rr(g, x, y, w, h, 10); g.fillStyle = 'rgba(255,252,244,0.96)'; g.fill();
      g.beginPath(); g.moveTo(sx - 6, y + h - 1); g.lineTo(sx, y + h + 7); g.lineTo(sx + 6, y + h - 1); g.fillStyle = 'rgba(255,252,244,0.96)'; g.fill();
      lines.forEach((l, i) => text(g, l, x + 10, y + 12 + i * 16, 13, PAL.ink, 'left', 600));
    }
    // order icons over waiting customers
    for (const n of E.npcs) {
      if (n.state !== 'wait' || n.bubble) continue;
      const [sx, sy] = C.game.worldToScreen(n.x, n.y - 24);
      const frac = 1 - n.waited / n.patience;
      rr(g, sx - 20, sy - 42, 40, 40, 10); g.fillStyle = 'rgba(255,252,244,0.95)'; g.fill();
      icon(g, n.order, sx - 16, sy - 40, 32);
      g.fillStyle = frac > 0.4 ? '#6ad06a' : frac > 0.2 ? '#f0c040' : '#e05a4a'; g.fillRect(sx - 16, sy - 6, 32 * frac, 3);
      hit(sx - 24, sy - 46, 48, 48, () => C.game.tapCustomer(n), 'cust' + n.def.id);
    }
  }

  // ---- modals ---------------------------------------------------------------------------
  UI.open = function (type, data) { UI.modal = { type, data: data || {}, t: 0 }; if (type === 'fishing') ST.startFishing(); };
  UI.close = function () { if (UI.modal && UI.modal.type === 'roaster') ST.roast = null; if (UI.modal && UI.modal.type === 'fishing') ST.fish = null; UI.modal = null; C.audio.sfx('back'); };
  UI.pausesTime = () => !!UI.modal && UI.modal.type !== 'order';

  function modalRect(prefW, prefH) {
    const w = Math.min(prefW, cssW - 24), h = Math.min(prefH, cssH - UI.safe.t - UI.safe.b - 24);
    return { x: (cssW - w) / 2, y: UI.safe.t + (cssH - UI.safe.t - UI.safe.b - h) / 2, w, h };
  }

  const MODALS = {
    title(g, m) {
      const S = C.state;
      g.fillStyle = 'rgba(10,14,10,0.45)'; g.fillRect(0, 0, cssW, cssH);
      const cy = cssH * 0.36;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 12;
      text(g, C.t('title'), cssW / 2, cy - 30, Math.min(84, cssW / 6), '#f6ecd8', 'center', 900);
      g.restore();
      text(g, C.t('tagline'), cssW / 2, cy + 26, 20, '#e8d8b8', 'center', 500);
      icon(g, 'espresso', cssW / 2 - 24, cy + 50, 48);
      const bw = Math.min(280, cssW - 60), bx = (cssW - bw) / 2; let by = cy + 120;
      if (C.save.hasSave()) { btn(g, 'cont', bx, by, bw, 54, C.t('continue_game'), { size: 20, fn: () => { C.audio.sfx('blip'); C.game.continueGame(); } }); by += 66; }
      btn(g, 'new', bx, by, bw, 54, C.t('new_game'), { size: 20, kind: C.save.hasSave() ? 'secondary' : 'primary', fn: () => { C.audio.sfx('blip'); if (C.save.hasSave()) UI.open('confirm', { text: C.t('new_game_confirm'), yes: () => C.game.newGame() }); else C.game.newGame(); } }); by += 66;
      // language toggle
      const lw = 150, lx = (cssW - lw) / 2;
      btn(g, 'lang', lx, by, lw, 40, C.lang === 'es' ? 'Español ▸ English' : 'English ▸ Español', { kind: 'secondary', size: 14, fn: () => { C.audio.sfx('tap'); C.game.toggleLang(); } });
      text(g, 'v1.0 · made with pixels & WebAudio', cssW / 2, cssH - UI.safe.b - 18, 12, 'rgba(246,236,216,0.7)', 'center', 500);
    },
    confirm(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(380, 190); panel(g, r.x, r.y, r.w, r.h, null);
      const lines = wrap(g, m.data.text, r.w - 40, 17, 600); lines.forEach((l, i) => text(g, l, r.x + r.w / 2, r.y + 40 + i * 22, 17, PAL.ink, 'center', 600));
      const bw = (r.w - 60) / 2;
      btn(g, 'yes', r.x + 20, r.y + r.h - 70, bw, 50, C.t('yes'), { fn: () => { const f = m.data.yes; UI.modal = null; f && f(); } });
      btn(g, 'no', r.x + 40 + bw, r.y + r.h - 70, bw, 50, C.t('no'), { kind: 'secondary', fn: () => { UI.modal = null; C.audio.sfx('back'); } });
    },
    settings(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(400, 380); panel(g, r.x, r.y, r.w, r.h, C.t('settings'), UI.close);
      const st = C.save.settings; let y = r.y + 70; const rowH = 56;
      const row = (label, value, id, fn) => { text(g, label, r.x + 24, y + 20, 17, PAL.ink, 'left', 700); btn(g, id, r.x + r.w - 150, y, 126, 42, value, { kind: 'secondary', size: 15, fn }); y += rowH; };
      row(C.t('language'), C.lang === 'es' ? 'Español' : 'English', 'lang', () => { C.audio.sfx('tap'); C.game.toggleLang(); });
      row(C.t('music'), st.music ? C.t('on') : C.t('off'), 'music', () => { st.music = !st.music; C.audio.setMusic(st.music); C.save.saveSettings(); C.audio.sfx('tap'); });
      row(C.t('sound'), st.sound ? C.t('on') : C.t('off'), 'sound', () => { st.sound = !st.sound; C.audio.setSound(st.sound); C.save.saveSettings(); C.audio.sfx('tap'); });
      y += 6;
      btn(g, 'newgame', r.x + 24, y, r.w - 48, 46, C.t('new_game'), { kind: 'secondary', fn: () => UI.open('confirm', { text: C.t('new_game_confirm'), yes: () => C.game.newGame() }) }); y += 56;
      const S = C.state;
      text(g, `${C.t('day')} ${S.time.day} · ${C.t('happy')}: ${S.stats.served} · ${C.t('earned')}: ${S.stats.earned}`, r.x + r.w / 2, y + 12, 12, PAL.inkSoft, 'center', 500);
      if (!window.navigator.standalone && /iPad|iPhone/.test(navigator.userAgent)) text(g, C.t('fullscreen'), r.x + r.w / 2, y + 32, 12, PAL.inkSoft, 'center', 500);
    },
    letter(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const body = C.t(m.data.key);
      const r = modalRect(440, 420);
      rr(g, r.x, r.y + 4, r.w, r.h, 8); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
      rr(g, r.x, r.y, r.w, r.h, 8); g.fillStyle = '#fbf5e6'; g.fill();
      g.strokeStyle = '#d8c8a8'; g.lineWidth = 2; rr(g, r.x + 8, r.y + 8, r.w - 16, r.h - 16, 6); g.stroke();
      icon(g, 'letter', r.x + r.w - 52, r.y + 16, 32);
      const lines = wrap(g, body, r.w - 64, 16, 500);
      lines.forEach((l, i) => text(g, l, r.x + 32, r.y + 44 + i * 22, 16, PAL.ink, 'left', 500));
      btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, C.t('ok'), { fn: () => { UI.modal = null; C.audio.sfx('blip'); } });
    },
    sleep(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(360, 200); panel(g, r.x, r.y, r.w, r.h, null);
      icon(g, 'zzz', r.x + r.w / 2 - 20, r.y + 20, 40);
      text(g, C.t('sleep_q'), r.x + r.w / 2, r.y + 80, 20, PAL.ink, 'center', 800);
      const bw = (r.w - 60) / 2;
      btn(g, 'yes', r.x + 20, r.y + r.h - 70, bw, 50, C.t('yes'), { fn: () => { UI.modal = null; C.game.sleep(); } });
      btn(g, 'no', r.x + 40 + bw, r.y + r.h - 70, bw, 50, C.t('no'), { kind: 'secondary', fn: UI.close });
    },
    summary(g, m) {
      g.fillStyle = 'rgba(8,10,14,0.6)'; g.fillRect(0, 0, cssW, cssH);
      const S = C.state, d = m.data;
      const r = modalRect(400, 330); panel(g, r.x, r.y, r.w, r.h, C.t('good_morning'));
      let y = r.y + 70;
      text(g, C.t('sleep_summary', { day: S.time.day, season: C.t('season_' + W.season()) }), r.x + 24, y, 17, PAL.ink, 'left', 700); y += 34;
      const line = (ic, label, val) => { icon(g, ic, r.x + 24, y - 12, 24); text(g, label, r.x + 58, y, 15, PAL.inkSoft, 'left', 600); text(g, String(val), r.x + r.w - 28, y, 17, PAL.ink, 'right', 800); y += 32; };
      line('heart', C.t('customers_today'), `${d.served} / ${d.customers}`);
      line('coin', C.t('earned'), d.earned);
      const fc = S.weather; line(fc === 'rain' ? 'rain' : fc === 'snow' ? 'snow' : fc === 'cloudy' ? 'cloud' : 'sun', C.t('weather_' + fc), '');
      if (S.forecast === 'rain') text(g, C.t('forecast_rain'), r.x + 24, y, 13, PAL.inkSoft, 'left', 500);
      else if (S.forecast === 'snow') text(g, C.t('forecast_snow'), r.x + 24, y, 13, PAL.inkSoft, 'left', 500);
      else text(g, C.t('forecast_clear'), r.x + 24, y, 13, PAL.inkSoft, 'left', 500);
      btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, C.t('ok'), { fn: () => { UI.modal = null; C.audio.sfx('blip'); C.game.afterSummary(); } });
    },
    bag(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(520, 440); panel(g, r.x, r.y, r.w, r.h, C.t('inventory'), UI.close);
      const items = EC.bagList();
      if (!items.length) text(g, C.t('empty_bag'), r.x + r.w / 2, r.y + r.h / 2, 16, PAL.inkSoft, 'center', 600);
      const cell = 76, cols = Math.max(3, Math.floor((r.w - 40) / cell));
      items.forEach((it, i) => {
        const cx = r.x + 20 + (i % cols) * cell, cy = r.y + 60 + Math.floor(i / cols) * (cell + 8);
        if (cy + cell > r.y + r.h - 10) return;
        rr(g, cx, cy, cell - 8, cell - 8, 12); g.fillStyle = m.data.sel === it.id ? '#ffe0b0' : PAL.panelD; g.fill();
        icon(g, it.id, cx + (cell - 8 - 40) / 2, cy + 6, 40);
        text(g, String(it.n), cx + cell - 16, cy + cell - 20, 13, PAL.ink, 'right', 800);
        hit(cx, cy, cell - 8, cell - 8, () => { m.data.sel = it.id; C.audio.sfx('tap'); }, 'bag' + it.id);
      });
      if (m.data.sel) { const it = C.ITEMS[m.data.sel]; text(g, `${EC.itemName(m.data.sel)}${it && it.sell ? `  ·  ${it.sell} ${C.t('coins')}` : ''}`, r.x + r.w / 2, r.y + r.h - 26, 15, PAL.ink, 'center', 700); }
    },
    shop(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const S = C.state;
      const r = modalRect(560, 520); panel(g, r.x, r.y, r.w, r.h, C.t('shop'), UI.close);
      icon(g, 'coin', r.x + r.w - 150, r.y + 16, 24); text(g, String(S.coins), r.x + r.w - 120, r.y + 28, 18, PAL.ink, 'left', 800);
      const tabs = [['seeds', C.t('seeds')], ['pantry', C.t('pantry')], ['upgrades', C.t('upgrades')], ['sell', C.t('sell')]];
      const tab = m.data.tab || 'seeds';
      const tw = (r.w - 40) / tabs.length;
      tabs.forEach(([id, label], i) => {
        const x = r.x + 20 + i * tw, y = r.y + 54;
        rr(g, x + 2, y, tw - 4, 36, 10); g.fillStyle = tab === id ? PAL.accent : PAL.panelD; g.fill();
        text(g, label, x + tw / 2, y + 18, 14, tab === id ? '#fff8ec' : PAL.ink, 'center', 700);
        hit(x, y, tw, 36, () => { m.data.tab = id; m.data.scroll = 0; C.audio.sfx('tap'); }, 'tab' + id);
      });
      const listY = r.y + 100, listH = r.h - 112, rowH = 62;
      g.save(); g.beginPath(); g.rect(r.x, listY, r.w, listH); g.clip();
      let rows = [];
      if (tab === 'sell') rows = EC.bagList().filter((it) => C.ITEMS[it.id].sell > 0).map((it) => ({ id: it.id, n: it.n, price: C.ITEMS[it.id].sell, sell: true }));
      else rows = C.SHOP[tab].map((e) => ({ ...e }));
      const scroll = m.data.scroll || 0;
      rows.forEach((row, i) => {
        const y = listY + i * rowH - scroll; if (y + rowH < listY || y > listY + listH) return;
        rr(g, r.x + 16, y + 4, r.w - 32, rowH - 8, 12); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
        const ic = tab === 'upgrades' ? row.icon : row.id;
        icon(g, ic, r.x + 26, y + 11, 40);
        const name = tab === 'upgrades' ? C.t('up_' + row.id) : EC.itemName(row.id);
        text(g, name, r.x + 76, y + 22, 15, PAL.ink, 'left', 700);
        if (tab === 'upgrades') { const dl = wrap(g, C.t('up_' + row.id + '_d'), r.w - 260, 12, 500); text(g, dl[0], r.x + 76, y + 42, 12, PAL.inkSoft, 'left', 500); }
        else if (row.sell) text(g, `x${row.n}  ·  ${row.price} ${C.t('coins')}`, r.x + 76, y + 42, 13, PAL.inkSoft, 'left', 500);
        else text(g, `${row.price} ${C.t('coins')}  ·  ${C.t('owned')}: ${EC.count(row.id)}`, r.x + 76, y + 42, 13, PAL.inkSoft, 'left', 500);
        const inView = y >= listY - 10 && y + rowH <= listY + listH + 10;
        if (tab === 'upgrades') {
          if (S.upgrades[row.id]) { icon(g, 'check', r.x + r.w - 60, y + 18, 28); }
          else btn(g, 'buy' + row.id, r.x + r.w - 130, y + 12, 104, 38, `${row.price}`, { icon: 'coin', size: 14, disabled: S.coins < row.price || !inView, fn: () => { if (EC.buyUpgrade(row.id)) UI.toast(C.t('up_' + row.id), 'check'); else C.audio.sfx('error'); } });
        } else if (row.sell) {
          btn(g, 'sell1' + row.id, r.x + r.w - 196, y + 12, 80, 38, '+1', { kind: 'green', size: 14, disabled: !inView, fn: () => EC.sell(row.id, 1) });
          btn(g, 'sellall' + row.id, r.x + r.w - 108, y + 12, 84, 38, C.t('sell_all'), { kind: 'green', size: 13, disabled: !inView, fn: () => { const n = EC.count(row.id); if (n) UI.toast(`+${EC.sell(row.id, n)} ${C.t('coins')}`, 'coin'); } });
        } else {
          btn(g, 'buy1' + row.id, r.x + r.w - 196, y + 12, 80, 38, `${row.price}`, { icon: 'coin', size: 13, disabled: S.coins < row.price || !inView, fn: () => { if (!EC.buy(row.id, row.price, 1)) { C.audio.sfx('error'); UI.toast(C.t('not_enough')); } } });
          btn(g, 'buy5' + row.id, r.x + r.w - 108, y + 12, 84, 38, `x5 ${row.price * 5}`, { size: 12, disabled: S.coins < row.price * 5 || !inView, fn: () => { if (!EC.buy(row.id, row.price, 5)) { C.audio.sfx('error'); UI.toast(C.t('not_enough')); } } });
        }
      });
      if (!rows.length) text(g, C.t('empty_bag'), r.x + r.w / 2, listY + 40, 15, PAL.inkSoft, 'center', 600);
      g.restore();
      m.maxScroll = Math.max(0, rows.length * rowH - listH);
      m.scrollArea = { x: r.x, y: listY, w: r.w, h: listH };
    },
    order(g, m) {
      // café panel: waiting customers with orders + recipes reference
      const S = C.state;
      g.fillStyle = 'rgba(12,10,8,0.35)'; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(560, 500); panel(g, r.x, r.y, r.w, r.h, C.t('cafe'), UI.close);
      const waiting = E.waitingCustomers();
      const tab = m.data.tab || (waiting.length ? 'orders' : 'recipes');
      const tabs = [['orders', `${C.t('customers_today')} (${waiting.length})`], ['recipes', C.t('recipe')]];
      const tw = (r.w - 40) / 2;
      tabs.forEach(([id, label], i) => { const x = r.x + 20 + i * tw, y = r.y + 54; rr(g, x + 2, y, tw - 4, 36, 10); g.fillStyle = tab === id ? PAL.accent : PAL.panelD; g.fill(); text(g, label, x + tw / 2, y + 18, 14, tab === id ? '#fff8ec' : PAL.ink, 'center', 700); hit(x, y, tw, 36, () => { m.data.tab = id; C.audio.sfx('tap'); }, 'otab' + id); });
      const listY = r.y + 100, listH = r.h - 112;
      g.save(); g.beginPath(); g.rect(r.x, listY, r.w, listH); g.clip();
      if (tab === 'orders') {
        if (!waiting.length) text(g, '…', r.x + r.w / 2, listY + 40, 20, PAL.inkSoft, 'center', 600);
        const rowH = 96;
        waiting.forEach((n, i) => {
          const y = listY + i * rowH - (m.data.scroll || 0);
          rr(g, r.x + 16, y + 4, r.w - 32, rowH - 8, 12); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
          // portrait
          const port = SP.humanoid(n.look, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(port, r.x + 26, y + 10, 48, 60);
          text(g, n.def.name, r.x + 84, y + 24, 16, PAL.ink, 'left', 800);
          icon(g, n.order, r.x + 84, y + 34, 28); text(g, C.t('drink_' + n.order), r.x + 118, y + 48, 14, PAL.ink, 'left', 600);
          text(g, `${C.RECIPES[n.order].price} ${C.t('coins')}`, r.x + 118, y + 68, 12, PAL.inkSoft, 'left', 500);
          const missing = ST.missingFor(n.order);
          // needs icons
          let ix = r.x + 84; const needs = C.RECIPES[n.order].needs;
          for (const it in needs) { const ok = EC.count(it) >= needs[it]; g.globalAlpha = ok ? 1 : 0.35; icon(g, it, ix, y + 72, 20); g.globalAlpha = 1; if (!ok) { g.fillStyle = '#e05a4a'; g.fillRect(ix, y + 90, 20, 2); } ix += 24; }
          // patience
          const frac = 1 - n.waited / n.patience; g.fillStyle = PAL.panelD; g.fillRect(r.x + r.w - 130, y + 66, 104, 6); g.fillStyle = frac > 0.4 ? '#6ad06a' : frac > 0.2 ? '#f0c040' : '#e05a4a'; g.fillRect(r.x + r.w - 130, y + 66, 104 * frac, 6);
          btn(g, 'serve' + n.def.id, r.x + r.w - 130, y + 12, 104, 44, C.t('serve'), { kind: 'green', disabled: missing.length > 0, fn: () => C.game.serveCustomer(n) });
          btn(g, 'sorry' + n.def.id, r.x + r.w - 130, y + 74, 104, 14, '', { kind: 'secondary', size: 10, fn: () => { EC.refuse(n); C.audio.sfx('back'); } });
          text(g, C.t('sorry'), r.x + r.w - 78, y + 81, 10, PAL.inkSoft, 'center', 600);
        });
        m.maxScroll = Math.max(0, waiting.length * rowH - listH);
      } else {
        const ids = Object.keys(C.RECIPES); const rowH = 54;
        ids.forEach((id, i) => {
          const y = listY + i * rowH - (m.data.scroll || 0), unlocked = S.rep >= C.RECIPES[id].rep;
          rr(g, r.x + 16, y + 4, r.w - 32, rowH - 8, 12); g.fillStyle = unlocked ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.06)'; g.fill();
          g.globalAlpha = unlocked ? 1 : 0.4;
          icon(g, id, r.x + 26, y + 11, 32); text(g, C.t('drink_' + id), r.x + 68, y + 20, 15, PAL.ink, 'left', 700);
          text(g, unlocked ? `${C.RECIPES[id].price} ${C.t('coins')}` : `${C.t('reputation')} ${C.RECIPES[id].rep}`, r.x + 68, y + 39, 12, PAL.inkSoft, 'left', 500);
          let ix = r.x + r.w - 40; const needs = C.RECIPES[id].needs;
          for (const it in needs) { ix -= 30; icon(g, it, ix, y + 15, 24); if (needs[it] > 1) text(g, 'x' + needs[it], ix + 24, y + 40, 10, PAL.ink, 'right', 700); }
          g.globalAlpha = 1;
        });
        m.maxScroll = Math.max(0, ids.length * rowH - listH);
      }
      g.restore();
      m.scrollArea = { x: r.x, y: listY, w: r.w, h: listH };
    },
    roaster(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(480, 420); panel(g, r.x, r.y, r.w, r.h, C.t('roaster_title'), UI.close);
      const ro = ST.roast;
      if (!ro) {
        const n = Math.min(EC.count('green'), ST.roastCap());
        text(g, C.t('roaster_choose'), r.x + r.w / 2, r.y + 74, 17, PAL.ink, 'center', 700);
        text(g, C.t('roaster_batch', { n }), r.x + r.w / 2, r.y + 100, 14, PAL.inkSoft, 'center', 500);
        icon(g, 'green', r.x + r.w / 2 - 24, r.y + 118, 48);
        const bw = Math.min(130, (r.w - 80) / 3); const x0 = r.x + (r.w - bw * 3 - 20) / 2;
        ['light', 'medium', 'dark'].forEach((lv, i) => btn(g, 'lv' + lv, x0 + i * (bw + 10), r.y + 190, bw, 64, C.t('roast_' + lv), { icon: 'roast_' + lv, size: 14, fn: () => { ST.startRoast(lv); C.audio.sfx('blip'); } }));
        text(g, C.t('roaster_hold'), r.x + r.w / 2, r.y + 290, 13, PAL.inkSoft, 'center', 500);
        return;
      }
      // drum
      const cx = r.x + r.w / 2, cy = r.y + 150;
      g.fillStyle = '#4a4a50'; rr(g, cx - 70, cy + 40, 140, 16, 6); g.fill();
      g.fillStyle = '#6a6a70'; g.beginPath(); g.ellipse(cx, cy, 70, 46, 0, 0, 7); g.fill();
      g.fillStyle = '#8a8a90'; g.beginPath(); g.ellipse(cx, cy, 54, 32, 0, 0, 7); g.fill();
      // beans inside
      const bc = ST.roastColor(ro.t); const rnd = C.rng(12);
      for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 0.9; const bx = cx + Math.cos(a) * 46 * d + (ro.holding ? Math.sin(m.t * 20 + i) * 2 : 0), by = cy + Math.sin(a) * 24 * d + (ro.holding ? Math.cos(m.t * 17 + i) * 2 : 0); g.fillStyle = bc; g.beginPath(); g.ellipse(bx, by, 5, 3.5, a, 0, 7); g.fill(); }
      // flame
      if (ro.holding && !ro.done) { for (let i = 0; i < 5; i++) { const fx = cx - 30 + i * 15, fh = 10 + Math.sin(m.t * 30 + i * 2) * 5; g.fillStyle = i % 2 ? '#ffb040' : '#ff7030'; g.beginPath(); g.moveTo(fx - 5, cy + 58); g.lineTo(fx, cy + 58 - fh); g.lineTo(fx + 5, cy + 58); g.fill(); } }
      // bar
      const bx = r.x + 40, bw = r.w - 80, by = r.y + 240, bh = 26;
      const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
      [[0, '#9fbf6a'], [0.25, '#c9b06a'], [0.4, '#b98a4a'], [0.58, '#8a5a30'], [0.78, '#4a2e1e'], [0.9, '#2a1a10'], [1, '#111']].forEach(([t, c]) => grad.addColorStop(t, c));
      rr(g, bx, by, bw, bh, 8); g.fillStyle = grad; g.fill();
      const [wa, wb] = ST.ROAST_WINDOWS[ro.level];
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx + wa * bw, by - 6, (wb - wa) * bw, bh + 12);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(bx + wa * bw, by - 6, (wb - wa) * bw, bh + 12);
      // needle
      const nx = bx + ro.t * bw; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(nx - 8, by - 14); g.lineTo(nx + 8, by - 14); g.lineTo(nx, by - 2); g.fill();
      g.fillStyle = PAL.ink; g.fillRect(nx - 1, by - 2, 2, bh + 4);
      text(g, C.t('roast_' + ro.level), r.x + r.w / 2, r.y + 62, 16, PAL.ink, 'center', 800);
      if (!ro.done) text(g, ro.holding ? C.t('roaster_release') : C.t('roaster_hold'), r.x + r.w / 2, by + 60, 16, ro.holding ? PAL.accent : PAL.inkSoft, 'center', 800);
      else {
        const res = ro.result; const key = res.grade === 'perfect' ? 'roast_perfect' : res.grade === 'good' ? 'roast_good' : res.grade === 'burnt' ? 'roast_burnt' : 'roast_under';
        text(g, C.t(key, { n: res.n }), r.x + r.w / 2, by + 60, 16, res.grade === 'perfect' ? PAL.green : res.grade === 'burnt' ? PAL.accent : PAL.ink, 'center', 800);
        btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, C.t('ok'), { fn: () => { ST.roast = null; if (EC.count('green') <= 0) UI.close(); else C.audio.sfx('blip'); } });
      }
    },
    fishing(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      const r = modalRect(420, 340); panel(g, r.x, r.y, r.w, r.h, C.t('pond'), UI.close);
      const f = ST.fish; if (!f) return;
      // water
      rr(g, r.x + 20, r.y + 56, r.w - 40, 180, 14); g.fillStyle = '#3d7fb0'; g.fill();
      for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); const yy = r.y + 80 + i * 26 + Math.sin(m.t * 2 + i) * 3; g.moveTo(r.x + 40, yy); g.bezierCurveTo(r.x + 90, yy - 6, r.x + 140, yy + 6, r.x + r.w - 40, yy); g.stroke(); }
      const bx = r.x + r.w / 2, dip = f.state === 'bite' ? 14 : Math.sin(m.t * 3) * 3;
      g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx + 60, r.y + 40); g.lineTo(bx, r.y + 140 + dip); g.stroke();
      g.fillStyle = '#e04a3a'; g.beginPath(); g.arc(bx, r.y + 140 + dip, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, r.y + 136 + dip, 5, 0, 7); g.fill();
      if (f.state === 'bite') { for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${0.6 - i * 0.2})`; g.beginPath(); g.arc(bx, r.y + 150, 14 + i * 10 + (m.t * 40 % 10), 0, 7); g.stroke(); } }
      const label = f.state === 'wait' ? C.t('fish_wait') : f.state === 'bite' ? C.t('fish_now') : f.result === 'caught' ? C.t('fish_caught') : C.t('fish_missed');
      text(g, label, r.x + r.w / 2, r.y + 270, f.state === 'bite' ? 26 : 17, f.state === 'bite' ? PAL.accent : PAL.ink, 'center', 800);
      if (f.state === 'done') { if (f.result === 'caught') icon(g, 'fish', r.x + r.w / 2 - 20, r.y + 288, 40); if (!m.doneT) m.doneT = m.t; if (m.t - m.doneT > 1.4) UI.close(); }
      else hit(r.x, r.y + 50, r.w, r.h - 50, () => { const res = ST.tapFishing(); if (res === 'caught') UI.toast(C.t('fish_caught'), 'fish'); else if (res === 'missed') C.audio.sfx('error'); }, 'fishtap');
    },
  };

  // scroll for lists via drag
  let scrollDrag = null;
  UI.modalDown = function (x, y) { const m = UI.modal; if (m && m.scrollArea) { const a = m.scrollArea; if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) scrollDrag = { y, s: m.data.scroll || 0 }; } };
  UI.modalMove = function (x, y) { const m = UI.modal; if (scrollDrag && m) { m.data.scroll = clamp(scrollDrag.s + (scrollDrag.y - y), 0, m.maxScroll || 0); } };
  UI.modalUp = function () { scrollDrag = null; };

  // ---- main draw ---------------------------------------------------------------------------
  UI.resize = function (w, h) { cssW = w; cssH = h; narrow = w < 560; };
  UI.update = function (dt) { if (pressedT > 0) pressedT -= dt; if (UI.modal) { UI.modal.t += dt; if (UI.modal.type === 'roaster') ST.updateRoast(dt); if (UI.modal.type === 'fishing') ST.updateFishing(dt); } };
  UI.draw = function (g, dt) {
    hits = [];
    g.imageSmoothingEnabled = false;
    if (C.game.mode === 'play') {
      drawBubbles(g);
      drawHUD(g);
      drawHotbar(g);
      drawToasts(g, dt);
      drawHint(g, dt);
    }
    if (UI.modal) {
      const m = UI.modal;
      // block world taps behind modal
      hits.unshift({ x: 0, y: 0, w: cssW, h: cssH, fn: () => { if (m.type !== 'title' && m.type !== 'summary' && m.type !== 'letter' && m.type !== 'roaster' && m.type !== 'fishing' && m.type !== 'confirm') UI.close(); }, id: 'backdrop' });
      const fn = MODALS[m.type]; if (fn) fn(g, m);
      // gestures for modal
      m.onDown = (x, y) => { UI.modalDown(x, y); if (m.type === 'roaster' && ST.roast && !ST.roast.done) { ST.roast.holding = true; } };
      m.onUp = (x, y) => { UI.modalUp(); if (m.type === 'roaster' && ST.roast && !ST.roast.done && ST.roast.holding) { ST.roast.holding = false; if (ST.roast.t > 0.03) { ST.releaseRoast(); C.audio.sfx(ST.roast.result.grade === 'perfect' ? 'unlock' : ST.roast.result.grade === 'burnt' ? 'error' : 'harvest'); } } };
      if (m.type === 'title' || m.type === 'summary' || m.type === 'letter' || m.type === 'confirm' || m.type === 'roaster' || m.type === 'fishing') { /* backdrop taps ignored */ }
    }
  };
  UI.onMove = function (x, y) { if (UI.modal) UI.modalMove(x, y); };
  UI.__hits = () => hits; // for automated tests
})();
