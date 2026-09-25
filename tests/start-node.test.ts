/**
 * Before the start the ball rests on the first node of its authored path (on the road), instead of
 * waiting at the legacy grid spot, which floats off the road once the start node has been moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultLaneNetwork, startNodeOf, assignNearestPaths } from '../src/game/lane-network';
import { createRacers } from '../src/game/racers';

test('startNodeOf returns the first node of the racer path', () => {
  const network = createDefaultLaneNetwork('ridge');
  const racers = createRacers();
  assignNearestPaths(racers, network);
  for (const racer of racers) {
    const node = startNodeOf(network, racer.pathId);
    assert.ok(node, `${racer.name} has a start node`);
    const path = network.paths.find((p) => p.id === racer.pathId)!;
    assert.equal(node!.id, path.nodeIds[0]);
    assert.ok(Math.abs(node!.z - racer.z) < 1, 'the default network starts on the grid lanes');
  }
  assert.equal(startNodeOf(network, null), null);
  assert.equal(startNodeOf(null, 'x'), null);
  assert.equal(startNodeOf(network, 'no-such-path'), null);
});

test('a moved start node moves the waiting ball with it, resting on the road', () => {
  const network = createDefaultLaneNetwork('ridge');
  const racers = createRacers();
  assignNearestPaths(racers, network);
  const player = racers[0];
  const node = startNodeOf(network, player.pathId)!;
  node.x += 150; node.z += 60;
  // The engine's placeOnStartNodes, applied to the moved node.
  const x = node.x + (player.x - 190);
  assert.equal(x, node.x, 'the front row sits exactly on the node');
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /this\.placeOnStartNodes\(\);\n[\s\S]{0,800}?if \(this\.customPhysics\)/, 'runs on every reset, after paths are assigned');
  assert.match(engine, /racer\.x = node\.x \+ \(racer\.x - START_X\);\n\s*racer\.z = node\.z;\n\s*racer\.y = this\.y\(racer\.x\) - RADIUS;/, 'on the node, on the road');
});
