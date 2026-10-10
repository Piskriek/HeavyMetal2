// Overnight helper: whenever an asset gains a model (the local 3080 pipeline's or RUN's), make its three levels
// (scripts/runworld-post.mjs) and a review thumbnail of low beside high (scripts/render-thumb.py), then log one line.
//   node scripts/runworld-watch.mjs            (runs until stopped; checks every 60 s)
// Log lines go to stdout and zips/runworld/assets/watch.log: "POSTED <id> <post summary>" or "FAILED <id> <reason>".
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const LOG = path.join(OUT, 'watch.log');
const say = (line) => { console.log(line); fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`); };
const failed = new Set();

for (;;) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
  for (const a of manifest.assets) {
    const d = path.join(OUT, a.id), has = (f) => fs.existsSync(path.join(d, f));
    if (failed.has(a.id) || !(has('model.glb') || has('model-local.glb'))) continue;
    if (!has('high.glb')) {
      const r = spawnSync('node', ['scripts/runworld-post.mjs', a.id], { cwd: ROOT, encoding: 'utf8', timeout: 30 * 60 * 1000 });
      const line = (r.stdout ?? '').split('\n').find((l) => l.startsWith(`${a.id}:`));
      if (r.status !== 0 || !has('high.glb')) { failed.add(a.id); say(`FAILED ${a.id} ${(r.stderr || r.stdout || '').slice(-300).replace(/\s+/g, ' ')}`); continue; }
      say(`POSTED ${line ?? a.id}`);
    }
    if (!has('thumb.png')) {
      spawnSync(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/render-thumb.py', '--', path.join(d, 'thumb.png'), path.join(d, 'low.glb'), path.join(d, 'high.glb')], { cwd: ROOT, encoding: 'utf8', timeout: 10 * 60 * 1000 });
      if (has('thumb.png')) say(`THUMB ${a.id}`);
    }
  }
  await new Promise((r) => setTimeout(r, 60000));
}
