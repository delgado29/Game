export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Frame-rate independent exponential approach. */
export const damp = (cur: number, target: number, rate: number, dt: number) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
export const deg = (d: number) => (d * Math.PI) / 180;

/** Small deterministic RNG (mulberry32) so towers and forests are stable between runs. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a: number, b: number) => a + (b - a) * next(), int: (n: number) => Math.floor(next() * n), pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)] };
}

/** Cheap 2D value noise for terrain, 0..1. */
export function makeNoise(seed: number) {
  const r = rng(seed); const perm = new Uint8Array(512); const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = r.int(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const hash = (x: number, y: number) => perm[(perm[x & 255] + y) & 255] / 255;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  return { n2, fbm: (x: number, y: number, oct = 4) => { let s = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.05; } return s / norm; } };
}

export const fmtTime = (s: number) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
