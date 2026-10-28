// Plan 52 demo: egos learn hidden per-context quantities for 40 trials from veiled feedback only (the worlds are closures; the
// ego is never handed a target), then make their Harvest choice from their own experience. Finally the Overwatch meta-audit.
// Run: npx tsx scripts/test-veil-learning-harvest.js
import {
  auditOverwatchDistortion, beliefMean, beliefStd, createEgoMemory, evaluateHarvestChoice, perceivedErrorTrend, stepVeiledEgoLearning,
  STAGE_VEIL_OPACITY, VEIL_STAGES,
} from '../packages/harness/src/veil-learning-harvest.ts';

const TRIALS = 40;
let failed = false;
const fail = (msg) => { console.error(`FAIL: ${msg}`); failed = true; };
const makeWorld = (hidden) => (action) => hidden - action; // the hidden value lives only in this closure
const f2 = (x) => (x === null ? '  -  ' : x.toFixed(3));

// ---- 1. One ego per stage, one context ------------------------------------------------------------------------------
const HIDDEN = 0.73;
console.log(`Part 1: one ego per stage, ${TRIALS} trials, range [0,1], hidden value kept inside the world\n`);
console.log('stage  opacity  lost  belief  +/-std  |err|   perceived early -> recent   error@10/20/30/40');
const errs = {};
for (const stage of VEIL_STAGES) {
  let m = createEgoMemory({ seed: 2026 });
  const world = makeWorld(HIDDEN);
  const curve = [];
  for (let i = 0; i < TRIALS; i++) {
    m = stepVeiledEgoLearning(m, world, stage).memory;
    if ((i + 1) % 10 === 0) curve.push(Math.abs(beliefMean(m) - HIDDEN));
  }
  const err = Math.abs(beliefMean(m) - HIDDEN);
  errs[stage] = err;
  const t = perceivedErrorTrend(m);
  console.log(`${stage.padEnd(5)}  ${STAGE_VEIL_OPACITY[stage].toFixed(2)}     ${String(m.lostSignals).padStart(2)}    ${beliefMean(m).toFixed(3)}   ${beliefStd(m).toFixed(3)}   ${err.toFixed(3)}   ${f2(t.early)} -> ${f2(t.recent)}          ${curve.map((c) => c.toFixed(3)).join(' ')}`);
}
if (!(errs.S6 <= 0.05)) fail(`S6 ego did not learn (error ${errs.S6})`);
if (!(errs.S6 < errs.S0a)) fail('S6 should learn better than S0a');

// ---- 2. A Wanderer: three contexts, three different hidden answers ---------------------------------------------------
const TARGETS = { 'game-a': 0.12, 'game-b': 0.5, 'game-c': 0.91 };
console.log('\nPart 2: a Wanderer at S6 learns three contexts, each with its own hidden answer');
{
  const worlds = Object.entries(TARGETS).map(([id, t]) => [id, makeWorld(t)]);
  let m = createEgoMemory({ seed: 77 });
  for (let i = 0; i < TRIALS; i++) for (const [id, w] of worlds) m = stepVeiledEgoLearning(m, w, 'S6', { gameId: id }).memory;
  for (const [id, t] of Object.entries(TARGETS)) {
    const a = m.learnedAttractorByContext[id];
    console.log(`  ${id}: learned ${a.toFixed(3)}  confidence ${m.learnedConfidenceByContext[id].toFixed(2)}  (error ${Math.abs(a - t).toFixed(3)})`);
    if (!(Math.abs(a - t) <= 0.05)) fail(`${id} not learned`);
  }
  console.log(`  catalysts mastered alone: ${m.autonomousCatalystsMastered}   self-resolved distortion: ${m.totalSelfResolvedDistortion.toFixed(3)}`);
  if (m.autonomousCatalystsMastered !== 3) fail('expected 3 catalysts mastered');
}

// ---- 3. Four lives, four Harvest choices -----------------------------------------------------------------------------
console.log('\nPart 3: four lives (two catalysts each, 40 trials, S6) and their Harvest choices from their own experience');
const LIVES = {
  steward: { seed: 1, tag: (i) => ({ servedOther: i % 10 < 8, floats: [0.3, 0.3, 0.8, 0.8] }) },
  wanderer: { seed: 2, tag: () => ({ servedOther: false, floats: [0.9, 0.5, 0.8, 0.3] }) },
  specialist: { seed: 3, tag: (i) => ({ servedOther: i % 10 < 3, floats: [0.5, 0.9, 0.4, 0.4] }) },
  enclave: { seed: 4, tag: () => ({ servedOther: false, helped: false, floats: [0.4, 0.6, 0.4, 0.5] }) },
};
const EXPECT = { steward: 'PATH_1_HIGHER_SELF_STEWARD', wanderer: 'PATH_2_CROSS_GAME_WANDERER', specialist: 'PATH_3_RAY_SPECIALIST', enclave: 'PATH_4_SOVEREIGN_ENCLAVE' };
for (const [name, { seed, tag }] of Object.entries(LIVES)) {
  let m = createEgoMemory({ seed });
  const two = [['one', makeWorld(0.35)], ['two', makeWorld(0.7)]];
  for (let i = 0; i < 20; i++) two.forEach(([id, w], k) => { m = stepVeiledEgoLearning(m, w, 'S6', { gameId: id, ...tag(i * 2 + k) }).memory; });
  const h = evaluateHarvestChoice(m);
  console.log(`  ${name}: eligible=${h.harvestEligible}  ${h.chosenPath}  ${h.chosenNextVessel}  ${h.stargateOrBridgeTarget}`);
  console.log(`     ${h.rationale}`);
  for (const r of h.reasons) console.log(`       - ${r}`);
  if (h.chosenPath !== EXPECT[name] || !h.harvestEligible) fail(`${name} harvest`);
  if (name === 'steward') {
    const cold = evaluateHarvestChoice(m, { coherenceH: 0.9 });
    console.log(`  (same steward at coherence 0.90: eligible=${cold.harvestEligible}  ${cold.chosenNextVessel}  ${cold.stargateOrBridgeTarget})`);
    if (cold.harvestEligible) fail('coherence gate');
  }
}

// ---- 4. The Overwatch meta-audit -------------------------------------------------------------------------------------
console.log('\nPart 4: Overwatch meta-audit');
const AUDITS = [
  [{ usesHardcodedExampleNames: true, blocksMechanicsOnUncheckedPermission: false, leavesExtractedRulesUnwiredInPlay: false }, 'DISTORTION_1_EXAMPLE_FIXATION'],
  [{ usesHardcodedExampleNames: true, blocksMechanicsOnUncheckedPermission: true, leavesExtractedRulesUnwiredInPlay: true }, 'DISTORTION_2_AUTHORITARIAN_GATE'],
  [{ usesHardcodedExampleNames: false, blocksMechanicsOnUncheckedPermission: false, leavesExtractedRulesUnwiredInPlay: true }, 'DISTORTION_3_HOLLOW_UNWIRED_SHELL'],
  [{ usesHardcodedExampleNames: false, blocksMechanicsOnUncheckedPermission: false, leavesExtractedRulesUnwiredInPlay: false }, 'NONE_UNDISTORTED'],
];
for (const [proposal, want] of AUDITS) {
  const a = auditOverwatchDistortion(proposal);
  console.log(`  ${a.distortion} (pi ${a.severityPi}): ${a.correctiveLogosDirective}`);
  if (a.distortion !== want) fail(`audit expected ${want}`);
}

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
