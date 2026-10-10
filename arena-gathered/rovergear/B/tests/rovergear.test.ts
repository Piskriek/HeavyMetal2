import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createMaterials,
  fabricator,
  scout,
  hauler,
  crawler,
  setLamp,
  triangles,
  type Rover,
  type LabMaterials,
} from '../src/index';

const m = createMaterials();
const bb = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const has = (s: { sockets: { name: string }[] }, ...n: string[]) =>
  n.forEach((x) => assert.ok(s.sockets.some((k) => k.name === x), x));

/* ── provided test (kept unchanged) ─────────────────────────────────── */

test('rovers fit their hubs and lengths; the fabricator stands on its ring', () => {
  for (const stage of [1, 6]) {
    const o = { stage },
      r: Record<string, Rover> = { scout: scout(m, o), hauler: hauler(m, o), crawler: crawler(m, o) };
    for (const [k, v] of Object.entries(r)) {
      const tri =
        triangles(v.body) + (v.wheel ? triangles(v.wheel) * v.hubs.length : 0);
      assert.ok(tri > 0 && tri <= (stage === 1 ? 1500 : 12000), `${k} s${stage}: ${tri}`);
      assert.ok(v.body.children.length <= 8 && v.colliders.length > 0 && v.lamps.length >= 2, k);
      has(v, 'seat');
      setLamp(v.lamps[0]!, 1);
      if (v.wheel) {
        const w = bb(v.wheel);
        assert.ok(
          Math.abs(w.max.y - v.wheelRadius) < 0.08 && Math.abs(w.min.y + v.wheelRadius) < 0.08,
          `${k} wheel radius`,
        );
      }
    }
    assert.equal(r.scout!.hubs.length, 4);
    assert.equal(r.hauler!.hubs.length, 6);
    assert.equal(r.crawler!.wheel, null);
    const len = (v: Rover) => {
      const b = bb(v.body);
      return b.max.z - b.min.z;
    };
    assert.ok(len(r.scout!) > 2.6 && len(r.scout!) < 3.8);
    assert.ok(len(r.hauler!) > 5.2 && len(r.hauler!) < 6.8);
    assert.ok(len(r.crawler!) > 6 && len(r.crawler!) < 8);
    has(r.hauler!, 'dish');
    has(r.crawler!, 'drill', 'mast');
    assert.ok(r.crawler!.parts['arm']);
    const f = fabricator(m, o),
      fb = bb(f.group);
    assert.ok(
      fb.min.y >= -0.02 &&
        fb.max.y > 4.2 &&
        fb.max.y < 6.2 &&
        fb.min.x >= -4 &&
        fb.max.x <= 4 &&
        fb.min.z >= -4 &&
        fb.max.z <= 4,
    );
    has(f, 'bed', 'power');
    assert.ok(f.parts['head'] && triangles(f.group) <= (stage === 1 ? 1500 : 10000));
  }
});

/* ── additional tests ────────────────────────────────────────────────── */

test('createMaterials returns all eight required material types', () => {
  const lm = createMaterials();
  assert.ok(lm.gunmetal instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.darkSteel instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.paint instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.copper instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.rubber instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.hazard instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.concrete instanceof THREE.MeshStandardMaterial);
  assert.ok(lm.glass instanceof THREE.MeshPhysicalMaterial);
  // glass must NOT use transmission
  assert.equal(lm.glass.transmission, 0);
});

test('setLamp toggles emissive intensity and colour', () => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), mat);
  setLamp(mesh, 0.7);
  assert.equal(mat.emissiveIntensity, 0.7);
  assert.equal(mat.emissive.getHex(), 0xffaa00);
  setLamp(mesh, 0);
  assert.equal(mat.emissiveIntensity, 0);
});

test('triangles counts correctly for basic primitives', () => {
  // indexed box → toNonIndexed gives 12 tris
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
  assert.equal(triangles(box), 12);

  // cylinder(8 seg) non-indexed → 4*8 = 32
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 8).toNonIndexed(),
  );
  assert.equal(triangles(cyl), 32);

  // group of two boxes → 24
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  assert.equal(triangles(grp), 24);
});

test('all rover body geometries are non-indexed with position, normal, uv', () => {
  const lm = createMaterials();
  const o = { stage: 1 };
  const builders: ((m: LabMaterials, o: { stage: number }) => Rover)[] = [
    scout,
    hauler,
    crawler,
  ];
  for (const build of builders) {
    const r = build(lm, o);
    r.body.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const geo = obj.geometry;
        assert.equal(geo.index, null, 'geometry should be non-indexed');
        assert.ok(geo.getAttribute('position'), 'missing position attribute');
        assert.ok(geo.getAttribute('normal'), 'missing normal attribute');
        assert.ok(geo.getAttribute('uv'), 'missing uv attribute');
      }
    });
  }
});

test('wheel geometries are also non-indexed with required attributes', () => {
  const lm = createMaterials();
  for (const stage of [1, 6]) {
    for (const build of [scout, hauler]) {
      const r = build(lm, { stage });
      const w = r.wheel;
      assert.ok(w, 'wheel should exist');
      w!.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const geo = obj.geometry;
          assert.equal(geo.index, null);
          assert.ok(geo.getAttribute('position'));
          assert.ok(geo.getAttribute('normal'));
          assert.ok(geo.getAttribute('uv'));
        }
      });
    }
  }
});

test('stage 6 rovers have more triangles than stage 1', () => {
  const lm = createMaterials();
  for (const build of [scout, hauler, crawler]) {
    const s1 = build(lm, { stage: 1 });
    const s6 = build(lm, { stage: 6 });
    const t1 = triangles(s1.body) + (s1.wheel ? triangles(s1.wheel) * s1.hubs.length : 0);
    const t6 = triangles(s6.body) + (s6.wheel ? triangles(s6.wheel) * s6.hubs.length : 0);
    assert.ok(t6 > t1, `stage 6 (${t6}) should have more tris than stage 1 (${t1})`);
  }
});

test('fabricator group has ≤ 8 children at both stages', () => {
  const lm = createMaterials();
  for (const stage of [1, 6]) {
    const f = fabricator(lm, { stage });
    assert.ok(f.group.children.length <= 8, `stage ${stage}: ${f.group.children.length} children`);
  }
});

test('crawler arm is a child of body and can be rotated', () => {
  const lm = createMaterials();
  const r = crawler(lm, { stage: 1 });
  const arm = r.parts['arm'];
  assert.ok(arm, 'arm part should exist');
  assert.ok(r.body.children.includes(arm), 'arm should be a child of body');
  // verify rotation.x doesn't throw
  arm.rotation.x = 0.5;
  assert.equal(arm.rotation.x, 0.5);
});

test('fabricator head can be slid along x', () => {
  const lm = createMaterials();
  const f = fabricator(lm, { stage: 1 });
  const head = f.parts['head'];
  assert.ok(head, 'head part should exist');
  assert.ok(f.group.children.includes(head), 'head should be a child of group');
  head.position.x = 2.0;
  assert.equal(head.position.x, 2.0);
});

test('colliders produce sensible min/max', () => {
  const lm = createMaterials();
  for (const build of [scout, hauler, crawler]) {
    const r = build(lm, { stage: 1 });
    for (const c of r.colliders) {
      assert.ok(c.min[0] < c.max[0], 'min.x < max.x');
      assert.ok(c.min[1] < c.max[1], 'min.y < max.y');
      assert.ok(c.min[2] < c.max[2], 'min.z < max.z');
    }
  }
});
