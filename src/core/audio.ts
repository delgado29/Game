/** All sound is synthesised with WebAudio: no audio files. Call unlock() from a user gesture. */
import { clamp, lerp } from './math';

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, seconds = 2, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return buf;
}

export class Audio {
  ctx: Ctx | null = null;
  enabled = true;
  private master!: GainNode;
  private windGain!: GainNode; private windFilt!: BiquadFilterNode; private windHi!: GainNode; private windHiFilt!: BiquadFilterNode;
  private rainGain!: GainNode;
  private humGain!: GainNode; private humOsc: OscillatorNode[] = [];
  private buzzGain!: GainNode;
  private musicGain!: GainNode; private musicTimer = 0; private musicOn = false;
  private heartTimer = 0;
  private creakTimer = 3;
  private radioStaticGain!: GainNode;
  private white!: AudioBuffer; private brown!: AudioBuffer;
  private t = 0;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0; this.master.connect(c.destination);
    this.white = noiseBuffer(c, 2); this.brown = noiseBuffer(c, 2, true);
    // wind: brown noise through a wandering low-pass, plus a whistling high band
    const src = this.loop(this.brown); this.windFilt = c.createBiquadFilter(); this.windFilt.type = 'lowpass'; this.windFilt.frequency.value = 300; this.windFilt.Q.value = 0.7;
    this.windGain = c.createGain(); this.windGain.gain.value = 0; src.connect(this.windFilt).connect(this.windGain).connect(this.master);
    const src2 = this.loop(this.white); this.windHiFilt = c.createBiquadFilter(); this.windHiFilt.type = 'bandpass'; this.windHiFilt.frequency.value = 900; this.windHiFilt.Q.value = 6;
    this.windHi = c.createGain(); this.windHi.gain.value = 0; src2.connect(this.windHiFilt).connect(this.windHi).connect(this.master);
    // rain: white noise, high-passed
    const r = this.loop(this.white); const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2500; this.rainGain = c.createGain(); this.rainGain.gain.value = 0; r.connect(rf).connect(this.rainGain).connect(this.master);
    // transmitter hum (50 Hz + harmonics)
    this.humGain = c.createGain(); this.humGain.gain.value = 0; this.humGain.connect(this.master);
    for (const [f, g] of [[50, 0.5], [100, 0.25], [150, 0.12]] as const) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = g; o.connect(gg).connect(this.humGain); o.start(); this.humOsc.push(o); }
    // electrical buzz (sawtooth 120 Hz, gated)
    this.buzzGain = c.createGain(); this.buzzGain.gain.value = 0; this.buzzGain.connect(this.master);
    const bo = c.createOscillator(); bo.type = 'sawtooth'; bo.frequency.value = 120; const bf = c.createBiquadFilter(); bf.type = 'highpass'; bf.frequency.value = 800; bo.connect(bf).connect(this.buzzGain); bo.start();
    // radio static
    const rs = this.loop(this.white); const rsf = c.createBiquadFilter(); rsf.type = 'bandpass'; rsf.frequency.value = 1800; rsf.Q.value = 1.2; this.radioStaticGain = c.createGain(); this.radioStaticGain.gain.value = 0; rs.connect(rsf).connect(this.radioStaticGain).connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
  }
  private loop(buf: AudioBuffer) { const s = this.ctx!.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  setEnabled(on: boolean) { this.enabled = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx!.currentTime, 0.1); }

  /** Per-frame ambience. wind 0..1 (speed), gust 0..1, alt metres, rain 0..1. */
  ambience(dt: number, wind: number, gust: number, alt: number, rain: number, hum: number, buzz: number, staticLevel: number) {
    if (!this.ctx) return; const c = this.ctx; const now = c.currentTime; this.t += dt;
    const w = clamp(wind * 0.8 + gust * 0.6, 0, 1.3); const h = clamp(alt / 200, 0, 1);
    this.windGain.gain.setTargetAtTime(0.05 + w * 0.35 + h * 0.08, now, 0.3);
    this.windFilt.frequency.setTargetAtTime(200 + w * 500 + Math.sin(this.t * 0.7) * 80 + gust * 300, now, 0.2);
    this.windHi.gain.setTargetAtTime(Math.max(0, w - 0.35) * 0.12 + gust * 0.08, now, 0.2);
    this.windHiFilt.frequency.setTargetAtTime(700 + Math.sin(this.t * 1.3) * 250 + gust * 600, now, 0.3);
    this.rainGain.gain.setTargetAtTime(rain * 0.16, now, 0.5);
    this.humGain.gain.setTargetAtTime(hum * 0.12, now, 0.3);
    this.buzzGain.gain.setTargetAtTime(buzz * 0.08, now, 0.05);
    this.radioStaticGain.gain.setTargetAtTime(staticLevel * 0.1, now, 0.1);
    // occasional steel creak, more often in wind
    this.creakTimer -= dt * (1 + w * 2);
    if (this.creakTimer <= 0) { this.creakTimer = 2 + Math.random() * 8; this.creak(); }
    if (this.musicOn) { this.musicTimer -= dt; if (this.musicTimer <= 0) { this.musicTimer = 3.2; this.chord(); } }
  }
  private env(g: GainNode, peak: number, a: number, d: number, t0 = this.ctx!.currentTime) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  private tone(type: OscillatorType, f0: number, f1: number, peak: number, a: number, d: number, dest: AudioNode = this.master) {
    if (!this.ctx) return; const c = this.ctx; const o = c.createOscillator(); o.type = type; const g = c.createGain(); o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), c.currentTime + a + d);
    this.env(g, peak, a, d); o.connect(g).connect(dest); o.start(); o.stop(c.currentTime + a + d + 0.05);
  }
  private burst(peak: number, a: number, d: number, filterF: number, type: BiquadFilterType = 'bandpass', q = 1) {
    if (!this.ctx) return; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.white; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterF; f.Q.value = q; const g = c.createGain(); this.env(g, peak, a, d); s.connect(f).connect(g).connect(this.master); s.start(); s.stop(c.currentTime + a + d + 0.05);
  }
  creak() { if (!this.ctx) return; const f = 90 + Math.random() * 140; this.tone('sawtooth', f, f * (0.7 + Math.random() * 0.6), 0.02 + Math.random() * 0.02, 0.15, 0.6 + Math.random()); }
  grab() { this.burst(0.25, 0.005, 0.08, 1200, 'bandpass', 2); this.tone('triangle', 180, 120, 0.08, 0.005, 0.12); }
  releaseHand() { this.burst(0.08, 0.005, 0.05, 2000, 'highpass'); }
  slip() { this.burst(0.3, 0.02, 0.25, 2500, 'bandpass', 0.8); }
  click() { this.burst(0.3, 0.002, 0.04, 4000, 'highpass'); this.tone('square', 2200, 1400, 0.12, 0.002, 0.05); }
  clipIn() { this.click(); setTimeout(() => this.tone('triangle', 900, 700, 0.15, 0.005, 0.1), 60); }
  jerk() { this.burst(0.5, 0.01, 0.4, 400, 'lowpass'); this.tone('sawtooth', 80, 40, 0.3, 0.01, 0.5); }
  snap() { this.burst(0.6, 0.002, 0.15, 1800, 'bandpass', 1.5); this.tone('square', 600, 100, 0.25, 0.002, 0.12); }
  step(metal = true) { this.burst(metal ? 0.12 : 0.08, 0.003, metal ? 0.09 : 0.06, metal ? 700 : 300, 'bandpass', metal ? 3 : 1); }
  shock() { this.burst(0.5, 0.005, 0.5, 3000, 'highpass'); this.tone('sawtooth', 120, 90, 0.35, 0.005, 0.5); }
  thunder(distance: number) {
    if (!this.ctx) return; const c = this.ctx; const delay = distance / 340; const t0 = c.currentTime + delay; const far = clamp(distance / 3000, 0, 1);
    const s = c.createBufferSource(); s.buffer = this.brown; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lerp(400, 90, far); const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(lerp(0.9, 0.25, far), t0 + lerp(0.05, 0.6, far)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + lerp(2.5, 6, far));
    s.connect(f).connect(g).connect(this.master); s.start(t0); s.stop(t0 + 7);
  }
  radioSquelch() { this.burst(0.2, 0.01, 0.12, 1800, 'bandpass', 1.5); }
  radioBlip() { this.tone('square', 1200, 1200, 0.05, 0.005, 0.05); }
  heartbeat(dt: number, rate: number) { if (!this.ctx || rate <= 0) return; this.heartTimer -= dt * rate; if (this.heartTimer <= 0) { this.heartTimer = 1; this.tone('sine', 70, 40, 0.35, 0.01, 0.15); setTimeout(() => this.tone('sine', 60, 35, 0.25, 0.01, 0.15), 140); } }
  breath() { this.burst(0.06, 0.2, 0.5, 600, 'bandpass', 0.7); }
  /** Short exhale on a pull-up; heavier packs sound lower and louder. */
  pull(weight: number) { this.burst(0.05 + weight * 0.06, 0.03, 0.22 + weight * 0.15, 700 - weight * 250, 'bandpass', 0.9); }
  /** Lanyard going taut. */
  ropeCreak() { this.tone('sawtooth', 160, 90, 0.06, 0.02, 0.3); this.burst(0.12, 0.005, 0.12, 900, 'bandpass', 3); }
  powerUp() { this.tone('sine', 60, 220, 0.3, 1.2, 1.5); this.tone('triangle', 220, 440, 0.15, 1.5, 1.5); setTimeout(() => this.burst(0.15, 0.01, 0.6, 3000, 'highpass'), 1200); }
  private chordIdx = 0;
  private chord() {
    if (!this.ctx) return; const c = this.ctx;
    const chords = [[220, 277, 330, 440], [196, 247, 294, 392], [174.6, 220, 261.6, 349], [164.8, 207.6, 246.9, 329.6]];
    const ch = chords[this.chordIdx++ % chords.length];
    for (const f of ch) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004); const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.045, c.currentTime + 1.2); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 3.4); o.connect(g).connect(this.musicGain); o.start(); o.stop(c.currentTime + 3.5); }
  }
  music(on: boolean, level = 1) { this.musicOn = on; if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? level : 0, this.ctx.currentTime, 1.5); if (on) this.musicTimer = 0; }
}

export const audio = new Audio();
