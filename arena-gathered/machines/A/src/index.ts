// src/index.ts — machines that turn resources into textures.
// No imports, no DOM, no Date, no Math.random. Pure data in, pure data out.

export type PortType = 'pixels' | 'mask' | 'texture';

export interface Knob { id: string; min: number; max: number; value: number }

export interface MachineKind {
  kind: string;
  inputs: { id: string; type: PortType }[];
  outputs: { id: string; type: PortType }[];
  knobs: Knob[];
  costMs: number; // bake time per 256x256 at default knobs
}

/** The ready-made machines in the toy-world workbench. */
export const KINDS: readonly MachineKind[] = [
  {
    kind: 'importer',
    inputs: [],
    outputs: [{ id: 'pixels', type: 'pixels' }],
    knobs: [],
    costMs: 2,
  },
  {
    kind: 'noise',
    inputs: [{ id: 'pixels', type: 'pixels' }],
    outputs: [{ id: 'texture', type: 'texture' }],
    knobs: [
      { id: 'scale', min: 1, max: 64, value: 8 },
      { id: 'octaves', min: 1, max: 6, value: 3 },
      { id: 'seed', min: 0, max: 9999, value: 0 },
    ],
    costMs: 6,
  },
  {
    kind: 'stamp-normals',
    inputs: [{ id: 'texture', type: 'texture' }],
    outputs: [{ id: 'texture', type: 'texture' }],
    knobs: [{ id: 'strength', min: 0, max: 2, value: 1 }],
    costMs: 4,
  },
  {
    kind: 'palette',
    inputs: [
      { id: 'texture', type: 'texture' },
      { id: 'pixels', type: 'pixels' },
    ],
    outputs: [{ id: 'texture', type: 'texture' }],
    knobs: [{ id: 'colours', min: 2, max: 16, value: 8 }],
    costMs: 3,
  },
  {
    kind: 'blur',
    inputs: [{ id: 'texture', type: 'texture' }],
    outputs: [{ id: 'texture', type: 'texture' }],
    knobs: [{ id: 'radius', min: 0, max: 8, value: 2 }],
    costMs: 5,
  },
  {
    kind: 'mask-slope',
    inputs: [{ id: 'texture', type: 'texture' }],
    outputs: [{ id: 'mask', type: 'mask' }],
    knobs: [{ id: 'angle', min: 0, max: 90, value: 45 }],
    costMs: 3,
  },
  {
    kind: 'mix',
    inputs: [
      { id: 'a', type: 'texture' },
      { id: 'b', type: 'texture' },
      { id: 'mask', type: 'mask' },
    ],
    outputs: [{ id: 'texture', type: 'texture' }],
    knobs: [{ id: 'balance', min: 0, max: 1, value: 0.5 }],
    costMs: 4,
  },
  {
    kind: 'output',
    inputs: [{ id: 'texture', type: 'texture' }],
    outputs: [],
    knobs: [],
    costMs: 1,
  },
];

export interface Machine { id: string; kind: string; knobs: Record<string, number> }
export interface Wire {
  from: { machine: string; port: string };
  to: { machine: string; port: string };
}
export interface Chain { machines: Machine[]; wires: Wire[] }
export interface Recipe {
  kind: string;
  knobs: Record<string, number>;
  inputs: Record<string, Recipe>;
}

const BY_KIND: Record<string, MachineKind> = {};
for (const kind of KINDS) BY_KIND[kind.kind] = kind;

const SEP = '\u0000';
const refKey = (machine: string, port: string): string => `${machine}${SEP}${port}`;

/** First machine per id, in the chain's own order. */
function machinesById(c: Chain): Map<string, Machine> {
  const out = new Map<string, Machine>();
  for (const m of c.machines) if (!out.has(m.id)) out.set(m.id, m);
  return out;
}

function kindOf(m: Machine): MachineKind | undefined {
  return BY_KIND[m.kind];
}

/** Every knob the kind declares, filled in from the machine or the default. */
function knobsFor(m: Machine, kind: MachineKind): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of kind.knobs) out[spec.id] = m.knobs[spec.id] ?? spec.value;
  return out;
}

/** machine.port -> the source port wired into it. The first wire wins. */
function wiredInputs(c: Chain, byId: Map<string, Machine>): Map<string, { machine: string; port: string }> {
  const map = new Map<string, { machine: string; port: string }>();
  for (const w of c.wires) {
    if (!byId.has(w.from.machine) || !byId.has(w.to.machine)) continue;
    const k = refKey(w.to.machine, w.to.port);
    if (!map.has(k)) map.set(k, { machine: w.from.machine, port: w.from.port });
  }
  return map;
}

/** machine id -> the set of machines it needs first. Ignores wires to unknown machines. */
function dependencies(c: Chain, byId: Map<string, Machine>): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const id of byId.keys()) deps.set(id, new Set<string>());
  for (const w of c.wires) {
    const to = deps.get(w.to.machine);
    if (to === undefined) continue;
    if (!deps.has(w.from.machine)) continue;
    to.add(w.from.machine);
  }
  return deps;
}

/** Depth-first search for a feedback loop; returns the loop (repeated start) or null. */
function findCycle(deps: Map<string, Set<string>>): string[] | null {
  const onPath = new Set<string>();
  const done = new Set<string>();
  const path: string[] = [];
  let found: string[] | null = null;
  const visit = (id: string): void => {
    if (found !== null || done.has(id)) return;
    if (onPath.has(id)) {
      const at = path.indexOf(id);
      found = at >= 0 ? [...path.slice(at), id] : [id, id];
      return;
    }
    onPath.add(id);
    path.push(id);
    for (const d of deps.get(id) ?? []) visit(d);
    path.pop();
    onPath.delete(id);
    done.add(id);
  };
  for (const id of deps.keys()) visit(id);
  return found;
}

/** Everything wrong with the chain, as human-readable strings. Empty = good. */
export function check(c: Chain): string[] {
  const problems: string[] = [];
  const byId = machinesById(c);
  const seenIds = new Set<string>();

  for (const m of c.machines) {
    if (seenIds.has(m.id)) problems.push(`duplicate machine id "${m.id}"`);
    seenIds.add(m.id);
    const kind = kindOf(m);
    if (kind === undefined) {
      problems.push(`machine "${m.id}" has unknown kind "${m.kind}"`);
      continue;
    }
    for (const [knobId, value] of Object.entries(m.knobs)) {
      const spec = kind.knobs.find((x) => x.id === knobId);
      if (spec === undefined) {
        problems.push(`machine "${m.id}" (${kind.kind}) has no knob "${knobId}"`);
      } else if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
        problems.push(`knob "${m.id}.${knobId}" = ${value} is outside ${spec.min}..${spec.max}`);
      }
    }
  }

  const takenInputs = new Map<string, string>();
  for (const w of c.wires) {
    const src = byId.get(w.from.machine);
    const dst = byId.get(w.to.machine);
    if (src === undefined || dst === undefined) {
      const missing = src === undefined ? w.from.machine : w.to.machine;
      problems.push(`wire references unknown machine "${missing}"`);
      continue;
    }
    const srcKind = kindOf(src);
    const dstKind = kindOf(dst);
    if (srcKind === undefined || dstKind === undefined) {
      problems.push(`wire "${w.from.machine}.${w.from.port}" -> "${w.to.machine}.${w.to.port}" touches a machine with an unknown kind`);
      continue;
    }
    const outPort = srcKind.outputs.find((x) => x.id === w.from.port);
    if (outPort === undefined) {
      problems.push(`"${w.from.port}" is not an output port of "${w.from.machine}" (${srcKind.kind})`);
      continue;
    }
    const inPort = dstKind.inputs.find((x) => x.id === w.to.port);
    if (inPort === undefined) {
      problems.push(`"${w.to.port}" is not an input port of "${w.to.machine}" (${dstKind.kind})`);
      continue;
    }
    if (outPort.type !== inPort.type) {
      problems.push(`type mismatch: "${w.from.machine}.${w.from.port}" carries ${outPort.type} but "${w.to.machine}.${w.to.port}" wants ${inPort.type}`);
      continue;
    }
    const k = refKey(w.to.machine, w.to.port);
    const before = takenInputs.get(k);
    if (before !== undefined) {
      problems.push(`input "${w.to.machine}.${w.to.port}" has two wires (from "${before}" and "${w.from.machine}.${w.from.port}")`);
    } else {
      takenInputs.set(k, `${w.from.machine}.${w.from.port}`);
    }
  }

  const cycle = findCycle(dependencies(c, byId));
  if (cycle !== null) problems.push(`cycle: ${cycle.join(' -> ')} (a machine cannot feed itself)`);

  const outs = [...byId.values()].filter((m) => m.kind === 'output');
  if (outs.length === 0) problems.push('the chain has no "output" machine, so nothing gets baked');
  for (const o of outs) {
    if (!takenInputs.has(refKey(o.id, 'texture'))) {
      problems.push(`output "${o.id}" has nothing wired into its "texture" input`);
    }
  }

  return problems;
}

/**
 * Every machine id, each one after the machines feeding it. Ties keep the
 * chain's order. Null when the graph cannot be ordered (a cycle).
 */
export function order(c: Chain): string[] | null {
  const byId = machinesById(c);
  const ids = [...byId.keys()];
  const rank = new Map<string, number>();
  ids.forEach((id, i) => rank.set(id, i));
  const rankOf = (id: string | undefined): number =>
    id === undefined ? Number.POSITIVE_INFINITY : rank.get(id) ?? Number.POSITIVE_INFINITY;

  const deps = dependencies(c, byId);
  const left = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of ids) {
    const list = deps.get(id);
    const size = list === undefined ? 0 : list.size;
    left.set(id, size);
    if (list === undefined) continue;
    for (const d of list) {
      const arr = children.get(d);
      if (arr === undefined) children.set(d, [id]);
      else arr.push(id);
    }
  }

  const ready = ids.filter((id) => (left.get(id) ?? 0) === 0);
  const ordered: string[] = [];
  while (ready.length > 0) {
    let pick = 0;
    let pickRank = rankOf(ready[0]);
    for (let i = 1; i < ready.length; i += 1) {
      const r = rankOf(ready[i]);
      if (r < pickRank) {
        pickRank = r;
        pick = i;
      }
    }
    const id = ready.splice(pick, 1)[0];
    if (id === undefined) break;
    ordered.push(id);
    for (const child of children.get(id) ?? []) {
      const n = (left.get(child) ?? 0) - 1;
      left.set(child, n);
      if (n === 0) ready.push(child);
    }
  }

  return ordered.length === ids.length ? ordered : null;
}

/** The recipe to bake: the 'output' machine unpacked through its wires. */
export function recipe(c: Chain): Recipe | null {
  const byId = machinesById(c);
  const inputs = wiredInputs(c, byId);

  let outputId: string | null = null;
  for (const m of c.machines) {
    if (m.kind === 'output' && byId.has(m.id)) {
      outputId = m.id;
      break;
    }
  }
  if (outputId === null) return null;
  if (!inputs.has(refKey(outputId, 'texture'))) return null;

  const build = (id: string, path: Set<string>): Recipe | null => {
    if (path.has(id)) return null; // feedback loop
    const m = byId.get(id);
    if (m === undefined) return null;
    const kind = kindOf(m);
    if (kind === undefined) return null;
    const knobs = knobsFor(m, kind);
    const result: Recipe = { kind: kind.kind, knobs, inputs: {} };
    path.add(id);
    for (const p of kind.inputs) {
      const src = inputs.get(refKey(id, p.id));
      if (src === undefined) continue;
      const child = build(src.machine, path);
      if (child === null) {
        path.delete(id);
        return null;
      }
      result.inputs[p.id] = child;
    }
    path.delete(id);
    return result;
  };

  return build(outputId, new Set<string>());
}

/** Extra bake time a kind needs beyond its flat costMs, from its knobs. */
function knobFactor(kind: MachineKind, knobs: Record<string, number>): number {
  if (kind.kind === 'noise') return (knobs['octaves'] ?? 1) / 2;
  if (kind.kind === 'blur') return 1 + (knobs['radius'] ?? 0) / 4;
  return 1;
}

/**
 * What baking this texture costs at `size` pixels per side. Only machines that
 * actually reach the output are baked; if the recipe can't be built, every
 * machine in the chain is assumed to run.
 */
export function cost(c: Chain, size: number): { ms: number; bytes: number } {
  const scale = (size / 256) * (size / 256);
  let ms = 0;
  let normalMaps = 0;

  const r = recipe(c);
  if (r !== null) {
    const walk = (node: Recipe): void => {
      const kind = BY_KIND[node.kind];
      if (kind !== undefined) ms += kind.costMs * scale * knobFactor(kind, node.knobs);
      if (node.kind === 'stamp-normals') normalMaps += 1;
      for (const [, child] of Object.entries(node.inputs)) walk(child);
    };
    walk(r);
  } else {
    for (const m of machinesById(c).values()) {
      const kind = kindOf(m);
      if (kind === undefined) continue;
      ms += kind.costMs * scale * knobFactor(kind, knobsFor(m, kind));
      if (kind.kind === 'stamp-normals') normalMaps += 1;
    }
  }

  const colour = size * size * 4;
  return { ms, bytes: colour + (normalMaps > 0 ? colour : 0) };
}

function fmtNumber(n: number): string {
  if (Number.isNaN(n)) return 'nan';
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf';
  return n === 0 ? '0' : String(n);
}

const byKey = (a: [string, unknown], b: [string, unknown]): number =>
  a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;

/** A canonical text form: knobs and input ports sorted, so key order is irrelevant. */
function canonical(r: Recipe): string {
  const memo = new Map<Recipe, string>();
  const go = (node: Recipe): string => {
    const hit = memo.get(node);
    if (hit !== undefined) return hit;
    const knobs = Object.entries(node.knobs)
      .sort(byKey)
      .map(([id, v]) => `${id}=${fmtNumber(v)}`)
      .join(',');
    const inputs = Object.entries(node.inputs)
      .sort(byKey)
      .map(([id, child]) => `${id}:${go(child)}`)
      .join(',');
    const text = `{${node.kind}|${knobs}|${inputs}}`;
    memo.set(node, text);
    return text;
  };
  return go(r);
}

/** 32-bit FNV-1a over the canonical text; `backwards` gives the second half. */
function fnv1a(s: string, seed: number, backwards: boolean): number {
  const n = s.length;
  let h = seed >>> 0;
  for (let i = 0; i < n; i += 1) {
    const code = s.charCodeAt(backwards ? n - 1 - i : i);
    h = (h ^ code) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Short fingerprint of a recipe: equal recipes share a string, so the shop can spot twins. */
export function fingerprint(r: Recipe): string {
  const text = canonical(r);
  const a = fnv1a(text, 0x811c9dc5, false).toString(16).padStart(8, '0');
  const b = fnv1a(text, 0x9e3779b1, true).toString(16).padStart(8, '0');
  return `tx-${a}${b}`;
}