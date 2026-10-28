// Plan 52: the Veil, per-context autonomous ego learning, the Harvest and the Overwatch audit. Each world is an opaque closure
// over a private target; the ego only ever sees veiled feedback (the Cybernetic Mirror's signed miss, filtered by the Veil).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditOverwatchDistortion, beliefMean, createEgoMemory, deserializeEgoMemory, evaluateHarvestChoice, perceivedErrorTrend,
  serializeEgoMemory, stepVeiledEgoLearning, STAGE_VEIL_OPACITY, veilObserve, VEIL_STAGES,
  type IEgoExperientialMemory, type TrialContext, type VeilStage, type VeiledWorld,
} from '../src/veil-learning-harvest';
import type { FourFloatsTuple } from '../src/types';

/** The hidden value lives ONLY in this closure; the world answers with the signed miss. */
function makeWorld(hidden: number): VeiledWorld {
  return (action) => hidden - action;
}

function run(m0: IEgoExperientialMemory, world: VeiledWorld, stage: VeilStage, n: number, ctx?: (i: number) => TrialContext | undefined): IEgoExperientialMemory {
  let m = m0;
  for (let i = 0; i < n; i++) m = stepVeiledEgoLearning(m, world, stage, ctx?.(i)).memory;
  return m;
}

/** Interleave several contexts, each with its own private world, `perContext` trials apiece. */
function runContexts(m0: IEgoExperientialMemory, targets: Record<string, number>, stage: VeilStage, perContext: number, extra?: (id: string, i: number) => Omit<TrialContext, 'gameId'>): IEgoExperientialMemory {
  const worlds = Object.entries(targets).map(([id, t]) => [id, makeWorld(t)] as const);
  let m = m0;
  for (let i = 0; i < perContext; i++) for (const [id, w] of worlds) m = stepVeiledEgoLearning(m, w, stage, { gameId: id, ...extra?.(id, i) }).memory;
  return m;
}

test('opacities: Argon curve exactly, strictly decreasing, S6 is clear', () => {
  assert.deepEqual(STAGE_VEIL_OPACITY, { S0a: 0.95, S0b: 0.88, S1: 0.78, S2: 0.65, S3: 0.5, S4: 0.32, S5: 0.15, S6: 0 });
  for (let i = 1; i < VEIL_STAGES.length; i++) {
    assert.ok(STAGE_VEIL_OPACITY[VEIL_STAGES[i] as VeilStage] < STAGE_VEIL_OPACITY[VEIL_STAGES[i - 1] as VeilStage]);
  }
  assert.equal(STAGE_VEIL_OPACITY.S6, 0);
});

test('the veil limits what the ego perceives: lost share and noise rise with opacity, S6 is exact, deterministic per seed', () => {
  assert.equal(veilObserve(0.1234, 0, 42).value, 0.1234);
  let prevLost = -1, prevSd = -1;
  for (const stage of [...VEIL_STAGES].reverse()) {
    const op = STAGE_VEIL_OPACITY[stage];
    let state = 7, lost = 0, sumSq = 0, kept = 0;
    for (let i = 0; i < 4000; i++) {
      const r = veilObserve(0, op, state);
      state = r.rngState;
      if (r.value === null) lost++; else { kept++; sumSq += r.value * r.value; }
    }
    const lostShare = lost / 4000, sd = Math.sqrt(sumSq / kept);
    assert.ok(Math.abs(lostShare - 0.6 * op) < 0.04, `${stage}: lost ${lostShare} vs ${0.6 * op}`);
    assert.ok(Math.abs(sd - 0.5 * op) <= 0.12 * 0.5 * op + 1e-12, `${stage}: sd ${sd} vs ${0.5 * op}`);
    assert.ok(lostShare >= prevLost && sd >= prevSd, `${stage} must be at least as thick as the clearer stage`);
    prevLost = lostShare; prevSd = sd;
  }
  assert.deepEqual(veilObserve(0, 0.95, 7), veilObserve(0, 0.95, 7));
});

test('genuine learning: at S6 the belief finds each private target (incl. range edges) within 5% of the span; perceived error falls', () => {
  for (const target of [0, 0.03, 0.31, 0.5, 0.77, 0.97, 1]) {
    const m = run(createEgoMemory({ seed: 11 }), makeWorld(target), 'S6', 40);
    assert.ok(Math.abs(beliefMean(m) - target) <= 0.05, `target ${target}: belief ${beliefMean(m)}`);
    const t = perceivedErrorTrend(m);
    assert.ok(t.early !== null && t.recent !== null && t.recent < 0.05 && t.recent <= t.early + 1e-12, `target ${target}: ${JSON.stringify(t)}`);
  }
  const m = run(createEgoMemory({ seed: 3, range: [-10, 10] }), makeWorld(9.8), 'S6', 40);
  assert.ok(Math.abs(beliefMean(m) - 9.8) <= 1, `wide range: ${beliefMean(m)}`);
});

test('a thicker veil learns measurably slower and worse (same trials, averaged over seeds)', () => {
  const avgErr = (stage: VeilStage): number => {
    let sum = 0, cnt = 0;
    for (let seed = 1; seed <= 8; seed++) for (const target of [0.2, 0.55, 0.9]) {
      sum += Math.abs(beliefMean(run(createEgoMemory({ seed }), makeWorld(target), stage, 40)) - target); cnt++;
    }
    return sum / cnt;
  };
  const e0 = avgErr('S0a'), e3 = avgErr('S3'), e6 = avgErr('S6');
  assert.ok(e0 > e6 * 3 && e0 > 0.02, `S0a ${e0} vs S6 ${e6}`);
  assert.ok(e0 > e3 && e3 >= e6, `monotone-ish: ${e0} ${e3} ${e6}`);
});

test('error decreases across trials while confidence consolidates per context', () => {
  const targets = { alpha: 0.25, beta: 0.8 };
  const early = runContexts(createEgoMemory({ seed: 21 }), targets, 'S4', 5);
  const late = runContexts(createEgoMemory({ seed: 21 }), targets, 'S4', 40);
  for (const [id, target] of Object.entries(targets)) {
    const c0 = early.learnedConfidenceByContext[id] ?? -1, c1 = late.learnedConfidenceByContext[id] ?? -1;
    assert.ok(c1 > c0 && c1 > 0.6, `${id}: confidence ${c0} -> ${c1}`);
    const e0 = Math.abs((early.learnedAttractorByContext[id] ?? 0) - target), e1 = Math.abs((late.learnedAttractorByContext[id] ?? 0) - target);
    assert.ok(e1 < 0.06 && e1 <= e0 + 0.02, `${id}: error ${e0} -> ${e1}`);
  }
  assert.ok(late.totalSelfResolvedDistortion > 0, 'the ego resolved some of its own perceived distortion');
  assert.equal(early.totalSelfResolvedDistortion, 0, 'nothing resolved before enough has been perceived');
});

test('a Wanderer learns three contexts with three different targets, each within 5% of the span (S6, 40 trials each)', () => {
  const targets = { 'game-a': 0.12, 'game-b': 0.5, 'game-c': 0.91 };
  const m = runContexts(createEgoMemory({ seed: 77 }), targets, 'S6', 40);
  assert.equal(m.trials, 120);
  for (const [id, target] of Object.entries(targets)) {
    assert.ok(Math.abs((m.learnedAttractorByContext[id] ?? 9) - target) <= 0.05, `${id}: ${m.learnedAttractorByContext[id]} vs ${target}`);
    assert.ok((m.learnedConfidenceByContext[id] ?? 0) >= 0.9);
  }
  assert.equal(m.autonomousCatalystsMastered, 3);
  // one shared belief would have been wrong: the contexts really differ
  assert.ok(Math.abs((m.learnedAttractorByContext['game-a'] ?? 0) - (m.learnedAttractorByContext['game-c'] ?? 0)) > 0.5);
});

test('mastery counts contexts once, needs the clear sight and mostly-unhelped trials', () => {
  const targets = { a: 0.3, b: 0.6 };
  const clear = runContexts(createEgoMemory({ seed: 5 }), targets, 'S6', 30);
  assert.equal(clear.autonomousCatalystsMastered, 2);
  assert.equal(runContexts(clear, targets, 'S6', 30).autonomousCatalystsMastered, 2, 'not counted twice');
  const helped = runContexts(createEgoMemory({ seed: 5 }), targets, 'S6', 30, () => ({ helped: true }));
  assert.equal(helped.autonomousCatalystsMastered, 0, 'helped contexts are not autonomous');
  const veiled = runContexts(createEgoMemory({ seed: 5 }), targets, 'S0a', 30);
  assert.equal(veiled.autonomousCatalystsMastered, 0, 'under the thickest veil nothing is mastered in 30 trials');
});

test('structural: the learning step never takes the target; the world is the only channel and is called once per trial', () => {
  assert.ok(stepVeiledEgoLearning.length <= 4);
  let calls = 0;
  const hidden = 0.6180339;
  const world: VeiledWorld = (a) => { calls++; return hidden - a; };
  const m = run(createEgoMemory({ seed: 5 }), world, 'S4', 12);
  assert.equal(calls, 12);
  assert.ok(!JSON.stringify(m).includes('0.618033'), 'memory must not contain the hidden value');
  assert.ok(!Object.keys(m).some((k) => /target|hidden|answer|true/i.test(k)));
});

test('across trials: learning continues from memory, which round-trips through JSON exactly', () => {
  const targets = { x: 0.42, y: 0.66 };
  const straight = runContexts(createEgoMemory({ seed: 9 }), targets, 'S2', 40);
  const half = runContexts(createEgoMemory({ seed: 9 }), targets, 'S2', 20);
  const revived = deserializeEgoMemory(serializeEgoMemory(half));
  assert.deepEqual(revived, half);
  const resumed = runContexts(revived, targets, 'S2', 20);
  assert.equal(resumed.trials, 80);
  assert.deepEqual(resumed, straight);
  assert.throws(() => deserializeEgoMemory('{"version":1}'));
});

test('determinism: same seed, same world, bit-identical memories; a different seed differs', () => {
  const a = run(createEgoMemory({ seed: 123 }), makeWorld(0.7), 'S1', 50);
  const b = run(createEgoMemory({ seed: 123 }), makeWorld(0.7), 'S1', 50);
  const c = run(createEgoMemory({ seed: 124 }), makeWorld(0.7), 'S1', 50);
  assert.equal(serializeEgoMemory(a), serializeEgoMemory(b));
  assert.notEqual(serializeEgoMemory(a), serializeEgoMemory(c));
});

/** A 40-trial life over two catalysts at S6 with the given tags. */
function life(seed: number, tag: (i: number) => Omit<TrialContext, 'gameId'>): IEgoExperientialMemory {
  return runContexts(createEgoMemory({ seed }), { one: 0.35, two: 0.7 }, 'S6', 20, (id, i) => tag(i * 2 + (id === 'two' ? 1 : 0)));
}

test('harvest routes four lives to the four paths and vessels, from the ego own experience', () => {
  const f = (a: number, b: number, c: number, d: number): FourFloatsTuple => [a, b, c, d];
  const steward = life(1, (i) => ({ servedOther: i % 10 < 8, floats: f(0.3, 0.3, 0.8, 0.8) }));
  const wanderer = life(2, () => ({ servedOther: false, floats: f(0.9, 0.5, 0.8, 0.3) }));
  const specialist = life(3, (i) => ({ servedOther: i % 10 < 3, floats: f(0.5, 0.9, 0.4, 0.4) }));
  const enclave = life(4, () => ({ servedOther: false, helped: false, floats: f(0.4, 0.6, 0.4, 0.5) }));
  const want: [IEgoExperientialMemory, string, string, string][] = [
    [steward, 'PATH_1_HIGHER_SELF_STEWARD', 'vessel:squad-commander', 'depth:N+1:steward'],
    [wanderer, 'PATH_2_CROSS_GAME_WANDERER', 'vessel:spore-creature', 'bridge:cross-game-wanderer'],
    [specialist, 'PATH_3_RAY_SPECIALIST', 'vessel:harvester-rig', 'local:specialist-ascension'],
    [enclave, 'PATH_4_SOVEREIGN_ENCLAVE', 'vessel:perimeter-turret', 'enclave:desynced-solitude'],
  ];
  for (const [m, path, vessel, target] of want) {
    assert.equal(m.autonomousCatalystsMastered, 2);
    const r = evaluateHarvestChoice(m);
    assert.equal(r.harvestEligible, true);
    assert.equal(r.chosenPath, path, JSON.stringify(r));
    assert.equal(r.chosenNextVessel, vessel);
    assert.equal(r.stargateOrBridgeTarget, target);
    assert.equal(r.polarityRatioSTO, m.servedOtherTrials / m.trials);
    assert.ok(r.reasons.length >= 4 && r.rationale.length > 10);
    assert.deepEqual(evaluateHarvestChoice(m), r, 'same memory, same choice');
  }
  // the floats really are the mastery-weighted mean of what was lived (constant tags give back the tag)
  const wf = evaluateHarvestChoice(wanderer).fourFloats;
  [0.9, 0.5, 0.8, 0.3].forEach((v, k) => assert.ok(Math.abs((wf[k] ?? 9) - v) < 1e-9));
  // untagged life: floats default to 0.5 each
  assert.deepEqual(evaluateHarvestChoice(runContexts(createEgoMemory({ seed: 8 }), { one: 0.35, two: 0.7 }, 'S6', 20)).fourFloats, [0.5, 0.5, 0.5, 0.5]);
});

test('harvest is not eligible below coherence 0.95 or with fewer than 2 catalysts mastered; overrides are honoured', () => {
  const m = life(1, () => ({ servedOther: true, floats: [0.3, 0.3, 0.8, 0.8] }));
  const cold = evaluateHarvestChoice(m, { coherenceH: 0.94 });
  assert.equal(cold.harvestEligible, false);
  assert.equal(cold.chosenPath, 'PATH_3_RAY_SPECIALIST');
  assert.equal(cold.chosenNextVessel, 'vessel:rover-escort');
  assert.equal(cold.stargateOrBridgeTarget, 'local:continue-incarnation');
  assert.equal(evaluateHarvestChoice(m, { coherenceH: 0.95 }).harvestEligible, true);
  const one = runContexts(createEgoMemory({ seed: 1 }), { solo: 0.4 }, 'S6', 40);
  assert.equal(one.autonomousCatalystsMastered, 1);
  assert.equal(evaluateHarvestChoice(one).harvestEligible, false);
  assert.equal(evaluateHarvestChoice(createEgoMemory({ seed: 1 })).harvestEligible, false);
  const forced = evaluateHarvestChoice(m, { stoRatio: 0.1, fourFloats: [0.4, 0.6, 0.4, 0.5] });
  assert.equal(forced.chosenPath, 'PATH_4_SOVEREIGN_ENCLAVE');
  assert.equal(forced.polarityRatioSTO, 0.1);
});

test('overwatch audit: D2 first, then D1, then D3, else none', () => {
  const p = (a: boolean, b: boolean, c: boolean) => auditOverwatchDistortion({ usesHardcodedExampleNames: a, blocksMechanicsOnUncheckedPermission: b, leavesExtractedRulesUnwiredInPlay: c });
  assert.deepEqual([p(false, true, false).distortion, p(false, true, false).severityPi], ['DISTORTION_2_AUTHORITARIAN_GATE', 85]);
  assert.deepEqual([p(true, false, false).distortion, p(true, false, false).severityPi], ['DISTORTION_1_EXAMPLE_FIXATION', 64]);
  assert.deepEqual([p(false, false, true).distortion, p(false, false, true).severityPi], ['DISTORTION_3_HOLLOW_UNWIRED_SHELL', 48]);
  assert.deepEqual([p(false, false, false).distortion, p(false, false, false).severityPi], ['NONE_UNDISTORTED', 1]);
  assert.equal(p(true, true, true).distortion, 'DISTORTION_2_AUTHORITARIAN_GATE');
  assert.equal(p(true, false, true).distortion, 'DISTORTION_1_EXAMPLE_FIXATION');
  assert.ok(p(true, true, true).correctiveLogosDirective.length > 10);
});
