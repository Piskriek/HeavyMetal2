/**
 * Goblin tool animations — data plus a tiny player.
 *
 * The goblin is a blocky toy-world character with six bones:
 *   body, head, armL, armR, legL, legR
 * Each bone is rotated by rx / ry / rz in radians:
 *   rx = swing forward/back (negative = forward), ry = twist, rz = raise sideways
 *   (positive rz = away from the middle of the body, on both sides)
 * On top of that the whole goblin gets `lift` (metres up) and `lean` (radians forward).
 *
 * Every tool lives in the right hand. A tool has a `hold` pose (how it idles in
 * the fist) and a `use` clip (the funny bit: anticipation, action, overshoot,
 * settle). Clips always start and end exactly on the hold pose so they loop
 * cleanly back to standing there looking pleased with themselves.
 */

export type Bone = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';

export interface BonePose {
  rx: number;
  ry: number;
  rz: number;
}

export interface Pose {
  bones: Record<Bone, BonePose>;
  lift: number;
  lean: number;
}

export type Channel = `${Bone}.${'rx' | 'ry' | 'rz'}` | 'lift' | 'lean';

export type Ease = 'linear' | 'smooth' | 'step';

/** ease: how this key travels to the next key. */
export interface Key {
  t: number;
  v: number;
  ease: Ease;
}

/** seconds; channels not listed stay at the hold pose */
export interface Clip {
  duration: number;
  tracks: Partial<Record<Channel, Key[]>>;
}

export type ToolId =
  | 'magnet'
  | 'can'
  | 'rollingPin'
  | 'baton'
  | 'boombox'
  | 'flashlight'
  | 'zapGun'
  | 'camera'
  | 'windupKey'
  | 'spade'
  | 'fairyWand';

export interface ToolAnim {
  id: ToolId;
  name: string;
  hold: Pose;
  use: Clip;
  /** the second the effect should fire (the jerk, the click, the stab) */
  hitAt: number;
}

export const TOOL_IDS: readonly ToolId[] = [
  'magnet',
  'can',
  'rollingPin',
  'baton',
  'boombox',
  'flashlight',
  'zapGun',
  'camera',
  'windupKey',
  'spade',
  'fairyWand',
];

/* ------------------------------------------------------------------ */
/* tiny player                                                         */
/* ------------------------------------------------------------------ */

const BONES: readonly Bone[] = ['body', 'head', 'armL', 'armR', 'legL', 'legR'];
const PROPS: readonly ('rx' | 'ry' | 'rz')[] = ['rx', 'ry', 'rz'];
type Prop = 'rx' | 'ry' | 'rz';

const CHANNELS: readonly Channel[] = [
  ...BONES.flatMap((b) => PROPS.map((p) => `${b}.${p}` as Channel)),
  'lift',
  'lean',
];

const MAX_ANGLE = 2.6;
const MAX_LIFT = 0.5;
const LOOP_TOLERANCE = 0.02;

function zeroPose(): Pose {
  return {
    bones: {
      body: { rx: 0, ry: 0, rz: 0 },
      head: { rx: 0, ry: 0, rz: 0 },
      armL: { rx: 0, ry: 0, rz: 0 },
      armR: { rx: 0, ry: 0, rz: 0 },
      legL: { rx: 0, ry: 0, rz: 0 },
      legR: { rx: 0, ry: 0, rz: 0 },
    },
    lift: 0,
    lean: 0,
  };
}

/** Arms down, spine straight, goblin utterly at peace. */
export function restPose(): Pose {
  return zeroPose();
}

function copyPose(p: Pose): Pose {
  return {
    bones: {
      body: { ...p.bones.body },
      head: { ...p.bones.head },
      armL: { ...p.bones.armL },
      armR: { ...p.bones.armR },
      legL: { ...p.bones.legL },
      legR: { ...p.bones.legR },
    },
    lift: p.lift,
    lean: p.lean,
  };
}

function channelValue(p: Pose, ch: Channel): number {
  if (ch === 'lift') return p.lift;
  if (ch === 'lean') return p.lean;
  const dot = ch.indexOf('.');
  const bone = ch.slice(0, dot) as Bone;
  const prop = ch.slice(dot + 1) as Prop;
  return p.bones[bone][prop];
}

function setChannel(p: Pose, ch: Channel, v: number): void {
  if (ch === 'lift') {
    p.lift = v;
    return;
  }
  if (ch === 'lean') {
    p.lean = v;
    return;
  }
  const dot = ch.indexOf('.');
  const bone = ch.slice(0, dot) as Bone;
  const prop = ch.slice(dot + 1) as Prop;
  p.bones[bone][prop] = v;
}

/** Value of a track at t (clamped to the first and last key; 'smooth' = smoothstep between keys). */
export function sample(keys: readonly Key[], t: number): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first.t) return first.v;
  const last = keys[keys.length - 1];
  if (!last) return first.v;
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b) continue;
    if (t < a.t || t > b.t) continue;
    if (a.ease === 'step' || b.t <= a.t) return a.v;
    const u = (t - a.t) / (b.t - a.t);
    const s = a.ease === 'smooth' ? u * u * (3 - 2 * u) : u;
    return a.v + (b.v - a.v) * s;
  }
  return last.v;
}

/** The pose at t seconds into the use clip, starting from the hold pose (listed channels replace the hold value). */
export function useAt(a: ToolAnim, t: number): Pose {
  const d = a.use.duration;
  const time = t < 0 ? 0 : t > d ? d : t;
  const pose = copyPose(a.hold);
  for (const ch of CHANNELS) {
    const track = a.use.tracks[ch];
    if (!track) continue;
    setChannel(pose, ch, sample(track, time));
  }
  return pose;
}

/** Blend two poses (w = 0 is a, 1 is b). */
export function blend(a: Pose, b: Pose, w: number): Pose {
  const k = w < 0 ? 0 : w > 1 ? 1 : w;
  const out = copyPose(a);
  for (const bone of BONES) {
    const ba = a.bones[bone];
    const bb = b.bones[bone];
    const to = out.bones[bone];
    to.rx = ba.rx + (bb.rx - ba.rx) * k;
    to.ry = ba.ry + (bb.ry - ba.ry) * k;
    to.rz = ba.rz + (bb.rz - ba.rz) * k;
  }
  out.lift = a.lift + (b.lift - a.lift) * k;
  out.lean = a.lean + (b.lean - a.lean) * k;
  return out;
}

/* ------------------------------------------------------------------ */
/* the data                                                            */
/* ------------------------------------------------------------------ */

type KeySpec = readonly [t: number, v: number, ease?: Ease];
type TrackSpec = Partial<Record<Channel, readonly KeySpec[]>>;
type PoseSpec = Partial<Record<Bone, Partial<BonePose>>> & { lift?: number; lean?: number };

function pose(spec: PoseSpec = {}): Pose {
  const out = zeroPose();
  for (const bone of BONES) {
    const s = spec[bone];
    if (!s) continue;
    const to = out.bones[bone];
    if (s.rx !== undefined) to.rx = s.rx;
    if (s.ry !== undefined) to.ry = s.ry;
    if (s.rz !== undefined) to.rz = s.rz;
  }
  if (spec.lift !== undefined) out.lift = spec.lift;
  if (spec.lean !== undefined) out.lean = spec.lean;
  return out;
}

/**
 * Builds a track: only the interesting middle keys are written, the hold value
 * is pinned on at t=0 and t=duration so every clip loops back to holding.
 */
function buildTrack(spec: readonly KeySpec[], holdV: number, duration: number): Key[] {
  const out: Key[] = [];
  const first = spec[0];
  if (!first || first[0] > 0) out.push({ t: 0, v: holdV, ease: 'smooth' });
  for (const s of spec) out.push({ t: s[0], v: s[1], ease: s[2] ?? 'smooth' });
  const last = out[out.length - 1];
  if (!last || last.t < duration) out.push({ t: duration, v: holdV, ease: 'smooth' });
  return out;
}

function anim(
  id: ToolId,
  name: string,
  hold: Pose,
  duration: number,
  hitAt: number,
  spec: TrackSpec,
): ToolAnim {
  const tracks: Partial<Record<Channel, Key[]>> = {};
  for (const ch of CHANNELS) {
    const s = spec[ch];
    if (s) tracks[ch] = buildTrack(s, channelValue(hold, ch), duration);
  }
  return { id, name, hold, use: { duration, tracks }, hitAt };
}

const holdMagnet = pose({
  body: { ry: -0.1 },
  head: { rx: 0.05 },
  armL: { rx: 0.2, rz: 0.12 },
  armR: { rx: -0.85, ry: -0.1, rz: 0.3 },
  lean: 0.08,
});

const holdCan = pose({
  body: { ry: -0.06 },
  armL: { rx: 0.25, rz: 0.15 },
  armR: { rx: -0.5, ry: 0.1, rz: 0.2 },
  lift: 0.01,
  lean: 0.05,
});

const holdRollingPin = pose({
  body: { ry: -0.05 },
  head: { rx: 0.05 },
  armL: { rx: -1.05, rz: 0.18 },
  armR: { rx: -1.15, ry: 0, rz: 0.18 },
  lift: 0.02,
  lean: 0.2,
});

const holdBaton = pose({
  body: { ry: 0.05 },
  head: { rx: 0.02 },
  armL: { rx: -0.5, rz: 0.45 },
  armR: { rx: -0.7, ry: 0, rz: 0.3 },
  lean: 0.03,
});

const holdBoombox = pose({
  head: { rx: -0.05 },
  armL: { rx: 0.15, rz: 0.15 },
  armR: { rx: -0.35, ry: 0, rz: 0.35 },
  lean: 0.05,
});

const holdFlashlight = pose({
  body: { ry: -0.05 },
  head: { rx: -0.02 },
  armL: { rx: 0.2, rz: 0.12 },
  armR: { rx: -0.45, ry: 0, rz: 0.22 },
  lean: 0.04,
});

const holdZapGun = pose({
  body: { ry: -0.08 },
  armL: { rx: -0.35, rz: 0.1 },
  armR: { rx: -0.55, ry: -0.2, rz: 0.25 },
  lean: 0.06,
});

const holdCamera = pose({
  head: { rx: 0.03 },
  armL: { rx: 0.1, rz: 0.2 },
  armR: { rx: -0.3, ry: 0, rz: 0.25 },
  lean: 0.03,
});

const holdWindupKey = pose({
  body: { ry: -0.06 },
  armL: { rx: 0.2, rz: 0.14 },
  armR: { rx: -1.0, ry: 0, rz: 0.3 },
  lean: 0.07,
});

const holdSpade = pose({
  body: { ry: -0.05 },
  head: { rx: 0.1 },
  armL: { rx: -0.4, rz: 0.2 },
  armR: { rx: -0.6, ry: 0.1, rz: 0.3 },
  lean: 0.12,
});

const holdFairyWand = pose({
  body: { ry: -0.04 },
  head: { rx: -0.05 },
  armL: { rx: 0.15, rz: 0.1 },
  armR: { rx: -1.2, ry: 0.2, rz: 0.4 },
  lean: 0.05,
});

export const TOOL_ANIMS: Readonly<Record<ToolId, ToolAnim>> = {
  magnet: anim(
    'magnet',
    'Goblin Magnet',
    holdMagnet,
    1.7,
    0.6,
    {
      // point it out, then JERK it back into the chest — something heavy is coming
      'armR.rx': [
        [0.24, -1.2],
        [0.6, -0.15],
        [0.72, -0.2],
        [0.95, -0.55],
        [1.15, -0.3],
        [1.4, -0.85],
      ],
      'armR.rz': [
        [0.24, 0.45],
        [0.6, 0.12],
        [0.95, 0.28],
        [1.4, 0.3],
      ],
      'armR.ry': [
        [0.6, 0.25],
        [0.95, 0.05],
        [1.4, -0.1],
      ],
      'body.ry': [
        [0.6, 0.15],
        [0.95, -0.02],
        [1.4, -0.1],
      ],
      'head.rx': [
        [0.24, -0.08],
        [0.6, 0.12],
        [1.4, 0.05],
      ],
      lean: [
        [0.24, 0.02],
        [0.6, -0.22],
        [0.95, -0.08],
        [1.4, 0.08],
      ],
      lift: [
        [0.6, 0.03],
        [0.8, 0],
        [1.05, 0.03],
        [1.4, 0],
      ],
    },
  ),

  can: anim(
    'can',
    'Shaky Spray Can',
    holdCan,
    1.9,
    1.05,
    {
      // rattle-rattle-rattle the ball inside, then hold it out and wave the spray
      'armR.rx': [
        [0.14, -0.85, 'linear'],
        [0.28, -0.3, 'linear'],
        [0.42, -0.9, 'linear'],
        [0.56, -0.28, 'linear'],
        [0.7, -0.95, 'linear'],
        [0.84, -0.3, 'linear'],
        [1.05, -0.95],
        [1.7, -0.55],
      ],
      'armR.rz': [
        [0.7, 0.3],
        [1.05, 0.25],
        [1.7, 0.2],
      ],
      'armR.ry': [
        [1.05, 0.1],
        [1.2, 0.4, 'linear'],
        [1.35, -0.2, 'linear'],
        [1.5, 0.35, 'linear'],
        [1.7, 0.1],
      ],
      'body.ry': [
        [1.05, 0.12],
        [1.35, -0.12],
        [1.7, -0.06],
      ],
      'head.rx': [
        [0.42, -0.12],
        [1.05, -0.18],
        [1.7, 0.02],
      ],
      lean: [
        [1.05, 0.14],
        [1.7, 0.05],
      ],
      lift: [
        [1.05, 0.02],
        [1.7, 0.01],
      ],
    },
  ),

  rollingPin: anim(
    'rollingPin',
    'Dough Roller',
    holdRollingPin,
    2.1,
    0.8,
    {
      // both arms out, roll away and back twice, whole body squashing into it
      'armR.rx': [
        [0.3, -1.45],
        [0.55, -0.95],
        [0.8, -1.45],
        [1.05, -0.95],
        [1.3, -1.4],
        [1.7, -1.15],
      ],
      'armR.rz': [
        [0.3, 0.25],
        [0.8, 0.12],
        [1.3, 0.24],
        [1.7, 0.18],
      ],
      'armL.rx': [
        [0.3, -1.25],
        [0.55, -0.8],
        [0.8, -1.25],
        [1.05, -0.8],
        [1.3, -1.2],
        [1.7, -1.05],
      ],
      'body.ry': [
        [0.3, 0.05],
        [0.8, -0.12],
        [1.3, 0.05],
        [1.7, -0.05],
      ],
      'head.rx': [
        [0.3, 0.2],
        [0.55, 0.08],
        [0.8, 0.2],
        [1.7, 0.05],
      ],
      lean: [
        [0.3, 0.38],
        [0.55, 0.18],
        [0.8, 0.38],
        [1.05, 0.16],
        [1.3, 0.34],
        [1.7, 0.2],
      ],
      lift: [
        [0.3, 0.05],
        [0.55, 0],
        [0.8, 0.05],
        [1.05, 0],
        [1.3, 0.04],
        [1.7, 0.02],
      ],
    },
  ),

  baton: anim(
    'baton',
    'Tiny Conductor Baton',
    holdBaton,
    1.6,
    0.5,
    {
      // two crisp beats, head bobbing on every downbeat
      'armR.rx': [
        [0.2, -1.75],
        [0.35, -1.0],
        [0.5, -1.85],
        [0.65, -0.95],
        [1.0, -1.3],
        [1.35, -0.7],
      ],
      'armR.rz': [
        [0.5, 0.2],
        [1.0, 0.35],
        [1.35, 0.3],
      ],
      'armL.rx': [
        [0.2, -0.75],
        [0.5, -0.55],
        [1.0, -0.7],
        [1.35, -0.5],
      ],
      'head.rx': [
        [0.2, 0.2],
        [0.35, -0.12],
        [0.5, 0.22],
        [0.65, -0.1],
        [1.0, 0.05],
        [1.35, 0.02],
      ],
      'head.rz': [
        [0.5, 0.12],
        [1.0, -0.06],
        [1.35, 0],
      ],
      'body.ry': [
        [0.5, -0.08],
        [1.0, 0.1],
        [1.35, 0.05],
      ],
      lift: [
        [0.5, 0.04],
        [0.75, 0],
        [1.35, 0],
      ],
    },
  ),

  boombox: anim(
    'boombox',
    'Shoulder Boombox',
    holdBoombox,
    1.9,
    0.85,
    {
      // heave it onto the shoulder, slap it with the left hand, little hop on the beat
      'armR.rx': [
        [0.4, -1.5],
        [0.6, -1.4],
        [0.85, -1.55],
        [1.3, -1.45],
        [1.6, -0.35],
      ],
      'armR.rz': [
        [0.4, 0.1],
        [0.85, 0.28],
        [1.7, 0.35],
      ],
      'armL.rx': [
        [0.4, 0.3],
        [0.7, -0.9],
        [0.85, -1.45],
        [0.95, -1.1],
        [1.4, -0.6],
        [1.7, 0.15],
      ],
      'armL.rz': [
        [0.85, 0.1],
        [1.4, 0.3],
        [1.7, 0.15],
      ],
      'body.ry': [
        [0.85, -0.15],
        [1.3, 0.05],
        [1.7, 0],
      ],
      'head.rx': [
        [0.4, -0.2],
        [0.85, -0.1],
        [1.0, -0.25],
        [1.4, -0.05],
        [1.7, -0.05],
      ],
      lean: [
        [0.4, -0.05],
        [0.85, 0.12],
        [1.3, 0.08],
        [1.7, 0.05],
      ],
      lift: [
        [0.85, 0.02],
        [1.0, 0.14],
        [1.2, 0],
        [1.35, 0.06],
        [1.55, 0],
        [1.7, 0],
      ],
      'legL.rx': [
        [1.0, -0.5],
        [1.2, 0],
        [1.7, 0],
      ],
      'legR.rx': [
        [1.0, -0.45],
        [1.2, 0],
        [1.7, 0],
      ],
    },
  ),

  flashlight: anim(
    'flashlight',
    'Big Torch',
    holdFlashlight,
    1.8,
    0.9,
    {
      // up to eye level, then one slow suspicious sweep across the room
      'armR.rx': [
        [0.3, -1.35],
        [0.55, -1.25],
        [1.3, -1.2],
        [1.6, -0.45],
      ],
      'armR.rz': [
        [0.3, 0.05],
        [1.6, 0.22],
      ],
      'armR.ry': [
        [0.5, -0.55, 'linear'],
        [1.2, 0.6, 'linear'],
        [1.45, 0.1],
        [1.6, 0],
      ],
      'body.ry': [
        [0.5, -0.3],
        [1.2, 0.28],
        [1.6, -0.05],
      ],
      'head.ry': [
        [0.5, -0.2],
        [1.2, 0.22],
        [1.6, 0],
      ],
      'head.rx': [
        [0.3, -0.12],
        [1.6, -0.02],
      ],
      lean: [
        [0.3, 0.1],
        [1.6, 0.04],
      ],
    },
  ),

  zapGun: anim(
    'zapGun',
    'Zap Gun',
    holdZapGun,
    2.0,
    0.95,
    {
      // both hands on the grip, then kick-kick — the whole body rocks back
      'armR.rx': [
        [0.35, -1.5],
        [0.7, -1.45],
        [0.95, -1.0],
        [1.1, -1.35],
        [1.35, -1.05],
        [1.55, -1.3],
        [1.8, -0.55],
      ],
      'armR.rz': [
        [0.35, 0.08],
        [0.95, 0.4],
        [1.1, 0.15],
        [1.8, 0.25],
      ],
      'armL.rx': [
        [0.35, -1.4],
        [0.95, -1.15],
        [1.1, -1.35],
        [1.8, -0.35],
      ],
      'body.ry': [
        [0.35, 0.12],
        [0.95, -0.28],
        [1.1, 0],
        [1.35, -0.22],
        [1.8, -0.08],
      ],
      'head.rx': [
        [0.35, -0.18],
        [0.95, 0.1],
        [1.35, -0.05],
        [1.8, -0.02],
      ],
      lean: [
        [0.35, 0.16],
        [0.95, -0.18],
        [1.1, 0.08],
        [1.35, -0.1],
        [1.8, 0.06],
      ],
      lift: [
        [0.95, 0.04],
        [1.1, 0],
        [1.35, 0.03],
        [1.6, 0],
        [1.8, 0],
      ],
      'legL.rx': [
        [0.95, 0.1],
        [1.35, 0.08],
        [1.8, 0],
      ],
    },
  ),

  camera: anim(
    'camera',
    'Clicky Camera',
    holdCamera,
    1.7,
    0.95,
    {
      // both hands up to the face, then a quick head tilt on the click
      'armR.rx': [
        [0.35, -1.55],
        [0.7, -1.5],
        [0.95, -1.6],
        [1.3, -1.5],
        [1.5, -0.3],
      ],
      'armR.rz': [
        [0.35, -0.05],
        [1.3, -0.02],
        [1.5, 0.25],
      ],
      'armR.ry': [
        [0.35, 0.2],
        [1.3, 0.15],
        [1.5, -0.1],
      ],
      'armL.rx': [
        [0.35, -1.45],
        [1.3, -1.4],
        [1.5, 0.1],
      ],
      'armL.rz': [
        [0.35, -0.05],
        [1.5, 0.2],
      ],
      'head.rx': [
        [0.35, 0.18],
        [0.95, 0.1],
        [1.3, 0.16],
        [1.5, 0.03],
      ],
      'head.rz': [
        [0.85, 0.02],
        [0.95, 0.28],
        [1.15, 0.05],
        [1.5, 0],
      ],
      lean: [
        [0.35, -0.08],
        [1.5, 0.03],
      ],
      lift: [
        [0.35, 0.02],
        [1.5, 0],
      ],
    },
  ),

  windupKey: anim(
    'windupKey',
    'Windup Key',
    holdWindupKey,
    2.3,
    1.55,
    {
      // three ratchet twists of the wrist (click ... click ... click), then let go
      'armR.ry': [
        [0.25, 0.5, 'step'],
        [0.4, 0.32, 'step'],
        [0.65, 0.95, 'step'],
        [0.8, 0.77, 'step'],
        [1.05, 1.4, 'step'],
        [1.2, 1.22, 'step'],
        [1.55, 0.15],
        [1.9, -0.15],
        [2.1, 0],
      ],
      'armR.rx': [
        [0.25, -1.18],
        [1.05, -1.22],
        [1.55, -0.65],
        [1.85, -1.05],
        [2.05, -1.0],
      ],
      'armR.rz': [
        [1.55, 0.15],
        [1.85, 0.3],
        [2.05, 0.3],
      ],
      'body.ry': [
        [0.25, 0.12, 'linear'],
        [1.05, 0.2, 'linear'],
        [1.55, -0.02],
        [1.9, 0.08],
        [2.1, -0.06],
      ],
      'head.rx': [
        [0.25, -0.15],
        [1.05, -0.18],
        [1.55, 0.08],
        [2.05, -0.02],
      ],
      lean: [
        [0.25, 0.02],
        [1.55, 0.16],
        [1.9, 0.06],
        [2.05, 0.07],
      ],
      lift: [
        [1.55, 0.03],
        [1.75, 0],
        [2.05, 0],
      ],
    },
  ),

  spade: anim(
    'spade',
    'Rusty Spade',
    holdSpade,
    2.4,
    0.95,
    {
      // arch back and raise it, stab down with a push off the right foot, lever it back
      'armR.rx': [
        [0.35, -1.95],
        [0.7, -1.6],
        [0.95, -0.25],
        [1.15, -0.4],
        [1.6, -1.25],
        [1.95, -0.6],
      ],
      'armR.rz': [
        [0.35, 0.1],
        [0.95, 0.45],
        [1.6, 0.2],
        [1.95, 0.3],
      ],
      'armL.rx': [
        [0.35, -1.7],
        [0.95, -0.3],
        [1.15, -0.5],
        [1.6, -1.0],
        [1.95, -0.4],
      ],
      'body.ry': [
        [0.35, 0.2],
        [0.95, -0.3],
        [1.6, 0.05],
        [1.95, -0.05],
      ],
      'head.rx': [
        [0.35, -0.2],
        [0.95, 0.35],
        [1.6, 0.12],
        [1.95, 0.1],
      ],
      'legR.rx': [
        [0.7, 0.15],
        [0.95, -0.7],
        [1.2, -0.35],
        [1.6, 0.05],
        [1.95, 0],
      ],
      'legR.rz': [
        [0.95, 0.2],
        [1.3, 0.05],
        [1.95, 0],
      ],
      'legL.rx': [
        [0.35, -0.1],
        [0.95, 0.12],
        [1.6, 0.02],
        [1.95, 0],
      ],
      lean: [
        [0.35, -0.25],
        [0.7, -0.1],
        [0.95, 0.42],
        [1.15, 0.35],
        [1.6, 0.05],
        [1.95, 0.12],
      ],
      lift: [
        [0.35, 0.06],
        [0.7, 0.02],
        [0.95, 0],
        [1.2, 0.04],
        [1.95, 0],
      ],
    },
  ),

  fairyWand: anim(
    'fairyWand',
    'Fairy Wand',
    holdFairyWand,
    2.0,
    1.1,
    {
      // a dainty little circle in the air, then FLICK — with a hopeful hop
      'armR.rx': [
        [0.3, -1.8],
        [0.5, -1.35],
        [0.7, -1.85],
        [0.9, -1.4],
        [1.1, -0.85],
        [1.3, -1.15],
        [1.7, -1.2],
      ],
      'armR.rz': [
        [0.3, 0.5],
        [0.5, 0.25],
        [0.7, 0.55],
        [0.9, 0.3],
        [1.1, 0.6],
        [1.4, 0.45],
        [1.7, 0.4],
      ],
      'armR.ry': [
        [0.3, 0.1],
        [0.5, 0.65],
        [0.7, -0.35],
        [0.9, 0.5],
        [1.1, -0.25],
        [1.4, 0.15],
        [1.7, 0.2],
      ],
      'body.ry': [
        [0.5, 0.15],
        [0.9, -0.2],
        [1.1, 0.1],
        [1.7, -0.04],
      ],
      'head.rx': [
        [0.3, -0.2],
        [1.1, -0.05],
        [1.3, 0.05],
        [1.7, -0.05],
      ],
      'armL.rx': [
        [1.1, -0.5],
        [1.4, 0.05],
        [1.7, 0.15],
      ],
      lean: [
        [0.3, -0.05],
        [1.1, 0.2],
        [1.3, 0.12],
        [1.7, 0.05],
      ],
      lift: [
        [1.0, 0.02],
        [1.1, 0.05],
        [1.25, 0.18],
        [1.45, 0],
        [1.7, 0],
      ],
      'legL.rx': [
        [1.15, -0.4],
        [1.4, 0],
        [1.7, 0],
      ],
      'legR.rx': [
        [1.15, -0.35],
        [1.4, 0],
        [1.7, 0],
      ],
    },
  ),
};

/* ------------------------------------------------------------------ */
/* data checker                                                        */
/* ------------------------------------------------------------------ */

/** Problems in the data: bad ordering, out-of-range keys, or a clip that does not loop. */
export function check(a: ToolAnim): string[] {
  const problems: string[] = [];
  const d = a.use.duration;
  const where = (ch: Channel, what: string): string => `${a.id}.${ch}: ${what}`;

  if (!(d > 0)) problems.push(`${a.id}: duration ${d} must be greater than 0`);
  if (!(a.hitAt >= 0 && a.hitAt <= d)) {
    problems.push(`${a.id}: hitAt ${a.hitAt} is outside the clip 0..${d}`);
  }

  for (const bone of BONES) {
    for (const prop of PROPS) {
      const v = a.hold.bones[bone][prop];
      if (Math.abs(v) > MAX_ANGLE) {
        problems.push(`${a.id}.hold.${bone}.${prop}: ${v} rad is beyond ±${MAX_ANGLE}`);
      }
    }
  }
  if (a.hold.lift < 0 || a.hold.lift > MAX_LIFT) {
    problems.push(`${a.id}.hold.lift: ${a.hold.lift} m is outside 0..${MAX_LIFT}`);
  }

  for (const ch of CHANNELS) {
    const track = a.use.tracks[ch];
    if (!track) continue;
    const holdV = channelValue(a.hold, ch);
    if (track.length < 2) {
      problems.push(where(ch, 'a track needs at least two keys'));
      continue;
    }
    let previous: Key | undefined;
    for (const k of track) {
      if (!(k.t >= 0 && k.t <= d)) {
        problems.push(where(ch, `key at t=${k.t} is outside 0..${d}`));
      }
      if (!Number.isFinite(k.v)) {
        problems.push(where(ch, `key at t=${k.t} has a value that is not a number`));
      }
      if (previous !== undefined && k.t <= previous.t) {
        problems.push(where(ch, `key at t=${k.t} is not after the key at t=${previous.t}`));
      }
      if (ch === 'lift') {
        if (k.v < 0 || k.v > MAX_LIFT) {
          problems.push(where(ch, `${k.v} m is outside 0..${MAX_LIFT}`));
        }
      } else if (Math.abs(k.v) > MAX_ANGLE) {
        problems.push(where(ch, `${k.v} rad is beyond ±${MAX_ANGLE}`));
      }
      previous = k;
    }
    const first = track[0];
    const last = track[track.length - 1];
    if (first && last) {
      if (Math.abs(first.v - holdV) > LOOP_TOLERANCE) {
        problems.push(where(ch, `starts at ${first.v} but the hold pose is ${holdV}`));
      }
      if (Math.abs(last.v - holdV) > LOOP_TOLERANCE) {
        problems.push(where(ch, `ends at ${last.v} but the hold pose is ${holdV}`));
      }
    }
  }

  return problems;
}