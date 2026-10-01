import type { Unsubscribe, Value } from './core';
import type { PresetBundle } from './preset';

/** RUN has no server of ours: persistence, sharing, scores and rooms all go through the platform. Every adapter has a local stub with the same behaviour. */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<readonly string[]>;
}

export interface PublishedItem {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly createdAt: number;
  readonly tags: readonly string[];
  readonly bytes: number;
}

export const UGC_MAX_BYTES = 100_000;

export interface UgcAdapter {
  /** Rejects (throws UgcTooLargeError) a bundle whose JSON is over UGC_MAX_BYTES. */
  publish(title: string, bundle: PresetBundle, tags?: readonly string[]): Promise<PublishedItem>;
  list(opts?: { readonly tag?: string; readonly mine?: boolean; readonly limit?: number }): Promise<readonly PublishedItem[]>;
  load(id: string): Promise<PresetBundle>;
  remove(id: string): Promise<void>;
}
export class UgcTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`bundle is ${bytes} bytes; the limit is ${UGC_MAX_BYTES}`);
    this.name = 'UgcTooLargeError';
  }
}

export interface LeaderboardAdapter {
  submit(board: string, score: number, meta?: Readonly<Record<string, Value>>): Promise<void>;
  top(board: string, limit?: number): Promise<readonly { readonly rank: number; readonly name: string; readonly score: number }[]>;
}

export interface RoomMessage {
  readonly from: string;
  readonly name: string;
  readonly payload: Value;
}
export interface Room {
  readonly id: string;
  readonly members: readonly string[];
  send(name: string, payload: Value, to?: string): void;
  onMessage(listener: (message: RoomMessage) => void): Unsubscribe;
  onMembers(listener: (members: readonly string[]) => void): Unsubscribe;
  leave(): Promise<void>;
}
export interface RoomsAdapter {
  create(opts?: { readonly maxPlayers?: number; readonly metadata?: Readonly<Record<string, Value>> }): Promise<Room>;
  join(id: string): Promise<Room>;
  list(): Promise<readonly { readonly id: string; readonly members: number; readonly metadata: Readonly<Record<string, Value>> }[]>;
}

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly isAnonymous: boolean;
}

export interface Platform {
  readonly kind: 'stub' | 'run';
  readonly storage: StorageAdapter;
  readonly ugc: UgcAdapter;
  readonly leaderboard: LeaderboardAdapter;
  readonly rooms: RoomsAdapter;
  profile(): Promise<Profile>;
}
