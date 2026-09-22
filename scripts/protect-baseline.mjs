#!/usr/bin/env node
/**
 * scripts/protect-baseline.mjs
 *
 * Read-only safeguard around the user-authored *protected data* of this project: the
 * hand-built 3D track decorations (the "decoration baseline") that the Track Builder
 * writes to `backups/props/` through the Vite dev-server middleware and mirrors into
 * browser `localStorage`.
 *
 * What this tool guarantees
 *   - It never writes inside the protected directory (`backups/props/**`) and never
 *     restores anything automatically. Reads only, apart from its own snapshot output.
 *   - It rejects path escapes, absolute paths and unexpected symlinks.
 *   - It hashes the original bytes before touching anything else.
 *   - It creates an *exclusive* (never overwriting) timestamped snapshot directory
 *     holding the original bytes plus a manifest.
 *   - It reads the snapshot back and compares the hashes byte-for-byte.
 *   - It verifies a second (recovery) copy when one is available or was authorised
 *     with `--recovery`.
 *   - It records the prop count and IDs as *observations* carrying an explicit
 *     advisory flag. They are not runtime constants and must never be compiled into
 *     the game or asserted as a permanent expectation.
 *
 * Usage:
 *   node scripts/protect-baseline.mjs inventory [--json]
 *   node scripts/protect-baseline.mjs snapshot  [--source <path>] [--out <dir>] [--label <name>]
 *                                               [--recovery <path>]... [--now <iso>] [--dry-run]
 *                                               [--allow-symlink-source] [--allow-external-source]
 *                                               [--strict] [--json]
 *   node scripts/protect-baseline.mjs verify    [--snapshot <dir>] [--recovery <path>]...
 *                                               [--no-source-check] [--json]
 *
 * Exit codes: 0 success, 1 a check failed or the request was blocked, 2 usage error.
 *
 * Tests: tests/protect-baseline.test.ts (temporary fixtures, run through scripts/check.mjs)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const MANIFEST_SCHEMA = 'hm2.baseline-manifest/v1';
export const TOOL_NAME = 'scripts/protect-baseline.mjs';
export const TOOL_VERSION = '1.0.0';

/**
 * Fixed policy. `protectedRoots` are never written to by this tool, and `knownBaseline`
 * records where the protected data is *expected*. Both are paths relative to the repo
 * root; none of them is a promise that the file exists (see `inventory`).
 */
export const POLICY = {
  protectedRoots: ['backups/props'],
  knownBaseline: [
    { id: 'decoration-baseline', role: 'primary-disk-mirror', path: 'backups/props/track-props-latest.json' },
    { id: 'decoration-starter-backup', role: 'starter-preset-mirror', path: 'backups/props/track-props-default.json' },
    { id: 'decoration-starter-shipped', role: 'starter-preset-shipped', path: 'public/presets/track-props-default.json' },
  ],
  localStorageKeys: {
    working: 'hm2-3d-track-props',
    latestBackup: 'hm2-3d-track-props-backup-latest',
    historyBackup: 'hm2-3d-track-props-backup-history',
  },
  recoveryDirs: ['backups/props/user_safety_backup', 'backups/props/history'],
  defaultOutDir: 'baseline/snapshots',
};

/** Typed failure so callers and tests can branch on a stable code. */
export class BaselineError extends Error {
  constructor(code, message, detail = undefined) {
    super(message);
    this.name = 'BaselineError';
    this.code = code;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

export function repoRoot() {
  return path.resolve(fileURLToPath(new URL('..', import.meta.url)));
}

export function toRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

/** Rejects empty, absolute and escaping relative paths. Returns normalized posix form. */
export function assertRelativeSafe(input, { label = 'path' } = {}) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new BaselineError('E_PATH_EMPTY', `${label} is empty.`);
  }
  if (input.includes('\0')) {
    throw new BaselineError('E_PATH_NUL', `${label} contains a NUL byte.`);
  }
  if (path.isAbsolute(input) || /^[A-Za-z]:[\\/]/.test(input)) {
    throw new BaselineError('E_PATH_ABSOLUTE', `${label} must be a repo-relative path, got an absolute path: ${input}`);
  }
  const normalized = path.posix.normalize(input.split(path.sep).join('/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new BaselineError('E_PATH_ESCAPE', `${label} escapes the repository root: ${input}`);
  }
  if (/^[A-Za-z0-9._-]*$/.test(normalized) === false && normalized.includes('..')) {
    throw new BaselineError('E_PATH_ESCAPE', `${label} contains a traversal segment: ${input}`);
  }
  return normalized;
}

/** Asserts `absolute` is inside (or equal to) `root`. */
export function assertInside(root, absolute, { label = 'path' } = {}) {
  const rel = path.relative(root, absolute);
  const inside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (!inside) {
    throw new BaselineError('E_PATH_ESCAPE', `${label} escapes ${root}: ${absolute}`);
  }
  return rel;
}

/**
 * Resolves a repo-relative path while walking every component with `lstat`, so a
 * symlinked file *or* a symlinked directory component is detected instead of silently
 * followed. Symlinks are refused unless `allowSymlinks` is set, and even then the link
 * target must stay inside the root.
 */
export function resolveSafe(root, input, { allowSymlinks = false, allowExternal = false, label = 'path' } = {}) {
  const normalized = assertRelativeSafe(input, { label });
  const abs = path.resolve(root, normalized);
  if (!allowExternal) assertInside(root, abs, { label });

  const parts = normalized.split('/');
  const symlinks = [];
  let cursor = root;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { rel: normalized, abs, real: null, exists: false, kind: i < parts.length - 1 ? 'directory' : 'file', symlinks };
      }
      throw new BaselineError('E_STAT', `${label} could not be inspected at ${toRelative(root, cursor)}: ${error.message}`);
    }
    if (stat.isSymbolicLink()) {
      let target = null;
      try {
        target = fs.realpathSync(cursor);
      } catch {
        target = null;
      }
      symlinks.push({ component: toRelative(root, cursor), target });
      if (!allowSymlinks) {
        throw new BaselineError(
          'E_SYMLINK',
          `${label} traverses a symlink at "${toRelative(root, cursor)}"; refusing to follow it. Pass --allow-symlink-source only after checking the target.`,
          { component: toRelative(root, cursor), target },
        );
      }
      if (target === null) {
        throw new BaselineError('E_SYMLINK_BROKEN', `${label} traverses a broken symlink at "${toRelative(root, cursor)}".`);
      }
      if (!allowExternal) assertInside(root, target, { label: `${label} symlink target` });
    }
  }

  const real = fs.realpathSync(abs);
  if (!allowExternal) assertInside(root, real, { label: `${label} real path` });
  return { rel: normalized, abs, real, exists: true, kind: fs.statSync(abs).isDirectory() ? 'directory' : 'file', symlinks };
}

/** Refuses any write target inside a protected root. */
export function assertNotProtected(root, absolute, { label = 'path' } = {}) {
  const rel = path.relative(root, absolute).split(path.sep).join('/');
  for (const protectedRoot of POLICY.protectedRoots) {
    if (rel === protectedRoot || rel.startsWith(`${protectedRoot}/`)) {
      throw new BaselineError(
        'E_PROTECTED_WRITE',
        `${label} points inside the protected directory "${protectedRoot}" — this tool never writes there.`,
        { protectedRoot, requested: rel },
      );
    }
  }
  return rel;
}

export function sanitizeLabel(input) {
  const label = String(input ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '-');
  if (label === '' || label === '.' || label === '..') {
    throw new BaselineError('E_LABEL', `Label "${input}" is not usable; use letters, digits, dot, dash or underscore.`);
  }
  return label.slice(0, 64);
}

// ---------------------------------------------------------------------------
// Hashing and observation
// ---------------------------------------------------------------------------

export function hashBytes(bytes) {
  return { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

export function hashFile(absolute) {
  return hashBytes(fs.readFileSync(absolute));
}

/**
 * Parses a decoration file and returns *observations*. The `advisory` flag and the
 * `note` field exist so nobody mistakes these numbers for runtime constants: the
 * decorated track legitimately changes as the user edits it.
 */
export function observeDecorationSet(bytes, { label = 'baseline' } = {}) {
  let data;
  try {
    data = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new BaselineError('E_NOT_JSON', `${label} is not valid JSON: ${error.message}`);
  }
  const props = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray(data.props) ? data.props : null;
  if (!props) {
    throw new BaselineError('E_SHAPE', `${label} is neither an array of props nor an object with a "props" array.`);
  }
  if (props.length === 0) {
    throw new BaselineError(
      'E_EMPTY',
      `${label} contains zero props. An empty set is never treated as a baseline (the dev server refuses that overwrite too).`,
    );
  }
  const ids = props.map((prop) => (prop && typeof prop.id === 'string' && prop.id !== '' ? prop.id : null));
  const missingIds = ids.filter((id) => id === null).length;
  const seen = new Set();
  const duplicateIds = new Set();
  for (const id of ids) {
    if (id === null) continue;
    if (seen.has(id)) duplicateIds.add(id);
    seen.add(id);
  }
  const propTypes = new Set();
  for (const prop of props) {
    if (prop && typeof prop.type === 'string') propTypes.add(prop.type);
  }
  const idDigest = crypto.createHash('sha256').update(ids.map((id) => id ?? '<missing>').join('\n')).digest('hex');
  return {
    advisory: true,
    note: 'Observation only. Counts and IDs describe the bytes at hash time; never hard-code them as runtime constants.',
    container: Array.isArray(data) ? 'array' : 'props',
    count: props.length,
    uniqueIds: seen.size,
    missingIds,
    duplicateIds: [...duplicateIds],
    propTypeCount: propTypes.size,
    course: typeof data?.course === 'string' ? data.course : null,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
    timestamp: Number.isFinite(data?.timestamp) ? data.timestamp : null,
    idDigest,
    observedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Recovery copies
// ---------------------------------------------------------------------------

export function listRecoveryCandidates(root) {
  const found = [];
  for (const dir of POLICY.recoveryDirs) {
    const absolute = path.join(root, dir);
    let entries = [];
    try {
      entries = fs.readdirSync(absolute, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const rel = toRelative(root, path.join(absolute, entry.name));
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(path.join(absolute, entry.name)).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      found.push({ path: rel, mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function describeRecovery(absolute, expected) {
  let bytes;
  try {
    bytes = fs.readFileSync(absolute);
  } catch (error) {
    return { status: 'unreadable', error: error.message };
  }
  const hash = hashBytes(bytes);
  const matches = hash.sha256 === expected.sha256 && hash.bytes === expected.bytes;
  if (matches) return { status: 'match', sha256: hash.sha256, bytes: hash.bytes, matchesBytes: true };
  let observation = null;
  try {
    observation = observeDecorationSet(bytes, { label: path.basename(absolute) });
  } catch (error) {
    observation = { error: error.code ?? error.message };
  }
  return {
    status: 'mismatch',
    sha256: hash.sha256,
    bytes: hash.bytes,
    matchesBytes: false,
    observed: observation
      ? { count: observation.count ?? null, uniqueIds: observation.uniqueIds ?? null, error: observation.error ?? null }
      : null,
  };
}

export function verifyRecoveryCopies(root, expected, paths, { label = 'recovery' } = {}) {
  const results = [];
  for (const rel of paths) {
    const resolved = resolveSafe(root, rel, { label: `${label} "${rel}"` });
    if (!resolved.exists) {
      results.push({ path: resolved.rel, status: 'missing' });
      continue;
    }
    results.push({ path: resolved.rel, ...describeRecovery(resolved.abs, expected) });
  }
  return results;
}

/** Picks the newest recovery candidate whose bytes match, else the newest overall. */
export function selectRecoveryCopy(root, expected) {
  const candidates = listRecoveryCandidates(root);
  if (candidates.length === 0) return { selected: null, considered: 0 };
  for (const candidate of candidates) {
    const absolute = path.join(root, candidate.path);
    try {
      const hash = hashBytes(fs.readFileSync(absolute));
      if (hash.sha256 === expected.sha256 && hash.bytes === expected.bytes) {
        return { selected: candidate.path, considered: candidates.length };
      }
    } catch {
      // Unreadable candidates are simply skipped; `verify` reports them individually.
    }
  }
  return { selected: candidates[0].path, considered: candidates.length };
}

// ---------------------------------------------------------------------------
// Snapshot / verify
// ---------------------------------------------------------------------------

export function timestampLabel(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function createSnapshot(options = {}) {
  const root = options.root ?? repoRoot();
  const outDirRel = assertRelativeSafe(options.outDir ?? POLICY.defaultOutDir, { label: '--out' });
  const outDirAbs = path.resolve(root, outDirRel);
  assertInside(root, outDirAbs, { label: '--out' });
  assertNotProtected(root, outDirAbs, { label: '--out' });

  const sourceRel = options.source ?? POLICY.knownBaseline[0].path;
  const source = resolveSafe(root, sourceRel, {
    allowSymlinks: Boolean(options.allowSymlinkSource),
    allowExternal: Boolean(options.allowExternalSource),
    label: '--source',
  });
  if (!source.exists) {
    throw new BaselineError('E_SOURCE_MISSING', `Protected source "${source.rel}" does not exist; nothing to snapshot.`, { source: source.rel });
  }
  if (source.kind === 'directory') {
    throw new BaselineError('E_SOURCE_KIND', `Protected source "${source.rel}" is a directory; this tool snapshots a single file.`);
  }

  // Hash the original bytes before anything else.
  const original = fs.readFileSync(source.abs);
  const sourceHash = hashBytes(original);
  const observation = observeDecorationSet(original, { label: source.rel });

  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new BaselineError('E_TIME', `--now "${options.now}" is not a valid date.`);
  }
  const label = sanitizeLabel(options.label ?? path.basename(source.rel).replace(/\.json$/i, ''));
  const snapshotName = `${label}-${timestampLabel(now)}`;
  const snapshotDir = path.join(outDirAbs, snapshotName);
  assertNotProtected(root, snapshotDir, { label: '--out (snapshot directory)' });

  const recoveryPaths = options.recovery?.length ? [...options.recovery] : [];
  const snapshotFile = path.join(snapshotDir, path.basename(source.rel));
  const plan = {
    root,
    source: { relative: source.rel, absolute: source.abs, ...sourceHash, mtime: fs.statSync(source.abs).mtime.toISOString() },
    outDir: toRelative(root, outDirAbs),
    snapshot: { directory: toRelative(root, snapshotDir), name: snapshotName, file: toRelative(root, snapshotFile) },
    recoveryRequested: recoveryPaths,
  };
  if (options.dryRun) {
    return { ok: true, dryRun: true, ...plan, observation, manifest: null };
  }

  // Exclusive creation: an existing directory aborts instead of merging or overwriting.
  try {
    fs.mkdirSync(outDirAbs, { recursive: true });
    assertInside(root, fs.realpathSync(outDirAbs), { label: '--out real path' });
    fs.mkdirSync(snapshotDir, { recursive: false });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new BaselineError('E_SNAPSHOT_EXISTS', `Snapshot directory already exists; refusing to reuse it: ${toRelative(root, snapshotDir)}`);
    }
    throw error;
  }

  fs.writeFileSync(snapshotFile, original, { flag: 'wx' }); // exclusive create, never truncate

  // Read the snapshot back and compare hashes byte-for-byte.
  const readBack = fs.readFileSync(snapshotFile);
  const readBackHash = hashBytes(readBack);
  const snapshotMatchesSource = readBackHash.sha256 === sourceHash.sha256 && readBackHash.bytes === sourceHash.bytes;

  const recoveryChecks = recoveryPaths.length
    ? verifyRecoveryCopies(root, sourceHash, recoveryPaths)
    : (() => {
        const { selected, considered } = selectRecoveryCopy(root, sourceHash);
        if (!selected) return [{ path: null, status: 'none-available', considered: 0 }];
        return verifyRecoveryCopies(root, sourceHash, [selected]).map((check) => ({ ...check, autoSelected: true, considered }));
      })();
  const verifiedRecovery = recoveryChecks.filter((check) => check.status === 'match').length;

  const manifest = {
    schema: MANIFEST_SCHEMA,
    tool: { name: TOOL_NAME, version: TOOL_VERSION, node: process.version },
    created_at: now.toISOString(),
    protected_roots: [...POLICY.protectedRoots],
    source: {
      path: source.rel,
      kind: 'original-bytes',
      sha256: sourceHash.sha256,
      bytes: sourceHash.bytes,
      mtime: plan.source.mtime,
      symlinks: source.symlinks,
    },
    snapshot: {
      directory: plan.snapshot.directory,
      file: plan.snapshot.file,
      sha256: readBackHash.sha256,
      bytes: readBackHash.bytes,
      matches_source: snapshotMatchesSource,
    },
    recovery: {
      requested: recoveryPaths,
      checks: recoveryChecks,
      verifiedMatches: verifiedRecovery,
      note: 'A copy on the same disk/tree is not an independent backup; verify a second authorised medium separately.',
    },
    observation,
  };
  fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

  const warnings = [];
  if (!snapshotMatchesSource) warnings.push('Snapshot bytes differ from the source bytes.');
  if (verifiedRecovery === 0) warnings.push('No recovery copy could be verified byte-for-byte.');
  const ok = snapshotMatchesSource && (!options.strict || verifiedRecovery > 0);

  return {
    ok,
    dryRun: false,
    ...plan,
    snapshot: { ...plan.snapshot, sha256: readBackHash.sha256, bytes: readBackHash.bytes, matchesSource: snapshotMatchesSource },
    recovery: recoveryChecks,
    verifiedRecovery,
    observation,
    warnings,
    manifest,
    manifestPath: path.join(plan.snapshot.directory, 'manifest.json'),
  };
}

export function findLatestSnapshot(root = repoRoot(), outDirRel = POLICY.defaultOutDir) {
  const outDirAbs = path.resolve(root, outDirRel);
  let entries = [];
  try {
    entries = fs.readdirSync(outDirAbs, { withFileTypes: true });
  } catch {
    return null;
  }
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const absolute = path.join(outDirAbs, entry.name);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(absolute).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { name: entry.name, relative: toRelative(root, absolute), mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dirs.length ? dirs[0].relative : null;
}

export function verifySnapshot(snapshotRelDir, options = {}) {
  const root = options.root ?? repoRoot();
  const snapshot = resolveSafe(root, snapshotRelDir, { label: '--snapshot' });
  if (!snapshot.exists || snapshot.kind !== 'directory') {
    throw new BaselineError('E_SNAPSHOT_MISSING', `Snapshot directory "${snapshot.rel}" does not exist.`);
  }
  const manifestPath = path.join(snapshot.abs, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new BaselineError('E_MANIFEST', `Could not read ${toRelative(root, manifestPath)}: ${error.message}`);
  }
  if (manifest.schema !== MANIFEST_SCHEMA) {
    throw new BaselineError('E_MANIFEST_SCHEMA', `Unsupported manifest schema "${manifest.schema}" (expected ${MANIFEST_SCHEMA}).`);
  }

  const checks = [];
  const snapshotFilePath = path.join(root, manifest.snapshot.file);
  let snapshotBytes = null;
  try {
    snapshotBytes = fs.readFileSync(snapshotFilePath);
    const hash = hashBytes(snapshotBytes);
    checks.push({
      name: 'snapshot-readable',
      ok: hash.sha256 === manifest.snapshot.sha256 && hash.bytes === manifest.snapshot.bytes,
      detail: `snapshot sha256 ${hash.sha256} (${hash.bytes} bytes) vs manifest ${manifest.snapshot.sha256} (${manifest.snapshot.bytes} bytes)`,
    });
  } catch (error) {
    checks.push({ name: 'snapshot-readable', ok: false, detail: `could not read ${manifest.snapshot.file}: ${error.message}` });
  }

  checks.push({
    name: 'manifest-internal-consistency',
    ok: manifest.snapshot.sha256 === manifest.source.sha256 && manifest.snapshot.bytes === manifest.source.bytes,
    detail: `snapshot ${manifest.snapshot.sha256} vs recorded source bytes ${manifest.source.sha256}`,
  });
  checks.push({
    name: 'read-back-match-recorded',
    ok: manifest.snapshot.matches_source === true,
    detail: `manifest recorded matches_source=${manifest.snapshot.matches_source}`,
  });

  const sourceResolved = (() => {
    try {
      return resolveSafe(root, manifest.source.path, { label: 'manifest source', allowExternal: options.allowExternalSource === true });
    } catch (error) {
      return { error };
    }
  })();

  if (options.checkSource !== false) {
    if (sourceResolved.error) {
      checks.push({ name: 'source-path-safe', ok: false, detail: sourceResolved.error.message });
    } else if (!sourceResolved.exists) {
      checks.push({
        name: 'source-unchanged',
        ok: false,
        detail: `source "${manifest.source.path}" is missing; the snapshot is currently the only verified copy of these bytes`,
      });
    } else {
      const current = hashFile(sourceResolved.abs);
      checks.push({
        name: 'source-unchanged',
        ok: current.sha256 === manifest.source.sha256 && current.bytes === manifest.source.bytes,
        detail: `current ${current.sha256} (${current.bytes} bytes) vs recorded ${manifest.source.sha256} (${manifest.source.bytes} bytes)`,
      });
    }
  }

  const recordedRecovery = (manifest.recovery?.checks ?? []).map((check) => check.path).filter(Boolean);
  const recoveryPaths = options.recovery?.length
    ? [...options.recovery]
    : manifest.recovery?.requested?.length
      ? [...manifest.recovery.requested]
      : recordedRecovery;
  if (recoveryPaths.length) {
    const results = verifyRecoveryCopies(root, { sha256: manifest.source.sha256, bytes: manifest.source.bytes }, recoveryPaths);
    for (const result of results) {
      checks.push({ name: `recovery:${result.path}`, ok: result.status === 'match', detail: `status ${result.status}` });
    }
  } else {
    checks.push({ name: 'recovery-listed', ok: false, detail: 'no recovery copy was authorised in the manifest (--recovery)' });
  }

  const failures = checks.filter((check) => !check.ok);
  return {
    ok: failures.length === 0,
    snapshot: snapshot.rel,
    manifestSchema: manifest.schema,
    source: { path: manifest.source.path, sha256: manifest.source.sha256, bytes: manifest.source.bytes, observation: manifest.observation },
    checks,
    warnings: checks.filter((check) => check.ok && check.name.startsWith('recovery')).length === 0 ? ['No recovery copy verified.'] : [],
  };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function inspectKnown(root = repoRoot()) {
  const entries = [];
  for (const known of POLICY.knownBaseline) {
    const record = { ...known, status: 'missing' };
    try {
      const resolved = resolveSafe(root, known.path, { label: known.path });
      if (!resolved.exists) {
        entries.push(record);
        continue;
      }
      const hash = hashFile(resolved.abs);
      record.status = 'present';
      record.sha256 = hash.sha256;
      record.bytes = hash.bytes;
      try {
        record.observation = observeDecorationSet(fs.readFileSync(resolved.abs), { label: known.path });
      } catch (error) {
        record.observation = { error: error.code ?? error.message };
      }
    } catch (error) {
      record.status = 'unsafe';
      record.error = `${error.code ?? 'error'}: ${error.message}`;
    }
    entries.push(record);
  }

  const recoveryCandidates = listRecoveryCandidates(root).map((candidate) => {
    const absolute = path.join(root, candidate.path);
    try {
      const hash = hashFile(absolute);
      let count = null;
      try {
        count = observeDecorationSet(fs.readFileSync(absolute), { label: candidate.path }).count;
      } catch {
        count = null;
      }
      return { ...candidate, sha256: hash.sha256, bytes: hash.bytes, count };
    } catch (error) {
      return { ...candidate, error: error.message };
    }
  });

  const primary = entries.find((entry) => entry.id === 'decoration-baseline');
  const matchedRecovery = primary?.sha256
    ? recoveryCandidates.filter((candidate) => candidate.sha256 === primary.sha256).map((candidate) => candidate.path)
    : [];

  return {
    root,
    generatedAt: new Date().toISOString(),
    protectedRoots: [...POLICY.protectedRoots],
    localStorageKeys: { ...POLICY.localStorageKeys },
    known: entries,
    recovery: {
      candidateCount: recoveryCandidates.length,
      dirs: [...POLICY.recoveryDirs],
      matchingPrimary: matchedRecovery,
      candidates: recoveryCandidates,
      independentMedium: false,
    },
    provenance: {
      authoritative: false,
      reason:
        'No user-authorised manifest or independent medium is available in this checkout: the live working copy lives in the browser profile (localStorage) and the on-disk copies have no signed provenance. Hashes below describe bytes that exist here; they do not certify that these are the user\'s original authored bytes.',
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function reportLine(text = '') {
  process.stdout.write(`${text}\n`);
}

function printInventory(report) {
  reportLine(`Baseline inventory @ ${report.root}`);
  reportLine(`Generated: ${report.generatedAt}`);
  reportLine(`Protected roots (never written by this tool): ${report.protectedRoots.join(', ')}`);
  reportLine(`Live working copy (browser, not on disk here): localStorage key ${report.localStorageKeys.working}`);
  reportLine('');
  reportLine('Known protected locations:');
  for (const entry of report.known) {
    if (entry.status === 'present') {
      const observation = entry.observation?.count !== undefined ? `${entry.observation.count} props observed` : 'observation unavailable';
      reportLine(`  [present] ${entry.path} (${entry.role})`);
      reportLine(`            sha256 ${entry.sha256} · ${entry.bytes} bytes · ${observation}`);
      if (entry.observation?.duplicateIds?.length) reportLine(`            duplicate IDs: ${entry.observation.duplicateIds.length}`);
    } else if (entry.status === 'missing') {
      reportLine(`  [MISSING] ${entry.path} (${entry.role})`);
    } else {
      reportLine(`  [unsafe ] ${entry.path} (${entry.role}) — ${entry.error}`);
    }
  }
  reportLine('');
  reportLine(`Recovery candidates: ${report.recovery.candidateCount} file(s) under ${report.recovery.dirs.join(', ')}`);
  if (report.recovery.matchingPrimary.length) {
    reportLine(`  byte-identical copies of the primary: ${report.recovery.matchingPrimary.join(', ')}`);
    reportLine('  note: same checkout/disk, so this is a convenience copy, not an independent backup.');
  } else {
    reportLine('  no byte-identical copy of the primary was found.');
  }
  reportLine('');
  reportLine('BLOCKER: authoritative provenance is NOT established.');
  reportLine(`  ${report.provenance.reason}`);
}

function printSnapshot(result) {
  if (result.dryRun) {
    reportLine(`DRY RUN — would snapshot ${result.source.relative} (${result.source.sha256}, ${result.source.bytes} bytes)`);
    reportLine(`  into ${result.snapshot.directory}/${path.basename(result.source.relative)}`);
    reportLine(`  observed ${result.observation.count} props (advisory only)`);
    return;
  }
  reportLine(`${result.ok ? 'OK' : 'FAILED'} — snapshot created`);
  reportLine(`  source      ${result.source.relative} sha256 ${result.source.sha256} (${result.source.bytes} bytes)`);
  reportLine(`  snapshot    ${result.snapshot.file} sha256 ${result.snapshot.sha256} (${result.snapshot.bytes} bytes)`);
  reportLine(`  read-back   ${result.snapshot.matchesSource ? 'byte-for-byte match' : 'MISMATCH'}`);
  reportLine(`  manifest    ${result.manifestPath}`);
  reportLine(`  observation ${result.observation.count} props, ${result.observation.uniqueIds} unique IDs (advisory, not a runtime constant)`);
  for (const check of result.recovery) {
    reportLine(`  recovery    ${check.path ?? '(none)'} → ${check.status}${check.autoSelected ? ' (auto-selected)' : ''}`);
  }
  for (const warning of result.warnings) reportLine(`  WARNING     ${warning}`);
}

function printVerify(result) {
  reportLine(`${result.ok ? 'OK' : 'FAILED'} — verify ${result.snapshot}`);
  reportLine(`  recorded source ${result.source.path} sha256 ${result.source.sha256} (${result.source.bytes} bytes)`);
  for (const check of result.checks) {
    reportLine(`  [${check.ok ? 'pass' : 'FAIL'}] ${check.name}: ${check.detail}`);
  }
  for (const warning of result.warnings) reportLine(`  WARNING     ${warning}`);
}

const USAGE = `Usage: node scripts/protect-baseline.mjs <command> [options]

Commands
  inventory   Report which protected locations exist, their hashes and observations. Read-only.
  snapshot    Create an exclusive timestamped snapshot + manifest of the protected file.
  verify      Re-hash a snapshot (and its recovery copy) against the recorded manifest.

Common options
  --root <dir>              Repository root to operate on (defaults to this repo).
  --json                    Print machine-readable JSON instead of prose.

snapshot options
  --source <path>           Protected file, repo-relative (default: ${POLICY.knownBaseline[0].path}).
  --out <dir>               Snapshot parent directory (default: ${POLICY.defaultOutDir}).
  --label <name>            Snapshot name prefix (default: source file name).
  --recovery <path>         Authorised second copy to verify; repeatable.
  --now <iso>               Timestamp to use (reproducible runs/tests).
  --dry-run                 Plan the snapshot without writing anything.
  --strict                  Fail when no recovery copy verifies.
  --allow-symlink-source    Permit a source that traverses a symlink (target must stay inside the root).
  --allow-external-source   Permit a source outside the repo root (still no write to it).

verify options
  --snapshot <dir>          Snapshot directory (default: newest under ${POLICY.defaultOutDir}).
  --recovery <path>         Recovery copy to re-verify; repeatable, defaults to the manifest list.
  --no-source-check         Do not compare the live source against the recorded hash.
`;

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    reportLine(USAGE);
    return command ? 0 : 2;
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: {
        root: { type: 'string' },
        json: { type: 'boolean', default: false },
        source: { type: 'string' },
        out: { type: 'string' },
        label: { type: 'string' },
        recovery: { type: 'string', multiple: true },
        now: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        'allow-symlink-source': { type: 'boolean', default: false },
        'allow-external-source': { type: 'boolean', default: false },
        snapshot: { type: 'string' },
        'no-source-check': { type: 'boolean', default: false },
      },
      allowPositionals: false,
    });
  } catch (error) {
    reportLine(`Usage error: ${error.message}`);
    reportLine(USAGE);
    return 2;
  }

  const root = parsed.values.root ? path.resolve(parsed.values.root) : repoRoot();

  try {
    if (command === 'inventory') {
      const report = inspectKnown(root);
      if (parsed.values.json) reportLine(JSON.stringify(report, null, 2));
      else printInventory(report);
      return 0;
    }

    if (command === 'snapshot') {
      const result = createSnapshot({
        root,
        source: parsed.values.source,
        outDir: parsed.values.out,
        label: parsed.values.label,
        recovery: parsed.values.recovery,
        now: parsed.values.now,
        dryRun: parsed.values['dry-run'],
        strict: parsed.values.strict,
        allowSymlinkSource: parsed.values['allow-symlink-source'],
        allowExternalSource: parsed.values['allow-external-source'],
      });
      if (parsed.values.json) reportLine(JSON.stringify(result, null, 2));
      else printSnapshot(result);
      return result.ok ? 0 : 1;
    }

    if (command === 'verify') {
      const snapshotDir = parsed.values.snapshot ?? findLatestSnapshot(root, parsed.values.out ?? POLICY.defaultOutDir);
      if (!snapshotDir) {
        reportLine('No snapshot found to verify. Run `snapshot` first.');
        return 1;
      }
      const result = verifySnapshot(snapshotDir, {
        root,
        recovery: parsed.values.recovery,
        checkSource: !parsed.values['no-source-check'],
        allowExternalSource: parsed.values['allow-external-source'],
      });
      if (parsed.values.json) reportLine(JSON.stringify(result, null, 2));
      else printVerify(result);
      return result.ok ? 0 : 1;
    }

    reportLine(`Unknown command "${command}".`);
    reportLine(USAGE);
    return 2;
  } catch (error) {
    if (error instanceof BaselineError) {
      reportLine(`BLOCKED [${error.code}] ${error.message}`);
      if (parsed.values.json) reportLine(JSON.stringify({ ok: false, code: error.code, message: error.message, detail: error.detail }, null, 2));
      return 1;
    }
    throw error;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
