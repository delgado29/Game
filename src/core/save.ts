import type { Lang } from './i18n';

export interface TowerResult { time: number; falls: number; best: number; }
export interface SaveData {
  v: number; lang: Lang; invertY: boolean; sound: boolean; sens: number;
  fov: number; reduceMotion: boolean; leftHanded: boolean;
  credits: number; owned: string[]; loadout: string[];
  unlocked: string[]; completed: Record<string, TowerResult>;
  photos: string[]; totalClimbs: number;
}
export const SAVE_KEY = 'signal.save.v1';

const fresh = (): SaveData => ({
  v: 1, lang: (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en', invertY: false, sound: true, sens: 1,
  fov: 72, reduceMotion: false, leftHanded: false,
  credits: 150, owned: ['harness', 'tools', 'camera'], loadout: ['harness', 'tools', 'camera'],
  unlocked: ['pinegrove'], completed: {}, photos: [], totalClimbs: 0,
});

export const save: SaveData = load();

function load(): SaveData {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const d = JSON.parse(raw); return { ...fresh(), ...d }; } } catch { /* ignore */ }
  return fresh();
}
export function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or blocked */ } }
export function resetSave() { Object.assign(save, fresh()); persist(); }
