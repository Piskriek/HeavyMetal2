export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';

export const METRICS: readonly Metric[] = ['pxd', 'vtx', 'lx', 'aq'];

export const RULES = {
  blankCost: 12,
  rackSize: 48,
  writeSeconds: 20,
  combineSeconds: 45,
  catalogueSeconds: 2,
  minInputs: 2,
  maxInputs: 4,
} as const;

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly affinity: Readonly<Partial<Record<Metric, number>>>;
  readonly minStage: number;
}

export interface Cartridge {
  readonly id: string;
  readonly name: string;
  readonly kind: 'blank' | 'preset' | 'mix';
  readonly preset: string | null;
  readonly from: readonly string[];
  readonly affinity: Readonly<Record<Metric, number>>;
  readonly slot: number | null;
}

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
  readonly powered: boolean;
}

export type LabEvent =
  | { readonly type: 'written'; readonly id: string }
  | { readonly type: 'combined'; readonly id: string }
  | { readonly type: 'stalled'; readonly machine: 'bench' | 'combiner' };

export interface Check {
  readonly ok: boolean;
  readonly why: string;
}

const accepted = (): Check => ({ ok: true, why: '' });
const refused = (why: string): Check => ({ ok: false, why });

function inJob(s: LabState, id: string): boolean {
  return (s.bench !== null && s.bench.inputs.includes(id)) ||
    (s.combiner !== null && s.combiner.inputs.includes(id));
}

function findCartridge(s: LabState, id: string): Cartridge | undefined {
  return s.cartridges.find((cartridge) => cartridge.id === id);
}

function hasDuplicateIds(ids: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

function affinityForPreset(preset: Preset): Record<Metric, number> {
  return {
    pxd: preset.affinity.pxd ?? 1,
    vtx: preset.affinity.vtx ?? 1,
    lx: preset.affinity.lx ?? 1,
    aq: preset.affinity.aq ?? 1,
  };
}

export function newLab(): LabState {
  return {
    v: 1,
    time: 0,
    nextId: 1,
    cartridges: [],
    bench: null,
    combiner: null,
    catalogueUntil: 0,
  };
}

export function rackCount(s: LabState): number {
  return s.cartridges.filter((cartridge) => cartridge.slot === null).length;
}

export function canMakeBlank(s: LabState, ore: number): Check {
  if (!(ore >= RULES.blankCost)) {
    return refused(`Not enough ore: a blank costs ${RULES.blankCost}.`);
  }
  if (rackCount(s) >= RULES.rackSize) {
    return refused(`The rack is full: ${RULES.rackSize} cartridges.`);
  }
  return accepted();
}

export function makeBlank(
  s: LabState,
  ore: number,
): { readonly state: LabState; readonly oreUsed: number } {
  const check = canMakeBlank(s, ore);
  if (!check.ok) throw new Error(check.why);

  const blank: Cartridge = {
    id: `c${s.nextId}`,
    name: 'Blank',
    kind: 'blank',
    preset: null,
    from: [],
    affinity: { pxd: 1, vtx: 1, lx: 1, aq: 1 },
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

export function canWrite(s: LabState, env: LabEnv, blank: string, presetId: string): Check {
  if (!env.powered) return refused('No power: turn the gate on.');
  if (s.bench !== null) return refused('The bench is busy.');

  const cartridge = findCartridge(s, blank);
  if (cartridge === undefined) return refused(`Unknown cartridge: ${blank}.`);
  if (cartridge.kind !== 'blank') return refused('That cartridge is not a blank.');
  if (inJob(s, blank)) return refused('That cartridge is being used in another job.');
  if (cartridge.slot !== null) return refused('A cartridge in a machine cannot go into a job.');

  const preset = env.presets.find((candidate) => candidate.id === presetId);
  if (preset === undefined) return refused(`Unknown preset: ${presetId}.`);
  if (preset.minStage > env.stage) {
    return refused(`That preset opens at stage ${preset.minStage}.`);
  }
  return accepted();
}

export function startWrite(s: LabState, env: LabEnv, blank: string, preset: string): LabState {
  const check = canWrite(s, env, blank, preset);
  if (!check.ok) throw new Error(check.why);

  return {
    ...s,
    bench: {
      inputs: [blank],
      preset,
      done: 0,
      needs: RULES.writeSeconds,
    },
  };
}

export function canCombine(s: LabState, env: LabEnv, ids: readonly string[]): Check {
  if (!env.powered) return refused('No power: turn the gate on.');
  if (s.combiner !== null) return refused('The combiner is busy.');
  if (ids.length < RULES.minInputs || ids.length > RULES.maxInputs) {
    return refused(`Choose ${RULES.minInputs} to ${RULES.maxInputs} cartridges.`);
  }
  if (hasDuplicateIds(ids)) return refused('Choose each cartridge only once.');

  const selected: Cartridge[] = [];
  for (const id of ids) {
    const cartridge = findCartridge(s, id);
    if (cartridge === undefined) return refused(`Unknown cartridge: ${id}.`);
    selected.push(cartridge);
  }
  if (selected.some((cartridge) => cartridge.kind === 'blank')) {
    return refused('A blank does nothing: write a preset on it first.');
  }
  if (selected.some((cartridge) => cartridge.slot !== null || inJob(s, cartridge.id))) {
    return refused('A cartridge in a machine or another job cannot be combined.');
  }
  return accepted();
}

export function startCombine(s: LabState, env: LabEnv, ids: readonly string[]): LabState {
  const check = canCombine(s, env, ids);
  if (!check.ok) throw new Error(check.why);

  return {
    ...s,
    combiner: {
      inputs: [...ids],
      preset: null,
      done: 0,
      needs: RULES.combineSeconds,
    },
  };
}

export function canSlot(s: LabState, id: string, machine: number): Check {
  const cartridge = findCartridge(s, id);
  if (cartridge === undefined) return refused(`Unknown cartridge: ${id}.`);
  if (cartridge.kind === 'blank') {
    return refused('A blank does nothing: write a preset on it first.');
  }
  if (cartridge.slot !== null) return refused('That cartridge is already in a machine.');
  if (inJob(s, id)) return refused('That cartridge is being used in a job.');
  if (!Number.isFinite(machine)) return refused('Choose a finite machine id.');
  if (s.cartridges.some((other) => other.slot === machine)) {
    return refused('That machine slot is occupied.');
  }
  return accepted();
}

export function slotInto(s: LabState, id: string, machine: number): LabState {
  const check = canSlot(s, id, machine);
  if (!check.ok) throw new Error(check.why);

  return {
    ...s,
    cartridges: s.cartridges.map((cartridge) =>
      cartridge.id === id ? { ...cartridge, slot: machine } : cartridge,
    ),
  };
}

export function unslot(s: LabState, id: string): LabState {
  const cartridge = findCartridge(s, id);
  if (cartridge === undefined || cartridge.slot === null) return s;

  return {
    ...s,
    cartridges: s.cartridges.map((candidate) =>
      candidate.id === id ? { ...candidate, slot: null } : candidate,
    ),
  };
}

function combineAffinity(inputs: readonly Cartridge[], metric: Metric): number {
  const gains = inputs.map((cartridge) => cartridge.affinity[metric] - 1);
  gains.sort((left, right) => right - left);

  let gain = 0;
  for (let index = 0; index < gains.length; index += 1) {
    const value = gains[index] ?? 0;
    gain += index === 0 ? value : value / 2;
  }

  const affinity = 1 + gain;
  if (affinity < 0.5) return 0.5;
  if (affinity > 3) return 3;
  return affinity;
}

function completeWrite(s: LabState, job: Job, preset: Preset): LabState {
  const id = job.inputs[0];
  if (id === undefined) return { ...s, bench: null };

  const affinity = affinityForPreset(preset);
  return {
    ...s,
    bench: null,
    cartridges: s.cartridges.map((cartridge) =>
      cartridge.id === id
        ? {
            ...cartridge,
            name: preset.name,
            kind: 'preset',
            preset: preset.id,
            from: [],
            affinity,
            slot: null,
          }
        : cartridge,
    ),
  };
}

// Keep the stop edge in JSON state so events stay pure and do not repeat while paused.
type StoppedJob = Job & { readonly _stalled: true };

function hasStallMarker(job: Job): boolean {
  return (job as StoppedJob)._stalled === true;
}

function markStalled(job: Job): Job {
  return { ...job, _stalled: true } as StoppedJob;
}

function markRunning(job: Job, done: number): Job {
  return {
    inputs: [...job.inputs],
    preset: job.preset,
    done,
    needs: job.needs,
  };
}

function completeCombine(s: LabState, job: Job): { readonly state: LabState; readonly id: string } {
  const inputs: Cartridge[] = [];
  for (const id of job.inputs) {
    const cartridge = findCartridge(s, id);
    if (cartridge !== undefined) inputs.push(cartridge);
  }

  const id = `c${s.nextId}`;
  const affinity: Record<Metric, number> = {
    pxd: combineAffinity(inputs, 'pxd'),
    vtx: combineAffinity(inputs, 'vtx'),
    lx: combineAffinity(inputs, 'lx'),
    aq: combineAffinity(inputs, 'aq'),
  };
  const mix: Cartridge = {
    id,
    name: inputs.map((cartridge) => cartridge.name).join(' + '),
    kind: 'mix',
    preset: null,
    from: [...job.inputs],
    affinity,
    slot: null,
  };
  const used = new Set(job.inputs);

  return {
    id,
    state: {
      ...s,
      nextId: s.nextId + 1,
      combiner: null,
      cartridges: [...s.cartridges.filter((cartridge) => !used.has(cartridge.id)), mix],
      catalogueUntil: s.time + RULES.catalogueSeconds,
    },
  };
}

export function step(
  s: LabState,
  env: LabEnv,
  dt: number,
): { readonly state: LabState; readonly events: readonly LabEvent[] } {
  let state: LabState = { ...s, time: s.time + dt };
  const events: LabEvent[] = [];

  if (!env.powered) {
    let bench = s.bench;
    if (bench !== null && bench.done > 0 && !hasStallMarker(bench)) {
      events.push({ type: 'stalled', machine: 'bench' });
      bench = markStalled(bench);
    }
    let combiner = s.combiner;
    if (combiner !== null && combiner.done > 0 && !hasStallMarker(combiner)) {
      events.push({ type: 'stalled', machine: 'combiner' });
      combiner = markStalled(combiner);
    }
    state = { ...state, bench, combiner };
    return { state, events };
  }

  const bench = s.bench;
  if (bench !== null) {
    const done = bench.done + dt;
    if (done >= bench.needs) {
      const presetId = bench.preset;
      const preset = presetId === null
        ? undefined
        : env.presets.find((candidate) => candidate.id === presetId);
      if (preset === undefined) throw new Error('The active preset is missing from the lab environment.');
      state = completeWrite(state, bench, preset);
      events.push({ type: 'written', id: bench.inputs[0] ?? '' });
    } else {
      state = { ...state, bench: markRunning(bench, done) };
    }
  }

  const combiner = s.combiner;
  if (combiner !== null) {
    const done = combiner.done + dt;
    if (done >= combiner.needs) {
      const completed = completeCombine(state, combiner);
      state = completed.state;
      events.push({ type: 'combined', id: completed.id });
    } else {
      state = { ...state, combiner: markRunning(combiner, done) };
    }
  }

  return { state, events };
}

export function activity(
  s: LabState,
  env: LabEnv,
): { readonly bench: number; readonly combiner: number; readonly rack: number } {
  return {
    bench: env.powered && s.bench !== null ? 1 : 0,
    combiner: env.powered && s.combiner !== null ? 1 : 0,
    rack: env.powered && s.time < s.catalogueUntil ? 1 : 0,
  };
}

export function affinityOf(s: LabState, id: string, metric: Metric): number {
  const cartridge = findCartridge(s, id);
  if (cartridge === undefined || cartridge.kind === 'blank') return 1;
  return cartridge.affinity[metric];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const entries: unknown[] = value;
  for (const entry of entries) {
    if (typeof entry !== 'string') return false;
  }
  return true;
}

function sequenceOf(id: string): number | null {
  if (!/^c[1-9][0-9]*$/.test(id)) return null;
  const sequence = Number(id.slice(1));
  return Number.isSafeInteger(sequence) ? sequence : null;
}

function parseCartridge(value: unknown): Cartridge | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    (value.kind !== 'blank' && value.kind !== 'preset' && value.kind !== 'mix') ||
    !(value.preset === null || typeof value.preset === 'string') ||
    !isStringArray(value.from) ||
    !(value.slot === null || isFiniteNumber(value.slot)) ||
    !isRecord(value.affinity)
  ) {
    return null;
  }

  const rawAffinity = value.affinity;
  if (
    !isFiniteNumber(rawAffinity.pxd) ||
    !isFiniteNumber(rawAffinity.vtx) ||
    !isFiniteNumber(rawAffinity.lx) ||
    !isFiniteNumber(rawAffinity.aq)
  ) {
    return null;
  }

  const affinity: Record<Metric, number> = {
    pxd: rawAffinity.pxd,
    vtx: rawAffinity.vtx,
    lx: rawAffinity.lx,
    aq: rawAffinity.aq,
  };
  const from = [...value.from];

  if (sequenceOf(value.id) === null) return null;
  if (value.kind === 'blank') {
    if (
      value.name !== 'Blank' ||
      value.preset !== null ||
      from.length !== 0 ||
      value.slot !== null ||
      METRICS.some((metric) => affinity[metric] !== 1)
    ) {
      return null;
    }
  } else if (value.kind === 'preset') {
    if (value.preset === null || from.length !== 0) return null;
  } else if (
    value.preset !== null ||
    from.length < RULES.minInputs ||
    from.length > RULES.maxInputs ||
    hasDuplicateIds(from)
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    kind: value.kind,
    preset: value.preset,
    from,
    affinity,
    slot: value.slot,
  };
}

function parseJob(
  value: unknown,
  machine: 'bench' | 'combiner',
  cartridges: ReadonlyMap<string, Cartridge>,
): Job | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isStringArray(value.inputs)) return undefined;
  const stalled = value._stalled;
  if (
    !(value.preset === null || typeof value.preset === 'string') ||
    !isFiniteNumber(value.done) ||
    !isFiniteNumber(value.needs) ||
    !(stalled === undefined || typeof stalled === 'boolean') ||
    (stalled === true && value.done <= 0) ||
    hasDuplicateIds(value.inputs)
  ) {
    return undefined;
  }

  const inputs = [...value.inputs];
  if (machine === 'bench') {
    if (
      inputs.length !== 1 ||
      typeof value.preset !== 'string' ||
      value.needs !== RULES.writeSeconds ||
      value.done >= value.needs
    ) {
      return undefined;
    }
  } else if (
    inputs.length < RULES.minInputs ||
    inputs.length > RULES.maxInputs ||
    value.preset !== null ||
    value.needs !== RULES.combineSeconds ||
    value.done >= value.needs
  ) {
    return undefined;
  }

  for (const id of inputs) {
    const cartridge = cartridges.get(id);
    if (cartridge === undefined || cartridge.slot !== null) return undefined;
    if (machine === 'bench' && cartridge.kind !== 'blank') return undefined;
    if (machine === 'combiner' && cartridge.kind === 'blank') return undefined;
  }

  const job: Job = {
    inputs,
    preset: value.preset,
    done: value.done,
    needs: value.needs,
  };
  return stalled === true ? markStalled(job) : job;
}

export function loadLab(json: unknown): LabState | null {
  if (!isRecord(json)) return null;
  if (
    json.v !== 1 ||
    !isFiniteNumber(json.time) ||
    !isFiniteNumber(json.nextId) ||
    !Number.isSafeInteger(json.nextId) ||
    json.nextId < 1 ||
    !Array.isArray(json.cartridges) ||
    !(json.bench === null || isRecord(json.bench)) ||
    !(json.combiner === null || isRecord(json.combiner)) ||
    !isFiniteNumber(json.catalogueUntil)
  ) {
    return null;
  }

  const rawCartridges: unknown[] = json.cartridges;
  const cartridges: Cartridge[] = [];
  const byId = new Map<string, Cartridge>();
  const usedSlots = new Set<number>();
  let highestId = 0;

  for (const rawCartridge of rawCartridges) {
    const cartridge = parseCartridge(rawCartridge);
    if (cartridge === null || byId.has(cartridge.id)) return null;
    const sequence = sequenceOf(cartridge.id);
    if (sequence === null) return null;
    if (cartridge.slot !== null) {
      if (usedSlots.has(cartridge.slot)) return null;
      usedSlots.add(cartridge.slot);
    }
    if (sequence > highestId) highestId = sequence;
    cartridges.push(cartridge);
    byId.set(cartridge.id, cartridge);
  }

  if (json.nextId <= highestId) return null;

  const bench = parseJob(json.bench, 'bench', byId);
  const combiner = parseJob(json.combiner, 'combiner', byId);
  if (bench === undefined || combiner === undefined) return null;

  const activeInputs = new Set<string>();
  for (const job of [bench, combiner]) {
    if (job === null) continue;
    for (const id of job.inputs) {
      if (activeInputs.has(id)) return null;
      activeInputs.add(id);
    }
  }

  return {
    v: 1,
    time: json.time,
    nextId: json.nextId,
    cartridges,
    bench,
    combiner,
    catalogueUntil: json.catalogueUntil,
  };
}
