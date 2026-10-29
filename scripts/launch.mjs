#!/usr/bin/env node
/**
 * One launcher for "play FIDELITY with the AI beside me" (owner, 29 Oct: "if I'm struggling to follow the steps, automate
 * and simplify"). Double-click PLAY-WITH-AI.bat, or:
 *
 *   node scripts/launch.mjs [--no-capital] [--no-browser] [--check]
 *
 * It does, in order, and says what it is doing in plain words:
 *   1. checks: Node, this repo's packages, and (unless --no-capital) c:\CapitalEmpire's packages, installing them when
 *      its package-lock.json is newer than its node_modules (a git pull that changed dependencies);
 *   2. starts what is not already running, reusing anything that already answers on its port:
 *        the Neural Bridge        http://localhost:8220   (scripts/companion-bridge.mjs)
 *        the companion's brain    (scripts/companion-agent.mjs: Claude / Gemini / Ollama when available)
 *        FIDELITY                 http://localhost:5173   (the dev server)
 *        Capital Empire           http://localhost:5174   (c:\CapitalEmpire's dev server)
 *   3. opens the browser on each once it answers, and prints the four things to do next;
 *   4. Ctrl+C (or closing the window) stops everything it started, and only that.
 *
 * API keys for a real AI brain go in .env.local in this folder (gitignored, never committed), one per line:
 *   ANTHROPIC_API_KEY=...      or   GEMINI_API_KEY=...      (or run Ollama locally; nothing to set)
 * `--check` runs step 1 and reports the ports, then exits (used to verify the launcher itself).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CAPITAL = process.env.CAPITAL_EMPIRE_DIR ?? 'c:\\CapitalEmpire';
const args = new Set(process.argv.slice(2));
const WITH_CAPITAL = !args.has('--no-capital') && fs.existsSync(path.join(CAPITAL, 'package.json'));
const OPEN_BROWSER = !args.has('--no-browser');
const CHECK_ONLY = args.has('--check');
const WIN = process.platform === 'win32';

const C = { dim: '\x1b[90m', ok: '\x1b[32m', warn: '\x1b[33m', bad: '\x1b[31m', hi: '\x1b[36m', vio: '\x1b[35m', off: '\x1b[0m' };
const say = (s) => console.log(s);
const step = (s) => say(`${C.hi}>>${C.off} ${s}`);
const good = (s) => say(`   ${C.ok}ok${C.off}  ${s}`);
const warn = (s) => say(`   ${C.warn}!!${C.off}  ${s}`);
const fail = (s) => { say(`\n${C.bad}STOPPED:${C.off} ${s}\n`); process.exit(1); };

// ---- the keys file: KEY=value lines, read into this process (and so into the brain it starts) ----
function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return [];
  const set = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (value && !process.env[m[1]]) { process.env[m[1]] = value; set.push(m[1]); }
  }
  return set;
}

/** Whether something answers HTTP on this URL within the timeout. */
async function answers(url, ms = 1500) {
  try { await fetch(url, { signal: AbortSignal.timeout(ms) }); return true; } catch { return false; }
}
async function waitFor(url, label, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await answers(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  warn(`${label} did not answer on ${url} after ${seconds} s: its lines above say why.`);
  return false;
}

/** npm install in a folder when its lock file is newer than what is installed (or nothing is installed). */
function ensurePackages(dir, label) {
  const lock = path.join(dir, 'package-lock.json');
  const installed = path.join(dir, 'node_modules', '.package-lock.json');
  const stale = !fs.existsSync(installed) || (fs.existsSync(lock) && fs.statSync(lock).mtimeMs > fs.statSync(installed).mtimeMs);
  if (!stale) { good(`${label}: packages up to date`); return; }
  if (CHECK_ONLY) { warn(`${label}: packages are older than its package-lock.json; the launcher installs them when it runs`); return; }
  step(`${label}: its packages changed since they were installed; installing (a minute or two, once)...`);
  const r = spawnSync(WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail(`npm install in ${dir} failed. Tell Claude what the lines above say.`);
  good(`${label}: packages installed`);
}

// ---- the processes it starts, each line tagged; all stopped on exit ----
const children = [];
function start(tag, color, cmd, cmdArgs, cwd, env = {}) {
  // On Windows, running node.exe with shell: true fails because 'C:\Program Files' has spaces.
  // Shell is only needed for .cmd/.bat scripts like npm.cmd.
  const needsShell = WIN && (cmd.endsWith('.cmd') || cmd.endsWith('.bat'));
  const child = spawn(cmd, cmdArgs, { cwd, env: { ...process.env, ...env, FORCE_COLOR: '1' }, shell: needsShell, windowsHide: true });
  children.push({ tag, child });
  const prefix = `${color}[${tag}]${C.off} `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.on('data', (d) => {
      const lines = (rest + d).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) process.stdout.write(`${prefix}${l}\n`);
    });
  }
  child.on('exit', (code) => { if (!stopping) warn(`${tag} stopped (exit ${code ?? 'signal'}).`); });
  return child;
}
let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  if (children.length === 0) return;
  say(`\n${C.dim}Stopping what the launcher started...${C.off}`);
  for (const { child } of children) {
    if (child.exitCode !== null) continue;
    // npm and vite run under a shell on Windows: the whole tree goes, or vite keeps the port
    if (WIN) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}
process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });

function openBrowser(url) {
  if (!OPEN_BROWSER) return;
  if (WIN) spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

// ===================================================================================================================
say(`${C.vio}═══════════════════════════════════════════════════════════════════${C.off}`);
say(`${C.vio}  FIDELITY  //  play with the AI beside you${C.off}`);
say(`${C.vio}═══════════════════════════════════════════════════════════════════${C.off}`);

step('Checking this PC');
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) fail(`Node ${process.versions.node} is too old: install Node 20 or newer from https://nodejs.org`);
good(`Node ${process.versions.node}`);
ensurePackages(ROOT, 'FIDELITY');
if (WITH_CAPITAL) ensurePackages(CAPITAL, 'Capital Empire');
else warn(args.has('--no-capital') ? 'Capital Empire skipped (--no-capital)' : `Capital Empire not found at ${CAPITAL}: playing FIDELITY alone`);

const keys = loadEnvLocal();
const brainKey = process.env.ANTHROPIC_API_KEY ? 'Claude (ANTHROPIC_API_KEY)' : process.env.GEMINI_API_KEY ? 'Gemini (GEMINI_API_KEY)' : null;
const ollama = !brainKey && (await answers('http://localhost:11434/api/tags'));
if (brainKey) good(`AI brain: ${brainKey}${keys.length ? ' from .env.local' : ''}`);
else if (ollama) good('AI brain: Ollama, running on this PC');
else warn('No AI brain set: the companion answers from keywords only. For a real AI, put ANTHROPIC_API_KEY=... or GEMINI_API_KEY=... in .env.local in this folder, or run Ollama.');

const PORTS = { bridge: 'http://localhost:8220/status', fidelity: 'http://localhost:5173/', capital: 'http://localhost:5174/' };
const running = {
  bridge: await answers(PORTS.bridge),
  fidelity: await answers(PORTS.fidelity),
  capital: WITH_CAPITAL && (await answers(PORTS.capital)),
};
if (CHECK_ONLY) {
  for (const [k, v] of Object.entries(running)) say(`   ${v ? `${C.ok}up${C.off}  ` : `${C.dim}free${C.off}`}  ${k} (${PORTS[k]})`);
  say(`\n${C.ok}Check done.${C.off} Run without --check to start everything.`);
} else {

step('Starting');
if (running.bridge) good('Neural Bridge already running on :8220 (reused)');
else start('bridge', C.vio, process.execPath, ['scripts/companion-bridge.mjs'], ROOT);
if (!running.bridge && !(await waitFor(PORTS.bridge, 'The Neural Bridge', 15))) fail('the Neural Bridge did not start.');
// the brain: started unless an AI already reads this bridge (two would answer every line twice)
const agentLinked = running.bridge && (await fetch(PORTS.bridge).then((r) => r.json()).then((s) => s.agentLinked === true).catch(() => false));
if (agentLinked) good('An AI brain is already attached to the bridge (reused)');
else start('brain', C.hi, process.execPath, ['scripts/companion-agent.mjs'], ROOT);

if (running.fidelity) good('FIDELITY already running on :5173 (reused)');
else start('fidelity', C.ok, WIN ? 'npm.cmd' : 'npm', ['run', 'dev', '-w', '@hm/web', '--', '--port', '5173', '--strictPort'], ROOT);
if (WITH_CAPITAL) {
  if (running.capital) good('Capital Empire already running on :5174 (reused)');
  else start('capital', C.warn, WIN ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', '5174', '--strictPort'], CAPITAL);
}

const fidelityUp = running.fidelity || (await waitFor(PORTS.fidelity, 'FIDELITY', 90));
const capitalUp = WITH_CAPITAL && (running.capital || (await waitFor(PORTS.capital, 'Capital Empire', 90)));
if (capitalUp) openBrowser('http://localhost:5174/');
if (fidelityUp) openBrowser('http://localhost:5173/');

say('');
say(`${C.vio}═══════════════════════════════════════════════════════════════════${C.off}`);
say(`${C.ok}  READY.${C.off} Leave this window open; close it (or Ctrl+C) to stop everything.`);
say(`${C.vio}───────────────────────────────────────────────────────────────────${C.off}`);
say(`  1. In FIDELITY (the browser tab that just opened), click ${C.hi}Expedition${C.off}.`);
say(`  2. ${C.hi}Hold T${C.off} and talk (release to send), or press ${C.hi}Enter${C.off} and type.`);
say(`     Try: "hello", "float in front of me", "follow me", "speak afrikaans".`);
if (capitalUp) {
  say(`  3. Capital Empire is open in its own tab. To show it inside FIDELITY: on the menu's`);
  say(`     ${C.hi}Game bridge${C.off} card click ${C.hi}Link a game window${C.off} and pick the Capital Empire tab.`);
}
say(`  ${capitalUp ? '4' : '3'}. The brain's replies and everything you say also appear in this window ${C.dim}[brain] [bridge]${C.off}.`);
say(`${C.vio}═══════════════════════════════════════════════════════════════════${C.off}`);
}

