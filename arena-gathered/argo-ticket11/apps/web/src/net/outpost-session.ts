// ============================================================================
// File: apps/web/src/net/outpost-session.ts
// Plan 36 Phase 1: the one live outpost connection the app holds, shared by the Planetary Grid (host, join, leave) and the play
// screen (which predicts its builds through it). It outlives either screen, so leaving the grid does not drop a session the
// player is in, and opening play inside a session picks it up.
// Saves: a session never writes the play screen's base world. On leaving, the host's save takes the room's world (the room
// keeps the host's plot); a guest's own save is never touched, so the guest gets their own world back.
// ============================================================================

import type { BaseCommand, BaseWorld } from '../base/world';
import { connectOutpost, loadRealtimeSdk, type OutpostClient } from './outpost-client';
import type { OutpostRole } from './protocol';

export interface OutpostSession {
  readonly client: OutpostClient;
  /** The room's 6-character code (what a friend types to join). */
  readonly code: string | null;
  /** Whether this player is the host (the Lead Architect of the room they opened). */
  readonly host: boolean;
}

/** One player in the room, as the roster shows them. */
export interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly role: OutpostRole;
  readonly self: boolean;
}

/** The room's players: the roles and join usernames (POL-117) the room holds, presence names where known, and this player. */
export function rosterOf(client: OutpostClient): RosterEntry[] {
  const state = client.state();
  const byId = new Map<string, { name: string; role: OutpostRole }>();
  for (const [id, role] of Object.entries(state.roles)) {
    const known = state.usernames?.[id];
    byId.set(id, { name: known && known.trim() ? known : 'Friend', role });
  }
  for (const peer of state.peers) {
    byId.set(peer.id, { name: peer.username || state.usernames?.[peer.id] || 'Friend', role: peer.role });
  }
  if (state.playerId) byId.set(state.playerId, { name: 'You', role: state.role });
  return [...byId.entries()].map(([id, p]) => ({ id, name: p.name, role: p.role, self: id === state.playerId }));
}

/** A RUN room code: six letters or digits. */
export function isRoomCode(text: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(text.trim());
}

let active: OutpostSession | null = null;
let connecting: Promise<OutpostSession> | null = null;
/** The host's room world, held from leaving until the play screen writes it into the host's save. */
let pendingHostSave: BaseWorld | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  for (const cb of [...listeners]) cb();
}

/** The live session, or null. */
export function currentOutpostSession(): OutpostSession | null {
  return active;
}

/** Calls `cb` when a session starts or ends (and when the grid or play changes it). Returns the unsubscribe. */
export function subscribeOutpostSession(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Whether co-op can run in this build: the RUN realtime API is present (a plain build has no backend). */
export async function coopAvailable(): Promise<boolean> {
  return (await loadRealtimeSdk()) !== null;
}

function adopt(session: OutpostSession): OutpostSession {
  active = session;
  publish();
  return session;
}

/** Opens a new outpost room as its Lead Architect. Resolves to the live session; a second call while one is open returns it. */
export async function hostOutpostSession(): Promise<OutpostSession> {
  if (active) return active;
  if (connecting) return connecting;
  connecting = connectOutpost('host').then(
    (client) => {
      connecting = null;
      return adopt({ client, code: client.state().roomCode, host: true });
    },
    (err: unknown) => {
      connecting = null;
      throw err;
    },
  );
  return connecting;
}

/** Joins a room by its code. Rejects with a readable message for a code that is not a room code. */
export async function joinOutpostSession(code: string): Promise<OutpostSession> {
  const clean = code.trim().toUpperCase();
  if (!isRoomCode(clean)) throw new Error('A room code is six letters or digits.');
  if (active && active.code === clean) return active;
  if (active) leaveOutpostSession();
  const client = await connectOutpost(clean);
  return adopt({ client, code: clean, host: false });
}

/**
 * Leaves the session. A host's save will take the room's world when the play screen next reads its save (see
 * takePendingHostSave). A guest's save is not touched.
 */
export function leaveOutpostSession(): void {
  const session = active;
  if (!session) return;
  if (session.host) pendingHostSave = session.client.state().confirmedWorld;
  active = null;
  session.client.leave();
  publish();
}

/** The host's room world from the session just left, once: the play screen writes it into the host's base save. */
export function takePendingHostSave(): BaseWorld | null {
  const world = pendingHostSave;
  pendingHostSave = null;
  return world;
}

/**
 * A console hook for the browser checks (scripts/test-coop-outpost.mjs): the live session, driven from a page. It only reads and
 * sends through the same session the screens use; the game never calls it.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __outpost?: unknown }).__outpost = {
    host: async (): Promise<string | null> => (await hostOutpostSession()).code,
    join: async (code: string): Promise<string | null> => (await joinOutpostSession(code)).code,
    leave: (): void => leaveOutpostSession(),
    /** Sends a command through the live session; the answer is what the client predicted. */
    send: (cmd: BaseCommand): { readonly refused: boolean; readonly version: number } | null => {
      const session = currentOutpostSession();
      if (!session) return null;
      const applied = session.client.send(cmd);
      return { refused: applied.events.some((e) => e.type === 'refused'), version: session.client.state().version };
    },
    /** The confirmed world's hash, the version, and the roster as the room sees it. */
    state: (): { readonly hash: string; readonly version: number; readonly roles: readonly string[]; readonly connection: string; readonly structure: number | null; readonly player: string | null; readonly roleKeys: readonly string[]; readonly peers: number } | null => {
      const session = currentOutpostSession();
      if (!session) return null;
      const st = session.client.state();
      return {
        hash: st.confirmedHash,
        version: st.version,
        roles: rosterOf(session.client).map((p) => p.role),
        connection: st.connectionState,
        structure: st.confirmedWorld.base.structures[0]?.id ?? null,
        player: st.playerId,
        roleKeys: Object.keys(st.roles),
        peers: st.peers.length,
      };
    },
  };
}
