/** Unified input: keyboard + mouse (pointer lock) and touch overlays feed the same action state. */
export type Action = 'gripL' | 'gripR' | 'clip' | 'act' | 'rest' | 'photo' | 'menu' | 'jump';

export class Input {
  held = new Set<Action>();
  pressed = new Set<Action>();
  released = new Set<Action>();
  lookX = 0; lookY = 0;            // accumulated this frame (radians-ish, scaled later)
  move = { x: 0, y: 0 };            // -1..1 from keys or joystick
  touchMove = { x: 0, y: 0 };
  pointerLocked = false;
  wantLock = false;
  isTouch = false;
  readonly canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private onLockChange: ((locked: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    addEventListener('keydown', (e) => { if (e.repeat) return; this.keys.add(e.code); const a = keyMap[e.code]; if (a) this.press(a); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); const a = keyMap[e.code]; if (a) this.release(a); });
    addEventListener('blur', () => { this.keys.clear(); for (const a of [...this.held]) this.release(a); });
    canvas.addEventListener('mousedown', (e) => { if (!this.pointerLocked) return; if (e.button === 0) this.press('gripL'); if (e.button === 2) this.press('gripR'); });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.release('gripL'); if (e.button === 2) this.release('gripR'); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (!this.pointerLocked) return; this.lookX += e.movementX; this.lookY += e.movementY; });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === canvas; this.onLockChange?.(this.pointerLocked); });
    document.addEventListener('pointerlockerror', () => { this.pointerLocked = false; this.onLockChange?.(false); });
  }
  lockChanged(fn: (locked: boolean) => void) { this.onLockChange = fn; }
  requestLock() { if (this.isTouch) return; try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true } as never) as unknown; if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => { try { this.canvas.requestPointerLock(); } catch { /* */ } }); } catch { try { this.canvas.requestPointerLock(); } catch { /* */ } } }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  press(a: Action) { if (!this.held.has(a)) { this.held.add(a); this.pressed.add(a); } }
  release(a: Action) { if (this.held.has(a)) { this.held.delete(a); this.released.add(a); } }
  /** Touch look delta in CSS pixels. */
  addLook(dx: number, dy: number) { this.lookX += dx; this.lookY += dy; }

  update() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1; if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1; if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (x === 0 && y === 0) { x = this.touchMove.x; y = this.touchMove.y; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
  }
  endFrame() { this.pressed.clear(); this.released.clear(); this.lookX = 0; this.lookY = 0; }
}

const keyMap: Record<string, Action> = {
  KeyQ: 'gripL', KeyE: 'gripR', ShiftLeft: 'gripL', ShiftRight: 'gripR', Space: 'clip', KeyF: 'act', Enter: 'act', KeyV: 'rest', KeyC: 'photo', Escape: 'menu', Tab: 'menu',
};
