/**
 * Milestone safety copies of the hand-built track (C2).
 *
 * The dev server's `/api/backup-props` endpoint overwrites `track-props-latest.json` and keeps a
 * rolling 30-file history, so on its own it can't protect the owner's track from a bad save. Every
 * time a save carries more props than the biggest safety copy on disk, this writes
 * `user_safety_backup/track-props-<COUNT>-props-safeguard.json`.
 *
 * Safety copies are add-only: a copy is written with the exclusive `wx` flag and never replaces or
 * deletes an existing file.
 */
import fs from 'node:fs';
import path from 'node:path';

const SAFETY_NAME = /^track-props-(\d+)-props-safeguard\.json$/;

export const safetyCopyName = (count: number): string => `track-props-${count}-props-safeguard.json`;

/** The prop count of the biggest numbered safety copy in `dir`, or 0 when there is none. */
export function highestSafetyCount(dir: string): number {
  let highest = 0;
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    const match = SAFETY_NAME.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

export interface SafetyCopyResult {
  written: boolean;
  /** The biggest safety count on disk after this call. */
  watermark: number;
  file?: string;
}

/**
 * Writes a safety copy of `payload` when its prop count beats every existing safety copy.
 * `payload` is written exactly as the latest file is, so a copy can be restored by hand.
 */
export function writeSafetyCopyIfGrown(dir: string, payload: { props: unknown[] }): SafetyCopyResult {
  const count = payload.props.length;
  const watermark = highestSafetyCount(dir);
  if (count <= watermark) return { written: false, watermark };
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safetyCopyName(count));
  try {
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), { encoding: 'utf-8', flag: 'wx' });
  } catch (error) {
    // Another save got there first: the existing copy stays as it is.
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { written: false, watermark: count, file };
    throw error;
  }
  return { written: true, watermark: count, file };
}
