import * as THREE from 'three';
import css from './ui/styles.css';
import { Input } from './core/input';
import { audio } from './core/audio';
import { persist, resetSave, save } from './core/save';
import { setLang, t, pick } from './core/i18n';
import { clamp, damp } from './core/math';
import { Sky } from './world/sky';
import { Weather } from './world/weather';
import { Terrain } from './world/terrain';
import { Tower } from './world/tower';
import { Birds, makeVan } from './world/props';
import { Climber, type ClimbEvent } from './climb/climber';
import { TOWERS, towerById } from './game/towers';
import { packWeight } from './game/gear';
import type { RadioLine, TowerSpec } from './game/types';
import { Hud } from './ui/hud';
import { Touch } from './ui/touch';
import { Menus, type Screen } from './ui/menus';

const VAN_POS = new THREE.Vector3(7, 0, 13);

class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); menuCam = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
  sky: Sky; weather: Weather; terrain: Terrain; birds: Birds; van: THREE.Group; tower!: Tower; climber!: Climber;
  input: Input; hud: Hud; touch: Touch; menus: Menus;
  mode: 'menu' | 'climb' | 'debrief' = 'menu'; paused = false;
  private clock = new THREE.Clock(); private menuT = 0;
  private storyQueue: RadioLine[] = []; private storyFired = new Set<RadioLine>(); private lineT = 0; private staticT = 0;
  private litAnim = -1; private photoRequested = false; private deadShown = false; private fadeT = 0;
  spec: TowerSpec = TOWERS[0];

  constructor() {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const canvas = document.getElementById('gl') as HTMLCanvasElement; const ui = document.getElementById('ui')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    setLang(save.lang);
    this.input = new Input(canvas); if (this.input.isTouch) ui.classList.add('touch');
    this.sky = new Sky(this.scene); this.weather = new Weather(this.scene, this.sky); this.terrain = new Terrain(this.scene); this.birds = new Birds(this.scene);
    this.van = makeVan(); this.van.position.copy(VAN_POS); this.van.rotation.y = Math.PI + 0.35; this.scene.add(this.van);
    this.hud = new Hud(ui); this.touch = new Touch(ui, this.input, canvas);
    this.menus = new Menus(ui, {
      onStart: (id) => this.startClimb(id), onSetting: () => this.applySettings(), onReset: () => { resetSave(); this.applySettings(); this.loadTower(TOWERS[0]); },
      onResume: () => this.resume(), onAbandon: () => this.endClimb(false), onRespawn: () => { this.climber.respawn(); this.deadShown = false; this.menus.show('none'); this.resume(); },
      onToVan: () => this.toMenu(), onLock: () => this.resume(), onScreen: () => { /* */ },
    });
    this.loadTower(TOWERS[0]);
    this.applySettings();
    this.terrain.applyLit(save.completed['pinegrove'] ? 1 : 0);
    this.input.lockChanged((locked) => { if (this.mode === 'climb' && !locked && !this.paused && this.climber.state !== 'dead') this.pause(); });
    addEventListener('resize', () => this.resize()); this.resize();
    const unlock = () => audio.unlock(); addEventListener('pointerdown', unlock, { passive: true }); addEventListener('keydown', unlock);
    this.menus.show('van'); this.hud.show(false); audio.music(true, 0.8);
    this.renderer.setAnimationLoop(() => this.frame());
    if (this.input.isTouch) { const b = document.createElement('div'); b.className = 'tbtn sm'; b.textContent = '≡'; b.style.cssText = 'top: max(14px, env(safe-area-inset-top)); left: 50%; margin-left: -32px; width: 64px; height: 44px; border-radius: 12px;'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.mode === 'climb' && !this.paused) this.pause(); }); this.touch.root.appendChild(b); }
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.menuCam.aspect = w / h; this.menuCam.updateProjectionMatrix(); if (this.climber) { this.climber.camera.aspect = w / h; this.climber.camera.updateProjectionMatrix(); } }
  applySettings() { setLang(save.lang); audio.setEnabled(save.sound); this.hud.relabel(); this.touch.relabel(); if (this.menus.screen !== 'none') this.menus.show(this.menus.screen); }

  loadTower(spec: TowerSpec) {
    if (this.tower) this.scene.remove(this.tower.group); if (this.climber) this.climber.dispose();
    this.spec = spec; this.tower = new Tower(spec); this.scene.add(this.tower.group);
    this.climber = new Climber(this.scene, this.tower, this.weather, this.input, VAN_POS); this.climber.on((e, d) => this.onClimb(e, d)); this.climber.reset();
    this.weather.setScript(spec.weather); this.sky.sunElev = spec.sunElev; this.sky.sunAzimuth = spec.sunAzimuth; this.tower.repaired = !!save.completed[spec.id]; if (this.tower.repaired) this.tower.setRepaired();
    this.birds.center.set(30, spec.height * 0.45, -70); this.resize();
  }
  startClimb(id: string) {
    const spec = towerById(id); this.loadTower(spec); this.tower.repaired = false;
    const L = save.loadout; this.climber.setPerks({ gloves: L.includes('gloves'), longLeash: L.includes('carabiner'), rations: L.includes('rations'), analyzer: L.includes('analyzer'), tools: L.includes('tools'), battery: L.includes('battery'), camera: L.includes('camera'), drone: L.includes('drone'), wradio: L.includes('wradio'), weight: packWeight(L) });
    this.mode = 'climb'; this.paused = false; this.menus.show('none'); this.hud.show(true); this.touch.show(this.input.isTouch); this.hud.hideRadio();
    this.storyQueue = []; this.storyFired.clear(); this.lineT = 0; this.fadeT = 1; this.hud.fade(1); this.deadShown = false; this.litAnim = -1;
    audio.music(false); this.fireStory('start');
    save.totalClimbs++; persist();
    if (!this.input.isTouch) this.input.requestLock();
  }
  pause() { if (this.mode !== 'climb') return; this.paused = true; this.menus.show('pause'); this.input.releaseLock(); }
  resume() { this.paused = false; this.menus.show('none'); if (this.mode === 'climb' && !this.input.isTouch) this.input.requestLock(); }
  endClimb(success: boolean) {
    const c = this.climber; const spec = this.spec; const first = !save.completed[spec.id];
    const earned = success ? (first ? spec.reward : Math.round(spec.reward * 0.25)) : 0;
    if (success) { save.credits += earned; const prev = save.completed[spec.id]; save.completed[spec.id] = { time: c.elapsed, falls: c.falls, best: prev ? Math.min(prev.best, c.elapsed) : c.elapsed }; }
    let unlocked: string | null = null; if (success && spec.unlocks && !save.unlocked.includes(spec.unlocks)) { save.unlocked.push(spec.unlocks); unlocked = spec.unlocks; }
    persist(); this.input.releaseLock(); this.paused = false; this.hud.show(false); this.touch.show(false); this.hud.hideRadio();
    if (success) { this.mode = 'debrief'; this.menus.show('debrief', { towerId: spec.id, success, time: c.elapsed, falls: c.falls, maxAlt: c.maxAlt, earned, photos: save.photos.length, unlocked }); audio.music(true, 0.6); }
    else this.toMenu();
  }
  toMenu() { this.mode = 'menu'; this.paused = false; this.menuT = 0; const next = TOWERS.find((tw) => save.unlocked.includes(tw.id) && !save.completed[tw.id]) ?? this.spec; this.loadTower(next); this.hud.show(false); this.touch.show(false); this.menus.show('van'); this.hud.show(false); audio.music(true, 0.8); this.terrain.applyLit(save.completed['pinegrove'] ? 1 : 0); }

  // ---------- events & story ----------
  private onClimb(e: ClimbEvent, d?: unknown) {
    switch (e) {
      case 'clipped': this.fireStory('clipped'); break;
      case 'firstPlatform': this.fireStory('firstPlatform'); break;
      case 'stepOnTop': this.fireStory('stepOnTop'); break;
      case 'cut': this.fireStory('cut'); break;
      case 'repaired': this.weather.event('repaired'); this.fireStory('repaired'); this.climber.descending = true; if (this.terrain.lit < 1) this.litAnim = 0; break;
      case 'repairFailed': break;
      case 'landed': this.fireStory('landed'); break;
      case 'enterVan': this.endClimb(true); break;
      case 'fell': break;
      case 'photo': this.photoRequested = true; break;
      default: void d;
    }
  }
  private fireStory(at: RadioLine['at'], value?: number) {
    for (const l of this.spec.story) { if (this.storyFired.has(l) || l.at !== at) continue; if (value !== undefined && l.value !== undefined && ((at === 'alt' && value < l.value) || (at === 'descentAlt' && value > l.value))) continue; this.storyFired.add(l); this.storyQueue.push(l); }
  }
  private updateStory(dt: number) {
    const c = this.climber; if (!c.descending) this.fireStory('alt', c.altitude); else this.fireStory('descentAlt', c.altitude);
    if (this.spec.sabotaged && c.altitude > this.spec.height * 0.83) this.fireStory('strange');
    if (this.lineT > 0) { this.lineT -= dt; return; }
    if (this.staticT > 0) { this.staticT -= dt; return; }
    const next = this.storyQueue[0]; if (!next) return;
    if (this.weather.radioDead > 0 && next.who !== 'you') { this.hud.static_(1.5); this.staticT = 2.2; return; }
    this.storyQueue.shift(); const text = pick(next.en, next.es); const dur = 2.6 + text.split(' ').length * 0.34; this.lineT = dur + 0.8;
    if (next.who !== 'you') audio.radioSquelch(); this.hud.say(text, next.who ?? 'dispatch', dur);
  }
  private takePhoto() {
    const src = this.renderer.domElement; const w = 640, h = Math.round((640 * src.height) / src.width); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.drawImage(src, 0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#7fe3ff'; g.font = 'bold 12px monospace'; g.fillText(`${this.spec.name.toUpperCase()}  ALT ${this.climber.altitude.toFixed(0)} m  ${new Date().toISOString().slice(0, 10)}`, 8, h - 7);
    try { save.photos.push(c.toDataURL('image/jpeg', 0.72)); if (save.photos.length > 12) save.photos.shift(); persist(); } catch { /* */ }
    this.climber.say('photoSaved', 1.5); audio.click();
  }

  // ---------- frame ----------
  private frame() { const dt = Math.min(this.clock.getDelta(), 0.1); const cam = this.update(dt); this.renderer.render(this.scene, cam); if (this.photoRequested) { this.photoRequested = false; this.takePhoto(); } this.input.endFrame(); }
  /** Advances simulation time without rendering (headless tests). */
  sim(seconds: number, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) { this.update(dt); this.input.endFrame(); } }
  update(dt: number): THREE.Camera {
    this.input.update();
    const c = this.climber; let cam: THREE.Camera;
    if (this.mode === 'climb' && !this.paused) {
      c.update(dt, save.invertY, save.sens);
      this.sky.sunElev = this.spec.sunElev + this.spec.sunRate * c.elapsed;
      if (this.input.pressed.has('menu') && c.state !== 'dead') this.pause();
      this.updateStory(dt);
      if (c.state === 'dead' && !this.deadShown && c.deadT > 1.4) { this.deadShown = true; this.menus.show('dead'); this.input.releaseLock(); }
      this.hud.update(dt, c, this.weather, c.repaired ? t('objVan') : t('objTop'));
      this.fadeT = damp(this.fadeT, 0, 2, dt); this.hud.fade(c.state === 'dead' ? clamp(c.deadT / 1.2, 0, 0.85) : this.fadeT);
      cam = c.camera;
    } else if (this.mode === 'climb') { cam = c.camera; }
    else {
      this.menuT += dt; const a = this.menuT * 0.08 + 0.6; const r = 10.5; const tgt = VAN_POS.clone().add(new THREE.Vector3(-3, 1.6, -4));
      this.menuCam.position.set(VAN_POS.x + Math.cos(a) * r, 2.4 + Math.sin(this.menuT * 0.11) * 0.5, VAN_POS.z + Math.sin(a) * r); this.menuCam.lookAt(tgt); cam = this.menuCam;
      this.sky.sunElev = this.spec.sunElev * 0.35; this.sky.sunAzimuth = this.spec.sunAzimuth;
    }
    const camPos = (cam as THREE.PerspectiveCamera).position;
    this.weather.update(dt, camPos, this.mode === 'climb' ? c.altitude : 0);
    this.sky.update(dt, camPos, this.weather.cur.rain); this.tower.update(dt); this.birds.update(dt);
    if (this.litAnim >= 0) { this.litAnim += dt / 9; this.terrain.lit = clamp(this.litAnim, 0, 1); this.terrain.applyLit(this.terrain.lit); if (this.litAnim >= 1) { this.litAnim = -1; audio.music(true, 0.5); } }
    const nearTx = this.mode === 'climb' && c.repaired && c.pos.distanceTo(this.tower.transmitter) < 6 ? 1 : 0;
    const buzz = this.mode === 'climb' ? this.tower.electrical.reduce((m, e, i) => Math.max(m, this.tower.arcAt(i) * clamp(1 - Math.abs(c.chest - e.y) / 6, 0, 1)), 0) : 0;
    audio.ambience(dt, this.weather.cur.wind, this.weather.gust, this.mode === 'climb' ? c.altitude : 2, this.weather.cur.rain, nearTx, buzz, this.weather.radioDead > 0 && this.staticT > 0 ? 1 : 0);
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
};
