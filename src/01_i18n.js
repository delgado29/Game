/* Cafetal — 01_i18n.js
   English / Spanish strings. C.t(key, vars) resolves in the active language. */
(function () {
  'use strict';
  const C = window.Cafetal;

  const S = {
    en: {
      title: 'Cafetal',
      tagline: 'a cozy coffee farm',
      tap_to_start: 'Tap to begin',
      continue_game: 'Continue',
      new_game: 'New game',
      new_game_confirm: 'Start over? Your farm will be erased.',
      yes: 'Yes', no: 'No', ok: 'Okay', close: 'Close', back: 'Back',
      coins: 'coins', day: 'Day', reputation: 'Reputation',
      season_spring: 'Spring', season_summer: 'Summer', season_autumn: 'Autumn', season_winter: 'Winter',
      weather_clear: 'Clear', weather_cloudy: 'Cloudy', weather_rain: 'Rain', weather_snow: 'Snow',
      // tools
      tool_hand: 'Hand', tool_hoe: 'Hoe', tool_water: 'Water', tool_bag: 'Bag',
      // items
      item_coffee_seed: 'Coffee seedling', item_tomato_seed: 'Tomato seeds', item_corn_seed: 'Corn seeds', item_sunflower_seed: 'Sunflower seeds',
      item_cherry: 'Coffee cherries', item_parchment: 'Wet parchment', item_green: 'Green beans',
      item_roast_light: 'Light roast', item_roast_medium: 'Medium roast', item_roast_dark: 'Dark roast',
      item_tomato: 'Tomatoes', item_corn: 'Corn', item_sunflower: 'Sunflowers', item_egg: 'Eggs',
      item_milk: 'Milk', item_panela: 'Panela', item_cinnamon: 'Cinnamon', item_cocoa: 'Cocoa', item_mint: 'Wild mint', item_flower: 'Wildflowers',
      item_fish: 'Trout',
      // drinks
      drink_espresso: 'Espresso', drink_americano: 'Americano', drink_latte: 'Latte', drink_cappuccino: 'Cappuccino',
      drink_cold_brew: 'Cold brew', drink_olla: 'Café de olla', drink_mocha: 'Mocha', drink_mint_tea: 'Mint tea',
      // farming
      hint_tap_move: 'Tap the ground to walk there.',
      hint_hoe: 'Pick the hoe and tap soil near the house to till it.',
      hint_seed: 'Pick a seed and tap tilled soil to plant.',
      hint_water: 'Water your crops each morning. Rain does it for you.',
      hint_coffee_done: 'When coffee cherries turn red (about 6 days), pick them with your hand.',
      hint_pulper: 'Take cherries to the pulper by the shed.',
      hint_patio: 'Spread parchment on the patio to dry. Two sunny days.',
      hint_roaster: 'Roast green beans in the shed. Hold, then release at the right moment.',
      hint_cafe: 'Customers wait at the counter on the road. Serve them!',
      not_farmland: 'This ground is too rocky to till.',
      no_seeds: 'No seeds of that kind.',
      planted: 'Planted {name}.',
      harvested: '+{n} {name}',
      foraged: 'Found {name}!',
      picked_egg: 'The hens left an egg.',
      // stations
      pulper: 'Pulper', patio: 'Drying patio', roaster: 'Roaster', cafe: 'Café counter', house: 'Home', shop: "Rosa's cart", pond: 'Pond', coop: 'Hen house',
      pulper_none: 'No cherries to pulp.', pulper_done: 'Pulped {n} cherries into wet parchment.',
      patio_status: 'Drying: {n} / {max}  ·  {days} sunny day(s) left', patio_empty: 'The patio is empty.',
      patio_loaded: 'Spread {n} parchment to dry.', patio_collect: 'Collected {n} green beans!', patio_rain: 'Rain! Drying is paused today.',
      patio_full: 'The patio is full.',
      roaster_title: 'Roasting', roaster_choose: 'Choose a roast', roaster_none: 'No green beans to roast.',
      roaster_hold: 'HOLD to roast', roaster_release: 'RELEASE in the target', roaster_batch: 'Batch: {n} beans',
      roast_light: 'Light', roast_medium: 'Medium', roast_dark: 'Dark',
      roast_perfect: 'Perfect roast! +{n} beans', roast_good: 'Nice roast. +{n} beans', roast_burnt: 'Burnt... +{n} beans (a few survived)', roast_under: 'Under-roasted... +{n} beans',
      // cafe
      order_wants: 'wants a {drink}', serve: 'Serve', sorry: 'Sorry, not today', missing: 'Need: {list}',
      served: '+{coins} coins', tip: 'tip', recipe: 'Recipe',
      customers_today: 'Customers today', earned: 'Earned', happy: 'Happy customers',
      // shop
      buy: 'Buy', sell: 'Sell', seeds: 'Seeds', pantry: 'Pantry', upgrades: 'Upgrades', owned: 'Owned', not_enough: 'Not enough coins.',
      sell_all: 'Sell all',
      up_sprinkler: 'Sprinkler', up_sprinkler_d: 'Waters the whole field each morning.',
      up_roof: 'Patio roof', up_roof_d: 'Drying continues even when it rains.',
      up_patio2: 'Bigger patio', up_patio2_d: 'Dry 40 parchment at once.',
      up_roaster2: 'Drum roaster', up_roaster2_d: 'Roast 20 beans per batch.',
      up_cat: 'Adopt a cat', up_cat_d: 'A grey cat naps on the porch. Good luck follows.',
      up_lights: 'Fairy lights', up_lights_d: 'Warm lights along the café. Customers linger longer.',
      up_bench: 'Garden bench', up_bench_d: 'A place to sit and watch the rain.',
      up_hens: 'Hens', up_hens_d: 'Three hens roam the yard and leave eggs.',
      up_rod: 'Fishing rod', up_rod_d: 'Tap the pond to fish. Trout sell well.',
      // house / sleep
      sleep_q: 'Go to sleep?', sleep_summary: 'Day {day} · {season}', good_morning: 'Good morning.',
      forecast_rain: 'Rain expected tomorrow.', forecast_clear: 'Clear skies tomorrow.', forecast_snow: 'Snow tomorrow.',
      midnight: "It's late. You fall asleep on the porch...",
      // settings
      settings: 'Settings', language: 'Language', music: 'Music', sound: 'Sound', on: 'On', off: 'Off',
      // story letters
      letter_1: "Dear you,\n\nThe farm is yours now. The coffee trees your grandfather planted are gone, but the soil remembers. Start small. Tomatoes pay the bills while the coffee grows.\n\nRosa keeps a cart on the road; she'll sell you seeds.\n\n— Abuela",
      letter_2: "The village is talking about your café. Old Tomás says it's the first decent espresso since your grandfather's time.\n\nKeep going.\n\n— Abuela",
      letter_3: "They asked me for your recipe at the market. I told them it's the mountain, the rain, and a little patience.\n\nI'm proud of you.\n\n— Abuela",
      letter_4: "I'll visit this summer. Save me a cup of café de olla, the way your grandfather made it.\n\n— Abuela",
      // fishing
      fish_wait: 'Wait for a tug...', fish_now: 'NOW!', fish_caught: 'Caught a trout!', fish_missed: 'It got away.',
      // misc
      inventory: 'Bag', empty_bag: 'Your bag is empty.', fullscreen: 'Add to Home Screen for fullscreen', paused: 'Paused',
      tutorial_done: 'You know the basics now. Take it slow.',
      rep_up: 'Reputation grew!',
      unlock_recipe: 'New recipe: {drink}',
    },
    es: {
      title: 'Cafetal',
      tagline: 'una finca de café tranquila',
      tap_to_start: 'Toca para empezar',
      continue_game: 'Continuar',
      new_game: 'Nueva partida',
      new_game_confirm: '¿Empezar de nuevo? Tu finca se borrará.',
      yes: 'Sí', no: 'No', ok: 'Vale', close: 'Cerrar', back: 'Atrás',
      coins: 'monedas', day: 'Día', reputation: 'Reputación',
      season_spring: 'Primavera', season_summer: 'Verano', season_autumn: 'Otoño', season_winter: 'Invierno',
      weather_clear: 'Despejado', weather_cloudy: 'Nublado', weather_rain: 'Lluvia', weather_snow: 'Nieve',
      tool_hand: 'Mano', tool_hoe: 'Azadón', tool_water: 'Regar', tool_bag: 'Bolsa',
      item_coffee_seed: 'Plántula de café', item_tomato_seed: 'Semillas de tomate', item_corn_seed: 'Semillas de maíz', item_sunflower_seed: 'Semillas de girasol',
      item_cherry: 'Cerezas de café', item_parchment: 'Pergamino húmedo', item_green: 'Café verde',
      item_roast_light: 'Tueste claro', item_roast_medium: 'Tueste medio', item_roast_dark: 'Tueste oscuro',
      item_tomato: 'Tomates', item_corn: 'Maíz', item_sunflower: 'Girasoles', item_egg: 'Huevos',
      item_milk: 'Leche', item_panela: 'Panela', item_cinnamon: 'Canela', item_cocoa: 'Cacao', item_mint: 'Yerbabuena', item_flower: 'Flores silvestres',
      item_fish: 'Trucha',
      drink_espresso: 'Espresso', drink_americano: 'Americano', drink_latte: 'Latte', drink_cappuccino: 'Capuchino',
      drink_cold_brew: 'Cold brew', drink_olla: 'Café de olla', drink_mocha: 'Moca', drink_mint_tea: 'Té de yerbabuena',
      hint_tap_move: 'Toca el suelo para caminar.',
      hint_hoe: 'Elige el azadón y toca la tierra junto a la casa para ararla.',
      hint_seed: 'Elige una semilla y toca la tierra arada para sembrar.',
      hint_water: 'Riega tus cultivos cada mañana. La lluvia lo hace por ti.',
      hint_coffee_done: 'Cuando las cerezas de café se pongan rojas (unos 6 días), recógelas con la mano.',
      hint_pulper: 'Lleva las cerezas a la despulpadora junto al cobertizo.',
      hint_patio: 'Extiende el pergamino en el patio para secarlo. Dos días de sol.',
      hint_roaster: 'Tuesta el café verde en el cobertizo. Mantén pulsado y suelta en el momento justo.',
      hint_cafe: 'Los clientes esperan en el mostrador del camino. ¡Atiéndelos!',
      not_farmland: 'Este suelo es demasiado pedregoso.',
      no_seeds: 'No tienes semillas de ese tipo.',
      planted: 'Sembraste {name}.',
      harvested: '+{n} {name}',
      foraged: '¡Encontraste {name}!',
      picked_egg: 'Las gallinas dejaron un huevo.',
      pulper: 'Despulpadora', patio: 'Patio de secado', roaster: 'Tostadora', cafe: 'Mostrador', house: 'Casa', shop: 'Carreta de Rosa', pond: 'Estanque', coop: 'Gallinero',
      pulper_none: 'No hay cerezas que despulpar.', pulper_done: 'Despulpaste {n} cerezas en pergamino húmedo.',
      patio_status: 'Secando: {n} / {max}  ·  {days} día(s) de sol', patio_empty: 'El patio está vacío.',
      patio_loaded: 'Extendiste {n} pergamino a secar.', patio_collect: '¡Recogiste {n} de café verde!', patio_rain: '¡Lluvia! El secado se pausa hoy.',
      patio_full: 'El patio está lleno.',
      roaster_title: 'Tostando', roaster_choose: 'Elige un tueste', roaster_none: 'No hay café verde para tostar.',
      roaster_hold: 'MANTÉN para tostar', roaster_release: 'SUELTA en la zona', roaster_batch: 'Lote: {n} granos',
      roast_light: 'Claro', roast_medium: 'Medio', roast_dark: 'Oscuro',
      roast_perfect: '¡Tueste perfecto! +{n} granos', roast_good: 'Buen tueste. +{n} granos', roast_burnt: 'Quemado... +{n} granos (se salvaron algunos)', roast_under: 'Le faltó tueste... +{n} granos',
      order_wants: 'quiere un {drink}', serve: 'Servir', sorry: 'Hoy no puedo', missing: 'Falta: {list}',
      served: '+{coins} monedas', tip: 'propina', recipe: 'Receta',
      customers_today: 'Clientes hoy', earned: 'Ganaste', happy: 'Clientes felices',
      buy: 'Comprar', sell: 'Vender', seeds: 'Semillas', pantry: 'Despensa', upgrades: 'Mejoras', owned: 'Tuyo', not_enough: 'No alcanza.',
      sell_all: 'Vender todo',
      up_sprinkler: 'Aspersor', up_sprinkler_d: 'Riega todo el campo cada mañana.',
      up_roof: 'Techo del patio', up_roof_d: 'El secado continúa aunque llueva.',
      up_patio2: 'Patio grande', up_patio2_d: 'Seca 40 pergaminos a la vez.',
      up_roaster2: 'Tostadora de tambor', up_roaster2_d: 'Tuesta 20 granos por lote.',
      up_cat: 'Adoptar un gato', up_cat_d: 'Un gato gris duerme en el porche. Trae suerte.',
      up_lights: 'Luces de colores', up_lights_d: 'Luces cálidas en el café. Los clientes se quedan más.',
      up_bench: 'Banca de jardín', up_bench_d: 'Un lugar para sentarse a ver la lluvia.',
      up_hens: 'Gallinas', up_hens_d: 'Tres gallinas pasean por el patio y dejan huevos.',
      up_rod: 'Caña de pescar', up_rod_d: 'Toca el estanque para pescar. La trucha se vende bien.',
      sleep_q: '¿Dormir?', sleep_summary: 'Día {day} · {season}', good_morning: 'Buenos días.',
      forecast_rain: 'Mañana lloverá.', forecast_clear: 'Mañana estará despejado.', forecast_snow: 'Mañana nevará.',
      midnight: 'Es tarde. Te quedas dormido en el porche...',
      settings: 'Ajustes', language: 'Idioma', music: 'Música', sound: 'Sonido', on: 'Sí', off: 'No',
      letter_1: 'Querido nieto,\n\nLa finca es tuya. Los cafetos que sembró tu abuelo ya no están, pero la tierra recuerda. Empieza poco a poco. Los tomates pagan las cuentas mientras crece el café.\n\nRosa tiene una carreta en el camino; te venderá semillas.\n\n— Abuela',
      letter_2: 'En el pueblo hablan de tu café. Don Tomás dice que es el primer espresso decente desde los tiempos de tu abuelo.\n\nSigue así.\n\n— Abuela',
      letter_3: 'Me pidieron tu receta en el mercado. Les dije que es la montaña, la lluvia y un poco de paciencia.\n\nEstoy orgullosa de ti.\n\n— Abuela',
      letter_4: 'Este verano voy a visitarte. Guárdame una taza de café de olla, como lo hacía tu abuelo.\n\n— Abuela',
      fish_wait: 'Espera el tirón...', fish_now: '¡AHORA!', fish_caught: '¡Pescaste una trucha!', fish_missed: 'Se escapó.',
      inventory: 'Bolsa', empty_bag: 'Tu bolsa está vacía.', fullscreen: 'Añade a la pantalla de inicio para pantalla completa', paused: 'Pausa',
      tutorial_done: 'Ya sabes lo básico. Tómatelo con calma.',
      rep_up: '¡Tu reputación creció!',
      unlock_recipe: 'Nueva receta: {drink}',
    },
  };

  C.strings = S;
  C.lang = 'en';
  C.setLang = function (l) { C.lang = S[l] ? l : 'en'; };
  C.t = function (key, vars) {
    let s = (S[C.lang] && S[C.lang][key]) || S.en[key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  };

  // NPC dialogue: [en, es]
  C.NPC_LINES = {
    generic_order: [
      ['Morning! Could I get a {drink}?', '¡Buenas! ¿Me das un {drink}?'],
      ['One {drink}, please. No rush.', 'Un {drink}, por favor. Sin prisa.'],
      ['Smells amazing out here. A {drink}?', 'Qué bien huele. ¿Un {drink}?'],
      ['I walked all the way from the village for a {drink}.', 'Vine caminando desde el pueblo por un {drink}.'],
    ],
    thanks: [
      ['Perfect. Just perfect.', 'Perfecto. Simplemente perfecto.'],
      ['Ahh. That hits the spot.', 'Ahh. Justo lo que necesitaba.'],
      ['Your grandfather would be proud.', 'Tu abuelo estaría orgulloso.'],
      ['I\'ll tell everyone about this place.', 'Le voy a contar a todos de este lugar.'],
      ['Worth the walk.', 'Valió la pena la caminata.'],
    ],
    sorry: [
      ['No worries. I\'ll come back.', 'No pasa nada. Vuelvo otro día.'],
      ['Another time, then.', 'Otro día será.'],
    ],
    tired: [
      ['Maybe next time...', 'Quizá la próxima...'],
    ],
  };

  C.NPC_DEFS = [
    { id: 'tomas', name: 'Don Tomás', skin: '#c68b5a', hair: '#dcdcdc', shirt: '#4a6b8a', pants: '#3a3a4a', hat: '#e9d8a6', fav: 'espresso',
      lines: [['I planted trees with your grandfather. Same rain, same hills.', 'Sembré cafetos con tu abuelo. La misma lluvia, las mismas lomas.'], ['Dark roast. Always dark.', 'Tueste oscuro. Siempre oscuro.']] },
    { id: 'lucia', name: 'Lucía', skin: '#e8b898', hair: '#3a2418', shirt: '#d96c8a', pants: '#5a4a7a', hat: null, fav: 'latte',
      lines: [['I teach at the school. The kids ask if you have a cat.', 'Doy clases en la escuela. Los niños preguntan si tienes gato.'], ['Latte, extra foam if you can.', 'Latte, con mucha espuma si se puede.']] },
    { id: 'mateo', name: 'Mateo', skin: '#8a5a3a', hair: '#1a1a1a', shirt: '#6a9a5a', pants: '#2a3a5a', hat: '#5a7a3a', fav: 'americano',
      lines: [['Fixed the bridge this morning. Long day.', 'Arreglé el puente esta mañana. Día largo.'], ['Just black coffee. Big cup.', 'Café negro nomás. Taza grande.']] },
    { id: 'abril', name: 'Abril', skin: '#f0c8a8', hair: '#c85a2a', shirt: '#f0e0a0', pants: '#8a4a3a', hat: null, fav: 'cold_brew',
      lines: [['I paint the pond every summer. It\'s never the same twice.', 'Pinto el estanque cada verano. Nunca es igual.'], ['Something cold. It\'s so warm today.', 'Algo frío. Hace tanto calor hoy.']] },
    { id: 'elena', name: 'Doña Elena', skin: '#d8a888', hair: '#8a8a9a', shirt: '#7a3a6a', pants: '#3a2a3a', hat: null, fav: 'olla',
      lines: [['Café de olla with panela, like my mother made.', 'Café de olla con panela, como lo hacía mi madre.'], ['You\'ve got the touch, mijo.', 'Tienes mano, mijo.']] },
    { id: 'nico', name: 'Nico', skin: '#b87a5a', hair: '#4a3a2a', shirt: '#3a8a9a', pants: '#2a2a2a', hat: '#2a2a2a', fav: 'mocha',
      lines: [['I deliver mail on the mountain road. Your letters come through me.', 'Reparto el correo del camino. Tus cartas pasan por mí.'], ['Mocha. Don\'t judge.', 'Moca. No juzgues.']] },
    { id: 'sofia', name: 'Sofía', skin: '#e8c0a0', hair: '#f0d070', shirt: '#a0c0f0', pants: '#4a5a8a', hat: '#f0f0f0', fav: 'cappuccino',
      lines: [['Studying in the city. I come home on weekends for this.', 'Estudio en la ciudad. Vengo los fines de semana por esto.'], ['Cappuccino, and your wifi password. Kidding.', 'Capuchino, y la clave del wifi. Es broma.']] },
    { id: 'rafa', name: 'Rafa', skin: '#a86a4a', hair: '#2a2a2a', shirt: '#c0c0c0', pants: '#5a5a5a', hat: null, fav: 'mint_tea',
      lines: [['I don\'t even drink coffee. The mint tea though...', 'Ni siquiera tomo café. Pero el té de yerbabuena...'], ['Quiet up here. I like it.', 'Qué tranquilo es esto. Me gusta.']] },
  ];
  C.npcLine = (pair) => (C.lang === 'es' ? pair[1] : pair[0]);
})();
