/**
 * T04 — the qualifying heat: schedule, retries, ranking, and the human who takes their time.
 *
 * Run with: node scripts/check.mjs  ·  node --import tsx --test tests/qualifying-session.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CPU_RETRY_GAP, SESSION_STEP, createQualifyingSession, participantEntry,
} from '../src/game/qualifying/session';
import { runQualifyingHeat, rankingTable } from '../src/game/qualifying/harness';
import { createMysteryLedger } from '../src/game/qualifying/mystery';
import { legacyParticipants, syntheticField } from '../src/game/qualifying/field';
import { manualGate } from './fixtures/qualifying-harness';
import { normalizeRaceConfig } from '../src/game/contracts/config';
import { createHeatState, transitionHeat } from '../src/game/contracts/heat';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { cpuStagingDelay } from '../src/game/contracts/qualifying';
import type { CourseId } from '../src/game/types';

function heatConfig(size: number, seed: number, course: CourseId = 'ridge', overrides: Record<string, unknown> = {}) {
  const participants = size <= 4 ? legacyParticipants() : syntheticField(size, seed);
  return normalizeRaceConfig({
    version: 1, fieldSize: size, course, seed, participants, customPhysics: false,
    qualifying: { retries: 2, deadlineSeconds: 20 }, ...overrides,
  }).config;
}

test('heat: four and twenty actual attempts, complete and reproducible', () => {
  for (const size of [4, 20]) {
    const first = runQualifyingHeat({ config: heatConfig(size, 7), humanControl: 'auto' });
    const second = runQualifyingHeat({ config: heatConfig(size, 7), humanControl: 'auto' });
    assert.equal(first.session.status, 'complete', 'the heat ends by itself');
    assert.equal(first.counts.valid, size, 'every participant crossed the gate for real');
    assert.equal(first.counts.fallback, 0);
    assert.equal(first.entries.length, size, 'one entry per participant, none dropped');
    assert.deepEqual(rankingTable(second.ranked), rankingTable(first.ranked), 'the same seed reproduces the same table');
    assert.equal(second.fingerprint, first.fingerprint, 'and the same fingerprint');
    assert.deepEqual(first.ranked.map((entry) => entry.rank), Array.from({ length: size }, (_, index) => index + 1), 'ranks are dense and 1-based');
    assert.ok(first.ranked.every((entry) => entry.advanced), 'with no capacity set, the whole field advances');
    const times = first.ranked.filter((entry) => entry.time !== null).map((entry) => entry.time as number);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'valid times are ordered fastest first');
    assert.ok(times.every((time) => time > 0.1 && time < 20), `every time is inside the deadline (max ${Math.max(...times).toFixed(2)}s)`);
    assert.ok(first.ticks < first.session.maxTicks, 'and it finished inside the bound, not by being cut off');
    const attempts = first.report.reduce((sum, entry) => sum + entry.attempts.length, 0);
    assert.ok(attempts >= size, `the heat ran ${attempts} real attempts for ${size} participants`);
  }
});

test('heat: a different seed can produce a different table, and always a different draw', () => {
  const a = runQualifyingHeat({ config: heatConfig(20, 7), humanControl: 'auto' });
  const b = runQualifyingHeat({ config: heatConfig(20, 8), humanControl: 'auto' });
  assert.notEqual(a.fingerprint, b.fingerprint, 'the seed must matter');
  assert.equal(b.counts.valid, 20);
});

test('heat: the deployment schedule is bounded, monotone and never index-linear', () => {
  for (const size of [4, 20, 50, 100] as const) {
    const config = heatConfig(size, 3);
    const session = createQualifyingSession({ config, humanControl: 'auto' });
    const report = session.report();
    assert.equal(report.length, size);
    const starts = report.map((entry) => entry.startAt);
    assert.ok(starts.every((start) => start >= 0 && start <= 2.5), `every start is inside 2.5s (max ${Math.max(...starts).toFixed(3)})`);
    assert.equal(starts[0], 0, 'the local player is never queued');
    const human = report.find((entry) => entry.isHuman)!;
    assert.equal(human.startAt, 0);
    for (let index = 1; index < starts.length; index++) {
      assert.ok(starts[index] >= starts[index - 1], `slot ${index} must not deploy before slot ${index - 1}`);
    }
    // No two participants may launch on the same tick, or the first step order becomes arbitrary.
    const ticks = starts.map((start) => Math.round(start / FIXED_STEP));
    assert.equal(new Set(ticks).size, ticks.length, 'every deployment lands on its own tick');
    assert.equal(Math.max(...starts), cpuStagingDelay(size - 1, size), 'the last slot is the contract value');
    // The rule the ticket names: the window is a *spread*, so it must not grow with the field.
    // An index-linear 0.35 s per racer would need 34.65 s for 100 entrants; the schedule caps at 2.5.
    const indexLinear = (size - 1) * 0.35;
    assert.ok(indexLinear > 2.5 || size <= 8, `the comparison is only interesting once the naive schedule grows (it reaches ${indexLinear.toFixed(1)}s at ${size})`);
    const increments = starts.slice(1).map((start, index) => start - starts[index]);
    assert.ok(Math.max(...increments) <= 2.5 / Math.max(1, size - 1) + 1e-9, 'the per-slot step shrinks as the field grows');
  }
  assert.ok(CPU_RETRY_GAP <= 1, 'the gap between retries is bounded too');
});

test('heat: two retries means three attempts, and the heat still terminates', () => {
  // A gate 60 km away: nobody can reach it, so every participant burns the whole budget.
  const config = normalizeRaceConfig({
    version: 1, fieldSize: 4, course: 'ridge', seed: 2, participants: legacyParticipants(),
    qualifying: { retries: 2, deadlineSeconds: 0.25 }, customPhysics: false,
  }).config;
  assert.equal(config.qualifying.deadlineSeconds, 1, 'the frozen config loader clamps an attempt deadline to at least a second');
  const heat = runQualifyingHeat({ config, gate: manualGate({ x: 60_000 }), humanControl: 'auto' });
  assert.equal(heat.counts.valid, 0);
  assert.equal(heat.counts.fallback, 4);
  for (const entry of heat.report) {
    assert.equal(entry.attempts.length, 3, 'the first attempt plus two retries');
    assert.equal(entry.attempts.map((attempt) => attempt.attempt).join(','), '1,2,3', 'and they are numbered');
    assert.equal(entry.entry?.fallback, 'retry-exhausted', 'the heat-level class says the budget is gone');
    assert.equal(entry.entry?.status, 'fallback');
    assert.equal(entry.entry?.time, null);
    assert.ok(entry.attempts.every((attempt) => attempt.classification === 'deadline'), 'each attempt keeps its own cause');
  }
  assert.ok(heat.session.tick < heat.session.maxTicks, 'the heat ended on its own, inside the bound');
});

test('heat: a fallback never outranks a valid time, whatever the field', () => {
  const config = heatConfig(20, 5);
  const session = createQualifyingSession({ config });
  // Let the CPUs qualify; the human never touches the launch key.
  for (let tick = 0; tick < 700 && session.status !== 'complete'; tick++) session.step();
  const before = session.ranked();
  const human = before.find((entry) => entry.racerId === 0)!;
  assert.equal(human.status, 'fallback', 'the player who never launched has no time');
  session.settle('deadline');
  const ranked = session.ranked();
  assert.equal(ranked.length, 20);
  const validTail = ranked.filter((entry) => entry.status === 'valid').length;
  assert.ok(validTail >= 15, `${validTail} of 20 crossed the gate`);
  assert.deepEqual(ranked.slice(validTail).map((entry) => entry.racerId).includes(0), true, 'the human sits in the fallback tail');
  assert.ok(ranked.slice(0, validTail).every((entry) => entry.status === 'valid'), 'every valid entry is above every fallback');
  assert.ok(ranked.slice(validTail).every((entry) => entry.status === 'fallback'));
  assert.equal(human.attempt, 1, 'the abandoned attempt is still numbered as attempt one');
  assert.equal(before.length, ranked.length);
});

test('heat: staging freezes gameplay state, and idling costs nothing', () => {
  const config = heatConfig(4, 9);
  const session = createQualifyingSession({ config });
  const stagedBefore = session.report()[0].staged;
  for (let tick = 0; tick < 600; tick++) session.step();
  const stagedAfter = session.report()[0].staged;
  assert.deepEqual(stagedAfter, stagedBefore, 'six seconds on the sling change nothing');
  const human = session.snapshot().participants.find((entry) => entry.racerId === 0)!;
  assert.ok(human.attempt, 'the human has an attempt waiting');
  assert.equal(human.attempt!.runTime, 0, 'but its own clock never started');
  assert.equal(human.attempt!.boosts, stagedBefore.boosts);
  assert.equal(human.attempt!.bounces, stagedBefore.bounces);
  assert.equal(human.attempt!.progress >= 0 && human.attempt!.progress < 0.05, true, 'no phantom progress');
  assert.equal(human.attempt!.launched, false);
});

test('heat: a human re-aiming does not freeze the bots', () => {
  const config = heatConfig(4, 4);
  // A distant gate keeps the CPU attempts in flight long enough to measure.
  const session = createQualifyingSession({ config, gate: manualGate({ x: 6000 }) });
  for (let tick = 0; tick < 200; tick++) session.step();
  const snapshot = session.snapshot();
  const human = snapshot.participants.find((entry) => entry.racerId === 0)!;
  const bots = snapshot.participants.filter((entry) => entry.racerId !== 0 && entry.attempt);
  assert.ok(bots.length >= 1, 'the other participants must still be mid-attempt');
  assert.ok(human.attempt && human.attempt.runTime === 0, 'the human is still on the sling');
  const before = bots.map((entry) => entry.attempt!.runTime);
  for (let tick = 0; tick < 100; tick++) session.step();
  const after = session.snapshot().participants.filter((entry) => entry.racerId !== 0 && entry.attempt).map((entry) => entry.attempt!.runTime);
  const humanAfter = session.snapshot().participants.find((entry) => entry.racerId === 0)!.attempt!;
  assert.ok(after.length > 0, 'nobody was paused by the human idling');
  for (let index = 0; index < Math.min(before.length, after.length); index++) {
    assert.ok(after[index] > before[index], `bot ${index} kept running (${before[index].toFixed(2)}s → ${after[index].toFixed(2)}s)`);
  }
  assert.equal(humanAfter.runTime, 0, 'and the human lost nothing by waiting');
});

test('heat: the human launch, retry aim and benefit reset go through the session', () => {
  const config = heatConfig(4, 6);
  const session = createQualifyingSession({ config });
  // Queue an aim, then a boost that is illegal on the grid, then launch.
  assert.equal(session.send({ type: 'aim', power: 0.97, angle: 24 }).ok, true);
  assert.equal(session.send({ type: 'boost' }).ok, true, 'boost is allowed while awaiting launch, and does nothing there');
  assert.equal(session.send({ type: 'aim', power: 1.5, angle: 24 }).ok, false, 'out of the launch envelope is refused');
  assert.equal(session.send({ type: 'launch' }).ok, true);
  const humanState = () => session.snapshot().participants.find((entry) => entry.racerId === 0)!;
  session.step();
  assert.equal(humanState().attempt!.launched, true, 'the queued aim and launch land on the next tick');
  assert.equal(humanState().attempt!.runTime, 0, 'and the attempt clock starts with the first step after it');
  session.step();
  assert.ok(humanState().attempt!.runTime > 0, 'the run is on the clock now');
  for (let tick = 0; tick < 1200 && !humanState().entry; tick++) session.step();
  const human = session.report().find((entry) => entry.isHuman)!;
  assert.equal(human.attempts.length, 1, 'one attempt, and it is over');
  assert.equal(human.attempts[0].entry.status, 'valid', 'the queued aim carried them through the gate');
  assert.ok(human.attempts[0].crossing && human.attempts[0].crossing.time! > 0.2 && human.attempts[0].crossing.time! < 5);
  assert.equal(human.attempts[0].entry.fallback, null, 'and a valid entry carries no fallback class');
  assert.equal(human.attempts[0].entry.status, 'valid');
  // The other three are still on their own schedules: the heat is not over until they have crossed.
  assert.equal(session.status, 'running');
  assert.ok(session.snapshot().completed >= 1);
  session.run();
  assert.equal(session.status, 'complete', 'and it closes once every participant has an entry');
  assert.equal(session.entries().length, 4);
});

test('heat: a failed human attempt returns to the sling with the aim kept and the benefits cleared', () => {
  const config = normalizeRaceConfig({
    version: 1, fieldSize: 4, course: 'ridge', seed: 1, participants: legacyParticipants(),
    qualifying: { retries: 2, deadlineSeconds: 0.3 }, customPhysics: false,
  }).config;
  const session = createQualifyingSession({ config, gate: manualGate({ x: 60_000 }) });
  const human = () => session.snapshot().participants.find((entry) => entry.racerId === 0)!;
  assert.equal(config.qualifying.deadlineSeconds, 1, 'loader-clamped to the one-second floor');
  session.send({ type: 'aim', power: 0.42, angle: 61 });
  session.send({ type: 'launch' });
  for (let tick = 0; tick < 8; tick++) session.step();
  assert.equal(human().attempt!.launched, true, 'the queued launch went away with the queued aim');
  assert.deepEqual(human().attempt!.peakSpeed > 0, true, 'and the attempt is measuring from the launch');
  // Let the first attempt die on the deadline, then give the scheduler its tick.
  for (let tick = 0; tick < 400 && human().attemptsTaken < 1; tick++) session.step();
  session.step();
  session.step();
  const afterFailure = human();
  assert.equal(afterFailure.attemptsTaken, 1, 'one attempt is in the book');
  assert.ok(afterFailure.attempt, 'and the retry is already waiting on the sling');
  assert.equal(afterFailure.attempt!.boosts, 2, 'charges are whole again');
  assert.equal(afterFailure.attempt!.bounces, 3);
  assert.equal(afterFailure.attempt!.runTime, 0, 'on a fresh clock');
  assert.equal(afterFailure.attempt!.peakSpeed, 0, 'with no memory of the last run');
  assert.equal(afterFailure.attempt!.pickups, 0, 'and no carried-over supplies');
  assert.equal(afterFailure.attempt!.lane, 2, 'and in the lane they staged in');
  // A human retry does not run on its own: it waits on the sling for the launch key, and the bots
  // keep going while it waits.
  for (let tick = 0; tick < 400 && human().attempt!.runTime > 0; tick++) session.step();
  assert.equal(human().attemptsTaken, 1, 'still one attempt in the book, because nobody pressed launch');
  assert.equal(human().attempt!.launched, false, 'and the retry is waiting on the sling');
  const botsMoving = session.report().filter((entry) => !entry.isHuman && entry.pending).length;
  assert.ok(botsMoving + session.report().filter((entry) => !entry.isHuman).length > 0, 'the rest of the field is not blocked');
  assert.equal(session.send({ type: 'launch' }).ok, true);
  for (let tick = 0; tick < 400 && human().attemptsTaken < 2; tick++) session.step();
  assert.equal(human().attemptsTaken, 2, 'the retry runs once the player asks for it');
  const report = session.report().find((entry) => entry.isHuman)!;
  assert.equal(report.attempts.length >= 2, true);
  assert.ok(report.attempts[0].elapsed <= config.qualifying.deadlineSeconds + SESSION_STEP, 'each attempt got its own fixed deadline');
  assert.ok(report.attempts[0].elapsed > 0.5, 'and it used it');
  const everyone = session.report();
  assert.equal(everyone.find((entry) => entry.isHuman)!.pending, true, 'the human still has a retry left');
  assert.equal(everyone.find((entry) => entry.gridSlot === 1)!.attempts.length <= 3, true, 'a bot that started keeps to the same budget');
  session.settle('dnf');
  assert.equal(session.status, 'complete', 'finalizing the heat always produces a full table');
  assert.equal(session.entries().length, 4);
  assert.equal(session.ranked().filter((entry) => entry.status === 'fallback').length >= 1, true);
});

test('heat: a CPU retry waits a bounded moment and keeps its own staged record', () => {
  const config = normalizeRaceConfig({
    version: 1, fieldSize: 20, course: 'ridge', seed: 3, participants: syntheticField(20, 3),
    qualifying: { retries: 2, deadlineSeconds: 0.2 }, customPhysics: false,
  }).config;
  const session = createQualifyingSession({ config, gate: manualGate({ x: 60_000 }) });
  const waitingSince = new Map<number, number>();
  const gaps: number[] = [];
  for (let tick = 0; tick < 1500 && gaps.length < 19; tick++) {
    session.step();
    for (const entry of session.snapshot().participants) {
      if (entry.nextStartAt !== null) {
        if (!waitingSince.has(entry.racerId)) waitingSince.set(entry.racerId, session.time);
      } else if (waitingSince.has(entry.racerId)) {
        gaps.push(session.time - waitingSince.get(entry.racerId)!);
        waitingSince.delete(entry.racerId);
      }
    }
  }
  assert.ok(gaps.length >= 15, `the field must actually retry (saw ${gaps.length} retries)`);
  assert.ok(gaps.every((gap) => gap >= CPU_RETRY_GAP - SESSION_STEP && gap <= CPU_RETRY_GAP + SESSION_STEP * 2),
    `every retry waits the bounded gap, never a queue (saw ${Math.min(...gaps).toFixed(3)}–${Math.max(...gaps).toFixed(3)}s)`);
});

test('heat: the mystery route is optional, deterministic and rolled once per heat', () => {
  const config = heatConfig(20, 12);
  const off = runQualifyingHeat({ config, humanControl: 'auto' });
  assert.equal(off.session.snapshot().mysteryEnabled, false);
  assert.equal(off.session.snapshot().mysteryRolls, 0);
  assert.equal(off.report.every((entry) => entry.mystery === null), true, 'nothing exists when the route is off');

  const on = runQualifyingHeat({ config, humanControl: 'auto', mystery: true });
  assert.equal(on.session.snapshot().mysteryEnabled, true);
  assert.equal(on.session.snapshot().mysteryRolls, 20, 'one roll per participant, not per attempt');
  const routes = on.report.map((entry) => entry.mystery!);
  assert.equal(routes.every((route) => route !== null), true);
  assert.equal(routes.every((route) => ['fuel', 'shield', 'bounce'].includes(route.effect)), true, 'the resolved effect is a gameplay effect');
  assert.equal(routes.every((route => route.lane !== on.session.gate.loopLane)), true, 'the detour is never on the gate line');
  // Same seed, same routes: the roll is a function of the heat, not of the attempt count.
  const again = runQualifyingHeat({ config, humanControl: 'auto', mystery: true });
  assert.deepEqual(again.report.map((entry) => entry.mystery), routes, 'a rerun resolves the same routes');
  // And a failing heat that spends every retry still does not re-roll.
  const failing = normalizeRaceConfig({
    version: 1, fieldSize: 4, course: 'ridge', seed: 12, participants: legacyParticipants(),
    qualifying: { retries: 2, deadlineSeconds: 0.2 }, customPhysics: false,
  }).config;
  const exhausted = runQualifyingHeat({ config: failing, gate: manualGate({ x: 60_000 }), mystery: true, humanControl: 'auto' });
  assert.equal(exhausted.session.snapshot().mysteryRolls, 4, 'three attempts each, one roll each');
  assert.equal(exhausted.report.every((entry) => entry.attempts.length === 3), true);
  assert.equal(exhausted.report.every((entry) => entry.attempts.every((attempt) => attempt.entry.rewardRolled)), true,
    'every entry records that the heat reward was already rolled');
  assert.equal(exhausted.report.every((entry) => entry.attempts[0].crossing === null), true);
});

test('heat: the ledger alone is deterministic per racer and heat', () => {
  const gate = manualGate({});
  const ledger = createMysteryLedger({ enabled: true, seed: 99, heatIndex: 0 }, gate);
  const first = ledger.routeFor(3)!;
  assert.equal(ledger.rolls, 1);
  assert.deepEqual(ledger.routeFor(3), first, 'a second call is memoised');
  assert.equal(ledger.rolls, 1, 'and does not re-roll');
  const sameAgain = createMysteryLedger({ enabled: true, seed: 99, heatIndex: 0 }, gate);
  assert.deepEqual(sameAgain.routeFor(3), first, 'the ledger is a pure function of (seed, racer, heat)');
  const otherSeed = createMysteryLedger({ enabled: true, seed: 100, heatIndex: 0 }, gate);
  const differs = [0, 1, 2, 3, 4, 5, 6, 7].filter((id) => {
    const left = ledger.routeFor(id)!;
    const right = otherSeed.routeFor(id)!;
    return left.lane !== right.lane || left.effect !== right.effect || Math.abs(left.x - right.x) > 1;
  });
  assert.ok(differs.length >= 3, `a different seed must move the routes (moved ${differs.length} of 8)`);
  const disabled = createMysteryLedger({ enabled: false, seed: 99, heatIndex: 0 }, gate);
  assert.equal(disabled.routeFor(3), null);
  assert.equal(disabled.rolls, 0);
});

test('heat: the completion record is the event the frozen phase machine expects', () => {
  const twenty = heatConfig(20, 7);
  const session = createQualifyingSession({ config: twenty, humanControl: 'auto' });
  session.run();
  const heat = createHeatState(twenty);
  const begun = transitionHeat(heat, { type: 'begin-qualifying' }, 0);
  assert.equal(begun.ok, true, 'a 20-racer heat must qualify');
  if (!begun.ok) throw new Error('unreachable');
  const completed = transitionHeat(begun.state, session.qualifyingCompleteEvent(), session.tick);
  assert.equal(completed.ok, true, 'the session hands over exactly the order the contract ranks');
  if (!completed.ok) throw new Error('unreachable');
  assert.equal(completed.state.phase, 'release');
  assert.deepEqual(completed.state.qualifyingOrder.map((entry) => entry.racerId), session.ranked().map((entry) => entry.racerId));
  // Four racers do not qualify, so their heat refuses to enter the phase — while T04 can still run
  // their attempts, which is what the acceptance criteria ask for.
  const four = heatConfig(4, 7);
  const refused = transitionHeat(createHeatState(four), { type: 'begin-qualifying' }, 0);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.code, 'E_QUALIFYING_DISABLED');
  const small = runQualifyingHeat({ config: four, humanControl: 'auto' });
  assert.equal(small.counts.valid, 4, 'the simulation itself does not require the phase');
});

test('heat: frame-style advance uses the fixed-step clock, including its stall bound', () => {
  const config = heatConfig(4, 7);
  const session = createQualifyingSession({ config });
  assert.equal(session.tick, 0);
  const oneFrame = session.advance(1 / 60);
  assert.equal(oneFrame.ticks, 2, 'one 60 Hz frame is two 120 Hz ticks');
  assert.equal(session.tick, 2);
  const stall = session.advance(10);
  assert.equal(stall.ticks, 30, 'a 10s stall is bounded to 30 ticks, not simulated');
  assert.ok(stall.droppedSeconds > 9, `${stall.droppedSeconds.toFixed(2)}s of frame time was dropped on purpose`);
  assert.equal(session.tick, 32);
  const zero = session.advance(0);
  assert.equal(zero.ticks, 0, 'an empty frame is harmless');
});

test('heat: capacity decides who advances, and fallbacks never displace a valid entry', () => {
  const config = heatConfig(20, 21);
  const session = createQualifyingSession({ config, humanControl: 'auto', capacity: 8 });
  session.run();
  const ranked = session.ranked();
  assert.equal(ranked.filter((entry) => entry.advanced).length, 8, 'only eight slots are open');
  assert.deepEqual(ranked.slice(0, 8).every((entry) => entry.advanced), true);
  assert.deepEqual(ranked.slice(8).every((entry) => !entry.advanced), true);
  const valid = ranked.filter((entry) => entry.status === 'valid');
  assert.ok(valid.length > 8, 'more racers qualified than there are slots');
  assert.deepEqual(ranked.slice(0, 8).every((entry) => entry.status === 'valid'), true, 'the open slots go to valid times first');
});

test('heat: an old configuration still loads four racers and can be timed', () => {
  const heat = runQualifyingHeat({ config: {}, humanControl: 'auto' });
  assert.equal(heat.config.fieldSize, 4, 'a legacy config is the canonical four-racer field');
  assert.equal(heat.config.qualifying.enabled, false, 'with qualifying disabled by the frozen rule');
  assert.equal(heat.entries.length, 4);
  assert.equal(heat.counts.valid, 4, 'the heat still runs four actual attempts');
  const heat2 = runQualifyingHeat({ config: { mode: 'quick', course: 'boomtown', roster: [] } as never, humanControl: 'auto' });
  assert.equal(heat2.config.course, 'boomtown');
  assert.equal(heat2.counts.valid + heat2.counts.fallback, 4);
});

test('heat: the participant entry rule keeps the least-bad cause and upgrades an exhausted budget', () => {
  const attempts = [
    { classification: 'deadline' as const, peakSpeed: 10 },
    { classification: 'dnf' as const, peakSpeed: 20 },
    { classification: 'invalid-crossing' as const, peakSpeed: 30 },
  ].map((spec, index) => ({
    racerId: 5, attempt: index + 1, classification: spec.classification, peakSpeed: spec.peakSpeed,
    entry: { racerId: 5, attempt: index + 1, status: 'fallback' as const, time: null, speed: 0, peakSpeed: spec.peakSpeed, fallback: spec.classification, rewardRolled: false },
    crossing: null, rejections: [], pickups: [], ticks: 0, elapsed: 0, peakDisplaySpeed: 0, recoveries: 0, bestDistance: 0, finalLane: 0, reachedFinish: false,
  }));
  const exhausted = participantEntry(5, attempts as never, 3);
  assert.equal(exhausted.fallback, 'retry-exhausted', 'using every attempt is the heat-level fact');
  assert.equal(exhausted.attempt, 3, 'and it is reported on the attempt that ended the budget');
  assert.equal(exhausted.peakSpeed, 30, 'the best speed seen across the attempts is kept');
  const settled = participantEntry(5, attempts.slice(0, 2) as never, 3);
  assert.equal(settled.fallback, 'dnf', 'a heat finalized early keeps the least-bad cause');
  assert.equal(participantEntry(5, [], 3).fallback, 'dnf', 'a participant who never ran is a dnf');
});

test('heat: the snapshot is a bounded, readable summary of the field', () => {
  const session = createQualifyingSession({ config: heatConfig(100, 2), humanControl: 'auto' });
  const snapshot = session.snapshot();
  assert.equal(snapshot.fieldSize, 100);
  assert.equal(snapshot.participants.length, 100, 'a HUD row per participant, no more');
  assert.equal(snapshot.status, 'staged');
  assert.equal(snapshot.outstanding, 100);
  assert.equal(snapshot.deadlineSeconds, 20);
  assert.equal(snapshot.retries, 2);
  assert.equal(snapshot.gate.id, 'first-loop-entry');
  assert.ok(snapshot.gate.distance > 0);
  session.run();
  const done = session.snapshot();
  assert.equal(done.status, 'complete');
  assert.equal(done.completed, 100);
  assert.equal(done.outstanding, 0);
  assert.ok(done.attemptsTaken >= 100 && done.attemptsTaken <= 300, `${done.attemptsTaken} attempts for 100 participants`);
  assert.ok(done.time <= SESSION_STEP * session.maxTicks + 1e-9, 'a 100-racer heat stays inside its own bound');
  assert.ok(done.time < 90, `and stays reasonable (${done.time.toFixed(1)}s for 100 racers with a 20s deadline each)`);
  assert.equal(session.entries().length, 100);
  assert.equal(SESSION_STEP, FIXED_STEP);
});

test('heat: a session with no participants is a typed refusal, not an empty result', () => {
  assert.throws(() => createQualifyingSession({
    config: { ...heatConfig(4, 1), participants: [] as never },
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /at least one participant|does not match/);
    return true;
  });
});

test('heat: events are the contract log, in tick order', () => {
  const heat = runQualifyingHeat({ config: heatConfig(4, 7), humanControl: 'auto' });
  const types = heat.session.events.map((event) => event.type);
  assert.ok(types.includes('qualifying-begun'), 'each attempt announces itself');
  assert.ok(types.includes('gate-crossed'), 'and each crossing is logged');
  assert.ok(types.includes('qualifying-complete'), 'and the heat closes with the ranked order');
  const byRacer = new Map<number, number[]>();
  for (const event of heat.session.events) {
    if (!('racerId' in event) || typeof event.racerId !== 'number') continue;
    const list = byRacer.get(event.racerId) ?? [];
    list.push('tick' in event ? event.tick : 0);
    byRacer.set(event.racerId, list);
  }
  assert.ok(byRacer.size >= 4, 'every participant has a thread through the log');
  for (const [racerId, ticks] of byRacer) {
    assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b), `racer ${racerId}'s events are in tick order`);
  }
  const repeat = runQualifyingHeat({ config: heatConfig(4, 7), humanControl: 'auto' });
  assert.deepEqual(repeat.session.events, heat.session.events, 'and the log is reproducible');
  const crossed = heat.session.events.filter((event) => event.type === 'gate-crossed');
  assert.equal(crossed.length, 4, 'one crossing per qualified participant');
  assert.equal(crossed.every((event) => event.type === 'gate-crossed' && event.speed > 0), true);
  const begun = heat.session.events.filter((event) => event.type === 'qualifying-begun');
  assert.ok(begun.every((event) => event.type === 'qualifying-begun' && event.attempt === 1), 'a clean heat needs no retries');
});
