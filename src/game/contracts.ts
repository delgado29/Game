import { save } from '../core/save';
import { rng } from '../core/math';
import { rankOf } from './career';
import { TOWERS, towerById } from './towers';
import type { RadioLine, TowerSpec } from './types';

export type ContractKind = 'maintenance' | 'inspect' | 'express' | 'heavy' | 'storm' | 'night';
export interface Contract {
  id: string; kind: ContractKind; towerId: string; /** Dailies pay once per day; standing contracts always pay. */ daily: boolean;
  reward: number; xp: number; timeLimit?: number; minKg?: number;
}
interface KindDef { en: string; es: string; descEn: string; descEs: string; rank: number; mult: number; xp: number; }
export const KINDS: Record<ContractKind, KindDef> = {
  maintenance: { en: 'Routine maintenance', es: 'Mantenimiento rutinario', descEn: 'Clean the filters and retune the carrier. Always available.', descEs: 'Limpia los filtros y reajusta la portadora. Siempre disponible.', rank: 0, mult: 0.55, xp: 30 },
  inspect: { en: 'Structural inspection', es: 'Inspección estructural', descEn: 'Check three tagged points on the platforms. Nothing to do at the cabinet.', descEs: 'Revisa tres puntos marcados en las plataformas. Nada que hacer en la caja.', rank: 0, mult: 1.0, xp: 70 },
  express: { en: 'Express call-out', es: 'Aviso exprés', descEn: 'Service the transmitter and be back at the van inside the time limit. Late pays 40%.', descEs: 'Atiende el transmisor y vuelve a la furgoneta dentro del límite. Tarde paga el 40%.', rank: 1, mult: 1.25, xp: 90 },
  heavy: { en: 'Heavy haul', es: 'Carga pesada', descEn: 'Replacement parts go up with you: carry at least 7 kg.', descEs: 'Los repuestos suben contigo: lleva al menos 7 kg.', rank: 1, mult: 1.3, xp: 90 },
  storm: { en: 'Storm chaser', es: 'Cazatormentas', descEn: 'The fault only shows in bad weather. The storm is already here.', descEs: 'La avería solo aparece con mal tiempo. La tormenta ya está aquí.', rank: 2, mult: 1.6, xp: 130 },
  night: { en: 'Night shift', es: 'Turno de noche', descEn: 'Work in the dark. Headlamp required.', descEs: 'Trabajo a oscuras. Frontal obligatorio.', rank: 2, mult: 1.45, xp: 120 },
};

let dayOverride: string | null = null;
/** Fix "today" (tests). */
export const setDay = (d: string | null) => { dayOverride = d; };
export const today = () => { if (dayOverride) return dayOverride; const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function make(kind: ContractKind, tw: TowerSpec, daily: boolean, day: string): Contract {
  const k = KINDS[kind]; const base = tw.reward * 0.4;
  return {
    id: daily ? `${day}:${tw.id}:${kind}` : `standing:${tw.id}:${kind}`, kind, towerId: tw.id, daily,
    reward: Math.round((base * k.mult) / 10) * 10, xp: Math.round(k.xp * (tw.height > 150 ? 1.4 : 1)),
    timeLimit: kind === 'express' ? Math.round(tw.par * 0.8) : undefined, minKg: kind === 'heavy' ? 7 : undefined,
  };
}
const restored = () => TOWERS.filter((tw) => save.completed[tw.id]);
/** Three contracts for the day, the same for a given date, set of restored towers and rank. */
export function dailyContracts(day: string = today()): Contract[] {
  const towers = restored(); if (!towers.length) return [];
  const rank = rankOf(); const r = rng(hash(day));
  const kinds = (Object.keys(KINDS) as ContractKind[]).filter((k) => k !== 'maintenance' && KINDS[k].rank <= rank);
  const pool: [ContractKind, TowerSpec][] = []; for (const tw of towers) for (const k of kinds) pool.push([k, tw]);
  for (let i = pool.length - 1; i > 0; i--) { const j = r.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: Contract[] = []; const usedKinds = new Set<ContractKind>();
  for (const [k, tw] of pool) { if (out.length >= 3) break; if (usedKinds.has(k)) continue; usedKinds.add(k); out.push(make(k, tw, true, day)); }
  for (const [k, tw] of pool) { if (out.length >= 3) break; if (!out.some((c) => c.kind === k && c.towerId === tw.id)) out.push(make(k, tw, true, day)); }
  return out;
}
export const standingContracts = (): Contract[] => restored().map((tw) => make('maintenance', tw, false, ''));
export const contractsFor = (towerId: string): Contract[] => [...dailyContracts(), ...standingContracts()].filter((c) => c.towerId === towerId);
export const contractDone = (c: Contract) => c.daily && save.contractsDone.day === today() && save.contractsDone.ids.includes(c.id);
export function markDone(c: Contract) {
  if (!c.daily) return; const d = today();
  if (save.contractsDone.day !== d) save.contractsDone = { day: d, ids: [] };
  if (!save.contractsDone.ids.includes(c.id)) save.contractsDone.ids.push(c.id);
}

const L = (at: RadioLine['at'], en: string, es: string, who: RadioLine['who'] = 'dispatch'): RadioLine => ({ at, en, es, who });
const CHATTER: Record<ContractKind, RadioLine[]> = {
  maintenance: [
    L('start', 'Routine visit, unit four. Filters and a retune. Take the scenic route.', 'Visita de rutina, unidad cuatro. Filtros y un reajuste. Tómatelo con calma.'),
    L('repaired', 'Carrier is clean. Come on down.', 'Portadora limpia. Baja cuando quieras.'),
    L('landed', 'Logged. Thanks, four.', 'Anotado. Gracias, cuatro.'),
  ],
  inspect: [
    L('start', 'Inspection today. Three yellow tags, one per platform. Look at the steel, sign it off, move on.', 'Hoy toca inspección. Tres etiquetas amarillas, una por plataforma. Mira el acero, firma y sigue.'),
    L('repaired', 'That is all three. The structure holds. Head back.', 'Las tres hechas. La estructura aguanta. Vuelve.'),
    L('landed', 'Report filed. Good eyes.', 'Informe entregado. Buen ojo.'),
  ],
  express: [
    L('start', 'Clock is running, unit four. The hospital link drops when this transmitter drifts. Fast and clipped.', 'El reloj corre, unidad cuatro. El enlace del hospital se cae cuando este transmisor se desajusta. Rápido y anclado.'),
    L('repaired', 'Link is back. Now get to the van before the clock does.', 'Enlace arriba. Ahora llega a la furgoneta antes que el reloj.'),
    L('landed', 'Stop the clock.', 'Paren el reloj.'),
  ],
  heavy: [
    L('start', 'Those spares weigh what they weigh. Rest on every platform. Nobody is timing you.', 'Esos repuestos pesan lo que pesan. Descansa en cada plataforma. Nadie te cronometra.'),
    L('repaired', 'Parts are in. The climb down will feel like flying.', 'Piezas instaladas. La bajada te va a parecer volar.'),
    L('landed', 'Delivered. Your shoulders have the rest of the day off.', 'Entregado. Tus hombros tienen el resto del día libre.'),
  ],
  storm: [
    L('start', 'I would not send you up in this if the fault showed in the dry. Both hands in the gusts. If the radio dies, keep going.', 'No te mandaría arriba con esto si la avería saliera en seco. Las dos manos en las ráfagas. Si la radio muere, sigue.'),
    L('repaired', 'Got it. That was the fault. Down, now, clipped all the way.', 'Lo tengo. Esa era la avería. Abajo, ya, anclado todo el camino.'),
    L('landed', 'Unit four is on the ground. Breathe.', 'Unidad cuatro en tierra. Respira.'),
  ],
  night: [
    L('start', 'Night shift. Your lamp reaches about as far as you can fall. Count the anchors.', 'Turno de noche. Tu frontal alcanza más o menos lo que puedes caer. Cuenta los anclajes.'),
    L('repaired', 'Signal is steady. Look at the valley before you come down. That is your work, lit up.', 'Señal estable. Mira el valle antes de bajar. Eso es tu trabajo, encendido.'),
    L('landed', 'Down safe. Go to sleep, four.', 'Abajo y a salvo. Vete a dormir, cuatro.'),
  ],
};

/** The tower as this contract changes it: weather, light, required gear and radio chatter. */
export function applyContract(c: Contract): TowerSpec {
  const base = towerById(c.towerId); const spec: TowerSpec = { ...base, story: CHATTER[c.kind], requires: ['tools'], unlocks: undefined };
  if (c.kind === 'inspect') spec.requires = [];
  if (c.kind === 'storm') spec.weather = [{ at: 'start', target: { cloud: 0.95, rain: 0.7, wind: 0.85, storm: 0.8 }, over: 1 }, { at: 'repaired', target: { cloud: 1, rain: 0.9, wind: 1, storm: 1 }, over: 30 }];
  if (c.kind === 'night') { spec.sunElev = -0.45; spec.sunRate = 0; spec.requires = ['tools', 'headlamp']; spec.weather = [{ at: 'start', target: { cloud: 0.2, rain: 0, wind: 0.3, storm: 0 }, over: 1 }]; }
  if (c.kind === 'express' || c.kind === 'heavy' || c.kind === 'maintenance' || c.kind === 'inspect') spec.weather = base.weather.filter((w) => w.at !== 'repaired');
  return spec;
}
/** Steps at the transmitter for this contract, or null when the job is elsewhere. */
export const contractSteps = (c: Contract): string[] | null => (c.kind === 'inspect' ? null : ['rOpen', 'rFilter', 'rTune']);
