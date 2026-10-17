// ============================================================================
// File: apps/web/src/rooms/outpost-harness.ts
// Test harness for OutpostRoom (plan 36 Phase 1). It is the real GameRoom base class (from
// @series-inc/rundot-game-sdk/mp-server), wired the way the platform wires it: the harness owns the RoomProtocol, and
// drives the room through protocol.handleJoin, protocol.handleMessage(playerId, type, data) and protocol.handleLeave.
// Only the parts the platform owns are fakes here: a clock that fires its timers on demand, a logger that keeps its lines,
// and the wire, which carries every message as JSON, as a WebSocket would. Nothing is monkey-patched on the room.
// ============================================================================

import type { Clock, GameRoomProps, LeaveReason, Logger, PlatformServices, Player, RoomConfig, RoomProtocol } from '@series-inc/rundot-game-sdk/mp-server';
import OutpostRoom from './OutpostRoom';
import type { OutpostMessage } from '../net/protocol';
import type { RoomCallbacks, ServerRoomLike } from '../net/outpost-client';

/** A clock whose named timers the test fires by hand (the presence tick is one of them). */
export class FakeClock {
  readonly timers = new Map<string, { readonly intervalMs: number; readonly callback: () => void }>();

  setInterval(name: string, callback: () => void, intervalMs: number): void {
    this.timers.set(name, { intervalMs, callback });
  }

  setTimeout(name: string, callback: () => void, delayMs: number): void {
    this.timers.set(name, { intervalMs: delayMs, callback });
  }

  clear(name: string): void {
    this.timers.delete(name);
  }

  has(name: string): boolean {
    return this.timers.has(name);
  }

  snapshot(): { timers: never[] } {
    return { timers: [] };
  }

  restoreTimings(): void {}

  dispose(): void {
    this.timers.clear();
  }

  /** Runs the named timer once, as the platform would when its time comes. */
  fire(name: string): void {
    this.timers.get(name)?.callback();
  }
}

/** A logger that keeps its lines, so a test can check the room logged nothing at error level. */
export class FakeLogger {
  readonly lines: { readonly level: string; readonly message: string }[] = [];

  debug(message: string): void { this.lines.push({ level: 'DEBUG', message }); }
  info(message: string): void { this.lines.push({ level: 'INFO', message }); }
  warn(message: string): void { this.lines.push({ level: 'WARNING', message }); }
  error(message: string): void { this.lines.push({ level: 'ERROR', message }); }
  critical(message: string): void { this.lines.push({ level: 'CRITICAL', message }); }
  child(): FakeLogger { return this; }
}

/** One message the room sent: to one player, or to everyone connected (`to` null). */
export interface Delivery {
  readonly to: string | null;
  readonly recipient: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
}

const ROOM_CONFIG: RoomConfig = { maxPlayers: 4, allowReconnect: true, reconnectTimeout: 60, autoPersist: true };

/** Copies a value as the wire would: JSON out, JSON in. */
function overWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class OutpostHarness {
  readonly players = new Map<string, Player>();
  readonly clock = new FakeClock();
  readonly log = new FakeLogger();
  /** Everything the room sent, in order. */
  readonly deliveries: Delivery[] = [];
  readonly protocol: RoomProtocol;
  readonly room: OutpostRoom;
  /** The last state the room asked the platform to persist. */
  persisted: Record<string, unknown> | null = null;
  private locked = false;
  private readonly callbacks = new Map<string, RoomCallbacks<OutpostMessage>>();
  /** The wire: every message waits its turn, so the room is never re-entered while it is handling one. */
  private readonly wire: (() => void)[] = [];
  private draining = false;

  constructor(roomId = 'outpost-room-1') {
    this.protocol = {
      broadcast: (type: string, data: unknown) => this.route(null, type, data),
      sendTo: (playerId: string, type: string, data: unknown) => this.route(playerId, type, data),
      kick: () => {},
      lock: () => { this.locked = true; },
      unlock: () => { this.locked = false; },
      persist: (state: Record<string, unknown>) => { this.persisted = overWire(state); },
      getLocked: () => this.locked,
      getPlayers: () => this.players,
      serializePersistState: () => this.persisted ?? {},
    } as unknown as RoomProtocol;
    const props: GameRoomProps = {
      protocol: this.protocol,
      roomId,
      roomType: 'outpost',
      config: ROOM_CONFIG,
      players: this.players,
      clock: this.clock as unknown as Clock,
      log: this.log as unknown as Logger,
      services: {} as unknown as PlatformServices,
    };
    this.room = new OutpostRoom(props);
    void this.protocol.handleCreate();
  }

  /** Queues one step on the wire and runs the queue to its end (a step queued while another runs goes after it). */
  private onWire(step: () => void): void {
    this.wire.push(step);
    if (this.draining) return;
    this.draining = true;
    try {
      for (let next = this.wire.shift(); next !== undefined; next = this.wire.shift()) next();
    } finally {
      this.draining = false;
    }
  }

  /** Routes a room message to its recipients, as JSON, the way the client receives it (the type is the message's own). */
  private route(to: string | null, type: string, data: unknown): void {
    const body = overWire({ ...((data ?? {}) as Record<string, unknown>), type });
    this.onWire(() => this.deliver(to, body));
  }

  private deliver(to: string | null, body: Record<string, unknown>): void {
    const recipients = to === null
      ? [...this.players.values()].filter((p) => p.connected).map((p) => p.id)
      : [to];
    for (const recipient of recipients) {
      const { type: messageType, ...rest } = body;
      this.deliveries.push({ to, recipient, type: messageType as string, data: rest });
      const callbacks = this.callbacks.get(recipient);
      const player = this.players.get(recipient);
      // as the SDK delivers them: a broadcast to onMessage, a message to one player to onPrivateMessage
      const wire = overWire(body) as unknown as OutpostMessage;
      if (callbacks && player?.connected) {
        if (to === null) callbacks.onMessage?.(wire);
        else callbacks.onPrivateMessage?.(wire);
      }
    }
  }

  private joinPlayer(id: string, username: string): void {
    this.onWire(() => { void this.protocol.handleJoin({ id, username }); });
  }

  /**
   * A client's side of the room: `on` registers its callbacks and joins (as RUN does, so the welcome reaches the callbacks),
   * `send` carries a message over the wire, and `leave` leaves the room.
   */
  transport(id: string, username = id): ServerRoomLike<OutpostMessage> {
    return {
      roomCode: 'FX9KWR',
      on: (callbacks: RoomCallbacks<OutpostMessage>) => {
        this.callbacks.set(id, callbacks);
        this.joinPlayer(id, username);
      },
      send: (message: OutpostMessage) => {
        const player = this.players.get(id);
        if (!player?.connected) return;
        const { type, ...data } = message as unknown as Record<string, unknown>;
        const payload = overWire(data);
        this.onWire(() => { void this.protocol.handleMessage(id, type as string, payload); });
      },
      leave: () => {
        this.callbacks.delete(id);
        this.onWire(() => { void this.protocol.handleLeave(id, 'leave'); });
      },
    };
  }

  /** The socket drops: the player keeps their seat (the room holds it for reconnectTimeout), and the client shows it. */
  disconnect(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.connected = false;
    this.callbacks.get(id)?.onReconnecting?.();
    this.onWire(() => { void this.protocol.handleMessage(id, '__system:disconnected', {}); });
  }

  /** The socket comes back within the hold: the same player, the same world. */
  reconnect(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.connected = true;
    this.onWire(() => { void this.protocol.handleMessage(id, '__system:reconnected', {}); });
    this.callbacks.get(id)?.onReconnected?.();
  }

  /** The player leaves for good. */
  leave(id: string, reason: LeaveReason = 'leave'): void {
    this.callbacks.delete(id);
    this.onWire(() => { void this.protocol.handleLeave(id, reason); });
  }

  /** The room as a restart would bring it back: the last persisted state, restored into a new room of the same type. */
  restoredRoom(roomId = 'outpost-room-2'): OutpostHarness {
    const next = new OutpostHarness(roomId);
    void next.protocol.handleRestore({ state: overWire(this.persisted ?? {}) });
    return next;
  }

  /** Messages of one type the room sent to one player. */
  sentTo(recipient: string, type: string): Delivery[] {
    return this.deliveries.filter((d) => d.recipient === recipient && d.type === type);
  }
}
