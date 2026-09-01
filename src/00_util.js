/* Cafetal — 00_util.js
   Shared namespace, math helpers, seeded RNG, colour helpers, easing. */
(function () {
  'use strict';
  const C = (window.Cafetal = window.Cafetal || {});

  // ---- constants ---------------------------------------------------------
  C.TILE = 16;                 // world pixels per tile
  C.MAP_W = 48;                // tiles
  C.MAP_H = 36;
  C.DAY_SECONDS = 360;         // real seconds per in-game day (6:00 -> 24:00)
  C.DAY_START_HOUR = 6;
  C.DAY_END_HOUR = 24;
  C.SEASON_DAYS = 7;
  C.SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  C.SAVE_KEY = 'cafetal.save.v1';
  C.SETTINGS_KEY = 'cafetal.settings.v1';

  // ---- math ---------------------------------------------------------------
  const M = (C.math = {});
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smooth = (t) => t * t * (3 - 2 * t);
  M.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  M.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  M.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  M.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  M.wrap = (v, n) => ((v % n) + n) % n;
  M.round = (v, n) => Math.round(v / n) * n;
  M.fract = (v) => v - Math.floor(v);

  // ---- seeded RNG (mulberry32) -------------------------------------------
  C.rng = function (seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const r = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (n) => Math.floor(r() * n);
    r.range = (a, b) => a + r() * (b - a);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = r.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return r;
  };
  C.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed | 0) * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // 2D value noise for gentle terrain variation
  C.noise2 = function (x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = C.hash2(xi, yi, seed), b = C.hash2(xi + 1, yi, seed);
    const c = C.hash2(xi, yi + 1, seed), d = C.hash2(xi + 1, yi + 1, seed);
    const u = M.smooth(xf), v = M.smooth(yf);
    return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
  };

  // ---- colours ------------------------------------------------------------
  const Col = (C.color = {});
  Col.hex = (r, g, b) => '#' + [r, g, b].map((v) => M.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  Col.parse = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  Col.mix = (a, b, t) => { const A = Col.parse(a), B = Col.parse(b); return Col.hex(M.lerp(A[0], B[0], t), M.lerp(A[1], B[1], t), M.lerp(A[2], B[2], t)); };
  Col.shade = (h, k) => { const [r, g, b] = Col.parse(h); return Col.hex(r * k, g * k, b * k); };
  Col.lighten = (h, k) => Col.mix(h, '#ffffff', k);
  Col.rgba = (h, a) => { const [r, g, b] = Col.parse(h); return `rgba(${r},${g},${b},${a})`; };
  Col.hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

  // ---- misc ---------------------------------------------------------------
  C.pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  C.now = () => (window.performance ? performance.now() : Date.now());
  C.canvas = function (w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  C.ctx2d = function (cv) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
  C.uid = (() => { let n = 1; return () => n++; })();
  C.deepClone = (o) => JSON.parse(JSON.stringify(o));
  C.formatTime = function (hour) { // hour is fractional 0..24
    let h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    m = Math.floor(m / 10) * 10;
    const ampm = h >= 12 && h < 24 ? 'pm' : 'am';
    let hh = h % 12; if (hh === 0) hh = 12;
    return `${hh}:${C.pad2(m)} ${ampm}`;
  };

  // event bus
  const listeners = {};
  C.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  C.emit = (ev, data) => { const l = listeners[ev]; if (l) for (const fn of l) fn(data); };
})();
