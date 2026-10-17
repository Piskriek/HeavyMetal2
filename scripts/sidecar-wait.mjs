// Blocks until there is something for an agent to do, then prints it and exits: the wake-up for a sidecar loop.
//   node scripts/sidecar-wait.mjs --job docs/sidecar/FLASH_INBOX.md [--max-min 10]
//     exits 0 and prints the first "## F-NN [OPEN] title" job's whole section; exits 3 if none opened in time.
//   node scripts/sidecar-wait.mjs --change docs/sidecar/FLASH_OUTBOX.md [--max-min 30]
//     exits 0 and prints what was added once the file changes; exits 3 if it did not change in time.
// It only reads files in the shared working tree (no git, no network), polling every 15 s.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (key) => { const i = args.indexOf(`--${key}`); return i >= 0 ? args[i + 1] : undefined; };
const jobFile = opt('job'), changeFile = opt('change');
const maxMs = Math.max(1, Number(opt('max-min') ?? (jobFile ? 10 : 30))) * 60_000;
if (!jobFile === !changeFile) { console.error('usage: --job <inbox.md> | --change <file> [--max-min N]'); process.exit(2); }
const file = resolve(jobFile ?? changeFile);
const read = () => (existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADING = /^## (F-\d+) \[(OPEN|TAKEN|DONE|HELD)\] (.*)$/;
/** The first OPEN job: its id, title and section text (up to the next "## " heading). */
const openJob = (text) => {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => HEADING.exec(l)?.[2] === 'OPEN');
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start, end < 0 ? undefined : end).join('\n').trim();
};

const startedAt = Date.now();
const before = read();
for (;;) {
  const now = read();
  if (jobFile) {
    const job = openJob(now);
    if (job) { console.log(job); process.exit(0); }
  } else if (now !== before) {
    console.log(now.startsWith(before) ? now.slice(before.length).trim() : now.split('\n').slice(-40).join('\n'));
    process.exit(0);
  }
  if (Date.now() - startedAt >= maxMs) {
    const states = [...now.matchAll(/^## (F-\d+) \[(\w+)\]/gm)].map((m) => `${m[1]} ${m[2]}`).join(', ');
    console.log(jobFile ? `WAITING: no open job (${states || 'inbox empty'}). Run me again.` : 'NO CHANGE yet. Run me again.');
    process.exit(3);
  }
  await sleep(15_000);
}
