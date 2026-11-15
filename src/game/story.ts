import type { RadioLine } from './types';
import { pick } from '../core/i18n';
import { audio } from '../core/audio';

export type Speaker = 'dispatch' | 'you' | 'unknown';
/** Events that make earlier small talk pointless. */
const MILESTONES = new Set<RadioLine['at']>(['repaired', 'stepOnTop', 'landed', 'cut', 'strange']);
/** Lines that go stale if they wait in the queue. */
const STALE = new Set<RadioLine['at']>(['alt', 'descentAlt', 'clipped', 'firstPlatform']);

interface RadioOut { say(text: string, who: Speaker, dur: number): void; noise(dur: number): void; }

/** Radio chatter: lines fire on events, queue up, and play one at a time. A dead radio only gives static. */
export class Radio {
  private lines: RadioLine[] = []; private queue: { line: RadioLine; age: number }[] = []; private fired = new Set<RadioLine>();
  private lineT = 0; private staticT = 0;
  constructor(private out: RadioOut, private radioDead: () => boolean) {}
  reset(lines: RadioLine[]) { this.lines = lines; this.queue = []; this.fired.clear(); this.lineT = 0; this.staticT = 0; }
  /** Marks lines as already heard (resuming a climb). */
  skip(pred: (l: RadioLine) => boolean) { for (const l of this.lines) if (pred(l)) this.fired.add(l); }
  fire(at: RadioLine['at'], value?: number) {
    let purged = false;
    for (const l of this.lines) {
      if (this.fired.has(l) || l.at !== at) continue;
      if (value !== undefined && l.value !== undefined && ((at === 'alt' && value < l.value) || (at === 'descentAlt' && value > l.value))) continue;
      this.fired.add(l);
      if (!purged && MILESTONES.has(at)) { this.queue = this.queue.filter((q) => !STALE.has(q.line.at)); purged = true; }
      this.queue.push({ line: l, age: 0 });
    }
  }
  get pending() { return this.queue.length; }
  get staticOn() { return this.staticT > 0; }
  update(dt: number) {
    for (const q of this.queue) q.age += dt;
    if (this.queue.length > 1) this.queue = this.queue.filter((q) => !(STALE.has(q.line.at) && q.age > 30));
    if (this.lineT > 0) { this.lineT -= dt; return; }
    if (this.staticT > 0) { this.staticT -= dt; return; }
    const next = this.queue[0]; if (!next) return;
    if (this.radioDead() && next.line.who !== 'you') { this.out.noise(1.5); this.staticT = 2.2; return; }
    this.queue.shift();
    const text = pick(next.line.en, next.line.es); const dur = 2.6 + text.split(' ').length * 0.34; this.lineT = dur + 0.8;
    if (next.line.who !== 'you') audio.radioSquelch();
    this.out.say(text, next.line.who ?? 'dispatch', dur);
  }
}
