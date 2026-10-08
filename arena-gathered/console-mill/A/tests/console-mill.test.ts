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

/* ---------------- additional tests ---------------- */

test('determinism: two builds are identical', () => {
  const a = operatorConsole(m), b2 = operatorConsole(m);
  assert.equal(triangles(a), triangles(b2));
  assert.deepEqual(a.sockets, b2.sockets);
  const ba = box(a), bb = box(b2);
  assert.ok(ba.min.distanceTo(bb.min) < 1e-9 && ba.max.distanceTo(bb.max) < 1e-9);
  for (const s of [0, 1, 6]) {
    assert.equal(triangles(textureMill(m, { stage: s })), triangles(textureMill(m, { stage: s })));
  }
});

test('every socket sits inside its prop bounding box', () => {
  for (const p of [operatorConsole(m), textureMill(m), textureMill(m, { stage: 1 })]) {
    const b = box(p).expandByScalar(0.06);
    for (const s of p.sockets) {
      assert.ok(b.containsPoint(new THREE.Vector3(...s.at)), `${s.name} inside bounds`);
    }
    assert.ok(p.sockets.length >= 1);
  }
});

test('the lever pivots about x: thrown forward drops the grip and moves it toward +z', () => {
  const c = operatorConsole(m);
  c.group.updateMatrixWorld(true);
  const rest = new THREE.Box3().setFromObject(c.lever);
  c.lever.rotation.x = -1.1;
  c.group.updateMatrixWorld(true);
  const thrown = new THREE.Box3().setFromObject(c.lever);
  assert.ok(thrown.max.y < rest.max.y - 0.05, 'grip comes down when thrown');
  assert.ok(thrown.max.z > rest.max.z + 0.1, 'grip moves forward (+z) when thrown');
  assert.ok(rest.max.y > 1.25, 'at rest the grip stands up');
});

test('stage 1 is flat shaded and chunky, same big parts', () => {
  const lo = textureMill(m, { stage: 1 });
  let flat = 0, indexed = 0;
  lo.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry.index) indexed++;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.flatShading) flat++;
  });
  assert.equal(indexed, 0, 'all geometry is non-indexed (faceted normals)');
  assert.ok(flat >= 1, 'flat-shaded material copies in use');
  assert.deepEqual(lo.sockets.map((s) => s.name).sort(), ['hopper', 'power', 'stack']);
  // same silhouette: within 10 cm of the stage-6 bounds
  const b1 = box(lo), b6 = box(textureMill(m, { stage: 6 }));
  assert.ok(Math.abs(b1.max.y - b6.max.y) < 0.1 && Math.abs(b1.max.z - b6.max.z) < 0.1);
});

test('lamps light alone: own material each, glow follows setLamp', () => {
  const c = operatorConsole(m);
  const mats = new Set(c.lamps.map((l) => l.material));
  assert.equal(mats.size, c.lamps.length, 'each lamp has its own material');
  for (const l of c.lamps) {
    setLamp(l, 0);
    assert.equal((l.material as THREE.MeshStandardMaterial).emissiveIntensity, 0);
    setLamp(l, 1);
    assert.ok((l.material as THREE.MeshStandardMaterial).emissiveIntensity > 0);
  }
  const screenMat = c.screen.material as THREE.MeshStandardMaterial;
  assert.ok(screenMat.emissiveIntensity > 0 && screenMat.emissiveMap !== null, 'screen is lit by a DataTexture');
});
