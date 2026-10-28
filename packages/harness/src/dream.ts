/**
 * Plan 56 W3: the dream. The offline phase where a rung (the ego) and the presets under it rebalance (owner, 28 Oct:
 * "'dreaming' is important, its how the higherself helps aswell").
 *
 * 1. Select: recent excited episodes and the deepest unbalanced distortions (Law of One 86.7), within a budget.
 * 2. The Higher Self cues: a cue only biases what is replayed (targeted reactivation, research §8). With no cues given,
 *    the built-in cue takes the lowest charged ray first (15.12); an empty list is a Higher Self that cues nothing.
 * 3. Replay: what each replayed episode taught moves the ego's preference for that preset (good outcomes up).
 * 4. Rebalance: recalling a cued episode opens it (its hardness halved for the dream). A preset open enough takes the
 *    antidote: its charge on that ray falls toward rest, never past it (balance, not removal: 5.2, 18.5), and the episode
 *    keeps its content but sets softer. An `imagine` rollout, when given, must show a lower error, or the repair is undone.
 *    A preset not open enough refuses: its own state decides (they choose).
 * 5. Close (before downscale, so passive decay is never taken for a lesson; Argon, 28 Oct): a cause link closes when
 *    this dream's repair brought its ray to rest. The higher rung learns too: its own lean on that thinking eases.
 * 6. Downscale: every memory softens a little and the hardest least (synaptic homeostasis): noise fades, the strongest
 *    stand. A hardened distortion is among the strongest, which is why the cue matters.
 * 7. Wake: a digest of what was replayed, what balanced, what was refused and what is still open.
 *
 * Pure and deterministic: the same inputs give the same dream. Charge, hardness and preference are per-preset state, never
 * a fifth global metric.
 */
import { checkMem, type Episode, type Mem, type SqId, type SqOrAligned, ALIGNED } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { BALANCED_AT, dominantDistortion, episodeWeight, memoryBalance } from './preset-memory.js';
import { partnersOf, type Dyad } from './polarity.js';

/** Episodes one dream replays at most (the min-spec laptop's budget per checkpoint). */
export const DREAM_BUDGET = 12;
/** The charge one fully open, fully excited replay of an antidote takes off a ray (of 127). */
export const ANTIDOTE_GAIN = 48;
/** Below this openness a preset does not take the repair. */
export const OPEN_MIN = 0.15;
/** A ray at or under this charge is at rest: its cause links may close. */
export const REST_AT = 4;
/** How far one dream softens a memory of middling hardness (hard −= rate · hard · (1 − hard)). */
export const DOWNSCALE = 0.05;
/** The strongest episodes of each preset that the downscale spares. */
export const DOWNSCALE_SPARE = 4;
/** How much the higher rung's own lean on a thinking type eases when a link it caused closes. */
export const TEACH_GAIN = 16;
/** How far one replay moves the ego's preference for a preset (of ±127). */
export const REPLAY_GAIN = 12;

/** What the ego has learned to prefer among its presets, by preset (`of`): −127..127. */
export interface EgoWeights {
  readonly prefer: Readonly<Record<string, number>>;
}

/** A Higher Self's cue: an episode by its preset and tick. */
export interface DreamCue {
  readonly of: string;
  readonly t: number;
}

export interface DreamInput {
  /** The dreaming rung's own memory: its thinking caused what the presets carry, and it learns from closing it. */
  readonly ego: Mem;
  /** The presets under it, each with its memory. */
  readonly presets: readonly Mem[];
  readonly weights: EgoWeights;
  /** The game tick the dream runs at (recency is counted from it). */
  readonly now: number;
  /** The Higher Self's cues. Omitted: the built-in cue (lowest charged ray first). Empty: no cue at all. */
  readonly cues?: readonly DreamCue[];
  /** Episodes replayed at most (1..32). */
  readonly budget?: number;
  /** An imagined episode after a repair: the error the preset would make now (0..1), from its own model. Must be pure. */
  readonly imagine?: (mem: Mem, episode: Episode) => number;
  /**
   * Plan 56 §12: the dyads among these presets. A distorted preset whose partner (of the other pole) is balanced dreams as
   * if cued: the partner lends its cue, whatever the Higher Self gives. Only a balanced partner lends (Law of One 22.26).
   */
  readonly dyads?: readonly Dyad[];
}

export interface DreamDigest {
  readonly replayed: readonly { readonly of: string; readonly t: number; readonly cat: string; readonly d: SqOrAligned; readonly cued: boolean; readonly partner?: string }[];
  /** Repairs that took: the charge on that ray fell. */
  readonly balanced: readonly { readonly of: string; readonly d: SqId; readonly antidote: string; readonly charge: number }[];
  /** Repairs offered that the preset did not take, or that the imagined episode did not confirm. */
  readonly refused: readonly { readonly of: string; readonly d: SqId; readonly why: 'not open' | 'not confirmed' }[];
  /** Cause links this dream closed. */
  readonly closed: readonly { readonly of: string; readonly by: SqOrAligned; readonly d: SqId }[];
  /** Presets still thinking distorted after the dream. */
  readonly open: readonly { readonly of: string; readonly d: SqId }[];
}

export interface DreamResult {
  readonly ego: Mem;
  readonly presets: readonly Mem[];
  readonly weights: EgoWeights;
  readonly digest: DreamDigest;
}

const rayOf = (d: SqId): number => SQ_DISTORTION_CATALOG[d].rayIndex - 1;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const clampI8 = (x: number): number => Math.max(-127, Math.min(127, Math.round(x)));
const keyOf = (of: string, t: number): string => `${of}@${t}`;

/** Plan 56 §15: how much easier each earlier rising makes a wanderer's repair, counted up to WANDERER_EASE_MAX risings. */
export const WANDERER_EASE = 0.25;
export const WANDERER_EASE_MAX = 4;

/**
 * How open a preset is to a repair: soft memories and invested ones take it; a hardened, uninvested one, uncued, refuses.
 * A wanderer who has risen before finds it easier, but not automatic: it still needs the dream and the cue (Law of One 75.24).
 */
export function dreamOpenness(mem: Mem, cued: boolean): number {
  const hard = cued ? mem.hard / 2 : mem.hard;
  const ease = mem.wan ? 1 + WANDERER_EASE * Math.min(mem.wan.done, WANDERER_EASE_MAX) : 1;
  return clamp01((1 - hard) * (0.5 + mem.inv / 2) * ease);
}

/** An episode this dream may replay: preset `p`, its episode `i`. */
interface Candidate { readonly p: number; readonly i: number; readonly t: number; readonly score: number; readonly cued: boolean; readonly partner?: string }
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
/** A preset's memory as the dream works on it (copies: the input is never changed). */
interface Working { readonly of: string; readonly hard: number; readonly inv: number; charge: number[]; ep: Mutable<Episode>[]; cause: Mutable<Mem['cause'][number]>[]; readonly src: Mem }

/** Step 1 and 2: the episodes this dream replays, cued ones first, then by excitement, recency and the depth of their ray's charge. */
function selectEpisodes(input: DreamInput, budget: number): Candidate[] {
  const explicit = input.cues !== undefined;
  const cueSet = new Set((input.cues ?? []).map((c) => keyOf(c.of, c.t)));
  // the built-in cue: the lowest ray that is charged anywhere, its deepest episodes
  let lowest = -1;
  if (!explicit) {
    for (let r = 0; r < 7 && lowest < 0; r++) if (input.presets.some((m) => (m.charge[r] ?? 0) > REST_AT)) lowest = r;
  }
  // a balanced partner of the other pole lends its cue (Plan 56 §12): the first balanced one, by partner order
  const partners = partnersOf(input.dyads ?? []);
  const byOf = new Map(input.presets.map((m) => [m.of, m] as const));
  const lender = (of: string): string | undefined => (partners.get(of) ?? []).find((q) => (byOf.get(q)?.bal ?? 0) >= BALANCED_AT);
  const all: Candidate[] = [];
  input.presets.forEach((m, p) => {
    const partner = lender(m.of);
    m.ep.forEach((e, i) => {
      const depth = e.d !== ALIGNED ? Math.max(0, m.charge[rayOf(e.d)] ?? 0) / 127 : 0;
      const recency = 1 / (1 + Math.max(0, input.now - e.t) / 600);
      const selfCued = explicit ? cueSet.has(keyOf(m.of, e.t)) : (e.d !== ALIGNED && lowest >= 0 && rayOf(e.d) === lowest && depth > 0);
      const lent = !selfCued && partner !== undefined && depth > 0;
      const cued = selfCued || lent;
      all.push({ p, i, t: e.t, cued, ...(lent ? { partner } : {}), score: (cued ? 2 : 0) + depth + episodeWeight(e) * recency });
    });
  });
  all.sort((a, b) => b.score - a.score || a.p - b.p || a.t - b.t || a.i - b.i);
  return all.slice(0, budget);
}

/** One dream over a rung and the presets under it. Throws on invalid input (unknown cue presets are ignored). */
export function dream(input: DreamInput): DreamResult {
  const budget = Math.max(1, Math.min(32, Math.round(input.budget ?? DREAM_BUDGET)));
  if (!Number.isSafeInteger(input.now) || input.now < 0) throw new Error('now must be a whole tick');
  const ofs = new Set<string>();
  for (const m of input.presets) {
    if (ofs.has(m.of)) throw new Error(`preset ${m.of} appears twice`);
    ofs.add(m.of);
  }

  const chosen = selectEpisodes(input, budget);
  const presets: Working[] = input.presets.map((m) => ({ of: m.of, hard: m.hard, inv: m.inv, charge: [...m.charge], ep: m.ep.map((e) => ({ ...e })), cause: m.cause.map((c) => ({ ...c })), src: m }));
  const memOf = (w: Working): Mem => checkMem({ ...w.src, charge: w.charge, ep: w.ep, cause: w.cause, bal: memoryBalance(w.charge) });
  const prefer: Record<string, number> = { ...input.weights.prefer };
  const egoCharge = [...input.ego.charge];
  const replayed: DreamDigest['replayed'][number][] = [];
  const balanced: DreamDigest['balanced'][number][] = [];
  const refused: DreamDigest['refused'][number][] = [];
  const closed: DreamDigest['closed'][number][] = [];
  /** How much this dream's repairs took off each preset's rays (for closing links, before any downscale). */
  const repaired = presets.map(() => [0, 0, 0, 0, 0, 0, 0]);

  for (const c of chosen) {
    const m = presets[c.p]!;
    const e = m.ep[c.i]!;
    replayed.push({ of: m.of, t: e.t, cat: e.cat, d: e.d, cued: c.cued, ...(c.partner !== undefined ? { partner: c.partner } : {}) });
    // 3. replay: what the episode taught moves the ego's preference for this preset
    prefer[m.of] = clampI8((prefer[m.of] ?? 0) + REPLAY_GAIN * episodeWeight(e) * (1 - 2 * e.err));
    // 4. rebalance: only distorted episodes whose ray is still charged
    if (e.d === ALIGNED) continue;
    const ray = rayOf(e.d);
    const before = m.charge[ray] ?? 0;
    if (before <= 0) continue;
    const open = dreamOpenness(memOf(m), c.cued);
    if (open < OPEN_MIN) { refused.push({ of: m.of, d: e.d, why: 'not open' }); continue; }
    const take = Math.min(before, Math.max(1, Math.round(ANTIDOTE_GAIN * open * Math.max(0.25, episodeWeight(e)))));
    const prevH = e.h;
    m.charge[ray] = before - take;
    // the episode keeps what happened and sets softer (content kept, charge lost)
    e.h = Math.round(e.h * (1 - open / 2) * 1000) / 1000;
    if (input.imagine) {
      const err = clamp01(input.imagine(memOf(m), { ...e }));
      if (!(err < e.err)) {
        m.charge[ray] = before;
        e.h = prevH;
        refused.push({ of: m.of, d: e.d, why: 'not confirmed' });
        continue;
      }
    }
    const row = repaired[c.p]!;
    row[ray] = (row[ray] ?? 0) + take;
    balanced.push({ of: m.of, d: e.d, antidote: SQ_DISTORTION_CATALOG[e.d].antidoteName, charge: m.charge[ray]! });
  }

  // 5. close, before downscale: a link closes when this dream's repair brought its ray to rest; the higher rung learns
  presets.forEach((m, i) => {
    for (const link of m.cause) {
      if (!link.open) continue;
      const ray = rayOf(link.d);
      if ((repaired[i]![ray] ?? 0) <= 0 || (m.charge[ray] ?? 0) > REST_AT) continue;
      link.open = false;
      closed.push({ of: m.of, by: link.by, d: link.d });
      if (link.by !== ALIGNED) {
        const r = rayOf(link.by);
        egoCharge[r] = Math.max(0, (egoCharge[r] ?? 0) - TEACH_GAIN);
      }
    }
  });

  // 6. downscale: every memory softens a little, the hardest least; each preset's strongest episodes are spared
  const soften = (h: number): number => h - DOWNSCALE * h * (1 - h);
  const out = presets.map((m) => {
    const order = m.ep.map((e, i) => [i, e.h] as const).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const spared = new Set(order.slice(0, DOWNSCALE_SPARE).map(([i]) => i));
    const ep = m.ep.map((e, i) => (spared.has(i) ? e : { ...e, h: Math.max(0, e.h * (1 - DOWNSCALE)) }));
    return checkMem({ ...m.src, charge: m.charge, cause: m.cause, ep, hard: soften(m.hard), bal: memoryBalance(m.charge) });
  });
  const ego = checkMem({ ...input.ego, charge: egoCharge, bal: memoryBalance(egoCharge), hard: soften(input.ego.hard) });

  // 7. wake
  const open: DreamDigest['open'][number][] = [];
  for (const m of out) {
    const d = dominantDistortion(m);
    if (d !== ALIGNED) open.push({ of: m.of, d });
  }
  return { ego, presets: out, weights: { prefer }, digest: { replayed, balanced, refused, closed, open } };
}

/**
 * The drone's own words on waking (Plan 56 §5, Argon's voice): first person, in its body's telemetry, never the numbers.
 * One line from the digest; the Higher Self's reading is the outside AI's to give.
 */
export function wakeLine(digest: DreamDigest): string {
  const b = digest.balanced[0];
  const r = digest.refused[0];
  if (digest.replayed.length === 0) return 'I slept without dreaming.';
  if (b) {
    const settled = digest.closed.length > 0 ? 'and woke lighter, like my gyros forgot what they were bracing against' : 'and some of the weight bled out of my pods';
    return `I dreamed the ${digest.replayed[0]!.cat.toLowerCase().replace(/_/g, ' ')} again. ${b.antidote} came back, ${settled}.`;
  }
  if (r) return `I dreamed the ${digest.replayed[0]!.cat.toLowerCase().replace(/_/g, ' ')} again and held on to it. It is still in me.`;
  return `I dreamed the ${digest.replayed[0]!.cat.toLowerCase().replace(/_/g, ' ')} again, and it was quiet.`;
}

/**
 * The six steps (owner, 28 Oct, the 3/6/9 frame: "Observe, Orient, Design, Act, Verify, Refine"; Boyd's OODA loop with
 * Shewhart and Deming's check and act, research §11): where each already runs in the ladder, at every rung.
 */
export const LOOP_STEPS = [
  { step: 'observe', runs: 'recordExperience: a catalyst becomes an episode (W2)' },
  { step: 'orient', runs: 'the cause links and predictDistortion: which thinking above left what here (W2)' },
  { step: 'design', runs: 'dream, select and cue: what to replay, by the Higher Self\'s cue, the built-in one or a partner\'s (W3)' },
  { step: 'act', runs: 'dream, rebalance: the antidote on the charged ray (W3)' },
  { step: 'verify', runs: 'dream: the imagined rerun and the balance check (W3)' },
  { step: 'refine', runs: 'dream, close, teach and downscale; then graduate or repeat (W3, W5)' },
] as const;
