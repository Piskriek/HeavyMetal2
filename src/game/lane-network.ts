/**
 * M01 · T6 (IF-LANES) — authored lane paths: schema, validation, sampling, topology, OOB.
 *
 * The game has always steered in `z` towards one of four fixed lane centres. This module generalises
 * that to a **network of authored paths**: nodes placed in engine space (`x`, lateral `z`), paths
 * that are ordered runs of nodes with strictly increasing `x`, and three node kinds that say what
 * happens where paths meet — `merge`, `split`, and `oob` (out of bounds).
 *
 * Two laws keep this cheap to reason about:
 *
 *  1. **Engine space, not world space.** Physics steers in `z`, and engine space is what
 *     `placementFromEngine` consumes, so authoring here means an edit cannot desync physics from
 *     paint. Altitude is always taken from the surface.
 *  2. **A null network is exactly the old game.** `resolveLaneTarget` is the single integration
 *     point (D12): with `null` it returns `laneZ(targetLane)` and the legacy corridor, character for
 *     character, so every tuned handling value and every parity fingerprint is untouched.
 *
 * Everything here is pure: no DOM, no canvas, no three.js, no React.
 */
import { COURSES, type CourseId } from './types';
import { FINISH, LANE, LANE_WIDTH, RADIUS, START_X } from './scene';

export const LANE_NETWORK_VERSION = 1 as const;

/** The corridor every node must live inside: `LANE` less one ball of clearance. */
export const LANE_Z_LIMIT = LANE.far - RADIUS - 6; // 443
export const LANE_HALF_WIDTH_MIN = 40;
export const LANE_HALF_WIDTH_MAX = 240;
/** Default path half-width: one lane (D11). */
export const DEFAULT_HALF_WIDTH = LANE_WIDTH / 2;

export type LaneNodeKind = 'normal' | 'merge' | 'split' | 'oob';

/** Kept as an array so runtime code can validate a document without a type-cast. */
export const LANE_NODE_KINDS: readonly LaneNodeKind[] = ['normal', 'merge', 'split', 'oob'];

export interface LaneNode {
  id: string;
  /** Engine x (START_X..FINISH). */
  x: number;
  /** Engine lateral z, |z| ≤ 443. */
  z: number;
  kind: LaneNodeKind;
  /** Unknown fields survive a load → save round trip. */
  [key: string]: unknown;
}

export interface LanePath {
  id: string;
  name: string;
  /** At least two node ids, with strictly increasing x. */
  nodeIds: string[];
  /** z-units, 40..240. */
  halfWidth: number;
  [key: string]: unknown;
}

export interface LaneNetwork {
  version: typeof LANE_NETWORK_VERSION;
  course: CourseId;
  nodes: LaneNode[];
  paths: LanePath[];
  [key: string]: unknown;
}

export type LaneRefusal =
  | { code: 'duplicate_id'; id: string }
  | { code: 'unknown_node'; pathId: string; nodeId: string }
  | { code: 'too_few_nodes'; pathId: string }
  | { code: 'non_monotone'; pathId: string; nodeId: string }
  | { code: 'out_of_corridor'; nodeId: string }
  | { code: 'kind_mismatch'; nodeId: string; expected: LaneNodeKind }
  | { code: 'bad_half_width'; pathId: string };

export type LaneValidation =
  | { ok: true; network: LaneNetwork }
  | { ok: false; errors: LaneRefusal[] };

/* -----------------------------------------------------------------------------
   1. VALIDATION
   -------------------------------------------------------------------------- */

/**
 * How a document that is not a lane network at all is refused: `kind_mismatch` with an empty
 * `nodeId`. The seven refusal codes are frozen (IF-LANES) and none of them means "this is not a
 * network", so the document's own kind is reported as not matching `LANE_NETWORK_VERSION`.
 */
const notANetwork = (): LaneRefusal[] => [{ code: 'kind_mismatch', nodeId: '', expected: 'normal' }];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCourse = (value: unknown): value is CourseId =>
  typeof value === 'string' && COURSES.some((course) => course.id === value);

function usableId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id === '' ? null : id;
}

/**
 * Validates an unknown document. Every problem is reported, in a stable order (nodes, then paths),
 * so the builder's error list does not reshuffle under the author's cursor.
 */
export function validateLaneNetwork(doc: unknown): LaneValidation {
  if (!isRecord(doc)) return { ok: false, errors: notANetwork() };
  if (doc.version !== LANE_NETWORK_VERSION || !isCourse(doc.course)) return { ok: false, errors: notANetwork() };
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.paths)) return { ok: false, errors: notANetwork() };

  const errors: LaneRefusal[] = [];
  const nodes: LaneNode[] = [];
  const byId = new Map<string, LaneNode>();

  for (const raw of doc.nodes as unknown[]) {
    if (!isRecord(raw)) { errors.push(...notANetwork()); continue; }
    const id = usableId(raw.id);
    // An entry with no id shares the (absent) id with any other such entry: the id is the thing that
    // is wrong, and `duplicate_id` is the code that names it.
    if (id === null) { errors.push({ code: 'duplicate_id', id: '' }); continue; }
    if (byId.has(id)) { errors.push({ code: 'duplicate_id', id }); continue; }
    const kind = raw.kind as LaneNodeKind;
    if (typeof kind !== 'string' || !LANE_NODE_KINDS.includes(kind)) {
      errors.push({ code: 'kind_mismatch', nodeId: id, expected: 'normal' });
      continue;
    }
    const x = raw.x; const z = raw.z;
    if (typeof x !== 'number' || !Number.isFinite(x) || x < START_X || x > FINISH
      || typeof z !== 'number' || !Number.isFinite(z) || Math.abs(z) > LANE_Z_LIMIT) {
      errors.push({ code: 'out_of_corridor', nodeId: id });
      continue;
    }
    const node: LaneNode = { ...raw, id, x, z, kind } as LaneNode;
    nodes.push(node); byId.set(id, node);
  }

  const paths: LanePath[] = [];
  const pathIds = new Set<string>();
  for (const raw of doc.paths as unknown[]) {
    if (!isRecord(raw)) { errors.push(...notANetwork()); continue; }
    const id = usableId(raw.id);
    if (id === null) { errors.push({ code: 'duplicate_id', id: '' }); continue; }
    if (pathIds.has(id)) { errors.push({ code: 'duplicate_id', id }); continue; }
    pathIds.add(id);
    const nodeIds = Array.isArray(raw.nodeIds) ? raw.nodeIds.map((value) => String(value)) : [];
    const halfWidth = raw.halfWidth === undefined ? DEFAULT_HALF_WIDTH : raw.halfWidth;
    if (typeof halfWidth !== 'number' || !Number.isFinite(halfWidth)
      || halfWidth < LANE_HALF_WIDTH_MIN || halfWidth > LANE_HALF_WIDTH_MAX) {
      errors.push({ code: 'bad_half_width', pathId: id });
    }
    if (nodeIds.length < 2) { errors.push({ code: 'too_few_nodes', pathId: id }); continue; }
    let previousX = -Infinity;
    let broken = false;
    for (const nodeId of nodeIds) {
      const node = byId.get(nodeId);
      if (!node) { errors.push({ code: 'unknown_node', pathId: id, nodeId }); broken = true; continue; }
      if (node.x <= previousX) { errors.push({ code: 'non_monotone', pathId: id, nodeId }); broken = true; }
      previousX = node.x;
    }
    if (broken) continue;
    paths.push({
      ...raw, id, name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : id,
      nodeIds, halfWidth: halfWidth as number,
    } as LanePath);
  }

  if (errors.length) return { ok: false, errors };

  const network: LaneNetwork = {
    ...doc, version: LANE_NETWORK_VERSION, course: doc.course as CourseId, nodes, paths,
  } as LaneNetwork;

  // Node kind against topology, on the graph that survived the shape pass. A node no path references
  // is unconstrained: it is an authored spare, and `inferKind` calls it an orphan.
  for (const node of nodes) {
    const inferred = inferKind(network, node.id);
    if (inferred === 'orphan') {
      if (topologyOf(network, node.id).refs === 0) continue;
      errors.push({ code: 'kind_mismatch', nodeId: node.id, expected: impliedKind(network, node.id) });
      continue;
    }
    if (inferred !== node.kind) errors.push({ code: 'kind_mismatch', nodeId: node.id, expected: inferred });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, network };
}

/* -----------------------------------------------------------------------------
   2. TOPOLOGY
   -------------------------------------------------------------------------- */

interface NodeTopology {
  /** Paths that contain the node at all. */
  refs: number;
  /** Paths that begin at the node. */
  starts: number;
  /** Paths that end at the node. */
  ends: number;
}

function topologyOf(network: LaneNetwork, nodeId: string): NodeTopology {
  let refs = 0; let starts = 0; let ends = 0;
  for (const path of network.paths) {
    const index = path.nodeIds.indexOf(nodeId);
    if (index < 0) continue;
    refs += 1;
    if (index === 0) starts += 1;
    if (index === path.nodeIds.length - 1) ends += 1;
  }
  return { refs, starts, ends };
}

/**
 * The kind the *graph* says a node is, from D11's four rules:
 *
 * | Kind | Shape |
 * | --- | --- |
 * | `merge` | ends ≥ 2 paths, starts exactly 1 |
 * | `split` | ends exactly 1 path, starts ≥ 2 |
 * | `oob` | ends ≥ 1 path, starts none |
 * | `normal` | starts and ends at most 1 path each |
 *
 * The one special case is the end of the world: a dead-end node **at or past the finish line** is
 * `normal`, because there is nothing left to drive on and the race is already over. Everywhere else
 * a dead end *is* out of bounds — drive off the end of the authored road and the road has run out —
 * which is exactly what R13's out-of-bounds trigger nodes mean.
 *
 * `orphan` means "no path references this node" — or "the shape is none of the four", which no
 * authored kind can be right for. `impliedKind` is the kind such a shape was *trying* to be, for the
 * refusal's `expected` field.
 */
export function inferKind(network: LaneNetwork, nodeId: string): LaneNodeKind | 'orphan' {
  const { refs, starts, ends } = topologyOf(network, nodeId);
  if (refs === 0) return 'orphan';
  if (ends >= 2 && starts === 1) return 'merge';
  if (ends === 1 && starts >= 2) return 'split';
  if (starts <= 1 && ends <= 1) {
    const node = network.nodes.find((candidate) => candidate.id === nodeId);
    if (starts === 0 && ends >= 1 && node !== undefined && node.x < FINISH) return 'oob';
    return 'normal';
  }
  return 'orphan';
}

function impliedKind(network: LaneNetwork, nodeId: string): LaneNodeKind {
  const { starts, ends } = topologyOf(network, nodeId);
  if (ends === 1 && starts >= 2) return 'split';
  if (ends >= 2) return 'merge';
  return 'normal';
}

/* -----------------------------------------------------------------------------
   3. SAMPLING
   -------------------------------------------------------------------------- */

const pathById = (network: LaneNetwork, pathId: string): LanePath | null =>
  network.paths.find((path) => path.id === pathId) ?? null;

/** The centre and half-width of a path at an x, or `null` when the path is not active there. */
export function sampleLane(network: LaneNetwork, pathId: string, x: number): { z: number; halfWidth: number } | null {
  const path = pathById(network, pathId);
  if (!path) return null;
  const nodes = path.nodeIds.map((id) => network.nodes.find((node) => node.id === id));
  if (nodes.some((node) => node === undefined)) return null;
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  if (x < first.x || x > last.x) return null;
  for (let index = 1; index < nodes.length; index++) {
    const a = nodes[index - 1]!;
    const b = nodes[index]!;
    if (x < a.x || x > b.x) continue;
    const span = b.x - a.x;
    const t = span === 0 ? 0 : (x - a.x) / span;
    return { z: a.z + (b.z - a.z) * t, halfWidth: path.halfWidth };
  }
  // A path whose nodes are not strictly increasing would have failed validation; x === last.x has
  // been handled by the loop above, so this is the degenerate remainder.
  return { z: last.z, halfWidth: path.halfWidth };
}

/**
 * The drivable corridor at an x: the union of every path active there, clipped to ±443.
 *
 * The union of a set of intervals can be disjoint, and this returns a single interval — the
 * outermost bounds — on purpose: the corridor's job is to keep a ball from steering *out* of the
 * authored road, and clamping a ball that sits between two corridors into the nearer one would be
 * worse than letting it roll across the gap.
 */
export function corridorAt(network: LaneNetwork, x: number): { zMin: number; zMax: number } | null {
  let zMin = Infinity; let zMax = -Infinity;
  for (const path of network.paths) {
    const sample = sampleLane(network, path.id, x);
    if (!sample) continue;
    zMin = Math.min(zMin, sample.z - sample.halfWidth);
    zMax = Math.max(zMax, sample.z + sample.halfWidth);
  }
  if (zMin === Infinity) return null;
  return { zMin: Math.max(-LANE_Z_LIMIT, zMin), zMax: Math.min(LANE_Z_LIMIT, zMax) };
}

/**
 * The nearest path to a point, or `null` when no path is active at that x. Used to put a racer on
 * the network when one loads.
 */
export function nearestPath(network: LaneNetwork, x: number, z: number): string | null {
  let best: string | null = null; let bestDistance = Infinity;
  for (const path of network.paths) {
    const sample = sampleLane(network, path.id, x);
    if (!sample) continue;
    const distance = Math.abs(sample.z - z);
    if (distance < bestDistance) { bestDistance = distance; best = path.id; }
  }
  return best;
}

/**
 * The two fields adoption needs: anything with a place on the course can be given a path, so this
 * stays structural rather than importing `Racer` (which would drag the whole simulation in here).
 */
export interface PathBearer {
  pathId: string | null;
  x: number;
  z: number;
  finished: boolean;
}

/** Puts **every** bearer on the nearest path at this moment, and answers how many changed path. */
export function assignNearestPaths(bearers: readonly PathBearer[], network: LaneNetwork | null): number {
  if (!network) return 0;
  let changed = 0;
  for (const bearer of bearers) {
    const pathId = nearestPath(network, bearer.x, bearer.z);
    if (pathId !== bearer.pathId) changed++;
    bearer.pathId = pathId;
  }
  return changed;
}

/**
 * Adopts the bearers that are **not on a path yet**. The grid sits at `x = START_X` and an authored
 * network may begin further down the hill, so this is run every tick by the engine: a racer who is
 * put down outside every path's x range waits on the start line instead of being flung to one.
 */
export function adoptNearestPaths(bearers: readonly PathBearer[], network: LaneNetwork | null): number {
  if (!network) return 0;
  let adopted = 0;
  for (const bearer of bearers) {
    if (bearer.pathId !== null || bearer.finished) continue;
    const pathId = nearestPath(network, bearer.x, bearer.z);
    if (pathId) { bearer.pathId = pathId; adopted++; }
  }
  return adopted;
}

/**
 * Hands a bearer who has ridden **past the end of their path** to its successor.
 *
 * An authored network is a set of runs that meet: four lanes that merge into one spine, a spine that
 * splits at a fork. Until this existed, a racer who crossed the end of their own path simply fell back
 * to the legacy corridor — the merge was never taken and the authored road quietly stopped existing
 * mid-course. The rule is `successorPath`'s own:
 *
 *  - the end node is a **merge** → the single path that starts there is adopted;
 *  - the end node is a **split** → the branch on the racer's own side is taken (`bias` from which side
 *    of the junction they are on, so a racer steering down the left flank does not get yanked right);
 *  - the end node is **oob**, the flag, or nothing continues → **the bearer is left exactly as they
 *    are**. That is deliberate: an OOB node *is* the trigger a recovery fires on, and it can only fire
 *    while the racer is still on the path that ends there. A racer past the end of a dead end is the
 *    crew's business, not the network's.
 *
 * Returns how many bearers changed path, so a caller can log or assert on it.
 */
export function advancePaths(bearers: readonly PathBearer[], network: LaneNetwork | null): number {
  if (!network) return 0;
  let advanced = 0;
  for (const bearer of bearers) {
    if (bearer.pathId === null || bearer.finished) continue;
    // Still on the road: nothing to do. This is the overwhelmingly common case, one sample per tick.
    if (sampleLane(network, bearer.pathId, bearer.x)) continue;
    const path = pathById(network, bearer.pathId);
    const end = path ? path.nodeIds[path.nodeIds.length - 1] : undefined;
    const endNode = end ? network.nodes.find((node) => node.id === end) : undefined;
    // Which side of the junction the bearer is on decides a split; a merge has only one way on.
    const bias: -1 | 0 | 1 = !endNode || Math.abs(bearer.z - endNode.z) <= 1
      ? 0
      : bearer.z < endNode.z ? 1 : -1;
    const next = successorPath(network, bearer.pathId, bearer.z, bias);
    if (next) { bearer.pathId = next; advanced++; }
  }
  return advanced;
}

/* -----------------------------------------------------------------------------
   4. MOVEMENT
   -------------------------------------------------------------------------- */

/**
 * The nearest neighbouring path on one side, at one x. `dir` follows the game's lane convention:
 * **+1 is toward smaller z** (that is the direction `targetLane + 1` moves in), and -1 the other way.
 */
export function adjacentPath(network: LaneNetwork, pathId: string, x: number, dir: -1 | 1): string | null {
  const current = sampleLane(network, pathId, x);
  if (!current) return null;
  let best: string | null = null; let bestDistance = Infinity;
  for (const path of network.paths) {
    if (path.id === pathId) continue;
    const sample = sampleLane(network, path.id, x);
    if (!sample) continue;
    const delta = sample.z - current.z;
    if (dir === 1 ? delta >= -1e-9 : delta <= 1e-9) continue;
    const distance = Math.abs(delta);
    if (distance < bestDistance) { bestDistance = distance; best = path.id; }
  }
  return best;
}

/**
 * Where a path goes when it ends: through a merge, or down one branch of a split.
 *
 * - the end node is a **merge** → the single path that starts there;
 * - the end node is a **split** → the branch picked by `bias` (-1 = the larger-z branch, +1 = the
 *   smaller-z branch, matching `adjacentPath`; 0 = whichever branch is nearest the racer's z);
 * - the end node is **oob** (or nothing continues) → `null`: there is no successor, and an OOB node
 *   is a recovery, not a route.
 */
export function successorPath(network: LaneNetwork, pathId: string, z: number, bias: -1 | 0 | 1): string | null {
  const path = pathById(network, pathId);
  if (!path) return null;
  const endId = path.nodeIds[path.nodeIds.length - 1];
  const outgoing = network.paths.filter((candidate) => candidate.id !== pathId && candidate.nodeIds[0] === endId);
  if (outgoing.length === 0) return null;
  if (outgoing.length === 1) return outgoing[0].id;
  const end = network.nodes.find((node) => node.id === endId);
  if (!end) return null;
  let best = outgoing[0]; let bestScore = Infinity;
  for (const candidate of outgoing) {
    // Sample the branch a little *past* the junction: at the junction itself every branch is at the
    // same point, so the only place they can be told apart is where they are heading.
    const branchEnd = network.nodes.find((node) => node.id === candidate.nodeIds[candidate.nodeIds.length - 1]);
    const probeX = branchEnd ? Math.min(end.x + 400, branchEnd.x) : end.x + 400;
    const sample = sampleLane(network, candidate.id, probeX);
    const candidateZ = sample ? sample.z : end.z;
    // `bias` follows the lane convention: +1 is toward smaller z, exactly like `adjacentPath`.
    const score = bias === 0 ? Math.abs(candidateZ - z) : Math.abs(candidateZ - (z - bias * 900));
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  return best.id;
}

/**
 * Has this racer just *reached* the path's out-of-bounds node? Returns the node id on the crossing
 * tick and `null` otherwise, so the caller recovers exactly once per crossing.
 *
 * A node is reached when the racer's x passes it in this tick: `prevX < node.x ≤ x`. The path is
 * named by the racer, so a racer on a different path is unaffected even if the x ranges overlap.
 */
export function oobCrossed(network: LaneNetwork, pathId: string, prevX: number, x: number): string | null {
  const path = pathById(network, pathId);
  if (!path) return null;
  const endId = path.nodeIds[path.nodeIds.length - 1];
  const end = network.nodes.find((node) => node.id === endId);
  if (!end || end.kind !== 'oob') return null;
  return prevX < end.x && x >= end.x ? end.id : null;
}

/* -----------------------------------------------------------------------------
   5. THE INTEGRATION POINT (D12)
   -------------------------------------------------------------------------- */

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The legacy corridor: one ball of clearance inside the lane bounds, and four fixed lane centres. */
export const LEGACY_CORRIDOR = Object.freeze({
  zMin: LANE.near + RADIUS + 6,
  zMax: LANE.far - RADIUS - 6,
});

/**
 * Where a racer should steer, and how far they may drift, on this tick.
 *
 * With `network === null` (or a racer who is not on a path) this is exactly `laneZ(targetLane)` and
 * the legacy corridor — bit-identical behaviour, which is what keeps the parity fingerprints and
 * every tuned handling number intact. With a network it is the racer's own path centre, plus the
 * corridor of every path active at that x.
 */
export function resolveLaneTarget(
  racer: { targetLane: number; pathId: string | null; x: number },
  network: LaneNetwork | null,
): { targetZ: number; zMin: number; zMax: number } {
  const legacy = { targetZ: laneZOf(racer.targetLane), zMin: LEGACY_CORRIDOR.zMin, zMax: LEGACY_CORRIDOR.zMax };
  if (!network || !racer.pathId) return legacy;
  const sample = sampleLane(network, racer.pathId, racer.x);
  if (!sample) return legacy;
  const corridor = corridorAt(network, racer.x);
  if (!corridor) return { ...legacy, targetZ: sample.z };
  return {
    targetZ: clamp(sample.z, corridor.zMin, corridor.zMax),
    zMin: Math.max(legacy.zMin, corridor.zMin),
    zMax: Math.min(legacy.zMax, corridor.zMax),
  };
}

/** `laneZ`, re-stated locally so this module owns no runtime import of the scene's helper. */
function laneZOf(lane: number): number {
  return LANE.far - LANE_WIDTH * (lane + 0.5);
}

/* -----------------------------------------------------------------------------
   6. AN AUTHORED DEFAULT
   -------------------------------------------------------------------------- */

/**
 * The sample network: the four lanes of `ridge`, authored as four paths that run the whole course
 * and merge into a single line at the first loop's exit, plus an OOB node past the finish.
 *
 * It exists so the builder has something true to open, and so the runtime integration can be
 * exercised with real data. It is *not* the game's behaviour: a course with no authored network
 * keeps the legacy lanes exactly.
 */
export function sampleLaneNetwork(course: CourseId = 'ridge'): LaneNetwork {
  const nodes: LaneNode[] = [];
  const add = (id: string, x: number, z: number, kind: LaneNodeKind = 'normal') => {
    nodes.push({ id, x, z, kind });
  };
  // The grid's own run-up (x = 0 000 is the start pad), then the four lanes.
  const spineX = [1200, 4200, 9000, 16999, 24000, 30000];
  // The network starts where the field does, so a grid racer is already on a path at x = START_X.
  add('start', START_X, laneZOf(2));
  add('grid', 1200, laneZOf(2), 'split');
  for (let lane = 0; lane < 4; lane++) {
    for (const x of spineX.slice(1)) add(`lane${lane}-${x}`, x, laneZOf(lane));
  }
  // …which merge into one line at the loop's own lane, exactly where T2's pool puts the field.
  add('loop', 36000, laneZOf(2), 'merge');
  const paths: LanePath[] = [
    { id: 'ridge-start', name: 'Start pad', nodeIds: ['start', 'grid'], halfWidth: DEFAULT_HALF_WIDTH },
  ];
  for (let lane = 0; lane < 4; lane++) {
    paths.push({
      id: `ridge-lane-${lane}`, name: `Lane ${lane + 1}`,
      nodeIds: ['grid', ...spineX.slice(1).map((x) => `lane${lane}-${x}`), 'loop'],
      halfWidth: DEFAULT_HALF_WIDTH,
    });
  }
  // The merged line splits once more before the line: the main drag, and a decoy spur that ends out
  // of bounds. A racer only ever reaches the spur by being *on* it.
  add('spine', 42000, laneZOf(2));
  add('spine-2', 52000, laneZOf(2));
  add('fork', 64000, laneZOf(2), 'split');
  add('main', 70000, laneZOf(2));
  add('finish', FINISH, laneZOf(2));
  add('spur-end', 68000, laneZOf(0), 'oob');
  paths.push({ id: 'ridge-spine', name: 'Main line', nodeIds: ['loop', 'spine', 'spine-2', 'fork'], halfWidth: DEFAULT_HALF_WIDTH });
  paths.push({ id: 'ridge-main', name: 'Run to the flag', nodeIds: ['fork', 'main', 'finish'], halfWidth: DEFAULT_HALF_WIDTH });
  paths.push({ id: 'ridge-spur', name: 'Decoy spur', nodeIds: ['fork', 'spur-end'], halfWidth: LANE_HALF_WIDTH_MIN });
  return { version: LANE_NETWORK_VERSION, course, nodes, paths };
}
