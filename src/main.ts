import * as THREE from 'three';
import css from './ui/styles.css';
import { Input } from './core/input';
import { audio } from './core/audio';
import { persist, resetSave, save, type Checkpoint } from './core/save';
import { pick, setLang, t } from './core/i18n';
import { clamp, damp, fmtTime, rng } from './core/math';
import { AutoScaler, resolveQuality, type Quality } from './core/quality';
import { Sky } from './world/sky';
import { Weather } from './world/weather';
import { Terrain, TOWN } from './world/terrain';
import { Tower, type WorkPoint } from './world/tower';
import { Post } from './world/post';
import { Birds, makeVan } from './world/props';
import { Climber, type ClimbEvent } from './climb/climber';
import { TOWERS, towerById } from './game/towers';
import { buildPerks, gearById } from './game/gear';
import { B } from './game/balance';
import { Radio } from './game/story';
import { Tutorial } from './game/tutorial';
import { Ledger, MEDALS, foundOn, gearAtRank, rankName, rankOf, type MedalId } from './game/career';
import { KINDS, applyContract, contractDone, contractSteps, dailyContracts, markDone, setDay, type Contract } from './game/contracts';
import { matchGoal, type PhotoCtx } from './game/photos';
import type { TowerSpec } from './game/types';
import { Hud } from './ui/hud';
import { Touch } from './ui/touch';
import { Menus, jobName, type Job, type Screen } from './ui/menus';

const VAN_POS = new THREE.Vector3(7, 0, 13);
const VAN_YAW = Math.PI + 0.35;
const FRAGMENT_IDS = TOWERS.flatMap((tw) => tw.collectibles.filter((c) => c.kind === 'fragment').map((c) => c.id));

/** State of the climb in progress. */
interface Run { job: Job; base: TowerSpec; ledger: Ledger; xpBefore: number; inspectTotal: number; inspected: number[]; }

class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); menuCam = new THREE.PerspectiveCamera(50, 1, 0.1, 9000);
  quality: Quality; post: Post; private scaler = new AutoScaler();
  sky: Sky; weather: Weather; terrain: Terrain; birds: Birds; van: THREE.Group; tower!: Tower; climber!: Climber;
  input: Input; hud: Hud; touch: Touch; menus: Menus; radio: Radio; tutorial = new Tutorial();
  mode: 'menu' | 'climb' | 'debrief' = 'menu'; paused = false;
  /** The tower as it stands in the world right now (a contract may have changed its weather and light). */
  spec: TowerSpec = TOWERS[0];
  run: Run | null = null;
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
      onStart: (job) => this.startClimb(job), onResumeClimb: () => this.resumeClimb(),
      onSetting: () => this.applySettings(), onReset: () => { resetSave(); this.applySettings(); this.loadTower(TOWERS[0]); },
      onResume: () => this.resume(), onAbandon: () => this.endClimb(false),
      onRespawn: () => { this.climber.respawn(); this.deadShown = false; this.menus.show('none'); this.resume(); },
      onToVan: () => this.toMenu(),
    });
    this.checkUnlocks();
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

  // ---------- jobs ----------
  loadTower(spec: TowerSpec) {
    if (this.tower) this.scene.remove(this.tower.group); if (this.climber) this.climber.dispose();
    this.spec = spec; this.tower = new Tower(spec); this.scene.add(this.tower.group);
    this.climber = new Climber(this.scene, this.tower, this.weather, this.input, VAN_POS, VAN_YAW); this.climber.on((e, d) => this.onClimb(e, d)); this.climber.reset();
    this.weather.setScript(spec.weather); this.sky.sunElev = spec.sunElev; this.sky.sunAzimuth = spec.sunAzimuth;
    if (save.completed[spec.id]) this.tower.setRepaired();
    this.birds.center.set(30, spec.height * 0.45, -70); this.resize();
  }
  startClimb(job: Job, resume: Checkpoint | null = null) {
    const base = towerById(job.towerId); const ct = job.contract; const spec = ct ? applyContract(ct) : base;
    this.loadTower(spec); this.tower.setRepaired(false);
    const c = this.climber; const T = this.tower;
    c.setPerks(buildPerks(save.loadout)); c.setComfort(save.fov, save.reduceMotion); c.tapGrip = save.tapGrip;
    c.reachDir = this.input.isTouch ? 1 : 0;
    c.txSteps = ct ? contractSteps(ct) : ['rOpen', base.requires.includes('battery') ? 'rBattery' : 'rFuse', 'rFeed', 'rTune'];
    const run: Run = this.run = { job, base, ledger: new Ledger(), xpBefore: save.xp, inspectTotal: 0, inspected: resume?.inspected.slice() ?? [] };
    // things still to find on this tower
    const taken = new Set<string>();
    for (const col of base.collectibles) {
      taken.add(`${col.platform}:${col.corner}`);
      if (!(col.kind === 'page' ? save.pages : save.fragments).includes(col.id)) T.addPoint(col.id, col.kind, col.platform, col.corner);
    }
    if (ct?.kind === 'inspect') {
      const n = T.platforms.length; const idx = n <= 3 ? T.platforms.map((_, i) => i) : [Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
      const r = rng(ct.id.length * 7919 + ct.id.charCodeAt(ct.id.length - 1));
      idx.forEach((pi, i) => {
        let corner = r.int(4); for (let k = 0; k < 4 && taken.has(`${pi}:${corner}`); k++) corner = (corner + 1) % 4;
        const pt = T.addPoint(`inspect-${i}`, 'inspect', pi, corner); if (run.inspected.includes(i)) T.completePoint(pt);
      });
      run.inspectTotal = idx.length;
    }
    this.radio.reset(spec.story); this.tutorial.stop();
    if (resume) {
      const pi = Math.min(resume.platform, T.platforms.length - 1); const py = T.platforms[pi].y;
      c.restoreAt(pi, resume);
      const heard = new Set(['start', 'clipped', 'firstPlatform']); const late = new Set(['stepOnTop', 'repaired', 'cut', 'strange']);
      this.radio.skip((l) => heard.has(l.at) || (l.at === 'alt' && (l.value ?? 0) <= py) || (resume.repaired && (late.has(l.at) || l.at === 'alt')));
      if (resume.repaired) { T.setRepaired(); this.weather.event('repaired'); this.weather.jump(); if (c.reachDir !== 0) c.reachDir = -1; }
    } else {
      this.radio.fire('start'); save.totalClimbs++; save.stats.climbs++;
      if (!ct && base.id === TOWERS[0].id) this.tutorial.start();
    }
    this.mode = 'climb'; this.paused = false; this.menus.show('none'); this.hud.show(true); this.touch.show(this.input.isTouch); this.hud.hideRadio();
    this.fadeT = 1; this.hud.fade(1); this.deadShown = false; this.litAnim = -1;
    audio.music(false); persist();
    if (!this.input.isTouch) this.input.requestLock();
  }
  resumeClimb() { const cp = save.checkpoint; if (cp && TOWERS.some((tw) => tw.id === cp.towerId)) this.startClimb({ towerId: cp.towerId, contract: (cp.contract as Contract | null) ?? null }, cp); }
  pause() { if (this.mode !== 'climb') return; this.paused = true; this.menus.show('pause'); this.input.releaseLock(); }
  resume() { this.paused = false; this.menus.show('none'); if (this.mode === 'climb' && !this.input.isTouch) this.input.requestLock(); }

  /** Pays out immediately and records the line for the debrief. */
  private award(en: string, es: string, xp: number, credits = 0) { this.run?.ledger.add(en, es, xp, credits); save.xp += xp; save.credits += credits; }
  /** Relay 71 appears once its signal has been pieced together. */
  private checkUnlocks(): string[] {
    const out: string[] = [];
    const relay = TOWERS.find((tw) => tw.id === 'relay71');
    if (relay && !save.unlocked.includes(relay.id) && save.completed['blackridge'] && FRAGMENT_IDS.every((id) => save.fragments.includes(id))) { save.unlocked.push(relay.id); out.push(`${t('newTower')}: ${relay.name}`); }
    return out;
  }
  endClimb(success: boolean) {
    const c = this.climber; const run = this.run!; const base = run.base; const ct = run.job.contract; const st = save.stats;
    st.falls += c.falls; st.clips += c.clips; st.seconds += Math.round(c.elapsed); st.meters += Math.round(c.maxAlt);
    const top = Math.min(Math.round(c.maxAlt), base.height); const prevTop = save.bestAlt[base.id] ?? 0;
    if (top > prevTop) { this.award('New height on this tower', 'Altura nueva en esta torre', (top - prevTop) * B.xp.metre); save.bestAlt[base.id] = top; }
    const medals: MedalId[] = []; const unlocks: string[] = []; let late = false;
    if (success) {
      const mine = (save.medals[base.id] ??= []); const give = (m: MedalId) => { if (!mine.includes(m)) { mine.push(m); medals.push(m); } };
      if (!ct) { this.award('Tower restored', 'Torre restaurada', B.xp.restore, base.reward); st.repairs++; give('restored'); }
      else {
        late = ct.timeLimit !== undefined && c.elapsed > ct.timeLimit; const k = KINDS[ct.kind];
        const pay = contractDone(ct) ? 0 : late ? Math.round(ct.reward * 0.4) : ct.reward;
        this.award(`${k.en}${late ? ' (late)' : ''}`, `${k.es}${late ? ' (tarde)' : ''}`, late ? Math.round(ct.xp * 0.5) : ct.xp, pay); markDone(ct); st.contracts++;
      }
      if (c.falls === 0) { this.award('No falls', 'Sin caídas', B.xp.clean); give('clean'); }
      if (c.elapsed <= base.par) give('par');
      if (foundOn(base.id).all) give('found');
      for (const m of medals) { const md = MEDALS.find((x) => x.id === m)!; this.award(`Medal: ${md.en}`, `Medalla: ${md.es}`, B.xp.medal); }
      const prev = save.completed[base.id]; save.completed[base.id] = { time: c.elapsed, falls: c.falls, best: prev ? Math.min(prev.best, c.elapsed) : c.elapsed };
      if (!ct && base.unlocks && !save.unlocked.includes(base.unlocks)) { save.unlocked.push(base.unlocks); unlocks.push(`${t('newTower')}: ${towerById(base.unlocks).name}`); }
      unlocks.push(...this.checkUnlocks());
      for (let r = rankOf(run.xpBefore) + 1; r <= rankOf(); r++) {
        for (const g of gearAtRank(r)) unlocks.push(`${pick('Now in the shop', 'Ya en la tienda')}: ${pick(g.en, g.es)}`);
        const kinds = (Object.keys(KINDS) as (keyof typeof KINDS)[]).filter((k) => KINDS[k].rank === r);
        for (const k of kinds) unlocks.push(`${pick('New contract type', 'Nuevo tipo de contrato')}: ${pick(KINDS[k].en, KINDS[k].es)}`);
      }
    }
    save.checkpoint = null; persist();
    this.input.releaseLock(); this.paused = false; this.hud.show(false); this.touch.show(false); this.hud.hideRadio(); this.tutorial.stop();
    if (success) {
      this.mode = 'debrief'; audio.music(true, 0.6);
      this.menus.show('debrief', { job: run.job, time: c.elapsed, falls: c.falls, maxAlt: c.maxAlt, late, lines: run.ledger.lines, xpBefore: run.xpBefore, xpAfter: save.xp, medals, unlocks });
    } else this.toMenu();
    this.run = null;
  }
  toMenu() {
    this.mode = 'menu'; this.paused = false; this.menuT = 0; this.loadTower(this.nextTower());
    this.hud.show(false); this.touch.show(false); this.menus.show('van'); audio.music(true, 0.8);
    this.terrain.applyLit(save.completed['pinegrove'] ? 1 : 0);
  }

  // ---------- events ----------
  private onClimb(e: ClimbEvent, d?: unknown) {
    const c = this.climber; const run = this.run; if (!run) return;
    switch (e) {
      case 'clipped': this.radio.fire('clipped'); break;
      case 'firstPlatform': this.radio.fire('firstPlatform'); break;
      case 'stepOnTop': this.radio.fire('stepOnTop'); break;
      case 'cut': this.radio.fire('cut'); break;
      case 'ice': this.radio.fire('ice'); break;
      case 'platform':
        save.checkpoint = { towerId: run.base.id, contract: run.job.contract, platform: d as number, repaired: c.repaired, elapsed: c.elapsed, falls: c.falls, maxAlt: c.maxAlt, inspected: run.inspected.slice() };
        persist(); break;
      case 'point': this.onPoint(d as WorkPoint); break;
      case 'repaired':
        this.weather.event('repaired'); this.radio.fire('repaired');
        if (c.reachDir !== 0) { c.reachDir = -1; this.touch.refreshDir(); }
        if (!run.job.contract && this.terrain.lit < 1) this.litAnim = 0;
        if (save.checkpoint) { save.checkpoint.repaired = true; persist(); }
        break;
      case 'landed': this.radio.fire('landed'); break;
      case 'enterVan': this.endClimb(true); break;
      case 'photo': this.photoRequested = true; break;
      default: break;
    }
  }
  private onPoint(pt: WorkPoint) {
    const run = this.run!; const c = this.climber; this.tower.completePoint(pt); audio.clipIn();
    if (pt.kind === 'inspect') {
      const i = Number(pt.id.split('-')[1]); if (!run.inspected.includes(i)) run.inspected.push(i);
      c.note(`✓ ${pick('Checked', 'Revisado')} ${run.inspected.length}/${run.inspectTotal}`, 2);
      if (save.checkpoint) save.checkpoint.inspected = run.inspected.slice();
      if (run.inspected.length >= run.inspectTotal) c.completeJob();
    } else {
      const col = run.base.collectibles.find((x) => x.id === pt.id); if (!col) return;
      if (col.kind === 'page') {
        if (!save.pages.includes(col.id)) save.pages.push(col.id);
        this.award('Logbook page', 'Página de bitácora', B.xp.page);
        const text = pick(col.en ?? '', col.es ?? ''); this.hud.note(pick(col.titleEn ?? '', col.titleEs ?? ''), text, 5 + text.split(' ').length * 0.42);
      } else {
        if (!save.fragments.includes(col.id)) save.fragments.push(col.id);
        this.award('Signal fragment', 'Fragmento de señal', B.xp.fragment);
        const have = FRAGMENT_IDS.filter((id) => save.fragments.includes(id)).length;
        c.note(`✓ ${pick('Fragment captured', 'Fragmento capturado')} ${have}/${FRAGMENT_IDS.length}`, 3);
        if (have === FRAGMENT_IDS.length) this.hud.note(pick('ANALYZER', 'ANALIZADOR'), pick('All four fragments fit together. The signal has a source: Relay 71.', 'Los cuatro fragmentos encajan. La señal tiene un origen: Relé 71.'), 8);
      }
    }
    persist();
  }
  private photoCtx(): PhotoCtx {
    const c = this.climber; const cam = c.camera; const p = cam.position; const fwd = cam.getWorldDirection(new THREE.Vector3());
    const dir = (x: number, y: number, z: number) => new THREE.Vector3(x - p.x, y - p.y, z - p.z).normalize();
    return {
      alt: c.altitude, towerHeight: this.spec.height, sunElev: this.sky.sunElev, fwd, sunDir: this.sky.sunDir,
      toTown: dir(TOWN.x, this.terrain.heightAt(TOWN.x, TOWN.z), TOWN.z), townLit: this.terrain.lit,
      toVan: dir(VAN_POS.x, 1, VAN_POS.z), toBirds: dir(this.birds.center.x, this.birds.center.y, this.birds.center.z), birdsBelow: p.y > this.birds.center.y + 6,
      flash: this.weather.flash, resting: c.state === 'rest', inCut: c.onLadder && this.spec.cutAnchors.some(([a, b]) => c.chest > a - 1.5 && c.chest < b + 1.5), aboveClouds: false,
    };
  }
  private takePhoto() {
    const src = this.renderer.domElement; const w = 640, h = Math.round((640 * src.height) / src.width);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; g.drawImage(src, 0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#7fe3ff'; g.font = 'bold 12px monospace';
    g.fillText(`${this.spec.name.toUpperCase()}  ALT ${this.climber.altitude.toFixed(0)} m  ${new Date().toISOString().slice(0, 10)}`, 8, h - 7);
    const goal = matchGoal(this.photoCtx(), save.photoGoals); let tag: string | undefined;
    if (goal) { save.photoGoals.push(goal.id); tag = pick(goal.en, goal.es); this.award(`Photo assignment: ${goal.en}`, `Encargo fotográfico: ${goal.es}`, B.xp.photo, B.photoReward); }
    try { save.photos.push({ src: cv.toDataURL('image/jpeg', 0.72), tag }); if (save.photos.length > B.maxPhotos) save.photos.shift(); } catch { /* canvas tainted */ }
    save.stats.photos++; persist();
    if (goal) this.climber.note(`✓ ${pick('Assignment', 'Encargo')}: ${tag}`, 3); else this.climber.say('photoSaved', 1.5);
    audio.click();
  }
  private objective(): string {
    const c = this.climber; const run = this.run; if (c.repaired) return t('objVan'); if (!run?.job.contract) return t('objTop');
    return run.job.contract.kind === 'inspect' ? `${t('objInspect')} ${run.inspected.length}/${run.inspectTotal}` : t('objService');
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
      c.night = this.sky.night; c.update(dt, save.invertY, save.sens);
      this.sky.sunElev = this.spec.sunElev + this.spec.sunRate * c.elapsed;
      if (this.input.pressed.has('menu') && c.state !== 'dead') this.pause();
      if (!c.descending) this.radio.fire('alt', c.altitude); else this.radio.fire('descentAlt', c.altitude);
      if (this.spec.sabotaged && !this.run?.job.contract && c.altitude > this.spec.height * 0.83) this.radio.fire('strange');
      this.radio.update(dt);
      if (c.state === 'dead' && !this.deadShown && c.deadT > 1.4) { this.deadShown = true; this.menus.show('dead'); this.input.releaseLock(); }
      const limit = this.run?.job.contract?.timeLimit; const left = limit !== undefined ? limit - c.elapsed : 0;
      this.hud.update(dt, c, this.weather, this.objective(), this.tutorial.update(dt, c, this.input), limit !== undefined ? `${left < 0 ? '+' : ''}${fmtTime(Math.abs(left))}` : '', left < 0);
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
  game, save, TOWERS, persist, setDay, dailyContracts, rankOf, rankName, gearById,
  get climber() { return game.climber; }, get tower() { return game.tower; }, get weather() { return game.weather; },
  start: (id: string, contract: Contract | null = null) => game.startClimb({ towerId: id, contract }),
  cycle: (n = 1, up = true) => { let ok = 0; for (let i = 0; i < n; i++) if (game.climber.debugCycle(up)) ok++; return ok; },
  clip: () => game.climber.debugClip(), teleport: (y: number) => game.climber.debugTeleport(y),
  press: (a: string) => game.input.press(a as never), release: (a: string) => game.input.release(a as never),
  setWeather: (w: { cloud: number; rain: number; wind: number; storm: number }, over = 1) => game.weather.setTarget(w, over),
  screen: (s: Screen) => game.menus.show(s),
  sim: (seconds: number, dt?: number) => game.sim(seconds, dt),
  /** Deterministic probes: no wind, no gusts, no storm. */
  calm: () => { game.weather.setTarget({ cloud: 0.3, rain: 0, wind: 0, storm: 0 }, 1); game.weather.calm(); },
  jobName,
};
