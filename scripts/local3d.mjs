// Client for the owner's local Hunyuan3D pipeline (RTX 3080 PC on the LAN, REST on :8082).
//   node scripts/local3d.mjs health
//   node scripts/local3d.mjs model <id> [--no-texture]     one asset from docs/runworld/assets.json
//   node scripts/local3d.mjs models [id ...] [--no-texture] every approved asset without a local model
// Jobs are submitted and polled (POST /jobs, GET /jobs/{id}), so a slow job never hits a client timeout, unlike the
// RUN CLI's 600 s cap. Each request has its own timeout; if the pipeline stops answering (PC off or restarting) the
// client waits, checking every minute, and resubmits a job the restarted server no longer knows. The source image is sent as base64 from zips/runworld/assets/<id>/source.png; the result
// lands as model-local.glb beside it. The bearer token is read from .local3d-token (git-ignored) and never printed.
// The 3080 runs one heavy GPU job at a time, so this submits one job and waits for it before the next.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = process.env.LOCAL3D_URL ?? 'http://192.168.0.5:8082';
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const tokenFile = path.join(ROOT, '.local3d-token');
if (!fs.existsSync(tokenFile)) { console.log('missing .local3d-token (the pipeline\'s bearer token, one line)'); process.exit(2); }
const auth = { Authorization: `Bearer ${fs.readFileSync(tokenFile, 'utf8').trim()}` };
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

async function one(id) {
  const d = path.join(OUT, id), png = path.join(d, 'source.png'), out = path.join(d, 'model-local.glb');
  if (!fs.existsSync(png)) { console.log(`${id}: no source.png`); return; }
  const t0 = Date.now();
  await waitForServer();
  const job = await api('POST', '/jobs', { image_base64: fs.readFileSync(png).toString('base64'), texture }, 120000);
  const jobId = job.job_id ?? job.id ?? job.jobId;
  if (!jobId) throw new Error(`no job id in ${JSON.stringify(job).slice(0, 200)}`);
  console.log(`${id}: job ${jobId} submitted`);
  let last = '';
  for (;;) {
    await sleep(10000);
    let s;
    try { s = await api('GET', `/jobs/${jobId}`); } catch (e) {
      // the server went away mid-job: wait for it, then resubmit if it no longer knows the job
      await waitForServer();
      try { s = await api('GET', `/jobs/${jobId}`); } catch { console.log(`  ${id}: job lost in a restart; resubmitting`); return one(id); }
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
}

if (cmd === 'health') console.log(JSON.stringify(await api('GET', '/health')));
else if (cmd === 'model' && ids[0]) await one(ids[0]);
else if (cmd === 'models') {
  for (const a of manifest.assets.filter((x) => ids.length === 0 || ids.includes(x.id))) {
    const d = path.join(OUT, a.id);
    if (!fs.existsSync(path.join(d, 'approved')) || fs.existsSync(path.join(d, 'model-local.glb'))) continue;
    try { await one(a.id); } catch (e) { console.log(String(e.message ?? e)); }
  }
} else { console.log('usage: node scripts/local3d.mjs health | model <id> | models [id ...] [--no-texture]'); process.exit(2); }
