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
  DEFAULT_HALF_WIDTH, LANE_HALF_WIDTH_MAX, LANE_HALF_WIDTH_MIN, LANE_NETWORK_VERSION, LANE_Z_LIMIT, laneRules,
  LANE_COLORS, inferKind, laneColorOf, validateLaneNetwork,
  type LaneNetwork, type LaneNode, type LaneNodeKind, type LanePath, type LaneRefusal,
} from './lane-network';
import { FINISH, START_X } from './scene';

/* -----------------------------------------------------------------------------
   1. THE COMMANDS (IF-BUILDER)
   -------------------------------------------------------------------------- */

export type LaneEdit =
  | { op: 'addPath'; at: { x: number; z: number }[] }
  /**
   * With `passThrough` (a drag), a node pulled past its neighbours along a lane takes their place: the
   * nodes it passes are dropped (only ones on that one lane; a junction still stops it).
   */
  | { op: 'moveNode'; nodeId: string; x: number; z: number; passThrough?: boolean }
  /**
   * Joins two nodes with a lane (Ctrl-click one, then the other), always running down the hill. With
   * `extendPathId`, a lane ending at the uphill node grows by the new one (clicking on along a chain).
   */
  | { op: 'connect'; fromId: string; toId: string; extendPathId?: string | null }
  /** Several nodes at once (a group drag or nudge): all land together or none do. */
  | { op: 'moveNodes'; moves: { nodeId: string; x: number; z: number }[] }
  | { op: 'insertNode'; pathId: string; x: number; z: number }
  | { op: 'deleteNode'; nodeId: string }
  | { op: 'setKind'; nodeId: string; kind: LaneNodeKind }
  | { op: 'split'; nodeId: string; to: { x: number; z: number } }
  | { op: 'merge'; fromPathId: string; intoNodeId: string }
  | { op: 'markOob'; pathId: string }
  /**
   * The Split button: the lane through the node is cut there, and a second lane leaves the same node
   * and runs parallel to the first all the way down (one lane width over, dragged into place after).
   * The new branch gets a colour of its own, so a ball past the split cannot hop between the two.
   */
  | { op: 'fork'; nodeId: string }
  /** The lanes leaving a node (or, at a lane's end, the lanes arriving) take the next colour. */
  | { op: 'recolor'; nodeId: string }
  /** A lone node on the road: where a new line will be drawn out from (an unjoined node is allowed). */
  | { op: 'addNode'; x: number; z: number }
  /**
   * Draws a line out of a node: `at` are the new nodes, in the order they were laid. Down the hill a
   * lane ending at the node grows; up the hill a lane starting at it grows backwards; otherwise a new
   * lane leaves (or arrives at) the node. `toId` joins the last new node to an existing one.
   */
  | { op: 'drawFrom'; fromId: string; at: { x: number; z: number }[]; toId?: string | null }
  /** Cuts the connection between two neighbouring nodes of a lane (the lane becomes two, or shorter). */
  | { op: 'disconnect'; fromId: string; toId: string }
  /** Colours whole lanes (a ball only changes to a lane of its own colour). */
  | { op: 'recolorPaths'; pathIds: string[]; color: string }
  /** Colours nodes themselves (null: back to their lane's colour). Display only. */
  | { op: 'recolorNodes'; nodeIds: string[]; color: string | null }
  /**
   * Doubles a line (nodes `nodeIds`, consecutive on one lane) into two lanes side by side: a second
   * lane, one lane width over, leaves the line's first node and rejoins its last (or runs on its own
   * where the line starts or ends the lane). Same colour, so a ball may change between the two.
   */
  | { op: 'twin'; pathId: string; nodeIds: string[] }
  /** Every node and lane gone: start fresh. */
  | { op: 'clear' };

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
export function snapNode(x: number, z: number, opts: { lanes: boolean; grid: boolean }, startOffset: number = START_X): { x: number; z: number } {
  const minX = Math.min(START_X, startOffset);
  const clampedX = laneRules.corridor ? clamp(x, minX, FINISH) : x;
  const clampedZ = laneRules.corridor ? clamp(z, -LANE_Z_LIMIT, LANE_Z_LIMIT) : z;
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
  return { x: laneRules.corridor ? clamp(snappedX, minX, FINISH) : snappedX, z: snappedZ };
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
  Number.isFinite(x) && Number.isFinite(z) && (!laneRules.corridor || (x >= START_X && x <= FINISH)) && (!laneRules.corridor || Math.abs(z) <= LANE_Z_LIMIT);

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
/**
 * A copy of the network without the nodes a node moved to `x` would pass along its lanes, or null when
 * one of them is shared with another lane (a junction) or a lane would be left with one node.
 */
function dropPassedNodes(network: LaneNetwork, nodeId: string, x: number): LaneNetwork | null {
  const next = copyNetwork(network);
  const lanesOf = (id: string) => next.paths.filter((p) => p.nodeIds.includes(id)).length;
  const dropped = new Set<string>();
  for (const path of next.paths) {
    let index = path.nodeIds.indexOf(nodeId);
    if (index < 0) continue;
    while (index > 0 && nodeById(next, path.nodeIds[index - 1])!.x >= x) {
      const id = path.nodeIds[index - 1];
      if (lanesOf(id) !== 1) return null;
      path.nodeIds.splice(index - 1, 1); dropped.add(id); index--;
    }
    while (index < path.nodeIds.length - 1 && nodeById(next, path.nodeIds[index + 1])!.x <= x) {
      const id = path.nodeIds[index + 1];
      if (lanesOf(id) !== 1) return null;
      path.nodeIds.splice(index + 1, 1); dropped.add(id);
    }
    if (path.nodeIds.length < 2) return null;
  }
  next.nodes = next.nodes.filter((n) => !dropped.has(n.id));
  return next;
}

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
    case 'moveNode': return moveNode(network, edit.nodeId, edit.x, edit.z, edit.passThrough);
    case 'moveNodes': return moveNodes(network, edit.moves);
    case 'connect': return connectNodes(network, edit.fromId, edit.toId, edit.extendPathId ?? null);
    case 'insertNode': return insertNode(network, edit.pathId, edit.x, edit.z);
    case 'deleteNode': return deleteNode(network, edit.nodeId);
    case 'setKind': return setKind(network, edit.nodeId, edit.kind);
    case 'split': return splitBranch(network, edit.nodeId, edit.to);
    case 'merge': return mergeInto(network, edit.fromPathId, edit.intoNodeId);
    case 'markOob': return markOob(network, edit.pathId);
    case 'fork': return forkLane(network, edit.nodeId);
    case 'recolor': return recolorAt(network, edit.nodeId);
    case 'addNode': return addLoneNode(network, edit.x, edit.z);
    case 'drawFrom': return drawFrom(network, edit.fromId, edit.at, edit.toId ?? null);
    case 'disconnect': return disconnect(network, edit.fromId, edit.toId);
    case 'recolorPaths': return recolorPaths(network, edit.pathIds, edit.color);
    case 'recolorNodes': return recolorNodes(network, edit.nodeIds, edit.color);
    case 'twin': return twinRun(network, edit.pathId, edit.nodeIds);
    case 'clear': return finish({ ...copyNetwork(network), nodes: [], paths: [] });
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

function moveNode(network: LaneNetwork, nodeId: string, x: number, z: number, passThrough = false): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  if (!inCorridor(x, z)) return refuse('out_of_corridor', 'that point is off the drivable road');
  if (node.x === x && node.z === z) return refuse('unchanged', `${nodeId} is already there`);
  if (breaksMonotone(network, nodeId, x)) {
    const passed = passThrough ? dropPassedNodes(network, nodeId, x) : null;
    if (!passed) return refuse('non_monotone', 'the move would put this node out of x order in one of its paths');
    nodeById(passed, nodeId)!.x = x;
    nodeById(passed, nodeId)!.z = z;
    return finish(passed, nodeId);
  }
  const next = copyNetwork(network);
  nodeById(next, nodeId)!.x = x;
  nodeById(next, nodeId)!.z = z;
  return finish(next, nodeId);
}

/**
 * A group move: every node lands at once, then the whole network is validated, so a group can slide
 * past positions that one node moved alone could not pass through. Points off the road are pulled back
 * onto it, as a single drag is.
 */
function moveNodes(network: LaneNetwork, moves: readonly { nodeId: string; x: number; z: number }[]): LaneEditResult {
  if (!moves.length) return refuse('unchanged', 'no nodes to move');
  const next = copyNetwork(network);
  let changed = false;
  for (const move of moves) {
    const node = nodeById(next, move.nodeId);
    if (!node) return refuse('unknown_node', `there is no node ${move.nodeId}`);
    const x = laneRules.corridor ? clamp(move.x, START_X, FINISH) : move.x;
    const z = laneRules.corridor ? clamp(move.z, -LANE_Z_LIMIT, LANE_Z_LIMIT) : move.z;
    if (node.x !== x || node.z !== z) changed = true;
    node.x = x;
    node.z = z;
  }
  if (!changed) return refuse('unchanged', 'the nodes are already there');
  return finish(next, moves[0].nodeId);
}

function connectNodes(network: LaneNetwork, fromId: string, toId: string, extendPathId: string | null): LaneEditResult {
  const a = nodeById(network, fromId);
  const b = nodeById(network, toId);
  if (!a || !b) return refuse('unknown_node', `there is no node ${!a ? fromId : toId}`);
  if (fromId === toId) return refuse('unchanged', 'a node cannot be joined to itself');
  const [up, down] = a.x <= b.x ? [a, b] : [b, a];
  if (up.x === down.x) return refuse('non_monotone', 'the two nodes are level across the road: a lane has to run down the hill');
  if (network.paths.some((p) => { const i = p.nodeIds.indexOf(up.id); return i >= 0 && p.nodeIds[i + 1] === down.id; })) {
    return refuse('unchanged', 'those two nodes are already joined');
  }
  const next = copyNetwork(network);
  const chain = (extendPathId ? pathById(next, extendPathId) : undefined)
    // Joining from the end of a lane carries that lane on, rather than starting a two-node lane.
    ?? (() => {
      const ending = next.paths.filter((path) => path.nodeIds[path.nodeIds.length - 1] === up.id);
      const leaving = next.paths.some((path) => path.nodeIds.includes(up.id) && path.nodeIds[path.nodeIds.length - 1] !== up.id);
      return ending.length === 1 && !leaving ? ending[0] : undefined;
    })();
  if (chain && chain.nodeIds[chain.nodeIds.length - 1] === up.id && !chain.nodeIds.includes(down.id)) {
    chain.nodeIds.push(down.id);
    // The target is the start of a lane nothing arrives at: the two become one lane.
    const starting = next.paths.filter((path) => path !== chain && path.nodeIds[0] === down.id);
    const arriving = next.paths.some((path) => path !== chain && path.nodeIds.includes(down.id) && path.nodeIds[0] !== down.id);
    if (starting.length === 1 && !arriving && laneColorOf(starting[0]) === laneColorOf(chain)) {
      chain.nodeIds.push(...starting[0].nodeIds.slice(1));
      next.paths = next.paths.filter((path) => path !== starting[0]);
    }
  } else {
    const from = network.paths.find((path) => path.nodeIds.includes(up.id));
    next.paths.push({ id: uniqueId(next, 'p'), name: `Path ${next.paths.length + 1}`, nodeIds: [up.id, down.id], halfWidth: DEFAULT_HALF_WIDTH, ...(from?.color ? { color: from.color } : {}) });
  }
  return finish(next, down.id);
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

/** A colour no lane uses yet (or the one after `after` when every colour is taken). */
function freshColor(network: LaneNetwork, after: string): string {
  const used = new Set(network.paths.map((path) => laneColorOf(path)));
  const free = LANE_COLORS.find((colour) => !used.has(colour));
  return free ?? LANE_COLORS[(LANE_COLORS.indexOf(after) + 1) % LANE_COLORS.length];
}

/** One lane width, the gap a fork's branch starts at. */
const FORK_OFFSET = 240;

function forkLane(network: LaneNetwork, nodeId: string): LaneEditResult {
  const node = nodeById(network, nodeId);
  if (!node) return refuse('unknown_node', `there is no node ${nodeId}`);
  const lane = network.paths.find((path) => path.nodeIds.includes(nodeId) && path.nodeIds[path.nodeIds.length - 1] !== nodeId);
  if (!lane) return refuse('nothing_after', 'no lane carries on past this node: extend it first (drag, Ctrl-click or the brush), then split');
  const index = lane.nodeIds.indexOf(nodeId);
  const arriving = network.paths.some((path) => path.nodeIds[path.nodeIds.length - 1] === nodeId);
  if (index === 0 && !arriving) return refuse('split_at_start', 'a lane cannot split at its very first node: pick a node further down');

  const next = copyNetwork(network);
  const cut = pathById(next, lane.id)!;
  const tail = cut.nodeIds.slice(index + 1);
  if (index > 0) {
    // The lane ends here; the same colour carries on as its own lane (a split joins lanes end to start).
    const onward = [nodeId, ...tail];
    cut.nodeIds = cut.nodeIds.slice(0, index + 1);
    next.paths.push({ id: uniqueId(next, 'p'), name: cut.name, nodeIds: onward, halfWidth: cut.halfWidth, ...(cut.color ? { color: cut.color } : {}) });
  }
  // The branch: every node of the lane after the split, copied one lane width over (towards the middle).
  const side = node.z >= 0 ? -1 : 1;
  const branchIds = [nodeId];
  for (const id of tail) {
    const source = nodeById(next, id)!;
    let z = clamp(source.z + side * FORK_OFFSET, -LANE_Z_LIMIT, LANE_Z_LIMIT);
    if (Math.abs(z - source.z) < FORK_OFFSET / 2) z = clamp(source.z - side * FORK_OFFSET, -LANE_Z_LIMIT, LANE_Z_LIMIT);
    const newId = uniqueId(next, 'n');
    next.nodes.push({ id: newId, x: source.x, z, kind: 'normal' });
    branchIds.push(newId);
  }
  next.paths.push({
    id: uniqueId(next, 'p'), name: `Branch ${next.paths.length + 1}`, nodeIds: branchIds, halfWidth: lane.halfWidth,
    color: freshColor(next, laneColorOf(lane)),
  });
  return finish(next, branchIds[1]);
}

function recolorAt(network: LaneNetwork, nodeId: string): LaneEditResult {
  if (!nodeById(network, nodeId)) return refuse('unknown_node', `there is no node ${nodeId}`);
  const leaving = network.paths.filter((path) => path.nodeIds.includes(nodeId) && path.nodeIds[path.nodeIds.length - 1] !== nodeId);
  const lanes = leaving.length ? leaving : network.paths.filter((path) => path.nodeIds.includes(nodeId));
  if (!lanes.length) return refuse('no_lane', 'this node is on no lane');
  const current = laneColorOf(lanes[0]);
  const colour = LANE_COLORS[(LANE_COLORS.indexOf(current) + 1) % LANE_COLORS.length];
  const next = copyNetwork(network);
  for (const lane of lanes) pathById(next, lane.id)!.color = colour;
  return finish(next, nodeId);
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

/* -----------------------------------------------------------------------------
   THE FRIENDLY LANE TOOLS (draw out, cut, colour, twin, lines between junctions)
   -------------------------------------------------------------------------- */

function addLoneNode(network: LaneNetwork, x: number, z: number): LaneEditResult {
  if (!inCorridor(x, z)) return refuse('out_of_corridor', 'that point is off the drivable road');
  const next = copyNetwork(network);
  const id = uniqueId(next, 'n');
  next.nodes.push({ id, x: Math.round(x), z: Math.round(z), kind: 'normal' });
  return finish(next, id);
}

function drawFrom(network: LaneNetwork, fromId: string, at: readonly { x: number; z: number }[], toId: string | null): LaneEditResult {
  const from = nodeById(network, fromId);
  if (!from) return refuse('unknown_node', `there is no node ${fromId}`);
  const to = toId ? nodeById(network, toId) : null;
  if (toId && !to) return refuse('unknown_node', `there is no node ${toId}`);
  if (!at.length && !to) return refuse('too_short', 'drag further to draw a line');
  const last = at.length ? at[at.length - 1] : to!;
  const downhill = last.x > from.x;
  // The line as it runs down the hill: from the node out, or (drawn uphill) back to the node.
  const points = downhill ? at : [...at].reverse();
  const run = downhill ? [from, ...points] : [...points, from];
  const bad = checkRun(run);
  if (bad) return bad;
  if (to && (downhill ? to.x <= last.x : to.x >= (points[0]?.x ?? from.x))) {
    return refuse('non_monotone', 'the line has to keep running one way down the hill to reach that node');
  }
  const next = copyNetwork(network);
  const made = points.map((point) => {
    const id = uniqueId(next, 'n');
    next.nodes.push({ id, x: Math.round(point.x), z: Math.round(point.z), kind: 'normal' });
    return id;
  });
  const leaving = (id: string) => next.paths.some((path) => path.nodeIds.includes(id) && path.nodeIds[path.nodeIds.length - 1] !== id);
  const arriving = (id: string) => next.paths.some((path) => path.nodeIds.includes(id) && path.nodeIds[0] !== id);
  let lane: LanePath | undefined;
  if (downhill) {
    // Carry on a lane that ends here (and nothing leaves): one lane grows. Else a new lane leaves.
    const ending = next.paths.filter((path) => path.nodeIds[path.nodeIds.length - 1] === fromId);
    if (ending.length === 1 && !leaving(fromId)) { lane = ending[0]; lane.nodeIds.push(...made); }
    else {
      lane = { id: uniqueId(next, 'p'), name: `Lane ${next.paths.length + 1}`, nodeIds: [fromId, ...made], halfWidth: DEFAULT_HALF_WIDTH };
      const parent = next.paths.find((path) => path.nodeIds.includes(fromId));
      if (parent?.color) lane.color = parent.color;
      next.paths.push(lane);
    }
    if (to) lane.nodeIds.push(to.id);
  } else {
    const starting = next.paths.filter((path) => path.nodeIds[0] === fromId);
    const head = to ? [to.id, ...made] : made;
    if (starting.length === 1 && !arriving(fromId)) { lane = starting[0]; lane.nodeIds.unshift(...head); }
    else {
      lane = { id: uniqueId(next, 'p'), name: `Lane ${next.paths.length + 1}`, nodeIds: [...head, fromId], halfWidth: DEFAULT_HALF_WIDTH };
      next.paths.push(lane);
    }
  }
  return finish(next, made.length ? (downhill ? made[made.length - 1] : made[0]) : fromId);
}

function disconnect(network: LaneNetwork, fromId: string, toId: string): LaneEditResult {
  const path = network.paths.find((candidate) => {
    const i = candidate.nodeIds.indexOf(fromId);
    const j = candidate.nodeIds.indexOf(toId);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  });
  if (!path) return refuse('not_joined', 'those two nodes are not joined');
  const next = copyNetwork(network);
  const lane = pathById(next, path.id)!;
  const cut = Math.max(lane.nodeIds.indexOf(fromId), lane.nodeIds.indexOf(toId));
  const head = lane.nodeIds.slice(0, cut);
  const tail = lane.nodeIds.slice(cut);
  next.paths = next.paths.filter((candidate) => candidate.id !== lane.id);
  if (head.length >= 2) next.paths.push({ ...lane, nodeIds: head });
  if (tail.length >= 2) next.paths.push({ ...lane, id: head.length >= 2 ? uniqueId(next, 'p') : lane.id, name: head.length >= 2 ? `${lane.name} (2)` : lane.name, nodeIds: tail });
  return finish(next);
}

function recolorPaths(network: LaneNetwork, pathIds: readonly string[], color: string): LaneEditResult {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return refuse('bad_color', `${color} is not a colour`);
  const next = copyNetwork(network);
  let changed = 0;
  for (const id of pathIds) { const path = pathById(next, id); if (path) { path.color = color.toLowerCase(); changed++; } }
  if (!changed) return refuse('no_lane', 'pick a line first');
  return finish(next);
}

function recolorNodes(network: LaneNetwork, nodeIds: readonly string[], color: string | null): LaneEditResult {
  if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return refuse('bad_color', `${color} is not a colour`);
  const next = copyNetwork(network);
  let changed = 0;
  for (const id of nodeIds) {
    const node = nodeById(next, id);
    if (!node) continue;
    if (color) node.color = color.toLowerCase(); else delete node.color;
    changed++;
  }
  if (!changed) return refuse('no_node', 'pick a node first');
  return finish(next);
}

function twinRun(network: LaneNetwork, pathId: string, nodeIds: readonly string[]): LaneEditResult {
  const path = pathById(network, pathId);
  if (!path) return refuse('unknown_path', `there is no lane ${pathId}`);
  const first = path.nodeIds.indexOf(nodeIds[0]);
  const last = path.nodeIds.indexOf(nodeIds[nodeIds.length - 1]);
  if (first < 0 || last <= first) return refuse('no_line', 'pick a line of at least two joined nodes first');
  const next = copyNetwork(network);
  const run = path.nodeIds.slice(first, last + 1).map((id) => nodeById(next, id)!);
  // One lane width over, towards the side of the road with more room.
  const mid = run.reduce((sum, node) => sum + node.z, 0) / run.length;
  const side = mid >= 0 ? -1 : 1;
  const offset = (z: number) => {
    let moved = clamp(z + side * FORK_OFFSET, -LANE_Z_LIMIT, LANE_Z_LIMIT);
    if (Math.abs(moved - z) < FORK_OFFSET / 2) moved = clamp(z - side * FORK_OFFSET, -LANE_Z_LIMIT, LANE_Z_LIMIT);
    return Math.round(moved);
  };
  const shareStart = first > 0;
  const shareEnd = last < path.nodeIds.length - 1;
  const ids: string[] = [];
  run.forEach((node, i) => {
    const endpoint = (i === 0 && shareStart) || (i === run.length - 1 && shareEnd);
    if (endpoint) { ids.push(node.id); return; }
    const id = uniqueId(next, 'n');
    next.nodes.push({ id, x: node.x, z: offset(node.z), kind: 'normal' });
    ids.push(id);
  });
  // Two shared ends and nothing between: put one node in the middle so the twin runs beside the line.
  if (ids.length === 2 && shareStart && shareEnd) {
    const a = run[0], b = run[run.length - 1];
    const id = uniqueId(next, 'n');
    next.nodes.push({ id, x: Math.round((a.x + b.x) / 2), z: offset((a.z + b.z) / 2), kind: 'normal' });
    ids.splice(1, 0, id);
  }
  next.paths.push({
    id: uniqueId(next, 'p'), name: `${path.name} (twin)`, nodeIds: ids, halfWidth: path.halfWidth,
    ...(path.color ? { color: path.color } : {}),
  });
  return finish(next, ids[1]);
}

/**
 * The line through a lane segment or node, out to the nearest junction (or lane end) either way: a
 * node other lanes also use (a split, a merge, a crossing) stops it and is its last node.
 */
export function laneLineThrough(network: LaneNetwork, pathId: string, index: number): { pathId: string; nodeIds: string[] } | null {
  const path = pathById(network, pathId);
  if (!path || index < 0 || index >= path.nodeIds.length) return null;
  const shared = (id: string) => network.paths.filter((candidate) => candidate.nodeIds.includes(id)).length > 1;
  let a = index;
  while (a > 0 && !(a !== index && shared(path.nodeIds[a]))) a--;
  let b = index;
  while (b < path.nodeIds.length - 1 && !(b !== index && shared(path.nodeIds[b]))) b++;
  if (a === b) { if (b < path.nodeIds.length - 1) b++; else if (a > 0) a--; }
  return { pathId, nodeIds: path.nodeIds.slice(a, b + 1) };
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

/* -----------------------------------------------------------------------------
   LANE BRUSH
   -------------------------------------------------------------------------- */

/** The brush's node spacing (engine x between nodes): the panel's slider range and its default. */
export const BRUSH_SPACING_MIN = 150;
export const BRUSH_SPACING_MAX = 2000;
export const BRUSH_SPACING_DEFAULT = 600;

/**
 * A brush stroke (the pointer's path over the road, in engine x/z) as the nodes of a new lane: one
 * every `spacing` down the hill, the stroke's far end kept, every point pulled onto the road. A stroke
 * drawn up the hill is read the other way round (a lane always runs down it). Fewer than two points: [].
 */
export function brushStrokePoints(stroke: readonly { x: number; z: number }[], spacing: number): { x: number; z: number }[] {
  if (stroke.length < 2) return [];
  const step = clamp(spacing, BRUSH_SPACING_MIN, BRUSH_SPACING_MAX);
  const points = stroke[stroke.length - 1].x < stroke[0].x ? [...stroke].reverse() : [...stroke];
  const onRoad = (p: { x: number; z: number }) => snapNode(p.x, p.z, { lanes: false, grid: false });
  const out = [onRoad(points[0])];
  let furthest = out[0];
  for (const p of points) {
    const q = onRoad(p);
    if (q.x > furthest.x) furthest = q;
    if (q.x >= out[out.length - 1].x + step) out.push(q);
  }
  // The far end of the stroke is where the lane was meant to reach: keep it (or move the last node there).
  const last = out[out.length - 1];
  if (furthest.x > last.x + step * 0.4) out.push(furthest);
  else if (out.length > 1 && furthest.x > last.x) out[out.length - 1] = furthest;
  return out.length >= 2 ? out : [];
}
