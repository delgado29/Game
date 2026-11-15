import { save } from '../core/save';
import { pick } from '../core/i18n';
import { B } from './balance';
import { TOWERS } from './towers';
import { GEAR } from './gear';

export const RANKS: { en: string; es: string }[] = [
  { en: 'Apprentice', es: 'Aprendiz' },
  { en: 'Tower technician', es: 'Técnico de torre' },
  { en: 'Professional climber', es: 'Escalador profesional' },
  { en: 'Infrastructure specialist', es: 'Especialista en infraestructura' },
  { en: 'Network chief', es: 'Jefe de red' },
];
export const rankOf = (xp: number = save.xp) => { let r = 0; for (let i = 0; i < B.rankXp.length; i++) if (xp >= B.rankXp[i]) r = i; return r; };
export const rankName = (r: number = rankOf()) => pick(RANKS[r].en, RANKS[r].es);
/** Progress through the current rank: xp into it, xp it spans, fraction. At the last rank the bar stays full. */
export function rankProgress(xp: number = save.xp) {
  const r = rankOf(xp); const lo = B.rankXp[r]; const hi = B.rankXp[r + 1];
  return hi === undefined ? { rank: r, into: xp - lo, span: 0, frac: 1 } : { rank: r, into: xp - lo, span: hi - lo, frac: (xp - lo) / (hi - lo) };
}
/** Gear that becomes available exactly at rank `r`. */
export const gearAtRank = (r: number) => GEAR.filter((g) => (g.rank ?? 0) === r && r > 0);

export type MedalId = 'restored' | 'clean' | 'par' | 'found';
export const MEDALS: { id: MedalId; en: string; es: string; hintEn: string; hintEs: string }[] = [
  { id: 'restored', en: 'Restored', es: 'Restaurada', hintEn: 'Bring the transmitter back', hintEs: 'Devuelve la señal al transmisor' },
  { id: 'clean', en: 'No falls', es: 'Sin caídas', hintEn: 'Finish a job here without a single fall', hintEs: 'Termina un trabajo aquí sin una sola caída' },
  { id: 'par', en: 'Under par', es: 'Bajo par', hintEn: 'Finish a job here under the par time', hintEs: 'Termina un trabajo aquí por debajo del tiempo par' },
  { id: 'found', en: 'All found', es: 'Todo encontrado', hintEn: 'Find every page and signal fragment', hintEs: 'Encuentra todas las páginas y fragmentos' },
];
export const hasMedal = (towerId: string, m: MedalId) => (save.medals[towerId] ?? []).includes(m);
export const medalCount = () => Object.values(save.medals).reduce((n, a) => n + a.length, 0);
/** Collectibles found / total for a tower, by kind. */
export function foundOn(towerId: string) {
  const tw = TOWERS.find((x) => x.id === towerId); const c = tw?.collectibles ?? [];
  const pages = c.filter((x) => x.kind === 'page'), frags = c.filter((x) => x.kind === 'fragment');
  return {
    pages: pages.filter((x) => save.pages.includes(x.id)).length, pagesTotal: pages.length,
    fragments: frags.filter((x) => save.fragments.includes(x.id)).length, fragmentsTotal: frags.length,
    all: c.length > 0 && c.every((x) => (x.kind === 'page' ? save.pages : save.fragments).includes(x.id)),
  };
}

/** What a run paid, line by line, for the debrief. */
export interface LedgerLine { en: string; es: string; xp: number; credits: number; }
export class Ledger {
  lines: LedgerLine[] = [];
  add(en: string, es: string, xp: number, credits = 0) { if (xp || credits) this.lines.push({ en, es, xp, credits }); }
  get xp() { return this.lines.reduce((s, l) => s + l.xp, 0); }
  get credits() { return this.lines.reduce((s, l) => s + l.credits, 0); }
}

/** Long-term goals shown on the career screen. They carry no reward: they are a record. */
export function milestones(): { en: string; es: string; done: boolean; progress: string }[] {
  const st = save.stats; const totalMedals = TOWERS.length * MEDALS.length;
  const allPages = TOWERS.flatMap((t) => t.collectibles).filter((c) => c.kind === 'page');
  const m = (en: string, es: string, cur: number, goal: number) => ({ en, es, done: cur >= goal, progress: `${Math.min(cur, goal)} / ${goal}` });
  return [
    m('Restore every tower', 'Restaura todas las torres', Object.keys(save.completed).length, TOWERS.length),
    m('Climb a vertical kilometre', 'Escala un kilómetro vertical', st.meters, 1000),
    m('Climb five vertical kilometres', 'Escala cinco kilómetros verticales', st.meters, 5000),
    m('Finish 10 contracts', 'Completa 10 contratos', st.contracts, 10),
    m('Clip 500 anchors', 'Ancla 500 veces', st.clips, 500),
    m('Read the whole logbook', 'Lee toda la bitácora', save.pages.length, allPages.length),
    m('Complete every photo assignment', 'Completa todos los encargos fotográficos', save.photoGoals.length, 8),
    m('Earn every medal', 'Gana todas las medallas', medalCount(), totalMedals),
  ];
}
