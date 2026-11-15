import * as THREE from 'three';
import css from './ui/styles.css';
import { Input } from './core/input';
import { audio } from './core/audio';
import { persist, resetSave, save, type Checkpoint } from './core/save';
import { setLang, t } from './core/i18n';
import { clamp, damp } from './core/math';
import { AutoScaler, resolveQuality, type Quality } from './core/quality';
import { Sky } from './world/sky';
import { Weather } from './world/weather';
import { Terrain } from './world/terrain';
import { Tower } from './world/tower';
import { Post } from './world/post';
import { Birds, makeVan } from './world/props';
import { Climber, type ClimbEvent } from './climb/climber';
import { TOWERS, towerById } from './game/towers';
import { buildPerks } from './game/gear';
import { B } from './game/balance';
import { Radio } from './game/story';
import { Tutorial } from './game/tutorial';
import type { TowerSpec } from './game/types';
import { Hud } from './ui/hud';
import { Touch } from './ui/touch';
import { Menus, type Screen } from './ui/menus';

const VAN_POS = new THREE.Vector3(7, 0, 13);
const VAN_YAW = Math.PI + 0.35;

class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); menuCam = new THREE.PerspectiveCamera(50, 1, 0.1, 9000);
  quality: Quality; post: Post; private scaler = new AutoScaler();
  sky: Sky; weather: Weather; terrain: Terrain; birds: Birds; van: THREE.Group; tower!: Tower; climber!: Climber;
  input: Input; hud: Hud; touch: Touch; menus: Menus; radio: Radio; tutorial = new Tutorial();
  mode: 'menu' | 'climb' | 'debrief' = 'menu'; paused = false;
  spec: TowerSpec = TOWERS[0];
  private clock = new THREE.Clock(); private menuT = 0; private time = 0;
  private litAnim = -1; private photoRequested = false; private deadShown = false; private fadeT = 0;

  constructor() {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const canvas = document.getElementById('gl') as HTMLCanvasElement; const ui = document.getElementById('ui')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    setLang(save.lang);
    this.input = new Input(canvas); if (this.input.isTouch) ui.classList.add('touch');
    this.quality = resolveQuality(save.quality, this.input.isTouch);
    this.post = new Post(this.renderer, this.scene, this.quality);
    this.sky = new Sky(this.scene); this.weather = new Weather(this.scene, this.sky); this.terrain = new Terrain(this.scene); this.birds = new Birds(this.scene);
    this.van = makeVan(); this.van.position.copy(VAN_POS); this.van.rotation.y = VAN_YAW; this.scene.add(this.van);
    this.hud = new Hud(ui); this.touch = new Touch(ui, this.input, canvas);
    this.radio = new Radio(this.hud, () => this.weather.radioDead > 0);
    this.touch.bindDir(() => (this.climber ? this.climber.reachDir : 1), () => { if (this.climber && this.climber.reachDir !== 0) this.climber.reachDir = this.climber.reachDir > 0 ? -1 : 1; });
    this.menus = new Menus(ui, {
      onStart: (id) => this.startClimb(id), onResumeClimb: () => this.resumeClimb(),
      onSetting: () => this.applySettings(), onReset: () => { resetSave(); this.applySettings(); this.loadTower(TOWERS[0]); },
      onResume: () => this.resume(), onAbandon: () => this.endClimb(false),
      onRespawn: () => { this.climber.respawn(); this.deadShown = false; this.menus.show('none'); this.resume(); },
      onToVan: () => this.toMenu(),
    });
    this.loadTower(this.nextTower());
    this.applySettings();
    this.terrain.applyLit(save.completed['pinegrove'] ? 1 : 0);
    this.input.lockChanged((locked) => { if (this.mode === 'climb' && !locked && !this.paused && this.climber.state !== 'dead') this.pause(); });
    addEventListener('resize', () => this.resize()); this.resize();
    const unlock = () => audio.unlock(); addEventListener('pointerdown', unlock, { passive: true }); addEventListener('keydown', unlock);
    // a hidden tab must not keep climbing or making noise
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.mode === 'climb' && !this.paused && this.climber.state !== 'dead') this.pause(); audio.suspend(); }
      else { audio.resume(); this.clock.getDelta(); }
    });
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => { this.post.setQuality(this.quality); this.resize(); });
    this.menus.show('van'); this.hud.show(false); audio.music(true, 0.8);
    this.renderer.setAnimationLoop(() => this.frame());
    if (this.input.isTouch) {
      const b = document.createElement('div'); b.className = 'tbtn sm'; b.textContent = '≡';
      b.style.cssText = 'top: max(14px, env(safe-area-inset-top)); left: 50%; margin-left: -32px; width: 64px; height: 44px; border-radius: 12px;';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.mode === 'climb' && !this.paused) this.pause(); }); this.touch.root.appendChild(b);
    }
  }
  private nextTower() { return TOWERS.find((tw) => save.unlocked.includes(tw.id) && !save.completed[tw.id]) ?? TOWERS.find((tw) => save.unlocked.includes(tw.id)) ?? TOWERS[0]; }
  resize() {
    const w = innerWidth, h = innerHeight; const dpr = Math.min(devicePixelRatio, this.quality.dpr) * (this.quality.auto ? this.scaler.scale : 1);
    this.post.setSize(w, h, dpr);
    this.menuCam.aspect = w / h; this.menuCam.updateProjectionMatrix();
    if (this.climber) { this.climber.camera.aspect = w / h; this.climber.camera.updateProjectionMatrix(); }
  }
  applySettings() {
    setLang(save.lang); audio.setEnabled(save.sound); this.hud.relabel(); this.touch.relabel();
    this.touch.setLefty(save.leftHanded); document.getElementById('ui')!.classList.toggle('lefty', save.leftHanded);
    const q = resolveQuality(save.quality, this.input.isTouch);
    if (q.level !== this.quality.level || q.auto !== this.quality.auto) { this.quality = q; this.scaler = new AutoScaler(); this.post.setQuality(q); this.resize(); }
    if (this.climber) { this.climber.setComfort(save.fov, save.reduceMotion); this.climber.tapGrip = save.tapGrip; }
    if (this.menus.screen !== 'none') this.menus.show(this.menus.screen);
  }

  loadTower(spec: TowerSpec) {
    if (this.tower) this.scene.remove(this.tower.group); if (this.climber) this.climber.dispose();
    this.spec = spec; this.tower = new Tower(spec); this.scene.add(this.tower.group);
    this.climber = new Climber(this.scene, this.tower, this.weather, this.input, VAN_POS, VAN_YAW); this.climber.on((e, d) => this.onClimb(e, d)); this.climber.reset();
    this.weather.setScript(spec.weather); this.sky.sunElev = spec.sunElev; this.sky.sunAzimuth = spec.sunAzimuth;
    if (save.completed[spec.id]) this.tower.setRepaired();
    this.birds.center.set(30, spec.height * 0.45, -70); this.resize();
  }
  startClimb(id: string, resume: Checkpoint | null = null) {
    const spec = towerById(id); this.loadTower(spec); this.tower.repaired = false; this.tower.setRepaired(false);
    const c = this.climber;
    c.setPerks(buildPerks(save.loadout)); c.setComfort(save.fov, save.reduceMotion); c.tapGrip = save.tapGrip;
    c.reachDir = this.input.isTouch ? 1 : 0;
    c.txSteps = ['rOpen', spec.requires.includes('battery') ? 'rBattery' : 'rFuse', 'rFeed', 'rTune'];
    this.radio.reset(spec.story); this.tutorial.stop();
    if (resume) {
      const py = this.tower.platforms[resume.platform]?.y ?? 0;
      c.restoreAt(Math.min(resume.platform, this.tower.platforms.length - 1), resume);
      const heard = new Set(['start', 'clipped', 'firstPlatform']); const late = new Set(['stepOnTop', 'repaired', 'cut', 'strange']);
      this.radio.skip((l) => heard.has(l.at) || (l.at === 'alt' && (l.value ?? 0) <= py) || (resume.repaired && (late.has(l.at) || l.at === 'alt')));
      if (resume.repaired) { this.tower.setRepaired(); this.weather.event('repaired'); this.weather.jump(); c.reachDir = c.reachDir === 0 ? 0 : -1; }
    } else {
      this.radio.fire('start'); save.totalClimbs++; save.stats.climbs++;
      if (spec.id === TOWERS[0].id) this.tutorial.start();
    }
    this.mode = 'climb'; this.paused = false; this.menus.show('none'); this.hud.show(true); this.touch.show(this.input.isTouch); this.hud.hideRadio();
    this.fadeT = 1; this.hud.fade(1); this.deadShown = false; this.litAnim = -1;
    audio.music(false); persist();
    if (!this.input.isTouch) this.input.requestLock();
  }
  resumeClimb() { const cp = save.checkpoint; if (cp && TOWERS.some((tw) => tw.id === cp.towerId)) this.startClimb(cp.towerId, cp); }
  pause() { if (this.mode !== 'climb') return; this.paused = true; this.menus.show('pause'); this.input.releaseLock(); }
  resume() { this.paused = false; this.menus.show('none'); if (this.mode === 'climb' && !this.input.isTouch) this.input.requestLock(); }
  endClimb(success: boolean) {
    const c = this.climber; const spec = this.spec; const first = !save.completed[spec.id];
    const earned = success ? (first ? spec.reward : Math.round(spec.reward * 0.25)) : 0;
    const st = save.stats; st.falls += c.falls; st.clips += c.clips; st.seconds += Math.round(c.elapsed); st.meters += Math.round(c.maxAlt);
    if (success) {
      save.credits += earned; st.repairs++;
      const prev = save.completed[spec.id]; save.completed[spec.id] = { time: c.elapsed, falls: c.falls, best: prev ? Math.min(prev.best, c.elapsed) : c.elapsed };
    }
    let unlocked: string | null = null; if (success && spec.unlocks && !save.unlocked.includes(spec.unlocks)) { save.unlocked.push(spec.unlocks); unlocked = spec.unlocks; }
    save.checkpoint = null; persist();
    this.input.releaseLock(); this.paused = false; this.hud.show(false); this.touch.show(false); this.hud.hideRadio(); this.tutorial.stop();
    if (success) { this.mode = 'debrief'; this.menus.show('debrief', { towerId: spec.id, success, time: c.elapsed, falls: c.falls, maxAlt: c.maxAlt, earned, photos: save.photos.length, unlocked }); audio.music(true, 0.6); }
    else this.toMenu();
  }
  toMenu() {
    this.mode = 'menu'; this.paused = false; this.menuT = 0; this.loadTower(this.nextTower());
    this.hud.show(false); this.touch.show(false); this.menus.show('van'); audio.music(true, 0.8);
    this.terrain.applyLit(save.completed['pinegrove'] ? 1 : 0);
  }

  // ---------- events ----------
  private onClimb(e: ClimbEvent, d?: unknown) {
    const c = this.climber;
    switch (e) {
      case 'clipped': this.radio.fire('clipped'); break;
      case 'firstPlatform': this.radio.fire('firstPlatform'); break;
      case 'stepOnTop': this.radio.fire('stepOnTop'); break;
      case 'cut': this.radio.fire('cut'); break;
      case 'platform':
        save.checkpoint = { towerId: this.spec.id, contract: null, platform: d as number, repaired: c.repaired, elapsed: c.elapsed, falls: c.falls, maxAlt: c.maxAlt, inspected: [] };
        persist(); break;
      case 'repaired':
        this.weather.event('repaired'); this.radio.fire('repaired');
        if (c.reachDir !== 0) { c.reachDir = -1; this.touch.refreshDir(); }
        if (this.terrain.lit < 1) this.litAnim = 0;
        if (save.checkpoint) { save.checkpoint.repaired = true; persist(); }
        break;
      case 'landed': this.radio.fire('landed'); break;
      case 'enterVan': this.endClimb(true); break;
      case 'photo': this.photoRequested = true; break;
      default: break;
    }
  }
  private takePhoto() {
    const src = this.renderer.domElement; const w = 640, h = Math.round((640 * src.height) / src.width);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; g.drawImage(src, 0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#7fe3ff'; g.font = 'bold 12px monospace';
    g.fillText(`${this.spec.name.toUpperCase()}  ALT ${this.climber.altitude.toFixed(0)} m  ${new Date().toISOString().slice(0, 10)}`, 8, h - 7);
    try { save.photos.push({ src: cv.toDataURL('image/jpeg', 0.72) }); if (save.photos.length > B.maxPhotos) save.photos.shift(); save.stats.photos++; persist(); } catch { /* canvas tainted or storage full */ }
    this.climber.say('photoSaved', 1.5); audio.click();
  }

  // ---------- frame ----------
  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1); if (document.hidden) return;
    const cam = this.update(dt); const c = this.climber; const climbing = this.mode === 'climb';
    this.post.render(cam, { rain: climbing ? this.weather.cur.rain : this.weather.cur.rain * 0.4, aberration: climbing ? clamp(c.shake * 0.8 + c.flashRed, 0, 1.5) * c.comfort.motion : 0, time: this.time });
    if (this.photoRequested) { this.photoRequested = false; this.takePhoto(); }
    this.input.endFrame();
    if (this.quality.auto && !this.paused && this.scaler.sample(dt)) this.resize();
  }
  /** Advances simulation time without rendering (headless tests). */
  sim(seconds: number, dt = 1 / 60) { for (let s = 0; s < seconds; s += dt) { this.update(dt); this.input.endFrame(); } }
  update(dt: number): THREE.Camera {
    this.input.update(); this.time += dt;
    const c = this.climber; let cam: THREE.Camera;
    if (this.mode === 'climb' && !this.paused) {
      c.update(dt, save.invertY, save.sens);
      this.sky.sunElev = this.spec.sunElev + this.spec.sunRate * c.elapsed;
      if (this.input.pressed.has('menu') && c.state !== 'dead') this.pause();
      if (!c.descending) this.radio.fire('alt', c.altitude); else this.radio.fire('descentAlt', c.altitude);
      if (this.spec.sabotaged && c.altitude > this.spec.height * 0.83) this.radio.fire('strange');
      this.radio.update(dt);
      if (c.state === 'dead' && !this.deadShown && c.deadT > 1.4) { this.deadShown = true; this.menus.show('dead'); this.input.releaseLock(); }
      this.hud.update(dt, c, this.weather, c.repaired ? t('objVan') : t('objTop'), this.tutorial.update(dt, c, this.input), '');
      this.fadeT = damp(this.fadeT, 0, 2, dt); this.hud.fade(c.state === 'dead' ? clamp(c.deadT / 1.2, 0, 0.85) : this.fadeT);
      cam = c.camera;
    } else if (this.mode === 'climb') cam = c.camera;
    else {
      this.menuT += dt; const a = this.menuT * 0.08 + 0.6; const r = 10.5;
      this.menuCam.position.set(VAN_POS.x + Math.cos(a) * r, 2.4 + Math.sin(this.menuT * 0.11) * 0.5, VAN_POS.z + Math.sin(a) * r);
      this.menuCam.lookAt(VAN_POS.x - 3, 1.6, VAN_POS.z - 4); cam = this.menuCam;
      this.sky.sunElev = this.spec.sunElev * 0.35; this.sky.sunAzimuth = this.spec.sunAzimuth;
    }
    const camPos = (cam as THREE.PerspectiveCamera).position; const climbing = this.mode === 'climb';
    this.weather.update(dt, camPos, climbing ? c.altitude : 0);
    this.sky.update(dt, camPos, this.weather.cur.rain); this.tower.update(dt); this.birds.update(dt);
    if (this.litAnim >= 0) {
      this.litAnim += dt / 9; this.terrain.lit = clamp(this.litAnim, 0, 1); this.terrain.applyLit(this.terrain.lit);
      if (this.litAnim >= 1) { this.litAnim = -1; audio.music(true, 0.5); }
    }
    const nearTx = climbing && c.repaired && c.pos.distanceTo(this.tower.transmitter) < 6 ? 1 : 0;
    let buzz = 0; if (climbing) for (let i = 0; i < this.tower.electrical.length; i++) buzz = Math.max(buzz, this.tower.arcPhase(i) * clamp(1 - Math.abs(c.chest - this.tower.electrical[i].y) / 6, 0, 1));
    audio.ambience(dt, this.weather.cur.wind, this.weather.gust, climbing ? c.altitude : 2, this.weather.cur.rain, nearTx, buzz, this.weather.radioDead > 0 && this.radio.staticOn ? 1 : 0);
    return cam;
  }
}

const game = new Game();
// Debug / test API
(window as unknown as { SIGNAL: unknown }).SIGNAL = {
  game, save, TOWERS,
  get climber() { return game.climber; }, get tower() { return game.tower; }, get weather() { return game.weather; },
  start: (id: string) => game.startClimb(id),
  cycle: (n = 1, up = true) => { let ok = 0; for (let i = 0; i < n; i++) if (game.climber.debugCycle(up)) ok++; return ok; },
  clip: () => game.climber.debugClip(), teleport: (y: number) => game.climber.debugTeleport(y),
  press: (a: string) => game.input.press(a as never), release: (a: string) => game.input.release(a as never),
  setWeather: (w: { cloud: number; rain: number; wind: number; storm: number }, over = 1) => game.weather.setTarget(w, over),
  screen: (s: Screen) => game.menus.show(s),
  sim: (seconds: number, dt?: number) => game.sim(seconds, dt),
  /** Deterministic probes: no wind, no gusts, no storm. */
  calm: () => { game.weather.setTarget({ cloud: 0.3, rain: 0, wind: 0, storm: 0 }, 1); game.weather.calm(); },
};
