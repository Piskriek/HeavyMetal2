/**
 * C1 (interim): every gameplay obstacle the physics can hit has a marker in the 3D scene, at the
 * physics' own lane and distance; TNT and sheep markers vanish when hit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ObstacleView } from '../src/game/obstacle-view';
import { createTrackLayout } from '../src/game/track-layout';
import { withoutLoopRides } from '../src/game/sim/decor-loops';
import { passageMouthX } from '../src/game/qualifying/passage';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { getTrackSpace, worldFromCanonical, engineDistanceFromX } from '../src/game/track-space';
import { RADIUS, obstacleZ } from '../src/game/scene';

function raceLayout() {
  const built = createTrackLayout('ridge');
  return withoutLoopRides(createTrackLayout('ridge', { skipBeforeX: passageMouthX(), keepLoopsFromX: createQualifyingGate('ridge', built).x }));
}

test('every hittable obstacle gets a marker; only scenery kinds are skipped', () => {
  const layout = raceLayout();
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace()); // no art: billboards fall back to blocks
  view.update(layout);
  const hittable = layout.filter((o) => ['gap', 'boost', 'ramp', 'sheep', 'tnt', 'spring', 'pinball_spinner', 'rock_gate', 'water_rock', 'cauldron', 'roller_rails'].includes(o.kind));
  assert.equal(view.stats.drawn, hittable.length, `${view.stats.drawn} markers for ${hittable.length} hittable obstacles`);
  assert.ok(view.stats.drawn >= 130, `${view.stats.drawn} markers`);
  const again = view.root.children.length;
  view.update(layout); // same layout: no rebuild
  assert.equal(view.root.children.length, again);
});

test('a gap marker lies on the road in the gap lane, over the gap', () => {
  const layout = raceLayout();
  const gap = layout.find((o) => o.kind === 'gap')!;
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  view.update([gap]);
  const mesh = view.root.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const centre = new THREE.Vector3(); mesh.geometry.boundingBox!.getCenter(centre);
  const map = getTrackSpace();
  const s = map.trackDistFromEngineDistance(engineDistanceFromX(gap.x + gap.width / 2));
  const expect = worldFromCanonical(map, { s, laneZ: obstacleZ(gap), altitude: -RADIUS });
  const d = Math.hypot(centre.x - expect.world.x, centre.y - expect.world.y, centre.z - expect.world.z);
  assert.ok(d < 40, `gap marker ${d.toFixed(1)} units from the physics gap`);
});

test('TNT and sheep markers disappear once hit; the renderer draws the layer every frame', () => {
  const layout = raceLayout();
  const tnt = { ...layout.find((o) => o.kind === 'tnt')! };
  const scene = new THREE.Scene();
  const view = new ObstacleView(scene, {}, getTrackSpace());
  const list = [tnt];
  view.update(list);
  assert.equal(view.root.children[0].visible, true);
  tnt.hit = true; view.update(list);
  assert.equal(view.root.children[0].visible, false);
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(r, /this\.obstacleView\.update\(frame\.obstacles\);/);
});
