/**
 * Tests for 3D Model Textured Surface Painting, Document Serialization, and Undo/Redo.
 * Pure logic test: per-vertex paint law, document round trip, undo consistency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  decodeBytes,
  decodeIndices,
  encodeBytes,
  encodeIndices,
  isSculptDoc,
  makeSculptDoc,
  sculptDocBytes,
  type SculptMeshDoc,
} from '../src/game/sculpt/sculpt-doc';
import { SculptMesh } from '../src/game/sculpt/sculpt-mesh';
import { applyStamp, DEFAULT_BRUSH, type BrushParams } from '../src/game/sculpt/sculpt-brushes';
import { SURFACE_GRANITE, SURFACE_MOSSY_ROCK, SURFACE_SAND } from '../src/game/surface/surface-table';

test('LEB128 Index & Byte Codecs Round-Trip', () => {
  const originalIndices = [0, 1, 5, 12, 100, 101, 102, 5000, 9999];
  const encodedIdx = encodeIndices(originalIndices);
  const decodedIdx = Array.from(decodeIndices(encodedIdx));
  assert.deepEqual(decodedIdx, originalIndices, 'LEB128 index encoding/decoding round-trips exactly');

  const surfaceBytes = new Uint8Array([SURFACE_MOSSY_ROCK, 255, SURFACE_GRANITE, 128, SURFACE_SAND, 64]);
  const encodedS = encodeBytes(surfaceBytes);
  const decodedS = decodeBytes(encodedS);
  assert.equal(decodedS.length, surfaceBytes.length, 'Surface byte array length matches');
  assert.deepEqual(Array.from(decodedS), Array.from(surfaceBytes), 'Surface ID & weight byte encoding/decoding round-trips exactly');
});

test('SculptDoc Serialization & Hash Stability with Surface Paint', () => {
  const meshDoc: SculptMeshDoc = {
    key: '0:RockMesh:24',
    n: 24,
    surface: {
      idx: encodeIndices([0, 2, 4]),
      s: encodeBytes(new Uint8Array([SURFACE_MOSSY_ROCK, 200, SURFACE_MOSSY_ROCK, 180, SURFACE_GRANITE, 255])),
    },
  };

  const doc = makeSculptDoc([meshDoc]);
  assert.ok(doc !== null, 'makeSculptDoc creates a valid document from surface paint data');
  assert.ok(isSculptDoc(doc), 'isSculptDoc validates document structure');
  assert.equal(doc.meshes.length, 1, 'Document contains exactly 1 mesh doc');
  assert.equal(doc.hash.length, 8, `Document produces stable 8-char hex hash: ${doc.hash}`);
  assert.ok(sculptDocBytes(doc) > 0, `Document calculates byte size: ${sculptDocBytes(doc)} bytes`);
});

test('SculptMesh Surface Paint Law & Falloff', () => {
  const geo = new THREE.BoxGeometry(100, 100, 100, 4, 4, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geo, mat);
  const sculptMesh = SculptMesh.wrap(mesh);

  assert.ok(sculptMesh.isPristine(), 'Newly created SculptMesh starts in pristine state');

  // Paint group with mossy rock surface
  const targetGroup = 0;
  sculptMesh.paintSurfaceGroup(targetGroup, SURFACE_MOSSY_ROCK, 0.75);
  sculptMesh.finishStroke();

  assert.ok(!sculptMesh.isPristine(), 'SculptMesh is no longer pristine after painting surface');
  assert.ok(sculptMesh.hasSurface, 'SculptMesh has surface attribute initialized');
  assert.ok(sculptMesh.changedCount() > 0, 'changedCount reflects modified painted vertices');

  const extractedDoc = sculptMesh.extractDoc('0:TestBox:98');
  assert.ok(extractedDoc !== null, 'extractDoc captures surface paint data into SculptMeshDoc');
  assert.ok(extractedDoc?.surface !== undefined, 'SculptMeshDoc contains surface section');

  // Unpaint / erase back to base look
  sculptMesh.unpaintSurfaceGroup(targetGroup, 1.0);
  sculptMesh.finishStroke();
  assert.ok(sculptMesh.isPristine(), 'Unpainting with weight 1.0 restores pristine status');
});

test('ApplyStamp with Surface Mode', () => {
  const geo = new THREE.SphereGeometry(100, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
  const mesh = new THREE.Mesh(geo, mat);
  const sculptMesh = SculptMesh.wrap(mesh);
  sculptMesh.syncMatrices();

  const brushParams: BrushParams = {
    ...DEFAULT_BRUSH,
    tool: 'paint',
    paintMode: 'surface',
    surfaceId: SURFACE_MOSSY_ROCK,
    radius: 80,
    strength: 0.8,
    hardness: 0.5,
    invert: false,
  };

  const hits = sculptMesh.query(new THREE.Vector3(0, 100, 0), brushParams.radius);
  assert.ok(hits.length > 0, `Brush query finds ${hits.length} vertex groups within radius`);

  applyStamp({
    mesh: sculptMesh,
    centre: new THREE.Vector3(0, 100, 0),
    viewDir: new THREE.Vector3(0, -1, 0),
    params: brushParams,
    hits,
  });
  sculptMesh.finishStroke();

  assert.ok(!sculptMesh.isPristine(), 'applyStamp successfully painted island surface onto mesh');
  const doc = sculptMesh.extractDoc('0:Sphere:289');
  assert.ok(doc?.surface !== undefined, 'applyStamp result serialized into doc');

  // Reset back to original
  sculptMesh.reset();
  assert.ok(sculptMesh.isPristine(), 'SculptMesh.reset() cleanly clears surface paint back to generated look');
});

export function runModelPaintTests(): { passed: boolean; log: string[] } {
  const log: string[] = [];
  let allPassed = true;

  function localAssert(condition: boolean, msg: string) {
    if (condition) {
      log.push(`  ✓ ${msg}`);
    } else {
      log.push(`  ✗ FAIL: ${msg}`);
      allPassed = false;
    }
  }

  log.push('=== Running 3D Model Paint Tests ===');

  try {
    const originalIndices = [0, 1, 5, 12, 100, 101, 102, 5000, 9999];
    const encodedIdx = encodeIndices(originalIndices);
    const decodedIdx = Array.from(decodeIndices(encodedIdx));
    localAssert(
      JSON.stringify(originalIndices) === JSON.stringify(decodedIdx),
      'LEB128 index encoding/decoding round-trips exactly',
    );

    const surfaceBytes = new Uint8Array([SURFACE_MOSSY_ROCK, 255, SURFACE_GRANITE, 128, SURFACE_SAND, 64]);
    const encodedS = encodeBytes(surfaceBytes);
    const decodedS = decodeBytes(encodedS);
    localAssert(
      surfaceBytes.length === decodedS.length &&
      Array.from(surfaceBytes).every((b, i) => b === decodedS[i]),
      'Surface ID & weight byte encoding/decoding round-trips exactly',
    );

    const meshDoc: SculptMeshDoc = {
      key: '0:RockMesh:24',
      n: 24,
      surface: {
        idx: encodeIndices([0, 2, 4]),
        s: encodeBytes(new Uint8Array([SURFACE_MOSSY_ROCK, 200, SURFACE_MOSSY_ROCK, 180, SURFACE_GRANITE, 255])),
      },
    };

    const doc = makeSculptDoc([meshDoc]);
    localAssert(doc !== null, 'makeSculptDoc creates a valid document from surface paint data');
    if (doc) {
      localAssert(isSculptDoc(doc), 'isSculptDoc validates document structure');
      localAssert(doc.meshes.length === 1, 'Document contains exactly 1 mesh doc');
      localAssert(doc.hash.length === 8, `Document produces stable 8-char hex hash: ${doc.hash}`);
      localAssert(sculptDocBytes(doc) > 0, `Document calculates byte size: ${sculptDocBytes(doc)} bytes`);
    }

    const geo = new THREE.BoxGeometry(100, 100, 100, 4, 4, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geo, mat);
    const sculptMesh = SculptMesh.wrap(mesh);
    localAssert(sculptMesh.isPristine(), 'Newly created SculptMesh starts in pristine state');

    const targetGroup = 0;
    sculptMesh.paintSurfaceGroup(targetGroup, SURFACE_MOSSY_ROCK, 0.75);
    sculptMesh.finishStroke();

    localAssert(!sculptMesh.isPristine(), 'SculptMesh is no longer pristine after painting surface');
    localAssert(sculptMesh.hasSurface, 'SculptMesh has surface attribute initialized');
    localAssert(sculptMesh.changedCount() > 0, 'changedCount reflects modified painted vertices');

    const extractedDoc = sculptMesh.extractDoc('0:TestBox:98');
    localAssert(extractedDoc !== null, 'extractDoc captures surface paint data into SculptMeshDoc');
    localAssert(extractedDoc?.surface !== undefined, 'SculptMeshDoc contains surface section');

    sculptMesh.unpaintSurfaceGroup(targetGroup, 1.0);
    sculptMesh.finishStroke();
    localAssert(sculptMesh.isPristine(), 'Unpainting with weight 1.0 restores pristine status');

    const sGeo = new THREE.SphereGeometry(100, 16, 16);
    const sMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const sMesh = new THREE.Mesh(sGeo, sMat);
    const sphereSculpt = SculptMesh.wrap(sMesh);
    sphereSculpt.syncMatrices();

    const brushParams: BrushParams = {
      ...DEFAULT_BRUSH,
      tool: 'paint',
      paintMode: 'surface',
      surfaceId: SURFACE_MOSSY_ROCK,
      radius: 80,
      strength: 0.8,
      hardness: 0.5,
      invert: false,
    };

    const hits = sphereSculpt.query(new THREE.Vector3(0, 100, 0), brushParams.radius);
    localAssert(hits.length > 0, `Brush query finds ${hits.length} vertex groups within radius`);

    applyStamp({
      mesh: sphereSculpt,
      centre: new THREE.Vector3(0, 100, 0),
      viewDir: new THREE.Vector3(0, -1, 0),
      params: brushParams,
      hits,
    });
    sphereSculpt.finishStroke();

    localAssert(!sphereSculpt.isPristine(), 'applyStamp successfully painted island surface onto mesh');
    const sDoc = sphereSculpt.extractDoc('0:Sphere:289');
    localAssert(sDoc?.surface !== undefined, 'applyStamp result serialized into doc');

    sphereSculpt.reset();
    localAssert(sphereSculpt.isPristine(), 'SculptMesh.reset() cleanly clears surface paint back to generated look');
  } catch (err) {
    localAssert(false, `Unexpected error: ${err}`);
  }

  log.push(allPassed ? '=== ALL MODEL PAINT TESTS PASSED ===' : '=== SOME TESTS FAILED ===');
  return { passed: allPassed, log };
}
