/**
 * Race pieces placed in build mode: 3D powerups are real pickups, 3D hazards are real obstacles, stunt
 * ramps ride as ramps, and the island races nothing it was not given.
 *
 *   node --import tsx --test tests/race-pieces.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { islandTrackSpace } from '../src/game/island-route/island-space';
import { worldFromCanonical, engineDistanceFromX } from '../src/game/track-space';
import { OBSTACLE_PIECES, POWERUP_PIECES, racePiecesFrom } from '../src/game/race-pieces';
import { courseY, obstacleBounds, obstacleZ } from '../src/game/scene';
import { KIT_MODELS } from '../src/game/models/kit-catalog';
import type { PlacedProp } from '../src/game/builder/prop-catalog';

const space = islandTrackSpace();
/** A prop standing on the island road at engine x, z across it, lifted by `up`. */
function onRoad(id: string, type: string, x: number, z: number, up = 0): PlacedProp {
  const w = worldFromCanonical(space, { s: space.trackDistFromEngineDistance(engineDistanceFromX(x)), laneZ: z, altitude: 0 }).world;
  return { id, type, x: w.x, y: w.y + up, z: w.z, rotY: 0, scale: 1 } as PlacedProp;
}

test('a placed powerup is a pickup of its kind, where it stands, floating over the road', () => {
  const { pickups, obstacles } = racePiecesFrom([onRoad('p1', 'kit_powerup-shield', 20000, 120)], space, 'basalt');
  assert.equal(obstacles.length, 0);
  assert.equal(pickups.length, 1);
  const [p] = pickups;
  assert.equal(p.kind, 'shield');
  assert.equal(p.propId, 'p1');
  assert.ok(Math.abs(p.x - 20000) < 30, `x ${p.x}`);
  assert.ok(Math.abs(p.z - 120) < 10, `z ${p.z}`);
  assert.ok(p.y < courseY(p.x, 'basalt') - 60, 'above the road (engine y grows downward)');
});

test('placed hazards are obstacles at their exact spot, one lane wide', () => {
  const props = [onRoad('b', 'kit_boost-pad', 30000, -200), onRoad('t', 'kit_tnt-crate', 25000, 0), onRoad('s', 'kit_sheep', 40000, 250)];
  const { obstacles } = racePiecesFrom(props, space, 'basalt');
  assert.deepEqual(obstacles.map((o) => o.kind), ['tnt', 'boost', 'sheep'], 'in race order');
  const boost = obstacles.find((o) => o.kind === 'boost')!;
  assert.ok(Math.abs(boost.x + boost.width / 2 - 30000) < 30, 'centred where it stands');
  assert.ok(Math.abs(obstacleZ(boost) + 200) < 10, 'hit where it stands across the road');
  const band = obstacleBounds(boost);
  assert.ok(band.near < -200 && band.far > -200 && band.far - band.near === 240);
  assert.equal(boost.propId, 'b');
});

test('hidden pieces and ordinary props are not raced', () => {
  const hidden = { ...onRoad('h', 'kit_powerup-fuel', 20000, 0), visible: false };
  const palm = onRoad('palm', 'kit_palm-tall', 20000, 0);
  const { pickups, obstacles } = racePiecesFrom([hidden, palm], space, 'basalt');
  assert.equal(pickups.length + obstacles.length, 0);
});

test('every race piece has a model on the shelf', () => {
  const ids = new Set(KIT_MODELS.map((m) => `kit_${m.id}`));
  for (const type of [...Object.keys(POWERUP_PIECES), ...Object.keys(OBSTACLE_PIECES)]) {
    assert.ok(ids.has(type), `${type} is placeable`);
  }
});

test('the island races only placed pieces: no generated 2D obstacles or pickups', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /if \(this\.options\.course === 'basalt'\) \{ this\.makeIslandTrack\(\); return; \}/);
  assert.match(engine, /this\.pickups = pieces\.pickups;/);
});
