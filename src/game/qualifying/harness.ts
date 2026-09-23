/**
 * T04 — the one-call heat runner.
 *
 * `runQualifyingHeat` normalizes a configuration, plays every participant's isolated attempt to the
 * end of the heat, and hands back the ranked table with a **fingerprint** of the result. The
 * fingerprint is what makes the reproducibility criterion testable without diffing floating-point
 * arrays by hand: two sessions built from the same seed and the same field must print the same digest,
 * and the digest changes when anything that decides a place changes.
 *
 * This is also what `scripts/qualifying-harness.ts` drives, so the printed report and the tests are
 * reading the same code path a staging screen will use later.
 */
import { normalizeRaceConfig, type RaceConfigV1 } from '../contracts/config';
import type { QualifyingEntry, RankedQualifyingEntry } from '../contracts/qualifying';
import { qualifyingCounts } from '../contracts/qualifying';
import { createQualifyingSession, type ParticipantReport, type QualifyingSession, type QualifyingSessionOptions } from './session';

export interface RunHeatOptions extends Omit<QualifyingSessionOptions, 'config'> {
  /** A `RaceConfigV1`, or any historical/partial config shape for `normalizeRaceConfig` to load. */
  readonly config: RaceConfigV1 | Record<string, unknown>;
  /** Extra tick budget beyond the computed bound. A heat should never need it; it keeps a bug honest. */
  readonly extraTicks?: number;
}

export interface RunHeatResult {
  readonly session: QualifyingSession;
  readonly config: RaceConfigV1;
  readonly repairs: readonly string[];
  readonly entries: readonly QualifyingEntry[];
  readonly ranked: readonly RankedQualifyingEntry[];
  readonly report: readonly ParticipantReport[];
  readonly ticks: number;
  readonly seconds: number;
  readonly counts: Readonly<{ valid: number; fallback: number }>;
  /** FNV-1a over the canonical ranking table. Same heat, same digest. */
  readonly fingerprint: string;
}

/** Canonical text for a ranking: every field that may decide a place, in a fixed order and format. */
export function rankingTable(entries: readonly RankedQualifyingEntry[]): string {
  return entries.map((entry) => [
    entry.rank,
    entry.racerId,
    entry.status,
    entry.fallback ?? '-',
    entry.time === null ? '-' : entry.time.toFixed(6),
    entry.speed.toFixed(6),
    entry.peakSpeed.toFixed(6),
    entry.attempt,
    entry.advanced ? 'A' : '-',
    entry.rewardRolled ? 'R' : '-',
  ].join(':')).join('|');
}

/** 32-bit FNV-1a, printed as hex. Deterministic, dependency-free, good enough for a regression pin. */
export function fingerprintOf(table: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < table.length; index++) {
    hash ^= table.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function runQualifyingHeat(options: RunHeatOptions): RunHeatResult {
  const normalization = normalizeRaceConfig(options.config);
  const { config, repairs } = normalization;
  const session = createQualifyingSession({ ...options, config });
  session.run(session.maxTicks + (options.extraTicks ?? 0));
  const ranked = session.ranked();
  const table = rankingTable(ranked);
  return {
    session,
    config,
    repairs,
    entries: session.entries(),
    ranked,
    report: session.report(),
    ticks: session.tick,
    seconds: session.time,
    counts: qualifyingCounts(session.entries()),
    fingerprint: fingerprintOf(table),
  };
}
