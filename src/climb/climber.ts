import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import { audio } from '../core/audio';
import { haptic } from '../core/haptics';
import type { Input } from '../core/input';
import type { Tower, WorkPoint } from '../world/tower';
import { RUNG_STEP } from '../world/tower';
import type { Weather } from '../world/weather';
import { makeHand, makeClimberFigure } from '../world/props';
import { t } from '../core/i18n';
import { B } from '../game/balance';
import type { Perks } from '../game/gear';

export type ClimbState = 'ground' | 'platform' | 'ladder' | 'falling' | 'dead' | 'rest' | 'work';
export type ClimbEvent = 'clipped' | 'clip' | 'platform' | 'firstPlatform' | 'stepOnTop' | 'repaired' | 'landed' | 'fell' | 'caught' | 'stumble' | 'cut' | 'ice' | 'photo' | 'enterVan' | 'point';
export type Protection = 'clipped' | 'arrester' | 'none';

interface Hand { rung: number | null; mesh: THREE.Group; pos: THREE.Vector3; quat: THREE.Quaternion; snapT: number; }
/** A hold-to-work interaction: one or more timed steps, then a callback. */
interface Work { steps: { key: string; dur: number }[]; i: number; t: number; done: () => void; }

const { eye: EYE, chest: CHEST, handRest: HAND_REST, gravity: G } = B;
const UP = new THREE.Vector3(0, 1, 0);
// scratch objects: the climber updates every frame and must not allocate
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e1 = new THREE.Euler();

export class Climber {
  state: ClimbState = 'ground';
  pos = new THREE.Vector3(4, 0, 14);
  yaw = 0.3; pitch = 0.15;
  camera: THREE.PerspectiveCamera;
  hands: [Hand, Hand];
  figure: THREE.Group;
  stamina = 100; maxStamina = 100;
  anchor: number | null = null; // index into tower.anchors
  leash: number = B.leash;
  falls = 0; maxAlt = 0; elapsed = 0; clips = 0;
  /** True once the job's task on the tower is done; from then on the goal is the van. */
  repaired = false;
  /** Steps of the transmitter task, or null when this job has nothing to do at the cabinet. */
  txSteps: string[] | null = ['rOpen', 'rFuse', 'rFeed', 'rTune'];
  lastPlatform = -1; // index of the last platform reached (checkpoint)
  descending = false;
  prompt = ''; message = ''; messageT = 0; brace = false; slipping = false;
  arcWarn = 0;            // 0 no live box near, (0,1) warning ramp, 1 arcing within reach
  shake = 0; flashRed = 0; deadT = 0;
  pullBob = 0;            // 1 right after a pull-up, decays; drives the camera dip
  /** Comfort settings: base field of view and a motion scale (0.3 with reduce-motion on). */
  comfort = { fov: 72, motion: 1 };
  /** Touch reach mode: 1 grabs upward from the other hand, -1 downward, 0 aims with the camera pitch (desktop). */
  reachDir: 1 | -1 | 0 = 0;
  /** Assisted grip: a tap moves that hand to the next rung; hands never let go on their own. */
  tapGrip = false;
  perks: Perks = { weight: 3, fatigueMul: 1, gloves: false, leash: B.leash, maxStamina: 100, regen: B.regenPlatform, warnLead: 1.5, tools: true, battery: false, analyzer: false, camera: false, drone: false, headlamp: false, arrester: false };

  private work: Work | null = null;
  private pullRate = 7;   // how fast the body follows the hands (slower with a heavy pack)
  private vel = 0; private noHandsT = 0; private slipT = 0; private restT = 0;
  private fallFrom = 0; private fallGuarded = false;
  private time = 0; private stepT = 0; private walkPhase = 0;
  private events: ((e: ClimbEvent, data?: unknown) => void)[] = [];
  private platformsSeen = new Set<number>();
  private cutWarned = false; private iceWarned = false;

  constructor(private scene: THREE.Scene, public tower: Tower, private weather: Weather, private input: Input, private vanPos: THREE.Vector3, private vanYaw: number) {
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 9000);
    const mk = (left: boolean): Hand => { const mesh = makeHand(left); scene.add(mesh); return { rung: null, mesh, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), snapT: 0 }; };
    this.hands = [mk(true), mk(false)];
    this.figure = makeClimberFigure(); this.figure.visible = false; scene.add(this.figure);
  }
  on(cb: (e: ClimbEvent, data?: unknown) => void) { this.events.push(cb); }
  private emit(e: ClimbEvent, data?: unknown) { for (const cb of this.events) cb(e, data); }
  setPerks(p: Perks) {
    this.perks = p; this.maxStamina = p.maxStamina; this.stamina = this.maxStamina; this.leash = p.leash;
    this.pullRate = 7 / (1 + p.weight / 14); this.weather.warnLead = p.warnLead; this.tower.showHazards(p.drone);
  }
  setComfort(fov: number, reduceMotion: boolean) { this.comfort = { fov, motion: reduceMotion ? 0.3 : 1 }; }
  dispose() { for (const h of this.hands) this.scene.remove(h.mesh); this.scene.remove(this.figure); }
  reset() {
    this.state = 'ground'; this.pos.set(this.vanPos.x - 2, 0, this.vanPos.z - 3); this.yaw = Math.atan2(this.pos.x, this.pos.z); this.pitch = 0.25;
    this.stamina = this.maxStamina; this.anchor = null; this.falls = 0; this.maxAlt = 0; this.elapsed = 0; this.clips = 0;
    this.repaired = false; this.work = null; this.lastPlatform = -1; this.descending = false; this.platformsSeen.clear();
    this.cutWarned = false; this.iceWarned = false; this.message = ''; this.prompt = '';
    for (const h of this.hands) h.rung = null;
    this.figure.visible = false; this.shake = 0; this.vel = 0;
  }
  /** Put the climber back on a platform reached earlier (resuming a saved climb). */
  restoreAt(pi: number, s: { elapsed: number; falls: number; maxAlt: number; repaired: boolean }) {
    const p = this.tower.platforms[pi]; this.state = 'platform'; this.lastPlatform = pi; this.pos.set(0, p.y, p.hw + 0.55); this.yaw = 0; this.pitch = 0.1;
    this.elapsed = s.elapsed; this.falls = s.falls; this.maxAlt = s.maxAlt; this.repaired = s.repaired; this.descending = s.repaired;
    for (let i = 0; i <= pi; i++) this.platformsSeen.add(i);
    if (s.repaired) for (let i = 0; i < this.tower.platforms.length; i++) this.platformsSeen.add(i);
  }

  get altitude() { return this.pos.y; }
  get chest() { return this.pos.y + CHEST; }
  get gripping() { return (this.hands[0].rung !== null ? 1 : 0) + (this.hands[1].rung !== null ? 1 : 0); }
  get onLadder() { return this.state === 'ladder' || this.state === 'falling'; }
  get anchorY() { return this.anchor === null ? null : this.tower.anchors[this.anchor]; }
  /** 0..1 how much of the lanyard is used up (0 when unclipped). */
  get leashFrac() { const ay = this.anchorY; return ay === null ? 0 : clamp(Math.abs(this.chest - ay) / this.leash, 0, 1); }
  /** What would stop a fall right now. */
  get protection(): Protection {
    if (this.perks.arrester) return this.tower.cableAt(this.chest) ? 'arrester' : 'none';
    return this.anchor !== null ? 'clipped' : 'none';
  }
  get workProgress() { const w = this.work; return w ? clamp(w.t / w.steps[w.i].dur, 0, 1) : 0; }
  get workLabel() { const w = this.work; if (!w) return ''; const n = w.steps.length; return n > 1 ? `${t(w.steps[w.i].key)} (${w.i + 1}/${n})` : t(w.steps[w.i].key); }
  say(key: string, dur = 2.2) { this.message = t(key); this.messageT = dur; }
  /** Marks the job's task as done (transmitter repaired, or every inspection tag checked). */
  completeJob() { if (this.repaired) return; this.repaired = true; this.descending = true; this.emit('repaired'); }
  /** Keyboard hint for prompts; hidden on touch devices. */
  private k(key: string) { return this.input.isTouch ? '' : ` (${key})`; }
  private holdHint() { return this.input.isTouch ? `${t('hold')} ${t('tAct')}` : `${t('hold')} F`; }

  update(dt: number, invertY: boolean, sens: number) {
    dt = Math.min(dt, 0.05); this.time += dt; if (this.state !== 'dead' && this.state !== 'rest') this.elapsed += dt;
    if (this.state !== 'rest' && this.state !== 'dead') {
      const k = 0.0022 * sens; this.yaw -= this.input.lookX * k; this.pitch = clamp(this.pitch - this.input.lookY * k * (invertY ? -1 : 1), -1.45, 1.45);
    }
    if (this.messageT > 0) { this.messageT -= dt; if (this.messageT <= 0) this.message = ''; }
    this.shake = damp(this.shake, 0, 6, dt); this.flashRed = damp(this.flashRed, 0, 5, dt); this.pullBob = damp(this.pullBob, 0, 4.5, dt);
    this.prompt = ''; this.arcWarn = 0;
    switch (this.state) {
      case 'ground': this.updateWalk(dt, true); break;
      case 'platform': this.updateWalk(dt, false); break;
      case 'ladder': this.updateLadder(dt); break;
      case 'falling': this.updateFall(dt); break;
      case 'rest': this.updateRest(dt); break;
      case 'work': this.updateWork(dt); break;
      case 'dead': this.deadT += dt; break;
    }
    this.maxAlt = Math.max(this.maxAlt, this.pos.y);
    this.updateStamina(dt);
    this.updateCamera(dt);
    this.updateHands(dt);
  }

  // ---------- walking (ground & platforms) ----------
  private updateWalk(dt: number, ground: boolean) {
    const mv = this.input.move; const T = this.tower;
    if (mv.x || mv.y) {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), k = B.walkSpeed * dt;
      const np = v1.set(this.pos.x + (-sy * mv.y + cy * mv.x) * k, this.pos.y, this.pos.z + (-cy * mv.y - sy * mv.x) * k);
      if (ground) { if (Math.hypot(np.x, np.z) < 42 && !this.hitsTowerBase(np) && !this.hitsVan(np)) this.pos.copy(np); }
      else {
        const p = T.platforms[this.lastPlatform]; const out = p.hw + 1.1 - 0.25, inn = p.hw - 0.15 + 0.25; const top = p.y === T.topY;
        if (Math.abs(np.x) < out && Math.abs(np.z) < out && (top || Math.abs(np.x) > inn || Math.abs(np.z) > inn)) this.pos.copy(np);
      }
      this.walkPhase += dt * 9; this.stepT += dt * B.walkSpeed; if (this.stepT > 1.4) { this.stepT = 0; audio.step(!ground); }
    }
    const act = this.input.pressed.has('act');
    if (ground) {
      if (Math.hypot(this.pos.x, this.pos.z - (T.ladderZ(0) + 0.55)) < 1.4) { this.prompt = `${t('grabLadder')}${this.k('F')}`; if (act) this.mountLadder(0); }
      else if (this.repaired && this.pos.distanceTo(this.vanPos) < 3.4) { this.prompt = `${t('toVan')}${this.k('F')}`; if (act) this.emit('enterVan'); }
    } else {
      const p = T.platforms[this.lastPlatform]; const isTop = p.y === T.topY;
      const pt = T.nearestPoint(this.pos, this.lastPlatform, 1.6);
      if (Math.abs(this.pos.x) < 0.9 && this.pos.z > p.hw + 0.1) { this.prompt = `${t('grabLadder')}${this.k('F')}`; if (act) this.mountLadder(p.y); }
      else if (isTop && !this.repaired && this.txSteps && Math.hypot(this.pos.x - T.transmitter.x, this.pos.z - T.transmitter.z) < 2.0) {
        this.prompt = `${t('repair')} — ${this.holdHint()}`; if (this.input.held.has('act')) this.startRepair();
      } else if (pt) this.offerPoint(pt);
      if (this.input.pressed.has('rest')) this.startRest(); else if (!this.prompt) this.prompt = `${t('rest')}${this.k('V')}`;
    }
    if (this.input.pressed.has('photo') && this.perks.camera) this.emit('photo');
  }
  private offerPoint(pt: WorkPoint) {
    if (pt.kind === 'fragment' && !this.perks.analyzer) { this.prompt = t('needAnalyzer'); return; }
    const key = pt.kind === 'page' ? 'wPage' : pt.kind === 'fragment' ? 'wFragment' : 'wInspect';
    this.prompt = `${t(key)} — ${this.holdHint()}`;
    if (this.input.held.has('act')) this.startWork([{ key, dur: pt.kind === 'page' ? 0.7 : pt.kind === 'fragment' ? 2.6 : 2.0 }], () => this.emit('point', pt));
  }
  private hitsTowerBase(p: THREE.Vector3) { const hw = this.tower.hw(0) + 0.2; return Math.abs(p.x) < hw && Math.abs(p.z) < hw; }
  private hitsVan(p: THREE.Vector3) { const d = v2.copy(p).sub(this.vanPos).applyAxisAngle(UP, -this.vanYaw); return Math.abs(d.x) < 1.3 && Math.abs(d.z) < 3.0; }
  private mountLadder(y: number) {
    this.state = 'ladder'; this.pos.set(0, y, this.tower.ladderZ(y) + 0.55); this.yaw = 0; this.pitch = 0.35; this.vel = 0; this.noHandsT = 0;
    const i = this.tower.rungAt(y + CHEST + HAND_REST); this.hands[0].rung = i; this.hands[1].rung = Math.min(i + 1, this.tower.rungY.length - 1); audio.grab();
  }

  // ---------- ladder ----------
  private updateLadder(dt: number) {
    const inp = this.input; const T = this.tower;
    for (const [hi, act] of [[0, 'gripL'], [1, 'gripR']] as const) {
      const h = this.hands[hi];
      if (this.tapGrip) { if (inp.pressed.has(act)) { const prev = h.rung; h.rung = null; if (!this.tryGrab(hi)) h.rung = prev; } }
      else {
        if (inp.pressed.has(act)) this.tryGrab(hi);
        if (inp.released.has(act) && h.rung !== null) { h.rung = null; audio.releaseHand(); }
      }
      if (h.rung !== null && T.broken.has(h.rung) && !T.snapped.has(h.rung)) {
        h.snapT += dt;
        if (h.snapT > 0.35) { T.snapRung(h.rung); h.rung = null; h.snapT = 0; audio.snap(); haptic(50); this.say('rungSnap'); this.stamina -= 8; this.shake = 0.6; }
      } else h.snapT = 0;
    }
    if (this.perks.arrester) this.anchor = null;
    if (inp.pressed.has('clip')) this.tryClip();
    // the body follows the hands
    const n = this.gripping;
    if (n) {
      let hy = 0; for (const h of this.hands) if (h.rung !== null) hy += T.rungY[h.rung];
      const target = this.clampLeash(hy / n - CHEST - HAND_REST - (n === 1 ? 0.15 : 0));
      this.pos.y = damp(this.pos.y, target, this.pullRate, dt); this.noHandsT = 0;
    } else {
      const ay = this.anchorY;
      if (ay !== null && this.chest <= ay - this.leash + 0.05) this.noHandsT = 0; // hanging in the harness
      else { this.noHandsT += dt; if (this.noHandsT > 0.15) this.startFall(); }
    }
    this.pos.x = damp(this.pos.x, 0, 8, dt); this.pos.z = damp(this.pos.z, T.ladderZ(this.pos.y) + 0.55, 8, dt);
    // a strong gust can peel off a single hand
    const g = this.weather.gust; this.brace = (this.weather.gustWarning || g > 0.45) && this.pos.y > 8;
    if (g > 0.6 && n === 1) {
      this.slipT += dt;
      if (this.slipT > 0.6 && Math.random() < dt * 1.6) { this.dropOneHand(); this.slipT = 0; }
    } else this.slipT = Math.max(0, this.slipT - dt);
    // live junction boxes: HUD warning within 3 m, shock within reach while arcing
    for (let i = 0; i < T.electrical.length; i++) {
      const d = Math.abs(this.chest - T.electrical[i].y);
      if (d < 3) this.arcWarn = Math.max(this.arcWarn, T.arcPhase(i));
      if (d < 1.15 && T.arcAt(i) && n) { for (const h of this.hands) h.rung = null; audio.shock(); haptic([30, 30, 30, 30, 30]); this.say('shocked', 1.5); this.stamina -= 18; this.shake = 1; this.flashRed = 1; }
    }
    if (!this.iceWarned && T.iceAt(this.chest)) { this.iceWarned = true; this.say('ice', 2.5); this.emit('ice'); }
    // stepping off
    const pi = T.platforms.findIndex((p) => Math.abs(this.pos.y - p.y) < 0.75);
    const act = inp.pressed.has('act');
    if (pi >= 0) { this.prompt = `${t('stepOff')}${this.k('F')}`; if (act) this.stepOnto(pi); }
    else if (this.pos.y < 0.4) {
      this.prompt = `${t('stepDown')}${this.k('F')}`;
      if (act) { this.state = 'ground'; this.pos.y = 0; this.pos.z += 0.6; for (const h of this.hands) h.rung = null; this.anchor = null; if (this.repaired) this.emit('landed'); }
    } else this.promptLeash();
    if (inp.pressed.has('photo') && this.perks.camera) this.emit('photo');
    if (this.pos.y < -0.2) this.pos.y = 0;
  }
  private dropOneHand() { const h = this.hands[0].rung !== null ? this.hands[0] : this.hands[1]; if (h.rung === null) return; h.rung = null; audio.slip(); haptic([40, 30, 40]); this.say('slipping', 1.2); }
  private tryGrab(hi: 0 | 1): boolean {
    const T = this.tower; const h = this.hands[hi]; if (h.rung !== null) return false;
    const other = this.hands[1 - hi].rung;
    const rest = this.pos.y + CHEST + HAND_REST; let reachY: number;
    if (this.reachDir !== 0) { const base = other !== null ? T.rungY[other] : rest; reachY = clamp(base + this.reachDir * (other !== null ? 2 * RUNG_STEP : 0.6), rest - 1.1, rest + 1.1); }
    else reachY = rest + clamp(this.pitch / 1.1, -1, 1) * 0.9;
    const i = T.rungAt(reachY); if (T.snapped.has(i)) { audio.releaseHand(); return false; }
    const y = T.rungY[i]; if (Math.abs(y - rest) > B.reach) return false;
    // refuse a grab that would drag the body past the end of the lanyard
    const target = (other === null ? y : (y + T.rungY[other]) / 2) - CHEST - HAND_REST;
    if (Math.abs(this.clampLeash(target) - target) > 0.05) { this.say('reclip', 1.2); this.shake = Math.max(this.shake, 0.35); audio.ropeCreak(); return false; }
    h.rung = i; h.snapT = 0; audio.grab(); haptic(10);
    if (this.state === 'ladder' && target > this.pos.y + 0.12) { this.pullBob = other === null ? 1 : 0.6; audio.pull(clamp(this.perks.weight / 9, 0, 1)); }
    if (this.state === 'falling' && this.vel < B.regrabVel) { this.state = 'ladder'; this.stamina -= B.catchCost; this.shake = 0.5; this.vel = 0; }
    return true;
  }
  private clampLeash(feetY: number) { const ay = this.anchorY; if (ay === null) return feetY; return clamp(feetY + CHEST, ay - this.leash, ay + this.leash) - CHEST; }
  private promptLeash() {
    if (this.perks.arrester) { if (!this.tower.cableAt(this.chest)) this.prompt = t('noCable'); return; }
    const ay = this.anchorY; const near = this.nearestAnchor();
    if (ay === null) { if (near !== null) this.prompt = `${t('clipHint')}${this.k('Space')}`; }
    else if (Math.abs(this.chest - ay) > this.leash - 0.4) this.prompt = near !== null && near !== this.anchor ? `${t('reclip')}${this.k('Space')}` : t('noAnchor');
  }
  private nearestAnchor(): number | null {
    const A = this.tower.anchors; let best: number | null = null, bd: number = B.clipReach;
    for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - this.chest); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  private tryClip() {
    if (this.perks.arrester) { this.say(this.tower.cableAt(this.chest) ? 'arresterOn' : 'noCable', 1.4); return; }
    const n = this.nearestAnchor();
    if (n === null) {
      this.say('noAnchor', 1.6); audio.releaseHand();
      const inCut = this.tower.spec.cutAnchors.some(([a, b]) => this.chest > a - 1 && this.chest < b + 1);
      if (inCut && !this.cutWarned) { this.cutWarned = true; this.emit('cut'); }
      return;
    }
    if (n === this.anchor) return;
    const first = this.anchor === null && this.clips === 0; this.anchor = n; this.clips++; audio.clipIn(); haptic(20);
    this.emit('clip'); if (first) this.emit('clipped');
  }
  private stepOnto(pi: number) {
    const p = this.tower.platforms[pi]; this.state = 'platform'; this.lastPlatform = pi; this.pos.set(0, p.y, p.hw + 0.55);
    for (const h of this.hands) h.rung = null; this.anchor = null; this.stepT = 0;
    if (!this.platformsSeen.has(pi)) {
      this.platformsSeen.add(pi);
      if (this.platformsSeen.size === 1) this.emit('firstPlatform');
      if (p.y === this.tower.topY) this.emit('stepOnTop');
    }
    this.emit('platform', pi);
  }

  // ---------- falling ----------
  private startFall() { this.state = 'falling'; this.vel = 0; this.fallFrom = this.pos.y; this.fallGuarded = this.perks.arrester && this.tower.cableAt(this.chest); }
  private updateFall(dt: number) {
    this.vel += G * dt; this.pos.y -= this.vel * dt; this.pos.z = this.tower.ladderZ(Math.max(0, this.pos.y)) + 0.7;
    for (const [hi, act] of [[0, 'gripL'], [1, 'gripR']] as const) if (this.input.pressed.has(act)) this.tryGrab(hi);
    if (this.state !== 'falling') return;
    const ay = this.anchorY;
    if (this.fallGuarded && this.fallFrom - this.pos.y >= B.arresterDrop) { this.caught(B.arresterCost, 0.9); return; }
    if (ay !== null && this.chest <= ay - this.leash) { this.pos.y = ay - this.leash - CHEST; this.caught(B.catchCost, 1.4); return; }
    if (this.pos.y <= 0) { this.pos.y = 0; if (this.vel < B.stumbleVel) this.stumble(); else this.die(); }
  }
  private caught(cost: number, shake: number) {
    this.state = 'ladder'; this.vel = 0; this.falls++; this.stamina -= cost; this.shake = shake;
    audio.jerk(); haptic(80); this.say('caught', 2); this.emit('caught');
    // hang there: put a hand back on if the player is holding a grip
    if (this.fallGuarded) { const i = this.tower.rungAt(this.pos.y + CHEST + HAND_REST); if (!this.tower.snapped.has(i)) this.hands[0].rung = i; }
  }
  /** A short drop onto the ground: bruised, not dead. */
  private stumble() {
    this.state = 'ground'; this.pos.z += 0.6; this.falls++; this.stamina = Math.max(0, this.stamina - 30); this.shake = 1.2; this.flashRed = 0.6;
    this.anchor = null; this.vel = 0; for (const h of this.hands) h.rung = null; audio.jerk(); haptic(60); this.say('stumble', 2); this.emit('stumble');
  }
  private die() { this.state = 'dead'; this.deadT = 0; this.falls++; audio.jerk(); this.emit('fell'); for (const h of this.hands) h.rung = null; }
  respawn() {
    if (this.lastPlatform >= 0) { const p = this.tower.platforms[this.lastPlatform]; this.state = 'platform'; this.pos.set(0, p.y, p.hw + 0.55); }
    else { this.state = 'ground'; this.pos.set(0, 0, this.tower.ladderZ(0) + 2.5); }
    this.yaw = 0; this.anchor = null; this.stamina = this.maxStamina * 0.7; this.vel = 0; this.pitch = 0.2; this.shake = 0; this.work = null;
  }

  // ---------- rest / look down ----------
  private startRest() { this.state = 'rest'; this.restT = 0; this.figure.visible = true; this.figure.position.copy(this.pos); this.figure.rotation.y = this.yaw + Math.PI; audio.breath(); }
  private updateRest(dt: number) {
    this.restT += dt; this.prompt = t('stopRest');
    const photo = this.input.pressed.has('photo');
    if (photo && this.perks.camera) this.emit('photo');
    else if (this.restT > 0.6 && this.input.pressed.size > 0) { this.state = 'platform'; this.figure.visible = false; }
  }

  // ---------- hold-to-work: repairs, pages, fragments, inspections ----------
  private startRepair() {
    if (!this.txSteps) return;
    if (!this.perks.tools) { this.say('needTools', 3); return; }
    if (this.txSteps.includes('rBattery') && !this.perks.battery) { this.say('needBattery', 3); return; }
    const dur = (k: string) => (k === 'rTune' ? (this.perks.analyzer ? 0.6 : 4.5) : k === 'rBattery' ? 3 : 1.8);
    this.startWork(this.txSteps.map((key) => ({ key, dur: dur(key) })), () => { this.tower.setRepaired(); audio.powerUp(); this.say('rDone', 4); this.completeJob(); });
  }
  private startWork(steps: Work['steps'], done: () => void) { this.work = { steps, i: 0, t: 0, done }; this.state = 'work'; }
  private updateWork(dt: number) {
    const w = this.work; if (!w) { this.state = 'platform'; return; }
    this.prompt = this.holdHint();
    if (this.input.held.has('act')) { w.t += dt; if (w.t % 0.5 < dt) audio.click(); }
    else w.t = Math.max(0, w.t - dt * 0.6);
    if (w.t >= w.steps[w.i].dur) {
      w.i++; w.t = 0; audio.clipIn();
      if (w.i >= w.steps.length) { this.work = null; this.state = 'platform'; w.done(); }
    }
    // walking away or resting cancels
    if (this.work && (Math.hypot(this.input.move.x, this.input.move.y) > 0.5 || this.input.pressed.has('rest'))) { this.work = null; this.state = 'platform'; }
  }

  // ---------- stamina ----------
  private updateStamina(dt: number) {
    const p = this.perks; let d = 0;
    if (this.state === 'ladder') {
      const n = this.gripping; const wet = this.weather.cur.rain > 0.3 && !p.gloves;
      const ice = this.tower.iceAt(this.chest) ? (p.gloves ? B.iceGloveMul : B.iceMul) : 1;
      d = B.drain * (1 + p.weight / 12) * p.fatigueMul * (wet ? B.wetMul : 1) * ice * (n === 1 ? B.oneHandMul : n === 0 ? B.hangMul : 1) * (1 + this.weather.gust * B.gustMul);
    } else if (this.state === 'platform' || this.state === 'rest' || this.state === 'work') d = -p.regen;
    else if (this.state === 'ground') d = -B.regenGround;
    this.stamina = clamp(this.stamina - d * dt, 0, this.maxStamina);
    this.slipping = this.state === 'ladder' && this.stamina < 18;
    if (this.state === 'ladder' && this.stamina <= 0.01) { this.slipT += dt; if (this.slipT > 1.1) { this.dropOneHand(); this.slipT = 0; } }
    audio.heartbeat(dt, this.state === 'ladder' && this.stamina < 35 ? lerp(1.0, 2.2, 1 - this.stamina / 35) : 0);
  }

  // ---------- camera & hands ----------
  private updateCamera(dt: number) {
    const cam = this.camera; const w = this.weather; const wind = w.windSpeed; const hf = clamp(this.pos.y / 60, 0, 1);
    if (this.state === 'rest') {
      const a = this.time * 0.25; const r = 3.2 + Math.sin(this.time * 0.13) * 0.6; const tgt = v1.copy(this.figure.position); tgt.y += 0.7;
      cam.position.set(tgt.x + Math.cos(a) * r, tgt.y + 0.9 + Math.sin(this.time * 0.2) * 0.4, tgt.z + Math.sin(a) * r); cam.lookAt(tgt);
      cam.fov = damp(cam.fov, 60, 3, dt); cam.updateProjectionMatrix(); return;
    }
    const m = this.comfort.motion;
    const swayX = ((Math.sin(this.time * 1.7) * 0.03 + Math.sin(this.time * 4.3) * 0.012) * wind * hf + w.gust * 0.09 * Math.sin(this.time * 6.1) * hf) * m;
    const walking = (this.state === 'ground' || this.state === 'platform') && (this.input.move.x !== 0 || this.input.move.y !== 0);
    const swayY = (Math.sin(this.time * 2.3) * 0.015 * wind * hf + (this.onLadder ? Math.sin(this.time * 2.0) * 0.01 : 0) + (walking ? Math.abs(Math.sin(this.walkPhase)) * 0.035 : 0)) * m;
    const tremble = (this.slipping ? 0.012 : 0) * m; const sh = this.shake * 0.08 * m;
    const eye = this.state === 'dead' ? 0.4 : EYE;
    const dip = -0.07 * this.pullBob * m; // pull-up: the head dips as the arms take the load, then rises
    cam.position.set(this.pos.x + swayX + (Math.random() - 0.5) * (tremble + sh), this.pos.y + eye + swayY + dip + (Math.random() - 0.5) * (tremble + sh), this.pos.z + (Math.random() - 0.5) * sh);
    const roll = (m < 1 ? 0 : -swayX * 0.6 + (Math.random() - 0.5) * sh * 0.5) + (this.state === 'dead' ? 0.6 : 0);
    cam.rotation.order = 'YXZ'; cam.rotation.set((this.state === 'dead' ? -0.5 : this.pitch) - this.pullBob * 0.04 * m, this.yaw, roll);
    cam.fov = damp(cam.fov, this.comfort.fov + (this.state === 'falling' ? 12 : 0), 4, dt); cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
  private updateHands(dt: number) {
    const T = this.tower; const cam = this.camera; const show = this.state !== 'rest' && this.state !== 'dead';
    for (let i = 0; i < 2; i++) {
      const h = this.hands[i]; h.mesh.visible = show; if (!show) continue;
      const side = i === 0 ? -1 : 1; const tp = v1; const tq = q1;
      if (this.state === 'work') {
        tp.set(side * 0.22, -0.3 + Math.sin(this.time * 7 + i * 2) * 0.02, -0.45).applyMatrix4(cam.matrixWorld);
        tq.copy(cam.quaternion).multiply(q2.setFromEuler(e1.set(-1.2, 0, 0)));
      } else if (h.rung !== null && this.onLadder) {
        const y = T.rungY[h.rung]; tp.set(side * 0.19, y + 0.03, T.ladderZ(y) + 0.01);
        tq.setFromEuler(e1.set(-0.35, 0, -side * 0.08));
      } else {
        const bob = Math.sin(this.time * 2.5 + i) * 0.006; const reach = this.onLadder ? 0.12 : 0;
        tp.set(side * 0.26, -0.28 + bob + reach * 0.5, -0.5 - reach).applyMatrix4(cam.matrixWorld);
        tq.copy(cam.quaternion).multiply(q2.setFromEuler(e1.set(-0.9, side * 0.25, side * 0.3)));
      }
      h.pos.lerp(tp, 1 - Math.exp(-16 * dt)); h.quat.slerp(tq, 1 - Math.exp(-14 * dt)); h.mesh.position.copy(h.pos); h.mesh.quaternion.copy(h.quat);
    }
  }

  // ---------- debug helpers (headless tests) ----------
  /** One hand-over-hand cycle upward (or downward). Returns false if blocked. */
  debugCycle(up = true): boolean {
    if (this.state !== 'ladder') return false; this.pitch = up ? 0.9 : -0.9;
    const free = this.hands.findIndex((h) => h.rung === null); const hi = (free >= 0 ? free : 0) as 0 | 1;
    this.hands[hi].rung = null;
    if (!this.tryGrab(hi)) return false;
    this.hands[1 - hi].rung = null;
    return true;
  }
  debugClip() { this.tryClip(); return this.anchor; }
  debugTeleport(y: number) {
    this.state = 'ladder'; this.pos.set(0, y, this.tower.ladderZ(y) + 0.55); const i = this.tower.rungAt(y + CHEST + HAND_REST);
    this.hands[0].rung = i; this.hands[1].rung = i + 1; this.anchor = null; this.vel = 0; this.noHandsT = 0; this.work = null;
  }
}
