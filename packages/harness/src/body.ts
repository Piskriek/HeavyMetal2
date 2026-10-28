/**
 * Plan 56 §20: the preset body (owner, 28 Oct). A distortion shows in the zone of its energy center and on its side, through
 * a body that works like a program: gates trip into sickness when it stays unresolved; a fast release ejects the energy as a
 * sharp pain (and some of it comes back), a slow one releases it as an itch. Research: docs/BODY_ENERGY_CENTERS_RESEARCH.md.
 *
 * - Flow is the kundalini read as a body: energy enters at the base and each zone takes its share in order, stopping at the
 *   first blocked one (Law of One 54.27, 54.30, 84.10). Zones above a block are starved.
 * - Each gate fails two ways (12.31): blocked (charge above rest) or overopen (below: antidote past rest, overspending).
 *   Out of flow across checkpoints it trips into a symbolic sickness: Congested, Inflamed, Runaway; Drained; Numb.
 * - Sides (97.16): left is intake (what came in), right is output (what it did), from each episode's catalyst.
 * - Release (the owner's design; medicine: sharp pain and itch are separate signals, and pain masks itch): a fall of at most
 *   RELEASE_RATE between checkpoints itches; more is ejected as a pain, and part of the excess rebounds at the next
 *   checkpoint unless the cause closed (relief returns without a new configuration, 66.13).
 * - Teaching runs upward (§20.8): a warned part's pain cues its own episodes in the next dream, and the ego counts the link
 *   from its thinking to the part's distortion.
 *
 * Every preset is a part with its own body: the zones are its rays. Pure and deterministic; the states make no medical claim.
 */
import { ALIGNED, checkMem, type Mem, type SqId } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { dominantDistortion, memoryBalance, noteCause } from './preset-memory.js';
import { REST_AT, type DreamCue } from './dream.js';
import { kundalini } from './lifecycle.js';

export type BodyKind = 'organic' | 'mechanical';
export type Side = 'left' | 'center' | 'right';
export type ZoneMode = 'flowing' | 'blocked' | 'overopen' | 'starved';
export type Sickness = 'congested' | 'inflamed' | 'runaway' | 'drained' | 'numb';
/**
 * pain: released too fast (sharp); itch: released slowly; ache: held (a dull ache that grows the longer the loop lasts);
 * eureka: a long-held distortion let go (owner, 28 Oct: "the more it grows the more the dull ache will increase untill a
 * eureaka moment takes place or a catalyst is introduced to cause one").
 */
export type BodySignal = 'pain' | 'itch' | 'ache' | 'eureka';

/** One zone per ray: where it sits in each kind of body, whether Ra names the place or tradition does, and its colour. */
export const BODY_ZONES: readonly {
  readonly ray: number; readonly colour: string; readonly organic: string; readonly mechanical: string;
  readonly placeFrom: 'ra' | 'tradition'; readonly hue: string;
}[] = [
  { ray: 1, colour: 'red', organic: 'feet and the base of the spine', mechanical: 'thruster pods', placeFrom: 'ra', hue: '#d23c3c' },
  { ray: 2, colour: 'orange', organic: 'lower belly', mechanical: 'couplings', placeFrom: 'tradition', hue: '#e8842c' },
  { ray: 3, colour: 'yellow', organic: 'solar plexus', mechanical: 'power core', placeFrom: 'ra', hue: '#e8cf2c' },
  { ray: 4, colour: 'green', organic: 'heart', mechanical: 'gyro', placeFrom: 'ra', hue: '#3cb45a' },
  { ray: 5, colour: 'blue', organic: 'throat', mechanical: 'radio', placeFrom: 'tradition', hue: '#3c78d2' },
  { ray: 6, colour: 'indigo', organic: 'brow', mechanical: 'lens', placeFrom: 'ra', hue: '#5a46b4' },
  { ray: 7, colour: 'violet', organic: 'crown', mechanical: 'antenna', placeFrom: 'tradition', hue: '#a050c8' },
];

/** The most charge a zone releases between checkpoints and only itches; more is ejected as pain. */
export const RELEASE_RATE = 24;
/** The share of the charge ejected past the rate that comes back at the next checkpoint, unless the cause closed. */
export const REBOUND_SHARE = 0.5;
/** Checkpoints out of flow before each sickness. */
export const CONGESTED_AFTER = 2;
export const INFLAMED_AFTER = 4;
export const RUNAWAY_AFTER = 7;
export const DRAINED_AFTER = 2;
export const NUMB_AFTER = 3;

export interface ZoneState {
  /** 1..7. */
  readonly ray: number;
  readonly mode: ZoneMode;
  readonly sickness: Sickness | null;
  /** Consecutive checkpoints in this mode out of flow. */
  readonly trips: number;
  /** The zone's charge at this checkpoint (after any rebound). */
  readonly charge: number;
  /** −1 all intake (left) .. +1 all output (right), weighted by the episodes on this ray. */
  readonly lean: number;
  readonly side: Side;
  readonly signal: BodySignal | null;
  /** Charge ejected too fast, due back at the next checkpoint unless its cause closed. */
  readonly rebound: number;
  /** 0..1: the dull ache of a held distortion, growing with how long the loop has lasted and how hard it is held. */
  readonly ache: number;
}

export interface BodyState {
  readonly kind: BodyKind;
  readonly checkpoint: number;
  readonly zones: readonly ZoneState[];
}

const rayOf = (d: SqId): number => SQ_DISTORTION_CATALOG[d].rayIndex - 1;
const SIGN: Readonly<Record<Side, number>> = { left: -1, center: 0, right: 1 };
const openOn = (mem: Mem, r: number): boolean => mem.cause.some((c) => c.open && rayOf(c.d) === r);

/** How far a ray's episodes lean to intake (−1, left) or output (+1, right), weighted by how hard they set. */
export function sideLean(mem: Mem, ray0: number, sideOf: (cat: string) => Side): number {
  let w = 0, s = 0;
  for (const e of mem.ep) {
    if (e.d === ALIGNED || rayOf(e.d) !== ray0) continue;
    w += e.h;
    s += e.h * SIGN[sideOf(e.cat)];
  }
  return w > 0 ? Math.round((s / w) * 1000) / 1000 : 0;
}

const sideOfLean = (lean: number): Side => (lean < -1 / 3 ? 'left' : lean > 1 / 3 ? 'right' : 'center');

function sicknessOf(mode: ZoneMode, trips: number): Sickness | null {
  if (mode === 'blocked') return trips >= RUNAWAY_AFTER ? 'runaway' : trips >= INFLAMED_AFTER ? 'inflamed' : trips >= CONGESTED_AFTER ? 'congested' : null;
  if (mode === 'overopen') return trips >= DRAINED_AFTER ? 'drained' : null;
  if (mode === 'starved') return trips >= NUMB_AFTER ? 'numb' : null;
  return null;
}

/**
 * One checkpoint of a part's body. First the rebounds due from the last checkpoint come back where their cause is still open;
 * then each zone's mode, sickness, side and release signal are read. Returns the body and the part's memory (with rebounds).
 */
export function bodyStep(input: { readonly kind: BodyKind; readonly mem: Mem; readonly prev: BodyState | null; readonly sideOf: (cat: string) => Side }): { readonly body: BodyState; readonly mem: Mem } {
  const { kind, prev, sideOf } = input;
  const before = input.mem.charge;
  // 1. what was ejected too fast comes back, unless its cause closed (a real realization)
  const charge = [...before];
  for (const z of prev?.zones ?? []) {
    const r = z.ray - 1;
    if (z.rebound > 0 && openOn(input.mem, r)) charge[r] = Math.min(127, (charge[r] ?? 0) + z.rebound);
  }
  const mem = charge.some((c, i) => c !== before[i]) ? checkMem({ ...input.mem, charge, bal: memoryBalance(charge) }) : input.mem;
  // 2. the flow: it stops at the first zone the kundalini cannot pass
  const level = kundalini(mem);
  const zones: ZoneState[] = [];
  for (let r = 0; r < 7; r++) {
    const c = mem.charge[r] ?? 0;
    const own: ZoneMode | null = c > REST_AT ? 'blocked' : c < -REST_AT ? 'overopen' : openOn(mem, r) ? 'blocked' : null;
    const mode: ZoneMode = own ?? (r > level ? 'starved' : 'flowing');
    const was = prev?.zones[r];
    const trips = mode === 'flowing' ? 0 : was && was.mode === mode ? was.trips + 1 : 1;
    // 3. release since the last checkpoint: a slow fall itches, a fast one is ejected as pain (and part of it rebounds)
    let signal: BodySignal | null = null;
    let rebound = 0;
    const drop = was ? was.charge - (before[r] ?? 0) : 0;
    // the dull ache of a held loop: it grows with the checkpoints it has lasted and with how hard it is held
    const ache = mode === 'blocked' ? Math.round(Math.min(1, trips / RUNAWAY_AFTER) * (0.25 + 0.75 * Math.min(1, Math.max(0, c) / 64)) * 1000) / 1000 : 0;
    if (drop > RELEASE_RATE) {
      signal = 'pain';
      rebound = Math.round((drop - RELEASE_RATE) * REBOUND_SHARE);
    } else if (was && was.mode === 'blocked' && was.trips >= CONGESTED_AFTER && mode === 'flowing') {
      // a long-held distortion let go: the eureka
      signal = 'eureka';
    } else if (drop > 0 && was?.signal !== 'pain') {
      // the pain masks the itch for a checkpoint
      signal = 'itch';
    } else if (ache > 0) {
      signal = 'ache';
    }
    const lean = sideLean(mem, r, sideOf);
    zones.push({ ray: r + 1, mode, sickness: sicknessOf(mode, trips), trips, charge: c, lean, side: sideOfLean(lean), signal, rebound, ache });
  }
  return { body: { kind, checkpoint: (prev?.checkpoint ?? -1) + 1, zones }, mem };
}

/**
 * A part's warning to the body and the ego: what hurts, where, on which side, and how it looks.
 *
 * Owner, 28 Oct: a fearful decision to fix another's process "will manifest an ache in my neck cos thats the zone that
 * relates to supression of truth". So a warning shows where the quality the distortion suppresses lives: its antidote's ray
 * (the SQ check's "map the occlusion" step; for control, Wisdom & Surrender at the throat). The source is the distortion's
 * own ray, where the flow is held.
 */
export interface BodyWarning {
  readonly of: string;
  /** The source: the distortion's own ray, where the flow is held. */
  readonly ray: number;
  readonly source: string;
  /** Where it shows: the ray of the quality it suppresses, and that zone's place. */
  readonly at: number;
  readonly place: string;
  /** The suppressed quality (the antidote's name): what a eureka brings back. */
  readonly quality: string | null;
  readonly side: Side;
  readonly signal: BodySignal | null;
  readonly sickness: Sickness | null;
  readonly ache: number;
  /** The distortion this zone carries most heavily (null when only starved). */
  readonly d: SqId | null;
  /** The visible change: where it shows, which side, that zone's colour, and how it shows. */
  readonly visual: { readonly place: string; readonly side: Side; readonly hue: string; readonly look: 'flash' | 'glow' | 'stiff' | 'flicker' | 'tinge' | 'crack' | 'limp' };
}

/** The heaviest distortion on a ray in a memory. */
function heaviestOn(mem: Mem, r: number): SqId | null {
  const w = new Map<SqId, number>();
  for (const e of mem.ep) if (e.d !== ALIGNED && rayOf(e.d) === r) w.set(e.d, (w.get(e.d) ?? 0) + e.h);
  let best: SqId | null = null;
  for (const [d, v] of w) if (best === null || v > (w.get(best) ?? 0)) best = d;
  return best;
}

/**
 * What a part sends up: every zone in pain or sick, and every eureka (good news travels up too). An itch, or an ache too young
 * to have tripped a gate, is release or holding at work, not a warning.
 */
export function bodyWarnings(of: string, body: BodyState, mem: Mem): BodyWarning[] {
  const out: BodyWarning[] = [];
  const placeOf = (ray: number): string => { const z = BODY_ZONES[ray - 1]!; return body.kind === 'organic' ? z.organic : z.mechanical; };
  for (const z of body.zones) {
    if (z.signal !== 'pain' && z.signal !== 'eureka' && z.sickness === null) continue;
    // a eureka's distortion is gone from the zone's episodes' charge but not from its memory: read it the same way
    const d = heaviestOn(mem, z.ray - 1);
    const at = d ? SQ_DISTORTION_CATALOG[d].antidoteRayIndex : z.ray;
    const place = placeOf(at);
    const look = z.signal === 'pain' ? 'flash' : z.signal === 'eureka' ? 'glow' : z.sickness === 'runaway' ? 'crack' : z.sickness === 'inflamed' ? 'tinge'
      : z.sickness === 'numb' ? 'limp' : z.sickness === 'drained' ? 'flicker' : 'stiff';
    out.push({
      of, ray: z.ray, source: placeOf(z.ray), at, place, quality: d ? SQ_DISTORTION_CATALOG[d].antidoteName : null,
      side: z.side, signal: z.signal, sickness: z.sickness, ache: z.ache, d, visual: { place, side: z.side, hue: BODY_ZONES[at - 1]!.hue, look },
    });
  }
  return out;
}

/** The pain draws the dream's attention: a warned zone's own episodes, newest first, cue the part's next dream (at most 12). */
export function cuesFromWarnings(mem: Mem, warnings: readonly BodyWarning[]): DreamCue[] {
  const rays = new Set(warnings.filter((w) => w.of === mem.of).map((w) => w.ray - 1));
  return mem.ep.filter((e) => e.d !== ALIGNED && rays.has(rayOf(e.d))).sort((a, b) => b.t - a.t).slice(0, 12).map((e) => ({ of: mem.of, t: e.t }));
}

/** The body teaches the ego: each warning counts the link from the ego's thinking to the part's distortion. */
export function teachUpward(ego: Mem, warnings: readonly BodyWarning[]): Mem {
  const by = dominantDistortion(ego);
  return warnings.reduce((m, w) => (w.d ? noteCause(m, by, w.d) : m), ego);
}

/** What a part's warning sounds like on the radio, in the ego's words: where it shows, on which side, and where it is held. */
export function warningLine(w: BodyWarning): string {
  const where = `my ${w.place}${w.side === 'center' ? '' : `, on the ${w.side}`}`;
  const held = w.d ? ` (${w.d}, held in my ${w.source})` : '';
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  if (w.signal === 'pain') return `A sharp pain in ${where}${held}: I let it go too fast.`;
  if (w.signal === 'eureka') return `Something let go in ${where}${w.quality ? `: ${w.quality} came back` : ''}.`;
  if (w.sickness === 'runaway') return `A dull ache in ${where} keeps growing${held}. I need to dream on it.`;
  if (w.sickness === 'inflamed') return `${cap(where)}: inflamed${held}, the ache is getting worse.`;
  if (w.sickness === 'drained') return `${cap(where)}: drained${held}. I gave too much.`;
  if (w.sickness === 'numb') return `I cannot feel ${where}: the energy stops below it.`;
  return `A dull ache in ${where}, stiff${held}.`;
}
