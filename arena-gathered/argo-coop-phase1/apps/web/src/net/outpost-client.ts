// ============================================================================
// File: apps/web/src/net/outpost-client.ts
// Plan 36 Phase 1 (Deliverable 3 — Client Outpost Network Layer):
// connectOutpost('host' | code) returning:
//   { send(cmd), onEvents(cb), onPresence(cb), state(), leave() }
// Features:
// - Local predict and confirm using pure apply() from base/world.ts
// - Automatic resync request on version or world-hash mismatch
// - Reconnect state machine ('connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error')
// - 100 ms buffered presence interpolation for remote avatars
// ============================================================================

import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
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
  fromWireEvent,
  PROTOCOL_VERSION,
  roleName,
  verifyVersionAndHash,
  type OutpostMessage,
  type OutpostRole,
  type PeerPose,
  type ShiftLogEntry,
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
  onPlayerJoined?(player: { readonly id: string; readonly username: string }): void;
  onPlayerLeft?(playerId: string): void;
  onReconnecting?(): void;
  onReconnected?(): void;
  onDisconnect?(): void;
  onError?(err: string): void;
}

export interface ServerRoomLike<TMessage = OutpostMessage> {
  readonly roomCode?: string;
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
  readonly version: number;
  readonly world: BaseWorld;
  readonly confirmedWorld: BaseWorld;
  readonly worldHash: string;
  readonly confirmedHash: string;
  readonly pendingCount: number;
  readonly resyncCount: number;
  readonly peers: readonly PeerPose[];
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
  readonly lastRefusal: { readonly cmdKind: BaseCommand['t']; readonly why: string } | null;
  readonly lastError: string | null;
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
  setRole(targetId: string, role: OutpostRole): void;
  samplePeers(renderTimeMs?: number): PeerPose[];
  onEvents(cb: EventsCallback): () => void;
  onPresence(cb: PresenceCallback): () => void;
  onStateChange(cb: (state: OutpostClientState) => void): () => void;
  state(): OutpostClientState;
  leave(): void;
}

export interface ConnectOutpostOptions {
  readonly env?: WorldEnv;
  readonly initialWorld?: BaseWorld;
  readonly playerId?: string;
  readonly room?: ServerRoomLike<OutpostMessage>;
  readonly realtime?: RealtimeSdkLike;
}

const DEFAULT_ENV: WorldEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: BRIDGE_RANGE },
};

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
 * Connects to a live or persisted Outpost room (`'host'` creates a new outpost room;
 * a 6-character code calls `joinRoomByCode`).
 */
export async function connectOutpost(
  target: 'host' | string,
  options: ConnectOutpostOptions = {},
): Promise<OutpostClient> {
  const env = options.env ?? DEFAULT_ENV;
  const isHost = target.trim().toLowerCase() === 'host';
  const normalizedCode = isHost ? null : target.trim().toUpperCase();

  let room: ServerRoomLike<OutpostMessage>;
  if (options.room) {
    room = options.room;
  } else {
    const sdk =
      options.realtime ??
      ((RundotGameAPI as unknown as { realtime?: RealtimeSdkLike })?.realtime ?? null);
    if (!sdk) {
      throw new Error('RUN realtime SDK is not available in this build.');
    }
    room = isHost
      ? await sdk.createRoom<OutpostMessage>('outpost')
      : await sdk.joinRoomByCode<OutpostMessage>(normalizedCode!);
  }

  let connectionState: ReconnectState = 'connected';
  let roomCode: string | null = room.roomCode ?? normalizedCode;
  let playerId: string | null = options.playerId ?? (isHost ? 'host' : null);
  let role: OutpostRole = isHost ? 'owner' : 'cobuilder';
  let version = 0;
  let confirmedWorld: BaseWorld =
    options.initialWorld ?? withBridgeStore(createWorld(1), env);
  let predictedWorld: BaseWorld = confirmedWorld;
  let roles: Record<string, OutpostRole> = playerId ? { [playerId]: role } : {};
  let placedBy: Record<number, string> = {};
  let shiftLog: ShiftLogEntry[] = [];
  let peers: PeerPose[] = [];
  let lastServerTime = 0;
  let seqCounter = 0;
  let resyncCount = 0;
  let lastRefusal: { readonly cmdKind: BaseCommand['t']; readonly why: string } | null = null;
  let lastError: string | null = null;

  const pending: PendingCommand[] = [];
  const poseHistory = new Map<string, PoseHistorySample[]>();
  const eventListeners = new Set<EventsCallback>();
  const presenceListeners = new Set<PresenceCallback>();
  const stateListeners = new Set<(state: OutpostClientState) => void>();

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
    version,
    world: predictedWorld,
    confirmedWorld,
    worldHash: computeWorldHash(predictedWorld),
    confirmedHash: computeWorldHash(confirmedWorld),
    pendingCount: pending.length,
    resyncCount,
    peers,
    roles: { ...roles },
    placedBy: { ...placedBy },
    shiftLog: [...shiftLog],
    lastRefusal,
    lastError,
  });

  const emitState = (): void => {
    const snap = buildState();
    for (const cb of stateListeners) cb(snap);
  };

  const requestResync = (): void => {
    resyncCount += 1;
    room.send({
      type: 'resync',
      proto: PROTOCOL_VERSION,
      clientVersion: version,
      clientHash: computeWorldHash(confirmedWorld),
    });
    emitState();
  };

  room.on({
    onMessage(msg: OutpostMessage) {
      if (!msg || typeof msg !== 'object') return;

      switch (msg.type) {
        case 'welcome': {
          playerId = msg.playerId;
          role = msg.role;
          version = msg.version;
          confirmedWorld = msg.world;
          roles = { ...msg.roles };
          placedBy = { ...msg.placedBy };
          shiftLog = [...msg.shiftLog];
          if (msg.roomCode) roomCode = msg.roomCode;
          pending.length = 0;
          predictedWorld = confirmedWorld;
          // If host passed a custom initialWorld with higher tick and room is fresh (version 0), seed the room
          if (isHost && options.initialWorld && msg.version === 0 && options.initialWorld.tick > 0) {
            confirmedWorld = options.initialWorld;
            predictedWorld = options.initialWorld;
            room.send({
              type: 'seedWorld',
              proto: PROTOCOL_VERSION,
              world: options.initialWorld,
            });
          }
          emitState();
          return;
        }

        case 'snapshot': {
          version = msg.version;
          confirmedWorld = msg.world;
          roles = { ...msg.roles };
          placedBy = { ...msg.placedBy };
          pending.length = 0;
          predictedWorld = confirmedWorld;
          emitState();
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
            confirmedWorld,
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

        case 'presence': {
          lastServerTime = msg.serverTime;
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
          if (playerId && msg.targetId === playerId) {
            role = msg.role;
          }
          emitState();
          return;
        }

        default:
          return;
      }
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

  return {
    send(cmd: BaseCommand): Applied {
      const seq = ++seqCounter;
      const actor = playerId ?? 'local';
      const roleVerdict = canRun(role, cmd, predictedWorld, actor, placedBy);

      if (!roleVerdict.ok) {
        const refused: BaseEvent = { type: 'refused', cmd: cmd.t, why: roleVerdict.why };
        lastRefusal = { cmdKind: cmd.t, why: roleVerdict.why };
        room.send({
          type: 'cmd',
          proto: PROTOCOL_VERSION,
          seq,
          baseVersion: version,
          cmd,
        });
        emitState();
        return { world: predictedWorld, events: [refused] };
      }

      // 1. Predict locally FIRST and queue in pending before sending over the wire
      const optimistic = apply(predictedWorld, env, cmd);
      const wasRefused = optimistic.events.some((e) => e.type === 'refused');
      if (!wasRefused) {
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
      }
      emitState();

      // 2. Dispatch to server authority (works identically for sync loopback or async WebSocket)
      room.send({
        type: 'cmd',
        proto: PROTOCOL_VERSION,
        seq,
        baseVersion: version,
        cmd,
      });

      return optimistic;
    },

    sendPose(pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly look?: string }): void {
      room.send({
        type: 'pose',
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: pose.yaw,
        look: pose.look ?? 'default',
      });
    },

    setRole(targetId: string, nextRole: OutpostRole): void {
      room.send({
        type: 'setRole',
        targetId,
        role: nextRole,
      });
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
