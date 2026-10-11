// Generates the music and sound effects in docs/runworld/audio.json on RUN.world (ElevenLabs), one call at a time.
//   node scripts/runworld-audio.mjs [id ...]        default: every entry not yet generated
// Files land in apps/web/public/audio/<id>.mp3 (shipped beside index.html, like vo/), and apps/web/public/audio/
// index.json lists them for the dev audition page (apps/web/src/dev/audio.html). Nothing is committed until the owner
// has listened. Before every call it reads the balance and stops under the floor (RUNWORLD_FLOOR, default 16000, the
// narrator's reserve); rate limits are retried with the server's backoff.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNDOT = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Rundot', 'rundot.exe');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'audio');
const FLOOR = Number(process.env.RUNWORLD_FLOOR ?? 16000);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'audio.json'), 'utf8'));
const only = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

function rundot(args) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = spawnSync(RUNDOT, args, { encoding: 'utf8', env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' }, timeout: 10 * 60 * 1000 });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const wait = /retry in (\d+)/i.exec(out);
    if (r.status !== 0 && wait) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, (Number(wait[1]) + 3) * 1000); continue; }
    return { ok: r.status === 0, out };
  }
  return { ok: false, out: 'gave up after repeated rate limits' };
}
function balance() {
  const m = /Balance:\s*([\d,\s]+)\s*credits/.exec(rundot(['credits', '--period', 'today']).out);
  return m ? Number(m[1].replace(/[^\d]/g, '')) : NaN;
}

const entries = [
  ...manifest.music.map((e) => ({ ...e, kind: 'music' })),
  ...manifest.sfx.map((e) => ({ ...e, kind: 'sfx' })),
].filter((e) => only.length === 0 || only.includes(e.id));

for (const e of entries) {
  const file = path.join(OUT, `${e.id}.mp3`);
  if (fs.existsSync(file)) continue;
  const b = balance();
  if (!Number.isFinite(b) || b < FLOOR + 500) { console.log(`STOP before ${e.id}: balance ${b}, floor ${FLOOR}`); break; }
  const args = e.kind === 'music'
    ? ['generate', 'music', '--prompt', e.prompt, '--duration', String(e.duration), '--out', file]
    : ['generate', 'sfx', '--description', e.description, '--duration', String(e.duration), '--out', file];
  const r = rundot(args);
  console.log(fs.existsSync(file) ? `${e.id}: ${Math.round(fs.statSync(file).size / 1024)} KB (balance before ${b})` : `${e.id}: FAILED ${r.out.slice(-240).replace(/\s+/g, ' ')}`);
  if (/QUOTA_EXCEEDED|CREDITS_EXHAUSTED|AI_POLICY_DENIED/i.test(r.out)) break;
}

// the CLI writes a <file>.json beside each file (its URL and generation id): keep those out of public/
const META = path.join(ROOT, 'zips', 'runworld', 'audio-meta');
fs.mkdirSync(META, { recursive: true });
for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith('.mp3.json'))) fs.renameSync(path.join(OUT, f), path.join(META, f));

// the audition list: every generated file with its prompt, kind and length
const index = [...manifest.music.map((e) => ({ ...e, kind: 'music' })), ...manifest.sfx.map((e) => ({ ...e, kind: 'sfx' }))]
  .filter((e) => fs.existsSync(path.join(OUT, `${e.id}.mp3`)))
  .map((e) => ({ id: e.id, kind: e.kind, duration: e.duration, text: e.prompt ?? e.description, loop: /seamless loop/i.test(e.prompt ?? e.description) }));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`index: ${index.length} files`);
