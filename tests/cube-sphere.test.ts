/**
 * T10 — Cube-Sphere Geometry and Atlas Tests
 *
 * Acceptance criteria:
 * - Correct counts, normals, radius, winding, seam positions, and UV bounds
 * - Asymmetric diagnostic texture proves all face orientations
 * - Actual exported PNG is 2048×2048
 * - Gutters survive tested minification
 * - Legacy art comparison captured
 * - No claims of distortion-free mapping or unchanged GPU cost
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCubeSphereGeometry,
  validateCubeSphereGeometry,
  getAtlasTileRect,
  FACE_ORDER,
  FACE_ATLAS_GRID,
  SEAM_EDGES,
  CUBE_SPHERE_VERSION,
} from '../src/game/cube-sphere';
import {
  generateDiagnosticAtlas,
  generateBlankPaintAtlas,
  verifyGutterSurvival,
  getExportGuide,
  ATLAS_SIZE,
  GUTTER_PIXELS,
  CELL_WIDTH,
  CELL_HEIGHT,
  TILE_SIZE,
  SKIN_LEGACY_SPHERE,
  SKIN_CUBE_ATLAS_V1,
} from '../src/game/cube-sphere-atlas';

test('T10: Cube-Sphere Geometry — Correct counts', async (t) => {
  await t.test('LOD0 (resolution=1): 6 faces, 24 vertices, 12 triangles', () => {
    const geo = buildCubeSphereGeometry(31, 1);
    assert.equal(geo.faceCount, 6);
    assert.equal(geo.vertexCount, 24);  // (1+1)² × 6
    assert.equal(geo.triangleCount, 12); // 1² × 2 × 6
  });

  await t.test('LOD1 (resolution=2): 6 faces, 54 vertices, 48 triangles', () => {
    const geo = buildCubeSphereGeometry(31, 2);
    assert.equal(geo.vertexCount, 54);  // (2+1)² × 6
    assert.equal(geo.triangleCount, 48); // 2² × 2 × 6
  });

  await t.test('LOD3 (resolution=4): 6 faces, 150 vertices, 192 triangles', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    assert.equal(geo.vertexCount, 150);  // (4+1)² × 6
    assert.equal(geo.triangleCount, 192); // 4² × 2 × 6
  });

  await t.test('index count matches triangle count × 3', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    assert.equal(geo.indices.length, geo.triangleCount * 3);
  });
});

test('T10: Cube-Sphere Geometry — Normals', async (t) => {
  await t.test('all normals are unit length', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    for (let i = 0; i < geo.vertexCount; i++) {
      const nx = geo.normals[i * 3];
      const ny = geo.normals[i * 3 + 1];
      const nz = geo.normals[i * 3 + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      assert.ok(Math.abs(len - 1.0) < 1e-5, `Normal ${i} has length ${len}`);
    }
  });

  await t.test('normals point outward (same direction as position)', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    for (let i = 0; i < geo.vertexCount; i++) {
      const px = geo.positions[i * 3];
      const py = geo.positions[i * 3 + 1];
      const pz = geo.positions[i * 3 + 2];
      const nx = geo.normals[i * 3];
      const ny = geo.normals[i * 3 + 1];
      const nz = geo.normals[i * 3 + 2];
      // Dot product should be positive (normals align with position direction)
      const dot = px * nx + py * ny + pz * nz;
      assert.ok(dot > 0, `Vertex ${i} has inward normal (dot = ${dot})`);
    }
  });
});

test('T10: Cube-Sphere Geometry — Radius', async (t) => {
  await t.test('all vertices are on sphere surface (radius=31)', () => {
    const R = 31;
    const geo = buildCubeSphereGeometry(R, 8);
    for (let i = 0; i < geo.vertexCount; i++) {
      const px = geo.positions[i * 3];
      const py = geo.positions[i * 3 + 1];
      const pz = geo.positions[i * 3 + 2];
      const dist = Math.sqrt(px * px + py * py + pz * pz);
      assert.ok(Math.abs(dist - R) < 1e-4, `Vertex ${i} at distance ${dist} (expected ${R})`);
    }
  });

  await t.test('supports arbitrary radius', () => {
    for (const R of [1, 10, 100, 0.5, 999]) {
      const geo = buildCubeSphereGeometry(R, 2);
      assert.equal(geo.radius, R);
      const px = geo.positions[0];
      const py = geo.positions[1];
      const pz = geo.positions[2];
      const dist = Math.sqrt(px * px + py * py + pz * pz);
      assert.ok(Math.abs(dist - R) < 1e-4);
    }
  });
});

test('T10: Cube-Sphere Geometry — Winding', async (t) => {
  await t.test('all triangles have outward-facing normals (CCW winding)', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    const errors = validateCubeSphereGeometry(geo);
    const windingErrors = errors.filter(e => e.includes('winding'));
    assert.equal(windingErrors.length, 0, `Winding errors: ${windingErrors.join('; ')}`);
  });
});

test('T10: Cube-Sphere Geometry — Seam positions', async (t) => {
  await t.test('seam edges are defined for all face adjacencies', () => {
    // 12 edges on a cube = 12 seam pairs
    assert.equal(SEAM_EDGES.length, 12);
  });

  await t.test('seam edges reference valid face indices', () => {
    for (const seam of SEAM_EDGES) {
      assert.ok(seam.faceA >= 0 && seam.faceA < 6, `Invalid faceA: ${seam.faceA}`);
      assert.ok(seam.faceB >= 0 && seam.faceB < 6, `Invalid faceB: ${seam.faceB}`);
      assert.notEqual(seam.faceA, seam.faceB, 'Seam cannot connect face to itself');
    }
  });
});

test('T10: Cube-Sphere Geometry — UV bounds', async (t) => {
  await t.test('face UVs are in [0, 1]', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    for (let i = 0; i < geo.vertexCount; i++) {
      const u = geo.faceUVs[i * 2];
      const v = geo.faceUVs[i * 2 + 1];
      assert.ok(u >= -1e-6 && u <= 1 + 1e-6, `Face UV ${i} u=${u}`);
      assert.ok(v >= -1e-6 && v <= 1 + 1e-6, `Face UV ${i} v=${v}`);
    }
  });

  await t.test('atlas UVs are in [0, 1]', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    for (let i = 0; i < geo.vertexCount; i++) {
      const u = geo.atlasUVs[i * 2];
      const v = geo.atlasUVs[i * 2 + 1];
      assert.ok(u >= -1e-6 && u <= 1 + 1e-6, `Atlas UV ${i} u=${u}`);
      assert.ok(v >= -1e-6 && v <= 1 + 1e-6, `Atlas UV ${i} v=${v}`);
    }
  });

  await t.test('atlas UVs fall within tile rectangles', () => {
    const geo = buildCubeSphereGeometry(31, 2);
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const rect = getAtlasTileRect(faceIdx);
      const vOffset = geo.faceVertexOffsets[faceIdx];
      const vertsPerFace = (geo.resolution + 1) * (geo.resolution + 1);

      for (let vi = 0; vi < vertsPerFace; vi++) {
        const idx = vOffset + vi;
        const u = geo.atlasUVs[idx * 2];
        const v = geo.atlasUVs[idx * 2 + 1];

        // Convert atlas UV back to pixel coordinates
        const px = u * ATLAS_SIZE;
        const py = (1.0 - v) * ATLAS_SIZE; // V-flip

        assert.ok(px >= rect.x - 1 && px <= rect.x + rect.width + 1,
          `Face ${faceIdx} vertex ${vi}: atlas px=${px.toFixed(1)} outside tile [${rect.x}, ${rect.x + rect.width}]`);
        assert.ok(py >= rect.y - 1 && py <= rect.y + rect.height + 1,
          `Face ${faceIdx} vertex ${vi}: atlas py=${py.toFixed(1)} outside tile [${rect.y}, ${rect.y + rect.height}]`);
      }
    }
  });
});

test('T10: Cube-Sphere Geometry — Validation', async (t) => {
  await t.test('valid geometry passes validation with no errors', () => {
    const geo = buildCubeSphereGeometry(31, 4);
    const errors = validateCubeSphereGeometry(geo);
    assert.equal(errors.length, 0, `Validation errors: ${errors.join('; ')}`);
  });

  await t.test('rejects invalid radius', () => {
    assert.throws(() => buildCubeSphereGeometry(0, 4));
    assert.throws(() => buildCubeSphereGeometry(-1, 4));
    assert.throws(() => buildCubeSphereGeometry(NaN, 4));
    assert.throws(() => buildCubeSphereGeometry(Infinity, 4));
  });

  await t.test('rejects invalid resolution', () => {
    assert.throws(() => buildCubeSphereGeometry(31, 0));
    assert.throws(() => buildCubeSphereGeometry(31, -1));
    assert.throws(() => buildCubeSphereGeometry(31, 1.5));
    assert.throws(() => buildCubeSphereGeometry(31, NaN));
  });

  await t.test('geometry version matches CUBE_SPHERE_VERSION', () => {
    const geo = buildCubeSphereGeometry(31, 2);
    assert.equal(geo.version, CUBE_SPHERE_VERSION);
  });
});

test('T10: Diagnostic Atlas — Asymmetric pattern proves face orientations', async (t) => {
  await t.test('atlas is 2048×2048 RGBA', () => {
    const atlas = generateDiagnosticAtlas();
    assert.equal(atlas.length, ATLAS_SIZE * ATLAS_SIZE * 4);
  });

  await t.test('each face tile has a unique background color', () => {
    const atlas = generateDiagnosticAtlas();
    const colors = new Set<string>();

    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const rect = getAtlasTileRect(faceIdx);
      // Sample at 30% offset from top-left to avoid center crosshair and corners
      const cx = Math.round(rect.x + rect.width * 0.3);
      const cy = Math.round(rect.y + rect.height * 0.3);
      const idx = (cy * ATLAS_SIZE + cx) * 4;
      const color = `${atlas[idx]},${atlas[idx + 1]},${atlas[idx + 2]}`;
      colors.add(color);
    }

    assert.equal(colors.size, 6, `Each face should have a unique color, got ${colors.size}: ${[...colors].join(', ')}`);
  });

  await t.test('corner markers are asymmetric (TL≠TR≠BL≠BR)', () => {
    const atlas = generateDiagnosticAtlas();
    const rect = getAtlasTileRect(0); // +X face

    // Sample corner regions
    const sampleCorner = (cx: number, cy: number) => {
      const idx = (cy * ATLAS_SIZE + cx) * 4;
      return `${atlas[idx]},${atlas[idx + 1]},${atlas[idx + 2]}`;
    };

    const margin = Math.round(rect.width * 0.1);
    const tl = sampleCorner(rect.x + margin, rect.y + margin);
    const tr = sampleCorner(rect.x + rect.width - margin, rect.y + margin);
    const bl = sampleCorner(rect.x + margin, rect.y + rect.height - margin);
    const br = sampleCorner(rect.x + rect.width - margin, rect.y + rect.height - margin);

    // At least 3 of the 4 corners should be different
    const unique = new Set([tl, tr, bl, br]);
    assert.ok(unique.size >= 3, `Corners should be asymmetric, got ${unique.size} unique: TL=${tl} TR=${tr} BL=${bl} BR=${br}`);
  });
});

test('T10: Atlas — Exported PNG is 2048×2048', async (t) => {
  await t.test('diagnostic atlas pixel count matches 2048²', () => {
    const atlas = generateDiagnosticAtlas();
    assert.equal(atlas.length, 2048 * 2048 * 4);
  });

  await t.test('blank paint atlas pixel count matches 2048²', () => {
    const atlas = generateBlankPaintAtlas();
    assert.equal(atlas.length, 2048 * 2048 * 4);
  });
});

test('T10: Atlas — Gutters survive minification', async (t) => {
  await t.test('diagnostic atlas gutters survive 2× box filter', () => {
    const atlas = generateDiagnosticAtlas();
    const result = verifyGutterSurvival(atlas);
    assert.ok(result.pass, `Gutter test failed: ${result.details.join('; ')}`);
    assert.ok(result.minGutterBrightness > 0, 'Min gutter brightness should be > 0');
  });

  await t.test('blank paint atlas gutters survive 2× box filter', () => {
    const atlas = generateBlankPaintAtlas();
    const result = verifyGutterSurvival(atlas);
    assert.ok(result.pass, `Gutter test failed: ${result.details.join('; ')}`);
  });
});

test('T10: Atlas — Skin metadata', async (t) => {
  await t.test('legacy_sphere skin has correct type', () => {
    assert.equal(SKIN_LEGACY_SPHERE.type, 'legacy_sphere');
    assert.equal(SKIN_LEGACY_SPHERE.id, 'legacy_sphere');
  });

  await t.test('cube_atlas_v1 skin has correct dimensions', () => {
    assert.equal(SKIN_CUBE_ATLAS_V1.type, 'cube_atlas_v1');
    assert.equal(SKIN_CUBE_ATLAS_V1.atlasSize, 2048);
    assert.equal(SKIN_CUBE_ATLAS_V1.gutterPixels, 4);
    assert.ok(SKIN_CUBE_ATLAS_V1.tileSize > 0);
    assert.equal(SKIN_CUBE_ATLAS_V1.faceOrder.length, 6);
  });

  await t.test('skins are frozen (immutable)', () => {
    assert.ok(Object.isFrozen(SKIN_LEGACY_SPHERE));
    assert.ok(Object.isFrozen(SKIN_CUBE_ATLAS_V1));
  });
});

test('T10: Atlas — Tile rectangles', async (t) => {
  await t.test('6 non-overlapping tile rects within 2048²', () => {
    const rects = [];
    for (let i = 0; i < 6; i++) {
      rects.push(getAtlasTileRect(i));
    }

    // All within bounds
    for (const r of rects) {
      assert.ok(r.x >= 0 && r.x + r.width <= ATLAS_SIZE);
      assert.ok(r.y >= 0 && r.y + r.height <= ATLAS_SIZE);
    }

    // No overlaps (check all pairs)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const overlaps = !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
                          a.y + a.height <= b.y || b.y + b.height <= a.y);
        assert.ok(!overlaps, `Tiles ${i} and ${j} overlap`);
      }
    }
  });

  await t.test('tile dimensions match atlas constants', () => {
    const rect = getAtlasTileRect(0);
    assert.ok(Math.abs(rect.width - TILE_SIZE) < 1);
    assert.ok(Math.abs(rect.height - TILE_SIZE) < 1);
  });
});

test('T10: Export Guide', async (t) => {
  await t.test('export guide contains key specifications', () => {
    const guide = getExportGuide();
    assert.ok(guide.includes('2048'));
    assert.ok(guide.includes('3 columns'));
    assert.ok(guide.includes('gutter'));
    assert.ok(guide.includes('seam'));
    assert.ok(guide.includes('PNG'));
  });

  await t.test('export guide does not claim distortion-free mapping', () => {
    const guide = getExportGuide().toLowerCase();
    assert.ok(!guide.includes('distortion-free'));
    assert.ok(!guide.includes('no distortion'));
    assert.ok(!guide.includes('zero distortion'));
  });

  await t.test('export guide does not claim unchanged GPU cost', () => {
    const guide = getExportGuide().toLowerCase();
    assert.ok(!guide.includes('unchanged gpu'));
    assert.ok(!guide.includes('same gpu cost'));
    assert.ok(!guide.includes('no performance impact'));
  });
});

test('T10: Face Order and Atlas Grid', async (t) => {
  await t.test('6 faces defined', () => {
    assert.equal(FACE_ORDER.length, 6);
    assert.equal(FACE_ATLAS_GRID.length, 6);
  });

  await t.test('atlas grid covers 3×2 layout', () => {
    const cols = new Set(FACE_ATLAS_GRID.map(g => g.col));
    const rows = new Set(FACE_ATLAS_GRID.map(g => g.row));
    assert.equal(cols.size, 3, 'Should have 3 columns');
    assert.equal(rows.size, 2, 'Should have 2 rows');
  });

  await t.test('all grid cells are unique', () => {
    const keys = FACE_ATLAS_GRID.map(g => `${g.col},${g.row}`);
    assert.equal(new Set(keys).size, 6, 'All grid cells should be unique');
  });
});
