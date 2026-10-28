/**
 * Plan 56 W2: the experience writer. Every preset keeps its own memory (the shorthand's `Mem`, W1), written here.
 *
 * - An experience is an episode in a bounded record of 32, weighted by its excitement: an excited moment hardens the
 *   memory (arousal modulates consolidation, research §2) and is the last to be forgotten.
 * - Each episode records what the higher rung was thinking (`by`, an SQ type or aligned) and, when known, which of its
 *   rules acted (`src`). Under distorted thinking the preset's charge moves on the ray of the distortion it took on.
 * - The cause links (`by` → `d`) are how its distortions relate: observed distortions teach them, and when nothing was
 *   observed they predict which distortion that kind of thinking leaves here (the same type until they learn otherwise).
 * - "Repeat" (owner, 28 Oct): a preset that goes round its curriculum again keeps every memory it has; only its cycle
 *   count rises and its next episodes start at S0a. Nothing is wiped.
 *
 * Pure and deterministic: no clock, no random. Balancing the charge back (the antidote) is the dream's work (W3).
 */
import { checkMem, type Episode, type Mem, type SqId, type SqOrAligned, type StageId, ALIGNED, MAX_CAUSE_LINKS, MAX_EPISODES, SQ_IDS } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';

/** How much of the remaining softness one fully excited moment hardens (hard += (1 − hard) · excitement · rate). */
export const HARDEN_RATE = 0.25;
/** The charge one fully excited moment under distorted thinking puts on the distortion's ray (of ±127). */
export const CHARGE_GAIN = 32;
/** At or above this balance a memory steers nothing: its rung thinks aligned. */
export const BALANCED_AT = 0.9;
/** Where a repeated curriculum starts again. */
export const CURRICULUM_START: StageId = 'S0a';

/** One thing that happened to a preset while it was in use. */
export interface Experience {
  /** The game tick. */
  readonly t: number;
  readonly stage: StageId;
  /** The catalyst's kind (e.g. a Compass event kind). */
  readonly cat: string;
  /** 0..1: how exciting the moment was (the Compass's excitement, or a bridged game's resonance). */
  readonly excitement: number;
  /** 0..1: how far the outcome was from what the preset meant to do. */
  readonly error: number;
  /** What the higher rung was thinking when it acted: an SQ type, or aligned. */
  readonly by: SqOrAligned;
  /** The distortion an observer saw in this preset, when one did. It teaches the cause links. */
  readonly felt?: SqOrAligned;
  /** The higher rung's rule or preset that acted (e.g. 'logic:mimic-reflex'). */
  readonly src?: string;
}

const RAYS = 7;
const SQ_ORDER = new Map<string, number>(SQ_IDS.map((id, i) => [id, i]));

const clamp01 = (x: number, what: string): number => {
  if (!Number.isFinite(x)) throw new Error(`${what} must be a finite number`);
  return Math.min(1, Math.max(0, x));
};
/** The 0-based ray a distortion sits on. */
const rayOf = (d: SqId): number => SQ_DISTORTION_CATALOG[d].rayIndex - 1;

/** A preset's first memory: nothing happened yet, so it is soft and balanced. `of` is the preset's kind and content hash. */
export function createPresetMemory(of: string): Mem {
  return checkMem({ of, hard: 0, bal: 1, charge: [0, 0, 0, 0, 0, 0, 0], ep: [], cause: [], inv: 0, cyc: 0 });
}

/** Balance from the charge: 1 when every ray is at rest, 0 when one ray is fully charged. */
export function memoryBalance(charge: readonly number[]): number {
  let worst = 0;
  for (let i = 0; i < RAYS; i++) worst = Math.max(worst, Math.abs(charge[i] ?? 0));
  return 1 - worst / 127;
}

/** An episode's weight: its excitement when written, which is also how hard it set. */
export const episodeWeight = (e: Episode): number => e.h;

/**
 * The distortion `by` thinking leaves in this preset when nobody observed one: the most counted link from `by`
 * (ties go to the catalog's order), or the same type while the links have learned nothing for it.
 */
export function predictDistortion(mem: Mem, by: SqOrAligned): SqOrAligned {
  if (by === ALIGNED) return ALIGNED;
  let best: { d: SqId; n: number } | null = null;
  for (const c of mem.cause) {
    if (c.by !== by) continue;
    if (best === null || c.n > best.n || (c.n === best.n && (SQ_ORDER.get(c.d) ?? 0) < (SQ_ORDER.get(best.d) ?? 0))) best = { d: c.d, n: c.n };
  }
  return best?.d ?? by;
}

/** The record with room for one more: when it is full, the lightest episode goes (the oldest of equals). */
function makeRoom(ep: readonly Episode[]): Episode[] {
  const out = [...ep];
  if (out.length < MAX_EPISODES) return out;
  let drop = 0;
  for (let i = 1; i < out.length; i++) {
    const a = out[i]!, b = out[drop]!;
    if (episodeWeight(a) < episodeWeight(b) || (episodeWeight(a) === episodeWeight(b) && a.t < b.t)) drop = i;
  }
  out.splice(drop, 1);
  return out;
}

/** The cause links with `by → d` counted once more and opened. When all 64 are taken, the smallest closed link goes, else the smallest. */
function linkCause(cause: Mem['cause'], by: SqOrAligned, d: SqId): Mem['cause'] {
  const out = cause.map((c) => ({ ...c }));
  const at = out.findIndex((c) => c.by === by && c.d === d);
  if (at >= 0) {
    const c = out[at]!;
    out[at] = { ...c, n: Math.min(65535, c.n + 1), open: true };
    return out;
  }
  if (out.length >= MAX_CAUSE_LINKS) {
    let drop = -1;
    for (let i = 0; i < out.length; i++) {
      const c = out[i]!;
      const best = drop < 0 ? null : out[drop]!;
      const better = best === null
        || (!c.open && best.open)
        || (c.open === best.open && c.n < best.n);
      if (better) drop = i;
    }
    out.splice(drop, 1);
  }
  out.push({ by, d, n: 1, open: true });
  return out;
}

/**
 * Writes one experience into a preset's memory and returns the new memory (checked and quantized). The episode
 * hardens the memory by its excitement. Under distorted thinking, or with a distortion observed, it charges that
 * distortion's ray and counts the cause link. Throws on an invalid experience.
 */
export function recordExperience(mem: Mem, x: Experience): Mem {
  if (!Number.isSafeInteger(x.t) || x.t < 0) throw new Error('t must be a whole tick');
  const ex = clamp01(x.excitement, 'excitement');
  const err = clamp01(x.error, 'error');
  const d = x.felt ?? predictDistortion(mem, x.by);
  const episode: Episode = { t: x.t, stage: x.stage, cat: x.cat, ex, err, h: ex, d, by: x.by, ...(x.src !== undefined ? { src: x.src } : {}) };

  const charge = [...mem.charge];
  let cause = mem.cause;
  if (d !== ALIGNED) {
    const ray = rayOf(d);
    charge[ray] = Math.max(-127, Math.min(127, (charge[ray] ?? 0) + Math.round(ex * CHARGE_GAIN)));
    cause = linkCause(cause, x.by, d);
  }
  return checkMem({
    ...mem,
    hard: mem.hard + (1 - mem.hard) * ex * HARDEN_RATE,
    bal: memoryBalance(charge),
    charge,
    ep: [...makeRoom(mem.ep), episode],
    cause,
  });
}

/**
 * What this memory, as a rung, is thinking: aligned when it is balanced, else the distortion on its most charged ray
 * that its episodes carry most heavily (ties go to the catalog's order). A rung's memory is a preset's memory, so the
 * ladder is presets inside presets.
 */
export function dominantDistortion(mem: Mem): SqOrAligned {
  if (mem.bal >= BALANCED_AT) return ALIGNED;
  let ray = 0;
  for (let i = 1; i < RAYS; i++) if ((mem.charge[i] ?? 0) > (mem.charge[ray] ?? 0)) ray = i;
  // a negative charge is antidote past rest, not a distortion being thought
  if ((mem.charge[ray] ?? 0) <= 0) return ALIGNED;
  const weight = new Map<SqId, number>();
  for (const e of mem.ep) {
    if (e.d === ALIGNED || rayOf(e.d) !== ray) continue;
    weight.set(e.d, (weight.get(e.d) ?? 0) + episodeWeight(e));
  }
  let best: SqId | null = null;
  for (const [d, w] of weight) {
    const bw = best === null ? -1 : weight.get(best) ?? 0;
    if (w > bw || (w === bw && best !== null && (SQ_ORDER.get(d) ?? 0) < (SQ_ORDER.get(best) ?? 0))) best = d;
  }
  return best ?? ALIGNED;
}

/** The episodes a higher rung's rule `src` left whose distortion is still open: what that rule is responsible for. */
export function openCausesFrom(mem: Mem, src: string): Episode[] {
  const open = new Set(mem.cause.filter((c) => c.open).map((c) => `${c.by}>${c.d}`));
  return mem.ep.filter((e) => e.src === src && e.d !== ALIGNED && open.has(`${e.by}>${e.d}`));
}

/** "Repeat": the preset goes round its curriculum again from S0a with every memory it has; only its cycle count rises. */
export function repeatCurriculum(mem: Mem): { readonly mem: Mem; readonly stage: StageId } {
  return { mem: checkMem({ ...mem, cyc: Math.min(65535, mem.cyc + 1) }), stage: CURRICULUM_START };
}

/** FNV-1a over a string, as an unsigned 32-bit number. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The body's symptom (Law of One 61.7: catalyst left unused shows in the body): a deterministic offset in
 * [−(1 − bal), 1 − bal] for tick `t`, which the preset's user adds to its parameters (a stutter, a drifting rhythm).
 * A balanced memory gives 0.
 */
export function symptomOffset(mem: Mem, t: number, seed = 0): number {
  const amp = 1 - mem.bal;
  if (amp <= 0) return 0;
  const u = fnv1a(`${mem.of}|${t}|${seed}`) / 0xffffffff;
  return amp * (2 * u - 1);
}
