/* ============================================================================
 *  packages/setmix-machines/src/index.ts
 *  ---------------------------------------------------------------------------
 *  THE PLANET CRAFTER LOOP: extractors, a power grid that can brown out, and
 *  a thermal model that punishes greed.
 *
 *  Design rule that shaped everything here: AN UNDERPOWERED MACHINE DOES NOT
 *  STOP — IT GETS UGLY. Brownout drops a machine's own render tier before it
 *  drops its output, so the base tells you it is starving by looking starved.
 *  Nobody has to read a tooltip.
 *
 *  Pure. 120 Hz fixed step. No clock, no RNG, no I/O.
 * ==========================================================================*/

import type { FidelityState, MetricKey } from "./contracts.setmix";
import { TICK_HZ, normalised } from "./fidelity";

export type Vec2 = readonly [number, number];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/* ─────────────────────────────────────────────────────────── contracts ── */

export type MachineKind =
  | "PIXEL_CHIMNEY" | "HARMONIC_VIBRATOR" | "LUMEN_MAST" | "RAYLEIGH_BELLOWS"
  | "CONDENSATION_TOWER" | "GLACIER_CRACKER" | "TEMPLATE_INJECTOR"
  | "SOLAR_COLLECTOR" | "GEOTHERMAL_VENT" | "WATERWHEEL" | "FISSION_PILE"
  | "RELAY_PYLON" | "COHERENCE_BEACON";

export type MachineRole = "EMITTER" | "SOURCE" | "GRID" | "UTILITY";

export interface MachineSpec {
  kind: MachineKind;
  role: MachineRole;
  label: string;
  metric: MetricKey | null;
  colour: string;
  /** units/s of its metric at T1, 100% clock, no cartridge */
  baseYield: number;
  /** cyc/s demanded at T1 (negative = produced) */
  baseClock: number;
  /** °C/s generated at 100% load before cooling */
  heatRate: number;
  /** passive cooling coefficient; higher sheds heat faster */
  cooling: number;
  /** thermal trip point, °C */
  tripTemp: number;
  /** grid connection radius, metres */
  reach: number;
  cost: string;
  /** the plume this machine emits, if any */
  plume: PlumeKind | null;
  blurb: string;
}

export type PlumeKind = "PIXEL" | "HARMONIC" | "PHOTON" | "VAPOUR" | "NONE";

export const TIER_YIELD = [1, 6.5, 42, 400] as const;
export const TIER_CLOCK = [1, 2.2, 5, 11] as const;

export const MACHINES: Readonly<Record<MachineKind, MachineSpec>> = Object.freeze({
  PIXEL_CHIMNEY: {
    kind: "PIXEL_CHIMNEY", role: "EMITTER", label: "Pixel Chimney", metric: "pxd",
    colour: "#ff3d8a", baseYield: 12, baseClock: 3, heatRate: 2.1, cooling: 0.9,
    tripTemp: 220, reach: 0, cost: "8 Chromatic Crystal · 4 Slag", plume: "PIXEL",
    blurb: "Sublimates colour crystals into the sky. The plume's hue IS the colour being added to the planet's palette — a progress bar visible from 300 m.",
  },
  HARMONIC_VIBRATOR: {
    kind: "HARMONIC_VIBRATOR", role: "EMITTER", label: "Harmonic Mesh Vibrator", metric: "vtx",
    colour: "#7cff4d", baseYield: 9, baseClock: 4, heatRate: 2.8, cooling: 1.1,
    tripTemp: 200, reach: 0, cost: "10 Topology Shard · 2 Substrate", plume: "HARMONIC",
    blurb: "A tuning fork that shakes the voxel field until it relaxes into smoother isosurfaces. Terrain within 60 m bevels first — local before global, always.",
  },
  LUMEN_MAST: {
    kind: "LUMEN_MAST", role: "EMITTER", label: "Lumen Mast", metric: "lx",
    colour: "#ffc13d", baseYield: 7, baseClock: 2, heatRate: 1.4, cooling: 1.4,
    tripTemp: 240, reach: 0, cost: "6 Photon Salt · 6 Shard", plume: "PHOTON",
    blurb: "Broadcasts a light-transport upgrade. Each mast adds one shadow cascade in its radius until the planet's global lighting model promotes a tier.",
  },
  RAYLEIGH_BELLOWS: {
    kind: "RAYLEIGH_BELLOWS", role: "EMITTER", label: "Rayleigh Bellows", metric: "lx",
    colour: "#ffd97a", baseYield: 16, baseClock: 6, heatRate: 2.0, cooling: 1.0,
    tripTemp: 210, reach: 0, cost: "14 Photon Salt · 8 Substrate", plume: "PHOTON",
    blurb: "Pumps wavelength-dependent scatter into the upper atmosphere. Black → indigo → blue → sunset. Players learn Rayleigh scattering by operating a bellows.",
  },
  CONDENSATION_TOWER: {
    kind: "CONDENSATION_TOWER", role: "EMITTER", label: "Condensation Tower", metric: "aq",
    colour: "#3dc8ff", baseYield: 5, baseClock: 7, heatRate: 3.4, cooling: 1.6,
    tripTemp: 180, reach: 0, cost: "14 Ice Clathrate · 4 Substrate", plume: "VAPOUR",
    blurb: "Humidity before water: clouds form, then rain, then the valleys fill. A three-act structure inside one machine.",
  },
  GLACIER_CRACKER: {
    kind: "GLACIER_CRACKER", role: "EMITTER", label: "Glacier Cracker", metric: "aq",
    colour: "#8fe3ff", baseYield: 22, baseClock: 14, heatRate: 6.2, cooling: 2.2,
    tripTemp: 160, reach: 0, cost: "30 Clathrate · 12 Substrate", plume: "VAPOUR",
    blurb: "Fractures polar ice directly into the hydrosphere. Enormous yield, enormous heat, and it will flood your own extractor farm if you misjudge the basin.",
  },
  TEMPLATE_INJECTOR: {
    kind: "TEMPLATE_INJECTOR", role: "EMITTER", label: "Template Injector", metric: null,
    colour: "#b46bff", baseYield: 0, baseClock: 6, heatRate: 1.8, cooling: 1.2,
    tripTemp: 230, reach: 0, cost: "20 Substrate · 30 Shard", plume: "PIXEL",
    blurb: "Three cartridge slots. Whatever you slot, it emits — and a radial terraform wave carries that exact preset outward at 2–14 m/s.",
  },
  SOLAR_COLLECTOR: {
    kind: "SOLAR_COLLECTOR", role: "SOURCE", label: "Solar Collector", metric: null,
    colour: "#ffe08a", baseYield: 0, baseClock: -18, heatRate: 0.2, cooling: 2.4,
    tripTemp: 300, reach: 90, cost: "10 Photon Salt · 6 Shard", plume: "NONE",
    blurb: "Free, clean, and asleep for half of every 24-minute day. Teaches storage before the player has heard the word battery.",
  },
  GEOTHERMAL_VENT: {
    kind: "GEOTHERMAL_VENT", role: "SOURCE", label: "Geothermal Vent", metric: null,
    colour: "#ff8a3d", baseYield: 0, baseClock: -46, heatRate: 1.1, cooling: 0.6,
    tripTemp: 320, reach: 110, cost: "22 Substrate · 18 Slag", plume: "VAPOUR",
    blurb: "Constant output, sited only on fissures, and it heats everything around it — a geothermal farm is a thermal-management puzzle by construction.",
  },
  WATERWHEEL: {
    kind: "WATERWHEEL", role: "SOURCE", label: "Hydro Waterwheel", metric: null,
    colour: "#5fd0ff", baseYield: 0, baseClock: -34, heatRate: 0, cooling: 3.2,
    tripTemp: 400, reach: 95, cost: "16 Shard · 8 Substrate", plume: "NONE",
    blurb: "Only works once Aq ≥ 1.1e6, which means the player powers their mid-game with an ocean they personally created. Self-cooling.",
  },
  FISSION_PILE: {
    kind: "FISSION_PILE", role: "SOURCE", label: "Fission Pile", metric: null,
    colour: "#c9ff5f", baseYield: 0, baseClock: -180, heatRate: 9.5, cooling: 0.4,
    tripTemp: 140, reach: 140, cost: "60 Substrate · 40 Logic", plume: "VAPOUR",
    blurb: "Enormous, constant, and it will melt down. The lowest trip temperature in the game paired with the highest heat rate — late-game power is a commitment.",
  },
  RELAY_PYLON: {
    kind: "RELAY_PYLON", role: "GRID", label: "Relay Pylon", metric: null,
    colour: "#8b9bb4", baseYield: 0, baseClock: 1, heatRate: 0, cooling: 2.0,
    tripTemp: 300, reach: 120, cost: "6 Shard · 3 Substrate", plume: "NONE",
    blurb: "Carries Clock and Bandwidth on one line. Two commodities, one wire — the logistics puzzle of the mid-game.",
  },
  COHERENCE_BEACON: {
    kind: "COHERENCE_BEACON", role: "UTILITY", label: "Coherence Beacon", metric: null,
    colour: "#e8eef7", baseYield: 0, baseClock: 1, heatRate: 0.1, cooling: 2.0,
    tripTemp: 300, reach: 90, cost: "4 Shard · 2 Salt", plume: "NONE",
    blurb: "Your lifeline network. Placing beacons is how you draw the map of where you are allowed to be — exploration is literally an infrastructure problem.",
  },
});

/* ───────────────────────────────────────────────────── machine instance ── */

export interface Machine {
  id: string;
  kind: MachineKind;
  pos: Vec2;
  tier: 0 | 1 | 2 | 3;
  /** 1.0 nominal · up to 1.8 overclocked */
  overclock: number;
  cartridgeId: string | null;
  /** 0..1 — degrades without maintenance, scales yield */
  condition: number;
  /** °C */
  temperature: number;
  /** true after a thermal trip; needs a manual reset */
  tripped: boolean;
  enabled: boolean;
  /** grid island assigned by the solver */
  island: number;
}

export interface GridNode { id: string; pos: Vec2; reach: number }

export interface GridIsland {
  id: number;
  members: string[];
  supply: number;
  demand: number;
  /** supply / demand, clamped to 1 */
  satisfaction: number;
  /** average temperature across the island, for the heat overlay */
  avgTemp: number;
}

export interface MachineRuntime {
  machines: Machine[];
  islands: GridIsland[];
  /** per-machine effective output this tick */
  output: Record<string, number>;
  totals: Record<MetricKey, number>;
  tick: number;
  brownouts: string[];
  trips: string[];
}

/* ═══════════════════════════════════════════════ 1 · THE GRID SOLVER ══ */

/**
 *  Union-find over connection radii. Machines form ISLANDS; an island
 *  brownouts independently, which is the entire reason players build pylon
 *  trunks instead of one giant blob — and why a flood severing a line is a
 *  real engineering event rather than a number going down.
 */
export function solveIslands(machines: readonly Machine[]): Map<string, number> {
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(a) !== r) { const nx = parent.get(a)!; parent.set(a, r); a = nx; }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const m of machines) parent.set(m.id, m.id);
  for (let i = 0; i < machines.length; i++)
    for (let j = i + 1; j < machines.length; j++) {
      const a = machines[i], b = machines[j];
      const ra = MACHINES[a.kind].reach, rb = MACHINES[b.kind].reach;
      const reach = Math.max(ra, rb);
      if (reach <= 0) continue;                         // emitters do not relay
      const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
      if (d <= reach) union(a.id, b.id);
    }
  // attach emitters to the nearest grid member within ITS reach
  for (const m of machines) {
    if (MACHINES[m.kind].reach > 0) continue;
    let best: Machine | null = null, bd = Infinity;
    for (const g of machines) {
      const r = MACHINES[g.kind].reach;
      if (r <= 0) continue;
      const d = Math.hypot(m.pos[0] - g.pos[0], m.pos[1] - g.pos[1]);
      if (d <= r && d < bd) { bd = d; best = g; }
    }
    if (best) union(m.id, best.id);
  }

  const ids = new Map<string, number>();
  const roots = new Map<string, number>();
  let next = 0;
  for (const m of machines) {
    const r = find(m.id);
    if (!roots.has(r)) roots.set(r, next++);
    ids.set(m.id, roots.get(r)!);
  }
  return ids;
}

/* ═══════════════════════════════════════════════ 2 · THE 120 Hz STEP ══ */

export interface MachineStepCtx {
  fi: FidelityState;
  /** 0..1 — solar output; drives SOLAR_COLLECTOR only */
  daylight: number;
  /** ambient °C; geothermal regions run hotter */
  ambient: number;
  /** per-machine affinity multiplier from a slotted cartridge */
  affinity?: (m: Machine) => number;
  ticks?: number;
}

export function stepMachines(rt: MachineRuntime, ctx: MachineStepCtx): MachineRuntime {
  const ticks = ctx.ticks ?? 1;
  const dt = ticks / TICK_HZ;
  const n = normalised(ctx.fi);

  const islandIds = solveIslands(rt.machines);
  const machines = rt.machines.map((m) => ({ ...m, island: islandIds.get(m.id) ?? 0 }));

  /* ── supply & demand per island ─────────────────────────────────── */
  const agg = new Map<number, { supply: number; demand: number; temp: number; n: number; members: string[] }>();
  for (const m of machines) {
    const spec = MACHINES[m.kind];
    const a = agg.get(m.island) ?? { supply: 0, demand: 0, temp: 0, n: 0, members: [] };
    const live = m.enabled && !m.tripped;
    const clock = spec.baseClock * TIER_CLOCK[m.tier] * m.overclock;
    if (live) {
      if (clock < 0) {
        // sources: solar sleeps at night, hydro needs an ocean to exist
        const avail =
          m.kind === "SOLAR_COLLECTOR" ? ctx.daylight
          : m.kind === "WATERWHEEL" ? clamp01((n.aq - 0.14) * 4)
          : 1;
        a.supply += -clock * avail * m.condition;
      } else {
        a.demand += clock;
      }
    }
    a.temp += m.temperature; a.n++; a.members.push(m.id);
    agg.set(m.island, a);
  }

  const islands: GridIsland[] = [...agg.entries()].map(([id, a]) => ({
    id, members: a.members, supply: a.supply, demand: a.demand,
    satisfaction: a.demand <= 0 ? 1 : clamp01(a.supply / a.demand),
    avgTemp: a.n ? a.temp / a.n : 0,
  }));
  const satOf = new Map(islands.map((i) => [i.id, i.satisfaction]));

  /* ── per-machine thermal + output ───────────────────────────────── */
  const output: Record<string, number> = {};
  const totals: Record<MetricKey, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  const brownouts: string[] = [];
  const trips: string[] = [];

  const next = machines.map((m) => {
    const spec = MACHINES[m.kind];
    const sat = satOf.get(m.island) ?? 1;
    const live = m.enabled && !m.tripped;
    const load = live ? sat * m.overclock * m.condition : 0;

    /* thermal: Newtonian cooling toward ambient, heating with load².
     * The square is what makes overclocking feel dangerous rather than
     * merely expensive — 1.8× output is 3.24× heat. */
    const heat = spec.heatRate * load * load;
    const cool = spec.cooling * (m.temperature - ctx.ambient) * 0.045;
    let temperature = m.temperature + (heat - cool) * dt;
    let tripped = m.tripped;
    if (!tripped && temperature >= spec.tripTemp) { tripped = true; trips.push(m.id); }
    if (tripped && temperature <= ctx.ambient + 12) tripped = false;   // auto-reset when cool
    temperature = clamp(temperature, ctx.ambient, spec.tripTemp + 40);

    if (sat < 0.995 && spec.baseClock > 0 && live) brownouts.push(m.id);

    /* condition decays with heat stress; maintenance is the player's job */
    const stress = clamp01((temperature - spec.tripTemp * 0.6) / (spec.tripTemp * 0.4));
    const condition = clamp01(m.condition - stress * 0.012 * dt);

    const aff = ctx.affinity?.(m) ?? 1;
    const out = live && spec.metric
      ? spec.baseYield * TIER_YIELD[m.tier] * load * aff
      : 0;
    output[m.id] = out;
    if (spec.metric) totals[spec.metric] += out;

    return { ...m, temperature, tripped, condition };
  });

  return { machines: next, islands, output, totals, tick: rt.tick + ticks, brownouts, trips };
}

/**
 *  THE BROWNOUT RENDER TIER. This is the design rule made executable: a
 *  starved machine drops its OWN visual fidelity before it drops output.
 *  Returns a 0..1 multiplier the renderer applies to that machine's texel
 *  size, plume density and emissive strength.
 */
export function brownoutVisual(m: Machine, islands: readonly GridIsland[]): number {
  const isl = islands.find((i) => i.id === m.island);
  const sat = isl?.satisfaction ?? 1;
  if (m.tripped) return 0.18;
  return clamp(0.3 + sat * 0.7, 0.18, 1) * clamp(0.5 + m.condition * 0.5, 0.3, 1);
}

export function emptyRuntime(machines: Machine[] = []): MachineRuntime {
  return {
    machines, islands: [], output: {},
    totals: { pxd: 0, vtx: 0, lx: 0, aq: 0 },
    tick: 0, brownouts: [], trips: [],
  };
}

export function makeMachine(
  id: string, kind: MachineKind, pos: Vec2, tier: 0 | 1 | 2 | 3 = 0,
): Machine {
  return {
    id, kind, pos, tier, overclock: 1, cartridgeId: null,
    condition: 1, temperature: 20, tripped: false, enabled: true, island: 0,
  };
}

/* ═══════════════════════════════════════ 3 · THE PIXEL PLUME SYSTEM ══ */

/**
 *  GPU-instanced cubes. The CPU owns ONE Float32Array of per-instance
 *  transforms that it rewrites in place each frame; the GPU owns a single
 *  unit-cube VBO. 20,000 motes cost one draw call and ~0.3 ms.
 *
 *  Particles are not killed at a fixed lifetime — they DISSIPATE INTO THE
 *  ACTIVE TERRAFORM BAND. A mote that reaches the wave front is consumed by
 *  it, which makes the causal chain visible: this chimney is feeding that
 *  expanding ring, and you can watch an individual pixel make the trip.
 */
export interface PlumeParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;      // 0..1, counts up
  size: number;
  hue: number;       // index into the machine's palette
  seed: number;
}

export interface PlumeConfig {
  kind: PlumeKind;
  /** motes/s at full load */
  rate: number;
  riseSpeed: number;
  spread: number;
  lifetime: number;
  cubeSize: number;
  /** motes are consumed when they reach the wave band */
  consumedByWave: boolean;
}

export const PLUME_CONFIG: Readonly<Record<PlumeKind, PlumeConfig>> = Object.freeze({
  PIXEL:    { kind: "PIXEL",    rate: 46, riseSpeed: 7.5, spread: 1.6, lifetime: 5.5, cubeSize: 0.42, consumedByWave: true },
  HARMONIC: { kind: "HARMONIC", rate: 28, riseSpeed: 5.2, spread: 2.9, lifetime: 4.2, cubeSize: 0.55, consumedByWave: true },
  PHOTON:   { kind: "PHOTON",   rate: 62, riseSpeed: 11.0, spread: 1.1, lifetime: 3.4, cubeSize: 0.26, consumedByWave: false },
  VAPOUR:   { kind: "VAPOUR",   rate: 34, riseSpeed: 4.0, spread: 4.4, lifetime: 7.8, cubeSize: 0.78, consumedByWave: false },
  NONE:     { kind: "NONE",     rate: 0,  riseSpeed: 0,   spread: 0,   lifetime: 1,   cubeSize: 0,    consumedByWave: false },
});

export interface PlumeSystem {
  particles: PlumeParticle[];
  capacity: number;
  /** xyz + scale + hue + alpha, 6 floats per instance */
  instanceData: Float32Array;
  liveCount: number;
  /** deterministic emitter accumulator per machine */
  accum: Map<string, number>;
  rngState: number;
  consumed: number;
}

export function makePlumeSystem(capacity = 20000): PlumeSystem {
  return {
    particles: [], capacity,
    instanceData: new Float32Array(capacity * 6),
    liveCount: 0, accum: new Map(), rngState: 0x5eed, consumed: 0,
  };
}

export interface PlumeStepCtx {
  machines: readonly Machine[];
  output: Record<string, number>;
  islands: readonly GridIsland[];
  wind: Vec2;
  /** active wave fronts the motes dissipate into */
  waves: readonly { origin: Vec2; radius: number; thickness: number }[];
  /** Pxd drives mote size: a low-res planet has chunky pixels, literally */
  fi: FidelityState;
  dt: number;
}

export function stepPlumes(ps: PlumeSystem, ctx: PlumeStepCtx): PlumeSystem {
  const n = normalised(ctx.fi);
  let rng = ps.rngState;
  const rnd = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);

  const particles = ps.particles;
  const accum = new Map(ps.accum);
  let consumed = ps.consumed;

  /* ── emit ────────────────────────────────────────────────────────── */
  for (const m of ctx.machines) {
    const spec = MACHINES[m.kind];
    if (!spec.plume || spec.plume === "NONE") continue;
    if (!m.enabled || m.tripped) continue;
    const cfg = PLUME_CONFIG[spec.plume];
    const vis = brownoutVisual(m, ctx.islands);
    const load = clamp01((ctx.output[m.id] ?? 0) / Math.max(1e-6, spec.baseYield * TIER_YIELD[m.tier]));
    const rate = cfg.rate * (0.25 + load * 0.75) * vis * (1 + m.tier * 0.35);

    let a = (accum.get(m.id) ?? 0) + rate * ctx.dt;
    while (a >= 1 && particles.length < ps.capacity) {
      a -= 1;
      const ang = rnd() * Math.PI * 2;
      const r = rnd() * 0.8;
      particles.push({
        x: m.pos[0] + Math.cos(ang) * r,
        y: 26 + m.tier * 5,
        z: m.pos[1] + Math.sin(ang) * r,
        vx: Math.cos(ang) * cfg.spread * 0.25,
        vy: cfg.riseSpeed * (0.8 + rnd() * 0.4),
        vz: Math.sin(ang) * cfg.spread * 0.25,
        life: 0,
        // Pxd drives mote size: on a low-res planet the pixels are visibly big
        size: cfg.cubeSize * (0.7 + rnd() * 0.6) * (1.9 - n.pxd),
        hue: rnd(),
        seed: rnd(),
      });
    }
    accum.set(m.id, a);
  }

  /* ── integrate + dissipate ───────────────────────────────────────── */
  const inst = ps.instanceData;
  let live = 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const cfgLife = 5.5;
    p.life += ctx.dt / cfgLife;

    // buoyant rise with turbulence; wind advects increasingly with altitude
    const alt = clamp01((p.y - 26) / 60);
    p.vy += (-0.9 + 2.2 * (1 - p.life)) * ctx.dt;
    p.vx += (ctx.wind[0] * 0.34 * alt + Math.sin(p.seed * 31 + p.y * 0.14) * 0.5) * ctx.dt;
    p.vz += (ctx.wind[1] * 0.34 * alt + Math.cos(p.seed * 17 + p.y * 0.11) * 0.5) * ctx.dt;
    p.x += p.vx * ctx.dt; p.y += p.vy * ctx.dt; p.z += p.vz * ctx.dt;

    /* dissipation into the wave band — the causal chain, made visible */
    let eaten = false;
    for (const w of ctx.waves) {
      const d = Math.hypot(p.x - w.origin[0], p.z - w.origin[1]);
      if (Math.abs(d - w.radius) < w.thickness && p.life > 0.25) { eaten = true; break; }
    }
    if (eaten) { consumed++; particles.splice(i, 1); continue; }
    if (p.life >= 1) { particles.splice(i, 1); continue; }
  }

  /* ── pack the instance buffer (one write, one upload) ────────────── */
  for (let i = 0; i < particles.length && live < ps.capacity; i++) {
    const p = particles[i];
    const fade = p.life < 0.12 ? p.life / 0.12 : 1 - (p.life - 0.12) / 0.88;
    const o = live * 6;
    inst[o] = p.x; inst[o + 1] = p.y; inst[o + 2] = p.z;
    inst[o + 3] = p.size * (0.6 + fade * 0.4);
    inst[o + 4] = p.hue;
    inst[o + 5] = clamp01(fade) * 0.9;
    live++;
  }

  return { ...ps, particles, instanceData: inst, liveCount: live, accum, rngState: rng, consumed };
}

/** The GLSL the instance buffer feeds. Cubes, not billboards — at Stage 1
 *  the player must be able to see that the atmosphere is made of voxels. */
export const PLUME_VERT = /* glsl */ `
in vec3 a_cube;            // unit cube corner
in vec3 i_pos;             // instance
in float i_size;
in float i_hue;
in float i_alpha;
uniform mat4 u_viewProj;
uniform vec3 u_palette[4];
uniform float u_time;
out vec3 v_colour;
out float v_alpha;
void main(){
  // spin each mote on its own axis, seeded by hue so it is free
  float s = sin(u_time * 1.7 + i_hue * 31.4), c = cos(u_time * 1.7 + i_hue * 31.4);
  vec3 r = vec3(a_cube.x * c - a_cube.z * s, a_cube.y, a_cube.x * s + a_cube.z * c);
  vec3 world = i_pos + r * i_size;
  int idx = int(clamp(floor(i_hue * 4.0), 0.0, 3.0));
  v_colour = u_palette[idx];
  v_alpha  = i_alpha;
  gl_Position = u_viewProj * vec4(world, 1.0);
}`;
