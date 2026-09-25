/**
 * M01 · T6 — the lane network: refuse what cannot be driven, sample what can.
 *
 * Run with: `node --import tsx --test tests/lane-network.test.ts`.
 *
 * The acceptance ticket names six things, and they are the six tests below: every refusal code for a
 * crafted document, kind inference against topology, sampling continuity, the corridor union,
 * adjacency and successors, and the out-of-bounds crossing — the last one driven through the real
 * physics step, so it is the engine's own recovery that fires and not a hand-rolled imitation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HALF_WIDTH, LANE_BAKE_STEP, LANE_NETWORK_VERSION, LANE_Z_LIMIT, LEGACY_CORRIDOR,
  adjacentPath, corridorAt, createDefaultLaneNetwork, inferKind, nearestPath, oobCrossed, resolveLaneTarget, sampleLane,
  sampleLaneNetwork, successorPath, validateLaneNetwork,
  type LaneNetwork, type LaneRefusal,
} from '../src/game/lane-network';
import { FINISH, LANE, LANE_WIDTH, RADIUS, START_X, laneZ } from '../src/game/scene';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createStepTrace, resetTrace, stepRacer } from '../src/game/sim/racer-physics';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { FIXED_STEP } from '../src/game/contracts/timing';

const codes = (errors: readonly LaneRefusal[]) => errors.map((error) => error.code);

/** A minimal valid network: one straight path from the grid to the flag. */
function straight(course: 'ridge' = 'ridge'): LaneNetwork {
  return {
    version: LANE_NETWORK_VERSION, course,
    nodes: [
      { id: 'a', x: START_X, z: laneZ(2), kind: 'normal' },
      { id: 'b', x: 20000, z: laneZ(1), kind: 'normal' },
      { id: 'c', x: FINISH, z: laneZ(1), kind: 'normal' },
    ],
    paths: [{ id: 'p', name: 'Straight', nodeIds: ['a', 'b', 'c'], halfWidth: DEFAULT_HALF_WIDTH }],
  };
}

const withNodes = (nodes: LaneNetwork['nodes'], paths: LaneNetwork['paths'] = straight().paths): LaneNetwork =>
  ({ version: LANE_NETWORK_VERSION, course: 'ridge', nodes, paths });

/* -----------------------------------------------------------------------------
   AC-2: every refusal code
   -------------------------------------------------------------------------- */

test('refusal codes', () => {
  const valid = validateLaneNetwork(straight());
  assert.equal(valid.ok, true, JSON.stringify(valid.ok ? [] : valid.errors));

  const cases: { name: string; doc: unknown; expect: LaneRefusal['code'] }[] = [
    {
      name: 'duplicate_id',
      doc: withNodes([
        { id: 'a', x: START_X, z: 0, kind: 'normal' },
        { id: 'a', x: 20000, z: 0, kind: 'normal' },
        { id: 'c', x: FINISH, z: 0, kind: 'normal' },
      ]),
      expect: 'duplicate_id',
    },
    {
      name: 'unknown_node',
      doc: withNodes(straight().nodes, [{ id: 'p', name: 'P', nodeIds: ['a', 'nope', 'c'], halfWidth: DEFAULT_HALF_WIDTH }]),
      expect: 'unknown_node',
    },
    {
      name: 'too_few_nodes',
      doc: withNodes(straight().nodes, [{ id: 'p', name: 'P', nodeIds: ['a'], halfWidth: DEFAULT_HALF_WIDTH }]),
      expect: 'too_few_nodes',
    },
    {
      name: 'non_monotone',
      doc: withNodes(straight().nodes, [{ id: 'p', name: 'P', nodeIds: ['c', 'b', 'a'], halfWidth: DEFAULT_HALF_WIDTH }]),
      expect: 'non_monotone',
    },
    {
      name: 'out_of_corridor',
      doc: withNodes([
        { id: 'a', x: START_X, z: LANE_Z_LIMIT + 1, kind: 'normal' },
        { id: 'b', x: FINISH, z: 0, kind: 'normal' },
      ], [{ id: 'p', name: 'P', nodeIds: ['a', 'b'], halfWidth: DEFAULT_HALF_WIDTH }]),
      expect: 'out_of_corridor',
    },
    {
      name: 'kind_mismatch',
      // Two paths end here, so the graph says merge, but the node is authored as a plain one.
      doc: {
        version: LANE_NETWORK_VERSION, course: 'ridge',
        nodes: [
          { id: 'a', x: START_X, z: laneZ(0), kind: 'normal' },
          { id: 'b', x: 20000, z: laneZ(1), kind: 'normal' },
          { id: 'm', x: 40000, z: laneZ(2), kind: 'normal' },
          { id: 'z', x: FINISH, z: laneZ(2), kind: 'normal' },
        ],
        paths: [
          { id: 'p1', name: 'P1', nodeIds: ['a', 'm'], halfWidth: DEFAULT_HALF_WIDTH },
          { id: 'p2', name: 'P2', nodeIds: ['b', 'm'], halfWidth: DEFAULT_HALF_WIDTH },
          { id: 'p3', name: 'P3', nodeIds: ['m', 'z'], halfWidth: DEFAULT_HALF_WIDTH },
        ],
      },
      expect: 'kind_mismatch',
    },
    {
      name: 'bad_half_width',
      doc: withNodes(straight().nodes, [{ id: 'p', name: 'P', nodeIds: ['a', 'b', 'c'], halfWidth: 900 }]),
      expect: 'bad_half_width',
    },
  ];

  for (const testCase of cases) {
    const result = validateLaneNetwork(testCase.doc);
    assert.equal(result.ok, false, `${testCase.name}: must be refused`);
    if (!result.ok) {
      assert.ok(codes(result.errors).includes(testCase.expect),
        `${testCase.name}: expected ${testCase.expect}, got ${JSON.stringify(result.errors)}`);
    }
  }

  // A document that is not a network at all is refused, not thrown on.
  for (const rubbish of [null, 42, 'lanes', {}, { version: 2, course: 'ridge', nodes: [], paths: [] },
    { version: 1, course: 'moon', nodes: [], paths: [] }]) {
    const result = validateLaneNetwork(rubbish);
    assert.equal(result.ok, false, `${JSON.stringify(rubbish)} must be refused`);
  }

  // And the sample the builder opens is a valid one.
  const sample = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(sample.ok, true, JSON.stringify(sample.ok ? [] : sample.errors));
  if (sample.ok) {
    assert.equal(sample.network.nodes.length, 29);
    assert.equal(sample.network.paths.length, 8);
  }
});

/* -----------------------------------------------------------------------------
   AC-3: kind inference
   -------------------------------------------------------------------------- */

test('kind inference', () => {
  const sample = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(sample.ok, true);
  if (!sample.ok) return;
  const { network } = sample;

  // Every authored non-normal node is exactly what the graph says it is (AC-3).
  for (const node of network.nodes) {
    if (node.kind === 'normal') continue;
    assert.equal(inferKind(network, node.id), node.kind, `${node.id} should infer ${node.kind}`);
  }
  assert.equal(inferKind(network, 'grid'), 'split');
  assert.equal(inferKind(network, 'loop'), 'merge');
  assert.equal(inferKind(network, 'spur-end'), 'oob');
  assert.equal(inferKind(network, 'finish'), 'normal', 'the finish line is an end, not an out-of-bounds trigger');
  assert.equal(inferKind(network, 'lane0-9000'), 'normal', 'a node in the middle of a path is normal');
  assert.equal(inferKind(network, 'nothing-here'), 'orphan');

  // An unreferenced node is an orphan, and a document may carry one: it is a spare, not an error.
  const spare = withNodes([...straight().nodes, { id: 'spare', x: 30000, z: 0, kind: 'normal' }]);
  const validated = validateLaneNetwork(spare);
  assert.equal(validated.ok, true);
  if (validated.ok) assert.equal(inferKind(validated.network, 'spare'), 'orphan');
});

/* -----------------------------------------------------------------------------
   AC-4: sampling
   -------------------------------------------------------------------------- */

test('sampling continuity', () => {
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { network } = result;

  // Outside a path's x range there is no lane at all.
  assert.equal(sampleLane(network, 'ridge-lane-0', START_X - 1), null);
  assert.equal(sampleLane(network, 'ridge-lane-0', FINISH + 1), null);
  assert.equal(sampleLane(network, 'nope', 20000), null);

  // Continuous through every node, and monotone-safe: walk each path in 25-unit steps and require
  // the centre to move no further than the slope allows and never to jump at a node.
  for (const path of network.paths) {
    const first = network.nodes.find((node) => node.id === path.nodeIds[0])!;
    const last = network.nodes.find((node) => node.id === path.nodeIds[path.nodeIds.length - 1])!;
    let previous = sampleLane(network, path.id, first.x)!;
    assert.ok(Math.abs(previous.z - first.z) < 1e-9, `${path.id} starts at its first node`);
    for (let x = first.x + 25; x <= last.x; x += 25) {
      const current = sampleLane(network, path.id, x);
      assert.ok(current, `${path.id} is defined at ${x}`);
      assert.equal(current!.halfWidth, path.halfWidth);
      const step = Math.abs(current!.z - previous.z);
      assert.ok(step <= 25 * 4 + 1e-9, `${path.id}: ${step} z-units in a 25-unit x step`);
      previous = current!;
    }
    // The value *at* a node is the node's own z — where the interpolation must land exactly.
    for (const nodeId of path.nodeIds) {
      const node = network.nodes.find((candidate) => candidate.id === nodeId)!;
      const sample = sampleLane(network, path.id, node.x);
      assert.ok(sample && Math.abs(sample.z - node.z) < 1e-9, `${path.id} at ${nodeId}`);
    }
  }
});

/* -----------------------------------------------------------------------------
   The corridor union
   -------------------------------------------------------------------------- */

test('corridor union', () => {
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { network } = result;

  // Four lanes of half-width 120, centred on the four lane centres: the union is the whole corridor,
  // which is what an un-authored course gives a racer anyway.
  assert.deepEqual(corridorAt(network, 9000), { zMin: LEGACY_CORRIDOR.zMin, zMax: LEGACY_CORRIDOR.zMax });
  // Past the merge there is one line, so the corridor is that line's own width.
  assert.deepEqual(corridorAt(network, 42000), laneZ(2) - DEFAULT_HALF_WIDTH === 0
    ? { zMin: -LANE_Z_LIMIT, zMax: LANE_Z_LIMIT }
    : { zMin: laneZ(2) - DEFAULT_HALF_WIDTH, zMax: laneZ(2) + DEFAULT_HALF_WIDTH });
  // Before the network starts, and after it ends, there is no corridor at all.
  assert.equal(corridorAt(network, START_X - 10), null);
  assert.equal(corridorAt(network, FINISH + 10), null);

  // The union is clipped to the track, whatever a path claims.
  const wide = withNodes(
    [{ id: 'a', x: START_X, z: 0, kind: 'normal' }, { id: 'b', x: FINISH, z: 0, kind: 'normal' }],
    [{ id: 'p', name: 'Wide', nodeIds: ['a', 'b'], halfWidth: DEFAULT_HALF_WIDTH }],
  );
  const clipped = validateLaneNetwork(wide);
  assert.equal(clipped.ok, true);
  if (clipped.ok) {
    const corridor = corridorAt(clipped.network, 20000)!;
    assert.ok(corridor.zMin >= -LANE_Z_LIMIT && corridor.zMax <= LANE_Z_LIMIT);
  }
});

/* -----------------------------------------------------------------------------
   AC-6: adjacency and successors
   -------------------------------------------------------------------------- */

test('adjacent/successor', () => {
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { network } = result;

  // Adjacency follows the lane convention: +1 is toward smaller z (lane 1 → lane 2 → lane 3).
  assert.equal(adjacentPath(network, 'ridge-lane-1', 9000, 1), 'ridge-lane-2');
  assert.equal(adjacentPath(network, 'ridge-lane-1', 9000, -1), 'ridge-lane-0');
  assert.equal(adjacentPath(network, 'ridge-lane-0', 9000, -1), null, 'nothing further out');
  assert.equal(adjacentPath(network, 'ridge-lane-3', 9000, 1), null);
  // Past the merge there is nothing to move to, however hard you steer.
  assert.equal(adjacentPath(network, 'ridge-spine', 42000, 1), null);
  assert.equal(adjacentPath(network, 'ridge-spine', 42000, -1), null);
  // A path that is not active at this x is not a neighbour.
  assert.equal(adjacentPath(network, 'ridge-lane-1', FINISH + 5, 1), null);
  // Which racer is where: the nearest centre, not the nearest lane number.
  assert.equal(nearestPath(network, 9000, laneZ(3)), 'ridge-lane-3');
  assert.equal(nearestPath(network, 9000, laneZ(0) + 500), 'ridge-lane-0');

  // Merges: whatever path you arrive on, the only way on is the spine.
  for (const lane of [0, 1, 2, 3]) {
    assert.equal(successorPath(network, `ridge-lane-${lane}`, laneZ(lane), 0), 'ridge-spine');
  }
  // Splits: bias picks a branch, and both branches are real (AC-6).
  assert.equal(successorPath(network, 'ridge-spine', laneZ(2), 1), 'ridge-main', '+1 is the smaller-z branch');
  assert.equal(successorPath(network, 'ridge-spine', laneZ(2), -1), 'ridge-spur');
  assert.equal(successorPath(network, 'ridge-spine', laneZ(2), 0), 'ridge-main', 'no bias: nearest centre');
  // An out-of-bounds path has no successor at all.
  assert.equal(successorPath(network, 'ridge-spur', laneZ(0), 0), null);
  // A path that ends at the flag simply ends.
  assert.equal(successorPath(network, 'ridge-main', laneZ(2), 0), null);
  assert.equal(successorPath(network, 'nope', 0, 0), null);
});

/* -----------------------------------------------------------------------------
   AC-1 / AC-5: the runtime integration
   -------------------------------------------------------------------------- */

test('a null network is the legacy lane target, exactly', () => {
  for (let lane = 0; lane < 4; lane++) {
    for (const x of [200, 5000, 30000, 70000]) {
      const resolved = resolveLaneTarget({ targetLane: lane, pathId: null, x }, null);
      assert.equal(resolved.targetZ, LANE.far - LANE_WIDTH * (lane + 0.5));
      assert.equal(resolved.zMin, LANE.near + RADIUS + 6);
      assert.equal(resolved.zMax, LANE.far - RADIUS - 6);
    }
  }
  // A racer with no path on a network is the legacy racer too.
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(resolveLaneTarget({ targetLane: 1, pathId: null, x: 9000 }, result.network),
      resolveLaneTarget({ targetLane: 1, pathId: null, x: 9000 }, null));
    // And a path that is not active at this x falls back the same way.
    assert.deepEqual(resolveLaneTarget({ targetLane: 1, pathId: 'ridge-lane-0', x: FINISH + 5 }, result.network),
      resolveLaneTarget({ targetLane: 1, pathId: null, x: FINISH + 5 }, null));
  }
});

test('a path owns the target and the corridor', () => {
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const network = result.network;
  // Lane 3's centre is -360, half-width 120: the corridor is its own lane's, not the track's.
  const onLane3 = resolveLaneTarget({ targetLane: 3, pathId: 'ridge-lane-3', x: 9000 }, network);
  assert.equal(onLane3.targetZ, laneZ(3));
  assert.equal(onLane3.zMin, LEGACY_CORRIDOR.zMin, 'the union of all four lanes is still the track');
  // Past the merge the corridor is the single line, so the ball cannot be clamped into a lane that
  // does not exist any more.
  const past = resolveLaneTarget({ targetLane: 3, pathId: 'ridge-spine', x: 42000 }, network);
  assert.equal(past.targetZ, laneZ(2));
  assert.equal(past.zMin, laneZ(2) - DEFAULT_HALF_WIDTH);
  assert.equal(past.zMax, laneZ(2) + DEFAULT_HALF_WIDTH);
  // A ball pushed outside its path's corridor is steered back to the centre, clamped inside it.
  const pushed = resolveLaneTarget({ targetLane: 3, pathId: 'ridge-spine', x: 42000 }, network);
  assert.ok(pushed.targetZ >= pushed.zMin && pushed.targetZ <= pushed.zMax);
});

test('oob crossing', () => {
  const result = validateLaneNetwork(sampleLaneNetwork('ridge'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const network = result.network;

  // The swept test: only the tick that passes the node, and only for a racer on that path.
  assert.equal(oobCrossed(network, 'ridge-spur', 67999, 68000), 'spur-end');
  assert.equal(oobCrossed(network, 'ridge-spur', 68000, 68010), null, 'never twice');
  assert.equal(oobCrossed(network, 'ridge-spur', 67990, 67999), null, 'not yet');
  assert.equal(oobCrossed(network, 'ridge-main', 67999, 68001), null, 'a different path is unaffected');
  assert.equal(oobCrossed(network, 'nope', 0, FINISH), null);

  // AC-5, through the real physics step: a scripted racer on the spur is recovered by the crew on
  // the exact tick it crosses the node, with the reason the policy is told about.
  // A bare course: the authored network is what is under test, not the dressing.
  const obstacles = createTrackLayout('ridge', { skipBeforeX: 0 });
  const world = createSimWorld('ridge', obstacles, createAirPickups('ridge', obstacles));
  const context: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    runTime: 0, wallTime: 0, laneNetwork: network,
  };
  const trace = createStepTrace();
  const racer = createRacers()[0];
  racer.pathId = 'ridge-spur';
  racer.x = 67900; racer.z = laneZ(0); racer.targetLane = 0; racer.lane = 0;
  racer.y = world.y(racer.x) - RADIUS; racer.grounded = true;
  racer.vx = 400; racer.vy = 0; racer.vz = 0;
  racer.loopRide = null; racer.falling = false; racer.finished = false;
  let crossingTick = -1;
  let recoveredAt = -1;
  for (let tick = 0; tick < 400; tick++) {
    const before = racer.x;
    resetTrace(trace);
    stepRacer(racer, context, FIXED_STEP, trace);
    if (trace.oobNode) crossingTick = tick;
    if (racer.recoveries > 0) { recoveredAt = tick; break; }
    assert.ok(racer.x >= before, `the racer keeps moving forward (tick ${tick})`);
  }
  assert.equal(trace.oobNode, 'spur-end');
  assert.ok(crossingTick >= 0, 'the node was crossed');
  assert.equal(recoveredAt, crossingTick, 'recovery happens on the crossing tick');
  assert.equal(trace.recoveryReason, 'oob');
  assert.ok(racer.x < 68000, 'and the ball is put back behind the node');
  assert.equal(racer.recoveries, 1, 'exactly one recovery per crossing');
});

test('createDefaultLaneNetwork builds a 4-lane network with ~10m (600 unit) node intervals all the way from START_X to FINISH', () => {
  const net = createDefaultLaneNetwork('ridge', 600);
  assert.equal(net.course, 'ridge');
  assert.equal(net.paths.length, 4, 'four standard paths');

  // Validate the whole network
  const validation = validateLaneNetwork(net);
  assert.equal(validation.ok, true, 'network passes validation');

  // Track is 72,000 units from START_X (190) to FINISH (72190)
  // With step 600, there are exactly 120 intervals -> 121 nodes per lane -> 484 total nodes
  assert.equal(net.nodes.length, 484, '121 nodes per lane * 4 lanes = 484 total nodes');

  for (let lane = 0; lane < 4; lane++) {
    const path = net.paths[lane];
    assert.equal(path.id, `default-lane-${lane + 1}`);
    assert.equal(path.name, `Lane ${lane + 1}`);
    assert.equal(path.nodeIds.length, 121);
    assert.equal(path.halfWidth, DEFAULT_HALF_WIDTH);

    const firstNode = net.nodes.find((n) => n.id === path.nodeIds[0])!;
    const lastNode = net.nodes.find((n) => n.id === path.nodeIds[path.nodeIds.length - 1])!;
    assert.equal(firstNode.x, START_X, 'starts at START_X');
    assert.equal(lastNode.x, FINISH, 'ends at FINISH');

    // Check spacing
    for (let i = 0; i < path.nodeIds.length - 1; i++) {
      const a = net.nodes.find((n) => n.id === path.nodeIds[i])!;
      const b = net.nodes.find((n) => n.id === path.nodeIds[i + 1])!;
      assert.equal(b.x - a.x, 600, 'nodes spaced by 600 units (~10m in world scale)');
      assert.equal(a.z, b.z, 'nodes stay centered in their authored lane');
      assert.equal(a.kind, 'normal');
    }
  }
});

// H2b: the baked lookup gives exactly the binary search's answer, and follows nodes edited in place.
function searchedSample(network: LaneNetwork, pathId: string, x: number): { z: number; halfWidth: number } | null {
  const path = network.paths.find((p) => p.id === pathId);
  if (!path) return null;
  const byId = new Map(network.nodes.map((n) => [n.id, n] as const));
  const nodes = path.nodeIds.map((id) => byId.get(id)!);
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (!first || x < first.x || x > last.x) return null;
  let lo = 0; let hi = nodes.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (nodes[mid].x <= x) lo = mid; else hi = mid; }
  const a = nodes[lo]; const b = nodes[Math.min(lo + 1, nodes.length - 1)];
  if (x >= a.x && x <= b.x) { const span = b.x - a.x; const t = span === 0 ? 0 : (x - a.x) / span; return { z: a.z + (b.z - a.z) * t, halfWidth: path.halfWidth }; }
  return { z: last.z, halfWidth: path.halfWidth };
}

test('H2b: baked lane lookup matches the binary search exactly, on every path', () => {
  for (const network of [createDefaultLaneNetwork('ridge'), createDefaultLaneNetwork('boomtown', 170), sampleLaneNetwork('ridge')]) {
    const xs = network.nodes.map((n) => n.x);
    const lo = Math.min(...xs) - 100; const hi = Math.max(...xs) + 100;
    for (const path of network.paths) {
      for (let x = lo; x <= hi; x += 23.7) {
        assert.deepEqual(sampleLane(network, path.id, x), searchedSample(network, path.id, x), `${path.id} at x ${x}`);
      }
      // Every node x and the bake boundaries either side of it.
      for (const id of path.nodeIds) {
        const nx = network.nodes.find((n) => n.id === id)!.x;
        for (const x of [nx - LANE_BAKE_STEP, nx - 1e-9, nx, nx + 1e-9, nx + LANE_BAKE_STEP]) {
          assert.deepEqual(sampleLane(network, path.id, x), searchedSample(network, path.id, x));
        }
      }
    }
  }
});

test('H2b: a node dragged in place is sampled live, past the baked boundaries', () => {
  const network = createDefaultLaneNetwork('ridge');
  const path = network.paths[0];
  sampleLane(network, path.id, 1000); // bake
  const node = network.nodes.find((n) => n.id === path.nodeIds[3])!;
  const prev = network.nodes.find((n) => n.id === path.nodeIds[2])!;
  const next = network.nodes.find((n) => n.id === path.nodeIds[4])!;
  for (const dx of [-0.6, -0.3, 0.3, 0.6]) {
    node.x = dx < 0 ? node.x + (node.x - prev.x) * dx : node.x + (next.x - node.x) * dx;
    node.z += 17;
    for (let x = prev.x; x <= next.x; x += 11.1) {
      assert.deepEqual(sampleLane(network, path.id, x), searchedSample(network, path.id, x), `dx ${dx} x ${x}`);
    }
    const corridor = corridorAt(network, node.x);
    assert.ok(corridor && corridor.zMax >= Math.min(LANE_Z_LIMIT, node.z + path.halfWidth) - 1e-9);
  }
});
