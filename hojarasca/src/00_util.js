/* Hojarasca — 00_util.js  Namespace, math, RNG, colours, strings EN/ES, events. */
(function () {
  'use strict';
  const H = (window.Hojarasca = window.Hojarasca || {});
  H.TILE = 16; H.MAP_W = 64; H.MAP_H = 58;
  H.SAVE_KEY = 'hojarasca.save.v1'; H.SETTINGS_KEY = 'hojarasca.settings.v1';
  const M = (H.math = {});
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  M.angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  H.rng = function (seed) { let a = (seed >>> 0) || 0x9e3779b9; const r = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; r.int = (n) => Math.floor(r() * n); r.range = (a, b) => a + r() * (b - a); r.pick = (arr) => arr[Math.floor(r() * arr.length)]; r.chance = (p) => r() < p; r.gauss = () => (r() + r() + r() - 1.5) * 2; return r; };
  H.hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s | 0) * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const Col = (H.color = {});
  Col.parse = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  Col.hex = (r, g, b) => '#' + [r, g, b].map((v) => M.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  Col.mix = (a, b, t) => { const A = Col.parse(a), B = Col.parse(b); return Col.hex(M.lerp(A[0], B[0], t), M.lerp(A[1], B[1], t), M.lerp(A[2], B[2], t)); };
  Col.shade = (h, k) => { const [r, g, b] = Col.parse(h); return Col.hex(r * k, g * k, b * k); };
  Col.lighten = (h, k) => Col.mix(h, '#ffffff', k);
  Col.rgba = (h, a) => { const [r, g, b] = Col.parse(h); return `rgba(${r},${g},${b},${a})`; };
  H.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  H.ctx2d = (cv) => { const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
  H.now = () => (window.performance ? performance.now() : Date.now());
  H.fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 10000 ? (n / 1000).toFixed(1) + 'K' : String(Math.floor(n)));
  H.fmtTime = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };
  const listeners = {};
  H.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  H.emit = (ev, d) => { const l = listeners[ev]; if (l) for (const fn of l) fn(d); };

  const S = {
    en: {
      title: 'Hojarasca', tagline: 'leave no leaf behind', tap_start: 'Tap to start', continue_game: 'Continue', new_game: 'New game', new_confirm: 'Start over? The whole property will be covered in leaves again.',
      coins: 'coins', bag: 'Bag', bag_full: 'Bag full! Dump it in the bin.', dumped: '+{n} coins', leaves: 'leaves', clean: 'clean',
      z_front: 'Front yard', z_drive: 'Driveway', z_back: 'Backyard', z_pool: 'Pool deck', z_green: 'Greenhouse', z_cellar: 'Cellar',
      tool_hand: 'Hands', tool_rake: 'Rake', tool_blower: 'Blower',
      shop: 'Shop', tab_tools: 'Tools', tab_body: 'Gear', tab_yard: 'Yard', buy: 'Buy', owned: 'Owned', max: 'MAX', lv: 'Lv', not_enough: 'Not enough coins', locked: 'Locked',
      up_bag: 'Bigger bag', up_bag_d: 'Holds {n} leaves', up_rake: 'Rake', up_rake_d: 'Drags a {w}-tile wide swath of leaves', up_rake_buy: 'Pull heaps of leaves along with you',
      up_blower: 'Leaf blower', up_blower_d: 'Power {p} · reach {r} tiles', up_blower_buy: 'Push whole heaps into bins and vents', up_shoes: 'Running shoes', up_shoes_d: 'Walk speed {s}', up_gloves: 'Grabby gloves', up_gloves_d: 'Pick up {n} leaves/s within reach',
      vent: 'Vent', vent_d: 'Sucks in nearby leaves and sells them for you', bin: 'Trash bin', bin_d: 'A second bin so you dump closer', gate: 'Gate', gate_d: 'Opens the way to the {zone}',
      gate_q: 'Open the gate to the {zone} for {n} coins?', gate_locked_cellar: 'The cellar hatch is stuck. Clean every zone to at least 95% first.', yes: 'Yes', no: 'No', ok: 'Okay', close: 'Close',
      zone_done: '{zone} spotless!', bonus_front: 'Leaves now sell for 25% more', bonus_drive: 'You walk 15% faster', bonus_back: 'Blower power up 30%', bonus_pool: 'Vents reach 50% further', bonus_green: 'Bag capacity doubled', bonus_cellar: 'You found the secret room',
      ending_title: 'The secret room', ending_body: 'Under the house, behind the vent, someone left a warm room with a kettle, a chair and a single golden leaf on the table. The property is clean. The season is over. Sit a while.',
      st_leaves: 'Leaves collected', st_coins: 'Coins earned', st_time: 'Time', st_dumps: 'Trips to the bin', st_blown: 'Leaves blown', golden: 'Golden leaf',
      settings: 'Settings', language: 'Language', music: 'Music', sound: 'Sound', on: 'On', off: 'Off',
      hint_move: 'Left thumb: walk. Walk over leaves to pick them up.', hint_dump: 'Your bag fills up. Dump it in the trash bin by the porch.', hint_shop: 'Tap the bin to open the shop. A rake is a good start.', hint_rake: 'Right thumb: aim and hold to rake. Drag heaps to the bin.', hint_blower: 'Right thumb: aim and hold to blow. Push leaves into the bin or a vent.', hint_gate: 'Gates open new zones. Walk into one to see the price.',
      wind: 'A gust of wind!', achievements: 'Achievements', percent_total: 'Property',
    },
    es: {
      title: 'Hojarasca', tagline: 'ni una hoja atrás', tap_start: 'Toca para empezar', continue_game: 'Continuar', new_game: 'Nueva partida', new_confirm: '¿Empezar de nuevo? Toda la finca volverá a llenarse de hojas.',
      coins: 'monedas', bag: 'Bolsa', bag_full: '¡Bolsa llena! Vacíala en el basurero.', dumped: '+{n} monedas', leaves: 'hojas', clean: 'limpio',
      z_front: 'Jardín delantero', z_drive: 'Entrada', z_back: 'Patio trasero', z_pool: 'Piscina', z_green: 'Invernadero', z_cellar: 'Sótano',
      tool_hand: 'Manos', tool_rake: 'Rastrillo', tool_blower: 'Soplador',
      shop: 'Tienda', tab_tools: 'Herramientas', tab_body: 'Equipo', tab_yard: 'Finca', buy: 'Comprar', owned: 'Tuyo', max: 'MÁX', lv: 'Nv', not_enough: 'No alcanza', locked: 'Bloqueado',
      up_bag: 'Bolsa más grande', up_bag_d: 'Guarda {n} hojas', up_rake: 'Rastrillo', up_rake_d: 'Arrastra una franja de {w} casillas de hojas', up_rake_buy: 'Arrastra montones de hojas contigo',
      up_blower: 'Soplador', up_blower_d: 'Potencia {p} · alcance {r} casillas', up_blower_buy: 'Empuja montones enteros a basureros y rejillas', up_shoes: 'Zapatillas', up_shoes_d: 'Velocidad {s}', up_gloves: 'Guantes ágiles', up_gloves_d: 'Recoge {n} hojas/s a tu alcance',
      vent: 'Rejilla', vent_d: 'Aspira las hojas cercanas y las vende por ti', bin: 'Basurero', bin_d: 'Un segundo basurero para vaciar más cerca', gate: 'Portón', gate_d: 'Abre el paso a {zone}',
      gate_q: '¿Abrir el portón a {zone} por {n} monedas?', gate_locked_cellar: 'La trampilla del sótano está atascada. Limpia cada zona al menos al 95% primero.', yes: 'Sí', no: 'No', ok: 'Vale', close: 'Cerrar',
      zone_done: '¡{zone} impecable!', bonus_front: 'Las hojas se venden 25% más caras', bonus_drive: 'Caminas 15% más rápido', bonus_back: 'Soplador 30% más potente', bonus_pool: 'Las rejillas alcanzan 50% más', bonus_green: 'Capacidad de la bolsa duplicada', bonus_cellar: 'Encontraste el cuarto secreto',
      ending_title: 'El cuarto secreto', ending_body: 'Bajo la casa, detrás de la rejilla, alguien dejó un cuarto cálido con una tetera, una silla y una sola hoja dorada sobre la mesa. La finca está limpia. La temporada terminó. Quédate un rato.',
      st_leaves: 'Hojas recogidas', st_coins: 'Monedas ganadas', st_time: 'Tiempo', st_dumps: 'Viajes al basurero', st_blown: 'Hojas sopladas', golden: 'Hoja dorada',
      settings: 'Ajustes', language: 'Idioma', music: 'Música', sound: 'Sonido', on: 'Sí', off: 'No',
      hint_move: 'Pulgar izquierdo: caminar. Pasa sobre las hojas para recogerlas.', hint_dump: 'La bolsa se llena. Vacíala en el basurero junto al porche.', hint_shop: 'Toca el basurero para abrir la tienda. Un rastrillo es un buen comienzo.', hint_rake: 'Pulgar derecho: apunta y mantén para rastrillar. Arrastra montones al basurero.', hint_blower: 'Pulgar derecho: apunta y mantén para soplar. Empuja hojas al basurero o a una rejilla.', hint_gate: 'Los portones abren zonas nuevas. Acércate a uno para ver el precio.',
      wind: '¡Una ráfaga de viento!', achievements: 'Logros', percent_total: 'Finca',
    },
  };
  H.lang = 'en'; H.setLang = (l) => { H.lang = S[l] ? l : 'en'; };
  H.t = (key, vars) => { let s = (S[H.lang] && S[H.lang][key]) || S.en[key] || key; if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); return s; };
})();
