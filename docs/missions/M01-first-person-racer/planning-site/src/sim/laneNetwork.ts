// Reference implementation of IF-LANES + IF-BUILDER (pure; never mutates input).
export type LaneNodeKind = 'normal' | 'merge' | 'split' | 'oob';
export interface LaneNode { id: string; x: number; z: number; kind: LaneNodeKind }
export interface LanePath { id: string; name: string; nodeIds: string[]; halfWidth: number }
export interface LaneNetwork { version: 1; course: 'ridge' | 'canyon' | 'stadium'; nodes: LaneNode[]; paths: LanePath[] }

export type LaneRefusal =
  | { code: 'duplicate_id'; id: string }
  | { code: 'unknown_node'; pathId: string; nodeId: string }
  | { code: 'too_few_nodes'; pathId: string }
  | { code: 'non_monotone'; pathId: string; nodeId: string }
  | { code: 'out_of_corridor'; nodeId: string }
  | { code: 'kind_mismatch'; nodeId: string; expected: LaneNodeKind | 'orphan' }
  | { code: 'bad_half_width'; pathId: string };

export const Z_LIMIT = 443;
export const SNAP_Z_LANES = [360, 120, -120, -360];
export const SNAP_X_GRID = 50;
const laneZ = (lane: number) => 480 - 240 * (lane + 0.5);

const nodeMap = (net: LaneNetwork) => new Map(net.nodes.map((n) => [n.id, n]));

function refs(net: LaneNetwork, nodeId: string) {
  let starts = 0, ends = 0, mids = 0;
  for (const p of net.paths) {
    p.nodeIds.forEach((id, i) => {
      if (id !== nodeId) return;
      if (i === 0) starts++;
      else if (i === p.nodeIds.length - 1) ends++;
      else mids++;
    });
  }
  return { starts, ends, mids };
}

export function inferKind(net: LaneNetwork, nodeId: string): LaneNodeKind | 'orphan' {
  const { starts, ends, mids } = refs(net, nodeId);
  if (starts + ends + mids === 0) return 'orphan';
  if (mids === 0 && ends >= 2 && starts === 1) return 'merge';
  if (mids === 0 && ends === 1 && starts >= 2) return 'split';
  return 'normal';
}

function kindValid(net: LaneNetwork, node: LaneNode): LaneNodeKind | 'orphan' | null {
  const { starts, ends, mids } = refs(net, node.id);
  if (starts + ends + mids === 0) return 'orphan';
  switch (node.kind) {
    case 'merge': return mids === 0 && ends >= 2 && starts === 1 ? null : inferKind(net, node.id);
    case 'split': return mids === 0 && ends === 1 && starts >= 2 ? null : inferKind(net, node.id);
    case 'oob': return mids === 0 && starts === 0 && ends >= 1 ? null : inferKind(net, node.id);
    case 'normal': {
      const ok = mids <= 1 && starts <= 1 && ends <= 1 && (mids === 0 || starts + ends === 0);
      return ok ? null : inferKind(net, node.id) === 'normal' ? 'orphan' : inferKind(net, node.id);
    }
  }
}

export function validateLaneNetwork(net: LaneNetwork): { ok: true } | { ok: false; errors: LaneRefusal[] } {
  const errors: LaneRefusal[] = [];
  const seen = new Set<string>();
  for (const id of [...net.nodes.map((n) => n.id), ...net.paths.map((p) => p.id)]) {
    if (seen.has(id)) errors.push({ code: 'duplicate_id', id });
    seen.add(id);
  }
  const nodes = nodeMap(net);
  for (const n of net.nodes) if (!Number.isFinite(n.x) || !Number.isFinite(n.z) || Math.abs(n.z) > Z_LIMIT) errors.push({ code: 'out_of_corridor', nodeId: n.id });
  for (const p of net.paths) {
    if (p.nodeIds.length < 2) errors.push({ code: 'too_few_nodes', pathId: p.id });
    if (!(p.halfWidth >= 40 && p.halfWidth <= 240)) errors.push({ code: 'bad_half_width', pathId: p.id });
    let lastX = -Infinity;
    for (const id of p.nodeIds) {
      const n = nodes.get(id);
      if (!n) { errors.push({ code: 'unknown_node', pathId: p.id, nodeId: id }); continue; }
      if (n.x <= lastX) errors.push({ code: 'non_monotone', pathId: p.id, nodeId: id });
      lastX = n.x;
    }
  }
  for (const n of net.nodes) {
    const bad = kindValid(net, n);
    if (bad) errors.push({ code: 'kind_mismatch', nodeId: n.id, expected: bad });
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function describeRefusal(r: LaneRefusal): string {
  switch (r.code) {
    case 'duplicate_id': return `Duplicate id “${r.id}”`;
    case 'unknown_node': return `Path ${r.pathId} references missing node ${r.nodeId}`;
    case 'too_few_nodes': return `Path ${r.pathId} needs at least 2 nodes`;
    case 'non_monotone': return `Path ${r.pathId}: node ${r.nodeId} does not advance down-track (x must strictly increase)`;
    case 'out_of_corridor': return `Node ${r.nodeId} is outside |z| ≤ ${Z_LIMIT}`;
    case 'kind_mismatch': return `Node ${r.nodeId}: authored kind does not match topology (looks like ${r.expected})`;
    case 'bad_half_width': return `Path ${r.pathId}: halfWidth must be within 40..240`;
  }
}

function pathNodes(net: LaneNetwork, pathId: string): LaneNode[] {
  const nodes = nodeMap(net);
  const p = net.paths.find((q) => q.id === pathId);
  return p ? (p.nodeIds.map((id) => nodes.get(id)).filter(Boolean) as LaneNode[]) : [];
}

export function sampleLane(net: LaneNetwork, pathId: string, x: number): { z: number; halfWidth: number } | null {
  const ns = pathNodes(net, pathId);
  const p = net.paths.find((q) => q.id === pathId);
  if (!p || ns.length < 2 || x < ns[0].x || x > ns[ns.length - 1].x) return null;
  for (let i = 1; i < ns.length; i++) {
    if (x <= ns[i].x) {
      const a = ns[i - 1], b = ns[i];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return { z: a.z + (b.z - a.z) * t, halfWidth: p.halfWidth };
    }
  }
  return null;
}

export function corridorAt(net: LaneNetwork, x: number): { zMin: number; zMax: number } | null {
  let zMin = Infinity, zMax = -Infinity;
  for (const p of net.paths) {
    const s = sampleLane(net, p.id, x);
    if (!s) continue;
    zMin = Math.min(zMin, s.z - s.halfWidth);
    zMax = Math.max(zMax, s.z + s.halfWidth);
  }
  if (zMin === Infinity) return null;
  return { zMin: Math.max(zMin, -Z_LIMIT), zMax: Math.min(zMax, Z_LIMIT) };
}

/** dir +1 = toward lane 3 (−z), matching changeLane(+1). */
export function adjacentPath(net: LaneNetwork, pathId: string, x: number, dir: -1 | 1): string | null {
  const cur = sampleLane(net, pathId, x);
  if (!cur) return null;
  let best: string | null = null, bestD = Infinity;
  for (const p of net.paths) {
    if (p.id === pathId) continue;
    const s = sampleLane(net, p.id, x);
    if (!s) continue;
    const d = (cur.z - s.z) * dir;
    if (d > 1 && d < bestD) { bestD = d; best = p.id; }
  }
  return best;
}

export function successorPath(net: LaneNetwork, pathId: string, z: number, bias: -1 | 0 | 1): string | null {
  const p = net.paths.find((q) => q.id === pathId);
  if (!p) return null;
  const end = p.nodeIds[p.nodeIds.length - 1];
  const outs = net.paths.filter((q) => q.nodeIds[0] === end && q.id !== pathId);
  if (!outs.length) return null;
  const nodes = nodeMap(net);
  const zOf = (q: LanePath) => nodes.get(q.nodeIds[1])?.z ?? 0;
  if (bias === 1) return [...outs].sort((a, b) => zOf(a) - zOf(b))[0].id;
  if (bias === -1) return [...outs].sort((a, b) => zOf(b) - zOf(a))[0].id;
  return [...outs].sort((a, b) => Math.abs(zOf(a) - z) - Math.abs(zOf(b) - z))[0].id;
}

export function oobCrossed(net: LaneNetwork, pathId: string, prevX: number, x: number): string | null {
  const ns = pathNodes(net, pathId);
  const last = ns[ns.length - 1];
  if (last && last.kind === 'oob' && prevX < last.x && x >= last.x) return last.id;
  return null;
}

export function resolveLaneTarget(
  racer: { targetLane: number; pathId: string | null; x: number },
  network: LaneNetwork | null,
): { targetZ: number; zMin: number; zMax: number } {
  const legacy = { targetZ: laneZ(racer.targetLane), zMin: -480 + 37, zMax: 480 - 37 };
  if (!network || racer.pathId === null) return legacy;
  const s = sampleLane(network, racer.pathId, racer.x);
  const c = corridorAt(network, racer.x);
  if (!s || !c) return legacy;
  return { targetZ: s.z, zMin: Math.max(c.zMin + 31, -443), zMax: Math.min(c.zMax - 31, 443) };
}

export function snapNode(x: number, z: number, opts: { lanes: boolean; grid: boolean }) {
  let sx = x, sz = z;
  if (opts.grid) sx = Math.round(x / SNAP_X_GRID) * SNAP_X_GRID;
  if (opts.lanes) for (const lz of SNAP_Z_LANES) if (Math.abs(z - lz) <= 30) sz = lz;
  return { x: sx, z: Math.max(-Z_LIMIT, Math.min(Z_LIMIT, sz)) };
}

// ---- edits ---------------------------------------------------------------
export type LaneEdit =
  | { op: 'moveNode'; nodeId: string; x: number; z: number }
  | { op: 'insertNode'; pathId: string; x: number; z: number }
  | { op: 'deleteNode'; nodeId: string }
  | { op: 'setKind'; nodeId: string; kind: LaneNodeKind }
  | { op: 'split'; nodeId: string; to: { x: number; z: number } }
  | { op: 'merge'; fromPathId: string; intoNodeId: string }
  | { op: 'addPath'; at: { x: number; z: number }[] }
  | { op: 'markOob'; pathId: string };

let uid = 0;
const newId = (net: LaneNetwork, prefix: string) => {
  const ids = new Set([...net.nodes.map((n) => n.id), ...net.paths.map((p) => p.id)]);
  let id = '';
  do id = `${prefix}${++uid}`; while (ids.has(id));
  return id;
};
const clone = (net: LaneNetwork): LaneNetwork => ({ ...net, nodes: net.nodes.map((n) => ({ ...n })), paths: net.paths.map((p) => ({ ...p, nodeIds: [...p.nodeIds] })) });

function monotoneOk(net: LaneNetwork, pathIds?: string[]) {
  const nodes = nodeMap(net);
  return net.paths.filter((p) => !pathIds || pathIds.includes(p.id)).every((p) => p.nodeIds.every((id, i) => i === 0 || nodes.get(id)!.x > nodes.get(p.nodeIds[i - 1])!.x));
}

function cutPathAt(net: LaneNetwork, nodeId: string): void {
  const p = net.paths.find((q) => { const i = q.nodeIds.indexOf(nodeId); return i > 0 && i < q.nodeIds.length - 1; });
  if (!p) return;
  const i = p.nodeIds.indexOf(nodeId);
  const tail: LanePath = { id: newId(net, 'P'), name: `${p.name}′`, nodeIds: p.nodeIds.slice(i), halfWidth: p.halfWidth };
  p.nodeIds = p.nodeIds.slice(0, i + 1);
  net.paths.push(tail);
}

function reinfer(net: LaneNetwork, ids: string[]) {
  for (const id of ids) {
    const n = net.nodes.find((q) => q.id === id);
    if (!n || n.kind === 'oob') continue;
    const k = inferKind(net, id);
    if (k !== 'orphan') n.kind = k;
  }
}

export function applyLaneEdit(input: LaneNetwork, edit: LaneEdit): { ok: true; network: LaneNetwork } | { ok: false; reason: string } {
  const net = clone(input);
  switch (edit.op) {
    case 'moveNode': {
      const n = net.nodes.find((q) => q.id === edit.nodeId);
      if (!n) return { ok: false, reason: 'unknown node' };
      n.x = edit.x; n.z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, edit.z));
      if (!monotoneOk(net)) return { ok: false, reason: 'move would break down-track order (x must strictly increase along every path)' };
      return { ok: true, network: net };
    }
    case 'insertNode': {
      const p = net.paths.find((q) => q.id === edit.pathId);
      if (!p) return { ok: false, reason: 'unknown path' };
      const nodes = nodeMap(net);
      const idx = p.nodeIds.findIndex((id) => nodes.get(id)!.x > edit.x);
      if (idx <= 0) return { ok: false, reason: 'insert must fall strictly between two nodes of the path' };
      const id = newId(net, 'N');
      net.nodes.push({ id, x: edit.x, z: edit.z, kind: 'normal' });
      p.nodeIds.splice(idx, 0, id);
      if (!monotoneOk(net, [p.id])) return { ok: false, reason: 'non-monotone insert' };
      return { ok: true, network: net };
    }
    case 'deleteNode': {
      const n = net.nodes.find((q) => q.id === edit.nodeId);
      if (!n) return { ok: false, reason: 'unknown node' };
      if (n.kind === 'merge' || n.kind === 'split') return { ok: false, reason: `a ${n.kind} node joins several paths — change its kind or delete a branch first` };
      net.nodes = net.nodes.filter((q) => q.id !== n.id);
      net.paths.forEach((p) => (p.nodeIds = p.nodeIds.filter((id) => id !== n.id)));
      const dropped = net.paths.filter((p) => p.nodeIds.length < 2);
      net.paths = net.paths.filter((p) => p.nodeIds.length >= 2);
      const used = new Set(net.paths.flatMap((p) => p.nodeIds));
      if (dropped.length) net.nodes = net.nodes.filter((q) => used.has(q.id));
      return { ok: true, network: net };
    }
    case 'setKind': {
      const n = net.nodes.find((q) => q.id === edit.nodeId);
      if (!n) return { ok: false, reason: 'unknown node' };
      n.kind = edit.kind;
      return { ok: true, network: net };
    }
    case 'split': {
      const n = net.nodes.find((q) => q.id === edit.nodeId);
      if (!n) return { ok: false, reason: 'unknown node' };
      if (n.kind === 'oob') return { ok: false, reason: 'cannot split from an OOB node (it is terminal)' };
      if (edit.to.x <= n.x) return { ok: false, reason: 'branch must head down-track' };
      cutPathAt(net, n.id);
      const id = newId(net, 'N');
      net.nodes.push({ id, x: edit.to.x, z: Math.max(-Z_LIMIT, Math.min(Z_LIMIT, edit.to.z)), kind: 'normal' });
      net.paths.push({ id: newId(net, 'P'), name: 'Branch', nodeIds: [n.id, id], halfWidth: 120 });
      reinfer(net, [n.id]);
      return { ok: true, network: net };
    }
    case 'merge': {
      const p = net.paths.find((q) => q.id === edit.fromPathId);
      const into = net.nodes.find((q) => q.id === edit.intoNodeId);
      if (!p || !into) return { ok: false, reason: 'unknown path or node' };
      if (p.nodeIds.includes(into.id)) return { ok: false, reason: 'cannot merge a path into itself' };
      const nodes = nodeMap(net);
      const endId = p.nodeIds[p.nodeIds.length - 1];
      const end = nodes.get(endId)!;
      if (end.kind === 'oob') return { ok: false, reason: 'path ends in OOB — change that node first' };
      if (net.paths.some((q) => q.nodeIds[0] === endId)) return { ok: false, reason: 'path end already continues elsewhere' };
      if (into.x <= end.x) return { ok: false, reason: 'target node must be down-track of the path end' };
      if (into.kind === 'oob') return { ok: false, reason: 'cannot merge into an OOB node' };
      cutPathAt(net, into.id);
      p.nodeIds.push(into.id);
      reinfer(net, [into.id, endId]);
      return { ok: true, network: net };
    }
    case 'addPath': {
      if (edit.at.length < 2) return { ok: false, reason: 'need at least two points' };
      const ids = edit.at.map((pt) => { const id = newId(net, 'N'); net.nodes.push({ id, x: pt.x, z: pt.z, kind: 'normal' }); return id; });
      const pid = newId(net, 'P');
      net.paths.push({ id: pid, name: `Lane ${net.paths.length + 1}`, nodeIds: ids, halfWidth: 120 });
      if (!monotoneOk(net, [pid])) return { ok: false, reason: 'points must advance down-track' };
      return { ok: true, network: net };
    }
    case 'markOob': {
      const p = net.paths.find((q) => q.id === edit.pathId);
      if (!p) return { ok: false, reason: 'unknown path' };
      const endId = p.nodeIds[p.nodeIds.length - 1];
      if (net.paths.some((q) => q.nodeIds[0] === endId)) return { ok: false, reason: 'end node continues into another path — cannot be OOB' };
      net.nodes.find((q) => q.id === endId)!.kind = 'oob';
      return { ok: true, network: net };
    }
  }
}

export function sampleNetwork(): LaneNetwork {
  return {
    version: 1,
    course: 'ridge',
    nodes: [
      { id: 'a1', x: 300, z: 360, kind: 'normal' },
      { id: 'a2', x: 1500, z: 360, kind: 'normal' },
      { id: 'b1', x: 300, z: 120, kind: 'normal' },
      { id: 'b2', x: 1500, z: 120, kind: 'normal' },
      { id: 'm1', x: 2300, z: 240, kind: 'merge' },
      { id: 'c1', x: 3000, z: 240, kind: 'normal' },
      { id: 's1', x: 3500, z: 240, kind: 'split' },
      { id: 'd1', x: 4300, z: 360, kind: 'normal' },
      { id: 'd2', x: 5600, z: 360, kind: 'normal' },
      { id: 'e1', x: 4100, z: 40, kind: 'normal' },
      { id: 'o1', x: 4700, z: -60, kind: 'oob' },
      { id: 'f1', x: 300, z: -240, kind: 'normal' },
      { id: 'f2', x: 2800, z: -300, kind: 'normal' },
      { id: 'f3', x: 5600, z: -240, kind: 'normal' },
    ],
    paths: [
      { id: 'A', name: 'Far lane', nodeIds: ['a1', 'a2', 'm1'], halfWidth: 110 },
      { id: 'B', name: 'Mid lane', nodeIds: ['b1', 'b2', 'm1'], halfWidth: 110 },
      { id: 'C', name: 'Merged', nodeIds: ['m1', 'c1', 's1'], halfWidth: 130 },
      { id: 'D', name: 'High road', nodeIds: ['s1', 'd1', 'd2'], halfWidth: 110 },
      { id: 'E', name: 'Cliff cut', nodeIds: ['s1', 'e1', 'o1'], halfWidth: 100 },
      { id: 'F', name: 'Near lane', nodeIds: ['f1', 'f2', 'f3'], halfWidth: 120 },
    ],
  };
}
