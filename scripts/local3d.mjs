// Client for the owner's local Hunyuan3D pipeline (RTX 3080 PC on the LAN, REST on :8082).
//   node scripts/local3d.mjs health
//   node scripts/local3d.mjs model <id> [--no-texture]     one asset from docs/runworld/assets.json
//   node scripts/local3d.mjs models [id ...] [--no-texture] every approved asset without a local model
//   add --views to send the four turnaround crops as a multi-view job (writes model-mv.glb)
// Jobs are submitted and polled (POST /jobs, GET /jobs/{id}), so a slow job never hits a client timeout, unlike the
// RUN CLI's 600 s cap. Each request has its own timeout; if the pipeline stops answering (PC off or restarting) the
// client waits, checking every minute, and resubmits a job the restarted server no longer knows. The source image is sent as base64 from zips/runworld/assets/<id>/source.png; the result
// lands as model-local.glb beside it. The bearer token and the URL are never printed. They come from the Studio's
// connection, .studio-secrets.json at the repo root (its local3d block: url and token), when it has a token; otherwise
// from .local3d-token (the older file, still git-ignored). LOCAL3D_URL, when set, overrides the URL.
// The 3080 runs one heavy GPU job at a time, so this submits one job and waits for it before the next.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const secretsFile = path.join(ROOT, '.studio-secrets.json');
const stored = (() => {
  try { return fs.existsSync(secretsFile) ? (JSON.parse(fs.readFileSync(secretsFile, 'utf8')).local3d ?? {}) : {}; } catch { return {}; }
})();
const tokenFile = path.join(ROOT, '.local3d-token');
const token = String(stored.token || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : '')).trim();
if (!token) { console.log('no 3D AI token: connect it in the Studio (its Redo panel), or put it in .local3d-token (one line)'); process.exit(2); }
const BASE = (process.env.LOCAL3D_URL ?? '').trim() || stored.url || 'http://192.168.0.9:8082';
const auth = { Authorization: `Bearer ${token}` };
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
const args = process.argv.slice(2), texture = !args.includes('--no-texture');
const [cmd, ...ids] = args.filter((a) => !a.startsWith('--'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every request times out (the server hung once overnight and a fetch with no timeout waited forever).
async function api(method, p, body, timeoutMs = 60000) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

/** Wait until /health answers (the PC may be off, asleep or restarting its pipeline): check every minute. */
async function waitForServer() {
  for (let n = 0; ; n++) {
    try { await api('GET', '/health', undefined, 15000); if (n > 0) console.log('  pipeline is back'); return; } catch {
      if (n === 0) console.log('  pipeline not answering; waiting (checks every 60 s)');
      await sleep(60000);
    }
  }
}

// --views: the multi-view job (Hunyuan3D-2mv shape, then the 2.0 paint stage; docs/prompts/local3d/01-...): the
// four crops from `runworld-assets.mjs views` go up as `views`, and the result is model-mv.glb, kept beside the
// single-view model-local.glb so the two can be compared; the post step prefers model-mv.glb when it exists
const multiView = args.includes('--views');
const SIDES = ['front', 'left', 'back', 'right'];

async function one(id) {
  const d = path.join(OUT, id), png = path.join(d, 'source.png'), out = path.join(d, multiView ? 'model-mv.glb' : 'model-local.glb');
  const b64 = (f) => fs.readFileSync(f).toString('base64');
  let body;
  if (multiView) {
    // `mvSkip` drops views reviewed as wrong (a flat chassis's "back" came out as a copy of its front)
    const skip = manifest.assets.find((x) => x.id === id)?.mvSkip ?? [];
    const sides = SIDES.filter((s) => !skip.includes(s));
    const files = sides.map((s) => path.join(d, 'views', `${s}.png`));
    if (!sides.includes('front') || !files.every((f) => fs.existsSync(f))) { console.log(`${id}: no views (run runworld-assets.mjs views ${id})`); return; }
    body = { views: Object.fromEntries(sides.map((s, i) => [s, b64(files[i])])), texture };
  } else {
    if (!fs.existsSync(png)) { console.log(`${id}: no source.png`); return; }
    body = { image_base64: b64(png), texture };
  }
  const t0 = Date.now();
  await waitForServer();
  // a stable reference for this exact input, so a resubmit after a restart can never start the same work twice
  // (the server returns the existing job for a known client_ref once it supports it; until then it is ignored)
  const client_ref = `${id}-${multiView ? 'mv' : 'sv'}-${createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12)}`;
  const job = await api('POST', '/jobs', { ...body, client_ref }, 120000);
  const jobId = job.job_id ?? job.id ?? job.jobId;
  if (!jobId) throw new Error(`no job id in ${JSON.stringify(job).slice(0, 200)}`);
  console.log(`${id}: job ${jobId} submitted`);
  if (!(await collect(id, jobId, out, t0))) { console.log(`  ${id}: job lost in a restart; resubmitting`); return one(id); }
}

/** Wait for a job to finish and download its GLB to `out`; false if the server no longer knows the job. */
async function collect(id, jobId, out, t0 = Date.now()) {
  let last = '';
  for (;;) {
    await sleep(10000);
    let s;
    try { s = await api('GET', `/jobs/${jobId}`); } catch {
      // the server went away mid-job: wait for it, then check whether it still knows the job
      await waitForServer();
      try { s = await api('GET', `/jobs/${jobId}`); } catch { return false; }
    }
    const status = String(s.status ?? s.state ?? '');
    if (status !== last) { console.log(`  ${id}: ${status} (${Math.round((Date.now() - t0) / 1000)} s)`); last = status; }
    if (/fail|error/i.test(status)) throw new Error(`${id}: job failed: ${JSON.stringify(s).slice(0, 300)}`);
    if (/done|complete|succeed|finished/i.test(status)) break;
  }
  const r = await fetch(`${BASE}/files/${jobId}.glb`, { headers: auth, signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error(`${id}: download ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`${id}: ${Math.round(fs.statSync(out).size / 1024)} KB in ${Math.round((Date.now() - t0) / 1000)} s -> ${path.relative(ROOT, out)}`);
  return true;
}

if (cmd === 'health') console.log(JSON.stringify(await api('GET', '/health')));
// the shared ledger with the 3D PC's agent (C:\Work\repo\ai-stack\PIPELINE-SYNC.md there), via GET/POST /sync:
//   sync [--all]       its last 60 lines (or all of it)
//   log <entry ...>    append a dated entry, signed as from this laptop
else if (cmd === 'sync') {
  const r = await api('GET', '/sync');
  const text = typeof r === 'string' ? r : String(r.text ?? r.content ?? JSON.stringify(r, null, 2));
  console.log(args.includes('--all') ? text : text.split('\n').slice(-60).join('\n'));
} else if (cmd === 'log' && ids.length) console.log(JSON.stringify(await api('POST', '/sync', { entry: `[Claude, laptop 192.168.0.7] ${ids.join(' ')}` })));
else if (cmd === 'model' && ids[0]) await one(ids[0]);
// fetch <asset> <jobId>: collect a job submitted earlier (by a client since stopped) into the asset's model file
else if (cmd === 'fetch' && ids[0] && ids[1]) {
  const out = path.join(OUT, ids[0], multiView ? 'model-mv.glb' : 'model-local.glb');
  if (!(await collect(ids[0], ids[1], out))) console.log(`${ids[0]}: the server no longer knows job ${ids[1]}`);
}
else if (cmd === 'models') {
  for (const a of manifest.assets.filter((x) => ids.length === 0 || ids.includes(x.id))) {
    const d = path.join(OUT, a.id);
    // skip an asset that already has a model of this kind (a single-view run also counts RUN's model.glb)
    const have = multiView ? ['model-mv.glb'] : ['model-local.glb', 'model.glb'];
    if (!fs.existsSync(path.join(d, 'approved')) || have.some((f) => fs.existsSync(path.join(d, f)))) continue;
    try { await one(a.id); } catch (e) { console.log(String(e.message ?? e)); }
  }
} else { console.log('usage: node scripts/local3d.mjs health | sync [--all] | log <entry> | model <id> | models [id ...] [--no-texture] [--views]'); process.exit(2); }
