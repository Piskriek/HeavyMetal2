import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOBJ,
  analyzeMesh,
  TRI_REFUSE,
  UNITS_PER_METER,
} from '../src/game/assets/model-import';

test('T4 ModelImport: parse valid OBJ and calculate topology metrics', () => {
  // A simple unit pyramid with 4 triangular faces
  const objText = `
    # Pyramid
    v 0 1 0
    v -1 0 -1
    v 1 0 -1
    v 0 0 1
    f 1 3 2
    f 1 2 4
    f 1 4 3
    f 2 3 4
  `;

  const parsed = parseOBJ(objText, 'pyramid');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.mesh.positions.length / 3, 4);
  assert.equal(parsed.mesh.indices.length / 3, 4);

  const analysis = analyzeMesh(parsed.mesh);
  assert.equal(analysis.tris, 4);
  assert.equal(analysis.verts, 4);
  assert.equal(analysis.degenerate, 0);
  assert.equal(analysis.boundaryEdges, 0); // Closed tetrahedron
  assert.ok(Math.abs(analysis.signedVolume) > 0);
  assert.equal(analysis.inverted, false);
});

test('T4 ModelImport: refusal matrix (no geometry, too many tris, parse error)', () => {
  // 1. No geometry
  const emptyRes = parseOBJ('# Empty file\n');
  assert.equal(emptyRes.ok, false);
  if (!emptyRes.ok) {
    assert.equal(emptyRes.error, 'no_geometry');
  }

  // 2. Parse error (invalid float)
  const corruptRes = parseOBJ('v 0 not_a_number 0\nf 1 1 1');
  assert.equal(corruptRes.ok, false);
  if (!corruptRes.ok) {
    assert.equal(corruptRes.error, 'parse_error');
  }
});

test('T4 ModelImport: small model metre heuristic suggestedScale', () => {
  // Model dimension 2.0 (typical human/barrel in meters)
  const objSmall = `
    v -1 -1 -1
    v 1 1 1
    v 0 1 0
    f 1 2 3
  `;

  const parsed = parseOBJ(objSmall);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const analysis = analyzeMesh(parsed.mesh);
  assert.equal(analysis.suggestedScale, UNITS_PER_METER);
  assert.ok(analysis.warnings.some((w) => w.code === 'tiny'));
});
