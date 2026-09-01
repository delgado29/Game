/* Leña — 00_util.js
   Namespace, math, seeded RNG, colours, number formatting, strings (EN/ES), events. */
(function () {
  'use strict';
  const L = (window.Lena = window.Lena || {});
  L.SAVE_KEY = 'lena.save.v1';
  L.SETTINGS_KEY = 'lena.settings.v1';

  const M = (L.math = {});
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  M.easeInCubic = (t) => t * t * t;
  M.easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  M.smooth = (t) => t * t * (3 - 2 * t);

  L.rng = function (seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const r = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (n) => Math.floor(r() * n);
    r.range = (a, b) => a + r() * (b - a);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  };
  L.hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s | 0) * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  const Col = (L.color = {});
  Col.parse = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  Col.hex = (r, g, b) => '#' + [r, g, b].map((v) => M.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  Col.mix = (a, b, t) => { const A = Col.parse(a), B = Col.parse(b); return Col.hex(M.lerp(A[0], B[0], t), M.lerp(A[1], B[1], t), M.lerp(A[2], B[2], t)); };
  Col.shade = (h, k) => { const [r, g, b] = Col.parse(h); return Col.hex(r * k, g * k, b * k); };
  Col.lighten = (h, k) => Col.mix(h, '#ffffff', k);
  Col.rgba = (h, a) => { const [r, g, b] = Col.parse(h); return `rgba(${r},${g},${b},${a})`; };

  L.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  L.ctx2d = (cv) => { const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
  L.now = () => (window.performance ? performance.now() : Date.now());

  // ---- number formatting: 1.23K, 45.6M, 7.89B ... ---------------------------------------
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
  L.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + L.fmt(-n);
    if (n < 1000) return n < 10 && n !== Math.floor(n) ? n.toFixed(1) : String(Math.floor(n));
    let e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return n.toExponential(2).replace('+', '');
    const m = n / Math.pow(1000, e);
    return (m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)) + SUF[e];
  };
  L.fmtTime = function (s) {
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  // ---- events ---------------------------------------------------------------------------
  const listeners = {};
  L.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  L.emit = (ev, d) => { const l = listeners[ev]; if (l) for (const fn of l) fn(d); };

  // ---- strings ----------------------------------------------------------------------------
  const S = {
    en: {
      title: 'Leña', tagline: 'a lumberjack incremental',
      tap_tree: 'Tap the tree to chop it', hint_first: 'Chop the tree, sell the wood, buy a better axe. Then hire help.',
      sell: 'Sell wood', nothing: 'Nothing to sell', coins: 'coins', logs: 'logs', planks: 'planks', acorns: 'acorns',
      tab_chop: 'Chop', tab_crew: 'Crew', tab_trade: 'Trade', tab_forest: 'Forest', tab_stats: 'Stats',
      lv: 'Lv', max: 'MAX', buy: 'Buy', hire: 'Hire', owned: 'owned', each: 'each', per_s: '/s', per_tap: '/tap', crew_dps: 'Crew',
      up_axe: 'Axe', up_axe_d: 'Damage per tap ×2',
      up_sharpen: 'Whetstone', up_sharpen_d: '+4% critical chance (×4 damage)',
      up_hire: 'Lumberjack', up_hire_d: 'Chops on their own, day and night',
      up_training: 'Training', up_training_d: 'Crew damage ×1.5',
      up_coffee: 'Coffee break', up_coffee_d: 'Crew works 15% faster',
      up_growth: 'Fertile soil', up_growth_d: 'Trees regrow 20% faster',
      up_market: 'Market stall', up_market_d: 'Wood sells for 25% more',
      up_merchant: 'Merchant wagon', up_merchant_d: 'Sells your wood automatically every {s}s',
      up_mill: 'Sawmill', up_mill_d: 'Turns {r} logs/s into planks worth 5×',
      sp_pine: 'Pine', sp_birch: 'Birch', sp_oak: 'Oak', sp_maple: 'Maple', sp_redwood: 'Redwood', sp_ancient: 'Ancient oak', sp_ironwood: 'Ironwood', sp_worldtree: 'World tree',
      tree_n: 'Tree #{n}', next_species: 'Next: {name} at tree #{n}', last_species: 'The forest has no bigger tree than this.', log_worth: 'Each log is worth {v} coins',
      prestige: 'Plant a new forest', prestige_d: 'Start over in a fresh forest. Keep your acorns: each one gives +10% damage and income, forever.',
      prestige_gain: 'You would gain {n} acorns', prestige_need: 'Earn {n} coins in this forest first ({p}%)', prestige_confirm: 'Plant a new forest? Coins, upgrades and crew reset. Acorns and achievements stay.',
      forests: 'Forests planted', st_felled: 'Trees felled', st_taps: 'Taps', st_earned: 'Earned this forest', st_lifetime: 'Earned all time', st_crew: 'Crew size', st_time: 'Time played', st_ach: 'Achievements', st_best: 'Best tree',
      offline_title: 'While you were away', offline_body: '{time} passed. Your crew felled {trees} trees.', offline_sold: 'The wagon sold wood for {coins} coins.', offline_pile: 'Wood is piling up, go sell it!',
      settings: 'Settings', language: 'Language', music: 'Music', sound: 'Sound', on: 'On', off: 'Off', reset: 'Reset everything', reset_confirm: 'Erase all progress, acorns included?', yes: 'Yes', no: 'No', ok: 'Okay', close: 'Close',
      crit: 'CRIT', new_species: 'New tree: {name}!', ach_unlocked: 'Achievement: {name}', ach_bonus: 'Each achievement gives +2% to everything.',
      a_first: 'First cut', a_felled10: 'Ten down', a_felled100: 'Clearing', a_felled1000: 'Deforester', a_felled10000: 'Legend of the axe',
      a_taps100: 'Warm hands', a_taps1000: 'Blisters', a_taps10000: 'Iron wrists', a_coins1k: 'Pocket money', a_coins100k: 'Savings', a_coins10m: 'Timber baron', a_coins1b: 'Old money',
      a_crew1: 'Not alone', a_crew10: 'A proper crew', a_crew50: 'Company town', a_mill: 'Sawdust', a_wagon: 'Wheels', a_oak: 'Hardwood', a_redwood: 'Giants', a_worldtree: 'Roots of the world', a_forest1: 'Fresh start', a_forest5: 'Nomad', a_crit: 'Clean split',
    },
    es: {
      title: 'Leña', tagline: 'un incremental de leñador',
      tap_tree: 'Toca el árbol para talarlo', hint_first: 'Tala el árbol, vende la madera, compra un hacha mejor. Luego contrata ayuda.',
      sell: 'Vender madera', nothing: 'Nada que vender', coins: 'monedas', logs: 'troncos', planks: 'tablones', acorns: 'bellotas',
      tab_chop: 'Talar', tab_crew: 'Equipo', tab_trade: 'Comercio', tab_forest: 'Bosque', tab_stats: 'Datos',
      lv: 'Nv', max: 'MÁX', buy: 'Comprar', hire: 'Contratar', owned: 'tienes', each: 'c/u', per_s: '/s', per_tap: '/toque', crew_dps: 'Equipo',
      up_axe: 'Hacha', up_axe_d: 'Daño por toque ×2',
      up_sharpen: 'Piedra de afilar', up_sharpen_d: '+4% de golpe crítico (×4 daño)',
      up_hire: 'Leñador', up_hire_d: 'Tala solo, de día y de noche',
      up_training: 'Entrenamiento', up_training_d: 'Daño del equipo ×1.5',
      up_coffee: 'Pausa para café', up_coffee_d: 'El equipo trabaja 15% más rápido',
      up_growth: 'Tierra fértil', up_growth_d: 'Los árboles crecen 20% más rápido',
      up_market: 'Puesto de mercado', up_market_d: 'La madera se vende 25% más cara',
      up_merchant: 'Carreta mercante', up_merchant_d: 'Vende tu madera sola cada {s}s',
      up_mill: 'Aserradero', up_mill_d: 'Convierte {r} troncos/s en tablones que valen 5×',
      sp_pine: 'Pino', sp_birch: 'Abedul', sp_oak: 'Roble', sp_maple: 'Arce', sp_redwood: 'Secuoya', sp_ancient: 'Roble ancestral', sp_ironwood: 'Palo de hierro', sp_worldtree: 'Árbol del mundo',
      tree_n: 'Árbol #{n}', next_species: 'Siguiente: {name} en el árbol #{n}', last_species: 'No hay árbol más grande en este bosque.', log_worth: 'Cada tronco vale {v} monedas',
      prestige: 'Plantar un nuevo bosque', prestige_d: 'Empieza de cero en un bosque nuevo. Conservas tus bellotas: cada una da +10% de daño e ingresos para siempre.',
      prestige_gain: 'Ganarías {n} bellotas', prestige_need: 'Primero gana {n} monedas en este bosque ({p}%)', prestige_confirm: '¿Plantar un nuevo bosque? Monedas, mejoras y equipo se reinician. Bellotas y logros se conservan.',
      forests: 'Bosques plantados', st_felled: 'Árboles talados', st_taps: 'Toques', st_earned: 'Ganado en este bosque', st_lifetime: 'Ganado en total', st_crew: 'Tamaño del equipo', st_time: 'Tiempo jugado', st_ach: 'Logros', st_best: 'Mejor árbol',
      offline_title: 'Mientras no estabas', offline_body: 'Pasaron {time}. Tu equipo taló {trees} árboles.', offline_sold: 'La carreta vendió madera por {coins} monedas.', offline_pile: '¡La madera se acumula, ve a venderla!',
      settings: 'Ajustes', language: 'Idioma', music: 'Música', sound: 'Sonido', on: 'Sí', off: 'No', reset: 'Borrar todo', reset_confirm: '¿Borrar todo el progreso, bellotas incluidas?', yes: 'Sí', no: 'No', ok: 'Vale', close: 'Cerrar',
      crit: 'CRÍTICO', new_species: '¡Nuevo árbol: {name}!', ach_unlocked: 'Logro: {name}', ach_bonus: 'Cada logro da +2% a todo.',
      a_first: 'Primer corte', a_felled10: 'Diez menos', a_felled100: 'Claro del bosque', a_felled1000: 'Deforestador', a_felled10000: 'Leyenda del hacha',
      a_taps100: 'Manos calientes', a_taps1000: 'Ampollas', a_taps10000: 'Muñecas de hierro', a_coins1k: 'Para el bolsillo', a_coins100k: 'Ahorros', a_coins10m: 'Barón maderero', a_coins1b: 'Dinero viejo',
      a_crew1: 'No estás solo', a_crew10: 'Un equipo de verdad', a_crew50: 'Pueblo maderero', a_mill: 'Aserrín', a_wagon: 'Ruedas', a_oak: 'Madera dura', a_redwood: 'Gigantes', a_worldtree: 'Raíces del mundo', a_forest1: 'Borrón y cuenta nueva', a_forest5: 'Nómada', a_crit: 'Corte limpio',
    },
  };
  L.lang = 'en';
  L.setLang = (l) => { L.lang = S[l] ? l : 'en'; };
  L.t = function (key, vars) {
    let s = (S[L.lang] && S[L.lang][key]) || S.en[key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  };
})();
