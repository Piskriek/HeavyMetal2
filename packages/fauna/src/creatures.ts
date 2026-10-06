// Individual animals near the viewer, materialised from the density field (the same for everyone standing there),
// and their behaviour: boids plus a pull towards food, water or away from threats (from the SetMix Arena drop).
import { FAUNA, densityAt, type DensityField, type FaunaId, type Gait } from "./field";
import { clamp, clamp01, h2, smooth } from "./util";

/* ══════════════════════════ 3 · MATERIALISATION (POISSON-DISK) ══ */

export const MATERIALISE_RADIUS_M = 300;

export interface Creature {
  /** deterministic from (cell, index) — stable across frames and machines */
  uid: number;
  id: FaunaId;
  x: number; z: number; y: number;
  vx: number; vz: number;
  heading: number;
  /** 0..1 phase of the gait cycle */
  gaitPhase: number;
  gait: Gait;
  state: Behaviour;
  /** 0..1 */
  energy: number;
  age: number;
  variant: number;
  /** 0..1 — fades in over the last 30 m of the radius, so nothing pops */
  lod: number;
}

export type Behaviour = "GRAZE" | "DRINK" | "SLEEP" | "FLEE" | "FLOCK" | "WANDER";

/**
 *  Poisson-disk-ish sampling on a jittered grid. True dart-throwing needs
 *  rejection loops and global state; a jittered lattice with a minimum
 *  spacing derived from density gives the same visual result, is O(1) per
 *  candidate, and — critically — is DETERMINISTIC from the cell coordinate,
 *  so two players standing side by side see the same individuals.
 */
export function materialise(
  f: DensityField, id: FaunaId, px: number, pz: number,
  heightAt: (x: number, z: number) => number, radiusM = MATERIALISE_RADIUS_M,
): Creature[] {
  const s = FAUNA[id];
  const out: Creature[] = [];
  // spacing from local density: more animals ⇒ tighter lattice
  const local = densityAt(f, id, px, pz);
  if (local < 0.02) return out;
  const perM2 = local / (f.cellM * f.cellM);
  const spacing = clamp(1 / Math.sqrt(Math.max(perM2, 1e-9)), s.bodyM * 2.2, 140);

  const i0 = Math.floor((px - radiusM) / spacing), i1 = Math.ceil((px + radiusM) / spacing);
  const j0 = Math.floor((pz - radiusM) / spacing), j1 = Math.ceil((pz + radiusM) / spacing);

  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const hx = h2(i, j, id.length * 977);
      const hz = h2(i + 31, j - 17, id.length * 613);
      const hk = h2(i * 7, j * 13, 4242);
      const x = (i + hx) * spacing;
      const z = (j + hz) * spacing;
      const d = Math.hypot(x - px, z - pz);
      if (d > radiusM) continue;

      // rejection against the LOCAL field value: clumps form naturally where
      // the macroscopic sim says the herd actually is
      const dens = densityAt(f, id, x, z);
      if (dens < 0.02 || hk > clamp01(dens / Math.max(0.05, s.K * 0.25)) + 0.12) continue;

      out.push({
        uid: (i * 73856093) ^ (j * 19349663) ^ (id.length * 83492791),
        id, x, z, y: heightAt(x, z),
        vx: 0, vz: 0,
        heading: h2(i, j, 99) * 6.283,
        gaitPhase: h2(i, j, 7),
        gait: s.legs === 0 ? "GLIDE" : "WALK",
        state: "WANDER",
        energy: 0.5 + h2(i, j, 5) * 0.5,
        age: h2(i, j, 11),
        variant: h2(i, j, 3),
        // the last 30 m is a scale fade — materialisation you cannot see
        lod: smooth((radiusM - d) / 30),
      });
    }
  return out;
}

/* ═══════════════════════════════════ 4 · BEHAVIOUR & BOID STEERING ══ */

export interface AgentCtx {
  /** 0..1 */
  biomass: (x: number, z: number) => number;
  water: (x: number, z: number) => number;
  heightAt: (x: number, z: number) => number;
  /** 0 = midnight, 0.5 = noon */
  timeOfDay: number;
  /** loud things that scare fauna — rovers, explosions, the player sprinting */
  threats: readonly { x: number; z: number; loudness: number }[];
  dt: number;
}

export function decideBehaviour(c: Creature, ctx: AgentCtx): Behaviour {
  const s = FAUNA[c.id];
  for (const t of ctx.threats) {
    const d = Math.hypot(c.x - t.x, c.z - t.z);
    if (d < s.fleeRadiusM * (0.5 + t.loudness)) return "FLEE";
  }
  const day = Math.sin(ctx.timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
  const awake = s.nocturnal ? 1 - day : day;
  if (awake < 0.25 && c.energy > 0.35) return "SLEEP";
  if (c.energy < 0.4 && ctx.water(c.x, c.z) > 0.5) return "DRINK";
  if (c.energy < 0.75 && ctx.biomass(c.x, c.z) > 0.3) return "GRAZE";
  if (s.cohesion > 1.2) return "FLOCK";
  return "WANDER";
}

/**
 *  Boids in 3D, plus a gradient-ascent term toward whatever the creature
 *  currently wants. The classic three rules give you a flock; the gradient
 *  term is what makes it an ECOSYSTEM — the flock drifts toward food, and
 *  food is produced by the flora cycle, which is driven by the water cycle,
 *  which is driven by the player's Lx and Aq machines.
 */
export function steerCreature(
  c: Creature, neighbours: readonly Creature[], ctx: AgentCtx,
): Creature {
  const s = FAUNA[c.id];
  const state = decideBehaviour(c, ctx);
  let ax = 0, az = 0;

  // ── boids ──────────────────────────────────────────────────────────
  let cx = 0, cz = 0, ax2 = 0, az2 = 0, n = 0;
  for (const o of neighbours) {
    if (o.uid === c.uid) continue;
    const dx = o.x - c.x, dz = o.z - c.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 900 || d2 < 1e-5) continue;
    const d = Math.sqrt(d2);
    cx += o.x; cz += o.z;
    ax2 += o.vx; az2 += o.vz;
    const push = (s.bodyM * 2.2 - d);
    if (push > 0) { ax -= (dx / d) * push * s.separation; az -= (dz / d) * push * s.separation; }
    n++;
  }
  if (n > 0) {
    ax += ((cx / n - c.x)) * 0.02 * s.cohesion;
    az += ((cz / n - c.z)) * 0.02 * s.cohesion;
    ax += (ax2 / n - c.vx) * 0.6 * s.alignment;
    az += (az2 / n - c.vz) * 0.6 * s.alignment;
  }

  // ── intent: gradient ascent on whatever it wants ───────────────────
  const field = state === "DRINK" ? ctx.water : ctx.biomass;
  if (state === "GRAZE" || state === "DRINK") {
    const e = 6;
    ax += (field(c.x + e, c.z) - field(c.x - e, c.z)) * 24;
    az += (field(c.x, c.z + e) - field(c.x, c.z - e)) * 24;
  } else if (state === "FLEE") {
    for (const t of ctx.threats) {
      const dx = c.x - t.x, dz = c.z - t.z;
      const d = Math.hypot(dx, dz) || 1;
      const w = (1 + t.loudness) * 90 / d;
      ax += (dx / d) * w; az += (dz / d) * w;
    }
  } else if (state === "WANDER") {
    const w = h2(Math.floor(c.x * 0.02), Math.floor(c.z * 0.02), c.uid & 0xffff) * 6.283;
    ax += Math.cos(w) * 1.4; az += Math.sin(w) * 1.4;
  }

  // ── integrate ──────────────────────────────────────────────────────
  const speed = s.speedMs * (state === "FLEE" ? 1.6 : state === "SLEEP" ? 0 : state === "GRAZE" ? 0.28 : 0.7);
  let vx = c.vx + ax * ctx.dt;
  let vz = c.vz + az * ctx.dt;
  const v = Math.hypot(vx, vz);
  if (v > speed) { vx = (vx / v) * speed; vz = (vz / v) * speed; }
  vx *= 0.96; vz *= 0.96;

  const x = c.x + vx * ctx.dt;
  const z = c.z + vz * ctx.dt;
  const sp = Math.hypot(vx, vz);

  const gait: Gait =
    s.legs === 0 ? (FAUNA[c.id].aqFloor > 0.4 ? "SWIM" : "GLIDE")
      : sp > s.speedMs * 0.75 ? "GALLOP" : sp > s.speedMs * 0.3 ? "TROT" : "WALK";

  // energy: grazing restores, fleeing burns
  const dE = state === "GRAZE" ? 0.08 : state === "DRINK" ? 0.05
    : state === "SLEEP" ? 0.02 : state === "FLEE" ? -0.12 : -0.02;

  return {
    ...c, x, z, vx, vz,
    y: ctx.heightAt(x, z),
    heading: sp > 0.05 ? Math.atan2(vz, vx) : c.heading,
    gaitPhase: (c.gaitPhase + (sp / Math.max(0.1, s.legLenM)) * ctx.dt * 0.36) % 1,
    gait, state,
    energy: clamp01(c.energy + dE * ctx.dt),
    age: c.age + ctx.dt / 3600,
  };
}
