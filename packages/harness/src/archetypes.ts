/**
 * Plan 57 §17: The 22-Archetype Blueprint & Cross-Wired Mind/Body Polarity (owner & Argon, 29 Oct).
 *
 * Grounded in the Law of One Archetypical Mind sessions (74.4, 78.10–37, 87.28, 91.15–37):
 * - "The archetypical mind, when penetrated lucidly, is a blueprint of the builded structure of all energy expenditures
 *   and all seeking, without distortion." (91.37)
 * - Cross-wired polarity after the Veil (87.28, 78.11):
 *   - To the intent / masculine polarity (pol >= 32) is attracted the Matrix of the Mind (I. The Magician: conscious will
 *     and logical structure) and the Potentiator of the Body (IX. Wisdom / The Hermit: kinetic judgment regulating action).
 *   - To the context / feminine polarity (pol <= -32) is attracted the Potentiator of the Mind (II. The High Priestess:
 *     intuitive sea of excitement and potential across the Veil) and the Matrix of the Body (VIII. Balanced Working:
 *     continuous somatic homeostasis).
 *   - Behind a thick Veil, an unintegrated intent preset leans on conscious control (Matrix of Mind) without intuition,
 *     while an unintegrated context preset leans on raw excitement/intuition (Potentiator of Mind) without structural
 *     focus. Pairing them or integrating the complementary station unites Matrix + Potentiator across Mind and Body.
 * - The 7-Station Functional Cycle (3 complexes × 7 stations + The Choice = 22 archetypes):
 *   1. matrix -> 2. potentiator -> 3. catalyst -> 4. experience -> 5. significator -> 6. transformation -> 7. great-way,
 *   plus 22. the-choice (The Fool: pure faith across the Veil).
 * - Dwelling in the Virgin Mind (91.35): when a preset is overloaded with abstruse cognitive loops (open cause links or
 *   Blue/Indigo rays 5–6 blocked/starved), invoking Station 1 (The Magician / Virgin Mind), Station 2 (High Priestess),
 *   Station 8/9 (Body Matrix/Potentiator), or Station 22 (The Fool / Faith) softens the cognitive loop hardness and eases
 *   charge by at most RELEASE_RATE (24) so the next bodyStep registers a gentle 'itch' release rather than a 'pain' rebound,
 *   while preserving all episodes and never faking closed cause links.
 *
 * Pure and deterministic.
 */
import { ALIGNED, checkMem, type Mem } from '@hm/shorthand';
import { SQ_DISTORTION_CATALOG } from './purpose-excitement-catalyst.js';
import { BALANCED_AT, memoryBalance } from './preset-memory.js';
import { kundalini } from './lifecycle.js';
import { poleOf, polarityOf, type Pole } from './polarity.js';
import { RELEASE_RATE, type BodyState } from './body.js';

export type ArchetypeComplex = 'mind' | 'body' | 'spirit' | 'choice';

export type ArchetypeStationKind =
  | 'matrix'
  | 'potentiator'
  | 'catalyst'
  | 'experience'
  | 'significator'
  | 'transformation'
  | 'great-way'
  | 'the-choice';

export interface ArchetypeDef {
  /** 1..22 (Tarot Major Arcana I..XXII). */
  readonly number: number;
  readonly complex: ArchetypeComplex;
  /** 1..7 within Mind/Body/Spirit, or 8 for The Choice (22). */
  readonly stationIndex: number;
  readonly station: ArchetypeStationKind;
  readonly raName: string;
  readonly tarotName: string;
  /** Which code subsystem in @hm/harness embodies this station. */
  readonly engineHook: string;
}

/** The 22 archetypes of the Logos blueprint (3 × 7 + 1). */
export const ARCHETYPE_BLUEPRINT: readonly ArchetypeDef[] = [
  // Mind Complex (1–7)
  { number: 1, complex: 'mind', stationIndex: 1, station: 'matrix', raName: 'Matrix of the Mind', tarotName: 'The Magician', engineHook: 'wiregraph+ego-prior' },
  { number: 2, complex: 'mind', stationIndex: 2, station: 'potentiator', raName: 'Potentiator of the Mind', tarotName: 'The High Priestess', engineHook: 'excitement-compass' },
  { number: 3, complex: 'mind', stationIndex: 3, station: 'catalyst', raName: 'Catalyst of the Mind', tarotName: 'The Empress', engineHook: 'catalyst-intake' },
  { number: 4, complex: 'mind', stationIndex: 4, station: 'experience', raName: 'Experience of the Mind', tarotName: 'The Emperor', engineHook: 'preset-memory' },
  { number: 5, complex: 'mind', stationIndex: 5, station: 'significator', raName: 'Significator of the Mind', tarotName: 'The Hierophant', engineHook: 'ego-significator' },
  { number: 6, complex: 'mind', stationIndex: 6, station: 'transformation', raName: 'Transformation of the Mind', tarotName: 'The Lovers', engineHook: 'dream-rebalance' },
  { number: 7, complex: 'mind', stationIndex: 7, station: 'great-way', raName: 'Great Way of the Mind', tarotName: 'The Chariot', engineHook: 'veil-mastery' },
  // Body Complex (8–14)
  { number: 8, complex: 'body', stationIndex: 1, station: 'matrix', raName: 'Matrix of the Body', tarotName: 'Balanced Working', engineHook: 'body-homeostasis' },
  { number: 9, complex: 'body', stationIndex: 2, station: 'potentiator', raName: 'Potentiator of the Body', tarotName: 'The Hermit (Wisdom)', engineHook: 'kinetic-judgment' },
  { number: 10, complex: 'body', stationIndex: 3, station: 'catalyst', raName: 'Catalyst of the Body', tarotName: 'Wheel of Fortune', engineHook: 'somatic-intake' },
  { number: 11, complex: 'body', stationIndex: 4, station: 'experience', raName: 'Experience of the Body', tarotName: 'The Enchantress', engineHook: 'body-zones' },
  { number: 12, complex: 'body', stationIndex: 5, station: 'significator', raName: 'Significator of the Body', tarotName: 'The Hanged Man', engineHook: 'body-step' },
  { number: 13, complex: 'body', stationIndex: 6, station: 'transformation', raName: 'Transformation of the Body', tarotName: 'Death (Renewal)', engineHook: 'somatic-eureka' },
  { number: 14, complex: 'body', stationIndex: 7, station: 'great-way', raName: 'Great Way of the Body', tarotName: 'The Alchemist (Temperance)', engineHook: 'vessel-alchemy' },
  // Spirit Complex (15–21)
  { number: 15, complex: 'spirit', stationIndex: 1, station: 'matrix', raName: 'Matrix of the Spirit', tarotName: 'The Devil (Night of Soul)', engineHook: 'veil-opacity' },
  { number: 16, complex: 'spirit', stationIndex: 2, station: 'potentiator', raName: 'Potentiator of the Spirit', tarotName: 'The Lightning Struck Tower', engineHook: 'kundalini-awakening' },
  { number: 17, complex: 'spirit', stationIndex: 3, station: 'catalyst', raName: 'Catalyst of the Spirit', tarotName: 'The Star (Hope)', engineHook: 'higher-self-cue' },
  { number: 18, complex: 'spirit', stationIndex: 4, station: 'experience', raName: 'Experience of the Spirit', tarotName: 'The Moon', engineHook: 'shadow-discernment' },
  { number: 19, complex: 'spirit', stationIndex: 5, station: 'significator', raName: 'Significator of the Spirit', tarotName: 'The Sun', engineHook: 'radiant-coherence' },
  { number: 20, complex: 'spirit', stationIndex: 6, station: 'transformation', raName: 'Transformation of the Spirit', tarotName: 'Judgment (Sarcophagus)', engineHook: 'astral-resonance' },
  { number: 21, complex: 'spirit', stationIndex: 7, station: 'great-way', raName: 'Great Way of the Spirit', tarotName: 'The World (Contact)', engineHook: 'stargate-harvest' },
  // The Choice (22)
  { number: 22, complex: 'choice', stationIndex: 8, station: 'the-choice', raName: 'The Choice', tarotName: 'The Fool', engineHook: 'sovereign-faith' },
];

export type InvocableArchetypeNumber = 1 | 2 | 8 | 9 | 22;
export type InvocableArchetypeAlias =
  | 'virgin-mind'
  | 'faith'
  | 'mind:matrix'
  | 'mind:potentiator'
  | 'body:matrix'
  | 'body:potentiator'
  | 'choice:the-fool';
const INVOCABLE_NUMBERS = new Set<number>([1, 2, 8, 9, 22]);
const ALIAS_TO_INVOCABLE: Readonly<Record<InvocableArchetypeAlias, InvocableArchetypeNumber>> = {
  'virgin-mind': 1,
  faith: 22,
  'mind:matrix': 1,
  'mind:potentiator': 2,
  'body:matrix': 8,
  'body:potentiator': 9,
  'choice:the-fool': 22,
};

export interface CrossWiredPolarity {
  readonly pole: Pole;
  readonly pol: number;
  /** In Mind: intent attracts Matrix (1, Magician), context attracts Potentiator (2, High Priestess). */
  readonly mindLead: ArchetypeDef;
  readonly mindComplement: ArchetypeDef;
  /** In Body: intent attracts Potentiator (9, Hermit), context attracts Matrix (8, Balanced Working) — Session 87.28. */
  readonly bodyLead: ArchetypeDef;
  readonly bodyComplement: ArchetypeDef;
  /** Veiled instinctive bias before integration (0..1): how strongly it leans toward logic/control vs excitement/flow. */
  readonly logicControlBias: number;
  readonly excitementFlowBias: number;
  /** True when the preset has balanced its ray charges (bal >= 0.9), uniting lead and complement. */
  readonly integrated: boolean;
}

/**
 * Computes a preset's cross-wired Mind and Body archetypical attractions (Session 87.28).
 * - Intent (masculine, pol >= 32): Mind = Matrix (1, Magician / conscious logic), Body = Potentiator (9, Hermit / kinetic regulation).
 * - Context (feminine, pol <= -32): Mind = Potentiator (2, High Priestess / intuitive excitement), Body = Matrix (8, Balanced Working).
 * - Balanced (|pol| < 32): equal access to both stations; when a memory is balanced (bal >= 0.9), its complement integrates.
 */
export function crossWiredPolarity(mem: Mem): CrossWiredPolarity {
  checkMem(mem);
  const pol = polarityOf(mem);
  const pole = poleOf(pol);
  const integrated = mem.bal >= BALANCED_AT;
  const mag = Math.min(1, Math.abs(pol) / 127);
  // Behind the veil (unintegrated), the pole leans toward its mind lead; integration brings the complement up to parity.
  const skew = integrated ? mag * 0.15 : mag * 0.45;
  const logicControlBias = Math.round((0.5 + (pole === 'intent' ? skew : pole === 'context' ? -skew : 0)) * 1000) / 1000;
  const excitementFlowBias = Math.round((0.5 + (pole === 'context' ? skew : pole === 'intent' ? -skew : 0)) * 1000) / 1000;

  const magician = ARCHETYPE_BLUEPRINT[0]!;
  const highPriestess = ARCHETYPE_BLUEPRINT[1]!;
  const balancedWorking = ARCHETYPE_BLUEPRINT[7]!;
  const hermit = ARCHETYPE_BLUEPRINT[8]!;

  if (pole === 'context') {
    return {
      pole,
      pol,
      mindLead: highPriestess,
      mindComplement: magician,
      bodyLead: balancedWorking,
      bodyComplement: hermit,
      logicControlBias,
      excitementFlowBias,
      integrated,
    };
  }
  return {
    pole,
    pol,
    mindLead: magician,
    mindComplement: highPriestess,
    bodyLead: hermit,
    bodyComplement: balancedWorking,
    logicControlBias,
    excitementFlowBias,
    integrated,
  };
}

/**
 * Identifies which of the 7 stations a preset currently occupies in a given complex,
 * based on its lived experience, somatic body state, cause links, and kundalini level.
 */
export function activeArchetypeStation(mem: Mem, body?: BodyState | null, complex: 'mind' | 'body' | 'spirit' = 'mind'): ArchetypeDef {
  checkMem(mem);
  const baseOffset = complex === 'mind' ? 0 : complex === 'body' ? 7 : 14;
  const pick = (stationIdx1to7: number): ArchetypeDef => ARCHETYPE_BLUEPRINT[baseOffset + stationIdx1to7 - 1]!;

  // 7. If risen (kundalini === 7 and >= 8 episodes) and balanced, it stands in Station 7 (Great Way: Chariot / Alchemist / World).
  const k = kundalini(mem);
  if (k === 7 && mem.ep.length >= 8 && mem.bal >= BALANCED_AT) return pick(7);

  // 6. If a body checkpoint registered a Eureka or a cause link was closed while balanced (before full 8-episode rising), it is in Station 6 (Transformation).
  const hasEureka = body?.zones.some((z) => z.signal === 'eureka') ?? false;
  const hasClosedCause = mem.cause.some((c) => !c.open);
  if (hasEureka || (hasClosedCause && mem.bal >= BALANCED_AT)) return pick(6);

  // 5. If the body has an active ache, pain, or sickness, or the memory holds charge above rest, it is at Station 5 (Significator) integrating the load.
  const hasSomaticLoad = body?.zones.some((z) => z.mode !== 'flowing' || z.signal !== null) ?? false;
  if (hasSomaticLoad || mem.bal < BALANCED_AT) return pick(5);

  // 4. If episodes have been recorded and hardened (hard > 0.25), it is at Station 4 (Experience).
  if (mem.ep.length > 0 && mem.hard > 0.25) return pick(4);

  // 3. If raw episodes just arrived (hard <= 0.25), it is at Station 3 (Catalyst).
  if (mem.ep.length > 0) return pick(3);

  // 1 or 2. Fresh preset before catalyst: its pole determines whether it rests in Station 1 (Matrix) or Station 2 (Potentiator).
  return poleOf(polarityOf(mem)) === 'context' ? pick(2) : pick(1);
}

export interface ArchetypeInvocationResult {
  readonly mem: Mem;
  readonly body: BodyState | null;
  readonly invoked: ArchetypeDef;
  /** True when cognitive overload (Blue/Indigo rays 5–6 or excessive open causes) was softened. */
  readonly clearedOverload: boolean;
  readonly systemLine: string;
}

/**
 * Session 91.35 ("Dwelling in the Virgin Mind"): when a preset's conscious ideation is congested
 * (open cause links or blockage/starvation in Blue Ray 5 or Indigo Ray 6), invoking Station 1 (The Magician /
 * Virgin Mind), Station 2 (The High Priestess / Intuitive Stillness), Station 8/9 (Body Matrix/Potentiator),
 * or Station 22 (The Fool / Pure Faith) softens the cognitive loop hardness and eases active charge by at most
 * RELEASE_RATE (24) so the next bodyStep experiences a gentle 'itch' release rather than a 'pain' spike,
 * without erasing episodes or faking causal closure.
 */
export function invokeArchetype(
  mem: Mem,
  archetypeSelector: InvocableArchetypeNumber | InvocableArchetypeAlias = 1,
  body: BodyState | null = null,
): ArchetypeInvocationResult {
  checkMem(mem);
  const archetypeNumber =
    typeof archetypeSelector === 'string'
      ? ALIAS_TO_INVOCABLE[archetypeSelector]
      : archetypeSelector;
  if (!archetypeNumber || !INVOCABLE_NUMBERS.has(archetypeNumber)) {
    throw new Error(`invokeArchetype: unsupported archetype station ${String(archetypeSelector)} (expected 1, 2, 8, 9, 22, 'virgin-mind', or 'faith')`);
  }
  const invoked = ARCHETYPE_BLUEPRINT.find((a) => a.number === archetypeNumber)!;
  const openCauses = mem.cause.filter((c) => c.open);
  const upperBlocked =
    Math.abs(mem.charge[4] ?? 0) > 4 ||
    Math.abs(mem.charge[5] ?? 0) > 4 ||
    (body?.zones.some((z) => (z.ray === 5 || z.ray === 6) && z.mode !== 'flowing') ?? false);
  const overloaded = openCauses.length >= 2 || upperBlocked || mem.hard >= 0.6;

  if (!overloaded) {
    return {
      mem,
      body,
      invoked,
      clearedOverload: false,
      systemLine: `Archetype invoked: ${invoked.tarotName} (${invoked.raName}) — mind is already clear.`,
    };
  }

  // Identify rays carrying open distortions or upper-triad (Ray 5/6) blockages/occlusions
  const openDistortions = new Set(openCauses.map((c) => c.d));
  const activeRays = new Set<number>([4, 5]); // 0-based rays 4 (Throat) and 5 (Third Eye)
  for (const d of openDistortions) {
    const info = SQ_DISTORTION_CATALOG[d];
    activeRays.add(info.rayIndex - 1);
    if (info.antidoteRayIndex >= 5) activeRays.add(info.antidoteRayIndex - 1);
  }

  const ep = mem.ep.map((e) => {
    if (e.d === ALIGNED) return e;
    const r = SQ_DISTORTION_CATALOG[e.d].rayIndex;
    if (openDistortions.has(e.d) || r >= 5) {
      return { ...e, h: Math.max(0.05, Math.round(e.h * 0.5 * 1000) / 1000) };
    }
    return e;
  });

  // Ease charge on affected rays by at most RELEASE_RATE (24) so bodyStep registers a gentle 'itch' rather than 'pain'
  const charge = mem.charge.map((c, idx) => {
    if (!activeRays.has(idx) || c === 0) return c;
    const step = Math.min(RELEASE_RATE, Math.max(1, Math.trunc(Math.abs(c) * 0.5)));
    return c > 0 ? Math.max(0, c - step) : Math.min(0, c + step);
  });

  const nextMem = checkMem({
    ...mem,
    hard: Math.round(mem.hard * 0.75 * 1000) / 1000,
    bal: memoryBalance(charge),
    charge,
    ep,
  });

  const nextBody: BodyState | null = body
    ? {
        ...body,
        zones: body.zones.map((z) => ({
          ...z,
          rebound: 0,
          ache: Math.round(z.ache * 0.5 * 1000) / 1000,
        })),
      }
    : null;

  return {
    mem: nextMem,
    body: nextBody,
    invoked,
    clearedOverload: true,
    systemLine: `Blueprint invoked: ${invoked.tarotName} (${invoked.raName}) — cognitive loop softened.`,
  };
}
