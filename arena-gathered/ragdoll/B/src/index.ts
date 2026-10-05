// src/index.ts
/**
 * A very small ragdoll for a toy-world game: goblins that get knocked over by a
 * hit or a fall, then blend back into their animated pose when they get up.
 *
 * - Particles integrated with Verlet (pos / prev), gravity + damping.
 * - Distance sticks between connected joints (relaxed position projection).
 * - Joint angle limits (elbows and knees) enforced by rotating the child bone
 *   around the joint axis, so a knee can never fold inside `min` or snap past
 *   `max` radians.
 * - A ground plane (y >= ground) with tangential friction, so a body that lands
 *   slides a little and then stops.
 * - `blend` walks every joint back from the crashed pose to the animated pose;
 *   at t = 1 the velocity is zeroed too, so the goblin stands still.
 *
 * Deterministic: pure functions over plain data, no clocks, no randomness,
 * no globals. Every function returns a fresh ragdoll and never mutates its
 * input.
 */

export type V3 = [number, number, number];

export interface Particle {
  /** mass 0 = pinned (never moved by verlet, sticks or impulses) */
  mass: number;
  pos: V3;
  prev: V3;
}

export interface Stick {
  a: number;
  b: number;
  length: number;
  /** 0..1, how much of the error is corrected per pass */
  stiffness: number;
}

/** angle at `mid`, between the bones mid->a and mid->b, in radians */
export interface Limit {
  a: number;
  mid: number;
  b: number;
  min: number;
  max: number;
}

export interface Ragdoll {
  particles: Particle[];
  sticks: Stick[];
  limits: Limit[];
}

/** Joint names, and therefore the particle order of every goblin ragdoll. */
export const JOINTS: readonly string[] = [
  'head',
  'neck',
  'pelvis',
  'lHand',
  'lElbow',
  'rHand',
  'rElbow',
  'lFoot',
  'lKnee',
  'rFoot',
  'rKnee',
];

const HEAD = 0;
const NECK = 1;
const PELVIS = 2;
const L_HAND = 3;
const L_ELBOW = 4;
const R_HAND = 5;
const R_ELBOW = 6;
const L_FOOT = 7;
const L_KNEE = 8;
const R_FOOT = 9;
const R_KNEE = 10;

/** Skeleton: head - neck - pelvis, two arms off the neck, two legs off the pelvis. */
const BONES: readonly (readonly [number, number])[] = [
  [HEAD, NECK],
  [NECK, PELVIS],
  [NECK, L_ELBOW],
  [L_ELBOW, L_HAND],
  [NECK, R_ELBOW],
  [R_ELBOW, R_HAND],
  [PELVIS, L_KNEE],
  [L_KNEE, L_FOOT],
  [PELVIS, R_KNEE],
  [R_KNEE, R_FOOT],
];

const ELBOW_RANGE = { min: 0.1, max: Math.PI };
const KNEE_RANGE = { min: 0.1, max: Math.PI };

const STIFFNESS = 0.9;
const GRAVITY_Y = -9.8;
const DAMPING = 0.99;
const FRICTION = 0.8;

/* ------------------------------------------------------------------ helpers */

function v3(x: number, y: number, z: number): V3 {
  return [x, y, z];
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function pick<T>(list: readonly T[], i: number): T {
  const item: T | undefined = list[i];
  if (item === undefined) throw new Error(`ragdoll: index ${i} out of range`);
  return item;
}

function dist(a: V3, b: V3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function copyParticle(p: Particle): Particle {
  return { pos: v3(p.pos[0], p.pos[1], p.pos[2]), prev: v3(p.prev[0], p.prev[1], p.prev[2]), mass: p.mass };
}

function clone(r: Ragdoll): Ragdoll {
  return {
    particles: r.particles.map(copyParticle),
    sticks: r.sticks.map((s) => ({ a: s.a, b: s.b, length: s.length, stiffness: s.stiffness })),
    limits: r.limits.map((l) => ({ a: l.a, mid: l.mid, b: l.b, min: l.min, max: l.max })),
  };
}

/* -------------------------------------------------------------- build goblin */

export function goblin(pose: Record<string, V3>): Ragdoll {
  const particles: Particle[] = [];
  for (const name of JOINTS) {
    const p = pose[name];
    if (p === undefined) throw new Error(`goblin: pose is missing joint "${name}"`);
    particles.push({ pos: v3(p[0], p[1], p[2]), prev: v3(p[0], p[1], p[2]), mass: 1 });
  }
  if (particles.length !== JOINTS.length) throw new Error('goblin: bad particle count');

  const sticks: Stick[] = BONES.map((bone) => {
    const a = pick(particles, bone[0]);
    const b = pick(particles, bone[1]);
    return {
      a: bone[0],
      b: bone[1],
      length: dist(a.pos, b.pos),
      stiffness: STIFFNESS,
    };
  });

  const limits: Limit[] = [];
  const addLimit = (a: number, mid: number, b: number, range: { min: number; max: number }): void => {
    limits.push({ a, mid, b, min: range.min, max: range.max });
  };
  addLimit(L_HAND, L_ELBOW, NECK, ELBOW_RANGE);
  addLimit(R_HAND, R_ELBOW, NECK, ELBOW_RANGE);
  addLimit(L_FOOT, L_KNEE, PELVIS, KNEE_RANGE);
  addLimit(R_FOOT, R_KNEE, PELVIS, KNEE_RANGE);

  return { particles, sticks, limits };
}

/* --------------------------------------------------------------------- kick */

/** Impulse in metres per second: prev -= impulse * dt. */
export function kick(r: Ragdoll, impulse: V3, dt: number, only?: number[]): Ragdoll {
  const out = clone(r);
  const targets: Set<number> | null = only === undefined ? null : new Set(only);
  for (let i = 0; i < out.particles.length; i++) {
    const p = pick(out.particles, i);
    if (p.mass <= 0) continue;
    if (targets !== null && !targets.has(i)) continue;
    p.prev = v3(p.prev[0] - impulse[0] * dt, p.prev[1] - impulse[1] * dt, p.prev[2] - impulse[2] * dt);
  }
  return out;
}

/* ------------------------------------------------------------------- solver */

function solveSticks(r: Ragdoll): void {
  for (const s of r.sticks) {
    const pa = pick(r.particles, s.a);
    const pb = pick(r.particles, s.b);
    const wa = pa.mass > 0 ? 1 / pa.mass : 0;
    const wb = pb.mass > 0 ? 1 / pb.mass : 0;
    const wsum = wa + wb;
    if (wsum <= 0) continue;

    const dx = pb.pos[0] - pa.pos[0];
    const dy = pb.pos[1] - pa.pos[1];
    const dz = pb.pos[2] - pa.pos[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-9) continue;

    const k = clamp(s.stiffness, 0, 1) * ((d - s.length) / d);
    const ka = (wa / wsum) * k;
    const kb = (wb / wsum) * k;
    pa.pos = v3(pa.pos[0] + dx * ka, pa.pos[1] + dy * ka, pa.pos[2] + dz * ka);
    pb.pos = v3(pb.pos[0] - dx * kb, pb.pos[1] - dy * kb, pb.pos[2] - dz * kb);
  }
}

/**
 * Keeps the angle at `mid` inside [min, max]. Only the child particle `a`
 * (hand / foot) is rotated, about the joint axis, so bone lengths survive.
 */
function solveLimits(r: Ragdoll): void {
  for (const l of r.limits) {
    const a = pick(r.particles, l.a);
    const mid = pick(r.particles, l.mid);
    const b = pick(r.particles, l.b);

    const ux = a.pos[0] - mid.pos[0];
    const uy = a.pos[1] - mid.pos[1];
    const uz = a.pos[2] - mid.pos[2];
    const vx = b.pos[0] - mid.pos[0];
    const vy = b.pos[1] - mid.pos[1];
    const vz = b.pos[2] - mid.pos[2];
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (ul < 1e-9 || vl < 1e-9) continue;

    const cos = clamp((ux * vx + uy * vy + uz * vz) / (ul * vl), -1, 1);
    const angle = Math.acos(cos);
    if (angle >= l.min && angle <= l.max) continue;

    const delta = angle - (angle < l.min ? l.min : l.max);

    // axis = normalise(u x v); degenerate when the bones are collinear
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl > 1e-12) {
      nx /= nl;
      ny /= nl;
      nz /= nl;
    } else {
      // pick the world axis least parallel to u, then take e x u
      const ax = Math.abs(ux);
      const ay = Math.abs(uy);
      const az = Math.abs(uz);
      let ex = 0;
      let ey = 0;
      let ez = 0;
      if (ax <= ay && ax <= az) {
        ex = 1;
      } else if (ay <= az) {
        ey = 1;
      } else {
        ez = 1;
      }
      nx = ey * uz - ez * uy;
      ny = ez * ux - ex * uz;
      nz = ex * uy - ey * ux;
      const nl2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl2 < 1e-12) continue;
      nx /= nl2;
      ny /= nl2;
      nz /= nl2;
    }

    // Rodrigues, with u perpendicular to the axis: u' = u cos(d) + (n x u) sin(d)
    const c = Math.cos(delta);
    const s = Math.sin(delta);
    a.pos = v3(
      mid.pos[0] + ux * c + (ny * uz - nz * uy) * s,
      mid.pos[1] + uy * c + (nz * ux - nx * uz) * s,
      mid.pos[2] + uz * c + (nx * uy - ny * ux) * s,
    );
  }
}

function solveGround(r: Ragdoll, ground: number): void {
  for (const p of r.particles) {
    if (p.pos[1] >= ground) continue;
    p.pos[1] = ground;
    if (p.mass <= 0) continue;
    // friction while touching: eat most of the tangential motion
    p.prev = v3(
      p.prev[0] + (p.pos[0] - p.prev[0]) * FRICTION,
      p.pos[1],
      p.prev[2] + (p.pos[2] - p.prev[2]) * FRICTION,
    );
  }
}

export function step(r: Ragdoll, dt: number, iterations: number, ground: number): Ragdoll {
  const out = clone(r);
  const dt2 = dt * dt;
  const gy = GRAVITY_Y * dt2;

  for (const p of out.particles) {
    if (p.mass <= 0) continue;
    const x = p.pos[0];
    const y = p.pos[1];
    const z = p.pos[2];
    const vx = (x - p.prev[0]) * DAMPING;
    const vy = (y - p.prev[1]) * DAMPING;
    const vz = (z - p.prev[2]) * DAMPING;
    p.prev = v3(x, y, z);
    p.pos = v3(x + vx, y + vy + gy, z + vz);
  }

  const passes = iterations > 0 ? Math.floor(iterations) : 0;
  for (let i = 0; i < passes; i++) {
    solveSticks(out);
    solveLimits(out);
    solveGround(out, ground);
  }
  return out;
}

/* ------------------------------------------------------------------ resting */

/** True when every particle moved less than eps during the last step. */
export function resting(r: Ragdoll, eps: number): boolean {
  let worst = 0;
  for (const p of r.particles) {
    const dx = p.pos[0] - p.prev[0];
    const dy = p.pos[1] - p.prev[1];
    const dz = p.pos[2] - p.prev[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > worst) worst = d;
  }
  return worst < eps;
}

/* -------------------------------------------------------------------- blend */

/** t = 0 keeps the ragdoll, t = 1 snaps to the animated pose (and stops it). */
export function blend(r: Ragdoll, pose: Record<string, V3>, t: number): Ragdoll {
  const out = clone(r);
  const k = clamp(t, 0, 1);
  for (let i = 0; i < JOINTS.length; i++) {
    const name: string | undefined = JOINTS[i];
    if (name === undefined) continue;
    const target = pose[name];
    if (target === undefined) continue;
    const p = pick(out.particles, i);
    p.pos = v3(
      p.pos[0] + (target[0] - p.pos[0]) * k,
      p.pos[1] + (target[1] - p.pos[1]) * k,
      p.pos[2] + (target[2] - p.pos[2]) * k,
    );
    p.prev = v3(
      p.prev[0] + (target[0] - p.prev[0]) * k,
      p.prev[1] + (target[1] - p.prev[1]) * k,
      p.prev[2] + (target[2] - p.prev[2]) * k,
    );
  }
  return out;
}