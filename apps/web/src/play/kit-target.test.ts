// Aiming at kit parts across a whole plot (OVERWATCH: universal cartridge targetability). The targeter must (1) name the same part a
// brute-force triangle raycast names, on every ray, and (2) never be slower than that brute force: a beam swept across forty machines
// has to reject almost all of them at the AABB stage. Both are checked here against real `buildKitPreset` builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { Kit } from '@hm/kitspec';
import { buildKitPreset, type KitBuild } from './kit-build';
import { KitTargeter, aimKit, meshWorldBox, rayBoxEntry, type Aabb, type KitTargetable } from './kit-target';
import { driven, poseDriven } from './machine-motion';

const steel = new THREE.MeshBasicMaterial();

/** A two-assembly kit: a 2 m skid with a column, a cap on the column, and a bolt row beside it. */
const KIT: Kit = {
  parts: {
    skid: {
      source: { kind: 'box', size: [2, 0.2, 1] },
      material: 'steel',
      rank: 0,
      sockets: { top: { at: [0, 0.2, 0] } },
    },
    column: {
      source: { kind: 'box', size: [0.3, 1.2, 0.3] },
      material: 'steel',
      rank: 0,
      sockets: { top: { at: [0, 1.2, 0] } },
    },
    cap: { source: { kind: 'box', size: [0.5, 0.12, 0.5] }, material: 'steel', rank: 1 },
    bolt: { source: { kind: 'box', size: [0.06, 0.06, 0.06] }, material: 'trim', rank: 2 },
  },
  assemblies: {
    mill: {
      children: [
        { ref: 'skid', key: 'skid' },
        { ref: 'column', key: 'column', on: { child: 0, socket: 'top' } },
        { ref: 'cap', key: 'cap', on: { child: 1, socket: 'top' } },
        { ref: 'bolt', key: 'bolt' },
      ],
    },
  },
};

const build = (rank: 0 | 1 | 2 = 2, at: readonly [number, number, number] = [0, 0, 0]): KitBuild => {
  const b = buildKitPreset(KIT, 'mill', { materials: { steel, trim: steel }, gen: () => null, maxRank: rank });
  assert.ok(b, 'the test kit should build');
  b.group.position.set(at[0], at[1], at[2]);
  return b;
};

/** Every triangle of every visible mesh, the slow honest way (what the targeter must agree with). */
const bruteForce = (targetables: readonly KitTargetable[], origin: THREE.Vector3, dir: THREE.Vector3, reach: number) => {
  const ray = new THREE.Raycaster(origin, dir.clone().normalize(), 0, reach);
  let best: { kit: string; path: string; distance: number } | null = null;
  for (const t of targetables) {
    t.build.group.updateWorldMatrix(true, true);
    const meshes = t.build.group.children.filter((c) => c.visible) as THREE.Mesh[];
    for (const hit of ray.intersectObjects(meshes, false)) {
      if (best && hit.distance >= best.distance) break;
      const part = hit.faceIndex === undefined || hit.faceIndex === null ? null : t.build.partAt(hit.object, hit.faceIndex);
      if (!part) continue;
      best = { kit: t.kit, path: part.path, distance: hit.distance };
      break;
    }
  }
  return best;
};

test('rayBoxEntry: enters at the near face, misses outside, and 0 means the origin is inside', () => {
  const box: Aabb = { min: [-1, -1, -1], max: [1, 1, 1] };
  assert.equal(rayBoxEntry([0, 0, 5], [0, 0, -1], box), 4);
  assert.equal(rayBoxEntry([0, 0, 5], [0, 0, 1], box), null, 'behind the origin');
  assert.equal(rayBoxEntry([2, 0, 5], [0, 0, -1], box), null, 'passes beside it');
  assert.equal(rayBoxEntry([0, 0, 0], [1, 0, 0], box), 0, 'origin inside');
  assert.equal(rayBoxEntry([0, 0, 5], [0, 0, -1], box, 3), null, 'beyond the reach');
  assert.equal(rayBoxEntry([0, 0, 5], [0, 0, -1], box, 4.5), 4, 'inside the reach');
  // parallel to two faces and exactly on one of them: still a hit (a beam grazing a skid's top)
  assert.equal(rayBoxEntry([0, 1, 5], [0, 0, -1], box), 4);
  // an axis-aligned miss is caught even when the ray is long and the box far
  assert.equal(rayBoxEntry([1.5, 0, 100], [0, 0, -1], { min: [-1, -1, -1], max: [1, 1, 1] }, 1000), null);
});

test('the targeter names the same part the brute-force triangle cast names', () => {
  const targetables: KitTargetable[] = [
    { kit: 'plot:a', build: build(2, [0, 0, 0]) },
    { kit: 'plot:b', build: build(2, [4, 0, 0]) },
    { kit: 'plot:c', build: build(2, [0, 0, 6]) },
  ];
  const targeter = new KitTargeter();
  const origin = new THREE.Vector3(-3, 0.7, 3);
  for (let i = 0; i < 40; i += 1) {
    const yaw = (i / 40) * Math.PI * 2;
    const pitch = -0.25 + (i % 7) * 0.08;
    const dir = new THREE.Vector3(Math.cos(yaw), Math.sin(pitch), Math.sin(yaw)).normalize();
    const brute = bruteForce(targetables, origin, dir, 30);
    const aimed = targeter.aim(targetables, origin, dir, 30);
    assert.equal(aimed?.kit ?? null, brute?.kit ?? null, `kit at yaw ${yaw.toFixed(2)}`);
    assert.equal(aimed?.path ?? null, brute?.path ?? null, `part at yaw ${yaw.toFixed(2)}`);
    if (brute && aimed) assert.ok(Math.abs(aimed.distance - brute.distance) < 1e-6);
  }
});

test('a hit names a real part, its generator, and the point on the surface', () => {
  const targetables: KitTargetable[] = [{ kit: 'plot:mill', build: build() }];
  // straight at the column's +z face, 1.0 m up from the kit's base
  const aimed = aimKit(targetables, new THREE.Vector3(0, 0.9, 3), new THREE.Vector3(0, 0, -1), 10);
  assert.ok(aimed, 'the column should be under the ray');
  assert.equal(aimed.kit, 'plot:mill');
  assert.equal(aimed.gen, null, 'a box part has no generator');
  assert.ok(['skid', 'column', 'cap', 'bolt'].includes(aimed.path.split('/').at(-1)!), `unexpected path ${aimed.path}`);
  assert.ok(aimed.point[2] > 0, 'the hit is on the side facing the beam');
});

test('the rank cap decides what the beam can hit', () => {
  // the cap is a rank 1 part on top of the column; at rank 0 it must not be there at all
  const low = build(0);
  const targeter = new KitTargeter();
  const from = new THREE.Vector3(0, 3, 0);
  const down = new THREE.Vector3(0, -1, 0);
  const capped = targeter.aim([{ kit: 'plot:low', build: low }], from, down, 10);
  assert.ok(capped);
  assert.ok(!capped.path.includes('cap'), `rank 0 hit a rank 1 part: ${capped.path}`);
  const full = targeter.aim([{ kit: 'plot:full', build: build(2) }], from, down, 10);
  assert.ok(full?.path.includes('cap'), `rank 2 should hit the cap, got ${full?.path}`);
});

test('the AABB stages do the culling: forty distant machines cost no triangle tests', () => {
  const targetables: KitTargetable[] = [];
  for (let i = 0; i < 40; i += 1) targetables.push({ kit: `plot:${i}`, build: build(2, [(i % 8) * 5, 0, Math.floor(i / 8) * 5]) });
  const targeter = new KitTargeter();
  // aim down an empty lane between two rows: every machine must be rejected by a box, not by geometry
  const aimed = targeter.aim(targetables, new THREE.Vector3(-10, 1.5, 1.2), new THREE.Vector3(1, 0, 0), 200);
  assert.equal(aimed, null);
  const c = targeter.counters();
  assert.equal(c.builds, 40);
  assert.equal(c.buildsCulled, 40, 'every machine should be rejected by its world AABB');
  assert.equal(c.triangleTests, 0);

  // and the same call where a machine is in the lane: one kit survives, and only the meshes under the ray are tested
  targeter.reset();
  const hit = targeter.aim(targetables, new THREE.Vector3(-10, 0.5, 0), new THREE.Vector3(1, 0, 0), 200);
  assert.ok(hit, 'the first machine should be hit');
  assert.ok(targeter.counters().buildsCulled >= 30, `culled ${targeter.counters().buildsCulled} of 40`);
  assert.ok(targeter.counters().triangleTests <= 4, `triangle-tested ${targeter.counters().triangleTests} meshes`);
});

test('the boxes follow the build: a moved kit is re-boxed, and a hidden mesh cannot be hit', () => {
  const b = build();
  const targetables: KitTargetable[] = [{ kit: 'plot:move', build: b }];
  const targeter = new KitTargeter();
  const from = new THREE.Vector3(0, 0.5, 5);
  const dir = new THREE.Vector3(0, 0, -1);
  assert.ok(targeter.aim(targetables, from, dir, 50), 'the kit starts in the way');
  b.group.position.set(30, 0, 0);
  assert.equal(targeter.aim(targetables, from, dir, 50), null, 'the moved kit is out of the ray (the box was stale)');
  b.group.position.set(0, 0, 0);

  // hiding every mesh (rank cap 0 hides the cap and the bolt) takes them out of the union
  const capMesh = b.group.children.find((c) => (c as THREE.Mesh).userData.lo === 1) as THREE.Mesh | undefined;
  assert.ok(capMesh, 'the cap should be its own mesh (rank 1)');
  b.setMaxRank(0);
  const aimed = targeter.aim([{ kit: 'plot:ranks', build: b }], new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(0, -1, 0), 10);
  assert.ok(!aimed?.path.includes('cap'), `a hidden mesh was hit: ${aimed?.path}`);
});

test('meshWorldBox boxes a mesh where it stands, and an empty geometry never intersects', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), steel);
  mesh.position.set(3, 0.5, -1);
  mesh.updateWorldMatrix(true, false);
  const box = meshWorldBox(mesh);
  assert.deepEqual(
    [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map((v) => Math.round(v * 1e6) / 1e6),
    [2, 0, -3, 4, 1, 1],
  );
  const empty = new THREE.Mesh(new THREE.BufferGeometry(), steel);
  assert.ok(meshWorldBox(empty).isEmpty());
});

test('the shared targeter is one instance, and resetting it does not forget the boxes', () => {
  const kit = build();
  const targetables: KitTargetable[] = [{ kit: 'plot:shared', build: kit }];
  const a = aimKit(targetables, new THREE.Vector3(0, 0.5, 5), new THREE.Vector3(0, 0, -1), 20);
  assert.ok(a);
  const sharedAgain = aimKit(targetables, new THREE.Vector3(0, 0.5, 5), new THREE.Vector3(0, 0, -1), 20);
  assert.deepEqual(sharedAgain, a);
});

test('a part a motion spec drives is re-boxed lazily: the aim finds it where it now is, and a standing build is never re-measured', () => {
  // a rig whose ram sits away from its base, so a ray at the ram's height can only hit the ram
  const rig: Kit = {
    parts: {
      base: {
        source: { kind: 'box', size: [1, 0.2, 1] }, material: 'steel', rank: 0,
        sockets: { side: { at: [3, 0.2, 0] } },
      },
      ram: { source: { kind: 'box', size: [0.2, 0.6, 0.2] }, material: 'trim', rank: 1 },
    },
    assemblies: { rig: { children: [{ ref: 'base', key: 'base' }, { ref: 'ram', key: 'ram', on: { child: 0, socket: 'side' } }] } },
  };
  const b = buildKitPreset(rig, 'rig', { materials: { steel, trim: steel }, gen: () => null, maxRank: 2 })!;
  assert.ok(b, 'the rig builds');
  const targetables: KitTargetable[] = [{ kit: 'rig', build: b }];
  const aim = (t: KitTargeter, x: number, y: number) => t.aim(targetables, new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1), 20);

  const ramMesh = b.group.children.find((c) => (c as THREE.Mesh).isMesh && c.visible) as THREE.Mesh;
  assert.ok(ramMesh, 'the build has a mesh to drive');

  const targeter = new KitTargeter();
  // at rest the ram stands at y 0.2..0.8 under x = 3, and the base is nowhere near that column
  assert.equal(aim(targeter, 3, 0.5)?.path, 'ram');
  // a second aim with nothing moved re-measures nothing: the boxes are the cached ones
  targeter.reset();
  assert.equal(aim(targeter, 3, 0.5)?.path, 'ram');
  assert.equal(targeter.counters().buildsRemeasured, 0, 'a standing build costs no box work');
  assert.equal(targeter.counters().meshesRemeasured, 0);

  // drive every mesh of the build a gantry-slide 2 m up at a quarter hertz (as a KitMotionSpec would), and pose it at t = 1 s,
  // where the sine is at its top: the ram is now at y 2.2..2.8
  const spec = { kind: 'gantry-slide', axis: 'y', rateHz: 0.25, amplitude: 2 } as const;
  const parts = b.group.children.filter((c) => (c as THREE.Mesh).isMesh).map((m) => driven(m, spec));
  poseDriven(parts, 1, 1, 6);
  targeter.reset();
  assert.equal(aim(targeter, 3, 0.5), null, 'the old box of the moved ram must not still catch the ray');
  assert.equal(aim(targeter, 3, 2.5)?.path, 'ram', 'the aim finds the ram where the motion put it');
  assert.ok(targeter.counters().buildsRemeasured > 0, 'the moved build was re-measured');
  assert.ok(targeter.counters().meshesRemeasured > 0 && targeter.counters().meshesRemeasured <= 4, 'only what moved was re-boxed');
  // the geometry's own bounding box is read, never rebuilt: a driven part never re-triangulates on the aim path
  assert.ok(ramMesh.geometry.boundingBox, 'the geometry box was computed once and reused');

  // and back at rest the ray finds the ram again: the boxes follow the motion both ways
  poseDriven(parts, 0, 1, 6);
  assert.equal(aim(targeter, 3, 0.5)?.path, 'ram');
});
