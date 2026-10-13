import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ARCHIVE, checkSubject, checkToken, checkUrl, redact, summarizeHealth } from './bench-rules';
import { BusyError, JobRunner, archiveFiles, benchPathsFor, handleBenchRequest, readArchive, restoreArchive, setSubject, stagesFor, type BenchPaths, type JobSpec } from './bench';
import type { Request } from './write-back';

const REPO = path.resolve(import.meta.dirname, '../../..');
const TOKEN = 'tok-0123456789abcdef-SECRET';

// ---------------------------------------------------------------- the pure rules

test('a description is trimmed, keeps its line breaks, and must have a usable length', () => {
  const ok = checkSubject('  the bench, on four legs\r\nno pegboard  ');
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.value, 'the bench, on four legs\nno pegboard');
  assert.equal(checkSubject('short').ok, false);
  assert.equal(checkSubject(42).ok, false);
  assert.equal(checkSubject('x'.repeat(1501)).ok, false);
  assert.equal(checkSubject('a long enough line\u0007 with a bell').ok, false);
});

test('a connection URL is http or https, with no login, query or fragment', () => {
  assert.deepEqual(checkUrl('http://192.168.0.9:8082/'), { ok: true, value: 'http://192.168.0.9:8082' });
  assert.equal(checkUrl('ftp://192.168.0.9').ok, false);
  assert.equal(checkUrl('http://user:pw@192.168.0.9:8082').ok, false);
  assert.equal(checkUrl('http://192.168.0.9:8082/?x=1').ok, false);
  assert.equal(checkUrl('not a url').ok, false);
});

test('a token is one line of printable characters of a sane length', () => {
  assert.equal(checkToken(TOKEN).ok, true);
  assert.equal(checkToken('short').ok, false);
  assert.equal(checkToken('has a space in it').ok, false);
  assert.equal(checkToken(undefined).ok, false);
});

test('a secret is redacted from any text the Studio shows, and short values are not', () => {
  assert.equal(redact(`Authorization: Bearer ${TOKEN}`, [TOKEN]), 'Authorization: Bearer [redacted]');
  assert.equal(redact('a b c', ['b']), 'a b c');
});

test('a health answer keeps only its numbers and a short stage', () => {
  const s = summarizeHealth({ queued: 1, busy: 0, vram_free_gb: 11.2, token: TOKEN, stage: 'x'.repeat(200), other: { deep: true } });
  assert.deepEqual(s, { queued: 1, busy: 0, vram_free_gb: 11.2, stage: 'x'.repeat(60) });
  assert.equal(JSON.stringify(s).includes(TOKEN), false);
});

test('archive folder names are a timestamp, an optional counter and an archiving step', () => {
  assert.equal(ARCHIVE.test('20261013-151203-model'), true);
  assert.equal(ARCHIVE.test('20261013-151203-2-revert'), true);
  assert.equal(ARCHIVE.test('../20261013-151203-model'), false);
  assert.equal(ARCHIVE.test('20261013-151203-pack'), false);
});

// ---------------------------------------------------------------- disk fixtures

function fixture(): { paths: BenchPaths; dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-'));
  const manifestFile = path.join(dir, 'docs', 'runworld', 'assets.json');
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    budgets: { fixture: [900, 1500, 2500] },
    assets: [
      { id: 'weapon-bench', class: 'fixture', subject: 'the bench, with its legs and top and an empty clamp', size: 2.4, axis: 'length' },
      { id: 'bin', class: 'fixture', subject: 'a steel bin on four square feet, plain and closed up', size: 1 },
    ],
  }, null, 2)}\n`);
  fs.mkdirSync(path.join(dir, 'zips', 'runworld', 'assets', 'weapon-bench'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'apps', 'web', 'src', 'assets', 'gen'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'apps', 'web', 'public', 'hd'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  const paths = benchPathsFor(dir, path.join(dir, '.studio-secrets.json'));
  return { paths, dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const req = (over: Partial<Request> & { body?: string; path: string }): Request => {
  const body = over.body ?? '';
  return {
    method: 'GET',
    host: 'localhost:5199',
    origin: undefined,
    contentType: 'application/json',
    readBody: async () => body,
    ...over,
  };
};

const jsonOf = (r: { body: unknown } | null): Record<string, unknown> => JSON.parse(String((r as { body: string }).body)) as Record<string, unknown>;

// ---------------------------------------------------------------- the description

test('setSubject changes one asset and leaves the rest of the file byte-identical', () => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.paths.manifestFile, 'utf8');
    setSubject(f.paths.manifestFile, 'bin', 'a steel bin on four square feet, plain and closed up, lid shut');
    const after = JSON.parse(fs.readFileSync(f.paths.manifestFile, 'utf8')) as { assets: { id: string; subject: string }[] };
    assert.equal(after.assets.find((a) => a.id === 'bin')?.subject.endsWith('lid shut'), true);
    assert.equal(after.assets.find((a) => a.id === 'weapon-bench')?.subject, 'the bench, with its legs and top and an empty clamp');
    setSubject(f.paths.manifestFile, 'bin', 'a steel bin on four square feet, plain and closed up');
    assert.equal(fs.readFileSync(f.paths.manifestFile, 'utf8'), before);
  } finally {
    f.cleanup();
  }
});

test('the checked-in assets.json survives a description round trip unchanged', () => {
  const f = fixture();
  try {
    const real = path.join(REPO, 'docs', 'runworld', 'assets.json');
    const copy = path.join(f.dir, 'assets.json');
    fs.copyFileSync(real, copy);
    const data = JSON.parse(fs.readFileSync(copy, 'utf8')) as { assets: { id: string; subject: string }[] };
    const wb = data.assets.find((a) => a.id === 'weapon-bench');
    assert.ok(wb);
    setSubject(copy, 'weapon-bench', wb.subject);
    assert.equal(fs.readFileSync(copy, 'utf8'), fs.readFileSync(real, 'utf8'));
  } finally {
    f.cleanup();
  }
});

// ---------------------------------------------------------------- the connection

test('the connection is stored, reported without its token, and forgotten', async () => {
  const f = fixture();
  try {
    const post = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/connection', body: JSON.stringify({ url: 'http://192.168.0.9:8082', token: TOKEN }) }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(post?.status, 200);
    assert.equal(fs.existsSync(f.paths.secretsFile), true);
    const get = await handleBenchRequest(req({ path: '/__studio/bench/connection' }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(get?.status, 200);
    assert.equal(String(get?.body).includes(TOKEN), false, 'the token is never returned');
    assert.equal(jsonOf(get).connected, true);
    assert.equal(jsonOf(get).source, 'studio');
    const del = await handleBenchRequest(req({ method: 'DELETE', path: '/__studio/bench/connection' }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(jsonOf(del).connected, false);
    assert.equal(fs.existsSync(f.paths.secretsFile), false, 'an empty secrets file is removed');
  } finally {
    f.cleanup();
  }
});

test('a connection with a bad URL or token is refused and nothing is written', async () => {
  const f = fixture();
  try {
    const r1 = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/connection', body: JSON.stringify({ url: 'ftp://x', token: TOKEN }) }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(r1?.status, 422);
    const r2 = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/connection', body: JSON.stringify({ url: 'http://192.168.0.9:8082', token: 'x y' }) }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(r2?.status, 422);
    assert.equal(fs.existsSync(f.paths.secretsFile), false);
  } finally {
    f.cleanup();
  }
});

test('the older .local3d-token still counts as a connection, and is named as such', async () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.paths.legacyTokenFile, `${TOKEN}\n`);
    const get = await handleBenchRequest(req({ path: '/__studio/bench/connection' }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(jsonOf(get).connected, true);
    assert.equal(jsonOf(get).source, 'legacy');
    assert.equal(String(get?.body).includes(TOKEN), false);
  } finally {
    f.cleanup();
  }
});

// ---------------------------------------------------------------- the routes refuse what they must

test('the bench refuses other hosts, unknown ids, traversal and bad steps', async () => {
  const f = fixture();
  try {
    const jobs = new JobRunner(f.dir);
    const run = (over: Partial<Request> & { path: string }) => handleBenchRequest(req({ method: 'POST', ...over }), f.paths, jobs, { mock: false });
    assert.equal((await run({ host: 'evil.example', path: '/__studio/bench/cancel' }))?.status, 403);
    assert.equal((await run({ path: '/__studio/bench/step/images/nope' }))?.status, 404, 'an id not in assets.json');
    assert.equal((await run({ path: '/__studio/bench/step/images/..%2Fetc' }))?.status, 404, 'a traversal id');
    assert.equal((await run({ path: '/__studio/bench/step/rm/weapon-bench' }))?.status, 404, 'a step that is not one of ours');
    assert.equal((await run({ path: '/__studio/bench/revert/weapon-bench/20000101-000000-model' }))?.status, 404, 'an archive that does not exist');
    assert.equal((await run({ path: '/__studio/bench/describe/weapon-bench', body: JSON.stringify({ subject: 'a valid long description here', id: 'bin' }) }))?.status, 422, 'extra fields');
    assert.equal((await run({ path: '/__studio/bench/describe/weapon-bench', body: JSON.stringify({ subject: 'short' }) }))?.status, 422);
    assert.equal((await run({ path: '/__studio/bench/approve/weapon-bench' }))?.status, 422, 'nothing to approve');
    assert.equal((await run({ path: '/__studio/bench/step/model/weapon-bench' }))?.status, 422, 'no image yet');
    assert.equal((await run({ path: '/__studio/bench/step/pack/weapon-bench' }))?.status, 422, 'no levels yet');
    const f1 = await handleBenchRequest(req({ path: '/__studio/bench/file/weapon-bench/secret.txt' }), f.paths, jobs, { mock: false });
    assert.equal(f1?.status, 404, 'only the fixed file names are served');
    const f2 = await handleBenchRequest(req({ path: '/__studio/bench/file/weapon-bench/..%2F..%2Fsecrets' }), f.paths, jobs, { mock: false });
    assert.equal(f2?.status, 404);
  } finally {
    f.cleanup();
  }
});

test('a description edit writes only that asset and keeps the file form', async () => {
  const f = fixture();
  try {
    const r = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/describe/bin', body: JSON.stringify({ subject: 'a steel bin on four square feet, plain and closed up, lid shut' }) }), f.paths, new JobRunner(f.dir), { mock: false });
    assert.equal(r?.status, 200);
    const data = JSON.parse(fs.readFileSync(f.paths.manifestFile, 'utf8')) as { assets: { id: string; subject: string }[] };
    assert.equal(data.assets.find((a) => a.id === 'bin')?.subject.endsWith('lid shut'), true);
  } finally {
    f.cleanup();
  }
});

test('a model step needs an approved image and a connection', async () => {
  const f = fixture();
  try {
    const dir = path.join(f.dir, 'zips', 'runworld', 'assets', 'weapon-bench');
    fs.writeFileSync(path.join(dir, 'source.png'), 'png');
    const jobs = new JobRunner(f.dir);
    const r1 = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/step/model/weapon-bench' }), f.paths, jobs, { mock: false });
    assert.equal(r1?.status, 422);
    assert.match(String(jsonOf(r1).why), /approve/);
    fs.writeFileSync(path.join(dir, 'approved'), '');
    const r2 = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/step/model/weapon-bench' }), f.paths, jobs, { mock: false });
    assert.equal(r2?.status, 422);
    assert.match(String(jsonOf(r2).why), /connect/);
  } finally {
    f.cleanup();
  }
});

test('the real steps run the fixed scripts; the mock run keeps pack real', () => {
  assert.deepEqual(stagesFor('images', 'bin', false)[0]?.args, ['images', 'bin']);
  assert.equal(stagesFor('model', 'bin', false)[0]?.script, 'scripts/local3d.mjs');
  assert.equal(stagesFor('post', 'bin', true)[0]?.script, 'scripts/studio-bench-mock.mjs');
  assert.equal(stagesFor('pack', 'bin', true)[0]?.script, 'scripts/runworld-pack.mjs');
});

// ---------------------------------------------------------------- archives

test('an archive copies the files it holds, and a restore puts them back', () => {
  const f = fixture();
  try {
    const dir = path.join(f.dir, 'zips', 'runworld', 'assets', 'weapon-bench');
    fs.writeFileSync(path.join(dir, 'low.glb'), 'old-low');
    fs.writeFileSync(path.join(dir, 'mid.glb'), 'old-mid');
    const name = archiveFiles(f.paths, 'weapon-bench', 'post', ['low.glb', 'mid.glb', 'high.glb'], [], new Date('2026-10-13T15:12:03Z'));
    assert.equal(name, '20261013-151203-post');
    fs.writeFileSync(path.join(dir, 'low.glb'), 'new-low');
    const info = readArchive(f.paths, 'weapon-bench', name ?? '');
    assert.deepEqual(info?.files, ['low.glb', 'mid.glb']);
    restoreArchive(f.paths, 'weapon-bench', name ?? '');
    assert.equal(fs.readFileSync(path.join(dir, 'low.glb'), 'utf8'), 'old-low');
    assert.equal(fs.existsSync(path.join(dir, 'old', name ?? '', 'low.glb')), true, 'the archive keeps its copy');
  } finally {
    f.cleanup();
  }
});

test('an archive that moves the image leaves nothing behind in the asset folder', () => {
  const f = fixture();
  try {
    const dir = path.join(f.dir, 'zips', 'runworld', 'assets', 'weapon-bench');
    fs.writeFileSync(path.join(dir, 'source.png'), 'old-image');
    fs.writeFileSync(path.join(dir, 'approved'), '');
    const name = archiveFiles(f.paths, 'weapon-bench', 'images', ['source.png', 'approved'], ['source.png', 'approved']) ?? '';
    assert.equal(fs.existsSync(path.join(dir, 'source.png')), false);
    assert.equal(fs.existsSync(path.join(dir, 'approved')), false, 'a new image is not approved until it is used');
    assert.equal(fs.readFileSync(path.join(dir, 'old', name, 'source.png'), 'utf8'), 'old-image');
  } finally {
    f.cleanup();
  }
});

// ---------------------------------------------------------------- the job runner (fixed scripts, real children)

function fakeRoot(): { root: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-jobs-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'fake.mjs'), [
    "const [mode, ...rest] = process.argv.slice(2);",
    "if (mode === 'talk') { console.log('auth ' + rest[0]); console.log('done'); process.exit(0); }",
    "if (mode === 'fail') { console.log('boom'); process.exit(3); }",
    "if (mode === 'wait') { console.log('waiting'); setTimeout(() => {}, 20000); }",
    "",
  ].join('\n'));
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const specOf = (over: Partial<JobSpec> & { stages: JobSpec['stages'] }): JobSpec => ({
  step: 'test',
  assetId: 'bin',
  secrets: () => [TOKEN],
  ...over,
});

async function settle(jobs: JobRunner): Promise<void> {
  for (let i = 0; i < 400 && jobs.running; i++) await new Promise((r) => setTimeout(r, 25));
}

test('a job runs its stages in order, redacts the secret, and logs to its file', async () => {
  const { root, cleanup } = fakeRoot();
  try {
    const logFile = path.join(root, 'job.log');
    const jobs = new JobRunner(root);
    const done = await jobs.start(specOf({ stages: [{ label: 'talk', script: 'scripts/fake.mjs', args: ['talk', TOKEN] }], logFile }));
    assert.equal(done.state, 'ok');
    assert.equal(done.lines.some((l) => l.includes(TOKEN)), false, 'no line carries the token');
    assert.equal(done.lines.some((l) => l === 'auth [redacted]'), true);
    assert.equal(fs.readFileSync(logFile, 'utf8').includes(TOKEN), false, 'nor does the log file');
    assert.equal(done.stages.length, 1);
  } finally {
    cleanup();
  }
});

test('a failing stage stops the job, and the onFail hook runs', async () => {
  const { root, cleanup } = fakeRoot();
  try {
    const jobs = new JobRunner(root);
    let failed = 0;
    const done = await jobs.start(specOf({
      stages: [{ label: 'fail', script: 'scripts/fake.mjs', args: ['fail'] }, { label: 'never', script: 'scripts/fake.mjs', args: ['talk', 'x'] }],
      onFail: () => { failed++; },
    }));
    assert.equal(done.state, 'failed');
    assert.equal(done.stages.length, 1, 'the second stage did not run');
    assert.match(String(done.error), /stopped with code 3/);
    assert.equal(failed, 1);
  } finally {
    cleanup();
  }
});

test('a verify that finds no files fails the job even when the scripts exit cleanly', async () => {
  const { root, cleanup } = fakeRoot();
  try {
    const jobs = new JobRunner(root);
    const done = await jobs.start(specOf({ stages: [{ label: 'talk', script: 'scripts/fake.mjs', args: ['talk', 'x'] }], verify: () => 'nothing was made' }));
    assert.equal(done.state, 'failed');
    assert.equal(done.error, 'nothing was made');
  } finally {
    cleanup();
  }
});

test('one job at a time, and a cancel stops a running child', async () => {
  const { root, cleanup } = fakeRoot();
  try {
    const jobs = new JobRunner(root);
    let restored = false;
    const first = jobs.start(specOf({ stages: [{ label: 'wait', script: 'scripts/fake.mjs', args: ['wait'] }], onFail: () => { restored = true; } }));
    assert.throws(() => jobs.start(specOf({ stages: [] })), BusyError);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(jobs.cancel(), true);
    const done = await first;
    assert.equal(done.state, 'cancelled');
    assert.equal(restored, true, 'a cancelled job puts its files back');
    assert.equal(jobs.running, false);
    await settle(jobs);
  } finally {
    cleanup();
  }
});

test('the mock step route runs a job end to end and reports its state over GET /job', async () => {
  const f = fixture();
  try {
    const dir = path.join(f.dir, 'zips', 'runworld', 'assets', 'weapon-bench');
    fs.writeFileSync(path.join(f.dir, 'scripts', 'studio-bench-mock.mjs'), "import fs from 'node:fs';\nconst [step, id] = process.argv.slice(2);\nfs.writeFileSync(`zips/runworld/assets/${id}/source.png`, 'new ' + step);\nconsole.log('mock ' + step);\n");
    fs.writeFileSync(path.join(dir, 'source.png'), 'old image');
    const jobs = new JobRunner(f.dir);
    const start = await handleBenchRequest(req({ method: 'POST', path: '/__studio/bench/step/images/weapon-bench' }), f.paths, jobs, { mock: true });
    assert.equal(start?.status, 202);
    await settle(jobs);
    const job = await handleBenchRequest(req({ path: '/__studio/bench/job' }), f.paths, jobs, { mock: true });
    const j = jsonOf(job).job as { state: string; lines: string[] };
    assert.equal(j.state, 'ok', JSON.stringify(j));
    assert.equal(fs.readFileSync(path.join(dir, 'source.png'), 'utf8'), 'new images');
    assert.equal(fs.existsSync(path.join(dir, 'studio-redo.log')), true);
    const archived = readArchive(f.paths, 'weapon-bench', String(jsonOf(start).archived));
    assert.ok(archived, 'the old image is in an archive');
    const file = await handleBenchRequest(req({ path: `/__studio/bench/file/weapon-bench/old/${archived.name}/source.png` }), f.paths, jobs, { mock: true });
    assert.equal(String(file?.body), 'old image');
  } finally {
    f.cleanup();
  }
});
