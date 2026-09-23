/**
 * T04 — isolated qualifying attempts and canonical gate timing. Public surface.
 *
 * ```ts
 * import { runQualifyingHeat, normalizeRaceConfig } from './game/qualifying';
 *
 * const { config } = normalizeRaceConfig({ fieldSize: 20, participants: syntheticField(20, seed) });
 * const heat = runQualifyingHeat({ config, humanControl: 'auto' });
 * heat.session.ranked();   // valid times first, every fallback class behind them
 * ```
 *
 * Everything here is headless on purpose: no DOM, no canvas, no renderer. A heat can be stepped in a
 * test process, and the same code path is what T06 will drive from a staging screen.
 */
export {
  CANONICAL_SEGMENTS, DEFAULT_SEGMENT_PROVIDER, LOOP_SEGMENT_PREFIX,
  canonicalSpeed, createQualifyingGate, crossingInput, evaluateCrossing, findFirstLoop,
  loopEngagementReach, loopSegmentOf, recordCrossing, segmentAtX, segmentForStep, speedToDisplay, surfaceAltitude,
  type CanonicalSegment, type GateCrossing, type PositionSample, type QualifyingGateSpec,
  type SegmentProvider, type SegmentView,
} from './gate';
export {
  AIM_ANGLE_MAX, AIM_ANGLE_MIN, AIM_POWER_MAX, AIM_POWER_MIN, RETRY_DELAY_SECONDS, SYNTHETIC_COLORS,
  attemptSeed, clampedLaunchAngle, createAttemptRacer, cpuAim, freezeStagedState, heatSeed,
  humanAim, initialDecisionDelay, launchAngleOffset, launchDelay, launchVelocityFor, legacyParticipants,
  participantsFromConfig, resetToStagedState, syntheticField,
  type LaunchAim, type QualifyingParticipant, type StagedState,
} from './field';
export {
  ATTEMPT_MAX_RECOVERIES, ATTEMPT_STEP, QualifyingAttempt,
  type AttemptConfig, type AttemptOutcome, type AttemptPhase, type AttemptPickup, type AttemptRejection,
  type AttemptSnapshot,
} from './attempt';
export {
  CPU_RETRY_GAP, SESSION_STEP, createQualifyingSession, cpuLaunchAim, participantEntry,
  type MysterySessionOptions, type ParticipantReport, type ParticipantState,
  type QualifyingSession, type QualifyingSessionOptions, type SessionSnapshot, type SessionStatus,
} from './session';
export {
  MYSTERY_ALTITUDE_BAND, MYSTERY_APPROACH_UNITS, MYSTERY_EFFECTS, createMysteryLedger,
  mysteryPickup, recordedResolver,
  type MysteryLedger, type MysteryOptions, type MysteryRoute,
} from './mystery';
export { QualifyingError, isQualifyingError, type QualifyingErrorCode } from './errors';
export { runQualifyingHeat, type RunHeatOptions, type RunHeatResult } from './harness';
