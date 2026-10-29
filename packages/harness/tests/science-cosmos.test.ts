import assert from 'node:assert/strict';
import test from 'node:test';
import { PHYS_MATERIALS } from '@hm/physmat';
import {
  PHYSMAT_ELEMENT_STACKS,
  antidoteResilience,
  bodyStep,
  callIntensity,
  cellTemperatureKelvin,
  combinePresets,
  createPresetMemory,
  deriveElementPhysics,
  dream,
  dyadTransferRay,
  effectiveVeilOpacity,
  generateSystemQuests,
  harmoniousDoubling,
  investSecondDensity,
  mixElementStack,
  recordExperience,
  recordResilientExperience,
  relievePlanetFromComplex,
} from '../src/index.js';

test('effectiveVeilOpacity (Ra 94.12): inner balance and kundalini thin personal Veil opacity up to 35%', () => {
  const raw = createPresetMemory('loc:ab12cd34');
  const charged = recordExperience(raw, {
    t: 1,
    stage: 'S3',
    cat: 'hit',
    excitement: 1,
    error: 0.9,
    by: 'root-fear',
    felt: 'root-fear',
  });
  const opCharged = effectiveVeilOpacity('S3', charged);
  const opBalanced = effectiveVeilOpacity('S3', raw);
  assert.ok(opBalanced < opCharged);
  assert.equal(effectiveVeilOpacity('S6', raw), 0);
});

test('antidoteResilience & recordResilientExperience (Ra 42.2): closing a cause link halves future charge on that lesson', () => {
  let mem = createPresetMemory('mot:11223344');
  mem = recordExperience(mem, {
    t: 1,
    stage: 'S3',
    cat: 'burst',
    excitement: 0.8,
    error: 0.7,
    by: 'solar-control',
    felt: 'solar-control',
  });
  assert.equal(antidoteResilience(mem, 'solar-control', 'solar-control'), 0);

  // Heal and close the cause link in a cued dream
  let ego = createPresetMemory('logic:55667788');
  for (let i = 0; i < 3; i++) {
    const d = dream({
      ego,
      presets: [{ ...mem, inv: 0.9 }],
      weights: { prefer: {} },
      now: 10 + i,
      cues: [{ of: mem.of, t: 1 }],
    });
    ego = d.ego;
    mem = d.presets[0]!;
  }
  assert.equal(antidoteResilience(mem, 'solar-control', 'solar-control'), 0.5);

  const withoutResilience = recordExperience(mem, {
    t: 20,
    stage: 'S3',
    cat: 'burst',
    excitement: 1.0,
    error: 0.7,
    by: 'solar-control',
    felt: 'solar-control',
  });
  const withResilience = recordResilientExperience(mem, {
    t: 20,
    stage: 'S3',
    cat: 'burst',
    excitement: 1.0,
    error: 0.7,
    by: 'solar-control',
    felt: 'solar-control',
  });
  assert.ok((withResilience.charge[2] ?? 0) < (withoutResilience.charge[2] ?? 0));
});

test('dyadTransferRay & harmoniousDoubling (Ra 26.36, 32.5, 10.12): mutual ray gates transfer and harmonious minds double', () => {
  const clearA = createPresetMemory('kit:aaaa1111');
  const clearB = createPresetMemory('lx:bbbb2222');
  const blockedRoot = recordExperience(clearA, {
    t: 1,
    stage: 'S3',
    cat: 'shock',
    excitement: 1,
    error: 0.8,
    by: 'root-fear',
    felt: 'root-fear',
  });

  const blockedPair = dyadTransferRay(blockedRoot, clearB);
  assert.equal(blockedPair.highestMutualRay, 0);
  assert.equal(blockedPair.heartOpen, false);

  const openPair = dyadTransferRay(clearA, clearB);
  assert.equal(openPair.highestMutualRay, 7);
  assert.equal(openPair.heartOpen, true);
  assert.ok(openPair.transferMultiplier > blockedPair.transferMultiplier);

  const doubling = harmoniousDoubling([clearA, clearB, createPresetMemory('part:cccc3333')]);
  assert.equal(doubling.harmoniousCount, 3);
  assert.equal(doubling.multiplier, 4); // 2^(3-1)
});

test('callIntensity (Ra 7.12) & investSecondDensity (Ra 13.21): sorrow/seeking emits The Call and naming/tending awakens 2nd density', () => {
  let native = createPresetMemory('species:12345678');
  assert.equal(callIntensity(native), 0);

  native = recordExperience(native, {
    t: 1,
    stage: 'S2',
    cat: 'drought',
    excitement: 0.9,
    error: 0.85,
    by: 'root-lack',
    felt: 'root-lack',
  });
  let body = bodyStep({ kind: 'organic', mem: native, prev: null, sideOf: () => 'left' }).body;
  body = bodyStep({ kind: 'organic', mem: native, prev: body, sideOf: () => 'left' }).body;
  assert.ok(callIntensity({ ...native, inv: 0.6 }, body) > 0.3);

  // Second-density flora/creature awakens via naming, tending, and companionship
  let sprout = createPresetMemory('flora:87654321');
  let step = investSecondDensity(sprout, 1.0, 'name', 1);
  step = investSecondDensity(step.mem, 1.0, 'tend', 2);
  step = investSecondDensity(step.mem, 1.0, 'companion', 3);
  step = investSecondDensity(step.mem, 1.0, 'companion', 4);
  assert.equal(step.awakenedToThirdDensity, true);
});

test('relievePlanetFromComplex (Plan 57 §2–3): native Social Memory Complex relieves planetary body zones and charges Stargate', () => {
  // Planet has congestion on Ray 1 (crust and tectonics)
  let planet = createPresetMemory('world:00112233');
  planet = recordExperience(planet, {
    t: 1,
    stage: 'S3',
    cat: 'quake',
    excitement: 0.9,
    error: 0.8,
    by: 'root-trauma',
    felt: 'root-trauma',
  });
  let planetBody = bodyStep({ kind: 'planetary', mem: planet, prev: null, sideOf: () => 'left' }).body;
  planetBody = bodyStep({ kind: 'planetary', mem: planet, prev: planetBody, sideOf: () => 'left' }).body;

  // Two balanced natives who have closed the root-trauma link form a Social Memory Complex (coherence >= 0.95)
  const nativeA = {
    ...createPresetMemory('species:aaaa0001'),
    cause: [{ by: 'root-trauma' as const, d: 'root-trauma' as const, n: 2, open: false }],
  };
  const nativeB = {
    ...createPresetMemory('species:aaaa0002'),
    cause: [{ by: 'root-trauma' as const, d: 'root-trauma' as const, n: 2, open: false }],
  };

  const res1 = relievePlanetFromComplex({
    planetMem: planet,
    prevPlanetBody: planetBody,
    natives: [{ mem: nativeA }, { mem: nativeB }],
  });
  assert.equal(res1.isSocialMemoryComplex, true);
  assert.ok(res1.relievedRays.includes(1));
  // Second harmonic pass finishes clearing the remaining charge (29 -> 5 -> 0 <= REST_AT) without triggering Sharp Pain
  const res2 = relievePlanetFromComplex({
    planetMem: res1.planetMem,
    prevPlanetBody: res1.planetBody,
    natives: [{ mem: nativeA }, { mem: nativeB }],
  });
  assert.ok(res2.stargateCharge >= 0.95);
});

test('deriveElementPhysics & mixElementStack (Plan 57 §16.6 P1–P3): reproduces @hm/physmat 9-material oracle and alloy work-hardening', () => {
  for (const stack of PHYSMAT_ELEMENT_STACKS) {
    const ref = PHYS_MATERIALS.find((m) => m.id === stack.id);
    assert.ok(ref, `missing physmat reference for ${stack.id}`);
    const derived = deriveElementPhysics(stack);
    assert.equal(derived.density, ref.density, `${stack.id} density`);
    assert.ok(Math.abs(derived.bounce - ref.bounce) <= 0.12, `${stack.id} bounce: ${derived.bounce} vs ${ref.bounce}`);
    assert.ok(Math.abs(derived.friction - ref.friction) <= 0.14, `${stack.id} friction: ${derived.friction} vs ${ref.friction}`);
  }

  // Alloying copper + tin -> bronze increases Pxd hardness over weighted mean while lowering Lx conductivity
  const copper = { id: 'cu', name: 'Copper', pxd: 4800, vtx: 8960, lx: 9500, aq: 3800 };
  const tin = { id: 'sn', name: 'Tin', pxd: 2200, vtx: 7310, lx: 6000, aq: 2300 };
  const bronze = mixElementStack('bronze', 'Bronze', [
    { element: copper, massShare: 0.88 },
    { element: tin, massShare: 0.12 },
  ]);
  const weightedPxd = 0.88 * copper.pxd + 0.12 * tin.pxd;
  const weightedLx = 0.88 * copper.lx + 0.12 * tin.lx;
  assert.ok(bronze.pxd > weightedPxd, 'interstitial alloying increases hardness');
  assert.ok(bronze.lx < weightedLx, 'alloy lattice scattering lowers electrical conductivity');
  assert.ok(cellTemperatureKelvin(3800, copper) > 0);
});

test('combinePresets & generateSystemQuests (Plan 57 §18): emergent thermal thruster and homeostatic/karmic/frontier quests', () => {
  const chamber = {
    of: 'part:10000001',
    element: { id: 'steel', name: 'Steel', pxd: 8200, vtx: 7800, lx: 7500, aq: 4500 },
  };
  const propellant = {
    of: 'matc:20000002',
    element: { id: 'hydrolox', name: 'Hydrolox', pxd: 3000, vtx: 800, lx: 2000, aq: 9000 },
  };

  // Combining chamber + propellant at high heat with an open nozzle produces a thermal-thruster from first principles
  const thruster = combinePresets(chamber, propellant, { heatKelvin: 3200, openNozzle: true, massShareA: 0.6 });
  assert.equal(thruster.emergentMechanic, 'thermal-thruster');
  assert.ok(thruster.emergentOutput > 0);
  assert.ok(thruster.of.startsWith('part:'));

  // Planet with congested crust + native with open root-lack + newly crafted thruster -> 3 distinct System quest kinds
  let planet = createPresetMemory('world:99887766');
  planet = recordExperience(planet, {
    t: 1,
    stage: 'S3',
    cat: 'strip-mine',
    excitement: 1,
    error: 0.9,
    by: 'root-lack',
    felt: 'root-lack',
  });
  let pBody = bodyStep({ kind: 'planetary', mem: planet, prev: null, sideOf: () => 'left' }).body;
  pBody = bodyStep({ kind: 'planetary', mem: planet, prev: pBody, sideOf: () => 'left' }).body;

  let native = { ...createPresetMemory('species:55443322'), inv: 0.7 };
  native = recordExperience(native, {
    t: 2,
    stage: 'S3',
    cat: 'famine',
    excitement: 0.95,
    error: 0.85,
    by: 'root-lack',
    felt: 'root-lack',
  });
  const nBody = bodyStep({ kind: 'organic', mem: native, prev: null, sideOf: () => 'left' }).body;

  const quests = generateSystemQuests({
    planetMem: planet,
    planetBody: pBody,
    natives: [{ mem: native, body: nBody }],
    recentSyntheses: [thruster],
  });

  assert.ok(quests.some((q) => q.kind === 'homeostatic-planet'));
  assert.ok(quests.some((q) => q.kind === 'karmic-call'));
  assert.ok(quests.some((q) => q.kind === 'scientific-frontier'));
});
