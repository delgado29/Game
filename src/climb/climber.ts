import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import { audio } from '../core/audio';
import type { Input } from '../core/input';
import type { Tower } from '../world/tower';
import { RUNG_STEP } from '../world/tower';
import type { Weather } from '../world/weather';
import { makeHand, makeClimberFigure } from '../world/props';
import { t } from '../core/i18n';
import { haptic } from '../core/haptics';

export type ClimbState = 'ground' | 'platform' | 'ladder' | 'falling' | 'dead' | 'rest' | 'repair';
export type ClimbEvent = 'clipped' | 'firstPlatform' | 'stepOnTop' | 'repaired' | 'repairFailed' | 'landed' | 'fell' | 'caught' | 'cut' | 'photo' | 'enterVan' | 'message';

export interface Perks { gloves: boolean; longLeash: boolean; rations: boolean; analyzer: boolean; tools: boolean; battery: boolean; camera: boolean; drone: boolean; wradio: boolean; weight: number; }
interface Hand { rung: number | null; mesh: THREE.Group; pos: THREE.Vector3; quat: THREE.Quaternion; snapT: number; }

const EYE = 1.62, CHEST = 1.28, HAND_REST = 0.5, G = 9.81; // hands settle HAND_REST above the chest

export class Climber {
  state: ClimbState = 'ground';
  pos = new THREE.Vector3(4, 0, 14);
  yaw = 0.3; pitch = 0.15;
  camera: THREE.PerspectiveCamera;
  hands: [Hand, Hand];
  figure: THREE.Group;
  stamina = 100; maxStamina = 100;
  anchor: number | null = null; // index into tower.anchors
  leash = 3.4;
  falls = 0; maxAlt = 0; elapsed = 0;
  repaired = false; repairStep = 0; repairT = 0; repairSteps: string[] = [];
  lastPlatform = -1;  // index of last platform reached (checkpoint)
  descending = false;
  prompt = ''; message = ''; messageT = 0; brace = false; slipping = false;
  arcWarn = 0;            // 0 no live box near, (0,1) warning ramp, 1 arcing within reach
  /** Comfort settings: base field of view and a motion scale (0.3 with reduce-motion on). */
  comfort = { fov: 72, motion: 1 };
  setComfort(fov: number, reduceMotion: boolean) { this.comfort = { fov, motion: reduceMotion ? 0.3 : 1 }; }
  /** Touch reach mode: 1 grabs upward from the other hand, -1 downward, 0 aims with the camera pitch (desktop). */
  reachDir: 1 | -1 | 0 = 0;
  shake = 0; flashRed = 0; deadT = 0;
  pullBob = 0;            // 1 right after a pull-up, decays; drives the camera dip
  private pullRate = 7;   // how fast the body follows the hands (slower with a heavy pack)
  private vel = 0; private noHandsT = 0; private fallT = 0; private slipT = 0; private restT = 0;
  private time = 0; private stepT = 0;
  private events: ((e: ClimbEvent, data?: unknown) => void)[] = [];
  private platformsSeen = new Set<number>();
  private cutWarned = false;
  perks: Perks = { gloves: false, longLeash: false, rations: false, analyzer: false, tools: true, battery: false, camera: false, drone: false, wradio: false, weight: 3 };

  constructor(private scene: THREE.Scene, public tower: Tower, private weather: Weather, private input: Input, private vanPos: THREE.Vector3) {
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 6000);
    const mk = (left: boolean): Hand => { const mesh = makeHand(left); scene.add(mesh); return { rung: null, mesh, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), snapT: 0 }; };
    this.hands = [mk(true), mk(false)];
    this.figure = makeClimberFigure(); this.figure.visible = false; scene.add(this.figure);
  }
  on(cb: (e: ClimbEvent, data?: unknown) => void) { this.events.push(cb); }
  private emit(e: ClimbEvent, data?: unknown) { for (const cb of this.events) cb(e, data); }
  setPerks(p: Perks) { this.perks = p; this.maxStamina = p.rations ? 130 : 100; this.stamina = this.maxStamina; this.leash = p.longLeash ? 4.6 : 3.4; this.pullRate = 7 / (1 + p.weight / 14); this.weather.warnLead = p.wradio ? 4.5 : 1.5; this.tower.showHazards(p.drone); }
  setTower(tower: Tower) { this.tower = tower; }
  dispose() { for (const h of this.hands) this.scene.remove(h.mesh); this.scene.remove(this.figure); }
  reset() {
    this.state = 'ground'; this.pos.set(this.vanPos.x - 2, 0, this.vanPos.z - 3); this.yaw = Math.atan2(this.pos.x, this.pos.z) ; this.pitch = 0.25; this.stamina = this.maxStamina; this.anchor = null; this.falls = 0; this.maxAlt = 0; this.elapsed = 0;
    this.repaired = false; this.repairStep = 0; this.repairT = 0; this.lastPlatform = -1; this.descending = false; this.platformsSeen.clear(); this.cutWarned = false; this.message = ''; this.prompt = '';
    for (const h of this.hands) { h.rung = null; }
    this.figure.visible = false; this.shake = 0; this.vel = 0;
  }
  get altitude() { return this.pos.y; }
  get chest() { return this.pos.y + CHEST; }
  get gripping() { return this.hands.filter((h) => h.rung !== null).length; }
  get onLadder() { return this.state === 'ladder' || this.state === 'falling'; }
  get anchorY() { return this.anchor === null ? null : this.tower.anchors[this.anchor]; }
  /** 0..1 how much of the lanyard is used up (0 when unclipped). */
  get leashFrac() { const ay = this.anchorY; return ay === null ? 0 : clamp(Math.abs(this.chest - ay) / this.leash, 0, 1); }
  say(key: string, dur = 2.2) { this.message = t(key); this.messageT = dur; }
  /** Keyboard hint for prompts; hidden on touch devices. */
  private k(key: string) { return this.input.isTouch ? '' : ` (${key})`; }

  // ---------- input handling ----------
  private handleLook(dt: number, invertY: boolean, sens: number) {
    const k = 0.0022 * sens; this.yaw -= this.input.lookX * k; this.pitch -= this.input.lookY * k * (invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.45, 1.45); void dt;
  }
  private forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  private right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  update(dt: number, invertY: boolean, sens: number) {
    dt = Math.min(dt, 0.05); this.time += dt; if (this.state !== 'dead' && this.state !== 'rest') this.elapsed += dt;
    if (this.state !== 'rest' && this.state !== 'dead') this.handleLook(dt, invertY, sens);
    if (this.messageT > 0) { this.messageT -= dt; if (this.messageT <= 0) this.message = ''; }
    this.shake = damp(this.shake, 0, 6, dt); this.flashRed = damp(this.flashRed, 0, 5, dt); this.pullBob = damp(this.pullBob, 0, 4.5, dt);
    this.prompt = ''; this.arcWarn = 0;
    switch (this.state) {
      case 'ground': this.updateWalk(dt, true); break;
      case 'platform': this.updateWalk(dt, false); break;
      case 'ladder': this.updateLadder(dt); break;
      case 'falling': this.updateFall(dt); break;
      case 'rest': this.updateRest(dt); break;
      case 'repair': this.updateRepair(dt); break;
      case 'dead': this.deadT += dt; break;
    }
    this.maxAlt = Math.max(this.maxAlt, this.pos.y);
    this.updateStamina(dt);
    this.updateCamera(dt);
    this.updateHands(dt);
  }

  // ---------- walking (ground & platforms) ----------
  private updateWalk(dt: number, ground: boolean) {
    const mv = this.input.move; const speed = 2.6;
    if (mv.x || mv.y) {
      const d = this.forward().multiplyScalar(mv.y).add(this.right().multiplyScalar(mv.x)).multiplyScalar(speed * dt);
      const np = this.pos.clone().add(d);
      if (ground) { if (Math.hypot(np.x, np.z) < 42 && !this.hitsTowerBase(np) && !this.hitsVan(np)) this.pos.copy(np); }
      else { const p = this.tower.platforms[this.lastPlatform]; const out = p.hw + 1.1 - 0.25, inn = p.hw - 0.15 + 0.25; const top = p.y === this.tower.topY;
        if (Math.abs(np.x) < out && Math.abs(np.z) < out && (top || Math.abs(np.x) > inn || Math.abs(np.z) > inn)) this.pos.copy(np); }
      this.stepT += dt * speed; if (this.stepT > 1.4) { this.stepT = 0; audio.step(!ground); }
    }
    if (ground) {
      const ladderFoot = new THREE.Vector3(0, 0, this.tower.ladderZ(0) + 0.55);
      if (this.pos.distanceTo(ladderFoot) < 1.4) { this.prompt = t('grabLadder'); if (this.input.pressed.has('act')) this.mountLadder(0); }
      const toVan = this.pos.distanceTo(this.vanPos); if (this.repaired && toVan < 3.2) { this.prompt = t('toVan'); if (this.input.pressed.has('act')) this.emit('enterVan'); }
    } else {
      const p = this.tower.platforms[this.lastPlatform]; const gapZ = p.hw + 1.1;
      if (Math.abs(this.pos.x) < 0.9 && this.pos.z > gapZ - 1.0) { this.prompt = t('grabLadder'); if (this.input.pressed.has('act')) this.mountLadder(p.y); }
      if (p.y === this.tower.topY && !this.repaired) { const d = this.pos.distanceTo(new THREE.Vector3(this.tower.transmitter.x, this.pos.y, this.tower.transmitter.z)); if (d < 2.0) { this.prompt = this.input.isTouch ? `${t('repair')} — ${t('hold')} ${t('tAct')}` : `${t('repair')} — ${t('hold')} F`; if (this.input.held.has('act')) this.startRepair(); } }
      if (this.input.pressed.has('rest')) this.startRest(); else if (!this.prompt) this.prompt = `${t('rest')}${this.k('V')}`;
    }
    if (this.input.pressed.has('photo') && this.perks.camera) this.emit('photo');
  }
  private hitsTowerBase(p: THREE.Vector3) { const hw = this.tower.hw(0) + 0.2; return Math.abs(p.x) < hw && Math.abs(p.z) < hw; }
  private hitsVan(p: THREE.Vector3) { const d = p.clone().sub(this.vanPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -(Math.PI + 0.35)); return Math.abs(d.x) < 1.3 && Math.abs(d.z) < 3.0; }
  private mountLadder(y: number) {
    this.state = 'ladder'; this.pos.set(0, y, this.tower.ladderZ(y) + 0.55); this.yaw = 0; this.pitch = 0.35; this.vel = 0; this.noHandsT = 0;
    const i = this.tower.rungAt(y + CHEST + HAND_REST); this.hands[0].rung = i; this.hands[1].rung = Math.min(i + 1, this.tower.rungY.length - 1); audio.grab();
  }

  // ---------- ladder ----------
  private updateLadder(dt: number) {
    const inp = this.input; const T = this.tower;
    // grabs and releases
    for (const [hi, act] of [[0, 'gripL'], [1, 'gripR']] as const) {
      const h = this.hands[hi];
      if (inp.pressed.has(act)) this.tryGrab(hi);
      if (inp.released.has(act) && h.rung !== null) { h.rung = null; audio.releaseHand(); }
      if (h.rung !== null && T.broken.has(h.rung) && !T.snapped.has(h.rung)) { h.snapT += dt; if (h.snapT > 0.35) { T.snapRung(h.rung); h.rung = null; h.snapT = 0; audio.snap(); haptic(50); this.say('rungSnap'); this.stamina -= 8; this.shake = 0.6; } } else h.snapT = 0;
    }
    // clip
    if (inp.pressed.has('clip')) this.tryClip();
    // body follows hands
    const held = this.hands.filter((h) => h.rung !== null);
    if (held.length) {
      const hy = held.reduce((s, h) => s + T.rungY[h.rung!], 0) / held.length; let target = hy - CHEST - HAND_REST - (held.length === 1 ? 0.15 : 0);
      target = this.clampLeash(target);
      this.pos.y = damp(this.pos.y, target, this.pullRate, dt); this.noHandsT = 0;
    } else {
      const ay = this.anchorY;
      if (ay !== null && this.chest <= ay - this.leash + 0.05) { /* hanging in the harness */ this.noHandsT = 0; }
      else { this.noHandsT += dt; if (this.noHandsT > 0.15) { this.state = 'falling'; this.vel = 0; this.fallT = 0; } }
    }
    this.pos.x = damp(this.pos.x, 0, 8, dt); this.pos.z = damp(this.pos.z, T.ladderZ(this.pos.y) + 0.55, 8, dt);
    // gust: one hand in a strong gust slips
    const g = this.weather.gust; this.brace = (this.weather.gustWarning || g > 0.45) && this.pos.y > 8;
    if (g > 0.6 && held.length === 1) { this.slipT += dt; if (this.slipT > 0.6 && Math.random() < dt * 1.6) { held[0].rung = null; audio.slip(); haptic([40, 30, 40]); this.say('slipping', 1.2); this.slipT = 0; } } else this.slipT = Math.max(0, this.slipT - dt);
    // electrical boxes: HUD warning within 3 m, shock within reach while arcing
    this.arcWarn = T.electrical.reduce((m, e, i) => Math.abs(this.chest - e.y) < 3 ? Math.max(m, T.arcPhase(i)) : m, 0);
    T.electrical.forEach((e, i) => { if (Math.abs(this.chest - e.y) < 1.15 && T.arcAt(i) && held.length) { for (const h of this.hands) h.rung = null; audio.shock(); haptic([30, 30, 30, 30, 30]); this.say('shocked', 1.5); this.stamina -= 18; this.shake = 1; this.flashRed = 1; } });
    // platform step-off
    const pi = T.platforms.findIndex((p) => Math.abs(this.pos.y - p.y) < 0.75);
    if (pi >= 0) { this.prompt = t('stepOff'); if (inp.pressed.has('act')) this.stepOnto(pi); }
    else if (this.pos.y < 0.4 && this.pos.y > -0.5) { this.prompt = t('stepDown'); if (inp.pressed.has('act')) { this.state = 'ground'; this.pos.y = 0; this.pos.z += 0.6; for (const h of this.hands) h.rung = null; this.anchor = null; if (this.repaired) this.emit('landed'); } }
    else this.promptLeash();
    if (inp.pressed.has('photo') && this.perks.camera) this.emit('photo');
    if (this.pos.y < -0.2) this.pos.y = 0;
  }
  private tryGrab(hi: 0 | 1) {
    const T = this.tower; const h = this.hands[hi]; if (h.rung !== null) return;
    const rest = this.pos.y + CHEST + HAND_REST; let reachY: number;
    if (this.reachDir !== 0) { const o = this.hands[1 - hi].rung; const base = o !== null ? T.rungY[o] : rest; reachY = clamp(base + this.reachDir * (o !== null ? 2 * RUNG_STEP : 0.6), rest - 1.1, rest + 1.1); }
    else reachY = rest + clamp(this.pitch / 1.1, -1, 1) * 0.9;
    const i = T.rungAt(reachY); if (T.snapped.has(i)) { audio.releaseHand(); return; }
    const y = T.rungY[i]; if (Math.abs(y - (this.pos.y + CHEST + HAND_REST)) > 1.15) return;
    // leash: refuse a grab that would drag the body past the rope
    const other = this.hands[1 - hi].rung; const meanY = other === null ? y : (y + T.rungY[other]) / 2; const target = meanY - CHEST - HAND_REST;
    if (this.clampLeash(target) !== target && Math.abs(this.clampLeash(target) - target) > 0.05) { this.say('reclip', 1.2); this.shake = Math.max(this.shake, 0.35); audio.ropeCreak(); return; }
    h.rung = i; h.snapT = 0; audio.grab(); haptic(10);
    if (this.state === 'ladder' && target > this.pos.y + 0.12) { this.pullBob = other === null ? 1 : 0.6; audio.pull(clamp(this.perks.weight / 9, 0, 1)); }
    if (this.state === 'falling' && this.vel < 4.5) { this.state = 'ladder'; this.stamina -= 22; this.shake = 0.5; this.vel = 0; }
  }
  private clampLeash(targetFeetY: number) { const ay = this.anchorY; if (ay === null) return targetFeetY; const c = targetFeetY + CHEST; return clamp(c, ay - this.leash, ay + this.leash) - CHEST; }
  private promptLeash() {
    const ay = this.anchorY; const near = this.nearestAnchor();
    if (ay === null) { if (near !== null) this.prompt = `${t('clipHint')}${this.k('Space')}`; }
    else if (Math.abs(this.chest - ay) > this.leash - 0.4) this.prompt = near !== null && near !== this.anchor ? `${t('reclip')}${this.k('Space')}` : t('noAnchor');
  }
  private nearestAnchor(): number | null { const A = this.tower.anchors; let best: number | null = null, bd = 1.35; for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - this.chest); if (d < bd) { bd = d; best = i; } } return best; }
  private tryClip() {
    const n = this.nearestAnchor();
    if (n === null) { this.say('noAnchor', 1.6); audio.releaseHand(); const inCut = this.tower.spec.cutAnchors.some(([a, b]) => this.chest > a - 1 && this.chest < b + 1); if (inCut && !this.cutWarned) { this.cutWarned = true; this.emit('cut'); } return; }
    if (n === this.anchor) return;
    const first = this.anchor === null; this.anchor = n; audio.clipIn(); haptic(20); if (first) this.emit('clipped');
  }
  private stepOnto(pi: number) {
    const p = this.tower.platforms[pi]; this.state = 'platform'; this.lastPlatform = pi; this.pos.set(0, p.y, p.hw + 0.55); for (const h of this.hands) h.rung = null; this.anchor = null; this.stepT = 0;
    if (!this.platformsSeen.has(pi)) { this.platformsSeen.add(pi); if (this.platformsSeen.size === 1) this.emit('firstPlatform'); if (p.y === this.tower.topY) this.emit('stepOnTop'); }
  }

  // ---------- falling ----------
  private updateFall(dt: number) {
    this.vel += G * dt; this.fallT += dt; this.pos.y -= this.vel * dt; this.pos.z = this.tower.ladderZ(Math.max(0, this.pos.y)) + 0.7;
    for (const [hi, act] of [[0, 'gripL'], [1, 'gripR']] as const) if (this.input.pressed.has(act)) this.tryGrab(hi);
    if (this.state !== 'falling') return;
    const ay = this.anchorY;
    if (ay !== null && this.chest <= ay - this.leash) { this.pos.y = ay - this.leash - CHEST; this.state = 'ladder'; this.vel = 0; this.falls++; this.stamina -= 22; this.shake = 1.4; audio.jerk(); haptic(80); this.say('caught', 2); this.emit('caught'); return; }
    if (this.pos.y <= 0) { this.pos.y = 0; if (this.vel < 8) this.stumble(); else this.die(); }
  }
  /** A short drop onto the ground: bruised, not dead. */
  private stumble() { this.state = 'ground'; this.pos.z += 0.6; this.falls++; this.stamina = Math.max(0, this.stamina - 30); this.shake = 1.2; this.flashRed = 0.6; this.anchor = null; this.vel = 0; for (const h of this.hands) h.rung = null; audio.jerk(); haptic(60); this.say('stumble', 2); }
  private die() { this.state = 'dead'; this.deadT = 0; this.falls++; audio.jerk(); this.emit('fell'); for (const h of this.hands) h.rung = null; }
  respawn() {
    if (this.lastPlatform >= 0) { const p = this.tower.platforms[this.lastPlatform]; this.state = 'platform'; this.pos.set(0, p.y, p.hw + 0.55); this.yaw = 0; }
    else { this.state = 'ground'; this.pos.set(0, 0, this.tower.ladderZ(0) + 2.5); this.yaw = 0; }
    this.anchor = null; this.stamina = this.maxStamina * 0.7; this.vel = 0; this.pitch = 0.2; this.shake = 0;
  }

  // ---------- rest / look down ----------
  private startRest() { this.state = 'rest'; this.restT = 0; this.figure.visible = true; this.figure.position.copy(this.pos); this.figure.rotation.y = this.yaw + Math.PI; audio.breath(); }
  private updateRest(dt: number) {
    this.restT += dt; this.prompt = t('stopRest');
    if (this.restT > 0.6 && (this.input.pressed.size > 0)) { this.state = 'platform'; this.figure.visible = false; }
    if (this.input.pressed.has('photo') && this.perks.camera) this.emit('photo');
  }

  // ---------- repair ----------
  private startRepair() {
    if (!this.perks.tools) { this.say('needTools', 3); this.emit('repairFailed', 'tools'); return; }
    const needsBattery = this.tower.spec.requires.includes('battery'); if (needsBattery && !this.perks.battery) { this.say('needBattery', 3); this.emit('repairFailed', 'battery'); return; }
    this.repairSteps = ['rOpen', needsBattery ? 'rBattery' : 'rFuse', 'rFeed', 'rTune']; this.repairStep = 0; this.repairT = 0; this.state = 'repair';
  }
  get repairProgress() { const dur = this.stepDur(); return this.state === 'repair' ? clamp(this.repairT / dur, 0, 1) : 0; }
  get repairLabel() { return this.state === 'repair' ? t(this.repairSteps[this.repairStep]) : ''; }
  private stepDur() { const k = this.repairSteps[this.repairStep]; return k === 'rTune' ? (this.perks.analyzer ? 0.6 : 4.5) : k === 'rBattery' ? 3 : 1.8; }
  private updateRepair(dt: number) {
    this.prompt = this.input.isTouch ? `${t('hold')} ${t('tAct')}` : `${t('hold')} F`;
    if (this.input.held.has('act')) { this.repairT += dt; if (this.repairT % 0.5 < dt) audio.click(); }
    else this.repairT = Math.max(0, this.repairT - dt * 0.6);
    if (this.repairT >= this.stepDur()) { this.repairStep++; this.repairT = 0; audio.clipIn(); if (this.repairStep >= this.repairSteps.length) { this.repaired = true; this.state = 'platform'; this.tower.setRepaired(); audio.powerUp(); this.emit('repaired'); this.say('rDone', 4); } }
    if (this.input.pressed.has('menu')) { this.state = 'platform'; }
  }

  // ---------- stamina ----------
  private updateStamina(dt: number) {
    const p = this.perks; const rain = this.weather.cur.rain; const wmul = 1 + p.weight / 12;
    let d = 0;
    if (this.state === 'ladder') { const n = this.gripping; d = 1.5 * wmul * (p.gloves ? 0.8 : 1) * (rain > 0.3 && !p.gloves ? 1.4 : 1) * (n === 1 ? 2.2 : n === 0 ? 0.6 : 1) * (1 + this.weather.gust * 1.1); }
    else if (this.state === 'platform' || this.state === 'rest' || this.state === 'repair') d = -(p.rations ? 18 : 12);
    else if (this.state === 'ground') d = -25;
    this.stamina = clamp(this.stamina - d * dt, 0, this.maxStamina);
    this.slipping = this.state === 'ladder' && this.stamina < 18;
    if (this.state === 'ladder' && this.stamina <= 0.01) { this.slipT += dt; if (this.slipT > 1.1) { const held = this.hands.filter((h) => h.rung !== null); if (held.length) { held[0].rung = null; audio.slip(); this.say('slipping', 1.2); } this.slipT = 0; } }
    audio.heartbeat(dt, this.state === 'ladder' && this.stamina < 35 ? lerp(1.0, 2.2, 1 - this.stamina / 35) : 0);
  }

  // ---------- camera & hands ----------
  private updateCamera(dt: number) {
    const cam = this.camera; const w = this.weather; const wind = w.windSpeed; const hf = clamp(this.pos.y / 60, 0, 1);
    if (this.state === 'rest') {
      const a = this.time * 0.25; const r = 3.2 + Math.sin(this.time * 0.13) * 0.6; const target = this.figure.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      cam.position.set(target.x + Math.cos(a) * r, target.y + 0.9 + Math.sin(this.time * 0.2) * 0.4, target.z + Math.sin(a) * r); cam.lookAt(target); cam.rotation.z = 0; return;
    }
    const m = this.comfort.motion;
    const swayX = ((Math.sin(this.time * 1.7) * 0.03 + Math.sin(this.time * 4.3) * 0.012) * wind * hf + w.gust * 0.09 * Math.sin(this.time * 6.1) * hf) * m;
    const swayY = (Math.sin(this.time * 2.3) * 0.015 * wind * hf + (this.onLadder ? Math.sin(this.time * 2.0) * 0.01 : 0)) * m;
    const tremble = (this.slipping ? 0.012 : 0) * m; const sh = this.shake * 0.08 * m;
    const eye = this.state === 'dead' ? 0.4 : EYE;
    const dip = -0.07 * this.pullBob * m; // pull-up: the head dips as the arms take the load, then rises
    cam.position.set(this.pos.x + swayX + (Math.random() - 0.5) * (tremble + sh), this.pos.y + eye + swayY + dip + (Math.random() - 0.5) * (tremble + sh), this.pos.z + (Math.random() - 0.5) * sh);
    const roll = (m < 1 ? 0 : -swayX * 0.6 + (Math.random() - 0.5) * sh * 0.5) + (this.state === 'dead' ? 0.6 : 0);
    cam.rotation.set(0, 0, 0); cam.rotation.order = 'YXZ'; cam.rotation.y = this.yaw; cam.rotation.x = (this.state === 'dead' ? -0.5 : this.pitch) - this.pullBob * 0.04; cam.rotation.z = roll;
    cam.fov = damp(cam.fov, this.comfort.fov + (this.state === 'falling' ? 12 : 0), 4, dt); cam.updateProjectionMatrix();
  }
  private updateHands(dt: number) {
    const T = this.tower; const cam = this.camera; const show = this.state !== 'rest' && this.state !== 'dead';
    this.hands.forEach((h, i) => {
      h.mesh.visible = show;
      let tp: THREE.Vector3, tq: THREE.Quaternion;
      if (h.rung !== null && this.onLadder) { const y = T.rungY[h.rung]; tp = new THREE.Vector3(i === 0 ? -0.19 : 0.19, y + 0.03, T.ladderZ(y) + 0.01); tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, i === 0 ? 0.08 : -0.08)); }
      else { const side = i === 0 ? -1 : 1; const bob = Math.sin(this.time * 2.5 + i) * 0.006; const reach = this.state === 'ladder' || this.state === 'falling' ? 0.12 : 0; const local = new THREE.Vector3(side * 0.26, -0.28 + bob + reach * 0.5, -0.5 - reach); tp = local.applyMatrix4(cam.matrixWorld); tq = cam.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, side * 0.25, side * 0.3))); }
      if (this.state === 'repair') { const side = i === 0 ? -1 : 1; tp = new THREE.Vector3(side * 0.22, -0.3 + Math.sin(this.time * 7 + i * 2) * 0.02, -0.45).applyMatrix4(cam.matrixWorld); tq = cam.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0, 0))); }
      h.pos.lerp(tp, 1 - Math.exp(-16 * dt)); h.quat.slerp(tq, 1 - Math.exp(-14 * dt)); h.mesh.position.copy(h.pos); h.mesh.quaternion.copy(h.quat);
    });
  }
  /** Debug helper: one hand-over-hand cycle upward (or downward). Returns false if blocked. */
  debugCycle(up = true): boolean {
    if (this.state !== 'ladder') return false; this.pitch = up ? 0.9 : -0.9;
    const held = this.hands.findIndex((h) => h.rung === null); const hi = (held >= 0 ? held : 0) as 0 | 1;
    if (this.hands[hi].rung !== null) { this.hands[hi].rung = null; }
    const before = this.hands[hi].rung; this.tryGrab(hi); if (this.hands[hi].rung === before) return false;
    const other = this.hands[1 - hi]; if (other.rung !== null) { other.rung = null; }
    return true;
  }
  debugClip() { this.tryClip(); return this.anchor; }
  debugTeleport(y: number) { this.state = 'ladder'; this.pos.set(0, y, this.tower.ladderZ(y) + 0.55); const i = this.tower.rungAt(y + CHEST + HAND_REST); this.hands[0].rung = i; this.hands[1].rung = i + 1; this.anchor = null; this.vel = 0; this.noHandsT = 0; }
}
export { RUNG_STEP };
