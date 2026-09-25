/**
 * Balls are drawn (and touch each other) at twice the road-physics radius, sit on the road rather
 * than floating, and use a flat diffuse material with no specular shine.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BALL_DRAW_RADIUS, RADIUS, courseY, laneZ } from '../src/game/scene';
import { getTrackSpace, placementFromEngine } from '../src/game/track-space';

test('the drawn ball is twice the physics radius', () => {
  assert.equal(RADIUS, 31, 'road, gap and loop physics keep their radius');
  assert.equal(BALL_DRAW_RADIUS, 62);
});

test('a grounded ball drawn at BALL_DRAW_RADIUS rests on the road (no float)', () => {
  const map = getTrackSpace();
  for (const x of [190, 430, 2000, 9000, 30000]) {
    const y = courseY(x, 'ridge') - RADIUS; // how the engine holds a grounded ball
    const p = placementFromEngine(map, { x, y, z: laneZ(1), grounded: true, course: 'ridge' });
    const f = p.frame;
    const surface = map.frameAt(p.state.s).pos;
    // Height of the centre above the ribbon, along the ribbon's up.
    const lift = (p.world.x - surface.x) * f.up.x + (p.world.y - surface.y) * f.up.y + (p.world.z - surface.z) * f.up.z;
    assert.ok(Math.abs(lift - BALL_DRAW_RADIUS) < 1.5, `x ${x}: centre ${lift.toFixed(1)} above the road, radius ${BALL_DRAW_RADIUS}`);
  }
});

test('ball-to-ball contact uses the drawn size', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /const diameter = BALL_DRAW_RADIUS \* 2 \+ 4;/);
});

test('the ball and its caps are flat-lit: no MeshStandard/Physical, no specular', () => {
  const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  const build = renderer.slice(renderer.indexOf('private coreBatch('), renderer.indexOf('private releaseRacerMesh('));
  assert.match(build, /new THREE\.MeshLambertMaterial\(/);
  assert.doesNotMatch(build, /MeshStandardMaterial|MeshPhysicalMaterial|MeshPhongMaterial|metalness|envMap/);
  assert.match(renderer, /capMat = new THREE\.MeshLambertMaterial\(/);
  assert.match(renderer, /sphereGeo: new THREE\.SphereGeometry\(BALL_DRAW_RADIUS,/);
});

test('a supply that touches the drawn ball is collected; pickup reach uses the drawn size', async () => {
  const { pickupIntercept, PICKUP_RADIUS } = await import('../src/game/powerups');
  const pickup = { x: 1000, z: 0 } as never;
  // Ball centre (physics) grounded at y = 0; the drawn centre is one RADIUS higher (y − RADIUS).
  const drawnCentreY = -RADIUS;
  const side = BALL_DRAW_RADIUS + PICKUP_RADIUS - 2; // just inside the drawn ball's reach, sideways
  assert.equal(pickupIntercept({ x: 1000, y: 0, z: side }, { x: 1000, y: 0, z: side }, pickup, drawnCentreY), 0, 'touching the drawn ball = collected');
  const outside = BALL_DRAW_RADIUS + PICKUP_RADIUS + 2;
  assert.equal(pickupIntercept({ x: 1000, y: 0, z: outside }, { x: 1000, y: 0, z: outside }, pickup, drawnCentreY), null, 'clear of it = not collected');
});
