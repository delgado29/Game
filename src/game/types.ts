import type { WeatherPhase } from '../world/weather';

export interface RadioLine { at: 'start' | 'alt' | 'descentAlt' | 'repaired' | 'clipped' | 'firstPlatform' | 'cut' | 'strange' | 'stepOnTop' | 'landed'; value?: number; en: string; es: string; who?: 'dispatch' | 'you' | 'unknown'; }

export interface TowerSpec {
  id: string; name: string; en: string; es: string; height: number; baseWidth: number; topWidth: number;
  platforms: number[];                     // heights of rest platforms (the top one is added automatically)
  anchorSpacing: number;
  cutAnchors: [number, number][];          // height ranges where the safety cable is cut (no anchors)
  brokenRungs: number[];                   // approximate heights of rungs that will snap
  electrical: number[];                    // heights of live junction boxes beside the ladder
  dishes: number[];
  sunElev: number; sunAzimuth: number; sunRate: number; // radians and radians/second (sun moves during the climb)
  weather: WeatherPhase[]; story: RadioLine[];
  reward: number; requires: string[]; unlocks?: string;
  sabotaged: boolean;
}
