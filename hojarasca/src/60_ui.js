/* Hojarasca — 60_ui.js  Twin-stick touch input, HUD, tool tabs, shop, modals, toasts. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const { clamp } = H.math;
  const A = H.art, W = H.world, G = H.game, LV = H.leaves;
  const UI = (H.ui = {});
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';
  const PAL = { panel: '#f6ecd8', panelD: '#e6d6b8', ink: '#3a2a1e', soft: '#7a6a5a', accent: '#c85a2a', green: '#5a9a4a', hud: 'rgba(30,22,16,0.72)', hudInk: '#f6ecd8', dim: 'rgba(12,10,8,0.55)', coin: '#ffe08a' };
  UI.PAL = PAL; UI.safe = { t: 0, r: 0, b: 0, l: 0 }; UI.modal = null; UI.toasts = []; UI.hintText = null;
  UI.left = null; UI.right = null; UI.STICK_R = 46;
  let hits = [], pressed = null, pressedT = 0, cssW = 0, cssH = 0;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function text(g, s, x, y, size, color, align, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y); }
  function textW(g, s, size, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; return g.measureText(s).width; }
  function icon(g, name, x, y, size) { g.imageSmoothingEnabled = false; g.drawImage(A.icon(name), x, y, size, size); }
  function wrap(g, s, maxW, size, weight) { g.font = `${weight || 500} ${size}px ${FONT}`; const out = []; for (const para of String(s).split('\n')) { let line = ''; for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } out.push(line); } return out; }
  function hit(x, y, w, h, fn, id) { hits.push({ x, y, w, h, fn, id: id || fn }); }
  UI.rr = rr; UI.text = text; UI.icon = icon; UI.hit = hit;
  function btn(g, id, x, y, w, h, label, o) {
    o = o || {}; const dis = !!o.disabled, isP = pressed === id && pressedT > 0;
    const bg = dis ? '#c8bca8' : o.kind === 'secondary' ? PAL.panelD : o.kind === 'green' ? PAL.green : PAL.accent, fg = dis ? '#8a8078' : o.kind === 'secondary' ? PAL.ink : '#fff8ec';
    g.save(); if (isP) g.translate(0, 1);
    rr(g, x, y + 2, w, h, 12); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill(); rr(g, x, y, w, h, 12); g.fillStyle = bg; g.fill();
    if (!dis) { rr(g, x + 1, y + 1, w - 2, h / 2, 10); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); }
    let tx = x + w / 2; const lw = label ? textW(g, label, o.size || 15, 800) : 0;
    if (o.icon) { const sz = Math.min(24, h - 12), total = sz + 6 + lw, ix = x + (w - total) / 2; icon(g, o.icon, ix, y + (h - sz) / 2, sz); tx = ix + sz + 6 + lw / 2; }
    if (label) text(g, label, tx, y + h / 2, o.size || 15, fg, 'center', 800);
    g.restore(); if (!dis) hit(x, y, w, h, o.fn, id);
  }
  UI.btn = btn;
  function panel(g, r, title, onClose) { rr(g, r.x, r.y + 4, r.w, r.h, 18); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); rr(g, r.x, r.y, r.w, r.h, 18); g.fillStyle = PAL.panel; g.fill(); g.lineWidth = 3; g.strokeStyle = '#a06a3a'; rr(g, r.x, r.y, r.w, r.h, 18); g.stroke(); if (title) text(g, title, r.x + 20, r.y + 28, 22, PAL.ink, 'left', 800); if (onClose) { const bx = r.x + r.w - 46, by = r.y + 12; rr(g, bx, by, 34, 34, 10); g.fillStyle = PAL.panelD; g.fill(); icon(g, 'x', bx + 5, by + 5, 24); hit(bx - 6, by - 6, 46, 46, onClose, 'close'); } }
  function modalRect(pw, ph) { const w = Math.min(pw, cssW - 24), h = Math.min(ph, cssH - UI.safe.t - UI.safe.b - 24); return { x: (cssW - w) / 2, y: UI.safe.t + (cssH - UI.safe.t - UI.safe.b - h) / 2, w, h }; }
  UI.toast = (msg, ic) => { UI.toasts.push({ msg, icon: ic, t: 0, life: 2.6 }); if (UI.toasts.length > 3) UI.toasts.shift(); };
  UI.hint = (msg) => { UI.hintText = msg; UI.hintT = 0; };
  UI.open = (type, data) => { UI.modal = { type, data: data || {}, t: 0 }; UI.left = null; UI.right = null; };
  UI.close = () => { UI.modal = null; H.audio.sfx('back'); };
  UI.resize = (w, h) => { cssW = w; cssH = h; };

  // ---- input ---------------------------------------------------------------------------------------
  const pointers = new Map();
  UI.bindInput = function (canvas) {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); H.audio.init(); const [x, y] = pos(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const h = hitAt(x, y);
      if (h) { pointers.set(e.pointerId, { kind: 'ui', hit: h, x, y }); pressed = h.id; pressedT = 0.25; return; }
      if (UI.modal) { pointers.set(e.pointerId, { kind: 'modal', x, y, sx: x, sy: y, s0: UI.modal.data.scroll || 0 }); return; }
      const side = x < cssW / 2 ? 'left' : 'right';
      if (UI[side]) return;
      const st = { id: e.pointerId, ox: x, oy: y, x, y, dx: 0, dy: 0, mag: 0, t: H.now(), moved: false, side };
      UI[side] = st; pointers.set(e.pointerId, { kind: 'stick', st });
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault(); const p = pointers.get(e.pointerId); if (!p) return; const [x, y] = pos(e);
      if (p.kind === 'stick') { const st = p.st; st.x = x; st.y = y; let dx = x - st.ox, dy = y - st.oy; const d = Math.hypot(dx, dy); if (d > 12) st.moved = true; if (d > UI.STICK_R) { dx *= UI.STICK_R / d; dy *= UI.STICK_R / d; } st.dx = dx / UI.STICK_R; st.dy = dy / UI.STICK_R; st.mag = Math.min(1, d / UI.STICK_R); }
      else if (p.kind === 'modal' && UI.modal && UI.modal.maxScroll) UI.modal.data.scroll = clamp(p.s0 + (p.sy - y), 0, UI.modal.maxScroll);
    }, { passive: false });
    const up = (e) => {
      e.preventDefault(); const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId); const [x, y] = pos(e);
      if (p.kind === 'ui') { const h = hitAt(x, y); if (h && h.id === p.hit.id && h.fn) h.fn(x, y); pressed = null; return; }
      if (p.kind === 'modal') { if (Math.hypot(x - p.sx, y - p.sy) < 10 && UI.modal && UI.modal.dismiss) UI.close(); return; }
      const st = p.st; if (UI[st.side] === st) UI[st.side] = null;
      if (!st.moved && H.now() - st.t < 260) H.main.interact(st.side);
    };
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', (e) => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (p && p.kind === 'stick' && UI[p.st.side] === p.st) UI[p.st.side] = null; pressed = null; }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard (desktop testing): WASD / arrows move, space = use tool, E = interact
    const keys = {}; let kbStick = null;
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'e' || e.key === 'Enter') H.main.interact('right'); syncKb(); });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; syncKb(); });
    function syncKb() { const dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0); if (dx || dy) { if (!kbStick) { kbStick = { id: 'kb', ox: 0, oy: 0, x: 0, y: 0, dx, dy, mag: 1, t: 0, moved: true, side: 'left', kb: true }; UI.left = kbStick; } kbStick.dx = dx; kbStick.dy = dy; kbStick.mag = 1; } else if (kbStick) { if (UI.left === kbStick) UI.left = null; kbStick = null; } if (keys[' ']) { if (!UI.right) UI.right = { id: 'kbr', ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 1, t: 0, moved: true, side: 'right', kb: true }; } else if (UI.right && UI.right.kb) UI.right = null; }
  };
  function hitAt(x, y) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }

  // ---- HUD --------------------------------------------------------------------------------------------
  function drawHUD(g) {
    const S = H.state, s = UI.safe, top = s.t + 8, left = s.l + 10, d = G.d;
    const coinStr = H.fmt(S.coins), cw = textW(g, coinStr, 22, 900) + 52;
    rr(g, left, top, cw, 40, 12); g.fillStyle = PAL.hud; g.fill(); icon(g, 'coin', left + 8, top + 8, 24); text(g, coinStr, left + 40, top + 20, 22, PAL.coin, 'left', 900);
    // bag
    const bw = Math.max(cw, 150), by = top + 46; rr(g, left, by, bw, 32, 10); g.fillStyle = PAL.hud; g.fill(); icon(g, 'bag', left + 8, by + 6, 20);
    text(g, `${S.bag} / ${d.bagCap}`, left + 34, by + 11, 12, S.bag >= d.bagCap ? '#ff9a6a' : PAL.hudInk, 'left', 700);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, left + 34, by + 21, bw - 44, 5, 2); g.fill(); g.fillStyle = S.bag >= d.bagCap ? '#ff9a6a' : '#d8b040'; rr(g, left + 34, by + 21, (bw - 44) * clamp(S.bag / d.bagCap, 0, 1), 5, 2); g.fill();
    // zone label (top centre)
    const p = H.main.player, zi = p.cellar ? W.zoneIdx('cellar') : W.zoneAt((p.x / 16) | 0, (p.y / 16) | 0);
    const z = zi >= 0 ? W.ZONES[zi] : null;
    const zname = z ? H.t('z_' + z.id) : '', prog = z ? G.zoneProgress(z.id) : 0;
    const total = G.totalProgress();
    const lw = 220, lx = (cssW - lw) / 2; rr(g, lx, top, lw, 44, 12); g.fillStyle = PAL.hud; g.fill();
    text(g, z ? `${zname}  ·  ${Math.floor(prog * 100)}%` : '', lx + lw / 2, top + 13, 13, PAL.hudInk, 'center', 800);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, lx + 12, top + 25, lw - 24, 5, 2); g.fill(); g.fillStyle = '#6ad06a'; rr(g, lx + 12, top + 25, (lw - 24) * prog, 5, 2); g.fill();
    text(g, `${H.t('percent_total')} ${(total * 100).toFixed(1)}%`, lx + lw / 2, top + 36, 9, '#d0c0a8', 'center', 600);
    // settings
    const gx = cssW - s.r - 10 - 40; rr(g, gx, top, 40, 40, 12); g.fillStyle = PAL.hud; g.fill(); icon(g, 'settings', gx + 8, top + 8, 24); hit(gx - 4, top - 4, 48, 48, () => { H.audio.sfx('tap'); UI.open('settings'); }, 'settings');
    // tool tabs (bottom centre)
    const tools = [['hand', true], ['rake', S.up.rake > 0], ['blower', S.up.blower > 0]]; const size = 52, gap = 8, tw = tools.length * size + (tools.length - 1) * gap, tx0 = (cssW - tw) / 2, ty = cssH - s.b - size - 12;
    rr(g, tx0 - 8, ty - 6, tw + 16, size + 12, 16); g.fillStyle = PAL.hud; g.fill();
    tools.forEach(([id, owned], i) => { const x = tx0 + i * (size + gap), sel = S.tool === id; rr(g, x, ty, size, size, 12); g.fillStyle = sel ? 'rgba(255,220,150,0.95)' : 'rgba(255,255,255,0.12)'; g.fill(); g.globalAlpha = owned ? 1 : 0.3; icon(g, id, x + 10, ty + 10, 32); g.globalAlpha = 1; if (!owned) icon(g, 'lock', x + 34, ty + 34, 14); if (owned) hit(x, ty, size, size, () => { S.tool = id; H.audio.sfx('tap'); if (id === 'rake' && !S.flags.hintRake) { S.flags.hintRake = 1; UI.hint(H.t('hint_rake')); } if (id === 'blower' && !S.flags.hintBlower) { S.flags.hintBlower = 1; UI.hint(H.t('hint_blower')); } }, 'tool' + id); });
  }
  function drawSticks(g) {
    for (const st of [UI.left, UI.right]) { if (!st || st.kb) continue; g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(st.ox, st.oy, UI.STICK_R + 8, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke(); g.fillStyle = st.side === 'right' ? 'rgba(255,200,120,0.85)' : 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(st.ox + st.dx * UI.STICK_R, st.oy + st.dy * UI.STICK_R, 22, 0, 7); g.fill(); }
  }
  function drawToasts(g, dt) { let y = UI.safe.t + 60; for (const t of UI.toasts) { t.t += dt; const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.5 ? Math.max(0, (t.life - t.t) / 0.5) : 1; const w = textW(g, t.msg, 14, 700) + (t.icon ? 52 : 24); g.globalAlpha = a; const x = (cssW - w) / 2; rr(g, x, y, w, 34, 12); g.fillStyle = PAL.hud; g.fill(); if (t.icon) icon(g, t.icon, x + 10, y + 6, 22); text(g, t.msg, x + (t.icon ? 40 : 12), y + 17, 14, PAL.hudInk, 'left', 700); g.globalAlpha = 1; y += 40; } UI.toasts = UI.toasts.filter((t) => t.t < t.life); }
  function drawHint(g, dt) { if (!UI.hintText || UI.modal) return; UI.hintT = (UI.hintT || 0) + dt; const lines = wrap(g, UI.hintText, Math.min(cssW - 80, 440), 13, 600), w = Math.min(cssW - 60, 460), h = lines.length * 17 + 16, x = (cssW - w) / 2, y = cssH - UI.safe.b - 90 - h; g.globalAlpha = Math.min(1, UI.hintT / 0.3); rr(g, x, y, w, h, 12); g.fillStyle = 'rgba(246,236,216,0.94)'; g.fill(); icon(g, 'star', x + 8, y + h / 2 - 10, 20); lines.forEach((l, i) => text(g, l, x + 32, y + 13 + i * 17, 13, PAL.ink, 'left', 600)); g.globalAlpha = 1; hit(x, y, w, h, () => { UI.hintText = null; }, 'hint'); }

  // ---- modals ------------------------------------------------------------------------------------------
  function row(g, x, y, w, ic, name, desc, right) { rr(g, x, y, w, 60, 12); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill(); icon(g, ic, x + 12, y + 10, 40); text(g, name, x + 62, y + 20, 15, PAL.ink, 'left', 800); const dl = wrap(g, desc, w - 62 - 130, 11, 500); text(g, dl[0] || '', x + 62, y + 40, 11, PAL.soft, 'left', 500); if (right) right(x + w - 122, y + 10); }
  const MODALS = {
    title(g, m) {
      g.fillStyle = 'rgba(10,8,6,0.45)'; g.fillRect(0, 0, cssW, cssH); const cy = cssH * 0.36;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 12; text(g, H.t('title'), cssW / 2, cy - 30, Math.min(78, cssW / 7), '#f6ecd8', 'center', 900); g.restore();
      text(g, H.t('tagline'), cssW / 2, cy + 26, 20, '#e8d8b8', 'center', 500); icon(g, 'leaf', cssW / 2 - 24, cy + 50, 48);
      const bw = Math.min(280, cssW - 60), bx = (cssW - bw) / 2; let by = cy + 120;
      if (G.hasSave()) { btn(g, 'cont', bx, by, bw, 54, H.t('continue_game'), { size: 20, fn: () => { H.audio.sfx('buy'); H.main.continueGame(); } }); by += 66; }
      btn(g, 'new', bx, by, bw, 54, H.t('new_game'), { size: 20, kind: G.hasSave() ? 'secondary' : 'primary', fn: () => { if (G.hasSave()) UI.open('confirm', { text: H.t('new_confirm'), yes: () => H.main.newGame() }); else H.main.newGame(); } }); by += 66;
      btn(g, 'lang', (cssW - 150) / 2, by, 150, 40, H.lang === 'es' ? 'Español ▸ English' : 'English ▸ Español', { kind: 'secondary', size: 14, fn: () => { H.main.toggleLang(); } });
      text(g, 'v1.0 · pixels & WebAudio, no assets', cssW / 2, cssH - UI.safe.b - 18, 12, 'rgba(246,236,216,0.7)', 'center', 500);
    },
    confirm(g, m) { g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH); const r = modalRect(400, 200); panel(g, r, null); const lines = wrap(g, m.data.text, r.w - 40, 16, 600); lines.forEach((l, i) => text(g, l, r.x + r.w / 2, r.y + 36 + i * 21, 16, PAL.ink, 'center', 600)); const bw = (r.w - 60) / 2; btn(g, 'yes', r.x + 20, r.y + r.h - 66, bw, 48, H.t('yes'), { fn: () => { const f = m.data.yes; UI.modal = null; f && f(); } }); btn(g, 'no', r.x + 40 + bw, r.y + r.h - 66, bw, 48, H.t('no'), { kind: 'secondary', fn: UI.close }); },
    gate(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH); const gt = W.GATES.find((x) => x.id === m.data.id), c = G.canOpenGate(gt.id); const r = modalRect(400, 220); panel(g, r, null); icon(g, 'gate', r.x + r.w / 2 - 20, r.y + 16, 40);
      const txt = c.reason === 'cellar' ? H.t('gate_locked_cellar') : H.t('gate_q', { zone: H.t('z_' + gt.zone), n: gt.cost });
      wrap(g, txt, r.w - 40, 15, 600).forEach((l, i) => text(g, l, r.x + r.w / 2, r.y + 76 + i * 20, 15, PAL.ink, 'center', 600));
      const bw = (r.w - 60) / 2;
      if (c.reason === 'cellar') btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, H.t('ok'), { fn: UI.close });
      else { btn(g, 'yes', r.x + 20, r.y + r.h - 66, bw, 48, `${gt.cost}`, { icon: 'coin', disabled: !c.ok, fn: () => { if (G.openGate(gt.id)) { UI.modal = null; } } }); btn(g, 'no', r.x + 40 + bw, r.y + r.h - 66, bw, 48, H.t('no'), { kind: 'secondary', fn: UI.close }); }
    },
    settings(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH); const r = modalRect(400, 340); panel(g, r, H.t('settings'), UI.close); const st = G.settings; let y = r.y + 66;
      const rowb = (label, val, id, fn) => { text(g, label, r.x + 22, y + 20, 16, PAL.ink, 'left', 700); btn(g, id, r.x + r.w - 150, y, 128, 40, val, { kind: 'secondary', size: 14, fn }); y += 54; };
      rowb(H.t('language'), H.lang === 'es' ? 'Español' : 'English', 'lang', () => H.main.toggleLang());
      rowb(H.t('music'), st.music ? H.t('on') : H.t('off'), 'music', () => { st.music = !st.music; H.audio.setMusic(st.music); G.saveSettings(); H.audio.sfx('tap'); });
      rowb(H.t('sound'), st.sound ? H.t('on') : H.t('off'), 'sound', () => { st.sound = !st.sound; H.audio.setSound(st.sound); G.saveSettings(); H.audio.sfx('tap'); });
      y += 6; btn(g, 'newgame', r.x + 22, y, r.w - 44, 42, H.t('new_game'), { kind: 'secondary', fn: () => UI.open('confirm', { text: H.t('new_confirm'), yes: () => H.main.newGame() }) }); y += 54;
      const S = H.state; text(g, `${H.t('st_leaves')}: ${S.stats.leaves}  ·  ${H.t('st_time')}: ${H.fmtTime(S.stats.time)}`, r.x + r.w / 2, y + 6, 11, PAL.soft, 'center', 500);
    },
    shop(g, m) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH); const S = H.state; const r = modalRect(560, 520); panel(g, r, H.t('shop'), UI.close);
      icon(g, 'coin', r.x + r.w - 150, r.y + 16, 24); text(g, H.fmt(S.coins), r.x + r.w - 120, r.y + 28, 18, PAL.ink, 'left', 800);
      const tabs = [['tools', H.t('tab_tools')], ['body', H.t('tab_body')], ['yard', H.t('tab_yard')]]; const tab = m.data.tab || 'tools', tw = (r.w - 40) / tabs.length;
      tabs.forEach(([id, label], i) => { const x = r.x + 20 + i * tw, y = r.y + 54; rr(g, x + 2, y, tw - 4, 36, 10); g.fillStyle = tab === id ? PAL.accent : PAL.panelD; g.fill(); text(g, label, x + tw / 2, y + 18, 14, tab === id ? '#fff8ec' : PAL.ink, 'center', 700); hit(x, y, tw, 36, () => { m.data.tab = id; m.data.scroll = 0; H.audio.sfx('tap'); }, 'tab' + id); });
      const listY = r.y + 100, listH = r.h - 112, rx = r.x + 16, rw = r.w - 32; const scroll = m.data.scroll || 0; let y = listY - scroll + 4;
      g.save(); g.beginPath(); g.rect(r.x, listY, r.w, listH); g.clip();
      const buyBtn = (id, cost, can, fn) => (x, yy) => { if (cost === null) { rr(g, x, yy + 4, 110, 32, 10); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fill(); text(g, H.t('max'), x + 55, yy + 20, 13, PAL.soft, 'center', 800); } else btn(g, 'buy' + id, x, yy, 110, 40, `${cost}`, { icon: 'coin', size: 14, disabled: !can, fn }); };
      if (tab === 'tools') {
        const U = H.UPG, u = S.up;
        row(g, rx, y, rw, 'rake', `${H.t('up_rake')}  ${u.rake ? H.t('lv') + ' ' + u.rake : ''}`, u.rake ? H.t('up_rake_d', { w: U.rake.w[Math.min(u.rake + 1, 4)] }) : H.t('up_rake_buy'), buyBtn('rake', G.nextCost('rake'), S.coins >= (G.nextCost('rake') || 0), () => { if (G.buy('rake')) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68;
        row(g, rx, y, rw, 'blower', `${H.t('up_blower')}  ${u.blower ? H.t('lv') + ' ' + u.blower : ''}`, u.blower ? H.t('up_blower_d', { p: U.blower.power[Math.min(u.blower + 1, 5)], r: U.blower.range[Math.min(u.blower + 1, 5)] }) : H.t('up_blower_buy'), buyBtn('blower', G.nextCost('blower'), S.coins >= (G.nextCost('blower') || 0), () => { if (G.buy('blower')) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68;
      } else if (tab === 'body') {
        const U = H.UPG, u = S.up;
        row(g, rx, y, rw, 'bag', `${H.t('up_bag')}  ${H.t('lv')} ${u.bag}`, H.t('up_bag_d', { n: U.bag.caps[Math.min(u.bag + 1, 5)] }), buyBtn('bag', G.nextCost('bag'), S.coins >= (G.nextCost('bag') || 0), () => { if (G.buy('bag')) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68;
        row(g, rx, y, rw, 'shoes', `${H.t('up_shoes')}  ${H.t('lv')} ${u.shoes}`, H.t('up_shoes_d', { s: U.shoes.speed[Math.min(u.shoes + 1, 3)] }), buyBtn('shoes', G.nextCost('shoes'), S.coins >= (G.nextCost('shoes') || 0), () => { if (G.buy('shoes')) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68;
        row(g, rx, y, rw, 'gloves', `${H.t('up_gloves')}  ${H.t('lv')} ${u.gloves}`, H.t('up_gloves_d', { n: U.gloves.rate[Math.min(u.gloves + 1, 2)] }), buyBtn('gloves', G.nextCost('gloves'), S.coins >= (G.nextCost('gloves') || 0), () => { if (G.buy('gloves')) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68;
      } else {
        for (const gt of W.GATES) { const open = S.gates[gt.id]; const c = G.canOpenGate(gt.id); row(g, rx, y, rw, 'gate', `${H.t('gate')} → ${H.t('z_' + gt.zone)}`, open ? H.t('owned') : c.reason === 'cellar' ? H.t('gate_locked_cellar') : H.t('gate_d', { zone: H.t('z_' + gt.zone) }), open ? (x, yy) => icon(g, 'check', x + 40, yy + 8, 28) : buyBtn(gt.id, gt.cost, c.ok, () => { if (G.openGate(gt.id)) H.audio.sfx('gate'); else H.audio.sfx('error'); })); y += 68; }
        for (const b of W.BINS) { if (!b.cost) continue; const own = S.bins[b.id], unl = G.zoneUnlocked(b.zone); row(g, rx, y, rw, 'bin', `${H.t('bin')} · ${H.t('z_' + b.zone)}`, own ? H.t('owned') : unl ? H.t('bin_d') : H.t('locked'), own ? (x, yy) => icon(g, 'check', x + 40, yy + 8, 28) : buyBtn(b.id, b.cost, unl && S.coins >= b.cost, () => { if (G.buyBin(b.id)) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68; }
        for (const v of W.VENTS) { const own = S.vents[v.id], unl = G.zoneUnlocked(v.zone); row(g, rx, y, rw, 'vent', `${H.t('vent')} · ${H.t('z_' + v.zone)}`, own ? H.t('owned') : unl ? H.t('vent_d') : H.t('locked'), own ? (x, yy) => icon(g, 'check', x + 40, yy + 8, 28) : buyBtn(v.id, v.cost, unl && S.coins >= v.cost, () => { if (G.buyVent(v.id)) H.audio.sfx('buy'); else H.audio.sfx('error'); })); y += 68; }
      }
      g.restore(); m.maxScroll = Math.max(0, y + scroll - listY - listH + 8);
    },
    zone(g, m) { g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH); const r = modalRect(420, 240); panel(g, r, null); icon(g, 'trophy', r.x + r.w / 2 - 24, r.y + 18, 48); text(g, H.t('zone_done', { zone: H.t('z_' + m.data.id) }), r.x + r.w / 2, r.y + 90, 20, PAL.ink, 'center', 800); wrap(g, H.t('bonus_' + m.data.id), r.w - 40, 15, 600).forEach((l, i) => text(g, l, r.x + r.w / 2, r.y + 122 + i * 20, 15, PAL.green, 'center', 700)); btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, H.t('ok'), { fn: () => { UI.modal = null; H.audio.sfx('buy'); } }); },
    ending(g, m) {
      g.fillStyle = 'rgba(8,6,4,0.7)'; g.fillRect(0, 0, cssW, cssH); const S = H.state; const r = modalRect(460, 440); panel(g, r, H.t('ending_title')); icon(g, 'golden', r.x + r.w - 56, r.y + 14, 36);
      let y = r.y + 66; wrap(g, H.t('ending_body'), r.w - 44, 15, 500).forEach((l) => { text(g, l, r.x + 22, y, 15, PAL.ink, 'left', 500); y += 21; }); y += 10;
      const rows = [['st_leaves', S.stats.leaves], ['st_coins', H.fmt(S.stats.coins)], ['st_dumps', S.stats.dumps], ['st_blown', S.stats.blown || LV.blownCount], ['st_time', H.fmtTime(S.stats.time)]];
      rows.forEach(([k, v]) => { text(g, H.t(k), r.x + 22, y, 13, PAL.soft, 'left', 600); text(g, String(v), r.x + r.w - 22, y, 14, PAL.ink, 'right', 800); y += 24; });
      btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, H.t('ok'), { fn: () => { UI.modal = null; } });
    },
  };
  UI.update = (dt) => { if (pressedT > 0) pressedT -= dt; if (UI.modal) UI.modal.t += dt; };
  UI.draw = function (g, dt) {
    hits = []; g.imageSmoothingEnabled = false;
    if (H.main.mode === 'play') { drawSticks(g); drawHUD(g); drawToasts(g, dt); drawHint(g, dt); }
    if (UI.modal) { const m = UI.modal; m.dismiss = m.type === 'shop' || m.type === 'settings'; const fn = MODALS[m.type]; if (fn) fn(g, m); }
  };
  UI.__hits = () => hits;
})();
