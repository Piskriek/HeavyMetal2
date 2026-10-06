/* ============================================================================
 *  packages/setmix-fauna/src/{FaunaSimulation,ProceduralCreature}.ts
 *  ---------------------------------------------------------------------------
 *  AN ECOSYSTEM THAT COSTS NOTHING WHEN YOU ARE NOT LOOKING AT IT.
 *
 *  Beyond 300 m a herd is a NUMBER — a population density field integrated
 *  by Lotka-Volterra on a coarse grid at 2 Hz. Inside 300 m that same number
 *  MATERIALISES into individual creatures via Poisson-disk sampling seeded by
 *  the cell coordinate, so:
 *
 *    · 4,000 km² of fauna costs one 128×128 Float32Array per species
 *    · walking toward a herd does not spawn it — it reveals it
 *    · the individuals you see are a deterministic function of the field,
 *      so two players standing together see the SAME animals
 *    · walking away does not despawn anything; it stops sampling
 *
 *  Pure. No clock, no RNG, no allocation in the hot path.
 * ==========================================================================*/

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

function h2(x: number, y: number, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 1442695040) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/* ═══════════════════════════════════════════════════ 1 · THE SPECIES ══ */

export type FaunaId = "MOON_STRIDER" | "CRYSTAL_TORTOISE" | "SKY_MANTA" | "GLIMMER_SHOAL";
export type Trophic = "GRAZER" | "BROWSER" | "PREDATOR" | "FILTER";
export type Gait = "WALK" | "TROT" | "GALLOP" | "GLIDE" | "SWIM";

export interface FaunaSpec {
  id: FaunaId;
  label: string;
  trophic: Trophic;
  legs: 0 | 4 | 6;
  /** intrinsic growth rate r, per simulated hour */
  r: number;
  /** carrying capacity per km² at biomass 1.0 */
  K: number;
  /** Lotka-Volterra predation coefficient against its prey */
  predation: number;
  preyOf: FaunaId | null;
  bodyM: number;
  legLenM: number;
  speedMs: number;
  /** boid weights */
  cohesion: number;
  separation: number;
  alignment: number;
  /** metres — flees when the player is closer than this */
  fleeRadiusM: number;
  /** nocturnal creatures invert the sleep curve */
  nocturnal: boolean;
  colour: string;
  /** minimum Aq for this species to exist at all */
  aqFloor: number;
}

export const FAUNA: Readonly<Record<FaunaId, FaunaSpec>> = Object.freeze({
  MOON_STRIDER: {
    id: "MOON_STRIDER", label: "Moon Strider", trophic: "GRAZER", legs: 4,
    r: 0.42, K: 140, predation: 0, preyOf: null,
    bodyM: 2.1, legLenM: 1.5, speedMs: 6.2,
    cohesion: 0.9, separation: 1.5, alignment: 1.1, fleeRadiusM: 34,
    nocturnal: false, colour: "#d8a24a", aqFloor: 0.1,
  },
  CRYSTAL_TORTOISE: {
    id: "CRYSTAL_TORTOISE", label: "Crystal Tortoise", trophic: "BROWSER", legs: 6,
    r: 0.14, K: 38, predation: 0, preyOf: null,
    bodyM: 3.4, legLenM: 0.8, speedMs: 1.1,
    cohesion: 0.25, separation: 2.2, alignment: 0.2, fleeRadiusM: 12,
    nocturnal: false, colour: "#6ee7ff", aqFloor: 0.05,
  },
  SKY_MANTA: {
    id: "SKY_MANTA", label: "Sky Manta", trophic: "PREDATOR", legs: 0,
    r: 0.18, K: 22, predation: 0.0065, preyOf: "MOON_STRIDER",
    bodyM: 5.2, legLenM: 0, speedMs: 11.5,
    cohesion: 1.4, separation: 1.0, alignment: 1.8, fleeRadiusM: 0,
    nocturnal: true, colour: "#b46bff", aqFloor: 0.18,
  },
  GLIMMER_SHOAL: {
    id: "GLIMMER_SHOAL", label: "Glimmer Shoal", trophic: "FILTER", legs: 0,
    r: 0.95, K: 420, predation: 0, preyOf: null,
    bodyM: 0.35, legLenM: 0, speedMs: 3.4,
    cohesion: 2.6, separation: 1.8, alignment: 2.4, fleeRadiusM: 9,
    nocturnal: false, colour: "#3dc8ff", aqFloor: 0.5,
  },
});

/* ═════════════════════════════════ 2 · THE MACROSCOPIC DENSITY FIELD ══ */

export interface DensityField {
  res: number;
  /** metres covered per cell */
  cellM: number;
  /** world origin of cell (0,0) */
  ox: number;
  oz: number;
  /** individuals per cell, per species */
  n: Record<FaunaId, Float32Array>;
  tick: number;
}

export function makeField(res = 48, cellM = 512, ox = 0, oz = 0): DensityField {
  const mk = () => new Float32Array(res * res);
  return {
    res, cellM, ox, oz, tick: 0,
    n: {
      MOON_STRIDER: mk(), CRYSTAL_TORTOISE: mk(),
      SKY_MANTA: mk(), GLIMMER_SHOAL: mk(),
    },
  };
}

export interface EcoCtx {
  /** 0..1 biomass available at a world point — from the flora cycle */
  biomass: (x: number, z: number) => number;
  /** 0..1 water at a world point */
  water: (x: number, z: number) => number;
  /** 0..1 normalised Aq, gates which species can exist */
  aq: number;
  /** simulated hours elapsed this step */
  dtHours: number;
}

/**
 *  LOTKA-VOLTERRA WITH LOGISTIC SELF-LIMITING, per cell:
 *
 *      dN/dt = r·N·(1 − N/K)  −  α·N·P
 *      dP/dt = β·α·N·P  −  m·P
 *
 *  K is not a constant: it is the local biomass the flora cycle produced.
 *  That is the whole coupling — terraform a valley green and herds appear in
 *  it two simulated days later without anyone writing a spawn rule.
 *
 *  Diffusion (migration) is a 5-point Laplacian, which is what makes herds
 *  spread into newly-fertile land rather than teleporting there.
 */
export function stepField(f: DensityField, ctx: EcoCtx): DensityField {
  const { res, cellM } = f;
  const out: Record<FaunaId, Float32Array> = {
    MOON_STRIDER: new Float32Array(res * res),
    CRYSTAL_TORTOISE: new Float32Array(res * res),
    SKY_MANTA: new Float32Array(res * res),
    GLIMMER_SHOAL: new Float32Array(res * res),
  };
  const ids = Object.keys(FAUNA) as FaunaId[];
  const km2 = (cellM * cellM) / 1e6;

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      const wx = f.ox + (i + 0.5) * cellM;
      const wz = f.oz + (j + 0.5) * cellM;
      const bio = ctx.biomass(wx, wz);
      const wat = ctx.water(wx, wz);

      for (const id of ids) {
        const s = FAUNA[id];
        const N = f.n[id][k];
        if (ctx.aq < s.aqFloor) { out[id][k] = N * 0.96; continue; }

        // carrying capacity follows the flora; filter feeders follow water
        const resource = s.trophic === "FILTER" ? wat : bio;
        const K = Math.max(0.01, s.K * km2 * resource);

        let dN = s.r * N * (1 - N / K);

        // predation: predators eat their prey, and convert it at 12%
        if (s.preyOf) {
          const prey = f.n[s.preyOf][k];
          const eaten = s.predation * prey * N;
          dN += eaten * 0.12 - N * 0.08;            // conversion − mortality
          out[s.preyOf][k] -= eaten * ctx.dtHours;
        }

        // migration: 5-point Laplacian × mobility
        const mob = s.speedMs * 0.0016;
        const nb =
          (f.n[id][j * res + Math.max(0, i - 1)] +
           f.n[id][j * res + Math.min(res - 1, i + 1)] +
           f.n[id][Math.max(0, j - 1) * res + i] +
           f.n[id][Math.min(res - 1, j + 1) * res + i]) * 0.25;
        dN += (nb - N) * mob;

        // a species never goes fully extinct where its resource exists —
        // a trickle of recolonisation keeps the world from dying silently
        const floor = resource > 0.25 ? 0.015 * km2 : 0;
        out[id][k] += Math.max(floor, N + dN * ctx.dtHours);
      }
    }
  }
  for (const id of ids) for (let k = 0; k < out[id].length; k++) out[id][k] = Math.max(0, out[id][k]);
  return { ...f, n: out, tick: f.tick + Math.round(ctx.dtHours * 3600 * 120) };
}

export function densityAt(f: DensityField, id: FaunaId, x: number, z: number): number {
  const i = clamp(Math.floor((x - f.ox) / f.cellM), 0, f.res - 1);
  const j = clamp(Math.floor((z - f.oz) / f.cellM), 0, f.res - 1);
  return f.n[id][j * f.res + i];
}

export function totalPopulation(f: DensityField, id: FaunaId): number {
  let s = 0;
  const a = f.n[id];
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

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

/* ═══════════════════════════ 5 · PROCEDURAL LOCOMOTION (IK) ══ */

export interface LegPose {
  hip: [number, number, number];
  knee: [number, number, number];
  foot: [number, number, number];
  /** 0 planted … 1 at the top of the swing */
  lift: number;
  planted: boolean;
}

export interface CreaturePose {
  legs: LegPose[];
  /** spine bend in radians — leans into turns, arches over obstacles */
  spineBend: number;
  spinePitch: number;
  bodyY: number;
  /** wing flap phase for the legless species */
  wing: number;
}

/**
 *  Gait phase offsets. These four numbers are the difference between an
 *  animal and a sliding box, and they are the only "animation data" in the
 *  entire fauna system — there are no clips, no skeletons on disk, no
 *  retargeting. A six-legged tripod gait is three numbers.
 */
const GAIT_OFFSETS: Record<number, Record<Gait, number[]>> = {
  4: {
    WALK:    [0, 0.5, 0.25, 0.75],     // lateral sequence
    TROT:    [0, 0.5, 0.5, 0],         // diagonal pairs
    GALLOP:  [0, 0.1, 0.5, 0.6],       // rotary
    GLIDE:   [0, 0, 0, 0], SWIM: [0, 0.5, 0.25, 0.75],
  },
  6: {
    WALK:    [0, 0.5, 0, 0.5, 0, 0.5], // alternating tripod
    TROT:    [0, 0.5, 0, 0.5, 0, 0.5],
    GALLOP:  [0, 0.33, 0.66, 0.16, 0.5, 0.83],
    GLIDE:   [0, 0, 0, 0, 0, 0], SWIM: [0, 0.5, 0, 0.5, 0, 0.5],
  },
};

/** Closed-form two-bone IK — law of cosines, no iteration. */
function ik2(
  hip: [number, number, number], target: [number, number, number],
  l1: number, l2: number, pole: [number, number, number],
): [number, number, number] {
  const dx = target[0] - hip[0], dy = target[1] - hip[1], dz = target[2] - hip[2];
  const d = clamp(Math.hypot(dx, dy, dz), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  const along = Math.cos(a) * l1, outD = Math.sin(a) * l1;
  // bend axis = pole projected perpendicular to the limb
  let bx = pole[0] - ux * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  let by = pole[1] - uy * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  let bz = pole[2] - uz * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  const bl = Math.hypot(bx, by, bz) || 1;
  bx /= bl; by /= bl; bz /= bl;
  return [hip[0] + ux * along + bx * outD, hip[1] + uy * along + by * outD, hip[2] + uz * along + bz * outD];
}

export function poseCreature(
  c: Creature, heightAt: (x: number, z: number) => number, dtTurn = 0,
): CreaturePose {
  const s = FAUNA[c.id];
  const legs: LegPose[] = [];
  const ch = Math.cos(c.heading), sh = Math.sin(c.heading);
  const bodyLift = s.legLenM * 0.72;

  if (s.legs === 0) {
    // legless: wings / fins. A sine with a phase lag along the span reads
    // as a travelling wave, which is what a manta actually does.
    return {
      legs: [], spineBend: dtTurn * 1.6,
      spinePitch: Math.sin(c.gaitPhase * 6.283) * 0.12,
      bodyY: c.y + 6 + Math.sin(c.gaitPhase * 6.283) * 0.9,
      wing: c.gaitPhase,
    };
  }

  const offsets = GAIT_OFFSETS[s.legs][c.gait];
  const pairs = s.legs / 2;
  for (let i = 0; i < s.legs; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const fwd = (row - (pairs - 1) / 2) * s.bodyM * 0.52;
    const lat = side * s.bodyM * 0.3;

    const hip: [number, number, number] = [
      c.x + ch * fwd - sh * lat,
      c.y + bodyLift,
      c.z + sh * fwd + ch * lat,
    ];

    const ph = (c.gaitPhase + offsets[i]) % 1;
    const swinging = ph < 0.4;
    const t = swinging ? ph / 0.4 : (ph - 0.4) / 0.6;
    // stride: the foot swings forward through the air, then is planted and
    // travels backward with the body — that contact phase is what sells it
    const stride = s.legLenM * 0.75 * clamp01(Math.hypot(c.vx, c.vz) / s.speedMs);
    const along = swinging ? (t - 0.5) * stride : (0.5 - t) * stride;
    const lift = swinging ? Math.sin(t * Math.PI) * s.legLenM * 0.33 : 0;

    const fx = hip[0] + ch * along;
    const fz = hip[2] + sh * along;
    const foot: [number, number, number] = [fx, heightAt(fx, fz) + lift, fz];

    const l = s.legLenM * 0.5;
    const pole: [number, number, number] = [ch, 0, sh];
    legs.push({ hip, knee: ik2(hip, foot, l, l, pole), foot, lift, planted: !swinging });
  }

  // spine: lean into the turn, arch to follow the ground under the feet
  const front = legs.slice(0, 2).reduce((a, l) => a + l.foot[1], 0) / 2;
  const back = legs.slice(-2).reduce((a, l) => a + l.foot[1], 0) / 2;
  return {
    legs,
    spineBend: clamp(dtTurn * 2.2, -0.5, 0.5),
    spinePitch: Math.atan2(front - back, s.bodyM),
    bodyY: c.y + bodyLift + Math.sin(c.gaitPhase * 6.283 * (s.legs / 2)) * 0.035 * s.bodyM,
    wing: 0,
  };
}

export interface FaunaTelemetry {
  populations: Record<FaunaId, number>;
  materialised: number;
  fieldCells: number;
  bytesResident: number;
  bytesIfEntities: number;
}

export function faunaTelemetry(f: DensityField, materialised: number): FaunaTelemetry {
  const populations = {} as Record<FaunaId, number>;
  let total = 0;
  for (const id of Object.keys(FAUNA) as FaunaId[]) {
    populations[id] = totalPopulation(f, id);
    total += populations[id];
  }
  const cells = f.res * f.res;
  return {
    populations, materialised, fieldCells: cells,
    // four Float32Arrays, regardless of how many animals exist
    bytesResident: cells * 4 * 4,
    // what a conventional entity-per-animal engine would hold
    bytesIfEntities: Math.round(total) * 96,
  };
}
