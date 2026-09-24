/**
 * M01 · T2 — the first-loop merge pool (IF-MERGE).
 *
 * The mission's rule for the sorting loop is a queueing rule: everyone who reaches the loop goes into
 * a pool, the pool readies up, a countdown runs, and the riders are let go **one at a time in the
 * order they arrived**, so that the order they leave the loop in is the order they entered it in,
 * with no contact inside. After that the gloves come off.
 *
 * This module is the whole of that policy as a pure, tick-driven state machine. It owns no THREE,
 * no DOM, no timers and no randomness: the engine steps it once per physics tick and reads back
 * which racers to release. Every deadline is an integer tick count, which is what makes the pool
 * pausable — a pause simply stops the ticks, and every release moves by exactly the ticks lost
 * (acceptance AC-9).
 *
 * Phases: `open` (riders still arriving) → `closed` (everyone is held, or the wait ran out) →
 * `countdown` (3 … 2 … 1 … GO!) → `releasing` (ordered release, one at a time) → `done`.
 *
 * Two behaviours go beyond the flat interface and are here because the acceptance criteria need
 * them:
 *   - `rank`/`aligning`: a held rider waits in their own lane (`slotZ`), and the rider who is next
 *     to be released slides across to the loop's lane before they go. A rider released in the wrong
 *     lane would simply *skip* the lane-filtered sorting loop, and then the exit order could not
 *     follow the entry order at all.
 *   - `candidateAligned`: the release of that sliding rider waits for them to arrive (bounded by
 *     `ALIGN_MAX_TICKS`, after which they are released anyway and flagged `alignForced`).
 */
import { LANE_WIDTH, laneZ } from '../scene';

/* -----------------------------------------------------------------------------
   1. FROZEN CONSTANTS (IF-MERGE, D8 + D9)
   -------------------------------------------------------------------------- */

/** Ticks a bot is held before readying, before its rank term is added. */
export const BOT_READY_BASE_TICKS = 90;
/** Extra hold per place in the entry order: the riders who queued first ready first. */
export const BOT_READY_RANK_TICKS = 30;
/** The pool gives up waiting for stragglers this long after the first entry. */
/**
 * M01 · T1c — **which loop the field is sorted at**, zero-based in down-range order.
 *
 * The pool used to anchor at the course's *first* loop. Measured on the real layouts, that loop is
 * `1.93 s` from the shove on **every** course — the start pad crests 300 units above it — so the
 * ready-up panel arrived two seconds into the run, and every rider's split read ~2 s. The opening
 * stint is supposed to be the player's first split, so the sort moved to the loop at the bottom of
 * the opening descent (`2`, the third loop):
 *
 * | loop | ridge | boomtown | sheep |
 * | --- | --- | --- | --- |
 * | 1 | 1.93 s | 1.93 s | 1.93 s |
 * | **2 (sorted here)** | **9.36 s** | **9.99 s** | **12.68 s** |
 * | 3 | 12.82 s | 13.47 s | — |
 *
 * The field now rides the first loop (and the crest, and the gap) before anyone queues, and the
 * split is the run they actually made. One number: move it to `1` for a brisk 4 s opening, or `3`
 * for a longer one, and nothing else needs to change.
 */
export const MERGE_SORTING_LOOP_INDEX = 2;

export const POOL_MAX_WAIT_TICKS = 1200;
/**
 * M01 · T1b — the backstop for a player who cannot reach the first loop at all.
 *
 * `POOL_MAX_WAIT_TICKS` is the grace a *held* rider waits for the rest of the field, and it now
 * measures from the player's own crossing (see `step`), because the run down to the loop is the
 * player's split and must not be cut short by somebody else's clock. That leaves one hole: a player
 * wrecked, out of bounds or stuck before the gate would hold the race for ever. This deadline is
 * the answer — half a minute of grace after the field's first arrival, then the pool closes and the
 * player is flagged `late` on arrival, exactly as any other late rider.
 */
export const POOL_PLAYER_GRACE_TICKS = 6000;
/** An idle player readies automatically after this long, and keeps their place in the queue. */
export const PLAYER_AUTO_READY_TICKS = 1800;
/** The countdown itself: three seconds of ticks. */
export const COUNTDOWN_TICKS = 360;
/** Gap between two releases: 0.35 s, ≈245 x-units at the release speed. */
export const RELEASE_GAP_TICKS = 42;
export const RELEASE_RETRY_TICKS = 6;
export const RELEASE_MAX_RETRIES = 8;
/** Every released rider leaves at the same speed, so release order is exit order (D9). */
export const MERGE_RELEASE_VX = 700;
/** Riders stay intangible this long after their loop exit; contact racing resumes after that. */
export const MERGE_GHOST_TAIL_S = 0.75;
/** How long a rider may take to slide into the loop lane before being released regardless. */
export const ALIGN_MAX_TICKS = 150;
/**
 * The pool's gate spans the whole corridor (C1/C2 of the red team): a rider in lane 0 or lane 3 is
 * 360 z-units off the loop's lane and must still enter the pool, or they would bypass the queue.
 */
export const MERGE_GATE_HALF_WIDTH = 443;
/** How square to the loop lane a rider must be before the release is allowed to fire. */
export const ALIGN_Z_TOLERANCE = 6;
export const ALIGN_VZ_TOLERANCE = 30;
/** The loop-lane z a rider must be in for the lane-filtered loop to engage them. */
export const LOOP_LANE_TOLERANCE = LANE_WIDTH / 2;
/**
 * The held rider's lateral glide: the same PD spring the race uses through the wet section, with
 * the damping the ticket fixes for the pool. `sim/racer-physics.ts` is the only user.
 */
export const HELD_RESPONSE = 20;
export const HELD_DAMPING = 6.2;

/* -----------------------------------------------------------------------------
   2. TYPES
   -------------------------------------------------------------------------- */

export type MergePhase = 'open' | 'closed' | 'countdown' | 'releasing' | 'done';
export type MergeFlag = 'late' | 'autoReady' | 'forced' | 'delayed' | 'alignForced';

export interface MergeEntry {
  readonly racerId: number;
  readonly isPlayer: boolean;
  /** The integer physics tick the racer crossed the gate plane. */
  readonly entryTick: number;
  /** Sub-tick entry time in seconds: `(tick + fraction) / 120`. The ordering key. */
  readonly entryTime: number;
  /** Engine x where the racer was held. */
  readonly crossX: number;
  /** Place in the queue, 0 first. Also the bot ready delay and the waiting lane. */
  rank: number;
  /** The lane the racer waits in while the pool is filling: `laneZ(rank % 4)`. */
  slotZ: number;
  readyTick: number | null;
  releaseTick: number | null;
  /** True while this (next-to-release) rider is sliding into the loop lane. */
  aligning: boolean;
  alignStartTick: number;
  readonly flags: MergeFlag[];
}

export type MergeRefusal =
  | 'not_open' | 'duplicate_entry' | 'unknown_racer' | 'not_held' | 'already_ready';

export type MergeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: MergeRefusal };

export interface MergeOccupancy {
  /** Loop progress (0..1) of the previously released rider; 1 once they have exited the loop. */
  readonly previousProgress: number;
  /** True when the next rider is square in the loop lane and slow enough to let go. */
  readonly candidateAligned: boolean;
  /** How many racers the pool is still expecting to hold. */
  readonly expected: number;
}

export interface MergePoolOptions {
  /** Gate plane x, from `createQualifyingGate` — the sorting loop's own outer reach. */
  readonly gateX: number;
  /** The loop's lane centre, the z every released rider must be in. */
  readonly loopZ: number;
  readonly racerIds: readonly number[];
  readonly playerId: number;
}

/** The published ordering law: ascending sub-tick entry time, ties broken by racer id. */
export function mergeOrder(entries: readonly MergeEntry[]): number[] {
  return [...entries]
    .sort((a, b) => a.entryTime - b.entryTime || a.racerId - b.racerId)
    .map((entry) => entry.racerId);
}

/** The label for a given number of ticks still to run: 3, 2, 1, then nothing. */
export function countdownLabelFor(ticksLeft: number): '3' | '2' | '1' | null {
  if (ticksLeft > 240) return '3';
  if (ticksLeft > 120) return '2';
  if (ticksLeft > 0) return '1';
  return null;
}

/* -----------------------------------------------------------------------------
   3. THE POOL
   -------------------------------------------------------------------------- */

export class MergePool {
  phase: MergePhase = 'open';
  /** Always sorted by (entryTime, racerId): the queue order is the entry order. */
  readonly entries: MergeEntry[] = [];
  /** Refusals, kept for diagnostics and the tests. Never grows unbounded in practice. */
  readonly refusals: { racerId: number; reason: MergeRefusal }[] = [];

  private readonly racerIds: readonly number[];
  private readonly playerId: number;
  readonly gateX: number;
  readonly loopZ: number;
  private firstEntryTick: number | null = null;
  private countdownStart = 0;
  private goTick: number | null = null;
  private nextReleaseTick = 0;
  private retries = 0;
  private lastTick = 0;

  constructor(options: MergePoolOptions) {
    this.gateX = options.gateX;
    this.loopZ = options.loopZ;
    this.racerIds = options.racerIds;
    this.playerId = options.playerId;
  }

  get goAt(): number | null { return this.goTick; }
  get firstAt(): number | null { return this.firstEntryTick; }
  /** True once every entry has been released and the pool has nothing left to do. */
  get finished(): boolean { return this.phase === 'done'; }
  /**
   * Sorts the queue and re-numbers it.
   *
   * `rank` is the *queue* place, not the arrival order: a racer who crossed the gate a few
   * thousandths of a second earlier than someone who arrived in the same tick gets the earlier
   * place — and with it the earlier ready-up deadline and the nearer waiting lane. Two riders can
   * only re-order inside a single tick, so a rider can never be shuffled after they have started
   * gliding to their slot in any way the player could see.
   */
  private reindex(): void {
    this.entries.sort((a, b) => a.entryTime - b.entryTime || a.racerId - b.racerId);
    for (let index = 0; index < this.entries.length; index++) {
      const entry = this.entries[index];
      if (entry.rank === index) continue;
      entry.rank = index;
      entry.slotZ = laneZ(index % 4);
    }
  }

  /** The entry next in line for release, or null when the queue is empty. */
  get next(): MergeEntry | null {
    return this.entries.find((entry) => entry.releaseTick === null) ?? null;
  }

  private refuse(racerId: number, reason: MergeRefusal): MergeResult<never> {
    this.refusals.push({ racerId, reason });
    return { ok: false, reason };
  }

  /**
   * Queue a racer that crossed the gate plane on this tick.
   *
   * `crossingFraction` is where inside the tick the plane was crossed, so two racers who cross in
   * the same 1/120 s are still ordered exactly. A racer arriving after the pool closed is `late`:
   * flagged, never dropped.
   */
  enter(racerId: number, tick: number, crossingFraction: number, crossX: number): MergeResult<MergeEntry> {
    if (this.phase === 'done') return this.refuse(racerId, 'not_open');
    if (!this.racerIds.includes(racerId)) return this.refuse(racerId, 'unknown_racer');
    if (this.entries.some((entry) => entry.racerId === racerId)) return this.refuse(racerId, 'duplicate_entry');
    const fraction = Math.max(0, Math.min(1, crossingFraction));
    const entry: MergeEntry = {
      racerId,
      isPlayer: racerId === this.playerId,
      entryTick: tick,
      entryTime: (tick + fraction) / 120,
      crossX,
      rank: 0,
      slotZ: laneZ(0),
      readyTick: null,
      releaseTick: null,
      aligning: false,
      alignStartTick: 0,
      flags: this.phase === 'open' ? [] : ['late'],
    };
    if (this.firstEntryTick === null) this.firstEntryTick = tick;
    if (entry.isPlayer) this.playerArrivalTick = tick;
    this.entries.push(entry);
    this.reindex();
    return { ok: true, value: entry };
  }

  /** A held rider is ready to go. Refused when they are not held, or already ready. */
  ready(racerId: number, tick: number): MergeResult<MergeEntry> {
    const entry = this.entries.find((candidate) => candidate.racerId === racerId);
    if (!entry || entry.releaseTick !== null) return this.refuse(racerId, 'not_held');
    if (entry.readyTick !== null) return this.refuse(racerId, 'already_ready');
    entry.readyTick = tick;
    return { ok: true, value: entry };
  }

  /** The tick the player's own entry crossed the gate, or null while they are still on their way. */
  private playerArrivalTick: number | null = null;

  /**
   * The tick the pool's closing grace measures from — the player's own crossing — or null while the
   * player is still on their way down and the deadline above is the only thing that can close it.
   */
  get graceTick(): number | null {
    return this.playerArrivalTick;
  }

  /** True while the player is still on their way down and has not queued yet. */
  get playerOnApproach(): boolean {
    return this.playerArrivalTick === null;
  }

  /**
   * Advances the pool to `tick` and returns the racers released on this tick (0 or 1).
   *
   * The order of the checks matters and is the published one: ready-ups first (so a rider who
   * becomes ready exactly when the pool closes does not stall the countdown by a tick), then the
   * close test, then the countdown, then the release.
   */
  step(tick: number, occupancy: MergeOccupancy): readonly number[] {
    this.lastTick = tick;
    const released: number[] = [];

    for (const entry of this.entries) {
      if (entry.readyTick !== null) continue;
      if (!entry.isPlayer && tick >= entry.entryTick + BOT_READY_BASE_TICKS + BOT_READY_RANK_TICKS * entry.rank) {
        entry.readyTick = tick;
        continue;
      }
      if (entry.isPlayer && tick >= entry.entryTick + PLAYER_AUTO_READY_TICKS) {
        entry.readyTick = tick;
        entry.flags.push('autoReady');
      }
    }

    if (this.phase === 'open' && this.firstEntryTick !== null) {
      const allHeld = this.entries.length >= occupancy.expected;
      // The grace starts when the rider we are waiting for has arrived. While that rider is the
      // player they are still setting their split time down the hill, so the wait has no clock of
      // its own: nothing but the deadline closes the window, and the player is not made `late` for a
      // gate they never had a race to reach. Once they are in, the grace is theirs, exactly as it
      // has always been for a held rider waiting on the field.
      const grace = this.playerArrivalTick === null ? Infinity : this.playerArrivalTick + POOL_MAX_WAIT_TICKS;
      const deadline = this.firstEntryTick + POOL_PLAYER_GRACE_TICKS;
      if (allHeld || tick >= grace || tick >= deadline) this.phase = 'closed';
    }

    if (this.phase === 'closed' && this.entries.length > 0 && this.entries.every((entry) => entry.readyTick !== null)) {
      this.phase = 'countdown';
      this.countdownStart = tick;
    }

    if (this.phase === 'countdown' && tick >= this.countdownStart + COUNTDOWN_TICKS) {
      this.phase = 'releasing';
      this.goTick = tick;
      this.nextReleaseTick = tick;
    }

    if (this.phase === 'releasing') {
      const next = this.next;
      if (!next) {
        if (this.entries.length > 0) this.phase = 'done';
      } else {
        if (!next.aligning) { next.aligning = true; next.alignStartTick = tick; }
        const alignOk = occupancy.candidateAligned || tick >= next.alignStartTick + ALIGN_MAX_TICKS;
        const ordered = this.entries.filter((entry) => entry.releaseTick !== null).length;
        if (tick >= this.nextReleaseTick && next.readyTick !== null && alignOk) {
          // The occupancy check: the previous rider must be a quarter of the way round the ring (or
          // out of it) before the next one is let go.
          const blocked = ordered > 0 && occupancy.previousProgress < 0.25;
          if (blocked && this.retries < RELEASE_MAX_RETRIES) {
            this.retries += 1;
            if (!next.flags.includes('delayed')) next.flags.push('delayed');
            this.nextReleaseTick = tick + RELEASE_RETRY_TICKS;
          } else {
            if (blocked) next.flags.push('forced');
            if (!occupancy.candidateAligned) next.flags.push('alignForced');
            next.releaseTick = tick;
            released.push(next.racerId);
            this.retries = 0;
            this.nextReleaseTick = tick + RELEASE_GAP_TICKS;
          }
        }
      }
    }

    return released;
  }

  /**
   * The label the overlay shows for this tick.
   *
   * During the countdown it is a pure function of the tick against the stored window, so it can be
   * asked for a tick that has already passed (and asked twice) and answers the same thing. After
   * GO! it lingers for half a second and then stops answering: there is no label for a race in
   * progress.
   */
  countdownLabel(tick: number): '3' | '2' | '1' | 'GO!' | null {
    if (this.phase === 'countdown') {
      return countdownLabelFor(this.countdownStart + COUNTDOWN_TICKS - tick);
    }
    if (this.goTick !== null && tick >= this.goTick && tick < this.goTick + 60) return 'GO!';
    return null;
  }

  /** Physics ticks the field spent queued: the engine subtracts this from the race clock. */
  holdTicks(): number {
    if (this.firstEntryTick === null) return 0;
    return Math.max(0, (this.goTick ?? this.lastTick) - this.firstEntryTick);
  }
}

/* -----------------------------------------------------------------------------
   4. LOOP PROGRESS
   -------------------------------------------------------------------------- */

/** The slice of a loop ride the occupancy check needs. */
export interface LoopProgressView {
  readonly entryProgress: number;
  readonly angle: number;
  readonly entryAngle: number;
  readonly exitAngle: number;
}

/**
 * How far round the ring a rider is, 0..1.
 *
 * `null` (not riding) is 1: the previous rider has left, so the ring is clear. While a rider is
 * still sliding on from the mouth their progress is 0 — nobody may follow them in yet.
 */
export function loopRideProgress(ride: LoopProgressView | null): number {
  if (!ride) return 1;
  if (ride.entryProgress < 1) return 0;
  const span = ride.exitAngle - ride.entryAngle;
  if (!(span > 0)) return 1;
  return Math.max(0, Math.min(1, (ride.angle - ride.entryAngle) / span));
}
