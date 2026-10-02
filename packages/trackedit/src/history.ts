/**
 * Undo / redo history for drafts.
 *
 * Steps are stored as immutable drafts, so history can never be corrupted by a
 * caller mutating a state it was handed. Deep-equal pushes are ignored, undoing
 * then pushing drops the redo tail, and the oldest steps fall off the front
 * beyond `limit`.
 */

import { isNum } from './math';
import type { TrackDraft } from './types';

export interface DraftHistory {
  /** Current draft. */
  readonly state: TrackDraft;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Labels of the applied steps, oldest first. */
  readonly labels: readonly string[];
  /** Apply `next`; ignored when it is deep-equal to the current state. */
  push(next: TrackDraft, label: string): void;
  /** Step back, returning the label of the undone step (`null` if impossible). */
  undo(): string | null;
  /** Step forward, returning the label of the reapplied step (`null` if impossible). */
  redo(): string | null;
  /** Replace every history with `d` as the initial state. */
  reset(d: TrackDraft): void;
}

interface Step {
  draft: TrackDraft;
  label: string;
}

function sameDraft(a: TrackDraft, b: TrackDraft): boolean {
  if (a === b) return true;
  if (a.closed !== b.closed || a.width !== b.width) return false;
  if (a.points.length !== b.points.length) return false;
  return a.points.every((p, i) => {
    const q = b.points[i];
    if (!q) return false;
    return p.x === q.x && p.z === q.z && p.width === q.width;
  });
}

export function createDraftHistory(initial: TrackDraft, limit = 100): DraftHistory {
  const cap = isNum(limit) && limit >= 1 ? Math.floor(limit) : 1;
  let steps: Step[] = [{ draft: initial, label: '' }];
  let cursor = 0;

  const trim = (): void => {
    while (steps.length - 1 > cap) {
      steps.shift();
      cursor -= 1;
    }
  };

  const history: DraftHistory = {
    get state(): TrackDraft {
      return (steps[cursor] ?? steps[0]!).draft;
    },
    get canUndo(): boolean {
      return cursor > 0;
    },
    get canRedo(): boolean {
      return cursor < steps.length - 1;
    },
    get labels(): readonly string[] {
      return steps.slice(1).map((s) => s.label);
    },
    push(next: TrackDraft, label: string): void {
      if (sameDraft(next, history.state)) return;
      steps = steps.slice(0, cursor + 1);
      steps.push({ draft: next, label });
      cursor = steps.length - 1;
      trim();
    },
    undo(): string | null {
      if (cursor === 0) return null;
      const label = (steps[cursor] ?? steps[0]!).label;
      cursor -= 1;
      return label;
    },
    redo(): string | null {
      if (cursor >= steps.length - 1) return null;
      cursor += 1;
      return (steps[cursor] ?? steps[0]!).label;
    },
    reset(d: TrackDraft): void {
      steps = [{ draft: d, label: '' }];
      cursor = 0;
    },
  };
  return history;
}
