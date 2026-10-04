export type Vec3 = [number, number, number];
export type Node =
  | { id: string; kind: 'inside'; centre: Vec3; half: Vec3 }
  | { id: string; kind: 'enter'; centre: Vec3; half: Vec3 }
  | { id: string; kind: 'leave'; centre: Vec3; half: Vec3 }
  | { id: string; kind: 'press'; key: string }
  | { id: string; kind: 'timer'; every: number }
  | { id: string; kind: 'and' | 'or'; inputs: string[] }
  | { id: string; kind: 'not'; inputs: [string] }
  | { id: string; kind: 'delay'; inputs: [string]; seconds: number }
  | { id: string; kind: 'gate'; inputs: [string, string] }
  | { id: string; kind: 'once'; inputs: [string] }
  | { id: string; kind: 'toggle'; inputs: [string] }
  | { id: string; kind: 'action'; inputs: [string]; action: Action; repeat: number };
export type Action =
  | { kind: 'open' | 'close' | 'light-on' | 'light-off' | 'show' | 'hide'; target: string }
  | { kind: 'sound'; sound: string }
  | { kind: 'teleport'; to: Vec3 }
  | { kind: 'damage'; amount: number }
  | { kind: 'say'; text: string };
export interface Frame { dt: number; actors: Vec3[]; pressed: string[] }
export interface Fired { node: string; action: Action }

const EPS = 1e-9;

function inputsOf(n: Node): readonly string[] {
  return 'inputs' in n ? n.inputs : [];
}

function arity(n: Node): [number, number] {
  switch (n.kind) {
    case 'inside': case 'enter': case 'leave': case 'press': case 'timer': return [0, 0];
    case 'and': case 'or': return [1, Number.MAX_SAFE_INTEGER];
    case 'gate': return [2, 2];
    default: return [1, 1];
  }
}

export function validate(nodes: readonly Node[]): string[] {
  const problems: string[] = [];
  const byId = new Map<string, Node>();
  for (const n of nodes) {
    if (byId.has(n.id)) problems.push(`duplicate node id "${n.id}"`);
    byId.set(n.id, n);
  }
  for (const n of nodes) {
    const ins = inputsOf(n);
    const [lo, hi] = arity(n);
    if (ins.length < lo || ins.length > hi) problems.push(`node "${n.id}" (${n.kind}) has a wrong number of inputs: ${ins.length}`);
    for (const i of ins) if (!byId.has(i)) problems.push(`node "${n.id}" reads an unknown input "${i}"`);
    if (n.kind === 'timer' && !(n.every > 0)) problems.push(`timer "${n.id}" needs a positive period`);
    if (n.kind === 'delay' && n.seconds < 0) problems.push(`delay "${n.id}" has a negative time`);
    if (n.kind === 'action' && n.repeat < 0) problems.push(`action "${n.id}" has a negative repeat`);
  }
  // cycles
  const state = new Map<string, number>();
  const walk = (id: string): boolean => {
    const s = state.get(id) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    const n = byId.get(id);
    if (n) for (const i of inputsOf(n)) if (byId.has(i) && walk(i)) { state.set(id, 2); return true; }
    state.set(id, 2);
    return false;
  };
  for (const n of nodes) {
    state.clear();
    if (walk(n.id)) { problems.push(`node "${n.id}" is part of a cycle`); break; }
  }
  return problems;
}

interface Sample { t: number; v: boolean }

export class LogicGraph {
  private readonly nodes: readonly Node[];
  private readonly order: Node[];
  private cur = new Map<string, boolean>();
  private prev = new Map<string, boolean>();
  private t = 0;
  private occupied = new Map<string, boolean>();
  private ticks = new Map<string, number>();
  private history = new Map<string, Sample[]>();
  private fireCount = new Map<string, number>();
  private onceDone = new Map<string, boolean>();
  private toggleState = new Map<string, boolean>();

  constructor(nodes: readonly Node[]) {
    const problems = validate(nodes);
    if (problems.length > 0) throw new Error(problems.join('; '));
    this.nodes = nodes.slice();
    const byId = new Map<string, Node>();
    for (const n of this.nodes) byId.set(n.id, n);
    const order: Node[] = [];
    const seen = new Set<string>();
    const visit = (n: Node): void => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      for (const i of inputsOf(n)) { const p = byId.get(i); if (p) visit(p); }
      order.push(n);
    };
    for (const n of this.nodes) visit(n);
    this.order = order;
    this.reset();
  }

  reset(): void {
    this.cur = new Map();
    this.prev = new Map();
    this.t = 0;
    this.occupied = new Map();
    this.ticks = new Map();
    this.history = new Map();
    this.fireCount = new Map();
    this.onceDone = new Map();
    this.toggleState = new Map();
    for (const n of this.nodes) {
      this.cur.set(n.id, false);
      this.prev.set(n.id, false);
      if (n.kind === 'inside' || n.kind === 'enter' || n.kind === 'leave') this.occupied.set(n.id, false);
      if (n.kind === 'timer') this.ticks.set(n.id, 0);
      if (n.kind === 'delay') this.history.set(n.id, []);
      if (n.kind === 'action') this.fireCount.set(n.id, 0);
      if (n.kind === 'once') this.onceDone.set(n.id, false);
      if (n.kind === 'toggle') this.toggleState.set(n.id, false);
    }
  }

  value(id: string): boolean {
    return this.cur.get(id) ?? false;
  }

  private get(id: string): boolean { return this.cur.get(id) ?? false; }
  private was(id: string): boolean { return this.prev.get(id) ?? false; }

  private anyInside(centre: Vec3, half: Vec3, actors: readonly Vec3[]): boolean {
    for (const a of actors) {
      let ok = true;
      for (let k = 0; k < 3; k++) {
        const p = a[k] ?? 0, c = centre[k] ?? 0, h = half[k] ?? 0;
        if (Math.abs(p - c) > h + EPS) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  step(f: Frame): Fired[] {
    this.prev = new Map(this.cur);
    this.t += f.dt;
    const now = this.t;
    const fired: Fired[] = [];
    const pressed = new Set(f.pressed);
    for (const n of this.order) {
      let v = false;
      switch (n.kind) {
        case 'inside': v = this.anyInside(n.centre, n.half, f.actors); this.occupied.set(n.id, v); break;
        case 'enter': {
          const now2 = this.anyInside(n.centre, n.half, f.actors);
          v = now2 && !(this.occupied.get(n.id) ?? false);
          this.occupied.set(n.id, now2);
          break;
        }
        case 'leave': {
          const now2 = this.anyInside(n.centre, n.half, f.actors);
          v = !now2 && (this.occupied.get(n.id) ?? false);
          this.occupied.set(n.id, now2);
          break;
        }
        case 'press': v = pressed.has(n.key); break;
        case 'timer': {
          const c = Math.floor((now + EPS) / n.every);
          v = c > (this.ticks.get(n.id) ?? 0);
          this.ticks.set(n.id, c);
          break;
        }
        case 'and': v = n.inputs.every((i) => this.get(i)); break;
        case 'or': v = n.inputs.some((i) => this.get(i)); break;
        case 'not': v = !this.get(n.inputs[0]); break;
        case 'delay': {
          const h = this.history.get(n.id) ?? [];
          h.push({ t: now, v: this.get(n.inputs[0]) });
          this.history.set(n.id, h);
          const want = now - n.seconds;
          let found: Sample | undefined;
          for (const s of h) { if (s.t <= want + EPS) found = s; else break; }
          v = found !== undefined && found.v;
          break;
        }
        case 'gate': v = this.get(n.inputs[0]) && this.get(n.inputs[1]); break;
        case 'once': {
          const inv = this.get(n.inputs[0]);
          if (inv && !(this.onceDone.get(n.id) ?? false)) { v = true; this.onceDone.set(n.id, true); }
          break;
        }
        case 'toggle': {
          const inv = this.get(n.inputs[0]);
          if (inv && !this.was(n.inputs[0])) this.toggleState.set(n.id, !(this.toggleState.get(n.id) ?? false));
          v = this.toggleState.get(n.id) ?? false;
          break;
        }
        case 'action': {
          const inv = this.get(n.inputs[0]);
          const rising = inv && !this.was(n.inputs[0]);
          const count = this.fireCount.get(n.id) ?? 0;
          if (rising && (n.repeat === 0 || count < n.repeat)) {
            this.fireCount.set(n.id, count + 1);
            fired.push({ node: n.id, action: n.action });
            v = true;
          }
          break;
        }
      }
      this.cur.set(n.id, v);
    }
    return fired;
  }
}