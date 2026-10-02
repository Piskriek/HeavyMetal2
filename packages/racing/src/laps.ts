import { onTrack, project, trackLength, type Track, type Vec2 } from './track';

export interface LapState {
  lap: number;
  progress: number;
  finished: boolean;
  lapCompleted: boolean;
}

export interface LapTracker {
  update(p: Vec2): LapState;
  reset(): void;
  readonly state: LapState;
}

const CHECKPOINT_COUNT = 8;

function signedLoopDelta(previous: number, current: number, length: number): number {
  let delta = current - previous;
  if (delta > length / 2) delta -= length;
  else if (delta < -length / 2) delta += length;
  return delta;
}

function firstCheckpointAfter(s: number, length: number, spacing: number): number {
  let target = Math.floor(s / length) * length + spacing;
  if (target <= s) target += length;
  return target;
}

function staysOnTrack(track: Track, from: Vec2, to: Vec2): boolean {
  if (!onTrack(track, from) || !onTrack(track, to)) return false;

  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const travel = Math.sqrt(dx * dx + dz * dz);
  if (travel === 0) return true;

  const spacing = Math.max(0.25, Math.min(2, track.width > 0 ? track.width / 4 : 0.25));
  const steps = Math.min(512, Math.ceil(travel / spacing));
  for (let step = 1; step < steps; step += 1) {
    const fraction = step / steps;
    const sample: Vec2 = [from[0] + dx * fraction, from[1] + dz * fraction];
    if (!onTrack(track, sample)) return false;
  }
  return true;
}

export function createLapTracker(track: Track, laps: number): LapTracker {
  if (!Number.isInteger(laps) || laps < 1) {
    throw new RangeError('laps must be a positive integer.');
  }

  const length = trackLength(track);
  const spacing = length / CHECKPOINT_COUNT;
  let completedLaps = 0;
  let previousS: number | undefined;
  let previousPoint: Vec2 | undefined;
  let unwrappedS: number | undefined;
  let nextCheckpoint = 1;
  let nextTarget = 0;
  let currentState: LapState = { lap: 1, progress: 0, finished: false, lapCompleted: false };

  const resetCheckpointSequence = (s: number): void => {
    nextCheckpoint = 1;
    nextTarget = firstCheckpointAfter(s, length, spacing);
  };

  return {
    update(p: Vec2): LapState {
      let lapCompleted = false;
      const projection = project(track, p);

      if (length > 0) {
        if (previousS === undefined || previousPoint === undefined || unwrappedS === undefined) {
          previousS = projection.s;
          previousPoint = [p[0], p[1]];
          unwrappedS = projection.s;
          resetCheckpointSequence(projection.s);
        } else {
          const delta = signedLoopDelta(previousS, projection.s, length);
          const validTravel = staysOnTrack(track, previousPoint, p);

          if (!validTravel) {
            // A gap in the drivable corridor invalidates any partially completed lap.
            unwrappedS = projection.s;
            resetCheckpointSequence(projection.s);
          } else {
            const nextUnwrappedS = unwrappedS + delta;
            if (delta > 0 && completedLaps < laps) {
              while (nextUnwrappedS >= nextTarget) {
                if (nextCheckpoint === 0) {
                  completedLaps += 1;
                  lapCompleted = true;
                  nextCheckpoint = 1;
                } else if (nextCheckpoint < CHECKPOINT_COUNT - 1) {
                  nextCheckpoint += 1;
                } else {
                  nextCheckpoint = 0;
                }
                nextTarget += spacing;
              }
            }
            unwrappedS = nextUnwrappedS;
          }

          previousS = projection.s;
          previousPoint = [p[0], p[1]];
        }
      }

      const finished = completedLaps >= laps;
      const projectedProgress = length > 0 ? completedLaps + projection.s / length : 0;
      const progress = Math.min(laps, Math.max(currentState.progress, projectedProgress));
      currentState = {
        lap: Math.min(completedLaps + 1, laps),
        progress,
        finished,
        lapCompleted,
      };
      return { ...currentState };
    },
    reset(): void {
      completedLaps = 0;
      previousS = undefined;
      previousPoint = undefined;
      unwrappedS = undefined;
      nextCheckpoint = 1;
      nextTarget = 0;
      currentState = { lap: 1, progress: 0, finished: false, lapCompleted: false };
    },
    get state(): LapState {
      return { ...currentState };
    },
  };
}