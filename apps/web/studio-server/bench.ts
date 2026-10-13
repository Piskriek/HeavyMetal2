/**
 * The Studio's asset bench endpoint (TASK-18). DEV ONLY, like the write-back: vite-plugin.ts mounts it on the dev
 * server, and the built game has no route at all.
 *
 *   GET    /__studio/bench/connection                  whether a 3D AI is connected (never the token)
 *   POST   /__studio/bench/connection                  {url, token}: kept in .studio-secrets.json, never echoed
 *   DELETE /__studio/bench/connection                  forgets the stored connection
 *   POST   /__studio/bench/test                        GET the provider's /health with the token; a summary only
 *   GET    /__studio/bench/asset/<id>                  one asset: description, files, archives, packed sizes, job
 *   GET    /__studio/bench/file/<id>/<name>            an image or a model of the asset (a fixed list of names)
 *   GET    /__studio/bench/file/<id>/old/<archive>/<name>   the same, from an archive
 *   POST   /__studio/bench/describe/<id>               {subject}: writes only that asset's subject in assets.json
 *   POST   /__studio/bench/approve/<id>                the new image is the one to model (creates `approved`)
 *   POST   /__studio/bench/step/<step>/<id>            images | model | post | pack: runs one fixed script
 *   POST   /__studio/bench/revert/<id>/<archive>       puts an archive's files back and packs again
 *   POST   /__studio/bench/cancel                      stops the running job
 *   GET    /__studio/bench/job                         the running (or last) job: its state and log tail
 *
 * Rules, all enforced here: requests come from this machine only (write-back's check); an id must be in
 * docs/runworld/assets.json; one job at a time; each job runs fixed scripts with fixed arguments and nothing else; the
 * token is read from the secrets file or .local3d-token and is redacted from every log line. Before a step overwrites
 * files, it copies (or moves) the old ones into zips/runworld/assets/<id>/old/<stamp>-<step>/, so a revert is always
 * possible.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ARCHIVABLE, ARCHIVE, BENCH_ID, FILE_NAMES, checkSubject, checkToken, checkUrl, hostOf, isStep, redact, summarizeHealth, type Step } from './bench-rules';
import { localRefusal, type Reply, type Request } from './write-back';

export const BENCH_ROUTE = '/__studio/bench/';
/** The per-asset log the redo writes beside the asset's files (zips/ is git-ignored). */
export const REDO_LOG = 'studio-redo.log';
const BODY_MAX = 64 * 1024;
const DEFAULT_LOCAL3D = 'http://192.168.0.9:8082';
const JOB_TIMEOUT_MS = 50 * 60 * 1000;
const LOG_TAIL = 400;

export interface BenchPaths {
  /** The repository root: the scripts run from here. */
  readonly root: string;
  /** docs/runworld/assets.json */
  readonly manifestFile: string;
  /** zips/runworld/assets: the working files of each asset (git-ignored). */
  readonly assetsDir: string;
  /** apps/web/src/assets/gen: the packed low level and the registry. */
  readonly genDir: string;
  /** apps/web/public/hd: the packed HD pack. */
  readonly hdDir: string;
  /** .studio-secrets.json at the repository root (git-ignored). */
  readonly secretsFile: string;
  /** .local3d-token: the older bearer-token file, still honoured when the secrets file has no token. */
  readonly legacyTokenFile: string;
}

/**
 * The bench's paths. `dataDir` moves every file the bench reads or writes (the manifest, the working folders, the
 * packed outputs) under another folder with the same shape: the test run uses a temporary one, so no real asset is
 * ever touched. The steps still run from `root`.
 */
export function benchPathsFor(root: string, secretsFile = path.join(root, '.studio-secrets.json'), dataDir?: string): BenchPaths {
  const base = dataDir ?? root;
  return {
    root,
    manifestFile: path.join(base, 'docs', 'runworld', 'assets.json'),
    assetsDir: path.join(base, 'zips', 'runworld', 'assets'),
    genDir: path.join(base, 'apps', 'web', 'src', 'assets', 'gen'),
    hdDir: path.join(base, 'apps', 'web', 'public', 'hd'),
    secretsFile,
    legacyTokenFile: path.join(base, '.local3d-token'),
  };
}

// ---------------------------------------------------------------- the manifest and the description

interface ManifestEntry {
  readonly id: string;
  readonly class: string;
  readonly subject: string;
  readonly [k: string]: unknown;
}
export interface Manifest {
  readonly budgets: Record<string, readonly number[]>;
  readonly assets: ManifestEntry[];
}

export function readManifest(file: string): Manifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
}

/**
 * Writes one asset's description into assets.json and nothing else. The file is rewritten in the form it is kept in
 * (two-space JSON and one trailing newline: a round trip of the checked-in file is byte-identical), through a temp file.
 */
export function setSubject(file: string, id: string, subject: string): void {
  const data = readManifest(file);
  const asset = data.assets.find((a) => a.id === id);
  if (!asset) throw new Error(`no asset ${id}`);
  (asset as { subject: string }).subject = subject;
  writeAtomic(file, `${JSON.stringify(data, null, 2)}\n`);
}

function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- the connection (secrets)

interface Local3dSecret { url?: string; token?: string }
interface Secrets { local3d?: Local3dSecret }

function readSecrets(file: string): Secrets {
  if (!fs.existsSync(file)) return {};
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Secrets) : {};
  } catch {
    return {};
  }
}

function writeSecrets(file: string, s: Secrets): void {
  if (Object.keys(s).length === 0) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    return;
  }
  writeAtomic(file, `${JSON.stringify(s, null, 2)}\n`);
}

export interface Connection {
  readonly connected: boolean;
  /** Where the token comes from: the secrets file, the older token file, or nowhere. */
  readonly source: 'studio' | 'legacy' | null;
  readonly url: string;
  /** The token itself. Used by the server only: no route returns it. */
  readonly token: string | null;
}

/** The pipeline's URL, as scripts/local3d.mjs picks it: LOCAL3D_URL when set, else the stored one, else the default. */
export const pickUrl = (stored: string | undefined, env: string | undefined = process.env.LOCAL3D_URL): string =>
  (env ?? '').trim() || stored || DEFAULT_LOCAL3D;

/**
 * The 3D AI connection. The pipeline scripts read the same file with the same fallback (scripts/local3d.mjs): the
 * secrets file's token first, then .local3d-token.
 */
export function connectionOf(paths: BenchPaths): Connection {
  const s = readSecrets(paths.secretsFile).local3d;
  if (s?.token) return { connected: true, source: 'studio', url: pickUrl(s.url), token: s.token };
  if (fs.existsSync(paths.legacyTokenFile)) {
    const token = fs.readFileSync(paths.legacyTokenFile, 'utf8').trim();
    if (token) return { connected: true, source: 'legacy', url: pickUrl(undefined), token };
  }
  return { connected: false, source: null, url: pickUrl(s?.url), token: null };
}

/** Every secret value a log line must not carry. */
function secretValues(paths: BenchPaths): string[] {
  const c = connectionOf(paths);
  return c.token ? [c.token] : [];
}

// ---------------------------------------------------------------- archives and restores

const assetDirOf = (paths: BenchPaths, id: string): string => path.join(paths.assetsDir, id);
const existsIn = (dir: string, name: string): boolean => fs.existsSync(path.join(dir, name));

export type ArchiveStep = 'images' | 'model' | 'post' | 'revert';
export interface ArchiveInfo { readonly name: string; readonly step: string; readonly at: string; readonly files: readonly string[] }

/**
 * Copies (or, for the names in `move`, moves) the named files of an asset that exist into a new archive folder, with
 * a manifest of what it holds. Returns the folder's name, or null when none of the files existed (no folder is made).
 */
export function archiveFiles(paths: BenchPaths, id: string, step: ArchiveStep, names: readonly string[], move: readonly string[], at: Date = new Date()): string | null {
  const dir = assetDirOf(paths, id);
  const present = names.filter((n) => existsIn(dir, n));
  if (present.length === 0) return null;
  const oldDir = path.join(dir, 'old');
  fs.mkdirSync(oldDir, { recursive: true });
  const base = at.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  let name = `${base}-${step}`;
  for (let n = 2; fs.existsSync(path.join(oldDir, name)); n++) name = `${base}-${n}-${step}`;
  const target = path.join(oldDir, name);
  fs.mkdirSync(target);
  for (const f of present) {
    if (move.includes(f)) fs.renameSync(path.join(dir, f), path.join(target, f));
    else fs.copyFileSync(path.join(dir, f), path.join(target, f));
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), `${JSON.stringify({ step, at: at.toISOString(), files: present }, null, 2)}\n`);
  return name;
}

/** An archive's manifest, or null when the name is not a real archive of this asset. */
export function readArchive(paths: BenchPaths, id: string, name: string): ArchiveInfo | null {
  if (!ARCHIVE.test(name)) return null;
  const file = path.join(assetDirOf(paths, id), 'old', name, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  const m = JSON.parse(fs.readFileSync(file, 'utf8')) as { step?: unknown; at?: unknown; files?: unknown };
  const allowed = ARCHIVABLE as readonly string[];
  const files = Array.isArray(m.files) ? m.files.filter((f): f is string => typeof f === 'string' && allowed.includes(f)) : [];
  return { name, step: String(m.step ?? ''), at: String(m.at ?? ''), files };
}

/** Copies an archive's files back into the asset's folder (the archive keeps its own copies). */
export function restoreArchive(paths: BenchPaths, id: string, name: string): string[] {
  const a = readArchive(paths, id, name);
  if (!a) throw new Error(`no archive ${name}`);
  const dir = assetDirOf(paths, id);
  const from = path.join(dir, 'old', name);
  for (const f of a.files) fs.copyFileSync(path.join(from, f), path.join(dir, f));
  return [...a.files];
}

function listArchives(paths: BenchPaths, id: string): ArchiveInfo[] {
  const oldDir = path.join(assetDirOf(paths, id), 'old');
  if (!fs.existsSync(oldDir)) return [];
  const out: ArchiveInfo[] = [];
  for (const n of fs.readdirSync(oldDir)) {
    const a = readArchive(paths, id, n);
    if (a) out.push(a);
  }
  return out.sort((x, y) => (x.name < y.name ? 1 : x.name > y.name ? -1 : 0));
}

/** What each step archives before it overwrites anything: the copies, and the files that leave the folder. */
const PLAN: Record<'images' | 'model' | 'post', { names: readonly string[]; move: readonly string[] }> = {
  images: { names: ['source.png', 'source.png.json', 'approved'], move: ['source.png', 'source.png.json', 'approved'] },
  model: { names: ['model-local.glb', 'model.glb', 'model-mv.glb', 'norm.glb', 'low.glb', 'mid.glb', 'high.glb'], move: ['model.glb', 'model-mv.glb'] },
  post: { names: ['norm.glb', 'low.glb', 'mid.glb', 'high.glb'], move: [] },
};

// ---------------------------------------------------------------- the job runner

export interface Stage { readonly label: string; readonly script: string; readonly args: readonly string[] }

export interface JobSpec {
  readonly step: string;
  readonly assetId: string;
  readonly stages: readonly Stage[];
  /** Null when the step made its files; otherwise why it did not. Checked once every stage has passed. */
  readonly verify?: () => string | null;
  /** Runs when the job fails or is cancelled (puts an archived file back, for instance). */
  readonly onFail?: () => void;
  /** The file the job's log lines are appended to, beside the asset's files. */
  readonly logFile?: string;
  /** The secret values the log must not carry. Read once, when the job starts. */
  readonly secrets: () => string[];
  readonly timeoutMs?: number;
}

export interface JobStage { readonly label: string; readonly ms: number; readonly ok: boolean }
export interface JobView {
  readonly id: number;
  readonly step: string;
  readonly assetId: string;
  readonly state: 'running' | 'ok' | 'failed' | 'cancelled';
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly stage: string | null;
  readonly stages: readonly JobStage[];
  readonly lines: readonly string[];
  readonly error: string | null;
}

export class BusyError extends Error {}

interface Running {
  view: JobView;
  child: ChildProcess | null;
  cancelled: boolean;
  timedOut: boolean;
  secrets: string[];
}

/** Runs one job at a time: fixed stages, one child process at a time, a log tail, a cancel and a time limit. */
export class JobRunner {
  private seq = 0;
  private cur: Running | null = null;
  private last: JobView | null = null;

  constructor(private readonly root: string) {}

  get running(): boolean { return this.cur !== null; }

  /** The running job, or else the last one that ended, as a snapshot. */
  view(): JobView | null { return this.cur ? this.cur.view : this.last; }

  /** Starts a job. Throws BusyError when another is running. Resolves when the job has ended. */
  start(spec: JobSpec): Promise<JobView> {
    if (this.cur) throw new BusyError('another job is running');
    const r: Running = {
      view: { id: ++this.seq, step: spec.step, assetId: spec.assetId, state: 'running', startedAt: Date.now(), endedAt: null, stage: null, stages: [], lines: [], error: null },
      child: null,
      cancelled: false,
      timedOut: false,
      secrets: spec.secrets(),
    };
    this.cur = r;
    return this.execute(spec, r);
  }

  /** Stops the running job's child and the processes it started. False when nothing runs. */
  cancel(): boolean {
    const r = this.cur;
    if (!r) return false;
    r.cancelled = true;
    if (r.child) killTree(r.child);
    return true;
  }

  private log(r: Running, spec: JobSpec, line: string): void {
    const clean = redact(line, r.secrets).slice(0, 300);
    r.view = { ...r.view, lines: [...r.view.lines, clean].slice(-LOG_TAIL) };
    if (spec.logFile) {
      try { fs.appendFileSync(spec.logFile, `${new Date().toISOString()} ${clean}\n`); } catch { /* the log is a record, not a gate */ }
    }
  }

  private async execute(spec: JobSpec, r: Running): Promise<JobView> {
    this.log(r, spec, `${spec.step} ${spec.assetId}: started`);
    const timer = setTimeout(() => { r.timedOut = true; r.cancelled = true; if (r.child) killTree(r.child); }, spec.timeoutMs ?? JOB_TIMEOUT_MS);
    let failure: string | null = null;
    try {
      for (const st of spec.stages) {
        if (r.cancelled) break;
        const t0 = Date.now();
        r.view = { ...r.view, stage: st.label };
        this.log(r, spec, `-- ${st.label}`);
        const code = await this.runChild(st, r, spec);
        const ms = Date.now() - t0;
        r.view = { ...r.view, stages: [...r.view.stages, { label: st.label, ms, ok: code === 0 }] };
        this.log(r, spec, `-- ${st.label}: ${code === 0 ? 'done' : 'stopped'} in ${Math.round(ms / 1000)} s`);
        if (r.cancelled) break;
        if (code !== 0) { failure = `${st.label} stopped with code ${code}`; break; }
      }
      if (!failure && !r.cancelled && spec.verify) failure = spec.verify();
    } catch (e) {
      failure = e instanceof Error ? e.message : 'the job failed';
    }
    clearTimeout(timer);
    let state: JobView['state'];
    let error: string | null = failure;
    if (r.timedOut) { state = 'failed'; error = 'timed out after 50 minutes'; }
    else if (r.cancelled) { state = 'cancelled'; error = 'cancelled'; }
    else if (failure) state = 'failed';
    else state = 'ok';
    if (state !== 'ok') {
      try { spec.onFail?.(); } catch (e) { this.log(r, spec, `could not put the files back: ${e instanceof Error ? e.message : String(e)}`); }
    }
    this.log(r, spec, `${spec.step} ${spec.assetId}: ${state}${error ? ` (${error})` : ''}`);
    const done: JobView = { ...r.view, state, stage: null, endedAt: Date.now(), error };
    this.last = done;
    this.cur = null;
    return done;
  }

  private runChild(st: Stage, r: Running, spec: JobSpec): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(this.root, st.script), ...st.args], {
        cwd: this.root,
        env: process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      r.child = child;
      let buf = '';
      const feed = (chunk: Buffer): void => {
        buf += chunk.toString('utf8');
        let i = buf.indexOf('\n');
        while (i >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          if (line.trim()) this.log(r, spec, line);
          i = buf.indexOf('\n');
        }
      };
      child.stdout.on('data', feed);
      child.stderr.on('data', feed);
      child.on('error', (e) => { this.log(r, spec, `could not start: ${e.message}`); resolve(-1); });
      child.on('close', (code) => {
        if (buf.trim()) this.log(r, spec, buf);
        buf = '';
        r.child = null;
        resolve(code ?? -1);
      });
    });
  }
}

/** Stops a child and its children (Blender, for one). On Windows that is taskkill's tree kill. */
export function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else child.kill('SIGTERM');
}

// ---------------------------------------------------------------- the steps

/**
 * The script a step runs. In the test run (STUDIO_BENCH_MOCK=1) every step, the pack included, runs the fixture
 * instead: the fixture writes only under STUDIO_BENCH_DIR, so the real pack never runs against the repository.
 */
export function stagesFor(step: Step, id: string, mock: boolean): Stage[] {
  if (mock) return [{ label: `${step} (fixture)`, script: 'scripts/studio-bench-mock.mjs', args: [step, id] }];
  switch (step) {
    case 'images': return [{ label: 'New image (RUN.world)', script: 'scripts/runworld-assets.mjs', args: ['images', id] }];
    case 'model': return [{ label: '3D model (local Hunyuan3D)', script: 'scripts/local3d.mjs', args: ['model', id] }];
    case 'post': return [{ label: 'Fit and the three levels (Blender)', script: 'scripts/runworld-post.mjs', args: [id] }];
    case 'pack': return [{ label: 'Pack into the game', script: 'scripts/runworld-pack.mjs', args: [id] }];
  }
}

const newer = (file: string, since: number): boolean => fs.existsSync(file) && fs.statSync(file).mtimeMs >= since;

/** Whether a step left its files behind (written after the job began). Null when it did. */
export function verifyFor(step: Step, paths: BenchPaths, id: string, since: number): string | null {
  const dir = assetDirOf(paths, id);
  if (step === 'images') return newer(path.join(dir, 'source.png'), since) ? null : 'the image step made no new source.png';
  if (step === 'model') return newer(path.join(dir, 'model-local.glb'), since) ? null : 'the 3D step made no model (is the PC on and the connection right?)';
  if (step === 'post') return ['low', 'mid', 'high'].every((l) => newer(path.join(dir, `${l}.glb`), since)) ? null : 'the post step made no new levels';
  return newer(path.join(paths.genDir, `${id}.glb`), since) && newer(path.join(paths.hdDir, id, 'high.gltf'), since) ? null : 'the pack step wrote nothing (no levels to pack?)';
}

/** The preconditions of a step, checked before any file moves. A reply when the step must not run. */
function precheck(paths: BenchPaths, id: string, step: Step): Reply | null {
  const dir = assetDirOf(paths, id);
  if (step === 'model') {
    if (!existsIn(dir, 'source.png')) return json(422, { ok: false, why: 'make a new image first' });
    if (!existsIn(dir, 'approved')) return json(422, { ok: false, why: 'use the new image first (approve it)' });
    if (!connectionOf(paths).connected) return json(422, { ok: false, why: 'connect the 3D AI first' });
  } else if (step === 'post') {
    if (!['model-mv.glb', 'model.glb', 'model-local.glb'].some((f) => existsIn(dir, f))) return json(422, { ok: false, why: 'make the 3D model first' });
  } else if (step === 'pack') {
    if (!['low', 'mid', 'high'].every((l) => existsIn(dir, `${l}.glb`))) return json(422, { ok: false, why: 'process the model first' });
  }
  return null;
}

/** Archives what a step will overwrite, then starts the job. The route answers 202 and the page polls GET /job. */
function startStep(paths: BenchPaths, jobs: JobRunner, id: string, step: Step, mock: boolean): Reply {
  if (jobs.running) return json(409, { ok: false, why: 'another job is running' });
  const dir = assetDirOf(paths, id);
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date();
  let archived: string | null = null;
  if (step !== 'pack') {
    const plan = PLAN[step];
    archived = archiveFiles(paths, id, step, plan.names, plan.move, at);
  }
  const since = Date.now();
  const onFail = (): void => {
    // a failed new image puts the old one back, so the asset never ends up without one
    if (step === 'images' && archived && !existsIn(dir, 'source.png')) restoreArchive(paths, id, archived);
  };
  return startJob(jobs, {
    step,
    assetId: id,
    stages: stagesFor(step, id, mock),
    verify: () => verifyFor(step, paths, id, since),
    onFail,
    logFile: path.join(dir, REDO_LOG),
    secrets: () => secretValues(paths),
  }, { archived });
}

/** Starts a job and answers at once (202); the job runs on and the page polls. */
function startJob(jobs: JobRunner, spec: JobSpec, extra: Record<string, unknown>): Reply {
  jobs.start(spec).catch(() => undefined);
  return json(202, { ok: true, ...extra, job: jobs.view() });
}

const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value) });

/** The reply for one bench request, or null when the path is not the bench's. */
export async function handleBenchRequest(req: Request, paths: BenchPaths, jobs: JobRunner, opts: { mock: boolean }): Promise<Reply | null> {
  if (!req.path.startsWith(BENCH_ROUTE)) return null;
  const refused = localRefusal(req);
  if (refused) return refused;
  const parts = req.path.slice(BENCH_ROUTE.length).split('/').filter((p) => p !== '');
  const [head, a, b, c, d] = parts;
  const m = req.method;
  const bad = (status: number, why: string): Reply => json(status, { ok: false, why });

  const readJsonBody = async (): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; reply: Reply }> => {
    if (!(req.contentType ?? '').toLowerCase().startsWith('application/json')) return { ok: false, reply: bad(415, 'send application/json') };
    let text: string;
    try { text = await req.readBody(BODY_MAX); } catch { return { ok: false, reply: bad(413, 'the request is over 64 KB') }; }
    try {
      const v = JSON.parse(text) as unknown;
      if (typeof v !== 'object' || v === null || Array.isArray(v)) return { ok: false, reply: bad(422, 'expected a JSON object') };
      return { ok: true, value: v as Record<string, unknown> };
    } catch {
      return { ok: false, reply: bad(422, 'the body is not valid JSON') };
    }
  };

  const knownAsset = (id: string | undefined): { id: string; entry: ManifestEntry } | Reply => {
    if (!id || !BENCH_ID.test(id)) return bad(404, 'no such asset');
    const manifest = readManifest(paths.manifestFile);
    const entry = manifest.assets.find((x) => x.id === id);
    return entry ? { id, entry } : bad(404, 'no such asset');
  };

  // ---- the connection (the token never leaves the server)
  if (head === 'connection' && a === undefined) {
    if (m === 'GET') {
      const cn = connectionOf(paths);
      return json(200, { ok: true, provider: 'local3d', connected: cn.connected, source: cn.source, host: cn.connected ? hostOf(cn.url) : '' });
    }
    if (m === 'DELETE') {
      const s = readSecrets(paths.secretsFile);
      delete s.local3d;
      writeSecrets(paths.secretsFile, s);
      const cn = connectionOf(paths);
      return json(200, { ok: true, connected: cn.connected, source: cn.source });
    }
    if (m === 'POST') {
      const body = await readJsonBody();
      if (!body.ok) return body.reply;
      const url = checkUrl(body.value.url);
      if (!url.ok) return bad(422, url.why);
      const token = checkToken(body.value.token);
      if (!token.ok) return bad(422, token.why);
      const s = readSecrets(paths.secretsFile);
      s.local3d = { url: url.value, token: token.value };
      writeSecrets(paths.secretsFile, s);
      const cn = connectionOf(paths);
      return json(200, { ok: true, connected: cn.connected, source: cn.source, host: hostOf(url.value) });
    }
    return bad(405, 'use GET, POST or DELETE');
  }

  if (head === 'test' && a === undefined && m === 'POST') {
    const cn = connectionOf(paths);
    if (!cn.connected || !cn.token) return bad(422, 'connect the 3D AI first');
    try {
      const r = await fetch(`${cn.url.replace(/\/+$/, '')}/health`, { headers: { Authorization: `Bearer ${cn.token}` }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return json(200, { ok: false, why: `the pipeline answered ${r.status}`, status: r.status });
      const j = (await r.json().catch(() => ({}))) as unknown;
      return json(200, { ok: true, status: r.status, host: hostOf(cn.url), detail: summarizeHealth(j) });
    } catch {
      return json(200, { ok: false, why: 'no answer from the pipeline (is the PC on?)' });
    }
  }

  if (head === 'cancel' && a === undefined && m === 'POST') return json(200, { ok: true, cancelled: jobs.cancel() });

  if (head === 'job' && a === undefined && m === 'GET') return json(200, { ok: true, running: jobs.running, job: jobs.view() });

  // ---- one asset
  if (head === 'asset' && m === 'GET') {
    const k = knownAsset(a);
    if ('status' in k) return k;
    return json(200, { ok: true, ...assetInfo(paths, k.id, k.entry, readManifest(paths.manifestFile), jobs) });
  }

  if (head === 'file' && m === 'GET') {
    const k = knownAsset(a);
    if ('status' in k) return k;
    const dir = assetDirOf(paths, k.id);
    let file: string | null = null;
    if (b === 'old' && c !== undefined && d !== undefined) {
      if (readArchive(paths, k.id, c) && (ARCHIVABLE as readonly string[]).includes(d)) file = path.join(dir, 'old', c, d);
    } else if (b !== undefined && c === undefined && (FILE_NAMES as readonly string[]).includes(b)) {
      file = path.join(dir, b);
    }
    if (!file || !fs.existsSync(file)) return bad(404, 'no such file');
    const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.json') ? 'application/json' : 'model/gltf-binary';
    return { status: 200, body: fs.readFileSync(file), type };
  }

  if (head === 'describe' && m === 'POST') {
    const k = knownAsset(a);
    if ('status' in k) return k;
    const body = await readJsonBody();
    if (!body.ok) return body.reply;
    if (Object.keys(body.value).some((x) => x !== 'subject')) return bad(422, 'only the description can change here');
    const subject = checkSubject(body.value.subject);
    if (!subject.ok) return bad(422, subject.why);
    setSubject(paths.manifestFile, k.id, subject.value);
    return json(200, { ok: true, id: k.id, chars: subject.value.length });
  }

  if (head === 'approve' && m === 'POST') {
    const k = knownAsset(a);
    if ('status' in k) return k;
    const dir = assetDirOf(paths, k.id);
    if (!existsIn(dir, 'source.png')) return bad(422, 'there is no image to use yet');
    fs.writeFileSync(path.join(dir, 'approved'), '');
    return json(200, { ok: true, approved: true });
  }

  if (head === 'step' && m === 'POST') {
    if (!a || !isStep(a)) return bad(404, 'no such step');
    const k = knownAsset(b);
    if ('status' in k) return k;
    if (jobs.running) return bad(409, 'another job is running');
    const pre = precheck(paths, k.id, a);
    if (pre) return pre;
    return startStep(paths, jobs, k.id, a, opts.mock);
  }

  if (head === 'revert' && m === 'POST') {
    const k = knownAsset(a);
    if ('status' in k) return k;
    if (!b || !readArchive(paths, k.id, b)) return bad(404, 'no such archive');
    if (jobs.running) return bad(409, 'another job is running');
    const dir = assetDirOf(paths, k.id);
    const arch = readArchive(paths, k.id, b);
    // revert is itself reversible: the files it is about to replace are archived first
    const archivedAs = archiveFiles(paths, k.id, 'revert', arch?.files ?? [], [], new Date());
    restoreArchive(paths, k.id, b);
    const since = Date.now();
    return startJob(jobs, {
      step: 'revert',
      assetId: k.id,
      // the same pack step as the Redo panel's own pack (the fixture in the test run, so a test never packs the repository)
      stages: stagesFor('pack', k.id, opts.mock),
      verify: () => (newer(path.join(paths.hdDir, k.id, 'high.gltf'), since) && newer(path.join(paths.genDir, `${k.id}.glb`), since) ? null : 'the pack after the revert wrote nothing'),
      logFile: path.join(dir, REDO_LOG),
      secrets: () => secretValues(paths),
    }, { reverted: b, archivedAs });
  }

  return bad(404, 'no such bench route');
}

/** The summary the Redo panel reads for one asset: its description, its files, its archives, its packed sizes. */
function assetInfo(paths: BenchPaths, id: string, entry: ManifestEntry, m: Manifest, jobs: JobRunner): Record<string, unknown> {
  const dir = assetDirOf(paths, id);
  const has = (f: string): boolean => existsIn(dir, f);
  const size = (f: string): number | null => (fs.existsSync(f) ? fs.statSync(f).size : null);
  const hdDir = path.join(paths.hdDir, id);
  const hdBytes = fs.existsSync(hdDir) ? fs.readdirSync(hdDir).reduce((n, f) => n + (size(path.join(hdDir, f)) ?? 0), 0) : null;
  const cn = connectionOf(paths);
  const model = ['model-mv.glb', 'model.glb', 'model-local.glb'].find((f) => has(f)) ?? null;
  const budgets = (entry.budgets as number[] | undefined) ?? m.budgets[entry.class] ?? null;
  const job = jobs.view();
  return {
    id,
    entry: {
      class: entry.class,
      subject: entry.subject,
      view: entry.view ?? null,
      size: entry.size ?? null,
      axis: entry.axis ?? null,
      panel: entry.panel ?? null,
      budgets,
    },
    files: {
      source: has('source.png'),
      sourceJson: has('source.png.json'),
      approved: has('approved'),
      model,
    },
    levels: { low: has('low.glb'), mid: has('mid.glb'), high: has('high.glb') },
    packed: {
      lowBytes: size(path.join(paths.genDir, `${id}.glb`)),
      hdBytes,
      hdLevels: { mid: fs.existsSync(path.join(hdDir, 'mid.gltf')), high: fs.existsSync(path.join(hdDir, 'high.gltf')) },
    },
    archives: listArchives(paths, id),
    connection: { connected: cn.connected, source: cn.source, host: cn.connected ? hostOf(cn.url) : '' },
    jobRunning: jobs.running,
    job: job && job.assetId === id ? job : null,
  };
}
