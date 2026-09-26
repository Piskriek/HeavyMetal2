/**
 * ISLAND-ROUTE: Basalt Isle's route, maps and ground.
 *
 *   node --import tsx --test tests/island-route.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TRACK_DISTANCE, START_X, courseY } from '../src/game/scene';
import { COURSES } from '../src/game/types';
import { TRACKS } from '../src/game/courses';
import { D_START, getTrackSpace, type TrackSpaceMap } from '../src/game/track-space';
import { layoutForSeed, validateRouteGraph } from '../src/game/sim/route';
import { ISLAND_ANCHORS, ISLAND_ROUTE_GRAPH, ISLAND_SEGMENTS } from '../src/game/island-route/basalt-route';
import {
  CAMERA_TAIL_X, cameraTrackSpace, courseTrackSpace, islandBranchRoads, islandBranchSpace, islandRoadsAt, islandTrackSpace,
  racerTrackSpace,
} from '../src/game/island-route/island-space';
import { buildClosedGates, type IslandMaterials } from '../src/game/island-route/island-world';
import {
  ROAD_BED, RoadIndex, carvedHeight, markBridges, naturalHeight, roadSamples,
} from '../src/game/island-route/island-ground';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { writeStorage, TRACK_STORAGE_KEY_V2 } from '../src/game/track-storage';
import type { TrackData } from '../src/game/renderer-3d';

const dist = (x: number) => (x - START_X) / 2;
const gap = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('the classic courses keep their exact engine-to-arc mapping (no knots, one linear segment)', () => {
  const map = getTrackSpace();
  assert.equal(map.D_START, D_START);
  for (const d of [0, 1234.5, 9000, 18000, 27777, TRACK_DISTANCE]) {
    assert.equal(map.trackDistFromEngineDistance(d), D_START + (map.D_END - D_START) * (d / TRACK_DISTANCE));
    assert.equal(map.arcPerEngineDistanceAt(d), map.ARC_PER_ENGINE_DISTANCE);
  }
  assert.equal(courseTrackSpace('ridge'), map);
  assert.equal(racerTrackSpace('sheep', 30000, { rim: 'ledge' }), map, 'a route never changes a classic course');
});

test('every anchor lands exactly where it is pinned, on the main map and on every branch map', () => {
  const maps: TrackSpaceMap[] = [islandTrackSpace(), ...islandBranchRoads().map((b) => b.map)];
  for (const map of maps) {
    for (const a of ISLAND_ANCHORS) {
      assert.ok(Math.abs(map.trackDistFromEngineDistance(dist(a.x)) - map.distOf(a.label)) < 1e-6, a.label);
      assert.ok(Math.abs(map.engineDistanceFromTrackDist(map.distOf(a.label)) - dist(a.x)) < 1e-6, a.label);
    }
    let last = -Infinity;
    for (let d = 0; d <= TRACK_DISTANCE; d += 250) {
      const s = map.trackDistFromEngineDistance(d);
      assert.ok(s > last, 'the mapping only ever moves forward');
      last = s;
    }
  }
});

test('a branch map is the main road outside its fork, so a racer never jumps at a split or a merge', () => {
  const main = islandTrackSpace();
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    for (const b of section.branches.slice(1)) {
      const map = islandBranchSpace(section.id, b.id);
      for (const x of [section.x0, section.x1]) {
        const p = map.frameAt(map.trackDistFromEngineDistance(dist(x))).pos;
        const q = main.frameAt(main.trackDistFromEngineDistance(dist(x))).pos;
        assert.ok(gap(p, q) < 2, `${section.id}/${b.id} at x ${x}: ${gap(p, q).toFixed(2)} units apart`);
      }
      for (const x of [START_X + 2000, section.x0 - 1500, section.x1 + 1500, START_X + 70000]) {
        const p = map.frameAt(map.trackDistFromEngineDistance(dist(x))).pos;
        const q = main.frameAt(main.trackDistFromEngineDistance(dist(x))).pos;
        assert.ok(gap(p, q) < 2, `${section.id}/${b.id} off its fork at x ${x}: ${gap(p, q).toFixed(2)} units apart`);
      }
    }
  }
});

test('branches peel off left to right in the order the split hands them out', () => {
  const main = islandTrackSpace();
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    const split = main.frameAt(main.distOf(`${section.id}:split`));
    const across = section.branches.map((b) => {
      const map = islandBranchSpace(section.id, b.id);
      const p = map.frameAt(map.distOf(`${section.id}:split`) + 1600).pos;
      return (p.x - split.pos.x) * split.right.x + (p.y - split.pos.y) * split.right.y + (p.z - split.pos.z) * split.right.z;
    });
    for (let i = 1; i < across.length; i++) assert.ok(across[i] > across[i - 1], `${section.id}: ${across.map(Math.round).join(' < ')}`);
  }
});

test('the route graph matches the authored forks and is valid; the first split is three ways', () => {
  validateRouteGraph(ISLAND_ROUTE_GRAPH);
  const forks = ISLAND_SEGMENTS.filter((s) => s.kind === 'fork');
  assert.equal(ISLAND_ROUTE_GRAPH.sections.length, forks.length);
  assert.equal(ISLAND_ROUTE_GRAPH.sections[0].branches.length, 3);
  for (const section of ISLAND_ROUTE_GRAPH.sections) {
    assert.ok(ISLAND_ANCHORS.some((a) => a.label === `${section.id}:split` && a.x === section.x0));
    assert.ok(ISLAND_ANCHORS.some((a) => a.label === `${section.id}:merge` && a.x === section.x1));
  }
  assert.equal(ISLAND_ANCHORS.find((a) => a.label === 'maw')?.x, 8304, 'the Maw is the sorting gate');
});

test('a racer is drawn on its branch inside a fork and on the main road everywhere else', () => {
  const rim = ISLAND_ROUTE_GRAPH.sections[0];
  assert.equal(racerTrackSpace('basalt', rim.x0 + 100, { rim: 'ledge' }), islandBranchSpace('rim', 'ledge'));
  assert.equal(racerTrackSpace('basalt', rim.x0 + 100, { rim: rim.branches[0].id }), islandTrackSpace());
  assert.equal(racerTrackSpace('basalt', rim.x1 + 100, { rim: 'ledge' }), islandTrackSpace());
  assert.equal(racerTrackSpace('basalt', 3000, undefined), islandTrackSpace());
});

test('the ground never pokes through a road: under every road it sits below the surface', () => {
  const main = islandTrackSpace();
  const roads = [{ map: main, from: 0, to: main.length }, ...islandBranchRoads()];
  const index = new RoadIndex(roadSamples(roads, 2));
  markBridges(index);
  const worst: string[] = [];
  for (const { map, from, to } of roads) {
    for (let d = from; d <= to; d += 400) {
      const f = map.frameAt(d);
      if (f.stage === 'cavern' || f.stage === 'mine') continue;
      for (const k of [-0.9, 0, 0.9]) {
        const x = f.pos.x + f.right.x * f.halfWidth * k;
        const z = f.pos.z + f.right.z * f.halfWidth * k;
        const surface = f.pos.y + f.right.y * f.halfWidth * k;
        const ground = carvedHeight(x, z, naturalHeight(x, z), index);
        if (ground > surface - ROAD_BED / 2) worst.push(`${f.stage} d ${Math.round(d)} lane ${k}: ground ${Math.round(ground - surface)} above`);
      }
    }
  }
  assert.deepEqual(worst.slice(0, 8), [], `${worst.length} places`);
});

test('the island builder never loads, saves or backs up the owner\'s track', async () => {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  };
  const saved = [{ id: 'owner-1', type: 'prop_14_scrapdome_gantry', x: 1, y: 2, z: 3, rotY: 0, scale: 1 }];
  writeStorage(saved as never, 'ridge');
  const before = data.get(TRACK_STORAGE_KEY_V2);
  assert.ok(before, 'the owner\'s track is in storage');
  const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
  const builder = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, false);
  assert.equal(builder.getProps().length, 0, 'the saved props stay out of the island');
  builder.saveToStorage();
  assert.equal(data.get(TRACK_STORAGE_KEY_V2), before, 'nothing is written over the saved track');
  assert.equal(await builder.backupToFile(true), null, 'no disk backup');
  const classic = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track);
  assert.equal(classic.getProps().length, 1, 'the classic builder still loads it');
});

test('Basalt Isle is the fourth course and rides Rustbucket Ridge\'s physics profile', () => {
  assert.deepEqual(COURSES.map((c) => c.id), ['ridge', 'boomtown', 'sheep', 'basalt']);
  assert.equal(TRACKS.basalt.profile, TRACKS.ridge.profile);
  for (const x of [190, 5000, 8304, 30000, 60000, 72190]) assert.equal(courseY(x, 'basalt'), courseY(x, 'ridge'));
});

test('an obstacle inside a fork stands on every branch; the camera keeps the branch just past the merge', () => {
  const rim = ISLAND_ROUTE_GRAPH.sections[0];
  assert.deepEqual(islandRoadsAt(rim.x0 + 500), rim.branches.map((b) => islandBranchSpace('rim', b.id)));
  assert.deepEqual(islandRoadsAt(rim.x0 - 500), [islandTrackSpace()]);
  const ledge = islandBranchSpace('rim', 'ledge');
  assert.equal(cameraTrackSpace('basalt', rim.x1 + CAMERA_TAIL_X - 1, { rim: 'ledge' }), ledge, 'the look-back stays on the ledge');
  assert.equal(cameraTrackSpace('basalt', rim.x1 + CAMERA_TAIL_X + 1, { rim: 'ledge' }), islandTrackSpace());
  const next = ISLAND_ROUTE_GRAPH.sections[1];
  assert.ok(next.x0 > rim.x1 + CAMERA_TAIL_X, 'the camera tail never reaches the next split');
});

test('every branch shut this race gets a gate, and only those', () => {
  const layout = layoutForSeed(ISLAND_ROUTE_GRAPH, 12345);
  const materials = { wood: new THREE.MeshStandardMaterial() } as unknown as IslandMaterials;
  const gates = buildClosedGates(layout, materials);
  const closed = ISLAND_ROUTE_GRAPH.sections.flatMap((s) => s.branches
    .filter((b) => !layout.open?.[s.id]?.includes(b.id)).map((b) => `Closed: ${s.id}/${b.id}`));
  assert.deepEqual(gates.children.map((g) => g.name), closed);
  assert.equal(buildClosedGates(null, materials).children.length, 0);
});
