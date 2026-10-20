// ============================================================================
// File: apps/web/src/net/protocol.ts
// Plan 36 Phase 1 & Phase 2 (Co-op Outpost Room — Protocol, Role Table & Guardrails):
// - Typed message union in both directions (never a payload field named 'type')
// - Version and world-hash checks
// - Role table using Lead Architect, Co-Builder, and Field Observer names
// - canRun(role, cmd, world, actorId) with Co-Builder guardrails
// - Phase 2 messages: kickPlayer, setDefaultRole, undoAuthor, beamIntent (POL-114),
//   kicked, and usernames map on welcome/snapshot/roleChanged (POL-117)
// Pure TypeScript: zero DOM, zero timers, zero I/O.
// ============================================================================

import { hashWorld, type BaseCommand, type BaseEvent, type BaseWorld } from '../base/world';
import type * as L from '@hm/lattice';
import type * as S from '@hm/structure';
import type { PartSlot, StationKind, VehicleKind } from '../base/catalog';

export const PROTOCOL_VERSION = 1;

/** Internal role union: shown in UI as Lead Architect, Co-Builder, and Field Observer. */
export type OutpostRole = 'owner' | 'cobuilder' | 'visitor';
export type Role = OutpostRole;

export interface RoleDefinition {
  readonly role: OutpostRole;
  readonly name: 'Lead Architect' | 'Co-Builder' | 'Field Observer';
  readonly label: 'Lead Architect' | 'Co-Builder' | 'Field Observer';
  readonly canBuild: boolean;
  readonly canRemoveOwn: boolean;
  readonly canRemoveAny: boolean;
  readonly canManageRoles: boolean;
  readonly description: string;
}

/** Role table mapping internal role IDs to Argo's approved display names and capabilities. */
export const ROLE_TABLE: Readonly<Record<OutpostRole, RoleDefinition>> = {
  owner: {
    role: 'owner',
    name: 'Lead Architect',
    label: 'Lead Architect',
    canBuild: true,
    canRemoveOwn: true,
    canRemoveAny: true,
    canManageRoles: true,
    description: 'Full authority over the outpost, structures, hardpoint machines, and team roles.',
  },
  cobuilder: {
    role: 'cobuilder',
    name: 'Co-Builder',
    label: 'Co-Builder',
    canBuild: true,
    canRemoveOwn: true,
    canRemoveAny: false,
    canManageRoles: false,
    description: 'Can place pieces, draft, craft, slot cartridges, and demolish pieces they placed during the session.',
  },
  visitor: {
    role: 'visitor',
    name: 'Field Observer',
    label: 'Field Observer',
    canBuild: false,
    canRemoveOwn: false,
    canRemoveAny: false,
    canManageRoles: false,
    description: 'Read-only exploration: walk, look, and inspect the outpost without altering structures or stock.',
  },
};

export const ROLE_LABELS: Readonly<Record<OutpostRole, 'Lead Architect' | 'Co-Builder' | 'Field Observer'>> = {
  owner: 'Lead Architect',
  cobuilder: 'Co-Builder',
  visitor: 'Field Observer',
};

export function roleName(role: OutpostRole): 'Lead Architect' | 'Co-Builder' | 'Field Observer' {
  return ROLE_TABLE[role]?.name ?? 'Field Observer';
}

// ============================================================================
// Wire-safe BaseEvent representation (no nested field named 'type')
// ============================================================================

export type WireBaseEvent =
  | { readonly kind: 'refused'; readonly cmd: BaseCommand['t']; readonly why: string; readonly short?: readonly L.Stack[] }
  | { readonly kind: 'placed'; readonly id: number; readonly pieceKind: S.Kind }
  | { readonly kind: 'removed'; readonly id: number; readonly collapsed: readonly number[]; readonly lost: readonly L.Stack[] }
  | { readonly kind: 'drafted'; readonly blueprint: string }
  | { readonly kind: 'moved'; readonly n: number }
  | { readonly kind: 'stacked'; readonly n: number }
  | { readonly kind: 'hotbar'; readonly index: number }
  | { readonly kind: 'door'; readonly id: number; readonly open: boolean }
  | { readonly kind: 'harvested'; readonly items: readonly L.Stack[]; readonly lost: readonly L.Stack[] }
  | { readonly kind: 'finished'; readonly machine: number; readonly item: string; readonly n: number }
  | { readonly kind: 'installed'; readonly machine: number; readonly stationKind: StationKind }
  | { readonly kind: 'queued'; readonly machine: number; readonly recipe: string }
  | { readonly kind: 'collected'; readonly machine: number; readonly n: number }
  | { readonly kind: 'stage'; readonly stage: number }
  | { readonly kind: 'layout'; readonly id: string }
  | { readonly kind: 'planned'; readonly plan: number }
  | { readonly kind: 'filled'; readonly plan: number; readonly built: readonly number[]; readonly left: number; readonly blocked: number }
  | { readonly kind: 'dropped'; readonly plan: number }
  | { readonly kind: 'shelter'; readonly structure: number }
  | { readonly kind: 'printed'; readonly machine: number; readonly vehicle: number; readonly vehicleKind: VehicleKind }
  | { readonly kind: 'parked'; readonly vehicle: number }
  | { readonly kind: 'forged'; readonly item: string }
  | { readonly kind: 'fitted'; readonly slot: PartSlot; readonly item: string | null }
  | { readonly kind: 'granted'; readonly stock: readonly L.Stack[]; readonly lost: readonly L.Stack[] }
  | { readonly kind: 'salvaged'; readonly stock: readonly L.Stack[] }
  | { readonly kind: 'switched'; readonly machine: number; readonly on: boolean }
  | { readonly kind: 'paid'; readonly reason: string; readonly bill: readonly L.Stack[] };

/** Converts a `BaseEvent` (which uses `type`) into a `WireBaseEvent` (which uses `kind`, never `type`). */
export function toWireEvent(e: BaseEvent): WireBaseEvent {
  switch (e.type) {
    case 'refused':
      return { kind: 'refused', cmd: e.cmd, why: e.why, ...(e.short ? { short: e.short } : {}) };
    case 'placed':
      return { kind: 'placed', id: e.id, pieceKind: e.kind };
    case 'removed':
      return { kind: 'removed', id: e.id, collapsed: e.collapsed, lost: e.lost };
    case 'drafted':
      return { kind: 'drafted', blueprint: e.blueprint };
    case 'paid':
      return { kind: 'paid', reason: e.reason, bill: e.bill };
    case 'moved':
      return { kind: 'moved', n: e.n };
    case 'stacked':
      return { kind: 'stacked', n: e.n };
    case 'hotbar':
      return { kind: 'hotbar', index: e.index };
    case 'door':
      return { kind: 'door', id: e.id, open: e.open };
    case 'harvested':
      return { kind: 'harvested', items: e.items, lost: e.lost };
    case 'finished':
      return { kind: 'finished', machine: e.machine, item: e.item, n: e.n };
    case 'installed':
      return { kind: 'installed', machine: e.machine, stationKind: e.kind };
    case 'queued':
      return { kind: 'queued', machine: e.machine, recipe: e.recipe };
    case 'collected':
      return { kind: 'collected', machine: e.machine, n: e.n };
    case 'stage':
      return { kind: 'stage', stage: e.stage };
    case 'layout':
      return { kind: 'layout', id: e.id };
    case 'planned':
      return { kind: 'planned', plan: e.plan };
    case 'filled':
      return { kind: 'filled', plan: e.plan, built: e.built, left: e.left, blocked: e.blocked };
    case 'dropped':
      return { kind: 'dropped', plan: e.plan };
    case 'shelter':
      return { kind: 'shelter', structure: e.structure };
    case 'printed':
      return { kind: 'printed', machine: e.machine, vehicle: e.vehicle, vehicleKind: e.kind };
    case 'parked':
      return { kind: 'parked', vehicle: e.vehicle };
    case 'forged':
      return { kind: 'forged', item: e.item };
    case 'fitted':
      return { kind: 'fitted', slot: e.slot, item: e.item };
    case 'granted':
      return { kind: 'granted', stock: e.stock, lost: e.lost };
    case 'salvaged':
      return { kind: 'salvaged', stock: e.stock };
    case 'switched':
      return { kind: 'switched', machine: e.machine, on: e.on };
  }
}

/** Converts a `WireBaseEvent` back into a `BaseEvent`. */
export function fromWireEvent(w: WireBaseEvent): BaseEvent {
  switch (w.kind) {
    case 'refused':
      return { type: 'refused', cmd: w.cmd, why: w.why, ...(w.short ? { short: w.short } : {}) };
    case 'placed':
      return { type: 'placed', id: w.id, kind: w.pieceKind };
    case 'removed':
      return { type: 'removed', id: w.id, collapsed: w.collapsed, lost: w.lost };
    case 'drafted':
      return { type: 'drafted', blueprint: w.blueprint };
    case 'moved':
      return { type: 'moved', n: w.n };
    case 'stacked':
      return { type: 'stacked', n: w.n };
    case 'hotbar':
      return { type: 'hotbar', index: w.index };
    case 'door':
      return { type: 'door', id: w.id, open: w.open };
    case 'harvested':
      return { type: 'harvested', items: w.items, lost: w.lost };
    case 'finished':
      return { type: 'finished', machine: w.machine, item: w.item, n: w.n };
    case 'installed':
      return { type: 'installed', machine: w.machine, kind: w.stationKind };
    case 'queued':
      return { type: 'queued', machine: w.machine, recipe: w.recipe };
    case 'collected':
      return { type: 'collected', machine: w.machine, n: w.n };
    case 'stage':
      return { type: 'stage', stage: w.stage };
    case 'layout':
      return { type: 'layout', id: w.id };
    case 'planned':
      return { type: 'planned', plan: w.plan };
    case 'filled':
      return { type: 'filled', plan: w.plan, built: w.built, left: w.left, blocked: w.blocked };
    case 'dropped':
      return { type: 'dropped', plan: w.plan };
    case 'shelter':
      return { type: 'shelter', structure: w.structure };
    case 'printed':
      return { type: 'printed', machine: w.machine, vehicle: w.vehicle, kind: w.vehicleKind };
    case 'parked':
      return { type: 'parked', vehicle: w.vehicle };
    case 'forged':
      return { type: 'forged', item: w.item };
    case 'fitted':
      return { type: 'fitted', slot: w.slot, item: w.item };
    case 'granted':
      return { type: 'granted', stock: w.stock, lost: w.lost };
    case 'salvaged':
      return { type: 'salvaged', stock: w.stock };
    case 'switched':
      return { type: 'switched', machine: w.machine, on: w.on };
    case 'paid':
      return { type: 'paid', reason: w.reason, bill: w.bill };
  }
}

// ============================================================================
// Bidirectional Message Protocol (never a payload field named 'type')
// ============================================================================

export interface PeerPose {
  readonly id: string;
  readonly username: string;
  readonly role: OutpostRole;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly look: string;
  readonly at: number;
}

export interface ShiftLogEntry {
  readonly actorId: string;
  readonly username: string;
  readonly role: OutpostRole;
  readonly summary: string;
  readonly version: number;
  readonly at: number;
}

/** Client -> Server: propose a BaseCommand. */
export interface CmdMessage {
  readonly type: 'cmd';
  readonly proto: number;
  readonly seq: number;
  readonly baseVersion: number;
  readonly cmd: BaseCommand;
}

/** Client -> Server: 10 Hz avatar pose update. */
export interface PoseMessage {
  readonly type: 'pose';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly look: string;
}

/** Client -> Server: request full world snapshot on version or hash mismatch. */
export interface ResyncRequestMessage {
  readonly type: 'resync';
  readonly proto: number;
  readonly clientVersion: number;
  readonly clientHash: string;
}

/** Client -> Server: Lead Architect promotes/demotes a player or toggles co-builder permissions. */
export interface SetRoleMessage {
  readonly type: 'setRole';
  readonly targetId: string;
  readonly role: OutpostRole;
}

/** Client -> Server: Lead Architect changes the default role assigned to newly joining guests. */
export interface SetDefaultRoleMessage {
  readonly type: 'setDefaultRole';
  readonly role: OutpostRole;
}

/** Client -> Server: Lead Architect removes a player from the room. */
export interface KickPlayerMessage {
  readonly type: 'kickPlayer';
  readonly targetId: string;
  readonly reason?: string;
}

/** Client -> Server: Lead Architect reverts the most recent standing build placed by `targetId`. */
export interface UndoAuthorMessage {
  readonly type: 'undoAuthor';
  readonly targetId: string;
}

/**
 * Client -> Server (POL-114): sets or clears this player's active Extraction Beam harvest intent
 * and plot power shares so the room's authoritative tick timer advances machines & harvest without
 * 10 Hz client tick round-trips.
 */
export interface BeamIntentMessage {
  readonly type: 'beamIntent';
  readonly at: { readonly x: number; readonly z: number };
  readonly beam: { readonly node: number; readonly power: number } | null;
  readonly power?: Readonly<Record<number, number>>;
  readonly latched?: readonly number[];
}

/** Client -> Server: Lead Architect seeds the room with their current local BaseWorld on creation. */
export interface SeedWorldMessage {
  readonly type: 'seedWorld';
  readonly proto: number;
  readonly world: BaseWorld;
}

/**
 * The Moon Twin Gate's pose on the plot: x and z in metres, yaw in radians (the gate's rotation.y). Its footing pad is levelled
 * there (POL-112), so the room and every client must hold the same pose or their grounds disagree.
 */
export interface GatePose {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** Whether a value is a finite gate pose (the room checks what a Lead Architect sends before it stores it). */
export function isGatePose(value: unknown): value is GatePose {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Partial<Record<keyof GatePose, unknown>>;
  return Number.isFinite(g.x) && Number.isFinite(g.z) && Number.isFinite(g.yaw);
}

/**
 * The plot's terrain: its seed and the beam save's sculpt text (encodeField), and the gate's pose for the footing pad (POL-112).
 * Only the Lead Architect sends it (on hosting, and after each finished sculpt stroke); the room stores it, rebuilds its ground
 * with plotHeightAt, and relays it to everyone. Without a gate the pad is at the origin with yaw 0.
 */
export interface TerrainState {
  readonly seed: number;
  readonly sculpt: string;
  readonly gate?: GatePose;
}

/**
 * Client -> Server: asks for the welcome again. The room's welcome goes out as the player joins, which can be before the client has
 * attached its listeners (the SDK's join resolves after it); the client sends hello once it is listening.
 */
export interface HelloMessage {
  readonly type: 'hello';
  readonly proto: number;
}

/** Owner -> Server, and Server -> All Clients (on join, on change, and after a resync). */
export interface TerrainMessage extends TerrainState {
  readonly type: 'terrain';
}

/**
 * One frame of a message too big for a single realtime frame (both directions). A fresh world is about 37 KB of JSON, and the
 * SDK caps a frame at MAX_BROADCAST_BYTES (16 KiB), so a welcome, snapshot, seed or terrain travels as a run of these.
 * `id` names the transfer, `i` is this frame's place (0-based), `n` the frame count, `text` a slice of the message's JSON.
 */
export interface ChunkMessage {
  readonly type: 'chunk';
  readonly id: number;
  readonly i: number;
  readonly n: number;
  readonly text: string;
}

export type ClientMessage =
  | CmdMessage
  | PoseMessage
  | ResyncRequestMessage
  | SetRoleMessage
  | SetDefaultRoleMessage
  | KickPlayerMessage
  | UndoAuthorMessage
  | BeamIntentMessage
  | SeedWorldMessage
  | TerrainMessage
  | HelloMessage
  | ChunkMessage;

/** Server -> Client: initial state sent to a joining player. */
export interface WelcomeMessage {
  readonly type: 'welcome';
  readonly proto: number;
  readonly playerId: string;
  readonly role: OutpostRole;
  readonly version: number;
  readonly worldHash: string;
  readonly world: BaseWorld;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames?: Readonly<Record<string, string>>;
  readonly defaultGuestRole?: OutpostRole;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog: readonly ShiftLogEntry[];
}

/** Server -> All Clients: confirmed command and resulting wire events with world version & hash. */
export interface EventsMessage {
  readonly type: 'events';
  readonly proto: number;
  readonly version: number;
  readonly worldHash: string;
  readonly actorId: string;
  readonly seq: number;
  readonly cmd: BaseCommand;
  readonly events: readonly WireBaseEvent[];
  readonly placedByPatch?: Readonly<Record<number, string>>;
  readonly shiftLog?: readonly ShiftLogEntry[];
}

/** Server -> Sender Only: command refusal (role guardrail, rate limit, or world.ts refusal). */
export interface RefusedMessage {
  readonly type: 'refused';
  readonly proto: number;
  readonly seq: number;
  readonly cmdKind: BaseCommand['t'];
  readonly why: string;
  readonly version: number;
  readonly worldHash: string;
  readonly short?: readonly L.Stack[];
}

/** Server -> All Clients: 10 Hz batched presence relay. */
export interface PresenceMessage {
  readonly type: 'presence';
  readonly peers: readonly PeerPose[];
  readonly serverTime: number;
}

/** Server -> Client: full snapshot in response to a resync request. */
export interface SnapshotMessage {
  readonly type: 'snapshot';
  readonly proto: number;
  readonly version: number;
  readonly worldHash: string;
  readonly world: BaseWorld;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames?: Readonly<Record<string, string>>;
  readonly defaultGuestRole?: OutpostRole;
  readonly placedBy: Readonly<Record<number, string>>;
  readonly shiftLog?: readonly ShiftLogEntry[];
}

/** Server -> Sender Only: a message the room could not act on that is not a command (not the Lead Architect, a terrain too large). */
export interface NoticeMessage {
  readonly type: 'notice';
  readonly proto: number;
  readonly why: string;
}

/** Server -> All Clients: role table updated by the Lead Architect. */
export interface RoleChangedMessage {
  readonly type: 'roleChanged';
  readonly targetId: string;
  readonly role: OutpostRole;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames?: Readonly<Record<string, string>>;
  readonly defaultGuestRole?: OutpostRole;
}

/** Server -> All Clients (and kicked target): player removed by the Lead Architect. */
export interface KickedMessage {
  readonly type: 'kicked';
  readonly targetId: string;
  readonly reason: string;
  readonly roles: Readonly<Record<string, OutpostRole>>;
  readonly usernames?: Readonly<Record<string, string>>;
}

export type ServerMessage =
  | WelcomeMessage
  | EventsMessage
  | RefusedMessage
  | PresenceMessage
  | SnapshotMessage
  | RoleChangedMessage
  | KickedMessage
  | TerrainMessage
  | NoticeMessage
  | ChunkMessage;

export type OutpostMessage = ClientMessage | ServerMessage;
export type OutpostProtocol = OutpostMessage;

/**
 * Verifies that a protocol message has `type` ONLY as its top-level discriminator
 * and never as a nested payload field name (which RUN's wire protocol would clobber).
 */
export function hasNoPayloadTypeField(msg: OutpostMessage): boolean {
  const visit = (val: unknown, isRoot: boolean): boolean => {
    if (!val || typeof val !== 'object') return true;
    if (Array.isArray(val)) {
      return val.every((item) => visit(item, false));
    }
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (!isRoot && k === 'type') return false;
      if (!visit(v, false)) return false;
    }
    return true;
  };
  return visit(msg, true);
}

// ============================================================================
// Frames: a message too big for one realtime frame travels as chunks
// ============================================================================

/**
 * The most JSON text one chunk carries. A chunk's own JSON escapes quotes (two bytes) and may hold non-ASCII (up to four bytes a
 * character), so 3000 characters stays inside MAX_BROADCAST_BYTES (16 KiB) in the worst case.
 */
export const FRAME_TEXT_CHARS = 3000;

/**
 * The frames that carry `msg`: the message itself when its JSON fits one frame, else chunk frames whose texts join back to the same
 * JSON (in order). `id` is the transfer's number; the sender takes a new one per transfer.
 */
export function frameMessage(msg: OutpostMessage, id: number): OutpostMessage[] {
  const json = JSON.stringify(msg);
  if (json.length <= FRAME_TEXT_CHARS) return [msg];
  const n = Math.ceil(json.length / FRAME_TEXT_CHARS);
  const frames: OutpostMessage[] = [];
  for (let i = 0; i < n; i++) {
    frames.push({ type: 'chunk', id, i, n, text: json.slice(i * FRAME_TEXT_CHARS, (i + 1) * FRAME_TEXT_CHARS) });
  }
  return frames;
}

/**
 * Joins the chunks one sender's transfers arrive as. Feed every message from that sender through `push`: it returns the whole
 * message when the last chunk arrives (or the message itself when it was never chunked), and null while a transfer is still open.
 * A gap or an unreadable transfer is dropped, and the sender's next transfer starts clean.
 */
export class FrameAssembler {
  private id = -1;
  private n = 0;
  private parts: string[] = [];

  push(msg: OutpostMessage): OutpostMessage | null {
    if (msg.type !== 'chunk') return msg;
    if (msg.i === 0 || msg.id !== this.id) {
      this.id = msg.id;
      this.n = msg.n;
      this.parts = [];
    }
    if (msg.i !== this.parts.length || msg.n !== this.n) {
      this.reset();
      return null;
    }
    this.parts.push(msg.text);
    if (this.parts.length < this.n) return null;
    const text = this.parts.join('');
    this.reset();
    try {
      return JSON.parse(text) as OutpostMessage;
    } catch {
      return null;
    }
  }

  private reset(): void {
    this.id = -1;
    this.n = 0;
    this.parts = [];
  }
}

// ============================================================================
// Version & World-Hash Checks
// ============================================================================

export interface SyncCheckResult {
  readonly ok: boolean;
  readonly synced: boolean;
  readonly needsResync: boolean;
  readonly reason: 'ok' | 'protocol-mismatch' | 'version-mismatch' | 'hash-mismatch';
  readonly localHash: string;
}

export function computeWorldHash(world: BaseWorld): string {
  return hashWorld(world);
}

export function checkVersion(expectedVersion: number, actualVersion: number): boolean {
  return Number.isInteger(expectedVersion) && expectedVersion === actualVersion;
}

export function checkWorldHash(worldOrHash: BaseWorld | string, expectedHash: string): boolean {
  const actual = typeof worldOrHash === 'string' ? worldOrHash : computeWorldHash(worldOrHash);
  return actual === expectedHash;
}

/**
 * Pure sync validator comparing local version + world (or hash) against the server's
 * authoritative version and worldHash.
 */
export function verifyVersionAndHash(
  localVersion: number,
  localWorldOrHash: BaseWorld | string,
  serverVersion: number,
  serverHash: string,
  proto = PROTOCOL_VERSION,
): SyncCheckResult {
  const localHash = typeof localWorldOrHash === 'string' ? localWorldOrHash : computeWorldHash(localWorldOrHash);
  if (proto !== PROTOCOL_VERSION) {
    return { ok: false, synced: false, needsResync: true, reason: 'protocol-mismatch', localHash };
  }
  if (!checkVersion(localVersion, serverVersion)) {
    return { ok: false, synced: false, needsResync: true, reason: 'version-mismatch', localHash };
  }
  if (localHash !== serverHash) {
    return { ok: false, synced: false, needsResync: true, reason: 'hash-mismatch', localHash };
  }
  return { ok: true, synced: true, needsResync: false, reason: 'ok', localHash };
}

export const checkSync = verifyVersionAndHash;

// ============================================================================
// Role Guardrails: canRun(role, cmd, world, actorId, placedBy?)
// ============================================================================

export type PlacedBySource =
  | ReadonlyMap<number, string>
  | Readonly<Record<number, string>>
  | {
      readonly placedBy?: ReadonlyMap<number, string> | Readonly<Record<number, string>>;
      readonly allowCobuilderRemoveAll?: boolean;
      readonly allowCobuilderHardpoints?: boolean;
    };

export type RoleVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly why: string };

function lookupPiecePlacer(
  pieceId: number,
  world: BaseWorld,
  source?: PlacedBySource,
): {
  readonly placer: string | null;
  readonly allowAll: boolean;
  readonly allowHardpoints: boolean;
} {
  let allowAll = false;
  let allowHardpoints = false;
  let mapOrRec: ReadonlyMap<number, string> | Readonly<Record<number, string>> | undefined;

  if (source) {
    if (source instanceof Map) {
      mapOrRec = source;
    } else if (
      typeof source === 'object' &&
      ('placedBy' in source || 'allowCobuilderRemoveAll' in source || 'allowCobuilderHardpoints' in source)
    ) {
      const opts = source as {
        readonly placedBy?: ReadonlyMap<number, string> | Readonly<Record<number, string>>;
        readonly allowCobuilderRemoveAll?: boolean;
        readonly allowCobuilderHardpoints?: boolean;
      };
      mapOrRec = opts.placedBy;
      allowAll = !!opts.allowCobuilderRemoveAll;
      allowHardpoints = !!opts.allowCobuilderHardpoints;
    } else {
      mapOrRec = source as Readonly<Record<number, string>>;
    }
  }

  if (mapOrRec) {
    const fromMap = mapOrRec instanceof Map ? mapOrRec.get(pieceId) : (mapOrRec as Readonly<Record<number, string>>)[pieceId];
    if (typeof fromMap === 'string' && fromMap.length > 0) {
      return { placer: fromMap, allowAll, allowHardpoints };
    }
  }

  const worldPlacedBy = (world as BaseWorld & { readonly placedBy?: Readonly<Record<number, string>> }).placedBy;
  if (worldPlacedBy && typeof worldPlacedBy[pieceId] === 'string') {
    return { placer: worldPlacedBy[pieceId]!, allowAll, allowHardpoints };
  }

  const piece = world.base.pieces.find((p) => p.id === pieceId) as
    | (S.Piece & { readonly by?: string; readonly actorId?: string; readonly owner?: string })
    | undefined;
  const tag = piece?.by ?? piece?.actorId ?? piece?.owner ?? null;
  return { placer: tag, allowAll, allowHardpoints };
}

/**
 * Pure server/client role gate (`Plan 36` Phase 1 & 2):
 * Checks whether `actorId` with `role` (`'owner' | 'cobuilder' | 'visitor'`) may execute `cmd` on `world`.
 *
 * Guardrails:
 * - `owner` (**Lead Architect**): full authority (`{ ok: true }`).
 * - `visitor` (**Field Observer**): read-only; every `BaseCommand` is refused (`{ ok: false, why: 'visitor-read-only' }`).
 * - `cobuilder` (**Co-Builder**):
 *   - Can place pieces, draft and craft, slot cartridges, operate machines, and demolish pieces they placed during the session.
 *   - Cannot run plot-level admin commands (`stage`, `grant`).
 *   - Cannot remove hardpoint machines, bins holding items, or pieces placed by the Lead Architect (or another player).
 */
export function canRun(
  role: OutpostRole,
  cmd: BaseCommand,
  world: BaseWorld,
  actorId: string,
  placedBy?: PlacedBySource,
): RoleVerdict {
  if (!actorId || typeof actorId !== 'string') {
    return { ok: false, why: 'missing-actor' };
  }

  if (role === 'owner') {
    return { ok: true };
  }

  if (role === 'visitor') {
    return { ok: false, why: 'visitor-read-only' };
  }

  if (role !== 'cobuilder') {
    return { ok: false, why: 'invalid-role' };
  }

  // Co-Builder guardrails
  switch (cmd.t) {
    case 'stage':
    case 'grant':
      return { ok: false, why: 'owner-only' };

    case 'remove': {
      const piece = world.base.pieces.find((p) => p.id === cmd.id);
      if (!piece) {
        return { ok: false, why: 'no-piece' };
      }

      const { placer, allowAll, allowHardpoints } = lookupPiecePlacer(cmd.id, world, placedBy);

      // Guardrail 1: Cannot remove hardpoints or hardpoint machines unless Lead Architect explicitly allows
      const hasMachine = world.machines.some((m) => m.id === cmd.id);
      if ((hasMachine || piece.kind === 'hardpoint') && !allowHardpoints) {
        return { ok: false, why: 'hardpoint-protected' };
      }

      // Guardrail 2: Cannot remove a storage bin holding items
      const box = world.boxes.find((b) => b.id === cmd.id);
      if (box && box.slots.some((s) => s !== null && s.n > 0)) {
        return { ok: false, why: 'bin-not-empty' };
      }

      // Guardrail 3: Cannot remove Lead Architect's pieces (or any piece not placed by this Co-Builder)
      if (!allowAll && placer !== actorId) {
        return { ok: false, why: 'owner-piece-protected' };
      }

      return { ok: true };
    }

    default:
      return { ok: true };
  }
}
