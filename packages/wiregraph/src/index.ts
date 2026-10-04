export interface GNode { id: string; inputs: string[]; outputs: string[] }
export interface End { node: string; port: string }
export interface Wire { from: End; to: End }
export interface Graph { nodes: GNode[]; wires: Wire[] }
export interface Placed { id: string; x: number; y: number; w: number; h: number }
export interface LayoutOptions { nodeW?: number; nodeH?: number; colGap?: number; rowGap?: number }

const DEFAULTS = { nodeW: 160, nodeH: 60, colGap: 80, rowGap: 30 } as const;

function indexNodes(g: Graph): Map<string, GNode> {
  const byId = new Map<string, GNode>();
  for (const node of g.nodes) if (!byId.has(node.id)) byId.set(node.id, node);
  return byId;
}
function cloneNode(node: GNode): GNode {
  return { id: node.id, inputs: node.inputs.slice(), outputs: node.outputs.slice() };
}
function cloneWire(wire: Wire): Wire {
  return { from: { node: wire.from.node, port: wire.from.port }, to: { node: wire.to.node, port: wire.to.port } };
}
function realWires(g: Graph, byId: Map<string, GNode>): Wire[] {
  const out: Wire[] = [];
  for (const wire of g.wires) if (byId.has(wire.from.node) && byId.has(wire.to.node)) out.push(wire);
  return out;
}

export function problems(g: Graph): string[] {
  const out: string[] = [];
  const byId = new Map<string, GNode>();
  for (const node of g.nodes) {
    if (byId.has(node.id)) out.push(`two nodes share the id "${node.id}"`);
    else byId.set(node.id, node);
  }
  const feeds = new Map<string, number>();
  const feedOrder: string[] = [];
  for (let i = 0; i < g.wires.length; i++) {
    const wire = g.wires[i];
    if (wire === undefined) continue;
    const src = byId.get(wire.from.node);
    const dst = byId.get(wire.to.node);
    if (src === undefined) out.push(`wire ${i}: starts at unknown node "${wire.from.node}"`);
    else if (src.outputs.indexOf(wire.from.port) < 0) {
      if (src.inputs.indexOf(wire.from.port) >= 0)
        out.push(`wire ${i}: starts at the input "${wire.from.node}.${wire.from.port}", but wires leave outputs`);
      else out.push(`wire ${i}: node "${wire.from.node}" has no output called "${wire.from.port}"`);
    }
    if (dst === undefined) out.push(`wire ${i}: ends at unknown node "${wire.to.node}"`);
    else if (dst.inputs.indexOf(wire.to.port) < 0) {
      if (dst.outputs.indexOf(wire.to.port) >= 0)
        out.push(`wire ${i}: ends at the output "${wire.to.node}.${wire.to.port}", but wires arrive at inputs`);
      else out.push(`wire ${i}: node "${wire.to.node}" has no input called "${wire.to.port}"`);
    } else {
      const key = `${wire.to.node}\u0000${wire.to.port}`;
      const seen = feeds.get(key);
      if (seen === undefined) { feeds.set(key, 1); feedOrder.push(key); } else feeds.set(key, seen + 1);
    }
  }
  for (const key of feedOrder) {
    const count = feeds.get(key) ?? 0;
    if (count > 1) {
      const cut = key.indexOf('\u0000');
      out.push(`the input "${key.slice(0, cut)}.${key.slice(cut + 1)}" is fed by ${count} wires, but an input takes one`);
    }
  }
  for (const cycle of findCycles(g, byId)) out.push(`the wires run in a cycle: ${cycle.join(' -> ')}`);
  return out;
}

function findCycles(g: Graph, byId: Map<string, GNode>): string[][] {
  const next = new Map<string, string[]>();
  for (const id of byId.keys()) next.set(id, []);
  for (const wire of realWires(g, byId)) {
    const list = next.get(wire.from.node);
    if (list !== undefined && list.indexOf(wire.to.node) < 0) list.push(wire.to.node);
  }
  const state = new Map<string, 0 | 1 | 2>();
  for (const id of byId.keys()) state.set(id, 0);
  const stack: string[] = [];
  const cycles: string[][] = [];
  const reported = new Set<string>();
  const walk = (id: string): void => {
    state.set(id, 1);
    stack.push(id);
    for (const other of next.get(id) ?? []) {
      const mark = state.get(other) ?? 0;
      if (mark === 0) walk(other);
      else if (mark === 1) {
        const at = stack.indexOf(other);
        const loop = stack.slice(at < 0 ? stack.length - 1 : at);
        loop.push(other);
        const key = loop.join('\u0000');
        if (!reported.has(key)) { reported.add(key); cycles.push(loop); }
      }
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const node of g.nodes) if ((state.get(node.id) ?? 2) === 0) walk(node.id);
  return cycles;
}

function columnOf(g: Graph, byId: Map<string, GNode>): Map<string, number> {
  const col = new Map<string, number>();
  for (const id of byId.keys()) col.set(id, 0);
  const wires = realWires(g, byId);
  for (let round = 0; round < byId.size; round++) {
    let moved = false;
    for (const wire of wires) {
      if (wire.from.node === wire.to.node) continue;
      const a = col.get(wire.from.node) ?? 0;
      const b = col.get(wire.to.node) ?? 0;
      if (b < a + 1) { col.set(wire.to.node, a + 1); moved = true; }
    }
    if (!moved) break;
  }
  return col;
}
function positions(column: string[]): Map<string, number> {
  const pos = new Map<string, number>();
  for (let i = 0; i < column.length; i++) { const id = column[i]; if (id !== undefined) pos.set(id, i); }
  return pos;
}
function neighbourPositions(wires: Wire[], id: string, ref: Map<string, number>, side: 'sources' | 'targets'): number[] {
  const found: number[] = [];
  for (const wire of wires) {
    if (side === 'sources') {
      if (wire.to.node === id) { const p = ref.get(wire.from.node); if (p !== undefined) found.push(p); }
    } else if (wire.from.node === id) { const p = ref.get(wire.to.node); if (p !== undefined) found.push(p); }
  }
  return found;
}
function sortColumn(column: string[], wires: Wire[], ref: Map<string, number>, side: 'sources' | 'targets'): string[] {
  const keyed = column.map((id, i) => {
    const near = neighbourPositions(wires, id, ref, side);
    let value = i;
    if (near.length > 0) { let sum = 0; for (const p of near) sum += p; value = sum / near.length; }
    return { id, i, value };
  });
  keyed.sort((a, b) => (a.value - b.value) || (a.i - b.i));
  return keyed.map((k) => k.id);
}

export function layers(g: Graph): string[][] {
  const byId = indexNodes(g);
  const col = columnOf(g, byId);
  const wires = realWires(g, byId);
  let widest = 0;
  for (const c of col.values()) if (c > widest) widest = c;
  const buckets: string[][] = [];
  for (let i = 0; i <= widest; i++) buckets.push([]);
  for (const node of g.nodes) {
    const c = col.get(node.id);
    if (c === undefined) continue;
    const bucket = buckets[c];
    if (bucket !== undefined && bucket.indexOf(node.id) < 0) bucket.push(node.id);
  }
  const cols = buckets.filter((b) => b.length > 0);
  const sweepRight = (): void => {
    for (let k = 1; k < cols.length; k++) {
      const left = cols[k - 1]; const here = cols[k];
      if (left === undefined || here === undefined) continue;
      cols[k] = sortColumn(here, wires, positions(left), 'sources');
    }
  };
  const sweepLeft = (): void => {
    for (let k = cols.length - 2; k >= 0; k--) {
      const right = cols[k + 1]; const here = cols[k];
      if (right === undefined || here === undefined) continue;
      cols[k] = sortColumn(here, wires, positions(right), 'targets');
    }
  };
  sweepRight(); sweepLeft(); sweepRight(); sweepLeft();
  return cols;
}

export function crossings(g: Graph, order: string[][]): number {
  const layerOf = new Map<string, number>();
  const posOf = new Map<string, number>();
  for (let k = 0; k < order.length; k++) {
    const column = order[k];
    if (column === undefined) continue;
    for (let i = 0; i < column.length; i++) {
      const id = column[i];
      if (id === undefined || layerOf.has(id)) continue;
      layerOf.set(id, k); posOf.set(id, i);
    }
  }
  const spans: { layer: number; a: number; b: number }[] = [];
  for (const wire of g.wires) {
    const la = layerOf.get(wire.from.node);
    const lb = layerOf.get(wire.to.node);
    if (la === undefined || lb === undefined || lb !== la + 1) continue;
    const a = posOf.get(wire.from.node); const b = posOf.get(wire.to.node);
    if (a === undefined || b === undefined) continue;
    spans.push({ layer: la, a, b });
  }
  let total = 0;
  for (let i = 0; i < spans.length; i++) {
    const one = spans[i];
    if (one === undefined) continue;
    for (let j = i + 1; j < spans.length; j++) {
      const two = spans[j];
      if (two === undefined || two.layer !== one.layer) continue;
      if ((one.a - two.a) * (one.b - two.b) < 0) total++;
    }
  }
  return total;
}

export function layout(g: Graph, opt?: LayoutOptions): Placed[] {
  const nodeW = opt?.nodeW ?? DEFAULTS.nodeW;
  const nodeH = opt?.nodeH ?? DEFAULTS.nodeH;
  const colGap = opt?.colGap ?? DEFAULTS.colGap;
  const rowGap = opt?.rowGap ?? DEFAULTS.rowGap;
  const cols = layers(g);
  const placed: Placed[] = [];
  for (let k = 0; k < cols.length; k++) {
    const column = cols[k];
    if (column === undefined) continue;
    for (let i = 0; i < column.length; i++) {
      const id = column[i];
      if (id === undefined) continue;
      placed.push({ id, x: k * (nodeW + colGap), y: i * (nodeH + rowGap), w: nodeW, h: nodeH });
    }
  }
  return placed;
}

export function portPos(p: Placed, n: GNode, side: 'in' | 'out', port: string): [number, number] | null {
  const list = side === 'in' ? n.inputs : n.outputs;
  const i = list.indexOf(port);
  if (i < 0) return null;
  const x = side === 'in' ? p.x : p.x + p.w;
  const y = p.y + (p.h * (i + 1)) / (list.length + 1);
  return [x, y];
}

export function portAt(placed: Placed[], g: Graph, x: number, y: number, radius = 8): (End & { side: 'in' | 'out' }) | null {
  const byId = indexNodes(g);
  let best: (End & { side: 'in' | 'out' }) | null = null;
  let bestD = Infinity;
  for (const box of placed) {
    const node = byId.get(box.id);
    if (node === undefined) continue;
    const sides: ('in' | 'out')[] = ['in', 'out'];
    for (const side of sides) {
      const ports = side === 'in' ? node.inputs : node.outputs;
      for (const port of ports) {
        const at = portPos(box, node, side, port);
        if (at === null) continue;
        const dx = at[0] - x; const dy = at[1] - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= radius && d < bestD) { bestD = d; best = { node: node.id, port, side }; }
      }
    }
  }
  return best;
}

export function wirePath(a: [number, number], b: [number, number]): [[number, number], [number, number], [number, number], [number, number]] {
  const dx = Math.max(40, Math.abs(b[0] - a[0]) / 2);
  return [[a[0], a[1]], [a[0] + dx, a[1]], [b[0] - dx, b[1]], [b[0], b[1]]];
}

export function connect(g: Graph, from: End, to: End): Graph {
  const wires: Wire[] = [];
  for (const wire of g.wires) {
    if (wire.to.node === to.node && wire.to.port === to.port) continue;
    wires.push(cloneWire(wire));
  }
  wires.push({ from: { node: from.node, port: from.port }, to: { node: to.node, port: to.port } });
  return { nodes: g.nodes.map(cloneNode), wires };
}