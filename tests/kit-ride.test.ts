/**
 * Rideable Meshy models: a placed deck's drive surface becomes a heightfield patch in engine space,
 * and the physics rides on it where it stands (and nowhere else).
 *
 *   node --import tsx --test tests/kit-ride.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { islandTrackSpace } from '../src/game/island-route/island-space';
import { engineDistanceFromX, worldFromCanonical } from '../src/game/track-space';
import { compilePatch } from '../src/game/collision/terrain-patch';
import { DECK_STEP_UP, createSimWorld } from '../src/game/sim/world';
import { createRacers, type Racer } from '../src/game/racers';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { RADIUS, courseY } from '../src/game/scene';
import { RIDEABLE_KIT, isRideableType, placementMatrix, rideMeshInEngineSpace } from '../src/game/models/kit-collision';
import { KIT_MODELS } from '../src/game/models/kit-catalog';

const space = islandTrackSpace();
const roadAt = (x: number, z = 0) => worldFromCanonical(space, { s: space.trackDistFromEngineDistance(engineDistanceFromX(x)), laneZ: z, altitude: 0 });

/** A flat square deck, `size` world units across, as a drive surface (centred on its origin). */
function deck(size: number): THREE.Object3D {
  const geo = new THREE.PlaneGeometry(size, size, 8, 8);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo);
}

/** A deck placed on the island road at engine x, lifted `lift` above it and turned to face down it. */
function placedDeck(x: number, lift: number) {
  const at = roadAt(x);
  const ahead = roadAt(x + 60).world;
  const rotY = Math.atan2(ahead.x - at.world.x, ahead.z - at.world.z);
  const placement = placementMatrix({ x: at.world.x, y: at.world.y + lift, z: at.world.z, rotY, scale: 1 });
  return rideMeshInEngineSpace(deck(700), new THREE.Matrix4(), placement, space, 'deck');
}

test('the rideable models are the ones with a drive surface, and all are on the shelves', () => {
  const ids = new Set(KIT_MODELS.map((m) => m.id));
  for (const id of RIDEABLE_KIT) assert.ok(ids.has(id), `${id} is placeable`);
  assert.ok(isRideableType('kit_stunt-launch-ramp'));
  assert.equal(isRideableType('kit_palm-tall'), false);
});

test('a placed deck turns into engine space where it stands, at its height above the road', () => {
  const mesh = placedDeck(30000, 200)!;
  assert.ok(mesh, 'the deck is over the road');
  let minX = Infinity, maxX = -Infinity, minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    minX = Math.min(minX, mesh.positions[i]); maxX = Math.max(maxX, mesh.positions[i]);
    minH = Math.min(minH, mesh.positions[i + 1]); maxH = Math.max(maxH, mesh.positions[i + 1]);
  }
  assert.ok(minX < 30000 && maxX > 30000, `spans x 30000 (${Math.round(minX)}..${Math.round(maxX)})`);
  // The island road slopes: a flat deck lifted 200 sits higher above the road downhill than uphill.
  assert.ok(minH > 40 && maxH < 400 && minH < 200 && maxH > 200, `around 200 above the sloping road (${Math.round(minH)}..${Math.round(maxH)})`);
});

test('the physics rides the deck where it stands, and the road everywhere else', () => {
  const patch = compilePatch(placedDeck(30000, 200)!, { fillHoles: true });
  const world = createSimWorld('basalt', [], [], [patch]);
  const road = courseY(30000, 'basalt');
  const onDeck = world.surfaceAt(30000, 0);
  assert.ok(road - onDeck.y > 120 && road - onDeck.y < 320, `raised by the deck (${Math.round(road - onDeck.y)})`);
  assert.equal(world.surfaceAt(20000, 0).y, courseY(20000, 'basalt'), 'the plain road away from it');
  const bare = createSimWorld('basalt', [], []);
  assert.equal(bare.surfaceAt(30000, 0).y, road, 'no patches: the road exactly as before');
  bare.configure('basalt', [], [], [patch]);
  assert.equal(bare.surfaceAt(30000, 0).y, onDeck.y, 'configure hands the patches over');
});

test('a deck overhead is not ground: from the road the ball rolls on underneath; at its level it rides it', () => {
  const patch = compilePatch(placedDeck(30000, 200)!, { fillHoles: true });
  const world = createSimWorld('basalt', [], [], [patch]);
  const road = courseY(30000, 'basalt');
  const fromRoad = world.surfaceAt(30000, 0, road);
  assert.equal(fromRoad.y, road, 'a ball on the road meets the road, not the deck above it');
  assert.equal(fromRoad.deck, undefined);
  const deckY = world.surfaceAt(30000, 0).y;
  const onDeck = world.surfaceAt(30000, 0, deckY + 5);
  assert.equal(onDeck.y, deckY, 'a ball at deck level rides the deck');
  assert.equal(onDeck.deck, true);
  assert.equal(world.surfaceAt(30000, 0, deckY + DECK_STEP_UP - 1).deck, true, 'a small step up is taken');
  assert.equal(world.surfaceAt(30000, 0, deckY + DECK_STEP_UP + 20).deck, undefined, 'a sheer face is not');
});

test('a ball rolling off the end of a deck falls instead of snapping down to the road', () => {
  const patch = compilePatch(placedDeck(30000, 200)!, { fillHoles: true });
  const world = createSimWorld('basalt', [], [], [patch]);
  // Find the deck's far edge along the middle of the road, then start just before it, on the deck.
  let edge = 30000;
  while (world.surfaceAt(edge + 10, 0).deck) edge += 10;
  const startX = edge - 30;
  const deckY = world.surfaceAt(startX, 0).y;
  const lane = 1;
  const racer: Racer = { ...createRacers()[0], lane, targetLane: lane, z: 0, x: startX, y: deckY - RADIUS, vx: 900, vy: 0, grounded: true };
  let t = 0;
  const ctx: RacerStepContext = { world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5, get runTime() { return t; }, get wallTime() { return t; } };
  for (let i = 0; i < 12; i++) { t += FIXED_STEP; stepRacer(racer, ctx, FIXED_STEP); }
  assert.ok(racer.x > edge, 'past the edge');
  assert.equal(racer.grounded, false, 'airborne off the deck');
  assert.ok(racer.y + RADIUS < courseY(racer.x, 'basalt') - 60, 'still well above the road, falling, not teleported onto it');
});
