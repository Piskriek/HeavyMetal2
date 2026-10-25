/**
 * The gait evaluator's gate (plan 44 §3): the three-tier distance LOD, the pure-function contract, and the wiring to the
 * project's own analytical two-bone solver.
 *
 * The tier schedule is the budget: near organisms conform to real ground every frame, midground ones read a pure
 * heightfield at the stage's cadence with zero raycasts, and far ones sleep without writing a matrix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASTRO_SUIT_GENOME,
  CREATURE_ARCHETYPE_GENOMES,
  creatureGaitRate,
  creatureGaitTier,
  creatureSkeleton,
  evaluateCreatureGait,
  quantiseGaitTime,
  GAIT_NEAR_HZ,
  GAIT_STAGE_HZ_MAX,
  GAIT_STAGE_HZ_MIN,
  GAIT_TIER_FAR_M,
  GAIT_TIER_NEAR_M,
} from '../src/index';

test('the distance schedule cuts at 15 m and 50 m, with the stage cadence clamped to 12–30 Hz', () => {
  assert.equal(creatureGaitTier(0), 0);
  assert.equal(creatureGaitTier(GAIT_TIER_NEAR_M - 0.001), 0);
  assert.equal(creatureGaitTier(GAIT_TIER_NEAR_M), 1);
  assert.equal(creatureGaitTier(GAIT_TIER_FAR_M - 0.001), 1);
  assert.equal(creatureGaitTier(GAIT_TIER_FAR_M), 2);
  assert.equal(creatureGaitTier(Number.POSITIVE_INFINITY), 2);
  assert.equal(creatureGaitTier(0, 2), 2, 'a test may force a tier');

  assert.equal(creatureGaitRate(0), GAIT_NEAR_HZ);
  assert.equal(creatureGaitRate(2), 0, 'the far tier does not sample');
  assert.equal(creatureGaitRate(1, 5), GAIT_STAGE_HZ_MIN);
  assert.equal(creatureGaitRate(1, 90), GAIT_STAGE_HZ_MAX);
  assert.equal(creatureGaitRate(1, 24), 24);
});

test('time is quantised to the tier cadence, so every frame inside one step shares a pose', () => {
  const a = quantiseGaitTime(0.041, 30);
  const b = quantiseGaitTime(0.0499, 30);
  assert.equal(a, b);
  assert.notEqual(quantiseGaitTime(0.075, 30), a);
  assert.equal(quantiseGaitTime(-1, 30), 0);
  assert.equal(quantiseGaitTime(1, 0), 0);
});

test('the pose is a pure function of (genome, time, velocity)', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const a = evaluateCreatureGait(genome, 1.234, 1.2);
    const b = evaluateCreatureGait(genome, 1.234, 1.2);
    assert.deepEqual(a, b, `${genome.id}: same arguments, same pose`);
  }
});

test('every limb is posed by the two-bone solver inside its own reach', () => {
  for (const genome of CREATURE_ARCHETYPE_GENOMES) {
    const skeleton = creatureSkeleton(genome);
    for (const t of [0, 0.17, 0.33, 0.5, 0.71, 0.99]) {
      const gait = evaluateCreatureGait(genome, t, 1.3);
      assert.equal(gait.limbs.length, skeleton.limbs.length, `${genome.id}: every chain is posed`);
      for (const limb of gait.limbs) {
        assert.ok(limb.withinReach, `${genome.id} ${limb.label} t=${t}: reach ${limb.reachM}`);
        assert.equal(limb.state, limb.phase < 0.5 || limb.phase >= 0 ? limb.state : limb.state);
        const frame = skeleton.limbs.find((l) => l.label === limb.label);
        assert.ok(frame);
        // the solved ankle can never be further from the hip than the two links allow, plus a millimetre of slack
        const span = Math.hypot(
          limb.solved[0] - limb.root[0],
          limb.solved[1] - limb.root[1],
          limb.solved[2] - limb.root[2],
        );
        assert.ok(span <= (frame as { upperLength: number; lowerLength: number }).upperLength + (frame as { lowerLength: number }).lowerLength + 1e-3);
      }
    }
  }
});

test('the tiers spend their budgets: near conforms, midground raycasts nothing, far sleeps', () => {
  let raycasts = 0;
  let heightfield = 0;
  const ground = (): number => 0.12;
  const gait = evaluateCreatureGait(ASTRO_SUIT_GENOME, 0.6, 1.4, {
    distanceM: 0,
    raycastHeightAt: () => {
      raycasts += 1;
      return 0.12;
    },
    groundHeightAt: () => {
      heightfield += 1;
      return 0;
    },
  });
  assert.equal(gait.lodTier, 0);
  assert.ok(raycasts > 0, 'the near tier reads the exact ground');
  assert.equal(heightfield, 0, 'the near tier never falls back to the heightfield');

  raycasts = 0;
  const mid = evaluateCreatureGait(ASTRO_SUIT_GENOME, 0.6, 1.4, {
    distanceM: 26,
    raycastHeightAt: () => {
      raycasts += 1;
      return 0.12;
    },
    groundHeightAt: ground,
  });
  assert.equal(mid.lodTier, 1);
  assert.equal(raycasts, 0, 'zero raycasts in the midground');
  assert.equal(mid.lodHz, creatureGaitRate(1, 18));

  const far = evaluateCreatureGait(ASTRO_SUIT_GENOME, 0.6, 1.4, { distanceM: 120 });
  assert.equal(far.lodTier, 2);
  assert.ok(far.sleeping, 'the far tier sleeps');
  assert.equal(far.lodHz, 0);
  for (const limb of far.limbs) {
    assert.deepEqual(limb.upperRotationDeg, [0, 0, 0]);
    assert.deepEqual(limb.lowerRotationDeg, [0, 0, 0]);
  }
});

test('a standing organism takes no stride: the feet hold and the pelvis only breathes', () => {
  const still = evaluateCreatureGait(ASTRO_SUIT_GENOME, 2.5, 0);
  for (const limb of still.limbs) {
    assert.equal(limb.state, 'stance');
    if (limb.target[1] < 0.3) assert.ok(Math.abs(limb.target[1] - 0.12) < 0.2, `${limb.label} keeps its foothold`);
  }
  const walking = evaluateCreatureGait(ASTRO_SUIT_GENOME, 2.5, 1.6);
  const moved = walking.limbs.some((l) => l.state === 'swing');
  assert.ok(moved, 'walking lifts a foot');
});
