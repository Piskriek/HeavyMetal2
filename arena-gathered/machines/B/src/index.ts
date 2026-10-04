// src/index.ts

export type PortType = 'pixels' | 'mask' | 'texture';
export interface Knob { id: string; min: number; max: number; value: number }
export interface MachineKind {
  kind: string;
  inputs: { id: string; type: PortType }[];
  outputs: { id: string; type: PortType }[];
  knobs: Knob[];
  /** Bake time per 256x256 at default knobs. */
  costMs: number;
}
export interface Machine { id: string; kind: string; knobs: Record<string, number> }
export interface Wire { from: { machine: string; port: string }; to: { machine: string; port: string } }
export interface Chain { machines: Machine[]; wires: Wire[] }
export interface Recipe { kind: string; knobs: Record<string, number>; inputs: Record<string, Recipe> }

const p = (id: string, type: PortType): { id: string; type: PortType } => ({ id, type });
const k = (id: string, min: number, max: number, value: number): Knob => ({ id, min, max, value });

/** The ready-made machines. */
export const KINDS: readonly MachineKind[] = Object.freeze([
  { kind: 'importer', inputs: [], outputs: [p('pixels', 'pixels')], knobs: [], costMs: 2 },
  {
    kind: 'noise', inputs: [p('pixels', 'pixels')], outputs: [p('texture', 'texture')],
    knobs: [k('scale', 1, 64, 8), k('octaves', 1, 6, 4), k('seed', 0, 9999, 0)], costMs: 40,
  },
  { kind: 'stamp-normals', inputs: [p('texture', 'texture')], outputs: [p('texture', 'texture')], knobs: [k('strength', 0, 2, 1)], costMs: 15 },
  {
    kind: 'palette', inputs: [p('texture', 'texture'), p('pixels', 'pixels')], outputs: [p('texture', 'texture')],
    knobs: [k('colours', 2, 16, 8)], costMs: 10,
  },
  { kind: 'blur', inputs: [p('texture', 'texture')], outputs: [p('texture', 'texture')], knobs: [k('radius', 0, 8, 2)], costMs: 20 },
  { kind: 'mask-slope', inputs: [p('texture', 'texture')], outputs: [p('mask', 'mask')], knobs: [k('angle', 0, 90, 45)], costMs: 8 },
  {
    kind: 'mix', inputs: [p('a', 'texture'), p('b', 'texture'), p('mask', 'mask')], outputs: [p('texture', 'texture')],
    knobs: [], costMs: 6,
  },
  { kind: 'output', inputs: [p('texture', 'texture')], outputs: [], knobs: [], costMs: 1 },
]);

function kindOf(name: string): MachineKind | undefined {
  return KINDS.find((x) => x.kind === name);
}

/** First machine per id (later duplicates are ignored everywhere except check, which reports them). */
function machinesById(c: Chain): Map<string, Machine> {
  const map = new Map<string, Machine>();
  for (const m of c.machines) if (!map.has(m.id)) map.set(m.id, m);
  return map;
}

function effectiveKnobs(m: Machine, kind: MachineKind | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!kind) {
    for (const [id, v] of Object.entries(m.knobs)) out[id] = v;
    return out;
  }
  for (const knob of kind.knobs) out[knob.id] = m.knobs[knob.id] ?? knob.value;
  return out;
}

/** Ids of the start machine and every machine upstream of it. */
function upstream(c: Chain, start: string): Set<string> {
  const byId = machinesById(c);
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    for (const w of c.wires) if (w.to.machine === id) stack.push(w.from.machine);
  }
  return seen;
}

const portKey = (machine: string, port: string): string => `${machine}\u0000${port}`;

export function check(c: Chain): string[] {
  const problems: string[] = [];
  const byId = new Map<string, Machine>();

  for (const m of c.machines) {
    if (byId.has(m.id)) problems.push(`duplicate machine id '${m.id}'`);
    else byId.set(m.id, m);
    const kind = kindOf(m.kind);
    if (!kind) {
      problems.push(`machine '${m.id}': unknown kind '${m.kind}'`);
      continue;
    }
    for (const [name, v] of Object.entries(m.knobs)) {
      const knob = kind.knobs.find((x) => x.id === name);
      if (!knob) problems.push(`machine '${m.id}': unknown knob '${name}'`);
      else if (!Number.isFinite(v) || v < knob.min || v > knob.max) {
        problems.push(`machine '${m.id}': knob '${name}' = ${v} is out of range ${knob.min}..${knob.max}`);
      }
    }
  }

  const fed = new Map<string, number>();
  c.wires.forEach((w, i) => {
    const label = `wire ${i} (${w.from.machine}.${w.from.port} -> ${w.to.machine}.${w.to.port})`;
    const src = byId.get(w.from.machine);
    const dst = byId.get(w.to.machine);
    let fromType: PortType | undefined;
    let toType: PortType | undefined;
    if (!src) problems.push(`${label}: unknown machine '${w.from.machine}'`);
    else {
      const kind = kindOf(src.kind);
      if (kind) {
        const port = kind.outputs.find((x) => x.id === w.from.port);
        if (!port) problems.push(`${label}: unknown output port '${w.from.port}' on '${src.id}'`);
        else fromType = port.type;
      }
    }
    if (!dst) problems.push(`${label}: unknown machine '${w.to.machine}'`);
    else {
      const kind = kindOf(dst.kind);
      if (kind) {
        const port = kind.inputs.find((x) => x.id === w.to.port);
        if (!port) problems.push(`${label}: unknown input port '${w.to.port}' on '${dst.id}'`);
        else toType = port.type;
      }
      const key = portKey(w.to.machine, w.to.port);
      fed.set(key, (fed.get(key) ?? 0) + 1);
    }
    if (fromType !== undefined && toType !== undefined && fromType !== toType) {
      problems.push(`${label}: type mismatch, ${fromType} into ${toType}`);
    }
  });

  for (const [key, n] of fed) {
    if (n > 1) {
      const [m, port] = key.split('\u0000');
      problems.push(`input ${m ?? ''}.${port ?? ''} has ${n} wires`);
    }
  }

  if (order(c) === null) problems.push('the chain has a cycle');

  const outputs = [...byId.values()].filter((m) => m.kind === 'output');
  if (outputs.length === 0) problems.push('no output machine');

  const reported = new Set<string>();
  for (const out of outputs) {
    for (const id of upstream(c, out.id)) {
      const m = byId.get(id);
      const kind = m && kindOf(m.kind);
      if (!m || !kind) continue;
      for (const port of kind.inputs) {
        const key = portKey(m.id, port.id);
        if (fed.has(key) || reported.has(key)) continue;
        reported.add(key);
        problems.push(
          m.kind === 'output'
            ? `output '${m.id}' has nothing wired into '${port.id}'`
            : `machine '${m.id}': input '${port.id}' has nothing wired in`,
        );
      }
    }
  }

  return problems;
}

export function order(c: Chain): string[] | null {
  const ids = [...machinesById(c).keys()];
  const known = new Set(ids);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const outs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const w of c.wires) {
    if (!known.has(w.from.machine) || !known.has(w.to.machine)) continue;
    outs.get(w.from.machine)?.push(w.to.machine);
    indeg.set(w.to.machine, (indeg.get(w.to.machine) ?? 0) + 1);
  }
  const done = new Set<string>();
  const result: string[] = [];
  while (result.length < ids.length) {
    const next = ids.find((id) => !done.has(id) && (indeg.get(id) ?? 0) === 0);
    if (next === undefined) return null;
    done.add(next);
    result.push(next);
    for (const to of outs.get(next) ?? []) indeg.set(to, (indeg.get(to) ?? 0) - 1);
  }
  return result;
}

/** Recipe for the first 'output' machine; null if there is none or the chain has a cycle. */
export function recipe(c: Chain): Recipe | null {
  if (order(c) === null) return null;
  const out = c.machines.find((m) => m.kind === 'output');
  if (!out) return null;
  const byId = machinesById(c);
  const memo = new Map<string, Recipe>();

  const build = (m: Machine): Recipe => {
    const hit = memo.get(m.id);
    if (hit) return hit;
    const kind = kindOf(m.kind);
    const portIds = kind
      ? kind.inputs.map((x) => x.id)
      : [...new Set(c.wires.filter((w) => w.to.machine === m.id).map((w) => w.to.port))];
    const inputs: Record<string, Recipe> = {};
    for (const pid of portIds) {
      const w = c.wires.find((x) => x.to.machine === m.id && x.to.port === pid && byId.has(x.from.machine));
      const src = w ? byId.get(w.from.machine) : undefined;
      if (src) inputs[pid] = build(src);
    }
    const r: Recipe = { kind: m.kind, knobs: effectiveKnobs(m, kind), inputs };
    memo.set(m.id, r);
    return r;
  };

  return build(out);
}

/** Cost of the machines feeding the first 'output' machine (each machine baked once). */
export function cost(c: Chain, size: number): { ms: number; bytes: number } {
  if (!Number.isFinite(size) || size <= 0) throw new RangeError(`size must be a positive number, got ${size}`);
  const byId = machinesById(c);
  const out = c.machines.find((m) => m.kind === 'output');
  const used = out ? upstream(c, out.id) : new Set<string>();
  const area = (size / 256) ** 2;
  let ms = 0;
  let normals = false;
  for (const id of used) {
    const m = byId.get(id);
    const kind = m && kindOf(m.kind);
    if (!m || !kind) continue;
    const kn = effectiveKnobs(m, kind);
    let factor = 1;
    if (kind.kind === 'noise') factor *= (kn['octaves'] ?? 4) / 2;
    if (kind.kind === 'blur') factor *= 1 + (kn['radius'] ?? 2) / 4;
    if (kind.kind === 'stamp-normals') normals = true;
    ms += kind.costMs * factor * area;
  }
  const bytes = size * size * 4 + (normals ? size * size * 4 : 0);
  return { ms, bytes };
}

function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

const fpMemo = new WeakMap<Recipe, string>();

export function fingerprint(r: Recipe): string {
  const hit = fpMemo.get(r);
  if (hit !== undefined) return hit;
  const knobs = Object.entries(r.knobs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, v]) => [id, Object.is(v, -0) ? 0 : v]);
  const inputs = Object.entries(r.inputs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, child]) => [id, fingerprint(child)]);
  const fp = hash(JSON.stringify([r.kind, knobs, inputs]));
  fpMemo.set(r, fp);
  return fp;
}