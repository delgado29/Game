import type { Action, Input } from '../core/input';
import { t } from '../core/i18n';

/** Virtual controls for touch devices: joystick, drag-look, and hold buttons for both hands, clip, act, rest, photo. */
export class Touch {
  root: HTMLElement; private stick: HTMLElement; private knob: HTMLElement; private labels: [HTMLElement, string][] = [];
  private stickId: number | null = null; private lookId: number | null = null; private lastLook = { x: 0, y: 0 };
  constructor(parent: HTMLElement, private input: Input, canvas: HTMLCanvasElement) {
    this.root = document.createElement('div'); this.root.id = 'touch'; parent.appendChild(this.root);
    this.stick = document.createElement('div'); this.stick.className = 'stick'; this.knob = document.createElement('i'); this.stick.appendChild(this.knob); this.root.appendChild(this.stick);
    const mk = (cls: string, key: string, action: Action, style: string) => { const b = document.createElement('div'); b.className = `tbtn ${cls}`; b.textContent = t(key); b.style.cssText = style; this.root.appendChild(b); this.labels.push([b, key]);
      const down = (e: PointerEvent) => { e.preventDefault(); b.classList.add('act'); input.press(action); try { b.setPointerCapture(e.pointerId); } catch { /* */ } };
      const up = (e: PointerEvent) => { e.preventDefault(); b.classList.remove('act'); input.release(action); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); return b; };
    const R = 'right: max(24px, env(safe-area-inset-right));', L = 'left: max(24px, env(safe-area-inset-left));', B = (px: number) => `bottom: max(${px}px, calc(env(safe-area-inset-bottom) + ${px - 10}px));`;
    mk('big grip', 'tL', 'gripL', `${L} ${B(24)} left: max(170px, calc(env(safe-area-inset-left) + 150px));`);
    mk('big grip', 'tR', 'gripR', `${R} ${B(24)}`);
    mk('', 'tClip', 'clip', `${B(160)} right: max(36px, env(safe-area-inset-right));`);
    mk('', 'tAct', 'act', `${B(150)} right: max(150px, calc(env(safe-area-inset-right) + 130px));`);
    mk('sm', 'tRest', 'rest', `${B(270)} right: max(36px, env(safe-area-inset-right));`);
    mk('sm', 'tPhoto', 'photo', `${B(270)} right: max(120px, calc(env(safe-area-inset-right) + 100px));`);
    // joystick
    this.stick.addEventListener('pointerdown', (e) => { this.stickId = e.pointerId; this.stick.setPointerCapture(e.pointerId); this.moveStick(e); });
    this.stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.moveStick(e); });
    const endStick = (e: PointerEvent) => { if (e.pointerId === this.stickId) { this.stickId = null; input.touchMove.x = input.touchMove.y = 0; this.knob.style.transform = ''; } };
    this.stick.addEventListener('pointerup', endStick); this.stick.addEventListener('pointercancel', endStick);
    // drag-look anywhere on the canvas
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' && !input.isTouch) return; if (this.lookId === null) { this.lookId = e.pointerId; this.lastLook = { x: e.clientX, y: e.clientY }; } });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== this.lookId) return; input.addLook((e.clientX - this.lastLook.x) * 2.2, (e.clientY - this.lastLook.y) * 2.2); this.lastLook = { x: e.clientX, y: e.clientY }; });
    const endLook = (e: PointerEvent) => { if (e.pointerId === this.lookId) this.lookId = null; };
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
    this.root.hidden = true;
  }
  private moveStick(e: PointerEvent) { const r = this.stick.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.input.touchMove.x = dx; this.input.touchMove.y = -dy; this.knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`; }
  show(v: boolean) { this.root.hidden = !v; }
  relabel() { for (const [b, k] of this.labels) b.textContent = t(k); }
}
