// src/index.ts — "Live Puppet": two-bone IK for a blocky goblin.
export type Vec3 = [number, number, number];
export type Limb = 'armL' | 'armR' | 'legL' | 'legR';
export interface LimbDef { root: Vec3; upper: number; lower: number; pole: Vec3 }
export interface LimbPose { mid: Vec3; end: Vec3; reached: boolean }
export interface Pose { limbs: Record<Limb, LimbPose>; offset: Vec3 }

export const LIMBS: readonly Limb[] = ['armL', 'armR', 'legL', 'legR'];

export const RIG: Readonly<Record<Limb, LimbDef>> = {
  armL: { root: [-0.25, 1.2, 0], upper: 0.3, lower: 0.3, pole: [0, 0, -1] },
  armR: { root: [0.25, 1.2, 0], upper: 0.3, lower: 0.3, pole: [0, 0, -1] },
  legL: { root: [-0.12, 0.6, 0], upper: 0.3, lower: 0.3, pole: [0, 0, 1] },
  legR: { root: [0.12, 0.6, 0], upper: 0.3, lower: 0.3, pole: [0, 0, 1] },
};

const EPS = 1e-9;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => { const l = len(a); return l < EPS ? [0, 0, 0] : scale(a, 1 / l); };
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const copy = (a: Vec3): Vec3 => [a[0], a[1], a[2]];
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Unit vector perpendicular to `dir`, as close to `pole` as possible (with fallbacks when parallel). */
function perpendicular(dir: Vec3, pole: Vec3): Vec3 {
  const candidates: Vec3[] = [pole, [0, 0, 1], [1, 0, 0], [0, 1, 0]];
  for (const c of candidates) {
    const p = sub(c, scale(dir, dot(c, dir)));
    if (len(p) > 1e-6) return norm(p);
  }
  return [1, 0, 0];
}

export function solveLimb(def: LimbDef, target: Vec3): LimbPose {
  const { root, upper, lower, pole } = def;
  const minD = Math.abs(upper - lower);
  const maxD = upper + lower;
  const delta = sub(target, root);
  const rawD = len(delta);
  // At the root there is no direction: fall back on the rest direction (straight down).
  const dir: Vec3 = rawD < EPS ? [0, -1, 0] : scale(delta, 1 / rawD);
  const perp = perpendicular(dir, pole);

  if (rawD > maxD + EPS) {
    return { mid: add(root, scale(dir, upper)), end: add(root, scale(dir, maxD)), reached: false };
  }
  const d = clamp(rawD, minD, maxD);
  if (d < EPS) {
    // Equal bones folded completely: the elbow sticks out along the pole.
    return { mid: add(root, scale(perp, upper)), end: copy(root), reached: true };
  }
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const end = add(root, scale(dir, d));
  const mid = add(add(root, scale(dir, a)), scale(perp, h));
  return { mid, end, reached: true };
}

export function restPose(): Pose {
  const limbs = {} as Record<Limb, LimbPose>;
  for (const l of LIMBS) {
    const d = RIG[l];
    limbs[l] = solveLimb(d, [d.root[0], d.root[1] - d.upper - d.lower, d.root[2]]);
  }
  return { limbs, offset: [0, 0, 0] };
}

export function pickLimb(pose: Pose, point: Vec3, radius: number): Limb | null {
  let best: Limb | null = null;
  let bestD = radius;
  for (const l of LIMBS) {
    const d = len(sub(add(pose.limbs[l].end, pose.offset), point));
    if (d <= bestD) { bestD = d; best = l; }
  }
  return best;
}

function withLimb(pose: Pose, limb: Limb, lp: LimbPose): Pose {
  return { limbs: { ...pose.limbs, [limb]: lp }, offset: copy(pose.offset) };
}

export function dragLimb(pose: Pose, limb: Limb, target: Vec3): Pose {
  return withLimb(pose, limb, solveLimb(RIG[limb], sub(target, pose.offset)));
}

/** Move the whole body by `delta`; limbs ride along (they are stored in body space). */
export function dragBody(pose: Pose, delta: Vec3): Pose {
  return { limbs: { ...pose.limbs }, offset: add(pose.offset, delta) };
}

const OPPOSITE: Record<Limb, Limb> = { armL: 'armR', armR: 'armL', legL: 'legR', legR: 'legL' };

export function mirror(pose: Pose, from: Limb): Pose {
  const to = OPPOSITE[from];
  const e = pose.limbs[from].end;
  return withLimb(pose, to, solveLimb(RIG[to], [-e[0], e[1], e[2]]));
}

const DEG = 180 / Math.PI;

export function toAngles(pose: Pose): Record<Limb, { swingX: number; swingZ: number; bend: number }> {
  const out = {} as Record<Limb, { swingX: number; swingZ: number; bend: number }>;
  for (const l of LIMBS) {
    const def = RIG[l];
    const lp = pose.limbs[l];
    const u = norm(sub(lp.mid, def.root));
    const w = norm(sub(lp.end, lp.mid));
    const swingX = Math.atan2(u[2], -u[1]) * DEG;   // about x: down -> forward (+z) is positive
    const swingZ = Math.atan2(u[0], -u[1]) * DEG;   // about z: down -> +x is positive
    const bend = Math.acos(clamp(dot(u, w), -1, 1)) * DEG;
    out[l] = { swingX, swingZ, bend };
  }
  return out;
}

export function blend(a: Pose, b: Pose, t: number): Pose {
  const k = clamp(t, 0, 1);
  const limbs = {} as Record<Limb, LimbPose>;
  for (const l of LIMBS) {
    const end = lerp(a.limbs[l].end, b.limbs[l].end, k);
    limbs[l] = solveLimb(RIG[l], end);
  }
  return { limbs, offset: lerp(a.offset, b.offset, k) };
}