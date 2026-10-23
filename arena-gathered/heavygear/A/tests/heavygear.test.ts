import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, heavyPress, heavyProjector, heavyWater, setLamp, triangles, type Gear } from '../src/index';

const m = createMaterials(), bb = (g: Gear) => new THREE.Box3().setFromObject(g.group);
const has = (g: Gear, ...names: string[]) => names.forEach((n) => assert.ok(g.sockets.some((s) => s.name === n), n));

test('heavy press, projector and water maker stand on the ring, keep to the pad, vent at the back', () => {
  for (const stage of [1, 6]) {
    const o = { stage }, all = { heavyPress: heavyPress(m, o), heavyProjector: heavyProjector(m, o), heavyWater: heavyWater(m, o) };
    for (const [k, g] of Object.entries(all)) {
      const t = triangles(g); assert.ok(t > 0 && t <= (stage === 1 ? 900 : 10000), `${k} s${stage}: ${t}`);
      assert.ok(g.group.children.length <= 8, k); const b = bb(g);
      assert.ok(b.min.y >= -0.02, `${k} sinks`); assert.ok(b.min.x >= -4 && b.max.x <= 4 && b.min.z >= -4 && b.max.z <= 4, `${k} leaves the pad`);
      assert.ok(g.colliders.length > 0 && g.lamps.length > 0, k); setLamp(g.lamps[0]!, 1);
    }
    const hp = bb(all.heavyPress).max.y, pj = bb(all.heavyProjector).max.y, wm = bb(all.heavyWater);
    assert.ok(hp >= 3.6 && hp <= 5.5); assert.ok(pj >= 4.2 && pj <= 6.5);
    assert.ok(wm.max.y >= 2.8 && wm.max.y <= 4.5 && wm.max.x - wm.min.x >= 5);
    has(all.heavyPress, 'vent', 'chute', 'power'); has(all.heavyProjector, 'vent', 'lens', 'power'); has(all.heavyWater, 'vent', 'hopper', 'power');
    const at = (g: Gear, n: string) => g.sockets.find((s) => s.name === n)!.at;
    assert.ok(at(all.heavyPress, 'vent')[2] < 0);
    assert.ok(at(all.heavyProjector, 'vent')[2] < at(all.heavyProjector, 'lens')[2] - 0.5);
    assert.ok(at(all.heavyWater, 'vent')[1] > 2.5);
    assert.ok(all.heavyPress.parts?.['ram'] && all.heavyProjector.parts?.['head']);
  }
});

test('materials: eight entries, glass is physical without transmission', () => {
  const mats = createMaterials();
  for (const key of ['gunmetal', 'darkSteel', 'paint', 'copper', 'rubber', 'hazard', 'concrete'] as const) {
    assert.ok(mats[key] instanceof THREE.MeshStandardMaterial, key);
  }
  assert.ok(mats.glass instanceof THREE.MeshPhysicalMaterial, 'glass');
  assert.equal(mats.glass.transmission, 0);
});

test('setLamp drives emissive intensity between 0 and 1', () => {
  const g = heavyPress(m, { stage: 6 });
  const l = g.lamps[0]!;
  const mat = l.material as THREE.MeshStandardMaterial;
  assert.ok(mat.emissiveIntensity > 0, 'lamp starts lit');
  setLamp(l, 0);
  assert.equal(mat.emissiveIntensity, 0);
  setLamp(l, 1);
  assert.equal(mat.emissiveIntensity, 1);
  setLamp(l, 0.5);
  assert.equal(mat.emissiveIntensity, 0.5);
});

test('every mesh is non-indexed with position, normal and uv', () => {
  for (const stage of [1, 6]) {
    const gears = [heavyPress(m, { stage }), heavyProjector(m, { stage }), heavyWater(m, { stage })];
    for (const g of gears) {
      let meshes = 0;
      g.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          meshes++;
          const geo = o.geometry;
          assert.ok(geo.index === null, 'geometry must be non-indexed');
          assert.ok(geo.attributes.position !== undefined, 'position');
          assert.ok(geo.attributes.normal !== undefined, 'normal');
          assert.ok(geo.attributes.uv !== undefined, 'uv');
        }
      });
      assert.ok(meshes > 4, 'expected several meshes');
    }
  }
});

test('colliders are a few sane boxes inside the pad', () => {
  for (const stage of [1, 6]) {
    const gears = [heavyPress(m, { stage }), heavyProjector(m, { stage }), heavyWater(m, { stage })];
    for (const g of gears) {
      assert.ok(g.colliders.length >= 3 && g.colliders.length <= 8, 'a few boxes');
      for (const c of g.colliders) {
        for (let a = 0; a < 3; a++) {
          assert.ok(c.min[a]! < c.max[a]!, 'min < max');
        }
        assert.ok(c.min[0]! >= -4 && c.max[0]! <= 4 && c.min[2]! >= -4 && c.max[2]! <= 4, 'inside pad');
        assert.ok(c.min[1]! >= -0.02, 'above pad');
      }
    }
  }
});

test('stage 6 carries more triangles than stage 1 at the same silhouette', () => {
  const builders = [heavyPress, heavyProjector, heavyWater] as const;
  for (const fn of builders) {
    const g1 = fn(m, { stage: 1 });
    const g6 = fn(m, { stage: 6 });
    assert.ok(triangles(g6) > triangles(g1), fn.name);
    const b1 = new THREE.Box3().setFromObject(g1.group);
    const b6 = new THREE.Box3().setFromObject(g6.group);
    const p1 = [b1.min.x, b1.min.y, b1.min.z, b1.max.x, b1.max.y, b1.max.z];
    const p6 = [b6.min.x, b6.min.y, b6.min.z, b6.max.x, b6.max.y, b6.max.z];
    for (let i = 0; i < 6; i++) {
      assert.ok(Math.abs(p1[i]! - p6[i]!) < 1e-6, `silhouette ${fn.name} axis ${i}`);
    }
  }
});

test('ram slides 0..0.6 m without leaving the pad or hitting the die bed', () => {
  const g = heavyPress(m, { stage: 6 });
  const ram = g.parts?.['ram'];
  assert.ok(ram !== undefined, 'ram part');
  ram.position.y = -0.6;
  const b = new THREE.Box3().setFromObject(g.group);
  assert.ok(b.min.y >= -0.02, 'min y');
  assert.ok(b.min.x >= -4 && b.max.x <= 4 && b.min.z >= -4 && b.max.z <= 4, 'pad');
  const rb = new THREE.Box3().setFromObject(ram);
  assert.ok(rb.min.y >= 1.2, 'press plate clears the die bed');
  ram.position.y = 0;
});

test('head tilts and keeps inside the pad', () => {
  const g = heavyProjector(m, { stage: 6 });
  const head = g.parts?.['head'];
  assert.ok(head !== undefined, 'head part');
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    head.rotation.x = a;
    const b = new THREE.Box3().setFromObject(g.group);
    assert.ok(b.min.y >= -0.02, `tilt ${a} min y`);
    assert.ok(b.min.x >= -4 && b.max.x <= 4 && b.min.z >= -4 && b.max.z <= 4, `tilt ${a} pad`);
  }
  head.rotation.x = (-25 * Math.PI) / 180;
});
