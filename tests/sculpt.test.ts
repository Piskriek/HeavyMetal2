/**
 * NewSculpt — the brushes, the welding, the documents and the sync, asserted headlessly on planes.
 *
 * What is checked, and why a track author would care:
 *  - **a dent is a dent**: raise moves what is under the brush, falls off to the rim, leaves the rest
 *    alone, and the normals follow the new slope;
 *  - **seams do not tear**: a non-indexed mesh (every triangle its own vertices, like a GLB with UV
 *    seams) moves as one surface, and its welded groups match the indexed plane's vertex count;
 *  - **smooth relaxes, flatten terraces**: measurable on a raised bump;
 *  - **transforms are respected**: a moved, scaled mesh finds the same vertices under a world-space brush;
 *  - **a sculpt survives a save**: extract → apply to a fresh copy → same shape within the quantum, same
 *    hash; reset puts the generated shape back exactly;
 *  - **paint is vertex colour**: the attribute appears, the material switches, colours round-trip;
 *  - **shared geometry is never touched**: wrapping clones, so a second copy of the same geometry is
 *    unchanged after the first is sculpted;
 *  - **sync applies and clears**: a prop with a document gets the shape; take the document away, and
 *    the geometry goes back — the undo path, headless.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { PlacedProp } from '../src/game/builder/prop-catalog';
import { DEFAULT_BRUSH, applyGrab, applyStamp, captureGrab, falloff, type BrushParams } from '../src/game/sculpt/sculpt-brushes';
import { decodeIndices, decodeInt16, encodeIndices, encodeInt16, isSculptDoc, makeSculptDoc, sculptDocBytes } from '../src/game/sculpt/sculpt-doc';
import { SculptMesh, meshKey, sculptableMeshes } from '../src/game/sculpt/sculpt-mesh';
import { SculptTool, type SculptHost } from '../src/game/sculpt/sculpt-tool';

/** A 20×20 plane in XY facing +Z, vertices on integer coordinates from −10 to 10. */
function plane(nonIndexed = false): THREE.Mesh {
  let geometry: THREE.BufferGeometry = new THREE.PlaneGeometry(20, 20, 20, 20);
  if (nonIndexed) geometry = geometry.toNonIndexed();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}

const VIEW = new THREE.Vector3(0, 0, -1);
const brush = (over: Partial<BrushParams>): BrushParams => ({ ...DEFAULT_BRUSH, radius: 3, strength: 1, hardness: 0, ...over });

function stamp(sm: SculptMesh, centre: THREE.Vector3, params: BrushParams, times = 1) {
  for (let i = 0; i < times; i++) {
    sm.syncMatrices();
    const hits = sm.query(centre, params.radius);
    sm.recomputeNormals(applyStamp({ mesh: sm, centre, viewDir: VIEW, params, hits }));
  }
  sm.finishStroke();
}

function vertexAt(sm: SculptMesh, x: number, y: number): number {
  for (let i = 0; i < sm.count; i++) if (Math.abs(sm.base[i * 3] - x) < 1e-6 && Math.abs(sm.base[i * 3 + 1] - y) < 1e-6) return i;
  throw new Error(`no vertex at ${x},${y}`);
}

test('falloff is 1 inside the hard core, 0 at the rim, monotone between', () => {
  assert.equal(falloff(0, 10, 0.5), 1);
  assert.equal(falloff(4.9, 10, 0.5), 1);
  assert.equal(falloff(10, 10, 0.5), 0);
  let last = 1;
  for (let d = 5; d <= 10; d += 0.5) { const f = falloff(d, 10, 0.5); assert.ok(f <= last); last = f; }
});

test('raise dents the plane under the brush, falls off to the rim, and re-normals the slope', () => {
  const mesh = plane();
  const sm = SculptMesh.wrap(mesh);
  const centre = new THREE.Vector3(0, 0, 0);
  const hits = sm.query(centre, 3);
  assert.ok(hits.length >= 25 && hits.every((h) => h.dist <= 3), `the query finds the disc (${hits.length})`);
  stamp(sm, centre, brush({ tool: 'raise' }));
  const z = (x: number, y: number) => sm.position.getZ(vertexAt(sm, x, y));
  assert.ok(z(0, 0) > 0.1, `the centre rose (${z(0, 0)})`);
  assert.ok(z(0, 0) >= z(1, 0) && z(1, 0) >= z(2, 0) && z(2, 0) > 0, 'height falls toward the rim');
  assert.equal(z(3, 0), 0, 'the rim is untouched');
  assert.equal(z(10, 10), 0, 'the corner is untouched');
  const n = new THREE.Vector3().fromBufferAttribute(sm.normal, vertexAt(sm, 2, 0));
  assert.ok(Math.abs(n.length() - 1) < 1e-5, 'unit normal');
  assert.ok(n.x > 0.01, `the slope's normal leans outward (${n.x.toFixed(3)})`);
  const flat = new THREE.Vector3().fromBufferAttribute(sm.normal, vertexAt(sm, 8, 8));
  assert.ok(Math.abs(flat.z - 1) < 1e-6, 'far away the normal is still straight up');
  assert.equal(sm.changedCount(1e-4), hits.filter((h) => falloff(h.dist, 3, 0) > 0).length, 'exactly the weighted vertices moved');
});

test('lower and Shift-raise push in; up and view directions are honoured', () => {
  const sm = SculptMesh.wrap(plane());
  stamp(sm, new THREE.Vector3(0, 0, 0), brush({ tool: 'lower' }));
  assert.ok(sm.position.getZ(vertexAt(sm, 0, 0)) < -0.1, 'lower digs');
  const sm2 = SculptMesh.wrap(plane());
  stamp(sm2, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise', invert: true }));
  assert.ok(sm2.position.getZ(vertexAt(sm2, 0, 0)) < -0.1, 'inverted raise digs');
  const sm3 = SculptMesh.wrap(plane());
  stamp(sm3, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise', direction: 'up' }));
  assert.ok(sm3.position.getY(vertexAt(sm3, 0, 0)) > 0.1 && Math.abs(sm3.position.getZ(vertexAt(sm3, 0, 0))) < 1e-9, 'world up moves y, not z');
  const sm4 = SculptMesh.wrap(plane());
  stamp(sm4, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise', direction: 'view' }));
  assert.ok(sm4.position.getZ(vertexAt(sm4, 0, 0)) > 0.1, 'toward the view (the camera looks down −z)');
});

test('a non-indexed mesh is welded: seams move together and the groups equal the indexed vertex count', () => {
  const sm = SculptMesh.wrap(plane(true));
  assert.equal(sm.groups.length, 21 * 21, 'welded to the indexed count');
  assert.ok(sm.count > sm.groups.length, 'from many more raw vertices');
  stamp(sm, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise' }), 3);
  for (const group of sm.groups) {
    const z0 = sm.position.getZ(group[0]);
    for (const v of group) assert.equal(sm.position.getZ(v), z0, 'every vertex of a welded group shares its height');
  }
  for (let i = 0; i < sm.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(sm.normal, i);
    assert.ok(Number.isFinite(n.x) && Math.abs(n.length() - 1) < 1e-5, 'normals stay finite and unit');
  }
});

test('smooth relaxes a bump, flatten terraces it, inflate and pinch move as advertised', () => {
  const sm = SculptMesh.wrap(plane());
  const c = new THREE.Vector3(0, 0, 0);
  stamp(sm, c, brush({ tool: 'raise', hardness: 0 }), 6);
  const peak = sm.position.getZ(vertexAt(sm, 0, 0));
  stamp(sm, c, brush({ tool: 'smooth', radius: 4 }), 12);
  const relaxed = sm.position.getZ(vertexAt(sm, 0, 0));
  assert.ok(relaxed < peak * 0.9, `smooth lowered the peak (${peak.toFixed(3)} → ${relaxed.toFixed(3)})`);

  const sf = SculptMesh.wrap(plane());
  stamp(sf, c, brush({ tool: 'raise' }), 6);
  const range = () => { let lo = Infinity, hi = -Infinity; for (const h of sf.query(c, 2.5)) { const z = sf.position.getZ(sf.groups[h.group][0]); lo = Math.min(lo, z); hi = Math.max(hi, z); } return hi - lo; };
  sf.syncMatrices();
  const before = range();
  stamp(sf, c, brush({ tool: 'flatten', hardness: 1 }), 10);
  sf.syncMatrices();
  assert.ok(range() < before * 0.3, `flatten shrank the height range (${before.toFixed(3)} → ${range().toFixed(3)})`);

  const si = SculptMesh.wrap(plane());
  stamp(si, c, brush({ tool: 'inflate' }));
  assert.ok(si.position.getZ(vertexAt(si, 0, 0)) > 0.05, 'inflate pushes along the normal');

  const sp = SculptMesh.wrap(plane());
  stamp(sp, c, brush({ tool: 'pinch', hardness: 1 }), 4);
  const x = sp.position.getX(vertexAt(sp, 2, 0));
  assert.ok(x < 2 && x > 0.5, `pinch slid the vertex toward the centre (${x.toFixed(3)})`);
});

test('noise is seeded and grab drags the area with the pointer', () => {
  const a = SculptMesh.wrap(plane()), b = SculptMesh.wrap(plane()), c2 = SculptMesh.wrap(plane());
  const c = new THREE.Vector3(0, 0, 0);
  stamp(a, c, brush({ tool: 'noise', seed: 3 }));
  stamp(b, c, brush({ tool: 'noise', seed: 3 }));
  stamp(c2, c, brush({ tool: 'noise', seed: 4 }));
  assert.deepEqual(Array.from(a.position.array as Float32Array), Array.from(b.position.array as Float32Array), 'same seed, same rock');
  assert.notDeepEqual(Array.from(a.position.array as Float32Array), Array.from(c2.position.array as Float32Array), 'another seed, another rock');
  assert.ok(a.changedCount(1e-4) > 0);

  const g = SculptMesh.wrap(plane());
  g.syncMatrices();
  const captured = captureGrab(g, g.query(c, 3), brush({ tool: 'grab', hardness: 1 }));
  applyGrab(captured, new THREE.Vector3(0, 0, 2));
  g.finishStroke();
  assert.ok(Math.abs(g.position.getZ(vertexAt(g, 0, 0)) - 2) < 1e-6, 'the centre followed the pointer');
  assert.equal(g.position.getZ(vertexAt(g, 5, 0)), 0, 'outside the brush nothing moved');
});

test('a moved, scaled mesh finds the same vertices under a world-space brush', () => {
  const plain = SculptMesh.wrap(plane());
  const n0 = plain.query(new THREE.Vector3(0, 0, 0), 3).length;
  const mesh = plane();
  mesh.position.set(100, -50, 7);
  mesh.scale.setScalar(2);
  mesh.updateMatrixWorld(true);
  const sm = SculptMesh.wrap(mesh);
  const hits = sm.query(new THREE.Vector3(100, -50, 7), 6);
  assert.equal(hits.length, n0, 'twice the radius on twice the scale: the same disc');
  stamp(sm, new THREE.Vector3(100, -50, 7), brush({ tool: 'raise', radius: 6 }));
  const z = sm.position.getZ(vertexAt(sm, 0, 0));
  assert.ok(z > 0.05, 'the displacement landed in local space');
  const world = sm.groupWorld(sm.groupOf[vertexAt(sm, 0, 0)], new THREE.Vector3());
  assert.ok(Math.abs(world.z - (7 + z * 2)) < 1e-4, 'and reads back scaled in world space');
});

test('the codecs round-trip and a document survives extract → apply, hash-stable; reset is exact', () => {
  const idx = [0, 1, 2, 130, 131, 5000, 70000];
  assert.deepEqual(Array.from(decodeIndices(encodeIndices(idx))), idx);
  const ints = [0, 1, -1, 32767, -32768, 1234];
  assert.deepEqual(Array.from(decodeInt16(encodeInt16(ints))), ints);

  const src = SculptMesh.wrap(plane());
  const c = new THREE.Vector3(1, -2, 0);
  stamp(src, c, brush({ tool: 'raise', radius: 4 }), 4);
  stamp(src, new THREE.Vector3(-4, 4, 0), brush({ tool: 'lower', radius: 3 }), 2);
  const part = src.extractDoc('0::441', 0.01);
  assert.ok(part && part.shape && !part.paint, 'shape only');
  const doc = makeSculptDoc([part!], 0.01)!;
  assert.ok(isSculptDoc(doc));
  assert.ok(sculptDocBytes(doc) < src.count * 10, `compact (${sculptDocBytes(doc)} bytes for ${src.changedCount(0.01)} vertices)`);

  const dst = SculptMesh.wrap(plane());
  assert.equal(dst.applyDoc(part!, 0.01), true);
  for (let i = 0; i < src.count; i++) {
    assert.ok(Math.abs(src.position.getZ(i) - dst.position.getZ(i)) <= 0.006, `vertex ${i} within the quantum`);
  }
  const again = dst.extractDoc('0::441', 0.01)!;
  assert.equal(makeSculptDoc([again], 0.01)!.hash, doc.hash, 'quantised once, the hash is stable');
  const n = new THREE.Vector3().fromBufferAttribute(dst.normal, vertexAt(dst, 3, -2));
  assert.ok(Math.abs(n.z - 1) > 0.001, 'applying a document recomputed the normals');

  const other = SculptMesh.wrap(new THREE.Mesh(new THREE.PlaneGeometry(20, 20, 10, 10)));
  assert.equal(other.applyDoc(part!, 0.01), false, 'a mesh of another size refuses the document');

  dst.reset();
  assert.ok(dst.isPristine(), 'reset is exact');
  assert.equal(dst.extractDoc('k'), null);
  assert.equal(dst.changedCount(), 0);
});

test('paint creates vertex colours, switches the material, and round-trips through a document', () => {
  const mesh = plane();
  const shared = mesh.material as THREE.MeshStandardMaterial;
  const sm = SculptMesh.wrap(mesh);
  assert.equal(sm.hasColor, false);
  stamp(sm, new THREE.Vector3(0, 0, 0), brush({ tool: 'paint', hardness: 1, color: [1, 0, 0] }));
  assert.equal(sm.hasColor, true);
  const colour = sm.geometry.getAttribute('color');
  const v = vertexAt(sm, 0, 0);
  assert.ok(Math.abs(colour.getX(v) - 1) < 1e-6 && Math.abs(colour.getY(v) - 0.5) < 1e-6, 'half-way to red in one stamp');
  assert.equal(colour.getY(vertexAt(sm, 9, 9)), 1, 'outside the brush still white');
  assert.notEqual(mesh.material, shared, 'the shared material was not touched');
  assert.equal((mesh.material as THREE.MeshStandardMaterial).vertexColors, true);
  assert.equal(shared.vertexColors, false);

  const part = sm.extractDoc('0::441')!;
  assert.ok(part.paint && !part.shape, 'paint only');
  const dst = SculptMesh.wrap(plane());
  assert.equal(dst.applyDoc(part), true);
  const c2 = dst.geometry.getAttribute('color');
  assert.ok(Math.abs(c2.getY(v) - 0.5) <= 1 / 255);
  stamp(sm, new THREE.Vector3(0, 0, 0), brush({ tool: 'paint', hardness: 1, invert: true }), 40);
  assert.ok(colour.getY(v) > 0.99, 'inverted paint returns to the generated colour');
});

test('wrapping clones: a second copy of the same geometry is untouched, and wrapping twice is a lookup', () => {
  const geometry = new THREE.PlaneGeometry(20, 20, 20, 20);
  const a = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const b = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  a.updateMatrixWorld(true); b.updateMatrixWorld(true);
  const sa = SculptMesh.wrap(a);
  assert.notEqual(a.geometry, geometry, 'a owns a clone');
  assert.equal(b.geometry, geometry, 'b still shares the original');
  stamp(sa, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise' }), 3);
  assert.equal(geometry.getAttribute('position').getZ(220), 0, 'the shared buffer never moved');
  assert.equal(SculptMesh.wrap(a), sa, 'the same wrapper again');
  assert.equal(SculptMesh.of(a), sa);
  assert.equal(SculptMesh.of(b), undefined);
  assert.equal(sculptableMeshes(a).length, 1);
  assert.equal(meshKey(0, a), '0::441');
});

test('sync applies a prop document to the live object and clears it when the document goes (the undo path)', () => {
  const scene = new THREE.Scene();
  const mesh = plane();
  scene.add(mesh);
  const src = SculptMesh.wrap(plane());
  stamp(src, new THREE.Vector3(0, 0, 0), brush({ tool: 'raise' }), 4);
  const doc = makeSculptDoc([src.extractDoc(meshKey(0, mesh))!])!;
  const props: PlacedProp[] = [{ id: 'p1', type: 'kit_rock', name: 'Rock', x: 0, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false, sculpt: doc }];
  const commits: (string | null)[] = [];
  const host: SculptHost = {
    getProps: () => props,
    sculptObjectFor: (id) => (id === 'p1' ? mesh : null),
    isSculptLocked: () => false,
    pickTerrain: () => null,
    beginSculpt: () => {},
    commitSculpt: (_id, d) => { commits.push(d ? d.hash : null); },
    onChange: () => () => {},
  };
  const tool = new SculptTool(host, scene, new THREE.PerspectiveCamera(), null);
  const sm = SculptMesh.of(mesh)!;
  assert.ok(sm.position.getZ(vertexAt(sm, 0, 0)) > 0.1, 'the document was applied on construction');
  assert.equal(tool.describe('p1')!.changed, src.changedCount());
  assert.equal(tool.sculpted().length, 1);

  delete props[0].sculpt;
  tool.sync();
  assert.ok(sm.isPristine(), 'no document, generated shape');
  assert.equal(tool.sculpted().length, 0);

  props[0].sculpt = doc;
  tool.sync();
  assert.ok(sm.position.getZ(vertexAt(sm, 0, 0)) > 0.1, 'and back again (redo)');
  assert.equal(tool.reset('p1'), true);
  assert.deepEqual(commits, [null], 'reset committed an empty document');
  assert.ok(sm.isPristine());
  tool.dispose();
  assert.equal(scene.children.length, 1, 'dispose took the cursor ring out and left the mesh');
});

test('a unit-sized model scaled up (the island terrain, 50 000×) keeps a small stroke through save and load', () => {
  const make = () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 8), new THREE.MeshStandardMaterial());
    mesh.scale.setScalar(50000);
    mesh.updateMatrixWorld(true);
    return SculptMesh.wrap(mesh);
  };
  const sm = make();
  // Lift one vertex by 150 world units: 0.003 in the mesh's own units, far under the 0.25 world quantum.
  sm.position.setZ(40, sm.position.getZ(40) + 150 / 50000);
  const q = sm.localQuantum();
  assert.ok(Math.abs(q - 0.25 / 50000) < 1e-12, 'a quarter world unit at this scale');
  const doc = sm.extractDoc(meshKey(0, sm.mesh), q);
  assert.ok(doc, 'the stroke is not rounded away');
  const back = make();
  assert.ok(back.applyDoc(doc!), 'the saved offsets fit a fresh copy');
  assert.ok(Math.abs((back.position.getZ(40) - sm.position.getZ(40)) * 50000) <= 0.125 + 1e-6, 'restored to within half a world quantum');
});
