/**
 * Plan 56 W4: taking Overwatch means inheriting the whole system (owner, 28 Oct: "when an ai takes overwatch the ai must
 * have gain the memories and experienced of the entire system, the actual data stored in the presets but behaviour has
 * been learned with weights").
 *
 * - Data is copied exactly: every preset's memory (the shorthand's Mem), every ego's own memory and weights.
 * - Behaviour is inherited by distillation: the Overwatch's preferences are distilled from every ego's (policy
 *   distillation merges many policies into one, research §4). Dyads stay whole: partners share one distilled preference.
 * - It pools when aligned: above Plan 52's coherence threshold the cause links merge into one graph (a social memory
 *   complex forms from a shared orientation, Law of One 11.17); below it each ego's part stands apart. Nothing is lost
 *   either way.
 * - A digest is its readable view: an outside AI in the seat explains an agent best from a structure like this, not from
 *   raw weights (research §5).
 *
 * Pure and deterministic. `hm2:system-memory:v1` is its JSON form.
 */
import { canonicalJson } from '@hm/gamepreset';
import { ALIGNED, checkMem, type Mem, type SqId, type SqOrAligned } from '@hm/shorthand';
import type { EgoWeights } from './dream.js';
import { dominantDistortion, episodeWeight } from './preset-memory.js';
import { HARVEST_MIN_COHERENCE } from './veil-learning-harvest.js';
import { BALANCED_AT } from './preset-memory.js';
import { findDyads, poleOf, polarityOf, triadsOf, type Dyad, type Pole, type Triad } from './polarity.js';

export const SYSTEM_MEMORY_SCHEMA = 'hm2:system-memory:v1';
/** The pack pools into one graph at or above this coherence (Plan 52's Harvest threshold). */
export const POOL_AT = HARVEST_MIN_COHERENCE;
/** Whoever takes the seat: the observer of the triads among egos (one rung up from the egos'). */
export const OVERWATCH_SEAT = 'overwatch';

/** A triad at its rung: among presets (an ego observes it) or among egos (the Overwatch seat observes it). */
export type LeveledTriad = Triad & { readonly level: 'preset' | 'ego' };

/**
 * The 9 (owner, 28 Oct: "Macro, Micro, and Nano alignment"): the three forces aligned at three scales.
 * - nano: every preset balanced;
 * - micro: every ego balanced, and every triad it observes whole;
 * - macro: the system pooled, and every triad among its egos whole.
 */
export interface Alignment {
  readonly nano: { readonly aligned: boolean; readonly balanced: number; readonly of: number };
  readonly micro: { readonly aligned: boolean; readonly balanced: number; readonly of: number };
  readonly macro: { readonly aligned: boolean; readonly coherence: number };
  readonly complete: boolean;
}

/** One ego as the system holds it: its own memory, the presets it uses, what it has learned to prefer. */
export interface SystemEgo {
  readonly ego: Mem;
  readonly presets: readonly string[];
  readonly weights: EgoWeights;
}

export interface SystemDigest {
  readonly coherence: number;
  readonly pooled: boolean;
  readonly egos: readonly { readonly of: string; readonly thinking: SqOrAligned; readonly pole: Pole; readonly leanings: readonly { readonly of: string; readonly prefer: number }[] }[];
  /** The system's hardest-set episodes (its most formative memories). */
  readonly hardened: readonly { readonly of: string; readonly t: number; readonly cat: string; readonly d: SqOrAligned; readonly h: number }[];
  /** Presets still thinking distorted, with the thinking above that most caused it. */
  readonly open: readonly { readonly of: string; readonly d: SqId; readonly cause: SqOrAligned; readonly pole: Pole }[];
  readonly dyads: readonly { readonly a: string; readonly b: string; readonly whole: boolean }[];
  readonly triads: readonly LeveledTriad[];
  readonly alignment: Alignment;
}

export interface SystemMemoryPack {
  readonly schema: typeof SYSTEM_MEMORY_SCHEMA;
  /** Every preset's data and memory, exactly. */
  readonly presets: readonly Mem[];
  readonly egos: readonly SystemEgo[];
  /** Mean balance over every memory in the system. */
  readonly coherence: number;
  readonly pooled: boolean;
  /** The merged cause graph, only when pooled. */
  readonly pool: { readonly cause: readonly { readonly by: SqOrAligned; readonly d: SqId; readonly n: number; readonly open: boolean }[] } | null;
  /** The Overwatch's own preferences, distilled from every ego (dyads share one). */
  readonly distilled: EgoWeights;
  readonly dyads: readonly Dyad[];
  /** The nested triads: each pair with the rung that observes it, among presets and among egos. */
  readonly triads: readonly LeveledTriad[];
  readonly alignment: Alignment;
  readonly digest: SystemDigest;
}

const clampI8 = (x: number): number => Math.max(-127, Math.min(127, Math.round(x)));
const byOf = (a: { of: string }, b: { of: string }): number => (a.of < b.of ? -1 : a.of > b.of ? 1 : 0);

/** The Overwatch's preferences: each preset's mean over the egos that use it; dyad partners then share their mean. */
export function distillWeights(egos: readonly SystemEgo[], dyads: readonly Dyad[]): EgoWeights {
  const sum = new Map<string, { s: number; n: number }>();
  for (const e of egos) {
    for (const of of e.presets) {
      const cur = sum.get(of) ?? { s: 0, n: 0 };
      sum.set(of, { s: cur.s + (e.weights.prefer[of] ?? 0), n: cur.n + 1 });
    }
  }
  const prefer: Record<string, number> = {};
  for (const of of [...sum.keys()].sort()) { const v = sum.get(of)!; prefer[of] = clampI8(v.s / v.n); }
  // a dyad is inherited whole: both partners or neither, so they share one preference
  for (const d of dyads) {
    if (prefer[d.a] === undefined || prefer[d.b] === undefined) continue;
    const mean = clampI8((prefer[d.a]! + prefer[d.b]!) / 2);
    prefer[d.a] = mean;
    prefer[d.b] = mean;
  }
  return { prefer };
}

/** The whole system as one pack for whoever takes the Overwatch seat. Throws on a preset that appears twice or an ego that names an unknown preset. */
export function compileSystemMemory(presets: readonly Mem[], egos: readonly SystemEgo[]): SystemMemoryPack {
  const known = new Set<string>();
  const copies = presets.map((m) => {
    if (known.has(m.of)) throw new Error(`preset ${m.of} appears twice`);
    known.add(m.of);
    return checkMem(m);
  }).sort(byOf);
  const egoCopies = egos.map((e) => {
    for (const of of e.presets) if (!known.has(of)) throw new Error(`ego ${e.ego.of} uses ${of}, which is not in the system`);
    for (const [of, v] of Object.entries(e.weights.prefer)) {
      if (!Number.isInteger(v) || v < -127 || v > 127) throw new Error(`ego ${e.ego.of}: its preference for ${of} is not a whole number in -127..127`);
    }
    return { ego: checkMem(e.ego), presets: [...e.presets].sort(), weights: { prefer: { ...e.weights.prefer } } };
  }).sort((a, b) => byOf(a.ego, b.ego));

  const all = [...copies, ...egoCopies.map((e) => e.ego)];
  const coherence = all.length ? Math.round((all.reduce((s, m) => s + m.bal, 0) / all.length) * 1000) / 1000 : 1;
  const pooled = coherence >= POOL_AT;
  const dyads = findDyads(copies);

  let pool: SystemMemoryPack['pool'] = null;
  if (pooled) {
    const merged = new Map<string, { by: SqOrAligned; d: SqId; n: number; open: boolean }>();
    for (const m of all) {
      for (const c of m.cause) {
        const k = `${c.by}>${c.d}`;
        const cur = merged.get(k);
        merged.set(k, cur ? { ...cur, n: Math.min(65535, cur.n + c.n), open: cur.open || c.open } : { by: c.by, d: c.d, n: c.n, open: c.open });
      }
    }
    pool = { cause: [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v) };
  }
  const distilled = distillWeights(egoCopies, dyads);

  // the nested triads: pairs of presets observed by the egos that use both; pairs of egos observed by the Overwatch seat
  const polOf = new Map(all.map((m) => [m.of, polarityOf(m)] as const));
  const pol = (of: string): number => polOf.get(of) ?? 0;
  const egoMems = egoCopies.map((e) => e.ego);
  const triads: LeveledTriad[] = [
    ...triadsOf(dyads, egoCopies.map((e) => ({ of: e.ego.of, members: e.presets })), pol).map((t) => ({ ...t, level: 'preset' as const })),
    ...triadsOf(findDyads(egoMems), [{ of: OVERWATCH_SEAT, members: egoMems.map((m) => m.of) }], pol).map((t) => ({ ...t, level: 'ego' as const })),
  ];
  // the 9: the three forces aligned at three scales
  const nanoBalanced = copies.filter((m) => m.bal >= BALANCED_AT).length;
  const microBalanced = egoCopies.filter((e) => e.ego.bal >= BALANCED_AT && triads.every((t) => t.observer !== e.ego.of || t.whole)).length;
  const nano = { aligned: nanoBalanced === copies.length, balanced: nanoBalanced, of: copies.length };
  const micro = { aligned: microBalanced === egoCopies.length, balanced: microBalanced, of: egoCopies.length };
  const macro = { aligned: pooled && triads.every((t) => t.level !== 'ego' || t.whole), coherence };
  const alignment: Alignment = { nano, micro, macro, complete: nano.aligned && micro.aligned && macro.aligned };

  const hardened = copies.flatMap((m) => m.ep.map((e) => ({ of: m.of, t: e.t, cat: e.cat, d: e.d, h: episodeWeight(e) })))
    .sort((a, b) => b.h - a.h || byOf(a, b) || a.t - b.t).slice(0, 8);
  const open: SystemDigest['open'][number][] = [];
  for (const m of copies) {
    const d = dominantDistortion(m);
    if (d === ALIGNED) continue;
    const links = m.cause.filter((c) => c.d === d && c.open).sort((a, b) => b.n - a.n);
    open.push({ of: m.of, d, cause: links[0]?.by ?? ALIGNED, pole: poleOf(polarityOf(m)) });
  }
  const digest: SystemDigest = {
    coherence,
    pooled,
    egos: egoCopies.map((e) => ({
      of: e.ego.of,
      thinking: dominantDistortion(e.ego),
      pole: poleOf(polarityOf(e.ego)),
      leanings: e.presets.map((of) => ({ of, prefer: e.weights.prefer[of] ?? 0 })).sort((a, b) => b.prefer - a.prefer || byOf(a, b)).slice(0, 3),
    })),
    hardened,
    open,
    dyads: dyads.map((d) => ({ a: d.a, b: d.b, whole: d.whole })),
    triads,
    alignment,
  };
  return { schema: SYSTEM_MEMORY_SCHEMA, presets: copies, egos: egoCopies, coherence, pooled, pool, distilled, dyads, triads, alignment, digest };
}

/** The digest as plain lines, for an outside AI taking the seat (it reads structure, never the raw weights). */
export function digestLines(pack: SystemMemoryPack): string[] {
  const d = pack.digest;
  const lines = [`System coherence ${d.coherence}: ${d.pooled ? 'aligned, so its memory is one pool' : 'not aligned yet, so each ego stands apart'}.`];
  for (const e of d.egos) {
    lines.push(`Ego ${e.of} (${e.pole} pole) thinks ${e.thinking}; it leans to ${e.leanings.map((l) => `${l.of} (${l.prefer > 0 ? '+' : ''}${l.prefer})`).join(', ') || 'nothing yet'}.`);
  }
  for (const o of d.open) lines.push(`${o.of} (${o.pole} pole) still carries ${o.d}${o.cause !== ALIGNED ? `, left by ${o.cause} thinking above it` : ''}.`);
  for (const p of d.dyads) lines.push(`${p.a} and ${p.b} work as a pair${p.whole ? ', and are whole' : ''}.`);
  for (const t of d.triads) lines.push(`Triad: ${t.intent} (intent) and ${t.context} (context), harmonized by ${t.observer}${t.whole ? ': whole' : ''}.`);
  const a = d.alignment;
  lines.push(`Alignment, the 9: nano ${a.nano.balanced}/${a.nano.of} presets balanced; micro ${a.micro.balanced}/${a.micro.of} egos balanced with whole triads; macro ${a.macro.aligned ? 'pooled and whole' : 'not yet'}. ${a.complete ? 'Complete.' : 'Not complete.'}`);
  if (d.hardened[0]) lines.push(`Its most formative memory: ${d.hardened[0].cat} in ${d.hardened[0].of} at tick ${d.hardened[0].t}.`);
  return lines;
}

/** The pack's JSON form (canonical: the same pack, the same text). */
export function packToJson(pack: SystemMemoryPack): string {
  return canonicalJson(pack);
}

/** A pack from its JSON form, every memory checked; null for anything else. Never throws. */
export function packFromJson(text: string): SystemMemoryPack | null {
  try {
    const v = JSON.parse(text) as SystemMemoryPack;
    if (!v || v.schema !== SYSTEM_MEMORY_SCHEMA || !Array.isArray(v.presets) || !Array.isArray(v.egos)) return null;
    // rebuilt from its parts: the derived fields are recomputed, so a hand-edited digest or pool cannot lie
    return compileSystemMemory(v.presets.map((m) => checkMem(m)), v.egos.map((e) => ({ ego: checkMem(e.ego), presets: e.presets, weights: { prefer: { ...e.weights.prefer } } })));
  } catch {
    return null;
  }
}
