/**
 * camtrack — camera tracks for a toy-world game's photo and film tools.
 *
 * A `CamTrack` is a list of keys sorted by time. Each key parks the camera
 * somewhere (`pos`), aims it at something (`target`) and sets its lens
 * (`fov`, degrees). Sampling the track at a time hands you a `CamShot` ready
 * for the renderer: outside the keys the camera simply holds the first or last
 * pose, between them the shot is eased, and with `smooth` the position glides
 * along a Catmull-Rom arc through the keys instead of cornering on them.
 *
 * Around that core: `orbitShot` builds a ready-made dolly round a subject,
 * `lookYawPitch` turns "aim from here at there" into the euler angles the toy
 * rigs speak, and `SlowMo` is the ramping clock that converts real seconds
 * into fewer game seconds for a bullet-time freeze.
 */

/** A point or direction in the toy world: [x, y, z]. */
export type Vec3 = [number, number, number];

/** Where the camera is, what it looks at, and its lens — parked at time `t`. */
export interface CamKey {
  /** seconds along the track timeline; keys are sorted by it */
  t: number;
  pos: Vec3;
  target: Vec3;
  /** vertical field of view, degrees */
  fov: number;
}

/** How the parameter between two keys is shaped. */
export type Ease = 'linear' | 'in' | 'out' | 'in-out';

export interface CamTrack {
  keys: CamKey[];
  ease: Ease;
  /** arc the positions through the keys (uniform Catmull-Rom, tension 0.5) */
  smooth: boolean;
  /** wrap sampled times back into [first.t, last.t) */
  loop: boolean;
}

/** A camera pose: what the photo/film tools need. */
export interface CamShot {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

const DEG = 180 / Math.PI;

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const lerp = (a: number, b: number, s: number): number => a + (b - a) * s;

const blend = (a: Vec3, b: Vec3, s: number): Vec3 => [
  lerp(a[0], b[0], s),
  lerp(a[1], b[1], s),
  lerp(a[2], b[2], s),
];

const copy = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

/** `from` pushed as far past `away` as `away` sits past `from` — the mirrored end point. */
const reflect = (from: Vec3, away: Vec3): Vec3 => [
  2 * from[0] - away[0],
  2 * from[1] - away[1],
  2 * from[2] - away[2],
];

/**
 * `ease` in the box: u is clamped to 0..1 first, then
 * linear u, in u^2, out 1 - (1 - u)^2, in-out 3u^2 - 2u^3.
 */
export function ease(kind: Ease, u: number): number {
  const x = clamp01(u);
  switch (kind) {
    case 'linear':
      return x;
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'in-out':
      return 3 * x * x - 2 * x * x * x;
  }
}

/** Last key's t minus first key's t (0 with fewer than two keys). */
export function trackDuration(track: CamTrack): number {
  const n = track.keys.length;
  if (n < 2) return 0;
  return track.keys[n - 1]!.t - track.keys[0]!.t;
}

/** Uniform Catmull-Rom segment (tension 0.5) between p1 and p2, at s in 0..1. */
const catmullRom = (p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, s: number): Vec3 => {
  const s2 = s * s;
  const s3 = s2 * s;
  const comp = (a: number, b: number, c: number, d: number): number =>
    0.5 *
    (2 * b +
      (c - a) * s +
      (2 * a - 5 * b + 4 * c - d) * s2 +
      (3 * b - a - 3 * c + d) * s3);
  return [
    comp(p0[0], p1[0], p2[0], p3[0]),
    comp(p0[1], p1[1], p2[1], p3[1]),
    comp(p0[2], p1[2], p2[2], p3[2]),
  ];
};

/** Key `i`'s position, with the two missing end positions mirrored: p[-1] and p[n]. */
function positionAt(keys: readonly CamKey[], i: number): Vec3 {
  const n = keys.length;
  if (n === 0) return [0, 0, 0];
  if (i >= 0 && i < n) return keys[i]!.pos;
  if (i < 0) {
    const first = keys[0]!.pos;
    return n > 1 ? reflect(first, keys[1]!.pos) : first;
  }
  const last = keys[n - 1]!.pos;
  return n > 1 ? reflect(last, keys[n - 2]!.pos) : last;
}

const shotOf = (key: CamKey): CamShot => ({
  pos: copy(key.pos),
  target: copy(key.target),
  fov: key.fov,
});

/**
 * The shot at time `t`. Before the first key the first key is held, after the
 * last key the last one; with `loop`, `t` wraps into [first.t, last.t).
 * Between keys k and k+1 the blend factor is `s = ease((t - tk) / (tk+1 - tk))`:
 * target and fov blend straight by s, and pos blends straight by s or, when the
 * track is smooth, rides the Catmull-Rom through the key positions at s.
 */
export function sampleTrack(track: CamTrack, t: number): CamShot {
  const keys = track.keys;
  const n = keys.length;
  if (n === 0) return { pos: [0, 0, 0], target: [0, 0, 0], fov: 0 };

  const first = keys[0]!;
  const last = keys[n - 1]!;
  const span = last.t - first.t;
  let time = t;

  if (track.loop && span > 0) {
    const wrapped = (time - first.t) % span;
    time = first.t + (wrapped < 0 ? wrapped + span : wrapped);
  }

  if (n === 1 || time <= first.t) return shotOf(first);
  if (time >= last.t) return shotOf(last);

  let i = 0;
  for (let j = 1; j < n - 1; j++) {
    if (time >= keys[j]!.t) i = j;
  }
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const seg = b.t - a.t;
  const s = ease(track.ease, seg > 0 ? (time - a.t) / seg : 1);

  const pos = track.smooth
    ? catmullRom(positionAt(keys, i - 1), a.pos, b.pos, positionAt(keys, i + 2), s)
    : blend(a.pos, b.pos, s);

  return { pos, target: blend(a.target, b.target, s), fov: lerp(a.fov, b.fov, s) };
}

/**
 * A ready-made orbit shot: a key every 45 degrees of turning, `turns` times
 * round (turns * 8 + 1 keys), evenly spaced over `seconds`. Each key sits at
 * centre + (radius sin a, height, radius cos a) with a = startDeg + the turning
 * so far, looking at centre through a `fov` lens. Smooth, linear ease, no loop.
 */
export function orbitShot(
  centre: Vec3,
  radius: number,
  height: number,
  seconds: number,
  startDeg: number,
  turns: number,
  fov: number,
): CamTrack {
  const steps = Math.max(0, Math.round(turns * 8));
  const keys: CamKey[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = ((startDeg + i * 45) * Math.PI) / 180;
    keys.push({
      t: steps > 0 ? (seconds * i) / steps : 0,
      pos: [
        centre[0] + radius * Math.sin(angle),
        centre[1] + height,
        centre[2] + radius * Math.cos(angle),
      ],
      target: copy(centre),
      fov,
    });
  }
  return { keys, ease: 'linear', smooth: true, loop: false };
}

/**
 * The yaw and pitch, in degrees, that look from `from` at `to`:
 * yaw = atan2(dx, dz), pitch = atan2(dy, hypot(dx, dz)).
 */
export function lookYawPitch(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return {
    yaw: Math.atan2(dx, dz) * DEG,
    pitch: Math.atan2(dy, Math.hypot(dx, dz)) * DEG,
  };
}

/**
 * The slow-motion clock. The time scale starts at 1; `setScale` walks it in a
 * straight line to `scale` over `rampSeconds` of real time (0 snaps at once).
 * `tick(realDt)` returns the game time that passed — realDt times the mean
 * scale across the step, splitting a step that the ramp finishes inside so the
 * area under the ramp stays exact.
 */
export class SlowMo {
  private current = 1;
  private target = 1;
  private rate = 0;
  private rampLeft = 0;

  /** the scale the clock is at right now */
  get scale(): number {
    return this.current;
  }

  setScale(scale: number, rampSeconds: number): void {
    this.target = scale;
    if (!(rampSeconds > 0)) {
      this.current = scale;
      this.rampLeft = 0;
      this.rate = 0;
      return;
    }
    this.rampLeft = rampSeconds;
    this.rate = (scale - this.current) / rampSeconds;
  }

  tick(realDt: number): number {
    let dt = realDt;
    if (!(dt > 0)) return 0;
    let game = 0;

    if (this.rampLeft > 0) {
      const ramping = Math.min(dt, this.rampLeft);
      const next = this.current + this.rate * ramping;
      game += (this.current + next) * 0.5 * ramping;
      this.current = next;
      this.rampLeft -= ramping;
      dt -= ramping;
      if (this.rampLeft <= 0) {
        this.rampLeft = 0;
        this.current = this.target;
        this.rate = 0;
      }
    }

    return game + dt * this.current;
  }
}