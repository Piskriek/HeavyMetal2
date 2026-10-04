/**
 * Live Puppet – two-bone inverse kinematics for a blocky goblin.
 *
 * Conventions: y up, metres, the character faces +z. Joint positions inside a
 * Pose are in body space; add `pose.offset` to get world positions. `pickLimb`
 * and `dragLimb` take world-space points so the cursor can be fed in directly.
 * Every function is pure: arguments are never mutated.
 */

export type Vec3 = [number, number, number];
export type Limb = 'armL' | 'armR' | 'legL' | 'legR';

export interface LimbDef {
  /** Root joint (shoulder or hip), body space. */
  root: Vec3;
  /** Length of the upper bone (root → mid). */
  upper: number;
  /** Length of the lower bone (mid → end). */
  lower: number;
  /** Direction the middle joint (elbow / knee) bends toward. */
  pole: Vec3;
}

/** One solved limb. `reached` is false when the end could not be put on its target. */
export interface LimbPose { mid: Vec3; end: Vec3; reached: boolean }
/** The whole puppet: a LimbPose per limb plus the body's translation. */
export interface Pose { limbs: Record<Limb, LimbPose>; offset: Vec3 }
/** Animation-rig angles of one limb, degrees (see toAngles). */
export interface LimbAngles { swingX: number; swingZ: number; bend: number }

export const LIMBS: readonly Limb[] = ['armL', 'armR', 'legL', 'legR'];

const frozen = (def: LimbDef): LimbDef => {
  Object.freeze(def.root);
  Object.freeze(def.pole);
  return Object.freeze(def);
};

export const RIG: Readonly<Record<Limb, LimbDef>> = Object.freeze({
  armL: frozen({ root: [-0.25, 1.2, 0], upper: 0.3, lower: 0.3, pole: [0, 0, -1] }),
  armR: frozen({ root: [0.25, 1.2, 0], upper: 0.3, lower: 0.3, pole: [0, 0, -1] }),
  legL: frozen({ root: [-0.12, 0.6, 0], upper: 0.3, lower: 0.3, pole: [0, 0, 1] }),
  legR: frozen({ root: [0.12, 0.6, 0], upper: 0.3, lower: 0.3, pole: [0, 0, 1] }),
});

const OTHER_SIDE: Readonly<Record<Limb, Limb>> = { armL: 'armR', armR: 'armL', legL: 'legR', legR: 'legL' };

// ---- vectors ----------------------------------------------------------------

const EPS = 1e-9;
const DOWN: Vec3 = [0, -1, 0];
const SIDE: Vec3 = [1, 0, 0];

const copy = (v: Vec3): Vec3 => [v[0], v[1], v[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (v: Vec3): number => Math.sqrt(dot(v, v));
const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t,
];
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const degrees = (rad: number): number => (rad * 180) / Math.PI;

/** `v` normalised, or a copy of `fallback` when `v` is (nearly) zero. */
const unitOr = (v: Vec3, fallback: Vec3): Vec3 => {
  const n = length(v);
  return n > EPS ? [v[0] / n, v[1] / n, v[2] / n] : copy(fallback);
};

/** Unit component of `hint` perpendicular to the unit vector `axis`, or null when they are (nearly) parallel. */
const perpendicular = (axis: Vec3, hint: Vec3): Vec3 | null => {
  const p = sub(hint, scale(axis, dot(hint, axis)));
  const n = length(p);
  return n > EPS ? [p[0] / n, p[1] / n, p[2] / n] : null;
};

// ---- pose plumbing ----------------------------------------------------------

function mapLimbs<T>(f: (limb: Limb) => T): Record<Limb, T> {
  return { armL: f('armL'), armR: f('armR'), legL: f('legL'), legR: f('legR') };
}

const cloneLimb = (lp: LimbPose): LimbPose => ({ mid: copy(lp.mid), end: copy(lp.end), reached: lp.reached });

/** A copy of `pose` with one limb replaced. */
function withLimb(pose: Pose, limb: Limb, lp: LimbPose): Pose {
  return {
    limbs: mapLimbs((l) => (l === limb ? lp : cloneLimb(pose.limbs[l]))),
    offset: copy(pose.offset),
  };
}

// ---- public API -------------------------------------------------------------

/** Every limb hanging straight down, body at the origin. */
export function restPose(): Pose {
  return {
    limbs: mapLimbs<LimbPose>((limb) => {
      const { root, upper, lower } = RIG[limb];
      return {
        mid: [root[0], root[1] - upper, root[2]],
        end: [root[0], root[1] - upper - lower, root[2]],
        reached: true,
      };
    }),
    offset: [0, 0, 0],
  };
}

/**
 * Two-bone IK. The middle joint lies in the plane of root, target and pole, on
 * the pole's side; bone lengths are kept exactly.
 * - Target farther than upper + lower: `reached` is false and the straight limb
 *   points at it.
 * - Target nearer than |upper - lower|: pushed out to that distance along the
 *   root→target ray (`reached` false, limb fully folded).
 * - Target on the root itself: the direction is taken as straight down, so an
 *   equal-length limb folds with its middle joint sticking out along the pole.
 * - Target exactly along the pole: no preferred side; the bend falls back to
 *   gravity (then +x) so the result stays deterministic.
 */
export function solveLimb(def: LimbDef, target: Vec3): LimbPose {
  const { root, upper, lower } = def;
  const maxReach = upper + lower;
  const minReach = Math.abs(upper - lower);
  const toTarget = sub(target, root);
  const targetDist = length(toTarget);

  const axis = unitOr(toTarget, DOWN);
  const reached = targetDist >= minReach - EPS && targetDist <= maxReach + EPS;
  const reach = clamp(targetDist, minReach, maxReach);

  const bendDir =
    perpendicular(axis, def.pole) ?? perpendicular(axis, DOWN) ?? perpendicular(axis, SIDE) ?? copy(SIDE);

  // Law of cosines: how far the middle joint sits along the axis, then off it.
  const along = reach > EPS ? (upper * upper - lower * lower + reach * reach) / (2 * reach) : 0;
  const off = Math.sqrt(Math.max(0, upper * upper - along * along));

  const mid = add(root, add(scale(axis, along), scale(bendDir, off)));
  const end = reached ? copy(target) : add(root, scale(axis, reach));
  return { mid, end, reached };
}

/**
 * Which limb end is nearest `point` (world space, within `radius`, inclusive),
 * or null: what the cursor grabs. Ties go to the first limb in LIMBS order.
 */
export function pickLimb(pose: Pose, point: Vec3, radius: number): Limb | null {
  let best: Limb | null = null;
  let bestDist = Infinity;
  for (const limb of LIMBS) {
    const d = distance(add(pose.limbs[limb].end, pose.offset), point);
    if (d <= radius && d < bestDist) {
      best = limb;
      bestDist = d;
    }
  }
  return best;
}

/** Drag one limb end to a world-space target; the other limbs and the body stay. */
export function dragLimb(pose: Pose, limb: Limb, target: Vec3): Pose {
  return withLimb(pose, limb, solveLimb(RIG[limb], sub(target, pose.offset)));
}

/** Move the whole body so its origin sits at `to` (world space); limbs keep their body-space pose. */
export function dragBody(pose: Pose, to: Vec3): Pose {
  return { limbs: mapLimbs((l) => cloneLimb(pose.limbs[l])), offset: copy(to) };
}

/** Copy `from`'s pose onto the opposite limb with x negated: armL <-> armR, legL <-> legR. */
export function mirror(pose: Pose, from: Limb): Pose {
  const src = pose.limbs[from];
  const flip = (v: Vec3): Vec3 => [0 - v[0], v[1], v[2]]; // `0 - x` never yields -0
  return withLimb(pose, OTHER_SIDE[from], { mid: flip(src.mid), end: flip(src.end), reached: src.reached });
}

/**
 * Bone angles for the game's animation rig, degrees.
 * - swingX / swingZ: the upper bone's rotation away from straight down, composed
 *   as upper = Rx(swingX) · Rz(swingZ) · (0,-1,0) with right-handed rotations
 *   about the body's x and z axes. Positive swingX swings the bone toward -z
 *   (backwards for a +z-facing character), positive swingZ toward +x. swingX
 *   covers ±180°, swingZ ±90°.
 * - bend: angle between the lower and the upper bone, 0 = straight,
 *   180 = fully folded; the bend direction is the limb's pole.
 */
export function toAngles(pose: Pose): Record<Limb, LimbAngles> {
  return mapLimbs((limb) => {
    const lp = pose.limbs[limb];
    const u = unitOr(sub(lp.mid, RIG[limb].root), DOWN); // upper bone direction
    const v = unitOr(sub(lp.end, lp.mid), u); // lower bone direction
    // u = (sin Z, -cos Z · cos X, -cos Z · sin X)
    const swingZ = degrees(Math.asin(clamp(u[0], -1, 1)));
    const swingX = Math.hypot(u[1], u[2]) > EPS ? degrees(Math.atan2(0 - u[2], 0 - u[1])) : 0;
    const bend = degrees(Math.acos(clamp(dot(u, v), -1, 1)));
    return { swingX, swingZ, bend };
  });
}

/**
 * Blend two poses (t clamped to 0..1): ends and offset linearly, then every limb
 * is re-solved to its blended end so the bones keep their lengths (the blended
 * middle joint is thereby put back on the pole side).
 */
export function blend(a: Pose, b: Pose, t: number): Pose {
  const k = Number.isFinite(t) ? clamp(t, 0, 1) : 0;
  return {
    limbs: mapLimbs((limb) => solveLimb(RIG[limb], lerp(a.limbs[limb].end, b.limbs[limb].end, k))),
    offset: lerp(a.offset, b.offset, k),
  };
}