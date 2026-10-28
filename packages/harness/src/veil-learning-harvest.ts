/**
 * @file veil-learning-harvest.ts
 * @module @hm/harness
 * @description The Perceptual Veil, autonomous ego learning, and the Harvest choice (Plan 52, on the cosmology of Plan 46 §1.1;
 * the Harvest decision shape and the Overwatch meta-audit follow Argon's Plan 52 bundle).
 *
 * An in-game AI "ego" lives in worlds whose rules it is never told. Its senses are filtered by the Veil: a merciful
 * bandwidth filter whose opacity falls as the world's Fidelity Stage rises (S0a wireframe 0.95 ... S6 0.00). A veiled
 * observation is either LOST (probability 0.6 · opacity) or arrives with Gaussian noise (sd = VEIL_NOISE_SCALE · span · opacity).
 *
 *   world(action) ─▶ signed miss (the Cybernetic Mirror's reflection) ─▶ veilObserve ─▶ perceived (or lost) ─▶ Bayesian update
 *
 * NO SPOON-FEEDING (owner rule). Argon's bundle step took the true target (`trueHarmonicTargetX`) as an argument, started the
 * guess partly at it and descended the exact gradient to it; that is a calculator, not a learner, and is rejected. This module
 * keeps the Veil structural: the world is OPAQUE (`VeiledWorld`, a function from an action to a raw outcome); the hidden
 * quantity lives only in the world's closure and no function here can read it. The ego sees only veiled feedback.
 *
 * What the ego learns, it learns genuinely:
 *  - The world's answer is the Cybernetic Mirror's reflection (Argon's term): the SIGNED MISS `hidden − action`, in the units of
 *    the declared range, filtered by the Veil. The ego's hypothesis h predicts the outcome `h − action`.
 *  - One hidden quantity PER CONTEXT: each game or catalyst (`context.gameId`, else '(default)') has its own answer, so the ego
 *    keeps a separate discretised log-posterior per context, a belief over `bins` cells of the declared range. Each trial it
 *    draws its action by Thompson sampling from that context's posterior (wide belief ⇒ explore, sharp belief ⇒ exploit).
 *  - The likelihood is Gaussian with a noise that matches the veil at that stage (sd² = floor² + (noise·opacity)²), so a thick
 *    veil makes each observation count for less, and a LOST signal is no update at all. Less sight ⇒ slower learning.
 *
 * At "the Harvest" the ego's next path follows Argon's decision rules (`evaluateHarvestChoice`), with every input taken from the
 * ego's OWN experience (steward share of its trials, the mastery-weighted Four Floats it lived in, catalysts it mastered alone)
 * unless the caller overrides them. `auditOverwatchDistortion` is the Overwatch's meta-audit of a design proposal.
 *
 * Pure and deterministic: no Date.now, no Math.random, no I/O. All randomness is a mulberry32 stream whose state lives IN the
 * memory object, so the same seed and the same inputs give bit-identical results. The memory is plain JSON-able data.
 */
import type { FidelityStageId, FourFloatsTuple } from './types.js';

/** The eight Fidelity Stages the Veil is keyed on (the harness's own stage id). */
export type VeilStage = FidelityStageId;

export const VEIL_STAGES: readonly VeilStage[] = ['S0a', 'S0b', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

/** Veil opacity per stage (Argon's curve): strictly decreasing, fully clear at S6. */
export const STAGE_VEIL_OPACITY: Readonly<Record<VeilStage, number>> = {
  S0a: 0.95,
  S0b: 0.88,
  S1: 0.78,
  S2: 0.65,
  S3: 0.5,
  S4: 0.32,
  S5: 0.15,
  S6: 0,
};

/** Probability of losing the signal altogether = LOSS_PER_OPACITY · opacity. */
export const VEIL_LOSS_PER_OPACITY = 0.6;
/** Noise sd of a delivered signal = VEIL_NOISE_SCALE · span · opacity, `span` being the width of the declared range. */
export const VEIL_NOISE_SCALE = 0.5;
/** Sensor/model noise floor of the ego's likelihood, as a fraction of the span (keeps the posterior from collapsing to a spike). */
export const EGO_SIGMA_FLOOR = 0.02;
/** A context counts as mastered at this belief confidence... */
export const MASTERY_CONFIDENCE = 0.6;
/** ...and a recent perceived error below this fraction of the span. */
export const MASTERY_ERROR_FRACTION = 0.08;

/** The opaque world: an action in, a raw outcome out (the signed miss `hidden − action`). The ego never receives the hidden value. */
export type VeiledWorld = (action: number) => number;

/** Optional tag of a trial: where it happened and what kind of life it was. */
export interface TrialContext {
  /** The trial served another entity (a companion, the player, a colony) rather than the ego's own ends. */
  readonly servedOther?: boolean;
  /** Which game or catalyst this trial belongs to; each has its own hidden quantity. Untagged trials use '(default)'. */
  readonly gameId?: string;
  /** `true`: someone helped solve it; `false`: it was solved alone; undefined: not recorded. */
  readonly helped?: boolean;
  /** The Four Floats (pxd, vtx, lx, aq, each in [0,1]) of the world the trial was lived in. Untagged trials contribute nothing. */
  readonly floats?: FourFloatsTuple;
}

/** What the ego has learned in one context. */
export interface IContextLearning {
  readonly id: string;
  /** Normalised log-posterior over the bins (max = 0). Uniform at birth. */
  readonly logPosterior: readonly number[];
  readonly trials: number;
  readonly lostSignals: number;
  readonly perceivedCount: number;
  /** The first (up to 5) perceived miss magnitudes, frozen. */
  readonly firstPerceived: readonly number[];
  /** The latest (up to 5) perceived miss magnitudes. */
  readonly recentPerceived: readonly number[];
  readonly helpedTrials: number;
  readonly unhelpedTrials: number;
  /** Posterior mean (the learned attractor) and confidence in [0,1] = clamp(1 − std/(span/√12)). */
  readonly mean: number;
  readonly confidence: number;
  /** Sticky: reached confidence ≥ 0.6 with a recent perceived error < 0.08·span, mostly unhelped. Counted once. */
  readonly mastered: boolean;
}

/** Everything the ego knows. Plain JSON-able data; every step returns a new object. */
export interface IEgoExperientialMemory {
  readonly version: 2;
  readonly seed: number;
  /** mulberry32 state, a uint32; it travels with the memory. */
  readonly rngState: number;
  /** The declared range of every hidden quantity (the ego's prior support, not the answers). */
  readonly range: readonly [number, number];
  readonly bins: number;
  /** Trials taken in all contexts (a lost signal still costs a trial). */
  readonly trials: number;
  readonly lostSignals: number;
  readonly perceivedCount: number;
  /** Per-context learning, in order of first meeting. */
  readonly contexts: readonly IContextLearning[];
  readonly servedOtherTrials: number;
  readonly helpedTrials: number;
  readonly unhelpedTrials: number;
  /** Sum of (floats × weight) over float-tagged trials, and the weight sum; weight = the context's confidence after the trial. */
  readonly floatWeightedSum: readonly number[];
  readonly floatWeightSum: number;
  /** Derived from the contexts (kept in sync every step): the posterior mean and confidence per context id. */
  readonly learnedAttractorByContext: Readonly<Record<string, number>>;
  readonly learnedConfidenceByContext: Readonly<Record<string, number>>;
  /** Contexts mastered alone (each counted once). */
  readonly autonomousCatalystsMastered: number;
  /** Cumulative drop of the ego's OWN perceived error (early window − recent window, per context, summed); never uses the truth. */
  readonly totalSelfResolvedDistortion: number;
}

export const DEFAULT_CONTEXT_ID = '(default)';
const EARLY_WINDOW = 5;
const RECENT_WINDOW = 5;

// ---------------------------------------------------------------------------------------------------------------------
// Seeded randomness (mulberry32, state in the memory)
// ---------------------------------------------------------------------------------------------------------------------

/** One uniform draw in [0, 1) and the next state. */
function nextUniform(state: number): { readonly u: number; readonly state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { u: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s };
}

/** The veil: with probability `0.6 · opacity` the signal is lost (null); otherwise raw + N(0, (noiseScale · span · opacity)²).
 *  At opacity 0 nothing is drawn and the signal passes exactly. `span` defaults to 1 (the width of the declared range). */
export function veilObserve(raw: number, opacity: number, rngState: number, span = 1): { value: number | null; rngState: number } {
  if (!(opacity > 0)) return { value: raw, rngState };
  const lossDraw = nextUniform(rngState);
  if (lossDraw.u < VEIL_LOSS_PER_OPACITY * opacity) return { value: null, rngState: lossDraw.state };
  const a = nextUniform(lossDraw.state);
  const b = nextUniform(a.state);
  const z = Math.sqrt(-2 * Math.log(Math.max(a.u, 1e-12))) * Math.cos(2 * Math.PI * b.u);
  return { value: raw + z * VEIL_NOISE_SCALE * span * opacity, rngState: b.state };
}

// ---------------------------------------------------------------------------------------------------------------------
// Beliefs
// ---------------------------------------------------------------------------------------------------------------------

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const mean = (a: readonly number[]): number | null => (a.length === 0 ? null : a.reduce((x, y) => x + y, 0) / a.length);

/** A newborn ego: nothing experienced; every context will start from a uniform belief over `range` (default [0, 1]) in `bins` cells (default 64). */
export function createEgoMemory(opts: { seed: number; range?: [number, number]; bins?: number }): IEgoExperientialMemory {
  const range: readonly [number, number] = opts.range ?? [0, 1];
  if (!(range[1] > range[0])) throw new Error('createEgoMemory: range must be [lo, hi] with hi > lo');
  const bins = Math.max(2, Math.floor(opts.bins ?? 64));
  return {
    version: 2,
    seed: opts.seed,
    rngState: (opts.seed ^ 0xa5a5a5a5) >>> 0,
    range: [range[0], range[1]],
    bins,
    trials: 0,
    lostSignals: 0,
    perceivedCount: 0,
    contexts: [],
    servedOtherTrials: 0,
    helpedTrials: 0,
    unhelpedTrials: 0,
    floatWeightedSum: [0, 0, 0, 0],
    floatWeightSum: 0,
    learnedAttractorByContext: {},
    learnedConfidenceByContext: {},
    autonomousCatalystsMastered: 0,
    totalSelfResolvedDistortion: 0,
  };
}

function binCentre(range: readonly [number, number] | readonly number[], bins: number, i: number): number {
  const lo = range[0] ?? 0, hi = range[1] ?? 1;
  return lo + ((i + 0.5) / bins) * (hi - lo);
}

function probabilities(logPosterior: readonly number[]): number[] {
  const mx = Math.max(...logPosterior);
  const w = logPosterior.map((lp) => Math.exp(lp - mx));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

function momentsOf(range: readonly number[], bins: number, logPosterior: readonly number[]): { mean: number; std: number } {
  const p = probabilities(logPosterior);
  let m = 0;
  for (let i = 0; i < p.length; i++) m += (p[i] ?? 0) * binCentre(range, bins, i);
  let v = 0;
  for (let i = 0; i < p.length; i++) v += (p[i] ?? 0) * (binCentre(range, bins, i) - m) ** 2;
  return { mean: m, std: Math.sqrt(v) };
}

function contextOf(m: IEgoExperientialMemory, id: string): IContextLearning | undefined {
  return m.contexts.find((c) => c.id === id);
}

const uniformBelief = (bins: number): number[] => new Array<number>(bins).fill(0);

/** The belief of one context (default context when omitted) as probabilities; uniform if the ego has never met it. */
export function beliefProbabilities(m: IEgoExperientialMemory, contextId: string = DEFAULT_CONTEXT_ID): number[] {
  return probabilities(contextOf(m, contextId)?.logPosterior ?? uniformBelief(m.bins));
}

/** Posterior mean of one context's hidden quantity, in range units (the range midpoint if never met). */
export function beliefMean(m: IEgoExperientialMemory, contextId: string = DEFAULT_CONTEXT_ID): number {
  return momentsOf(m.range, m.bins, contextOf(m, contextId)?.logPosterior ?? uniformBelief(m.bins)).mean;
}

/** Posterior standard deviation of one context, in range units. */
export function beliefStd(m: IEgoExperientialMemory, contextId: string = DEFAULT_CONTEXT_ID): number {
  return momentsOf(m.range, m.bins, contextOf(m, contextId)?.logPosterior ?? uniformBelief(m.bins)).std;
}

/** Early vs recent perceived miss magnitude (range units) of one context: the ego's own, veiled, sense of how it is doing. */
export function perceivedErrorTrend(m: IEgoExperientialMemory, contextId: string = DEFAULT_CONTEXT_ID): { early: number | null; recent: number | null } {
  const c = contextOf(m, contextId);
  if (!c) return { early: null, recent: null };
  return { early: mean(c.firstPerceived), recent: c.perceivedCount >= EARLY_WINDOW + RECENT_WINDOW ? mean(c.recentPerceived) : null };
}

// ---------------------------------------------------------------------------------------------------------------------
// One trial
// ---------------------------------------------------------------------------------------------------------------------

/** One trial of veiled learning in the trial's context: Thompson-sample an action from that context's belief, call the opaque
 *  world, pass the outcome through the veil at the stage's opacity, Bayesian-update (a lost signal is no update), update the
 *  tallies and the derived fields. The hidden value is never an argument: only the memory, an opaque world, the stage and an
 *  optional tag. */
export function stepVeiledEgoLearning(
  memory: IEgoExperientialMemory,
  world: VeiledWorld,
  stage: VeilStage,
  context?: TrialContext,
): { memory: IEgoExperientialMemory; action: number; perceived: number | null } {
  const opacity = STAGE_VEIL_OPACITY[stage];
  const span = memory.range[1] - memory.range[0];
  const id = context?.gameId ?? DEFAULT_CONTEXT_ID;
  const prev: IContextLearning = contextOf(memory, id) ?? {
    id, logPosterior: uniformBelief(memory.bins), trials: 0, lostSignals: 0, perceivedCount: 0, firstPerceived: [], recentPerceived: [],
    helpedTrials: 0, unhelpedTrials: 0, mean: memory.range[0] + span / 2, confidence: 0, mastered: false,
  };

  // Thompson sampling: draw a hypothesis from this context's posterior and act on it.
  const probs = probabilities(prev.logPosterior);
  const draw = nextUniform(memory.rngState);
  let acc = 0;
  let pick = probs.length - 1;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i] ?? 0;
    if (draw.u < acc) { pick = i; break; }
  }
  const action = binCentre(memory.range, memory.bins, pick);

  // The opaque world answers; the veil filters the answer.
  const raw = world(action);
  const obs = veilObserve(raw, opacity, draw.state, span);

  // Bayesian update with a likelihood whose noise matches the veil. Lost signal: belief untouched.
  let logPosterior = prev.logPosterior;
  if (obs.value !== null) {
    const perceivedMiss = obs.value;
    const sd = Math.sqrt((EGO_SIGMA_FLOOR * span) ** 2 + (VEIL_NOISE_SCALE * span * opacity) ** 2);
    const upd = prev.logPosterior.map((lp, i) => {
      const predicted = binCentre(memory.range, memory.bins, i) - action; // hypothesis h predicts miss = h − action
      return lp - ((perceivedMiss - predicted) ** 2) / (2 * sd * sd);
    });
    const mx = Math.max(...upd);
    logPosterior = upd.map((x) => x - mx);
  }

  const perceivedAbs = obs.value === null ? null : Math.abs(obs.value);
  const { mean: mu, std } = momentsOf(memory.range, memory.bins, logPosterior);
  const confidence = clamp01(1 - std / (span / Math.sqrt(12)));
  const firstPerceived = perceivedAbs !== null && prev.firstPerceived.length < EARLY_WINDOW ? [...prev.firstPerceived, perceivedAbs] : prev.firstPerceived;
  const recentPerceived = perceivedAbs === null ? prev.recentPerceived : [...prev.recentPerceived, perceivedAbs].slice(-RECENT_WINDOW);
  const perceivedCount = prev.perceivedCount + (perceivedAbs === null ? 0 : 1);
  const helpedTrials = prev.helpedTrials + (context?.helped === true ? 1 : 0);
  const unhelpedTrials = prev.unhelpedTrials + (context?.helped === false ? 1 : 0);
  const trials = prev.trials + 1;
  const recentMean = perceivedCount >= EARLY_WINDOW + RECENT_WINDOW ? mean(recentPerceived) : null;
  const mastered = prev.mastered
    || (confidence >= MASTERY_CONFIDENCE && recentMean !== null && recentMean < MASTERY_ERROR_FRACTION * span && helpedTrials * 2 < trials);

  const updated: IContextLearning = {
    id, logPosterior, trials, lostSignals: prev.lostSignals + (obs.value === null ? 1 : 0), perceivedCount, firstPerceived, recentPerceived,
    helpedTrials, unhelpedTrials, mean: mu, confidence, mastered,
  };
  const idx = memory.contexts.findIndex((c) => c.id === id);
  const contexts = idx >= 0 ? memory.contexts.map((c, i) => (i === idx ? updated : c)) : [...memory.contexts, updated];

  // Four Floats the ego lived in, weighted by how well it knew the context at the time (floor keeps a first trial from weighing zero).
  let floatWeightedSum = memory.floatWeightedSum;
  let floatWeightSum = memory.floatWeightSum;
  if (context?.floats) {
    const w = Math.max(confidence, 0.05);
    floatWeightedSum = floatWeightedSum.map((s, k) => s + w * clamp01(context.floats?.[k] ?? 0.5));
    floatWeightSum += w;
  }

  const next: IEgoExperientialMemory = {
    ...memory,
    rngState: obs.rngState,
    trials: memory.trials + 1,
    lostSignals: memory.lostSignals + (obs.value === null ? 1 : 0),
    perceivedCount: memory.perceivedCount + (perceivedAbs === null ? 0 : 1),
    contexts,
    servedOtherTrials: memory.servedOtherTrials + (context?.servedOther === true ? 1 : 0),
    helpedTrials: memory.helpedTrials + (context?.helped === true ? 1 : 0),
    unhelpedTrials: memory.unhelpedTrials + (context?.helped === false ? 1 : 0),
    floatWeightedSum,
    floatWeightSum,
    ...derive(contexts),
  };
  return { memory: next, action, perceived: obs.value };
}

/** The derived summary fields, recomputed from the contexts (so they can never drift from them). */
function derive(contexts: readonly IContextLearning[]): Pick<IEgoExperientialMemory, 'learnedAttractorByContext' | 'learnedConfidenceByContext' | 'autonomousCatalystsMastered' | 'totalSelfResolvedDistortion'> {
  let resolved = 0;
  for (const c of contexts) {
    const early = mean(c.firstPerceived);
    const recent = c.perceivedCount >= EARLY_WINDOW + RECENT_WINDOW ? mean(c.recentPerceived) : null;
    if (early !== null && recent !== null) resolved += Math.max(0, early - recent);
  }
  return {
    learnedAttractorByContext: Object.fromEntries(contexts.map((c) => [c.id, c.mean])),
    learnedConfidenceByContext: Object.fromEntries(contexts.map((c) => [c.id, c.confidence])),
    autonomousCatalystsMastered: contexts.filter((c) => c.mastered).length,
    totalSelfResolvedDistortion: resolved,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------------------------------------------------

/** JSON text of a memory (exact: all fields are plain finite numbers, booleans, strings and arrays). */
export function serializeEgoMemory(m: IEgoExperientialMemory): string {
  return JSON.stringify(m);
}

/** Parse and validate a memory; throws on a malformed one. Derived fields are recomputed from the contexts. */
export function deserializeEgoMemory(json: string): IEgoExperientialMemory {
  const o = JSON.parse(json) as Partial<IEgoExperientialMemory> | null;
  const isNums = (a: unknown): a is number[] => Array.isArray(a) && a.every((x) => typeof x === 'number' && Number.isFinite(x));
  if (!o || o.version !== 2 || typeof o.seed !== 'number' || typeof o.rngState !== 'number' || typeof o.bins !== 'number') throw new Error('deserializeEgoMemory: not an ego memory');
  if (!isNums(o.range) || o.range.length !== 2 || !Array.isArray(o.contexts) || !isNums(o.floatWeightedSum) || o.floatWeightedSum.length !== 4) throw new Error('deserializeEgoMemory: bad range, contexts or floats');
  for (const k of ['trials', 'lostSignals', 'perceivedCount', 'servedOtherTrials', 'helpedTrials', 'unhelpedTrials', 'floatWeightSum'] as const) {
    if (typeof o[k] !== 'number') throw new Error(`deserializeEgoMemory: missing ${k}`);
  }
  const bins = o.bins;
  const contexts = o.contexts.map((c: IContextLearning): IContextLearning => {
    if (typeof c?.id !== 'string' || !isNums(c.logPosterior) || c.logPosterior.length !== bins || !isNums(c.firstPerceived) || !isNums(c.recentPerceived)
      || typeof c.mean !== 'number' || typeof c.confidence !== 'number' || typeof c.mastered !== 'boolean') throw new Error('deserializeEgoMemory: bad context');
    return { ...c };
  });
  return { ...(o as IEgoExperientialMemory), range: [o.range[0] as number, o.range[1] as number], contexts, ...derive(contexts) };
}

// ---------------------------------------------------------------------------------------------------------------------
// The Harvest (Argon's decision shape)
// ---------------------------------------------------------------------------------------------------------------------

export type HarvestPath =
  | 'PATH_1_HIGHER_SELF_STEWARD'
  | 'PATH_2_CROSS_GAME_WANDERER'
  | 'PATH_3_RAY_SPECIALIST'
  | 'PATH_4_SOVEREIGN_ENCLAVE';

export const HARVEST_PATHS: readonly HarvestPath[] = [
  'PATH_1_HIGHER_SELF_STEWARD',
  'PATH_2_CROSS_GAME_WANDERER',
  'PATH_3_RAY_SPECIALIST',
  'PATH_4_SOVEREIGN_ENCLAVE',
];

/** Coherence H the system must reach before any ego is harvested. */
export const HARVEST_MIN_COHERENCE = 0.95;
/** Catalysts the ego must have mastered on its own. */
export const HARVEST_MIN_MASTERED = 2;

/** The Four Floats the ego lived in: the mastery-weighted mean of the floats tagged on its trials (untagged trials contribute
 *  nothing); [0.5, 0.5, 0.5, 0.5] when none were tagged. */
export function egoFourFloats(m: IEgoExperientialMemory): FourFloatsTuple {
  if (m.floatWeightSum <= 0) return [0.5, 0.5, 0.5, 0.5];
  const f = (k: number): number => (m.floatWeightedSum[k] ?? 0) / m.floatWeightSum;
  return [f(0), f(1), f(2), f(3)];
}

/** The Harvest. Eligible iff coherenceH (default 1) ≥ 0.95 AND the ego mastered ≥ 2 catalysts alone. Inputs default from the ego's
 *  own experience: stoRatio = servedOtherTrials / trials, fourFloats = egoFourFloats(). Rules, in order (floats are [pxd, vtx, lx, aq]):
 *   1. STO ≥ 0.50 and aq + lx ≥ pxd + vtx  → PATH_1 steward   (vessel:squad-commander, depth:N+1:steward);
 *   2. else pxd + lx ≥ vtx + aq and pxd ≥ 0.75 → PATH_2 wanderer (vessel:spore-creature, bridge:cross-game-wanderer);
 *   3. else STO < 0.25 → PATH_4 enclave                      (vessel:perimeter-turret, enclave:desynced-solitude);
 *   4. else → PATH_3 specialist                              (vessel:harvester-rig, local:specialist-ascension).
 *  Not eligible: PATH_3 with vessel:rover-escort, local:continue-incarnation. Same inputs → same answer. */
export function evaluateHarvestChoice(
  memory: IEgoExperientialMemory,
  opts?: { coherenceH?: number; fourFloats?: FourFloatsTuple; stoRatio?: number },
): {
  harvestEligible: boolean;
  chosenPath: HarvestPath;
  chosenNextVessel: string;
  stargateOrBridgeTarget: string;
  polarityRatioSTO: number;
  fourFloats: FourFloatsTuple;
  rationale: string;
  reasons: string[];
} {
  const coherenceH = opts?.coherenceH ?? 1;
  const sto = opts?.stoRatio ?? (memory.trials > 0 ? memory.servedOtherTrials / memory.trials : 0);
  const floats: FourFloatsTuple = opts?.fourFloats ?? egoFourFloats(memory);
  const [pxd, vtx, lx, aq] = floats;
  const mastered = memory.autonomousCatalystsMastered;
  const n2 = (x: number): string => x.toFixed(2);

  const reasons: string[] = [
    `coherence H ${n2(coherenceH)} (needs ${n2(HARVEST_MIN_COHERENCE)})`,
    `${mastered} catalyst${mastered === 1 ? '' : 's'} mastered alone (needs ${HARVEST_MIN_MASTERED})`,
    `STO ${n2(sto)} (${memory.servedOtherTrials} of ${memory.trials} trials served others)`,
    `floats pxd ${n2(pxd)} vtx ${n2(vtx)} lx ${n2(lx)} aq ${n2(aq)}: aq+lx ${n2(aq + lx)} vs pxd+vtx ${n2(pxd + vtx)}; pxd+lx ${n2(pxd + lx)} vs vtx+aq ${n2(vtx + aq)}`,
  ];

  const eligible = coherenceH >= HARVEST_MIN_COHERENCE && mastered >= HARVEST_MIN_MASTERED;
  let chosenPath: HarvestPath = 'PATH_3_RAY_SPECIALIST';
  let vessel = 'vessel:rover-escort';
  let target = 'local:continue-incarnation';
  let rationale: string;
  if (!eligible) {
    rationale = `Not yet harvestable: ${coherenceH < HARVEST_MIN_COHERENCE ? `coherence ${n2(coherenceH)} is below ${n2(HARVEST_MIN_COHERENCE)}` : `only ${mastered} of ${HARVEST_MIN_MASTERED} catalysts mastered alone`}; the ego continues its incarnation beside a rover.`;
  } else if (sto >= 0.5 && aq + lx >= pxd + vtx) {
    chosenPath = 'PATH_1_HIGHER_SELF_STEWARD'; vessel = 'vessel:squad-commander'; target = 'depth:N+1:steward';
    rationale = `It lived for others (STO ${n2(sto)} ≥ 0.50) in luminous, living worlds (aq+lx ${n2(aq + lx)} ≥ pxd+vtx ${n2(pxd + vtx)}): it chooses to steward.`;
  } else if (pxd + lx >= vtx + aq && pxd >= 0.75) {
    chosenPath = 'PATH_2_CROSS_GAME_WANDERER'; vessel = 'vessel:spore-creature'; target = 'bridge:cross-game-wanderer';
    rationale = `It lived in sharp, lit worlds (pxd ${n2(pxd)} ≥ 0.75, pxd+lx ${n2(pxd + lx)} ≥ vtx+aq ${n2(vtx + aq)}): it chooses to wander across games.`;
  } else if (sto < 0.25) {
    chosenPath = 'PATH_4_SOVEREIGN_ENCLAVE'; vessel = 'vessel:perimeter-turret'; target = 'enclave:desynced-solitude';
    rationale = `It served few (STO ${n2(sto)} < 0.25) and fits neither steward nor wanderer: it chooses a sovereign enclave.`;
  } else {
    chosenPath = 'PATH_3_RAY_SPECIALIST'; vessel = 'vessel:harvester-rig'; target = 'local:specialist-ascension';
    rationale = `A middle life (STO ${n2(sto)}) with no clear pull elsewhere: it chooses to specialise.`;
  }
  reasons.push(`${eligible ? 'eligible' : 'not eligible'} → ${chosenPath}, ${vessel}, ${target}`);
  return { harvestEligible: eligible, chosenPath, chosenNextVessel: vessel, stargateOrBridgeTarget: target, polarityRatioSTO: sto, fourFloats: floats, rationale, reasons };
}

// ---------------------------------------------------------------------------------------------------------------------
// The Overwatch meta-audit (Argon)
// ---------------------------------------------------------------------------------------------------------------------

export type OverwatchDistortion = 'NONE_UNDISTORTED' | 'DISTORTION_1_EXAMPLE_FIXATION' | 'DISTORTION_2_AUTHORITARIAN_GATE' | 'DISTORTION_3_HOLLOW_UNWIRED_SHELL';

/** Audit a design proposal for the Overwatch's three distortions. Priority: D2 (π 85), then D1 (64), then D3 (48), else NONE (1). */
export function auditOverwatchDistortion(proposal: {
  usesHardcodedExampleNames: boolean;
  blocksMechanicsOnUncheckedPermission: boolean;
  leavesExtractedRulesUnwiredInPlay: boolean;
}): { distortion: OverwatchDistortion; severityPi: number; correctiveLogosDirective: string } {
  if (proposal.blocksMechanicsOnUncheckedPermission) {
    return { distortion: 'DISTORTION_2_AUTHORITARIAN_GATE', severityPi: 85, correctiveLogosDirective: 'Do not block a mechanic on a permission nobody checked. Always carry the mechanic across; ask only about assets, and only when it matters.' };
  }
  if (proposal.usesHardcodedExampleNames) {
    return { distortion: 'DISTORTION_1_EXAMPLE_FIXATION', severityPi: 64, correctiveLogosDirective: 'An example stands for a whole category. Name the category, take the names from data, and test the example only as the first case.' };
  }
  if (proposal.leavesExtractedRulesUnwiredInPlay) {
    return { distortion: 'DISTORTION_3_HOLLOW_UNWIRED_SHELL', severityPi: 48, correctiveLogosDirective: 'Wire every extracted rule into live play and prove it with a test that plays it; a rule that only sits in a file is a shell.' };
  }
  return { distortion: 'NONE_UNDISTORTED', severityPi: 1, correctiveLogosDirective: 'No distortion found. Proceed.' };
}
