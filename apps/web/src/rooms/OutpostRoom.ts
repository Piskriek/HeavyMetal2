// ============================================================================
// File: apps/web/src/rooms/OutpostRoom.ts
// Plan 36 Phase 1 & Phase 2 (TICKET-11 server-authoritative OutpostRoom):
// - Imports only pure modules (base/world.ts apply, net/protocol.ts, net/coop-guardrails.ts, base/plot-height.ts, @hm/*).
// - Checks sender's role with canRun(), enforces POL-115 seed gate and token-bucket rate limit, then runs apply().
// - Persists roles, usernames (POL-117), placedBy, shiftLog, undoLog, defaultGuestRole, and terrain.
// - Supports Lead Architect setRole, setDefaultRole, kickPlayer, and one-click per-author undo (undoAuthor).
// - Runs authoritative 1 Hz machine & harvest tick on this.clock using client beamIntents (POL-114).
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
  isGatePose,
  PROTOCOL_VERSION,
  toWireEvent,
  type BeamIntentMessage,
  type OutpostMessage,
  type OutpostRole,
  type PeerPose,
  type ShiftLogEntry,
  type TerrainMessage,
  type TerrainState,
} from '../net/protocol';
import {
  DEFAULT_RATE_LIMIT,
  findNextUndoCommandsForAuthor,
  recordAuthorBuild,
  TokenBucketLimiter,
  type RateLimitConfig,
  type UndoLogEntry,
} from '../net/coop-guardrails';

export const PRESENCE_HZ = 10;
export const PRESENCE_INTERVAL_MS = 1000 / PRESENCE_HZ; // 100 ms
export const PRESENCE_TIMER = 'outpost-presence-10hz';

export const OUTPOST_TICK_HZ = 1;
export const OUTPOST_TICK_INTERVAL_MS = 1000 / OUTPOST_TICK_HZ; // 1000 ms
export const OUTPOST_TICK_TIMER = 'outpost-world-tick-1hz';

const MAX_SHIFT_LOG = 5;
const DEFAULT_MAX_PLAYERS = 4;

/**
 * The longest sculpt text the room accepts. A 256-cell field carries a few kilobytes for a plot with some cuts; the cap only bounds
 * what one owner can make the room store and send to every visitor.
 */
export const MAX_TERRAIN_CHARS = 200_000;

const DEFAULT_TERRAIN: TerrainState = { seed: OUTPOST_PLOT_SEED, sculpt: '' };

/** The room's ground: the plot's heights (plotHeightAt, the same formula as the clients, with the gate's pad, POL-112) and the Quantum Gate at the origin. */
function groundEnv(terrain: TerrainState): WorldEnv {
  return {
    heightAt: plotHeightAt({ seed: terrain.seed, sculpt: terrain.sculpt, gate: terrain.gate }),
    bridge: { x: 0, z: 0, range: BRIDGE_RANGE },
  };
}

/** The terrain as the wire carries it: to a joiner, on a resync, and to everyone when the Lead Architect changes it. */
function terrainMessage(terrain: TerrainState): TerrainMessage {
  return { type: 'terrain', seed: terrain.seed, sculpt: terrain.sculpt, ...(terrain.gate ? { gate: terrain.gate } : {}) };
}

/** Whether two terrains are the same ground: the seed, the sculpt text and the gate's pose. */
function sameTerrain(a: TerrainState, b: TerrainState): boolean {
  if (a.seed !== b.seed || a.sculpt !== b.sculpt) return false;
  if (!a.gate || !b.gate) return a.gate === b.gate;
  return a.gate.x === b.gate.x && a.gate.z === b.gate.z && a.gate.yaw === b.gate.yaw;
}

export interface OutpostPersistSnapshot {
  readonly world: BaseWorld;
  readonly version: number;
  readonly ownerId: string;
  readonly defaultGuestRole?: OutpostRole;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames?: Readonly<Record<string, string>>;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
  readonly undoLog?: readonly UndoLogEntry[];
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
  private usernames: Record<string, string> = {};
  private placedBy: Record<number, string> = {};
  private poses = new Map<string, PeerPose>();
  private shiftLog: ShiftLogEntry[] = [];
  private undoLog: UndoLogEntry[] = [];
  private beamIntents = new Map<string, BeamIntentMessage>();
  private lastPowerShare: Record<number, number> = {};
  private lastLatched: readonly number[] = [];
  private rateLimiter = new TokenBucketLimiter(DEFAULT_RATE_LIMIT);
  private clockTickMs = 0;
  /** Frames arriving from each sender, joined back into whole messages. */
  private inbound = new Map<string, FrameAssembler>();
  private frameCount = 0;

  constructor(ctx: GameRoomProps) {
    super(ctx);
  }

  override onCreate(): void {
    this.log.info('outpost room created', { roomId: this.roomId, roomType: this.roomType });
    this.startClocks();
  }

  override onPlayerJoin(player: Player): void {
    this.usernames[player.id] = player.username || player.id;
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
    this.sendFramed(player.id, terrainMessage(this.terrain));
    // everyone learns who joined, their username (POL-117), and the role they hold, so each roster is complete
    this.broadcast({
      type: 'roleChanged',
      targetId: player.id,
      role: this.roleOf(player.id),
      roles: { ...this.roles },
      usernames: { ...this.usernames },
      defaultGuestRole: this.defaultGuestRole,
    });

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
        // POL-172: When a guest or host steps into the Earth Lab, clear their plot avatar & active beam intent
        const poseFlags = msg as { readonly inLab?: boolean; readonly leftPlot?: boolean };
        if (poseFlags.inLab === true || poseFlags.leftPlot === true) {
          this.poses.delete(sender.id);
          this.beamIntents.delete(sender.id);
          return;
        }
        if (![msg.x, msg.y, msg.z, msg.yaw].every(Number.isFinite)) return;
        const uname = sender.username || this.usernames[sender.id] || sender.id;
        this.usernames[sender.id] = uname;
        this.poses.set(sender.id, {
          id: sender.id,
          username: uname,
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

      case 'beamIntent': {
        if (this.roleOf(sender.id) === 'visitor') return;
        if (!msg.at || ![msg.at.x, msg.at.z].every(Number.isFinite)) return;
        if (msg.power && typeof msg.power === 'object') {
          this.lastPowerShare = { ...msg.power };
        }
        if (Array.isArray(msg.latched)) {
          this.lastLatched = [...msg.latched];
        }
        if (msg.beam === null) {
          this.beamIntents.delete(sender.id);
        } else if (
          typeof msg.beam === 'object' &&
          Number.isInteger(msg.beam.node) &&
          Number.isFinite(msg.beam.power) &&
          msg.beam.power > 0
        ) {
          this.beamIntents.set(sender.id, msg);
        }
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
          usernames: { ...this.usernames },
          defaultGuestRole: this.defaultGuestRole,
          placedBy: { ...this.placedBy },
          shiftLog: [...this.shiftLog],
        });
        this.sendFramed(sender.id, terrainMessage(this.terrain));
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
        if (msg.role === 'visitor') {
          this.beamIntents.delete(msg.targetId);
        }
        this.broadcast({
          type: 'roleChanged',
          targetId: msg.targetId,
          role: msg.role,
          roles: { ...this.roles },
          usernames: { ...this.usernames },
          defaultGuestRole: this.defaultGuestRole,
        });
        this.save();
        return;
      }

      case 'setDefaultRole': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (msg.role !== 'cobuilder' && msg.role !== 'visitor') return;
        this.defaultGuestRole = msg.role;
        this.broadcast({
          type: 'roleChanged',
          targetId: this.ownerId,
          role: 'owner',
          roles: { ...this.roles },
          usernames: { ...this.usernames },
          defaultGuestRole: this.defaultGuestRole,
        });
        this.save();
        return;
      }

      case 'kickPlayer': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (!msg.targetId || msg.targetId === this.ownerId) return;
        const reason = typeof msg.reason === 'string' && msg.reason.trim() ? msg.reason.trim() : 'Removed by Lead Architect';
        delete this.roles[msg.targetId];
        this.poses.delete(msg.targetId);
        this.inbound.delete(msg.targetId);
        this.beamIntents.delete(msg.targetId);
        this.rateLimiter.clearPlayer(msg.targetId);

        const kickedMsg: OutpostMessage = {
          type: 'kicked',
          targetId: msg.targetId,
          reason,
          roles: { ...this.roles },
          usernames: { ...this.usernames },
        };
        this.sendTo(msg.targetId, kickedMsg);
        this.broadcast(kickedMsg);
        this.kick(msg.targetId, reason);
        this.save();
        return;
      }

      case 'undoAuthor': {
        if (this.roleOf(sender.id) !== 'owner') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (!msg.targetId) return;
        const plan = findNextUndoCommandsForAuthor(this.world, this.placedBy, this.undoLog, msg.targetId);
        if (!plan || plan.commands.length === 0) {
          this.notice(sender.id, 'nothing-to-undo');
          return;
        }
        this.undoLog = plan.remainingLog;
        let undidAny = false;
        for (const removeCmd of plan.commands) {
          if (!this.world.base.pieces.some((p) => p.id === removeCmd.id)) continue;
          const applied = apply(this.world, this.env, removeCmd);
          if (applied.events.some((e) => e.type === 'refused')) continue;
          this.world = applied.world;
          this.version += 1;
          undidAny = true;

          const afterPieces = new Set(this.world.base.pieces.map((p) => p.id));
          for (const key of Object.keys(this.placedBy)) {
            const numId = Number(key);
            if (!afterPieces.has(numId)) delete this.placedBy[numId];
          }

          const targetName = this.usernames[msg.targetId] ?? msg.targetId;
          this.recordShiftEntry(sender, 'owner', `undo(${targetName})`);
          this.broadcastFramed({
            type: 'events',
            proto: PROTOCOL_VERSION,
            version: this.version,
            worldHash: this.worldHash(),
            actorId: sender.id,
            seq: 0,
            cmd: removeCmd,
            events: applied.events.map(toWireEvent),
            shiftLog: [...this.shiftLog],
          });
        }
        if (!undidAny) {
          this.notice(sender.id, 'undo-refused');
          return;
        }
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
        const worldVersion = msg.world ? (msg.world as { readonly v?: unknown }).v : undefined;
        if (!msg.world || (worldVersion !== 4 && worldVersion !== 5)) {
          this.notice(sender.id, 'bad-world');
          return;
        }
        // POL-171: Accept optional gate pose (and seed/sculpt) with seedWorld so the footing pad sits at
        // the host's Moon Twin Gate immediately, before the first sculpt arrives.
        const seedExtras = msg as {
          readonly gate?: unknown;
          readonly seed?: unknown;
          readonly sculpt?: unknown;
        };
        if (seedExtras.gate !== undefined && isGatePose(seedExtras.gate)) {
          const nextSeed = Number.isInteger(seedExtras.seed) ? (seedExtras.seed as number) : this.terrain.seed;
          const nextSculpt =
            typeof seedExtras.sculpt === 'string' && seedExtras.sculpt.length <= MAX_TERRAIN_CHARS
              ? seedExtras.sculpt
              : this.terrain.sculpt;
          this.terrain = {
            seed: nextSeed,
            sculpt: nextSculpt,
            gate: { x: seedExtras.gate.x, z: seedExtras.gate.z, yaw: seedExtras.gate.yaw },
          };
          this.env = groundEnv(this.terrain);
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
          usernames: { ...this.usernames },
          defaultGuestRole: this.defaultGuestRole,
          placedBy: { ...this.placedBy },
          shiftLog: [...this.shiftLog],
        });
        if (this.terrain.gate) {
          this.broadcastFramed(terrainMessage(this.terrain));
        }
        this.save();
        return;
      }

      case 'terrain': {
        // POL-173: Both Lead Architect ('owner') and Co-Builders ('cobuilder') may sculpt and paint the shared plot
        const senderRole = this.roleOf(sender.id);
        if (senderRole !== 'owner' && senderRole !== 'cobuilder') {
          this.notice(sender.id, 'owner-only');
          return;
        }
        if (!Number.isInteger(msg.seed) || typeof msg.sculpt !== 'string') return;
        if (msg.gate !== undefined && !isGatePose(msg.gate)) return;
        if (msg.sculpt.length > MAX_TERRAIN_CHARS) {
          this.notice(sender.id, 'terrain-too-large');
          return;
        }
        const next: TerrainState = { seed: msg.seed, sculpt: msg.sculpt, ...(msg.gate ? { gate: { x: msg.gate.x, z: msg.gate.z, yaw: msg.gate.yaw } } : {}) };
        if (sameTerrain(next, this.terrain)) return;
        this.terrain = next;
        this.env = groundEnv(this.terrain);
        this.broadcastFramed(terrainMessage(this.terrain));
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

    // 1. Token-bucket rate limit check for non-owners
    const rateVerdict = this.rateLimiter.tryConsume(sender.id, role, this.clockTickMs);
    if (!rateVerdict.ok) {
      this.sendTo(sender.id, {
        type: 'refused',
        proto: PROTOCOL_VERSION,
        seq,
        cmdKind: cmd.t,
        why: rateVerdict.why,
        version: this.version,
        worldHash: this.worldHash(),
      });
      return;
    }

    // 2. Role guardrail check
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

      // 3. POL-115: Hold non-owner commands until the Lead Architect seeds the room (version > 0)
      if (role !== 'owner' && this.version === 0) {
        this.sendTo(sender.id, {
          type: 'refused',
          proto: PROTOCOL_VERSION,
          seq,
          cmdKind: cmd.t,
          why: 'waiting-for-host-seed',
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
    const newPieceIds: number[] = [];
    const afterPieces = new Set<number>();
    for (const p of this.world.base.pieces) {
      afterPieces.add(p.id);
      if (!beforePieces.has(p.id)) {
        this.placedBy[p.id] = sender.id;
        placedByPatch[p.id] = sender.id;
        newPieceIds.push(p.id);
      }
    }
    for (const id of Object.keys(this.placedBy)) {
      const numId = Number(id);
      if (!afterPieces.has(numId)) delete this.placedBy[numId];
    }

    if (newPieceIds.length > 0) {
      this.undoLog = recordAuthorBuild(this.undoLog, {
        actorId: sender.id,
        username: sender.username || this.usernames[sender.id] || sender.id,
        role,
        version: this.version,
        cmdKind: cmd.t,
        pieceIds: newPieceIds,
        at: this.clockTickMs,
      });
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
      shiftLog: [...this.shiftLog],
    });

    if (cmd.t !== 'tick' && cmd.t !== 'hotbar') this.save();
  }

  /**
   * POL-114: Server-authoritative 1 Hz machine & Extraction Beam tick on `this.clock`.
   * Runs only when the room is seeded (`version > 0`) and has active machine jobs or an active `beamIntent`,
   * and broadcasts an `'events'` frame only when state changes or work progresses.
   */
  public flushWorldTick(dtSec = OUTPOST_TICK_INTERVAL_MS / 1000): void {
    if (this.version === 0) return;
    const hasRunningMachine = this.world.machines.some((m) => m.on !== false && m.jobs.length > 0);
    const activeIntent = [...this.beamIntents.entries()].find(([pid, intent]) => {
      const p = this.players.get(pid);
      return (!p || p.connected) && this.roleOf(pid) !== 'visitor' && intent.beam !== null;
    });

    if (!hasRunningMachine && !activeIntent) return;

    const actorId = activeIntent ? activeIntent[0] : (this.ownerId || 'server');
    const at = activeIntent ? activeIntent[1].at : { x: 0, z: 0 };
    const beam = activeIntent ? activeIntent[1].beam : null;
    const power: Record<number, number> = { ...this.lastPowerShare };
    for (const m of this.world.machines) {
      if (power[m.id] === undefined) power[m.id] = 1;
    }

    const tickCmd: BaseCommand = {
      t: 'tick',
      at,
      dt: dtSec,
      beam,
      power,
      ...(this.lastLatched.length > 0 ? { latched: this.lastLatched } : {}),
    };

    const applied = apply(this.world, this.env, tickCmd);
    if (applied.events.some((e) => e.type === 'refused')) return;

    this.world = applied.world;
    this.version += 1;
    this.broadcastFramed({
      type: 'events',
      proto: PROTOCOL_VERSION,
      version: this.version,
      worldHash: this.worldHash(),
      actorId,
      seq: 0,
      cmd: tickCmd,
      events: applied.events.map(toWireEvent),
    });
    if (applied.events.length > 0) this.save();
  }

  override onPlayerLeave(player: Player, reason: LeaveReason): void {
    this.log.info('player left outpost', { id: player.id, reason });
    this.poses.delete(player.id);
    this.inbound.delete(player.id);
    this.beamIntents.delete(player.id);
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
      defaultGuestRole: this.defaultGuestRole,
      roles: { ...this.roles },
      usernames: { ...this.usernames },
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
      undoLog: [...this.undoLog],
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
    if (snapshot.defaultGuestRole === 'cobuilder' || snapshot.defaultGuestRole === 'visitor') {
      this.defaultGuestRole = snapshot.defaultGuestRole;
    }
    if (snapshot.roles && typeof snapshot.roles === 'object') {
      this.roles = { ...(snapshot.roles as Record<string, OutpostRole>) };
    }
    if (snapshot.usernames && typeof snapshot.usernames === 'object') {
      this.usernames = { ...(snapshot.usernames as Record<string, string>) };
    }
    if (snapshot.placedBy && typeof snapshot.placedBy === 'object') {
      this.placedBy = { ...(snapshot.placedBy as Record<number, string>) };
    }
    if (Array.isArray(snapshot.shiftLog)) {
      this.shiftLog = [...(snapshot.shiftLog as ShiftLogEntry[])].slice(-MAX_SHIFT_LOG);
    }
    if (Array.isArray(snapshot.undoLog)) {
      this.undoLog = [...(snapshot.undoLog as UndoLogEntry[])];
    }
    const saved = snapshot.terrain as Partial<TerrainState> | undefined;
    if (saved && Number.isInteger(saved.seed) && typeof saved.sculpt === 'string') {
      this.terrain = { seed: saved.seed as number, sculpt: saved.sculpt, ...(isGatePose(saved.gate) ? { gate: saved.gate } : {}) };
    }
    this.env = groundEnv(this.terrain);
    this.startClocks();
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

  public setRateLimit(config: RateLimitConfig): void {
    this.rateLimiter.setConfig(config);
  }

  public getUndoLog(): readonly UndoLogEntry[] {
    return [...this.undoLog];
  }

  public getUsernames(): Readonly<Record<string, string>> {
    return { ...this.usernames };
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
      usernames: { ...this.usernames },
      defaultGuestRole: this.defaultGuestRole,
      placedBy: { ...this.placedBy },
      shiftLog: [...this.shiftLog],
    };
  }

  private maxPlayers(): number {
    return this.config?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
  }

  private startClocks(): void {
    this.clock.setInterval(PRESENCE_TIMER, () => this.flushPresence(), PRESENCE_INTERVAL_MS);
    this.clock.setInterval(OUTPOST_TICK_TIMER, () => this.flushWorldTick(), OUTPOST_TICK_INTERVAL_MS);
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
    const uname = sender.username || this.usernames[sender.id] || sender.id;
    const summary = `${uname} ran ${cmdKind} (v${this.version})`;
    this.shiftLog.push({
      actorId: sender.id,
      username: uname,
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
