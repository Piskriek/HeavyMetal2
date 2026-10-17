// ============================================================================
// File: apps/web/src/rooms/OutpostRoom.ts
// Plan 36 Phase 1 (Deliverable 2, server-authoritative outpost GameRoom):
// - Imports only pure modules (base/world.ts apply, net/protocol.ts, base/plot-height.ts, @hm/*).
// - Checks the sender's role with canRun(), then runs apply() against the plot's ground.
// - Broadcasts confirmed events with a monotonic version and a worldHash; refusals go to the sender only.
// - Keeps the plot's terrain (seed and sculpt) from the Lead Architect, and builds its ground with plotHeightAt.
// - Relays poses at 10 Hz on this.clock (never raw timers); persists through getPersistState and onRestore.
// ============================================================================

import {
  GameRoom,
  type GameMessage,
  type GameRoomProps,
  type LeaveReason,
  type Player,
} from '@series-inc/rundot-game-sdk/mp-server';
import {
  apply,
  BRIDGE_RANGE,
  createWorld,
  withBridgeStore,
  type Applied,
  type BaseCommand,
  type BaseWorld,
  type WorldEnv,
} from '../base/world';
import { OUTPOST_PLOT_SEED, plotHeightAt } from '../base/plot-height';
import {
  canRun,
  computeWorldHash,
  FrameAssembler,
  frameMessage,
  PROTOCOL_VERSION,
  toWireEvent,
  type OutpostMessage,
  type OutpostRole,
  type PeerPose,
  type ShiftLogEntry,
  type TerrainState,
} from '../net/protocol';

export const PRESENCE_HZ = 10;
export const PRESENCE_INTERVAL_MS = 1000 / PRESENCE_HZ; // 100 ms
export const PRESENCE_TIMER = 'outpost-presence-10hz';
const MAX_SHIFT_LOG = 5;
const DEFAULT_MAX_PLAYERS = 4;
/**
 * The longest sculpt text the room accepts. A 256-cell field carries a few kilobytes for a plot with some cuts; the cap only bounds
 * what one owner can make the room store and send to every visitor.
 */
export const MAX_TERRAIN_CHARS = 200_000;

const DEFAULT_TERRAIN: TerrainState = { seed: OUTPOST_PLOT_SEED, sculpt: '' };

/** The room's ground: the plot's heights (plotHeightAt, the same formula as the clients) and the Quantum Gate at the origin. */
function groundEnv(terrain: TerrainState): WorldEnv {
  return {
    heightAt: plotHeightAt({ seed: terrain.seed, sculpt: terrain.sculpt }),
    bridge: { x: 0, z: 0, range: BRIDGE_RANGE },
  };
}

export interface OutpostPersistSnapshot {
  readonly world: BaseWorld;
  readonly version: number;
  readonly ownerId: string;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
  readonly terrain: TerrainState;
}

export default class OutpostRoom extends GameRoom<OutpostMessage> {
  private terrain: TerrainState = DEFAULT_TERRAIN;
  private env: WorldEnv = groundEnv(DEFAULT_TERRAIN);
  private world: BaseWorld = withBridgeStore(createWorld(1), this.env);
  /** The world's hash, computed once per world (a 37 KB hash is too dear to repeat on every refusal). */
  private hashedWorld: BaseWorld | null = null;
  private hashed = '';
  private version = 0;
  private ownerId = '';
  private defaultGuestRole: OutpostRole = 'cobuilder';
  private roles: Record<string, OutpostRole> = {};
  private placedBy: Record<number, string> = {};
  private poses = new Map<string, PeerPose>();
  private shiftLog: ShiftLogEntry[] = [];
  private clockTickMs = 0;
  /** Frames arriving from each sender, joined back into whole messages. */
  private inbound = new Map<string, FrameAssembler>();
  private frameCount = 0;

  constructor(ctx: GameRoomProps) {
    super(ctx);
  }

  override onCreate(): void {
    this.log.info('outpost room created', { roomId: this.roomId, roomType: this.roomType });
    this.startPresenceClock();
  }

  override onPlayerJoin(player: Player): void {
    if (!this.ownerId) {
      this.ownerId = player.id;
      this.roles[player.id] = 'owner';
      for (const p of this.world.base.pieces) {
        if (!this.placedBy[p.id]) this.placedBy[p.id] = player.id;
      }
    } else if (!this.roles[player.id]) {
      this.roles[player.id] = this.defaultGuestRole;
    }

    this.sendFramed(player.id, this.welcomeFor(player.id));
    this.sendFramed(player.id, { type: 'terrain', seed: this.terrain.seed, sculpt: this.terrain.sculpt });
    // everyone learns who joined, and the role they hold, so each roster is complete
    this.broadcast({ type: 'roleChanged', targetId: player.id, role: this.roleOf(player.id), roles: { ...this.roles } });

    if (this.playerCount >= this.maxPlayers()) this.lock();
  }

  override onGameMessage(message: GameMessage<OutpostMessage>): void {
    const { sender, payload } = message;
    if (!sender || !sender.connected || !payload) return;
    if (payload.type === 'chunk') {
      const whole = this.assemblerFor(sender.id).push(payload);
      if (whole !== null) this.handle(sender, whole);
      return;
    }
    this.handle(sender, payload);
  }

  private handle(sender: Player, msg: OutpostMessage): void {
    switch (msg.type) {
      case 'pose': {
        if (![msg.x, msg.y, msg.z, msg.yaw].every(Number.isFinite)) return;
        this.poses.set(sender.id, {
          id: sender.id,
          username: sender.username || sender.id,
          role: this.roleOf(sender.id),
          x: msg.x,
          y: msg.y,
          z: msg.z,
          yaw: msg.yaw,
          look: typeof msg.look === 'string' && msg.look ? msg.look : 'default',
          at: this.clockTickMs,
        });
        return;
      }

      case 'hello': {
        this.sendFramed(sender.id, this.welcomeFor(sender.id));
        return;
      }

      case 'resync': {
        this.sendFramed(sender.id, {
          type: 'snapshot',
          proto: PROTOCOL_VERSION,
          version: this.version,
          worldHash: this.worldHash(),
          world: this.world,
          roles: { ...this.roles },
          placedBy: { ...this.placedBy },
        });
        this.sendFramed(sender.id, { type: 'terrain', seed: this.terrain.seed, sculpt: this.terrain.sculpt });
        return;
      }

      case 'setRole': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (!msg.targetId || msg.targetId === this.ownerId) return;
        if (msg.role !== 'owner' && msg.role !== 'cobuilder' && msg.role !== 'visitor') return;
        this.roles[msg.targetId] = msg.role;
        const existingPose = this.poses.get(msg.targetId);
        if (existingPose) this.poses.set(msg.targetId, { ...existingPose, role: msg.role });
        this.broadcast({ type: 'roleChanged', targetId: msg.targetId, role: msg.role, roles: { ...this.roles } });
        this.save();
        return;
      }

      case 'seedWorld': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (this.version > 0) {
          this.notice(sender.id, 'already-seeded');
          return;
        }
        if (!msg.world || msg.world.v !== 4) {
          this.notice(sender.id, 'bad-world');
          return;
        }
        this.world = msg.world;
        this.version = 1;
        this.placedBy = {};
        for (const p of this.world.base.pieces) this.placedBy[p.id] = sender.id;
        this.broadcastFramed({
          type: 'snapshot',
          proto: PROTOCOL_VERSION,
          version: this.version,
          worldHash: this.worldHash(),
          world: this.world,
          roles: { ...this.roles },
          placedBy: { ...this.placedBy },
        });
        this.save();
        return;
      }

      case 'terrain': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (!Number.isInteger(msg.seed) || typeof msg.sculpt !== 'string') return;
        if (msg.sculpt.length > MAX_TERRAIN_CHARS) {
          this.notice(sender.id, 'terrain-too-large');
          return;
        }
        if (msg.seed === this.terrain.seed && msg.sculpt === this.terrain.sculpt) return;
        this.terrain = { seed: msg.seed, sculpt: msg.sculpt };
        this.env = groundEnv(this.terrain);
        this.broadcastFramed({ type: 'terrain', seed: this.terrain.seed, sculpt: this.terrain.sculpt });
        this.save();
        return;
      }

      case 'cmd': {
        this.runCommand(sender, msg.seq, msg.cmd);
        return;
      }

      default:
        return;
    }
  }

  private runCommand(sender: Player, seq: number, cmd: BaseCommand): void {
    if (!cmd || typeof cmd !== 'object' || typeof (cmd as { t?: unknown }).t !== 'string') {
      this.notice(sender.id, 'bad-command');
      return;
    }
    const role = this.roleOf(sender.id);
    let applied: Applied;
    try {
      const roleVerdict = canRun(role, cmd, this.world, sender.id, this.placedBy);
      if (!roleVerdict.ok) {
        this.sendTo(sender.id, {
          type: 'refused',
          proto: PROTOCOL_VERSION,
          seq,
          cmdKind: cmd.t,
          why: roleVerdict.why,
          version: this.version,
          worldHash: this.worldHash(),
        });
        return;
      }
      applied = apply(this.world, this.env, cmd);
    } catch {
      // a command the rules cannot read is refused, never allowed to break the room
      this.notice(sender.id, 'bad-command');
      return;
    }

    const refusal = applied.events.find((e) => e.type === 'refused');
    if (refusal && refusal.type === 'refused') {
      this.sendTo(sender.id, {
        type: 'refused',
        proto: PROTOCOL_VERSION,
        seq,
        cmdKind: refusal.cmd,
        why: refusal.why,
        version: this.version,
        worldHash: this.worldHash(),
        ...(refusal.short ? { short: refusal.short } : {}),
      });
      return;
    }

    const beforePieces = new Set(this.world.base.pieces.map((p) => p.id));
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
      if (!afterPieces.has(numId)) delete this.placedBy[numId];
    }

    if (sender.id !== this.ownerId && cmd.t !== 'tick' && cmd.t !== 'hotbar') {
      this.recordShiftEntry(sender, role, cmd.t);
    }

    this.broadcastFramed({
      type: 'events',
      proto: PROTOCOL_VERSION,
      version: this.version,
      worldHash: this.worldHash(),
      actorId: sender.id,
      seq,
      cmd,
      events: applied.events.map(toWireEvent),
      ...(Object.keys(placedByPatch).length > 0 ? { placedByPatch } : {}),
    });

    if (cmd.t !== 'tick' && cmd.t !== 'hotbar') this.save();
  }

  override onPlayerLeave(player: Player, reason: LeaveReason): void {
    this.log.info('player left outpost', { id: player.id, reason });
    this.poses.delete(player.id);
    this.inbound.delete(player.id);
    if (this.playerCount < this.maxPlayers()) this.unlock();
  }

  override onDispose(): void {
    this.log.info('outpost room disposed', { roomId: this.roomId, version: this.version });
  }

  protected override getPersistState(): Record<string, unknown> {
    const snapshot: OutpostPersistSnapshot = {
      world: this.world,
      version: this.version,
      ownerId: this.ownerId,
      roles: { ...this.roles },
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
      terrain: { ...this.terrain },
    };
    return snapshot as unknown as Record<string, unknown>;
  }

  override onRestore(snapshot: Record<string, unknown>): void {
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
    const saved = snapshot.terrain as Partial<TerrainState> | undefined;
    if (saved && Number.isInteger(saved.seed) && typeof saved.sculpt === 'string') {
      this.terrain = { seed: saved.seed as number, sculpt: saved.sculpt };
    }
    this.env = groundEnv(this.terrain);
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

  private worldHash(): string {
    if (this.hashedWorld !== this.world) {
      this.hashed = computeWorldHash(this.world);
      this.hashedWorld = this.world;
    }
    return this.hashed;
  }

  public getWorld(): BaseWorld {
    return this.world;
  }

  public getVersion(): number {
    return this.version;
  }

  public getTerrain(): TerrainState {
    return { ...this.terrain };
  }

  public roleOf(playerId: string): OutpostRole {
    if (playerId === this.ownerId) return 'owner';
    return this.roles[playerId] ?? this.defaultGuestRole;
  }

  /** The welcome for one player: their seat, the room's world and roster. A player sends hello to ask for it again. */
  private welcomeFor(playerId: string): OutpostMessage {
    return {
      type: 'welcome',
      proto: PROTOCOL_VERSION,
      playerId,
      role: this.roleOf(playerId),
      version: this.version,
      worldHash: this.worldHash(),
      world: this.world,
      roles: { ...this.roles },
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
    };
  }

  private maxPlayers(): number {
    return this.config?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
  }

  private startPresenceClock(): void {
    this.clock.setInterval(PRESENCE_TIMER, () => this.flushPresence(), PRESENCE_INTERVAL_MS);
  }

  private assemblerFor(playerId: string): FrameAssembler {
    let assembler = this.inbound.get(playerId);
    if (!assembler) {
      assembler = new FrameAssembler();
      this.inbound.set(playerId, assembler);
    }
    return assembler;
  }

  /** Sends a message to one player, in as many frames as it needs. */
  private sendFramed(playerId: string, msg: OutpostMessage): void {
    for (const frame of frameMessage(msg, this.nextFrameId())) this.sendTo(playerId, frame);
  }

  /** Broadcasts a message to everyone, in as many frames as it needs. */
  private broadcastFramed(msg: OutpostMessage): void {
    for (const frame of frameMessage(msg, this.nextFrameId())) this.broadcast(frame);
  }

  /** A note to one player that is not a command refusal (for example, the Lead Architect's rights). */
  private notice(playerId: string, why: string): void {
    this.sendTo(playerId, { type: 'notice', proto: PROTOCOL_VERSION, why });
  }

  private nextFrameId(): number {
    this.frameCount += 1;
    return this.frameCount;
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
