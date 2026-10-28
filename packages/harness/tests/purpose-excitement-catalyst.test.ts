// Plan 54: excitement-guided purpose alignment under the Veil. The purpose lives only in the Higher Self closure the game holds;
// the ego learns it from veiled felt excitement alone. Alignment is measured by the caller (purposeAlignment), never by the ego.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHETYPE_PURPOSE_VECTORS, createPreIncarnationalPurpose, enterPresetBehindVeil, purposeAlignment, SQ_DISTORTION_CATALOG, SQ_DISTORTION_IDS,
  stepExcitementPurposeAlignment,
  type IEgoCandidateAction, type IncarnationalArchetypeId, type IPlayerCatalystEvent, type IVeiledEgoState, type ExcitementWorld,
  type IPreIncarnationalPurpose,
} from '../src/purpose-excitement-catalyst';
import type { VeilStage } from '../src/veil-learning-harvest';

const ARCHETYPES: IncarnationalArchetypeId[] = ['JOYFUL_GUARDIAN', 'HARMONIC_CHALLENGER', 'UNITIVE_COMPANION', 'SOVEREIGN_PATHFINDER'];

/** A tiny seeded generator for the test's candidate stream (mulberry32). */
function rngOf(seed: number): () => number {
  let s = (seed ^ 0x1234abcd) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UPPER = [0.1, 0.1, 0.15, 0.55, 0.5, 0.5, 0.4];
const LOWER = [0.6, 0.5, 0.45, 0.12, 0.1, 0.08, 0.05];

/** Six candidates per step: upper-triad leaning, lower-triad leaning, and random mixes. The generator never sees the purpose. */
function candidatesFor(rand: () => number, step: number): IEgoCandidateAction[] {
  const jitter = (base: number[], amp: number): number[] => base.map((b) => Math.max(0.01, b * (1 - amp + 2 * amp * rand())));
  const mix = (): number[] => Array.from({ length: 7 }, () => 0.02 + rand() * rand());
  const vecs = [jitter(UPPER, 0.4), jitter(UPPER, 0.4), jitter(LOWER, 0.5), mix(), mix(), mix()];
  return vecs.map((v, i) => ({ actionId: `s${step}c${i}`, description: `candidate ${i}`, actionRayVector: v, outcomeInsistence: rand() }));
}

function catalystFor(rand: () => number, step: number): IPlayerCatalystEvent {
  const kinds = ['WEAPON_BURST_CADENCE', 'OBJECTIVE_PLANT_OR_HARMONIZE', 'COMPANION_ASSIST_OR_SHIELD', 'HIGH_ENTROPY_SURPRISE', 'ROUND_TRANSITION'] as const;
  return {
    eventId: `e${step}`, sourcePlayerRole: step % 2 === 0 ? 'HOST_GAME_PLAYER' : 'HARNESS_SKIN_PLAYER', eventKind: kinds[step % kinds.length] ?? 'ROUND_TRANSITION',
    catalystIntensity: 0.5 + 0.5 * rand(), stimulusRayVector: Array.from({ length: 7 }, () => 0.05 + rand()), stateSnapshot: [0.5, 0.5, 0.5, 0.5],
  };
}

function live(archetype: IncarnationalArchetypeId, stage: VeilStage, seed: number, steps: number, applyAntidote = true): { state: IVeiledEgoState; purpose: IPreIncarnationalPurpose } {
  const { purpose, higherSelf } = createPreIncarnationalPurpose(`soul-${seed}`, archetype, 'preset:test');
  let state = enterPresetBehindVeil(purpose.soulId, purpose.curriculum, stage, seed);
  const rand = rngOf(seed * 7919 + 13);
  for (let i = 0; i < steps; i++) state = stepExcitementPurposeAlignment(state, higherSelf, catalystFor(rand, i), candidatesFor(rand, i), applyAntidote).state;
  return { state, purpose };
}

const avgAlignment = (archetype: IncarnationalArchetypeId, stage: VeilStage, steps: number, applyAntidote = true): number => {
  let sum = 0;
  for (let seed = 1; seed <= 8; seed++) { const r = live(archetype, stage, seed, steps, applyAntidote); sum += purposeAlignment(r.state, r.purpose); }
  return sum / 8;
};

test('catalog: 21 entries with Argon antidote rays; archetype vectors normalised', () => {
  assert.equal(SQ_DISTORTION_IDS.length, 21);
  const rays: Record<string, [number, number, number, string]> = {
    'root-lack': [1, 4, 0.42, 'BELIEF_1_LACK'], 'root-fear': [1, 6, 0.48, 'BELIEF_1_LACK'], 'root-reactivity': [1, 5, 0.45, 'BELIEF_1_LACK'],
    'root-apathy': [1, 4, 0.55, 'BELIEF_1_LACK'], 'root-trauma': [1, 6, 0.52, 'BELIEF_1_LACK'],
    'sacral-resistance': [2, 4, 0.46, 'BELIEF_2_OUTCOME_ATTACHMENT'], 'sacral-guilt': [2, 4, 0.4, 'BELIEF_2_OUTCOME_ATTACHMENT'], 'sacral-shame': [2, 4, 0.44, 'BELIEF_2_OUTCOME_ATTACHMENT'],
    'sacral-insecurity': [2, 5, 0.36, 'BELIEF_2_OUTCOME_ATTACHMENT'], 'sacral-frustration': [2, 5, 0.47, 'BELIEF_2_OUTCOME_ATTACHMENT'], 'sacral-addiction': [2, 6, 0.43, 'BELIEF_2_OUTCOME_ATTACHMENT'],
    'sacral-repression': [2, 5, 0.49, 'BELIEF_2_OUTCOME_ATTACHMENT'],
    'solar-control': [3, 5, 0.5, 'BELIEF_3_CONTROL'], 'solar-anxiety': [3, 6, 0.45, 'BELIEF_3_CONTROL'], 'solar-victimhood': [3, 4, 0.41, 'BELIEF_3_CONTROL'],
    'solar-jealousy': [3, 4, 0.39, 'BELIEF_3_CONTROL'], 'solar-projection': [3, 6, 0.44, 'BELIEF_3_CONTROL'], 'solar-pride': [3, 4, 0.46, 'BELIEF_3_CONTROL'],
    'heart-awakening': [4, 4, 0.15, 'UPPER_TRIAD_ALIGNED'], 'throat-actualization': [5, 5, 0.12, 'UPPER_TRIAD_ALIGNED'], 'thirdeye-illumination': [6, 6, 0.1, 'UPPER_TRIAD_ALIGNED'],
  };
  for (const id of SQ_DISTORTION_IDS) {
    const want = rays[id];
    const got = SQ_DISTORTION_CATALOG[id];
    assert.ok(want, `unexpected id ${id}`);
    assert.deepEqual([got.rayIndex, got.antidoteRayIndex, got.occlusionPenalty, got.belief], want);
  }
  assert.equal(Object.keys(rays).length, 21);
  assert.equal(SQ_DISTORTION_CATALOG['solar-control'].antidoteName, 'Wisdom & Surrender');
  for (const a of ARCHETYPES) {
    const v = ARCHETYPE_PURPOSE_VECTORS[a];
    assert.equal(v.length, 7);
    assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12);
  }
});

test('structural: no purpose parameter, the world is a closure, the ego state has no purpose field', () => {
  assert.ok(stepExcitementPurposeAlignment.length <= 5);
  const signature = stepExcitementPurposeAlignment.toString().split(')')[0]?.split('(')[1] ?? '';
  assert.ok(!/purpose/i.test(signature), signature);
  const { purpose, higherSelf } = createPreIncarnationalPurpose('s', 'JOYFUL_GUARDIAN', 'preset:x');
  assert.equal(typeof higherSelf, 'function');
  const state = enterPresetBehindVeil('s', purpose.curriculum, 'S3', 1);
  assert.ok(!Object.keys(state).some((k) => /purpose|target|archetype/i.test(k)), Object.keys(state).join());
  const after = live('JOYFUL_GUARDIAN', 'S3', 2, 10).state;
  assert.ok(!Object.keys(after).some((k) => /purpose|target|archetype/i.test(k)));
  assert.ok(!JSON.stringify(after).includes(String(ARCHETYPE_PURPOSE_VECTORS.JOYFUL_GUARDIAN[3])));
  // the Higher Self is the only reader of the purpose, and counts its calls
  let calls = 0;
  const counting: ExcitementWorld = (a) => { calls++; return higherSelf(a); };
  const rand = rngOf(5);
  stepExcitementPurposeAlignment(state, counting, catalystFor(rand, 0), candidatesFor(rand, 0));
  assert.equal(calls, 6);
});

test('learning: every archetype reaches alignment > 0.95 at S6 within 40 steps; the thick veil of S0a does worse (8 seeds)', () => {
  for (const a of ARCHETYPES) {
    for (let seed = 1; seed <= 4; seed++) {
      const r = live(a, 'S6', seed, 40);
      const al = purposeAlignment(r.state, r.purpose);
      assert.ok(al > 0.95, `${a} seed ${seed}: alignment ${al}`);
    }
    const clear = avgAlignment(a, 'S6', 40), veiled = avgAlignment(a, 'S0a', 40);
    assert.ok(veiled < clear, `${a}: S0a ${veiled} vs S6 ${clear}`);
  }
});

test('SQ antidote: the distortion clears and alignment beats the same run without it (S3, averaged over seeds)', () => {
  const { purpose } = createPreIncarnationalPurpose('x', 'HARMONIC_CHALLENGER', 'preset:x');
  const start = enterPresetBehindVeil('x', purpose.curriculum, 'S3', 1);
  assert.equal(start.activeDistortion, 'solar-control');
  const withIt = live('HARMONIC_CHALLENGER', 'S3', 3, 12, true).state;
  assert.equal(withIt.activeDistortion, null);
  assert.ok(withIt.antidotesAppliedCount >= 1);
  const without = live('HARMONIC_CHALLENGER', 'S3', 3, 12, false).state;
  assert.equal(without.activeDistortion, 'solar-control');
  assert.ok(without.distortionCharge > start.distortionCharge);
  for (const a of ARCHETYPES) {
    const yes = avgAlignment(a, 'S3', 20, true), no = avgAlignment(a, 'S3', 20, false);
    assert.ok(yes > no, `${a}: with ${yes} vs without ${no}`);
  }
});

test('outcome insistence: of two candidates with the same ray vector the more insistent is chosen less often', () => {
  const { higherSelf, purpose } = createPreIncarnationalPurpose('x', 'UNITIVE_COMPANION', 'preset:x');
  const same = [...ARCHETYPE_PURPOSE_VECTORS.UNITIVE_COMPANION];
  const pair: IEgoCandidateAction[] = [
    { actionId: 'clingy', description: 'insists on the outcome', actionRayVector: same, outcomeInsistence: 1 },
    { actionId: 'open', description: 'open to the outcome', actionRayVector: same, outcomeInsistence: 0 },
  ];
  const rand = rngOf(99);
  for (const applyAntidote of [true, false]) {
    let clingy = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const state = enterPresetBehindVeil('x', purpose.curriculum, 'S4', i + 1);
      const r = stepExcitementPurposeAlignment(state, higherSelf, catalystFor(rand, i), pair, applyAntidote);
      if (r.chosen?.actionId === 'clingy') clingy++;
    }
    assert.ok(clingy < N / 2, `antidote=${applyAntidote}: clingy chosen ${clingy}/${N}`);
  }
});

test('determinism: same seed and inputs, identical states (and JSON-safe)', () => {
  const a = live('SOVEREIGN_PATHFINDER', 'S2', 42, 30).state;
  const b = live('SOVEREIGN_PATHFINDER', 'S2', 42, 30).state;
  const c = live('SOVEREIGN_PATHFINDER', 'S2', 43, 30).state;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
});
