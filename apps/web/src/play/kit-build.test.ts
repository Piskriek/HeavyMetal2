import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { Kit } from '@hm/kitspec';
import { buildKitPreset } from './kit-build';

const mats = {
  steel: new THREE.MeshStandardMaterial({ name: 'steel' }),
  green: new THREE.MeshStandardMaterial({ name: 'green' }),
  gunmetal: new THREE.MeshStandardMaterial({ name: 'gunmetal' }),
};

/** A plate on the ground with a beam on top and two bolts on the plate. */
const kit: Kit = {
  parts: {
    plate: { source: { kind: 'box', size: [2, 0.1, 1] }, material: 'steel', rank: 0 },
    beam: { source: { kind: 'param', gen: 'beam', params: { length: 1.6, section: 0.2 } }, material: 'steel', rank: 0 },
    bolt: { source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.04 } }, material: 'gunmetal', rank: 2 },
  },
  assemblies: {
    rig: {
      children: [
        { ref: 'plate', key: 'plate' },
        { ref: 'beam', key: 'beam', at: [0, 0.1, 0] },
        { ref: 'bolt', key: 'bolts', at: [-0.9, 0.1, 0.4], repeat: { count: 2, step: [1.8, 0, 0] } },
      ],
    },
  },
};

const build = (overrides?: Record<string, { params?: Record<string, number>; material?: string }>, maxRank: 0 | 1 | 2 = 2) =>
  buildKitPreset(kit, 'rig', { materials: mats, gen: () => null, maxRank, ...(overrides ? { overrides } : {}) })!;

const visibleTriangles = (g: THREE.Group) =>
  g.children.filter((m) => m.visible).reduce((s, m) => s + ((m as THREE.Mesh).geometry.getIndex()!.count / 3), 0);

test('rank changes only flip visibility, and the beam gains its detail with the cap', () => {
  const b = build();
  b.setMaxRank(0);
  const t0 = visibleTriangles(b.group);
  b.setMaxRank(1);
  const t1 = visibleTriangles(b.group);
  b.setMaxRank(2);
  const t2 = visibleTriangles(b.group);
  assert.ok(t0 < t1 && t1 < t2, `${t0} ${t1} ${t2}`);
  assert.ok(b.calls(0) >= 1 && b.calls(2) >= b.calls(0));
});

test('bolts show only at rank 2', () => {
  const b = build();
  b.setMaxRank(1);
  const shown = b.group.children.filter((m) => m.visible).map((m) => m.name);
  assert.ok(shown.every((n) => !n.startsWith('kit:gunmetal')), shown.join(','));
  b.setMaxRank(2);
  assert.ok(b.group.children.some((m) => m.visible && m.name.startsWith('kit:gunmetal')));
});

test('a ray names the part it hits', () => {
  const b = build();
  b.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0.9, 2, 0.4), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects(b.group.children.filter((m) => m.visible), false);
  const first = hits[0]!;
  assert.equal(b.partAt(first.object, first.faceIndex!)?.path, 'bolts[1]');
  const plateRay = new THREE.Raycaster(new THREE.Vector3(0.5, 2, -0.45), new THREE.Vector3(0, -1, 0));
  const ph = plateRay.intersectObjects(b.group.children.filter((m) => m.visible), false)[0]!;
  assert.equal(b.partAt(ph.object, ph.faceIndex!)?.path, 'plate');
});

test('an override changes only its own part: one fat green bolt', () => {
  const b = build({ 'bolts[0]': { params: { headWidth: 0.12 }, material: 'green' } });
  const green = b.group.children.find((m) => m.name.startsWith('kit:green')) as THREE.Mesh;
  assert.ok(green, 'the overridden bolt draws with the green material');
  green.geometry.computeBoundingBox();
  const size = green.geometry.boundingBox!.getSize(new THREE.Vector3());
  assert.ok(size.x > 0.1, `fat head ${size.x}`);
  assert.equal(b.placed.find((p) => p.path === 'bolts[1]')!.material, 'gunmetal', 'the other bolt is unchanged');
});
