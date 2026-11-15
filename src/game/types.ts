import type { WeatherPhase } from '../world/weather';

export interface RadioLine { at: 'start' | 'alt' | 'descentAlt' | 'repaired' | 'clipped' | 'firstPlatform' | 'cut' | 'strange' | 'stepOnTop' | 'landed' | 'ice' | 'clouds'; value?: number; en: string; es: string; who?: 'dispatch' | 'you' | 'unknown'; }

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
  /** Target time in seconds for the Under Par medal. */ par: number;
  /** Position on the network map (viewBox 600x380). */ map: { x: number; y: number };
  /** Rungs above this height are iced over. */ iceAbove?: number;
  /** Guyed mast: constant width with tensioned stay cables. */ guyed?: boolean;
  collectibles: Collectible[];
}

/** Things to find on platforms. `platform` indexes the sorted platform list (the top is last); `corner` is 0..3. */
export interface Collectible { id: string; kind: 'page' | 'fragment'; platform: number; corner: number; en?: string; es?: string; titleEn?: string; titleEs?: string; }
