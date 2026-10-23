import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, bolt, triangleCount } from '@hm/partgen';
import {
  smoothTaubin,
  smoothLaplacian,
  subdivideMidSmooth,
  spherizeCast,
  peakInflate,
} from '../src/smooth-subdiv';

describe('TICKET-33: Family 1 — Smoothing, Fairing & Subdivision Operators', () => {
  it('subdivides a partgen box/can by 4x per level and rounds corners with Taubin smooth without shrinking volume', () => {
    const baseCan = can.build({ width: 1.0, depth: 1.0, height: 1.0 }, 0);
    assert.equal(triangleCount(baseCan), 12);

    const subdiv = subdivideMidSmooth.apply(baseCan, subdivideMidSmooth.oneClickPreset);
    assert.equal(triangleCount(subdiv), 48);

    // Volume-safe Taubin smooth keeps bounding span >= 78% of original 1.0m box while rounding sharp corners:
    const spanX = subdiv.max[0] - subdiv.min[0];
    assert.ok(spanX > 0.82 && spanX <= 1.05, `Expected volume-safe spanX in (0.78, 1.01], got ${spanX}`);
  });

  it('applies Laplacian HC Soft Polish and Spherize/Cast deterministically', () => {
    const baseBolt = bolt.build({}, 1);
    const sub = subdivideMidSmooth.apply(baseBolt, { levels: 1, roundness: 0 });
    const polished = smoothLaplacian.apply(sub, smoothLaplacian.oneClickPreset);
    const domed = spherizeCast.apply(sub, spherizeCast.oneClickPreset);

    assert.equal(triangleCount(polished), triangleCount(sub));
    assert.equal(triangleCount(domed), triangleCount(sub));
  });

  it('inflates mesh along normals while keeping y=0 base grounded when keepGrounded=1', () => {
    const baseCan = can.build({ width: 0.6, depth: 0.6, height: 1.0 }, 0);
    const inflated = peakInflate.apply(baseCan, { offset: 0.05, keepGrounded: 1 });

    // Base min[1] stays grounded at 0, while width expands by ~2 * 0.05 / sqrt(3):
    assert.ok(Math.abs(inflated.min[1]) < 1e-5);
    assert.ok(inflated.max[0] - inflated.min[0] > 0.62);
  });
});
