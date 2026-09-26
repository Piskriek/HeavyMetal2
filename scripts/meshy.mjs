/**
 * Meshy client for the 3D kit (ramps, bridges, caves, cliffs…), with a hard credit ceiling.
 *
 *   node scripts/meshy.mjs balance                      credits left on the account (free)
 *   node scripts/meshy.mjs image <name> <ref.png>       image → textured GLB (≈30 credits)
 *   node scripts/meshy.mjs wait <name>                  poll until done, then download
 *   node scripts/meshy.mjs ledger                       every task this project has paid for
 *
 * The API key is read from C:\MarbleGp\.env.local (MESHY_API_KEY=…, git-ignored) and is only ever
 * sent to api.meshy.ai; it is never printed or written anywhere else. Every task is recorded in
 * art-src/meshy/ledger.json with its credits, and a new task is refused when the ledger plus the
 * task's cost would pass MESHY_CEILING (default 1800). Outputs land in art-src/meshy/<name>/
 * (model.glb, thumbnail.png, task.json); the runtime copy is made by the wiring step, not here.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const API = 'https://api.meshy.ai/openapi/v1';
const OUT = join(root, 'art-src/meshy');
const LEDGER = join(OUT, 'ledger.json');
/** The owner's ceiling (2026-09-26: raised from 1000 to 1800; the account's hard limit is 2021). */
const CEILING = Number(process.env.MESHY_CEILING ?? 1800);
/** Worst-case cost of one textured image-to-3d task on the latest model (Meshy pricing, 2026-09). */
const IMAGE_TASK_COST = 30;

function apiKey() {
  // The key lives in the main checkout; worktrees look there too.
  for (const f of [join(root, '.env.local'), 'C:/MarbleGp/.env.local']) {
    if (!existsSync(f)) continue;
    const line = readFileSync(f, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MESHY_API_KEY='));
    if (line) return line.slice('MESHY_API_KEY='.length).trim();
  }
  throw new Error('No MESHY_API_KEY in .env.local');
}
const headers = () => ({ Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' });
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/*
 * The ledger is one file per task (art-src/meshy/ledger/<taskId>.json), so any number of tasks can
 * run in parallel without one overwriting another's record. ledger.json is the pre-split record, still read.
 */
const LEDGER_DIR = join(OUT, 'ledger');
function ledger() {
  const byId = new Map();
  if (existsSync(LEDGER)) for (const t of JSON.parse(readFileSync(LEDGER, 'utf8'))) byId.set(t.taskId, t);
  if (existsSync(LEDGER_DIR)) for (const f of readdirSync(LEDGER_DIR)) if (f.endsWith('.json')) {
    const t = JSON.parse(readFileSync(join(LEDGER_DIR, f), 'utf8'));
    byId.set(t.taskId, t);
  }
  return [...byId.values()].sort((x, y) => x.at.localeCompare(y.at));
}
const spent = () => ledger().reduce((s, t) => s + (t.credits ?? IMAGE_TASK_COST), 0);
function record(entry) {
  mkdirSync(LEDGER_DIR, { recursive: true });
  const file = join(LEDGER_DIR, `${entry.taskId}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(entry, null, 2) + '\n');
  renameSync(tmp, file);
}

/** The reference as a PNG data URI, with a 14 px frame painted in its corner colour (hides neighbours' slivers). */
function referenceUri(file) {
  const { w, h, data } = decodePng(file);
  const px = Buffer.from(data);
  const bg = [px[0], px[1], px[2]];
  const F = 14;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= F && y >= F && x < w - F && y < h - F) continue;
    const i = (y * w + x) * 4; px[i] = bg[0]; px[i + 1] = bg[1]; px[i + 2] = bg[2]; px[i + 3] = 255;
  }
  const tmp = join(OUT, '.ref-upload.png');
  mkdirSync(OUT, { recursive: true });
  encodePng(tmp, w, h, px);
  return `data:image/png;base64,${readFileSync(tmp).toString('base64')}`;
}

async function image(name, file, extra = {}) {
  if (spent() + IMAGE_TASK_COST > CEILING) throw new Error(`Refused: ${spent()} credits spent, ceiling ${CEILING}`);
  const body = {
    image_url: referenceUri(file),
    ai_model: 'latest',
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 8000,
    should_texture: true,
    enable_pbr: false,
    texture_resolution: '2k',
    target_formats: ['glb'],
    ...extra,
  };
  const { result: taskId } = await call('POST', '/image-to-3d', body);
  record({ name, taskId, kind: 'image-to-3d', ref: file, params: { ...body, image_url: '(data uri)' }, credits: IMAGE_TASK_COST, status: 'PENDING', at: new Date().toISOString() });
  console.log(`${name}: task ${taskId} started (ledger ${spent()} / ${CEILING})`);
  return taskId;
}

async function wait(name) {
  const entry = ledger().filter((t) => t.name === name).at(-1);
  if (!entry) throw new Error(`No task named ${name}`);
  for (;;) {
    const t = await call('GET', `/image-to-3d/${entry.taskId}`);
    if (t.status === 'SUCCEEDED' || t.status === 'FAILED' || t.status === 'CANCELED') {
      record({ ...entry, status: t.status, credits: t.consumed_credits ?? entry.credits });
      if (t.status !== 'SUCCEEDED') throw new Error(`${name}: ${t.status} ${t.task_error?.message ?? ''}`);
      const dir = join(OUT, name);
      mkdirSync(dir, { recursive: true });
      for (const [file, url] of [['model.glb', t.model_urls?.glb], ['thumbnail.png', t.thumbnail_url]]) {
        if (!url) continue;
        const res = await fetch(url);
        writeFileSync(join(dir, file), Buffer.from(await res.arrayBuffer()));
      }
      writeFileSync(join(dir, 'task.json'), JSON.stringify({ ...t, model_urls: undefined, texture_urls: undefined, thumbnail_url: undefined }, null, 2) + '\n');
      console.log(`${name}: done, ${t.consumed_credits ?? '?'} credits → art-src/meshy/${name}/model.glb`);
      return t;
    }
    process.stdout.write(`${name}: ${t.status} ${t.progress ?? 0}%\r`);
    await new Promise((r) => setTimeout(r, 10000));
  }
}

/** A lighter copy of a finished model (5 credits): `tier` names the file, e.g. lod → lod.glb. */
const REMESH_COST = 5;
async function remesh(name, tier, polycount) {
  const source = ledger().filter((t) => t.name === name && t.kind === 'image-to-3d' && t.status === 'SUCCEEDED').at(-1);
  if (!source) throw new Error(`No finished model named ${name}`);
  if (spent() + REMESH_COST > CEILING) throw new Error(`Refused: ${spent()} credits spent, ceiling ${CEILING}`);
  const { result: taskId } = await call('POST', '/remesh', { input_task_id: source.taskId, target_polycount: Number(polycount), topology: 'triangle', target_formats: ['glb'] });
  const entry = { name: `${name}:${tier}`, taskId, kind: 'remesh', source: source.taskId, polycount: Number(polycount), credits: REMESH_COST, status: 'PENDING', at: new Date().toISOString() };
  record(entry);
  for (;;) {
    const t = await call('GET', `/remesh/${taskId}`);
    if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(t.status)) {
      record({ ...entry, status: t.status, credits: t.consumed_credits ?? REMESH_COST });
      if (t.status !== 'SUCCEEDED') throw new Error(`${name}:${tier}: ${t.status} ${t.task_error?.message ?? ''}`);
      const res = await fetch(t.model_urls.glb);
      writeFileSync(join(OUT, name, `${tier}.glb`), Buffer.from(await res.arrayBuffer()));
      console.log(`${name}:${tier} done, ${t.consumed_credits ?? '?'} credits → art-src/meshy/${name}/${tier}.glb`);
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
}

const [cmd, a, b, c] = process.argv.slice(2);
try {
  if (cmd === 'balance') console.log(await call('GET', '/balance'));
  else if (cmd === 'image') await image(a, b);
  else if (cmd === 'wait') await wait(a);
  else if (cmd === 'remesh') await remesh(a, b, c);
  else if (cmd === 'ledger') { for (const t of ledger()) console.log(`${t.name.padEnd(20)} ${t.status.padEnd(10)} ${t.credits}`); console.log(`total ${spent()} / ${CEILING}`); }
  else console.log('usage: balance | image <name> <ref.png> | wait <name> | remesh <name> <tier> <polycount> | ledger');
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
