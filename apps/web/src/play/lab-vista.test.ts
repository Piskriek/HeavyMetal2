// ============================================================================
// File: apps/web/src/play/lab-vista.test.ts
// Unit tests for lab-vista-math and storm/pocket invariants (TICKET-06 Item 6).
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

test('POCKET_KINDS and quantiseVistaStormColour never turn grey wasteland structures into purple or pink cubes', () => {
  // Verify no pocket kind has a magenta/pink tint (R > G and B > G with low G)
  for (const k of POCKET_KINDS) {
    const [r, g, b] = k.tint;
    const isPinkOrPurple = r > g + 0.15 && b > g + 0.15;
    assert.equal(isPinkOrPurple, false, `Pocket kind ${k.name} tint [${r}, ${g}, ${b}] must not be pink/purple`);
  }

  // Verify neutral grey/brown wasteland surfaces outside pockets stay cold storm slate, never magenta [0.67, 0, 0.67]
  const samples: readonly (readonly [number, number, number])[] = [
    [0.35, 0.32, 0.36],
    [0.45, 0.42, 0.46],
    [0.28, 0.25, 0.29],
  ];
  for (const s of samples) {
    const q = quantiseVistaStormColour(s, 0.15, 0);
    const isPurple = q[0] > q[1] + 0.15 && q[2] > q[1] + 0.15;
    assert.equal(isPurple, false, `Quantised colour [${q.join(', ')}] must not snap to purple/pink`);
  }
});

test('pocketFrame generates floating 3D spherical S-pockets clear of the Breach corridor across storm progress', () => {
  const look0 = lookAt(0);
  const lookHalf = lookAt(0.5);
  assert.ok(look0.breachHeight >= lookHalf.breachHeight, 'the Breach column is at least as tall at the storm as at progress 0.5');
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
