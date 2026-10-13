// The pure maths of a monster on screen: which way its view faces, which frame or clip time its phase plays, and its facing from
// its motion. Deterministic and free of the DOM and of three.js, so the frame timing is tested without a GPU.
import type { Phase } from '@hm/leaksim';

/** Doom's tic rate: a sprite's `ticks` are tics per frame. */
export const TICS_PER_SECOND = 35;
/** Eight views per frame, the first facing the viewer (view 0), the mirrored ones from view 5 on. */
export const VIEWS = 8;
const TAU = Math.PI * 2;

export type SpriteGroup = 'walk' | 'attack' | 'pain' | 'death';
/** loop: repeats; once: plays and holds its last frame; hold: stays on its first frame. */
export type PlayMode = 'loop' | 'once' | 'hold';
export interface Play { readonly group: SpriteGroup; readonly mode: PlayMode }

/** The group and mode that a leaksim phase plays. Wind-up holds the first attack frame, so the telegraph reads as a pause. */
export function playFor(phase: Phase): Play {
  switch (phase) {
    case 'roam':
    case 'chase':
    case 'recover':
      return { group: 'walk', mode: 'loop' };
    case 'windup':
      return { group: 'attack', mode: 'hold' };
    case 'attack':
      return { group: 'attack', mode: 'loop' };
    case 'pain':
      return { group: 'pain', mode: 'once' };
    case 'dead':
      return { group: 'death', mode: 'once' };
  }
}

/** Wraps an angle into [0, 2 pi). */
export function wrapAngle(a: number): number {
  const m = a % TAU;
  return m < 0 ? m + TAU : m;
}

/** The bearing (radians, atan2(x, z): zero is +z, as a yaw) from one point on the ground to another. */
export function bearing(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

/**
 * The view for a monster that faces `yaw`, seen from `toCamera` (both radians, as `bearing` gives them). View 0 is the monster facing
 * the viewer; each step is 45 degrees; views 5, 6 and 7 are the mirrors of 3, 2 and 1, so `mirror` is true for them.
 */
export function pickView(yaw: number, toCamera: number): { readonly index: number; readonly mirror: boolean } {
  const rel = wrapAngle(toCamera - yaw);
  const index = Math.floor((rel + Math.PI / 8) / (Math.PI / 4)) % VIEWS;
  return { index, mirror: index >= 5 };
}

/** The frame of a sprite group at `t` seconds into its phase. `ticks` is the group's tics per frame. */
export function frameIndex(count: number, ticks: number, t: number, mode: PlayMode): number {
  if (count <= 1 || mode === 'hold') return 0;
  const perFrame = Math.max(1, ticks) / TICS_PER_SECOND;
  const n = Math.floor(Math.max(0, t) / perFrame);
  return mode === 'loop' ? n % count : Math.min(n, count - 1);
}

/** The time into a 3D clip of `duration` seconds at `t` seconds into its phase. */
export function clipTime(duration: number, t: number, mode: PlayMode): number {
  if (!(duration > 0) || mode === 'hold') return 0;
  if (mode === 'loop') return ((t % duration) + duration) % duration;
  return Math.min(Math.max(0, t), duration);
}

/**
 * The facing of a monster from its last move: a step of more than `eps` turns it to the direction of the step, a standing monster
 * keeps its yaw.
 */
export function yawFromMotion(prevYaw: number, dx: number, dz: number, eps = 1e-4): number {
  return Math.hypot(dx, dz) > eps ? Math.atan2(dx, dz) : prevYaw;
}
