/**
 * IF-HISTORY: Command stack with drag coalescing and byte-capped diffing.
 * Replaces full document JSON snapshots with lightweight, memory-bounded commands.
 */

export const HISTORY_DEPTH = 200;
export const HISTORY_BYTES = 16 * 1024 * 1024; // 16 MB

export interface Command<T extends { id: string }> {
  label: string;
  before: T[];
  after: T[];          // only records whose serialised form changed
  added: T[];
  removed: T[];
  bytes: number;       // JSON length estimate, used for memory cap
}

/**
 * Pure diff between previous and next object collections.
 * Returns null if no changes occurred (prevents empty undo steps).
 */
export function diffCommand<T extends { id: string }>(
  label: string,
  prev: readonly T[],
  next: readonly T[],
): Command<T> | null {
  const prevMap = new Map<string, T>(prev.map((p) => [p.id, p]));
  const nextMap = new Map<string, T>(next.map((p) => [p.id, p]));

  const added: T[] = [];
  const removed: T[] = [];
  const before: T[] = [];
  const after: T[] = [];

  for (const item of next) {
    const old = prevMap.get(item.id);
    if (!old) {
      added.push(structuredClone(item));
    } else {
      if (JSON.stringify(old) !== JSON.stringify(item)) {
        before.push(structuredClone(old));
        after.push(structuredClone(item));
      }
    }
  }

  for (const item of prev) {
    if (!nextMap.has(item.id)) {
      removed.push(structuredClone(item));
    }
  }

  if (added.length === 0 && removed.length === 0 && before.length === 0) {
    return null;
  }

  const payload = { added, removed, before, after };
  const bytes = JSON.stringify(payload).length;

  return {
    label,
    before,
    after,
    added,
    removed,
    bytes,
  };
}

/**
 * Applies an undo command to revert docs to their prior state.
 */
export function undo<T extends { id: string }>(docs: readonly T[], c: Command<T>): T[] {
  const map = new Map<string, T>(docs.map((d) => [d.id, structuredClone(d)]));

  // Remove items that were added in the command
  for (const a of c.added) {
    map.delete(a.id);
  }

  // Restore items that were removed
  for (const r of c.removed) {
    map.set(r.id, structuredClone(r));
  }

  // Restore previous states of modified items
  for (const b of c.before) {
    map.set(b.id, structuredClone(b));
  }

  return Array.from(map.values());
}

/**
 * Applies a redo command to advance docs to their after state.
 */
export function redo<T extends { id: string }>(docs: readonly T[], c: Command<T>): T[] {
  const map = new Map<string, T>(docs.map((d) => [d.id, structuredClone(d)]));

  // Remove items that were removed in the command
  for (const r of c.removed) {
    map.delete(r.id);
  }

  // Add items that were added
  for (const a of c.added) {
    map.set(a.id, structuredClone(a));
  }

  // Apply after states of modified items
  for (const aft of c.after) {
    map.set(aft.id, structuredClone(aft));
  }

  return Array.from(map.values());
}

export class CommandStack<T extends { id: string }> {
  private undoStack: Command<T>[] = [];
  private redoStack: Command<T>[] = [];
  private activeLabel: string | null = null;
  private activeSnapshot: readonly T[] | null = null;
  private currentBytes = 0;

  get depth(): number {
    return this.undoStack.length;
  }

  get bytes(): number {
    return this.currentBytes;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Begin recording a command (e.g. on pointerdown / drag start).
   */
  begin(label: string, snapshot: readonly T[]): void {
    this.activeLabel = label;
    this.activeSnapshot = snapshot.map((x) => structuredClone(x));
  }

  /**
   * Commit the command (e.g. on pointerup / drag end).
   * Coalesces the whole interaction into one diff command.
   */
  commit(current: readonly T[]): Command<T> | null {
    if (!this.activeSnapshot || !this.activeLabel) {
      this.activeSnapshot = null;
      this.activeLabel = null;
      return null;
    }

    const cmd = diffCommand(this.activeLabel, this.activeSnapshot, current);
    this.activeSnapshot = null;
    this.activeLabel = null;

    if (!cmd) return null;

    this.pushCommand(cmd);
    return cmd;
  }

  /**
   * Cancel ongoing interaction (e.g. on Escape during drag).
   * Returns the original snapshot before the interaction started.
   */
  cancel(): readonly T[] | null {
    const snap = this.activeSnapshot;
    this.activeSnapshot = null;
    this.activeLabel = null;
    return snap;
  }

  /**
   * Directly push an already computed command (e.g. delete, duplicate).
   */
  pushCommand(cmd: Command<T>): void {
    this.undoStack.push(cmd);
    this.redoStack = []; // Redo history is cleared on any new edit
    this.currentBytes += cmd.bytes;

    this.enforceCaps();
  }

  /**
   * Revert the most recent command.
   */
  undo(current: readonly T[]): T[] | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;

    this.currentBytes -= cmd.bytes;
    this.redoStack.push(cmd);

    return undo(current, cmd);
  }

  /**
   * Re-apply the most recently undone command.
   */
  redo(current: readonly T[]): T[] | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;

    this.undoStack.push(cmd);
    this.currentBytes += cmd.bytes;

    return redo(current, cmd);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeLabel = null;
    this.activeSnapshot = null;
    this.currentBytes = 0;
  }

  private enforceCaps(): void {
    // Evict oldest commands if exceeding depth or byte cap
    while (this.undoStack.length > HISTORY_DEPTH || (this.currentBytes > HISTORY_BYTES && this.undoStack.length > 1)) {
      const evicted = this.undoStack.shift();
      if (evicted) {
        this.currentBytes -= evicted.bytes;
      }
    }
  }
}
