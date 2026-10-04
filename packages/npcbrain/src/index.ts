/**
 * Toy-world character AI, written as pure steering.
 *
 * Ground plane only: `y` is scenery. It is copied through every tick and never
 * takes part in a distance, a direction or a decision.
 *
 * Angles are degrees and the facing vector is (sin yaw, 0, cos yaw), so yaw 0
 * looks down +z and yaw 90 looks down +x. A moving agent is turned to face its
 * own movement; a standing one keeps the yaw it had.
 *
 * `think` is a single tick: agent + behaviour + the brain it handed back last
 * time + the target (or null) + dt in; position, yaw, moving and the brain out.
 * There is no clock, no DOM and no Math.random in here — the only randomness is
 * the seeded mulberry32 that `wander` keeps inside its brain — so identical
 * inputs give identical outputs, bit for bit.
 */

export type Vec3 = [number, number, number];

export interface Agent {
  /** where it stands; the middle component is carried through untouched */
  pos: Vec3;
  /** facing, degrees: the nose points along (sin yaw, 0, cos yaw) */
  yaw: number;
  /** top speed, m/s */
  speed: number;
  /** how far off it notices the target, m */
  sight: number;
  /** how long the target must stay in sight before it reacts, s */
  reaction: number;
}

export type Behaviour =
  | { kind: 'stand' }
  | { kind: 'wander'; home: Vec3; radius: number; seed: number }
  | { kind: 'patrol'; points: Vec3[]; mode: 'loop' | 'back-and-forth'; wait: number }
  | { kind: 'chase' } // run at the target while it is within sight
  | { kind: 'flee' } // run straight away from the target while it is within sight
  | { kind: 'follow'; distance: number } // stay about `distance` off the target, sight or no sight
  | { kind: 'walk-to'; point: Vec3 };

/** Opaque per-agent state. Callers only thread it from one tick to the next. */
export interface Brain {
  readonly kind: string;
  [k: string]: unknown;
}

export interface Step {
  pos: Vec3;
  yaw: number;
  moving: boolean;
  brain: Brain;
}

/** A goal counts as reached inside this many metres, and the agent stops there. */
const ARRIVE = 0.3;
/** Follow: it sets off again only once the gap grows past distance + this. */
const SLACK = 0.5;
/** Wander: a breath between strolls, in seconds. */
const WANDER_PAUSE = 1;
/** Shorter than this and a move is not a move. */
const EPS = 1e-9;
const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;

/** The standard mulberry32: a tiny seeded generator, values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ brains */

type Sighted = { kind: string; seen: number; engaged: boolean };
type Follower = { kind: string; walking: boolean };
type Patroller = { kind: string; index: number; dir: number; wait: number };
type Wanderer = { kind: string; goal: Vec3 | null; pause: number; rnd: () => number };

export function newBrain(b: Behaviour): Brain {
  switch (b.kind) {
    case 'wander':
      return { kind: 'wander', goal: null, pause: 0, rnd: mulberry32(b.seed) };
    case 'patrol':
      return { kind: 'patrol', index: 0, dir: 1, wait: 0 };
    case 'chase':
      return { kind: 'chase', seen: 0, engaged: false };
    case 'flee':
      return { kind: 'flee', seen: 0, engaged: false };
    case 'follow':
      return { kind: 'follow', walking: false };
    case 'stand':
      return { kind: 'stand' };
    case 'walk-to':
      return { kind: 'walk-to' };
    default:
      return { kind: 'stand' };
  }
}

/** Take the brain back if it is the right shape, otherwise start one afresh. */
function reuse<T>(brain: Brain, kind: string, make: () => T, fields: readonly string[]): T {
  if (brain.kind !== kind) return make();
  for (const f of fields) {
    if (!(f in brain)) return make();
  }
  return brain as unknown as T;
}

/* ----------------------------------------------------------------- plumbing */

/** Distance on the ground plane; the middle component is ignored. */
function ground(p: Vec3, q: Vec3): number {
  const [px, , pz] = p;
  const [qx, , qz] = q;
  return Math.hypot(px - qx, pz - qz);
}

type Move = {
  pos: Vec3;
  /** facing the way it travelled, degrees */
  yaw: number;
  moving: boolean;
  /** the goal is now inside the arrival radius */
  arrived: boolean;
  /** metres covered, never more than speed * dt */
  covered: number;
};

/** Head for `goal` at no more than speed * dt, and never past it. */
function seek(pos: Vec3, goal: Vec3, speed: number, dt: number): Move {
  const [ax, ay, az] = pos;
  const [gx, , gz] = goal;
  const dx = gx - ax;
  const dz = gz - az;
  const gap = Math.hypot(dx, dz);
  const budget = speed * dt;
  if (gap <= ARRIVE || !(budget > 0)) {
    return { pos: [ax, ay, az], yaw: 0, moving: false, arrived: gap <= ARRIVE, covered: 0 };
  }
  const covered = budget < gap ? budget : gap;
  const ux = dx / gap;
  const uz = dz / gap;
  return {
    pos: [ax + ux * covered, ay, az + uz * covered],
    yaw: Math.atan2(ux, uz) * DEG,
    moving: covered > EPS,
    arrived: gap - covered <= ARRIVE,
    covered,
  };
}

/** Stand where it is, looking where it was looking. */
function hold(a: Agent, brain: Brain): Step {
  const [x, y, z] = a.pos;
  return { pos: [x, y, z], yaw: a.yaw, moving: false, brain };
}

/** Turn a move into a step: moving turns the agent, standing does not. */
function ofMove(m: Move, a: Agent, brain: Brain): Step {
  return { pos: m.pos, yaw: m.moving ? m.yaw : a.yaw, moving: m.moving, brain };
}

/**
 * The reaction delay. Returns the target once it has been inside sight for
 * `reaction` seconds in a row, and null otherwise; the clock restarts from zero
 * the moment the target slips out of sight (or there is no target at all).
 */
function engage(st: Sighted, a: Agent, target: Vec3 | null, dt: number): Vec3 | null {
  if (target === null) {
    st.seen = 0;
    st.engaged = false;
    return null;
  }
  if (ground(a.pos, target) <= a.sight) {
    st.seen += dt;
    if (st.seen >= a.reaction) st.engaged = true;
  } else {
    st.seen = 0;
    st.engaged = false;
  }
  return st.engaged ? target : null;
}

/* --------------------------------------------------------------- behaviours */

function chase(a: Agent, st: Sighted, target: Vec3 | null, dt: number): Step {
  const seen = engage(st, a, target, dt);
  if (seen === null) return hold(a, st); // out of sight: stand and look blank
  return ofMove(seek(a.pos, seen, a.speed, dt), a, st);
}

function flee(a: Agent, st: Sighted, target: Vec3 | null, dt: number): Step {
  const seen = engage(st, a, target, dt);
  if (seen === null) return hold(a, st);
  const [ax, ay, az] = a.pos;
  const [tx, , tz] = seen;
  let dx = ax - tx;
  let dz = az - tz;
  let gap = Math.hypot(dx, dz);
  if (!(gap > EPS)) {
    // Cornered, with the target on top of it: back off along its own nose.
    const r = a.yaw / DEG;
    dx = -Math.sin(r);
    dz = -Math.cos(r);
    gap = 1;
  }
  const budget = a.speed * dt;
  if (!(budget > 0)) return hold(a, st);
  const ux = dx / gap;
  const uz = dz / gap;
  return {
    pos: [ax + ux * budget, ay, az + uz * budget],
    yaw: Math.atan2(ux, uz) * DEG,
    moving: true,
    brain: st,
  };
}

function follow(
  a: Agent,
  b: { kind: 'follow'; distance: number },
  st: Follower,
  target: Vec3 | null,
  dt: number,
): Step {
  if (target === null) return hold(a, st);
  const [ax, ay, az] = a.pos;
  const [tx, , tz] = target;
  const dx = tx - ax;
  const dz = tz - az;
  const gap = Math.hypot(dx, dz);
  const want = b.distance;
  // Hysteresis: too far and it sets off, too near and it stops, and in between
  // it simply carries on doing whatever it was already doing.
  if (gap > want + SLACK) st.walking = true;
  else if (gap < want) st.walking = false;
  if (!st.walking || !(gap > EPS)) return hold(a, st);
  const budget = a.speed * dt;
  const covered = Math.min(budget > 0 ? budget : 0, gap - want);
  if (!(covered > EPS)) {
    st.walking = false;
    return hold(a, st);
  }
  const ux = dx / gap;
  const uz = dz / gap;
  return {
    pos: [ax + ux * covered, ay, az + uz * covered],
    yaw: Math.atan2(ux, uz) * DEG,
    moving: true,
    brain: st,
  };
}

/** Next point on the round, and which way the round is running. */
function advance(st: Patroller, n: number, mode: 'loop' | 'back-and-forth'): void {
  if (n < 2) {
    st.index = 0;
    st.dir = 1;
    return;
  }
  if (mode === 'loop') {
    st.index = (st.index + 1) % n;
    st.dir = 1;
    return;
  }
  let next = st.index + st.dir;
  if (next >= n) {
    st.dir = -1;
    next = st.index - 1;
  } else if (next < 0) {
    st.dir = 1;
    next = st.index + 1;
  }
  st.index = next >= 0 && next < n ? next : 0;
}

function patrol(
  a: Agent,
  b: { kind: 'patrol'; points: Vec3[]; mode: 'loop' | 'back-and-forth'; wait: number },
  st: Patroller,
  dt: number,
): Step {
  const n = b.points.length;
  if (n === 0) return hold(a, st);
  if (!(st.index >= 0 && st.index < n)) {
    st.index = 0;
    st.dir = 1;
  }
  if (st.wait > 0) {
    st.wait -= dt;
    return hold(a, st); // dawdling at the point it has just reached
  }
  const goal = b.points[st.index];
  if (goal === undefined) return hold(a, st);
  const m = seek(a.pos, goal, a.speed, dt);
  if (m.arrived) {
    st.wait = b.wait > 0 ? b.wait : 0;
    advance(st, n, b.mode);
  }
  return ofMove(m, a, st);
}

/** A seeded point somewhere inside the disc around home. */
function pick(home: Vec3, radius: number, rnd: () => number): Vec3 {
  const [hx, hy, hz] = home;
  const bearing = rnd() * TAU;
  const reach = radius * Math.sqrt(rnd());
  return [hx + Math.sin(bearing) * reach, hy, hz + Math.cos(bearing) * reach];
}

function wander(
  a: Agent,
  b: { kind: 'wander'; home: Vec3; radius: number; seed: number },
  st: Wanderer,
  dt: number,
): Step {
  if (st.pause > 0) {
    st.pause -= dt;
    if (st.pause > 0) return hold(a, st);
    st.goal = null;
  }
  let goal = st.goal;
  if (goal === null) {
    goal = pick(b.home, b.radius > 0 ? b.radius : 0, st.rnd);
    st.goal = goal;
  }
  const m = seek(a.pos, goal, a.speed, dt);
  if (m.arrived) {
    st.goal = null;
    st.pause = WANDER_PAUSE;
  }
  return ofMove(m, a, st);
}

/* -------------------------------------------------------------------- tick */

/**
 * One tick: where the agent is after dt seconds. `target` is the player, or
 * null when there is nobody about. Never moves farther than speed * dt.
 */
export function think(
  a: Agent,
  b: Behaviour,
  brain: Brain,
  target: Vec3 | null,
  dt: number,
): Step {
  const h = dt > 0 && Number.isFinite(dt) ? dt : 0;
  switch (b.kind) {
    case 'stand':
      return hold(a, reuse(brain, 'stand', () => ({ kind: 'stand' }), []));
    case 'walk-to':
      return ofMove(
        seek(a.pos, b.point, a.speed, h),
        a,
        reuse(brain, 'walk-to', () => ({ kind: 'walk-to' }), []),
      );
    case 'chase':
      return chase(
        a,
        reuse(brain, 'chase', () => ({ kind: 'chase', seen: 0, engaged: false }), [
          'seen',
          'engaged',
        ]),
        target,
        h,
      );
    case 'flee':
      return flee(
        a,
        reuse(brain, 'flee', () => ({ kind: 'flee', seen: 0, engaged: false }), [
          'seen',
          'engaged',
        ]),
        target,
        h,
      );
    case 'follow':
      return follow(
        a,
        b,
        reuse(brain, 'follow', () => ({ kind: 'follow', walking: false }), ['walking']),
        target,
        h,
      );
    case 'patrol':
      return patrol(
        a,
        b,
        reuse(brain, 'patrol', () => ({ kind: 'patrol', index: 0, dir: 1, wait: 0 }), [
          'index',
          'dir',
          'wait',
        ]),
        h,
      );
    case 'wander':
      return wander(
        a,
        b,
        reuse(
          brain,
          'wander',
          () => ({ kind: 'wander', goal: null, pause: 0, rnd: mulberry32(b.seed) }),
          ['goal', 'pause', 'rnd'],
        ),
        h,
      );
    default:
      return hold(a, brain);
  }
}