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

export const ROUTE = '/__studio/data/';
export const MAX_BODY = 2 * 1024 * 1024;
/** A name must match this before it is looked up: lowercase letters, digits and dashes only. */
export const NAME = /^[a-z0-9-]+$/;

/** The writable files. Adding one here is the only way to make a new name writable. */
export const ALLOWED: Readonly<Record<string, { readonly file: string; readonly kind: 'tweaks' }>> = {
  'asset-tweaks': { file: 'asset-tweaks.json', kind: 'tweaks' },
};

export interface StudioPaths {
  /** apps/web/src/studio-data: where the files live. */
  readonly dataDir: string;
  /** apps/web/src/assets/gen/registry.json: the asset ids that exist. */
  readonly registryFile: string;
}

export interface Request {
  readonly method: string;
  /** The path with its query string removed. */
  readonly path: string;
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly contentType: string | undefined;
  /** Reads the body, or rejects with a BodyTooLarge error past MAX_BODY bytes. */
  readonly readBody: () => Promise<string>;
}

export interface Reply { readonly status: number; readonly body: string }

export class BodyTooLarge extends Error {}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value) });

function registryIds(file: string): Set<string> {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  return new Set(Object.keys(data));
}

/** The reply for one request, or null when the path is not the Studio's. */
export async function handleStudioRequest(req: Request, paths: StudioPaths): Promise<Reply | null> {
  if (!req.path.startsWith(ROUTE)) return null;
  const name = req.path.slice(ROUTE.length);
  if (!NAME.test(name)) return json(404, { ok: false, why: 'no such studio file' });
  const entry =Object.prototype.hasOwnProperty.call(ALLOWED, name) ? ALLOWED[name] : undefined;
  if (!entry) return json(404, { ok: false, why: 'no such studio file' });
  if (!LOCAL.test(req.host ?? '')) return json(403, { ok: false, why: 'studio writes are local only' });
  if (req.origin !== undefined && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.origin)) {
    return json(403, { ok: false, why: 'cross-site request refused' });
  }
  const file = path.join(paths.dataDir, entry.file);

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
    text = await req.readBody();
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
  const check = checkTweaks(data, registryIds(paths.registryFile));
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
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, file);
  return json(200, { ok: true, file: entry.file, assets: Object.keys(out).length });
}
