// Goblin hand-tool animations: data plus a tiny player. No imports, no DOM, no clock, no randomness.
//
// Conventions: rx > 0 swings a limb forward (head: chin down), rz > 0 raises an arm out sideways
// (head: tilts), ry twists (positive = toward the goblin's left, so a left-to-right sweep goes down).
// lean > 0 is forward, lift is metres off the ground.

export type Bone = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
export interface BonePose { rx: number; ry: number; rz: number }
export interface Pose { bones: Record<Bone, BonePose>; lift: number; lean: number }
export type Channel = `${Bone}.${'rx' | 'ry' | 'rz'}` | 'lift' | 'lean';
export interface Key { t: number; v: number; ease: 'linear' | 'smooth' | 'step' } // ease: from this key to the next
export interface Clip { duration: number; tracks: Partial<Record<Channel, Key[]>> } // seconds; unlisted channels stay at the hold pose
export type ToolId =
  | 'magnet' | 'can' | 'rollingPin' | 'baton' | 'boombox' | 'flashlight'
  | 'zapGun' | 'camera' | 'windupKey' | 'spade' | 'fairyWand';
export const TOOL_IDS: readonly ToolId[] = [
  'magnet', 'can', 'rollingPin', 'baton', 'boombox', 'flashlight',
  'zapGun', 'camera', 'windupKey', 'spade', 'fairyWand',
];
export interface ToolAnim { id: ToolId; name: string; hold: Pose; use: Clip; hitAt: number }

const MAX_ANGLE = 2.6;
const MAX_LIFT = 0.5;
const LOOP_TOLERANCE = 0.02;

const BONES: readonly Bone[] = ['body', 'head', 'armL', 'armR', 'legL', 'legR'];
type Axis = 'rx' | 'ry' | 'rz';
const AXES: readonly Axis[] = ['rx', 'ry', 'rz'];

interface Slot { ch: Channel; get(p: Pose): number; set(p: Pose, v: number): void }

const SLOTS: readonly Slot[] = [
  ...BONES.flatMap((bone) =>
    AXES.map((axis): Slot => ({
      ch: `${bone}.${axis}` as Channel,
      get: (p) => p.bones[bone][axis],
      set: (p, v) => { p.bones[bone][axis] = v; },
    })),
  ),
  { ch: 'lift', get: (p) => p.lift, set: (p, v) => { p.lift = v; } },
  { ch: 'lean', get: (p) => p.lean, set: (p, v) => { p.lean = v; } },
];

const bonePose = (): BonePose => ({ rx: 0, ry: 0, rz: 0 });

export function restPose(): Pose {
  return {
    bones: { body: bonePose(), head: bonePose(), armL: bonePose(), armR: bonePose(), legL: bonePose(), legR: bonePose() },
    lift: 0,
    lean: 0,
  };
}

function clonePose(p: Pose): Pose {
  const o = restPose();
  for (const s of SLOTS) s.set(o, s.get(p));
  return o;
}

/** Value of a track at t (clamped to the first and last key; 'smooth' = smoothstep between keys). */
export function sample(keys: readonly Key[], t: number): number {
  const first = keys[0];
  if (!first) return 0;
  if (!(t > first.t)) return first.v;
  const last = keys[keys.length - 1] ?? first;
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b || t < a.t || t >= b.t) continue;
    if (a.ease === 'step') return a.v;
    const span = b.t - a.t;
    if (span <= 0) return b.v;
    const u = (t - a.t) / span;
    const w = a.ease === 'smooth' ? u * u * (3 - 2 * u) : u;
    return a.v + (b.v - a.v) * w;
  }
  return last.v;
}

/** The pose at t seconds into the use clip, starting from the hold pose (listed channels replace the hold value). */
export function useAt(a: ToolAnim, t: number): Pose {
  const time = Math.min(Math.max(t, 0), a.use.duration);
  const p = clonePose(a.hold);
  for (const s of SLOTS) {
    const keys = a.use.tracks[s.ch];
    if (keys && keys.length > 0) s.set(p, sample(keys, time));
  }
  return p;
}

/** Blend two poses (w = 0 is a, 1 is b; w is clamped to 0..1). */
export function blend(a: Pose, b: Pose, w: number): Pose {
  const x = Math.min(Math.max(w, 0), 1);
  const o = restPose();
  for (const s of SLOTS) {
    const av = s.get(a);
    s.set(o, av + (s.get(b) - av) * x);
  }
  return o;
}

/** Problems in the data (empty array = clean). */
export function check(a: ToolAnim): string[] {
  const out: string[] = [];
  const { duration, tracks } = a.use;
  if (!Number.isFinite(duration) || duration <= 0) out.push(`duration ${duration} must be a positive number`);
  if (!(a.hitAt >= 0 && a.hitAt <= duration)) out.push(`hitAt ${a.hitAt} is outside the clip 0..${duration}`);
  for (const s of SLOTS) {
    const isLift = s.ch === 'lift';
    const outOfRange = (v: number): boolean => (isLift ? !(v >= 0 && v <= MAX_LIFT) : !(Math.abs(v) <= MAX_ANGLE));
    const rangeText = isLift ? `beyond 0..${MAX_LIFT}` : `beyond ±${MAX_ANGLE} rad`;
    const hv = s.get(a.hold);
    if (outOfRange(hv)) out.push(`hold ${s.ch}: value ${hv} is ${rangeText}`);
    const keys = tracks[s.ch];
    if (!keys) continue;
    if (keys.length === 0) {
      out.push(`${s.ch}: track has no keys`);
      continue;
    }
    let prev = -Infinity;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!key) continue;
      if (!Number.isFinite(key.t) || !Number.isFinite(key.v)) {
        out.push(`${s.ch}: key ${i} is not a finite number`);
        continue;
      }
      if (key.t < prev) out.push(`${s.ch}: keys out of time order at key ${i}`);
      prev = key.t;
      if (key.t < 0 || key.t > duration) out.push(`${s.ch}: key ${i} at t=${key.t} is outside 0..duration (${duration})`);
      if (outOfRange(key.v)) out.push(`${s.ch}: key ${i} value ${key.v} is ${rangeText}`);
    }
    const f = keys[0];
    const l = keys[keys.length - 1];
    if (f && Math.abs(f.v - hv) > LOOP_TOLERANCE) out.push(`${s.ch}: first value ${f.v} differs from the hold pose (${hv}) by more than ${LOOP_TOLERANCE}`);
    if (l && Math.abs(l.v - hv) > LOOP_TOLERANCE) out.push(`${s.ch}: last value ${l.v} differs from the hold pose (${hv}) by more than ${LOOP_TOLERANCE}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

type Ease = Key['ease'];
type KeySpec = [number, number, Ease?]; // [seconds, value, ease to next key (default smooth)]
const L: Ease = 'linear';

function k(...specs: KeySpec[]): Key[] {
  return specs.map((s) => ({ t: s[0], v: s[1], ease: s[2] ?? 'smooth' }));
}

function hold(spec: Partial<Record<Channel, number>>): Pose {
  const p = restPose();
  for (const s of SLOTS) {
    const v = spec[s.ch];
    if (v !== undefined) s.set(p, v);
  }
  return p;
}

export const TOOL_ANIMS: Readonly<Record<ToolId, ToolAnim>> = {
  // Points the magnet out, creeps forward, then JERKS it back to the chest like it caught an anvil.
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    hold: hold({ 'armR.rx': 0.9, 'armR.rz': 0.1 }),
    hitAt: 0.74,
    use: {
      duration: 1.6,
      tracks: {
        'armR.rx': k([0, 0.9], [0.3, 1.5], [0.62, 1.6], [0.74, 0.2], [0.86, 0.05], [1.2, 0.5], [1.6, 0.9]),
        'armR.rz': k([0, 0.1], [0.62, 0.1], [0.74, 0.35], [1.0, 0.2], [1.6, 0.1]),
        'armL.rx': k([0, 0], [0.6, 0], [0.74, 0.5], [1.1, 0.2], [1.6, 0]),
        'body.ry': k([0, 0], [0.3, -0.15], [0.62, -0.2], [0.74, 0.2], [1.0, 0.08], [1.6, 0]),
        lean: k([0, 0], [0.3, 0.18], [0.62, 0.22], [0.78, -0.28], [1.0, -0.1], [1.3, 0.04], [1.6, 0]),
        'head.rx': k([0, 0], [0.62, 0.1], [0.78, -0.2], [1.1, 0.05], [1.6, 0]),
        'legL.rx': k([0, 0], [0.3, 0.2], [0.62, 0.25], [1.0, 0.2], [1.6, 0]),
        'legR.rx': k([0, 0], [0.62, -0.2], [0.78, -0.35], [1.1, -0.1], [1.6, 0]),
        lift: k([0, 0], [0.74, 0], [0.84, 0.04], [1.0, 0], [1.6, 0]),
      },
    },
  },

  // Three fast shakes (rattle rattle rattle), a wind-back, then out and spraying with a wiggle.
  can: {
    id: 'can',
    name: 'Spray Can',
    hold: hold({ 'armR.rx': 0.7, 'armR.rz': 0.1 }),
    hitAt: 0.95,
    use: {
      duration: 2.0,
      tracks: {
        'armR.rx': k(
          [0, 0.7], [0.12, 1.15], [0.24, 0.3], [0.36, 1.15], [0.48, 0.3], [0.6, 1.15], [0.72, 0.3],
          [0.92, 1.55], [1.02, 1.42], [1.7, 1.42], [1.88, 0.5], [2.0, 0.7],
        ),
        'armR.ry': k([0, 0], [1.0, 0], [1.12, 0.22], [1.28, -0.2], [1.44, 0.22], [1.6, -0.2], [1.76, 0], [2.0, 0]),
        'body.ry': k([0, 0], [1.0, 0], [1.12, -0.08], [1.28, 0.07], [1.44, -0.08], [1.6, 0.07], [1.76, 0], [2.0, 0]),
        'body.rz': k([0, 0], [0.12, 0.07], [0.24, -0.07], [0.36, 0.07], [0.48, -0.07], [0.6, 0.07], [0.72, 0], [2.0, 0]),
        'head.rx': k([0, 0], [0.72, -0.1], [0.92, 0.15], [1.1, 0], [2.0, 0]),
        lift: k([0, 0], [0.12, 0.03], [0.24, 0], [0.36, 0.03], [0.48, 0], [0.6, 0.03], [0.72, 0], [0.92, 0.05], [1.1, 0], [2.0, 0]),
      },
    },
  },

  // Both arms push the pin out and haul it back, twice, with the whole body leaning into it.
  rollingPin: {
    id: 'rollingPin',
    name: 'Rolling Pin',
    hold: hold({ 'armR.rx': 1.0, 'armL.rx': 1.0, lean: 0.1 }),
    hitAt: 0.7,
    use: {
      duration: 2.4,
      tracks: {
        'armR.rx': k([0, 1.0], [0.3, 0.55], [0.7, 1.55], [1.1, 0.6], [1.5, 1.55], [1.9, 0.6], [2.15, 1.1], [2.4, 1.0]),
        'armL.rx': k([0, 1.0], [0.3, 0.6], [0.7, 1.5], [1.1, 0.65], [1.5, 1.5], [1.9, 0.65], [2.15, 1.08], [2.4, 1.0]),
        lean: k([0, 0.1], [0.3, 0], [0.7, 0.38], [1.1, 0.05], [1.5, 0.4], [1.9, 0.05], [2.15, 0.16], [2.4, 0.1]),
        'head.rx': k([0, 0], [0.7, 0.2], [1.1, 0], [1.5, 0.2], [1.9, 0], [2.4, 0]),
        'body.rz': k([0, 0], [0.7, 0.06], [1.1, -0.04], [1.5, 0.06], [1.9, -0.04], [2.4, 0]),
        'legL.rx': k([0, 0], [0.3, -0.1], [0.7, 0.2], [1.1, -0.05], [1.5, 0.2], [1.9, -0.05], [2.4, 0]),
        'legR.rx': k([0, 0], [0.3, 0.1], [0.7, -0.15], [1.1, 0.05], [1.5, -0.15], [1.9, 0.05], [2.4, 0]),
        lift: k([0, 0], [0.7, 0.02], [1.1, 0], [1.5, 0.02], [1.9, 0], [2.4, 0]),
      },
    },
  },

  // Two crisp downbeats, the head nodding along, a little bounce on each beat.
  baton: {
    id: 'baton',
    name: "Conductor's Baton",
    hold: hold({ 'armR.rx': 0.8, 'armR.rz': 0.35, 'armL.rz': 0.15 }),
    hitAt: 0.3,
    use: {
      duration: 1.4,
      tracks: {
        'armR.rx': k([0, 0.8], [0.15, 1.35], [0.3, 0.45], [0.45, 1.4], [0.6, 0.4], [0.8, 1.15], [1.1, 0.75], [1.4, 0.8]),
        'armR.rz': k([0, 0.35], [0.15, 0.3], [0.3, 0.5], [0.6, 0.5], [1.1, 0.35], [1.4, 0.35]),
        'armL.rz': k([0, 0.15], [0.3, 0.4], [0.6, 0.4], [1.0, 0.15], [1.4, 0.15]),
        'head.rx': k([0, 0], [0.15, -0.1], [0.3, 0.25], [0.45, -0.1], [0.6, 0.25], [0.8, 0], [1.4, 0]),
        'body.ry': k([0, 0], [0.3, 0.1], [0.6, -0.1], [0.9, 0], [1.4, 0]),
        lift: k([0, 0], [0.15, 0.04], [0.3, 0], [0.45, 0.04], [0.6, 0], [1.4, 0]),
      },
    },
  },

  // Hoist to the shoulder, left hand winds back, SLAP, then a small hop.
  boombox: {
    id: 'boombox',
    name: 'Boombox',
    hold: hold({ 'armR.rx': 0.5, 'armR.rz': 0.3 }),
    hitAt: 0.8,
    use: {
      duration: 1.8,
      tracks: {
        'armR.rx': k([0, 0.5], [0.15, 0.35], [0.5, 1.0], [0.8, 1.0], [0.88, 1.2], [1.1, 1.0], [1.4, 0.8], [1.8, 0.5]),
        'armR.rz': k([0, 0.3], [0.15, 0.2], [0.5, 0.9], [0.8, 0.9], [0.9, 1.05], [1.1, 0.9], [1.4, 0.6], [1.8, 0.3]),
        'armL.rx': k([0, 0], [0.4, 0.3], [0.65, -0.5], [0.8, 1.6], [1.0, 1.25], [1.4, 0.4], [1.8, 0]),
        'armL.rz': k([0, 0], [0.4, 0.4], [0.65, 0.7], [0.8, 0.3], [1.3, 0.1], [1.8, 0]),
        'body.ry': k([0, 0], [0.5, -0.15], [0.65, -0.25], [0.8, 0.2], [1.1, 0.05], [1.8, 0]),
        'head.rz': k([0, 0], [0.8, 0], [0.9, 0.2], [1.2, 0], [1.8, 0]),
        'legL.rx': k([0, 0], [0.75, 0.2], [0.98, -0.25], [1.18, 0.2], [1.5, 0], [1.8, 0]),
        'legR.rx': k([0, 0], [0.75, -0.2], [0.98, 0.25], [1.18, -0.2], [1.5, 0], [1.8, 0]),
        lift: k([0, 0], [0.78, 0], [0.98, 0.18], [1.18, 0], [1.8, 0]),
      },
    },
  },

  // Dip, raise to eye level, overshoot, then a slow left-to-right sweep with the head leading.
  flashlight: {
    id: 'flashlight',
    name: 'Flashlight',
    hold: hold({ 'armR.rx': 0.5, 'armR.rz': 0.1 }),
    hitAt: 0.55,
    use: {
      duration: 2.2,
      tracks: {
        'armR.rx': k([0, 0.5], [0.15, 0.3], [0.5, 1.62], [0.6, 1.5], [1.7, 1.5], [1.95, 0.9], [2.2, 0.5]),
        'armR.ry': k([0, 0], [0.55, 0.2], [0.7, 0.3], [1.6, -0.3], [1.72, -0.38], [1.95, -0.2], [2.2, 0]),
        'body.ry': k([0, 0], [0.55, 0.55], [0.7, 0.6], [1.6, -0.6], [1.72, -0.7], [1.9, -0.62], [2.2, 0]),
        'head.ry': k([0, 0], [0.55, 0.4], [0.7, 0.45], [1.6, -0.45], [1.75, -0.5], [2.2, 0]),
        'head.rx': k([0, 0], [0.5, -0.1], [1.7, -0.1], [2.2, 0]),
        lean: k([0, 0], [0.15, -0.05], [0.5, 0.06], [1.7, 0.06], [2.2, 0]),
      },
    },
  },

  // Two-handed aim, a fidgety creep, then BZAP: muzzle flips up, body rocks back and wobbles.
  zapGun: {
    id: 'zapGun',
    name: 'Zap Gun',
    hold: hold({ 'armR.rx': 0.9, 'armL.rx': 0.5 }),
    hitAt: 0.72,
    use: {
      duration: 1.7,
      tracks: {
        'armR.rx': k([0, 0.9], [0.2, 0.75], [0.5, 1.5], [0.65, 1.55], [0.72, 2.0], [0.85, 1.45], [1.0, 1.55], [1.4, 1.0], [1.7, 0.9]),
        'armL.rx': k([0, 0.5], [0.2, 0.4], [0.5, 1.45], [0.65, 1.5], [0.72, 1.9], [0.85, 1.4], [1.0, 1.5], [1.4, 0.8], [1.7, 0.5]),
        lean: k([0, 0], [0.2, 0.05], [0.5, 0.18], [0.65, 0.22], [0.74, -0.3], [0.9, 0.12], [1.05, -0.08], [1.2, 0.04], [1.7, 0]),
        'body.rx': k([0, 0], [0.65, 0], [0.74, -0.15], [0.95, 0.08], [1.3, 0], [1.7, 0]),
        'head.rx': k([0, 0], [0.74, -0.25], [1.0, 0.05], [1.7, 0]),
        'legL.rx': k([0, 0], [0.5, 0.25], [1.3, 0.2], [1.7, 0]),
        'legR.rx': k([0, 0], [0.5, -0.25], [0.74, -0.4], [1.0, -0.2], [1.4, -0.1], [1.7, 0]),
        lift: k([0, 0], [0.72, 0], [0.82, 0.06], [1.0, 0], [1.7, 0]),
      },
    },
  },

  // Two hands bring it to the face, a quick head tilt on the click, then lower it with a droop.
  camera: {
    id: 'camera',
    name: 'Camera',
    hold: hold({ 'armR.rx': 0.6, 'armL.rx': 0.4 }),
    hitAt: 0.85,
    use: {
      duration: 1.9,
      tracks: {
        'armR.rx': k([0, 0.6], [0.15, 0.4], [0.5, 1.85], [0.6, 1.7], [0.8, 1.7], [0.85, 1.58], [0.95, 1.7], [1.4, 1.7], [1.65, 0.35], [1.9, 0.6]),
        'armL.rx': k([0, 0.4], [0.15, 0.3], [0.5, 1.8], [0.6, 1.65], [1.4, 1.65], [1.65, 0.25], [1.9, 0.4]),
        'armR.rz': k([0, 0], [0.5, 0.25], [1.4, 0.25], [1.9, 0]),
        'armL.rz': k([0, 0], [0.5, 0.25], [1.4, 0.25], [1.9, 0]),
        'head.rz': k([0, 0], [0.7, 0], [0.85, 0.35], [1.05, -0.08], [1.25, 0], [1.9, 0]),
        'head.rx': k([0, 0], [0.15, 0.1], [0.5, -0.05], [1.4, -0.05], [1.9, 0]),
        lean: k([0, 0], [0.15, -0.05], [0.5, 0.1], [1.4, 0.1], [1.65, -0.04], [1.9, 0]),
      },
    },
  },

  // Held out, three ratchet twists (each a quick ry step, then a pause), then let go: it springs back.
  windupKey: {
    id: 'windupKey',
    name: 'Windup Key',
    hold: hold({ 'armR.rx': 1.0, 'armR.rz': 0.2, 'armL.rx': 0.5 }),
    hitAt: 0.62,
    use: {
      duration: 2.2,
      tracks: {
        'armR.rx': k([0, 1.0], [0.2, 0.8], [0.45, 1.2], [1.6, 1.2], [1.7, 1.5], [1.95, 0.9], [2.2, 1.0]),
        'armR.ry': k([0, 0], [0.5, 0], [0.62, 0.6], [0.9, 0.6], [1.02, 1.2], [1.3, 1.2], [1.42, 1.8], [1.62, 1.8], [1.72, -0.35], [1.95, 0.08], [2.2, 0]),
        'head.rz': k([0, 0], [0.5, 0], [0.62, 0.1], [0.9, 0.1], [1.02, 0.2], [1.3, 0.2], [1.42, 0.3], [1.62, 0.3], [1.72, -0.15], [1.95, 0], [2.2, 0]),
        'body.rz': k([0, 0], [0.62, 0.05], [1.02, 0.1], [1.42, 0.15], [1.62, 0.15], [1.75, -0.1], [2.0, 0], [2.2, 0]),
        lean: k([0, 0], [0.45, 0.1], [1.6, 0.1], [1.8, -0.1], [2.2, 0]),
        lift: k([0, 0], [1.62, 0], [1.8, 0.12], [2.0, 0], [2.2, 0]),
      },
    },
  },

  // Raise it high (leaning back), stab down with a foot stamp on the blade, then lever the handle back.
  spade: {
    id: 'spade',
    name: 'Spade',
    hold: hold({ 'armR.rx': 0.7, 'armR.rz': 0.1, 'armL.rx': 0.6 }),
    hitAt: 1.0,
    use: {
      duration: 2.4,
      tracks: {
        'armR.rx': k([0, 0.7], [0.2, 0.9], [0.55, 2.0], [0.7, 2.1], [1.0, 0.25], [1.1, 0.1], [1.25, 0.15], [1.6, 0.9], [1.95, 0.55], [2.4, 0.7]),
        'armL.rx': k([0, 0.6], [0.55, 1.8], [0.7, 1.9], [1.0, 0.3], [1.25, 0.2], [1.6, 0.8], [2.4, 0.6]),
        'legR.rx': k([0, 0], [0.45, 0], [0.7, 0.9], [1.0, 0.55], [1.25, 0.6], [1.5, 0.1], [1.8, -0.08], [2.4, 0]),
        'legL.rx': k([0, 0], [0.6, -0.15], [1.25, -0.2], [1.8, 0], [2.4, 0]),
        lean: k([0, 0], [0.2, -0.08], [0.55, -0.22], [0.7, -0.25], [1.0, 0.42], [1.1, 0.5], [1.25, 0.45], [1.6, -0.2], [1.9, 0.05], [2.4, 0]),
        'head.rx': k([0, 0], [0.55, -0.25], [1.0, 0.3], [1.25, 0.3], [1.6, -0.1], [2.4, 0]),
      },
    },
  },

  // A little circle in the air (linear keys so it stays round), a wind-back, then a flick with a hop.
  fairyWand: {
    id: 'fairyWand',
    name: 'Fairy Wand',
    hold: hold({ 'armR.rx': 0.7, 'armR.rz': 0.4 }),
    hitAt: 1.3,
    use: {
      duration: 1.9,
      tracks: {
        'armR.rx': k(
          [0, 0.7], [0.12, 0.5], [0.3, 1.0, L], [0.4, 1.2, L], [0.5, 1.28, L], [0.6, 1.2, L], [0.7, 1.0, L],
          [0.8, 0.8, L], [0.9, 0.72, L], [1.0, 0.8, L], [1.1, 1.0], [1.2, 0.7], [1.3, 1.7], [1.4, 1.85], [1.55, 1.65], [1.9, 0.7],
        ),
        'armR.rz': k(
          [0, 0.4], [0.12, 0.3], [0.3, 0.83, L], [0.4, 0.75, L], [0.5, 0.55, L], [0.6, 0.35, L], [0.7, 0.27, L],
          [0.8, 0.35, L], [0.9, 0.55, L], [1.0, 0.75, L], [1.1, 0.83], [1.2, 0.7], [1.3, 0.2], [1.4, 0.15], [1.55, 0.25], [1.9, 0.4],
        ),
        'head.rz': k([0, 0], [0.5, 0.15], [0.9, -0.15], [1.2, 0], [1.9, 0]),
        lean: k([0, 0], [1.2, -0.05], [1.35, 0.15], [1.6, -0.03], [1.9, 0]),
        'legL.rx': k([0, 0], [1.2, -0.15], [1.35, 0.3], [1.55, -0.05], [1.9, 0]),
        'legR.rx': k([0, 0], [1.2, -0.1], [1.35, 0.2], [1.55, 0], [1.9, 0]),
        lift: k([0, 0], [1.2, 0], [1.35, 0.14], [1.55, 0], [1.9, 0]),
      },
    },
  },
};