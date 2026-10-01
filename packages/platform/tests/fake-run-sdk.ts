// In-memory fake of the @series-inc/rundot-game-sdk matching docs and types

interface FakeServerPlayer {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface FakeServerRoomInternal {
  roomCode: string;
  players: FakeServerPlayer[];
  maxPlayers: number;
  metadata: Record<string, any>;
  connections: Set<FakeServerRoomHandle>;
}

interface FakeServerRoomHandle {
  roomCode: string;
  players: FakeServerPlayer[];
  on(events: any): void;
  send(msg: any): void;
  leave(): Promise<void>;
}

export function createFakeRunSdk(initialUser: { id?: string; username?: string; isAnonymous?: boolean } = {}) {
  const profile = {
    id: initialUser.id ?? 'fake-player-1',
    username: initialUser.username ?? 'RunPlayer',
    name: initialUser.username ?? 'RunPlayer',
    isAnonymous: initialUser.isAnonymous ?? false,
  };

  // Storage bucket simulation
  const storageMap = new Map<string, string>();

  // UGC repository simulation
  let ugcCounter = 1;
  const ugcItems = new Map<string, any>();

  // Leaderboard simulation: board -> username -> best score
  const boards = new Map<string, Map<string, { username: string; score: number; metadata?: any }>>();

  // Realtime rooms simulation
  let roomCounter = 1;
  const activeRooms = new Map<string, FakeServerRoomInternal>();

  function createRoomHandle(internal: FakeServerRoomInternal, player: FakeServerPlayer): FakeServerRoomHandle {
    const eventHandlers: any[] = [];
    const handle: FakeServerRoomHandle = {
      get roomCode() {
        return internal.roomCode;
      },
      get players() {
        return [...internal.players];
      },
      on(events: any) {
        eventHandlers.push(events);
      },
      send(msg: any) {
        // Broadcast to all connected clients in the room
        for (const conn of internal.connections) {
          for (const handler of (conn as any)._handlers) {
            handler.onMessage?.(msg);
          }
        }
      },
      async leave() {
        internal.players = internal.players.filter((p) => p.id !== player.id);
        internal.connections.delete(handle);
        for (const conn of internal.connections) {
          for (const handler of (conn as any)._handlers) {
            handler.onPlayerLeft?.(player.id);
          }
        }
      },
    };
    (handle as any)._handlers = eventHandlers;
    internal.connections.add(handle);
    return handle;
  }

  return {
    getProfile() {
      return { ...profile };
    },
    appStorage: {
      async getItem(key: string): Promise<string | null> {
        return storageMap.has(key) ? storageMap.get(key)! : null;
      },
      async setItem(key: string, value: string): Promise<void> {
        storageMap.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        storageMap.delete(key);
      },
      async getAllItems(): Promise<string[]> {
        return Array.from(storageMap.keys());
      },
    },
    ugc: {
      async create(params: { contentType: string; data: Record<string, unknown>; title?: string; tags?: string[] }) {
        const id = `ugc_entry_${ugcCounter++}`;
        const entry = {
          id,
          contentType: params.contentType,
          data: params.data,
          title: params.title ?? '',
          tags: params.tags ?? [],
          authorId: profile.id,
          authorName: profile.username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPublic: true,
        };
        ugcItems.set(id, entry);
        return entry;
      },
      async browse(params?: { contentType?: string; limit?: number }) {
        let entries = Array.from(ugcItems.values());
        if (params?.contentType) {
          entries = entries.filter((e) => e.contentType === params.contentType);
        }
        if (params?.limit !== undefined) {
          entries = entries.slice(0, params.limit);
        }
        return { entries };
      },
      async listMine(params?: { contentType?: string; limit?: number }) {
        let entries = Array.from(ugcItems.values()).filter((e) => e.authorName === profile.username);
        if (params?.contentType) {
          entries = entries.filter((e) => e.contentType === params.contentType);
        }
        if (params?.limit !== undefined) {
          entries = entries.slice(0, params.limit);
        }
        return { entries };
      },
      async get(id: string) {
        return ugcItems.get(id) ?? null;
      },
      async delete(id: string) {
        ugcItems.delete(id);
      },
    },
    leaderboard: {
      async submitScore(params: { score: number; duration?: number; mode?: string; metadata?: Record<string, any> }) {
        const board = params.mode ?? 'default';
        let b = boards.get(board);
        if (!b) {
          b = new Map();
          boards.set(board, b);
        }
        const existing = b.get(profile.username);
        if (!existing || params.score > existing.score) {
          b.set(profile.username, { username: profile.username, score: params.score, metadata: params.metadata });
        }
        return { accepted: true, rank: 1 };
      },
      async getPagedScores(options?: { mode?: string; limit?: number }) {
        const board = options?.mode ?? 'default';
        const b = boards.get(board);
        if (!b) return { entries: [] };
        const sorted = Array.from(b.values()).sort((x, y) => y.score - x.score);
        const sliced = options?.limit !== undefined ? sorted.slice(0, options.limit) : sorted;
        return {
          entries: sliced.map((entry, index) => ({
            profileId: `pid_${entry.username}`,
            username: entry.username,
            score: entry.score,
            duration: 0,
            rank: index + 1,
            metadata: entry.metadata,
          })),
        };
      },
    },
    realtime: {
      async createRoom(_roomType: string, opts?: { createOptions?: { maxPlayers?: number; metadata?: Record<string, any> } }) {
        const code = `ROOM${roomCounter++}`;
        const player: FakeServerPlayer = { id: profile.id, username: profile.username };
        const internal: FakeServerRoomInternal = {
          roomCode: code,
          players: [player],
          maxPlayers: opts?.createOptions?.maxPlayers ?? 10,
          metadata: opts?.createOptions?.metadata ?? {},
          connections: new Set(),
        };
        activeRooms.set(code, internal);
        return createRoomHandle(internal, player);
      },
      async joinRoomByCode(code: string) {
        const internal = activeRooms.get(code);
        if (!internal) {
          throw new Error(`Room not found: ${code}`);
        }
        const player: FakeServerPlayer = { id: `guest_${Date.now()}`, username: profile.username };
        internal.players.push(player);
        const handle = createRoomHandle(internal, player);
        for (const conn of internal.connections) {
          for (const handler of (conn as any)._handlers) {
            handler.onPlayerJoined?.(player);
          }
        }
        return handle;
      },
      async getUserRooms() {
        return Array.from(activeRooms.values()).map((r) => ({
          roomId: r.roomCode,
          roomCode: r.roomCode,
          roomType: 'default',
          appId: 'fake-app',
          players: r.players.map((p) => p.username),
          maxPlayers: r.maxPlayers,
          isPrivate: false,
          status: 'active',
          metadata: r.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
      },
    },
  };
}
