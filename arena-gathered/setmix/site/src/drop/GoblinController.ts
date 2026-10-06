/* ============================================================================
 *  packages/goblin-controller/src/GoblinController.ts
 *  ---------------------------------------------------------------------------
 *  THE AVATAR THAT GETS BETTER AT MOVING.
 *
 *  Most games ship one controller and hide its limitations. SetMix ships one
 *  controller whose limitations ARE the progression: at Stage 1 you genuinely
 *  cannot walk up a slope, because the world has no slopes — it has steps.
 *  By Stage 4 you can swim in an ocean you created.
 *
 *  Every tier below is the same integrator with different coefficients. There
 *  is no "if (stage === 1)" branch in the movement maths, only continuous
 *  blends, because a discontinuity in the controller would be felt as a
 *  cheat the moment a metric ticked over.
 *
 *  Pure. Fixed-step at 120 Hz. No DOM, no clock, no RNG.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised, stageOf, fidelityIndex } from "./fidelity";

export type Vec3 = [number, number, number];

export const MOON_G = -1.62;   // m/s² — the first jump is comically floaty
export const TICK_HZ = 120;
export const DT = 1 / TICK_HZ;

/* ───────────────────────────────────────────────────────────── contracts */

export interface GoblinInput {
  /** −1..1 strafe, −1..1 forward */
  move: [number, number];
  /** yaw in radians */
  yaw: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  /** held, for swimming ascent */
  ascend: boolean;
}

export interface GoblinState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  grounded: boolean;
  /** metres of surface normal deviation, 0 = flat */
  slopeDeg: number;
  submersion: number;      // 0 dry … 1 fully underwater
  stamina: number;         // 0..1
  coyote: number;          // ticks of grace after leaving ground
  jumpBuffer: number;      // ticks of early-jump forgiveness
  mode: LocomotionMode;
  tick: number;
  /** diagnostic: which tier the maths resolved to this tick */
  tier: MoveTier;
}

export type LocomotionMode = "GROUND" | "AIR" | "CLAMBER" | "SWIM" | "DIVE";
export type MoveTier = 1 | 2 | 3 | 4;

export interface WorldProbe {
  /** surface height at (x,z) */
  height(x: number, z: number): number;
  /** sea level; −Infinity when Aq = 0 */
  seaLevel: number;
  /** horizontal wind, used by the cape and by swim drift */
  wind: [number, number];
}

/* ─────────────────────────────── the ladder, as data not as branches ──── */

export interface MoveProfile {
  tier: MoveTier;
  /** the world is quantised to this; 0 means continuous */
  posQuantum: number;
  maxSlopeDeg: number;
  /** m/s */
  walkSpeed: number;
  sprintMult: number;
  /** m/s² — how fast you reach walkSpeed. Low = skating, high = snappy */
  accel: number;
  friction: number;
  airControl: number;
  jumpImpulse: number;
  /** 0 = snap to grid (stop-motion), 1 = fully continuous */
  continuity: number;
  stepHeight: number;
  canSwim: boolean;
  buoyancy: number;
  waterDrag: number;
  /** animation sampling rate — S1 is a 2-frame cycle at 8 fps */
  animFps: number;
  animFrames: number;
}

export const MOVE_TIERS: Readonly<Record<MoveTier, MoveProfile>> = Object.freeze({
  1: { tier: 1, posQuantum: 0.25, maxSlopeDeg: 0,  walkSpeed: 2.6, sprintMult: 1.0,
       accel: 40, friction: 14, airControl: 0.0, jumpImpulse: 4.6, continuity: 0,
       stepHeight: 1.0, canSwim: false, buoyancy: 0, waterDrag: 0, animFps: 8,  animFrames: 2 },
  2: { tier: 2, posQuantum: 0.0,  maxSlopeDeg: 28, walkSpeed: 3.4, sprintMult: 1.25,
       accel: 24, friction: 9,  airControl: 0.18, jumpImpulse: 5.0, continuity: 0.45,
       stepHeight: 0.6, canSwim: false, buoyancy: 0, waterDrag: 0, animFps: 15, animFrames: 5 },
  3: { tier: 3, posQuantum: 0.0,  maxSlopeDeg: 46, walkSpeed: 4.1, sprintMult: 1.75,
       accel: 18, friction: 7,  airControl: 0.38, jumpImpulse: 5.4, continuity: 1,
       stepHeight: 0.45, canSwim: false, buoyancy: 0, waterDrag: 0, animFps: 30, animFrames: 12 },
  4: { tier: 4, posQuantum: 0.0,  maxSlopeDeg: 54, walkSpeed: 4.4, sprintMult: 1.9,
       accel: 17, friction: 6.4, airControl: 0.42, jumpImpulse: 5.6, continuity: 1,
       stepHeight: 0.4, canSwim: true, buoyancy: 13.5, waterDrag: 3.1, animFps: 60, animFrames: 24 },
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (u: number) => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };

/** Vtx picks the tier; Aq unlocks swimming. The blend between adjacent tiers
 *  is continuous so a metric ticking over never produces a felt discontinuity. */
export function profileFor(s: FidelityState): MoveProfile {
  const n = normalised(s);
  const raw = 1 + n.vtx * 3 * (0.55 + n.aq * 0.45) + n.aq * 0.9;
  const lo = clamp(Math.floor(raw), 1, 4) as MoveTier;
  const hi = clamp(lo + 1, 1, 4) as MoveTier;
  const f = smooth(raw - lo);
  const A = MOVE_TIERS[lo], B = MOVE_TIERS[hi];
  const L = (k: keyof MoveProfile) => lerp(A[k] as number, B[k] as number, f);
  return {
    tier: f > 0.5 ? hi : lo,
    posQuantum: A.posQuantum * (1 - f),     // the grid dissolves, it never snaps off
    maxSlopeDeg: L("maxSlopeDeg"),
    walkSpeed: L("walkSpeed"),
    sprintMult: L("sprintMult"),
    accel: L("accel"),
    friction: L("friction"),
    airControl: L("airControl"),
    jumpImpulse: L("jumpImpulse"),
    continuity: L("continuity"),
    stepHeight: L("stepHeight"),
    canSwim: B.canSwim && f > 0.4,
    buoyancy: L("buoyancy"),
    waterDrag: L("waterDrag"),
    animFps: L("animFps"),
    animFrames: Math.round(L("animFrames")),
  };
}

/* ══════════════════════════════════════════════════════ THE INTEGRATOR ══ */

export function initialGoblin(pos: Vec3 = [0, 0, 0]): GoblinState {
  return {
    pos, vel: [0, 0, 0], yaw: 0, grounded: false, slopeDeg: 0, submersion: 0,
    stamina: 1, coyote: 0, jumpBuffer: 0, mode: "AIR", tick: 0, tier: 1,
  };
}

/**
 *  One 120 Hz tick. Semi-implicit Euler: integrate velocity first, then
 *  position. Deterministic, stable at this step size, and — crucially —
 *  reversible enough that the command journal can replay a session exactly.
 */
export function stepGoblin(
  st: GoblinState,
  input: GoblinInput,
  world: WorldProbe,
  fi: FidelityState,
  ticks = 1,
): GoblinState {
  const p = profileFor(fi);
  let { pos, vel, grounded, coyote, jumpBuffer, stamina } = {
    pos: [...st.pos] as Vec3, vel: [...st.vel] as Vec3,
    grounded: st.grounded, coyote: st.coyote,
    jumpBuffer: st.jumpBuffer, stamina: st.stamina,
  };

  for (let i = 0; i < ticks; i++) {
    const sea = world.seaLevel;
    const submersion = sea > -1e8
      ? clamp((sea - pos[1]) / 1.8, 0, 1)
      : 0;
    const swimming = p.canSwim && submersion > 0.62;

    /* ── slope from a central difference of the heightfield ─────────── */
    const e = 0.4;
    const dx = world.height(pos[0] + e, pos[2]) - world.height(pos[0] - e, pos[2]);
    const dz = world.height(pos[0], pos[2] + e) - world.height(pos[0], pos[2] - e);
    const slope = Math.atan(Math.hypot(dx, dz) / (2 * e)) * (180 / Math.PI);

    /* ── desired horizontal velocity ────────────────────────────────── */
    const cy = Math.cos(input.yaw), sy = Math.sin(input.yaw);
    let wishX = input.move[0] * cy - input.move[1] * sy;
    let wishZ = input.move[0] * sy + input.move[1] * cy;
    const wl = Math.hypot(wishX, wishZ);
    if (wl > 1) { wishX /= wl; wishZ /= wl; }

    const sprinting = input.sprint && stamina > 0.05 && !swimming && grounded;
    const speed = p.walkSpeed * (sprinting ? p.sprintMult : 1) * (input.crouch ? 0.45 : 1);
    stamina = clamp(stamina + (sprinting ? -0.22 : 0.16) * DT, 0, 1);

    // Slope-dependent friction & speed (tier 3+). Below that the world has
    // no slopes to speak of, so the term quietly contributes nothing.
    const slopePenalty = 1 - clamp((slope - p.maxSlopeDeg * 0.4) / 60, 0, 0.55) * p.continuity;
    const target = speed * slopePenalty;

    if (swimming) {
      /* ── tier 4 · swim ───────────────────────────────────────────── */
      const drag = p.waterDrag;
      vel[0] += (wishX * target * 0.72 - vel[0]) * clamp(p.accel * 0.45 * DT, 0, 1);
      vel[2] += (wishZ * target * 0.72 - vel[2]) * clamp(p.accel * 0.45 * DT, 0, 1);
      // Archimedes: upthrust proportional to displaced volume (= submersion)
      const up = p.buoyancy * submersion + (input.ascend ? 6.5 : 0) - (input.crouch ? 7.0 : 0);
      vel[1] += (MOON_G + up) * DT;
      vel[0] -= vel[0] * drag * DT;
      vel[1] -= vel[1] * drag * DT;
      vel[2] -= vel[2] * drag * DT;
      // currents: the wind field drives surface drift, halved below the surface
      vel[0] += world.wind[0] * 0.04 * (1 - submersion * 0.5) * DT;
      vel[2] += world.wind[1] * 0.04 * (1 - submersion * 0.5) * DT;
      grounded = false;
    } else {
      /* ── ground / air ────────────────────────────────────────────── */
      const control = grounded ? 1 : p.airControl;
      const a = p.accel * control;
      vel[0] += (wishX * target - vel[0]) * clamp(a * DT, 0, 1);
      vel[2] += (wishZ * target - vel[2]) * clamp(a * DT, 0, 1);
      if (grounded && wl < 0.01) {
        const f = clamp(p.friction * DT, 0, 1);
        vel[0] -= vel[0] * f;
        vel[2] -= vel[2] * f;
      }
      vel[1] += MOON_G * DT * (1 - submersion * 0.55);
    }

    /* ── jump, with coyote time and input buffering ─────────────────── */
    if (input.jump) jumpBuffer = 8; else jumpBuffer = Math.max(0, jumpBuffer - 1);
    coyote = grounded ? 7 : Math.max(0, coyote - 1);
    if (jumpBuffer > 0 && (grounded || coyote > 0) && !swimming) {
      vel[1] = p.jumpImpulse;
      grounded = false; coyote = 0; jumpBuffer = 0;
    }

    /* ── integrate ──────────────────────────────────────────────────── */
    pos[0] += vel[0] * DT;
    pos[1] += vel[1] * DT;
    pos[2] += vel[2] * DT;

    /* ── collide against the heightfield ────────────────────────────── */
    const gy = world.height(pos[0], pos[2]);

    // TIER 1 CLAMBER: the world is a stack of boxes. You cannot walk up a
    // 28° ramp because there is no ramp — there is a 1 m wall. If the step
    // is within stepHeight you are teleported up it (that IS clambering);
    // otherwise you are stopped dead, which is the authentic Stage-1 feel.
    const rise = gy - pos[1];
    if (rise > 0) {
      if (rise <= p.stepHeight || p.continuity > 0.5) {
        pos[1] = gy;
        if (vel[1] < 0) vel[1] = 0;
        grounded = true;
      } else {
        // blocked: undo the horizontal move, keep the vertical
        pos[0] -= vel[0] * DT;
        pos[2] -= vel[2] * DT;
        vel[0] = 0; vel[2] = 0;
        grounded = world.height(pos[0], pos[2]) >= pos[1] - 0.02;
      }
    } else if (pos[1] - gy < 0.02) {
      pos[1] = gy;
      if (vel[1] < 0) vel[1] = 0;
      grounded = true;
    } else {
      grounded = false;
    }

    /* ── POSITION QUANTISATION — the Stage-1 signature ──────────────── *
     *  Objects do not roll, they snap. The quantum fades to zero as Vtx
     *  rises, so the world does not "unlock" smooth movement: it dissolves
     *  into it over about forty minutes of play. */
    if (p.posQuantum > 0.001) {
      const q = p.posQuantum;
      const snap = (v: number) => Math.round(v / q) * q;
      const blend = 1 - p.continuity;
      pos[0] = lerp(pos[0], snap(pos[0]), blend);
      pos[1] = lerp(pos[1], snap(pos[1]), blend);
      pos[2] = lerp(pos[2], snap(pos[2]), blend);
    }

    st = { ...st, submersion, slopeDeg: slope };
  }

  const sub = st.submersion;
  const mode: LocomotionMode =
    p.canSwim && sub > 0.62 ? (sub > 0.95 ? "DIVE" : "SWIM")
      : !grounded ? "AIR"
      : p.continuity < 0.5 && st.slopeDeg > 12 ? "CLAMBER"
      : "GROUND";

  return {
    pos, vel, yaw: input.yaw, grounded,
    slopeDeg: st.slopeDeg, submersion: sub, stamina,
    coyote, jumpBuffer, mode, tick: st.tick + ticks, tier: p.tier,
  };
}

/** Diagnostics the HUD and the design doc both read. */
export function goblinTelemetry(st: GoblinState, fi: FidelityState) {
  const p = profileFor(fi);
  const speed = Math.hypot(st.vel[0], st.vel[2]);
  return {
    stage: stageOf(fidelityIndex(fi)),
    tier: p.tier,
    speed,
    vertical: st.vel[1],
    mode: st.mode,
    slopeDeg: st.slopeDeg,
    maxSlopeDeg: p.maxSlopeDeg,
    quantum: p.posQuantum,
    continuity: p.continuity,
    animFps: p.animFps,
    animFrames: p.animFrames,
    canSwim: p.canSwim,
    submersion: st.submersion,
    stamina: st.stamina,
    /** triangle budget of the avatar itself, S1 48 → S6 48 000 */
    triBudget: Math.round(48 * Math.pow(1000, normalised(fi).vtx)),
  };
}
