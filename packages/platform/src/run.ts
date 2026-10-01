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

// Wrap SDK's ServerRoom into our application's Room interface
function wrapServerRoom(serverRoom: any, getAuthor: () => string): Room {
  const messageListeners = new Set<(message: RoomMessage) => void>();
  const membersListeners = new Set<(members: readonly string[]) => void>();

  const getMemberList = (): readonly string[] => {
    if (!serverRoom.players) return [];
    return serverRoom.players.map((p: any) => (typeof p === 'string' ? p : p.username || p.id));
  };

  const notifyMembers = () => {
    const list = getMemberList();
    for (const listener of membersListeners) {
      listener(list);
    }
  };

  // Wire into the SDK ServerRoom event callbacks
  if (typeof serverRoom.on === 'function') {
    serverRoom.on({
      onMessage(msg: any) {
        if (!msg || msg.type !== 'game_message') return;
        const myName = getAuthor();
        // Never deliver message back to sender (matches Stub semantics)
        if (msg.from === myName) return;
        if (msg.to !== undefined && msg.to !== myName) return;
        const roomMsg: RoomMessage = { from: msg.from, name: msg.name, payload: msg.payload };
        for (const listener of messageListeners) {
          listener(roomMsg);
        }
      },
      onPlayerJoined: notifyMembers,
      onPlayerLeft: notifyMembers,
    });
  }

  return {
    id: serverRoom.roomCode || serverRoom.id || '',
    get members(): readonly string[] {
      return getMemberList();
    },
    send(name: string, payload: Value, to?: string): void {
      try {
        serverRoom.send({
          type: 'game_message',
          from: getAuthor(),
          name,
          payload,
          to,
        });
      } catch (err: any) {
        throw new Error(`Room send failed: ${err?.message || err}`);
      }
    },
    onMessage(listener: (message: RoomMessage) => void): Unsubscribe {
      messageListeners.add(listener);
      return () => {
        messageListeners.delete(listener);
      };
    },
    onMembers(listener: (members: readonly string[]) => void): Unsubscribe {
      membersListeners.add(listener);
      return () => {
        membersListeners.delete(listener);
      };
    },
    async leave(): Promise<void> {
      try {
        await serverRoom.leave();
      } catch (err: any) {
        throw new Error(`Room leave failed: ${err?.message || err}`);
      }
    },
  };
}

export function createRunPlatform(opts?: { readonly user?: string; readonly sdk?: unknown }): Platform {
  // Requirement: throw an Error containing "sdk" when opts.sdk is absent
  if (!opts || !opts.sdk) {
    throw new Error('RUN platform requires an sdk object in opts.sdk');
  }

  const sdk = opts.sdk as any;

  function getAuthor(): string {
    if (opts?.user) return opts.user;
    try {
      const p = sdk.getProfile?.();
      return p?.username || p?.name || 'guest';
    } catch {
      return 'guest';
    }
  }

  // Profile API: reads player identity via getProfile() per PROFILE.md
  async function profile(): Promise<Profile> {
    try {
      if (typeof sdk.getProfile !== 'function') {
        throw new Error('SDK missing getProfile function');
      }
      const p = sdk.getProfile();
      return {
        id: p.id || 'unknown',
        name: p.username || p.name || 'guest',
        isAnonymous: Boolean(p.isAnonymous),
      };
    } catch (err: any) {
      throw new Error(`Profile fetch failed: ${err?.message || err}`);
    }
  }

  // Storage API: maps get/set/remove/keys to appStorage per STORAGE.md
  const storage = {
    async get(key: string): Promise<string | null> {
      try {
        const res = await sdk.appStorage.getItem(key);
        return res ?? null;
      } catch (err: any) {
        throw new Error(`Storage get failed for "${key}": ${err?.message || err}`);
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        await sdk.appStorage.setItem(key, value);
      } catch (err: any) {
        throw new Error(`Storage set failed for "${key}": ${err?.message || err}`);
      }
    },
    async remove(key: string): Promise<void> {
      try {
        await sdk.appStorage.removeItem(key);
      } catch (err: any) {
        throw new Error(`Storage remove failed for "${key}": ${err?.message || err}`);
      }
    },
    async keys(prefix?: string): Promise<readonly string[]> {
      try {
        const allKeys: string[] = await sdk.appStorage.getAllItems();
        return prefix ? allKeys.filter((k) => k.startsWith(prefix)) : allKeys;
      } catch (err: any) {
        throw new Error(`Storage keys failed: ${err?.message || err}`);
      }
    },
  };

  // UGC API: maps publish/list/load/remove to sdk.ugc per UGC.md
  const ugc = {
    async publish(title: string, bundle: PresetBundle, tags?: readonly string[]): Promise<PublishedItem> {
      const bytes = JSON.stringify(bundle).length;
      if (bytes > UGC_MAX_BYTES) {
        throw new UgcTooLargeError(bytes);
      }
      try {
        const entry = await sdk.ugc.create({
          contentType: 'preset-bundle',
          data: bundle,
          title,
          tags: tags ? [...tags] : [],
        });
        return {
          id: entry.id,
          title: entry.title ?? title,
          author: entry.authorName || getAuthor(),
          createdAt: entry.createdAt,
          tags: entry.tags ?? (tags ? [...tags] : []),
          bytes,
        };
      } catch (err: any) {
        if (err instanceof UgcTooLargeError) throw err;
        throw new Error(`UGC publish failed: ${err?.message || err}`);
      }
    },
    async list(listOpts?: { readonly tag?: string; readonly mine?: boolean; readonly limit?: number }): Promise<readonly PublishedItem[]> {
      try {
        const res = listOpts?.mine
          ? await sdk.ugc.listMine({ contentType: 'preset-bundle', limit: listOpts?.limit })
          : await sdk.ugc.browse({ contentType: 'preset-bundle', limit: listOpts?.limit });

        let entries: any[] = res?.entries ?? [];
        if (listOpts?.tag) {
          entries = entries.filter((e) => Array.isArray(e.tags) && e.tags.includes(listOpts.tag!));
        }
        if (listOpts?.limit !== undefined) {
          entries = entries.slice(0, listOpts.limit);
        }
        return entries.map((e) => ({
          id: e.id,
          title: e.title ?? '',
          author: e.authorName || 'guest',
          createdAt: e.createdAt,
          tags: e.tags ?? [],
          bytes: e.data ? JSON.stringify(e.data).length : 0,
        }));
      } catch (err: any) {
        throw new Error(`UGC list failed: ${err?.message || err}`);
      }
    },
    async load(id: string): Promise<PresetBundle> {
      try {
        const entry = await sdk.ugc.get(id);
        if (!entry || !entry.data) {
          throw new Error(`UGC item "${id}" not found`);
        }
        return entry.data as PresetBundle;
      } catch (err: any) {
        throw new Error(`UGC load failed: ${err?.message || err}`);
      }
    },
    async remove(id: string): Promise<void> {
      try {
        await sdk.ugc.delete(id);
      } catch (err: any) {
        throw new Error(`UGC remove failed: ${err?.message || err}`);
      }
    },
  };

  // Leaderboard API: maps submit and top to sdk.leaderboard per LEADERBOARD.md
  const leaderboard = {
    async submit(board: string, score: number, meta?: Readonly<Record<string, Value>>): Promise<void> {
      try {
        await sdk.leaderboard.submitScore({
          mode: board,
          score,
          duration: 0,
          metadata: meta ? { ...meta } : undefined,
        });
      } catch (err: any) {
        throw new Error(`Leaderboard submit failed: ${err?.message || err}`);
      }
    },
    async top(board: string, limit?: number): Promise<readonly { readonly rank: number; readonly name: string; readonly score: number }[]> {
      try {
        const res = await sdk.leaderboard.getPagedScores({ mode: board, limit });
        const entries: any[] = res?.entries ?? [];
        return entries.map((entry, index) => ({
          rank: entry.rank ?? index + 1,
          name: entry.username || entry.name || '',
          score: entry.score,
        }));
      } catch (err: any) {
        throw new Error(`Leaderboard top query failed: ${err?.message || err}`);
      }
    },
  };

  // Multiplayer Rooms API: uses sdk.realtime per MULTIPLAYER.md
  const rooms = {
    async create(createOpts?: { readonly maxPlayers?: number; readonly metadata?: Readonly<Record<string, Value>> }): Promise<Room> {
      try {
        const serverRoom = await sdk.realtime.createRoom('default', {
          createOptions: {
            maxPlayers: createOpts?.maxPlayers,
            metadata: createOpts?.metadata ? { ...createOpts.metadata } : undefined,
          },
        });
        return wrapServerRoom(serverRoom, getAuthor);
      } catch (err: any) {
        throw new Error(`Room create failed: ${err?.message || err}`);
      }
    },
    async join(id: string): Promise<Room> {
      try {
        const serverRoom = await sdk.realtime.joinRoomByCode(id);
        return wrapServerRoom(serverRoom, getAuthor);
      } catch (err: any) {
        throw new Error(`Room join failed: ${err?.message || err}`);
      }
    },
    async list(): Promise<readonly { readonly id: string; readonly members: number; readonly metadata: Readonly<Record<string, Value>> }[]> {
      try {
        const summaries: any[] = await sdk.realtime.getUserRooms();
        return (summaries ?? []).map((s) => ({
          id: s.roomCode || s.roomId || '',
          members: Array.isArray(s.players) ? s.players.length : (typeof s.players === 'number' ? s.players : 0),
          metadata: s.metadata ?? {},
        }));
      } catch (err: any) {
        throw new Error(`Room list failed: ${err?.message || err}`);
      }
    },
  };

  return {
    kind: 'run',
    storage,
    ugc,
    leaderboard,
    rooms,
    profile,
  };
}
