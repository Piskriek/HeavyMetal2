export type V3 = [number, number, number];

export interface Particle {
  pos: V3;
  prev: V3;
  mass: number;
}

export interface Stick {
  a: number;
  b: number;
  length: number;
  stiffness: number;
}

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

export const JOINTS: readonly string[] = [
  'head', 'neck', 'pelvis', 'lHand', 'lElbow', 'rHand', 'rElbow',
  'lFoot', 'lKnee', 'rFoot', 'rKnee',
];

const copy = (v: V3): V3 => [v[0], v[1], v[2]];
const subtract = (a: V3, b: V3): V3 =>
  [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const weight = (p: Particle): number => p.mass > 0 ? 1 / p.mass : 0;
const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

function addScaled(to: V3, from: V3, scale: number): void {
  to[0] += from[0] * scale;
  to[1] += from[1] * scale;
  to[2] += from[2] * scale;
}

function clone(r: Ragdoll): Ragdoll {
  return {
    particles: r.particles.map((p) => ({
      pos: copy(p.pos), prev: copy(p.prev), mass: p.mass,
    })),
    sticks: r.sticks.map((s) => ({ ...s })),
    limits: r.limits.map((l) => ({ ...l })),
  };
}

/** Make a goblin with sticks at the pose's current lengths and limited elbows and knees. */
export function goblin(pose: Record<string, V3>): Ragdoll {
  const particles = JOINTS.map((name): Particle => {
    const joint = pose[name];
    if (!joint) throw new Error(`Missing joint: ${name}`);
    return { pos: copy(joint), prev: copy(joint), mass: 1 };
  });
  const pairs: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [1, 2], [1, 4], [4, 3], [1, 6], [6, 5],
    [2, 8], [8, 7], [2, 10], [10, 9],
  ];
  const sticks = pairs.map(([a, b]): Stick => {
    const first = particles[a];
    const second = particles[b];
    if (!first || !second) throw new Error('Invalid joint index');
    return { a, b, length: length(subtract(first.pos, second.pos)), stiffness: 1 };
  });
  const limits: Limit[] = [
    { a: 1, mid: 4, b: 3, min: 0.1, max: Math.PI },
    { a: 1, mid: 6, b: 5, min: 0.1, max: Math.PI },
    { a: 2, mid: 8, b: 7, min: 0.1, max: Math.PI },
    { a: 2, mid: 10, b: 9, min: 0.1, max: Math.PI },
  ];
  return { particles, sticks, limits };
}

/** Add velocity to all unpinned particles, or only the selected indices. */
export function kick(r: Ragdoll, impulse: V3, dt: number, only?: number[]): Ragdoll {
  const result = clone(r);
  const selected = only === undefined ? undefined : new Set(only);
  result.particles.forEach((p, i) => {
    if (p.mass <= 0 || (selected !== undefined && !selected.has(i))) return;
    addScaled(p.prev, impulse, -dt);
  });
  return result;
}

function constrainStick(particles: Particle[], stick: Stick): void {
  const a = particles[stick.a];
  const b = particles[stick.b];
  if (!a || !b) return;
  const wa = weight(a);
  const wb = weight(b);
  if (wa + wb === 0) return;

  const separation = subtract(b.pos, a.pos);
  const distance = length(separation);
  const direction: V3 = distance > 1e-12
    ? [separation[0] / distance, separation[1] / distance, separation[2] / distance]
    : [1, 0, 0];
  const correction = clamp(stick.stiffness, 0, 1) *
    (distance - stick.length) / (wa + wb);
  addScaled(a.pos, direction, wa * correction);
  addScaled(b.pos, direction, -wb * correction);
}

function constrainLimit(particles: Particle[], limit: Limit): void {
  const a = particles[limit.a];
  const mid = particles[limit.mid];
  const b = particles[limit.b];
  if (!a || !mid || !b) return;

  const u = subtract(a.pos, mid.pos);
  const v = subtract(b.pos, mid.pos);
  const lu = length(u);
  const lv = length(v);
  if (lu < 1e-12 || lv < 1e-12) return;
  const ua: V3 = [u[0] / lu, u[1] / lu, u[2] / lu];
  const ub: V3 = [v[0] / lv, v[1] / lv, v[2] / lv];
  const cosine = clamp(dot(ua, ub), -1, 1);
  const angle = Math.acos(cosine);
  const target = clamp(angle, limit.min, limit.max);
  if (angle === target) return;

  let ga: V3;
  let gb: V3;
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  if (sine > 1e-6) {
    ga = [
      (cosine * ua[0] - ub[0]) / (lu * sine),
      (cosine * ua[1] - ub[1]) / (lu * sine),
      (cosine * ua[2] - ub[2]) / (lu * sine),
    ];
    gb = [
      (cosine * ub[0] - ua[0]) / (lv * sine),
      (cosine * ub[1] - ua[1]) / (lv * sine),
      (cosine * ub[2] - ua[2]) / (lv * sine),
    ];
  } else {
    // Collinear limbs need a deterministic direction in which to start bending.
    const axis: V3 = Math.abs(ua[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const perpendicular: V3 = [
      ua[1] * axis[2] - ua[2] * axis[1],
      ua[2] * axis[0] - ua[0] * axis[2],
      ua[0] * axis[1] - ua[1] * axis[0],
    ];
    const n = length(perpendicular);
    ga = [perpendicular[0] / (n * lu), perpendicular[1] / (n * lu), perpendicular[2] / (n * lu)];
    const sign = cosine > 0 ? -1 : 1;
    gb = [sign * perpendicular[0] / (n * lv), sign * perpendicular[1] / (n * lv), sign * perpendicular[2] / (n * lv)];
  }

  const gm: V3 = [-ga[0] - gb[0], -ga[1] - gb[1], -ga[2] - gb[2]];
  const wa = weight(a);
  const wm = weight(mid);
  const wb = weight(b);
  const denominator = wa * dot(ga, ga) + wm * dot(gm, gm) + wb * dot(gb, gb);
  if (denominator < 1e-12) return;
  const correction = (target - angle) / denominator;
  addScaled(a.pos, ga, wa * correction);
  addScaled(mid.pos, gm, wm * correction);
  addScaled(b.pos, gb, wb * correction);
}

function constrainGround(particles: Particle[], ground: number): void {
  for (const p of particles) {
    if (p.mass > 0 && p.pos[1] < ground) p.pos[1] = ground;
  }
}

/** Advance Verlet motion, then solve sticks, joint angles and ground contacts. */
export function step(r: Ragdoll, dt: number, iterations: number, ground: number): Ragdoll {
  const result = clone(r);
  for (const p of result.particles) {
    if (p.mass <= 0) {
      p.prev = copy(p.pos);
      continue;
    }
    const old = copy(p.pos);
    p.pos = [
      old[0] + (old[0] - p.prev[0]) * 0.99,
      old[1] + (old[1] - p.prev[1]) * 0.99 - 9.8 * dt * dt,
      old[2] + (old[2] - p.prev[2]) * 0.99,
    ];
    p.prev = old;
  }

  for (let i = 0; i < Math.max(0, Math.floor(iterations)); i++) {
    for (const stick of result.sticks) constrainStick(result.particles, stick);
    for (const limit of result.limits) constrainLimit(result.particles, limit);
    constrainGround(result.particles, ground);
  }
  constrainGround(result.particles, ground);
  for (const p of result.particles) {
    if (p.mass <= 0 || p.pos[1] > ground) continue;
    // A contact removes vertical velocity and 80% of horizontal velocity.
    p.prev[0] = p.pos[0] - 0.2 * (p.pos[0] - p.prev[0]);
    p.prev[1] = ground;
    p.prev[2] = p.pos[2] - 0.2 * (p.pos[2] - p.prev[2]);
  }
  return result;
}

/** Check the displacement encoded by every particle's current and previous positions. */
export function resting(r: Ragdoll, eps: number): boolean {
  return r.particles.every((p) => length(subtract(p.pos, p.prev)) < eps);
}

/** Interpolate positions and previous positions back to the animated pose. */
export function blend(r: Ragdoll, pose: Record<string, V3>, t: number): Ragdoll {
  const result = clone(r);
  const amount = clamp(t, 0, 1);
  if (amount === 0) return result;
  result.particles.forEach((p, i) => {
    const name = JOINTS[i];
    if (name === undefined) return;
    const target = pose[name];
    if (!target) throw new Error(`Missing joint: ${name}`);
    if (amount === 1) {
      p.pos = copy(target);
      p.prev = copy(target);
    } else {
      addScaled(p.pos, subtract(target, p.pos), amount);
      addScaled(p.prev, subtract(target, p.prev), amount);
    }
  });
  return result;
}