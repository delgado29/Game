import type { Climber } from '../climb/climber';
import type { Input } from '../core/input';
import { t } from '../core/i18n';
import { persist, save } from '../core/save';

/** First-climb coaching: one hint at a time, each cleared by doing the thing it describes. */
export class Tutorial {
  active = false; step = 0; private baseY = 0; private doneT = 0;
  start() { this.active = !save.tutorialDone; this.step = 0; this.doneT = 0; }
  stop() { this.active = false; }
  /** Returns the hint to show, or '' for none. */
  update(dt: number, c: Climber, input: Input): string {
    if (!this.active) return '';
    const k = (key: string) => t(key + (input.isTouch ? 'T' : 'K'));
    switch (this.step) {
      case 0: if (c.state === 'ladder') { this.step = 1; this.baseY = c.pos.y; } return k('tutWalk');
      case 1:
        if (c.tapGrip || (input.held.has('gripL') && input.held.has('gripR')) || c.pos.y > this.baseY + 0.5) this.step = 2;
        return c.tapGrip ? t('tutTap') : k('tutHold');
      case 2: if (c.pos.y > this.baseY + 1.2) this.step = 3; return c.tapGrip ? t('tutTap') : k('tutMove');
      case 3: if (c.clips >= 1 || c.perks.arrester) this.step = 4; return k('tutClip');
      case 4: if (c.clips >= 3 || c.state === 'platform' || c.perks.arrester) this.step = 5; return t('tutRhythm');
      case 5:
        if (c.state === 'platform' || c.state === 'rest') { this.doneT += dt; if (this.doneT > 6) this.finish(); return t('tutPlatform'); }
        return '';
    }
    return '';
  }
  private finish() { this.active = false; save.tutorialDone = true; persist(); }
}
