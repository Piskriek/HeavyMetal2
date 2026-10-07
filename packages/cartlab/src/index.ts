/**
 * @hm/cartlab — the lab's cartridges, for a terraforming game.
 *
 * The plot's pixel machines pour pixels that raise four metrics. A cartridge in a
 * machine's slot scales what it pours, per metric, by its affinity. The lab has
 * three machines for cartridges:
 *
 *  - the preset bench writes one preset onto one blank (RULES.writeSeconds of powered time);
 *  - the preset combiner mixes 2 to 4 written cartridges into a new one (RULES.combineSeconds);
 *  - the preset rack holds up to RULES.rackSize cartridges; its indexer glows for
 *    RULES.catalogueSeconds after a cartridge is added.
 *
 * All state is plain JSON data and every function is pure: it returns new data and
 * never mutates its input. No imports, no DOM, no clock, no randomness.
 */

export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';

/** Texture, shape, light and water, in that order. */
export const METRICS: readonly Metric[] = Object.freeze(['pxd', 'vtx', 'lx', 'aq'] as const);

export const RULES: {
  readonly blankCost: 12;
  readonly rackSize: 48;
  readonly writeSeconds: 20;
  readonly combineSeconds: 45;
  readonly catalogueSeconds: 2;
  readonly minInputs: 2;
  readonly maxInputs: 4;
} = Object.freeze({
  blankCost: 12,
  rackSize: 48,
  writeSeconds: 20,
  combineSeconds: 45,
  catalogueSeconds: 2,
  minInputs: 2,
  maxInputs: 4,
} as const);

export interface Preset {
  readonly id: string;
  readonly name: string;
  /** A missing metric is 1. */
  readonly affinity: Readonly<Partial<Record<Metric, number>>>;
  /** The plot stage that opens this preset for writing. */
  readonly minStage: number;
}

/**
 * Ids run 'c1', 'c2', ... in the order made. A written cartridge keeps its id and
 * takes the preset's name, kind 'preset' and preset = the preset's id. A mix gets a
 * new id, kind 'mix', preset null, the inputs' names joined with ' + ' in the order
 * given, and from = the inputs' ids. A blank: name 'Blank', preset null, from [],
 * every affinity 1.
 */
export interface Cartridge {
  readonly id: string;
  readonly name: string;
  readonly kind: 'blank' | 'preset' | 'mix';
  readonly preset: string | null;
  readonly from: readonly string[];
  readonly affinity: Readonly<Record<Metric, number>>;
  /** null: in the rack. A number: in that plot machine. */
  readonly slot: number | null;
}

/**
 * A job on the bench (one blank and a preset id) or in the combiner (2 to 4
 * cartridges, preset null). done and needs are seconds of powered time.
 *
 * While a power cut has it paused, a job also carries `stalled: true`. The rule
 * "one 'stalled' event per cut" needs that one bit of memory, and LabState has
 * nowhere else to keep it. The key is dropped the moment the job runs again, and
 * loadLab accepts and keeps it.
 */
export interface Job {
  readonly inputs: readonly string[];
  readonly preset: string | null;
  readonly done: number;
  readonly needs: number;
}

export interface LabState {
  readonly v: 1;
  readonly time: number;
  readonly nextId: number;
  readonly cartridges: readonly Cartridge[];
  readonly bench: Job | null;
  readonly combiner: Job | null;
  readonly catalogueUntil: number;
}

export interface LabEnv {
  readonly presets: readonly Preset[];
  readonly stage: number;
  /** The gate: the bench and the combiner only work while it is on. */
  readonly powered: boolean;
}

export type LabEvent =
  | { readonly type: 'written'; readonly id: string }
  | { readonly type: 'combined'; readonly id: string }
  | { readonly type: 'stalled'; readonly machine: 'bench' | 'combiner' };

/** why is '' when ok, else one plain sentence for the player. */
export interface Check {
  readonly ok: boolean;
  readonly why: string;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Machine = 'bench' | 'combiner';

/** A combined affinity stays within these bounds. */
const MIN_AFFINITY = 0.5;
const MAX_AFFINITY = 3;

const OK: Check = Object.freeze({ ok: true, why: '' });
const no = (why: string): Check => ({ ok: false, why });
const NO_POWER = 'No power: turn the gate on.';

const orThrow = (check: Check): void => {
  if (!check.ok) throw new Error(check.why);
};

const byMetric = (f: (m: Metric) => number): Record<Metric, number> => ({
  pxd: f('pxd'),
  vtx: f('vtx'),
  lx: f('lx'),
  aq: f('aq'),
});

const find = (s: LabState, id: string): Cartridge | undefined => s.cartridges.find((c) => c.id === id);

/** The machine whose job holds the cartridge, if any. */
const jobOf = (s: LabState, id: string): Machine | null => {
  if (s.bench !== null && s.bench.inputs.includes(id)) return 'bench';
  if (s.combiner !== null && s.combiner.inputs.includes(id)) return 'combiner';
  return null;
};

const busyWhy = (c: Cartridge, where: Machine): string => {
  const who = c.kind === 'blank' ? 'That blank' : c.name;
  return where === 'bench' ? `${who} is being written on the bench.` : `${who} is being mixed in the combiner.`;
};

type PausedJob = Job & { readonly stalled: true };

const isPaused = (job: Job): boolean => 'stalled' in job && job.stalled === true;

const paused = (job: Job): Job => {
  const p: PausedJob = { inputs: job.inputs, preset: job.preset, done: job.done, needs: job.needs, stalled: true };
  return p;
};

/** The job after it has run: a running job is never marked stalled. */
const running = (job: Job, done: number): Job => ({ inputs: job.inputs, preset: job.preset, done, needs: job.needs });

const presetAffinity = (p: Preset): Record<Metric, number> =>
  byMetric((m) => {
    const v = p.affinity[m];
    return typeof v === 'number' && Number.isFinite(v) ? v : 1;
  });

/** Per metric: the best gain in full, every other gain at half, clamped to [0.5, 3]. */
const combineAffinity = (affinities: readonly number[]): number => {
  const gains = affinities.map((a) => a - 1).sort((x, y) => y - x);
  let gain = 0;
  gains.forEach((g, i) => {
    gain += i === 0 ? g : g / 2;
  });
  return Math.min(MAX_AFFINITY, Math.max(MIN_AFFINITY, 1 + gain));
};

// ---------------------------------------------------------------------------
// The lab
// ---------------------------------------------------------------------------

export function newLab(): LabState {
  return { v: 1, time: 0, nextId: 1, cartridges: [], bench: null, combiner: null, catalogueUntil: 0 };
}

/** Cartridges not in a plot machine. Cartridges in a lab job still sit on the rack. */
export function rackCount(s: LabState): number {
  let n = 0;
  for (const c of s.cartridges) if (c.slot === null) n += 1;
  return n;
}

export function canMakeBlank(s: LabState, ore: number): Check {
  if (!(ore >= RULES.blankCost)) return no(`Not enough ore: a blank costs ${RULES.blankCost}.`);
  if (rackCount(s) >= RULES.rackSize) return no(`The rack is full: ${RULES.rackSize} cartridges.`);
  return OK;
}

/** Makes a blank and puts it in the rack. Throws Error(why) when refused. */
export function makeBlank(s: LabState, ore: number): { readonly state: LabState; readonly oreUsed: number } {
  orThrow(canMakeBlank(s, ore));
  const blank: Cartridge = {
    id: `c${s.nextId}`,
    name: 'Blank',
    kind: 'blank',
    preset: null,
    from: [],
    affinity: byMetric(() => 1),
    slot: null,
  };
  return {
    state: {
      ...s,
      nextId: s.nextId + 1,
      cartridges: [...s.cartridges, blank],
      catalogueUntil: s.time + RULES.catalogueSeconds,
    },
    oreUsed: RULES.blankCost,
  };
}

export function canWrite(s: LabState, env: LabEnv, blank: string, preset: string): Check {
  if (!env.powered) return no(NO_POWER);
  if (s.bench !== null) return no('The bench is busy: wait for its write to finish.');
  const c = find(s, blank);
  if (c === undefined) return no('That cartridge is not in the lab.');
  if (c.kind !== 'blank') return no(`${c.name} is not a blank: presets go on blanks only.`);
  const busy = jobOf(s, c.id);
  if (busy !== null) return no(busyWhy(c, busy));
  const p = env.presets.find((x) => x.id === preset);
  if (p === undefined) return no('There is no such preset.');
  if (!(p.minStage <= env.stage)) return no(`That preset opens at stage ${p.minStage}.`);
  return OK;
}

/** Puts a blank and a preset on the bench. Throws Error(why) when refused. */
export function startWrite(s: LabState, env: LabEnv, blank: string, preset: string): LabState {
  orThrow(canWrite(s, env, blank, preset));
  return { ...s, bench: { inputs: [blank], preset, done: 0, needs: RULES.writeSeconds } };
}

export function canCombine(s: LabState, env: LabEnv, ids: readonly string[]): Check {
  if (!env.powered) return no(NO_POWER);
  if (s.combiner !== null) return no('The combiner is busy: wait for its mix to finish.');
  if (ids.length < RULES.minInputs || ids.length > RULES.maxInputs) {
    return no(`The combiner takes ${RULES.minInputs} to ${RULES.maxInputs} cartridges.`);
  }
  if (new Set(ids).size !== ids.length) return no('Each cartridge can go in only once.');
  const inputs: Cartridge[] = [];
  for (const id of ids) {
    const c = find(s, id);
    if (c === undefined) return no('One of those cartridges is not in the lab.');
    inputs.push(c);
  }
  if (inputs.some((c) => c.kind === 'blank')) return no('A blank has nothing to mix: write a preset on it first.');
  for (const c of inputs) {
    if (c.slot !== null) return no(`${c.name} is in a machine: take it out first.`);
    const busy = jobOf(s, c.id);
    if (busy !== null) return no(busyWhy(c, busy));
  }
  return OK;
}

/** Loads 2 to 4 written cartridges into the combiner. Throws Error(why) when refused. */
export function startCombine(s: LabState, env: LabEnv, ids: readonly string[]): LabState {
  orThrow(canCombine(s, env, ids));
  return { ...s, combiner: { inputs: [...ids], preset: null, done: 0, needs: RULES.combineSeconds } };
}

export function canSlot(s: LabState, id: string, machine: number): Check {
  const c = find(s, id);
  if (c === undefined) return no('That cartridge is not in the lab.');
  if (c.kind === 'blank') return no('A blank does nothing: write a preset on it first.');
  if (c.slot !== null) return no(`${c.name} is already in a machine: take it out first.`);
  const busy = jobOf(s, c.id);
  if (busy !== null) return no(busyWhy(c, busy));
  if (!Number.isFinite(machine)) return no('There is no such machine.');
  return OK;
}

/** Puts a written cartridge into a plot machine's slot. Throws Error(why) when refused. */
export function slotInto(s: LabState, id: string, machine: number): LabState {
  orThrow(canSlot(s, id, machine));
  const slot = machine === 0 ? 0 : machine; // -0 would not survive a JSON round trip
  return { ...s, cartridges: s.cartridges.map((c) => (c.id === id ? { ...c, slot } : c)) };
}

/**
 * Back to the rack; unchanged if it is there already (or unknown). This never
 * refuses, so a full rack can go over RULES.rackSize this way; making blanks
 * stays refused until it is back under.
 */
export function unslot(s: LabState, id: string): LabState {
  const c = find(s, id);
  if (c === undefined || c.slot === null) return s;
  return { ...s, cartridges: s.cartridges.map((x) => (x.id === id ? { ...x, slot: null } : x)) };
}

/**
 * Moves time on by dt seconds (a negative or non-finite dt counts as 0). Powered,
 * each job's done grows by dt and a job finishes once done >= needs. Unpowered,
 * nothing progresses, and each machine with a job reports one 'stalled' event when
 * it stops, then again only after it has run since.
 */
export function step(s: LabState, env: LabEnv, dt: number): { readonly state: LabState; readonly events: readonly LabEvent[] } {
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const events: LabEvent[] = [];
  const now: LabState = { ...s, time: s.time + d };
  if (!env.powered) {
    const stall = (job: Job | null, machine: Machine): Job | null => {
      if (job === null || isPaused(job)) return job;
      events.push({ type: 'stalled', machine });
      return paused(job);
    };
    const bench = stall(now.bench, 'bench');
    const combiner = stall(now.combiner, 'combiner');
    return { state: { ...now, bench, combiner }, events };
  }
  return { state: runCombiner(runBench(now, env, d, events), d, events), events };
}

function runBench(s: LabState, env: LabEnv, d: number, events: LabEvent[]): LabState {
  const job = s.bench;
  if (job === null) return s;
  const done = job.done + d;
  const preset = env.presets.find((p) => p.id === job.preset);
  if (done < job.needs || preset === undefined) {
    // Still writing, or the preset has gone from env.presets: the job never fails,
    // it waits at the finish line until the preset is back.
    return { ...s, bench: running(job, Math.min(done, job.needs)) };
  }
  const target = job.inputs[0];
  const blank = target === undefined ? undefined : find(s, target);
  if (blank === undefined) return { ...s, bench: null }; // nothing to write on (hand-made states only)
  events.push({ type: 'written', id: blank.id });
  const written: Cartridge = {
    id: blank.id,
    name: preset.name,
    kind: 'preset',
    preset: preset.id,
    from: [],
    affinity: presetAffinity(preset),
    slot: blank.slot,
  };
  return { ...s, bench: null, cartridges: s.cartridges.map((c) => (c.id === blank.id ? written : c)) };
}

function runCombiner(s: LabState, d: number, events: LabEvent[]): LabState {
  const job = s.combiner;
  if (job === null) return s;
  const done = job.done + d;
  if (done < job.needs) return { ...s, combiner: running(job, done) };
  const inputs: Cartridge[] = [];
  for (const id of job.inputs) {
    const c = find(s, id);
    if (c !== undefined) inputs.push(c);
  }
  if (inputs.length === 0) return { ...s, combiner: null }; // nothing to mix (hand-made states only)
  const mix: Cartridge = {
    id: `c${s.nextId}`,
    name: inputs.map((c) => c.name).join(' + '),
    kind: 'mix',
    preset: null,
    from: inputs.map((c) => c.id),
    affinity: byMetric((m) => combineAffinity(inputs.map((c) => c.affinity[m]))),
    slot: null,
  };
  events.push({ type: 'combined', id: mix.id });
  return {
    ...s,
    nextId: s.nextId + 1,
    cartridges: [...s.cartridges.filter((c) => !job.inputs.includes(c.id)), mix],
    combiner: null,
    catalogueUntil: s.time + RULES.catalogueSeconds,
  };
}

/** 0..1: how hard each lab machine works right now, for its pixels. */
export function activity(s: LabState, env: LabEnv): { readonly bench: number; readonly combiner: number; readonly rack: number } {
  const on = env.powered;
  return {
    bench: on && s.bench !== null ? 1 : 0,
    combiner: on && s.combiner !== null ? 1 : 0,
    rack: on && s.time < s.catalogueUntil ? 1 : 0,
  };
}

/** The factor a cartridge applies to a metric: 1 for an unknown id or a blank. */
export function affinityOf(s: LabState, id: string, metric: Metric): number {
  const c = find(s, id);
  if (c === undefined || c.kind === 'blank') return 1;
  const v: unknown = c.affinity[metric];
  return typeof v === 'number' ? v : 1;
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

type Json = { readonly [key: string]: unknown };

const isRecord = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const isList = (x: unknown): x is readonly unknown[] => Array.isArray(x);
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isString = (x: unknown): x is string => typeof x === 'string';
const CARTRIDGE_ID = /^c([1-9][0-9]*)$/;

const stringList = (x: unknown): string[] | null => {
  if (!isList(x)) return null;
  const out: string[] = [];
  for (const v of x) {
    if (!isString(v)) return null;
    out.push(v);
  }
  return out;
};

function loadCartridge(x: unknown, nextId: number): Cartridge | null {
  if (!isRecord(x)) return null;
  const { id, name, kind, preset, from, affinity, slot } = x;
  if (!isString(id) || !isString(name)) return null;
  const n = CARTRIDGE_ID.exec(id)?.[1];
  if (n === undefined || !(Number(n) < nextId)) return null; // only ids already handed out
  if (kind !== 'blank' && kind !== 'preset' && kind !== 'mix') return null;
  if (preset !== null && !isString(preset)) return null;
  if ((kind === 'preset') !== (preset !== null)) return null; // only a written preset names one
  const fromIds = stringList(from);
  if (fromIds === null || !isRecord(affinity)) return null;
  const { pxd, vtx, lx, aq } = affinity;
  if (!isNumber(pxd) || !isNumber(vtx) || !isNumber(lx) || !isNumber(aq)) return null;
  if (slot !== null && !isNumber(slot)) return null;
  if (kind === 'blank' && (slot !== null || fromIds.length > 0 || pxd !== 1 || vtx !== 1 || lx !== 1 || aq !== 1)) {
    return null; // blanks never go in a machine and do nothing
  }
  return { id, name, kind, preset, from: fromIds, affinity: { pxd, vtx, lx, aq }, slot };
}

function loadJob(x: unknown): Job | null {
  if (!isRecord(x)) return null;
  const { inputs, preset, done, needs, stalled } = x;
  const ids = stringList(inputs);
  if (ids === null) return null;
  if (preset !== null && !isString(preset)) return null;
  if (!isNumber(done) || done < 0 || !isNumber(needs) || needs < 0) return null;
  if (stalled !== undefined && typeof stalled !== 'boolean') return null;
  const job: Job = { inputs: ids, preset, done, needs };
  return stalled === true ? paused(job) : job;
}

/** The bench writes one preset onto one blank. */
function benchHolds(job: Job, byId: ReadonlyMap<string, Cartridge>): boolean {
  const [id, ...rest] = job.inputs;
  const c = id === undefined ? undefined : byId.get(id);
  return job.preset !== null && rest.length === 0 && c !== undefined && c.kind === 'blank';
}

/** The combiner holds 2 to 4 different written cartridges from the rack. */
function combinerHolds(job: Job, byId: ReadonlyMap<string, Cartridge>): boolean {
  const n = job.inputs.length;
  return (
    job.preset === null &&
    n >= RULES.minInputs &&
    n <= RULES.maxInputs &&
    new Set(job.inputs).size === n &&
    job.inputs.every((id) => {
      const c = byId.get(id);
      return c !== undefined && c.kind !== 'blank' && c.slot === null;
    })
  );
}

/**
 * Reads a save. Returns null for junk: a wrong v, missing or mistyped fields, the
 * same id twice, an id the lab has not handed out yet, a job naming a missing
 * cartridge, and labs the rules cannot make (a blank in a machine, a bench job
 * that is not one blank, a combiner job that is not 2 to 4 different written
 * cartridges from the rack). Unknown extra keys are dropped.
 */
export function loadLab(json: unknown): LabState | null {
  if (!isRecord(json)) return null;
  const { v, time, nextId, cartridges, bench, combiner, catalogueUntil } = json;
  if (v !== 1) return null;
  if (!isNumber(time) || time < 0 || !isNumber(catalogueUntil) || catalogueUntil < 0) return null;
  if (!isNumber(nextId) || !Number.isSafeInteger(nextId) || nextId < 1) return null;
  if (!isList(cartridges)) return null;
  const byId = new Map<string, Cartridge>();
  for (const x of cartridges) {
    const c = loadCartridge(x, nextId);
    if (c === null || byId.has(c.id)) return null;
    byId.set(c.id, c);
  }
  const b = bench === null ? null : loadJob(bench);
  const k = combiner === null ? null : loadJob(combiner);
  if (bench !== null && (b === null || !benchHolds(b, byId))) return null;
  if (combiner !== null && (k === null || !combinerHolds(k, byId))) return null;
  return { v: 1, time, nextId, cartridges: [...byId.values()], bench: b, combiner: k, catalogueUntil };
}
