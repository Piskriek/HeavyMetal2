import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, triangleCount } from '@hm/partgen';
import {
  uvBoxTriplanar,
  uvCylindricalUnwrap,
  surfaceEdgeWearAndCavity,
  evaluateOperatorStack,
  FAMILY6_UV_WEAR_STACK_OPERATORS,
  type OperatorStackLayer,
} from '../src/uv-wear-stack';

describe('TICKET-38: Family 6 — UV Projection, Surface Edge Wear & Non-Destructive Operator Stack', () => {
  it('re-projects box and cylindrical UVs deterministically', () => {
    const baseCan = can.build({ width: 0.6, depth: 0.6, height: 1.2 }, 1);
    const boxUv = uvBoxTriplanar.apply(baseCan, { tileScale: 2.0, rotationDeg: 90, offsetU: 0.25, offsetV: -0.1 });
    const cylUv = uvCylindricalUnwrap.apply(baseCan, uvCylindricalUnwrap.oneClickPreset);

    assert.equal(boxUv.uvs.length, baseCan.uvs.length);
    assert.equal(cylUv.uvs.length, baseCan.uvs.length);
  });

  it('generates procedural edge-wear and cavity-dirt material slots via surfaceEdgeWearAndCavity', () => {
    const baseCan = can.build({ width: 0.6, depth: 0.6, height: 1.0 }, 0);
    const worn = surfaceEdgeWearAndCavity.apply(baseCan, surfaceEdgeWearAndCavity.oneClickPreset);

    const slotNames = worn.slots.map((s) => s.name);
    assert.ok(slotNames.includes('edge-wear'), 'Expected edge-wear material slot');
    assert.ok(triangleCount(worn) > triangleCount(baseCan));
  });

  it('evaluates a non-destructive OperatorStack and skips high-rank layers on low detail ranks', () => {
    const baseCan = can.build({ width: 0.6, depth: 0.6, height: 1.0 }, 0);
    const stack: readonly OperatorStackLayer[] = [
      {
        layerId: 'L1',
        operatorId: 'uv-cylindrical-unwrap',
        enabled: true,
        minRank: 0,
        params: uvCylindricalUnwrap.oneClickPreset,
      },
      {
        layerId: 'L2',
        operatorId: 'surface-edge-wear-ao',
        enabled: true,
        minRank: 2,
        params: surfaceEdgeWearAndCavity.oneClickPreset,
      },
    ];

    const rank0Out = evaluateOperatorStack(baseCan, stack, FAMILY6_UV_WEAR_STACK_OPERATORS, 0);
    const rank2Out = evaluateOperatorStack(baseCan, stack, FAMILY6_UV_WEAR_STACK_OPERATORS, 2);

    // Rank 0 skips L2 (minRank: 2), keeping 12 triangles; Rank 2 runs L2, adding edge-wear geometry:
    assert.equal(triangleCount(rank0Out), 12);
    assert.ok(triangleCount(rank2Out) > 12);
  });
});
