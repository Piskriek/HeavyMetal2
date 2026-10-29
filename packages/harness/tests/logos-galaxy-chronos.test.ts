import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMorningSitRep,
  createPlayerWanderer,
  createPresetMemory,
  decodeClipShareCode,
  dream,
  evaluateParty,
  evaluateUnityInDiversityCircle,
  noteCause,
  projectSuggestionHandshake,
  recordExperience,
  seedGalacticSystem,
  stepOrbitalLattice,
} from '../src/index.js';

test('Plan 58 W4 (Part A.1): seeds Inner Core (r < 0.35) vs. Mid-to-Outer Rim (r >= 0.35, S3 spawn) and computes Hohmann & Conjunction windows', () => {
  const coreSys = seedGalacticSystem('ancient-core-01', 0.18);
  assert.equal(coreSys.zone, 'inner-core');
  assert.ok(['S0a', 'S5', 'S6'].includes(coreSys.primaryStage));
  assert.equal(coreSys.choiceActive, false);
  assert.ok(coreSys.baseVeilThickness < 0.35);

  const rimSys = seedGalacticSystem('frontier-rim-01', 0.65);
  assert.equal(rimSys.zone, 'mid-outer-rim');
  assert.equal(rimSys.primaryStage, 'S3');
  assert.equal(rimSys.choiceActive, true);
  assert.ok(rimSys.baseVeilThickness >= 0.68);
  assert.equal(rimSys.bodies.length, 5);

  const snap0 = stepOrbitalLattice(rimSys, 0);
  const snap500 = stepOrbitalLattice(rimSys, 500);
  assert.equal(snap0.transferWindows.length, 4);
  assert.notEqual(snap500.bodyPositions[0]!.angleDeg, snap0.bodyPositions[0]!.angleDeg);

  // Construct an explicit conjunction where 3 bodies align at tick 0
  const alignedSys = {
    ...rimSys,
    bodies: rimSys.bodies.map((b, idx) => (idx < 3 ? { ...b, initialPhaseDeg: 45 + idx * 3 } : b)),
  };
  const conjSnap = stepOrbitalLattice(alignedSys, 0);
  assert.ok(conjSnap.conjunctionSignals.length >= 1);
  assert.ok(conjSnap.effectiveVeilThickness < alignedSys.baseVeilThickness);
});

test('Plan 58 W4 (Part A.2): projects a non-coercive Neural Ghost suggestion handshake and applies the Entropy Tax on coercive override (Audit A3)', () => {
  const playerMem = createPlayerWanderer();
  const companionMem = createPresetMemory('brain:00a1c401');

  const resOk = projectSuggestionHandshake({
    ping: 'GRAVITY_SLINGSHOT',
    targetVector: { x: 100, y: 20, z: -50 },
    senderMem: playerMem,
    receiverMem: companionMem,
    tick: 120,
  });
  assert.equal(resOk.accepted, true);
  assert.equal(resOk.ghostVector.preservesFreeWill, true);
  assert.equal(resOk.ghostVector.lentAnchorCalm, 0.3);
  assert.equal(resOk.entropyTax.taxed, false);
  assert.equal(resOk.entropyTax.learningHalted, false);

  const resCoercive = projectSuggestionHandshake({
    ping: 'FLANK_VECTOR',
    targetVector: { x: 0, y: 0, z: 0 },
    senderMem: playerMem,
    receiverMem: companionMem,
    tick: 130,
    coerciveOverride: true,
    hierarchySize: 8,
  });
  assert.equal(resCoercive.accepted, false);
  assert.equal(resCoercive.responseMode, 'coercive-entropy-tax');
  assert.equal(resCoercive.entropyTax.taxed, true);
  assert.equal(resCoercive.entropyTax.learningHalted, true);
  assert.ok(resCoercive.entropyTax.lambdaFtle > 0.4);
  assert.ok(resCoercive.entropyTax.addedBodyAche > 0);
});

test('Plan 58 W4 (Part A.3): scores Unity-in-Diversity Resonance Circles by complementary 4-Floats, polarity & 7-ray coverage', () => {
  const m1 = createPlayerWanderer('species:00a1c401');
  const m2 = { ...createPresetMemory('species:00a1c402'), pol: 48 }; // Masculine / Intent lead
  const m3 = { ...createPresetMemory('species:00a1c403'), pol: -48 }; // Feminine / Context lead

  const circle = evaluateUnityInDiversityCircle([
    {
      memberId: 'p1',
      name: 'Anchor',
      mem: m1,
      fourFloatsSpecialty: { Pxd: 0.96, Vtx: 0.85, Lx: 0.75, Aq: 0.7 },
      contributedPresets: ['kit:00a1b2c3'],
    },
    {
      memberId: 'p2',
      name: 'Architect',
      mem: m2,
      fourFloatsSpecialty: { Pxd: 0.75, Vtx: 0.96, Lx: 0.95, Aq: 0.7 },
      contributedPresets: ['logic:00d4e5f6'],
    },
    {
      memberId: 'p3',
      name: 'Navigator',
      mem: m3,
      fourFloatsSpecialty: { Pxd: 0.7, Vtx: 0.75, Lx: 0.85, Aq: 0.98 },
      contributedPresets: ['matc:00112233'],
    },
  ]);

  assert.equal(circle.polarityComplementarity, 1);
  assert.ok(circle.fourFloatsCoverage > 0.94);
  assert.equal(circle.sevenRayCoverage, 1);
  assert.ok(circle.hSystem >= 0.95);
  assert.equal(circle.isSocialMemoryComplex, true);

  const party = evaluateParty([
    { id: 'p1', name: 'Anchor', mem: m1, stage: 'S3', worldGateCode: 'GATE-01' },
    { id: 'p2', name: 'Architect', mem: m2, stage: 'S3', worldGateCode: 'GATE-01' },
  ]);
  assert.equal(party.unityInDiversity.memberCount, 2);
});

test('Plan 58 W4 (Part A.4): builds a Chronos Morning SitRep with +5% Dream Lesson Bounty and a valid 30s Ghost Replay clip code', () => {
  const ego = createPresetMemory('brain:00a1c400');
  let preset = createPresetMemory('loc:00a1c401');
  preset = recordExperience(preset, {
    t: 10,
    stage: 'S3',
    cat: 'SOLAR_OVERLOAD',
    excitement: 0.8,
    error: 0.7,
    by: 'solar-control',
    felt: 'solar-anxiety',
  });
  preset = noteCause(preset, 'solar-control', 'solar-anxiety');

  const dreamRes = dream({
    ego,
    presets: [preset],
    weights: { prefer: {} },
    now: 100,
  });

  const sitRep = buildMorningSitRep({
    digest: dreamRes.digest,
    tick: 100,
    worldSeed: 'sys:frontier-01',
    stage: 'S3',
  });

  assert.equal(sitRep.schema, 'hm2:morning-sitrep:v1');
  assert.equal(sitRep.bounty.readinessBoost, 0.05);
  assert.equal(sitRep.bounty.rayIndex, 3); // Yellow / solar-anxiety ray
  assert.equal(sitRep.ghostReplayManifest.durationSec, 30);
  const decoded = decodeClipShareCode(sitRep.ghostReplayShareCode);
  assert.ok(decoded !== null);
  assert.equal(decoded.durationSec, 30);
});
