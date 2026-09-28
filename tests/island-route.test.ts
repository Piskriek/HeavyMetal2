/**
 * ISLAND-ROUTE: the island course on the owner's Serpentine Isle model.
 *
 *   node --import tsx --test tests/island-route.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TRACK_DISTANCE, courseY } from '../src/game/scene';
import { COURSES } from '../src/game/types';
import { TRACKS } from '../src/game/courses';
import { D_START, engineDistanceFromX, getTrackSpace, lateralFromLaneZ, worldFromCanonical, type TrackSpaceMap } from '../src/game/track-space';
import { validateLaneNetwork } from '../src/game/lane-network';
import { loadLaneNetwork, readLaneStorage, writeLaneStorage, buildLaneDocument } from '../src/game/lane-storage';
import { ISLAND_HALF_WIDTH, ISLAND_ROUTE_GRAPH } from '../src/game/island-route/serpentine-route';
import { courseTrackSpace, islandTrackSpace, racerTrackSpace } from '../src/game/island-route/island-space';
import { ISLAND_LANE_Z, islandLaneNetwork } from '../src/game/island-route/island-lanes';
import { islandHeightField, prepareIslandModel, softenNormals } from '../src/game/island-route/island-world';
import { GROUND_FRAGMENT_BODY, PAINT_HALF, PAINT_RES, injectIslandGround, migrateDirtCoverage, normalizeIslandGround, paintDab, paintPixel } from '../src/game/island-route/island-ground';
import { composeTexel, packTexel, projectRoadMask } from '../src/game/island-route/island-road-paint';
import { SurfaceMask } from '../src/game/surface/surface-mask';
import { RoadMask } from '../src/game/surface/road-mask';
import { AutoPaint, flatPaintField } from '../src/game/surface/auto-paint';
import { SURFACE_ASPHALT, SURFACE_CRACKED, SURFACE_GRAVEL } from '../src/game/surface/surface-table';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/renderer-3d';

const model = new OBJLoader().parse(readFileSync(new URL('../public/models/island/serpentine-isle.obj', import.meta.url), 'utf8'));
prepareIslandModel(model);
model.updateMatrixWorld(true);
const ground = islandHeightField(model);
const ray = new THREE.Raycaster();
/** The model's surface under (x, z) by a ray cast straight down (the truth the height map must match). */
const surface = (x: number, z: number): number | null => {
  ray.set(new THREE.Vector3(x, 40000, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(model, true)[0]?.point.y ?? null;
};

function mockStorage() {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as unknown as Storage;
  return { data, store };
}

test('the classic courses keep their exact engine-to-arc mapping (no knots, one linear segment)', () => {
  const map = getTrackSpace();
  assert.equal(map.D_START, D_START);
  for (const d of [0, 1234.5, 9000, 18000, 27777, TRACK_DISTANCE]) {
    assert.equal(map.trackDistFromEngineDistance(d), D_START + (map.D_END - D_START) * (d / TRACK_DISTANCE));
    assert.equal(map.arcPerEngineDistanceAt(d), map.ARC_PER_ENGINE_DISTANCE);
  }
  assert.equal(courseTrackSpace('ridge'), map);
  assert.equal(racerTrackSpace('sheep', 30000, undefined), map);
});

test('the island route runs the start line to the finish line down the groove, at the classic pace', () => {
  const map = islandTrackSpace();
  assert.equal(map.trackDistFromEngineDistance(0), map.distOf('start'));
  assert.equal(map.trackDistFromEngineDistance(TRACK_DISTANCE), map.distOf('finish'));
  assert.ok(map.distOf('start') > 1000, 'road behind the start line for the chase camera');
  assert.ok(map.distOf('end') > map.distOf('finish'), 'a run-out past the finish');
  // Close to the classic course's 4.37 arc units per unit of race distance, so racers look as fast.
  assert.ok(map.ARC_PER_ENGINE_DISTANCE > 3.8 && map.ARC_PER_ENGINE_DISTANCE < 4.8, `${map.ARC_PER_ENGINE_DISTANCE}`);
  assert.ok(map.frameAt(map.distOf('start')).pos.y > map.frameAt(map.distOf('finish')).pos.y + 10000, 'downhill, summit to sea');
  assert.equal(ISLAND_ROUTE_GRAPH.sections.length, 0, 'no forks until the owner builds them');
});

test('the island track is one width and never banks (the groove floor is level across)', () => {
  const map = islandTrackSpace();
  for (let s = 0; s < map.length; s += 2000) {
    const f = map.frameAt(s);
    assert.equal(f.halfWidth, ISLAND_HALF_WIDTH);
    assert.ok(Math.abs(f.right.y) < 0.002, `level across at ${Math.round(s)}: right.y ${f.right.y.toFixed(3)}`);
  }
});

test('the height map is the model: balls placed on it rest on its surface, never inside it', () => {
  // Where the balls roll (every lane of the route) it matches the model closely.
  const map = islandTrackSpace();
  for (let s = map.distOf('start'); s <= map.distOf('finish'); s += 500) {
    const f = map.frameAt(s);
    for (const z of [-443, 0, 443]) {
      const lateral = lateralFromLaneZ(map, s, z);
      const x = f.pos.x + f.right.x * lateral, zz = f.pos.z + f.right.z * lateral;
      const h = ground.heightAt(x, zz);
      const truth = surface(x, zz)!;
      // Exactly the model: a ball never sinks into it or hovers over it.
      assert.ok(h !== null && Math.abs(h - truth) < 1, `lane ${z} at ${Math.round(s)}: map ${h} vs model ${Math.round(truth)}`);
    }
  }
  // Across the whole island too.
  const gaps: number[] = [];
  for (let x = -44000; x <= 44000; x += 2750) {
    for (let z = -46000; z <= 44000; z += 2750) {
      const truth = surface(x, z);
      if (truth === null) continue;
      const h = ground.heightAt(x, z);
      assert.ok(h !== null, `height map covers (${x}, ${z})`);
      gaps.push(Math.abs(h - truth));
    }
  }
  gaps.sort((a, b) => a - b);
  assert.ok(gaps.length > 500, `${gaps.length} points on the island`);
  assert.ok(gaps[gaps.length - 1] < 1, `every point within 1 (${gaps[gaps.length - 1]})`);
});

test('the track follows the groove: its centre lies on the groove floor and every lane stays in the groove', () => {
  const map = islandTrackSpace();
  const off: string[] = [];
  const centre: number[] = [];
  for (let s = map.distOf('start'); s <= map.distOf('finish'); s += 250) {
    const f = map.frameAt(s);
    for (const z of [-443, -290, 0, 290, 443]) {
      const lateral = lateralFromLaneZ(map, s, z);
      const x = f.pos.x + f.right.x * lateral, zz = f.pos.z + f.right.z * lateral;
      const truth = surface(x, zz);
      assert.ok(truth !== null, `lane ${z} at ${Math.round(s)} is over the island`);
      const rise = truth - (f.pos.y + f.right.y * lateral);
      if (z === 0) centre.push(Math.abs(rise));
      // A lane further than a groove wall's height from the track would be up on the land beside it.
      if (Math.abs(rise) > 600) off.push(`lane ${z} at ${Math.round(s)}: ${Math.round(rise)}`);
    }
  }
  centre.sort((a, b) => a - b);
  const p90 = centre[Math.floor(centre.length * 0.9)];
  assert.ok(p90 < 60, `90% of the centre line within 60 of the floor (${Math.round(p90)})`);
  assert.deepEqual(off, []);
});

test('the island starts with three valid lanes down the middle of the groove', () => {
  const network = islandLaneNetwork();
  assert.equal(validateLaneNetwork(network).ok, true);
  assert.equal(network.course, 'basalt');
  assert.deepEqual(network.paths.map((p) => p.name), ['Left groove', 'Centre groove', 'Right groove']);
  for (const z of ISLAND_LANE_Z) assert.ok(Math.abs(z) <= 320, 'on the groove floor');
  const { store } = mockStorage();
  assert.deepEqual(loadLaneNetwork('basalt', store), network, 'used when nothing is saved for the island');
  assert.equal(loadLaneNetwork('ridge', store), null, 'the classic courses keep their legacy lanes');
});

test('saving a course\'s lanes keeps every other course\'s saved lanes', () => {
  const { store } = mockStorage();
  (globalThis as any).localStorage = store;
  const ridge = { ...islandLaneNetwork(), course: 'ridge' as const };
  assert.equal(writeLaneStorage(store, buildLaneDocument({ ridge })).ok, true);
  const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
  const builder = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'none');
  builder.setCourse('basalt');
  builder.setLaneNetwork(islandLaneNetwork());
  assert.equal(builder.saveLaneDoc(store).ok, true);
  const saved = readLaneStorage(store)?.networks;
  assert.ok(saved?.ridge, 'the ridge lanes survive');
  assert.ok(saved?.basalt, 'the island lanes are saved');
});

test('Serpentine Isle is the fourth course and rides Rustbucket Ridge\'s physics profile', () => {
  assert.deepEqual(COURSES.map((c) => c.id), ['ridge', 'boomtown', 'sheep', 'basalt']);
  assert.equal(COURSES[3].name, 'Serpentine Isle');
  assert.equal(TRACKS.basalt.profile, TRACKS.ridge.profile);
  for (const x of [190, 5000, 8304, 30000, 60000, 72190]) assert.equal(courseY(x, 'basalt'), courseY(x, 'ridge'));
});

test('the terrain has soft normals everywhere: one normal per position, even across texture seams', () => {
  // Two triangles meeting at a crease, their shared edge duplicated as it is at a texture seam.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, -1, 1, 0, 0, 0, 0, 0, 1, 1, 1], 3));
  softenNormals(geo);
  const n = geo.getAttribute('normal');
  const at = (i: number) => [n.getX(i), n.getY(i), n.getZ(i)].map((v) => +v.toFixed(6));
  assert.deepEqual(at(0), at(4), 'the shared corner (0,0,0) has one normal');
  assert.deepEqual(at(1), at(3), 'the shared corner (1,0,0) has one normal');
  // The island model itself: every copy of a position carries the same normal.
  const seen = new Map<string, string>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position'); const nor = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 7) {
      const key = `${pos.getX(i).toFixed(6)},${pos.getY(i).toFixed(6)},${pos.getZ(i).toFixed(6)}`;
      const normal = `${nor.getX(i).toFixed(4)},${nor.getY(i).toFixed(4)},${nor.getZ(i).toFixed(4)}`;
      if (seen.has(key)) assert.equal(seen.get(key), normal, `a hard edge at ${key}`);
      else seen.set(key, normal);
    }
  });
});

test('the ground shader finds its places in this three.js version\'s standard shader', () => {
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  injectIslandGround(shader, { paintMask: { value: null } });
  assert.match(shader.vertexShader, /vGroundWorld = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz;/);
  assert.match(shader.fragmentShader, /void gDetail\(/);
  // The pebble and crack pattern is a baked tile: the ground's own code searches no cells per pixel (the
  // surface gather's fixed loops over four mask texels live in the shared island surface GLSL).
  assert.doesNotMatch(GROUND_FRAGMENT_BODY, /for \(int/,'no per-pixel cell searches: the pattern is a baked tile');
  assert.ok(shader.fragmentShader.indexOf('#include <map_fragment>') < shader.fragmentShader.indexOf('diffuseColor.rgb *= groundTint * groundBright;'),
    'the ground works on the base colour after the base map is applied');
  assert.doesNotMatch(shader.fragmentShader, /detailMap/, 'no tiling detail texture: the grain is computed from the world position');
  assert.ok('paintMask' in shader.uniforms);
});

test('ground settings are clamped; the brush paints a layered surface softly and erases it', () => {
  const s = normalizeIslandGround({ brightness: 9, grain: -1, tint: 'red', sandPits: 0.7 });
  assert.equal(s.brightness, 2); assert.equal(s.grain, 0); assert.equal(s.tint, '#ffffff'); assert.equal(s.sandPits, 0.7);
  const mask = new SurfaceMask(PAINT_RES, PAINT_RES);
  const share = (x: number, y: number, id: number) => {
    const t = mask.get(x, y);
    return t.id0 === t.id1 ? (t.id0 === id ? 255 : 0) : (t.id0 === id ? 255 - t.weight : 0) + (t.id1 === id ? t.weight : 0);
  };
  assert.ok(paintDab(mask, 1000, -2000, 400, 1, SURFACE_ASPHALT, false));
  const { u, v } = paintPixel(1000, -2000);
  const cx = Math.floor(u), cy = Math.floor(v);
  assert.ok(share(cx, cy, SURFACE_ASPHALT) > 240 && share(cx + 7, cy, SURFACE_ASPHALT) < share(cx, cy, SURFACE_ASPHALT), 'full in the middle, soft to the rim');
  assert.equal(share(cx + 40, cy, 0), 255, 'the island outside the dab is untouched (surface 0)');
  paintDab(mask, 1000, -2000, 400, 1, SURFACE_ASPHALT, true);
  assert.ok(share(cx, cy, SURFACE_ASPHALT) < 15, 'erased back to the bare island');
  assert.equal(paintDab(mask, PAINT_HALF * 3, 0, 400, 1, SURFACE_ASPHALT, false), null, 'off the island: nothing');
});

test('old dirt saves become cracked dirt, rendering the way the grey mask did', () => {
  const coverage = new Uint8Array(PAINT_RES * PAINT_RES);
  coverage[5] = 255; coverage[6] = 100;
  const mask = new SurfaceMask(PAINT_RES, PAINT_RES);
  migrateDirtCoverage(coverage, mask);
  assert.deepEqual(mask.get(5, 0), { id0: SURFACE_CRACKED, id1: SURFACE_CRACKED, weight: 0, flags: 0 }, 'full cover: solid dirt');
  assert.deepEqual(mask.get(6, 0), { id0: 0, id1: SURFACE_CRACKED, weight: 100, flags: 0 }, 'partial cover: the same share over the bare island');
  assert.equal(mask.isPainted(7, 0), false, 'unpainted stays unpainted');
});

test('island road auto paint lands on the ground along the route, never under a bridge, and composes over the brush', () => {
  // A straight road along +z at y = 0, 960 wide, 12,000 long.
  const length = 12000;
  const map = {
    length,
    frameAt: (s: number) => ({ pos: { x: 0, y: 0, z: s }, right: { x: 1, y: 0, z: 0 }, halfWidth: 480 }),
  } as unknown as TrackSpaceMap;
  const road = new RoadMask(length);
  const auto = new AutoPaint(flatPaintField(road));
  auto.run('carriageway', { surface: SURFACE_ASPHALT, width: 1, edge: 0, wobble: 0, spareBridges: 0, spareLoops: 0 });
  // The terrain meets the road except for a bridge over a valley between s = 6000 and 8000.
  const heightAt = (_x: number, z: number) => (z > 6000 && z < 8000 ? -900 : 0);
  const square = { res: PAINT_RES, half: PAINT_HALF };
  const projected = projectRoadMask(road, map, heightAt, square);
  const at = (x: number, z: number) => { const { u, v } = paintPixel(x, z); return projected.get(Math.floor(v) * PAINT_RES + Math.floor(u)); };
  assert.equal(at(0, 3000), packTexel(SURFACE_ASPHALT, SURFACE_ASPHALT, 0), 'asphalt on the road centre');
  assert.equal(at(300, 3000), packTexel(SURFACE_ASPHALT, SURFACE_ASPHALT, 0), 'and across the carriageway');
  assert.equal(at(900, 3000), undefined, 'but not off the road');
  assert.equal(at(0, 7000), undefined, 'nothing lands in the valley under the bridge');
  assert.equal(projectRoadMask(new RoadMask(length), map, heightAt, square).size, 0, 'an unpainted road projects nothing');
  // Composition: the road over the brush's paint, the brush's paint where the road leaves it alone.
  const hand = new Uint8Array([SURFACE_CRACKED, SURFACE_CRACKED, 0, 0]);
  const out = new Uint8Array(4);
  composeTexel(hand, out, 0, packTexel(SURFACE_ASPHALT, SURFACE_ASPHALT, 0));
  assert.deepEqual(Array.from(out), [SURFACE_ASPHALT, SURFACE_ASPHALT, 0, 0], 'solid road paint covers the brush');
  composeTexel(hand, out, 0, undefined);
  assert.deepEqual(Array.from(out), [SURFACE_CRACKED, SURFACE_CRACKED, 0, 0], 'no road paint: the brush shows');
  composeTexel(hand, out, 0, packTexel(0, SURFACE_GRAVEL, 128));
  const again = out.slice();
  composeTexel(hand, out, 0, packTexel(0, SURFACE_GRAVEL, 128));
  assert.deepEqual(Array.from(out), Array.from(again), 'a feathered road edge composes the same every time');
  assert.equal(out[1], SURFACE_GRAVEL, 'and blends the gravel in over the dirt');
});

test('the island\'s lane handles sit on the island road, not on the classic track in the sky', () => {
  const { store } = mockStorage();
  (globalThis as any).localStorage = store;
  const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
  const builder = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'none');
  builder.setCourse('basalt');
  const gizmos = (builder as any).laneGizmos;
  const island = islandTrackSpace();
  for (const x of [190, 20000, 50000, 72190]) {
    const handle = gizmos.worldFromEngine(x, 0, 0);
    const truth = worldFromCanonical(island, { s: island.trackDistFromEngineDistance(engineDistanceFromX(x)), laneZ: 0, altitude: 0 }).world;
    assert.ok(Math.hypot(handle.x - truth.x, handle.y - truth.y, handle.z - truth.z) < 1e-6, `x ${x} on the island road`);
    const back = gizmos.engineFromWorld(handle);
    assert.ok(Math.abs(back.x - x) < 2, `x ${x} drags back to ${back.x}`);
  }
});

