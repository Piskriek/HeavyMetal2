/**
 * The Studio's write-back endpoint. DEV ONLY: the Vite plugin (vite-plugin.ts) mounts it on the dev server, and the
 * production build has no route at all, so the Studio opens read-only there.
 *
 *   GET  /__studio/data/<name>  the file as JSON ({} when it does not exist yet)
 *   POST /__studio/data/<name>  replace the file with the body (JSON, under 2 MB, checked against the schema)
 *
 * Security boundary: <name> is matched against an allowlist (ALLOWED) before anything touches the disk. No client path
 * reaches the filesystem. Requests must come from localhost (Host and Origin), a POST must be application/json (a
 * non-simple request, so a web page cannot send one cross-site without a preflight this server does not grant), and
 * the file is written to a temp name and renamed into place.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkTweaks, FIELDS, isNeutral } from './tweak-schema';
import { checkSceneLayouts } from './scene-layout-schema';
import { checkFixFlags, checkSnappedSockets } from '../src/studio/flag-and-socket-schema';

export const ROUTE = '/__studio/data/';
export const MAX_BODY = 2 * 1024 * 1024;
/** A name must match this before it is looked up: lowercase letters, digits and dashes only. */
export const NAME = /^[a-z0-9-]+$/;

export type WriteKind = 'tweaks' | 'layouts' | 'levels' | 'asset-flags' | 'sockets' | 'monster-tweaks';

/** The writable files. Adding one here is the only way to make a new name writable. */
export const ALLOWED: Readonly<Record<string, { readonly file: string; readonly kind: WriteKind }>> = {
  'asset-tweaks': { file: 'asset-tweaks.json', kind: 'tweaks' },
  'scene-layouts': { file: 'scene-layouts.json', kind: 'layouts' },
  'levels': { file: 'levels.json', kind: 'levels' },
  'asset-flags': { file: 'assets.json', kind: 'asset-flags' },
  'sockets': { file: 'sockets.json', kind: 'sockets' },
  'monster-tweaks': { file: 'monster-tweaks.json', kind: 'monster-tweaks' },
};

export interface StudioPaths {
  /** apps/web/src/studio-data: where the files live. */
  readonly dataDir: string;
  /** apps/web/src/assets/gen/registry.json: the asset ids that exist. */
  readonly registryFile: string;
  /** apps/web/public/audio/levels.json: audio levels. */
  readonly audioLevelsFile?: string;
  /** docs/runworld/assets.json: the asset pipeline manifest. */
  readonly manifestFile?: string;
}

export interface Request {
  readonly method: string;
  /** The path with its query string removed. */
  readonly path: string;
  /** The query string's parameters (an agent's poll carries its pairing key this way). */
  readonly query?: Readonly<Record<string, string>>;
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  /** Reads the body, or rejects with a BodyTooLarge error past `max` bytes. */
  readonly readBody: (max: number) => Promise<string>;
}

/** A reply: JSON text by default; `type` and a byte body for the files the bench serves. */
export interface Reply { readonly status: number; readonly body: string | Uint8Array; readonly type?: string }

export class BodyTooLarge extends Error {}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value) });

/** The refusal for a request that did not come from this machine, or null when it did. Shared by every Studio route. */
export function localRefusal(req: Request): Reply | null {
  if (!LOCAL.test(req.host ?? '')) return json(403, { ok: false, why: 'studio writes are local only' });
  if (req.origin !== undefined && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.origin)) {
    return json(403, { ok: false, why: 'cross-site request refused' });
  }
  return null;
}

function registryIds(file: string): Set<string> {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  return new Set(Object.keys(data));
}

function writeAtomic(file: string, content: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function resolveFilePath(entry: { readonly file: string; readonly kind: WriteKind }, paths: StudioPaths): string {
  if (entry.kind === 'levels') {
    return paths.audioLevelsFile ?? path.resolve(paths.dataDir, '../public/audio/levels.json');
  }
  if (entry.kind === 'asset-flags') {
    return paths.manifestFile ?? path.resolve(paths.dataDir, '../../../docs/runworld/assets.json');
  }
  return path.join(paths.dataDir, entry.file);
}

/** The reply for one request, or null when the path is not the Studio's. */
export async function handleStudioRequest(req: Request, paths: StudioPaths): Promise<Reply | null> {
  if (!req.path.startsWith(ROUTE)) return null;
  const name = req.path.slice(ROUTE.length);
  if (!NAME.test(name)) return json(404, { ok: false, why: 'no such studio file' });
  const entry = Object.prototype.hasOwnProperty.call(ALLOWED, name) ? ALLOWED[name] : undefined;
  if (!entry) return json(404, { ok: false, why: 'no such studio file' });
  const refused = localRefusal(req);
  if (refused) return refused;
  const file = resolveFilePath(entry, paths);

  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return { status: 200, body: '{}' };
    return { status: 200, body: fs.readFileSync(file, 'utf8') };
  }
  if (req.method !== 'POST') return json(405, { ok: false, why: 'use GET or POST' });
  if (!(req.contentType ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, { ok: false, why: 'send application/json' });
  }

  let text: string;
  try {
    text = await req.readBody(MAX_BODY);
  } catch (e) {
    if (e instanceof BodyTooLarge) return json(413, { ok: false, why: 'the file is over 2 MB' });
    throw e;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return json(422, { ok: false, why: 'the body is not valid JSON' });
  }
  const ids = registryIds(paths.registryFile);

  if (entry.kind === 'tweaks') {
    const check = checkTweaks(data, ids);
    if (!check.ok) return json(422, { ok: false, why: check.why });

    // canonical form: sorted asset ids, no empty entries, two-space indent, one trailing newline
    const out: Record<string, unknown> = {};
    for (const id of Object.keys(check.value).sort()) {
      const fields = (check.value[id] ?? {}) as Record<string, unknown>;
      const kept: Record<string, unknown> = {};
      for (const f of FIELDS) {
        const v = fields[f.key];
        if (v !== undefined && !isNeutral(f, v)) kept[f.key] = v;
      }
      if (Object.keys(kept).length > 0) out[id] = kept;
    }
    const body = `${JSON.stringify(out, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, assets: Object.keys(out).length });
  }

  if (entry.kind === 'layouts') {
    const check = checkSceneLayouts(data, ids);
    if (!check.ok) return json(422, { ok: false, why: check.why });

    const body = `${JSON.stringify(check.value, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, layouts: Object.keys(check.value).length });
  }

  if (entry.kind === 'levels') {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json(422, { ok: false, why: 'levels must be an object' });
    }
    const rawObj = data as Record<string, unknown>;
    const levelsMap = 'levels' in rawObj && typeof rawObj['levels'] === 'object' && rawObj['levels'] !== null
      ? (rawObj['levels'] as Record<string, unknown>)
      : rawObj;

    for (const [id, val] of Object.entries(levelsMap)) {
      if (!val || typeof val !== 'object' || typeof (val as Record<string, unknown>)['gain'] !== 'number') {
        return json(422, { ok: false, why: `audio level for "${id}" must contain a numeric gain` });
      }
    }

    const outDoc = typeof rawObj['about'] === 'string'
      ? { about: rawObj['about'], levels: levelsMap }
      : { levels: levelsMap };

    const body = `${JSON.stringify(outDoc, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, levels: Object.keys(levelsMap).length });
  }

  if (entry.kind === 'asset-flags') {
    const check = checkFixFlags(data, ids);
    if (!check.ok) return json(422, { ok: false, why: check.why });

    if (!fs.existsSync(file)) return json(404, { ok: false, why: 'assets.json manifest file not found' });
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { assets: Array<Record<string, unknown>> };
    if (!Array.isArray(manifest.assets)) {
      return json(422, { ok: false, why: 'manifest assets must be an array' });
    }

    let updated = 0;
    for (const a of manifest.assets) {
      const assetId = typeof a['id'] === 'string' ? a['id'] : '';
      const patch = check.value[assetId];
      if (!patch) continue;

      if (patch.fix !== undefined) {
        if (patch.fix.length > 0) a['fix'] = [...patch.fix];
        else delete a['fix'];
      }
      if (patch.reach !== undefined) a['reach'] = patch.reach;
      if (patch.hold !== undefined) {
        if (patch.hold) a['hold'] = true;
        else delete a['hold'];
      }
      if (patch.lumOk !== undefined) {
        if (patch.lumOk) a['lumOk'] = true;
        else delete a['lumOk'];
      }
      updated++;
    }

    const body = `${JSON.stringify(manifest, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, updated });
  }

  if (entry.kind === 'sockets') {
    const check = checkSnappedSockets(data, ids);
    if (!check.ok) return json(422, { ok: false, why: check.why });

    const body = `${JSON.stringify(check.value, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, assets: Object.keys(check.value).length });
  }

  if (entry.kind === 'monster-tweaks') {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json(422, { ok: false, why: 'monster-tweaks must be an object keyed by skin id' });
    }
    const record = data as Record<string, unknown>;
    for (const [skinId, val] of Object.entries(record)) {
      if (
        !val ||
        typeof val !== 'object' ||
        typeof (val as Record<string, unknown>)['remapStrength'] !== 'number' ||
        (val as { remapStrength: number }).remapStrength < 0 ||
        (val as { remapStrength: number }).remapStrength > 1
      ) {
        return json(422, { ok: false, why: `monster "${skinId}" must have remapStrength between 0 and 1` });
      }
    }

    const body = `${JSON.stringify(data, null, 2)}\n`;
    writeAtomic(file, body);
    return json(200, { ok: true, file: entry.file, monsters: Object.keys(record).length });
  }

  return json(400, { ok: false, why: 'unsupported write kind' });
}

