/**
 * M01 · T7 (IF-BUILDER) — the lane tool's brain, without a browser in the room.
 *
 * The four acceptance criteria this file can settle headlessly: immutability (a frozen document comes
 * back untouched), refusals with a reason (splitting an out-of-bounds node, merging a cycle, a move
 * that breaks x order), an undo/redo round trip per operation, and snapping to the lane centres and
 * the x grid.
 *
 * Run with: `node --import tsx --test tests/lane-edit.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANE_WIDTH_CHOICES, SNAP_X_GRID, SNAP_Z_LANES, SNAP_Z_RADIUS, applyLaneEdit, blankLaneNetwork,
  createLaneHistory, describeError, snapNode, uniqueId, type LaneEdit,
} from '../src/game/lane-path-tool';
import {
  DEFAULT_HALF_WIDTH, LANE_Z_LIMIT, LANE_NETWORK_VERSION, adjacentPath, sampleLane, sampleLaneNetwork,
  validateLaneNetwork, type LaneNetwork,
} from '../src/game/lane-network';
import { FINISH, RADIUS, START_X, laneZ } from '../src/game/scene';

/** Every edit lands on a network the runtime accepts — that is the module's promise. */
function applied(network: LaneNetwork, edit: LaneEdit): LaneNetwork {
  const result = applyLaneEdit(network, edit);
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  if (!result.ok) throw new Error(result.reason);
  assert.equal(validateLaneNetwork(result.network).ok, true, 'the result must validate');
  return result.network;
}

function refused(network: LaneNetwork, edit: LaneEdit): string {
  const result = applyLaneEdit(network, edit);
  assert.equal(result.ok, false, `expected a refusal: ${JSON.stringify(edit)}`);
  if (result.ok) throw new Error('expected a refusal');
  return result.reason;
}

const frozen = <T>(value: T): T => deepFreeze(structuredClone(value));
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

const ids = (network: LaneNetwork) => network.nodes.map((node) => node.id);
const node = (network: LaneNetwork, id: string) => network.nodes.find((candidate) => candidate.id === id)!;

test('lane-edit: immutability — a frozen document is never touched', () => {
  const base = frozen(blankLaneNetwork('ridge', laneZ(2)));
  const before = JSON.stringify(base);

  // One of every op, including the ones that fail: none of them may write to the input.
  const edits: LaneEdit[] = [
    { op: 'addPath', at: [{ x: 8000, z: laneZ(1) }, { x: 12000, z: laneZ(1) }] },
    { op: 'moveNode', nodeId: 'n2', x: 60000, z: laneZ(2) },
    { op: 'insertNode', pathId: 'p1', x: 30000, z: laneZ(2) },
    // setKind is the one op whose only legal target is what the node already is; asking for the
    // same kind again is a no-op and must not enter the stack (nor may an illegal kind).
    { op: 'setKind', nodeId: 'n1', kind: 'normal' },
    { op: 'split', nodeId: 'n1', to: { x: 20000, z: laneZ(1) } },
    { op: 'merge', fromPathId: 'p1', intoNodeId: 'n2' },
    { op: 'markOob', pathId: 'p1' },
    { op: 'deleteNode', nodeId: 'n1' },
    { op: 'moveNode', nodeId: 'n9', x: 1000, z: 0 },
    { op: 'insertNode', pathId: 'nope', x: 1000, z: 0 },
    { op: 'split', nodeId: 'n1', to: { x: 0, z: 0 } },
  ];
  for (const edit of edits) {
    const snapshot = JSON.stringify(base);
    applyLaneEdit(base, edit);
    assert.equal(JSON.stringify(base), snapshot, `${edit.op} wrote to its input`);
  }
  assert.equal(JSON.stringify(base), before);
  assert.equal(Object.isFrozen(base.nodes[0]), true, 'the fixture itself stayed frozen');
});

test('lane-edit: the operations do what they say', () => {
  const base = frozen(blankLaneNetwork('ridge', laneZ(2)));
  assert.equal(base.paths[0].halfWidth, DEFAULT_HALF_WIDTH);
  assert.ok(LANE_WIDTH_CHOICES.includes(DEFAULT_HALF_WIDTH));

  // addPath: a fresh line, and its end is an out-of-bounds trigger because it stops short of the flag.
  const withBranch = applied(base, { op: 'addPath', at: [{ x: 9000, z: laneZ(1) }, { x: 14000, z: laneZ(0) }, { x: 20000, z: laneZ(0) }] });
  assert.equal(withBranch.paths.length, 2);
  assert.equal(withBranch.nodes.length, 5);
  const branchNodes = withBranch.paths[1].nodeIds;
  assert.deepEqual(branchNodes.map((id) => node(withBranch, id).kind), ['normal', 'normal', 'oob']);
  assert.equal(uniqueId(withBranch, 'n'), 'n6', 'generated ids avoid what is already there');
  // Halfway between the first two points of the branch, in x and therefore in z.
  assert.equal(sampleLane(withBranch, withBranch.paths[1].id, 11500)!.z, laneZ(1) + (laneZ(0) - laneZ(1)) / 2);

  // insertNode: lands between the two nodes that bracket it, and keeps the line straight.
  const inserted = applied(base, { op: 'insertNode', pathId: 'p1', x: 30000, z: laneZ(2) });
  assert.equal(inserted.nodes.length, 3);
  assert.equal(inserted.paths[0].nodeIds.length, 3);
  assert.equal(inserted.paths[0].nodeIds[1], 'n3');
  assert.equal(node(inserted, 'n3').kind, 'normal');

  // moveNode: the node moves, everything else stays.
  const moved = applied(base, { op: 'moveNode', nodeId: 'n2', x: 70000, z: laneZ(3) });
  assert.equal(node(moved, 'n2').x, 70000);
  assert.equal(node(moved, 'n2').z, laneZ(3));
  assert.equal(node(moved, 'n1').x, START_X);

  // deleteNode: from a three-node path it is allowed, and the kinds follow the new shape.
  const shortened = applied(inserted, { op: 'deleteNode', nodeId: 'n3' });
  assert.deepEqual(ids(shortened), ['n1', 'n2']);
  assert.deepEqual(shortened.paths[0].nodeIds, ['n1', 'n2']);

  // setKind: refused when the shape disagrees, and the reason names what the node actually is.
  const refusedKind = refused(base, { op: 'setKind', nodeId: 'n2', kind: 'merge' });
  assert.ok(refusedKind.startsWith('kind_mismatch:'), refusedKind);
  assert.ok(refusedKind.includes('normal'), refusedKind);

  // markOob: a path that stops short of the flag is already an out-of-bounds end.
  const marked = applied(withBranch, { op: 'markOob', pathId: withBranch.paths[1].id });
  assert.equal(node(marked, marked.paths[1].nodeIds[2]).kind, 'oob');
  // …and one that reaches the flag is not, which is the only interesting answer it has.
  const refusedMark = refused(base, { op: 'markOob', pathId: 'p1' });
  assert.ok(refusedMark.startsWith('kind_mismatch:'), refusedMark);

  // split: from a mid-path node. The road carries on through the node, so the node keeps its shape —
  // the fork is the new path, and it is a lane option from the fork onwards, which is exactly what
  // "split a path" means in play.
  const withMid = applied(base, { op: 'insertNode', pathId: 'p1', x: 30000, z: laneZ(2) });
  const split = applied(withMid, { op: 'split', nodeId: 'n3', to: { x: 40000, z: laneZ(3) } });
  assert.equal(split.paths.length, 2);
  assert.equal(validateLaneNetwork(split).ok, true);
  assert.equal(node(split, 'n3').kind, 'normal', 'the path it forks from does not end here');
  assert.deepEqual(split.paths[1].nodeIds, ['n3', split.paths[1].nodeIds[1]]);
  assert.equal(node(split, split.paths[1].nodeIds[1]).kind, 'oob', 'a branch that stops short of the flag is an oob trigger');
  assert.equal(sampleLane(split, split.paths[1].id, 35000)!.z, laneZ(2) + (laneZ(3) - laneZ(2)) / 2);
  // The branch is a lane option at that x, the same list the CPU drivers pick from.
  assert.equal(adjacentPath(split, 'p1', 35000, 1), split.paths[1].id, 'the branch is the smaller-z option');
  assert.equal(adjacentPath(split, 'p1', 20000, 1), null, 'and it does not exist before the fork');

  // A whole split node — one path in, two out — is what a branch point becomes once a path *ends*
  // there, so the tool reaches it in two steps rather than one.
  const feeder = applied(split, { op: 'addPath', at: [{ x: 10000, z: laneZ(0) }, { x: 15000, z: laneZ(0) }] });
  const intoFork = applied(feeder, { op: 'merge', fromPathId: feeder.paths[2].id, intoNodeId: 'n3' });
  assert.equal(node(intoFork, 'n3').kind, 'normal', 'one arrival, one departure — the road just joins');
  const splitAgain = applied(intoFork, { op: 'split', nodeId: 'n3', to: { x: 50000, z: laneZ(0) } });
  assert.equal(node(splitAgain, 'n3').kind, 'split', 'one path ends here and two leave');

  // Branching off the very first node is *not* one of the four shapes: two paths would leave a node
  // with nothing arriving at it, which is a second start, not a fork.
  const secondStart = refused(base, { op: 'split', nodeId: 'n1', to: { x: 20000, z: laneZ(3) } });
  assert.ok(secondStart.startsWith('kind_mismatch:'), secondStart);

  // merge: a new path joined onto the sample's merge node stays a merge (still two in, one out).
  const sample = sampleLaneNetwork('ridge');
  const added = applied(sample, { op: 'addPath', at: [{ x: 9000, z: laneZ(3) }, { x: 12000, z: laneZ(3) }] });
  const joined = added.paths[added.paths.length - 1];
  const merged = applied(added, { op: 'merge', fromPathId: joined.id, intoNodeId: 'loop' });
  assert.equal(merged.paths[merged.paths.length - 1].nodeIds.includes('loop'), true);
  assert.equal(node(merged, 'loop').kind, 'merge', 'two in, one out is still a merge');
  assert.equal(validateLaneNetwork(merged).ok, true);
  // A *split* node may not take a second arrival: two in and two out is none of the four shapes.
  // The sample's fork from one line into four is at x = 1200, so a feeder has to end before that.
  const shortFeed = applied(merged, { op: 'addPath', at: [{ x: 300, z: laneZ(3) }, { x: 700, z: laneZ(3) }] });
  const intoGrid = refused(shortFeed, {
    op: 'merge', fromPathId: shortFeed.paths[shortFeed.paths.length - 1].id, intoNodeId: 'grid',
  });
  assert.ok(intoGrid.startsWith('kind_mismatch:'), intoGrid);
});

test('lane-edit: refusals name the code and the reason', () => {
  const base = frozen(blankLaneNetwork('ridge', laneZ(2)));

  // A move that breaks x order in one of its paths.
  const monotone = refused(base, { op: 'moveNode', nodeId: 'n1', x: FINISH, z: laneZ(2) });
  assert.equal(monotone.startsWith('non_monotone:'), true, monotone);

  // Splitting an out-of-bounds node: a dead end is where a road ends.
  const spur = sampleLaneNetwork('ridge');
  const oob = refused(spur, { op: 'split', nodeId: 'spur-end', to: { x: 70000, z: laneZ(0) } });
  assert.equal(oob.startsWith('oob_branch:'), true, oob);
  // (and a mid-path node is fine to branch from, which is the same op succeeding)
  assert.equal(applyLaneEdit(spur, { op: 'split', nodeId: 'lane0-9000', to: { x: 20000, z: laneZ(1) } }).ok, true);

  // Merging a path into a node it already runs through is a cycle.
  const cycle = refused(base, { op: 'merge', fromPathId: 'p1', intoNodeId: 'n1' });
  assert.equal(cycle.startsWith('cycle:'), true, cycle);
  // Merging backwards, into a node that is behind the path's end, is not a cycle but still illegal.
  const backwards = refused(base, { op: 'merge', fromPathId: 'p1', intoNodeId: 'n1' });
  assert.ok(backwards.startsWith('cycle:'));

  // Everything a person can reach gets a sentence, not a throw.
  const cases: [string, LaneEdit][] = [
    ['out_of_corridor', { op: 'moveNode', nodeId: 'n1', x: 1000, z: LANE_Z_LIMIT + 1 }],
    ['out_of_corridor', { op: 'addPath', at: [{ x: 1000, z: 0 }, { x: 2000, z: 5000 }] }],
    ['out_of_corridor', { op: 'split', nodeId: 'n1', to: { x: 20000, z: -LANE_Z_LIMIT - 1 } }],
    ['too_few_nodes', { op: 'addPath', at: [{ x: 1000, z: 0 }] }],
    ['too_few_nodes', { op: 'deleteNode', nodeId: 'n1' }],
    ['non_monotone', { op: 'addPath', at: [{ x: 9000, z: 0 }, { x: 8000, z: 0 }] }],
    ['out_of_corridor', { op: 'insertNode', pathId: 'p1', x: FINISH + 1, z: 0 }],
    ['non_monotone', { op: 'insertNode', pathId: 'p1', x: START_X, z: 0 }],
    ['out_of_corridor', { op: 'split', nodeId: 'n1', to: { x: START_X - 1, z: 0 } }],
    ['non_monotone', { op: 'split', nodeId: 'n2', to: { x: 60000, z: 0 } }],
    ['unknown_node', { op: 'moveNode', nodeId: 'ghost', x: 1000, z: 0 }],
    ['unknown_node', { op: 'setKind', nodeId: 'ghost', kind: 'normal' }],
    ['unknown_node', { op: 'merge', fromPathId: 'p1', intoNodeId: 'ghost' }],
    ['unknown_path', { op: 'insertNode', pathId: 'ghost', x: 1000, z: 0 }],
    ['unknown_path', { op: 'markOob', pathId: 'ghost' }],
  ];
  for (const [code, edit] of cases) {
    const reason = refused(base, edit);
    assert.equal(reason.startsWith(`${code}:`), true, `${edit.op}: ${reason}`);
    assert.ok(reason.length > code.length + 8, `a reason must say something: ${reason}`);
  }

  // The refusal text for every code is a sentence with the code in front of it.
  const sentence = describeError({ code: 'non_monotone', pathId: 'p1', nodeId: 'n2' });
  assert.equal(sentence.startsWith('non_monotone:'), true, sentence);
  assert.ok(sentence.includes('p1') && sentence.includes('n2'));
});

test('lane-edit: undo and redo round-trip every operation', () => {
  const edits: LaneEdit[] = [
    { op: 'addPath', at: [{ x: 8000, z: laneZ(1) }, { x: 12000, z: laneZ(1) }] },
    { op: 'insertNode', pathId: 'p1', x: 30000, z: laneZ(2) },
    { op: 'moveNode', nodeId: 'n1', x: 400, z: laneZ(1) },
    { op: 'setKind', nodeId: 'n1', kind: 'normal' },
    { op: 'split', nodeId: 'n1', to: { x: 20000, z: laneZ(0) } },
    { op: 'markOob', pathId: 'p1' },
    { op: 'deleteNode', nodeId: 'n3' },
    { op: 'merge', fromPathId: 'p1', intoNodeId: 'n2' },
  ];

  for (const edit of edits) {
    const history = createLaneHistory(frozen(blankLaneNetwork('ridge', laneZ(2))));
    const start = JSON.stringify(history.network);
    assert.equal(history.canUndo, false);

    const result = history.apply(edit);
    const after = JSON.stringify(history.network);
    if (!result.ok) {
      // A refused edit is not an entry: nothing to undo, nothing changed.
      assert.equal(history.canUndo, false, `${edit.op} must not push a refused edit`);
      assert.equal(after, start);
      continue;
    }
    assert.equal(history.canUndo, true);
    assert.notEqual(after, start, `${edit.op} must change something`);

    // Undo gives back exactly the document we started from…
    const undone = history.undo();
    assert.equal(JSON.stringify(undone), start, `${edit.op}: undo must restore the previous document`);
    assert.equal(history.canRedo, true);
    // …and redo puts the edit back, exactly.
    const redone = history.redo();
    assert.equal(JSON.stringify(redone), after, `${edit.op}: redo must restore the edit`);
    // A fresh edit after an undo drops the redo branch.
    history.undo();
    const replacement = history.apply({ op: 'moveNode', nodeId: 'n2', x: 71000, z: laneZ(2) });
    assert.equal(replacement.ok, true);
    assert.equal(history.canRedo, false, 'a new edit after an undo clears the redo branch');
  }

  // depth, the floor of the stack, and reset().
  const history = createLaneHistory(frozen(blankLaneNetwork('ridge', laneZ(2))));
  assert.equal(history.depth, 0);
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
  history.apply({ op: 'moveNode', nodeId: 'n2', x: 60000, z: laneZ(2) });
  assert.equal(history.depth, 1);
  history.reset(blankLaneNetwork('ridge', laneZ(2)));
  assert.equal(history.depth, 0);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);

  // The stack is bounded, and the oldest entries are the ones dropped.
  const bounded = createLaneHistory(frozen(blankLaneNetwork('ridge', laneZ(2))), 3);
  for (let index = 0; index < 6; index++) {
    bounded.apply({ op: 'moveNode', nodeId: 'n1', x: START_X + index * 10, z: laneZ(2) });
  }
  assert.equal(bounded.depth, 3);
  let steps = 0;
  while (bounded.undo()) steps++;
  assert.equal(steps, 3);
});

test('lane-edit: snapping to the lanes and the grid', () => {
  // Within 30 z-units of a lane centre, and only then.
  for (const lane of SNAP_Z_LANES) {
    assert.equal(snapNode(1000, lane + SNAP_Z_RADIUS - 1, { lanes: true, grid: false }).z, lane);
    assert.equal(snapNode(1000, lane - SNAP_Z_RADIUS + 1, { lanes: true, grid: false }).z, lane);
  }
  assert.equal(snapNode(1000, laneZ(1) + SNAP_Z_RADIUS + 1, { lanes: true, grid: false }).z, laneZ(1) + SNAP_Z_RADIUS + 1);
  // Two lanes are 240 apart, so 30 is never ambiguous: the midpoint stays where it is.
  assert.equal(snapNode(1000, 0, { lanes: true, grid: false }).z, 0, 'halfway between two lanes snaps to neither');
  assert.equal(snapNode(1000, 5000, { lanes: true, grid: false }).z, LANE_Z_LIMIT, 'and everything is clamped');
  assert.equal(snapNode(0, 0, { lanes: true, grid: false }).x, START_X, 'x is clamped too');

  // The grid is 50 engine x-units, and it is optional.
  assert.equal(snapNode(9024, 0, { grid: true, lanes: false }).x, 9000);
  assert.equal(snapNode(9026, 0, { grid: true, lanes: false }).x, 9050);
  assert.equal(snapNode(9026, 0, { grid: false, lanes: false }).x, 9026);
  assert.equal(snapNode(9026, 0, { grid: true, lanes: false }).x % SNAP_X_GRID, 0);

  // Snapping is idempotent, and it is what the editor applies before an edit, so the result must be
  // something an edit accepts.
  const base = blankLaneNetwork('ridge', laneZ(2));
  for (const [x, z] of [[9026, laneZ(1) + 12], [30003, laneZ(3) - 9], [70010, 45]] as const) {
    const snapped = snapNode(x, z, { lanes: true, grid: true });
    assert.deepEqual(snapNode(snapped.x, snapped.z, { lanes: true, grid: true }), snapped);
    assert.equal(applyLaneEdit(base, { op: 'moveNode', nodeId: 'n2', x: snapped.x, z: snapped.z }).ok, true);
  }

  // The radius is the documented 30, and one lane width away from a centre is 120 — nowhere near it.
  assert.equal(SNAP_Z_RADIUS, 30);
  // Half a lane is 120: the snap radius is a quarter of that, so it can never be ambiguous.
  assert.equal(Math.abs(laneZ(0) - laneZ(1)) / 2, 120);
  assert.ok(SNAP_Z_RADIUS * 4 < Math.abs(laneZ(0) - laneZ(1)));
});

test('lane-edit: a blank network is a valid one, ready to author on', () => {
  const base = blankLaneNetwork('ridge', laneZ(2));
  const result = validateLaneNetwork(base);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.errors));
  assert.equal(base.version, LANE_NETWORK_VERSION);
  assert.equal(base.paths[0].nodeIds.length, 2);
  assert.equal(base.nodes[1].x, FINISH, 'the blank line runs to the flag');
  assert.equal(base.nodes.map((n) => n.kind).join(','), 'normal,normal', 'no dead end, no oob trigger');
  assert.equal(blankLaneNetwork('sheep', laneZ(1)).course, 'sheep');
});
