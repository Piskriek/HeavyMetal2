/**
 * Picks and adapts the render quality tier so the game holds its frame rate on phones.
 * Pure (no DOM): the shell feeds it the device facts and the frame times, and applies whatever it answers.
 */

export type Quality = 'low' | 'medium' | 'high';

const ORDER: readonly Quality[] = ['low', 'medium', 'high'];

export interface DeviceFacts { readonly touch: boolean; readonly cores: number; readonly dpr: number; readonly width: number }

/** A first guess before any frame has been drawn: phones start lower, desktops start high. */
export function guessQuality(d: DeviceFacts): Quality {
  if (!d.touch) return d.cores > 0 && d.cores <= 2 ? 'medium' : 'high';
  if (d.cores > 0 && d.cores <= 4) return 'low';
  return d.dpr >= 3 || d.width < 420 ? 'medium' : 'high';
}

export function parseQuality(v: unknown): Quality | null {
  return v === 'low' || v === 'medium' || v === 'high' ? v : null;
}

export interface AdaptiveQuality {
  readonly current: Quality;
  /** Feed every frame's duration (ms). Returns the new tier when it should drop, otherwise null. */
  frame(dtMs: number): Quality | null;
}

/**
 * Drops one tier when the rolling average frame time stays above `slowMs` (default 24 ms, about 42 fps) over `window` frames,
 * after a `warmup` of frames (shader compiles and texture uploads are slow and do not count). Never rises on its own:
 * a tier that was too heavy once is not tried again this session. A manual choice (`locked`) disables adapting.
 */
export function createAdaptiveQuality(start: Quality, o: { window?: number; warmup?: number; slowMs?: number; locked?: boolean } = {}): AdaptiveQuality {
  const window = o.window ?? 90, warmup = o.warmup ?? 120, slowMs = o.slowMs ?? 24;
  let current = start, seen = 0, sum = 0, n = 0;
  return {
    get current() { return current; },
    frame(dtMs) {
      if (o.locked || !Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 1000) return null;
      if (++seen <= warmup) return null;
      sum += dtMs; n++;
      if (n < window) return null;
      const avg = sum / n;
      sum = 0; n = 0;
      const i = ORDER.indexOf(current);
      if (avg > slowMs && i > 0) { current = ORDER[i - 1]!; seen = warmup - window; return current; }
      return null;
    },
  };
}
