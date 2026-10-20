// ============================================================================
// File: apps/web/src/avatar/custom-avatar-store.ts
// TICKET-21 (POL-12 — Universal 3D Avatar Drag & Drop):
// IndexedDB persistence for imported .glb and .vrm custom avatars, with an
// automatic in-memory fallback for headless tests and SSR.
// Keeps the Hazmat Scientist ('hazmat-scientist') as the default avatar.
// ============================================================================

import {
  inspectGlbOrVrmBinary,
  type AvatarFileFormat,
  type BoneRetargetMap,
} from '@hm/anim';
import { kv } from '../storage/profile-storage';

export const DEFAULT_AVATAR_ID = 'hazmat-scientist';
export const CUSTOM_AVATAR_DB_NAME = 'hm.setmix.customAvatars';
export const CUSTOM_AVATAR_STORE_NAME = 'avatars';
const ACTIVE_CUSTOM_AVATAR_KEY = 'hm.setmix.activeCustomAvatarId';

export interface CustomAvatarRecord {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly format: AvatarFileFormat;
  readonly bytes: ArrayBuffer;
  readonly retargetMap: BoneRetargetMap;
  readonly mappedCount: number;
  readonly createdAt: number;
}

const memoryStore = new Map<string, CustomAvatarRecord>();
let activeCustomIdMemory: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of [...listeners]) cb();
}

export function subscribeCustomAvatars(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CUSTOM_AVATAR_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CUSTOM_AVATAR_STORE_NAME)) {
          db.createObjectStore(CUSTOM_AVATAR_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Returns the active custom avatar ID, or `null` when the default Hazmat Scientist
 * (or a standard SetMix look) is worn.
 */
export function getActiveCustomAvatarId(): string | null {
  try {
    const val = kv.get(ACTIVE_CUSTOM_AVATAR_KEY);
    return val && val !== DEFAULT_AVATAR_ID ? val : activeCustomIdMemory;
  } catch {
    return activeCustomIdMemory;
  }
}

/**
 * Sets the active custom avatar ID (`null` or `'hazmat-scientist'` restores the default Hazmat Scientist).
 */
export function setActiveCustomAvatarId(id: string | null): void {
  const clean = id && id !== DEFAULT_AVATAR_ID ? id : null;
  activeCustomIdMemory = clean;
  try {
    if (clean) kv.set(ACTIVE_CUSTOM_AVATAR_KEY, clean);
    else kv.remove(ACTIVE_CUSTOM_AVATAR_KEY);
  } catch {
    // ignore storage quota errors
  }
  notify();
}

/**
 * Validates, inspects, retargets, and stores a dropped `.glb` or `.vrm` binary in IndexedDB.
 */
export async function importCustomAvatarFile(
  fileName: string,
  bytes: ArrayBuffer,
): Promise<{ readonly ok: true; readonly record: CustomAvatarRecord } | { readonly ok: false; readonly error: string }> {
  const lower = fileName.trim().toLowerCase();
  if (!lower.endsWith('.glb') && !lower.endsWith('.vrm')) {
    return { ok: false, error: 'Drop a .glb or .vrm 3D avatar file.' };
  }
  const inspection = inspectGlbOrVrmBinary(bytes, fileName);
  if (!inspection.valid) {
    return { ok: false, error: 'Invalid GLB/VRM binary header.' };
  }

  const baseName =
    inspection.vrmMeta?.title?.trim() ||
    fileName.replace(/\.(glb|vrm)$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 20) ||
    'Custom Rig';
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const record: CustomAvatarRecord = {
    id,
    name: baseName,
    fileName,
    format: inspection.format,
    bytes,
    retargetMap: inspection.retargetMap,
    mappedCount: inspection.mappedCount,
    createdAt: Date.now(),
  };

  memoryStore.set(id, record);
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(CUSTOM_AVATAR_STORE_NAME, 'readwrite');
        tx.objectStore(CUSTOM_AVATAR_STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  setActiveCustomAvatarId(id);
  notify();
  return { ok: true, record };
}

/**
 * Lists all saved custom `.glb` / `.vrm` avatars from IndexedDB (and memory store).
 */
export async function listCustomAvatars(): Promise<CustomAvatarRecord[]> {
  const db = await openDb();
  if (db) {
    const records = await new Promise<CustomAvatarRecord[]>((resolve) => {
      try {
        const tx = db.transaction(CUSTOM_AVATAR_STORE_NAME, 'readonly');
        const req = tx.objectStore(CUSTOM_AVATAR_STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as CustomAvatarRecord[]) ?? []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    for (const r of records) memoryStore.set(r.id, r);
  }
  return [...memoryStore.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeCustomAvatar(id: string): Promise<void> {
  memoryStore.delete(id);
  if (getActiveCustomAvatarId() === id) {
    setActiveCustomAvatarId(null);
  }
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(CUSTOM_AVATAR_STORE_NAME, 'readwrite');
        tx.objectStore(CUSTOM_AVATAR_STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  notify();
}
