/**
 * M01 · T0 — the eye-level audit.
 *
 * Three claims the spike rests on: a fixed plane seen edge-on is reported (and a camera-facing
 * sprite never is), the road-edge exposure distance is the arithmetic it says it is, and two runs
 * over the same inputs produce byte-identical reports.
 *
 * Run with: node --import tsx --test tests/eye-level-audit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_FOV, DECAL_RANGE, THIN_NORMAL_DOT, THIN_RANGE,
  runEyeLevelAudit, serializeEyeAudit,
  type AuditEyeSample, type AuditItem,
} from '../src/game/eye-level-audit';

const HALF_W = Math.tan((AUDIT_FOV * 0.5) * Math.PI / 180) * (16 / 9);

/** A straight eye path along +z, one sample every 200 units, drivable half-width 360. */
function eyePath(): AuditEyeSample[] {
  const samples: AuditEyeSample[] = [];
  for (let i = 0; i < 10; i++) {
    samples.push({ s: 1100 + i * 200, stage: 'alpine', eye: { x: 0, y: 100, z: i * 200 }, halfWidth: 360 });
  }
  return samples;
}

function plane(overrides: Partial<AuditItem> & { id: string }): AuditItem {
  return {
    kind: 'plane',
    name: 'Test Plane',
    position: { x: 0, y: 100, z: 400 },
    halfWidth: 200,
    halfHeight: 300,
    yaw: 0,
    source: 'builder',
    ...overrides,
  };
}

test('thin billboard detection', () => {
  // A plane whose normal is +x, standing beside a path that runs along +z. From far down the path
  // the sight line lies almost in the plane (|n·v| ≈ 0.10), so it is edge-on and must be reported.
  const edgeOn = plane({ id: 'edge-on', yaw: Math.PI / 2, position: { x: 200, y: 100, z: 1900 } });
  // The same plane rotated to face the path (normal +z) is never thin.
  const facing = plane({ id: 'facing', yaw: 0, position: { x: -200, y: 100, z: 900 } });
  // A camera-facing sprite can never be thin, whatever its yaw says.
  const billboard = plane({ id: 'billboard', kind: 'billboard', yaw: Math.PI / 2, position: { x: 150, y: 100, z: 700 } });
  // Out of range entirely.
  const farAway = plane({ id: 'far', yaw: Math.PI / 2, position: { x: 4000, y: 100, z: 900 } });
  // A decal lies flat: seen from above, never edge-on.
  const decal = plane({ id: 'decal', kind: 'decal', yaw: Math.PI / 2, position: { x: 120, y: 100, z: 600 } });

  const report = runEyeLevelAudit({
    samples: eyePath(),
    items: [edgeOn, facing, billboard, farAway, decal],
    spacing: 200,
  });

  assert.deepEqual(report.thin.map((find) => find.id), ['edge-on']);
  assert.equal(report.thin[0].minFacing < THIN_NORMAL_DOT, true);
  assert.equal(report.totals.planes, 3);
  assert.equal(report.totals.billboards, 1);
  assert.equal(report.totals.decals, 1);
  // The decal is inside DECAL_RANGE and is reported by the other check.
  assert.deepEqual(report.decals.map((find) => find.id), ['decal']);
  assert.ok(report.decals[0].distance <= DECAL_RANGE);
  // The edge-on plane sits on the path at z=900, well inside THIN_RANGE.
  assert.ok(report.thin[0].distance <= THIN_RANGE);
});

test('edge exposure detection', () => {
  const report = runEyeLevelAudit({ samples: eyePath(), items: [], spacing: 200 });
  const expected = 360 / HALF_W;
  for (const entry of report.exposed) {
    assert.ok(Math.abs(entry.edgeDistance - expected) < 1e-9,
      `edgeDistance ${entry.edgeDistance} should be halfWidth / tan(hfov/2) = ${expected}`);
  }
  assert.ok(Math.abs(report.totals.worstEdgeDistance - expected) < 1e-9);
  assert.ok(Math.abs(report.totals.medianEdgeDistance - expected) < 1e-9);
  // One entry per stage, even when every sample ties.
  assert.equal(report.stageWorst.length, 1);
  assert.equal(report.stageWorst[0].stage, 'alpine');

  // A wider road pushes the exposure distance out proportionally.
  const wide = runEyeLevelAudit({
    samples: eyePath().map((sample) => ({ ...sample, halfWidth: 720 })),
    items: [],
    spacing: 200,
  });
  assert.ok(Math.abs(wide.totals.worstEdgeDistance - expected * 2) < 1e-9);
});

test('deterministic report', () => {
  const items = [
    plane({ id: 'b', yaw: Math.PI / 2, position: { x: 240, y: 90, z: 800 } }),
    plane({ id: 'a', yaw: 0.3, position: { x: -240, y: 110, z: 1200 } }),
    plane({ id: 'c', kind: 'decal', position: { x: 0, y: 100, z: 400 } }),
  ];
  const options = { samples: eyePath().slice().reverse(), items: items.slice().reverse(), spacing: 200 };
  const first = serializeEyeAudit(runEyeLevelAudit(options));
  const second = serializeEyeAudit(runEyeLevelAudit(options));
  assert.equal(first, second, 'the same inputs must serialise to the same bytes');

  // Input order must not matter either: the audit sorts before it measures.
  const reversed = serializeEyeAudit(runEyeLevelAudit({ ...options, items: items.slice() }));
  assert.equal(first, reversed);

  // And the payload must actually contain the findings, not an empty shell.
  const parsed = JSON.parse(first) as { totals: { items: number; thin: number }; version: number };
  assert.equal(parsed.version, 1);
  assert.equal(parsed.totals.items, 3);
  assert.equal(typeof parsed.totals.thin, 'number');
});
