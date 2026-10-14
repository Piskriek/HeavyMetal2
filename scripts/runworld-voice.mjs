// Voices the narration script (docs/NARRATION_SCRIPT.md) in the FIDELITY Mentor voice on RUN.world.
//   node scripts/runworld-voice.mjs [ID ...]        e.g. A1-01 S-2; default: every line not yet voiced
// Reads each table row's ID and its quoted line, strips the **[canon]** marker, keeps the ElevenLabs v3 audio tags
// ([breathes], [pause] ...), and skips lines marked truncated (the owner owes their endings). One call at a time with
// the rate-limit backoff; files land in apps/web/public/vo/<ID>.mp3 (shipped beside index.html, like shareware/).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNDOT = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Rundot', 'rundot.exe');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'vo');
const VOICE = 'eBTgYm9Qho6PFSGSs2wn';
const only = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const lines = [];
for (const row of fs.readFileSync(path.join(ROOT, 'docs', 'NARRATION_SCRIPT.md'), 'utf8').split('\n')) {
  const cells = row.split('|').map((c) => c.trim());
  const id = cells[1];
  // ids like A1-01, S-2, and the named lines Argo writes (A4-LEAK-SEAL, A6-LEAK-SURGE)
  if (!id || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/.test(id)) continue;
  const raw = cells[cells.length - 2] ?? '';
  if (/truncated/i.test(raw)) { console.log(`${id}: skipped (truncated in the bible; the owner owes its ending)`); continue; }
  const m = /"(.+)"/.exec(raw);
  if (!m) continue;
  lines.push({ id, text: m[1].replace(/\*\*\[canon\]\*\*\s*/g, '').trim() });
}

let chars = 0;
for (const { id, text } of lines.filter((l) => only.length === 0 || only.includes(l.id))) {
  const out = path.join(OUT, `${id}.mp3`);
  if (fs.existsSync(out)) continue;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = spawnSync(RUNDOT, ['generate', 'tts', '--text', text, '--voice-id', VOICE, '--model', 'eleven_v3', '--stability', '0.4', '--out', out], { encoding: 'utf8', env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' }, timeout: 5 * 60 * 1000 });
    const res = `${r.stdout ?? ''}${r.stderr ?? ''}`, wait = /retry in (\d+)/i.exec(res);
    if (fs.existsSync(out)) { chars += text.length; console.log(`${id}: ${text.length} chars -> vo/${id}.mp3`); break; }
    if (wait) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, (Number(wait[1]) + 3) * 1000); continue; }
    console.log(`${id}: failed: ${res.slice(-200)}`); break;
  }
}
console.log(`voiced ${chars} characters (about ${Math.round(chars * 0.15)} credits)`);
