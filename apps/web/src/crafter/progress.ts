// The preview's progress: one number p (0 to 1) walks the world along the stage ladder, and a wave carries each new look
// out from the chimney. The real economy (machines feeding stepFidelity) comes with Wave 4 of docs/SETMIX_LANDING.md.
import { fidelityIndex, stageOf, type FidelityState, type Stage } from '@hm/fidelity';

/** A world at progress p: every metric grows together (pixels a little ahead, water behind), 10^2 to 10^8. */
export function stateAt(p: number): FidelityState {
  const v = Math.pow(10, 2 + Math.max(0, Math.min(1, p)) * 6);
  return { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
}

/** Where on p each stage starts (index 0 is stage 1 at p = 0), found by bisection on the Fi thresholds. */
export const STAGE_STARTS: readonly number[] = (() => {
  const starts = [0];
  for (let s = 2; s <= 6; s++) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (stageOf(fidelityIndex(stateAt(mid))) >= s) hi = mid; else lo = mid;
    }
    starts.push(hi);
  }
  return starts;
})();

/** The stage at progress p. */
export const stageAt = (p: number): Stage => stageOf(fidelityIndex(stateAt(p)));

/** Each stage in the player's words: what the moon looks like there. */
export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  1: 'Four colours',
  2: 'Pixel art',
  3: 'Light and shade',
  4: 'Lakes',
  5: 'Fine detail',
  6: 'Living world',
};

/** How fast a wave front travels (metres a second) and how far it goes (just past your plot's rim). */
export const WAVE_SPEED = 15;
export const WAVE_REACH = 62;
/** How wide the band is where the old look swells into the new (metres). */
export const WAVE_BAND = 7;

/** How much of the new look a point at `distance` from the chimney shows when the front is at `radius`: 1 behind it, 0 ahead, smooth (C1) between. */
export function waveFactor(distance: number, radius: number, band = WAVE_BAND): number {
  const t = Math.max(0, Math.min(1, (radius - distance) / band));
  return t * t * (3 - 2 * t);
}

/** One wave: the look it carries (a key the scene knows) and when it set off. */
export interface Wave { readonly to: string; readonly startedAt: number }

/**
 * The wave queue: a new look waits for the wave in front of it to finish, so the moon never shows three looks at once.
 * Pure: give it the time; it says which wave is running and how far it has gone.
 */
export class WaveQueue {
  private running: Wave | null = null;
  private readonly waiting: string[] = [];

  /** Asks for a wave carrying `to` (dropped when the last queued look is already `to`). */
  push(to: string, now: number): void {
    const last = this.waiting.length ? this.waiting[this.waiting.length - 1] : this.running?.to;
    if (last === to) return;
    if (!this.running) this.running = { to, startedAt: now };
    else this.waiting.push(to);
  }

  /** The wave under way at `now` and its front's radius; a finished wave hands over to the next. `done` names a look that just finished. */
  step(now: number): { wave: Wave | null; radius: number; done: string | null } {
    let done: string | null = null;
    if (this.running && (now - this.running.startedAt) * WAVE_SPEED >= WAVE_REACH + WAVE_BAND) {
      done = this.running.to;
      const next = this.waiting.shift();
      this.running = next === undefined ? null : { to: next, startedAt: now };
    }
    const radius = this.running ? (now - this.running.startedAt) * WAVE_SPEED : 0;
    return { wave: this.running, radius, done };
  }

  /** Looks still waiting behind the running wave. */
  get queued(): number { return this.waiting.length; }
}
