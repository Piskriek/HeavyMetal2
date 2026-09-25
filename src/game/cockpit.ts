/**
 * M01 · T4 — the cockpit channel and its layout (pure).
 *
 * Everything the first-person HUD needs to place painted art and drive live gauges, with no DOM,
 * no THREE and no React: the component layer copies these numbers into CSS transforms, and the
 * headless tests assert the same numbers.
 *
 * **No geometry here is guessed.** `cockpit-art.json` is written by `scripts/cut-cockpit-art.mjs`,
 * which measures the finished pixels: the bezel's aperture, the yoke's pivot and both grips, the
 * arm's fist and its reach, and each painted dial hole inside the two gauge clusters. Move the art,
 * re-run the script, and the layout follows — there is no second set of coordinates to keep in sync.
 *
 * Steer comes from the same `vz` the physics integrates, so the yoke leads the lane change instead of
 * replaying it.
 */
import manifest from './cockpit-art.json';
import type { GameStatus } from './types';

/* -----------------------------------------------------------------------------
   1. FROZEN CONSTANTS (plan decisions D3, D4, D14)
   -------------------------------------------------------------------------- */

/** Yoke rotation at full lock, degrees. */
export const YOKE_MAX_DEG = 38;
/** Lateral speed that counts as full lock, matching the physics' steering clamp. */
export const VZ_MAX = 650;
/** Viewport bob, px, at top speed (0 under reduced motion). */
export const BOB_MAX_PX = 6;
/** Yoke span as a share of the viewport (width share first, height cap second). */
const YOKE_SPAN_OF_WIDTH = 0.42;
const YOKE_SPAN_OF_HEIGHT = 0.72;
/**
 * How wide the *painted* forearm should read, as a share of the viewport height. Scaled off the
 * sprite's measured paint box (not its canvas, which carries the generator's margins), so the arm
 * is a close-up forearm reaching in from below rather than a doll's arm on the dashboard.
 */
const ARM_WIDTH_OF_HEIGHT = 0.27;
/** Where the yoke hub sits, as a share of viewport height. */
const YOKE_HUB_Y = 0.86;
/** Shoulders live this far below the viewport bottom: the arms must leave through the edge. */
const SHOULDER_BELOW = 0.16;

/* -----------------------------------------------------------------------------
   2. THE PER-FRAME CHANNEL (IF-COCKPIT)
   -------------------------------------------------------------------------- */

/**
 * One reused object, filled by the engine every frame and read by the HUD's rAF loop. It is a plain
 * mutable record on purpose: allocating a fresh state per frame would be a per-frame allocation in
 * the render path, which the project forbids.
 */
export interface CockpitState {
  /** −1..1, + = clockwise (toward lane 3 / −z). */
  steer: number;
  speedKmh: number;
  boostCharges: number;
  bounceCharges: number;
  shieldSeconds: number;
  /** Road grade in percent (0 = flat, 100 = a 45° drop). */
  gradePct: number;
  grounded: boolean;
  inLoop: boolean;
  status: GameStatus;
  /** Race position, 1-based. */
  position: number;
  /** Seconds since the push ended. */
  raceTime: number;
  /** Shown in the centre gauge during the pool/countdown phases; null the rest of the time. */
  countdownLabel: string | null;
  /** True while the starter goblin is shoving the grid. */
  pushing: boolean;
}

/**
 * The snapshot fields the HUD's channel is filled from — the *minimum* the gauges need, named
 * structurally so this function can be exercised with a literal instead of a whole `GameSnapshot`.
 * `GameSnapshot` satisfies it, which is the point: the engine hands over the one it already has.
 */
export interface CockpitTelemetry {
  status: GameStatus;
  speed: number;
  boosts: number;
  bounces: number;
  shieldSeconds: number;
  /** Road grade in percent. */
  grade: number;
  grounded: boolean;
  inLoop: boolean;
  position: number;
  raceTime: number;
  merge?: { countdownLabel?: string | null } | null;
}

/**
 * Fills the reused channel from live telemetry: **every gauge is read from the state the physics
 * stepped**, never from a constant or a copy taken at some earlier moment.
 *
 * `steer` is passed in rather than read here because it is the player's own lateral velocity
 * (`steerFrom(player.vz, handling)`) — the yoke leads the lane change instead of replaying it, which
 * is only true if the value comes from the same tick the physics just integrated.
 *
 * The object is mutated and returned, never re-created: a fresh record per frame would be a per-frame
 * allocation in the render path, which this project forbids.
 */
export function fillCockpitState(
  state: CockpitState,
  telemetry: CockpitTelemetry,
  steer: number,
): CockpitState {
  state.steer = steer;
  state.speedKmh = telemetry.speed;
  state.boostCharges = telemetry.boosts;
  state.bounceCharges = telemetry.bounces;
  state.shieldSeconds = telemetry.shieldSeconds;
  state.gradePct = telemetry.grade;
  state.grounded = telemetry.grounded;
  state.inLoop = telemetry.inLoop;
  state.status = telemetry.status;
  state.position = telemetry.position;
  state.raceTime = telemetry.raceTime;
  state.pushing = telemetry.status === 'pushing';
  // M01 · T2: while the field is queued the centre gauge is the pool's, and it says POOL until the
  // pool's own countdown starts speaking. Outside those phases the centre is blank.
  state.countdownLabel = telemetry.merge?.countdownLabel
    ?? (telemetry.status === 'checkpoint' ? 'POOL' : null);
  return state;
}

export function createCockpitState(): CockpitState {
  return {
    steer: 0, speedKmh: 0, boostCharges: 0, bounceCharges: 0, shieldSeconds: 0, gradePct: 0,
    grounded: false, inLoop: false, status: 'loading', position: 1, raceTime: 0,
    countdownLabel: null, pushing: false,
  };
}

/**
 * Lateral speed → steer, clamped to the physics' own `vz / (VZ_MAX · handling)`.
 * Sign: steerLeft (A) moves the ball toward lane 3 at negative vz, which is screen-left in both
 * cameras, so negative vz must give a negative (anticlockwise) yoke.
 */
export function steerFrom(vz: number, handling: number): number {
  if (!Number.isFinite(vz) || !Number.isFinite(handling) || handling <= 0) return 0;
  const steer = Math.max(-1, Math.min(1, vz / (VZ_MAX * handling)));
  return steer === 0 ? 0 : steer; // normalise −0
}

export const yokeAngleDeg = (steer: number): number =>
  Math.max(-1, Math.min(1, Number.isFinite(steer) ? steer : 0)) * YOKE_MAX_DEG;

/** A dial needle: [min, max] → [−sweep/2, +sweep/2] degrees, clamped outside the range. */
export function needleAngle(value: number, min: number, max: number, sweepDeg: number): number {
  if (!Number.isFinite(value) || max === min) return 0;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return -sweepDeg / 2 + t * sweepDeg;
}

/* -----------------------------------------------------------------------------
   3. LAYOUT (pure, viewport-driven)
   -------------------------------------------------------------------------- */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

export interface ArmPose {
  /** Where the arm sprite's top-left goes, CSS px. */
  x: number; y: number;
  /** True for the left arm: the sprite is mirrored in CSS (`scaleX(-1)`), one image for both arms. */
  mirrored: boolean;
  /** Sprite box, CSS px (the aspect ratio of the painted arm). */
  w: number; h: number;
  /** Rotation about the hand, degrees. */
  rotDeg: number;
  /** The hand's position: exactly the yoke grip it is holding. */
  grip: Point;
  /** Where the shoulder is (always below the viewport bottom). */
  shoulder: Point;
}

export interface CockpitLayout {
  w: number; h: number;
  aperture: Rect & { radius: number };
  horizonY: number;
  yoke: { hub: Point; scale: number; w: number; h: number };
  arms: { left: ArmPose; right: ArmPose };
  clusters: { left: { x: number; y: number; w: number }; right: { x: number; y: number; w: number } };
  strip: { x: number; y: number; w: number; h: number };
}

const BEZEL = manifest.bezel;
const YOKE = manifest.yoke;
const ARM = manifest.arm;

/** The bezel's aperture as shares of the viewport, measured off the finished PNG. */
export const APERTURE_FRACTION = {
  x: BEZEL.aperture.x / BEZEL.w,
  y: BEZEL.aperture.y / BEZEL.h,
  w: BEZEL.aperture.w / BEZEL.w,
  h: BEZEL.aperture.h / BEZEL.h,
  radius: BEZEL.aperture.radius / BEZEL.h,
} as const;

/** Upward offset for yoke grips to place hands higher on the wheel rim. */
export const YOKE_GRIP_Y_OFFSET = 64;

/** The yoke's grip anchors inside its own sprite, as shares of the sprite box. */
const GRIP_FRACTION = {
  left: { x: YOKE.grips.left.x / YOKE.w, y: (YOKE.grips.left.y - YOKE_GRIP_Y_OFFSET) / YOKE.h },
  right: { x: YOKE.grips.right.x / YOKE.w, y: (YOKE.grips.right.y - YOKE_GRIP_Y_OFFSET) / YOKE.h },
  pivot: { x: YOKE.pivot.x / YOKE.w, y: YOKE.pivot.y / YOKE.h },
} as const;

/** The hand's anchor inside the arm sprite. */
const ARM_GRIP_FRACTION = ARM.gripFraction;
/**
 * How far the *painted* sleeve runs below the fist, as a share of the sprite's canvas height. The
 * arm is scaled so this span reaches the shoulder, which is what keeps the limb going off-screen at
 * every viewport instead of ending in mid-air above the dashboard.
 */
export const ARM_FIST_TO_SLEEVE = (ARM.paint.y + ARM.paint.h) / ARM.h - ARM_GRIP_FRACTION.y;

/** Where a yoke grip lands in viewport pixels, with the yoke turned by `yokeDeg`. */
export function gripPoints(layout: CockpitLayout, yokeDeg: number): { left: Point; right: Point; hub: Point } {
  const { hub, scale } = layout.yoke;
  const a = (yokeDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rotate = (anchor: { x: number; y: number }): Point => {
    const dx = (anchor.x - GRIP_FRACTION.pivot.x) * YOKE.w * scale;
    const dy = (anchor.y - GRIP_FRACTION.pivot.y) * YOKE.h * scale;
    return { x: hub.x + dx * cos - dy * sin, y: hub.y + dx * sin + dy * cos };
  };
  return { left: rotate(GRIP_FRACTION.left), right: rotate(GRIP_FRACTION.right), hub };
}

function armFor(side: 'left' | 'right', layout: CockpitLayout, grip: Point): ArmPose {
  const span = YOKE.spanWidth * layout.yoke.scale;
  const sign = side === 'left' ? -1 : 1;
  const shoulder: Point = {
    x: layout.w / 2 + sign * span * 0.62,
    y: layout.h * (1 + SHOULDER_BELOW),
  };
  // Scale the sprite so the painted limb reads ARM_WIDTH_OF_HEIGHT tall. Where that would leave the
  // sleeve short of the shoulder (small viewports, arms at full lock), grow it until it reaches:
  // the limb must run off the bottom edge, never stop short of it.
  const paintWidth = Math.max(0.05, ARM.paint.widthFraction);
  const distance = Math.hypot(grip.x - shoulder.x, grip.y - shoulder.y);
  const needed = (distance / Math.max(0.05, ARM_FIST_TO_SLEEVE)) * (ARM.w / ARM.h);
  const spriteW = Math.max((layout.h * ARM_WIDTH_OF_HEIGHT) / paintWidth, needed / 1);
  const spriteH = spriteW * (ARM.h / ARM.w);
  // Rotation is about the hand, so the hand cannot drift off the grip at any yoke angle. The angle
  // is measured from "straight down the sprite" to "toward the shoulder", in CSS degrees
  // (clockwise on screen): the arm hangs from the fist toward a shoulder that is off-screen.
  const rotDeg = (Math.atan2(-(shoulder.x - grip.x), shoulder.y - grip.y) * 180) / Math.PI;
  return {
    x: grip.x - ARM_GRIP_FRACTION.x * spriteW,
    y: grip.y - ARM_GRIP_FRACTION.y * spriteH,
    w: spriteW, h: spriteH, rotDeg, grip, shoulder, mirrored: side === 'left',
  };
}

/** The whole first-person layout for a viewport. Pure: same numbers for the DOM and for tests. */
export function cockpitLayout(w: number, h: number): CockpitLayout {
  const aperture = {
    x: APERTURE_FRACTION.x * w,
    y: APERTURE_FRACTION.y * h,
    w: APERTURE_FRACTION.w * w,
    h: APERTURE_FRACTION.h * h,
    radius: APERTURE_FRACTION.radius * h,
  };
  const span = Math.min(w * YOKE_SPAN_OF_WIDTH, h * YOKE_SPAN_OF_HEIGHT);
  const scale = span / YOKE.spanWidth;
  const clusterW = Math.min(w * 0.3, h * 0.46, (h * 0.3) / (419 / 1024));
  const yoke: CockpitLayout['yoke'] = { hub: { x: w / 2, y: h * YOKE_HUB_Y }, scale, w: YOKE.w * scale, h: YOKE.h * scale };
  const layout: CockpitLayout = {
    w, h, aperture, horizonY: aperture.y + aperture.h / 2, yoke,
    arms: { left: null as unknown as ArmPose, right: null as unknown as ArmPose },
    clusters: {
      left: { x: w * 0.005, y: h - clusterW * (419 / 1024) - 4, w: clusterW },
      right: { x: w - clusterW - w * 0.005, y: h - clusterW * (485 / 1024) - 4, w: clusterW },
    },
    strip: { x: 0, y: h - Math.max(18, h * 0.05), w, h: Math.max(18, h * 0.05) },
  };
  const grips = gripPoints(layout, 0);
  layout.arms = { left: armFor('left', layout, grips.left), right: armFor('right', layout, grips.right) };
  return layout;
}

/** Arms for a turned yoke. The hands stay on the grips by construction. */
export function armsAt(layout: CockpitLayout, yokeDeg: number): { left: ArmPose; right: ArmPose } {
  const grips = gripPoints(layout, yokeDeg);
  return { left: armFor('left', layout, grips.left), right: armFor('right', layout, grips.right) };
}

/* -----------------------------------------------------------------------------
   4. BOB (visual only, never under reduced motion)
   -------------------------------------------------------------------------- */

/** Viewport bob in px. Speed-driven and grounded-only, so airtime does not read as vibration. */
export function cockpitBob(speedKmh: number, grounded: boolean, reducedMotion: boolean, seconds: number): number {
  if (reducedMotion || !grounded) return 0;
  const t = Math.max(0, Math.min(1, speedKmh / 360));
  return Math.sin(seconds * 11.5) * BOB_MAX_PX * t;
}

/* -----------------------------------------------------------------------------
   5. ART PATHS
   -------------------------------------------------------------------------- */

export const COCKPIT_ART = {
  bezel: `/${BEZEL.file}`,
  yoke: `/${YOKE.file}`,
  arm: `/${ARM.file}`,
  starter: `/${manifest.starter.file}`,
  /** M01 · T2 — the pool goblin: hold, call, count, and the sweep that sends the field off. */
  poolGoblin: `/${manifest.poolGoblin.file}`,
  strip: `/${manifest.rivetStrip.file}`,
  clusters: manifest.clusters.map((cluster) => `/${cluster.file}`),
  dials: manifest.dials.map((dial) => `/${dial.file}`),
} as const;

/** Every cockpit image, for the preloader (law 4: nothing decodes during a race). */
export const COCKPIT_ART_PATHS: readonly string[] = [
  COCKPIT_ART.bezel, COCKPIT_ART.yoke, COCKPIT_ART.arm, COCKPIT_ART.starter, COCKPIT_ART.poolGoblin,
  COCKPIT_ART.strip, ...COCKPIT_ART.clusters, ...COCKPIT_ART.dials,
];

export const COCKPIT_MANIFEST = manifest;
