import type { Lang } from './i18n';

export interface TowerResult { time: number; falls: number; best: number; }
export interface Photo { src: string; tag?: string; }
export interface Stats { meters: number; climbs: number; repairs: number; falls: number; clips: number; photos: number; seconds: number; contracts: number; }
/** A climb in progress, written every time the player steps onto a platform. */
export interface Checkpoint {
  towerId: string; contract: unknown | null; platform: number; repaired: boolean;
  elapsed: number; falls: number; maxAlt: number; inspected: number[];
}
export type QualityPref = 'auto' | 'low' | 'medium' | 'high';

export interface SaveData {
  v: number; lang: Lang; invertY: boolean; sound: boolean; sens: number;
  fov: number; reduceMotion: boolean; leftHanded: boolean; quality: QualityPref; tapGrip: boolean;
  credits: number; owned: string[]; loadout: string[]; gearLv: Record<string, number>;
  unlocked: string[]; completed: Record<string, TowerResult>;
  xp: number; medals: Record<string, string[]>; bestAlt: Record<string, number>;
  pages: string[]; fragments: string[]; photoGoals: string[];
  contractsDone: { day: string; ids: string[] };
  stats: Stats;
  photos: Photo[]; totalClimbs: number;
  tutorialDone: boolean; checkpoint: Checkpoint | null;
}
export const SAVE_KEY = 'signal.save.v1';

const fresh = (): SaveData => ({
  v: 2, lang: (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en', invertY: false, sound: true, sens: 1,
  fov: 72, reduceMotion: false, leftHanded: false, quality: 'auto', tapGrip: false,
  credits: 150, owned: ['harness', 'tools', 'camera'], loadout: ['harness', 'tools', 'camera'], gearLv: {},
  unlocked: ['pinegrove'], completed: {},
  xp: 0, medals: {}, bestAlt: {},
  pages: [], fragments: [], photoGoals: [],
  contractsDone: { day: '', ids: [] },
  stats: { meters: 0, climbs: 0, repairs: 0, falls: 0, clips: 0, photos: 0, seconds: 0, contracts: 0 },
  photos: [], totalClimbs: 0,
  tutorialDone: false, checkpoint: null,
});

export const save: SaveData = load();

/** Additive migration: unknown fields are kept, missing ones take their defaults. */
function migrate(d: Partial<SaveData> & Record<string, unknown>): SaveData {
  const f = fresh(); const s = { ...f, ...d } as SaveData;
  s.stats = { ...f.stats, ...(d.stats ?? {}) };
  s.contractsDone = { ...f.contractsDone, ...(d.contractsDone ?? {}) };
  // v1 stored photos as bare data URLs
  s.photos = (Array.isArray(d.photos) ? d.photos : []).map((p) => (typeof p === 'string' ? { src: p } : p)) as Photo[];
  if ((d.v ?? 1) < 2) {
    // a v1 player who already finished towers keeps credit for them
    s.tutorialDone = Object.keys(s.completed).length > 0;
    for (const id of Object.keys(s.completed)) { s.medals[id] = s.medals[id] ?? ['restored']; s.xp += 150; }
    s.stats.climbs = Math.max(s.stats.climbs, s.totalClimbs); s.stats.repairs = Object.keys(s.completed).length;
  }
  s.v = 2; return s;
}
function load(): SaveData {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch { /* corrupt or blocked: start fresh */ }
  return fresh();
}
/** Returns false when the browser refused the write (quota, private mode). */
export function persist(): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; }
  catch {
    // photos are the only bulky part: drop the oldest and retry once
    if (save.photos.length > 2) { save.photos.splice(0, Math.ceil(save.photos.length / 2)); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { /* give up */ } }
    return false;
  }
}
export function resetSave() { const keep = { lang: save.lang, quality: save.quality }; Object.assign(save, fresh(), keep); persist(); }
