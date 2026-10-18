// ============================================================================
// File: apps/web/src/play/lab-vista.test.ts
// Unit tests for lab-vista-math and storm/pocket invariants (TICKET-06 + POL-101 & POL-102).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bayOfBearing,
  BREACH_BEARING,
  inCorridor,
  lookAt,
  MAX_POCKETS,
  pocketFrame,
  POCKET_KINDS,
  quantiseVistaStormColour,
} from './lab-vista-math';

test('POCKET_KINDS keeps 1-bit pure white rim, EGA cyan (POL-101), and quantiseVistaStormColour prevents mauve/salmon at storm 0.5 (POL-102)', () => {
  const oneBit = POCKET_KINDS.find((k) => k.name === '1-bit')!;
  assert.deepEqual(oneBit.rim, [1, 1, 1], '1-bit pocket rim is pure white [1, 1, 1]');

  const ega = POCKET_KINDS.find((k) => k.name === 'EGA')!;
  assert.ok(ega.rim[2] > ega.rim[0] && ega.rim[1] > ega.rim[0], 'EGA pocket rim is cyan (POL-101)');

  // Verify no pocket kind has a magenta/pink/mauve tint (R > G and B > G)
  for (const k of POCKET_KINDS) {
    const [r, g, b] = k.tint;
    const isPinkOrPurple = r > g + 0.15 && b > g + 0.15;
    assert.equal(isPinkOrPurple, false, `Pocket kind ${k.name} tint [${r}, ${g}, ${b}] must not be pink/purple`);
  }

  // Verify storm = 0.0 (pxd = 0.15) and storm = 0.5 (pxd = 0.575, POL-102) never produce mauve/salmon blocks (e.g. RGB 181, 148, 171)
  const samples: readonly (readonly [number, number, number])[] = [
    [0.35, 0.32, 0.36],
    [0.45, 0.42, 0.46],
    [0.71, 0.58, 0.67], // ~RGB(181, 148, 171) input
    [0.66, 0.59, 0.62],
  ];
  for (const pxd of [0.15, 0.575]) {
    for (const s of samples) {
      const q = quantiseVistaStormColour(s, pxd, 0);
      const isMauveOrSalmon = q[0] > q[1] && q[2] > q[1];
      assert.equal(
        isMauveOrSalmon,
        false,
        `At pxd=${pxd}, quantised colour [${q.join(', ')}] must stay cold storm slate (R <= G <= B), never mauve/salmon`,
      );
    }
  }
});

test('pocketFrame generates floating 3D spherical S-pockets and lookAt(0.5) keeps dusk at 0 so storm 0.5 stays cold slate', () => {
  const lookHalf = lookAt(0.5);
  assert.equal(lookHalf.dusk, 0, 'At storm 0.5 dusk has not yet tinted the fog warm/mauve (POL-102)');
  assert.ok(lookHalf.breachHeight > 0.45, 'Breach column remains tall at progress 0.5');
  assert.ok(lookHalf.breachGlow > 0.5, 'Breach column retains strong cyan glow at progress 0.5');
  assert.equal(inCorridor(BREACH_BEARING), true);

  for (let slot = 0; slot < MAX_POCKETS; slot++) {
    const pf = pocketFrame(slot, 10, lookHalf.pocketScale);
    assert.ok(pf.radius > 0.5, `Pocket slot ${slot} has positive 3D sphere radius`);
    assert.ok(pf.centre[1] > pf.radius, `Pocket slot ${slot} floats above the ground (${pf.centre[1]} > ${pf.radius})`);
  }

  assert.ok(bayOfBearing(BREACH_BEARING) >= 0);
});
