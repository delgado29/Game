import type { Action, Input } from '../core/input';
import { t } from '../core/i18n';

/** Virtual controls for touch devices: joystick, drag-look, and hold buttons for both hands, clip, act, rest, photo. */
interface Placed { el: HTMLElement; side: 'left' | 'right'; dx: number; bottom: number; }

export class Touch {
  root: HTMLElement; private stick: HTMLElement; private knob: HTMLElement; private labels: [HTMLElement, string][] = [];
  private placed: Placed[] = []; private lefty = false; private dirBtn: HTMLElement; private getDir: () => number = () => 1; private toggleDir: () => void = () => {};
  private stickId: number | null = null; private lookId: number | null = null; private lastLook = { x: 0, y: 0 };
  constructor(parent: HTMLElement, private input: Input, canvas: HTMLCanvasElement) {
    this.root = document.createElement('div'); this.root.id = 'touch'; parent.appendChild(this.root);
    this.stick = document.createElement('div'); this.stick.className = 'stick'; this.knob = document.createElement('i'); this.stick.appendChild(this.knob); this.root.appendChild(this.stick);
    const mk = (cls: string, key: string, action: Action, side: 'left' | 'right', dx: number, bottom: number) => { const b = document.createElement('div'); b.className = `tbtn ${cls}`; b.textContent = t(key); this.root.appendChild(b); this.labels.push([b, key]); this.placed.push({ el: b, side, dx, bottom });
      const down = (e: PointerEvent) => { e.preventDefault(); b.classList.add('act'); input.press(action); try { b.setPointerCapture(e.pointerId); } catch { /* */ } };
      const up = (e: PointerEvent) => { e.preventDefault(); b.classList.remove('act'); input.release(action); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); return b; };
    mk('big grip', 'tL', 'gripL', 'left', 170, 24);
    mk('big grip', 'tR', 'gripR', 'right', 24, 24);
    mk('', 'tClip', 'clip', 'right', 36, 160);
    mk('', 'tAct', 'act', 'right', 150, 150);
    mk('sm', 'tRest', 'rest', 'right', 36, 270);
    mk('sm', 'tPhoto', 'photo', 'right', 120, 270);
    // reach direction toggle: ▲ grabs upward from the other hand, ▼ downward
    this.dirBtn = document.createElement('div'); this.dirBtn.className = 'tbtn sm dir'; this.root.appendChild(this.dirBtn); this.placed.push({ el: this.dirBtn, side: 'right', dx: 204, bottom: 270 });
    this.dirBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.toggleDir(); this.refreshDir(); });
    this.applyLayout();
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
  /** Wire the reach-direction button to the climber. */
  bindDir(get: () => number, toggle: () => void) { this.getDir = get; this.toggleDir = toggle; this.refreshDir(); }
  refreshDir() { this.dirBtn.textContent = this.getDir() < 0 ? '▼' : '▲'; this.dirBtn.classList.toggle('down', this.getDir() < 0); }
  setLefty(v: boolean) { this.lefty = v; this.applyLayout(); }
  private applyLayout() {
    const pos = (side: 'left' | 'right', dx: number) => `${side}: max(${dx}px, calc(env(safe-area-inset-${side}) + ${Math.max(0, dx - 20)}px));`;
    for (const p of this.placed) { const side = this.lefty ? (p.side === 'left' ? 'right' : 'left') : p.side; p.el.style.cssText = `${pos(side, p.dx)} bottom: max(${p.bottom}px, calc(env(safe-area-inset-bottom) + ${p.bottom - 10}px));`; }
    this.stick.style.cssText = this.lefty ? 'left: auto; right: max(24px, env(safe-area-inset-right));' : '';
  }
  show(v: boolean) { this.root.hidden = !v; if (v) this.refreshDir(); }
  relabel() { for (const [b, k] of this.labels) b.textContent = t(k); }
}
