import type { QualityPref } from './save';

export type QLevel = 'low' | 'medium' | 'high';
export interface Quality {
  level: QLevel; auto: boolean;
  /** Device-pixel-ratio cap. */ dpr: number;
  /** Post-processing chain (bloom, lens, grading). Off = direct render. */ composer: boolean;
  msaa: number; /** Shadow map size, 0 = no shadows. */ shadows: number;
  /** Fraction of trees / rain streaks to build. */ density: number;
  grass: boolean; skyOctaves: number;
}
const PRESETS: Record<QLevel, Omit<Quality, 'level' | 'auto'>> = {
  low: { dpr: 1.25, composer: false, msaa: 0, shadows: 0, density: 0.55, grass: false, skyOctaves: 3 },
  medium: { dpr: 1.5, composer: true, msaa: 4, shadows: 1024, density: 0.8, grass: true, skyOctaves: 4 },
  high: { dpr: 2, composer: true, msaa: 4, shadows: 2048, density: 1, grass: true, skyOctaves: 5 },
};
/** `?q=low|medium|high` in the URL overrides the saved preference (debugging, tests). */
export function resolveQuality(pref: QualityPref, isTouch: boolean): Quality {
  const url = new URLSearchParams(location.search).get('q');
  const forced = url === 'low' || url === 'medium' || url === 'high' ? url : null;
  const p = forced ?? pref; const level: QLevel = p === 'auto' ? (isTouch ? 'medium' : 'high') : p;
  return { level, auto: p === 'auto', ...PRESETS[level] };
}

/**
 * Dynamic resolution for the Auto setting: watches frame time and scales the internal
 * resolution down when the device cannot keep up, and back up when there is headroom.
 */
export class AutoScaler {
  scale = 1; private ema = 16; private slowT = 0; private fastT = 0; private coolDown = 3;
  /** Feed one frame's duration in seconds. Returns true when `scale` changed. */
  sample(dt: number): boolean {
    if (dt <= 0 || dt > 0.25) return false; // tab switches and hitches are not signal
    const ms = dt * 1000; this.ema += (ms - this.ema) * 0.08; this.coolDown -= dt;
    if (this.ema > 22) { this.slowT += dt; this.fastT = 0; } else if (this.ema < 12.5) { this.fastT += dt; this.slowT = 0; } else { this.slowT = 0; this.fastT = 0; }
    if (this.coolDown > 0) return false;
    if (this.slowT > 2 && this.scale > 0.56) { this.scale = Math.max(0.55, this.scale - 0.15); this.slowT = 0; this.coolDown = 3; return true; }
    if (this.fastT > 6 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.1); this.fastT = 0; this.coolDown = 4; return true; }
    return false;
  }
}
