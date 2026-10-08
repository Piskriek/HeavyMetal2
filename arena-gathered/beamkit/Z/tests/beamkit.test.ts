import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BUDGET, createMaterials, extractionBeam, beamEffect, beamPixelAt } from '../src/index';

const m = createMaterials();
const box = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);

test('rifle proportions, and the hands, shoulder and muzzle where a rifle has them', () => {
  for (const stage of [1, 6]) {
    const t = extractionBeam(m, { stage });
    const b = box(t.group);
    const len = b.max.z - b.min.z, h = b.max.y - b.min.y, w = b.max.x - b.min.x;
    assert.ok(len >= 0.7 && len <= 1.1, `length ${len}`);
    assert.ok(h >= 0.15 && h <= 0.35 && w <= 0.16, `height ${h}, width ${w}`);
    const s = t.sockets;
    assert.ok(s.muzzle.z > s.foregrip.z && s.foregrip.z > s.grip.z && s.grip.z > s.shoulder.z, 'muzzle, foregrip, grip, shoulder from front to back');
    assert.ok(s.grip.y < s.muzzle.y && s.foregrip.y < s.muzzle.y, 'the hands hold below the barrel');
    assert.ok(Math.abs(s.muzzle.z - b.max.z) < 0.05, 'the muzzle is the front of the tool');
    assert.ok(s.cartridge.x > 0, 'the cartridge port is on the right side');
    for (const v of Object.values(s)) assert.ok(b.containsPoint(v) || b.distanceToPoint(v) < 0.02);
  }
});

test('each detail level keeps to its triangle budget, and stage 1 is flat shaded', () => {
  const low = extractionBeam(m, { stage: 1 }), full = extractionBeam(m, { stage: 6 });
  assert.ok(low.triangles <= BUDGET.stage1, `stage 1: ${low.triangles}`);
  assert.ok(full.triangles <= BUDGET.full && full.triangles > low.triangles * 2, `full: ${full.triangles}`);
  low.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || low.lamps.includes(mesh)) return;
    const n = mesh.geometry.getAttribute('normal');
    if (mesh.geometry.index) return assert.fail('stage 1 meshes are non-indexed (flat)');
    for (let i = 0; i < n.count; i += 3) assert.ok(Math.abs(n.getX(i) - n.getX(i + 1)) + Math.abs(n.getY(i) - n.getY(i + 2)) < 1e-6);
  });
});

test('no material uses transmission', () => {
  for (const stage of [1, 6]) extractionBeam(m, { stage }).group.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const x of mat ? (Array.isArray(mat) ? mat : [mat]) : []) assert.ok(!('transmission' in x) || (x as THREE.MeshPhysicalMaterial).transmission === 0);
  });
});

test('the screen shows the mode, the port shows the cartridge, the strip shows the charge', () => {
  const t = extractionBeam(m, { stage: 6 });
  const screen = t.lamps.find((l) => ((l.material as THREE.MeshStandardMaterial).emissiveMap as THREE.DataTexture | null)?.isDataTexture)!;
  assert.ok(screen, 'a screen lamp with a DataTexture');
  const pixels = (): string => Array.from(((screen.material as THREE.MeshStandardMaterial).emissiveMap as THREE.DataTexture).image.data as Uint8Array).join(',');
  t.setMode('extract'); const a = pixels();
  t.setMode('apply'); const b = pixels();
  t.setMode('sculpt'); const c = pixels();
  assert.ok(a !== b && b !== c && a !== c);
  t.setCartridge(null);
  const hidden = t.group.getObjectByName('cartridge');
  assert.ok(hidden && !hidden.visible);
  t.setCartridge('#ff3d8a');
  assert.ok(hidden.visible);
  t.setCharge(0.6);
  assert.equal(t.lamps.filter((l) => /charge/.test(l.name) && (l.material as THREE.MeshStandardMaterial).emissiveIntensity > 0.5).length, 3);
});

test('the beam is one draw call, pixels flow the right way in each mode, and it hides when off', () => {
  const fx = beamEffect({ pixels: 160 });
  let meshes = 0;
  fx.object.traverse((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) meshes++; });
  assert.equal(meshes, 1);
  const from: [number, number, number] = [0, 1.4, 0], to: [number, number, number] = [0, 0.2, 8];
  const d = (p: [number, number, number]): number => Math.hypot(p[0] - from[0], p[1] - from[1], p[2] - from[2]);
  let inward = 0, outward = 0;
  for (let i = 0; i < 160; i++) {
    const e0 = d(beamPixelAt(i, 160, 1.0, from, to, 'extract')), e1 = d(beamPixelAt(i, 160, 1.02, from, to, 'extract'));
    if (e1 < e0) inward++;
    const a0 = d(beamPixelAt(i, 160, 1.0, from, to, 'apply')), a1 = d(beamPixelAt(i, 160, 1.02, from, to, 'apply'));
    if (a1 > a0) outward++;
  }
  assert.ok(inward > 140, `extract: ${inward} of 160 move toward the muzzle`);
  assert.ok(outward > 140, `apply: ${outward} of 160 move toward the target`);
  for (let i = 0; i < 160; i++) assert.ok(d(beamPixelAt(i, 160, 3.3, from, to, 'sculpt')) <= Math.hypot(0, -1.2, 8) + 0.6);
  fx.set(new THREE.Vector3(...from), new THREE.Vector3(...to), 'apply', '#7cff4d', false);
  assert.equal(fx.object.visible, false);
  fx.set(new THREE.Vector3(...from), new THREE.Vector3(...to), 'apply', '#7cff4d', true);
  assert.equal(fx.object.visible, true);
  fx.dispose();
});

test('the same options build the same tool', () => {
  const pos = (t: ReturnType<typeof extractionBeam>): number[] => { const out: number[] = []; t.group.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if (g) { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i += 7) out.push(p.getX(i), p.getY(i), p.getZ(i)); } }); return out; };
  assert.deepEqual(pos(extractionBeam(m, { stage: 6 })), pos(extractionBeam(m, { stage: 6 })));
});

test('performance: the full-detail beam builds in under 60 ms', () => {
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) extractionBeam(m, { stage: 6 });
  assert.ok((performance.now() - t0) / 5 < 60, `${(performance.now() - t0) / 5} ms`);
});

test('the three screen pictograms contain no accidental all-black frame', () => {
  const t = extractionBeam(m, { stage: 6 });
  const screen = t.lamps.find((lamp) => ((lamp.material as THREE.MeshStandardMaterial).emissiveMap as THREE.DataTexture | null)?.isDataTexture);
  assert.ok(screen);
  const texture = (screen.material as THREE.MeshStandardMaterial).emissiveMap as THREE.DataTexture;
  t.setMode('extract');
  const first = Array.from(texture.image.data as Uint8Array).reduce((sum, value) => sum + value, 0);
  t.setMode('apply');
  const second = Array.from(texture.image.data as Uint8Array).reduce((sum, value) => sum + value, 0);
  t.setMode('sculpt');
  const third = Array.from(texture.image.data as Uint8Array).reduce((sum, value) => sum + value, 0);
  assert.ok(first > 100000 && second > 100000 && third > 100000);
  assert.notEqual(first, second);
  assert.notEqual(second, third);
});

test('the shader-backed effect clamps its pixel count and sculpt keeps a spiral around the line', () => {
  const fx = beamEffect({ pixels: 400 });
  const points = fx.object as THREE.Points;
  assert.equal(points.geometry.getAttribute('aPhase').count, 256);
  const a = beamPixelAt(12, 256, 2, [0, 0, 0], [0, 0, 4], 'sculpt');
  assert.ok(Math.hypot(a[0], a[1]) > 0);
  fx.dispose();
});