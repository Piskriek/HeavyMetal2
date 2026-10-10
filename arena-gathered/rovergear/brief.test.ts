import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, fabricator, scout, hauler, crawler, setLamp, triangles, type Rover } from '../src/index';
const m = createMaterials(), bb = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const has = (s: { sockets: { name: string }[] }, ...n: string[]) => n.forEach((x) => assert.ok(s.sockets.some((k) => k.name === x), x));
test('rovers fit their hubs and lengths; the fabricator stands on its ring', () => {
  for (const stage of [1, 6]) {
    const o = { stage }, r: Record<string, Rover> = { scout: scout(m, o), hauler: hauler(m, o), crawler: crawler(m, o) };
    for (const [k, v] of Object.entries(r)) {
      const tri = triangles(v.body) + (v.wheel ? triangles(v.wheel) * v.hubs.length : 0); assert.ok(tri > 0 && tri <= (stage === 1 ? 1500 : 12000), `${k} s${stage}: ${tri}`);
      assert.ok(v.body.children.length <= 8 && v.colliders.length > 0 && v.lamps.length >= 2, k); has(v, 'seat'); setLamp(v.lamps[0]!, 1);
      if (v.wheel) { const w = bb(v.wheel); assert.ok(Math.abs(w.max.y - v.wheelRadius) < 0.08 && Math.abs(w.min.y + v.wheelRadius) < 0.08, `${k} wheel radius`); }
    }
    assert.equal(r.scout!.hubs.length, 4); assert.equal(r.hauler!.hubs.length, 6); assert.equal(r.crawler!.wheel, null);
    const len = (v: Rover) => { const b = bb(v.body); return b.max.z - b.min.z; };
    assert.ok(len(r.scout!) > 2.6 && len(r.scout!) < 3.8); assert.ok(len(r.hauler!) > 5.2 && len(r.hauler!) < 6.8); assert.ok(len(r.crawler!) > 6 && len(r.crawler!) < 8);
    has(r.hauler!, 'dish'); has(r.crawler!, 'drill', 'mast'); assert.ok(r.crawler!.parts['arm']);
    const f = fabricator(m, o), fb = bb(f.group); assert.ok(fb.min.y >= -0.02 && fb.max.y > 4.2 && fb.max.y < 6.2 && fb.min.x >= -4 && fb.max.x <= 4 && fb.min.z >= -4 && fb.max.z <= 4);
    has(f, 'bed', 'power'); assert.ok(f.parts['head'] && triangles(f.group) <= (stage === 1 ? 1500 : 10000));
  }
});
