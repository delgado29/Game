/* Leña — 40_ui.js
   Immediate-mode touch UI: HUD over the scene, tabbed upgrade panel, toasts,
   floating numbers and modal dialogs. Re-registers hit rectangles every frame. */
(function () {
  'use strict';
  const L = window.Lena;
  const { clamp } = L.math;
  const A = L.art, G = L.game;
  const UI = (L.ui = {});
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';
  const PAL = { panel: '#1f2b26', row: '#2a3a33', rowHi: '#33463d', ink: '#f4ead8', soft: '#a8b8a8', amber: '#e8a030', amberD: '#b87a20', green: '#6ad06a', red: '#e05a4a', coin: '#ffd866', hud: 'rgba(16,24,20,0.72)', dim: 'rgba(8,12,10,0.6)', tabOn: '#3a5046' };
  UI.PAL = PAL;
  UI.safe = { t: 0, r: 0, b: 0, l: 0 };
  UI.layout = { scene: { x: 0, y: 0, w: 100, h: 100 }, panel: { x: 0, y: 100, w: 100, h: 100 }, landscape: false };
  UI.modal = null; UI.toasts = []; UI.floats = []; UI.tab = 'chop'; UI.scroll = {}; UI.hintText = null;
  let hits = [], pressed = null, pressedT = 0, cssW = 0, cssH = 0;

  // ---- helpers -----------------------------------------------------------------------------
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function text(g, s, x, y, size, color, align, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y); }
  function textW(g, s, size, weight) { g.font = `${weight || 600} ${size}px ${FONT}`; return g.measureText(s).width; }
  function icon(g, name, x, y, size) { g.imageSmoothingEnabled = false; g.drawImage(A.icon(name), x, y, size, size); }
  function wrap(g, s, maxW, size, weight) { g.font = `${weight || 500} ${size}px ${FONT}`; const out = []; for (const para of String(s).split('\n')) { let line = ''; for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } out.push(line); } return out; }
  function hit(x, y, w, h, fn, id) { hits.push({ x, y, w, h, fn, id: id || fn }); }
  UI.rr = rr; UI.text = text; UI.icon = icon; UI.hit = hit;

  function btn(g, id, x, y, w, h, label, o) {
    o = o || {};
    const dis = !!o.disabled, isP = pressed === id && pressedT > 0;
    const bg = dis ? '#3a4a42' : o.kind === 'green' ? PAL.green : o.kind === 'ghost' ? 'rgba(255,255,255,0.08)' : PAL.amber;
    const fg = dis ? '#7a8a82' : o.kind === 'ghost' ? PAL.ink : '#1f1a10';
    g.save(); if (isP) g.translate(0, 1);
    rr(g, x, y + 2, w, h, 12); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
    rr(g, x, y, w, h, 12); g.fillStyle = bg; g.fill();
    if (!dis && o.kind !== 'ghost') { rr(g, x + 1, y + 1, w - 2, h / 2, 10); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill(); }
    let tx = x + w / 2, lw = label ? textW(g, label, o.size || 15, 800) : 0;
    if (o.icon) { const sz = Math.min(24, h - 12); const total = sz + 6 + lw; const ix = x + (w - total) / 2; icon(g, o.icon, ix, y + (h - sz) / 2, sz); tx = ix + sz + 6 + lw / 2; }
    if (label) text(g, label, tx, y + h / 2 + (o.sub ? -6 : 0), o.size || 15, fg, 'center', 800);
    if (o.sub) text(g, o.sub, x + w / 2, y + h / 2 + 10, 10, dis ? '#7a8a82' : 'rgba(0,0,0,0.6)', 'center', 700);
    g.restore();
    if (!dis) hit(x, y, w, h, o.fn, id);
  }
  UI.btn = btn;

  UI.toast = (msg, ic) => { UI.toasts.push({ msg, icon: ic, t: 0, life: 2.6 }); if (UI.toasts.length > 3) UI.toasts.shift(); };
  UI.float = (x, y, s, color, size) => { UI.floats.push({ x, y, s, color, size: size || 16, t: 0, vx: (Math.random() - 0.5) * 30 }); if (UI.floats.length > 40) UI.floats.shift(); };
  UI.open = (type, data) => { UI.modal = { type, data: data || {}, t: 0 }; };
  UI.close = () => { UI.modal = null; L.audio.sfx('back'); };

  // ---- layout ------------------------------------------------------------------------------
  UI.resize = function (w, h) {
    cssW = w; cssH = h;
    const s = UI.safe, landscape = w > h * 1.15;
    if (landscape) { const sw = Math.round(w * 0.62); UI.layout = { landscape, scene: { x: 0, y: 0, w: sw, h }, panel: { x: sw, y: 0, w: w - sw, h } }; }
    else { const sh = Math.round(h * 0.5); UI.layout = { landscape, scene: { x: 0, y: 0, w, h: sh }, panel: { x: 0, y: sh, w, h: h - sh } }; }
  };

  // ---- input ------------------------------------------------------------------------------------
  let down = null, scrollDrag = null;
  UI.bindInput = function (canvas) {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); L.audio.init();
      const [x, y] = pos(e); down = { x, y, t: L.now(), id: e.pointerId, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const h = hitAt(x, y); pressed = h ? h.id : null; pressedT = 0.25;
      if (!h && !UI.modal) {
        const sc = UI.layout.scene;
        if (x >= sc.x && x < sc.x + sc.w && y >= sc.y && y < sc.y + sc.h) { L.main.chopAt(x, y); down.chop = true; }
        else if (UI.listArea && y >= UI.listArea.y && y <= UI.listArea.y + UI.listArea.h && x >= UI.listArea.x) scrollDrag = { y, s: UI.scroll[UI.tab] || 0 };
      } else if (UI.modal && UI.modal.scrollArea) { const a = UI.modal.scrollArea; if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) scrollDrag = { y, s: UI.modal.data.scroll || 0, modal: true }; }
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault(); if (!down) return; const [x, y] = pos(e);
      if (Math.hypot(x - down.x, y - down.y) > 10) down.moved = true;
      if (scrollDrag) { const v = clamp(scrollDrag.s + (scrollDrag.y - y), 0, (scrollDrag.modal ? (UI.modal && UI.modal.maxScroll) : UI.maxScroll) || 0); if (scrollDrag.modal && UI.modal) UI.modal.data.scroll = v; else UI.scroll[UI.tab] = v; }
    }, { passive: false });
    const up = (e) => {
      e.preventDefault(); if (!down) return; const [x, y] = pos(e); const d = down; down = null; scrollDrag = null;
      if (!d.moved && !d.chop && L.now() - d.t < 800) { const h = hitAt(x, y); if (h && h.fn) h.fn(x, y); else if (UI.modal && UI.modal.dismiss) UI.close(); }
      pressed = null;
    };
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', () => { down = null; pressed = null; scrollDrag = null; }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  function hitAt(x, y) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }

  // ---- HUD over the scene -----------------------------------------------------------------------
  function drawHUD(g) {
    const S = L.state, sc = UI.layout.scene, s = UI.safe, top = sc.y + s.t + 8, left = sc.x + s.l + 10;
    // tree label + hp bar (top centre)
    const T = S.tree, sp = G.speciesFor(T.n);
    const lw = Math.min(320, sc.w - 130), lx = sc.x + (sc.w - lw) / 2, ly = top;
    rr(g, lx, ly, lw, 34, 12); g.fillStyle = PAL.hud; g.fill();
    text(g, `${L.t('sp_' + sp.id)}  ·  ${L.t('tree_n', { n: T.n + 1 })}`, lx + 12, ly + 11, 12, PAL.ink, 'left', 700);
    const frac = T.state === 'up' ? clamp(T.hp / T.maxHp, 0, 1) : T.state === 'grow' ? clamp(T.t / G.d.regrow, 0, 1) : 0;
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, lx + 10, ly + 23, lw - 20, 6, 3); g.fill();
    g.fillStyle = T.state === 'up' ? (frac > 0.5 ? PAL.green : frac > 0.2 ? PAL.amber : PAL.red) : '#8ac0ff'; rr(g, lx + 10, ly + 23, (lw - 20) * frac, 6, 3); g.fill();
    if (T.state === 'up') text(g, `${L.fmt(T.hp)} / ${L.fmt(T.maxHp)}`, lx + lw - 12, ly + 11, 10, PAL.soft, 'right', 600);
    // stock chips (top left)
    let cy = top; const chip = (ic, str, col) => { const w = textW(g, str, 14, 700) + 40; rr(g, left, cy, w, 28, 10); g.fillStyle = PAL.hud; g.fill(); icon(g, ic, left + 7, cy + 5, 18); text(g, str, left + 30, cy + 14, 14, col || PAL.ink, 'left', 700); cy += 32; };
    chip('log', L.fmt(Math.floor(S.logs)));
    if (S.up.mill) chip('plank', L.fmt(Math.floor(S.planks)));
    if (S.acorns) chip('acorn', `${S.acorns}  ·  +${Math.round(S.acorns * 10)}%`, '#e8c080');
    if (G.d.crew > 0) chip('worker', `${S.up.hire}  ·  ${L.fmt(G.d.crew)}${L.t('per_s')}`, PAL.soft);
    // settings (top right)
    const rx = sc.x + sc.w - s.r - 10 - 40;
    rr(g, rx, top, 40, 40, 12); g.fillStyle = PAL.hud; g.fill(); icon(g, 'settings', rx + 8, top + 8, 24); hit(rx - 4, top - 4, 48, 48, () => { L.audio.sfx('tap'); UI.open('settings'); }, 'settings');
  }
  // wallet strip at the top of the panel: coins + sell button
  function drawWallet(g, px, py, pw) {
    const S = L.state, coinStr = L.fmt(S.coins);
    icon(g, 'coin', px + 14, py + 10, 30); text(g, coinStr, px + 52, py + 25, 26, PAL.coin, 'left', 900);
    const val = G.stockValue(), has = val > 0;
    const bw = Math.min(190, pw * 0.48), bh = 50, bx = px + pw - 12 - bw, by = py;
    btn(g, 'sell', bx, by, bw, bh, has ? L.fmt(val) : L.t('nothing'), { icon: has ? 'coin' : null, size: 17, disabled: !has, kind: 'green', sub: L.t('sell'), fn: () => L.main.sellTap(bx + bw / 2, by + bh / 2) });
    return py + bh + 8;
  }

  // ---- panel ---------------------------------------------------------------------------------------
  const TABS = [['chop', 'axe'], ['crew', 'worker'], ['trade', 'scale'], ['forest', 'forest'], ['stats', 'stats']];
  function effectText(id) {
    const S = L.state, d = G.d, lv = S.up[id];
    switch (id) {
      case 'axe': return `${L.fmt(d.axe)}${L.t('per_tap')}`;
      case 'sharpen': return `${Math.round(d.crit * 100)}% ×4`;
      case 'hire': return lv ? `${L.fmt(d.crewEach)}${L.t('per_s')} ${L.t('each')}` : '';
      case 'training': return `×${L.fmt(Math.pow(1.5, lv))}`;
      case 'coffee': return `×${L.fmt(Math.pow(1.15, lv))}`;
      case 'growth': return `${d.regrow.toFixed(1)}s`;
      case 'market': return `×${L.fmt(Math.pow(1.25, lv))}`;
      case 'merchant': return lv ? `${d.merchant.toFixed(0)}s` : '';
      case 'mill': return lv ? `${L.fmt(d.mill)}${L.t('per_s')}` : '';
      default: return '';
    }
  }
  function descText(id) {
    const d = G.d, lv = L.state.up[id];
    if (id === 'merchant') return L.t('up_merchant_d', { s: lv ? (20 * Math.pow(0.85, lv)).toFixed(0) : 20 });
    if (id === 'mill') return L.t('up_mill_d', { r: L.fmt(Math.pow(1.6, Math.max(0, lv))) });
    return L.t('up_' + id + '_d');
  }
  function drawRow(g, x, y, w, id) {
    const S = L.state, u = L.UPG[id], lv = S.up[id], maxed = lv >= u.max;
    const n = G.buyCount(id), cost = G.costN(id, n), can = !maxed && S.coins >= cost && n > 0;
    rr(g, x, y, w, 64, 14); g.fillStyle = can ? PAL.rowHi : PAL.row; g.fill();
    icon(g, u.icon, x + 12, y + 12, 40);
    const name = L.t('up_' + id), lvStr = id === 'hire' ? `×${lv}` : `${L.t('lv')} ${lv}`;
    text(g, name, x + 62, y + 18, 15, PAL.ink, 'left', 800);
    const nw = textW(g, name, 15, 800); text(g, lvStr, x + 66 + nw, y + 19, 11, PAL.soft, 'left', 700);
    const eff = effectText(id), ex = x + 62 + nw + 8 + textW(g, lvStr, 11, 700) + 8; if (eff && ex + textW(g, eff, 11, 700) < x + w - 124) text(g, eff, ex, y + 19, 11, PAL.amber, 'left', 700);
    const dl = wrap(g, descText(id), w - 62 - 130, 11, 500); text(g, dl[0], x + 62, y + 40, 11, PAL.soft, 'left', 500); if (dl[1]) text(g, dl[1], x + 62, y + 52, 11, PAL.soft, 'left', 500);
    if (maxed) { rr(g, x + w - 112, y + 16, 100, 32, 10); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); text(g, L.t('max'), x + w - 62, y + 32, 13, PAL.soft, 'center', 800); }
    else btn(g, 'buy' + id, x + w - 118, y + 10, 106, 44, L.fmt(cost), { icon: 'coin', size: 14, disabled: !can, sub: n > 1 ? `+${n}` : null, fn: () => { if (G.buy(id, n)) L.audio.sfx(id === 'hire' ? 'hire' : 'buy'); else L.audio.sfx('error'); } });
  }
  function drawPanel(g, dt) {
    const S = L.state, p = UI.layout.panel, s = UI.safe, land = UI.layout.landscape;
    g.fillStyle = PAL.panel; g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(p.x, p.y, land ? 2 : p.w, land ? p.h : 2);
    const px = p.x + (land ? 0 : s.l), pw = p.w - (land ? s.r : s.l + s.r), py = p.y + (land ? s.t : 0);
    // wallet + tabs
    const ty = drawWallet(g, px, py + 6, pw);
    const tw = pw / TABS.length;
    TABS.forEach(([id, ic], i) => {
      const x = px + i * tw, on = UI.tab === id;
      if (on) { rr(g, x + 4, ty, tw - 8, 50, 12); g.fillStyle = PAL.tabOn; g.fill(); }
      icon(g, ic, x + tw / 2 - 11, ty + 6, 22); text(g, L.t('tab_' + id), x + tw / 2, ty + 40, 10, on ? PAL.ink : PAL.soft, 'center', 700);
      hit(x, ty, tw, 50, () => { UI.tab = id; L.audio.sfx('tap'); }, 'tab' + id);
    });
    // buy mode
    let ly = ty + 60;
    if (UI.tab !== 'stats' && UI.tab !== 'forest') {
      const modes = [[1, '×1'], [10, '×10'], ['max', 'MAX']]; const mw = 62;
      const mx = px + pw - 12 - modes.length * mw;
      text(g, L.t('buy'), mx - 10, ly + 14, 12, PAL.soft, 'right', 700);
      modes.forEach(([m, lab], i) => { const x = mx + i * mw, on = S.buyMode === m; rr(g, x, ly, mw - 4, 28, 9); g.fillStyle = on ? PAL.amber : 'rgba(255,255,255,0.08)'; g.fill(); text(g, lab, x + (mw - 4) / 2, ly + 14, 12, on ? '#1f1a10' : PAL.ink, 'center', 800); hit(x, ly, mw - 4, 28, () => { S.buyMode = m; L.audio.sfx('tap'); }, 'mode' + m); });
      ly += 36;
    }
    // list
    const listY = ly, listH = p.y + p.h - listY - (land ? s.b : s.b) - 6;
    UI.listArea = { x: px, y: listY, w: pw, h: listH };
    g.save(); g.beginPath(); g.rect(px, listY, pw, listH); g.clip();
    const scroll = UI.scroll[UI.tab] || 0; let y = listY - scroll + 4; const rx = px + 10, rw = pw - 20;
    if (L.TABS[UI.tab] && UI.tab !== 'forest') { for (const id of L.TABS[UI.tab]) { drawRow(g, rx, y, rw, id); y += 72; } }
    else if (UI.tab === 'forest') y = drawForest(g, rx, y, rw);
    else y = drawStats(g, rx, y, rw);
    g.restore();
    UI.maxScroll = Math.max(0, y + scroll - listY - listH + 8);
    if (UI.maxScroll > 0) { const th = Math.max(24, listH * listH / (listH + UI.maxScroll)); g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, px + pw - 6, listY + (listH - th) * (scroll / UI.maxScroll), 3, th, 2); g.fill(); }
  }
  function drawForest(g, x, y, w) {
    const S = L.state, T = S.tree, sp = G.speciesFor(T.n), next = G.nextSpecies(T.n);
    rr(g, x, y, w, 96, 14); g.fillStyle = PAL.row; g.fill();
    g.imageSmoothingEnabled = false; const tcv = A.tree(sp.id, 1); const sc = Math.min(1.2, 72 / tcv.height); g.drawImage(tcv, x + 12 + (60 - tcv.width * sc) / 2, y + 12 + 72 - tcv.height * sc, tcv.width * sc, tcv.height * sc);
    text(g, L.t('sp_' + sp.id), x + 84, y + 20, 16, PAL.ink, 'left', 800);
    text(g, `${L.t('tree_n', { n: T.n + 1 })}  ·  HP ${L.fmt(T.maxHp)}`, x + 84, y + 42, 12, PAL.soft, 'left', 600);
    text(g, L.t('log_worth', { v: L.fmt(sp.value * G.d.sell) }), x + 84, y + 60, 12, PAL.soft, 'left', 600);
    text(g, next ? L.t('next_species', { name: L.t('sp_' + next.id), n: next.at + 1 }) : L.t('last_species'), x + 84, y + 80, 12, PAL.amber, 'left', 700);
    y += 104;
    drawRow(g, x, y, w, 'growth'); y += 72;
    // prestige card
    const gain = G.prestigeGain(), prog = clamp(S.earnedRun / L.PRESTIGE_MIN, 0, 1);
    const dl = wrap(g, L.t('prestige_d'), w - 24, 12, 500); const ch = 96 + dl.length * 15;
    rr(g, x, y, w, ch, 14); g.fillStyle = '#2e3a2a'; g.fill();
    icon(g, 'acorn', x + 12, y + 12, 28); text(g, L.t('prestige'), x + 48, y + 26, 16, PAL.ink, 'left', 800);
    text(g, `${S.acorns} ${L.t('acorns')}  ·  ${L.t('forests')}: ${S.forests}`, x + 48, y + 46, 12, '#e8c080', 'left', 700);
    dl.forEach((l, i) => text(g, l, x + 12, y + 68 + i * 15, 12, PAL.soft, 'left', 500));
    const by = y + 68 + dl.length * 15 + 4;
    if (gain > 0) btn(g, 'prestige', x + 12, by, w - 24, 40, L.t('prestige_gain', { n: gain }), { icon: 'acorn', size: 14, fn: () => UI.open('confirm', { text: L.t('prestige_confirm'), yes: () => { G.prestige(); } }) });
    else { g.fillStyle = 'rgba(255,255,255,0.1)'; rr(g, x + 12, by + 14, w - 24, 8, 4); g.fill(); g.fillStyle = PAL.amber; rr(g, x + 12, by + 14, (w - 24) * prog, 8, 4); g.fill(); text(g, L.t('prestige_need', { n: L.fmt(L.PRESTIGE_MIN), p: (prog * 100).toFixed(1) }), x + w / 2, by + 32, 11, PAL.soft, 'center', 600); }
    return y + ch + 8;
  }
  function drawStats(g, x, y, w) {
    const S = L.state, d = G.d;
    const rows = [['st_felled', L.fmt(S.lifetimeFelled)], ['st_taps', L.fmt(S.taps)], ['st_earned', L.fmt(S.earnedRun)], ['st_lifetime', L.fmt(S.lifetimeEarned)], ['st_crew', `${S.up.hire}  ·  ${L.fmt(d.crew)}${L.t('per_s')}`], ['st_best', L.t('sp_' + L.SPECIES[S.bestSpecies].id)], ['forests', `${S.forests}  ·  ${S.acorns} ${L.t('acorns')}`], ['st_time', L.fmtTime(S.playTime)]];
    rr(g, x, y, w, rows.length * 26 + 16, 14); g.fillStyle = PAL.row; g.fill();
    rows.forEach(([k, v], i) => { text(g, L.t(k), x + 14, y + 20 + i * 26, 13, PAL.soft, 'left', 600); text(g, v, x + w - 14, y + 20 + i * 26, 13, PAL.ink, 'right', 800); });
    y += rows.length * 26 + 26;
    text(g, `${L.t('st_ach')}  ${d.achCount}/${L.ACH.length}`, x + 4, y + 8, 14, PAL.ink, 'left', 800); text(g, L.t('ach_bonus'), x + 4, y + 26, 11, PAL.soft, 'left', 500); y += 40;
    const cols = Math.max(2, Math.floor(w / 150)), cw = w / cols;
    L.ACH.forEach(([id], i) => { const cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * 40, on = !!S.ach[id]; rr(g, cx, cy, cw - 6, 34, 10); g.fillStyle = on ? '#3a4a2a' : PAL.row; g.fill(); icon(g, on ? 'trophy' : 'lock', cx + 8, cy + 8, 18); text(g, L.t('a_' + id), cx + 32, cy + 17, 11, on ? PAL.ink : PAL.soft, 'left', on ? 700 : 500); });
    return y + Math.ceil(L.ACH.length / cols) * 40 + 8;
  }

  // ---- overlays -------------------------------------------------------------------------------------
  function drawToasts(g, dt) {
    const sc = UI.layout.scene; let y = sc.y + UI.safe.t + 50 + (UI.hintText && !UI.modal ? UI.hintH || 0 : 0);
    for (const t of UI.toasts) { t.t += dt; const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.5 ? Math.max(0, (t.life - t.t) / 0.5) : 1; const w = textW(g, t.msg, 14, 700) + (t.icon ? 52 : 24); g.globalAlpha = a; const x = sc.x + (sc.w - w) / 2; rr(g, x, y, w, 34, 12); g.fillStyle = PAL.hud; g.fill(); if (t.icon) icon(g, t.icon, x + 10, y + 6, 22); text(g, t.msg, x + (t.icon ? 40 : 12), y + 17, 14, PAL.ink, 'left', 700); g.globalAlpha = 1; y += 40; }
    UI.toasts = UI.toasts.filter((t) => t.t < t.life);
  }
  function drawFloats(g, dt) {
    for (const f of UI.floats) { f.t += dt; const a = 1 - f.t / 0.9; g.globalAlpha = Math.max(0, a); text(g, f.s, f.x + f.vx * f.t, f.y - f.t * 60, f.size, f.color, 'center', 900); }
    g.globalAlpha = 1; UI.floats = UI.floats.filter((f) => f.t < 0.9);
  }
  function drawHint(g) {
    if (!UI.hintText || UI.modal) return;
    const sc = UI.layout.scene, lines = wrap(g, UI.hintText, Math.min(sc.w - 60, 420), 13, 600), w = Math.min(sc.w - 40, 440), h = lines.length * 17 + 16;
    const x = sc.x + (sc.w - w) / 2, y = sc.y + UI.safe.t + 50; UI.hintH = h + 6;
    rr(g, x, y, w, h, 12); g.fillStyle = 'rgba(244,234,216,0.94)'; g.fill(); icon(g, 'star', x + 8, y + h / 2 - 10, 20);
    lines.forEach((l, i) => text(g, l, x + 32, y + 13 + i * 17, 13, '#2b2118', 'left', 600));
    hit(x, y, w, h, () => { UI.hintText = null; }, 'hint');
  }

  function modalRect(pw, ph) { const w = Math.min(pw, cssW - 24), h = Math.min(ph, cssH - UI.safe.t - UI.safe.b - 24); return { x: (cssW - w) / 2, y: UI.safe.t + (cssH - UI.safe.t - UI.safe.b - h) / 2, w, h }; }
  function panel(g, r, title, onClose) {
    rr(g, r.x, r.y + 4, r.w, r.h, 18); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fill();
    rr(g, r.x, r.y, r.w, r.h, 18); g.fillStyle = '#26332d'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#4a5e54'; rr(g, r.x, r.y, r.w, r.h, 18); g.stroke();
    if (title) text(g, title, r.x + 20, r.y + 28, 20, PAL.ink, 'left', 800);
    if (onClose) { const bx = r.x + r.w - 46, by = r.y + 12; rr(g, bx, by, 34, 34, 10); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); icon(g, 'x', bx + 5, by + 5, 24); hit(bx - 6, by - 6, 46, 46, onClose, 'close'); }
  }
  const MODALS = {
    settings(g, m) {
      const r = modalRect(400, 360); panel(g, r, L.t('settings'), UI.close); const st = G.settings; let y = r.y + 66;
      const row = (label, val, id, fn) => { text(g, label, r.x + 22, y + 20, 16, PAL.ink, 'left', 700); btn(g, id, r.x + r.w - 150, y, 128, 40, val, { kind: 'ghost', size: 14, fn }); y += 54; };
      row(L.t('language'), L.lang === 'es' ? 'Español' : 'English', 'lang', () => { st.lang = L.lang === 'es' ? 'en' : 'es'; L.setLang(st.lang); G.saveSettings(); if (UI.hintText) UI.hintText = L.t('hint_first'); L.audio.sfx('tap'); });
      row(L.t('music'), st.music ? L.t('on') : L.t('off'), 'music', () => { st.music = !st.music; L.audio.setMusic(st.music); G.saveSettings(); L.audio.sfx('tap'); });
      row(L.t('sound'), st.sound ? L.t('on') : L.t('off'), 'sound', () => { st.sound = !st.sound; L.audio.setSound(st.sound); G.saveSettings(); L.audio.sfx('tap'); });
      y += 8; btn(g, 'reset', r.x + 22, y, r.w - 44, 42, L.t('reset'), { kind: 'ghost', size: 14, fn: () => UI.open('confirm', { text: L.t('reset_confirm'), yes: () => L.main.resetAll() }) }); y += 56;
      text(g, 'Leña v1.0 · pixels & WebAudio, no assets', r.x + r.w / 2, y + 6, 11, PAL.soft, 'center', 500);
    },
    confirm(g, m) {
      const r = modalRect(380, 200); panel(g, r, null);
      const lines = wrap(g, m.data.text, r.w - 40, 16, 600); lines.forEach((l, i) => text(g, l, r.x + r.w / 2, r.y + 36 + i * 21, 16, PAL.ink, 'center', 600));
      const bw = (r.w - 60) / 2;
      btn(g, 'yes', r.x + 20, r.y + r.h - 66, bw, 48, L.t('yes'), { fn: () => { const f = m.data.yes; UI.modal = null; f && f(); } });
      btn(g, 'no', r.x + 40 + bw, r.y + r.h - 66, bw, 48, L.t('no'), { kind: 'ghost', fn: UI.close });
    },
    offline(g, m) {
      const d = m.data, r = modalRect(420, 300); panel(g, r, L.t('offline_title'));
      icon(g, 'zzz', r.x + r.w - 56, r.y + 14, 36);
      let y = r.y + 72; const lines = wrap(g, L.t('offline_body', { time: L.fmtTime(d.seconds), trees: L.fmt(d.trees) }), r.w - 44, 15, 600); lines.forEach((l) => { text(g, l, r.x + 22, y, 15, PAL.ink, 'left', 600); y += 22; });
      if (d.coins > 0) { icon(g, 'coin', r.x + 22, y - 2, 22); text(g, L.t('offline_sold', { coins: L.fmt(d.coins) }), r.x + 50, y + 9, 15, PAL.coin, 'left', 800); y += 30; }
      else if (d.pile > 0) { icon(g, 'log', r.x + 22, y - 2, 22); text(g, L.t('offline_pile'), r.x + 50, y + 9, 14, PAL.amber, 'left', 700); y += 30; }
      btn(g, 'ok', r.x + r.w / 2 - 70, r.y + r.h - 64, 140, 46, L.t('ok'), { fn: () => { UI.modal = null; L.audio.sfx('coin'); } });
    },
  };

  UI.update = (dt) => { if (pressedT > 0) pressedT -= dt; if (UI.modal) UI.modal.t += dt; };
  UI.draw = function (g, dt) {
    hits = []; g.imageSmoothingEnabled = false;
    drawPanel(g, dt);
    drawHUD(g);
    drawFloats(g, dt);
    drawToasts(g, dt);
    drawHint(g);
    if (UI.modal) {
      g.fillStyle = PAL.dim; g.fillRect(0, 0, cssW, cssH);
      hits.unshift({ x: 0, y: 0, w: cssW, h: cssH, fn: () => { if (UI.modal && UI.modal.type === 'settings') UI.close(); }, id: 'backdrop' });
      const fn = MODALS[UI.modal.type]; if (fn) fn(g, UI.modal);
    }
  };
  UI.__hits = () => hits;
})();
