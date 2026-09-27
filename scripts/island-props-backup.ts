/**
 * ISLAND-ROUTE: the island's disk backup, served by the dev server (vite.config.ts) under
 * `/api/backup-island-props` and `/api/restore-island-backup`.
 *
 * Everything is written inside one folder, `backups/island/`: `island-props-latest.json` plus a
 * `history/` of up to 30 snapshots. It never touches `backups/props/` (the owner's classic track,
 * its latest file and its safety copies).
 */
import fs from 'fs';
import path from 'path';

export const ISLAND_LATEST_FILE = 'island-props-latest.json';
const HISTORY_KEEP = 30;
/**
 * Below this many saved props the shrink guard is off: on a small island, deleting a few props is an
 * ordinary edit, and refusing it would bring the deleted props back from disk on the next load.
 */
export const SHRINK_GUARD_MIN = 20;

export interface IslandSaveResult { success: boolean; count: number; timestamp?: number; reason?: string }

/** Saves one island prop list. Refuses a list much smaller than a large saved one (a wiped scene). */
export function saveIslandBackup(dir: string, data: unknown): IslandSaveResult {
  const body = data as { props?: unknown; timestamp?: unknown } | unknown[];
  const props = Array.isArray(body) ? body : body?.props;
  if (!Array.isArray(props)) throw new Error('no props');
  const timestamp = !Array.isArray(body) && typeof body?.timestamp === 'number' ? body.timestamp : Date.now();
  const historyDir = path.resolve(dir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });

  const latestFile = path.resolve(dir, ISLAND_LATEST_FILE);
  if (fs.existsSync(latestFile)) {
    try {
      const existingCount = JSON.parse(fs.readFileSync(latestFile, 'utf-8'))?.props?.length || 0;
      if (existingCount >= SHRINK_GUARD_MIN && props.length < existingCount * 0.75) {
        return { success: false, count: existingCount, reason: `Refusing to overwrite ${existingCount} island props with ${props.length}` };
      }
    } catch {}
  }

  const payload = { course: 'basalt', timestamp, count: props.length, updatedAt: new Date(timestamp).toISOString(), props };
  const text = JSON.stringify(payload, null, 2);
  fs.writeFileSync(latestFile, text, 'utf-8');
  if (props.length > 0) {
    fs.writeFileSync(path.resolve(historyDir, `island-props-${timestamp}.json`), text, 'utf-8');
    const files = fs.readdirSync(historyDir).filter((f) => f.endsWith('.json')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - HISTORY_KEEP))) {
      try { fs.unlinkSync(path.resolve(historyDir, f)); } catch {}
    }
  }
  return { success: true, count: props.length, timestamp };
}

/** The latest island save and the newest 20 history entries. */
export function listIslandBackups(dir: string): { latest: unknown; history: unknown[] } {
  const latestFile = path.resolve(dir, ISLAND_LATEST_FILE);
  const latest = fs.existsSync(latestFile) ? JSON.parse(fs.readFileSync(latestFile, 'utf-8')) : null;
  const historyDir = path.resolve(dir, 'history');
  const files = fs.existsSync(historyDir) ? fs.readdirSync(historyDir).filter((f) => f.endsWith('.json')).sort().reverse() : [];
  const history = files.slice(0, 20).map((filename) => {
    try {
      const c = JSON.parse(fs.readFileSync(path.resolve(historyDir, filename), 'utf-8'));
      return { filename, count: c.count || c.props?.length || 0, timestamp: c.timestamp || 0, updatedAt: c.updatedAt || '', course: 'basalt' };
    } catch {
      return { filename, count: 0, timestamp: 0, updatedAt: '', course: 'basalt' };
    }
  });
  return { latest, history };
}

/** One saved island file by name (the latest or a history entry), or null. Names never leave the folder. */
export function readIslandBackup(dir: string, filename: string): unknown | null {
  const safe = path.basename(String(filename));
  const target = safe === ISLAND_LATEST_FILE ? path.resolve(dir, safe) : path.resolve(dir, 'history', safe);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf-8')) : null;
}
