import type { TowerSpec } from './types';

export const TOWERS: TowerSpec[] = [
  {
    id: 'pinegrove', name: 'Pinegrove Relay', en: 'A 90 m relay above the valley. Quiet, mostly intact. Your first job since the collapse.', es: 'Un repetidor de 90 m sobre el valle. Tranquilo, casi intacto. Tu primer trabajo desde el colapso.',
    height: 90, baseWidth: 5.2, topWidth: 1.6, platforms: [30, 60], anchorSpacing: 3, cutAnchors: [], brokenRungs: [], electrical: [], dishes: [48, 72],
    sunElev: 0.42, sunAzimuth: 2.4, sunRate: -0.00055,
    weather: [
      { at: 'start', target: { cloud: 0.15, rain: 0, wind: 0.2, storm: 0 }, over: 1 },
      { at: 'alt', value: 45, target: { cloud: 0.3, rain: 0, wind: 0.4, storm: 0 }, over: 40 },
      { at: 'repaired', target: { cloud: 0.7, rain: 0.35, wind: 0.6, storm: 0.2 }, over: 50 },
    ],
    story: [
      { at: 'start', who: 'dispatch', en: 'Dispatch to unit four. Pinegrove has been dark since the collapse. Get the transmitter back up and the whole valley hears us again.', es: 'Central a unidad cuatro. Pinegrove está apagada desde el colapso. Levanta el transmisor y todo el valle nos oye otra vez.' },
      { at: 'start', who: 'you', en: '...Yeah. That is really high.', es: '...Sí. Eso está muy alto.' },
      { at: 'clipped', who: 'dispatch', en: 'Good. Stay clipped. Three metres of cable, then the next anchor. Same rhythm all the way up.', es: 'Bien. Sigue anclado. Tres metros de cable y el siguiente anclaje. El mismo ritmo hasta arriba.' },
      { at: 'firstPlatform', who: 'dispatch', en: 'Take a breather on the platforms. Nobody is timing you. Look around if you want; it is a good evening for it.', es: 'Respira en las plataformas. Nadie te cronometra. Mira alrededor si quieres; es una buena tarde para eso.' },
      { at: 'alt', value: 50, who: 'dispatch', en: 'Wind is picking up a little above fifty. If a gust comes, both hands on the steel.', es: 'El viento sube un poco a partir de cincuenta. Si llega una ráfaga, las dos manos al acero.' },
      { at: 'stepOnTop', who: 'dispatch', en: 'Top platform. The cabinet is behind you. Open it, swap the fuse, reconnect the feed, tune it. Take your time.', es: 'Plataforma superior. La caja está detrás de ti. Ábrela, cambia el fusible, reconecta la línea, ajústala. Tómate tu tiempo.' },
      { at: 'repaired', who: 'dispatch', en: 'We have carrier. We have— look down. Look at the town.', es: 'Tenemos portadora. Tenemos... mira abajo. Mira el pueblo.' },
      { at: 'repaired', who: 'dispatch', en: 'Weather warning, unit four. A front moved faster than forecast. Rain in ten minutes. Get down.', es: 'Aviso meteo, unidad cuatro. Un frente se movió más rápido de lo previsto. Lluvia en diez minutos. Baja.' },
      { at: 'descentAlt', value: 40, who: 'dispatch', en: 'Wet steel. Slow hands. You are doing fine.', es: 'Acero mojado. Manos lentas. Lo estás haciendo bien.' },
      { at: 'landed', who: 'dispatch', en: 'Unit four is on the ground. Payment is in. Get in the van and dry off; there is a strange one on the ridge we need to talk about.', es: 'Unidad cuatro en tierra. Pago hecho. Métete en la furgoneta y sécate; hay una rara en la cresta de la que tenemos que hablar.' },
    ],
    reward: 400, requires: ['tools'], unlocks: 'blackridge', sabotaged: false,
  },
  {
    id: 'blackridge', name: 'Black Ridge Mast', en: 'A 180 m mast on the ridge. Went silent overnight. The last crew never filed a report.', es: 'Un mástil de 180 m en la cresta. Se apagó de la noche a la mañana. La última cuadrilla nunca entregó informe.',
    height: 180, baseWidth: 7.5, topWidth: 1.4, platforms: [36, 72, 108, 144], anchorSpacing: 3, cutAnchors: [[78, 92], [128, 141]], brokenRungs: [51.3, 84.6, 99.9, 135.0, 160.2], electrical: [63, 118], dishes: [66, 100, 150],
    sunElev: 0.2, sunAzimuth: 2.9, sunRate: -0.00042,
    weather: [
      { at: 'start', target: { cloud: 0.45, rain: 0, wind: 0.45, storm: 0 }, over: 1 },
      { at: 'alt', value: 70, target: { cloud: 0.65, rain: 0.1, wind: 0.6, storm: 0.1 }, over: 60 },
      { at: 'alt', value: 130, target: { cloud: 0.85, rain: 0.35, wind: 0.75, storm: 0.35 }, over: 60 },
      { at: 'repaired', target: { cloud: 1, rain: 0.9, wind: 1.0, storm: 1 }, over: 40 },
    ],
    story: [
      { at: 'start', who: 'dispatch', en: 'Black Ridge. One hundred eighty metres. It dropped off the network at 03:12 with no fault code. Just gone.', es: 'Black Ridge. Ciento ochenta metros. Se cayó de la red a las 03:12 sin código de fallo. Simplemente desapareció.' },
      { at: 'start', who: 'dispatch', en: 'The battery bank will be dead by now. You brought the pack, right?', es: 'El banco de baterías ya estará muerto. Trajiste la batería, ¿verdad?' },
      { at: 'alt', value: 50, who: 'you', en: 'Rung is bent here. Rust on the break... no. That is a saw mark.', es: 'Aquí hay un peldaño doblado. Óxido en la rotura... no. Es una marca de sierra.' },
      { at: 'cut', who: 'dispatch', en: 'Say again? The safety cable is cut? Unit four, that cable was inspected in spring.', es: '¿Repite? ¿El cable de seguridad está cortado? Unidad cuatro, ese cable se inspeccionó en primavera.' },
      { at: 'cut', who: 'you', en: 'Clean cut. Both ends. Somebody did not want the next climber to make it past here.', es: 'Corte limpio. Los dos extremos. Alguien no quería que el siguiente escalador pasara de aquí.' },
      { at: 'alt', value: 110, who: 'dispatch', en: 'You can come down. Nobody would blame you.', es: 'Puedes bajar. Nadie te culparía.' },
      { at: 'alt', value: 112, who: 'you', en: 'Twenty metres from the top. I am not coming down.', es: 'A veinte metros de la cima. No voy a bajar.' },
      { at: 'strange', who: 'unknown', en: '...—ridge, ridge, do you copy. Relay seven-one, this is— ...we are not on the map. Stop the restoration. Stop the—', es: '...—cresta, cresta, ¿copias? Repetidor siete-uno, aquí— ...no estamos en el mapa. Detengan la restauración. Detengan el—' },
      { at: 'strange', who: 'dispatch', en: 'Unit four, what was that? That did not come from us. There is no relay seven-one.', es: 'Unidad cuatro, ¿qué fue eso? Eso no vino de nosotros. No existe ningún repetidor siete-uno.' },
      { at: 'stepOnTop', who: 'dispatch', en: 'Top. The panel will be dead cold. Battery first, then the feed, then tune it. And unit four... whatever that was, we will find it.', es: 'Cima. El panel estará frío del todo. Primero la batería, luego la línea, luego ajusta. Y unidad cuatro... sea lo que sea eso, lo encontraremos.' },
      { at: 'repaired', who: 'dispatch', en: 'Carrier is up. The ridge is back on the— severe weather warning. Lightning within five kilometres. Down. Now.', es: 'Portadora arriba. La cresta ha vuelto a la... aviso de tormenta severa. Rayos a menos de cinco kilómetros. Abajo. Ya.' },
      { at: 'descentAlt', value: 100, who: 'dispatch', en: 'Do not stop on the platforms. Keep clipped where you can and keep moving.', es: 'No pares en las plataformas. Mantente anclado donde puedas y sigue moviéndote.' },
      { at: 'landed', who: 'dispatch', en: 'You are down. You are down. Whoever cut that cable is going to hear that mast broadcasting from a hundred kilometres away. Good.', es: 'Estás abajo. Estás abajo. Quien cortó ese cable va a oír ese mástil emitiendo desde cien kilómetros. Bien.' },
    ],
    reward: 900, requires: ['tools', 'battery'], sabotaged: true,
  },
];
export const towerById = (id: string) => TOWERS.find((t) => t.id === id)!;
