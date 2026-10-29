/**
 * Plan 58 Wave 3 (Track 3): Ra's 7-Station Archetypical Mind Blueprint (`packages/harness/src/archetypical-mind.ts`).
 *
 * Formalizes the 7 Archetypical Stations across Mind (1–7), Body (8–14), and Spirit (15–21), plus 22 (The Choice / The Fool):
 *   1. Matrix         (Mind: The Magician         | Body: Balanced Working  | Spirit: The Devil)
 *   2. Potentiator    (Mind: The High Priestess   | Body: The Hermit        | Spirit: The Lightning Struck Tower)
 *   3. Catalyst       (Mind: The Empress          | Body: Wheel of Fortune  | Spirit: The Star)
 *   4. Experience     (Mind: The Emperor          | Body: The Enchantress   | Spirit: The Moon)
 *   5. Significator   (Mind: The Hierophant       | Body: The Hanged Man    | Spirit: The Sun)
 *   6. Transformation (Mind: The Lovers           | Body: Death / Renewal   | Spirit: Judgment / Sarcophagus)
 *   7. Great Way      (Mind: The Chariot          | Body: The Alchemist     | Spirit: The World)
 *  22. The Choice     (The Fool — pure sovereign faith across the Veil)
 *
 * Cross-Wired Polarity (Law of One Session 87.28 & 78.11):
 * - Masculine Polarity (`intent`, `pol >= 32`):
 *   - Mind Lead: Station 1 (Matrix of the Mind / The Magician — conscious will & logical structure)
 *   - Body Lead: Station 9 (Potentiator of the Body / The Hermit — kinetic discipline & regulation)
 * - Feminine Polarity (`context`, `pol <= -32`):
 *   - Mind Lead: Station 2 (Potentiator of the Mind / The High Priestess — intuitive sea across the Veil)
 *   - Body Lead: Station 8 (Matrix of the Body / Balanced Working — continuous somatic homeostasis)
 *
 * Session 91.35 ("Dwelling in the Virgin Mind"):
 * - Calling `invokeArchetype(stationId, mem, body)` (or `invokeArchetype(mem, stationId, body)`) on the Virgin Mind
 *   (`'mind:matrix'` / `'virgin-mind'` / `1`) or Faith (`'choice:the-fool'` / `'faith'` / `22`) clears Blue/Indigo
 *   (Ray 5/6) over-activation when open cause links clutter the mind, easing charge by at most `RELEASE_RATE` (24)
 *   so the next `bodyStep` registers a gentle `'itch'` release rather than a `'pain'` rebound.
 *
 * 100% pure and deterministic (no Date.now, no Math.random, no DOM/I/O).
 */
import type { Mem } from '@hm/shorthand';
import {
  ARCHETYPE_BLUEPRINT,
  activeArchetypeStation,
  crossWiredPolarity,
  invokeArchetype as invokeArchetypeByNumber,
  type ArchetypeComplex,
  type ArchetypeDef,
  type ArchetypeInvocationResult,
  type ArchetypeStationKind,
  type CrossWiredPolarity,
  type InvocableArchetypeNumber,
} from './archetypes.js';
import type { BodyState } from './body.js';

export type SymbolicStationId =
  | 'virgin-mind'
  | 'faith'
  | 'mind:matrix'
  | 'mind:potentiator'
  | 'mind:catalyst'
  | 'mind:experience'
  | 'mind:significator'
  | 'mind:transformation'
  | 'mind:great-way'
  | 'body:matrix'
  | 'body:potentiator'
  | 'body:catalyst'
  | 'body:experience'
  | 'body:significator'
  | 'body:transformation'
  | 'body:great-way'
  | 'spirit:matrix'
  | 'spirit:potentiator'
  | 'spirit:catalyst'
  | 'spirit:experience'
  | 'spirit:significator'
  | 'spirit:transformation'
  | 'spirit:great-way'
  | 'choice:the-fool';

export type ArchetypeStationSelector = InvocableArchetypeNumber | SymbolicStationId | number;

export interface SevenStationRoleSpec {
  readonly stationIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly station: Exclude<ArchetypeStationKind, 'the-choice'>;
  readonly title: string;
  readonly mindTarot: string;
  readonly bodyTarot: string;
  readonly spiritTarot: string;
  readonly functionalLaw: string;
}

/** The 7 functional stations shared across Mind, Body, and Spirit complexes. */
export const SEVEN_STATION_ROLES: readonly SevenStationRoleSpec[] = [
  {
    stationIndex: 1,
    station: 'matrix',
    title: '1. Matrix (That Which Reaches)',
    mindTarot: 'The Magician',
    bodyTarot: 'Balanced Working',
    spiritTarot: 'The Devil (Night of Soul)',
    functionalLaw: 'Unfettered conscious will in Mind; somatic homeostasis in Body; primeval darkness before dawn in Spirit.',
  },
  {
    stationIndex: 2,
    station: 'potentiator',
    title: '2. Potentiator (That Which Awaits)',
    mindTarot: 'The High Priestess',
    bodyTarot: 'The Hermit (Wisdom)',
    spiritTarot: 'The Lightning Struck Tower',
    functionalLaw: 'Vast intuitive sea across the Veil in Mind; kinetic wisdom regulating action in Body; sudden illumination in Spirit.',
  },
  {
    stationIndex: 3,
    station: 'catalyst',
    title: '3. Catalyst (Raw Experience Offered)',
    mindTarot: 'The Empress',
    bodyTarot: 'Wheel of Fortune',
    spiritTarot: 'The Star (Hope)',
    functionalLaw: 'Unfiltered sensory/emotional catalyst entering through the Veil to test polarity and balance.',
  },
  {
    stationIndex: 4,
    station: 'experience',
    title: '4. Experience (Distilled Bias)',
    mindTarot: 'The Emperor',
    bodyTarot: 'The Enchantress',
    spiritTarot: 'The Moon',
    functionalLaw: 'Catalyst processed and seated into firm memory bias (`ep` + `hard` + `charge`).',
  },
  {
    stationIndex: 5,
    station: 'significator',
    title: '5. Significator (The Self That Harvests)',
    mindTarot: 'The Hierophant',
    bodyTarot: 'The Hanged Man',
    spiritTarot: 'The Sun',
    functionalLaw: 'The integrated core actor (`ego` / `preset-body`) bearing the weight of its open causes and ray charges.',
  },
  {
    stationIndex: 6,
    station: 'transformation',
    title: '6. Transformation (Crucible & Release)',
    mindTarot: 'The Lovers',
    bodyTarot: 'Death (Renewal)',
    spiritTarot: 'Judgment (Sarcophagus)',
    functionalLaw: 'Dreaming and somatic Eureka: releasing held distortion and closing open cause links.',
  },
  {
    stationIndex: 7,
    station: 'great-way',
    title: '7. Great Way (Environment & Mastery)',
    mindTarot: 'The Chariot',
    bodyTarot: 'The Alchemist (Temperance)',
    spiritTarot: 'The World (Contact)',
    functionalLaw: 'Full 7-ray kundalini ascent and sovereign architecture across the world.',
  },
];

const SYMBOLIC_TO_NUMBER: Readonly<Record<SymbolicStationId, number>> = {
  'virgin-mind': 1,
  faith: 22,
  'mind:matrix': 1,
  'mind:potentiator': 2,
  'mind:catalyst': 3,
  'mind:experience': 4,
  'mind:significator': 5,
  'mind:transformation': 6,
  'mind:great-way': 7,
  'body:matrix': 8,
  'body:potentiator': 9,
  'body:catalyst': 10,
  'body:experience': 11,
  'body:significator': 12,
  'body:transformation': 13,
  'body:great-way': 14,
  'spirit:matrix': 15,
  'spirit:potentiator': 16,
  'spirit:catalyst': 17,
  'spirit:experience': 18,
  'spirit:significator': 19,
  'spirit:transformation': 20,
  'spirit:great-way': 21,
  'choice:the-fool': 22,
};

/** Resolves any numeric (`1..22`) or symbolic (`'mind:matrix'`, `'virgin-mind'`, `'faith'`) station selector to its `ArchetypeDef`. */
export function resolveArchetypeStation(selector: ArchetypeStationSelector): ArchetypeDef {
  const num = typeof selector === 'string' ? SYMBOLIC_TO_NUMBER[selector] : selector;
  const found = ARCHETYPE_BLUEPRINT.find((a) => a.number === num);
  if (!found) {
    throw new Error(`Unknown archetype station selector: ${String(selector)}`);
  }
  return found;
}

/** Looks up the `ArchetypeDef` for a given complex (`mind | body | spirit`) and station index (`1..7`), or `22` for `choice`. */
export function getComplexStation(
  complex: ArchetypeComplex,
  stationIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1,
): ArchetypeDef {
  if (complex === 'choice') return ARCHETYPE_BLUEPRINT[21]!;
  const offset = complex === 'mind' ? 0 : complex === 'body' ? 7 : 14;
  return ARCHETYPE_BLUEPRINT[offset + stationIndex - 1]!;
}

export interface SevenStationEvaluation {
  readonly mindStation: ArchetypeDef;
  readonly bodyStation: ArchetypeDef;
  readonly spiritStation: ArchetypeDef;
  readonly choiceStation: ArchetypeDef;
  readonly crossWiring: CrossWiredPolarity;
  readonly blueIndigoOveractivated: boolean;
  readonly recommendedInvocation: 'virgin-mind' | 'faith' | null;
}

/**
 * Evaluates a preset's position across all three 7-Station cycles (`mind`, `body`, `spirit`), its Session 87.28
 * cross-wired polarity, and whether Blue/Indigo (Ray 5/6) over-activation calls for dwelling in the Virgin Mind (91.35).
 */
export function evaluateSevenStationCycle(mem: Mem, body: BodyState | null = null): SevenStationEvaluation {
  const mindStation = activeArchetypeStation(mem, body, 'mind');
  const bodyStation = activeArchetypeStation(mem, body, 'body');
  const spiritStation = activeArchetypeStation(mem, body, 'spirit');
  const choiceStation = ARCHETYPE_BLUEPRINT[21]!;
  const crossWiring = crossWiredPolarity(mem);

  const openCauses = mem.cause.filter((c) => c.open).length;
  const blueIndigoOveractivated =
    Math.abs(mem.charge[4] ?? 0) > 4 ||
    Math.abs(mem.charge[5] ?? 0) > 4 ||
    openCauses >= 2 ||
    (body?.zones.some((z) => (z.ray === 5 || z.ray === 6) && z.mode !== 'flowing') ?? false);

  const recommendedInvocation: 'virgin-mind' | 'faith' | null = blueIndigoOveractivated
    ? openCauses >= 2
      ? 'virgin-mind'
      : 'faith'
    : null;

  return {
    mindStation,
    bodyStation,
    spiritStation,
    choiceStation,
    crossWiring,
    blueIndigoOveractivated,
    recommendedInvocation,
  };
}

/**
 * Session 91.35: Invokes an Archetypical Station by symbolic ID (`'virgin-mind'`, `'faith'`, `'mind:matrix'`,
 * `'mind:potentiator'`, `'body:matrix'`, `'body:potentiator'`, `'choice:the-fool'`) or number (`1..22`)
 * to clear Blue/Indigo cognitive over-activation when open cause links clutter the mind.
 * Accepts either `(stationId, mem, body)` or `(mem, stationId, body)`.
 */
export function invokeArchetypeStation(
  first: ArchetypeStationSelector | Mem,
  second: Mem | ArchetypeStationSelector = 'virgin-mind',
  body: BodyState | null = null,
): ArchetypeInvocationResult {
  const isFirstMem = typeof first === 'object' && first !== null && 'of' in first;
  const mem = (isFirstMem ? first : second) as Mem;
  const stationId = (isFirstMem ? second : first) as ArchetypeStationSelector;
  const def = resolveArchetypeStation(stationId);
  const invocableNum: InvocableArchetypeNumber =
    def.number === 1 || def.number === 2 || def.number === 8 || def.number === 9 || def.number === 22
      ? (def.number as InvocableArchetypeNumber)
      : def.complex === 'body'
        ? 8
        : def.complex === 'spirit'
          ? 22
          : 1;
  return invokeArchetypeByNumber(mem, invocableNum, body);
}

