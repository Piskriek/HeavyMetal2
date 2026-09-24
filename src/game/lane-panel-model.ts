/**
 * M01 · T7 (IF-BUILDER) — everything `LanePanel` shows, derived purely.
 *
 * The panel is presentational: it renders this model and calls back. Keeping the derivation here means
 * the two claims the panel must never get wrong — *the error list is the validator's own*, and *Save is
 * impossible while the document is invalid* — are testable without a DOM, and the rendered-DOM test
 * (`tests/lane-panel.test.tsx`) only has to prove the markup shows what this model says.
 *
 * Pure TypeScript: no React, no DOM, no three.js.
 */
import {
  LANE_HALF_WIDTH_MAX, LANE_HALF_WIDTH_MIN, LANE_NODE_KINDS, inferKind, validateLaneNetwork,
  type LaneNetwork, type LaneNodeKind,
} from './lane-network';
import { FINISH, START_X } from './scene';
import { SNAP_X_GRID, SNAP_Z_LANES, SNAP_Z_RADIUS, describeError, snapNode, type LaneEdit } from './lane-path-tool';

export interface LaneNodeRow {
  readonly id: string;
  /** The kind the graph implies — the panel shows this, never the authored label. */
  readonly kind: LaneNodeKind | 'orphan';
  readonly x: number;
  readonly z: number;
  /** How many paths run through the node: 0 means it is stranded. */
  readonly pathCount: number;
}

export interface LanePathRow {
  readonly id: string;
  readonly name: string;
  readonly nodeCount: number;
  readonly halfWidth: number;
  /** The kind of its last node: what happens where this path ends. */
  readonly terminalKind: LaneNodeKind | 'orphan';
  /** True when the path is the document's out-of-bounds branch. */
  readonly oob: boolean;
}

export interface LanePanelModel {
  readonly hasDocument: boolean;
  readonly course: string | null;
  readonly nodes: readonly LaneNodeRow[];
  readonly paths: readonly LanePathRow[];
  /** The validator's own messages, ready to list. Empty means the document is legal. */
  readonly errors: readonly string[];
  /** The node id behind each error, in the same order — for "click the error to focus it". */
  readonly errorNodeIds: readonly (string | null)[];
  /** False while `errors` is non-empty. The Save control is disabled on exactly this. */
  readonly canSave: boolean;
  readonly selectedNodeId: string | null;
  readonly selectedPathId: string | null;
  /** Kept so the panel can show the four authored kinds in a stable order. */
  readonly kinds: readonly LaneNodeKind[];
}

const EMPTY: LanePanelModel = Object.freeze({
  hasDocument: false, course: null, nodes: [], paths: [], errors: [], errorNodeIds: [],
  canSave: false, selectedNodeId: null, selectedPathId: null, kinds: LANE_NODE_KINDS,
});

/** Builds the panel's view of the document. A refused document shows its refusals and cannot be saved. */
export function lanePanelModel(
  network: LaneNetwork | null,
  selection: { nodeId?: string | null; pathId?: string | null } = {},
): LanePanelModel {
  if (!network) return EMPTY;
  const selectedNodeId = selection.nodeId ?? null;
  const selectedPathId = selection.pathId ?? null;

  const pathCount = new Map<string, number>();
  for (const path of network.paths) {
    for (const nodeId of path.nodeIds) pathCount.set(nodeId, (pathCount.get(nodeId) ?? 0) + 1);
  }

  const nodes: LaneNodeRow[] = network.nodes.map((node) => ({
    id: node.id,
    kind: inferKind(network, node.id),
    x: node.x,
    z: node.z,
    pathCount: pathCount.get(node.id) ?? 0,
  }));

  const paths: LanePathRow[] = network.paths.map((path) => {
    const last = path.nodeIds[path.nodeIds.length - 1];
    return {
      id: path.id,
      name: path.name,
      nodeCount: path.nodeIds.length,
      halfWidth: path.halfWidth,
      terminalKind: last ? inferKind(network, last) : 'orphan',
      oob: path.nodeIds.some((nodeId) => inferKind(network, nodeId) === 'oob'),
    };
  });

  const validation = validateLaneNetwork(network);
  const errors = validation.ok ? [] : validation.errors.map(describeError);
  const errorNodeIds = validation.ok
    ? []
    : validation.errors.map((refusal) => ('nodeId' in refusal && refusal.nodeId ? refusal.nodeId : null));

  return Object.freeze({
    hasDocument: true,
    course: network.course,
    nodes: Object.freeze(nodes),
    paths: Object.freeze(paths),
    errors: Object.freeze(errors),
    errorNodeIds: Object.freeze(errorNodeIds),
    canSave: validation.ok,
    selectedNodeId,
    selectedPathId,
    kinds: LANE_NODE_KINDS,
  });
}

/* ---------------------------------------------------------------------------
   The keys. The ticket's own list, as a pure function so the binding is testable.
   ------------------------------------------------------------------------- */

export type LaneKeyIntent =
  | 'undo' | 'redo'
  | 'newPath' | 'insert' | 'delete' | 'cycleKind' | 'split' | 'merge' | 'markOob';

export interface LaneKeyEvent {
  readonly key: string;
  readonly ctrlOrMeta: boolean;
  /** True when a text field has focus: typing "n" in a name box must not start a path. */
  readonly typing: boolean;
}

/**
 * One keypress → one intent, or null. `Ctrl+Z`/`Ctrl+Y` (and `Ctrl+Shift+Z`) are checked first, and a
 * keystroke inside a text field never becomes a command.
 */
export function laneKeyIntent(event: LaneKeyEvent): LaneKeyIntent | null {
  const key = event.key.toLowerCase();
  if (event.ctrlOrMeta) {
    if (key === 'z') return event.key === 'Z' ? 'redo' : 'undo';
    if (key === 'y') return 'redo';
    return null;
  }
  if (event.typing) return null;
  switch (key) {
    case 'n': return 'newPath';
    case 'i': return 'insert';
    case 'delete': return 'delete';
    case 'k': return 'cycleKind';
    case 's': return 'split';
    case 'm': return 'merge';
    case 'o': return 'markOob';
    default: return null;
  }
}

/* ---------------------------------------------------------------------------
   The panel's commands → the tool's edits.
   ---------------------------------------------------------------------------
   The panel hands back a command with no coordinates in it ("insert a node", "split here"), so
   *which* point that means is decided here, purely, from the document and the selection. That keeps
   the React component presentational and lets the defaults be tested: every command either produces an
   edit the tool accepts, or a reason the panel can toast — never a coordinate that happens to be legal.
   ------------------------------------------------------------------------- */

export type LanePanelCommand =
  | { op: 'newPath' } | { op: 'insert' } | { op: 'delete' } | { op: 'split' }
  | { op: 'merge' } | { op: 'markOob' }
  /** `kind` is what a kind button asks for; the K key asks for the next kind instead. */
  | { op: 'cycleKind'; kind?: LaneNodeKind }
  | { op: 'setHalfWidth'; pathId: string; halfWidth: number };

export type LanePanelAction =
  | { readonly kind: 'edit'; readonly edit: LaneEdit }
  /** Half width is document data the edit ops never touch, so it takes its own path to the builder. */
  | { readonly kind: 'halfWidth'; readonly pathId: string; readonly halfWidth: number };

export type LaneCommandResult =
  | { readonly ok: true; readonly action: LanePanelAction }
  | { readonly ok: false; readonly reason: string };

const FAIL = (reason: string): LaneCommandResult => ({ ok: false, reason });

const nodeAt = (network: LaneNetwork, nodeId: string | null) =>
  (nodeId ? network.nodes.find((node) => node.id === nodeId) ?? null : null);
const pathAt = (network: LaneNetwork, pathId: string | null) =>
  (pathId ? network.paths.find((path) => path.id === pathId) ?? null : null);
const pathOfNode = (network: LaneNetwork, nodeId: string | null) =>
  (nodeId ? network.paths.find((path) => path.nodeIds.includes(nodeId)) ?? null : null);

/** The lane centre carrying the fewest nodes: where a fresh lane wants to go. */
function freeLaneZ(network: LaneNetwork): number {
  let best = SNAP_Z_LANES[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const centre of SNAP_Z_LANES) {
    const count = network.nodes.filter((node) => Math.abs(node.z - centre) <= SNAP_Z_RADIUS).length;
    if (count < bestCount) { bestCount = count; best = centre; }
  }
  return best;
}

/** The lane centre nearest `z` that is not the lane the node is already on. */
function otherLaneZ(z: number): number {
  let best = z;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const centre of SNAP_Z_LANES) {
    if (Math.abs(centre - z) < SNAP_Z_RADIUS) continue;
    const distance = Math.abs(centre - z);
    if (distance < bestDistance) { bestDistance = distance; best = centre; }
  }
  return bestDistance === Number.POSITIVE_INFINITY ? z : best;
}

/** The four kinds, in the order K walks them. `orphan` is not a destination: a node is what it is. */
function nextKind(current: LaneNodeKind | 'orphan'): LaneNodeKind {
  const index = (LANE_NODE_KINDS as readonly string[]).indexOf(current);
  return LANE_NODE_KINDS[(index + 1) % LANE_NODE_KINDS.length];
}

/**
 * Turns one panel command into one tool edit.
 *
 * The defaults, spelled out, because they are decisions a person will feel:
 *  - **New path** runs to the flag, in the lane that is least occupied: `[x, x+6000, FINISH]`, with the
 *    middle point dropped when it would not fit. A path that stops short of the flag is an
 *    out-of-bounds trigger by T6's law, and that is not what "new path" means.
 *  - **Insert** lands in the middle of the segment after the selected node (else the longest segment,
 *    so a two-node path has somewhere to grow), with `z` read off the straight line between them.
 *  - **Split** branches 4000 down-range (or to the flag, whichever comes first) onto the nearest other
 *    lane centre.
 *  - **Merge** needs both halves of the selection: the path to fold in, and the node it folds into.
 *  - **Mark out of bounds** marks the selected path's tail — usually a confirmation, since T6 infers it.
 */
export function laneEditForCommand(
  command: LanePanelCommand,
  network: LaneNetwork | null,
  selection: { nodeId?: string | null; pathId?: string | null } = {},
): LaneCommandResult {
  if (!network) return FAIL('no_document: there is no lane network loaded for this course');
  const nodeId = selection.nodeId ?? null;
  const pathId = selection.pathId ?? null;
  const node = nodeAt(network, nodeId);

  switch (command.op) {
    case 'newPath': {
      const base = node ?? network.nodes[0] ?? null;
      const x0 = base ? snapNode(base.x, base.z, { lanes: true, grid: true }).x : START_X;
      const start = Math.min(x0, FINISH - SNAP_X_GRID * 3);
      if (start < START_X) return FAIL('out_of_corridor: there is no room left to start a path here');
      const z = base ? freeLaneZ(network) : SNAP_Z_LANES[0];
      const middle = start + 6000;
      const at = middle < FINISH
        ? [{ x: start, z }, { x: middle, z }, { x: FINISH, z }]
        : [{ x: start, z }, { x: FINISH, z }];
      return { ok: true, action: { kind: 'edit', edit: { op: 'addPath', at } } };
    }

    case 'insert': {
      const path = pathAt(network, pathId) ?? pathOfNode(network, nodeId);
      if (!path) return FAIL('no_selection: select a path, or a node on one, before inserting');
      const nodes = path.nodeIds.map((id) => nodeAt(network, id)).filter((n): n is NonNullable<typeof n> => n !== null);
      let best = -1;
      let bestSpan = 0;
      for (let index = 0; index < nodes.length - 1; index++) {
        const span = nodes[index + 1].x - nodes[index].x;
        if (span <= 1) continue;
        // The segment right after the selected node wins even when it is not the longest.
        const preferred = nodes[index].id === nodeId;
        if (preferred) { best = index; bestSpan = span; break; }
        if (span > bestSpan) { best = index; bestSpan = span; }
      }
      if (best < 0 || bestSpan <= 1) return FAIL('too_few_nodes: this path has no segment to hold a new node');
      const before = nodes[best];
      const after = nodes[best + 1];
      const x = before.x + bestSpan / 2;
      const z = before.z + (after.z - before.z) * ((x - before.x) / bestSpan);
      return { ok: true, action: { kind: 'edit', edit: { op: 'insertNode', pathId: path.id, x, z } } };
    }

    case 'delete': {
      if (!node) return FAIL('no_selection: select the node you want to delete');
      return { ok: true, action: { kind: 'edit', edit: { op: 'deleteNode', nodeId: node.id } } };
    }

    case 'split': {
      if (!node) return FAIL('no_selection: select the node the branch should leave from');
      const x = Math.min(node.x + 4000, FINISH);
      if (x <= node.x) return FAIL('out_of_corridor: there is no room left to branch from this node');
      return { ok: true, action: { kind: 'edit', edit: { op: 'split', nodeId: node.id, to: { x, z: otherLaneZ(node.z) } } } };
    }

    case 'merge': {
      const path = pathAt(network, pathId);
      if (!path) return FAIL('no_selection: select the path to fold in');
      if (!node) return FAIL('no_selection: select the node it should fold into');
      return { ok: true, action: { kind: 'edit', edit: { op: 'merge', fromPathId: path.id, intoNodeId: node.id } } };
    }

    case 'markOob': {
      const path = pathAt(network, pathId) ?? pathOfNode(network, nodeId);
      if (!path) return FAIL('no_selection: select a path, or a node on one, first');
      return { ok: true, action: { kind: 'edit', edit: { op: 'markOob', pathId: path.id } } };
    }

    case 'cycleKind': {
      if (!node) return FAIL('no_selection: select a node to change');
      const kind = command.kind ?? nextKind(inferKind(network, node.id));
      return { ok: true, action: { kind: 'edit', edit: { op: 'setKind', nodeId: node.id, kind } } };
    }

    case 'setHalfWidth': {
      const path = pathAt(network, command.pathId);
      if (!path) return FAIL(`unknown_path: there is no path ${command.pathId}`);
      if (command.halfWidth < LANE_HALF_WIDTH_MIN || command.halfWidth > LANE_HALF_WIDTH_MAX) {
        return FAIL(`bad_half_width: ${command.halfWidth} is outside ${LANE_HALF_WIDTH_MIN}–${LANE_HALF_WIDTH_MAX}`);
      }
      return { ok: true, action: { kind: 'halfWidth', pathId: path.id, halfWidth: command.halfWidth } };
    }
  }
}
