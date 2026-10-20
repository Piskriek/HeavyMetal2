import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, beam, triangleCount } from '@hm/partgen';
import {
  bendArc,
  twistHelix,
  taperFlare,
  shearSkew,
  ffdCageWarp,
} from '../src/deformers';

describe('TICKET-36: Family 4 — Non-Linear Gizmo Deformers', () => {
  it('bends and twists a vertical can without losing triangles or slots', () => {
    const baseCan = can.build({ width: 0.4, depth: 0.4, height: 2.0 }, 1);
    const bent = bendArc.apply(baseCan, bendArc.oneClickPreset);
    const twisted = twistHelix.apply(baseCan, twistHelix.oneClickPreset);

    assert.equal(triangleCount(bent), triangleCount(baseCan));
    assert.equal(triangleCount(twisted), triangleCount(baseCan));
    // Bending +45 deg around Y shifts the top X range beyond the original [-0.215, 0.215]:
    assert.ok(bent.max[0] > baseCan.max[0] + 0.15);
  });

  it('tapers a hopper funnel and skews a louver cleanly', () => {
    const baseCan = can.build({ width: 1.0, depth: 1.0, height: 1.0 }, 0);
    const tapered = taperFlare.apply(baseCan, taperFlare.oneClickPreset);
    assert.ok(tapered.max[0] - tapered.min[0] > 1.4);

    const skewed = shearSkew.apply(baseCan, shearSkew.oneClickPreset);
    assert.ok(skewed.max[0] > baseCan.max[0] + 0.3);
  });

  it('warps a box into a wedge cab and arched beam with ffdCageWarp', () => {
    const baseBeam = beam.build({ length: 2.0, section: 0.2 }, 0);
    const wedged = ffdCageWarp.apply(baseBeam, { topScaleX: 0.75, topScaleZ: 0.85, frontSlopeY: 0.3, archLiftY: 0.0 });
    assert.ok(wedged.max[1] > baseBeam.max[1] + 0.04);
  });
});
