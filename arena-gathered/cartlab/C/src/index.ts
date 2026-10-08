export type Metric = 'pxd' | 'vtx' | 'lx' | 'aq';

export const METRICS: readonly Metric[] = ['pxd', 'vtx', 'lx', 'aq'];

export const RULES: {
  readonly blankCost: 12;
  readonly rackSize: 48;
  readonly writeSeconds: 20;
  readonly combineSeconds: 45;
  readonly catalogueSeconds: 2;
  readonly minInputs: 2;
  readonly maxInputs: 4;
} = {
  blankCost: 12,
  rackSize: 48,
  writeSeconds: 20,
  combineSeconds: 45,
  catalogueSeconds: 2,
  minInputs: 2,
  maxInputs: 4,
};

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

function findCartridge(s: LabState, id: string): Cartridge | undefined {
  for (const c of s.cartridges) {
    if (c.id === id) return c;
  }
  return undefined;
}

function findPreset(env: LabEnv, id: string): Preset | undefined {
  for (const p of env.presets) {
    if (p.id === id) return p;
  }
  return undefined;
}

function isInJob(s: LabState, id: string): boolean {
  const b = s.bench;
  if (b !== null) {
    for (const x of b.inputs) {
      if (x === id) return true;
    }
  }
  const c = s.combiner;
  if (c !== null) {
    for (const x of c.inputs) {
      if (x === id) return true;
    }
  }
  return false;
}

function affinityFromPreset(p: Preset): Record<Metric, number> {
  const a = p.affinity;
  const pxd = a.pxd;
  const vtx = a.vtx;
  const lx = a.lx;
  const aq = a.aq;
  return {
    pxd: typeof pxd === 'number' && Number.isFinite(pxd) ? pxd : 1,
    vtx: typeof vtx === 'number' && Number.isFinite(vtx) ? vtx : 1,
    lx: typeof lx === 'number' && Number.isFinite(lx) ? lx : 1,
    aq: typeof aq === 'number' && Number.isFinite(aq) ? aq : 1,
  };
}

function clampAffinity(v: number): number {
  if (v < 0.5) return 0.5;
  if (v > 3) return 3;
  return v;
}

function combineAffinities(inputs: readonly Cartridge[]): Record<Metric, number> {
  const out: Record<Metric, number> = { pxd: 1, vtx: 1, lx: 1, aq: 1 };
  for (const m of METRICS) {
    const gains: number[] = [];
    for (const c of inputs) {
      const av = c.affinity[m];
      const g = (typeof av === 'number' && Number.isFinite(av) ? av : 1) - 1;
      gains.push(g);
    }
    const sorted = [...gains].sort((x, y) => y - x);
    const first = sorted[0];
    let gain = typeof first === 'number' ? first : 0;
    for (let i = 1; i < sorted.length; i++) {
      const g = sorted[i];
      if (typeof g === 'number') gain += g / 2;
    }
    out[m] = clampAffinity(1 + gain);
  }
  return out;
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
  let n = 0;
  for (const c of s.cartridges) {
    if (c.slot === null) n += 1;
  }
  return n;
}

export function canMakeBlank(s: LabState, ore: number): Check {
  if (!(typeof ore === 'number' && Number.isFinite(ore)) || ore < RULES.blankCost) {
    return { ok: false, why: `Not enough ore: a blank costs ${RULES.blankCost}.` };
  }
  if (rackCount(s) >= RULES.rackSize) {
    return { ok: false, why: `The rack is full: ${RULES.rackSize} cartridges.` };
  }
  return { ok: true, why: '' };
}

export function makeBlank(s: LabState, ore: number): { readonly state: LabState; readonly oreUsed: number } {
  const c = canMakeBlank(s, ore);
  if (!c.ok) throw new Error(c.why);
  const id = `c${s.nextId}`;
  const cart: Cartridge = {
    id,
    name: 'Blank',
    kind: 'blank',
    preset: null,
    from: [],
    affinity: { pxd: 1, vtx: 1, lx: 1, aq: 1 },
    slot: null,
  };
  const state: LabState = {
    v: 1,
    time: s.time,
    nextId: s.nextId + 1,
    cartridges: [...s.cartridges, cart],
    bench: s.bench,
    combiner: s.combiner,
    catalogueUntil: s.time + RULES.catalogueSeconds,
  };
  return { state, oreUsed: RULES.blankCost };
}

export function canWrite(s: LabState, env: LabEnv, blank: string, preset: string): Check {
  if (!env.powered) return { ok: false, why: 'No power: turn the gate on.' };
  if (s.bench !== null) return { ok: false, why: 'The bench is busy.' };
  const cart = findCartridge(s, blank);
  if (cart === undefined) return { ok: false, why: 'That cartridge is not in the lab.' };
  if (cart.kind !== 'blank') return { ok: false, why: 'Only a blank can be written.' };
  if (isInJob(s, blank)) return { ok: false, why: 'That cartridge is already in a job.' };
  const p = findPreset(env, preset);
  if (p === undefined) return { ok: false, why: 'That preset is unknown.' };
  if (p.minStage > env.stage) return { ok: false, why: `That preset opens at stage ${p.minStage}.` };
  return { ok: true, why: '' };
}

export function startWrite(s: LabState, env: LabEnv, blank: string, preset: string): LabState {
  const c = canWrite(s, env, blank, preset);
  if (!c.ok) throw new Error(c.why);
  const job: Job = { inputs: [blank], preset, done: 0, needs: RULES.writeSeconds };
  return {
    v: 1,
    time: s.time,
    nextId: s.nextId,
    cartridges: s.cartridges,
    bench: job,
    combiner: s.combiner,
    catalogueUntil: s.catalogueUntil,
  };
}

export function canCombine(s: LabState, env: LabEnv, ids: readonly string[]): Check {
  if (!env.powered) return { ok: false, why: 'No power: turn the gate on.' };
  if (s.combiner !== null) return { ok: false, why: 'The combiner is busy.' };
  if (ids.length < RULES.minInputs || ids.length > RULES.maxInputs) {
    return { ok: false, why: `The combiner mixes ${RULES.minInputs} to ${RULES.maxInputs} cartridges.` };
  }
  const seen: string[] = [];
  for (const id of ids) {
    for (const x of seen) {
      if (x === id) return { ok: false, why: 'Use each cartridge only once.' };
    }
    seen.push(id);
  }
  for (const id of ids) {
    if (findCartridge(s, id) === undefined) {
      return { ok: false, why: 'That cartridge is not in the lab.' };
    }
  }
  for (const id of ids) {
    const c = findCartridge(s, id);
    if (c !== undefined && c.kind === 'blank') {
      return { ok: false, why: 'A blank cannot be mixed: write a preset on it first.' };
    }
  }
  for (const id of ids) {
    const c = findCartridge(s, id);
    if (c !== undefined && c.slot !== null) {
      return { ok: false, why: 'That cartridge is out in a machine.' };
    }
    if (isInJob(s, id)) {
      return { ok: false, why: 'That cartridge is already in a job.' };
    }
  }
  return { ok: true, why: '' };
}

export function startCombine(s: LabState, env: LabEnv, ids: readonly string[]): LabState {
  const c = canCombine(s, env, ids);
  if (!c.ok) throw new Error(c.why);
  const job: Job = { inputs: [...ids], preset: null, done: 0, needs: RULES.combineSeconds };
  return {
    v: 1,
    time: s.time,
    nextId: s.nextId,
    cartridges: s.cartridges,
    bench: s.bench,
    combiner: job,
    catalogueUntil: s.catalogueUntil,
  };
}

export function canSlot(s: LabState, id: string, machine: number): Check {
  void machine;
  const cart = findCartridge(s, id);
  if (cart === undefined) return { ok: false, why: 'That cartridge is not in the lab.' };
  if (cart.kind === 'blank') {
    return { ok: false, why: 'A blank does nothing: write a preset on it first.' };
  }
  if (cart.slot !== null) return { ok: false, why: 'That cartridge is already in a machine.' };
  if (isInJob(s, id)) return { ok: false, why: 'That cartridge is already in a job.' };
  return { ok: true, why: '' };
}

export function slotInto(s: LabState, id: string, machine: number): LabState {
  const c = canSlot(s, id, machine);
  if (!c.ok) throw new Error(c.why);
  const next: Cartridge[] = [];
  for (const cart of s.cartridges) {
    if (cart.id === id) {
      next.push({ ...cart, slot: machine });
    } else {
      next.push(cart);
    }
  }
  return {
    v: 1,
    time: s.time,
    nextId: s.nextId,
    cartridges: next,
    bench: s.bench,
    combiner: s.combiner,
    catalogueUntil: s.catalogueUntil,
  };
}

export function unslot(s: LabState, id: string): LabState {
  const cart = findCartridge(s, id);
  if (cart === undefined) return s;
  if (cart.slot === null) return s;
  const next: Cartridge[] = [];
  for (const c of s.cartridges) {
    if (c.id === id) {
      next.push({ ...c, slot: null });
    } else {
      next.push(c);
    }
  }
  return {
    v: 1,
    time: s.time,
    nextId: s.nextId,
    cartridges: next,
    bench: s.bench,
    combiner: s.combiner,
    catalogueUntil: s.catalogueUntil,
  };
}

export function step(s: LabState, env: LabEnv, dt: number): { readonly state: LabState; readonly events: readonly LabEvent[] } {
  const safeDt = typeof dt === 'number' && Number.isFinite(dt) ? dt : 0;
  const newTime = s.time + safeDt;
  if (!env.powered) {
    const events: LabEvent[] = [];
    if (safeDt > 0) {
      if (s.bench !== null) events.push({ type: 'stalled', machine: 'bench' });
      if (s.combiner !== null) events.push({ type: 'stalled', machine: 'combiner' });
    }
    const state: LabState = {
      v: 1,
      time: newTime,
      nextId: s.nextId,
      cartridges: s.cartridges,
      bench: s.bench,
      combiner: s.combiner,
      catalogueUntil: s.catalogueUntil,
    };
    return { state, events };
  }
  let newBench: Job | null = s.bench;
  let newCombiner: Job | null = s.combiner;
  let carts: readonly Cartridge[] = s.cartridges;
  let nextId = s.nextId;
  let catalogueUntil = s.catalogueUntil;
  const events: LabEvent[] = [];

  const bench = s.bench;
  if (bench !== null) {
    const done = bench.done + safeDt;
    const clampedDone = done < 0 ? 0 : done;
    if (clampedDone >= bench.needs) {
      const first = bench.inputs[0];
      if (typeof first === 'string') {
        const target = findCartridge({ ...s, cartridges: carts }, first);
        if (target !== undefined) {
          const presetId = bench.preset;
          const preset = typeof presetId === 'string' ? findPreset(env, presetId) : undefined;
          const name = preset !== undefined ? preset.name : (typeof presetId === 'string' ? presetId : target.name);
          const aff = preset !== undefined ? affinityFromPreset(preset) : { pxd: 1, vtx: 1, lx: 1, aq: 1 };
          const made: Cartridge = {
            ...target,
            name,
            kind: 'preset',
            preset: typeof presetId === 'string' ? presetId : target.preset,
            affinity: aff,
          };
          const next: Cartridge[] = [];
          for (const c of carts) {
            if (c.id === first) next.push(made);
            else next.push(c);
          }
          carts = next;
          events.push({ type: 'written', id: first });
        }
      }
      newBench = null;
    } else {
      newBench = { inputs: bench.inputs, preset: bench.preset, done: clampedDone, needs: bench.needs };
    }
  }

  const combiner = s.combiner;
  if (combiner !== null) {
    const done = combiner.done + safeDt;
    const clampedDone = done < 0 ? 0 : done;
    if (clampedDone >= combiner.needs) {
      const lookup: Record<string, Cartridge> = {};
      for (const c of carts) {
        lookup[c.id] = c;
      }
      const ins: Cartridge[] = [];
      let missing = false;
      for (const id of combiner.inputs) {
        const c = lookup[id];
        if (c === undefined) {
          missing = true;
          break;
        }
        ins.push(c);
      }
      if (!missing && ins.length > 0) {
        const names: string[] = [];
        for (const c of ins) names.push(c.name);
        const aff = combineAffinities(ins);
        const id = `c${nextId}`;
        const from: string[] = [];
        for (const x of combiner.inputs) from.push(x);
        const mix: Cartridge = {
          id,
          name: names.join(' + '),
          kind: 'mix',
          preset: null,
          from,
          affinity: aff,
          slot: null,
        };
        const doomed: Record<string, boolean> = {};
        for (const x of combiner.inputs) doomed[x] = true;
        const kept: Cartridge[] = [];
        for (const c of carts) {
          if (doomed[c.id] !== true) kept.push(c);
        }
        kept.push(mix);
        carts = kept;
        nextId += 1;
        catalogueUntil = newTime + RULES.catalogueSeconds;
        events.push({ type: 'combined', id });
      }
      newCombiner = null;
    } else {
      newCombiner = { inputs: combiner.inputs, preset: combiner.preset, done: clampedDone, needs: combiner.needs };
    }
  }

  const state: LabState = {
    v: 1,
    time: newTime,
    nextId,
    cartridges: carts,
    bench: newBench,
    combiner: newCombiner,
    catalogueUntil,
  };
  return { state, events };
}

export function activity(s: LabState, env: LabEnv): { readonly bench: number; readonly combiner: number; readonly rack: number } {
  const bench = env.powered && s.bench !== null ? 1 : 0;
  const combiner = env.powered && s.combiner !== null ? 1 : 0;
  const rack = env.powered && s.time < s.catalogueUntil ? 1 : 0;
  return { bench, combiner, rack };
}

export function affinityOf(s: LabState, id: string, metric: Metric): number {
  const c = findCartridge(s, id);
  if (c === undefined) return 1;
  if (c.kind === 'blank') return 1;
  const v = c.affinity[metric];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 1;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function checkStringArray(x: unknown): readonly string[] | null {
  if (!Array.isArray(x)) return null;
  const out: string[] = [];
  for (const v of x) {
    if (typeof v !== 'string') return null;
    out.push(v);
  }
  return out;
}

function checkAffinity(x: unknown): Record<Metric, number> | null {
  if (!isRecord(x)) return null;
  const pxd = x['pxd'];
  const vtx = x['vtx'];
  const lx = x['lx'];
  const aq = x['aq'];
  if (!isFiniteNum(pxd) || !isFiniteNum(vtx) || !isFiniteNum(lx) || !isFiniteNum(aq)) return null;
  return { pxd, vtx, lx, aq };
}

function checkCartridge(x: unknown): Cartridge | null {
  if (!isRecord(x)) return null;
  const id = x['id'];
  const name = x['name'];
  const kind = x['kind'];
  const preset = x['preset'];
  const from = x['from'];
  const affinity = x['affinity'];
  const slot = x['slot'];
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string') return null;
  if (kind !== 'blank' && kind !== 'preset' && kind !== 'mix') return null;
  if (!(preset === null || typeof preset === 'string')) return null;
  const fromOk = checkStringArray(from);
  if (fromOk === null) return null;
  const affOk = checkAffinity(affinity);
  if (affOk === null) return null;
  if (!(slot === null || isFiniteNum(slot))) return null;
  return { id, name, kind, preset, from: fromOk, affinity: affOk, slot };
}

function checkJob(x: unknown): Job | null {
  if (x === null) return null;
  if (!isRecord(x)) return null;
  const inputs = x['inputs'];
  const preset = x['preset'];
  const done = x['done'];
  const needs = x['needs'];
  const inputsOk = checkStringArray(inputs);
  if (inputsOk === null) return null;
  if (!(preset === null || typeof preset === 'string')) return null;
  if (!isFiniteNum(done) || done < 0) return null;
  if (!isFiniteNum(needs) || needs <= 0) return null;
  return { inputs: inputsOk, preset, done, needs };
}

export function loadLab(json: unknown): LabState | null {
  if (!isRecord(json)) return null;
  const v = json['v'];
  const time = json['time'];
  const nextId = json['nextId'];
  const cartridges = json['cartridges'];
  const bench = json['bench'];
  const combiner = json['combiner'];
  const catalogueUntil = json['catalogueUntil'];
  if (v !== 1) return null;
  if (!isFiniteNum(time)) return null;
  if (!isFiniteNum(catalogueUntil)) return null;
  if (typeof nextId !== 'number' || !Number.isInteger(nextId) || nextId < 1) return null;
  if (!Array.isArray(cartridges)) return null;
  const carts: Cartridge[] = [];
  const ids: Record<string, boolean> = {};
  for (const raw of cartridges) {
    const c = checkCartridge(raw);
    if (c === null) return null;
    if (ids[c.id] === true) return null;
    ids[c.id] = true;
    carts.push(c);
  }
  let benchOk: Job | null = null;
  if (bench !== null) {
    const j = checkJob(bench);
    if (j === null) return null;
    benchOk = j;
  }
  let combinerOk: Job | null = null;
  if (combiner !== null) {
    const j = checkJob(combiner);
    if (j === null) return null;
    combinerOk = j;
  }
  if (benchOk !== null) {
    for (const id of benchOk.inputs) {
      if (ids[id] !== true) return null;
    }
  }
  if (combinerOk !== null) {
    for (const id of combinerOk.inputs) {
      if (ids[id] !== true) return null;
    }
  }
  return {
    v: 1,
    time,
    nextId,
    cartridges: carts,
    bench: benchOk,
    combiner: combinerOk,
    catalogueUntil,
  };
}
