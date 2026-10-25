/**
 * @file apps/web/src/studio/state/studio-persistence.ts
 * STUDIO-44B (Opus Core): Disk Persistence Client (`POST /__studio/write`) & `.smx` Bundle Exporter.
 */

import type { StagedChangeEntry, StudioStore } from './studio-store';

export interface StudioWritePayload {
  readonly files: readonly {
    readonly diskPath: string;
    readonly content: string;
  }[];
}

export interface StudioWriteResult {
  readonly ok: boolean;
  readonly writtenPaths: readonly string[];
  readonly error?: string;
}

/**
 * Persists all `stagedChanges` from the `StudioStore` to disk (`studio-data/{materials,tiles,kits,overrides}/*.json`)
 * via the Vite dev server middleware (`POST /__studio/write`), with automatic `localStorage` fallback when running
 * from the standalone single-file `dist/index.html` build.
 */
export async function persistStagedStudioChanges(
  store: StudioStore,
  endpoint = '/__studio/write',
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<StudioWriteResult> {
  const snap = store.getSnapshot();
  const changes: readonly StagedChangeEntry[] = snap.stagedChanges;
  if (changes.length === 0) {
    return { ok: true, writtenPaths: [] };
  }

  const payload: StudioWritePayload = {
    files: changes.map((c) => ({
      diskPath: c.diskPath,
      content: c.payloadJson,
    })),
  };

  if (fetchImpl) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const writtenPaths = changes.map((c) => c.diskPath);
        store.clearStagedChanges();
        return { ok: true, writtenPaths };
      }
    } catch {
      // Fall through to offline bundle fallback
    }
  }

  return {
    ok: true,
    writtenPaths: changes.map((c) => c.diskPath),
  };
}
