/**
 * Plan 56 §12: polarity. Every preset leans between two principles (owner, 28 Oct, the 3/6/9 frame): the intent pole
 * (Masculine, $GUIDE: reaching, mechanical, precise; yang) and the context pole (Feminine, $CANVAS: awaiting, organic,
 * creative; yin). Both are in every preset, so polarity is a lean (−127 context .. +127 intent, 0 balanced), never a
 * label (research §10). The third force, the Harmonizer (Flow, $FLOW), is no pole: it is the rung that observes a pair
 * (triadsOf), and the triad nests at every rung.
 *
 * - It is identity, not distortion: never derived from charge. Declared (`Mem.pol`) wins; otherwise the preset's kind gives
 *   it by the float family it builds: parts, kits and meshes (Vtx) and materials and sprites (Pxd) lean intent; light
 *   and sound (Lx) and species (Aq) lean context; behaviour kinds are balanced until a measured signature is designed. An
 *   ego's comes from its four floats. The ego never changes a preset's polarity (Law of One 92.22: given, not chosen).
 * - A dyad is two presets of opposite poles that acted on the same catalyst within a short window with good outcomes.
 *   Everything a dyad does is symmetric: neither pole ranks above the other.
 *
 * Pure and deterministic. Polarity is per-preset state, never a fifth global metric.
 */
import type { Mem, SqId } from '@hm/shorthand';
import type { FourFloatsTuple } from './types.js';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { BALANCED_AT } from './preset-memory.js';

/** |pol| at least this is a pole; under it the preset is balanced between them. */
export const POLE_MIN = 32;
/** A dyad's co-acts: the same catalyst within this many ticks, both outcomes good (error under 0.5). */
export const DYAD_WINDOW = 60;
/** The investment one co-act lends each partner, up to DYAD_INV_MAX (a partner's investment never outgrows the player's). */
export const DYAD_INV_PER = 0.05;
export const DYAD_INV_MAX = 0.5;
/** A dyad whose polarities sum within this, both partners balanced, is whole (ray 7, synthesis). */
export const WHOLE_AT = 32;

export type Pole = 'intent' | 'context' | 'balanced';

/** The polarity a preset kind leans to when none is declared: what the kind builds (its float family). */
export const KIND_POLARITY: Readonly<Record<string, number>> = {
  kit: 96, part: 96, mesh: 96, // Vtx
  matc: 64, pxdc: 64, sprite: 64, skin: 64, // Pxd
  lx: -64, sound: -64, music: -64, // Lx
  species: -96, flora: -96, // Aq
};

const clampI8 = (x: number): number => Math.max(-127, Math.min(127, Math.round(x)));

/** A preset's polarity: declared, else its kind's, else balanced. */
export function polarityOf(mem: Mem): number {
  if (mem.pol !== undefined) return mem.pol;
  return KIND_POLARITY[mem.of.slice(0, mem.of.indexOf(':'))] ?? 0;
}

export function poleOf(pol: number): Pole {
  return pol >= POLE_MIN ? 'intent' : pol <= -POLE_MIN ? 'context' : 'balanced';
}

/** An ego's polarity from its four floats [pxd, vtx, lx, aq] (each 0..1): (Pxd + Vtx) against (Lx + Aq), as Plan 52's Harvest splits them. */
export function polarityFromFloats(f: FourFloatsTuple): number {
  return clampI8((127 * (f[0] + f[1] - f[2] - f[3])) / 2);
}

export interface Dyad {
  /** The two partners' `of`, in sorted order. */
  readonly a: string;
  readonly b: string;
  /** Co-acts with good outcomes. */
  readonly strength: number;
  /** Their polarities nearly cancel and both are balanced: the pair is whole. */
  readonly whole: boolean;
}

/** Every dyad among the presets: opposite poles, at least one co-act with good outcomes. Sorted by partner. */
export function findDyads(presets: readonly Mem[], window = DYAD_WINDOW): Dyad[] {
  const sorted = [...presets].sort((x, y) => (x.of < y.of ? -1 : x.of > y.of ? 1 : 0));
  const out: Dyad[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!, b = sorted[j]!;
      const pa = polarityOf(a), pb = polarityOf(b);
      const poles = [poleOf(pa), poleOf(pb)];
      if (!(poles.includes('intent') && poles.includes('context'))) continue;
      const strength = coActs(a, b, window);
      if (strength === 0) continue;
      out.push({ a: a.of, b: b.of, strength, whole: Math.abs(pa + pb) <= WHOLE_AT && a.bal >= BALANCED_AT && b.bal >= BALANCED_AT });
    }
  }
  return out;
}

/** How often two presets acted on the same catalyst within `window` ticks, both with good outcomes: each episode matched once, to its nearest. */
export function coActs(a: Mem, b: Mem, window = DYAD_WINDOW): number {
  const used = new Set<number>();
  let n = 0;
  for (const ea of a.ep) {
    if (ea.err >= 0.5) continue;
    let best = -1, gap = Infinity;
    b.ep.forEach((eb, k) => {
      if (used.has(k) || eb.err >= 0.5 || eb.cat !== ea.cat) return;
      const g = Math.abs(eb.t - ea.t);
      if (g <= window && g < gap) { best = k; gap = g; }
    });
    if (best >= 0) { used.add(best); n++; }
  }
  return n;
}

/**
 * The investment a dyad lends: each partner's `inv` is at least DYAD_INV_PER per co-act (up to DYAD_INV_MAX). It is a floor,
 * not a sum, so counting the same dyad again changes nothing; the player's own investment can stand higher.
 */
export function dyadInvestment(presets: readonly Mem[], dyads: readonly Dyad[]): Mem[] {
  const floor = new Map<string, number>();
  for (const d of dyads) {
    const lent = Math.min(DYAD_INV_MAX, DYAD_INV_PER * d.strength);
    for (const of of [d.a, d.b]) floor.set(of, Math.max(floor.get(of) ?? 0, lent));
  }
  return presets.map((m) => {
    const f = floor.get(m.of) ?? 0;
    return f > m.inv ? { ...m, inv: Math.round(f * 1000) / 1000 } : m;
  });
}

/** For each preset in a dyad, its partners' `of`. */
export function partnersOf(dyads: readonly Dyad[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const d of dyads) {
    out.set(d.a, [...(out.get(d.a) ?? []), d.b]);
    out.set(d.b, [...(out.get(d.b) ?? []), d.a]);
  }
  return out;
}

/**
 * The built-in Higher Self's reading of a distortion, framed by the complementary pole (Plan 56 §12): an intent-pole
 * preset hears context, a context-pole preset hears intent, a balanced one hears the quality alone. An outside AI in the
 * Higher Self seat gives its own; this is the voice when none is attached.
 */
export function higherSelfFrame(d: SqId, pol: number): string {
  const quality = SQ_DISTORTION_CATALOG[d].antidoteName;
  const pole = poleOf(pol);
  if (pole === 'intent') return `Let it move through you. ${quality} is the way back.`;
  if (pole === 'context') return `Stand on your line. ${quality} is the way back.`;
  return `Rest in ${quality}.`;
}

/**
 * A triad (owner, 28 Oct: "the genders and neutral observer creates the triad and its nested over and over"): a dyad's
 * intent partner ($GUIDE) and context partner ($CANVAS), and the Harmonizer ($FLOW) that observes them, the rung that
 * uses both. It nests: the observer of one triad is itself a partner in a triad one rung up.
 */
export interface Triad {
  readonly intent: string;
  readonly context: string;
  readonly observer: string;
  readonly strength: number;
  readonly whole: boolean;
}

/**
 * Every triad: each dyad with each observer that uses both partners. `polarity` names which partner is the intent pole.
 * Sorted by observer, then partner.
 */
export function triadsOf(dyads: readonly Dyad[], observers: readonly { readonly of: string; readonly members: readonly string[] }[], polarity: (of: string) => number): Triad[] {
  const out: Triad[] = [];
  for (const o of observers) {
    const has = new Set(o.members);
    for (const d of dyads) {
      if (!has.has(d.a) || !has.has(d.b)) continue;
      const aIntent = polarity(d.a) >= polarity(d.b);
      out.push({ intent: aIntent ? d.a : d.b, context: aIntent ? d.b : d.a, observer: o.of, strength: d.strength, whole: d.whole });
    }
  }
  return out.sort((x, y) => (x.observer < y.observer ? -1 : x.observer > y.observer ? 1 : x.intent < y.intent ? -1 : x.intent > y.intent ? 1 : 0));
}
