import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, operatorConsole, textureMill, triangles, setLamp, type Prop } from '../src/index';

const m = createMaterials();
const box = (p: Prop) => new THREE.Box3().setFromObject(p.group);
const meshes = (p: Prop) => { let n = 0; p.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };
const at = (p: Prop, n: string) => p.sockets.find((s) => s.name === n)!.at;

test('both stand on the floor, with colliders, and are cheap to draw', () => {
  for (const p of [operatorConsole(m), textureMill(m), textureMill(m, { stage: 1 })]) {
    assert.ok(Math.abs(box(p).min.y) <= 0.002, `grounded (min y ${box(p).min.y})`);
    assert.ok(p.colliders.length >= 1);
    assert.ok(meshes(p) <= 16 + p.lamps.length, `${meshes(p)} meshes`);
    for (const o of [p.group]) o.traverse((x) => { const mat = (x as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined; if (mat && 'transmission' in mat) assert.equal(mat.transmission, 0, 'no transmission'); });
  }
});

test('the console: a desk on a pedestal, the lever off, a lit screen, its cable into the floor', () => {
  const c = operatorConsole(m);
  const b = box(c);
  assert.ok(b.max.x - b.min.x >= 0.9 && b.max.x - b.min.x <= 1.5, `width ${b.max.x - b.min.x}`);
  assert.ok(b.max.z - b.min.z >= 0.5 && b.max.z - b.min.z <= 1.0, `depth ${b.max.z - b.min.z}`);
  assert.ok(b.max.y >= 1.15 && b.max.y <= 1.7, `height ${b.max.y}`);
  assert.equal(c.lever.rotation.x, 0);
  c.lever.rotation.x = -1.1;
  assert.ok(c.screen.isMesh);
  assert.ok(c.lamps.length >= 2);
  setLamp(c.lamps[0]!, 1);
  assert.ok((c.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity > 0);
  assert.ok(at(c, 'cable')[1] <= 0.1, 'the cable goes into the floor');
  const t = triangles(c);
  assert.ok(t >= 2500 && t <= 8000, `${t} triangles`);
});

test('the mill: hopper in front, stack behind and above it, power low at the back, chunky at stage 1', () => {
  const mill = textureMill(m, { stage: 6 });
  const b = box(mill);
  assert.ok(b.max.z - b.min.z >= 1.3 && b.max.z - b.min.z <= 2.1, `length ${b.max.z - b.min.z}`);
  assert.ok(b.max.x - b.min.x >= 0.8 && b.max.x - b.min.x <= 1.5, `width ${b.max.x - b.min.x}`);
  assert.ok(b.max.y >= 1.2 && b.max.y <= 2.0, `height ${b.max.y}`);
  const hopper = at(mill, 'hopper'), stack = at(mill, 'stack'), power = at(mill, 'power');
  assert.ok(hopper[2] > 0.2, 'the hopper is at the front');
  assert.ok(stack[2] < hopper[2] - 0.5 && stack[1] > hopper[1] + 0.2, 'the stack is behind and above the hopper');
  assert.ok(power[1] < 0.7 && power[2] < 0, 'power comes in low at the back');
  assert.ok(mill.lamps.length >= 1);
  const t6 = triangles(mill), t1 = triangles(textureMill(m, { stage: 1 }));
  assert.ok(t6 >= 2500 && t6 <= 8000, `stage 6: ${t6}`);
  assert.ok(t1 <= 1500 && t1 * 2 <= t6, `stage 1: ${t1}`);
});

test('determinism: two builds match', () => {
  const a = operatorConsole(m);
  const b = operatorConsole(m);
  assert.equal(triangles(a), triangles(b));
  const ba = box(a);
  const bb = box(b);
  assert.ok(ba.min.distanceTo(bb.min) < 0.0001);
  assert.ok(ba.max.distanceTo(bb.max) < 0.0001);
  const m1 = textureMill(m, { stage: 6 });
  const m2 = textureMill(m, { stage: 6 });
  assert.equal(triangles(m1), triangles(m2));
  const m3 = textureMill(m, { stage: 1 });
  const m4 = textureMill(m, { stage: 1 });
  assert.equal(triangles(m3), triangles(m4));
});

test('sockets inside the bounding box', () => {
  const props: Prop[] = [operatorConsole(m), textureMill(m), textureMill(m, { stage: 1 })];
  for (const p of props) {
    const b = box(p);
    const eps = 0.01;
    for (const s of p.sockets) {
      const v = new THREE.Vector3(s.at[0], s.at[1], s.at[2]);
      assert.ok(v.x >= b.min.x - eps && v.x <= b.max.x + eps, `${s.name} x inside`);
      assert.ok(v.y >= b.min.y - eps && v.y <= b.max.y + eps, `${s.name} y inside`);
      assert.ok(v.z >= b.min.z - eps && v.z <= b.max.z + eps, `${s.name} z inside`);
    }
  }
});

test('lever pivots about x', () => {
  const c = operatorConsole(m);
  assert.equal(c.lever.rotation.x, 0);
  let found = false;
  c.group.traverse((o) => { if (o === c.lever) found = true; });
  assert.ok(found, 'lever inside group');
  c.group.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(c.lever);
  const cb = before.getCenter(new THREE.Vector3());
  c.lever.rotation.x = -1.1;
  c.group.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(c.lever);
  const ca = after.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(ca.x - cb.x) < 0.001, 'pivot keeps x');
  assert.ok(ca.z < cb.z - 0.02, 'thrown lever moves rearward');
  assert.ok(Math.abs(ca.y - cb.y) > 0.02, 'lever swings');
});

test('flat shading at stage 1', () => {
  const low = textureMill(m, { stage: 1 });
  let n = 0;
  low.group.traverse((o) => {
    const mh = o as THREE.Mesh;
    if (mh.isMesh) {
      const mat = mh.material as THREE.MeshStandardMaterial;
      if ('flatShading' in mat) {
        assert.equal(mat.flatShading, true, 'stage1 flat');
        n++;
      }
    }
  });
  assert.ok(n >= 5, `checked ${n} materials`);
});

test('lamps glow', () => {
  const c = operatorConsole(m);
  for (const l of c.lamps) {
    setLamp(l, 0);
    assert.equal((l.material as THREE.MeshStandardMaterial).emissiveIntensity, 0);
    setLamp(l, 1);
    assert.ok((l.material as THREE.MeshStandardMaterial).emissiveIntensity > 1);
  }
  const mill = textureMill(m);
  for (const l of mill.lamps) {
    setLamp(l, 0.5);
    assert.ok((l.material as THREE.MeshStandardMaterial).emissiveIntensity > 0.5);
    setLamp(l, 1);
    assert.ok((l.material as THREE.MeshStandardMaterial).emissiveIntensity > 1);
  }
});
