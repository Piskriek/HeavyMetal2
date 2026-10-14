/**
 * The first-person rifle's feel (TASK-21d, P0-VFX-01): the view model sways as the mouse looks, bobs with the walk and vibrates
 * while it fires. Each is a damped spring from @hm/tooljuice, so a flick settles instead of snapping. Pure: the scene passes the
 * frame's look, walk and firing in; no clock, no random (the vibration's phase is the time it is given).
 */
import { springStep, type Spring } from '@hm/tooljuice';

export interface RifleFeelInput {
  /** The mouse look this frame, in pixels (the scene's look deltas). */
  readonly lookX: number;
  readonly lookY: number;
  /** Metres walked this frame, and the frame's time step in seconds. */
  readonly walked: number;
  readonly dt: number;
  /** Whether the rifle is firing, and the time in seconds (the vibration's phase). */
  readonly firing: boolean;
  readonly time: number;
}

/** The view model's offsets this frame: metres on x (right), y (up) and z, and small angles (radians) in pitch and roll. */
export interface RifleFeel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pitch: number;
  readonly roll: number;
}

export interface RifleFeelState {
  readonly swayX: Spring;
  readonly swayY: Spring;
  readonly bob: Spring;
  /** Metres walked, for the bob's phase. */
  readonly stride: number;
  /** 0 (still) to 1 (firing): how much the vibration is on, eased. */
  readonly shake: number;
}

export const FEEL_START: RifleFeelState = { swayX: { x: 0, v: 0 }, swayY: { x: 0, v: 0 }, bob: { x: 0, v: 0 }, stride: 0, shake: 0 };

/**
 * The sway: each pixel of look kicks the spring's speed by SWAY_KICK metres a second (a flick of 60 px gives about 1 cm of lean),
 * the speed is capped, and the spring settles back. The offset is capped at SWAY_LIMIT. Stiffness and damping are 1/s squared and 1/s.
 */
export const SWAY_KICK = 0.0045;
export const SWAY_SPEED_LIMIT = 1.2;
export const SWAY_LIMIT = 0.04;
const SWAY_K = 120, SWAY_C = 16;
/** One bob cycle is two steps: about 1.9 m. The bob is 1.2 cm at most. */
export const STRIDE_CYCLE = 1.9;
export const BOB_HEIGHT = 0.012;
/** The bob's spring is stiff enough to follow a walking cadence (about 10 rad/s) without losing its height. */
const BOB_K = 400, BOB_C = 30;
/** The vibration while firing: about 2 mm at 70 and 113 rad/s. */
const SHAKE_AMOUNT = 0.002;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** One sway spring for a frame: the kick is added to its speed (capped), and it runs back to rest, its offset capped. */
function sway(s: Spring, kick: number, dt: number): Spring {
  if (!(dt > 0)) return s;
  const v = clamp(s.v + (Number.isFinite(kick) ? kick : 0), -SWAY_SPEED_LIMIT, SWAY_SPEED_LIMIT);
  const next = springStep({ x: s.x, v }, 0, SWAY_K, SWAY_C, dt);
  return { x: clamp(next.x, -SWAY_LIMIT, SWAY_LIMIT), v: next.v };
}

/** One frame of the feel: the new state, and the offsets to draw the view model with. A broken frame changes nothing. */
export function feelStep(s: RifleFeelState, i: RifleFeelInput): { readonly state: RifleFeelState; readonly out: RifleFeel } {
  const dt = Number.isFinite(i.dt) && i.dt > 0 && i.dt < 0.25 ? i.dt : 0;
  const walked = Number.isFinite(i.walked) && i.walked > 0 ? i.walked : 0;
  const lookX = Number.isFinite(i.lookX) ? i.lookX : 0;
  const lookY = Number.isFinite(i.lookY) ? i.lookY : 0;
  // the view lags the look and springs back: the look kicks the spring's speed, and the spring settles it to rest
  const swayX = sway(s.swayX, -lookX * SWAY_KICK, dt);
  const swayY = sway(s.swayY, lookY * SWAY_KICK, dt);
  // the bob follows the stride while the character walks, and settles when it stops
  const stride = s.stride + walked;
  const walking = dt > 0 && walked / dt > 0.3;
  const bobTarget = walking ? Math.sin((2 * Math.PI * stride) / STRIDE_CYCLE) * BOB_HEIGHT : 0;
  const bob = springStep(s.bob, bobTarget, BOB_K, BOB_C, dt);
  // the vibration eases in while the rifle fires and out when it stops
  const aim = i.firing ? 1 : 0;
  const shake = dt > 0 ? s.shake + (aim - s.shake) * Math.min(1, dt * 10) : s.shake;
  const t = Number.isFinite(i.time) ? i.time : 0;
  const vx = shake * SHAKE_AMOUNT * Math.sin(t * 113);
  const vy = shake * SHAKE_AMOUNT * Math.sin(t * 70);
  const state: RifleFeelState = { swayX, swayY, bob, stride, shake };
  return {
    state,
    out: {
      x: swayX.x + vx,
      y: swayY.x + bob.x + vy,
      z: 0,
      pitch: swayY.x * 0.6 + vy * 0.5,
      roll: swayX.x * 0.8 + vx * 0.5,
    },
  };
}
