import type { Climber } from '../climb/climber';
import type { Weather } from '../world/weather';
import type { Speaker } from '../game/story';
import { t } from '../core/i18n';
import { clamp } from '../core/math';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = '') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };

/** In-climb overlay. Every setter is cached so the DOM is only touched when a value actually changes. */
export class Hud {
  root: HTMLElement;
  private altNum: HTMLElement; private altLabel: HTMLElement; private stam: HTMLElement; private stamLabel: HTMLElement; private stamBar: HTMLElement; private windLabel: HTMLElement; private windBar: HTMLElement;
  private clip: HTMLElement; private clipMain: HTMLElement; private clipSub: HTMLElement; private obj: HTMLElement; private prompt: HTMLElement; private msg: HTMLElement;
  private brace: HTMLElement; private braceText: HTMLElement; private braceBar: HTMLElement; private hazard: HTMLElement; private hazardText: HTMLElement; private hazardBar: HTMLElement;
  private radio: HTMLElement; private radioWho: HTMLElement; private radioText: HTMLElement; private work: HTMLElement; private workLabel: HTMLElement; private workBar: HTMLElement;
  private tut: HTMLElement; private timer: HTMLElement; private fadeEl: HTMLElement; private red: HTMLElement; private cross: HTMLElement;
  private radioT = 0; private radioFull = ''; private radioChars = 0;
  private cache = new Map<string, string>(); private ids = new WeakMap<HTMLElement, number>(); private nextId = 1;

  constructor(parent: HTMLElement) {
    this.root = el('div', '', parent); this.root.id = 'hud';
    el('div', 'vig', this.root);
    const alt = el('div', 'alt mono', this.root); this.altLabel = el('span', '', alt, t('altitude')); const b = el('b', '', alt); this.altNum = el('span', '', b, '0'); el('small', '', b, 'm');
    const meters = el('div', 'meters', this.root);
    this.stam = el('div', 'meter stam', meters); this.stamLabel = el('span', '', this.stam, t('stamina')); this.stamBar = el('i', '', el('div', 'bar', this.stam));
    const wind = el('div', 'meter wind', meters); this.windLabel = el('span', '', wind, t('wind')); this.windBar = el('i', '', el('div', 'bar', wind));
    this.clip = el('div', 'clip mono off', this.root); this.clipMain = el('span', '', this.clip); this.clipSub = el('small', '', this.clip);
    this.obj = el('div', 'obj', this.root); this.timer = el('div', 'timer mono', this.root);
    this.tut = el('div', 'tut', this.root);
    this.prompt = el('div', 'prompt', this.root); this.msg = el('div', 'msg', this.root);
    this.brace = el('div', 'brace', this.root); this.braceText = el('span', '', this.brace, t('brace')); this.braceBar = el('i', '', el('div', 'bar', this.brace));
    this.hazard = el('div', 'hazard', this.root); this.hazardText = el('span', '', this.hazard); this.hazardBar = el('i', '', el('div', 'bar', this.hazard));
    this.radio = el('div', 'radio', this.root); this.radioWho = el('div', 'who', this.radio); this.radioText = el('div', '', this.radio);
    this.work = el('div', 'repair', this.root); this.workLabel = el('div', '', this.work); this.workBar = el('i', '', el('div', 'bar', this.work));
    this.cross = el('div', 'cross', this.root); this.red = el('div', 'red', this.root); this.fadeEl = el('div', 'fade', this.root);
    for (const e of [this.radio, this.work, this.brace, this.hazard, this.prompt, this.msg, this.tut, this.timer]) e.hidden = true;
  }
  private key(e: HTMLElement, k: string) { let id = this.ids.get(e); if (!id) { id = this.nextId++; this.ids.set(e, id); } return id + k; }
  private text(e: HTMLElement, s: string) { const k = this.key(e, 't'); if (this.cache.get(k) !== s) { this.cache.set(k, s); e.textContent = s; } }
  private css(e: HTMLElement, prop: 'width' | 'opacity' | 'color', v: string) { const k = this.key(e, prop); if (this.cache.get(k) !== v) { this.cache.set(k, v); e.style[prop] = v; } }
  private cls(e: HTMLElement, v: string) { const k = this.key(e, 'c'); if (this.cache.get(k) !== v) { this.cache.set(k, v); e.className = v; } }
  private hide(e: HTMLElement, hidden: boolean) { if (e.hidden !== hidden) e.hidden = hidden; }
  private pct(e: HTMLElement, f: number) { this.css(e, 'width', `${Math.round(clamp(f, 0, 1) * 200) / 2}%`); }

  show(v: boolean) { this.root.hidden = !v; }
  relabel() { this.altLabel.textContent = t('altitude'); this.stamLabel.textContent = t('stamina'); this.windLabel.textContent = t('wind'); this.cache.clear(); }
  fade(a: number) { this.css(this.fadeEl, 'opacity', a.toFixed(2)); }

  update(dt: number, c: Climber, w: Weather, objective: string, hint: string, timer: string, timerOver = false) {
    this.text(this.altNum, Math.max(0, c.altitude).toFixed(0));
    const sp = clamp(c.stamina / c.maxStamina, 0, 1); this.pct(this.stamBar, sp); this.cls(this.stam, sp < 0.25 ? 'meter stam low' : 'meter stam');
    this.pct(this.windBar, w.windSpeed / 1.4);
    // protection badge
    this.hide(this.clip, !c.onLadder);
    if (c.onLadder) {
      const p = c.protection;
      if (c.perks.arrester) { this.cls(this.clip, `clip mono ${p === 'arrester' ? 'on' : 'off'}`); this.text(this.clipMain, p === 'arrester' ? t('arrester') : t('unclipped')); this.text(this.clipSub, ''); }
      else if (p === 'clipped') { this.cls(this.clip, `clip mono on${c.leashFrac > 0.8 ? ' warn' : ''}`); this.text(this.clipMain, t('clipped')); this.text(this.clipSub, `${Math.abs(c.chest - (c.anchorY ?? 0)).toFixed(1)} / ${c.leash.toFixed(1)} m`); }
      else { this.cls(this.clip, 'clip mono off'); this.text(this.clipMain, t('unclipped')); this.text(this.clipSub, ''); }
    }
    this.text(this.obj, objective);
    this.hide(this.timer, !timer); if (timer) { this.text(this.timer, timer); this.cls(this.timer, timerOver ? 'timer mono over' : 'timer mono'); }
    this.hide(this.tut, !hint); if (hint) this.text(this.tut, hint);
    this.hide(this.prompt, !c.prompt); if (c.prompt) this.text(this.prompt, c.prompt);
    this.hide(this.msg, !c.message);
    if (c.message) { this.text(this.msg, c.message); this.css(this.msg, 'color', c.message === t('caught') || c.message === t('rDone') ? 'var(--ok)' : c.message === t('photoSaved') || c.message.startsWith('✓') ? 'var(--signal)' : 'var(--danger)'); }
    this.hide(this.brace, !c.brace);
    if (c.brace) {
      const gi = w.gustIn; this.pct(this.braceBar, w.gust > 0 ? w.gust : gi >= 0 ? 1 - gi / Math.max(0.1, w.warnLead) : 0);
      this.text(this.braceText, c.onLadder && c.gripping === 1 ? `${t('brace')} ${t('twoHands')}` : t('brace'));
    }
    const arc = c.onLadder ? c.arcWarn : 0; this.hide(this.hazard, arc <= 0);
    if (arc > 0) { const on = arc >= 1; this.cls(this.hazard, on ? 'hazard on' : 'hazard'); this.text(this.hazardText, `⚡ ${on ? t('arcNow') : t('arcWarn')}`); this.pct(this.hazardBar, on ? 1 : arc); }
    this.hide(this.work, c.state !== 'work');
    if (c.state === 'work') { this.text(this.workLabel, c.workLabel); this.pct(this.workBar, c.workProgress); }
    this.css(this.red, 'opacity', clamp(c.flashRed + (c.slipping ? 0.35 + Math.sin(performance.now() / 150) * 0.15 : 0), 0, 1).toFixed(2));
    this.hide(this.cross, c.state === 'rest' || c.state === 'dead');
    this.updateRadio(dt);
  }
  private updateRadio(dt: number) {
    if (this.radioT <= 0) return;
    this.radioT -= dt;
    if (this.radioChars < this.radioFull.length) { this.radioChars = Math.min(this.radioFull.length, this.radioChars + dt * 55); this.radioText.textContent = this.radioFull.slice(0, Math.floor(this.radioChars)); }
    if (this.radioT <= 0) this.radio.hidden = true;
  }
  say(text: string, who: Speaker, dur: number) {
    this.radio.hidden = false; this.radio.className = `radio ${who}`;
    this.radioWho.textContent = t(who === 'dispatch' ? 'whoDispatch' : who === 'you' ? 'whoYou' : 'whoUnknown');
    this.radioFull = text; this.radioChars = 0; this.radioText.textContent = ''; this.radioT = dur;
  }
  /** A found document, shown in the radio box. */
  note(title: string, text: string, dur: number) { this.radio.hidden = false; this.radio.className = 'radio note'; this.radioWho.textContent = title; this.radioFull = text; this.radioChars = 0; this.radioText.textContent = ''; this.radioT = dur; }
  noise(dur: number) { this.radio.hidden = false; this.radio.className = 'radio unknown'; this.radioWho.textContent = '- - -'; this.radioFull = '▒▒▒ ▒▒ ▒▒▒▒▒ ▒▒▒ ▒▒▒▒'; this.radioChars = 99; this.radioText.textContent = this.radioFull; this.radioT = dur; }
  hideRadio() { this.radio.hidden = true; this.radioT = 0; }
}
