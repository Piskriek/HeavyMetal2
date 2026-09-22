/**
 * T01 contract tests — the frozen interfaces of `src/game/contracts/`.
 *
 * Acceptance coverage for #34:
 * - legal and illegal state transitions tested
 * - old configs load as four racers with qualifying disabled
 * - snapshot reset does not share mutable arrays
 * - repeated commands are harmless
 * - public contracts documented before downstream integration
 *
 * Run with: node scripts/check.mjs   (tsc --noEmit, then node --import tsx --test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as contracts from '../src/game/contracts';
import {
  CONTRACTS_VERSION, ContractError, DENT_MAX_TOTAL_DEPTH, DENT_SLOTS, FIXED_STEP, GAMEPLAY_EFFECTS, HEAT_PHASES,
  LEGAL_HEAT_TRANSITIONS, MAX_RACERS, MAX_STAGING_DELAY, QUALIFYING_ATTEMPTS, STAGING_DELAY_CEILING, TICK_RATE,
  HeatController, advanceHeat, applyDent, assertGameplayEffect, assertRaceConfig, canTransitionHeat, cloneDentState,
  commandKey, compareQualifying, cpuStagingDelay, createDentState, createHeatState, createNullAdapter, createPickupArbiter,
  createPickupTrigger, createPropRegistry, createQualifyingEntry, createRacerRegistry, createRenderView,
  createReservationLedger, createWeightedMysteryResolver, dedupeCommands, deepFreeze, defaultReleaseCorridor,
  dentRenderView, dentTotalDepth, describeEvent, filterEvents, frameScript, laneCenterZ, normalizeRaceConfig,
  rankQualifying, recoverDents, registryRoundTrip, runHeadless, validateCommand, validateGateCrossing,
  validatePropDefinition, validateRaceConfig, validateReleaseCorridor,
  type GameCommand, type QualifyingEntry, type RaceConfigV1,
} from '../src/game/contracts';
import { RACER_DEFINITIONS } from '../src/game/types';

const legacySetup = (overrides: Record<string, unknown> = {}) => ({
  mode: 'quick', course: 'boomtown', loadout: { rider: 'nix', capsule: 'springsteel' },
  difficulty: 'racer', customPhysics: false, ...overrides,
});

const fieldConfig = (fieldSize: number, extra: Record<string, unknown> = {}): RaceConfigV1 => {
  const participants = Array.from({ length: fieldSize }, (_, index) => ({
    id: index, name: `RACER ${index}`, homeLane: index % 4, pace: 1,
    loadout: { rider: 'rivet', capsule: 'iron' }, isPlayer: index === 0,
  }));
  return normalizeRaceConfig({ version: CONTRACTS_VERSION, fieldSize, course: 'ridge', participants, ...extra }).config;
};

const entry = (racerId: number, overrides: Partial<QualifyingEntry> = {}): QualifyingEntry =>
  createQualifyingEntry({ racerId, attempt: 1, time: 12, speed: 400, peakSpeed: 420, rewardRolled: false, status: 'valid', ...overrides });

const gateState = (overrides: Record<string, unknown> = {}) =>
  ({ status: 'ready' as const, phase: 'release' as const, inputEnabled: true, racerId: 0, ...overrides });

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------

test('config: an old setup loads as four racers with qualifying disabled', () => {
  for (const legacy of [undefined, null, {}, legacySetup(), { raceConfig: legacySetup() }, 'nonsense', 42]) {
    const { config } = normalizeRaceConfig(legacy);
    assert.equal(config.fieldSize, 4, `legacy input ${JSON.stringify(legacy)} must load four racers`);
    assert.equal(config.participants.length, 4);
    assert.equal(config.qualifying.enabled, false, 'four-racer fields never qualify');
    assert.deepEqual(config.participants.map((participant) => participant.id), RACER_DEFINITIONS.map((definition) => definition.id));
    assert.equal(config.version, CONTRACTS_VERSION);
    assert.deepEqual([...validateRaceConfig(config)], [], 'the normalized config must be valid');
  }
});

test('config: a legacy setup keeps its course, loadout and custom-physics flag', () => {
  const { config } = normalizeRaceConfig(legacySetup({ customPhysics: true }));
  assert.equal(config.course, 'boomtown');
  assert.equal(config.customPhysics, true);
  assert.equal(config.participants[0].loadout.rider, 'nix');
  assert.equal(config.participants[0].loadout.capsule, 'springsteel');
});

test('config: large fields require explicit participants and force qualifying on', () => {
  const large = fieldConfig(20);
  assert.equal(large.participants.length, 20);
  assert.equal(large.qualifying.enabled, true, 'a 20-racer field must qualify');
  assert.deepEqual([...validateRaceConfig(large)], []);

  const missing = normalizeRaceConfig({ version: CONTRACTS_VERSION, fieldSize: 20, course: 'ridge' });
  assert.equal(missing.config.fieldSize, 4);
  assert.match(missing.repairs.join(' '), /No participant list/);

  const inconsistent = normalizeRaceConfig({ version: CONTRACTS_VERSION, fieldSize: 20, participants: [{ id: 0 }], course: 'ridge' });
  assert.equal(inconsistent.config.fieldSize, 4);
  assert.match(inconsistent.repairs.join(' '), /Participant list has 1 entries/);
});

test('config: hostile input is repaired, never thrown and never padded with invented racers', () => {
  const hostile = normalizeRaceConfig({
    version: CONTRACTS_VERSION, fieldSize: 50, course: 'nowhere',
    participants: Array.from({ length: 50 }, () => ({ id: 3, name: '', homeLane: 'x', pace: Number.NaN, loadout: { rider: 'nope', capsule: 5 } })),
    qualifying: { enabled: false, retries: -4, deadlineSeconds: 0 }, seed: Number.NaN,
  });
  assert.equal(hostile.config.fieldSize, 4, 'duplicate IDs fall back to the canonical field');
  assert.equal(hostile.config.course, 'ridge');
  assert.equal(hostile.config.seed, 1);
  assert.equal(hostile.config.qualifying.retries, 2);
  assert.equal(hostile.config.qualifying.deadlineSeconds, 20);
  assert.equal(hostile.config.participants.length, 4);
  assert.equal(hostile.config.participants[0].loadout.rider, 'rivet');
  assert.deepEqual([...validateRaceConfig(hostile.config)], []);
  assert.ok(hostile.repairs.length >= 2);
});

test('config: a 100-racer field normalizes and validates without bit tricks', () => {
  const big = fieldConfig(MAX_RACERS);
  assert.equal(big.fieldSize, MAX_RACERS);
  assert.equal(big.qualifying.enabled, true);
  const registry = createRacerRegistry(big.participants.map((participant) => participant.id));
  assert.equal(registry.size, MAX_RACERS);
  assert.equal(registry.indexOf(99), 99);
  assert.equal(registry.indexOf(1 << 5), 32, 'ID 32 must resolve to index 32, not wrap');
  assert.equal(registry.indexOf(-1), -1);
});

test('config: assertRaceConfig rejects impossible documents', () => {
  const good = fieldConfig(4);
  assert.equal(assertRaceConfig(good), good);
  assert.throws(() => assertRaceConfig({ ...good, fieldSize: 20 }),
    (error: unknown) => error instanceof ContractError && error.code === 'E_CONTRACT_SHAPE');
  assert.throws(() => assertRaceConfig({ ...good, qualifying: { enabled: true, retries: 2, deadlineSeconds: 20 } }),
    (error: unknown) => error instanceof ContractError);
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

test('identity: dense indices are lookup only and duplicates are refused', () => {
  const registry = createRacerRegistry([7, 3, 11]);
  assert.deepEqual([...registry.ids], [7, 3, 11], 'stable order is preserved');
  assert.equal(registry.requireIndex(3), 1);
  assert.equal(registry.idAt(2), 11);
  assert.equal(registry.idAt(3), undefined);
  assert.equal(registry.idAt(-1), undefined);
  assert.equal(registry.has(3), true);
  assert.equal(registry.has(4), false);
  assert.throws(() => registry.requireIndex(99), (error: unknown) => error instanceof ContractError && error.code === 'E_UNKNOWN_RACER');
  assert.throws(() => createRacerRegistry([1, 1]), (error: unknown) => error instanceof ContractError && error.code === 'E_DUPLICATE_RACER');
  assert.throws(() => createRacerRegistry([1.5]), (error: unknown) => error instanceof ContractError && error.code === 'E_RACER_ID');
  assert.throws(() => createRacerRegistry([-2]), (error: unknown) => error instanceof ContractError && error.code === 'E_RACER_ID');
  assert.deepEqual([...registry.denseIndices()], [0, 1, 2]);
});

// ---------------------------------------------------------------------------
// Tick timing
// ---------------------------------------------------------------------------

test('timing: fixed-step advance is deterministic and float tolerant', () => {
  assert.equal(TICK_RATE, 120);
  assert.equal(FIXED_STEP, 1 / 120);
  const clock = new contracts.FixedStepClock();
  assert.equal(clock.advance(0.05).ticks, 6, '0.05 s must be exactly six ticks');
  assert.equal(clock.advance(0.05).remainder, 0, 'the accumulator must not drift');
  assert.equal(clock.elapsedTicks, 12);

  const a = new contracts.FixedStepClock();
  const b = new contracts.FixedStepClock();
  const script = frameScript({ seconds: 2, frameDelta: 1 / 60, jitter: [0, 0.001, -0.001, 0.004] });
  for (const delta of script) { a.advance(delta); b.advance(delta); }
  assert.equal(a.elapsedTicks, b.elapsedTicks, 'the same delta script must produce the same tick count');
  assert.equal(a.elapsedTicks, Math.round(script.reduce((sum, delta) => sum + delta, 0) * TICK_RATE));
});

test('timing: long stalls are dropped instead of replayed', () => {
  const clock = new contracts.FixedStepClock();
  const result = clock.advance(5);
  assert.equal(result.ticks, 30, 'the tick ceiling bounds a single frame');
  assert.ok(result.droppedSeconds > 4.5, `expected most of the stall to be dropped, dropped ${result.droppedSeconds}`);
  assert.ok(clock.pending < FIXED_STEP);
  assert.equal(clock.advance(-1).ticks, 0);
  assert.throws(() => new contracts.FixedStepClock(0), (error: unknown) => error instanceof ContractError);
});

// ---------------------------------------------------------------------------
// Effects and pickups
// ---------------------------------------------------------------------------

test('effects: only fuel, shield and bounce are lasting effects', () => {
  assert.deepEqual([...GAMEPLAY_EFFECTS], ['fuel', 'shield', 'bounce']);
  assert.equal(assertGameplayEffect('fuel'), 'fuel');
  for (const invalid of ['mystery', 'Mystery', '', 'nitro', null, 7]) {
    assert.throws(() => assertGameplayEffect(invalid), (error: unknown) => error instanceof ContractError && error.code === 'E_EFFECT');
  }
});

test('effects: mystery is resolved once and can never be persisted as an effect', () => {
  const arbiter = createPickupArbiter();
  const claim = arbiter.claim(createPickupTrigger({ pickupId: 'pickup-1', racerId: 2, tick: 40, crossingFraction: 0.3, kind: 'mystery' }));
  assert.equal(claim.status, 'claimed');
  assert.equal(claim.requiresMysteryRoll, true);

  const first = arbiter.resolve('pickup-1', createWeightedMysteryResolver(), 0.1);
  assert.ok(first);
  assert.equal(first.fromMystery, true);
  assert.equal(first.effect, 'fuel');

  const second = arbiter.resolve('pickup-1', createWeightedMysteryResolver(), 0.99);
  assert.deepEqual(second, first, 're-resolving must return the recorded effect, never re-roll');
  assert.equal(arbiter.resolve('pickup-1')?.effect, first.effect);
  assert.equal(arbiter.isClaimed('pickup-1'), true);
  assert.equal(arbiter.resolve('never-claimed'), null);
  assert.equal(arbiter.resolved().length, 1);
});

test('effects: the weighted resolver stays inside the effect set for every roll', () => {
  const resolver = createWeightedMysteryResolver();
  for (let step = 0; step < 100; step++) {
    const effect = resolver({ pickupId: 'p', racerId: 0, tick: 0, roll: step / 100 });
    assert.ok((GAMEPLAY_EFFECTS as readonly string[]).includes(effect), `roll ${step / 100} produced "${effect}"`);
  }
  assert.equal(resolver({ pickupId: 'p', racerId: 0, tick: 0, roll: 0, weights: { fuel: 0, shield: 0, bounce: 0 } }), 'fuel');
  assert.equal(resolver({ pickupId: 'p', racerId: 0, tick: 0, roll: 0.9, weights: { fuel: 0, shield: 0, bounce: 1 } }), 'bounce');
});

test('effects: same-tick arbitration is crossing fraction then racer ID', () => {
  const arbiter = createPickupArbiter();
  const late = createPickupTrigger({ pickupId: 'p', racerId: 1, tick: 10, crossingFraction: 0.8, kind: 'fuel' });
  const early = createPickupTrigger({ pickupId: 'p', racerId: 3, tick: 10, crossingFraction: 0.2, kind: 'fuel' });
  const tieLower = createPickupTrigger({ pickupId: 'p', racerId: 0, tick: 10, crossingFraction: 0.2, kind: 'fuel' });

  assert.equal(arbiter.claim(late).status, 'claimed');
  assert.equal(arbiter.winnerOf('p'), 1);
  assert.equal(arbiter.claim(early).status, 'claimed', 'an earlier crossing fraction in the same tick wins outright');
  assert.equal(arbiter.winnerOf('p'), 3);
  assert.equal(arbiter.claim(tieLower).status, 'claimed', 'an exact tie goes to the lower racer ID');
  assert.equal(arbiter.claim(tieLower).status, 'already-claimed', 'an identical claim is harmless');
  assert.equal(arbiter.claim(late).status, 'lost-arbitration', 'a worse crossing in the same tick loses');
  assert.equal(arbiter.claim(createPickupTrigger({ pickupId: 'p', racerId: 0, tick: 99, crossingFraction: 0.05, kind: 'fuel' })).status, 'lost-arbitration',
    'a later tick never displaces the winner');
  assert.equal(arbiter.winnerOf('p'), 0);
  assert.equal(arbiter.resolve('p')?.racerId, 0, 'the winning claim keeps the pickup');

  arbiter.clear();
  assert.equal(arbiter.size, 0);
  assert.equal(arbiter.resolve('p'), null);
  assert.throws(() => createPickupTrigger({ pickupId: '', racerId: 0, tick: 0, crossingFraction: 0, kind: 'fuel' }), (error: unknown) => error instanceof ContractError);
  assert.throws(() => createPickupTrigger({ pickupId: 'x', racerId: 0, tick: 0, crossingFraction: 2, kind: 'fuel' }), (error: unknown) => error instanceof ContractError);
  assert.throws(() => createPickupTrigger({ pickupId: 'x', racerId: 0, tick: -1, crossingFraction: 0, kind: 'fuel' }), (error: unknown) => error instanceof ContractError);
});

// ---------------------------------------------------------------------------
// Qualifying and gate timing
// ---------------------------------------------------------------------------

test('qualifying: valid entries always rank before every fallback class', () => {
  const entries = [
    entry(0, { status: 'fallback', fallback: 'retry-exhausted', time: null, speed: 900 }),
    entry(1, { status: 'fallback', fallback: 'dnf', time: null }),
    entry(2, { time: 30, speed: 200 }),
    entry(3, { time: 25, speed: 210 }),
  ];
  const ranked = rankQualifying(entries, 2);
  assert.deepEqual(ranked.map((item) => item.racerId), [3, 2, 1, 0]);
  assert.deepEqual(ranked.map((item) => item.status), ['valid', 'valid', 'fallback', 'fallback']);
  assert.deepEqual(ranked.map((item) => item.advanced), [true, true, false, false]);
  assert.deepEqual(ranked.map((item) => item.rank), [1, 2, 3, 4]);
});

test('qualifying: ties fall through to speed then racer ID deterministically', () => {
  const slower = entry(4, { time: 20, speed: 300 });
  const faster = entry(9, { time: 20, speed: 360 });
  assert.ok(compareQualifying(faster, slower) < 0, 'a faster crossing wins an equal time');
  const tied = entry(2, { time: 20, speed: 360 });
  assert.ok(compareQualifying(tied, faster) < 0, 'an exact tie falls through to the lower racer ID');
  assert.throws(() => rankQualifying([], 0), (error: unknown) => error instanceof ContractError);
});

test('qualifying: retry entries cannot reroll a heat reward and stay in their own attempt', () => {
  const first = entry(0, { attempt: 1, rewardRolled: true });
  const retry = entry(0, { attempt: 2, time: 18, rewardRolled: true });
  assert.equal(first.rewardRolled, true);
  assert.equal(retry.attempt, 2);
  assert.notEqual(first, retry);
  assert.throws(() => createQualifyingEntry({ racerId: 0, attempt: 0, status: 'valid', time: 1, speed: 1, peakSpeed: 1, rewardRolled: false }),
    (error: unknown) => error instanceof ContractError);
  assert.throws(() => createQualifyingEntry({ racerId: 0, attempt: 1, status: 'fallback', time: null, speed: 0, peakSpeed: 0, rewardRolled: false }),
    (error: unknown) => error instanceof ContractError, 'a fallback needs a fallback class');
  assert.throws(() => createQualifyingEntry({ racerId: 0, attempt: 1, status: 'valid', time: -1, speed: 0, peakSpeed: 0, rewardRolled: false }),
    (error: unknown) => error instanceof ContractError);
  assert.equal(QUALIFYING_ATTEMPTS, 3, 'two retries means three attempts');
});

test('qualifying: the gate crossing is swept over the whole movement range', () => {
  const gate = { id: 'g', x: 1000, z: 0, halfWidth: 120, altitude: 40, altitudeTolerance: 90, segment: 'section-1' };
  const ok = validateGateCrossing({ from: { x: 900, z: 0, altitude: 40 }, to: { x: 1400, z: 0, altitude: 40 }, gate, segment: 'section-1' });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.ok(Math.abs(ok.fraction - (1000 - 900) / 500) < 1e-9, 'the crossing fraction must come from the swept solve');
    assert.equal(ok.distance, 100);
  }

  const cases: readonly [string, Parameters<typeof validateGateCrossing>[0], string][] = [
    ['wrong-lane', { from: { x: 900, z: 400, altitude: 40 }, to: { x: 1400, z: 400, altitude: 40 }, gate, segment: 'section-1' }, 'wrong-lane'],
    ['reverse', { from: { x: 1400, z: 0, altitude: 40 }, to: { x: 900, z: 0, altitude: 40 }, gate, segment: 'section-1' }, 'reverse'],
    ['above-gate', { from: { x: 900, z: 0, altitude: 300 }, to: { x: 1400, z: 0, altitude: 300 }, gate, segment: 'section-1' }, 'above-gate'],
    ['wrong-segment', { from: { x: 900, z: 0, altitude: 40 }, to: { x: 1400, z: 0, altitude: 40 }, gate, segment: 'section-2' }, 'wrong-segment'],
    ['missed', { from: { x: 1200, z: 0, altitude: 40 }, to: { x: 1400, z: 0, altitude: 40 }, gate, segment: 'section-1' }, 'missed'],
  ];
  for (const [name, input, reason] of cases) {
    const outcome = validateGateCrossing(input);
    assert.equal(outcome.ok, false, `${name} must be rejected`);
    if (!outcome.ok) assert.equal(outcome.reason, reason, `${name} must report "${reason}"`);
  }
  const straddle = validateGateCrossing({ from: { x: 900, z: 0, altitude: 40 }, to: { x: 1400, z: 0, altitude: 40 }, gate, segment: null });
  assert.equal(straddle.ok, true, 'a boundary straddle is accepted rather than guessed');
});

// ---------------------------------------------------------------------------
// Heat and participant transitions
// ---------------------------------------------------------------------------

test('heat: the legal transition graph is the only way forward', () => {
  assert.deepEqual([...HEAT_PHASES], ['staging', 'qualifying', 'release', 'racing', 'settling', 'results']);
  for (const from of HEAT_PHASES) {
    for (const to of HEAT_PHASES) {
      assert.equal(canTransitionHeat(from, to), (LEGAL_HEAT_TRANSITIONS[from] ?? []).includes(to));
    }
  }
  assert.equal(canTransitionHeat('staging', 'racing'), false);
  assert.equal(canTransitionHeat('racing', 'staging'), false);
  assert.equal(canTransitionHeat('results', 'staging'), true);
});

test('heat: a four-racer heat releases without qualifying and refuses to qualify', () => {
  const controller = new HeatController(fieldConfig(4));
  const refused = controller.send({ type: 'begin-qualifying' });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.code, 'E_QUALIFYING_DISABLED');
  assert.equal(controller.phase, 'staging', 'a refused transition must not move the phase');

  assert.equal(controller.send({ type: 'release' }).ok, true);
  assert.equal(controller.phase, 'release');
  assert.equal(controller.send({ type: 'race-start', tick: 0 }).ok, true);
  assert.equal(controller.phase, 'racing');
  assert.equal(controller.send({ type: 'settle-complete' }).ok, true);
  assert.equal(controller.send({ type: 'results-ready' }).ok, true);
  assert.equal(controller.phase, 'results');
  assert.equal(controller.send({ type: 'acknowledge' }).ok, true);
  assert.equal(controller.phase, 'staging');
});

test('heat: illegal transitions are refused with a typed code and logged', () => {
  const controller = new HeatController(fieldConfig(4));
  const illegal: Parameters<HeatController['send']>[0][] = [
    { type: 'race-start', tick: 0 },
    { type: 'settle-complete' },
    { type: 'results-ready' },
    { type: 'acknowledge' },
    { type: 'qualifying-complete', order: [] },
    { type: 'racer-finished', racerId: 0 },
  ];
  for (const event of illegal) {
    const outcome = controller.send(event);
    assert.equal(outcome.ok, false, `${event.type} must be refused in staging`);
    if (!outcome.ok) assert.equal(outcome.code, 'E_PHASE_TRANSITION');
  }
  assert.equal(controller.phase, 'staging');
  assert.equal(filterEvents(controller.events, 'command-rejected').length, illegal.length);
  assert.equal(controller.send({ type: 'abort', reason: 'test' }).ok, true);
  assert.equal(controller.phase, 'staging');
  assert.equal(filterEvents(controller.events, 'heat-aborted').length, 1);
});

test('heat: a large field must qualify and its order must cover the whole field', () => {
  const controller = new HeatController(fieldConfig(20));
  assert.equal(controller.send({ type: 'begin-qualifying' }).ok, true);
  assert.equal(controller.phase, 'qualifying');
  assert.equal(filterEvents(controller.events, 'qualifying-begun').length, 20, 'every racer begins an attempt');

  const partial = controller.send({ type: 'qualifying-complete', order: [entry(0)] });
  assert.equal(partial.ok, false);
  if (!partial.ok) assert.equal(partial.code, 'E_PARTICIPANTS');

  const withOutsider = [...Array.from({ length: 20 }, (_, index) => entry(index)), entry(999)];
  assert.equal(controller.send({ type: 'qualifying-complete', order: withOutsider }).ok, false);

  const order = Array.from({ length: 20 }, (_, index) => entry(19 - index, { time: 10 + index }));
  assert.equal(controller.send({ type: 'qualifying-complete', order }).ok, true);
  assert.equal(controller.phase, 'release');
  assert.equal(controller.heat.qualifyingOrder.length, 20);
  assert.deepEqual([...filterEvents(controller.events, 'qualifying-complete')[0].order].slice(0, 3), [19, 18, 17]);
});

test('heat: release and finishing are once-only and idempotent', () => {
  const controller = new HeatController(fieldConfig(4));
  controller.send({ type: 'release' });
  const again = controller.send({ type: 'release' });
  assert.equal(again.ok, true);
  assert.equal(again.ok && again.idempotent, true);
  assert.equal(filterEvents(controller.events, 'released').length, 1, 'a repeated release must not emit a second event');

  controller.send({ type: 'race-start', tick: 0 });
  assert.equal(controller.finish(2).ok, true);
  const repeated = controller.finish(2);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.ok && repeated.idempotent, true);
  assert.equal(controller.heat.finished.length, 1);
  assert.equal(filterEvents(controller.events, 'finished')[0].position, 1);

  const outsider = controller.finish(77);
  assert.equal(outsider.ok, false);
  if (!outsider.ok) assert.equal(outsider.code, 'E_PARTICIPANTS');
  controller.send({ type: 'settle-complete' });
  controller.send({ type: 'results-ready' });
  assert.equal(controller.send({ type: 'abort', reason: 'late' }).ok, false, 'a read heat cannot be aborted');
  assert.equal(controller.send({ type: 'acknowledge' }).ok, true);
  assert.equal(controller.phase, 'staging');
});

test('heat: advanceHeat keeps advancing racers stable and drops duplicates', () => {
  const before = createHeatState(fieldConfig(20));
  const after = advanceHeat(before, { advancing: [5, 7, 5], roster: [0, 1, 2, 3, 5, 7, 9], fieldSize: 4 });
  assert.equal(after.heatIndex, before.heatIndex + 1);
  assert.deepEqual([...after.participants], [5, 7, 0, 1]);
  assert.equal(after.phase, 'staging');
  assert.equal(after.released, false);
  assert.notEqual(after.participants, before.participants);
  assert.notEqual(after.qualifyingOrder, before.qualifyingOrder);
  assert.equal(before.heatIndex, 0, 'the previous heat is untouched');
  assert.equal(before.participants.length, 20);
});

test('heat: cpu staging is deterministically bounded for every supported field size', () => {
  for (const fieldSize of [4, 20, 50, MAX_RACERS]) {
    const delays = Array.from({ length: fieldSize }, (_, index) => cpuStagingDelay(index, fieldSize));
    const maximum = Math.max(...delays);
    assert.ok(maximum <= STAGING_DELAY_CEILING, `${fieldSize} racers produced a ${maximum}s delay`);
    assert.ok(maximum >= MAX_STAGING_DELAY - 1e-9, 'the last slot uses the whole staging window');
    assert.deepEqual(delays, Array.from({ length: fieldSize }, (_, index) => cpuStagingDelay(index, fieldSize)), 'the schedule is deterministic');
    for (let index = 1; index < fieldSize; index++) {
      assert.ok(delays[index] >= delays[index - 1], 'the schedule never goes backwards');
      assert.ok(delays[index] - delays[index - 1] <= MAX_STAGING_DELAY / (fieldSize - 1) + 0.02, 'one slot never jumps the whole window');
    }
    // The regression the ticket calls out: a schedule that grows with the racer index.
    assert.ok(delays[fieldSize - 1] < 3, `a ${fieldSize}-racer field must not stage linearly (last slot ${delays[fieldSize - 1]}s)`);
  }
  assert.ok(cpuStagingDelay(99, MAX_RACERS) > cpuStagingDelay(0, MAX_RACERS), 'later slots still deploy later');
  assert.equal(cpuStagingDelay(-1, 20), 0);
});

// ---------------------------------------------------------------------------
// Prop registry
// ---------------------------------------------------------------------------

test('props: definitions are validated, unknown fields preserved and IDs unique', () => {
  const raw = {
    id: 'prop-1', type: 'prop_25_timber_coaster_loop', category: 'hazard', x: 10, y: 20, z: 30,
    width: 64, height: 128, depth: 32, solid: true, tags: ['loop', 'timber'], mysteryFutureField: { nested: true },
  };
  const registry = createPropRegistry([raw]);
  const definition = registry.require('prop-1');
  assert.deepEqual({ ...definition.extents }, { width: 64, height: 128, depth: 32 });
  assert.equal(definition.category, 'hazard');
  assert.equal(definition.solid, true);
  assert.equal(definition.pickup, false);
  assert.deepEqual(definition.unknown, { mysteryFutureField: { nested: true } });
  assert.equal(definition.transform.x, 10);
  assert.equal(definition.transform.rotY, 0);
  assert.equal(registry.solids().length, 1);
  assert.equal(registry.byCategory('decoration').length, 0);
  assert.equal(registry.ids.length, 1);
  assert.equal(registry.get('nope'), undefined);

  const roundTripped = registryRoundTrip(registry);
  assert.equal(roundTripped.length, 1);
  assert.deepEqual(roundTripped[0].unknown, definition.unknown, 'an unknown field must survive a round trip');

  assert.throws(() => createPropRegistry([raw, raw]), (error: unknown) => error instanceof ContractError && error.code === 'E_DUPLICATE_PROP');
  assert.throws(() => registry.require('nope'), (error: unknown) => error instanceof ContractError);
});

test('props: dimensions are never scaled twice and invalid definitions are rejected', () => {
  const doubleScaled = { id: 'p', type: 'barrel', width: 4, height: 4, depth: 4, scale: 2 };
  assert.match(validatePropDefinition(doubleScaled).join(' '), /applied twice/);
  assert.throws(() => createPropRegistry([doubleScaled]), (error: unknown) => error instanceof ContractError && error.code === 'E_DOUBLE_SCALE');

  assert.throws(() => createPropRegistry([{ id: 'p', type: 'barrel', width: -1, height: 4, depth: 4 }]),
    (error: unknown) => error instanceof ContractError && error.code === 'E_PROP_DEFINITION');
  assert.throws(() => createPropRegistry([{ type: 'barrel' }]), (error: unknown) => error instanceof ContractError);
  assert.throws(() => createPropRegistry([{ id: 'p' }]), (error: unknown) => error instanceof ContractError);
  assert.throws(() => createPropRegistry([{ id: 'p', type: 'barrel', scaleConvention: 'legacy-scale' }]), (error: unknown) => error instanceof ContractError);
  assert.deepEqual([...validatePropDefinition({ id: 'p', type: 'barrel' })], []);
  assert.deepEqual([...validatePropDefinition(null)], ['Definition is not an object.']);
});

// ---------------------------------------------------------------------------
// Release corridor and reservations
// ---------------------------------------------------------------------------

test('release: the corridor validates spawns, spacing and blocking props', () => {
  const corridor = defaultReleaseCorridor();
  const spawns = [0, 1, 2, 3].map((id) => ({ racerId: id, x: 190 + id * 90, z: laneCenterZ(id) }));
  assert.equal(validateReleaseCorridor(corridor, spawns).ok, true);

  const outside = validateReleaseCorridor(corridor, [...spawns, { racerId: 4, x: corridor.to + 500, z: 0 }]);
  assert.equal(outside.ok, false);
  assert.ok(outside.violations.some((violation) => violation.code === 'outside-corridor'));

  const crowded = validateReleaseCorridor(corridor, [{ racerId: 0, x: 300, z: 0 }, { racerId: 1, x: 300, z: 0 }]);
  assert.ok(crowded.violations.some((violation) => violation.code === 'spacing'));

  const duplicated = validateReleaseCorridor(corridor, [...spawns, { racerId: 0, x: 700, z: 0 }]);
  assert.ok(duplicated.violations.some((violation) => violation.code === 'duplicate-racer'));

  const blockedRegistry = createPropRegistry([{ id: 'wall', type: 'barrier', category: 'barrier', x: 400, z: 0, width: 120, height: 80, depth: 240, solid: true }]);
  const blocked = validateReleaseCorridor(corridor, spawns, blockedRegistry.solids());
  assert.equal(blocked.ok, false);
  assert.match(blocked.violations.map((violation) => violation.message).join(' '), /intrudes into the release corridor/);
  assert.equal(validateReleaseCorridor(corridor, []).violations[0].code, 'no-spawns');
});

test('release: reservations are idempotent per holder and deny other holders', () => {
  const ledger = createReservationLedger();
  const first = ledger.reserve('corridor:grid', 0, 4);
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.status, 'created');

  const repeat = ledger.reserve('corridor:grid', 0, 9);
  assert.equal(repeat.ok, true);
  assert.equal(repeat.ok && repeat.status, 'already-held');
  assert.equal(repeat.ok && repeat.record.tick, 4, 'repeating your own reservation must not move its timestamp');

  const conflict = ledger.reserve('corridor:grid', 1, 10);
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.status, 'conflict');
    assert.equal(conflict.heldBy, 0);
    assert.equal(conflict.heldSinceTick, 4);
  }

  assert.equal(ledger.isReservedBy('corridor:grid', 0), true);
  assert.equal(ledger.holderOf('corridor:grid'), 0);
  assert.equal(ledger.release('corridor:grid', 1), false, 'a non-holder cannot release a reservation');
  assert.equal(ledger.release('corridor:grid', 0), true);
  assert.equal(ledger.reserve('corridor:grid', 1, 11).ok, true);

  ledger.reserve('pickup:1', 1, 12);
  assert.deepEqual([...ledger.releaseAllFor(1)], ['corridor:grid', 'pickup:1']);
  assert.equal(ledger.size, 0);
  assert.deepEqual([...ledger.snapshot()], []);
  assert.throws(() => ledger.reserve('', 0, 0), (error: unknown) => error instanceof ContractError && error.code === 'E_RESERVATION');
  assert.throws(() => ledger.reserve('x', -1, 0), (error: unknown) => error instanceof ContractError);
});

// ---------------------------------------------------------------------------
// Dents
// ---------------------------------------------------------------------------

test('dents: three slots, deterministic merge and an aggregate cap', () => {
  let state = createDentState();
  state = applyDent(state, { direction: { x: 0, y: 1, z: 0 }, severity: 4, tick: 1 });
  assert.equal(state.slots.length, 1);
  assert.ok(dentTotalDepth(state) > 3.9);

  const merged = applyDent(state, { direction: { x: 0.05, y: 0.99, z: 0 }, severity: 3, tick: 2 });
  assert.equal(merged.slots.length, 1, 'a same-facing impact merges into the existing slot');
  assert.equal(merged.slots[0].count, 2);
  assert.equal(merged.slots[0].tick, 2);

  let spread = createDentState();
  const directions = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }];
  for (let index = 0; index < directions.length; index++) spread = applyDent(spread, { direction: directions[index], severity: 20, tick: index });
  assert.equal(spread.slots.length, DENT_SLOTS, 'never more than three slots');
  assert.ok(dentTotalDepth(spread) <= DENT_MAX_TOTAL_DEPTH + 1e-9, `aggregate cap exceeded: ${dentTotalDepth(spread)}`);
  assert.ok(spread.slots.every((slot) => slot.depth <= DENT_MAX_TOTAL_DEPTH));

  assert.equal(applyDent(state, { direction: { x: 1, y: 0, z: 0 }, severity: 0.01, tick: 3 }), state, 'a cosmetic impact changes nothing');
  assert.equal(applyDent(state, { direction: { x: 0, y: -1, z: 0 }, severity: 5, tick: 4 }).slots.length, 2);
  assert.equal(applyDent(createDentState(), { direction: { x: 0, y: 0, z: 0 }, severity: 6, tick: 0 }).slots[0].direction.y, -1, 'a degenerate direction falls back to -y');
});

test('dents: recovery is exponential and the 50% repair notice fires exactly once', () => {
  let state = applyDent(createDentState(), { direction: { x: 0, y: 1, z: 0 }, severity: 12, tick: 0 });
  let repairs = 0;
  let previous = dentTotalDepth(state);
  for (let step = 0; step < 1800; step++) {
    const recovery = recoverDents(state, 1 / 60);
    state = recovery.state;
    if (recovery.repaired) repairs++;
    const total = dentTotalDepth(state);
    assert.ok(total <= previous + 1e-9, 'recovery never grows a dent');
    previous = total;
    if (state.slots.length === 0) break;
  }
  assert.equal(repairs, 1, `the repair notice must fire exactly once, fired ${repairs}`);
  assert.equal(dentTotalDepth(state), 0);
  assert.equal(state.peak, 0);
  assert.equal(recoverDents(state, 1).repaired, false);
  assert.equal(dentRenderView(state).totalDepth, 0);
  const fresh = applyDent(createDentState(), { direction: { x: 0, y: 1, z: 0 }, severity: 9, tick: 0 });
  assert.equal(dentRenderView(fresh).clamped > 0, true);
  assert.ok(dentRenderView(fresh).clamped <= 1);
});

// ---------------------------------------------------------------------------
// Render contract
// ---------------------------------------------------------------------------

test('render: the frame is frozen plain data the renderer cannot write back to', () => {
  const source = {
    tick: 120, time: 1, phase: 'racing' as const, camera: { x: 10, y: 2 },
    racers: [{ id: 3, name: 'NIX', color: '#fff', x: 1, y: 2, z: 3, rotation: 0.5, lane: 1, speed: 200, falling: false, grounded: true, finished: false, shieldUntil: 5 }],
    playerId: 3, reducedMotion: false, paused: false,
  };
  const view = createRenderView(source, 1);
  assert.equal(view.playerIndex, 0);
  assert.equal(view.racers[0].shieldActive, true, 'a shield active at this time reads true');
  assert.equal(createRenderView({ ...source, playerId: null }).playerIndex, -1);
  assert.equal(createRenderView({ ...source, playerId: 99 }).playerIndex, -1);
  assert.equal(view.racers[0].dent.totalDepth, 0, 'a racer without dent state reads an empty dent view');
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.racers), true);
  assert.equal(Object.isFrozen(view.racers[0]), true);
  assert.throws(() => { (view.racers as unknown as { push(value: unknown): void }).push({}); }, TypeError);
  assert.throws(() => { (view.racers[0] as unknown as { x: number }).x = 99; }, TypeError);
  assert.throws(() => { (view.camera as unknown as { x: number }).x = 99; }, TypeError);
});

test('render: deepFreeze handles cycles, maps and nested arrays', () => {
  const cyclic: Record<string, unknown> = { name: 'root', list: [{ deep: { value: 1 } }] };
  cyclic.self = cyclic;
  const frozen = deepFreeze(cyclic) as Record<string, unknown>;
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(Object.isFrozen((frozen.list as unknown[])[0]), true);
  assert.equal(Object.isFrozen(deepFreeze(new Map([['a', { b: 1 }]]))), true);
  assert.equal(Object.isFrozen(deepFreeze(new Set([{ c: 2 }]))), true);
  assert.equal(deepFreeze(7), 7);
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

test('commands: the gate decides what is legal, and refusals are typed', () => {
  const aim = (power: number, angle: number): GameCommand => ({ type: 'aim', power, angle });
  assert.equal(validateCommand(aim(0.8, 36), gateState()).ok, true);
  for (const bad of [aim(0.1, 36), aim(1.2, 36), aim(0.8, 5), aim(0.8, 90), aim(Number.NaN, 36)]) {
    const verdict = validateCommand(bad, gateState());
    assert.equal(verdict.ok, false, `${JSON.stringify(bad)} must be refused`);
    if (!verdict.ok) assert.equal(verdict.code, 'E_COMMAND');
  }
  assert.equal(validateCommand(aim(0.8, 36), gateState({ status: 'flying' })).ok, false, 'aim is grid-only');
  assert.equal(validateCommand({ type: 'launch' }, gateState({ status: 'flying' })).ok, false);
  assert.equal(validateCommand({ type: 'launch' }, gateState()).ok, true);
  assert.equal(validateCommand({ type: 'boost' }, gateState({ status: 'paused' })).ok, false);
  assert.equal(validateCommand({ type: 'toggle-pause' }, gateState({ status: 'flying', phase: 'racing' })).ok, true);
  assert.equal(validateCommand({ type: 'toggle-pause' }, gateState({ phase: 'results' })).ok, false);
  assert.equal(validateCommand({ type: 'restart' }, gateState({ phase: 'racing' })).ok, true);
  assert.equal(validateCommand({ type: 'restart' }, gateState({ phase: 'release' })).ok, false);
  assert.equal(validateCommand({ type: 'teleport', x: 2400 }, gateState()).ok, true);
  assert.equal(validateCommand({ type: 'teleport', x: -5 }, gateState()).ok, false);
  assert.equal(validateCommand({ type: 'steer', direction: 2 as unknown as 1 }, gateState()).ok, false);
  assert.equal(validateCommand({ type: 'set-option', key: '', value: 1 }, gateState()).ok, false);
  assert.equal(validateCommand({ type: 'reserve', resourceId: '', racerId: 0 }, gateState()).ok, false);
  assert.equal(validateCommand({ type: 'noop' }, gateState({ inputEnabled: false })).ok, true, 'a no-op is harmless even with input disabled');
  assert.equal(validateCommand({ type: 'boost' }, gateState({ inputEnabled: false })).ok, false);
});

test('commands: repeated commands collapse and never double-apply', () => {
  const commands: GameCommand[] = [
    { type: 'boost' }, { type: 'boost' }, { type: 'boost' },
    { type: 'steer', direction: 1 }, { type: 'steer', direction: 1 },
    { type: 'noop' },
    { type: 'steer', direction: -1 },
    { type: 'boost' },
  ];
  assert.deepEqual(dedupeCommands(commands).map((command) => command.type), ['boost', 'steer', 'steer', 'boost']);
  assert.deepEqual([...dedupeCommands([])], []);
  assert.deepEqual([...dedupeCommands([{ type: 'noop' }])], []);
  assert.equal(commandKey({ type: 'steer', direction: 1 }), 'steer:1');
  assert.equal(commandKey({ type: 'aim', power: 0.5, angle: 30 }), 'aim:0.5000:30.0000');

  const queue = new contracts.CommandQueue();
  assert.equal(queue.push({ type: 'boost' }), true);
  assert.equal(queue.push({ type: 'boost' }), false, 'an identical repeat is dropped');
  assert.equal(queue.push({ type: 'noop' }), false);
  assert.equal(queue.size, 1);
  assert.deepEqual(queue.drain().map((command) => command.type), ['boost']);
  assert.equal(queue.size, 0);
  queue.push({ type: 'boost' });
  queue.clear();
  assert.equal(queue.size, 0);
});

// ---------------------------------------------------------------------------
// Headless stepping seam
// ---------------------------------------------------------------------------

test('seam: a heat steps headlessly with deterministic tick counts', () => {
  const deltas = [1 / 60, 1 / 60, 1 / 120, 0.5];
  const first = runHeadless({ adapter: createNullAdapter(1), frameDeltas: deltas });
  assert.equal(first.ticks, 2 + 2 + 1 + 30, 'ticks are exact and the stall is capped');
  assert.ok(first.droppedSeconds >= 0.25, `the stall beyond the frame ceiling is dropped, dropped ${first.droppedSeconds}`);
  assert.equal(first.adapterId, 'null-adapter');
  assert.equal(first.seed, 1);
  assert.equal(first.frames, deltas.length);
  assert.equal(first.observations.length, deltas.length);

  const second = runHeadless({ adapter: createNullAdapter(1), frameDeltas: deltas });
  assert.equal(second.ticks, first.ticks, 'the same frame script always yields the same ticks');
  const wallClock = runHeadless({ adapter: createNullAdapter(1), seconds: 1, frameDelta: 1 / 60 });
  assert.equal(wallClock.ticks, 120);
});

test('seam: the controller steps its adapter and keeps one clock', () => {
  const adapter = createNullAdapter(7);
  const controller = new HeatController(fieldConfig(4), adapter);
  controller.send({ type: 'release' });
  controller.send({ type: 'race-start', tick: 0 });
  controller.step(12, [{ type: 'boost' }]);
  assert.equal(controller.currentTick, 12);
  assert.equal(adapter.steps, 12);
  assert.deepEqual(adapter.lastCommands.map((command) => command.type), ['boost']);
  assert.throws(() => controller.step(-1), (error: unknown) => error instanceof ContractError);
  assert.equal(adapter.resetCount, 0, 'the seam never resets behind the caller\'s back');
  assert.equal(createNullAdapter(3).id, 'null-adapter');
});

test('seam: commands reach the adapter through the seam and refusals stay out', () => {
  const received: string[] = [];
  const base = createNullAdapter(1);
  const adapter = { ...base, tick: (_index: number, _step: number, commands: readonly GameCommand[]) => { received.push(...commands.map((command) => command.type)); } };
  const controller = new HeatController(fieldConfig(4), adapter);
  const burst: GameCommand[] = [{ type: 'boost' }, { type: 'boost' }, { type: 'aim', power: 0.9, angle: 40 }];
  const accepted = dedupeCommands(burst).filter((command) => validateCommand(command, { status: 'ready', phase: controller.phase, inputEnabled: true, racerId: 0 }).ok);
  controller.step(1, accepted);
  assert.deepEqual(received, ['boost', 'aim']);
  assert.equal(describeEvent({ type: 'boost-used', tick: 3, racerId: 0, charges: 1 }), 'boost-used tick=3 racerId=0 charges=1');
  assert.equal(describeEvent({ type: 'qualifying-complete', tick: 1, order: [2, 1] }), 'qualifying-complete tick=1 order=[2,1]');
});

// ---------------------------------------------------------------------------
// Snapshot isolation and the public surface
// ---------------------------------------------------------------------------

test('snapshot reset does not share mutable arrays with the previous state', () => {
  const before = createHeatState(fieldConfig(20));
  const snapshot = { ...before, participants: [...before.participants], qualifyingOrder: [...before.qualifyingOrder], finished: [...before.finished] };
  const after = advanceHeat(before, { advancing: [1], roster: [0, 1, 2], fieldSize: 4 });

  assert.notEqual(after.participants, before.participants);
  assert.notEqual(after.qualifyingOrder, before.qualifyingOrder);
  assert.notEqual(after.finished, before.finished);
  assert.notEqual(after.participants, snapshot.participants);
  assert.deepEqual([...before.participants], [...snapshot.participants], 'the snapshot content is unchanged');

  const cloned = cloneDentState(applyDent(createDentState(), { direction: { x: 0, y: 1, z: 0 }, severity: 5, tick: 0 }));
  const grown = applyDent(cloned, { direction: { x: 1, y: 0, z: 0 }, severity: 5, tick: 1 });
  assert.notEqual(grown.slots, cloned.slots);
  assert.equal(cloned.slots.length, 1, 'the clone is unaffected by the later impact');
  assert.notEqual(grown.slots[0].direction, cloned.slots[0].direction);

  const registry = createRacerRegistry([0, 1, 2, 3]);
  assert.notEqual(registry.denseIndices(), registry.ids);
  const attempt = [...registry.denseIndices()];
  attempt.push(99);
  assert.deepEqual([...registry.denseIndices()], [0, 1, 2, 3]);
});

test('contracts: the public barrel exposes every frozen module', () => {
  const surface = [
    'CONTRACTS_VERSION', 'ContractError', 'normalizeRaceConfig', 'validateRaceConfig', 'assertRaceConfig', 'defaultParticipants',
    'createRacerRegistry', 'FixedStepClock', 'createPickupArbiter', 'createPickupTrigger', 'createWeightedMysteryResolver',
    'createQualifyingEntry', 'rankQualifying', 'validateGateCrossing', 'cpuStagingDelay',
    'transitionHeat', 'advanceHeat', 'createHeatState', 'HeatController', 'createNullAdapter', 'runHeadless',
    'createPropRegistry', 'validatePropDefinition', 'createReservationLedger', 'validateReleaseCorridor', 'defaultReleaseCorridor',
    'createDentState', 'applyDent', 'recoverDents', 'createRenderView', 'deepFreeze',
    'validateCommand', 'dedupeCommands', 'commandKey', 'CommandQueue', 'isRaceEventType', 'countEvents', 'describeEvent',
  ];
  for (const name of surface) assert.ok(name in contracts, `the contracts barrel must export ${name}`);
  assert.equal(contracts.CONTRACTS_VERSION, 1);
  assert.equal(contracts.isRaceEventType('boost-used'), true);
  assert.equal(contracts.isRaceEventType('nope'), false);
  assert.deepEqual({ ...contracts.countEvents([{ type: 'hop', tick: 0, racerId: 0 }, { type: 'hop', tick: 1, racerId: 0 }]) }, { hop: 2 });
});
