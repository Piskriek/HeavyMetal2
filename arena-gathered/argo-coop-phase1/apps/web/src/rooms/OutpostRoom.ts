// ============================================================================
// File: apps/web/src/rooms/OutpostRoom.ts
// Plan 36 Phase 1 (Deliverable 2 — Server-Authoritative Outpost GameRoom):
// - Imports ONLY pure modules (base/world.ts apply, net/protocol.ts, @hm/*)
// - Validates role via canRun() then runs apply()
// - Broadcasts confirmed events with monotonic version and worldHash
// - Sends refusals ONLY to the sender via sendTo()
// - Relays presence at 10 Hz using this.clock (never raw timers)
// - Persists state through getPersistState() and onRestore()
// ============================================================================

import {
  GameRoom,
  type GameMessage,
  type LeaveReason,
  type Player,
} from '@series-inc/rundot-game-sdk/mp-server';
import {
  apply,
  BRIDGE_RANGE,
  createWorld,
  withBridgeStore,
  type BaseWorld,
  type WorldEnv,
} from '../base/world';
import {
  canRun,
  computeWorldHash,
  PROTOCOL_VERSION,
  toWireEvent,
  type OutpostMessage,
  type OutpostRole,
  type PeerPose,
  type ShiftLogEntry,
} from '../net/protocol';

export const PRESENCE_HZ = 10;
export const PRESENCE_INTERVAL_MS = 1000 / PRESENCE_HZ; // 100 ms
const MAX_SHIFT_LOG = 5;

const DEFAULT_OUTPOST_ENV: WorldEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: BRIDGE_RANGE },
};

export interface OutpostPersistSnapshot {
  readonly world: BaseWorld;
  readonly version: number;
  readonly ownerId: string;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
}

export default class OutpostRoom extends GameRoom<OutpostMessage> {
  private world: BaseWorld = withBridgeStore(createWorld(1), DEFAULT_OUTPOST_ENV);
  private env: WorldEnv = DEFAULT_OUTPOST_ENV;
  private version = 0;
  private ownerId = '';
  private defaultGuestRole: OutpostRole = 'cobuilder';
  private roles: Record<string, OutpostRole> = {};
  private placedBy: Record<number, string> = {};
  private poses = new Map<string, PeerPose>();
  private shiftLog: ShiftLogEntry[] = [];
  private clockTickMs = 0;

  onCreate(): void {
    this.log.info('outpost room created', {
      roomId: this.roomId,
      roomType: this.roomType,
    });
    this.startPresenceClock();
  }

  onPlayerJoin(player: Player): void {
    if (!this.ownerId) {
      this.ownerId = player.id;
      this.roles[player.id] = 'owner';
      for (const p of this.world.base.pieces) {
        if (!this.placedBy[p.id]) {
          this.placedBy[p.id] = player.id;
        }
      }
    } else if (!this.roles[player.id]) {
      this.roles[player.id] = this.defaultGuestRole;
    }

    const role = this.roleOf(player.id);
    this.sendTo(player.id, {
      type: 'welcome',
      proto: PROTOCOL_VERSION,
      playerId: player.id,
      role,
      version: this.version,
      worldHash: computeWorldHash(this.world),
      world: this.world,
      roles: { ...this.roles },
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
      ...(typeof (this as { roomCode?: string }).roomCode === 'string'
        ? { roomCode: (this as { roomCode?: string }).roomCode }
        : {}),
    });

    if (this.playerCount >= (this.config?.maxPlayers ?? 4)) {
      this.lock();
    }
  }

  onGameMessage(message: GameMessage<OutpostMessage>): void {
    const { sender, payload } = message;
    if (!sender || !sender.connected || !payload) return;

    switch (payload.type) {
      case 'pose': {
        if (![payload.x, payload.y, payload.z, payload.yaw].every(Number.isFinite)) return;
        this.poses.set(sender.id, {
          id: sender.id,
          username: sender.username || sender.id,
          role: this.roleOf(sender.id),
          x: payload.x,
          y: payload.y,
          z: payload.z,
          yaw: payload.yaw,
          look: typeof payload.look === 'string' && payload.look ? payload.look : 'default',
          at: this.clockTickMs,
        });
        return;
      }

      case 'resync': {
        this.sendTo(sender.id, {
          type: 'snapshot',
          proto: PROTOCOL_VERSION,
          version: this.version,
          worldHash: computeWorldHash(this.world),
          world: this.world,
          roles: { ...this.roles },
          placedBy: { ...this.placedBy },
        });
        return;
      }

      case 'setRole': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.sendTo(sender.id, {
            type: 'refused',
            proto: PROTOCOL_VERSION,
            seq: 0,
            cmdKind: 'stage',
            why: 'owner-only',
            version: this.version,
            worldHash: computeWorldHash(this.world),
          });
          return;
        }
        if (!payload.targetId || payload.targetId === this.ownerId) return;
        if (payload.role !== 'owner' && payload.role !== 'cobuilder' && payload.role !== 'visitor') return;
        this.roles[payload.targetId] = payload.role;
        const existingPose = this.poses.get(payload.targetId);
        if (existingPose) {
          this.poses.set(payload.targetId, { ...existingPose, role: payload.role });
        }
        this.broadcast({
          type: 'roleChanged',
          targetId: payload.targetId,
          role: payload.role,
          roles: { ...this.roles },
        });
        this.save();
        return;
      }

      case 'seedWorld': {
        if (this.roleOf(sender.id) !== 'owner' || this.version > 0) return;
        if (!payload.world || payload.world.v !== 4) return;
        this.world = payload.world;
        this.version = 1;
        this.placedBy = {};
        for (const p of this.world.base.pieces) {
          this.placedBy[p.id] = sender.id;
        }
        this.broadcast({
          type: 'snapshot',
          proto: PROTOCOL_VERSION,
          version: this.version,
          worldHash: computeWorldHash(this.world),
          world: this.world,
          roles: { ...this.roles },
          placedBy: { ...this.placedBy },
        });
        this.save();
        return;
      }

      case 'cmd': {
        const role = this.roleOf(sender.id);
        const roleVerdict = canRun(role, payload.cmd, this.world, sender.id, this.placedBy);
        if (!roleVerdict.ok) {
          this.sendTo(sender.id, {
            type: 'refused',
            proto: PROTOCOL_VERSION,
            seq: payload.seq,
            cmdKind: payload.cmd.t,
            why: roleVerdict.why,
            version: this.version,
            worldHash: computeWorldHash(this.world),
          });
          return;
        }

        const beforePieces = new Set(this.world.base.pieces.map((p) => p.id));
        const applied = apply(this.world, this.env, payload.cmd);
        const refusal = applied.events.find((e) => e.type === 'refused');
        if (refusal && refusal.type === 'refused') {
          this.sendTo(sender.id, {
            type: 'refused',
            proto: PROTOCOL_VERSION,
            seq: payload.seq,
            cmdKind: refusal.cmd,
            why: refusal.why,
            version: this.version,
            worldHash: computeWorldHash(this.world),
            ...(refusal.short ? { short: refusal.short } : {}),
          });
          return;
        }

        this.world = applied.world;
        this.version += 1;

        const placedByPatch: Record<number, string> = {};
        const afterPieces = new Set<number>();
        for (const p of this.world.base.pieces) {
          afterPieces.add(p.id);
          if (!beforePieces.has(p.id)) {
            this.placedBy[p.id] = sender.id;
            placedByPatch[p.id] = sender.id;
          }
        }
        for (const id of Object.keys(this.placedBy)) {
          const numId = Number(id);
          if (!afterPieces.has(numId)) {
            delete this.placedBy[numId];
          }
        }

        if (sender.id !== this.ownerId && payload.cmd.t !== 'tick' && payload.cmd.t !== 'hotbar') {
          this.recordShiftEntry(sender, role, payload.cmd.t);
        }

        const worldHash = computeWorldHash(this.world);
        this.broadcast({
          type: 'events',
          proto: PROTOCOL_VERSION,
          version: this.version,
          worldHash,
          actorId: sender.id,
          seq: payload.seq,
          cmd: payload.cmd,
          events: applied.events.map(toWireEvent),
          ...(Object.keys(placedByPatch).length > 0 ? { placedByPatch } : {}),
        });

        if (payload.cmd.t !== 'tick' && payload.cmd.t !== 'hotbar') {
          this.save();
        }
        return;
      }

      default:
        return;
    }
  }

  onPlayerLeave(player: Player, reason: LeaveReason): void {
    this.log.info('player left outpost', { id: player.id, reason });
    this.poses.delete(player.id);
    if (this.playerCount < (this.config?.maxPlayers ?? 4)) {
      this.unlock();
    }
  }

  onDispose(): void {
    this.log.info('outpost room disposed', { roomId: this.roomId, version: this.version });
  }

  protected getPersistState(): Record<string, unknown> {
    const snapshot: OutpostPersistSnapshot = {
      world: this.world,
      version: this.version,
      ownerId: this.ownerId,
      roles: { ...this.roles },
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
    };
    return snapshot as unknown as Record<string, unknown>;
  }

  onRestore(snapshot: Record<string, unknown>): void {
    if (snapshot.world && typeof snapshot.world === 'object') {
      this.world = snapshot.world as BaseWorld;
    }
    if (typeof snapshot.version === 'number' && Number.isFinite(snapshot.version)) {
      this.version = snapshot.version;
    }
    if (typeof snapshot.ownerId === 'string') {
      this.ownerId = snapshot.ownerId;
    }
    if (snapshot.roles && typeof snapshot.roles === 'object') {
      this.roles = { ...(snapshot.roles as Record<string, OutpostRole>) };
    }
    if (snapshot.placedBy && typeof snapshot.placedBy === 'object') {
      this.placedBy = { ...(snapshot.placedBy as Record<number, string>) };
    }
    if (Array.isArray(snapshot.shiftLog)) {
      this.shiftLog = [...(snapshot.shiftLog as ShiftLogEntry[])].slice(-MAX_SHIFT_LOG);
    }
    this.startPresenceClock();
  }

  /** Relays current peer poses to all connected players at 10 Hz. */
  public flushPresence(): void {
    this.clockTickMs += PRESENCE_INTERVAL_MS;
    if (this.poses.size === 0) return;
    this.broadcast({
      type: 'presence',
      peers: [...this.poses.values()],
      serverTime: this.clockTickMs,
    });
  }

  public getWorld(): BaseWorld {
    return this.world;
  }

  public getVersion(): number {
    return this.version;
  }

  public roleOf(playerId: string): OutpostRole {
    if (playerId === this.ownerId) return 'owner';
    return this.roles[playerId] ?? this.defaultGuestRole;
  }

  private startPresenceClock(): void {
    const tick = (): void => this.flushPresence();
    const clk = (this as unknown as { clock?: { setInterval?: (...args: unknown[]) => unknown } }).clock;
    if (!clk || typeof clk.setInterval !== 'function') return;
    try {
      if (clk.setInterval.length >= 3) {
        clk.setInterval('outpost-presence-10hz', tick, PRESENCE_INTERVAL_MS);
      } else {
        clk.setInterval(tick, PRESENCE_INTERVAL_MS);
      }
    } catch {
      try {
        clk.setInterval('outpost-presence-10hz', tick, PRESENCE_INTERVAL_MS);
      } catch {
        // Ignore if mock clock has custom signature
      }
    }
  }

  private recordShiftEntry(sender: Player, role: OutpostRole, cmdKind: string): void {
    const summary = `${sender.username || sender.id} ran ${cmdKind} (v${this.version})`;
    this.shiftLog.push({
      actorId: sender.id,
      username: sender.username || sender.id,
      role,
      summary,
      version: this.version,
      at: this.clockTickMs,
    });
    if (this.shiftLog.length > MAX_SHIFT_LOG) {
      this.shiftLog.splice(0, this.shiftLog.length - MAX_SHIFT_LOG);
    }
  }
}
