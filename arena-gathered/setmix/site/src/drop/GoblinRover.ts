/* ============================================================================
 *  packages/setmix-vehicle/src/GoblinRover.ts
 *  ---------------------------------------------------------------------------
 *  THE GOBLIN ROVER.
 *
 *  Low gravity is the whole design. At 1.62 m/s² a conventional car model
 *  feels broken: the wheels unload on every crest, the tyres never find grip,
 *  and the thing flips. So the rover is built around that fact rather than
 *  against it —
 *
 *    · suspension is a raycast spring-damper (F = −kx − cv) with a hard
 *      anti-float clamp, so the chassis is pressed onto the ground by the
 *      SPRINGS rather than by its own weight;
 *    · the tyre model is Pacejka's Magic Formula, whose peak slip angle is
 *      load-dependent — at 1/6 g the peak arrives early, which is exactly
 *      what makes crater-rim powersliding feel correct instead of icy;
 *    · the hover variant swaps the tyre for a lateral damper and keeps the
 *      same solver, because a repulsor is a spring that never touches.
 *
 *  Pure. 120 Hz fixed step. No DOM, no clock, no RNG.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised } from "./fidelity";

export type Vec3 = [number, number, number];
export const TICK_HZ = 120;
export const DT = 1 / TICK_HZ;
export const MOON_G = -1.62;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ───────────────────────────────────────────────────────────── contracts */

export type Drivetrain = "WHEELED" | "HOVER";

export interface RoverChassis {
  mass: number;              // kg
  /** half-extents: [length, height, width] in metres */
  half: Vec3;
  /** yaw inertia, kg·m² — derived from the hull if omitted */
  inertiaY: number;
  drivetrain: Drivetrain;

  /* suspension */
  springK: number;           // N/m
  damperC: number;           // N·s/m
  restLength: number;        // m
  maxTravel: number;         // m

  /* tyre — Pacejka coefficients */
  pacejkaB: number;          // stiffness
  pacejkaC: number;          // shape
  pacejkaD: number;          // peak (scaled by normal load)
  pacejkaE: number;          // curvature
  rollingResistance: number;

  /* drive */
  motorTorque: number;       // N·m at the wheel
  brakeTorque: number;
  maxSteerDeg: number;
  /** steering authority falls off with speed or the rover is undriveable */
  steerFalloff: number;

  /* boost */
  boostThrust: number;       // N
  boostCapacity: number;     // seconds of continuous fire
  boostRecharge: number;     // seconds of capacity per second, when solar-lit
  downforce: number;         // N at 10 m/s, scaled quadratically
}

export const CHASSIS: Readonly<Record<string, RoverChassis>> = Object.freeze({
  SCRAP_STRIDER: {
    mass: 640, half: [1.55, 0.42, 1.0], inertiaY: 520, drivetrain: "WHEELED",
    springK: 34000, damperC: 3400, restLength: 0.52, maxTravel: 0.40,
    pacejkaB: 9.2, pacejkaC: 1.62, pacejkaD: 1.05, pacejkaE: 0.96,
    rollingResistance: 14,
    motorTorque: 2600, brakeTorque: 4200, maxSteerDeg: 34, steerFalloff: 0.055,
    boostThrust: 7600, boostCapacity: 3.4, boostRecharge: 0.42, downforce: 480,
  },
  CHROMA_BUGGY: {
    mass: 410, half: [1.3, 0.34, 0.86], inertiaY: 300, drivetrain: "WHEELED",
    springK: 24000, damperC: 2100, restLength: 0.44, maxTravel: 0.46,
    pacejkaB: 7.4, pacejkaC: 1.48, pacejkaD: 0.86, pacejkaE: 1.02,
    rollingResistance: 9,
    motorTorque: 2050, brakeTorque: 3000, maxSteerDeg: 42, steerFalloff: 0.042,
    boostThrust: 6400, boostCapacity: 4.6, boostRecharge: 0.58, downforce: 260,
  },
  REPULSOR_SLED: {
    mass: 520, half: [1.7, 0.3, 1.05], inertiaY: 470, drivetrain: "HOVER",
    springK: 46000, damperC: 5200, restLength: 1.15, maxTravel: 0.95,
    // a repulsor has no contact patch: low peak, very high curvature → drift
    pacejkaB: 4.1, pacejkaC: 1.3, pacejkaD: 0.44, pacejkaE: 1.3,
    rollingResistance: 2,
    motorTorque: 2900, brakeTorque: 1600, maxSteerDeg: 30, steerFalloff: 0.03,
    boostThrust: 9100, boostCapacity: 3.0, boostRecharge: 0.5, downforce: 120,
  },
});

export interface WheelState {
  /** chassis-local mount point */
  local: Vec3;
  /** 0 = fully extended (airborne), 1 = fully compressed */
  compression: number;
  grounded: boolean;
  /** last frame's spring length, for the damper term */
  lastLength: number;
  /** degrees; the quantity Pacejka consumes */
  slipAngleDeg: number;
  /** longitudinal slip ratio */
  slipRatio: number;
  /** N */
  normalLoad: number;
  /** world contact point, for VFX and skid decals */
  contact: Vec3;
  steer: boolean;
  drive: boolean;
}

export interface RoverState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  yawRate: number;
  /** visual only — the chassis leans into its own suspension */
  pitch: number;
  roll: number;
  wheels: WheelState[];
  boostFuel: number;
  boosting: boolean;
  airborne: boolean;
  /** 0..1, drives the FOV warp and the chromatic aberration */
  speedWarp: number;
  odometer: number;
  tick: number;
  occupied: boolean;
}

export interface RoverInput {
  throttle: number;   // −1 reverse … 1 forward
  steer: number;      // −1 left … 1 right
  handbrake: boolean;
  boost: boolean;
}

export interface Ground {
  height(x: number, z: number): number;
  /** 0 regolith · 1 cobbled road — roads grant grip AND speed */
  surface(x: number, z: number): number;
}

/* ═══════════════════════════════════════════════ 1 · THE TYRE MODEL ══ */

/**
 *  Pacejka's Magic Formula:   F = D·sin(C·atan(B·α − E·(B·α − atan(B·α))))
 *
 *  D scales with normal load, which is the term that makes low gravity
 *  interesting: a wheel that has just crested a rim carries almost no load,
 *  so its peak lateral force collapses and the back steps out. The player
 *  learns to weight the rover before turning without ever being told.
 */
export function pacejka(slipDeg: number, load: number, c: RoverChassis): number {
  const B = c.pacejkaB, C = c.pacejkaC, E = c.pacejkaE;
  const D = c.pacejkaD * load;
  const x = slipDeg * (Math.PI / 180) * B;
  return D * Math.sin(C * Math.atan(x - E * (x - Math.atan(x))));
}

/** Peak slip angle, for the HUD's grip arc. Found by sampling — it is
 *  cheap, exact enough, and avoids an analytic derivative we would then
 *  have to keep in sync with the formula above. */
export function peakSlipDeg(c: RoverChassis): number {
  let best = 0, bestF = 0;
  for (let a = 0; a <= 30; a += 0.25) {
    const f = pacejka(a, 1, c);
    if (f > bestF) { bestF = f; best = a; }
  }
  return best;
}

/* ═══════════════════════════════════════════ 2 · THE 120 Hz SOLVER ══ */

export function makeRover(chassis: RoverChassis, pos: Vec3, yaw = 0): RoverState {
  const [L, , W] = chassis.half;
  const mounts: Vec3[] = [
    [ L * 0.78, -chassis.half[1],  W * 0.92],
    [ L * 0.78, -chassis.half[1], -W * 0.92],
    [-L * 0.78, -chassis.half[1],  W * 0.92],
    [-L * 0.78, -chassis.half[1], -W * 0.92],
  ];
  return {
    pos: [...pos] as Vec3, vel: [0, 0, 0], yaw, yawRate: 0, pitch: 0, roll: 0,
    wheels: mounts.map((local, i) => ({
      local, compression: 0, grounded: false, lastLength: chassis.restLength,
      slipAngleDeg: 0, slipRatio: 0, normalLoad: 0, contact: [0, 0, 0],
      steer: i < 2, drive: true,
    })),
    boostFuel: chassis.boostCapacity, boosting: false, airborne: true,
    speedWarp: 0, odometer: 0, tick: 0, occupied: false,
  };
}

/**
 *  One tick. Forces accumulate in WORLD space; the tyre model works in
 *  chassis space. Semi-implicit Euler, which at 120 Hz is stable for spring
 *  constants up to ~60 kN/m — comfortably above everything in CHASSIS.
 */
export function stepRover(
  st: RoverState, input: RoverInput, c: RoverChassis,
  ground: Ground, fi: FidelityState, ticks = 1,
): RoverState {
  const n = normalised(fi);
  // Vtx buys suspension resolution: at Stage 1 the ground is a staircase and
  // we deliberately stiffen the damper so the rover does not pogo on steps.
  const damperScale = lerp(2.1, 1.0, clamp01(n.vtx * 1.6));

  const pos: Vec3 = [...st.pos];
  const vel: Vec3 = [...st.vel];
  let { yaw, yawRate, boostFuel, odometer, pitch, roll } = st;
  const wheels = st.wheels.map((w) => ({ ...w, local: [...w.local] as Vec3 }));

  for (let t = 0; t < ticks; t++) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    /** chassis basis: forward = +X local, right = +Z local */
    const fwd: Vec3 = [cy, 0, sy];
    const right: Vec3 = [-sy, 0, cy];

    const speed = Math.hypot(vel[0], vel[2]);
    const fwdSpeed = vel[0] * fwd[0] + vel[2] * fwd[2];
    const latSpeed = vel[0] * right[0] + vel[2] * right[2];

    /* ── steering authority falls off with speed ─────────────────── */
    const steerDeg = input.steer * c.maxSteerDeg / (1 + speed * c.steerFalloff);
    const steerRad = steerDeg * (Math.PI / 180);

    let fx = 0, fz = 0, fy = 0, torque = 0;
    let groundedCount = 0;
    let totalLoad = 0;

    /* ── per-wheel: suspension raycast + tyre ─────────────────────── */
    for (const w of wheels) {
      // mount point in world space
      const mx = pos[0] + w.local[0] * fwd[0] + w.local[2] * right[0];
      const mz = pos[2] + w.local[0] * fwd[2] + w.local[2] * right[2];
      const my = pos[1] + w.local[1];

      const gh = ground.height(mx, mz);
      const length = clamp(my - gh, 0, c.restLength + c.maxTravel);
      const grounded = length < c.restLength;

      if (!grounded) {
        w.grounded = false; w.compression = 0; w.normalLoad = 0;
        w.lastLength = length;
        w.contact = [mx, gh, mz];
        continue;
      }
      groundedCount++;

      /* F = −k·x − c·v  — the spring-damper, verbatim */
      const x = c.restLength - length;                     // compression, m
      const v = (length - w.lastLength) / DT;              // closing speed
      let force = c.springK * x - c.damperC * damperScale * v;
      // suspension can push but never pull
      force = Math.max(0, force);
      // hard bump-stop: beyond maxTravel the spring goes rigid
      if (x > c.maxTravel) force += (x - c.maxTravel) * c.springK * 6;

      w.lastLength = length;
      w.compression = clamp01(x / c.maxTravel);
      w.grounded = true;
      w.normalLoad = force;
      w.contact = [mx, gh, mz];
      totalLoad += force;

      fy += force;
      // suspension force applied off-centre pitches and rolls the hull
      torque += 0; // yaw unaffected by vertical force on a flat normal

      /* ── tyre forces ──────────────────────────────────────────── */
      const loadN = force / (c.mass * 9.81 * 0.25 + 1e-6);   // normalised ~1
      const surf = ground.surface(mx, mz);
      const grip = lerp(0.82, 1.28, surf);                   // roads grip more

      // lateral slip angle at this wheel, including yaw-induced velocity
      const wheelLat = latSpeed + yawRate * w.local[0];
      const wheelFwd = fwdSpeed - yawRate * w.local[2];
      const steerHere = w.steer ? steerRad : 0;
      const slipRad = Math.atan2(wheelLat, Math.abs(wheelFwd) + 0.9) - steerHere;
      const slipDeg = slipRad * (180 / Math.PI);
      w.slipAngleDeg = slipDeg;

      let lat = -pacejka(slipDeg, loadN, c) * grip * (c.mass * 0.25) * 9.81 * 0.17;

      // handbrake collapses rear grip — this is the drift button
      if (input.handbrake && !w.steer) lat *= 0.28;

      // longitudinal
      const drive = w.drive ? input.throttle * c.motorTorque : 0;
      const brake = input.handbrake && !w.steer ? c.brakeTorque * 0.55 : 0;
      const slipRatio = clamp((drive * 0.0004 - wheelFwd * 0.02) / (1 + Math.abs(wheelFwd)), -1, 1);
      w.slipRatio = slipRatio;
      let lon = drive * 0.42 * grip * clamp01(loadN)
              - Math.sign(wheelFwd) * (brake + c.rollingResistance * Math.abs(wheelFwd));

      // HOVER: no contact patch. Lateral force becomes a pure damper, which
      // is why a sled slides beautifully and corners badly.
      if (c.drivetrain === "HOVER") {
        lat = -wheelLat * 180 * grip;
        lon *= 0.86;
      }

      const dirX = fwd[0] * Math.cos(steerHere) + right[0] * Math.sin(steerHere);
      const dirZ = fwd[2] * Math.cos(steerHere) + right[2] * Math.sin(steerHere);
      const latX = -dirZ, latZ = dirX;

      fx += dirX * lon + latX * lat;
      fz += dirZ * lon + latZ * lat;
      // yaw torque: lever arm is the longitudinal mount offset
      torque += (latX * lat * right[0] + latZ * lat * right[2]) * w.local[0] * 1.0;
    }

    /* ── boost ───────────────────────────────────────────────────── */
    const wantBoost = input.boost && boostFuel > 0.02;
    if (wantBoost) {
      fx += fwd[0] * c.boostThrust;
      fz += fwd[2] * c.boostThrust;
      boostFuel = Math.max(0, boostFuel - DT);
    } else {
      // Lx is the solar flux: a dark planet recharges boosters slowly.
      boostFuel = Math.min(c.boostCapacity, boostFuel + c.boostRecharge * DT * (0.35 + n.lx * 0.65));
    }

    /* ── downforce keeps the rover planted at speed in 1/6 g ─────── */
    if (groundedCount > 0) fy -= c.downforce * (speed / 10) ** 2 * 0.01;

    /* ── integrate ───────────────────────────────────────────────── */
    vel[0] += (fx / c.mass) * DT;
    vel[2] += (fz / c.mass) * DT;
    vel[1] += (MOON_G + fy / c.mass) * DT;
    yawRate += (torque / c.inertiaY) * DT;
    yawRate *= 1 - clamp01(3.4 * DT);              // yaw damping
    yaw += yawRate * DT;

    pos[0] += vel[0] * DT;
    pos[1] += vel[1] * DT;
    pos[2] += vel[2] * DT;

    /* ── hull floor: never let the body intersect the ground ─────── */
    const bodyH = ground.height(pos[0], pos[2]) + c.restLength * 0.42 + c.half[1];
    if (pos[1] < bodyH) { pos[1] = bodyH; if (vel[1] < 0) vel[1] = -vel[1] * 0.12; }

    odometer += Math.hypot(vel[0], vel[2]) * DT;

    /* ── cosmetic attitude from suspension asymmetry ─────────────── */
    const fL = (wheels[0].compression + wheels[1].compression) * 0.5;
    const rL = (wheels[2].compression + wheels[3].compression) * 0.5;
    const lL = (wheels[0].compression + wheels[2].compression) * 0.5;
    const rR = (wheels[1].compression + wheels[3].compression) * 0.5;
    pitch = lerp(pitch, (rL - fL) * 0.42, clamp01(9 * DT));
    roll = lerp(roll, (rR - lL) * 0.38, clamp01(9 * DT));

    st = { ...st, airborne: groundedCount === 0, boosting: wantBoost };
    void totalLoad;
  }

  const speed = Math.hypot(vel[0], vel[2]);
  return {
    pos, vel, yaw, yawRate, pitch, roll, wheels,
    boostFuel, boosting: st.boosting, airborne: st.airborne,
    // the FOV warp: 60° → 92°, driven by speed and hard-biased by boost
    speedWarp: clamp01(speed / 34 + (st.boosting ? 0.22 : 0)),
    odometer, tick: st.tick + ticks, occupied: st.occupied,
  };
}

/* ═══════════════════════════════════════════ 3 · CAMERA & MOUNTING ══ */

export interface ChaseCamera {
  pos: Vec3;
  look: Vec3;
  fovDeg: number;
  /** 0 first-person (on foot) … 1 full chase */
  blend: number;
}

export const CAM = {
  armLength: 7.4,
  armHeight: 2.9,
  stiffness: 7.5,
  fovBase: 60,
  fovMax: 92,
};

/**
 *  Spring-arm chase camera. Critically damped toward the ideal pose, with
 *  the arm shortened by the rover's own speed so acceleration reads as the
 *  world rushing past rather than the camera falling behind.
 */
export function stepChaseCamera(
  cam: ChaseCamera, r: RoverState, mounted: number, dt: number,
): ChaseCamera {
  const speed = Math.hypot(r.vel[0], r.vel[2]);
  const back = CAM.armLength * (1 - r.speedWarp * 0.18);
  const cy = Math.cos(r.yaw), sy = Math.sin(r.yaw);
  const ideal: Vec3 = [
    r.pos[0] - cy * back,
    r.pos[1] + CAM.armHeight + r.speedWarp * 0.6,
    r.pos[2] - sy * back,
  ];
  const k = 1 - Math.exp(-CAM.stiffness * dt);
  const pos: Vec3 = [
    lerp(cam.pos[0], ideal[0], k),
    lerp(cam.pos[1], ideal[1], k),
    lerp(cam.pos[2], ideal[2], k),
  ];
  // look slightly ahead of the rover so corners open up before you reach them
  const lead = 2.2 + speed * 0.14;
  const look: Vec3 = [r.pos[0] + cy * lead, r.pos[1] + 0.6, r.pos[2] + sy * lead];
  const fovDeg = lerp(CAM.fovBase, CAM.fovMax, r.speedWarp);
  return { pos, look, fovDeg, blend: mounted };
}

export interface MountState {
  mounted: boolean;
  /** 0 on foot … 1 fully seated; the camera blends across this */
  blend: number;
  nearVehicle: boolean;
  promptDistance: number;
}

export const MOUNT_RADIUS = 3.4;

/** `E` near the rover. The blend is a C¹ curve so the camera never snaps. */
export function stepMount(
  m: MountState, playerPos: Vec3, rover: RoverState, pressedE: boolean, dt: number,
): MountState {
  const d = Math.hypot(playerPos[0] - rover.pos[0], playerPos[2] - rover.pos[2]);
  const near = d <= MOUNT_RADIUS;
  let mounted = m.mounted;
  if (pressedE && (near || mounted)) mounted = !mounted;
  const target = mounted ? 1 : 0;
  const k = 1 - Math.exp(-6.2 * dt);
  const raw = m.blend + (target - m.blend) * k;
  return { mounted, blend: raw * raw * (3 - 2 * raw), nearVehicle: near, promptDistance: d };
}

/* ═══════════════════════════════════════════ 4 · THRUSTER PLUMES ══ */

export interface ThrusterMote {
  p: Vec3; v: Vec3; life: number; size: number; hue: number;
}

/** Boost fires the same pixel cubes the chimneys do — the rover is visibly
 *  burning the planet's own resolution to go faster, which is a joke the
 *  art direction tells without a line of dialogue. */
export function emitThrusterMotes(
  out: ThrusterMote[], r: RoverState, c: RoverChassis, dt: number, rnd: () => number,
): void {
  if (!r.boosting) return;
  const cy = Math.cos(r.yaw), sy = Math.sin(r.yaw);
  const count = Math.min(14, Math.ceil(34 * dt));
  for (let i = 0; i < count; i++) {
    const side = (rnd() - 0.5) * c.half[2] * 1.5;
    out.push({
      p: [r.pos[0] - cy * c.half[0] - sy * side, r.pos[1] - 0.1, r.pos[2] - sy * c.half[0] + cy * side],
      v: [-cy * (9 + rnd() * 7) - r.vel[0] * 0.2, 1.2 + rnd() * 2, -sy * (9 + rnd() * 7) - r.vel[2] * 0.2],
      life: 0, size: 0.16 + rnd() * 0.22, hue: rnd(),
    });
  }
}

export function stepThrusterMotes(motes: ThrusterMote[], dt: number): ThrusterMote[] {
  const out: ThrusterMote[] = [];
  for (const m of motes) {
    m.life += dt / 0.55;
    if (m.life >= 1) continue;
    m.v[1] += MOON_G * dt * 0.4;
    m.p[0] += m.v[0] * dt; m.p[1] += m.v[1] * dt; m.p[2] += m.v[2] * dt;
    out.push(m);
  }
  return out;
}

export function roverTelemetry(r: RoverState, c: RoverChassis) {
  const speed = Math.hypot(r.vel[0], r.vel[2]);
  const grounded = r.wheels.filter((w) => w.grounded).length;
  const maxSlip = Math.max(...r.wheels.map((w) => Math.abs(w.slipAngleDeg)));
  return {
    speedMs: speed,
    speedKph: speed * 3.6,
    grounded,
    airborne: r.airborne,
    maxSlipDeg: maxSlip,
    peakSlipDeg: peakSlipDeg(c),
    drifting: maxSlip > peakSlipDeg(c) * 1.25 && speed > 5,
    boostFuel: r.boostFuel,
    boostPct: r.boostFuel / c.boostCapacity,
    fovDeg: lerp(CAM.fovBase, CAM.fovMax, r.speedWarp),
    odometerM: r.odometer,
    loadN: r.wheels.reduce((a, w) => a + w.normalLoad, 0),
  };
}
