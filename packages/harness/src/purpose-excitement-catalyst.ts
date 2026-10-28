/**
 * @file purpose-excitement-catalyst.ts
 * @module @hm/harness
 * @description Excitement-guided purpose alignment under the Veil, with the SQ antidote (Plan 54). The design, the data and the
 * per-step loop are Argon's: 21 SQ distortion presets with antidote rays and occlusion penalties, four incarnational archetypes
 * with 7-ray purpose vectors, felt excitement as the compass, outcome-insistence as its poison, and a Hebbian pull of the ego's
 * ray weights toward what it chose and what the catalyst offered.
 *
 * CORRECTION (Opus cross-check, same as Plan 52). Argon's step took the soul's `preIncarnationalPurpose` as an argument and
 * computed soulResonance = cos(action, purpose) inside it, so the "veiled" ego always picked the action nearest its purpose and
 * the Veil never touched that signal (opacity merely decayed with excitement). Here the purpose lives only in the Higher Self,
 * an `ExcitementWorld` closure the game holds (`createPreIncarnationalPurpose`); the ego state has no purpose field; every
 * candidate's felt value comes from `higherSelf(action)` and passes through the stage's Veil (`veilObserve` at
 * `STAGE_VEIL_OPACITY[stage]`, Plan 52), and a lost signal falls back to the ego's own expectation cos(learnedWeights, action).
 * `purposeAlignment` is a separate pure measure for the caller and the tests: the Higher Self can measure it, the ego cannot.
 *
 * Rays are indexed 1..7 (Red, Orange, Yellow, Green, Blue, Indigo, Violet) and stored at positions 0..6.
 *
 * Pure and deterministic: no Date.now, no Math.random, no I/O. The mulberry32 state travels in the ego state.
 */
import type { FourFloatsTuple } from './types.js';
import { STAGE_VEIL_OPACITY, veilObserve, type VeilStage } from './veil-learning-harvest.js';

export type CoreEgoBeliefId = 'BELIEF_1_LACK' | 'BELIEF_2_OUTCOME_ATTACHMENT' | 'BELIEF_3_CONTROL' | 'UPPER_TRIAD_ALIGNED';

export type SQDistortionPresetId =
  | 'root-lack' | 'root-fear' | 'root-reactivity' | 'root-apathy' | 'root-trauma'
  | 'sacral-resistance' | 'sacral-guilt' | 'sacral-shame' | 'sacral-insecurity' | 'sacral-frustration' | 'sacral-addiction' | 'sacral-repression'
  | 'solar-control' | 'solar-anxiety' | 'solar-victimhood' | 'solar-jealousy' | 'solar-projection' | 'solar-pride'
  | 'heart-awakening' | 'throat-actualization' | 'thirdeye-illumination';

export type IncarnationalArchetypeId = 'JOYFUL_GUARDIAN' | 'HARMONIC_CHALLENGER' | 'UNITIVE_COMPANION' | 'SOVEREIGN_PATHFINDER';

/** A 7-ray vector: Red, Orange, Yellow, Green, Blue, Indigo, Violet. */
export type RayVector7 = readonly number[];

export interface ISQDistortionEntry {
  readonly belief: CoreEgoBeliefId;
  /** The ray (1..7) the distortion sits on. */
  readonly rayIndex: number;
  readonly antidoteName: string;
  /** The ray (1..7) the antidote strengthens. */
  readonly antidoteRayIndex: number;
  /** How hard a full charge occludes felt excitement (occlusion = min(0.85, charge · penalty)). */
  readonly occlusionPenalty: number;
}

const L1: CoreEgoBeliefId = 'BELIEF_1_LACK', L2: CoreEgoBeliefId = 'BELIEF_2_OUTCOME_ATTACHMENT', L3: CoreEgoBeliefId = 'BELIEF_3_CONTROL', U: CoreEgoBeliefId = 'UPPER_TRIAD_ALIGNED';
const e = (belief: CoreEgoBeliefId, rayIndex: number, antidoteName: string, antidoteRayIndex: number, occlusionPenalty: number): ISQDistortionEntry => ({ belief, rayIndex, antidoteName, antidoteRayIndex, occlusionPenalty });

/** The 21 SQ distortion presets (`.claude/skills/sq-distortion-check`), each with its antidote and its occlusion penalty. */
export const SQ_DISTORTION_CATALOG: Readonly<Record<SQDistortionPresetId, ISQDistortionEntry>> = {
  'root-lack': e(L1, 1, 'Gratitude', 4, 0.42),
  'root-fear': e(L1, 1, 'Faith', 6, 0.48),
  'root-reactivity': e(L1, 1, 'Presence', 5, 0.45),
  'root-apathy': e(L1, 1, 'Joy', 4, 0.55),
  'root-trauma': e(L1, 1, 'Sovereignty', 6, 0.52),
  'sacral-resistance': e(L2, 2, 'Acceptance & Flow', 4, 0.46),
  'sacral-guilt': e(L2, 2, 'Forgiveness', 4, 0.4),
  'sacral-shame': e(L2, 2, 'Self-Acceptance', 4, 0.44),
  'sacral-insecurity': e(L2, 2, 'Confidence', 5, 0.36),
  'sacral-frustration': e(L2, 2, 'Equanimity', 5, 0.47),
  'sacral-addiction': e(L2, 2, 'Sufficiency', 6, 0.43),
  'sacral-repression': e(L2, 2, 'Integrity', 5, 0.49),
  'solar-control': e(L3, 3, 'Wisdom & Surrender', 5, 0.5),
  'solar-anxiety': e(L3, 3, 'Inner Stillness & Order', 6, 0.45),
  'solar-victimhood': e(L3, 3, 'Empowerment', 4, 0.41),
  'solar-jealousy': e(L3, 3, 'Collaborative Unity', 4, 0.39),
  'solar-projection': e(L3, 3, 'Fidelity & Discernment', 6, 0.44),
  'solar-pride': e(L3, 3, 'Humility', 4, 0.46),
  'heart-awakening': e(U, 4, 'Balanced Service', 4, 0.15),
  'throat-actualization': e(U, 5, 'Authenticity & Integrity', 5, 0.12),
  'thirdeye-illumination': e(U, 6, 'Spiritual Balance', 6, 0.1),
};

export const SQ_DISTORTION_IDS = Object.keys(SQ_DISTORTION_CATALOG) as SQDistortionPresetId[];

/** Euclidean-normalise a vector (zero stays zero). */
export function normalizeRays(v: readonly number[]): number[] {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return n > 0 ? v.map((x) => x / n) : v.map(() => 0);
}

/** The archetype purpose vectors, normalised. */
export const ARCHETYPE_PURPOSE_VECTORS: Readonly<Record<IncarnationalArchetypeId, RayVector7>> = {
  JOYFUL_GUARDIAN: normalizeRays([0.18, 0.12, 0.15, 0.58, 0.48, 0.45, 0.4]),
  HARMONIC_CHALLENGER: normalizeRays([0.22, 0.15, 0.35, 0.42, 0.52, 0.48, 0.36]),
  UNITIVE_COMPANION: normalizeRays([0.14, 0.14, 0.14, 0.62, 0.5, 0.42, 0.38]),
  SOVEREIGN_PATHFINDER: normalizeRays([0.24, 0.14, 0.18, 0.4, 0.54, 0.55, 0.38]),
};

/** The veiled ego's starting ray weights (lower-triad heavy), normalised. */
export const INITIAL_VEILED_EGO_WEIGHTS: RayVector7 = normalizeRays([0.65, 0.55, 0.48, 0.12, 0.1, 0.08, 0.05]);

export type CatalystEventKind = 'WEAPON_BURST_CADENCE' | 'OBJECTIVE_PLANT_OR_HARMONIZE' | 'COMPANION_ASSIST_OR_SHIELD' | 'HIGH_ENTROPY_SURPRISE' | 'ROUND_TRANSITION';

/** A catalyst from the player's play (host game or harness skin). */
export interface IPlayerCatalystEvent {
  readonly eventId: string;
  readonly sourcePlayerRole: 'HOST_GAME_PLAYER' | 'HARNESS_SKIN_PLAYER';
  readonly eventKind: CatalystEventKind;
  /** [0, 1]. */
  readonly catalystIntensity: number;
  readonly stimulusRayVector: RayVector7;
  /** Carried for the caller's telemetry; the loop does not read it. */
  readonly stateSnapshot: FourFloatsTuple;
}

export interface IEgoCandidateAction {
  readonly actionId: string;
  readonly description: string;
  readonly actionRayVector: RayVector7;
  /** [0, 1]: how attached the action is to a particular outcome (poisons felt excitement). */
  readonly outcomeInsistence: number;
}

/** What the game knows about a soul's purpose. The ego never holds this. */
export interface IPreIncarnationalPurpose {
  readonly soulId: string;
  readonly archetype: IncarnationalArchetypeId;
  readonly targetPresetId: string;
  readonly curriculum: SQDistortionPresetId;
  readonly purposeRayVector: RayVector7;
}

/** The Higher Self: an opaque closure from an action's ray vector to the raw resonance max(0, cos(action, purpose)). */
export type ExcitementWorld = (actionRayVector: RayVector7) => number;

/** The ego's whole state. There is deliberately NO purpose field. */
export interface IVeiledEgoState {
  readonly soulId: string;
  readonly stage: VeilStage;
  readonly learnedRayWeights: RayVector7;
  readonly activeDistortion: SQDistortionPresetId | null;
  readonly distortionCharge: number;
  readonly feltExcitement: number;
  /** Cumulative catalystIntensity · feltExcitement of the chosen actions. */
  readonly integratedCatalystScore: number;
  readonly antidotesAppliedCount: number;
  /** mulberry32 state of the Veil's noise stream. */
  readonly rngState: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

/** The game's side: the soul's purpose (from its archetype) and the Higher Self closure that alone can read it. */
export function createPreIncarnationalPurpose(
  soulId: string,
  archetype: IncarnationalArchetypeId,
  targetPresetId: string,
  curriculum: SQDistortionPresetId = 'solar-control',
): { purpose: IPreIncarnationalPurpose; higherSelf: ExcitementWorld } {
  const purposeRayVector = ARCHETYPE_PURPOSE_VECTORS[archetype];
  const purpose: IPreIncarnationalPurpose = { soulId, archetype, targetPresetId, curriculum, purposeRayVector };
  const higherSelf: ExcitementWorld = (action) => Math.max(0, cosine(action, purposeRayVector));
  return { purpose, higherSelf };
}

/** The ego's side: a soul enters a preset behind the Veil of `stage`, knowing nothing of its purpose. The curriculum distortion
 *  starts charged at 0.72 · opacity (none if that is below the clearing threshold, e.g. at S6). */
export function enterPresetBehindVeil(soulId: string, curriculum: SQDistortionPresetId, stage: VeilStage = 'S0a', seed = 1): IVeiledEgoState {
  const charge = 0.72 * STAGE_VEIL_OPACITY[stage];
  return {
    soulId,
    stage,
    learnedRayWeights: INITIAL_VEILED_EGO_WEIGHTS,
    activeDistortion: charge >= CLEAR_THRESHOLD ? curriculum : null,
    distortionCharge: charge,
    feltExcitement: 0,
    integratedCatalystScore: 0,
    antidotesAppliedCount: 0,
    rngState: (seed ^ 0x9e3779b9) >>> 0,
  };
}

const CLEAR_THRESHOLD = 0.08;

/** How well the ego's learned weights match the soul's purpose, cos in [-1, 1]. A measure for the caller and the tests only. */
export function purposeAlignment(state: IVeiledEgoState, purpose: IPreIncarnationalPurpose): number {
  return cosine(state.learnedRayWeights, purpose.purposeRayVector);
}

/** One step of Argon's loop, with the correction that the purpose is never an argument:
 *  1. active distortion: with the antidote, transmuted = charge · (0.45 + 0.35·intensity); charge −= transmuted; the antidote ray's
 *     weight += 0.28 · transmuted; antidotes++; it clears below 0.08. Without it, charge = min(1, charge + 0.15·intensity).
 *  2. occlusion = min(0.85, charge · penalty of the active distortion).
 *  3. per candidate: felt = clamp01((0.75·soulResonance + 0.25·catalystHarmonic) · (1 − occlusion) − outcomePenalty), with
 *     soulResonance = higherSelf(action), catalystHarmonic = max(0, cos(action, stimulus)), outcomePenalty = (0.05 with the SQ
 *     check, else 0.45) · insistence. The whole felt value goes through the stage's Veil; if the signal is lost, the ego's own
 *     expectation cos(learnedWeights, action) stands in for the resonance. The highest perceived value wins (first on ties).
 *  4. Hebbian: lr = 0.24·(0.5 + 0.5·intensity)·max(0.1, felt); w = (1 − lr)·w + lr·(0.8·action + 0.2·stimulus); normalised. */
export function stepExcitementPurposeAlignment(
  state: IVeiledEgoState,
  higherSelf: ExcitementWorld,
  catalyst: IPlayerCatalystEvent,
  candidates: readonly IEgoCandidateAction[],
  applySQAntidote = true,
): { state: IVeiledEgoState; chosen: IEgoCandidateAction | null; chosenIndex: number; feltExcitement: number; signalsLost: number } {
  const intensity = clamp01(catalyst.catalystIntensity);
  let weights = [...state.learnedRayWeights];
  let charge = state.distortionCharge;
  let active = state.activeDistortion;
  let antidotes = state.antidotesAppliedCount;

  // 1. the distortion
  if (active) {
    if (applySQAntidote) {
      const entry = SQ_DISTORTION_CATALOG[active];
      const transmuted = charge * (0.45 + 0.35 * intensity);
      charge -= transmuted;
      const k = entry.antidoteRayIndex - 1;
      weights[k] = (weights[k] ?? 0) + 0.28 * transmuted;
      antidotes++;
      if (charge < CLEAR_THRESHOLD) active = null;
    } else {
      charge = Math.min(1, charge + 0.15 * intensity);
    }
  }
  // 2. occlusion
  const occlusion = active ? Math.min(0.85, charge * SQ_DISTORTION_CATALOG[active].occlusionPenalty) : 0;

  // 3. felt excitement per candidate, behind the veil
  const opacity = STAGE_VEIL_OPACITY[state.stage];
  const penaltyRate = applySQAntidote ? 0.05 : 0.45;
  let rng = state.rngState;
  let best = -1, bestPerceived = -Infinity, bestFelt = 0, lost = 0;
  candidates.forEach((c, i) => {
    const harmonic = Math.max(0, cosine(c.actionRayVector, catalyst.stimulusRayVector));
    const penalty = penaltyRate * clamp01(c.outcomeInsistence);
    const feltOf = (resonance: number): number => clamp01((0.75 * resonance + 0.25 * harmonic) * (1 - occlusion) - penalty);
    const raw = feltOf(higherSelf(c.actionRayVector));
    const obs = veilObserve(raw, opacity, rng);
    rng = obs.rngState;
    let perceived: number;
    if (obs.value === null) {
      lost++;
      perceived = feltOf(Math.max(0, cosine(weights, c.actionRayVector)));
    } else perceived = obs.value;
    if (perceived > bestPerceived) { bestPerceived = perceived; best = i; bestFelt = clamp01(perceived); }
  });

  const chosen = best >= 0 ? candidates[best] ?? null : null;
  if (chosen) {
    // 4. Hebbian pull toward what was chosen and what the catalyst offered
    const lr = 0.24 * (0.5 + 0.5 * intensity) * Math.max(0.1, bestFelt);
    weights = normalizeRays(weights.map((w, k) => (1 - lr) * w + lr * (0.8 * (chosen.actionRayVector[k] ?? 0) + 0.2 * (catalyst.stimulusRayVector[k] ?? 0))));
  } else weights = normalizeRays(weights);

  const next: IVeiledEgoState = {
    ...state,
    learnedRayWeights: weights,
    activeDistortion: active,
    distortionCharge: charge,
    feltExcitement: chosen ? bestFelt : 0,
    integratedCatalystScore: state.integratedCatalystScore + (chosen ? intensity * bestFelt : 0),
    antidotesAppliedCount: antidotes,
    rngState: rng,
  };
  return { state: next, chosen, chosenIndex: best, feltExcitement: next.feltExcitement, signalsLost: lost };
}
