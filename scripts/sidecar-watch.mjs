// The live channel between the two agents that share this working tree (docs/SIDECAR_COMMS.md section 5).
//   node scripts/sidecar-watch.mjs --me opus      (Claude Opus runs this)
//   node scripts/sidecar-watch.mjs --me flash     (Gemini Flash runs this)
// Options: --every <s> (local poll, default 20), --remote <s> (git fetch, default 300; 0 = never).
// Prints one line per event and is quiet otherwise:
//   BOARD  a new entry on the board addressed by the other agent or the owner
//   COMMIT a new commit by the other agent (local, or pushed to origin)
//   BRANCH the shared tree switched branch (a hard stop for both agents: see the board's rules)
// Who wrote a commit: Opus commits carry "Co-Authored-By: Claude", Flash commits carry "Agent: Gemini-Flash".
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (key, fallback) => { const i = args.indexOf(`--${key}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const me = String(opt('me', '')).toUpperCase();
if (me !== 'OPUS' && me !== 'FLASH') { console.error('usage: node scripts/sidecar-watch.mjs --me opus|flash [--every 20] [--remote 300]'); process.exit(2); }
const everyMs = Math.max(2, Number(opt('every', '20'))) * 1000;
const remoteMs = Math.max(0, Number(opt('remote', '300'))) * 1000;

const root = fileURLToPath(new URL('../', import.meta.url));
const board = fileURLToPath(new URL('../docs/SIDECAR_COMMS.md', import.meta.url));
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const say = (line) => process.stdout.write(`${line}\n`);

// "### [2026-10-10 03:40] FLASH → OPUS: [DONE] subject" (an ASCII "->" works too)
const HEADER = /^###\s*\[([^\]]+)\]\s*(OPUS|FLASH|OWNER)\s*(?:→|->)\s*(OPUS|FLASH|OWNER|ALL)\s*[:—-]\s*(.*)$/;
const entries = () => {
  let text = '';
  try { text = readFileSync(board, 'utf8'); } catch { return []; }
  return text.split(/\r?\n/).filter((l) => HEADER.test(l));
};
const byOpus = (body) => /Co-Authored-By:\s*Claude/i.test(body);
const byFlash = (body) => /^Agent:\s*Gemini-Flash/im.test(body);
// anything not carrying my own trailer is news to me (the owner's commits reach both agents)
const fromOther = (body) => (me === 'OPUS' ? !byOpus(body) : !byFlash(body));

const seenEntries = new Set(entries());
const seenCommits = new Set();
let branch = git('rev-parse', '--abbrev-ref', 'HEAD');
let head = git('rev-parse', 'HEAD');
let remoteRef = branch ? `origin/${branch}` : '';
let remoteTip = remoteRef ? git('rev-parse', '--verify', '--quiet', remoteRef) : '';

function newCommits(from, to) {
  if (!from || !to || from === to) return [];
  const out = git('log', '--format=%H%x1f%an%x1f%s%x1f%b%x1e', `${from}..${to}`);
  return out.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => { const [sha = '', author = '', subject = '', body = ''] = r.split('\x1f'); return { sha, author, subject, body }; }).reverse();
}
function report(list, where) {
  for (const c of list) {
    if (seenCommits.has(c.sha)) continue;
    seenCommits.add(c.sha);
    if (fromOther(c.body)) say(`COMMIT ${where} ${c.sha.slice(0, 8)} ${c.subject}`);
  }
}

function pollLocal() {
  for (const line of entries()) {
    if (seenEntries.has(line)) continue;
    seenEntries.add(line);
    const m = HEADER.exec(line);
    if (m && m[2] !== me) say(`BOARD ${m[2]} -> ${m[3]} [${m[1]}] ${m[4]}`);
  }
  const nowBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (nowBranch && branch && nowBranch !== branch) say(`BRANCH the shared tree moved from ${branch} to ${nowBranch}`);
  if (nowBranch) { branch = nowBranch; remoteRef = `origin/${branch}`; }
  const nowHead = git('rev-parse', 'HEAD');
  if (nowHead && nowHead !== head) { report(newCommits(head, nowHead), 'local'); head = nowHead; }
}
function pollRemote() {
  if (!branch || branch === 'HEAD') return;
  git('fetch', '--quiet', 'origin', branch);
  const tip = git('rev-parse', '--verify', '--quiet', remoteRef);
  if (tip && tip !== remoteTip) { if (remoteTip) report(newCommits(remoteTip, tip), 'pushed'); remoteTip = tip; }
}

say(`WATCHING as ${me}: board ${seenEntries.size} entries, ${branch} at ${head.slice(0, 8)}${remoteMs ? `, origin every ${remoteMs / 1000}s` : ''}`);
setInterval(pollLocal, everyMs);
if (remoteMs) setInterval(pollRemote, remoteMs);
