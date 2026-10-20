// ============================================================================
// File: packages/orbital/tests/flight-and-transfer.test.ts
// TICKET-28 unit tests covering POL-14 (Orbital Shuttle ascent, ground-to-orbit
// crossfade, SMX-PLN-XXXX share code parsing, and planetary approach lock)
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGroundToOrbitCrossfade,
  stepOrbitalShuttleFlight,
  parsePlanetForgeShareCode,
  findLockedApproachPlanet,
  CANONICAL_MULTIVERSE_PLANETS,
  ORBIT_INSERTION_M,
} from '../src/flight-and-transfer';

test('POL-14: computeGroundToOrbitCrossfade transitions smoothly across 120..420 m altitude', () => {
  const surf = computeGroundToOrbitCrossfade(40);
  assert.equal(surf.phase, 'surface');
  assert.equal(surf.groundChunkOpacity, 1);
  assert.equal(surf.starfieldOpacity, 0);

  const mid = computeGroundToOrbitCrossfade(270);
  assert.equal(mid.phase, 'ascent-crossfade');
  assert.equal(mid.orbitBlend01, 0.5);
  assert.equal(mid.groundChunkOpacity, 0.5);
  assert.equal(mid.starfieldOpacity, 0.5);

  const orb = computeGroundToOrbitCrossfade(500);
  assert.equal(orb.phase, 'orbit');
  assert.equal(orb.groundChunkOpacity, 0);
  assert.equal(orb.starfieldOpacity, 1);
  assert.equal(orb.gravityScale, 0);
});

test('POL-14: stepOrbitalShuttleFlight climbs from lunar surface into orbital insertion above 420 m', () => {
  let st = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, pitch: 0.65, yaw: 0 };
  for (let i = 0; i < 60; i++) {
    st = stepOrbitalShuttleFlight(st, { thrust01: 1, climb: 1, pitchDelta: 0, yawDelta: 0 }, 0.2);
  }
  assert.ok(st.y > ORBIT_INSERTION_M, `Expected shuttle altitude > ${ORBIT_INSERTION_M} m, got ${st.y.toFixed(1)} m`);
});

test('POL-14: parsePlanetForgeShareCode and findLockedApproachPlanet resolve SMX-PLN-XXXX worlds', () => {
  const custom = parsePlanetForgeShareCode('SMX-PLN-7744-HYPERION');
  assert.ok(custom);
  assert.equal(custom.seed, 7744);
  assert.equal(custom.name, 'HYPERION');

  const ignis = CANONICAL_MULTIVERSE_PLANETS[1]!;
  const locked = findLockedApproachPlanet({
    x: ignis.orbitPos.x + 40,
    y: ignis.orbitPos.y,
    z: ignis.orbitPos.z - 30,
  });
  assert.ok(locked);
  assert.equal(locked.code, 'SMX-PLN-1042-IGNIS');
});
