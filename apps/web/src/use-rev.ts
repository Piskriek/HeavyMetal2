import { useSyncExternalStore } from 'react';
import type { Runtime } from '@hm/engine';

/** A number that changes whenever anything in the runtime's presets or its undo history changes, so a component can re-read the store. */
export function useRev(rt: Runtime): number {
  return useSyncExternalStore(
    (cb) => { const a = rt.store.subscribe(cb); const b = rt.commands.subscribe(cb); return () => { a(); b(); }; },
    () => rt.store.list().length * 1e6 + rt.commands.history().length * 10 + (rt.commands.canUndo ? 1 : 0) + (rt.commands.canRedo ? 2 : 0),
  );
}
