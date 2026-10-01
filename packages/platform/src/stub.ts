import {
  UGC_MAX_BYTES,
  UgcTooLargeError,
  type Platform,
  type PresetBundle,
  type Profile,
  type PublishedItem,
  type Room,
  type RoomMessage,
  type Unsubscribe,
  type Value,
} from '../../contracts/src/index.js';

// In-memory hub allows multiple stub platforms to interact (e.g. multi-user rooms)
export interface StubHub {
  readonly storage: Map<string, string>;
  readonly ugc: Map<string, { readonly item: PublishedItem; readonly bundle: PresetBundle }>;
  readonly leaderboards: Map<string, Map<string, { readonly name: string; readonly score: number }>>;
  readonly rooms: Map<string, StubRoomState>;
  nextId(prefix: string): string;
  now(): number;
}

interface StubParticipant {
  readonly id: string;
  readonly name: string;
  readonly onMessage: Set<(message: RoomMessage) => void>;
  readonly onMembers: Set<(members: readonly string[]) => void>;
}

interface StubRoomState {
  readonly id: string;
  readonly maxPlayers: number;
  readonly metadata: Readonly<Record<string, Value>>;
  participants: StubParticipant[];
}

export function createStubHub(opts?: { readonly now?: () => number }): StubHub {
  let counter = 1;
  let idCounter = 1;
  return {
    storage: new Map(),
    ugc: new Map(),
    leaderboards: new Map(),
    rooms: new Map(),
    nextId(prefix: string): string {
      return `${prefix}_${idCounter++}`;
    },
    // We increment a clock counter instead of Date.now to keep tests deterministic
    now(): number {
      return opts?.now ? opts.now() : counter++;
    },
  };
}

export interface StubPlatformOptions {
  readonly user?: string;
  readonly hub?: StubHub;
  readonly now?: () => number;
}

export function createStubPlatform(opts?: StubPlatformOptions): Platform {
  // Use shared hub if provided, or create an isolated hub per instance
  const hub = opts?.hub ?? createStubHub(opts);
  const currentUser = opts?.user;
  const authorName = currentUser ?? 'guest';

  // Profile: anonymous guest when no user is supplied
  async function profile(): Promise<Profile> {
    if (currentUser) {
      return { id: `user-${currentUser}`, name: currentUser, isAnonymous: false };
    }
    return { id: 'guest', name: 'guest', isAnonymous: true };
  }

  // Storage: isolated per hub instance with key prefix querying
  const storage = {
    async get(key: string): Promise<string | null> {
      return hub.storage.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      hub.storage.set(key, value);
    },
    async remove(key: string): Promise<void> {
      hub.storage.delete(key);
    },
    async keys(prefix?: string): Promise<readonly string[]> {
      const all = Array.from(hub.storage.keys());
      return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
    },
  };

  // UGC: enforce 100KB payload cap and track bundles with injected counter
  const ugc = {
    async publish(title: string, bundle: PresetBundle, tags?: readonly string[]): Promise<PublishedItem> {
      const bytes = JSON.stringify(bundle).length;
      if (bytes > UGC_MAX_BYTES) {
        throw new UgcTooLargeError(bytes);
      }
      const id = hub.nextId('ugc');
      const item: PublishedItem = {
        id,
        title,
        author: authorName,
        createdAt: hub.now(),
        tags: tags ? [...tags] : [],
        bytes,
      };
      hub.ugc.set(id, { item, bundle });
      return item;
    },
    async list(listOpts?: { readonly tag?: string; readonly mine?: boolean; readonly limit?: number }): Promise<readonly PublishedItem[]> {
      let items = Array.from(hub.ugc.values()).map((v) => v.item);
      if (listOpts?.tag) {
        items = items.filter((i) => i.tags.includes(listOpts.tag!));
      }
      if (listOpts?.mine) {
        items = items.filter((i) => i.author === authorName);
      }
      if (listOpts?.limit !== undefined) {
        items = items.slice(0, listOpts.limit);
      }
      return items;
    },
    async load(id: string): Promise<PresetBundle> {
      const entry = hub.ugc.get(id);
      if (!entry) {
        throw new Error(`UGC bundle not found: ${id}`);
      }
      return entry.bundle;
    },
    async remove(id: string): Promise<void> {
      hub.ugc.delete(id);
    },
  };

  // Leaderboard: tracks high scores, keeps only personal best per board
  const leaderboard = {
    async submit(board: string, score: number): Promise<void> {
      let boardMap = hub.leaderboards.get(board);
      if (!boardMap) {
        boardMap = new Map();
        hub.leaderboards.set(board, boardMap);
      }
      const existing = boardMap.get(authorName);
      if (!existing || score > existing.score) {
        boardMap.set(authorName, { name: authorName, score });
      }
    },
    async top(board: string, limit?: number): Promise<readonly { readonly rank: number; readonly name: string; readonly score: number }[]> {
      const boardMap = hub.leaderboards.get(board);
      if (!boardMap || boardMap.size === 0) {
        return [];
      }
      const sorted = Array.from(boardMap.values()).sort((a, b) => b.score - a.score);
      const rows = limit !== undefined ? sorted.slice(0, limit) : sorted;
      return rows.map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        score: entry.score,
      }));
    },
  };

  // Helper to construct a Room handle for a given participant
  function buildRoomHandle(state: StubRoomState, participant: StubParticipant): Room {
    const notifyMembers = () => {
      const currentNames = state.participants.map((p) => p.name);
      for (const p of state.participants) {
        for (const cb of p.onMembers) {
          cb(currentNames);
        }
      }
    };

    return {
      id: state.id,
      get members(): readonly string[] {
        return state.participants.map((p) => p.name);
      },
      send(name: string, payload: Value, to?: string): void {
        const msg: RoomMessage = { from: participant.name, name, payload };
        // Deliver exclusively to OTHER members (never the sender)
        for (const other of state.participants) {
          if (other.id === participant.id) continue;
          if (to !== undefined && other.name !== to) continue;
          for (const cb of other.onMessage) {
            cb(msg);
          }
        }
      },
      onMessage(listener: (message: RoomMessage) => void): Unsubscribe {
        participant.onMessage.add(listener);
        return () => {
          participant.onMessage.delete(listener);
        };
      },
      onMembers(listener: (members: readonly string[]) => void): Unsubscribe {
        participant.onMembers.add(listener);
        return () => {
          participant.onMembers.delete(listener);
        };
      },
      async leave(): Promise<void> {
        state.participants = state.participants.filter((p) => p.id !== participant.id);
        notifyMembers();
      },
    };
  }

  // Rooms: manages lobby, player limits, and event dispatch
  const rooms = {
    async create(createOpts?: { readonly maxPlayers?: number; readonly metadata?: Readonly<Record<string, Value>> }): Promise<Room> {
      const id = hub.nextId('room');
      const maxPlayers = createOpts?.maxPlayers ?? 16;
      const metadata = createOpts?.metadata ?? {};
      const participant: StubParticipant = {
        id: hub.nextId('part'),
        name: authorName,
        onMessage: new Set(),
        onMembers: new Set(),
      };
      const state: StubRoomState = {
        id,
        maxPlayers,
        metadata,
        participants: [participant],
      };
      hub.rooms.set(id, state);
      return buildRoomHandle(state, participant);
    },
    async join(id: string): Promise<Room> {
      const state = hub.rooms.get(id);
      if (!state) {
        throw new Error(`Room not found: ${id}`);
      }
      if (state.participants.length >= state.maxPlayers) {
        throw new Error(`Room is full: reached maxPlayers (${state.maxPlayers})`);
      }
      const participant: StubParticipant = {
        id: hub.nextId('part'),
        name: authorName,
        onMessage: new Set(),
        onMembers: new Set(),
      };
      state.participants.push(participant);

      // Notify all room participants of the new member list
      const currentNames = state.participants.map((p) => p.name);
      for (const p of state.participants) {
        for (const cb of p.onMembers) {
          cb(currentNames);
        }
      }

      return buildRoomHandle(state, participant);
    },
    async list(): Promise<readonly { readonly id: string; readonly members: number; readonly metadata: Readonly<Record<string, Value>> }[]> {
      return Array.from(hub.rooms.values()).map((r) => ({
        id: r.id,
        members: r.participants.length,
        metadata: r.metadata,
      }));
    },
  };

  return {
    kind: 'stub',
    storage,
    ugc,
    leaderboard,
    rooms,
    profile,
  };
}
