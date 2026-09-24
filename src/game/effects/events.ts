/**
 * M01 · T5 — typed effect events (sim side).
 *
 * The simulation already knows *what happened* (a TNT crate went off, a bridge broke, a ball landed
 * hard); it does not know how to draw it. `EffectQueue` is the hand-off: a fixed ring buffer of
 * small records that the renderer drains with a cursor. Nothing is allocated after construction, so
 * a thousand explosions a second cannot make the physics tick allocate, and a headless attempt can
 * keep the queue (or drop it) without touching a canvas.
 *
 * Positions are **engine space** (the same x/y/z the physics integrates). The renderer maps them to
 * world space with `placementFromEngine`, exactly like the racers, so an effect cannot drift away
 * from the ball that caused it.
 *
 * Pure module: no DOM, no canvas, no three.js.
 */
import { ContractError } from '../contracts/core';

/* -----------------------------------------------------------------------------
   1. KINDS AND SIZING (IF-FX)
   -------------------------------------------------------------------------- */

export type EffectKind = 'explosion' | 'impact' | 'dust' | 'smoke' | 'sparks';

export const EFFECT_KINDS: readonly EffectKind[] = ['explosion', 'impact', 'dust', 'smoke', 'sparks'];

/** Ring capacity. A full queue overwrites the oldest event and counts the loss. */
export const EFFECT_QUEUE = 128;

export function isEffectKind(value: unknown): value is EffectKind {
  return typeof value === 'string' && (EFFECT_KINDS as readonly string[]).includes(value);
}

/** Thrown by `push()` when a caller invents a kind. Typed, per the fifth contract rule. */
export function assertEffectKind(value: unknown): EffectKind {
  if (!isEffectKind(value)) {
    throw new ContractError('E_EFFECT_KIND', `unknown_effect_kind: ${String(value)}`, { kind: String(value) });
  }
  return value;
}

/* -----------------------------------------------------------------------------
   2. THE EVENT
   -------------------------------------------------------------------------- */

export interface EffectEvent {
  /** Monotonically increasing, never reused. */
  readonly seq: number;
  /** The physics tick that emitted it (engine ticks, 120 Hz). */
  readonly tick: number;
  readonly kind: EffectKind;
  /** Engine space, straight from the physics. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0.25..3 — how big this instance is, relative to the spec's own size. */
  readonly scale: number;
  /** Who caused it, when a racer did (the HUD can ignore other racers). */
  readonly racerId: number | null;
}

/**
 * Fixed-capacity FIFO of effect events.
 *
 * `readSince(cursor, out)` copies the events written after `cursor` into `out` (reusing whatever
 * objects `out` already holds) and returns the new cursor. The renderer keeps one array and one
 * cursor for the whole race, so a frame with no effects writes nothing and allocates nothing.
 */
export class EffectQueue {
  private readonly events: EffectEvent[];
  private head = 0;
  private count = 0;
  private seq = 0;
  private lost = 0;
  /** The highest cursor any reader has acknowledged. An overwrite past it is a real loss. */
  private readTo = 0;

  constructor(capacity: number = EFFECT_QUEUE) {
    const size = Math.max(1, Math.floor(capacity));
    this.events = new Array<EffectEvent>(size);
    for (let i = 0; i < size; i++) {
      this.events[i] = { seq: 0, tick: 0, kind: 'dust', x: 0, y: 0, z: 0, scale: 1, racerId: null };
    }
  }

  get capacity(): number { return this.events.length; }
  /** Events written so far, including the ones an overflow dropped. */
  get written(): number { return this.seq; }
  /** How many events were dropped because the renderer fell behind. */
  get overflow(): number { return this.lost; }
  /** Events written since the last reader stopped reading (0 when a reader is keeping up). */
  get pending(): number { return this.seq - Math.max(this.readTo, this.seq - this.count); }

  /** The cursor a reader should start from to see only new events. */
  get cursor(): number { return this.seq; }

  push(kind: EffectKind, x: number, y: number, z: number, scale = 1, racerId: number | null = null, tick = 0): void {
    assertEffectKind(kind);
    const slot = this.events[this.head];
    // The seq the slot is about to lose, so an overwrite of an unread event can be counted.
    const overwritten = slot.seq;
    // The record is mutated in place: the ring owns every object it hands out.
    (slot as { seq: number }).seq = this.seq + 1;
    (slot as { tick: number }).tick = tick;
    (slot as { kind: EffectKind }).kind = kind;
    (slot as { x: number }).x = Number.isFinite(x) ? x : 0;
    (slot as { y: number }).y = Number.isFinite(y) ? y : 0;
    (slot as { z: number }).z = Number.isFinite(z) ? z : 0;
    (slot as { scale: number }).scale = Number.isFinite(scale) ? Math.max(0.25, Math.min(3, scale)) : 1;
    (slot as { racerId: number | null }).racerId = racerId ?? null;
    this.head = (this.head + 1) % this.events.length;
    this.seq += 1;
    if (this.count === this.events.length) {
      // The slot just overwritten held the oldest event: it is lost only if nobody read it.
      if (overwritten > this.readTo) this.lost += 1;
    } else this.count += 1;
  }

  /**
   * Copies every event written after `cursor` into `out`, oldest first, and returns the cursor to
   * pass next time. `out` is the reader's own array and is resized to exactly the events written:
   * a caller that keeps one array for the whole race (the renderer does) never allocates, because
   * writing back over the same indices reuses the backing store.
   *
   * Events dropped by an overflow are skipped, never replayed: an effect that could not be drawn in
   * time is gone, which is exactly what an explosion should do.
   */
  readSince(cursor: number, out: EffectEvent[]): number {
    const start = Math.max(0, this.seq - this.count);
    const first = Math.max(start, Math.floor(cursor));
    let written = 0;
    let index = this.head - this.count;
    if (index < 0) index += this.events.length;
    for (let seq = start; seq < this.seq; seq++) {
      const slot = this.events[index];
      index = (index + 1) % this.events.length;
      if (seq < first) continue;
      if (written < out.length) out[written] = slot;
      else out.push(slot);
      written += 1;
    }
    if (out.length !== written) out.length = written;
    if (this.seq > this.readTo) this.readTo = this.seq;
    return this.seq;
  }

  /** Every pending event, oldest first, in the order a reader will see them. Test/debug helper. */
  drain(): EffectEvent[] {
    const seen: EffectEvent[] = [];
    this.readSince(Math.max(0, this.seq - this.count), seen);
    return seen;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.seq = 0;
    this.lost = 0;
    this.readTo = 0;
  }
}

/* -----------------------------------------------------------------------------
   3. LOGGING FX (tests, qualifying diagnostics)
   -------------------------------------------------------------------------- */

/** A `SimFx`-compatible recorder that keeps only the effect events. */
export function createEffectLog(): { effect: (kind: EffectKind, x: number, y: number, z: number, scale?: number, racerId?: number | null) => void; readonly log: EffectEvent[] } {
  const queue = new EffectQueue(EFFECT_QUEUE);
  const log: EffectEvent[] = [];
  const pending: EffectEvent[] = [];
  return {
    log,
    effect: (kind, x, y, z, scale = 1, racerId = null) => {
      queue.push(kind, x, y, z, scale, racerId);
      queue.readSince(queue.written - 1, pending);
      if (pending.length > 0) log.push({ ...pending[pending.length - 1] });
    },
  };
}
