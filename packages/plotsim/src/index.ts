/**
 * plotsim: the economy of one player's plot in a terraforming game.
 *
 * Pure, deterministic functions over plain JSON data. No graphics, no DOM, no clock, no randomness.
 * Every function returns a new state and never touches its input.
 *
 * The physical story, which the numbers below follow:
 *  - The gate's junction box gives power. Wires reach only so far, so relay pylons (and power units,
 *    which are wired too) carry it outward in a chain.
 *  - A drill turns ground into ore. The ore sits in one plot-wide stock (the game draws it as heaps
 *    at the drills). Mills, presses, water makers and power units burn ore out of it.
 *  - When the stock is empty the ore-burning machines share what the drills deliver, evenly.
 *  - When the machines ask for more power than there is, all of them slow down by the same share.
 *  - Pixel machines pour pixels into the air. A metric climbs with the square root of the pixels:
 *    each next bit of fidelity costs more than the last.
 *  - Metrics only rise, stages only rise, nothing is ever taken from the plot.
 */

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';
export const METRICS: readonly Metric[] = ['pxd', 'vtx', 'lx', 'aq'];

export type MachineKind = 'drill' | 'mill' | 'pylon' | 'press' | 'power' | 'projector' | 'water' | HeavyKind;

/** Heavy terraformers (docs/BASE_BUILDING_ARCHITECTURE.md D3): built only on a base hardpoint, paid in refined parts by the base (so 0 ore here), about 20x the output of their field twin for 4x the power. */
export type HeavyKind = 'heavy-mill' | 'heavy-press' | 'heavy-projector' | 'heavy-water';
export const HEAVY_KINDS: readonly HeavyKind[] = ['heavy-mill', 'heavy-press', 'heavy-projector', 'heavy-water'];

/** The field kinds in the order they unlock (heavy kinds come from the base, see HEAVY_KINDS). */
export const MACHINE_KINDS: readonly MachineKind[] = ['drill', 'mill', 'pylon', 'press', 'power', 'projector', 'water'];

export interface KindSpec {
  readonly kind: MachineKind;
  readonly name: string;
  readonly cost: number; // ore
  readonly draw: number; // kW while running; negative = supplies (the power unit)
  readonly oreUse: number; // ore/s while running
  readonly mine: number; // ore/s at richness 1 (drill only, else 0)
  readonly emits: Metric | null;
  readonly rate: number; // points/s at full running
  readonly reach: number; // metres as a network node (pylon, power unit), else 0
  readonly unlock: number; // stage
  readonly slot: boolean; // takes a cartridge
  readonly radius: number; // footprint, metres
}

export const KINDS: Readonly<Record<MachineKind, KindSpec>> = {
  drill: { kind: 'drill', name: 'Rock drill', cost: 18, draw: 3, oreUse: 0, mine: 3.5, emits: null, rate: 0, reach: 0, unlock: 0, slot: false, radius: 2 },
  mill: { kind: 'mill', name: 'Texture mill', cost: 24, draw: 4, oreUse: 0.6, mine: 0, emits: 'pxd', rate: 2, reach: 0, unlock: 0, slot: true, radius: 1.5 },
  pylon: { kind: 'pylon', name: 'Relay pylon', cost: 10, draw: 0, oreUse: 0, mine: 0, emits: null, rate: 0, reach: 40, unlock: 0, slot: false, radius: 1 },
  press: { kind: 'press', name: 'Shape press', cost: 40, draw: 4, oreUse: 0.7, mine: 0, emits: 'vtx', rate: 2, reach: 0, unlock: 1, slot: true, radius: 2 },
  power: { kind: 'power', name: 'Power unit', cost: 60, draw: -16, oreUse: 1, mine: 0, emits: null, rate: 0, reach: 30, unlock: 1, slot: false, radius: 2.5 },
  projector: { kind: 'projector', name: 'Light projector', cost: 90, draw: 8, oreUse: 0, mine: 0, emits: 'lx', rate: 3, reach: 0, unlock: 2, slot: true, radius: 1.5 },
  water: { kind: 'water', name: 'Water maker', cost: 110, draw: 5, oreUse: 0.8, mine: 0, emits: 'aq', rate: 2, reach: 0, unlock: 3, slot: true, radius: 2 },
  'heavy-mill': { kind: 'heavy-mill', name: 'Heavy texture mill', cost: 0, draw: 16, oreUse: 1.2, mine: 0, emits: 'pxd', rate: 40, reach: 0, unlock: 0, slot: true, radius: 4 },
  'heavy-press': { kind: 'heavy-press', name: 'Heavy shape press', cost: 0, draw: 16, oreUse: 1.4, mine: 0, emits: 'vtx', rate: 40, reach: 0, unlock: 1, slot: true, radius: 4 },
  'heavy-projector': { kind: 'heavy-projector', name: 'Heavy light projector', cost: 0, draw: 32, oreUse: 0, mine: 0, emits: 'lx', rate: 60, reach: 0, unlock: 2, slot: true, radius: 4 },
  'heavy-water': { kind: 'heavy-water', name: 'Heavy water maker', cost: 0, draw: 20, oreUse: 1.6, mine: 0, emits: 'aq', rate: 40, reach: 0, unlock: 3, slot: true, radius: 4 },
};

/** The gate's junction box: kW it supplies, metres it reaches, metres of bare pad around the gate. */
export const GATE: { readonly supply: number; readonly reach: number; readonly pad: number } = { supply: 12, reach: 30, pad: 5 };

/** The most ore the plot can hold. */
export const ORE_CAP = 8000;

/** A drill needs ground at least this rich. */
export const MIN_RICHNESS = 0.2;

/** Points a metric needs to stand at level 100. */
export const TARGET: Readonly<Record<Metric, number>> = { pxd: 80000, vtx: 100000, lx: 90000, aq: 72000 };

/** What each stage needs (level per metric). Index = stage. Stage 1 comes from placing the first pixel machine. */
export const STAGES: readonly Readonly<Partial<Record<Metric, number>>>[] = [
  {},
  {},
  { pxd: 15, vtx: 10 },
  { pxd: 30, vtx: 25, lx: 15 },
  { pxd: 50, vtx: 45, lx: 35, aq: 20 },
  { pxd: 75, vtx: 70, lx: 60, aq: 50 },
  { pxd: 100, vtx: 100, lx: 100, aq: 100 },
];

export const LAST_STAGE = 6;

/** The longest span one call of `step` will simulate (a day); call again for more. */
export const MAX_STEP_SECONDS = 86400;

export interface Machine {
  readonly id: number;
  readonly kind: MachineKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly on: boolean;
  readonly cartridge: string | null;
  readonly built: number;
}

export interface PlotState {
  readonly v: 1;
  readonly time: number;
  readonly ore: number;
  readonly points: Readonly<Record<Metric, number>>;
  readonly stage: number;
  readonly machines: readonly Machine[];
  readonly nextId: number;
  /** Present (true) while the stock is dry with machines waiting for ore: lets 'ore-out' be announced once. */
  readonly oreOut?: true;
  /** Present (true) while the machines ask for more power than there is: lets 'underpowered' be announced once. */
  readonly underpowered?: true;
}

export interface Env {
  readonly gate: { readonly x: number; readonly z: number };
  readonly plotRadius: number;
  richness(x: number, z: number): number; // 0..1
  affinity?(cartridge: string, metric: Metric): number; // default 1
}

export type PlotEvent =
  | { readonly type: 'stage-up'; readonly stage: number }
  | { readonly type: 'ore-out' }
  | { readonly type: 'underpowered' };

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const EPS = 1e-9;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function distance(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function richnessAt(env: Env, x: number, z: number): number {
  const r = env.richness(x, z);
  return Number.isFinite(r) ? clamp(r, 0, 1) : 0;
}

function affinityOf(env: Env, m: Machine, metric: Metric): number {
  if (m.cartridge === null || !KINDS[m.kind].slot || env.affinity === undefined) return 1;
  const a = env.affinity(m.cartridge, metric);
  return Number.isFinite(a) ? clamp(a, 0, 10) : 1;
}

function levelOf(points: number, metric: Metric): number {
  return Math.min(100, 100 * Math.sqrt(Math.max(0, points) / TARGET[metric]));
}

const hasPixelMachine = (s: PlotState): boolean => s.machines.some((m) => KINDS[m.kind].emits !== null);

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

/** 60 ore, stage 0, nothing built: enough for the first texture mill and the first rock drill. */
export function newPlot(): PlotState {
  return { v: 1, time: 0, ore: 60, points: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, stage: 0, machines: [], nextId: 1 };
}

/** A metric's level, 0..100: 100 * sqrt(points / TARGET), capped. */
export function level(s: PlotState, m: Metric): number {
  return levelOf(s.points[m], m);
}

// ---------------------------------------------------------------------------------------------
// Power network
// ---------------------------------------------------------------------------------------------

interface Source {
  readonly x: number;
  readonly z: number;
  readonly reach: number;
}

/** The gate plus every pylon and power unit that is wired to it, directly or along a chain. */
function powerSources(s: PlotState, env: Env): Source[] {
  const found: Source[] = [{ x: env.gate.x, z: env.gate.z, reach: GATE.reach }];
  const waiting = s.machines.filter((m) => KINDS[m.kind].reach > 0);
  const taken = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of waiting) {
      if (taken.has(m.id) || !reachedBy(found, m.x, m.z)) continue;
      taken.add(m.id);
      found.push({ x: m.x, z: m.z, reach: KINDS[m.kind].reach });
      grew = true;
    }
  }
  return found;
}

function reachedBy(sources: readonly Source[], x: number, z: number): boolean {
  for (const src of sources) if (distance(src.x, src.z, x, z) <= src.reach + EPS) return true;
  return false;
}

interface Solved {
  readonly connected: ReadonlySet<number>;
  readonly supply: number;
  readonly demand: number;
  readonly satisfaction: number;
  readonly run: ReadonlyMap<number, number>;
  readonly needsOre: boolean; // some connected, switched-on machine burns ore
  readonly oreFactor: number; // share of the ore they ask for that they get, 0..1
  readonly mined: number; // ore/s the drills bring in
  readonly used: number; // ore/s the machines burn
  readonly emit: Readonly<Record<Metric, number>>; // points/s
}

/**
 * How the plot runs for the next `h` seconds.
 *
 * Power units burn ore and drills draw power, so the two feed each other. We settle it in two passes:
 * first as if the power units had all the ore they want, which tells how much ore is asked for and
 * brought in; then with the share of ore that the stock plus the drills can really give.
 */
function solve(s: PlotState, env: Env, h: number): Solved {
  const sources = powerSources(s, env);
  const connected = new Set<number>();
  const live: Machine[] = [];
  for (const m of s.machines) {
    if (!reachedBy(sources, m.x, m.z)) continue;
    connected.add(m.id);
    if (m.on) live.push(m);
  }
  const richness = new Map<number, number>();
  for (const m of live) if (KINDS[m.kind].mine > 0) richness.set(m.id, richnessAt(env, m.x, m.z));

  const pass = (oreFactor: number) => {
    let supply: number = GATE.supply;
    let demand = 0;
    for (const m of live) {
      const draw = KINDS[m.kind].draw;
      if (draw < 0) supply -= draw * oreFactor;
      else demand += draw;
    }
    const satisfaction = demand > 0 ? Math.min(1, supply / demand) : 1;
    const run = new Map<number, number>();
    const emit: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
    let mined = 0;
    let used = 0;
    for (const m of s.machines) {
      const k = KINDS[m.kind];
      let r = 0;
      if (connected.has(m.id) && m.on) {
        const power = k.draw > 0 ? satisfaction : 1;
        r = k.oreUse > 0 ? power * oreFactor : power;
      }
      run.set(m.id, r);
      if (r <= 0) continue;
      mined += k.mine * (richness.get(m.id) ?? 0) * r;
      used += k.oreUse * r;
      if (k.emits !== null) emit[k.emits] += k.rate * r * affinityOf(env, m, k.emits);
    }
    return { supply, demand, satisfaction, run, mined, used, emit };
  };

  const first = pass(1);
  const needsOre = live.some((m) => KINDS[m.kind].oreUse > 0);
  const asked = first.used * h;
  const oreFactor = asked <= EPS ? 1 : Math.min(1, Math.max(0, (s.ore + first.mined * h) / asked));
  const last = oreFactor >= 1 ? first : pass(oreFactor);
  return { connected, needsOre, oreFactor, ...last };
}

/** Which machines the network reaches, what it supplies and what is asked of it. */
export function network(
  s: PlotState,
  env: Env,
): { readonly connected: ReadonlySet<number>; readonly supply: number; readonly demand: number; readonly satisfaction: number } {
  const z = solve(s, env, 1);
  return { connected: z.connected, supply: z.supply, demand: z.demand, satisfaction: z.satisfaction };
}

/** How hard each machine runs now, 0..1 (0: off, unconnected, or starved). */
export function running(s: PlotState, env: Env): ReadonlyMap<number, number> {
  return new Map(solve(s, env, 1).run);
}

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

export function canPlace(
  s: PlotState,
  env: Env,
  kind: MachineKind,
  x: number,
  z: number,
): { readonly ok: true } | { readonly ok: false; readonly why: string } {
  const spec = KINDS[kind];
  const refuse = (why: string) => ({ ok: false as const, why });
  if (s.stage < spec.unlock) return refuse(`Unlocks at stage ${spec.unlock}.`);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return refuse('Outside your plot.');
  const fromGate = distance(x, z, env.gate.x, env.gate.z);
  if (fromGate > env.plotRadius) return refuse('Outside your plot.');
  if (fromGate < GATE.pad + spec.radius) return refuse('Too close to the gate.');
  let blocker: Machine | null = null;
  let blockerAt = Infinity;
  for (const m of s.machines) {
    const d = distance(x, z, m.x, m.z);
    if (d < spec.radius + KINDS[m.kind].radius + 1 && d < blockerAt) {
      blocker = m;
      blockerAt = d;
    }
  }
  if (blocker !== null) return refuse(`Too close to the ${KINDS[blocker.kind].name.toLowerCase()}.`);
  if (!reachedBy(powerSources(s, env), x, z)) return refuse('Out of reach of the power network: build a relay pylon closer.');
  if (kind === 'drill' && richnessAt(env, x, z) < MIN_RICHNESS) return refuse('Not enough ore in this ground.');
  if (s.ore < spec.cost) return refuse(`Needs ${spec.cost} ore (you have ${Math.floor(s.ore)}).`);
  return { ok: true };
}

/** Builds a machine, pays for it. Throws the reason when it may not be built. The first pixel machine lifts the plot to stage 1. */
export function place(s: PlotState, env: Env, kind: MachineKind, x: number, z: number, yaw: number): PlotState {
  const verdict = canPlace(s, env, kind, x, z);
  if (!verdict.ok) throw new Error(verdict.why);
  const spec = KINDS[kind];
  const machine: Machine = { id: s.nextId, kind, x, z, yaw: Number.isFinite(yaw) ? yaw : 0, on: true, cartridge: null, built: s.time };
  return {
    ...s,
    ore: s.ore - spec.cost,
    stage: s.stage === 0 && spec.emits !== null ? 1 : s.stage,
    machines: [...s.machines, machine],
    nextId: s.nextId + 1,
  };
}

/** Takes a machine away and refunds half its cost (rounded down). Metrics and stage stay. */
export function remove(s: PlotState, id: number): PlotState {
  const gone = s.machines.find((m) => m.id === id);
  if (gone === undefined) return s;
  const refund = Math.floor(KINDS[gone.kind].cost / 2);
  return {
    ...s,
    ore: Math.max(s.ore, Math.min(ORE_CAP, s.ore + refund)),
    machines: s.machines.filter((m) => m.id !== id),
  };
}

export function setOn(s: PlotState, id: number, on: boolean): PlotState {
  return { ...s, machines: s.machines.map((m) => (m.id === id ? { ...m, on } : m)) };
}

/** Slots a preset cartridge (or empties the slot with null). Throws on a machine without a slot. */
export function setCartridge(s: PlotState, id: number, cartridge: string | null): PlotState {
  const target = s.machines.find((m) => m.id === id);
  if (target === undefined) return s;
  if (!KINDS[target.kind].slot) throw new Error(`The ${KINDS[target.kind].name.toLowerCase()} has no cartridge slot.`);
  return { ...s, machines: s.machines.map((m) => (m.id === id ? { ...m, cartridge } : m)) };
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

function advance(s: PlotState, env: Env, h: number, events: PlotEvent[]): PlotState {
  const z = solve(s, env, h);

  const ore = clamp(s.ore + (z.mined - z.used) * h, 0, ORE_CAP);
  const points: Record<Metric, number> = { ...s.points };
  for (const m of METRICS) points[m] = Math.min(TARGET[m], s.points[m] + z.emit[m] * h);

  const starved = z.needsOre && z.oreFactor < 1;
  const short = z.satisfaction < 1;
  if (short && s.underpowered !== true) events.push({ type: 'underpowered' });
  if (starved && s.oreOut !== true) events.push({ type: 'ore-out' });

  let stage = s.stage;
  if (stage === 0 && hasPixelMachine(s)) {
    stage = 1;
    events.push({ type: 'stage-up', stage });
  }
  while (stage >= 1 && stage < LAST_STAGE && meets(STAGES[stage + 1], points)) {
    stage += 1;
    events.push({ type: 'stage-up', stage });
  }

  return {
    v: 1,
    time: s.time + h,
    ore,
    points,
    stage,
    machines: s.machines,
    nextId: s.nextId,
    ...(starved ? { oreOut: true as const } : {}),
    ...(short ? { underpowered: true as const } : {}),
  };
}

function meets(needs: Readonly<Partial<Record<Metric, number>>> | undefined, points: Readonly<Record<Metric, number>>): boolean {
  if (needs === undefined) return false;
  for (const m of METRICS) {
    const need = needs[m];
    if (need !== undefined && levelOf(points[m], m) < need) return false;
  }
  return true;
}

/**
 * Advances dt seconds, in steps of at most 1 s (so one big step equals many small ones).
 * Events: each stage reached; 'ore-out' when the stock runs dry while machines need ore (once, and
 * again only after it recovered); 'underpowered' when satisfaction first drops below 1 (same rule).
 */
export function step(s: PlotState, env: Env, dt: number): { readonly state: PlotState; readonly events: readonly PlotEvent[] } {
  const events: PlotEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0) return { state: s, events };
  let left = Math.min(dt, MAX_STEP_SECONDS);
  let state = s;
  while (left > EPS) {
    const h = Math.min(1, left);
    state = advance(state, env, h, events);
    left -= h;
  }
  return { state, events };
}

// ---------------------------------------------------------------------------------------------
// For the HUD
// ---------------------------------------------------------------------------------------------

/** What the next stage needs, and how close it is (the smallest level/need over its metrics, 0..1). Null at stage 6. */
export function nextStage(
  s: PlotState,
): { readonly stage: number; readonly needs: Readonly<Partial<Record<Metric, number>>>; readonly progress: number } | null {
  if (s.stage >= LAST_STAGE) return null;
  const stage = s.stage + 1;
  const needs: Partial<Record<Metric, number>> = { ...(STAGES[stage] ?? {}) };
  let progress = 1;
  let counted = 0;
  for (const m of METRICS) {
    const need = needs[m];
    if (need === undefined) continue;
    counted += 1;
    progress = Math.min(progress, Math.min(1, level(s, m) / need));
  }
  if (counted === 0) progress = hasPixelMachine(s) ? 1 : 0; // stage 1: place a pixel machine
  return { stage, needs, progress };
}

/** Net rates for the HUD: ore/s, points/s per metric, power. */
export function rates(
  s: PlotState,
  env: Env,
): { readonly ore: number; readonly points: Readonly<Record<Metric, number>>; readonly supply: number; readonly demand: number } {
  const z = solve(s, env, 1);
  let ore = z.mined - z.used;
  if (s.ore >= ORE_CAP && ore > 0) ore = 0; // the heaps are full
  const points: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const m of METRICS) points[m] = s.points[m] >= TARGET[m] ? 0 : z.emit[m];
  return { ore, points, supply: z.supply, demand: z.demand };
}

// ---------------------------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isKind(v: unknown): v is MachineKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(KINDS, v);
}

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

function loadMachine(raw: unknown): Machine | null {
  if (!isRecord(raw)) return null;
  const id = raw['id'];
  const kind = raw['kind'];
  const x = raw['x'];
  const z = raw['z'];
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return null;
  if (!isKind(kind)) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof z !== 'number' || !Number.isFinite(z)) return null;
  const cartridge = raw['cartridge'];
  return {
    id,
    kind,
    x,
    z,
    yaw: num(raw['yaw'], 0, -1e6, 1e6),
    on: typeof raw['on'] === 'boolean' ? raw['on'] : true,
    cartridge: KINDS[kind].slot && typeof cartridge === 'string' ? cartridge : null,
    built: num(raw['built'], 0, 0, 1e12),
  };
}

/** A saved state, checked: junk falls back to newPlot(); bad machines are dropped; numbers clamped. */
export function loadPlot(raw: unknown): PlotState {
  const fresh = newPlot();
  if (!isRecord(raw) || raw['v'] !== 1) return fresh;
  const savedPoints = isRecord(raw['points']) ? raw['points'] : {};
  const points: Record<Metric, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const m of METRICS) points[m] = num(savedPoints[m], 0, 0, TARGET[m]);

  const machines: Machine[] = [];
  const seen = new Set<number>();
  if (Array.isArray(raw['machines'])) {
    for (const item of raw['machines'] as readonly unknown[]) {
      const m = loadMachine(item);
      if (m === null || seen.has(m.id)) continue;
      seen.add(m.id);
      machines.push(m);
    }
  }
  const highest = machines.reduce((top, m) => Math.max(top, m.id), 0);

  return {
    v: 1,
    time: num(raw['time'], 0, 0, 1e12),
    ore: num(raw['ore'], fresh.ore, 0, ORE_CAP),
    points,
    stage: Math.floor(num(raw['stage'], 0, 0, LAST_STAGE)),
    machines,
    nextId: Math.max(1, highest + 1, Math.floor(num(raw['nextId'], 1, 1, 1e9))),
    ...(raw['oreOut'] === true ? { oreOut: true as const } : {}),
    ...(raw['underpowered'] === true ? { underpowered: true as const } : {}),
  };
}
