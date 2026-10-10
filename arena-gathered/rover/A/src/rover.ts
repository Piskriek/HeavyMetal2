/**
 * @hm/rover — arcade-stable driving physics for the moon game's rovers.
 *
 * Fixed DT = 1/60, y up, forward = local +z, right = local -x. Pure and
 * deterministic: no DOM, no Date, no Math.random, and no sin/cos/tan/atan2
 * in the hot path — all rotations are quaternion/vector algebra plus
 * Math.sqrt; the only angles ever materialized (oriented box yaw) come from
 * a hand-rolled Taylor series, which is exact IEEE arithmetic everywhere.
 *
 * Model (per fixed step):
 * - Each wheel/contact point is a raycast spring-damper from its body anchor
 *   along body-down (rest 0.5 m, ~1 Hz, damping ratio 0.6), with clamped
 *   force. The ray solves "wheel circle touches the heightfield" by a fixed
 *   bracket + bisection — a deterministic function of position only.
 * - Tire model: viscous slip — drive/brake longitudinally and lateral grip
 *   — clamped to the friction circle mu * N. Viscous slip cannot overshoot
 *   zero velocity, so rest means rest: no jitter, no explosion.
 * - Steering is emergent: front wheels' evaluation frames are deflected by
 *   the steer command (faded with speed, arcade-style), and the slip forces
 *   torque the body — no kinematic shortcuts, correct sign by construction
 *   (right = forward x up, so +steer rotates the heading toward -x).
 * - Crawler is skid steer: per-side drive commands (throttle +- skid*steer);
 *   with throttle 0 and steer +-1 the tracks contra-rotate and it turns on
 *   the spot. Its lateral grip is deliberately slipperier or the tall scrub
 *   torque would dominate the differential.
 * - Body damping: proportional angular damping plus a whisper of rolling
 *   resistance when coasting. Oriented boxes push the body box out with a
 *   2D OBB SAT (min-penetration axis) and kill the inward velocity — the
 *   rover slides along walls instead of tunneling or bouncing.
 */

export const DT = 1 / 60;

export type RoverKind = 'scout' | 'hauler' | 'crawler';

export interface RoverState {
  kind: RoverKind;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  w: [number, number, number];
}

export interface Ground {
  height(x: number, z: number): number;
  g: number;
  boxes?: { cx: number; cz: number; hx: number; hz: number; yaw: number; top: number }[];
}

export interface Input {
  throttle: number; // -1..1
  steer: number; // -1..1; +1 turns right (toward -x)
  brake: boolean;
}

/** Catalog numbers, as published. Physics tuning constants live below. */
export const ROVERS = {
  scout: { wheels: 4, mass: 400, wheelbase: 2.2, track: 1.6, wheelRadius: 0.45, topSpeed: 14, maxSteer: 0.5, tracked: false },
  hauler: { wheels: 6, mass: 1600, wheelbase: 3.6, track: 2.0, wheelRadius: 0.55, topSpeed: 9, maxSteer: 0.4, tracked: false },
  crawler: { wheels: 8, mass: 4000, wheelbase: 4.4, track: 2.4, wheelRadius: 0.5, topSpeed: 4, maxSteer: 1, tracked: true, length: 4.4 },
} as const;

/* ------------------------------------------------------------------ */
/* Little deterministic math kit                                       */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number];
type Quat = [number, number, number, number];

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vscale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const vlen = (a: V3): number => Math.sqrt(dot(a, a));
const vnorm = (a: V3): V3 => {
  const l = vlen(a);
  return l > 1e-12 ? vscale(a, 1 / l) : a;
};
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

const qnorm = (q: Quat): Quat => {
  const l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  return l > 1e-12 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : [0, 0, 0, 1];
};
/** Rotate v by q: v + 2 * qv x (qv x v + w v). */
const qrot = (q: Quat, v: V3): V3 => {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const tx = 2 * (qy * v[2] - qz * v[1]) + 2 * qw * v[0];
  const ty = 2 * (qz * v[0] - qx * v[2]) + 2 * qw * v[1];
  const tz = 2 * (qx * v[1] - qy * v[0]) + 2 * qw * v[2];
  return [
    v[0] + qy * tz - qz * ty,
    v[1] + qz * tx - qx * tz,
    v[2] + qx * ty - qy * tx,
  ];
};
const qconj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

/* Deterministic range-reduced Taylor trig — only used for oriented box yaw
 * (the one place an angle is data). ~1e-15 abs error on [-pi, pi]. */
const PI = 3.141592653589793;
const TAU = 6.283185307179586;
const reducePi = (x: number): number => {
  const k = Math.round(x / TAU);
  return x - k * TAU;
};
const cosT = (x0: number): number => {
  const x = reducePi(x0);
  const x2 = x * x;
  let term = 1;
  let sum = 1;
  for (let n = 1; n <= 9; n++) {
    term = (-term * x2) / ((2 * n - 1) * (2 * n));
    sum += term;
  }
  return sum;
};
const sinT = (x0: number): number => {
  const x = reducePi(x0);
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n <= 9; n++) {
    term = (-term * x2) / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
};

/* ------------------------------------------------------------------ */
/* Physics constants                                                   */
/* ------------------------------------------------------------------ */

const SUSP_REST = 0.5; // m
const SUSP_FREQ = 2 * PI; // 1 Hz
const SUSP_ZETA = 0.6;
const MU = 2.0; // tire friction coefficient (arcade grip)
const LAT_REF = 0.1; // slip speed (m/s) where lateral force saturates
const LAT_REF_CRAWLER = 3.0; // tracked: slippery or it cannot skid steer
const BRAKE_REF = 0.05; // slip ref for longitudinal (brake) grip
const DRIVE_ACCEL = 3.0; // m/s^2 at v=0, full throttle, before grip clamp
const STEER_FADE_SPEED = 5; // m/s: steering authority halves near this...
const ANG_DAMP = 3; // 1/s angular damping rate
const ROLL_RESIST = 0.005; // coasting rolling resistance fraction of N
const CRAWLER_SKID = 0.3; // side-command fraction per unit steer

interface Spec {
  readonly mass: number;
  readonly top: number;
  readonly radius: number;
  readonly maxSteer: number;
  readonly tracked: boolean;
  readonly ex: number; // body half width
  readonly ez: number; // body half length
  readonly height: number; // body box half height gate for walls
  readonly wheels: readonly (readonly [number, number])[]; // body-x, body-z anchors
  readonly steer: readonly boolean[]; // per wheel
  readonly fmax: number;
  readonly latRef: number;
  readonly ix: number;
  readonly iy: number;
  readonly iz: number;
}

const spec = (kind: RoverKind): Spec => {
  switch (kind) {
    case 'scout': {
      const c = ROVERS.scout;
      const wheels: [number, number][] = [
        [-c.track / 2, c.wheelbase / 2],
        [c.track / 2, c.wheelbase / 2],
        [-c.track / 2, -c.wheelbase / 2],
        [c.track / 2, -c.wheelbase / 2],
      ];
      return build(c.mass, 1.6, 2.2, 0.5, c.topSpeed, c.maxSteer, false, c.wheelRadius, wheels, [true, true, false, false], 1.6 / 2, 2.2 / 2);
    }
    case 'hauler': {
      const c = ROVERS.hauler;
      const wheels: [number, number][] = [];
      for (const z of [c.wheelbase / 2, 0, -c.wheelbase / 2]) {
        wheels.push([-c.track / 2, z], [c.track / 2, z]);
      }
      return build(c.mass, 2.0, 3.6, 0.55, c.topSpeed, c.maxSteer, false, c.wheelRadius, wheels, [true, true, false, false, false, false], 2.0 / 2, 3.6 / 2);
    }
    case 'crawler': {
      const c = ROVERS.crawler;
      const wheels: [number, number][] = [];
      for (const z of [1.65, 0.55, -0.55, -1.65]) {
        wheels.push([-c.track / 2, z], [c.track / 2, z]);
      }
      return build(c.mass, 2.4, 4.4, 0.8, c.topSpeed, c.maxSteer, true, c.wheelRadius, wheels, [false, false, false, false, false, false, false, false], 2.4 / 2, 4.4 / 2);
    }
  }
};
const build = (
  mass: number, width: number, length: number, height: number,
  top: number, maxSteer: number, tracked: boolean, radius: number,
  wheels: [number, number][], steer: boolean[], ex: number, ez: number,
): Spec => ({
  mass,
  top,
  radius,
  maxSteer,
  tracked,
  ex,
  ez,
  height,
  wheels,
  steer,
  fmax: DRIVE_ACCEL * mass,
  latRef: tracked ? LAT_REF_CRAWLER : LAT_REF,
  ix: (mass * (height * height + length * length)) / 12,
  iy: (mass * (width * width + length * length)) / 12,
  iz: (mass * (width * width + height * height)) / 12,
});
const SPECS: Record<RoverKind, Spec> = {
  scout: spec('scout'),
  hauler: spec('hauler'),
  crawler: spec('crawler'),
};

/* ------------------------------------------------------------------ */
/* Terrain helpers                                                     */
/* ------------------------------------------------------------------ */

const groundNormal = (g: Ground, x: number, z: number): V3 => {
  const e = 0.25;
  const hx = (g.height(x + e, z) - g.height(x - e, z)) / (2 * e);
  const hz = (g.height(x, z + e) - g.height(x, z - e)) / (2 * e);
  return vnorm([-hx, 1, -hz]);
};

/* ------------------------------------------------------------------ */
/* spawn                                                               */
/* ------------------------------------------------------------------ */

/** Build the orientation: yaw from heading (unit xz), then tilt to the terrain normal. */
const spawnOrientation = (ground: Ground, x: number, z: number, heading: [number, number]): Quat => {
  const hl = Math.sqrt(heading[0] * heading[0] + heading[1] * heading[1]);
  const fx = hl > 1e-12 ? heading[0] / hl : 0;
  const fz = hl > 1e-12 ? heading[1] / hl : 1;
  const n = groundNormal(ground, x, z);
  // forward = heading projected onto the tangent plane
  const f3 = vnorm(vsub([fx, 0, fz], vscale(n, fx * n[0] + fz * n[2])));
  // right = forward x up  (== local -x, per the game's convention)
  const r3 = vnorm(cross(f3, n));
  // Rotation columns: local +x = -right, local +y = n, local +z = f3.
  const cx: V3 = vscale(r3, -1);
  const cy: V3 = n;
  const cz: V3 = f3;
  // Matrix -> quaternion (largest-trace branch; sqrt only).
  const m00 = cx[0], m01 = cy[0], m02 = cz[0];
  const m10 = cx[1], m11 = cy[1], m12 = cz[1];
  const m20 = cx[2], m21 = cy[2], m22 = cz[2];
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  return qnorm(q);
};

export function spawn(kind: RoverKind, x: number, z: number, heading: [number, number], ground: Ground): RoverState {
  const sp = SPECS[kind];
  const q = spawnOrientation(ground, x, z, heading);
  // Rest the body so the springs start at their static compression g/omega^2.
  // Estimate the ground level from the terrain under each wheel anchor.
  const xAxis = qrot(q, [1, 0, 0]);
  const zAxis = qrot(q, [0, 0, 1]);
  let hSum = 0;
  for (const [wx, wz] of sp.wheels) {
    hSum += ground.height(x + xAxis[0] * wx + zAxis[0] * wz, z + xAxis[2] * wx + zAxis[2] * wz);
  }
  const hAvg = hSum / sp.wheels.length;
  const compEq = ground.g / (SUSP_FREQ * SUSP_FREQ);
  const y = hAvg + sp.radius + (SUSP_REST - compEq);
  return { kind, p: [x, y, z], q, v: [0, 0, 0], w: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* step                                                                */
/* ------------------------------------------------------------------ */

interface WheelOut {
  grounded: boolean;
  n: number; // normal force (spring scalar)
  cp: V3; // contact point (on the ground)
  normal: V3;
  fDir: V3; // tire forward on tangent plane
  lDir: V3; // tire lateral (right) on tangent plane
  vf: number; // forward slip speed
  vl: number; // lateral slip speed
}

export function step(s: RoverState, input: Input, ground: Ground): RoverState {
  const sp = SPECS[s.kind];
  const q = qnorm(s.q);
  const p: V3 = [s.p[0], s.p[1], s.p[2]];
  const v: V3 = [s.v[0], s.v[1], s.v[2]];
  const w: V3 = [s.w[0], s.w[1], s.w[2]];
  const n = sp.wheels.length;
  const m = sp.mass;
  const g = ground.g;

  const fBody = qrot(q, [0, 0, 1]);
  const rBody = qrot(q, [-1, 0, 0]);
  const dBody = qrot(q, [0, -1, 0]); // body down

  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  const brake = input.brake;

  // Body forward speed (for steering fade).
  const vFwdBody = dot(v, fBody);
  const fade = sp.tracked ? 0 : (sp.maxSteer * steer) / (1 + (vFwdBody / STEER_FADE_SPEED) * (vFwdBody / STEER_FADE_SPEED));

  const k = (m * SUSP_FREQ * SUSP_FREQ) / n;
  const c = (2 * SUSP_ZETA * SUSP_FREQ * m) / n;
  const kCap = k * SUSP_REST; // full-compression spring force (per wheel)

  let F: V3 = [0, -m * g, 0];
  let T: V3 = [0, 0, 0];
  const applyForceAt = (at: V3, f: V3): void => {
    F = vadd(F, f);
    T = vadd(T, cross(vsub(at, p), f));
  };

  // --- suspension raycast per wheel ---
  const out: WheelOut[] = [];
  for (let i = 0; i < n; i++) {
    const wx = sp.wheels[i]![0];
    const wz = sp.wheels[i]![1];
    // anchor on the body (y at body center level)
    const anchor = vadd(p, vadd(vscale(rBody, -wx), vscale(fBody, wz)));
    // Solve E(t) = (anchor + d t).y - (h(xz) + radius) == 0 on t in [0, REST].
    const elev = (t: number): number => {
      const ax = anchor[0] + dBody[0] * t;
      const ay = anchor[1] + dBody[1] * t;
      const az = anchor[2] + dBody[2] * t;
      return ay - (ground.height(ax, az) + sp.radius);
    };
    let comp = 0;
    let tHit = -1;
    if (elev(0) <= 0) {
      tHit = 0;
    } else if (elev(SUSP_REST) <= 0) {
      // bracket by a fixed scan, then refine by bisection
      const SCAN = 8;
      let lo = 0;
      let hi = SUSP_REST;
      for (let j = 1; j <= SCAN; j++) {
        const t = (SUSP_REST * j) / SCAN;
        if (elev(t) <= 0) {
          lo = (SUSP_REST * (j - 1)) / SCAN;
          hi = t;
          break;
        }
      }
      for (let it = 0; it < 10; it++) {
        const mid = (lo + hi) / 2;
        if (elev(mid) <= 0) hi = mid;
        else lo = mid;
      }
      tHit = (lo + hi) / 2;
    }
    let springF = 0;
    let contact = vadd(anchor, vscale(dBody, SUSP_REST));
    let gn: V3 = [0, 1, 0];
    if (tHit >= 0) {
      comp = SUSP_REST - tHit;
      contact = vadd(anchor, vscale(dBody, tHit));
      gn = groundNormal(ground, contact[0], contact[2]);
      const vAttach = vadd(v, cross(w, vsub(anchor, p)));
      const rate = -dot(vAttach, dBody); // > 0 while compressing
      springF = k * comp + clamp(c * rate, -kCap * 0.5, kCap * 0.5);
      springF = clamp(springF, 0, kCap * 2);
      applyForceAt(contact, vscale(dBody, -springF));
    }
    // tire frames on the tangent plane; front wheels may be deflected
    let fRaw = fBody;
    if (sp.steer[i] === true && fade !== 0) {
      fRaw = vnorm(vadd(fBody, vscale(rBody, fade)));
    }
    const fDir = vnorm(vsub(fRaw, vscale(gn, dot(fRaw, gn))));
    const lDir = vnorm(cross(fDir, gn));
    const vc = vadd(v, cross(w, vsub(contact, p)));
    out.push({
      grounded: tHit >= 0,
      n: springF,
      cp: contact,
      normal: gn,
      fDir,
      lDir,
      vf: tHit >= 0 ? dot(vc, fDir) : 0,
      vl: tHit >= 0 ? dot(vc, lDir) : 0,
    });
  }

  // --- tire forces ---
  const skidSide = (i: number): number => (sp.wheels[i]![0] > 0 ? 1 : -1);
  for (let i = 0; i < n; i++) {
    const wo = out[i]!;
    if (!wo.grounded || wo.n <= 0) continue;
    const capN = MU * wo.n;
    let ff = 0; // longitudinal force along fDir
    if (brake) {
      const sigma = capN / BRAKE_REF;
      ff = -sigma * wo.vf;
    } else if (sp.tracked) {
      const sSide = clamp(throttle + CRAWLER_SKID * skidSide(i) * steer, -1, 1);
      ff = (sp.fmax / n) * (sSide - wo.vf / sp.top);
    } else {
      ff = (sp.fmax / n) * (throttle - wo.vf / sp.top);
    }
    // lateral grip
    const sigmaL = capN / sp.latRef;
    let fl = -sigmaL * wo.vl;
    // rolling resistance when coasting
    let fr = 0;
    if (!brake && Math.abs(throttle) < 0.01 && Math.abs(wo.vf) > 0.1) {
      fr = -ROLL_RESIST * wo.n * Math.sign(wo.vf);
    }
    // friction circle clamp on the combined tire force
    let fx = ff + fr;
    const mag = Math.sqrt(fx * fx + fl * fl);
    if (mag > capN && mag > 1e-12) {
      const sc = capN / mag;
      fx *= sc;
      fl *= sc;
    }
    applyForceAt(wo.cp, vadd(vscale(wo.fDir, fx), vscale(wo.lDir, fl)));
  }

  // --- integrate linear ---
  let v2 = vadd(v, vscale(F, DT / m));
  let p2 = vadd(p, vscale(v2, DT));

  // --- integrate angular (work in body frame with diagonal inertia) ---
  const qi = qconj(q);
  let wb = qrot(qi, w);
  const tb = qrot(qi, T);
  wb = [
    wb[0] + ((tb[0] - ANG_DAMP * sp.ix * wb[0]) / sp.ix) * DT,
    wb[1] + ((tb[1] - ANG_DAMP * sp.iy * wb[1]) / sp.iy) * DT,
    wb[2] + ((tb[2] - ANG_DAMP * sp.iz * wb[2]) / sp.iz) * DT,
  ];
  const w2 = qrot(q, wb);
  // q' = q + 0.5 * (0, w2) * q * DT, normalized
  const dq: Quat = [
    0.5 * (w2[0] * q[3] + w2[1] * q[2] - w2[2] * q[1]) * DT,
    0.5 * (-w2[0] * q[2] + w2[1] * q[3] + w2[2] * q[0]) * DT,
    0.5 * (w2[0] * q[1] - w2[1] * q[0] + w2[2] * q[3]) * DT,
    0.5 * (-w2[0] * q[0] - w2[1] * q[1] - w2[2] * q[2]) * DT,
  ];
  const q2 = qnorm([q[0] + dq[0], q[1] + dq[1], q[2] + dq[2], q[3] + dq[3]]);

  // --- oriented boxes: 2D OBB SAT in xz, then kill inward velocity ---
  if (ground.boxes !== undefined) {
    const fwdX = 2 * (q2[0] * q2[2] + q2[3] * q2[1]);
    const fwdZ = 1 - 2 * (q2[0] * q2[0] + q2[1] * q2[1]);
    const fl2 = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ);
    const a1: [number, number] = fl2 > 1e-12 ? [fwdX / fl2, fwdZ / fl2] : [0, 1]; // forward
    const a2: [number, number] = [-a1[1], a1[0]]; // right
    for (const b of ground.boxes) {
      const bottom = p2[1] - sp.height;
      if (bottom >= b.top) continue;
      const cb = cosT(b.yaw);
      const sb = sinT(b.yaw);
      const u1: [number, number] = [cb, sb];
      const u2: [number, number] = [-sb, cb];
      const tx = p2[0] - b.cx;
      const tz = p2[2] - b.cz;
      const axes: [number, number][] = [a1, a2, u1, u2];
      let minOverlap = Number.POSITIVE_INFINITY;
      let pushX = 0;
      let pushZ = 0;
      let separated = false;
      for (const axis of axes) {
        const t = tx * axis[0] + tz * axis[1];
        const rR =
          sp.ex * Math.abs(a2[0] * axis[0] + a2[1] * axis[1]) +
          sp.ez * Math.abs(a1[0] * axis[0] + a1[1] * axis[1]);
        const rB =
          b.hx * Math.abs(u1[0] * axis[0] + u1[1] * axis[1]) +
          b.hz * Math.abs(u2[0] * axis[0] + u2[1] * axis[1]);
        const overlap = rR + rB - Math.abs(t);
        if (overlap <= 0) {
          separated = true;
          break;
        }
        if (overlap < minOverlap) {
          minOverlap = overlap;
          const sgn = t >= 0 ? 1 : -1;
          pushX = axis[0] * sgn;
          pushZ = axis[1] * sgn;
        }
      }
      if (separated) continue;
      p2 = [p2[0] + pushX * minOverlap, p2[1], p2[2] + pushZ * minOverlap];
      const vn = v2[0] * pushX + v2[2] * pushZ;
      if (vn < 0) {
        v2 = [v2[0] - pushX * vn, v2[1], v2[2] - pushZ * vn];
      }
    }
  }

  return {
    kind: s.kind,
    p: [p2[0], p2[1], p2[2]],
    q: [q2[0], q2[1], q2[2], q2[3]],
    v: [v2[0], v2[1], v2[2]],
    w: [w2[0], w2[1], w2[2]],
  };
}

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

export function speed(s: RoverState): number {
  const q = qnorm(s.q);
  const f = qrot(q, [0, 0, 1]);
  return s.v[0] * f[0] + s.v[1] * f[1] + s.v[2] * f[2];
}

export function hashRover(s: RoverState): string {
  const num = (x: number): string => (Object.is(x, -0) ? '-0' : String(x));
  const parts: string[] = [s.kind];
  for (const arr of [s.p, s.q, s.v, s.w] as const) {
    for (const x of arr) parts.push(num(x));
  }
  return parts.join('|');
}
