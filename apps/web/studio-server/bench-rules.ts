/**
 * The asset bench's rules, as pure checks: the redo steps, the asset ids, a description, a connection, the names of
 * the archive folders, and the redaction of a secret from any text the Studio shows. No I/O, so the unit tests run
 * without a disk. Used by bench.ts (the dev endpoint) and by the Studio's form checks.
 */

/** The redo steps the endpoint runs, one job at a time. */
export const STEPS = ['images', 'model', 'post', 'pack'] as const;
export type Step = (typeof STEPS)[number];

/** Asset ids: the same shape the write-back allows (lowercase letters, digits, dashes). */
export const BENCH_ID = /^[a-z0-9-]{1,40}$/;

/** An archive folder name: `<yyyymmdd>-<hhmmss>[-n]-<step>`, the step being one that archives (see bench.ts). */
export const ARCHIVE = /^\d{8}-\d{6}(-\d{1,2})?-(images|model|post|revert)$/;

/** The files a Redo can show (served by the file route): images and models. Nothing else is readable. */
export const FILE_NAMES = ['source.png', 'source.png.json', 'low.glb', 'mid.glb', 'high.glb', 'norm.glb', 'model-local.glb', 'model.glb', 'model-mv.glb'] as const;
/** What an archive may hold: the files above plus the `approved` marker of an image. */
export const ARCHIVABLE = [...FILE_NAMES, 'approved'] as const;

export const SUBJECT_MIN = 20;
export const SUBJECT_MAX = 1500;

export type Check = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly why: string };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** A description of an asset: plain text, trimmed, a usable length. Line breaks are kept. */
export function checkSubject(v: unknown): Check {
  if (typeof v !== 'string') return { ok: false, why: 'the description must be text' };
  const t = v.replace(/\r\n/g, '\n').trim();
  if (t.length < SUBJECT_MIN) return { ok: false, why: `the description needs at least ${SUBJECT_MIN} characters` };
  if (t.length > SUBJECT_MAX) return { ok: false, why: `the description is over ${SUBJECT_MAX} characters` };
  if (CONTROL.test(t)) return { ok: false, why: 'the description has a control character' };
  return { ok: true, value: t };
}

/** The connection URL of the owner's 3D pipeline: http or https, a host, no credentials, no query or fragment. */
export function checkUrl(v: unknown): Check {
  if (typeof v !== 'string' || v.length > 200) return { ok: false, why: 'the URL must be text under 200 characters' };
  let u: URL;
  try { u = new URL(v.trim()); } catch { return { ok: false, why: 'the URL is not valid' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, why: 'the URL must start with http:// or https://' };
  if (u.username || u.password) return { ok: false, why: 'the URL must not carry a login' };
  if (u.search || u.hash) return { ok: false, why: 'the URL must not carry a query or a fragment' };
  return { ok: true, value: `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}` };
}

/** A bearer token: one line, printable, a sane length. It is never echoed back by any route. */
export function checkToken(v: unknown): Check {
  if (typeof v !== 'string') return { ok: false, why: 'the token must be text' };
  const t = v.trim();
  if (t.length < 8 || t.length > 200) return { ok: false, why: 'the token must be 8 to 200 characters' };
  if (/\s/.test(t) || CONTROL.test(t)) return { ok: false, why: 'the token must be one line with no spaces' };
  return { ok: true, value: t };
}

/** The host a URL points at, for display ("192.168.0.9:8082"). Never a path or a token. */
export function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}

/** Replaces every occurrence of each secret in a text with a mark, so a log line never carries one. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of secrets) if (s.length >= 4) out = out.split(s).join('[redacted]');
  return out;
}

/** The fields of a health answer the Studio shows. Anything else in the answer is dropped. */
export function summarizeHealth(v: unknown): Record<string, string | number | null> {
  const src = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  const out: Record<string, string | number | null> = {};
  for (const k of ['queued', 'busy', 'vram_free_gb', 'ram_free_gb']) {
    const x = src[k];
    if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
  }
  const stage = src.stage;
  out.stage = typeof stage === 'string' ? stage.slice(0, 60) : null;
  return out;
}

export const isStep = (v: string): v is Step => (STEPS as readonly string[]).includes(v);
