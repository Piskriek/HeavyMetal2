/**
 * M01 · T2 — the pool goblin: which painted pose is on screen, and when.
 *
 * The overlay's own little law, kept out of the component so it can be asserted headlessly like
 * every other piece of presentation in this project. It knows nothing about the DOM: it takes the
 * pool's phase (plus whether the `GO!` window is open) and the seconds since it was mounted, and
 * answers with a cell of the 2x2 sheet in `public/art/cockpit/pool-goblin.png`.
 *
 * The sheet, in reading order (`scripts/cut-cockpit-art.mjs` measures the cells, so these indices
 * are checked against the finished pixels by `tests/cockpit.test.ts`):
 *
 * | Cell | Pose | Shown while |
 * | --- | --- | --- |
 * | 0 | palm out, "hold" | the pool is open — riders are still arriving |
 * | 1 | pointing, calling | the window has closed, the field is all in |
 * | 2 | both hands cupped, shouting | the countdown: 3 · 2 · 1 |
 * | 3 | sweeping both arms forward | `GO!` — and this one animates, all four poses at 12 fps |
 */
import type { MergeSnapshot } from '../types';

/** Poses, by cell index. */
export const POOL_GOBLIN_HOLD = 0;
export const POOL_GOBLIN_CALL = 1;
export const POOL_GOBLIN_COUNT = 2;
export const POOL_GOBLIN_SWEEP = 3;

/** The sweep's frame rate. The starter goblin's shove runs at the same 12 fps. */
export const POOL_GOBLIN_FPS = 12;

/**
 * The cell to draw. `goActive` is true while the countdown is reading `GO!`: the sweep then plays as
 * a four-frame animation instead of holding a pose, unless reduced motion is on, in which case it
 * holds the first pose of the sweep like everything else in this project.
 */
export function poolGoblinFrame(
  phase: MergeSnapshot['phase'],
  goActive: boolean,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (goActive) {
    if (reducedMotion) return POOL_GOBLIN_SWEEP;
    return Math.floor(Math.max(0, seconds) * POOL_GOBLIN_FPS) % 4;
  }
  if (phase === 'open') return POOL_GOBLIN_HOLD;
  if (phase === 'closed') return POOL_GOBLIN_CALL;
  if (phase === 'countdown') return POOL_GOBLIN_COUNT;
  return POOL_GOBLIN_SWEEP;
}

/**
 * Where that cell sits in the sheet, as the two CSS background percentages. The sheet is a 2x2 grid,
 * exactly like the starter goblin's, so a cell is one half of each axis.
 */
export function poolGoblinSheetPosition(frame: number): { x: number; y: number } {
  const cell = ((Math.floor(frame) % 4) + 4) % 4;
  return { x: (cell % 2) * 100, y: Math.floor(cell / 2) * 100 };
}
