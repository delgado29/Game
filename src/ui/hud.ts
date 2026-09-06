import type { Climber } from '../climb/climber';
import type { Weather } from '../world/weather';
import { t } from '../core/i18n';
import { clamp } from '../core/math';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = '') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };

export class Hud {
  root: HTMLElement;
  private alt: HTMLElement; private stam: HTMLElement; private stamBar: HTMLElement; private wind: HTMLElement; private windBar: HTMLElement;
  private clip: HTMLElement; private obj: HTMLElement; private prompt: HTMLElement; private msg: HTMLElement; private brace: HTMLElement;
  private radio: HTMLElement; private radioWho: HTMLElement; private radioText: HTMLElement; private repair: HTMLElement; private repairLabel: HTMLElement; private repairBar: HTMLElement;
  private fadeEl: HTMLElement; private red: HTMLElement; private cross: HTMLElement;
  private radioT = 0;
  constructor(parent: HTMLElement) {
    this.root = el('div', '', parent); this.root.id = 'hud';
    el('div', 'vig', this.root);
    this.alt = el('div', 'alt mono', this.root, `${t('altitude')}<b>0<small>m</small></b>`);
    const meters = el('div', 'meters', this.root);
    this.stam = el('div', 'meter stam', meters, `${t('stamina')}<div class="bar"><i></i></div>`); this.stamBar = this.stam.querySelector('i')!;
    this.wind = el('div', 'meter wind', meters, `${t('wind')}<div class="bar"><i></i></div>`); this.windBar = this.wind.querySelector('i')!;
    this.clip = el('div', 'clip mono off', this.root); this.obj = el('div', 'obj', this.root);
    this.prompt = el('div', 'prompt', this.root); this.msg = el('div', 'msg', this.root); this.brace = el('div', 'brace', this.root, t('brace'));
    this.radio = el('div', 'radio', this.root); this.radioWho = el('div', 'who', this.radio); this.radioText = el('div', '', this.radio);
    this.repair = el('div', 'repair', this.root); this.repairLabel = el('div', '', this.repair); el('div', 'bar', this.repair, '<i></i>'); this.repairBar = this.repair.querySelector('i')!;
    this.cross = el('div', 'cross', this.root); this.red = el('div', 'red', this.root); this.fadeEl = el('div', 'fade', this.root);
    this.radio.hidden = true; this.repair.hidden = true; this.brace.hidden = true; this.prompt.hidden = true; this.msg.hidden = true;
  }
  show(v: boolean) { this.root.hidden = !v; }
  relabel() { this.alt.innerHTML = `${t('altitude')}<b>0<small>m</small></b>`; this.stam.firstChild!.textContent = t('stamina'); this.wind.firstChild!.textContent = t('wind'); this.brace.textContent = t('brace'); }
  fade(a: number) { this.fadeEl.style.opacity = String(a); }
  update(dt: number, c: Climber, w: Weather, objective: string) {
    const altB = this.alt.querySelector('b')!; altB.innerHTML = `${Math.max(0, c.altitude).toFixed(0)}<small>m</small>`;
    const sp = clamp(c.stamina / c.maxStamina, 0, 1); this.stamBar.style.width = `${sp * 100}%`; this.stam.classList.toggle('low', sp < 0.25);
    this.windBar.style.width = `${clamp(w.windSpeed / 1.4, 0, 1) * 100}%`;
    const on = c.anchor !== null; this.clip.className = `clip mono ${on ? 'on' : 'off'}`;
    this.clip.innerHTML = on ? `${t('clipped')}<small>${(Math.abs(c.chest - (c.anchorY ?? 0))).toFixed(1)} / ${c.leash.toFixed(1)} m</small>` : `${t('unclipped')}<small>${c.onLadder ? '' : '&nbsp;'}</small>`;
    this.clip.hidden = !(c.onLadder);
    this.obj.textContent = objective;
    this.prompt.hidden = !c.prompt; this.prompt.textContent = c.prompt;
    this.msg.hidden = !c.message; this.msg.textContent = c.message; this.msg.style.color = c.message === t('caught') || c.message === t('rDone') ? 'var(--ok)' : c.message === t('photoSaved') ? 'var(--signal)' : 'var(--danger)';
    this.brace.hidden = !c.brace;
    this.repair.hidden = c.state !== 'repair'; if (c.state === 'repair') { this.repairLabel.textContent = `${c.repairLabel} (${c.repairStep + 1}/${c.repairSteps.length})`; this.repairBar.style.width = `${c.repairProgress * 100}%`; }
    this.red.style.opacity = String(clamp(c.flashRed + (c.slipping ? 0.35 + Math.sin(performance.now() / 150) * 0.15 : 0), 0, 1));
    this.cross.hidden = c.state === 'rest' || c.state === 'dead';
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.radio.hidden = true; }
  }
  say(text: string, who: 'dispatch' | 'you' | 'unknown', dur: number) { this.radio.hidden = false; this.radio.className = `radio ${who}`; this.radioWho.textContent = who === 'dispatch' ? 'DISPATCH' : who === 'you' ? (t('tL') === 'I' ? 'TÚ' : 'YOU') : '?????'; this.radioText.textContent = text; this.radioT = dur; }
  static_(dur: number) { this.radio.hidden = false; this.radio.className = 'radio unknown'; this.radioWho.textContent = '- - -'; this.radioText.textContent = '▒▒▒ ▒▒ ▒▒▒▒▒ ▒▒▒ ▒▒▒▒'; this.radioT = dur; }
  hideRadio() { this.radio.hidden = true; this.radioT = 0; }
}
