import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import { audio } from '../core/audio';
import type { Sky } from './sky';

export interface WeatherTarget { cloud: number; rain: number; wind: number; storm: number; }
export interface WeatherPhase { at: 'start' | 'repaired' | 'alt' | 'time'; value?: number; target: WeatherTarget; over: number; }
export interface Strike { pos: THREE.Vector3; dist: number; }

/** Weather state machine: cloud/rain/wind/storm approach scripted targets; gusts, rain streaks, lightning. */
export class Weather {
  cur: WeatherTarget = { cloud: 0, rain: 0, wind: 0.2, storm: 0 };
  target: WeatherTarget = { ...this.cur };
  rate = 0.2;
  windDir = new THREE.Vector3(1, 0, 0.3).normalize();
  gust = 0;            // 0..1 current gust envelope
  gustWarning = false; // true shortly before a gust hits
  gustPeak = 0;
  private nextGust = 6; private gustT = -1;
  warnLead = 1.5;
  flash = 0; radioDead = 0;
  onStrike: ((s: Strike) => void) | null = null;
  private nextStrike = 8;
  private rain: THREE.LineSegments; private rainPos: Float32Array; private rainN = 2200; private rainVel: Float32Array;
  private bolt: THREE.Line; private boltT = 0;
  private script: WeatherPhase[] = []; private fired = new Set<WeatherPhase>();
  private time = 0;

  constructor(scene: THREE.Scene, private sky: Sky) {
    this.rainPos = new Float32Array(this.rainN * 6); this.rainVel = new Float32Array(this.rainN);
    for (let i = 0; i < this.rainN; i++) { this.rainPos[i * 6] = (Math.random() - 0.5) * 30; this.rainPos[i * 6 + 1] = Math.random() * 30 - 15; this.rainPos[i * 6 + 2] = (Math.random() - 0.5) * 30; this.rainVel[i] = 14 + Math.random() * 8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 14), 3));
    this.bolt = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0, fog: false })); this.bolt.frustumCulled = false; scene.add(this.bolt);
  }
  setScript(script: WeatherPhase[]) { this.script = script; this.fired.clear(); this.time = 0; for (const p of script) if (p.at === 'start') { this.cur = { ...p.target }; this.target = { ...p.target }; this.fired.add(p); } }
  setTarget(t: WeatherTarget, over: number) { this.target = { ...t }; this.rate = 1 / Math.max(1, over); }
  event(kind: 'repaired') { for (const p of this.script) if (p.at === kind && !this.fired.has(p)) { this.fired.add(p); this.setTarget(p.target, p.over); } }
  /** Stops gusts for a long time (tests). */
  calm() { this.gust = 0; this.gustT = -1; this.nextGust = 1e9; this.gustWarning = false; }
  get windSpeed() { return clamp(this.cur.wind + this.gust * (0.5 + this.cur.storm * 0.6), 0, 1.6); }

  update(dt: number, cam: THREE.Vector3, altitude: number) {
    this.time += dt;
    for (const p of this.script) if (!this.fired.has(p) && ((p.at === 'alt' && altitude >= (p.value ?? 0)) || (p.at === 'time' && this.time >= (p.value ?? 0)))) { this.fired.add(p); this.setTarget(p.target, p.over); }
    for (const k of ['cloud', 'rain', 'wind', 'storm'] as const) this.cur[k] = damp(this.cur[k], this.target[k], this.rate * 2.5, dt);
    this.sky.overcast = clamp(this.cur.cloud, 0, 1);
    // gusts
    this.nextGust -= dt;
    this.gustWarning = this.nextGust > 0 && this.nextGust < this.warnLead;
    if (this.nextGust <= 0 && this.gustT < 0) { this.gustT = 0; this.gustPeak = 0.55 + Math.random() * 0.45; }
    if (this.gustT >= 0) {
      this.gustT += dt; const T = this.gustT; const dur = 3.2;
      const env = T < 0.8 ? T / 0.8 : T < 2.2 ? 1 : Math.max(0, 1 - (T - 2.2) / 1.0);
      this.gust = env * this.gustPeak * clamp(0.35 + this.cur.wind * 0.8 + this.cur.storm * 0.5, 0, 1.2);
      if (T > dur) { this.gustT = -1; this.gust = 0; this.nextGust = lerp(14, 4, clamp(this.cur.wind + this.cur.storm * 0.7, 0, 1)) * (0.6 + Math.random() * 0.8); }
    }
    this.windDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(this.time * 0.05) * 0.002);
    // rain streaks around the camera
    const r = this.cur.rain; (this.rain.material as THREE.LineBasicMaterial).opacity = r * 0.55;
    if (r > 0.02) {
      const p = this.rainPos; const wx = this.windDir.x * this.windSpeed * 6, wz = this.windDir.z * this.windSpeed * 6;
      for (let i = 0; i < this.rainN; i++) { const o = i * 6; let x = p[o] - cam.x, y = p[o + 1] - cam.y, z = p[o + 2] - cam.z; y -= this.rainVel[i] * dt; x += wx * dt; z += wz * dt;
        if (y < -15) { y += 30; x = (Math.random() - 0.5) * 30; z = (Math.random() - 0.5) * 30; } if (x > 15) x -= 30; if (x < -15) x += 30; if (z > 15) z -= 30; if (z < -15) z += 30;
        p[o] = cam.x + x; p[o + 1] = cam.y + y; p[o + 2] = cam.z + z; p[o + 3] = p[o] - wx * 0.03; p[o + 4] = p[o + 1] + this.rainVel[i] * 0.035; p[o + 5] = p[o + 2] - wz * 0.03; }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    // lightning
    this.flash = damp(this.flash, 0, 9, dt); this.sky.flash = this.flash; this.radioDead = Math.max(0, this.radioDead - dt);
    if (this.cur.storm > 0.25) {
      this.nextStrike -= dt * this.cur.storm;
      if (this.nextStrike <= 0) { this.nextStrike = 3 + Math.random() * 9; this.strike(cam); }
    }
    if (this.boltT > 0) { this.boltT -= dt; (this.bolt.material as THREE.LineBasicMaterial).opacity = clamp(this.boltT / 0.25, 0, 1) * (Math.random() > 0.3 ? 1 : 0.3); } else (this.bolt.material as THREE.LineBasicMaterial).opacity = 0;
  }
  private strike(cam: THREE.Vector3) {
    const dist = lerp(2500, 250, Math.pow(Math.random(), 1.6) * clamp(this.cur.storm, 0, 1)); const a = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(cam.x + Math.cos(a) * dist, 0, cam.z + Math.sin(a) * dist);
    this.flash = clamp(1.2 - dist / 2500, 0.15, 1); audio.thunder(dist);
    const arr = this.bolt.geometry.attributes.position.array as Float32Array; const top = 700 + Math.random() * 200;
    for (let i = 0; i < 14; i++) { const t = i / 13; arr[i * 3] = pos.x + (Math.random() - 0.5) * 40 * (1 - t) + (i ? 0 : 0); arr[i * 3 + 1] = top * (1 - t); arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 40 * (1 - t); }
    this.bolt.geometry.attributes.position.needsUpdate = true; this.boltT = 0.3;
    if (dist < 450) this.radioDead = 12 + Math.random() * 10;
    this.onStrike?.({ pos, dist });
  }
}
