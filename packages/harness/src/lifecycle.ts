/**
 * Plan 56 W5: the lifecycle (§14, §15; owner, 28 Oct).
 *
 * - Kundalini: a preset's rays clear in order from red (Law of One 49.6), never skipping one (49.5). Fully risen, every
 *   distortion of that preset is resolved, and it gains the next rung's awareness before the harvest (`awarenessOf`).
 * - Ready (`harvestReady`): risen and mastered. A rung must also leave nothing open below it and harmonize only whole triads.
 * - Astral travel: a ready preset, waiting for harvest day, dreams abroad through open gates only, to hosts of its kind at
 *   its balance or above (17.37). Read only: it brings home a travel episode and the host's lessons at half weight.
 * - The weekly harvest is the default game's update: a variant is adopted when more than half of the distinct, verified
 *   players who used that slot that week run it, it is ready, and a quorum is met. Players decide; an AI never votes.
 *   Adopted presets graduate into the default game; ready ones wait and travel; ones unbalanced for weeks repeat.
 * - Wanderers: a higher entity in a lower role (`descend`), veiled and limited. Balanced, it calms the presets acting with
 *   it (`anchorCalm`) and lends them its dream cue (`anchorLinks`). It is not immune: it distorts and repeats like any.
 *
 * Pure and deterministic: the week is an input, never a clock.
 */
import { ALIGNED, checkMem, type Mem, type SqId } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { BALANCED_AT, CURRICULUM_START, createPresetMemory, openCausesFrom, recordExperience, repeatCurriculum } from './preset-memory.js';
import { REST_AT } from './dream.js';
import { coActs, DYAD_WINDOW, type Dyad, type Pole } from './polarity.js';
import { OVERWATCH_SEAT, type Alignment, type SystemMemoryPack } from './system-memory.js';

/** Mastered: at least this many episodes, the latest of them with a mean error at or under MASTER_ERROR. */
export const MASTER_MIN_EPISODES = 8;
export const MASTER_ERROR = 0.2;
/** The calm one balanced wanderer brings to a moment, and the most any number bring. */
export const ANCHOR_CALM = 0.3;
export const ANCHOR_CALM_MAX = 0.6;
/** The fewest players a slot's week needs before its majority counts. */
export const QUORUM = 10;
/** Weeks a preset may stay unbalanced before it repeats its curriculum. */
export const REPEAT_AFTER_WEEKS = 4;

const rayOf = (d: SqId): number => SQ_DISTORTION_CATALOG[d].rayIndex - 1;
const kindOf = (of: string): string => of.slice(0, of.indexOf(':'));
const byT = <T extends { t: number }>(a: T, b: T): number => a.t - b.t;

/** The kundalini level, 0..7: the rays at rest from red upward, in order (charge at rest, no open link on that ray). */
export function kundalini(mem: Mem): number {
  let level = 0;
  for (let r = 0; r < 7; r++) {
    const rest = (mem.charge[r] ?? 0) <= REST_AT && !mem.cause.some((c) => c.open && rayOf(c.d) === r);
    if (!rest) break;
    level++;
  }
  return level;
}

/**
 * Every distortion of this preset is resolved: the kundalini has risen through all seven rays. Rising takes a lived
 * life: a new preset with nothing in it yet is undistorted, not risen (the infant's matrix is new, Law of One 92.9).
 */
export const isRisen = (mem: Mem): boolean => kundalini(mem) === 7 && mem.ep.length >= MASTER_MIN_EPISODES;

/** Mastered: enough experience, and the latest of it went well. */
export function mastered(mem: Mem): boolean {
  if (mem.ep.length < MASTER_MIN_EPISODES) return false;
  const latest = [...mem.ep].sort(byT).slice(-MASTER_MIN_EPISODES);
  return latest.reduce((s, e) => s + e.err, 0) / latest.length <= MASTER_ERROR;
}

/** Ready to harvest: risen and mastered. */
export const harvestReady = (mem: Mem): boolean => isRisen(mem) && mastered(mem);

/** A rung is ready when it is, nothing it caused below is still open (Law of One 22.26), and every triad it harmonizes is whole. */
export function rungHarvestReady(rung: Mem, below: readonly Mem[], triads: readonly { readonly observer: string; readonly whole: boolean }[]): boolean {
  return harvestReady(rung) && below.every((m) => openCausesFrom(m, rung.of).length === 0) && triads.every((t) => t.observer !== rung.of || t.whole);
}

export interface Awareness {
  readonly of: string;
  /** Where a wanderer came from, remembered on rising (the veil lifts by the work, 63.17); null for any other preset. */
  readonly home: string | null;
  /** The next rung's view: each rung that uses this preset (or, for an ego, the Overwatch seat's). */
  readonly rungs: readonly {
    readonly of: string;
    readonly thinking: string;
    readonly pole: Pole | null;
    readonly leanings: readonly { readonly of: string; readonly prefer: number }[];
    readonly triads: readonly { readonly intent: string; readonly context: string; readonly whole: boolean }[];
  }[];
  /** For an ego: the system it now sees, as the Overwatch does. */
  readonly system: { readonly coherence: number; readonly alignment: Alignment } | null;
}

/** What a risen preset (or ego) now sees of the rung above it, before the harvest; null while it has not risen. */
export function awarenessOf(pack: SystemMemoryPack, of: string): Awareness | null {
  const preset = pack.presets.find((m) => m.of === of);
  const ego = pack.egos.find((e) => e.ego.of === of)?.ego;
  const self = preset ?? ego;
  if (!self || !isRisen(self)) return null;
  const home = self.wan?.from ?? null;
  if (ego) {
    return {
      of, home, system: { coherence: pack.coherence, alignment: pack.alignment },
      rungs: [{ of: OVERWATCH_SEAT, thinking: pack.alignment.complete ? ALIGNED : 'the whole system, not yet complete', pole: null, leanings: Object.entries(pack.distilled.prefer).map(([p, v]) => ({ of: p, prefer: v })).sort((a, b) => b.prefer - a.prefer).slice(0, 3), triads: pack.triads.filter((t) => t.level === 'ego').map((t) => ({ intent: t.intent, context: t.context, whole: t.whole })) }],
    };
  }
  const rungs = pack.digest.egos.filter((e) => pack.egos.find((x) => x.ego.of === e.of)?.presets.includes(of)).map((e) => ({
    of: e.of, thinking: e.thinking, pole: e.pole, leanings: e.leanings,
    triads: pack.triads.filter((t) => t.observer === e.of).map((t) => ({ intent: t.intent, context: t.context, whole: t.whole })),
  }));
  return { of, home, rungs, system: null };
}

/**
 * A wanderer: the higher entity `higher` takes the lower role `role` (a preset's `of`) with a physical limit (0..1, the share of
 * the role's normal range it may use). The veil: none of its higher episodes come along, only where it came from and how many
 * times it has risen before.
 */
export function descend(higher: Mem, role: string, limit: number): Mem {
  if (!Number.isFinite(limit) || limit < 0 || limit > 1) throw new Error('a limit is a share of the normal range, 0..1');
  const done = Math.min(255, (higher.wan?.done ?? 0) + (isRisen(higher) ? 1 : 0));
  return checkMem({ ...createPresetMemory(role), wan: { from: higher.of, done, lim: limit } });
}

/** A balanced wanderer: one that can anchor (a healer balances itself first, Law of One 66.8). */
export const isAnchor = (mem: Mem): boolean => mem.wan !== undefined && mem.bal >= BALANCED_AT;

/** The calm the presets at a moment get from the balanced wanderers among them (for Experience.calm). */
export function anchorCalm(present: readonly Mem[]): number {
  return Math.min(ANCHOR_CALM_MAX, ANCHOR_CALM * present.filter(isAnchor).length);
}

/** The example: each balanced wanderer with each preset it acted with, as links the dream lends cues along (any pole). */
export function anchorLinks(presets: readonly Mem[], window = DYAD_WINDOW): Dyad[] {
  const out: Dyad[] = [];
  const anchors = presets.filter(isAnchor);
  for (const w of anchors) {
    for (const p of presets) {
      if (p.of === w.of || p.wan !== undefined) continue;
      const n = coActs(w, p, window);
      if (n === 0) continue;
      const [a, b] = w.of < p.of ? [w.of, p.of] : [p.of, w.of];
      out.push({ a, b, strength: n, whole: false });
    }
  }
  return out.sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : x.b < y.b ? -1 : x.b > y.b ? 1 : 0));
}

/** A world a dreaming preset may visit: a node of the network behind a gate, with what its owner shares. */
export interface AstralHost {
  readonly node: string;
  readonly access: 'open' | 'code-only' | 'closed';
  readonly presets: readonly Mem[];
}

/**
 * Astral travel: a ready preset, waiting for harvest day, visits a host through an open gate. It reads the host's presets
 * of its own kind at its balance or above, never writes to them, and brings home a travel episode (its excitement is the
 * novelty of how the host relates the same distortions) and the host's lessons (their cause links, closed, at half weight).
 */
export function astralTravel(mem: Mem, host: AstralHost, t: number): { readonly mem: Mem; readonly visited: readonly string[]; readonly why: string } {
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/.test(host.node)) throw new Error('a host node is a short lowercase id');
  if (!harvestReady(mem)) return { mem, visited: [], why: 'not ready: it travels only once risen and mastered' };
  if (host.access !== 'open') return { mem, visited: [], why: 'that gate is not open' };
  const kind = kindOf(mem.of);
  const peers = host.presets.filter((h) => h.of !== mem.of && kindOf(h.of) === kind && h.bal >= mem.bal);
  if (peers.length === 0) return { mem, visited: [], why: 'nothing there resonates with it' };
  const key = (c: { by: string; d: string }): string => `${c.by}>${c.d}`;
  const own = new Set(mem.cause.map(key));
  const theirs = peers.flatMap((p) => p.cause);
  const novel = new Map<string, { by: (typeof theirs)[number]['by']; d: SqId; n: number }>();
  for (const c of theirs) {
    if (own.has(key(c))) continue;
    const cur = novel.get(key(c));
    novel.set(key(c), { by: c.by, d: c.d, n: Math.min(65535, (cur?.n ?? 0) + c.n) });
  }
  const novelty = theirs.length ? [...theirs].filter((c) => !own.has(key(c))).length / theirs.length : 0;
  const stage = [...mem.ep].sort(byT)[mem.ep.length - 1]?.stage ?? CURRICULUM_START;
  const travelled = recordExperience(mem, { t, stage, cat: `astral:${host.node}`, excitement: 0.2 + 0.6 * novelty, error: 0, by: ALIGNED });
  const room = Math.max(0, 64 - travelled.cause.length);
  const borrowed = [...novel.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, room)
    .map(([, c]) => ({ by: c.by, d: c.d, n: Math.max(1, Math.ceil(c.n / 2)), open: false }));
  return { mem: checkMem({ ...travelled, cause: [...travelled.cause, ...borrowed] }), visited: peers.map((p) => p.of).sort(), why: `visited ${peers.length} at ${host.node}` };
}

/** One default slot's week: who used it, and which variants they ran. Counted by use, one count per verified player. */
export interface SlotWeek {
  readonly slot: string;
  readonly current: string;
  /** Distinct, verified players who used this slot this week. */
  readonly electorate: number;
  readonly entries: readonly { readonly code: string; readonly players: number; readonly ready: boolean }[];
}

/**
 * The weekly adoption for one slot (owner, 28 Oct: "the most used preset as per the majority rules"): a ready variant used
 * by more than half of the slot's players, with a quorum, becomes the default; otherwise the current default stays.
 */
export function weeklyAdoption(week: SlotWeek, quorum = QUORUM): { readonly slot: string; readonly adopted: string | null; readonly defaultCode: string; readonly why: string } {
  const ints = [week.electorate, ...week.entries.map((e) => e.players)];
  if (!ints.every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error('counts are whole numbers of players');
  const used = week.entries.reduce((s, e) => s + e.players, 0);
  if (used > week.electorate) throw new Error('more uses than players: each player counts once per slot');
  const keep = (why: string) => ({ slot: week.slot, adopted: null, defaultCode: week.current, why });
  if (week.electorate < quorum) return keep(`no quorum: ${week.electorate} of ${quorum} players`);
  const ready = week.entries.filter((e) => e.ready).sort((a, b) => b.players - a.players || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const best = ready[0];
  if (!best) return keep('no ready variant');
  if (ready[1] && ready[1].players === best.players) return keep('a tie keeps the current default');
  if (best.players * 2 <= week.electorate) return keep(`no majority: ${best.players} of ${week.electorate}`);
  if (best.code === week.current) return keep(`the default holds its majority: ${best.players} of ${week.electorate}`);
  return { slot: week.slot, adopted: best.code, defaultCode: best.code, why: `adopted by ${best.players} of ${week.electorate} players` };
}

export interface HarvestWeek {
  readonly week: number;
  readonly presets: readonly Mem[];
  /** The presets (`of`) whose variant the week's adoption made a default. */
  readonly adopted: readonly string[];
  /** Weeks each preset has stayed unbalanced so far. */
  readonly unbalancedWeeks: Readonly<Record<string, number>>;
  readonly repeatAfter?: number;
}

/**
 * Harvest day, once a week at the default game's update: adopted and ready presets graduate (into the default game, their
 * memory into the shared pack); ready ones not adopted wait and keep travelling; ones unbalanced for `repeatAfter` weeks
 * repeat their curriculum, keeping every memory. Nothing perishes.
 */
export function harvestWeek(input: HarvestWeek): {
  readonly week: number;
  readonly presets: readonly Mem[];
  readonly unbalancedWeeks: Readonly<Record<string, number>>;
  readonly graduated: readonly string[];
  readonly waiting: readonly string[];
  readonly repeated: readonly string[];
} {
  if (!Number.isSafeInteger(input.week) || input.week < 0) throw new Error('the week is a whole number');
  const after = input.repeatAfter ?? REPEAT_AFTER_WEEKS;
  const adopted = new Set(input.adopted);
  const weeks: Record<string, number> = { ...input.unbalancedWeeks };
  const graduated: string[] = [], waiting: string[] = [], repeated: string[] = [];
  const presets = input.presets.map((m) => {
    if (harvestReady(m)) {
      delete weeks[m.of];
      (adopted.has(m.of) ? graduated : waiting).push(m.of);
      return m;
    }
    if (m.bal >= BALANCED_AT) { delete weeks[m.of]; return m; } // balanced and still learning: no count against it
    const n = (weeks[m.of] ?? 0) + 1;
    if (n < after) { weeks[m.of] = n; return m; }
    delete weeks[m.of];
    repeated.push(m.of);
    return repeatCurriculum(m).mem;
  });
  return { week: input.week, presets, unbalancedWeeks: weeks, graduated, waiting, repeated };
}
