/**
 * T01 — configuration defaults and backward-compatible loading.
 *
 * The frozen rule: **an old config loads as four racers with qualifying disabled.** A
 * config may only claim a larger field when it also carries explicit participant records,
 * because T02 has to keep every participant's identity stable; nothing here invents
 * racers or loadouts to pad a field.
 *
 * `normalizeRaceConfig` never throws on hostile input. It repairs to canonical data and
 * reports what it changed, which is what the T04/T12 error-handling acceptance expects.
 */

import { DEFAULT_LOADOUT, isCapsule, isRider, opponentLoadouts, type Loadout } from '../loadouts';
import { COURSES, RACER_DEFINITIONS, type CourseId } from '../types';
import { createRacerRegistry } from './identity';
import {
  CONTRACTS_VERSION, ContractError, clamp, frozenArray, isFiniteNumber, isPlainObject,
  isSafeRacerId, safeRecord,
} from './core';

/** Field sizes the roadmap has to support. Four is the legacy shape and the default. */
export const FIELD_SIZES = [4, 20, 50, 100] as const;
export type FieldSize = (typeof FIELD_SIZES)[number];
export const MAX_RACERS = 100;
export const LEGACY_FIELD_SIZE: FieldSize = 4;
/** Above four participants a heat needs qualifying; at four it is disabled. */
export const QUALIFYING_REQUIRED_ABOVE = 4;

export interface QualifyingConfig {
  readonly enabled: boolean;
  /** Retries after the first attempt: two retries, so three attempts in total. */
  readonly retries: number;
  /** Fixed deadline per attempt, in seconds. Never grows with the racer index. */
  readonly deadlineSeconds: number;
}

export const QUALIFYING_RETRIES = 2;
export const QUALIFYING_ATTEMPTS = QUALIFYING_RETRIES + 1;
export const QUALIFYING_DEADLINE_SECONDS = 20;
export const DEFAULT_QUALIFYING: QualifyingConfig = Object.freeze({
  enabled: false, retries: QUALIFYING_RETRIES, deadlineSeconds: QUALIFYING_DEADLINE_SECONDS,
});

export interface ParticipantConfig {
  readonly id: number;
  readonly name: string;
  readonly homeLane: number;
  readonly pace: number;
  readonly loadout: Loadout;
  readonly isPlayer: boolean;
}

export interface RaceConfigV1 {
  readonly version: typeof CONTRACTS_VERSION;
  readonly fieldSize: FieldSize;
  readonly course: CourseId;
  readonly seed: number;
  readonly qualifying: QualifyingConfig;
  readonly participants: readonly ParticipantConfig[];
  readonly customPhysics: boolean;
}

/** Deterministic default so a fresh run is reproducible before any seed is chosen. */
export const DEFAULT_SEED = 1;

export const COURSE_IDS: readonly CourseId[] = frozenArray(COURSES.map((course) => course.id));

export function isFieldSize(value: unknown): value is FieldSize {
  return typeof value === 'number' && (FIELD_SIZES as readonly number[]).includes(value);
}

export function isCourseId(value: unknown): value is CourseId {
  return typeof value === 'string' && (COURSE_IDS as readonly string[]).includes(value);
}

export function isQualifyingConfig(value: unknown): value is QualifyingConfig {
  return isPlainObject(value)
    && typeof value.enabled === 'boolean'
    && isFiniteNumber(value.retries) && value.retries >= 0
    && isFiniteNumber(value.deadlineSeconds) && value.deadlineSeconds > 0;
}

/** Canonical four-racer field, reused by every legacy path. */
export function defaultParticipants(loadout: Loadout = DEFAULT_LOADOUT): readonly ParticipantConfig[] {
  const roster = opponentLoadouts(loadout);
  return frozenArray(RACER_DEFINITIONS.map((definition) => Object.freeze({
    id: definition.id,
    name: definition.name,
    homeLane: definition.homeLane,
    pace: definition.pace,
    loadout: Object.freeze({ ...(roster[definition.id] ?? loadout) }),
    isPlayer: definition.id === 0,
  })));
}

function normalizeLoadout(raw: unknown, fallback: Loadout): Loadout {
  const record = safeRecord(raw);
  return Object.freeze({
    rider: isRider(record.rider) ? record.rider : fallback.rider,
    capsule: isCapsule(record.capsule) ? record.capsule : fallback.capsule,
  });
}

function normalizeParticipant(raw: unknown, position: number, fallback: ParticipantConfig): ParticipantConfig {
  const record = safeRecord(raw);
  const canonical = RACER_DEFINITIONS[position];
  const id = isSafeRacerId(record.id) ? record.id : canonical?.id ?? position;
  return Object.freeze({
    id,
    name: typeof record.name === 'string' && record.name.trim() !== '' ? record.name.trim().slice(0, 24) : canonical?.name ?? `RACER ${id}`,
    homeLane: isFiniteNumber(record.homeLane) ? Math.round(record.homeLane) : canonical?.homeLane ?? position % 4,
    pace: isFiniteNumber(record.pace) && record.pace > 0.5 && record.pace < 1.5 ? record.pace : canonical?.pace ?? 1,
    loadout: normalizeLoadout(record.loadout, fallback.loadout),
    isPlayer: record.isPlayer === true || (record.isPlayer === undefined && id === 0),
  });
}

export interface ConfigNormalization {
  readonly config: RaceConfigV1;
  /** Plain-language repairs, in the order they were applied. */
  readonly repairs: readonly string[];
  readonly source: 'v1' | 'legacy' | 'repaired';
}

/**
 * Loads any historical or partial configuration.
 *
 * Accepted shapes:
 * - `undefined` / `null` / `{}` / an unknown object  → legacy four-racer field.
 * - a `RaceConfig`/`RaceSetup`-style document (mode, course, roster, customPhysics).
 * - a v1 document (`version: 1`, must carry a participant list matching its field size).
 */
export function normalizeRaceConfig(raw: unknown): ConfigNormalization {
  const repairs: string[] = [];
  const record = isPlainObject(raw) ? raw : {};
  if (raw !== undefined && raw !== null && !isPlainObject(raw)) repairs.push('Configuration was not an object; using the default four-racer field.');

  // Roster: legacy setups carry `roster` as a Loadout array; index 0 is the player.
  const rosterRaw = Array.isArray(record.roster) ? record.roster : [];
  const playerLoadout = normalizeLoadout(record.loadout ?? rosterRaw[0], DEFAULT_LOADOUT);
  const legacyParticipants = defaultParticipants(playerLoadout);

  const course: CourseId = isCourseId(record.course) ? record.course : 'ridge';
  if (record.course !== undefined && !isCourseId(record.course)) repairs.push(`Unknown course "${String(record.course)}"; falling back to ridge.`);

  let fieldSize: FieldSize = LEGACY_FIELD_SIZE;
  if (record.fieldSize !== undefined) {
    if (isFieldSize(record.fieldSize)) fieldSize = record.fieldSize;
    else repairs.push(`Unsupported field size ${String(record.fieldSize)}; using ${LEGACY_FIELD_SIZE} participants.`);
  }

  let participants: readonly ParticipantConfig[] = legacyParticipants;
  const rawParticipants = Array.isArray(record.participants) ? record.participants : null;
  if (rawParticipants) {
    if (rawParticipants.length !== fieldSize) {
      repairs.push(`Participant list has ${rawParticipants.length} entries but fieldSize is ${fieldSize}; using the canonical ${LEGACY_FIELD_SIZE}-racer field.`);
      fieldSize = LEGACY_FIELD_SIZE;
    } else {
      const normalized = rawParticipants.map((entry, position) => normalizeParticipant(entry, position, legacyParticipants[position] ?? legacyParticipants[0]));
      const unique = new Set(normalized.map((participant) => participant.id));
      if (unique.size !== normalized.length) {
        repairs.push('Participant IDs were duplicated; using the canonical four-racer field.');
        fieldSize = LEGACY_FIELD_SIZE;
      } else {
        participants = frozenArray(normalized);
      }
    }
  } else if (fieldSize > LEGACY_FIELD_SIZE) {
    repairs.push(`No participant list was supplied for a ${fieldSize}-racer field; using the canonical ${LEGACY_FIELD_SIZE}-racer field.`);
    fieldSize = LEGACY_FIELD_SIZE;
  }

  // Qualifying is required above four participants and disabled at four.
  const requested = safeRecord(record.qualifying);
  let qualifying: QualifyingConfig = Object.freeze({
    enabled: fieldSize > QUALIFYING_REQUIRED_ABOVE,
    retries: isFiniteNumber(requested.retries) && requested.retries >= 0 ? Math.round(requested.retries) : QUALIFYING_RETRIES,
    deadlineSeconds: isFiniteNumber(requested.deadlineSeconds) && requested.deadlineSeconds > 0
      ? clamp(requested.deadlineSeconds, 1, 600) : QUALIFYING_DEADLINE_SECONDS,
  });
  if (qualifying.enabled && requested.enabled === false) {
    repairs.push(`A ${fieldSize}-racer field always qualifies; the stored "qualifying disabled" flag was ignored.`);
  }
  if (!qualifying.enabled && requested.enabled === true) {
    repairs.push(`Qualifying is disabled for a ${fieldSize}-racer field; the stored flag was ignored.`);
  }

  const seed = isFiniteNumber(record.seed) && Number.isSafeInteger(record.seed) ? record.seed : DEFAULT_SEED;
  if (record.seed !== undefined && seed === DEFAULT_SEED && record.seed !== DEFAULT_SEED) repairs.push('Seed was not a safe integer; using the default seed 1.');

  const customPhysics = record.customPhysics === true;
  const source: ConfigNormalization['source'] = repairs.length ? 'repaired' : record.version === CONTRACTS_VERSION ? 'v1' : 'legacy';

  const config: RaceConfigV1 = Object.freeze({
    version: CONTRACTS_VERSION,
    fieldSize,
    course,
    seed,
    qualifying,
    participants,
    customPhysics,
  });

  // A registry build here is the cheap proof that identity is dense and unique.
  createRacerRegistry(participants.map((participant) => participant.id));

  return { config, repairs: frozenArray(repairs), source };
}

/** Structural invariants a normalized config must always satisfy. Empty means valid. */
export function validateRaceConfig(config: RaceConfigV1): readonly string[] {
  const problems: string[] = [];
  if (config.version !== CONTRACTS_VERSION) problems.push(`Config version ${String(config.version)} is not ${CONTRACTS_VERSION}.`);
  if (config.participants.length !== config.fieldSize) {
    problems.push(`fieldSize ${config.fieldSize} does not match ${config.participants.length} participants.`);
  }
  if (config.fieldSize > QUALIFYING_REQUIRED_ABOVE && !config.qualifying.enabled) {
    problems.push(`A ${config.fieldSize}-racer field must qualify.`);
  }
  if (config.fieldSize <= QUALIFYING_REQUIRED_ABOVE && config.qualifying.enabled) {
    problems.push(`Qualifying must be disabled at ${config.fieldSize} participants.`);
  }
  if (!isCourseId(config.course)) problems.push(`Unknown course "${String(config.course)}".`);
  if (!Number.isSafeInteger(config.seed)) problems.push(`Seed ${String(config.seed)} is not a safe integer.`);
  const ids = new Set<number>();
  for (const participant of config.participants) {
    if (!isSafeRacerId(participant.id)) problems.push(`Participant ID ${String(participant.id)} is not a non-negative safe integer.`);
    if (ids.has(participant.id)) problems.push(`Participant ID ${participant.id} is duplicated.`);
    ids.add(participant.id);
  }
  if (!config.participants.some((participant) => participant.isPlayer)) problems.push('No participant is marked as the local player.');
  return frozenArray(problems);
}

/** Throws unless the config is internally consistent. Used by the headless seam. */
export function assertRaceConfig(config: RaceConfigV1): RaceConfigV1 {
  const problems = validateRaceConfig(config);
  if (problems.length) {
    throw new ContractError('E_CONTRACT_SHAPE', `Race configuration is invalid: ${problems.join(' ')}`, { problems });
  }
  return config;
}
