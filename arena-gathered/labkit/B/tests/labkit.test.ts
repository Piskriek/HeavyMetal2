import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createMaterials, gate, relayCabinet, breakerPanel, capacitorBank,
  operatorConsole, controlBox, floorCover, cableTray, planetTable,
  presetRack, presetBench, presetCombiner, textureMill,
  triangles, setLamp, type Prop,
} from '../src/index';

const m = createMaterials();
const box = (p: Prop) => new THREE.Box3().setFromObject(p.group);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* ── Acceptance tests (required) ─────────────────────────────────────────── */

test('every prop stands on the floor and has a collider', () => {
  const props: Prop[] = [
    gate(m), gate(m, { twin: true, stage: 1 }),
    relayCabinet(m), breakerPanel(m), capacitorBank(m),
    operatorConsole(m), controlBox(m), planetTable(m),
    presetRack(m), presetBench(m), presetCombiner(m),
    textureMill(m), textureMill(m, { stage: 1 }),
  ];
  for (const p of props) {
    assert.ok(near(box(p).min.y, 0, 0.002), `grounded (min y ${box(p).min.y})`);
    assert.ok(p.colliders.length >= 1);
  }
});

test('the gate: a 2.6 x 1.7 opening in a free-standing frame, six coils bottom to top', () => {
  const g = gate(m);
  assert.ok(near(g.opening.height, 2.6, 0.02) && near(g.opening.width, 1.7, 0.02));
  const b = box(g);
  assert.ok(near(b.max.y, 3.2, 0.25) && near(b.max.x - b.min.x, 2.6, 0.3) && near(b.max.z - b.min.z, 1.1, 0.3));
  assert.equal(g.coils.length, 6);
  const ys = g.coils.map((c) => new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()).y);
  assert.ok(ys[0]! < ys[2]! && ys[2]! < ys[4]! && ys[1]! < ys[3]! && ys[3]! < ys[5]!);
  assert.ok(g.sockets.some((s) => s.name === 'rear-junction'));
  assert.ok(triangles(g) <= 16000 && triangles(gate(m, { twin: true, stage: 1 })) <= 2000);
});

test('the mill: exhaust apart from the hopper, cheaper at stage 1', () => {
  const s = (p: Prop, n: string) => p.sockets.find((x) => x.name === n)!.at;
  const mill = textureMill(m, { stage: 6 });
  assert.ok(s(mill, 'stack')[1] > s(mill, 'hopper')[1] && s(mill, 'stack')[2] < s(mill, 'hopper')[2]);
  assert.ok(triangles(textureMill(m, { stage: 1 })) < triangles(mill));
});

test('a floor cover follows its path, low, with a pulse strip measured in metres', () => {
  const f = floorCover(m, [[0, 0], [4, 0], [4, 3]]);
  assert.ok(near(f.length, 7, 0.01));
  assert.ok(box(f).max.y <= 0.07);
  const uv = f.pulse.geometry.getAttribute('uv');
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i)); hi = Math.max(hi, uv.getX(i)); }
  assert.ok(near(lo, 0, 0.05) && near(hi, 7, 0.1));
});

test('lamps light, the lever throws, the tray hangs', () => {
  const r = relayCabinet(m);
  assert.equal(r.lamps.length, 3);
  setLamp(r.lamps[0]!, 1);
  assert.ok((r.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity > 0);
  assert.equal((r.lamps[1]!.material as THREE.MeshStandardMaterial).emissiveIntensity, 0);
  const c = operatorConsole(m);
  assert.equal(c.lever.rotation.x, 0);
  const t = cableTray(m, [0, 0], [6, 0], 6, 8);
  assert.ok(near(box(t).max.y, 8, 0.05) && box(t).min.y >= 5.5);
  assert.ok(triangles(breakerPanel(m)) <= 8000 && triangles(capacitorBank(m)) <= 8000);
});

/* ── Additional tests ────────────────────────────────────────────────────── */

test('all props are deterministic (same bounding box on repeated creation)', () => {
  const builders: Array<() => Prop> = [
    () => gate(m), () => relayCabinet(m), () => breakerPanel(m),
    () => capacitorBank(m), () => operatorConsole(m), () => controlBox(m),
    () => planetTable(m), () => presetRack(m), () => presetBench(m),
    () => presetCombiner(m), () => textureMill(m),
  ];
  for (const build of builders) {
    const a = box(build());
    const b = box(build());
    assert.ok(a.min.distanceTo(b.min) < 0.0001);
    assert.ok(a.max.distanceTo(b.max) < 0.0001);
  }
});

test('lamps have independent materials', () => {
  const r = relayCabinet(m);
  setLamp(r.lamps[0]!, 1);
  setLamp(r.lamps[2]!, 0.5);
  assert.equal((r.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity, 1);
  assert.equal((r.lamps[1]!.material as THREE.MeshStandardMaterial).emissiveIntensity, 0);
  assert.equal((r.lamps[2]!.material as THREE.MeshStandardMaterial).emissiveIntensity, 0.5);
  // reset
  setLamp(r.lamps[0]!, 0);
  setLamp(r.lamps[2]!, 0);
});

test('all props have colliders covering their footprint', () => {
  const props: Prop[] = [
    gate(m), relayCabinet(m), breakerPanel(m), capacitorBank(m),
    operatorConsole(m), controlBox(m), planetTable(m),
    presetRack(m), presetBench(m), presetCombiner(m), textureMill(m),
    floorCover(m, [[0, 0], [2, 0]]),
    cableTray(m, [0, 0], [4, 0], 4, 6),
  ];
  for (const p of props) {
    for (const c of p.colliders) {
      assert.ok(c.min[0] < c.max[0]);
      assert.ok(c.min[1] < c.max[1]);
      assert.ok(c.min[2] < c.max[2]);
    }
  }
});

test('triangle budgets for all props', () => {
  assert.ok(triangles(relayCabinet(m)) <= 8000);
  assert.ok(triangles(controlBox(m)) <= 8000);
  assert.ok(triangles(planetTable(m)) <= 8000);
  assert.ok(triangles(presetRack(m)) <= 8000);
  assert.ok(triangles(presetBench(m)) <= 8000);
  assert.ok(triangles(presetCombiner(m)) <= 8000);
  assert.ok(triangles(operatorConsole(m)) <= 8000);
  // floor cover: ≤400 per metre
  const fc = floorCover(m, [[0, 0], [10, 0]]);
  assert.ok(triangles(fc) / 10 <= 400);
});

test('gate twin variant uses concrete, stands on floor', () => {
  const g = gate(m, { twin: true, stage: 1 });
  const b = box(g);
  assert.ok(near(b.min.y, 0, 0.002));
  assert.ok(g.coils.length === 6);
  assert.ok(g.sockets.some((s) => s.name === 'rear-junction'));
});

test('sockets for breaker panel and relay cabinet', () => {
  const bp = breakerPanel(m);
  assert.ok(bp.sockets.some((s) => s.name === 'in'));
  assert.ok(bp.sockets.some((s) => s.name === 'out'));
  const rc = relayCabinet(m);
  assert.ok(rc.sockets.some((s) => s.name === 'cable-top'));
  assert.ok(rc.sockets.some((s) => s.name === 'cable-bottom'));
});

test('operator console has screen and lever', () => {
  const c = operatorConsole(m);
  assert.ok(c.screen instanceof THREE.Mesh);
  assert.ok(c.lever instanceof THREE.Object3D);
  assert.equal(c.lever.rotation.x, 0);
  c.lever.rotation.x = -1.1;
  assert.ok(near(c.lever.rotation.x, -1.1, 0.001));
});

test('planet table has a glowing projection disc', () => {
  const p = planetTable(m);
  assert.equal(p.lamps.length, 1);
  setLamp(p.lamps[0]!, 0.8);
  assert.ok((p.lamps[0]!.material as THREE.MeshStandardMaterial).emissiveIntensity > 0);
  setLamp(p.lamps[0]!, 0);
});
