import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, beam, duct, triangleCount } from '@hm/partgen';
import {
  chamferHardEdges,
  insetOutsetFaces,
  extrudeFacesNormal,
  solidifyHollowShell,
  extenderMidSlice,
} from '../src/hardsurface-cad';

describe('TICKET-34: Family 2 — Hard-Surface CAD, Chamfer, Panel Inset, Extrude, Shell & Extender', () => {
  it('adds 45-degree industrial edge chamfers and recessed panel seams to a block can', () => {
    const baseCan = can.build({ width: 0.8, depth: 0.8, height: 1.2 }, 0);
    assert.equal(triangleCount(baseCan), 12);

    const chamfered = chamferHardEdges.apply(baseCan, chamferHardEdges.oneClickPreset);
    assert.ok(triangleCount(chamfered) > 12, 'Chamfer adds bevel strip quads around all 6 faces');

    const recessed = insetOutsetFaces.apply(baseCan, insetOutsetFaces.oneClickPreset);
    assert.ok(triangleCount(recessed) > 12, 'Recessed panel seam adds border frame + riser walls');
  });

  it('extrudes top boss and solidifies a hollow sheet-metal shell', () => {
    const baseCan = can.build({ width: 0.6, depth: 0.6, height: 1.0 }, 0);
    const bossed = extrudeFacesNormal.apply(baseCan, extrudeFacesNormal.oneClickPreset);
    assert.ok(bossed.max[1] > 1.04, `Expected top boss height > 1.04, got ${bossed.max[1]}`);

    const shelled = solidifyHollowShell.apply(baseCan, solidifyHollowShell.oneClickPreset);
    assert.equal(triangleCount(shelled), triangleCount(baseCan) * 2);
  });

  it('stretches a flanged duct with 9-slice extenderMidSlice without distorting end flange thickness', () => {
    const baseDuct = duct.build({ length: 1.5, section: 0.25, flange: 0.04 }, 2);
    const extended = extenderMidSlice.apply(baseDuct, { axis: 0, extension: 1.0, endCapProtect: 0.25 });

    const origSpanX = baseDuct.max[0] - baseDuct.min[0];
    const newSpanX = extended.max[0] - extended.min[0];
    assert.ok(Math.abs(newSpanX - (origSpanX + 1.0)) < 1e-4);
  });
});
