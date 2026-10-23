import test from 'node:test'; import assert from 'node:assert/strict';
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

/* ------------------------------------------------------------------ *
 * extra cover
 * ------------------------------------------------------------------ */

const build = (stage: number): Record<string, Gear> => ({
  heavyPress: heavyPress(m, { stage }),
  heavyProjector: heavyProjector(m, { stage }),
  heavyWater: heavyWater(m, { stage }),
});

test('materials are the documented lab set and the glass has no transmission', () => {
  const mats = createMaterials();
  for (const key of ['gunmetal', 'darkSteel', 'paint', 'copper', 'rubber', 'hazard', 'concrete'] as const) {
    assert.ok(mats[key] instanceof THREE.MeshStandardMaterial, key);
  }
  assert.ok(mats.glass instanceof THREE.MeshPhysicalMaterial);
  assert.equal(mats.glass.transmission, 0);
  assert.equal(mats.paint.vertexColors, true);
});

test('every merged part is non indexed with position, normal and uv', () => {
  for (const stage of [1, 3, 6]) {
    for (const [name, g] of Object.entries(build(stage))) {
      let meshes = 0;
      g.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        meshes++;
        const geo = o.geometry;
        assert.equal(geo.getIndex(), null, `${name} s${stage} ${o.name} indexed`);
        for (const a of ['position', 'normal', 'uv']) {
          assert.ok(geo.getAttribute(a) !== undefined, `${name} s${stage} ${o.name} missing ${a}`);
        }
        const pos = geo.getAttribute('position');
        assert.ok(pos !== undefined && pos.count % 3 === 0);
      });
      assert.ok(meshes > 0 && meshes <= 14, name);
    }
  }
});

test('one mesh per material: no duplicated material buckets at a level', () => {
  for (const g of Object.values(build(6))) {
    const seen = new Set<string>();
    for (const child of g.group.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      assert.ok(!seen.has(child.name), `duplicate bucket ${child.name}`);
      seen.add(child.name);
    }
  }
});

test('lamps own private emissive materials and setLamp clamps 0..1', () => {
  for (const [name, g] of Object.entries(build(6))) {
    assert.ok(g.lamps.length >= 3, name);
    assert.equal(g.lamps.filter((l) => l.name.startsWith('status')).length, 2, `${name} status lamps`);
    const mats = new Set(g.lamps.map((l) => l.material));
    assert.equal(mats.size, g.lamps.length, `${name} shares lamp materials`);
    const first = g.lamps[0]!;
    const second = g.lamps[1]!;
    setLamp(first, 4);
    setLamp(second, -3);
    const a = first.material;
    const b = second.material;
    assert.ok(a instanceof THREE.MeshStandardMaterial && b instanceof THREE.MeshStandardMaterial);
    assert.equal(a.emissiveIntensity, 1);
    assert.equal(b.emissiveIntensity, 0);
    setLamp(first, 0.25);
    assert.equal(a.emissiveIntensity, 0.25);
  }
});

test('the right pixels pour out of the right vents', () => {
  const made = build(6);
  const press = made['heavyPress']!;
  const proj = made['heavyProjector']!;
  const water = made['heavyWater']!;
  assert.ok(press.lamps.some((l) => l.name === 'pressVent'));
  assert.ok(proj.lamps.some((l) => l.name === 'projVent'));
  assert.ok(proj.lamps.some((l) => l.name === 'lens'));
  assert.ok(water.lamps.some((l) => l.name === 'waterVent'));
  // the lens and the back rim pixels ride on the tilting head
  const head = proj.parts!['head']!;
  for (const n of ['lens', 'projVent']) assert.equal(proj.lamps.find((l) => l.name === n)!.parent, head);
});

test('sockets and colliders are sane and sit on the pad', () => {
  for (const [name, g] of Object.entries(build(6))) {
    for (const s of g.sockets) {
      assert.ok(Math.abs(s.at[0]) <= 4 && Math.abs(s.at[2]) <= 4, `${name} socket ${s.name} off pad`);
      assert.ok(s.at[1] >= 0, `${name} socket ${s.name} under the ring`);
    }
    for (const c of g.colliders) {
      for (let i = 0; i < 3; i++) assert.ok(c.min[i]! < c.max[i]!, `${name} collider inverted`);
      assert.ok(c.min[1]! >= -0.02, `${name} collider under the ring`);
      assert.ok(Math.abs(c.min[0]!) <= 4 && Math.abs(c.max[0]!) <= 4 && Math.abs(c.min[2]!) <= 4 && Math.abs(c.max[2]!) <= 4);
    }
  }
});

test('stage 1 is cheap but keeps the stage 6 silhouette', () => {
  for (const key of ['heavyPress', 'heavyProjector', 'heavyWater']) {
    const lo = build(1)[key]!;
    const hi = build(6)[key]!;
    assert.ok(triangles(lo) < triangles(hi), `${key} lod`);
    const a = bb(lo);
    const b = bb(hi);
    for (const axis of ['x', 'y', 'z'] as const) {
      assert.ok(Math.abs(a.max[axis] - b.max[axis]) < 0.3, `${key} max ${axis}`);
      assert.ok(Math.abs(a.min[axis] - b.min[axis]) < 0.3, `${key} min ${axis}`);
    }
  }
});

test('the press ram slides 0.6 m and the projector head tilts, both stay on the pad', () => {
  const press = heavyPress(m, { stage: 6 });
  const ram = press.parts!['ram']!;
  const rest = new THREE.Box3().setFromObject(ram);
  ram.position.y = -0.6;
  press.group.updateMatrixWorld(true);
  const down = new THREE.Box3().setFromObject(ram);
  assert.ok(Math.abs(rest.min.y - 0.6 - down.min.y) < 1e-6);
  assert.ok(down.min.y > 0.9, 'the press plate never reaches the die');
  const pb = new THREE.Box3().setFromObject(press.group);
  assert.ok(pb.min.y >= -0.02 && pb.min.x >= -4 && pb.max.x <= 4);

  const proj = heavyProjector(m, { stage: 6 });
  const head = proj.parts!['head']!;
  assert.ok(head.position.y > 3 && Math.abs(head.rotation.x + 0.4363) < 1e-3, 'head starts tilted up ~25 deg');
  for (const angle of [0, 0.2, 0.7]) {
    head.rotation.x = angle;
    proj.group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(proj.group);
    assert.ok(b.min.y >= -0.02, `tilt ${angle} sinks`);
    assert.ok(b.min.x >= -4 && b.max.x <= 4 && b.min.z >= -4 && b.max.z <= 4, `tilt ${angle} leaves the pad`);
  }
});

test('the projector lens looks forward while its vents face the back', () => {
  const proj = heavyProjector(m, { stage: 6 });
  const lens = proj.sockets.find((s) => s.name === 'lens')!.at;
  const vent = proj.sockets.find((s) => s.name === 'vent')!.at;
  assert.ok(lens[2] > 0.4, 'lens faces +z');
  assert.ok(lens[1] > vent[1], 'lens is tilted up above the back rim');
  assert.ok(vent[2] < -0.4, 'rim vents face the back');
});

test('the water maker is a 6 m machine with its vent box on the top rear', () => {
  const water = heavyWater(m, { stage: 6 });
  const b = bb(water);
  assert.ok(b.max.x - b.min.x >= 5.5 && b.max.x - b.min.x <= 8);
  const vent = water.sockets.find((s) => s.name === 'vent')!.at;
  const hopper = water.sockets.find((s) => s.name === 'hopper')!.at;
  assert.ok(vent[2] < 0 && vent[1] > 2.5, 'vent box on the top rear');
  assert.ok(hopper[0] > 2 && hopper[1] < 2, 'gravel hopper low on the +x end');
});

test('stage is clamped, defaults to full detail and never throws', () => {
  for (const stage of [-4, 0, 1, 2, 3, 4, 5, 6, 9]) {
    for (const g of Object.values(build(stage))) {
      const t = triangles(g);
      assert.ok(t > 0 && t <= 10000);
      assert.ok(g.group.children.length <= 8);
    }
  }
  const dflt = heavyPress(m);
  assert.equal(triangles(dflt), triangles(heavyPress(m, { stage: 6 })));
});
