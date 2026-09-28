/**
 * M01 · T7 (IF-BUILDER) — the lane tool's brain: pure edit commands, snapping, and the undo stack.
 *
 * The 3D part of the builder (handles, picking, drag) is a thin layer over this file. Everything
 * that decides *what* an edit does lives here, which is why it can be tested without a canvas:
 *
 *  - **`applyLaneEdit` never mutates its input.** Every op builds a fresh network, then hands it to
 *    `validateLaneNetwork`. It cannot return an invalid network: either the edit is refused with a
 *    reason the panel can show, or the result is exactly what the runtime validated.
 *  - **Kinds are derived, not authored.** T6's law is that a node's authored kind must equal what the
 *    graph says it is (`inferKind`), so an edit that changes topology would leave stale kinds behind.
 *    Every structural op therefore re-derives the kinds of the nodes it touched, and a node whose
 *    shape is none of the four (`orphan`) is reported rather than silently reclassified.
 *  - **Refusals name the code.** `reason` starts with the refusal code it came from
 *    (`non_monotone: node …`), or with one of this file's own codes (`cycle:`, `oob_branch:`,
 *    `unknown_path:`, `too_few_nodes:`), so the panel can group them without parsing prose.
 *
 * Pure TypeScript: no DOM, no canvas, no three.js, no React.
 */
import {
  DEFAULT_HALF_WIDTH, LANE_HALF_WIDTH_MAX, LANE_HALF_WIDTH_MIN, LANE_NETWORK_VERSION, LANE_Z_LIMIT,
  inferKind, validateLaneNetwork,
  type LaneNetwork, type LaneNode, type LaneNodeKind, type LanePath, type LaneRefusal,
} from './lane-network';
import { FINISH, START_X } from './scene';

/* -----------------------------------------------------------------------------
   1. THE COMMANDS (IF-BUILDER)
   -------------------------------------------------------------------------- */

export type LaneEdit =
  | { op: 'addPath'; at: { x: number; z: number }[] }
  | { op: 'moveNode'; nodeId: string; x: number; z: number }
  | { op: 'insertNode'; pathId: string; x: number; z: number }
  | { op: 'deleteNode'; nodeId: string }
  | { op: 'setKind'; nodeId: string; kind: LaneNodeKind }
  | { op: 'split'; nodeId: string; to: { x: number; z: number } }
  | { op: 'merge'; fromPathId: string; intoNodeId: string }
  | { op: 'markOob'; pathId: string };

export type LaneEditResult =
  | { ok: true; network: LaneNetwork; /** Node the panel should select after the edit. */ focus?: string }
  | { ok: false; reason: string };

/** Snapping: the four lane centres, within 30 z-units, and a 50-unit x grid. */
export const SNAP_Z_LANES: readonly number[] = [360, 120, -120, -360];
export const SNAP_Z_RADIUS = 30;
export const SNAP_X_GRID = 50;

/** Half-widths the panel offers; `applyLaneEdit` never changes a path's width on its own. */
export const LANE_WIDTH_CHOICES: readonly number[] = [LANE_HALF_WIDTH_MIN, 80, DEFAULT_HALF_WIDTH, 180, LANE_HALF_WIDTH_MAX];

/* -----------------------------------------------------------------------------
   2. SNAPPING
   -------------------------------------------------------------------------- */

/**
 * Snaps a dragged handle. `lanes` pulls `z` to the nearest lane centre when it is within
 * `SNAP_Z_RADIUS`; `grid` rounds `x` to the nearest `SNAP_X_GRID`. Whatever is left is clamped into
 * the drivable corridor, so a handle dragged off the road cannot author a node the runtime refuses.
 */
export function snapNode(x: number, z: number, opts: { lanes: boolean; grid: boolean }): { x: number; z: number } {
  const clampedX = clamp(x, START_X, FINISH);
  const clampedZ = clamp(z, -LANE_Z_LIMIT, LANE_Z_LIMIT);
  let snappedZ = clampedZ;
  if (opts.lanes) {
    let best = clampedZ; let bestDistance = SNAP_Z_RADIUS;
    for (const lane of SNAP_Z_LANES) {
      const distance = Math.abs(lane - clampedZ);
      if (distance <= bestDistance) { bestDistance = distance; best = lane; }
    }
    snappedZ = best;
  }
  const snappedX = opts.grid ? Math.round(clampedX / SNAP_X_GRID) * SNAP_X_GRID : clampedX;
  return { x: clamp(snappedX, START_X, FINISH), z: snappedZ };
}

/* -----------------------------------------------------------------------------
   3. EDIT COMMANDS
   -------------------------------------------------------------------------- */

/** The result of a structural op, before validation: the reason is this file's own code. */
type Refusal = { ok: false; reason: string };
const refuse = (code: string, detail: string): Refusal => ({ ok: false, reason: `${code}: ${detail}` });
const okNetwork = (network: LaneNetwork): { ok: true; network: LaneNetwork } => ({ ok: true, network });

/** A deep enough copy: nodes, paths and every unknown field on them survive verbatim. */
function copyNetwork(network: LaneNetwork): LaneNetwork {
  return {
    ...network,
    nodes: network.nodes.map((node) => ({ ...node })),
    paths: network.paths.map((path) => ({ ...path, nodeIds: [...path.nodeIds] })),
  };
}

/** An id nothing else in the document uses. Ids are for people: "n3" beats a uuid in a panel. */
export function uniqueId(network: LaneNetwork, prefix: string): string {
  const taken = new Set<string>([...network.nodes.map((node) => node.id), ...network.paths.map((path) => path.id)]);
  for (let index = 1; ; index++) {
    const candidate = `${prefix}${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const nodeById = (network: LaneNetwork, nodeId: string): LaneNode | null =>
  network.nodes.find((node) => node.id === nodeId) ?? null;
const pathById = (network: LaneNetwork, pathId: string): LanePath | null =>
  network.paths.find((path) => path.id === pathId) ?? null;

const inCorridor = (x: number, z: number): boolean =>
  Number.isFinite(x) && Number.isFinite(z) && x >= START_X && x <= FINISH && Math.abs(z) <= LANE_Z_LIMIT;

/**
 * Re-derives every referenced node's kind from the graph. A node whose shape is none of the four is
 * left exactly as authored — `validateLaneNetwork` will refuse it with the kind it was trying to be,
 * which is a real thing for the author to fix rather than something to paper over.
 */
function repairKinds(network: LaneNetwork): LaneNetwork {
  for (const node of network.nodes) {
    const inferred = inferKind(network, node.id);
    if (inferred !== 'orphan') node.kind = inferred;
  }
  return network;
}

/** Runs the finished document through the runtime's own validator. */
function finish(network: LaneNetwork, focus?: string): LaneEditResult {
  const result = validateLaneNetwork(repairKinds(network));
  if (!result.ok) return { ok: false, reason: describeErrors(result.errors) };
  return focus === undefined ? okNetwork(result.network) : { ok: true, network: result.network, focus };
}

/** One refusal, in the shape the panel shows: the code first, then the sentence a human reads. */
export function describeError(error: LaneRefusal): string {
  const where = 'nodeId' in error && error.nodeId ? `node ${error.nodeId}` : '';
  const path = 'pathId' in error && error.pathId ? `path ${error.pathId}` : '';
  switch (error.code) {
    case 'duplicate_id': return `duplicate_id: the id "${error.id}" is already used`;
    case 'unknown_node': return `unknown_node: ${path || 'a path'} references a node that is not there (${error.nodeId})`;
    case 'too_few_nodes': return `too_few_nodes: ${path || 'a path'} needs at least two nodes`;
    case 'non_monotone': return `non_monotone: ${where || 'a node'} does not keep ${path || 'its path'} in increasing x order`;
    case 'out_of_corridor': return `out_of_corridor: ${where || 'a node'} is outside the drivable corridor`;
    case 'kind_mismatch': return `kind_mismatch: ${where || 'a node'} is a ${error.expected} node by its shape`;
    case 'bad_half_width': return `bad_half_width: ${path || 'a path'} has a half width outside ${LANE_HALF_WIDTH_MIN}–${LANE_HALF_WIDTH_MAX}`;
  }
}

/** Every refusal in one line — several can be reported at once, and the panel lists them all. */
function describeErrors(errors: readonly LaneRefusal[]): string {
  return errors.map(describeError).join(' · ');
}

/** Does this node sit correctly between its neighbours in every path that contains it? */
function breaksMonotone(network: LaneNetwork, nodeId: string, x: number): boolean {
  for (const path of network.paths) {
    const index = path.nodeIds.indexOf(nodeId);
    if (index < 0) continue;
    const before = index > 0 ? nodeById(network, path.nodeIds[index - 1]) : null;
    const after = index < path.nodeIds.length - 1 ? nodeById(network, path.nodeIds[index + 1]) : null;
    if (before && x <= before.x) return true;
    if (after && x >= after.x) return true;
  }
  return false;
}

/** `at` must be a run of points that a path can be driven along: in the corridor, increasing in x. */
function checkRun(at: readonly { x: number; z: number }[]): Refusal | null {
  for (const point of at) {
    if (!inCorridor(point.x, point.z)) return refuse('out_of_corridor', `the point (${round(point.x)}, ${round(point.z)}) is off the road`);
  }
  for (let index = 1; index < at.length; index++) {
    if (at[index].x <= at[index - 1].x) return refuse('non_monotone', 'the points must move down the hill, each further along than the last');
  }
  return null;
}

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Applies one edit. Pure: the network handed in is never touched, and the network handed back is one
 * `validateLaneNetwork` has accepted.
 */
export function applyLaneEdit(network: LaneNetwork, edit: LaneEdit): LaneEditResult {
  switch (edit.op) {
    case 'addPath': return addPath(network, edit.at);
    case 'moveNode': return moveNode(network, edit.nodeId, edit.x, edit.z);
    case 'insertNode': return insertNode(network, edit.pathId, edit.x, edit.z);
    case 'deleteNode': return deleteNode(network, edit.nodeId);
    case 'setKind': return setKind(network, edit.nodeId, edit.kind);
    case 'split': return splitBranch(network, edit.nodeId, edit.to);
    case 'merge': return mergeInto(network, edit.fromPathId, edit.intoNodeId);
    case 'markOob': return markOob(network, edit.pathId);
  }
}

function addPath(network: LaneNetwork, at: readonly { x: number; z: number }[]): LaneEditResult {
  if (at.length < 2) return refuse('too_few_nodes', 'a path needs at least two points');
  const bad = checkRun(at);
  if (bad) return bad;

  const next = copyNetwork(network);
  // The last node of a path that stops short of the flag is an out-of-bounds trigger by T6's law, so
  // it is authored as one straight away rather than being refused a step later.
  const nodeIds = at.map((point, index) => {
    const id = uniqueId(next, 'n');
    const last = index === at.length - 1;
    next.nodes.push({ id, x: point.x, z: point.z, kind: last && point.x < FINISH ? 'oob' : 'normal' });
    return id;
  });
  const pathId = uniqueId(next, 'p');
  next.paths.push({
    id: pathId, name: `Path ${next.paths.length + 1}`, nodeIds, halfWidth: DEFAULT_HALF_WIDTH,
  });
  return finish(next, nodeIds[nodeIds.length - 1]);
}

function moveNode(network: LaneNetwork, nodeId: string, x: number, z: number): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  if (!inCorridor(x, z)) return refuse('out_of_corridor', 'that point is off the drivable road');
  if (node.x === x && node.z === z) return refuse('unchanged', `${nodeId} is already there`);
  if (breaksMonotone(network, nodeId, x)) {
    return refuse('non_monotone', 'the move would put this node out of x order in one of its paths');
  }
  const next = copyNetwork(network);
  nodeById(next, nodeId)!.x = x;
  nodeById(next, nodeId)!.z = z;
  return finish(next, nodeId);
}

function insertNode(network: LaneNetwork, pathId: string, x: number, z: number): LaneEditResult {
  const path = pathById(network, pathId);
  if (!path) return refuse('unknown_path', `there is no path ${pathId}`);
  if (!inCorridor(x, z)) return refuse('out_of_corridor', 'that point is off the drivable road');
  let at = -1;
  for (let index = 0; index < path.nodeIds.length - 1; index++) {
    const before = nodeById(network, path.nodeIds[index])!;
    const after = nodeById(network, path.nodeIds[index + 1])!;
    if (x > before.x && x < after.x) { at = index + 1; break; }
  }
  if (at < 0) return refuse('non_monotone', 'a new node has to land between two existing nodes of the path');

  const next = copyNetwork(network);
  const id = uniqueId(next, 'n');
  next.nodes.push({ id, x, z, kind: 'normal' });
  pathById(next, pathId)!.nodeIds.splice(at, 0, id);
  return finish(next, id);
}

function deleteNode(network: LaneNetwork, nodeId: string): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  for (const path of network.paths) {
    if (path.nodeIds.includes(nodeId) && path.nodeIds.length < 3) {
      // Removing it would leave a one-node path, and a path is a road: refuse rather than silently
      // delete its neighbour too.
      return refuse('too_few_nodes', `path ${path.id} would be left with fewer than two nodes`);
    }
  }
  const next = copyNetwork(network);
  next.paths = next.paths.map((path) => ({ ...path, nodeIds: path.nodeIds.filter((id) => id !== nodeId) }));
  next.nodes = next.nodes.filter((candidate) => candidate.id !== nodeId);
  return finish(next);
}

function setKind(network: LaneNetwork, nodeId: string, kind: LaneNodeKind): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  // A no-op is not an undo entry: pressing K twice has to leave the stack alone.
  if (node.kind === kind) return refuse('unchanged', `${nodeId} is already a ${kind} node`);
  const next = copyNetwork(network);
  nodeById(next, nodeId)!.kind = kind;
  // Deliberately *not* repaired: the author asked for this kind, and the refusal that follows says
  // what the node's shape actually is.
  const result = validateLaneNetwork(next);
  if (!result.ok) return { ok: false, reason: describeErrors(result.errors) };
  return okNetwork(result.network);
}

function splitBranch(network: LaneNetwork, nodeId: string, to: { x: number; z: number }): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  if (inferKind(network, nodeId) === 'oob') {
    return refuse('oob_branch', 'an out-of-bounds node is where a road ends; branch from a node that is still on it');
  }
  if (!inCorridor(to.x, to.z)) return refuse('out_of_corridor', 'that point is off the drivable road');
  if (to.x <= node.x) return refuse('non_monotone', 'a branch has to go further down the hill than the node it leaves');

  const next = copyNetwork(network);
  const id = uniqueId(next, 'n');
  next.nodes.push({ id, x: to.x, z: to.z, kind: to.x < FINISH ? 'oob' : 'normal' });
  const pathId = uniqueId(next, 'p');
  next.paths.push({
    id: pathId, name: `Branch ${next.paths.length + 1}`, nodeIds: [nodeId, id], halfWidth: DEFAULT_HALF_WIDTH,
  });
  return finish(next, id);
}

function mergeInto(network: LaneNetwork, fromPathId: string, intoNodeId: string): LaneEditResult {
  const path = pathById(network, fromPathId);
  if (!path) return refuse('unknown_path', `there is no path ${fromPathId}`);
  const target = nodeById(network, intoNodeId);
  if (!target) return refuse('unknown_node', `there is no node ${intoNodeId}`);
  if (path.nodeIds.includes(intoNodeId)) {
    return refuse('cycle', `${fromPathId} already runs through ${intoNodeId}`);
  }
  const tail = nodeById(network, path.nodeIds[path.nodeIds.length - 1])!;
  if (target.x <= tail.x) return refuse('non_monotone', `${intoNodeId} is not further down the hill than the end of ${fromPathId}`);

  const next = copyNetwork(network);
  pathById(next, fromPathId)!.nodeIds.push(intoNodeId);
  return finish(next, intoNodeId);
}

/**
 * Marks the end of a path as an out-of-bounds trigger. T6 infers that for every dead end short of the
 * flag, so this is usually a confirmation — its interesting answer is the refusal: a path that
 * reaches the flag does not end out of bounds, it ends at the finish.
 */
function markOob(network: LaneNetwork, pathId: string): LaneEditResult {
  const path = pathById(network, pathId);
  if (!path) return refuse('unknown_path', `there is no path ${pathId}`);
  const tail = nodeById(network, path.nodeIds[path.nodeIds.length - 1])!;
  const next = copyNetwork(network);
  nodeById(next, tail.id)!.kind = 'oob';
  const result = validateLaneNetwork(next);
  if (!result.ok) return { ok: false, reason: describeErrors(result.errors) };
  return okNetwork(result.network);
}

/* -----------------------------------------------------------------------------
   4. UNDO / REDO
   -------------------------------------------------------------------------- */

export interface LaneHistory {
  /** The document as it stands. */
  readonly network: LaneNetwork;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly depth: number;
  /** Applies an edit and, if it lands, makes it the new head of the stack. */
  apply(edit: LaneEdit): LaneEditResult;
  /** Steps back one edit. Returns the document now current, or `null` at the bottom of the stack. */
  undo(): LaneNetwork | null;
  /** Steps forward one edit. Returns the document now current, or `null` at the top of the stack. */
  redo(): LaneNetwork | null;
  /** Drops the past (a loaded document is a new starting point), or replaces the head outright. */
  reset(network: LaneNetwork): void;
}

/**
 * The lanes half of the builder's undo stack. The builder keeps `{ props, lanes }` entries so one
 * Ctrl+Z covers both documents; this is the lanes half on its own, which is also why AC-2 can be
 * checked without any THREE or canvas in the room.
 */
export function createLaneHistory(initial: LaneNetwork, limit = 200): LaneHistory {
  const past: LaneNetwork[] = [];
  const future: LaneNetwork[] = [];
  let present = initial;
  return {
    get network() { return present; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get depth() { return past.length; },
    apply(edit) {
      const result = applyLaneEdit(present, edit);
      if (!result.ok) return result;
      past.push(present);
      while (past.length > limit) past.shift();
      present = result.network;
      future.length = 0;
      return result;
    },
    undo() {
      const previous = past.pop();
      if (!previous) return null;
      future.push(present);
      present = previous;
      return present;
    },
    redo() {
      const next = future.pop();
      if (!next) return null;
      past.push(present);
      present = next;
      return present;
    },
    reset(network) {
      past.length = 0; future.length = 0; present = network;
    },
  };
}

/** A blank network for a course: one straight line down the middle lane, start to flag. */
export function blankLaneNetwork(course: LaneNetwork['course'], z = 0): LaneNetwork {
  const network: LaneNetwork = {
    version: LANE_NETWORK_VERSION,
    course,
    nodes: [
      { id: 'n1', x: START_X, z, kind: 'normal' },
      { id: 'n2', x: FINISH, z, kind: 'normal' },
    ],
    paths: [{ id: 'p1', name: 'Path 1', nodeIds: ['n1', 'n2'], halfWidth: DEFAULT_HALF_WIDTH }],
  };
  return network;
}
