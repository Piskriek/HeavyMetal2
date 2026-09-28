/**
 * Placed models collide by their role: drivable models are ridden and their backs and sides are solid,
 * solid models (rocks, walls) bounce the ball, decoration does nothing. A ball riding a model's drive
 * surface is never blocked by it; a thin lip is rolled past; a deck high overhead is rolled under.
 * Also: the island sea is round and its waves run round the island.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collisionRoleOf } from '../src/game/models/kit-collision';
import { createSimWorld } from '../src/game/sim/world';
import { resolveSolids } from '../src/game/sim/racer-physics';
import { courseY, RADIUS } from '../src/game/scene';
import type { Patch } from '../src/game/collision/terrain-patch';

test('default roles: drive-surface models ride, rocks and walls are solid, the rest is decoration; the tab overrides', () => {
  assert.equal(collisionRoleOf({ type: 'kit_stunt-launch-ramp' }), 'terrain');
  assert.equal(collisionRoleOf({ type: 'kit_rock-boulder-rough' }), 'barrier');
  assert.equal(collisionRoleOf({ type: 'kit_stone-wall' }), 'barrier');
  assert.equal(collisionRoleOf({ type: 'kit_basalt-cave' }), 'decoration', 'you drive through a cave');
  assert.equal(collisionRoleOf({ type: 'kit_palm-tall' }), 'decoration');
  assert.equal(collisionRoleOf({ type: 'kit_palm-tall', roleConfig: { role: 'barrier' } }), 'barrier');
  assert.equal(collisionRoleOf({ type: 'kit_stunt-launch-ramp', roleConfig: { role: 'decoration' } }), 'decoration');
});

/** A block 100 along x (from x 5000), 96 across z, standing `top` above the road, from `bottom`. */
function block(top: number, bottom: number, drive = false): Patch {
  const nx = 5, nz = 4, n = nx * nz;
  const f = (v: number) => new Float32Array(n).fill(v);
  return {
    x0: 5000, z0: -48, nx, nz, cellX: 20, cellZ: 24,
    heights: drive ? f(top) : f(NaN), slopeX: f(0), slopeZ: f(0), flags: new Uint8Array(n), hash: '',
    stats: { covered: 0, walls: 0, overhangs: 0, filled: 0, outside: 0, ledges: 0, trisUsed: 0, trisDropped: 0, ms: 0 },
    solid: { x0: 5000, z0: -48, nx, nz, cellX: 20, cellZ: 24, top: f(top), bottom: f(bottom), restitution: 0.5 },
  };
}

test('the world: tall is solid, a thin lip is not, high overhead is not, and riding the model is never blocked', () => {
  const onRoad = courseY(5050, 'basalt') - RADIUS;
  const at = (p: Patch, y = onRoad, from?: [number, number]) => createSimWorld('basalt', [], [], [p]).solidAt(5050, 0, y, 0, from?.[0], from?.[1]);
  assert.equal(at(block(200, 0)), 0.5, 'a rock 200 tall stops a ball on the road');
  assert.equal(at(block(30, 0)), 0, 'a 30 lip is rolled past');
  assert.equal(at(block(900, 600)), 0, 'a deck 600 up is rolled under');
  assert.equal(at(block(200, 0, true), onRoad, [5020, 0]), 0, 'a ball already on the drive surface rides it');
  assert.equal(at(block(200, 0, true), onRoad, [4900, 0]), 0.5, 'arriving from the road into its tall back: solid');
});

test('the ball: stopped and bounced along the axis that took it in', () => {
  const world = createSimWorld('basalt', [], [], [block(200, 0)]);
  const racer = { x: 5010, z: 0, y: courseY(5010, 'basalt') - RADIUS, vx: 600, vz: 0, loopRide: null, falling: false, mergeHeld: false } as never as Parameters<typeof resolveSolids>[0];
  resolveSolids(racer, world, 4990, 0);
  assert.equal(racer.x, 4990, 'put back where it was');
  assert.ok(racer.vx < 0 && Math.abs(racer.vx + 300) < 1e-9, 'bounced with the block\'s restitution');
  const clear = { ...racer, x: 4700, vx: 600 } as typeof racer;
  resolveSolids(clear, world, 4690, 0);
  assert.equal(clear.x, 4700, 'nothing there: untouched');
});

test('the sea: a disc following the camera, waves in rings round the shore, foam, and a horizon haze', () => {
  const sea = readFileSync(new URL('../src/game/island-route/island-sea.ts', import.meta.url), 'utf8');
  assert.match(sea, /new THREE\.CircleGeometry\(SEA_RADIUS/);
  // The Sky window sets the pace (seaSpeed, 1 by default) and the pattern's size (seaTile, 3000 by default).
  assert.match(sea, /float v = \(rn \+ seaTime \* 160\.0 \* seaSpeed\) \/ seaTile;/, 'rings close in on the island over time');
  assert.match(sea, /const tile = \{ value: 3000 \};/, 'the default pattern size is unchanged');
  assert.match(sea, /name = 'Shore foam'/);
  assert.match(sea, /float haze = max\(1\.0 - smoothstep\(0\.0, 0\.07, -viewDir\.y\), edge\);/, 'the sea fades into the fog colour near the horizon line and near its own far edge (seen from high up)');
  const world = readFileSync(new URL('../src/game/island-route/island-world.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(world, /PlaneGeometry\(2 \* SEA_HALF/, 'no square sea');
});

test('the island skies: six CC0 panoramas in the Sky menu, mapped as 360° panoramas; the island opens under one', async () => {
  const { existsSync } = await import('node:fs');
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  for (const file of ['azure-isles', 'cloud-sea', 'deep-blue', 'lilac-daydream', 'violet-twilight', 'stormpeak-puffs']) {
    assert.match(r, new RegExp(`url: '/art/skies/sky-${file}\.jpg'`));
    assert.ok(existsSync(new URL(`../public/art/skies/sky-${file}.jpg`, import.meta.url)), `${file} is in the game`);
  }
  assert.ok(existsSync(new URL('../public/art/skies/LICENSE-skies.txt', import.meta.url)), 'the licence travels with them');
  assert.match(r, /float uvY = isPanorama > 0\.5 \? vUv\.y :/, 'a panorama maps straight');
  assert.match(r, /const fallbackSky = SKY_PRESETS\[initialSky\] \? initialSky : 'azure_isles';/);
  assert.doesNotMatch(r, /sky_copperwood|Golden Hour/, 'the old skies are gone from the menu');
  assert.match(r, /gl_FragColor = vec4\(color, 1\.0\);[^`]*#include <colorspace_fragment>/, 'the sky is in the screen colour space, so its horizon matches the sea haze (no hard line)');
  assert.match(r, /export function preloadSkies\(\)/, 'build mode preloads every sky, so a swap is instant');
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.match(ui, /\{showSkyMenu && \(\s*<div className="builder-dropdown-menu/, 'the Sky menu survives the click-outside listener, so a pick lands');
});
