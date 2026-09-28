/**
 * T00 safeguard tests: the protected-data protection utility
 * (`scripts/protect-baseline.mjs`) exercised on temporary fixtures only.
 *
 * Nothing here touches `backups/props/**` — every fixture lives in a fresh temporary
 * directory, and the tests additionally assert that the real protected bytes are not
 * modified by a run of the tool.
 *
 * Run with: node scripts/check.mjs   (tsc --noEmit, then node --import tsx --test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BaselineError,
  POLICY,
  createTemporaryCopy,
  findAuthorisedSnapshot,
  assertNotProtected,
  assertRelativeSafe,
  createSnapshot,
  hashBytes,
  inspectKnown,
  observeDecorationSet,
  repoRoot,
  resolveSafe,
  verifySnapshot,
} from '../scripts/protect-baseline.mjs';

const SCRIPT = resolve(fileURLToPath(new URL('../scripts/protect-baseline.mjs', import.meta.url)));

/** Builds a throw-away repo root containing a small protected-style file. */
function fixtureRoot(propCount = 3) {
  const root = mkdtempSync(join(tmpdir(), 'hm2-protect-'));
  mkdirSync(join(root, 'backups/props/user_safety_backup'), { recursive: true });
  mkdirSync(join(root, 'public/presets'), { recursive: true });
  const props = Array.from({ length: propCount }, (_, index) => ({
    id: `prop_fixture_${index}`,
    type: index % 2 === 0 ? 'prop_25_timber_coaster_loop' : 'pines_cluster',
    x: index * 10,
    scale: 1,
  }));
  const payload = { course: 'ridge', timestamp: 1790000000000, count: props.length, props };
  writeFileSync(join(root, POLICY.knownBaseline[0].path), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(root, POLICY.recoveryDirs[0], 'track-props-fixture-safeguard.json'), `${JSON.stringify(payload, null, 2)}\n`);
  return { root, payload, bytes: readFileSync(join(root, POLICY.knownBaseline[0].path)) };
}

function runCli(args, { cwd = repoRoot() } = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// ---------------------------------------------------------------------------
// Suite 1 — path safety (no shared resources, no writes)
// ---------------------------------------------------------------------------

test('path safety: escapes, absolute paths and NUL bytes are rejected', () => {
  assert.throws(() => assertRelativeSafe('../secrets.json'), { name: 'BaselineError', code: 'E_PATH_ESCAPE' });
  assert.throws(() => assertRelativeSafe('a/../../outside.json'), { code: 'E_PATH_ESCAPE' });
  assert.throws(() => assertRelativeSafe('/etc/passwd'), { code: 'E_PATH_ABSOLUTE' });
  assert.throws(() => assertRelativeSafe('C:\\Windows\\system32\\config'), { code: 'E_PATH_ABSOLUTE' });
  assert.throws(() => assertRelativeSafe('props\0.json'), { code: 'E_PATH_NUL' });
  assert.throws(() => assertRelativeSafe('   '), { code: 'E_PATH_EMPTY' });
  assert.equal(assertRelativeSafe('backups/props/track-props-latest.json'), 'backups/props/track-props-latest.json');
  assert.equal(assertRelativeSafe('backups//props/./latest.json'), 'backups/props/latest.json');
});

/**
 * Creates a symlink, or reports that this shell can't. Directory links use a junction on Windows
 * (no admin rights needed); a file link on an unprivileged Windows shell is refused with EPERM, and
 * the caller skips instead of failing.
 */
function trySymlink(target: string, linkPath: string, kind: 'file' | 'dir'): boolean {
  try {
    symlinkSync(target, linkPath, kind === 'dir' && process.platform === 'win32' ? 'junction' : kind);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw error;
  }
}

/** Repo-relative paths come back with the platform separator; compare them in POSIX form. */
const posix = (p: string): string => p.replace(/\\/g, '/');

test('path safety: a symlinked file outside the fixture root is refused', (t) => {
  const { root } = fixtureRoot();
  try {
    const outside = join(tmpdir(), `hm2-outside-${Date.now()}.json`);
    writeFileSync(outside, JSON.stringify({ props: [{ id: 'outside' }] }));
    const linkPath = join(root, 'linked-latest.json');
    if (!trySymlink(outside, linkPath, 'file')) {
      rmSync(outside, { force: true });
      t.skip('this shell may not create file symlinks (Windows without developer mode)');
      return;
    }

    assert.throws(() => resolveSafe(root, 'linked-latest.json'), { code: 'E_SYMLINK' });
    assert.throws(() => createSnapshot({ root, source: 'linked-latest.json', outDir: 'baseline/snapshots', now: '2026-01-01T00:00:00Z' }), {
      code: 'E_SYMLINK',
    });
    rmSync(outside, { force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('path safety: a symlinked directory component is refused even when the final file is real', () => {
  const { root } = fixtureRoot();
  try {
    assert.ok(trySymlink(join(root, 'backups'), join(root, 'alias-backups'), 'dir'));
    assert.throws(() => resolveSafe(root, 'alias-backups/props/track-props-latest.json'), { code: 'E_SYMLINK' });
    // An explicit opt-in still refuses a target that leaves the root.
    const outside = mkdtempSync(join(tmpdir(), 'hm2-elsewhere-'));
    try {
      assert.ok(trySymlink(outside, join(root, 'escape-dir'), 'dir'));
      assert.throws(() => resolveSafe(root, 'escape-dir/file.json', { allowSymlinks: true }), (error) => error instanceof BaselineError);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('path safety: writing into the protected directory is refused', () => {
  const { root } = fixtureRoot();
  try {
    assert.throws(() => createSnapshot({ root, outDir: 'backups/props', now: '2026-01-01T00:00:00Z' }), { code: 'E_PROTECTED_WRITE' });
    assert.throws(() => createSnapshot({ root, outDir: 'backups/props/nested/deeper', now: '2026-01-01T00:00:00Z' }), {
      code: 'E_PROTECTED_WRITE',
    });
    assert.throws(() => assertNotProtected(root, join(root, 'backups/props/x.json')), { code: 'E_PROTECTED_WRITE' });
    assert.doesNotThrow(() => assertNotProtected(root, join(root, 'baseline/snapshots')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Suite 2 — observations (counts and IDs are not constants)
// ---------------------------------------------------------------------------

test('observation: counts and IDs are reported as advisory data', () => {
  const bytes = Buffer.from(JSON.stringify({ course: 'ridge', props: [{ id: 'a' }, { id: 'b' }, { id: 'b' }, {}] }));
  const observation = observeDecorationSet(bytes, { label: 'fixture' });
  assert.equal(observation.count, 4);
  assert.equal(observation.uniqueIds, 2);
  assert.equal(observation.missingIds, 1);
  assert.deepEqual(observation.duplicateIds, ['b']);
  assert.equal(observation.advisory, true);
  assert.match(observation.note, /runtime constants/);
  assert.equal(observation.course, 'ridge');
});

test('observation: an empty or shapeless set is never accepted as a baseline', () => {
  assert.throws(() => observeDecorationSet(Buffer.from('{"props":[]}')), { code: 'E_EMPTY' });
  assert.throws(() => observeDecorationSet(Buffer.from('[]')), { code: 'E_EMPTY' });
  assert.throws(() => observeDecorationSet(Buffer.from('{"nope":1}')), { code: 'E_SHAPE' });
  assert.throws(() => observeDecorationSet(Buffer.from('not json')), { code: 'E_NOT_JSON' });
});

test('observation: the tool never synthesises props for a missing source', () => {
  const { root } = fixtureRoot();
  try {
    assert.throws(() => createSnapshot({ root, source: 'backups/props/does-not-exist.json', now: '2026-01-01T00:00:00Z' }), {
      code: 'E_SOURCE_MISSING',
    });
    // The fixture set itself is untouched by the failed run.
    assert.ok(readFileSync(join(root, POLICY.knownBaseline[0].path)).length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Suite 3 — snapshot creation, exclusivity, read-back
// ---------------------------------------------------------------------------

test('snapshot: copies the original bytes, records hashes and verifies a recovery copy', () => {
  const { root, bytes } = fixtureRoot();
  try {
    const result = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    assert.equal(result.ok, true);
    assert.equal(result.snapshot.matchesSource, true);
    assert.equal(result.snapshot.sha256, sha256(bytes));
    assert.equal(readFileSync(join(root, result.snapshot.file)).equals(bytes), true);

    const manifest = JSON.parse(readFileSync(join(root, result.manifestPath), 'utf8'));
    assert.equal(manifest.schema, 'hm2.baseline-manifest/v1');
    assert.equal(manifest.source.sha256, sha256(bytes));
    assert.equal(manifest.snapshot.matches_source, true);
    assert.equal(manifest.observation.count, 3);
    assert.equal(manifest.recovery.verifiedMatches, 1, 'the fixture recovery copy is byte-identical');
    assert.match(result.snapshot.directory, /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
    // The manifest is inside the snapshot directory, not in the protected tree.
    assert.ok(posix(result.manifestPath).startsWith('baseline/snapshots'), result.manifestPath);
    assert.ok(existsSync(join(root, result.manifestPath)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshot: creation is exclusive — a repeat at the same timestamp is refused, bytes intact', () => {
  const { root, bytes } = fixtureRoot();
  try {
    const now = '2026-01-02T03:04:05.678Z';
    const first = createSnapshot({ root, now });
    const snapshotFile = join(root, first.snapshot.file);
    const before = readFileSync(snapshotFile);

    assert.throws(() => createSnapshot({ root, now }), { code: 'E_SNAPSHOT_EXISTS' });
    assert.equal(readFileSync(snapshotFile).equals(before), true, 'the existing snapshot was not rewritten');
    assert.equal(readFileSync(join(root, POLICY.knownBaseline[0].path)).equals(bytes), true, 'the source is untouched');

    // A different timestamp creates a second, independent snapshot.
    const second = createSnapshot({ root, now: '2026-01-02T03:04:06.678Z' });
    assert.notEqual(second.snapshot.directory, first.snapshot.directory);
    assert.equal(second.snapshot.sha256, first.snapshot.sha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshot: --dry-run writes nothing at all', () => {
  const { root } = fixtureRoot();
  try {
    const result = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z', dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(result.observation.count, 3);
    assert.equal(existsSync(join(root, 'baseline/snapshots')), false, 'dry run must not create the output directory');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshot: an explicitly authorised mismatching recovery copy is reported, not hidden', () => {
  const { root } = fixtureRoot();
  try {
    const other = join(POLICY.recoveryDirs[0], 'track-props-other-safeguard.json');
    writeFileSync(join(root, other), JSON.stringify({ course: 'ridge', props: [{ id: 'prop_fixture_0' }] }));
    const result = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z', recovery: [other] });
    assert.equal(result.ok, true, 'the snapshot itself is valid');
    assert.equal(result.verifiedRecovery, 0);
    assert.equal(result.recovery[0].status, 'mismatch');
    assert.equal(result.recovery[0].observed.count, 1);
    assert.match(result.warnings.join(' '), /No recovery copy/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshot: --strict fails when no second copy can be verified', () => {
  const { root } = fixtureRoot();
  try {
    rmSync(join(root, POLICY.recoveryDirs[0], 'track-props-fixture-safeguard.json'), { force: true });
    const relaxed = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    assert.equal(relaxed.ok, true);
    assert.equal(relaxed.recovery[0].status, 'none-available');

    const strict = createSnapshot({ root, now: '2026-01-02T03:04:06.678Z', strict: true });
    assert.equal(strict.ok, false, 'strict mode must not claim success without a verified second copy');
    assert.match(strict.warnings.join(' '), /No recovery copy/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Suite 4 — verification and tamper detection
// ---------------------------------------------------------------------------

test('verify: a pristine snapshot passes, a tampered snapshot fails', () => {
  const { root } = fixtureRoot();
  try {
    const created = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    const clean = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(clean.ok, true);
    assert.equal(clean.checks.every((check) => check.ok), true);

    const snapshotFile = join(root, created.snapshot.file);
    const tampered = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    tampered.props.push({ id: 'prop_injected' });
    writeFileSync(snapshotFile, JSON.stringify(tampered, null, 2));

    const dirty = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(dirty.ok, false);
    const failed = dirty.checks.filter((check) => !check.ok).map((check) => check.name);
    assert.ok(failed.includes('snapshot-readable'), `expected a hash mismatch, got ${failed.join(', ')}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verify: source drift and a missing source are both reported', () => {
  const { root } = fixtureRoot();
  try {
    const created = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    writeFileSync(join(root, POLICY.knownBaseline[0].path), JSON.stringify({ course: 'ridge', props: [{ id: 'prop_new' }] }));
    const drifted = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(drifted.ok, false);
    assert.equal(drifted.checks.find((check) => check.name === 'source-unchanged')?.ok, false);

    rmSync(join(root, POLICY.knownBaseline[0].path), { force: true });
    const missing = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(missing.ok, false);
    assert.match(missing.checks.find((check) => check.name === 'source-unchanged')?.detail ?? '', /only verified copy/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verify: recovery copies are re-checked from the manifest list', () => {
  const { root } = fixtureRoot();
  try {
    const created = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z', recovery: [join(POLICY.recoveryDirs[0], 'track-props-fixture-safeguard.json')] });
    const ok = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(ok.ok, true);

    writeFileSync(join(root, POLICY.recoveryDirs[0], 'track-props-fixture-safeguard.json'), JSON.stringify({ course: 'ridge', props: [{ id: 'prop_other' }] }));
    const broken = verifySnapshot(created.snapshot.directory, { root });
    assert.equal(broken.ok, false);
    assert.ok(broken.checks.some((check) => check.name.startsWith('recovery:') && !check.ok));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verify: an unknown manifest schema is refused', () => {
  const { root } = fixtureRoot();
  try {
    const created = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    const manifestPath = join(root, created.manifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.schema = 'hm2.baseline-manifest/v99';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => verifySnapshot(created.snapshot.directory, { root }), { code: 'E_MANIFEST_SCHEMA' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Suite 5 — CLI behaviour on the real repository (read-only checks)
// ---------------------------------------------------------------------------

test('cli: inventory is read-only and reports authorisation honestly', () => {
  const protectedPath = join(repoRoot(), POLICY.knownBaseline[0].path);
  const before = readFileSync(protectedPath);
  const run = runCli(['inventory']);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /hm2-3d-track-props/);
  // Either an authorised snapshot exists, or the missing baseline is stated plainly.
  assert.match(run.stdout, /AUTHORISED BASELINE: |BLOCKER: no authorised snapshot/);
  assert.equal(readFileSync(protectedPath).equals(before), true, 'inventory must not touch the protected bytes');
});

test('cli: usage errors exit 2, blocked requests exit 1, and neither writes', () => {
  const tmpDest = runCli(['tmp-copy', '--dest', 'backups/props/nope.json']);
  assert.equal(tmpDest.status, 1);
  assert.match(tmpDest.stdout, /E_PROTECTED_WRITE/);

  const unknownOption = runCli(['snapshot', '--nope']);
  assert.equal(unknownOption.status, 2, unknownOption.stdout + unknownOption.stderr);
  const unknownCommand = runCli(['frobnicate']);
  assert.equal(unknownCommand.status, 2);

  const escapedSource = runCli(['snapshot', '--source', '../escape.json']);
  assert.equal(escapedSource.status, 1);
  assert.match(escapedSource.stdout, /E_PATH_ESCAPE/);
  const escapedOut = runCli(['snapshot', '--out', '../outside-snapshots']);
  assert.equal(escapedOut.status, 1);
  assert.match(escapedOut.stdout, /E_PATH_ESCAPE/);
  const protectedOut = runCli(['snapshot', '--out', 'backups/props']);
  assert.equal(protectedOut.status, 1);
  assert.match(protectedOut.stdout, /E_PROTECTED_WRITE/);
});

test('cli: the real protected file is unchanged by a full snapshot round-trip', (t) => {
  const protectedPath = join(repoRoot(), POLICY.knownBaseline[0].path);
  const outDirRel = 'tests/artifacts/baseline-fixture-snapshots';
  const outDir = join(repoRoot(), outDirRel);
  rmSync(outDir, { recursive: true, force: true });
  const startedAt = Date.now() - 1;
  const existedBefore = existsSync(protectedPath) ? readFileSync(protectedPath) : null;
  try {
    const run = runCli(['snapshot', '--out', outDirRel, '--label', 'test-round-trip']);
    if (existedBefore === null) {
      // No protected file in this checkout: the tool must say so instead of inventing one.
      assert.equal(run.status, 1, run.stdout);
      assert.match(run.stdout, /E_SOURCE_MISSING/);
      return;
    }
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /byte-for-byte match/);
    const after = readFileSync(protectedPath);
    if (!after.equals(existedBefore) && statSync(protectedPath).mtimeMs >= startedAt) {
      // A running dev server's builder saved the track while this test ran. The tool never writes
      // there (see the protected-write tests above), so this says nothing about it.
      t.skip('the dev server rewrote the live track during the round-trip');
      return;
    }
    assert.equal(after.equals(existedBefore), true, 'the protected bytes must be byte-identical afterwards');

    const verify = runCli(['verify', '--out', outDirRel]);
    assert.equal(verify.status, 0, verify.stdout + verify.stderr);
    assert.match(verify.stdout, /\[pass\] source-unchanged:/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('tmp-copy: writes a verified disposable copy inside a git-ignored area only', () => {
  const { root, bytes } = fixtureRoot();
  try {
    const result = createTemporaryCopy({ root });
    assert.equal(result.ok, true);
    assert.equal(result.dest, 'scratch/track-props-latest.tmp.json');
    assert.equal(readFileSync(join(root, result.dest)).equals(bytes), true, 'the tmp copy is byte-identical');
    assert.equal(result.tmp.matchesSource, true);
    assert.equal(result.observation.advisory, true);

    const dry = createTemporaryCopy({ root, dest: 'scratch/other.tmp.json', dryRun: true });
    assert.equal(dry.dryRun, true);
    assert.equal(existsSync(join(root, 'scratch/other.tmp.json')), false);

    assert.throws(() => createTemporaryCopy({ root, dest: 'backups/props/copy.json' }), { code: 'E_PROTECTED_WRITE' });
    assert.throws(() => createTemporaryCopy({ root, dest: 'src/game/real-props.json' }), { code: 'E_TMP_DEST' });
    assert.throws(() => createTemporaryCopy({ root, dest: '../outside.tmp.json' }), { code: 'E_PATH_ESCAPE' });
    assert.throws(() => createTemporaryCopy({ root, source: 'backups/props/missing.json' }), { code: 'E_SOURCE_MISSING' });
    assert.throws(() => createTemporaryCopy({ root, source: 'backups' }), { code: 'E_SOURCE_KIND' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('tmp-copy: the real repository copy is byte-identical and leaves the baseline alone', () => {
  const protectedPath = join(repoRoot(), POLICY.knownBaseline[0].path);
  if (!existsSync(protectedPath)) return; // nothing to copy in this checkout
  const before = readFileSync(protectedPath);
  const result = runCli(['tmp-copy']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /byte-for-byte match/);
  assert.match(result.stdout, /scratch\/track-props-latest\.tmp\.json/);
  assert.equal(readFileSync(protectedPath).equals(before), true, 'the protected bytes must be untouched');
  const copyPath = join(repoRoot(), 'scratch/track-props-latest.tmp.json');
  assert.equal(readFileSync(copyPath).equals(before), true, 'the tmp copy must be byte-identical');
  rmSync(copyPath, { force: true });
});

test('authorisation: a snapshot only counts when its manifest matches these exact bytes', () => {
  const { root } = fixtureRoot();
  try {
    const protectedPath = join(root, POLICY.knownBaseline[0].path);
    assert.equal(findAuthorisedSnapshot(root, POLICY.knownBaseline[0].path), null, 'no snapshot yet means no authorisation');

    const created = createSnapshot({ root, now: '2026-01-02T03:04:05.678Z' });
    const authorised = findAuthorisedSnapshot(root, POLICY.knownBaseline[0].path);
    assert.ok(authorised);
    assert.equal(authorised.directory, created.snapshot.directory);
    assert.equal(authorised.readBackMatches, true);
    assert.equal(authorised.verifiedRecovery, 1);

    // A different hash is a different baseline: the snapshot must not vouch for it.
    writeFileSync(protectedPath, JSON.stringify({ course: 'ridge', props: [{ id: 'prop_changed' }] }));
    assert.equal(findAuthorisedSnapshot(root, POLICY.knownBaseline[0].path, hashBytes(readFileSync(protectedPath)).sha256), null);
    assert.equal(findAuthorisedSnapshot(root, POLICY.knownBaseline[0].path)?.directory, created.snapshot.directory,
      'without an expected hash the recorded snapshot is still reported');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inventory: the real repository reports the observed copies without inventing provenance', () => {
  const report = inspectKnown(repoRoot());
  assert.equal(report.provenance.authoritative, report.provenance.authorisedSnapshot !== null,
    'authorisation must be derived from an actual verified snapshot, never assumed');
  assert.equal(report.recovery.independentMedium, false);
  assert.equal(report.known.length, POLICY.knownBaseline.length);
  const primary = report.known.find((entry) => entry.id === 'decoration-baseline');
  assert.ok(primary.status === 'present' || primary.status === 'missing');
  if (primary.status === 'present') {
    assert.equal(hashBytes(readFileSync(join(repoRoot(), primary.path))).sha256, primary.sha256);
    assert.equal(primary.observation.advisory, true);
  }
  const observation = report.known.map((entry) => `${entry.id}:${entry.status}`).join(' ');
  assert.equal(typeof observation, 'string');
});
