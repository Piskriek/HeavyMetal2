import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, rockDrill, shapePress, lightProjector, waterMaker, powerUnit, relayPylon, cableSpan, triangles, setLamp, type Prop } from '../src/index';

const m = createMaterials();
const box = (p: Prop) => new THREE.Box3().setFromObject(p.group);
const at = (p: Prop, n: string) => { const s = p.sockets.find((x) => x.name === n); assert.ok(s, `socket ${n}`); return s!.at; };
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const builders = { drill: rockDrill, press: shapePress, projector: lightProjector, water: waterMaker, power: powerUnit, pylon: relayPylon };

test('all six stand on the ground, with colliders, power in low, cheap at stage 1', () => {
  for (const [name, make] of Object.entries(builders)) {
    const p6 = make(m), p1 = make(m, { stage: 1 });
    for (const p of [p6, p1]) {
      assert.ok(Math.abs(box(p).min.y) <= 0.002, `${name} grounded (min y ${box(p).min.y})`);
      assert.ok(p.colliders.length >= 1, `${name} colliders`);
    }
    const t6 = triangles(p6), t1 = triangles(p1);
    const [lo, hi, s1] = name === 'pylon' ? [600, 5000, 800] : [1500, 8000, 1200];
    assert.ok(t6 >= lo && t6 <= hi, `${name} stage 6: ${t6}`);
    assert.ok(t1 <= s1 && t1 * 2 <= t6, `${name} stage 1: ${t1}`);
    if (name !== 'pylon') assert.ok(at(p6, name === 'power' ? 'out' : 'power')[1] < 0.9, `${name} power comes in low`);
  }
});

test('pixels come out of a vent apart from the feed, higher up', () => {
  for (const make of [shapePress, waterMaker]) {
    const p = make(m);
    const feed = at(p, 'feed'), vent = at(p, 'vent');
    assert.ok(dist(feed, vent) >= 0.6 && vent[1] > feed[1], 'the vent is apart from and above the feed');
  }
  const pr = lightProjector(m);
  assert.ok(at(pr, 'vent')[1] > 1.5, 'the projector vents from its head');
  assert.ok(at(rockDrill(m), 'tray')[2] > 0.2, 'the drill drops ore at the front');
  assert.ok(at(powerUnit(m), 'steam')[1] > 1.0, 'steam leaves from the top');
});

test('sizes, moving parts and the pylon\'s line', () => {
  const d = rockDrill(m); assert.ok(box(d).max.y >= 2.4 && box(d).max.y <= 4.5, `drill height ${box(d).max.y}`);
  assert.ok(d.bit.parent !== null);
  const pr = shapePress(m); assert.ok(pr.rams.length === 2);
  const lp = lightProjector(m); assert.ok(box(lp).max.y >= 2.2 && box(lp).max.y <= 4.0, `projector height ${box(lp).max.y}`);
  const py = relayPylon(m);
  assert.ok(box(py).max.y >= 5 && box(py).max.y <= 8.5, `pylon height ${box(py).max.y}`);
  assert.ok(py.top[1] >= 4.5 && dist(py.top, at(py, 'top')) < 0.01);
  at(py, 'box');
  const span = cableSpan(m, [0, 6, 0], [30, 6, 0], 1.2);
  const sb = new THREE.Box3().setFromObject(span);
  assert.ok(sb.min.y <= 6 - 1.0 && sb.min.y >= 6 - 1.6, `the span sags (lowest ${sb.min.y})`);
  assert.ok(sb.max.x >= 29.9 && sb.min.x <= 0.1, 'from one end to the other');
});

test('builds are deterministic: identical geometry, sockets and counts', () => {
  const geomHash = (p: Prop): number => {
    let h = 7;
    p.group.traverse((o) => {
      const ms = o as THREE.Mesh;
      if (!ms.isMesh) return;
      const pos = ms.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 7) {
        h = (h * 31 + Math.round(pos.getX(i) * 1e4) + Math.round(pos.getY(i) * 1e4) + Math.round(pos.getZ(i) * 1e4)) | 0;
      }
    });
    return h;
  };
  const socketSig = (p: Prop) => p.sockets.map((s) => `${s.name}:${s.at[0]},${s.at[1]},${s.at[2]}`).join('|');
  for (const [name, make] of Object.entries(builders)) {
    const a = make(m), b = make(m);
    assert.equal(triangles(a), triangles(b), `${name} triangle count`);
    assert.equal(socketSig(a), socketSig(b), `${name} sockets`);
    assert.equal(geomHash(a), geomHash(b), `${name} merged geometry`);
  }
  const s1a = cableSpan(m, [0, 6, 0], [30, 6, 0], 1.2), s1b = cableSpan(m, [0, 6, 0], [30, 6, 0], 1.2);
  assert.equal(s1a.geometry.attributes.position.count, s1b.geometry.attributes.position.count, 'span count');
});

test('every socket sits inside its machine bounding box', () => {
  for (const [name, make] of Object.entries(builders)) {
    const p = make(m);
    const b = box(p).clone().expandByScalar(0.05);
    for (const s of p.sockets) {
      const v = new THREE.Vector3(s.at[0], s.at[1], s.at[2]);
      assert.ok(b.containsPoint(v), `${name} socket ${s.name} inside bounds`);
    }
  }
});

test('the named moving parts actually move', () => {
  const changed = (o: THREE.Object3D, apply: (o: THREE.Object3D) => void, revert: (o: THREE.Object3D) => void): boolean => {
    const before = o.matrixWorld.clone();
    apply(o);
    o.updateWorldMatrix(true, true);
    const diff = !o.matrixWorld.equals(before);
    revert(o);
    o.updateWorldMatrix(true, true);
    return diff;
  };
  const d = rockDrill(m);
  assert.ok(d.bit.parent !== null, 'bit is mounted');
  assert.ok(changed(d.bit, (o) => { o.rotation.y += 0.7; }, (o) => { o.rotation.y -= 0.7; }), 'drill bit spins about y');
  const pr = shapePress(m);
  for (const r of pr.rams) {
    assert.ok(r.parent !== null, 'ram is mounted');
    assert.ok(changed(r, (o) => { o.position.y += 0.1; }, (o) => { o.position.y -= 0.1; }), 'ram lifts');
  }
  const lp = lightProjector(m);
  assert.ok(lp.head.parent !== null, 'head is mounted');
  assert.ok(changed(lp.head, (o) => { o.rotation.x += 0.2; }, (o) => { o.rotation.x -= 0.2; }), 'projector head tilts about x');
});

test('stage 1 machines are flat shaded, stage 6 smooth', () => {
  for (const [name, make] of Object.entries(builders)) {
    const p1 = make(m, { stage: 1 });
    let meshes1 = 0;
    p1.group.traverse((o) => {
      const ms = o as THREE.Mesh;
      if (!ms.isMesh) return;
      meshes1 += 1;
      assert.ok((ms.material as THREE.MeshStandardMaterial).flatShading === true, `${name} stage 1 flat (${ms.name ?? 'mesh'})`);
    });
    assert.ok(meshes1 > 0, `${name} has meshes`);
    const p6 = make(m);
    let smooth = 0;
    p6.group.traverse((o) => {
      const ms = o as THREE.Mesh;
      if (ms.isMesh && (ms.material as THREE.MeshStandardMaterial).flatShading === false) smooth += 1;
    });
    assert.ok(smooth > 0, `${name} stage 6 uses smooth shading`);
  }
});

test('lamps glow with setLamp and can be switched off', () => {
  for (const [name, make] of Object.entries(builders)) {
    const p = make(m);
    assert.ok(p.lamps.length >= 1, `${name} has a lamp`);
    for (const lamp of p.lamps) {
      const mat = lamp.material as THREE.MeshStandardMaterial;
      assert.ok(mat.emissiveIntensity > 0, `${name} lamp starts on`);
      setLamp(lamp, 1);
      assert.ok(mat.emissiveIntensity > 0.9, `${name} lamp glow at 1`);
      setLamp(lamp, 0);
      assert.equal(mat.emissiveIntensity, 0, `${name} lamp glow at 0`);
      setLamp(lamp, 2);
      assert.ok(mat.emissiveIntensity <= 1, `${name} lamp clamped`);
    }
  }
});

test('each machine stays within its mesh budget (16 static + lamps + movers)', () => {
  const meshCount = (root: THREE.Object3D): number => {
    let n = 0;
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) n += 1; });
    return n;
  };
  const d = rockDrill(m);
  assert.ok(meshCount(d.group) - d.lamps.length - meshCount(d.bit) <= 16, `drill ${meshCount(d.group)}`);
  const pr = shapePress(m);
  assert.ok(meshCount(pr.group) - pr.lamps.length - pr.rams.reduce((a, r) => a + meshCount(r), 0) <= 16, `press ${meshCount(pr.group)}`);
  const lp = lightProjector(m);
  assert.ok(meshCount(lp.group) - lp.lamps.length - meshCount(lp.head) <= 16, `projector ${meshCount(lp.group)}`);
  for (const [name, p] of [['water', waterMaker(m)], ['power', powerUnit(m)], ['pylon', relayPylon(m)]] as [string, Prop][]) {
    assert.ok(meshCount(p.group) - p.lamps.length <= 16, `${name} ${meshCount(p.group)}`);
  }
});

test('all six build in under 80 ms', () => {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 3; i++) {
    rockDrill(m); shapePress(m); lightProjector(m); waterMaker(m); powerUnit(m); relayPylon(m);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 3;
  assert.ok(ms < 80, `average build time ${ms.toFixed(1)} ms`);
});
