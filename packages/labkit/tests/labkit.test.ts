import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createMaterials,
  gate,
  relayCabinet,
  breakerPanel,
  capacitorBank,
  operatorConsole,
  controlBox,
  floorCover,
  cableTray,
  planetTable,
  presetRack,
  presetBench,
  presetCombiner,
  textureMill,
  triangles,
  setLamp,
  type Prop,
} from '../src/index';

const m = createMaterials();
const box = (p: Prop) => new THREE.Box3().setFromObject(p.group);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('every prop stands on the floor and has a collider', () => {
  const props: Prop[] = [
    gate(m),
    gate(m, { twin: true, stage: 1 }),
    relayCabinet(m),
    breakerPanel(m),
    capacitorBank(m),
    operatorConsole(m),
    controlBox(m),
    planetTable(m),
    presetRack(m),
    presetBench(m),
    presetCombiner(m),
    textureMill(m),
    textureMill(m, { stage: 1 }),
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
  for (let i = 0; i < uv.count; i++) {
    lo = Math.min(lo, uv.getX(i));
    hi = Math.max(hi, uv.getX(i));
  }
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

test('real equipment, not blocks: full-detail props are detailed and cheap to draw', () => {
  const meshes = (p: Prop) => {
    let n = 0;
    p.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++;
    });
    return n;
  };
  const g = gate(m);
  const full: [string, Prop, number, number][] = [
    ['gate', g, 6000, g.coils.length],
    ['capacitorBank', capacitorBank(m), 3000, 0],
    ['operatorConsole', operatorConsole(m), 2500, 0],
    ['textureMill', textureMill(m, { stage: 6 }), 2500, 0],
    ['relayCabinet', relayCabinet(m), 1500, 0],
    ['breakerPanel', breakerPanel(m), 1500, 0],
    ['planetTable', planetTable(m), 1500, 0],
    ['presetBench', presetBench(m), 1500, 0],
    ['presetCombiner', presetCombiner(m), 1500, 0],
    ['controlBox', controlBox(m), 600, 0],
  ];
  for (const [name, p, least, coils] of full) {
    assert.ok(triangles(p) >= least, `${name}: ${triangles(p)} triangles, at least ${least}`);
    assert.ok(
      meshes(p) <= 16 + p.lamps.length + coils,
      `${name}: ${meshes(p)} meshes (merge static parts by material)`
    );
  }
  const twin1 = gate(m, { twin: true, stage: 1 });
  const twin6 = gate(m, { twin: true, stage: 6 });
  assert.ok(triangles(twin1) * 4 <= triangles(twin6), 'stage 1 is chunky: at most a quarter of stage 6');
});

test('determinism: builders with identical input produce identical triangle counts', () => {
  const g1 = gate(m);
  const g2 = gate(m);
  assert.equal(triangles(g1), triangles(g2));

  const cb1 = capacitorBank(m);
  const cb2 = capacitorBank(m);
  assert.equal(triangles(cb1), triangles(cb2));

  const fc1 = floorCover(m, [[0, 0], [2, 0]]);
  const fc2 = floorCover(m, [[0, 0], [2, 0]]);
  assert.equal(triangles(fc1), triangles(fc2));
});

test('budgets: all props remain under maximum triangle thresholds', () => {
  assert.ok(triangles(gate(m)) <= 16000, 'gate full <= 16000');
  assert.ok(triangles(gate(m, { twin: true, stage: 1 })) <= 2000, 'gate twin stage 1 <= 2000');
  assert.ok(triangles(textureMill(m, { stage: 6 })) <= 6000, 'texture mill stage 6 <= 6000');
  assert.ok(triangles(textureMill(m, { stage: 1 })) <= 800, 'texture mill stage 1 <= 800');
  assert.ok(triangles(relayCabinet(m)) <= 8000, 'relay cabinet <= 8000');
  assert.ok(triangles(breakerPanel(m)) <= 8000, 'breaker panel <= 8000');
  assert.ok(triangles(capacitorBank(m)) <= 8000, 'capacitor bank <= 8000');
  assert.ok(triangles(operatorConsole(m)) <= 8000, 'operator console <= 8000');
  assert.ok(triangles(controlBox(m)) <= 8000, 'control box <= 8000');
  assert.ok(triangles(planetTable(m)) <= 8000, 'planet table <= 8000');
  assert.ok(triangles(presetBench(m)) <= 8000, 'preset bench <= 8000');
  assert.ok(triangles(presetCombiner(m)) <= 8000, 'preset combiner <= 8000');
  const fc = floorCover(m, [[0, 0], [10, 0]]);
  assert.ok(triangles(fc) / 10 <= 400, 'floor cover <= 400 per metre');
});

test('sockets exist and are positioned reasonably within or near bounds', () => {
  const g = gate(m);
  const b = box(g);
  for (const s of g.sockets) {
    assert.ok(s.at[0] >= b.min.x - 0.2 && s.at[0] <= b.max.x + 0.2);
    assert.ok(s.at[1] >= b.min.y - 0.2 && s.at[1] <= b.max.y + 0.2);
    assert.ok(s.at[2] >= b.min.z - 0.2 && s.at[2] <= b.max.z + 0.2);
  }
});

test('the gate is a doorway: no collider stands in its opening, so you can walk through', () => {
  for (const g of [gate(m), gate(m, { twin: true, stage: 1 })]) {
    const half = g.opening.width / 2;
    for (const c of g.colliders) assert.ok(c.max[0] <= -half + 1e-6 || c.min[0] >= half - 1e-6, JSON.stringify(c));
  }
});
