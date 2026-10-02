/**
 * `trackedit` — the pure model behind a track drawing tool in a map editor.
 *
 * ```ts
 * import { emptyDraft, addPoint, closeLoop, analyse, toCenterline } from 'trackedit';
 *
 * let draft = emptyDraft(12);
 * draft = addPoint(draft, [0, 0]);
 * draft = addPoint(draft, [80, 0]);
 * draft = addPoint(draft, [80, 60]);
 * draft = addPoint(draft, [0, 60]);
 * draft = closeLoop(draft);
 * analyse(draft);        // { valid: true, length: ~278, ... }
 * toCenterline(draft, 6) // Vec2[] sampled every ~6 m
 * ```
 *
 * Everything is immutable, deterministic and DOM-free: operations return new
 * drafts, NaN/Infinity input is rejected, and there is no randomness or clock
 * anywhere in the package.
 */

export type { Analysis, ControlPoint, Hit, TrackDraft, Vec2 } from './types';
export * from './draft';
export * from './spline';
export * from './analyse';
export * from './hit';
export * from './history';
export * from './presets';
