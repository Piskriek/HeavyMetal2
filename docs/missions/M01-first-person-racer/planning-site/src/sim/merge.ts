// Reference implementation of IF-MERGE v2 (src/game/merge/pool.ts). Pure, tick-driven.
// v1 behaviour is kept behind `mode: 'v1'` purely to reproduce red-team findings C1/C2.
import { nearestFreeLane, releaseVx } from './redteam';

export const TICK_HZ = 120;
export const BOT_READY_BASE_TICKS = 90;
export const BOT_READY_RANK_TICKS = 30;
export const POOL_MAX_WAIT_TICKS = 1200;
export const PLAYER_AUTO_READY_TICKS = 1800;
export const COUNTDOWN_TICKS = 360;
export const RELEASE_GAP_TICKS = 42;
export const RELEASE_RETRY_TICKS = 6;
export const RELEASE_MAX_RETRIES = 8;
export const ALIGN_MAX_TICKS = 150;
export const MERGE_GHOST_TAIL_S = 0.75;

export const laneZ = (lane: number) => 480 - 240 * (lane + 0.5);

export type MergeMode = 'v1' | 'v2';
export type MergePhase = 'open' | 'closed' | 'countdown' | 'releasing' | 'done';
export type MergeFlag = 'late' | 'autoReady' | 'forced' | 'delayed' | 'alignForced';

export interface MergeEntry {
  racerId: number;
  isPlayer: boolean;
  entryTick: number;
  entryTime: number;
  crossX: number;
  slotZ: number;
  rank: number;
  readyTick: number | null;
  releaseTick: number | null;
  aligning: boolean;
  flags: MergeFlag[];
}

export type MergeRefusal = 'not_open' | 'duplicate_entry' | 'unknown_racer' | 'not_held' | 'already_ready' | 'outside_gate';
export type MergeResult<T> = { ok: true; value: T } | { ok: false; reason: MergeRefusal };

export function mergeOrder(entries: readonly MergeEntry[]): number[] {
  return [...entries].sort((a, b) => a.entryTime - b.entryTime || a.racerId - b.racerId).map((e) => e.racerId);
}

export interface PoolOptions {
  gateX: number;
  gateZ: number;
  gateHalfWidth: number; // v1: 120 (gate.ts lane containment) · v2: 443 (full corridor)
  slotMode: 'rank' | 'nearest';
  align: boolean;
  racerIds: readonly number[];
  playerId: number;
}

export class MergePool {
  phase: MergePhase = 'open';
  entries: MergeEntry[] = [];
  readonly opts: PoolOptions;
  private firstEntryTick: number | null = null;
  private countdownStart = 0;
  private goTick: number | null = null;
  private nextReleaseTick = 0;
  private retries = 0;
  private alignStart = 0;
  private lastTick = 0;
  refusals: { racerId: number; reason: MergeRefusal }[] = [];

  constructor(opts: PoolOptions) {
    this.opts = opts;
  }

  enter(racerId: number, tick: number, crossingFraction: number, crossX: number, z: number): MergeResult<MergeEntry> {
    const refuse = (reason: MergeRefusal): MergeResult<MergeEntry> => {
      this.refusals.push({ racerId, reason });
      return { ok: false, reason };
    };
    if (this.phase === 'done') return refuse('not_open');
    if (!this.opts.racerIds.includes(racerId)) return refuse('unknown_racer');
    if (this.entries.some((e) => e.racerId === racerId)) return refuse('duplicate_entry');
    if (Math.abs(z - this.opts.gateZ) > this.opts.gateHalfWidth) return refuse('outside_gate');
    const rank = this.entries.length;
    const taken = new Set(this.entries.filter((e) => e.releaseTick === null).map((e) => Math.round((480 - e.slotZ) / 240 - 0.5)));
    const lane = this.opts.slotMode === 'rank' ? rank % 4 : nearestFreeLane(z, taken);
    const entry: MergeEntry = {
      racerId,
      isPlayer: racerId === this.opts.playerId,
      entryTick: tick,
      entryTime: (tick + crossingFraction) / TICK_HZ,
      crossX,
      slotZ: laneZ(lane < 0 ? rank % 4 : lane),
      rank,
      readyTick: null,
      releaseTick: null,
      aligning: false,
      flags: this.phase === 'open' ? [] : ['late'],
    };
    if (this.firstEntryTick === null) this.firstEntryTick = tick;
    this.entries.push(entry);
    this.entries.sort((a, b) => a.entryTime - b.entryTime || a.racerId - b.racerId);
    return { ok: true, value: entry };
  }

  ready(racerId: number, tick: number): MergeResult<MergeEntry> {
    const e = this.entries.find((x) => x.racerId === racerId);
    if (!e || e.releaseTick !== null) return { ok: false, reason: 'not_held' };
    if (e.readyTick !== null) return { ok: false, reason: 'already_ready' };
    e.readyTick = tick;
    return { ok: true, value: e };
  }

  /** occupancy.previousProgress: loop progress 0..1 of the last released rider (1 once exited). */
  step(tick: number, occ: { previousProgress: number; candidateAligned: boolean; expected: number }): number[] {
    this.lastTick = tick;
    const released: number[] = [];
    for (const e of this.entries) {
      if (e.readyTick !== null) continue;
      if (!e.isPlayer && tick >= e.entryTick + BOT_READY_BASE_TICKS + BOT_READY_RANK_TICKS * e.rank) e.readyTick = tick;
      if (e.isPlayer && tick >= e.entryTick + PLAYER_AUTO_READY_TICKS) {
        e.readyTick = tick;
        e.flags.push('autoReady');
      }
    }
    if (this.phase === 'open' && this.firstEntryTick !== null) {
      if (this.entries.length >= occ.expected || tick >= this.firstEntryTick + POOL_MAX_WAIT_TICKS) this.phase = 'closed';
    }
    if (this.phase === 'closed' && this.entries.every((e) => e.readyTick !== null)) {
      this.phase = 'countdown';
      this.countdownStart = tick;
    }
    if (this.phase === 'countdown' && tick >= this.countdownStart + COUNTDOWN_TICKS) {
      this.phase = 'releasing';
      this.goTick = tick;
      this.nextReleaseTick = tick;
    }
    if (this.phase === 'releasing') {
      const next = this.entries.find((e) => e.releaseTick === null);
      if (next) {
        const releasedCount = this.entries.filter((e) => e.releaseTick !== null).length;
        if (this.opts.align && !next.aligning) {
          next.aligning = true;
          this.alignStart = tick;
        }
        const alignOk = !this.opts.align || occ.candidateAligned || tick >= this.alignStart + ALIGN_MAX_TICKS;
        if (tick >= this.nextReleaseTick && next.readyTick !== null && alignOk) {
          const blocked = releasedCount > 0 && occ.previousProgress < 0.25;
          if (blocked && this.retries < RELEASE_MAX_RETRIES) {
            this.retries++;
            if (!next.flags.includes('delayed')) next.flags.push('delayed');
            this.nextReleaseTick = tick + RELEASE_RETRY_TICKS;
          } else {
            if (blocked) next.flags.push('forced');
            if (this.opts.align && !occ.candidateAligned) next.flags.push('alignForced');
            next.releaseTick = tick;
            released.push(next.racerId);
            this.retries = 0;
            this.nextReleaseTick = tick + RELEASE_GAP_TICKS;
          }
        }
      } else if (this.entries.length > 0) {
        this.phase = 'done';
      }
    }
    return released;
  }

  countdownLabel(tick: number): '3' | '2' | '1' | 'GO!' | null {
    if (this.phase === 'countdown') {
      const remaining = this.countdownStart + COUNTDOWN_TICKS - tick;
      return remaining > 240 ? '3' : remaining > 120 ? '2' : '1';
    }
    if (this.goTick !== null && tick < this.goTick + 60) return 'GO!';
    return null;
  }

  get goAt() {
    return this.goTick;
  }

  holdTicks(): number {
    if (this.firstEntryTick === null) return 0;
    return (this.goTick ?? this.lastTick) - this.firstEntryTick;
  }
}

// ---------------------------------------------------------------------------
// Demo world: run-up, full/partial gate, lane-filtered single-lane loop, exit straight.
export const GATE_X = 1184.44;
export const LOOP_LANE = 2;
export const LOOP_Z = laneZ(LOOP_LANE); // −120
export const LOOP_HALF_WIDTH = 58; // loopGeometry(first loop).halfWidth
export const LOOP_ENGAGE_Z_TOL = LOOP_HALF_WIDTH + 31; // presumption pending RQ-7
export const LOOP_START_X = 1370 - 154.56;
export const LOOP_LENGTH = 2 * Math.PI * 114.56;
export const DIAMETER = 66;

export interface DemoRacer {
  id: number;
  name: string;
  color: string;
  pace: number;
  x: number; // ground x
  loopT: number | null; // distance along the loop while riding
  vx: number;
  z: number;
  vz: number;
  held: boolean;
  ghost: boolean;
  rodeLoop: boolean;
  bypassed: boolean;
  passedGate: boolean;
  loopExitTime: number | null;
  exitTick: number | null;
  releaseZ: number | null;
  stalled: boolean;
}

export interface DemoWorld {
  mode: MergeMode;
  tick: number;
  racers: DemoRacer[];
  pool: MergePool;
  exitOrder: number[];
  lastReleased: number | null;
  illegalContacts: number;
  ghostOverlaps: number;
  minExitSpacing: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['You', 'Grizzik', 'Mogra', 'Snotbolt'];
const COLORS = ['#f08a24', '#5fb4c9', '#b388eb', '#9ccc65'];
const START_LANES = [2, 0, 1, 3];

export function createDemoWorld(seed: number, stallBot: boolean, mode: MergeMode = 'v2'): DemoWorld {
  const r = rng(seed);
  const racers: DemoRacer[] = NAMES.map((name, id) => ({
    id,
    name,
    color: COLORS[id],
    pace: 0.9 + r() * 0.2,
    x: 190 + r() * 140,
    loopT: null,
    vx: 430 + r() * 420,
    z: laneZ(START_LANES[id]),
    vz: 0,
    held: false,
    ghost: false,
    rodeLoop: false,
    bypassed: false,
    passedGate: false,
    loopExitTime: null,
    exitTick: null,
    releaseZ: null,
    stalled: false,
  }));
  if (stallBot) {
    racers[3].vx = 62;
    racers[3].stalled = true;
  }
  const v2 = mode === 'v2';
  return {
    mode,
    tick: 0,
    racers,
    pool: new MergePool({
      gateX: GATE_X,
      // v1: gate.ts centres on the loop lane with ±120 · v2: the whole corridor |z| ≤ 443 (centred on z = 0)
      gateZ: v2 ? 0 : LOOP_Z,
      gateHalfWidth: v2 ? 443 : 120,
      slotMode: v2 ? 'nearest' : 'rank',
      align: v2,
      racerIds: racers.map((x) => x.id),
      playerId: 0,
    }),
    exitOrder: [],
    lastReleased: null,
    illegalContacts: 0,
    ghostOverlaps: 0,
    minExitSpacing: Infinity,
  };
}

export function loopProgress(rc: DemoRacer): number {
  if (rc.exitTick !== null) return 1;
  return rc.loopT === null ? 0 : Math.min(1, rc.loopT / LOOP_LENGTH);
}

export function stepDemo(w: DemoWorld) {
  const dt = 1 / TICK_HZ;
  w.tick++;
  const tick = w.tick;
  for (const rc of w.racers) {
    if (rc.held) {
      const entry = w.pool.entries.find((e) => e.racerId === rc.id)!;
      const target = entry.aligning ? LOOP_Z : entry.slotZ;
      // held riders use the dry PD spring (response 33, damping 9.5)
      rc.vz += ((target - rc.z) * 33 - rc.vz * 9.5) * dt;
      rc.z += rc.vz * dt;
      continue;
    }
    if (rc.loopT !== null) {
      rc.loopT += rc.vx * dt;
      if (rc.loopT >= LOOP_LENGTH) {
        rc.loopT = null;
        rc.x = LOOP_START_X + 3;
        rc.exitTick = tick;
        rc.loopExitTime = tick / TICK_HZ;
        rc.vx = Math.min(1100, rc.vx * 1.08);
        w.exitOrder.push(rc.id);
      }
    } else {
      const prev = rc.x;
      rc.x += rc.vx * dt;
      // gate crossing
      if (!rc.passedGate && prev < GATE_X && rc.x >= GATE_X) {
        rc.passedGate = true;
        const frac = (GATE_X - prev) / (rc.x - prev);
        const res = w.pool.enter(rc.id, tick - 1, frac, GATE_X, rc.z);
        if (res.ok) {
          rc.x = GATE_X;
          rc.vx = 0;
          rc.held = true;
          continue;
        } else if (w.pool.phase === 'done' || res.reason === 'not_open') {
          rc.ghost = true; // UQ18 pass-through ghost
        }
      }
      // loop mouth: lane-filtered engagement
      if (!rc.rodeLoop && !rc.bypassed && prev < LOOP_START_X && rc.x >= LOOP_START_X) {
        if (Math.abs(rc.z - LOOP_Z) <= LOOP_ENGAGE_Z_TOL && rc.vx > 245) {
          rc.rodeLoop = true;
          rc.loopT = rc.x - LOOP_START_X;
          rc.x = LOOP_START_X;
          rc.vx = Math.max(650, rc.vx);
          rc.z = LOOP_Z;
          rc.vz = 0;
        } else {
          rc.bypassed = true;
        }
      }
      if (rc.bypassed && rc.exitTick === null && rc.x >= LOOP_START_X + 3) {
        rc.exitTick = tick;
        rc.loopExitTime = tick / TICK_HZ;
        w.exitOrder.push(rc.id);
      }
    }
    if (rc.ghost && rc.loopExitTime !== null && tick / TICK_HZ >= rc.loopExitTime + MERGE_GHOST_TAIL_S) rc.ghost = false;
  }

  const prevRacer = w.lastReleased === null ? null : w.racers[w.lastReleased];
  const candidate = w.pool.entries.find((e) => e.releaseTick === null);
  const cr = candidate ? w.racers[candidate.racerId] : null;
  const candidateAligned = !!cr && Math.abs(cr.z - LOOP_Z) <= 6 && Math.abs(cr.vz) <= 30;
  // riders who can still enter the pool, plus those already in it
  const expected = w.racers.filter((x) => !x.passedGate || w.pool.entries.some((e) => e.racerId === x.id)).length;
  const released = w.pool.step(tick, {
    previousProgress: prevRacer ? loopProgress(prevRacer) : 1,
    candidateAligned,
    expected: Math.max(1, expected),
  });
  for (const id of released) {
    const rc = w.racers[id];
    rc.held = false;
    rc.ghost = true;
    rc.vx = w.mode === 'v2' ? releaseVx(rc.pace) : 700;
    rc.vz = 0;
    rc.releaseZ = rc.z;
    w.lastReleased = id;
  }
  for (let i = 0; i < w.racers.length; i++)
    for (let j = i + 1; j < w.racers.length; j++) {
      const a = w.racers[i];
      const b = w.racers[j];
      if (a.held || b.held || a.loopT !== null || b.loopT !== null) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) < DIAMETER) {
        if (a.ghost || b.ghost) w.ghostOverlaps++;
        else if (a.exitTick === null || b.exitTick === null) w.illegalContacts++;
      }
    }
  const exited = w.racers.filter((x) => x.exitTick !== null && x.loopT === null);
  if (exited.length >= 2) {
    const sorted = [...exited].sort((a, b) => b.x - a.x);
    for (let k = 1; k < sorted.length; k++) w.minExitSpacing = Math.min(w.minExitSpacing, sorted[k - 1].x - sorted[k].x);
  }
}
