// Plot economy simulation for a terraforming game.
// Pure, deterministic, JSON-serialisable state. No DOM, no Date, no Math.random.

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';
export const METRICS: readonly Metric[] = ['pxd', 'vtx', 'lx', 'aq'];

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export type MachineKind = 'drill' | 'mill' | 'pylon' | 'press' | 'power' | 'projector' | 'water';

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
  drill: {
    kind: 'drill', name: 'Rock drill', cost: 15, draw: 3, oreUse: 0, mine: 2.0,
    emits: null, rate: 0, reach: 0, unlock: 0, slot: false, radius: 1.5,
  },
  mill: {
    kind: 'mill', name: 'Texture mill', cost: 15, draw: 3, oreUse: 0.3, mine: 0,
    emits: 'pxd', rate: 1, reach: 0, unlock: 0, slot: true, radius: 1.5,
  },
  pylon: {
    kind: 'pylon', name: 'Relay pylon', cost: 10, draw: 0, oreUse: 0, mine: 0,
    emits: null, rate: 0, reach: 35, unlock: 0, slot: false, radius: 1,
  },
  press: {
    kind: 'press', name: 'Shape press', cost: 25, draw: 4, oreUse: 0.4, mine: 0,
    emits: 'vtx', rate: 1, reach: 0, unlock: 1, slot: true, radius: 1.5,
  },
  power: {
    kind: 'power', name: 'Power unit', cost: 40, draw: -14, oreUse: 0.6, mine: 0,
    emits: null, rate: 0, reach: 30, unlock: 1, slot: false, radius: 2,
  },
  projector: {
    kind: 'projector', name: 'Light projector', cost: 35, draw: 7, oreUse: 0, mine: 0,
    emits: 'lx', rate: 1, reach: 0, unlock: 2, slot: true, radius: 1.5,
  },
  water: {
    kind: 'water', name: 'Water maker', cost: 35, draw: 5, oreUse: 0.5, mine: 0,
    emits: 'aq', rate: 1, reach: 0, unlock: 3, slot: true, radius: 1.5,
  },
};

export const GATE = { supply: 15, reach: 40, pad: 5 } as const;

export const ORE_CAP = 3000;

export const TARGET: Readonly<Record<Metric, number>> = {
  pxd: 32000,
  vtx: 16000,
  lx: 12000,
  aq: 40000,
};

export const STAGES: readonly Readonly<Partial<Record<Metric, number>>>[] = [
  {},
  {},
  { pxd: 15, vtx: 10 },
  { pxd: 30, vtx: 25, lx: 15 },
  { pxd: 50, vtx: 45, lx: 35, aq: 20 },
  { pxd: 75, vtx: 70, lx: 60, aq: 50 },
  { pxd: 100, vtx: 100, lx: 100, aq: 100 },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

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

/** Internal bookkeeping so events fire once per episode of trouble, and the
 * stage-0 -> stage-1 jump is remembered even if the triggering machine is
 * later removed (the plot never loses its stage). */
interface Flags {
  readonly pixelBuilt: boolean;
  readonly oreOut: boolean;
  readonly underpowered: boolean;
}

export interface PlotState {
  readonly v: 1;
  readonly time: number;
  readonly ore: number;
  readonly points: Readonly<Record<Metric, number>>;
  readonly stage: number;
  readonly machines: readonly Machine[];
  readonly nextId: number;
  readonly flags: Flags;
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

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const EPS = 1e-9;

function dist(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function emptyPoints(): Record<Metric, number> {
  return { pxd: 0, vtx: 0, lx: 0, aq: 0 };
}

function stageNeed(stage: number): Readonly<Partial<Record<Metric, number>>> {
  const need = STAGES[stage];
  return need ?? {};
}

function levelFromPoints(points: number, m: Metric): number {
  const target = TARGET[m];
  const v = 100 * Math.sqrt(Math.max(0, points) / target);
  return Math.min(100, v);
}

export function level(s: PlotState, m: Metric): number {
  return levelFromPoints(s.points[m], m);
}

function affinityOf(env: Env, m: Machine, metric: Metric): number {
  if (m.cartridge !== null && env.affinity) return env.affinity(m.cartridge, metric);
  return 1;
}

function recomputeStage(points: Readonly<Record<Metric, number>>, currentStage: number, pixelBuilt: boolean): number {
  let stage = currentStage;
  if (pixelBuilt && stage < 1) stage = 1;
  while (stage < 6) {
    const need = stageNeed(stage + 1);
    const keys = Object.keys(need) as Metric[];
    const ok = keys.every((k) => levelFromPoints(points[k], k) >= (need[k] as number) - EPS);
    if (!ok) break;
    stage++;
  }
  return stage;
}

// ---------------------------------------------------------------------------
// Power / ore network
// ---------------------------------------------------------------------------

interface NetworkNode {
  readonly x: number;
  readonly z: number;
  readonly reach: number;
}

function connectivityInfo(machines: readonly Machine[], env: Env): { nodes: NetworkNode[]; connected: Set<number> } {
  const nodes: NetworkNode[] = [{ x: env.gate.x, z: env.gate.z, reach: GATE.reach }];
  const nodeIds = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of machines) {
      if (m.kind !== 'pylon' && m.kind !== 'power') continue;
      if (nodeIds.has(m.id)) continue;
      for (const n of nodes) {
        if (dist(m.x, m.z, n.x, n.z) <= n.reach + EPS) {
          nodeIds.add(m.id);
          nodes.push({ x: m.x, z: m.z, reach: KINDS[m.kind].reach });
          changed = true;
          break;
        }
      }
    }
  }
  const connected = new Set<number>();
  for (const m of machines) {
    for (const n of nodes) {
      if (dist(m.x, m.z, n.x, n.z) <= n.reach + EPS) {
        connected.add(m.id);
        break;
      }
    }
  }
  return { nodes, connected };
}

interface Flow {
  readonly connected: ReadonlySet<number>;
  readonly demand: number;
  readonly supply: number;
  readonly satisfaction: number;
  readonly running: ReadonlyMap<number, number>;
  readonly oreFactor: number;
  readonly mineRate: number;
  readonly oreUseRate: number;
}

function computeFlow(s: PlotState, env: Env): Flow {
  const { connected } = connectivityInfo(s.machines, env);

  const drawers = s.machines.filter((m) => m.on && connected.has(m.id) && KINDS[m.kind].draw > 0);
  const demand = drawers.reduce((a, m) => a + KINDS[m.kind].draw, 0);

  const powerMachines = s.machines.filter((m) => m.kind === 'power' && m.on && connected.has(m.id));
  const supplyFull = GATE.supply + powerMachines.length * -KINDS.power.draw;
  const satisfaction1 = demand > 0 ? Math.min(1, supplyFull / demand) : 1;

  // Pass 1: estimate mining & ore demand assuming power units have ore.
  let mineRate1 = 0;
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    if (spec.mine <= 0) continue;
    const r = connected.has(m.id) && m.on ? satisfaction1 : 0;
    mineRate1 += spec.mine * env.richness(m.x, m.z) * r;
  }
  let oreDemand1 = 0;
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    if (spec.oreUse <= 0) continue;
    if (!m.on || !connected.has(m.id)) continue;
    oreDemand1 += m.kind === 'power' ? spec.oreUse : spec.oreUse * satisfaction1;
  }
  const oreFactor = s.ore > EPS ? 1 : oreDemand1 > EPS ? Math.min(1, mineRate1 / oreDemand1) : 1;

  // Pass 2: power units are ore-limited, so re-derive the real satisfaction.
  const supplyFinal = GATE.supply + powerMachines.length * -KINDS.power.draw * oreFactor;
  const satisfaction = demand > 0 ? Math.min(1, supplyFinal / demand) : 1;

  const running = new Map<number, number>();
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    if (!m.on || !connected.has(m.id)) {
      running.set(m.id, 0);
      continue;
    }
    if (m.kind === 'power') {
      running.set(m.id, oreFactor);
      continue;
    }
    if (m.kind === 'pylon') {
      running.set(m.id, 1);
      continue;
    }
    let r = spec.draw > 0 ? satisfaction : 1;
    if (spec.oreUse > 0) r = Math.min(r, oreFactor);
    running.set(m.id, r);
  }

  let mineRate = 0;
  let oreUseRate = 0;
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    const r = running.get(m.id) ?? 0;
    if (spec.mine > 0) mineRate += spec.mine * env.richness(m.x, m.z) * r;
    if (spec.oreUse > 0) oreUseRate += spec.oreUse * r;
  }

  return { connected, demand, supply: supplyFinal, satisfaction, running, oreFactor, mineRate, oreUseRate };
}

export function network(
  s: PlotState,
  env: Env,
): { readonly connected: ReadonlySet<number>; readonly supply: number; readonly demand: number; readonly satisfaction: number } {
  const flow = computeFlow(s, env);
  return { connected: flow.connected, supply: flow.supply, demand: flow.demand, satisfaction: flow.satisfaction };
}

export function running(s: PlotState, env: Env): ReadonlyMap<number, number> {
  return computeFlow(s, env).running;
}

export function rates(
  s: PlotState,
  env: Env,
): { readonly ore: number; readonly points: Readonly<Record<Metric, number>>; readonly supply: number; readonly demand: number } {
  const flow = computeFlow(s, env);
  const points = emptyPoints();
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    if (!spec.emits) continue;
    const r = flow.running.get(m.id) ?? 0;
    if (r <= 0) continue;
    points[spec.emits] += spec.rate * r * affinityOf(env, m, spec.emits);
  }
  return { ore: flow.mineRate - flow.oreUseRate, points, supply: flow.supply, demand: flow.demand };
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export function canPlace(
  s: PlotState,
  env: Env,
  kind: MachineKind,
  x: number,
  z: number,
): { readonly ok: true } | { readonly ok: false; readonly why: string } {
  const spec = KINDS[kind];

  if (s.stage < spec.unlock) return { ok: false, why: `Unlocks at stage ${spec.unlock}.` };

  const dGate = dist(x, z, env.gate.x, env.gate.z);
  if (dGate > env.plotRadius) return { ok: false, why: 'Outside your plot.' };

  if (dGate < GATE.pad + spec.radius) return { ok: false, why: 'Too close to the gate.' };

  for (const m of s.machines) {
    const other = KINDS[m.kind];
    if (dist(x, z, m.x, m.z) < spec.radius + other.radius + 1) {
      return { ok: false, why: `Too close to the ${other.name.toLowerCase()}.` };
    }
  }

  const { nodes } = connectivityInfo(s.machines, env);
  const inReach = nodes.some((n) => dist(x, z, n.x, n.z) <= n.reach + EPS);
  if (!inReach) return { ok: false, why: 'Out of reach of the power network: build a relay pylon closer.' };

  if (kind === 'drill' && env.richness(x, z) < 0.2) return { ok: false, why: 'Not enough ore in this ground.' };

  if (s.ore < spec.cost) return { ok: false, why: `Needs ${spec.cost} ore (you have ${Math.floor(s.ore)}).` };

  return { ok: true };
}

export function place(s: PlotState, env: Env, kind: MachineKind, x: number, z: number, yaw: number): PlotState {
  const check = canPlace(s, env, kind, x, z);
  if (!check.ok) throw new Error(check.why);
  const spec = KINDS[kind];
  const machine: Machine = { id: s.nextId, kind, x, z, yaw, on: true, cartridge: null, built: s.time };
  const machines = [...s.machines, machine];
  const ore = s.ore - spec.cost;
  const pixelBuilt = s.flags.pixelBuilt || spec.emits !== null;
  const stage = recomputeStage(s.points, s.stage, pixelBuilt);
  return { ...s, ore, machines, nextId: s.nextId + 1, stage, flags: { ...s.flags, pixelBuilt } };
}

export function remove(s: PlotState, id: number): PlotState {
  const m = s.machines.find((mm) => mm.id === id);
  if (!m) return s;
  const refund = Math.floor(KINDS[m.kind].cost / 2);
  const machines = s.machines.filter((mm) => mm.id !== id);
  return { ...s, ore: clamp(s.ore + refund, 0, ORE_CAP), machines };
}

export function setOn(s: PlotState, id: number, on: boolean): PlotState {
  const machines = s.machines.map((m) => (m.id === id ? { ...m, on } : m));
  return { ...s, machines };
}

export function setCartridge(s: PlotState, id: number, cartridge: string | null): PlotState {
  const m = s.machines.find((mm) => mm.id === id);
  if (!m) return s;
  if (!KINDS[m.kind].slot) throw new Error(`${KINDS[m.kind].name} has no cartridge slot.`);
  const machines = s.machines.map((mm) => (mm.id === id ? { ...mm, cartridge } : mm));
  return { ...s, machines };
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

function applySubstep(s: PlotState, env: Env, h: number): { next: PlotState; events: PlotEvent[] } {
  const flow = computeFlow(s, env);
  const events: PlotEvent[] = [];

  let ore = s.ore + (flow.mineRate - flow.oreUseRate) * h;
  ore = clamp(ore, 0, ORE_CAP);

  const points = { ...s.points };
  for (const m of s.machines) {
    const spec = KINDS[m.kind];
    if (!spec.emits) continue;
    const r = flow.running.get(m.id) ?? 0;
    if (r <= 0) continue;
    const metric = spec.emits;
    points[metric] = points[metric] + spec.rate * r * affinityOf(env, m, metric) * h;
  }

  const pixelBuilt = s.flags.pixelBuilt || s.machines.some((m) => KINDS[m.kind].emits !== null);
  const stage = recomputeStage(points, s.stage, pixelBuilt);
  for (let st = s.stage + 1; st <= stage; st++) events.push({ type: 'stage-up', stage: st });

  const oreStarved = flow.oreFactor < 1 - EPS;
  let oreOut = s.flags.oreOut;
  if (oreStarved && !oreOut) {
    events.push({ type: 'ore-out' });
    oreOut = true;
  } else if (!oreStarved) {
    oreOut = false;
  }

  const underpoweredNow = flow.satisfaction < 1 - EPS;
  let underpowered = s.flags.underpowered;
  if (underpoweredNow && !underpowered) {
    events.push({ type: 'underpowered' });
    underpowered = true;
  } else if (!underpoweredNow) {
    underpowered = false;
  }

  const next: PlotState = {
    ...s,
    time: s.time + h,
    ore,
    points,
    stage,
    flags: { pixelBuilt, oreOut, underpowered },
  };
  return { next, events };
}

export function step(s: PlotState, env: Env, dt: number): { readonly state: PlotState; readonly events: readonly PlotEvent[] } {
  let cur = s;
  let remaining = dt;
  const events: PlotEvent[] = [];
  while (remaining > EPS) {
    const h = Math.min(1, remaining);
    const { next, events: ev } = applySubstep(cur, env, h);
    cur = next;
    events.push(...ev);
    remaining -= h;
  }
  return { state: cur, events };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function nextStage(
  s: PlotState,
): { readonly stage: number; readonly needs: Readonly<Partial<Record<Metric, number>>>; readonly progress: number } | null {
  if (s.stage >= 6) return null;
  const stage = s.stage + 1;
  const needs = stageNeed(stage);
  const keys = Object.keys(needs) as Metric[];
  let progress = 1;
  if (keys.length > 0) {
    progress = Math.min(...keys.map((k) => Math.min(1, level(s, k) / (needs[k] as number))));
  }
  return { stage, needs, progress };
}

// ---------------------------------------------------------------------------
// New plot / persistence
// ---------------------------------------------------------------------------

export function newPlot(): PlotState {
  return {
    v: 1,
    time: 0,
    ore: 60,
    points: emptyPoints(),
    stage: 0,
    machines: [],
    nextId: 1,
    flags: { pixelBuilt: false, oreOut: false, underpowered: false },
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function loadPlot(raw: unknown): PlotState {
  const fallback = newPlot();
  if (typeof raw !== 'object' || raw === null) return fallback;
  const r = raw as Record<string, unknown>;
  if (r['v'] !== 1) return fallback;

  const ore = isFiniteNumber(r['ore']) ? clamp(r['ore'], 0, ORE_CAP) : fallback.ore;
  const time = isFiniteNumber(r['time']) && r['time'] >= 0 ? r['time'] : fallback.time;

  const pointsRaw = typeof r['points'] === 'object' && r['points'] !== null ? (r['points'] as Record<string, unknown>) : {};
  const points = emptyPoints();
  for (const m of METRICS) {
    const v = pointsRaw[m];
    points[m] = isFiniteNumber(v) && v >= 0 ? v : 0;
  }

  const machinesRaw = Array.isArray(r['machines']) ? (r['machines'] as unknown[]) : [];
  const seen = new Set<number>();
  const machines: Machine[] = [];
  for (const raw0 of machinesRaw) {
    if (typeof raw0 !== 'object' || raw0 === null) continue;
    const mo = raw0 as Record<string, unknown>;
    const kind = mo['kind'];
    if (typeof kind !== 'string' || !(kind in KINDS)) continue;
    if (!isFiniteNumber(mo['id'])) continue;
    const id = Math.floor(mo['id']);
    if (seen.has(id)) continue;
    const x = isFiniteNumber(mo['x']) ? mo['x'] : 0;
    const z = isFiniteNumber(mo['z']) ? mo['z'] : 0;
    const yaw = isFiniteNumber(mo['yaw']) ? mo['yaw'] : 0;
    const on = typeof mo['on'] === 'boolean' ? mo['on'] : true;
    const cartridge = typeof mo['cartridge'] === 'string' ? mo['cartridge'] : null;
    const built = isFiniteNumber(mo['built']) ? mo['built'] : 0;
    seen.add(id);
    machines.push({ id, kind: kind as MachineKind, x, z, yaw, on, cartridge, built });
  }

  const maxId = machines.reduce((a, m) => Math.max(a, m.id), 0);
  const nextId = isFiniteNumber(r['nextId']) && r['nextId'] > maxId ? Math.floor(r['nextId']) : maxId + 1;
  const stage = isFiniteNumber(r['stage']) ? clamp(Math.floor(r['stage']), 0, 6) : 0;

  const flagsRaw = typeof r['flags'] === 'object' && r['flags'] !== null ? (r['flags'] as Record<string, unknown>) : {};
  const pixelBuilt =
    typeof flagsRaw['pixelBuilt'] === 'boolean' ? flagsRaw['pixelBuilt'] : machines.some((m) => KINDS[m.kind].emits !== null);
  const oreOut = typeof flagsRaw['oreOut'] === 'boolean' ? flagsRaw['oreOut'] : false;
  const underpowered = typeof flagsRaw['underpowered'] === 'boolean' ? flagsRaw['underpowered'] : false;

  return { v: 1, time, ore, points, stage, machines, nextId, flags: { pixelBuilt, oreOut, underpowered } };
}
