// ============================================================================
// File: apps/web/src/net/outpost-client.ts
// Plan 36 Phase 1 & Phase 2 (TICKET-11 client outpost network layer):
// connectOutpost('host' | code) returns { send(cmd), onEvents(cb), onPresence(cb), state(), leave() } and Phase 2 controls:
// - Predict and confirm: a command applies locally at once (apply() on the plot's ground), then the room's events confirm it.
// - Phase 2 Lead Architect controls: setRole, setDefaultRole, kickPlayer, undoAuthor.
// - POL-114: sendBeamIntent(intent) for server-authoritative machine & harvest ticks.
// - POL-115: holds non-owner builds while version === 0 ('waiting-for-host-seed').
// - POL-117: tracks player usernames from welcome/snapshot/roleChanged so roster names show before movement.
// The RUN SDK is loaded only when a room is connected for real: nothing from it loads when this module is imported.
// ============================================================================

import { OUTPOST_PLOT_SEED, plotHeightAt } from '../base/plot-height';
import {
  apply,
  BRIDGE_RANGE,
  createWorld,
  withBridgeStore,
  type Applied,
  type BaseCommand,
  type BaseEvent,
  type BaseWorld,
  type WorldEnv,
} from '../base/world';
import {
  canRun,
  computeWorldHash,
  FrameAssembler,
  fromWireEvent,
  frameMessage,
  PROTOCOL_VERSION,
  roleName,
  verifyVersionAndHash,
  type OutpostMessage,
  type OutpostRole,
  type PeerPose,
  type ShiftLogEntry,
  type TerrainState,
} from './protocol';

export const INTERPOLATION_DELAY_MS = 100;

export type ReconnectState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface RoomCallbacks<TMessage = OutpostMessage> {
  onMessage?(msg: TMessage): void;
  /** Messages the room sent to this player alone (the SDK's sendTo). */
  onPrivateMessage?(msg: TMessage): void;
  onPlayerJoined?(player: { readonly id: string; readonly username: string }): void;
  onPlayerLeft?(playerId: string): void;
  onReconnecting?(): void;
  onReconnected?(): void;
  onDisconnect?(): void;
  onError?(err: string): void;
}

export interface ServerRoomLike<TMessage = OutpostMessage> {
  readonly roomCode?: string;
  /** The SDK's own id for this player, known as soon as the room is joined. */
  readonly playerId?: string;
  readonly connectionState?: string;
  on(callbacks: RoomCallbacks<TMessage>): void;
  send(message: TMessage): void;
  leave(): void;
  getServerTime?(): number;
}

export interface RealtimeSdkLike {
  createRoom<TMessage = OutpostMessage>(roomType: string): Promise<ServerRoomLike<TMessage>>;
  joinOrCreateRoom<TMessage = OutpostMessage>(roomType: string): Promise<ServerRoomLike<TMessage>>;
  joinRoomByCode<TMessage = OutpostMessage>(code: string): Promise<ServerRoomLike<TMessage>>;
}

export interface OutpostClientState {
  readonly connectionState: ReconnectState;
  readonly roomCode: string | null;
  readonly playerId: string | null;
  readonly role: OutpostRole;
  readonly roleLabel: 'Lead Architect' | 'Co-Builder' | 'Field Observer';
  readonly defaultGuestRole: OutpostRole;
  readonly version: number;
  readonly world: BaseWorld;
  readonly confirmedWorld: BaseWorld;
  readonly worldHash: string;
  readonly confirmedHash: string;
  readonly pendingCount: number;
  readonly resyncCount: number;
  readonly peers: readonly PeerPose[];
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames: Readonly<Record<string, string>>;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
  readonly terrain: TerrainState;
  readonly lastRefusal: { readonly cmdKind: BaseCommand['t']; readonly why: string } | null;
  readonly lastNotice: string | null;
  readonly lastError: string | null;
  readonly kickedReason: string | null;
}

export type EventsCallback = (
  events: readonly BaseEvent[],
  meta: {
    readonly version: number;
    readonly actorId: string;
    readonly confirmed: boolean;
    readonly seq: number;
  },
) => void;

export type PresenceCallback = (
  peers: readonly PeerPose[],
  serverTime: number,
) => void;

export interface OutpostClient {
  send(cmd: BaseCommand): Applied;
  sendPose(pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly look?: string }): void;
  sendBeamIntent(intent: {
    readonly at: { readonly x: number; readonly z: number };
    readonly beam: { readonly node: number; readonly power: number } | null;
    readonly power?: Readonly<Record<number, number>>;
    readonly latched?: readonly number[];
  }): void;
  setRole(targetId: string, role: OutpostRole): void;
  setDefaultRole(role: OutpostRole): boolean;
  kickPlayer(targetId: string, reason?: string): boolean;
  undoAuthor(targetId: string): boolean;
  /**
   * The Lead Architect's terrain: the plot's seed and the beam save's sculpt text. The room applies it in order and relays it, and
   * this client's ground changes when the room's copy comes back. False (and nothing sent) for anyone but the Lead Architect.
   */
  setTerrain(terrain: TerrainState): boolean;
  /**
   * The Lead Architect's own base, sent to a new room (the room takes it once, while it has no commands). False for anyone else, or
   * when the room already has a world. The play screen calls it when the host's play opens, since the host may host from the grid first.
   */
  seedWorld(world: BaseWorld): boolean;
  samplePeers(renderTimeMs?: number): PeerPose[];
  onEvents(cb: EventsCallback): () => void;
  onPresence(cb: PresenceCallback): () => void;
  onTerrain(cb: (terrain: TerrainState) => void): () => void;
  onStateChange(cb: (state: OutpostClientState) => void): () => void;
  state(): OutpostClientState;
  leave(): void;
}

export interface ConnectOutpostOptions {
  /** The host's own base world. A new outpost room is seeded with it, once. */
  readonly initialWorld?: BaseWorld;
  /** The host's plot terrain, sent to the room on hosting. Default: the plot's seed with no edits. */
  readonly terrain?: TerrainState;
  readonly playerId?: string;
  /** A transport in place of the RUN room (tests). */
  readonly room?: ServerRoomLike<OutpostMessage>;
  /** The RUN realtime API in place of the one the SDK provides (tests). */
  readonly realtime?: RealtimeSdkLike;
}

/** A world's hash, computed once per world object: a hash of the whole base is too dear to repeat for every state change. */
const hashes = new WeakMap<BaseWorld, string>();
function hashOf(world: BaseWorld): string {
  let hash = hashes.get(world);
  if (hash === undefined) {
    hash = computeWorldHash(world);
    hashes.set(world, hash);
  }
  return hash;
}

/** The ground a client builds on for a terrain: the plot's heights, and the Quantum Gate at the origin. */
function groundEnvFor(terrain: TerrainState): WorldEnv {
  return {
    heightAt: plotHeightAt({ seed: terrain.seed, sculpt: terrain.sculpt }),
    bridge: { x: 0, z: 0, range: BRIDGE_RANGE },
  };
}

interface PendingCommand {
  readonly seq: number;
  readonly baseVersion: number;
  readonly cmd: BaseCommand;
}

interface PoseHistorySample {
  readonly pose: PeerPose;
  readonly t: number;
}

function lerpAngleRad(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Pure helper: interpolates remote peer poses 100 ms (`INTERPOLATION_DELAY_MS`) behind `serverTime`.
 */
export function interpolatePeerPose(
  samples: readonly PoseHistorySample[],
  targetTimeMs: number,
): PeerPose | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return samples[0]!.pose;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (targetTimeMs <= first.t) return first.pose;
  if (targetTimeMs >= last.t) return last.pose;

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    if (targetTimeMs >= a.t && targetTimeMs <= b.t) {
      const span = Math.max(1e-3, b.t - a.t);
      const alpha = Math.max(0, Math.min(1, (targetTimeMs - a.t) / span));
      return {
        ...b.pose,
        x: a.pose.x + (b.pose.x - a.pose.x) * alpha,
        y: a.pose.y + (b.pose.y - a.pose.y) * alpha,
        z: a.pose.z + (b.pose.z - a.pose.z) * alpha,
        yaw: lerpAngleRad(a.pose.yaw, b.pose.yaw, alpha),
        at: targetTimeMs,
      };
    }
  }
  return last.pose;
}

/**
 * The RUN realtime API, loaded on first use. Only a RUN build provides it; elsewhere the import is a stub and this is null.
 * Exported so the screens can show a plain build's co-op as unavailable without opening a room.
 */
export async function loadRealtimeSdk(): Promise<RealtimeSdkLike | null> {
  const mod = (await import('@series-inc/rundot-game-sdk/api')) as unknown as { default?: { realtime?: RealtimeSdkLike } };
  return mod.default?.realtime ?? null;
}

/**
 * Connects to a live or persisted Outpost room (`'host'` creates a new outpost room; a 6-character code calls `joinRoomByCode`).
 */
export async function connectOutpost(
  target: 'host' | string,
  options: ConnectOutpostOptions = {},
): Promise<OutpostClient> {
  const isHost = target.trim().toLowerCase() === 'host';
  const normalizedCode = isHost ? null : target.trim().toUpperCase();

  let room: ServerRoomLike<OutpostMessage>;
  if (options.room) {
    room = options.room;
  } else {
    const sdk = options.realtime ?? (await loadRealtimeSdk());
    if (!sdk) {
      throw new Error('RUN realtime SDK is not available in this build.');
    }
    room = isHost
      ? await sdk.createRoom<OutpostMessage>('outpost')
      : await sdk.joinRoomByCode<OutpostMessage>(normalizedCode!);
  }

  let connectionState: ReconnectState = 'connected';
  let roomCode: string | null = room.roomCode ?? normalizedCode;
  let playerId: string | null = options.playerId ?? room.playerId ?? (isHost ? 'host' : null);
  let role: OutpostRole = isHost ? 'owner' : 'cobuilder';
  let defaultGuestRole: OutpostRole = 'cobuilder';
  let version = 0;
  let terrain: TerrainState = { seed: OUTPOST_PLOT_SEED, sculpt: '' };
  let env: WorldEnv = groundEnvFor(terrain);
  let confirmedWorld: BaseWorld = options.initialWorld ?? withBridgeStore(createWorld(1), env);
  let predictedWorld: BaseWorld = confirmedWorld;
  let roles: Record<string, OutpostRole> = playerId ? { [playerId]: role } : {};
  let usernames: Record<string, string> = {};
  let placedBy: Record<number, string> = {};
  let shiftLog: ShiftLogEntry[] = [];
  let peers: PeerPose[] = [];
  let lastServerTime = 0;
  let seqCounter = 0;
  let frameCounter = 0;
  let resyncCount = 0;
  let lastRefusal: { readonly cmdKind: BaseCommand['t']; readonly why: string } | null = null;
  let lastNotice: string | null = null;
  let lastError: string | null = null;
  let kickedReason: string | null = null;
  /** Whether the first welcome has come: the host seeds and sends its terrain once, on that one. */
  let greeted = false;

  const pending: PendingCommand[] = [];
  const poseHistory = new Map<string, PoseHistorySample[]>();
  const inbound = new FrameAssembler();
  const eventListeners = new Set<EventsCallback>();
  const presenceListeners = new Set<PresenceCallback>();
  const terrainListeners = new Set<(terrain: TerrainState) => void>();
  const stateListeners = new Set<(state: OutpostClientState) => void>();

  /** Sends a message, in as many frames as it needs. */
  const sendFramed = (msg: OutpostMessage): void => {
    frameCounter += 1;
    for (const frame of frameMessage(msg, frameCounter)) room.send(frame);
  };

  const recomputePredictedWorld = (): void => {
    let w = confirmedWorld;
    for (const item of pending) {
      const r = apply(w, env, item.cmd);
      if (!r.events.some((e) => e.type === 'refused')) {
        w = r.world;
      }
    }
    predictedWorld = w;
  };

  const buildState = (): OutpostClientState => ({
    connectionState,
    roomCode,
    playerId,
    role,
    roleLabel: roleName(role),
    defaultGuestRole,
    version,
    world: predictedWorld,
    confirmedWorld,
    worldHash: hashOf(predictedWorld),
    confirmedHash: hashOf(confirmedWorld),
    pendingCount: pending.length,
    resyncCount,
    peers,
    roles: { ...roles },
    usernames: { ...usernames },
    placedBy: { ...placedBy },
    shiftLog: [...shiftLog],
    terrain: { ...terrain },
    lastRefusal,
    lastNotice,
    lastError,
    kickedReason,
  });

  const emitState = (): void => {
    const snap = buildState();
    for (const cb of stateListeners) cb(snap);
  };

  const requestResync = (): void => {
    resyncCount += 1;
    sendFramed({
      type: 'resync',
      proto: PROTOCOL_VERSION,
      clientVersion: version,
      clientHash: hashOf(confirmedWorld),
    });
    emitState();
  };

  const applyTerrain = (next: TerrainState): void => {
    terrain = { seed: next.seed, sculpt: next.sculpt };
    env = groundEnvFor(terrain);
    recomputePredictedWorld();
    for (const cb of terrainListeners) cb({ ...terrain });
    emitState();
  };

  const handle = (msg: OutpostMessage): void => {
    switch (msg.type) {
      case 'welcome': {
        const first = !greeted;
        greeted = true;
        playerId = msg.playerId;
        role = msg.role;
        if (msg.defaultGuestRole) defaultGuestRole = msg.defaultGuestRole;
        version = msg.version;
        confirmedWorld = msg.world;
        roles = { ...msg.roles };
        if (msg.usernames) usernames = { ...usernames, ...msg.usernames };
        placedBy = { ...msg.placedBy };
        shiftLog = [...msg.shiftLog];
        recomputePredictedWorld();
        if (first) {
          // the host seeds a new room with its own base, once; the room answers with a snapshot
          if (isHost && options.initialWorld && msg.version === 0) {
            confirmedWorld = options.initialWorld;
            predictedWorld = options.initialWorld;
            sendFramed({ type: 'seedWorld', proto: PROTOCOL_VERSION, world: options.initialWorld });
          }
          // the host's plot terrain goes up with the seed; the room relays it back to everyone, this client included
          if (isHost && options.terrain && msg.role === 'owner') {
            sendFramed({ type: 'terrain', seed: options.terrain.seed, sculpt: options.terrain.sculpt });
          }
        }
        emitState();
        return;
      }

      case 'snapshot': {
        version = msg.version;
        confirmedWorld = msg.world;
        roles = { ...msg.roles };
        if (msg.usernames) usernames = { ...usernames, ...msg.usernames };
        if (msg.defaultGuestRole) defaultGuestRole = msg.defaultGuestRole;
        placedBy = { ...msg.placedBy };
        if (msg.shiftLog) shiftLog = [...msg.shiftLog];
        pending.length = 0;
        predictedWorld = confirmedWorld;
        emitState();
        return;
      }

      case 'terrain': {
        applyTerrain({ seed: msg.seed, sculpt: msg.sculpt });
        return;
      }

      case 'events': {
        const expectedVersion = version + 1;
        const applied = apply(confirmedWorld, env, msg.cmd);
        const syncCheck = verifyVersionAndHash(
          expectedVersion,
          applied.world,
          msg.version,
          msg.worldHash,
          msg.proto,
        );

        // Remove matching command from pending queue
        if (msg.actorId === playerId) {
          const idx = pending.findIndex((p) => p.seq === msg.seq);
          if (idx >= 0) pending.splice(idx, 1);
        }

        if (syncCheck.needsResync) {
          requestResync();
          return;
        }

        confirmedWorld = applied.world;
        version = msg.version;
        if (msg.placedByPatch) {
          placedBy = { ...placedBy, ...msg.placedByPatch };
        }
        if (msg.shiftLog) {
          shiftLog = [...msg.shiftLog];
        }
        const afterIds = new Set(confirmedWorld.base.pieces.map((p) => p.id));
        for (const k of Object.keys(placedBy)) {
          const numId = Number(k);
          if (!afterIds.has(numId)) delete placedBy[numId];
        }
        recomputePredictedWorld();

        const decodedEvents = msg.events.map(fromWireEvent);
        for (const cb of eventListeners) {
          cb(decodedEvents, {
            version: msg.version,
            actorId: msg.actorId,
            confirmed: true,
            seq: msg.seq,
          });
        }
        emitState();
        return;
      }

      case 'refused': {
        const idx = pending.findIndex((p) => p.seq === msg.seq);
        if (idx >= 0) pending.splice(idx, 1);
        recomputePredictedWorld();
        lastRefusal = { cmdKind: msg.cmdKind, why: msg.why };

        const refusalEvent: BaseEvent = {
          type: 'refused',
          cmd: msg.cmdKind,
          why: msg.why,
          ...(msg.short ? { short: msg.short } : {}),
        };
        for (const cb of eventListeners) {
          cb([refusalEvent], {
            version: msg.version,
            actorId: playerId ?? 'self',
            confirmed: true,
            seq: msg.seq,
          });
        }

        const syncCheck = verifyVersionAndHash(
          version,
          hashOf(confirmedWorld),
          msg.version,
          msg.worldHash,
          msg.proto,
        );
        if (syncCheck.needsResync) {
          requestResync();
          return;
        }
        emitState();
        return;
      }

      case 'notice': {
        lastNotice = msg.why;
        emitState();
        return;
      }

      case 'presence': {
        lastServerTime = msg.serverTime;
        for (const p of msg.peers) {
          if (p.username) usernames[p.id] = p.username;
        }
        const remotePeers = msg.peers.filter((p) => p.id !== playerId);
        for (const p of remotePeers) {
          const list = poseHistory.get(p.id) ?? [];
          list.push({ pose: p, t: msg.serverTime });
          if (list.length > 10) list.splice(0, list.length - 10);
          poseHistory.set(p.id, list);
        }
        peers = remotePeers.map((p) => {
          const samples = poseHistory.get(p.id) ?? [{ pose: p, t: msg.serverTime }];
          return interpolatePeerPose(samples, msg.serverTime - INTERPOLATION_DELAY_MS) ?? p;
        });
        for (const cb of presenceListeners) {
          cb(peers, msg.serverTime);
        }
        emitState();
        return;
      }

      case 'roleChanged': {
        roles = { ...msg.roles };
        if (msg.usernames) usernames = { ...usernames, ...msg.usernames };
        if (msg.defaultGuestRole) defaultGuestRole = msg.defaultGuestRole;
        if (playerId && msg.targetId === playerId) {
          role = msg.role;
        }
        emitState();
        return;
      }

      case 'kicked': {
        roles = { ...msg.roles };
        if (msg.usernames) usernames = { ...usernames, ...msg.usernames };
        poseHistory.delete(msg.targetId);
        peers = peers.filter((p) => p.id !== msg.targetId);
        if (playerId && msg.targetId === playerId) {
          kickedReason = msg.reason;
          connectionState = 'disconnected';
        }
        emitState();
        return;
      }

      default:
        return;
    }
  };

  /** Takes a message from the room. A message too big for one frame arrives as chunks, and is handled once the last one is in. */
  const receive = (raw: OutpostMessage): void => {
    if (!raw || typeof raw !== 'object') return;
    const msg = inbound.push(raw);
    if (msg !== null) handle(msg);
  };

  room.on({
    onMessage(raw: OutpostMessage) {
      receive(raw);
    },

    onPrivateMessage(raw: OutpostMessage) {
      receive(raw);
    },

    onPlayerLeft(leftId: string) {
      poseHistory.delete(leftId);
      peers = peers.filter((p) => p.id !== leftId);
      emitState();
    },

    onReconnecting() {
      connectionState = 'reconnecting';
      emitState();
    },

    onReconnected() {
      connectionState = 'connected';
      requestResync();
    },

    onDisconnect() {
      connectionState = 'disconnected';
      emitState();
    },

    onError(err: string) {
      lastError = err;
      connectionState = 'error';
      emitState();
    },
  });

  // listening now: ask for the welcome again, in case the join's one went out before we listened
  sendFramed({ type: 'hello', proto: PROTOCOL_VERSION });

  return {
    send(cmd: BaseCommand): Applied {
      const seq = ++seqCounter;
      const actor = playerId ?? 'local';
      const roleVerdict = canRun(role, cmd, predictedWorld, actor, placedBy);

      if (!roleVerdict.ok) {
        const refused: BaseEvent = { type: 'refused', cmd: cmd.t, why: roleVerdict.why };
        lastRefusal = { cmdKind: cmd.t, why: roleVerdict.why };
        // the room refuses it too, and tells only this player
        sendFramed({ type: 'cmd', proto: PROTOCOL_VERSION, seq, baseVersion: version, cmd });
        emitState();
        return { world: predictedWorld, events: [refused] };
      }

      // POL-115: Hold non-owner builds while the room has not been seeded yet (version === 0)
      if (role !== 'owner' && version === 0) {
        const refused: BaseEvent = { type: 'refused', cmd: cmd.t, why: 'waiting-for-host-seed' };
        lastRefusal = { cmdKind: cmd.t, why: 'waiting-for-host-seed' };
        sendFramed({ type: 'cmd', proto: PROTOCOL_VERSION, seq, baseVersion: version, cmd });
        emitState();
        return { world: predictedWorld, events: [refused] };
      }

      // 1. Predict locally FIRST and queue in pending before sending over the wire
      const optimistic = apply(predictedWorld, env, cmd);
      const wasRefused = optimistic.events.some((e) => e.type === 'refused');
      if (wasRefused) {
        emitState();
        return optimistic;
      }

      pending.push({ seq, baseVersion: version, cmd });
      predictedWorld = optimistic.world;
      for (const cb of eventListeners) {
        cb(optimistic.events, {
          version,
          actorId: actor,
          confirmed: false,
          seq,
        });
      }
      emitState();

      // 2. Dispatch valid predicted command to server authority
      sendFramed({ type: 'cmd', proto: PROTOCOL_VERSION, seq, baseVersion: version, cmd });

      return optimistic;
    },

    sendPose(pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly look?: string }): void {
      sendFramed({
        type: 'pose',
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: pose.yaw,
        look: pose.look ?? 'default',
      });
    },

    sendBeamIntent(intent): void {
      if (role === 'visitor') return;
      sendFramed({
        type: 'beamIntent',
        at: intent.at,
        beam: intent.beam,
        ...(intent.power ? { power: intent.power } : {}),
        ...(intent.latched ? { latched: intent.latched } : {}),
      });
    },

    setRole(targetId: string, nextRole: OutpostRole): void {
      sendFramed({ type: 'setRole', targetId, role: nextRole });
    },

    setDefaultRole(nextRole: OutpostRole): boolean {
      if (role !== 'owner') return false;
      sendFramed({ type: 'setDefaultRole', role: nextRole });
      return true;
    },

    kickPlayer(targetId: string, reason?: string): boolean {
      if (role !== 'owner' || !targetId || targetId === playerId) return false;
      sendFramed({ type: 'kickPlayer', targetId, ...(reason ? { reason } : {}) });
      return true;
    },

    undoAuthor(targetId: string): boolean {
      if (role !== 'owner' || !targetId) return false;
      sendFramed({ type: 'undoAuthor', targetId });
      return true;
    },

    setTerrain(next: TerrainState): boolean {
      if (role !== 'owner') return false;
      sendFramed({ type: 'terrain', seed: next.seed, sculpt: next.sculpt });
      return true;
    },

    seedWorld(world: BaseWorld): boolean {
      if (role !== 'owner' || version !== 0 || pending.length > 0) return false;
      confirmedWorld = world;
      predictedWorld = world;
      sendFramed({ type: 'seedWorld', proto: PROTOCOL_VERSION, world });
      emitState();
      return true;
    },

    samplePeers(renderTimeMs = lastServerTime - INTERPOLATION_DELAY_MS): PeerPose[] {
      const out: PeerPose[] = [];
      for (const [id, samples] of poseHistory.entries()) {
        if (id === playerId) continue;
        const interp = interpolatePeerPose(samples, renderTimeMs);
        if (interp) out.push(interp);
      }
      return out;
    },

    onEvents(cb: EventsCallback): () => void {
      eventListeners.add(cb);
      return () => {
        eventListeners.delete(cb);
      };
    },

    onPresence(cb: PresenceCallback): () => void {
      presenceListeners.add(cb);
      return () => {
        presenceListeners.delete(cb);
      };
    },

    onTerrain(cb: (terrain: TerrainState) => void): () => void {
      terrainListeners.add(cb);
      return () => {
        terrainListeners.delete(cb);
      };
    },

    onStateChange(cb: (state: OutpostClientState) => void): () => void {
      stateListeners.add(cb);
      return () => {
        stateListeners.delete(cb);
      };
    },

    state(): OutpostClientState {
      return buildState();
    },

    leave(): void {
      connectionState = 'disconnected';
      room.leave();
      emitState();
    },
  };
}
