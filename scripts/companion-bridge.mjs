#!/usr/bin/env node
/**
 * In-Game AI Companion Neural Bridge (Plan 48, reworked on the owner's 27 Oct feedback:
 * "i need to be able to connect you or any ai to the game"; Plan 49 adds the ping and kit edits).
 *
 * The RUNNING GAME polls this bridge for commands and pushes everything the player says (held
 * T radio or typed comms), what he pings (middle mouse / Q) and live telemetry as events. ANY outside
 * AI — Claude, Antigravity, a local LLM, or plain curl — drives the companion with three endpoints:
 *
 *   read the conversation:  GET  /events?after=<seq>   -> { events: [{seq, type, text?, target?, ...}] }
 *   act and speak:          POST /command              -> one of the commands below
 *   quick hello:            GET  /companion/say?text=...
 *
 * Commands (POST /command, JSON):
 *   { "action": "say"|"follow"|"goto"|"hover-at"|"hold"|"ground"|"gesture", "text", "target": {"x","z"}, "gesture" }
 *   Plan 49, kit edits (no kitId: the kit Piskriek last pinged):
 *   { "action": "mutate-kit-preset", "kitId"?, "partId"?, "mutation": "strip-hazard"|"restore-hazard"|"reset" }
 *   { "action": "override-kit-part", "kitId"?, "partId" | "paths": [...], "material": "darkSteel" }
 *   { "action": "save-kit-default", "kitId"? }    the game sends the kit's overrides to POST /kit-defaults
 *   Plan 56 W6b, the Higher Self seat (it reads, cues and speaks; it never writes the drone's memory):
 *   { "action": "higher-self-ask" }                               -> an ego-perspective event
 *   { "action": "higher-self-cue", "cues": [{ "of", "t" }, ...] }  1..12 episodes from ego-perspective's cueable, for the next dream
 *   { "action": "higher-self-say", "words": "..." }               the drone says "From my Higher Self: ..." (one line, 300 chars)
 *
 * Events an AI reads (GET /events): player-say {text, intent}, companion-say {text}, telemetry {player, companion},
 *   ping {where, label, target: {x,y,z, normal, entityType, entityId, kitId?, partId?, part?, material?, distance}},
 *   kit-result {action, result}, kit-default-saved {key, file}, command {cmd},
 *   Plan 56: ego-perspective {lines, kundalini, cueable}, ego-dream {line, digest, cuedBy}, higher-self-cue-taken {count},
 *   higher-self-cue-refused {why}.
 *
 * The game's side (companion-chat.tsx polls while the game runs on localhost):
 *   GET  /poll          -> drains queued commands for the companion
 *   POST /event         -> appends an event
 *   POST /kit-defaults  -> {key, overrides}: writes the kit's shipped defaults (apps/web/src/studio-data/kit-defaults.json)
 *   POST /frame?source= -> a JPEG of what the player sees (plan 50: the AI's eyes), saved to shots-run/bridge/frame-<source>.jpg
 *   POST /observe-mechanic -> Plan 51: {game, channel, trajectory? {t,x,y,z}, shots? {t, kick?}, events? [{t,name}]} from any
 *                     permitted observer; relayed to the game as a mimic proposal ("apply the mimic" is the player's word)
 *   GET  /status        -> link state, the latest telemetry, ping and frames
 *   POST /telemetry/<game> -> a game's official telemetry (Valve GSI and the like); GET it for the count and the last payload
 *
 * Plan 50, the drone's orders (the fast brain follows them; kit edits from here are staged for the player's "keep it"):
 *   { "action": "engage", "mode": "weapons-free"|"defend"|"hold-fire" }   { "action": "cover", "side": "left"|"right"|"rear" }
 *   { "action": "focus", "target": <mob id>|"ping"|"nearest"|"biggest"|null }   { "action": "recall" }
 *   { "action": "scout", "category": "weapons"|"enemies"|"resources"|"salvage"|"exits"|... }   { "action": "undo" }   { "action": "keep" }
 *
 * Safety (it writes a file): it listens on 127.0.0.1 only, answers CORS for localhost pages only, refuses writes from any
 * other page's Origin, caps bodies at 64 KB, and writes only shape-checked overrides to the one defaults file, atomically.
 *
 * Usage:
 *   node scripts/companion-bridge.mjs [--port 8220] [--defaults-file <path>]
 *
 * Example session for an AI agent:
 *   curl -s localhost:8220/events | jq        # read what Piskriek said and pinged
 *   curl -s -X POST localhost:8220/command -H 'Content-Type: application/json' \
 *     -d '{"action":"mutate-kit-preset","mutation":"strip-hazard","text":"On it."}'
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const PORT = parseInt(arg('--port') ?? '8220', 10);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULTS_FILE = path.resolve(arg('--defaults-file') ?? path.join(ROOT, 'apps/web/src/studio-data/kit-defaults.json'));
const BODY_CAP = 64 * 1024;
/** A 640x360 JPEG is 20 to 60 KB; anything past this is not a frame. */
const FRAME_CAP = 400 * 1024;
/** An observation can carry minutes of samples (a trajectory at 60 Hz): up to 1 MB. */
const OBSERVATION_CAP = 1024 * 1024;
const FRAME_DIR = path.resolve(arg('--frame-dir') ?? path.join(ROOT, 'shots-run/bridge'));
/** The latest frame per source (game, external), for /status. */
const lastFrames = {};
/** Plan 51 Wave 2: official telemetry payloads are small JSON documents; the queue keeps the newest few hundred. */
const TELEMETRY_CAP = 256 * 1024;
const TELEMETRY_QUEUE = 600;
/** Tests pass the running processes instead of scanning the machine. */
const FAKE_PROCESSES = arg('--fake-processes') ? arg('--fake-processes').split(',').map((s) => s.trim()).filter(Boolean) : null;
/** The permission profiles AIs have written, by game id (kept beside the frames, outside the repo's tracked files). */
const PROFILES_FILE = path.join(path.dirname(FRAME_DIR), 'bridge', 'profiles.json');
const profiles = (() => { try { const p = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); return isRecordLoose(p) ? p : {}; } catch { return {}; } })();
const telemetryCount = {};
/** The last payload each game posted, so an AI writing a mapping (or a person checking one) can see a real one. */
const lastTelemetryPayload = {};
function isRecordLoose(v) { return typeof v === 'object' && v !== null && !Array.isArray(v); }

/** Commands queued for the game to drain on its next /poll. */
const pendingCommands = [];
/** Plan 51 wave 3: the comms client (a game tab) that opened each game's bridge session; its stream is routed there. */
const sessionClients = {};

// ---- Plan 51 wave 3: the cadence sampler (the input-audio floor rung) for games that publish no telemetry ----
/** On by default on Windows while a bridge is live; `--no-sampler` turns it off; `--sampler-replay <file>` plays a recording. */
const NO_SAMPLER = process.argv.includes('--no-sampler');
const SAMPLER_REPLAY = arg('--sampler-replay');
/** Sampler lines go to the game in batches of this many (about 100 ms at 200 Hz); the queue keeps the newest few seconds. */
const CADENCE_BATCH = 20;
const CADENCE_QUEUE = 120;
let sampler = null;
/**
 * Which PowerShell runs the sampler: PowerShell 7 (pwsh) when it is installed, since its own policy (RemoteSigned on this
 * PC) runs a local script, where Windows PowerShell 5.1 is often left Restricted. No policy is changed either way.
 */
let powershellExe = null;
function samplerShell() {
  if (powershellExe) return powershellExe;
  try { execFileSync('pwsh.exe', ['-NoProfile', '-Command', 'exit 0'], { timeout: 20000, windowsHide: true, stdio: 'ignore' }); powershellExe = 'pwsh.exe'; }
  catch { powershellExe = 'powershell.exe'; }
  return powershellExe;
}
function queueCadence(gameId, lines) {
  const queued = pendingCommands.filter((c) => c.action === 'cadence');
  if (queued.length >= CADENCE_QUEUE) pendingCommands.splice(pendingCommands.indexOf(queued[0]), 1);
  pendingCommands.push({ action: 'cadence', gameId, lines, ...(sessionClients[gameId] ? { to: sessionClients[gameId] } : {}) });
}
// ---- Plan 53 §2.6: the mirror. The player plays the bridged game with their own hands; the sampler reads ten keys while
// the game has focus (its 7th column) and every change goes at once to the tab that bridged it (server-sent events), so
// FIDELITY's character does what they press. Read only: nothing is ever pressed into the game (owner, 28 Oct).
const mirrorStreams = new Map();
const mirrorLast = {};
function pushMirror(gameId, mask, t) {
  if (mirrorLast[gameId] === mask) return;
  mirrorLast[gameId] = mask;
  const to = sessionClients[gameId];
  const msg = `data: ${JSON.stringify({ gameId, mask, t })}\n\n`;
  for (const [client, res] of mirrorStreams) if (!to || client === to) { try { res.write(msg); } catch {} }
}
function stopSampler() {
  if (!sampler) return;
  sampler.stop();
  // every mirrored key comes up when the sampler stops: nothing stays held in FIDELITY
  pushMirror(sampler.gameId, 0, -1);
  console.log(`\x1b[35m[SAMPLER]\x1b[0m stopped (${sampler.gameId}, ${sampler.count} samples)`);
  sampler = null;
}
/** Starts sampling the bridged game (its process name), or replays a recorded stream in tests. */
function startSampler(gameId, processName) {
  stopSampler();
  if (NO_SAMPLER) return;
  let buf = [];
  const s = { gameId, count: 0, stop: () => {} };
  const take = (line) => {
    if (!/^\d/.test(line)) return;
    s.count += 1;
    buf.push(line.trim());
    if (buf.length >= CADENCE_BATCH) { queueCadence(gameId, buf); buf = []; }
    const f = line.trim().split(/\s+/);
    // the mirror's keys count only while the game has focus (the sampler zeroes them already; a hand-made stream too)
    pushMirror(gameId, f.length === 7 && f[1] === '1' ? (Number.parseInt(f[6] ?? '0', 10) & 1023) || 0 : 0, Number(f[0]));
  };
  if (SAMPLER_REPLAY && processName) {
    // a recording plays at its own pace (by its t column), so the game sees the timing a live run would give
    const lines = fs.readFileSync(path.resolve(SAMPLER_REPLAY), 'utf8').split(/\r?\n/).filter((l) => /^\d/.test(l));
    const t0 = Date.now();
    let i = 0;
    const timer = setInterval(() => {
      const now = (Date.now() - t0) / 1000;
      while (i < lines.length && Number(lines[i].split(' ')[0]) <= now) take(lines[i++]);
      if (i >= lines.length) clearInterval(timer);
    }, 25);
    s.stop = () => clearInterval(timer);
  } else if (process.platform === 'win32' && processName) {
    // no -ExecutionPolicy change: pwsh's own policy (RemoteSigned) runs a local script
    const child = spawn(samplerShell(), ['-NoProfile', '-File', path.join(ROOT, 'scripts/cadence-sampler.ps1'), '-Process', processName], { stdio: ['ignore', 'pipe', 'pipe'] });
    let rest = '';
    child.stdout.on('data', (d) => { const parts = (rest + d).split(/\r?\n/); rest = parts.pop() ?? ''; for (const l of parts) take(l); });
    child.stderr.on('data', (d) => console.log(`\x1b[31m[SAMPLER]\x1b[0m ${String(d).trim().slice(0, 300)}`));
    child.on('exit', () => { if (sampler === s) sampler = null; });
    s.stop = () => { try { child.kill(); } catch {} };
  } else {
    return;
  }
  sampler = s;
  console.log(`\x1b[35m[SAMPLER]\x1b[0m sampling ${processName ?? gameId}${SAMPLER_REPLAY ? ' (replay)' : ''}: its own audio, and fire/jump/dash only while its window has focus`);
}
process.on('exit', () => stopSampler());

// ---- Plan 53: the input relay. Off unless the player chose it for one bridged game (the box ticked, RELAY typed). Only
// the player's own presses, each carrying the token only their game tab holds (never posted to /events); only
// whitelisted lines: a console +name/-name, or a key from the short list, which the helper presses only while the game's
// own window is in front.
const RELAY_CONSOLE_LINE = /^[+-][a-z][a-z0-9_]{1,23}$/;
const RELAY_KEY_LINE = /^(down|up) (mouse1|mouse2|space|e|f|q|r|shift|ctrl)$/;
const relays = {};
// Owner, 28 Oct: no input into games where it is not allowed. The game's tab checks its profile first (relayAllowed); this
// side refuses on its own, whoever asks, whenever an anti-cheat is running or the game is one it guards (the same process
// list as @hm/gamebridge's detectAntiCheat, plus the VAC games FIDELITY ships a profile for).
const RELAY_ANTI_CHEAT_PROCESS = /easyanticheat|^beservice(_x64)?(\.exe)?$|^(vgc|vgtray)(\.exe)?$|faceit|^pnkbstr[ab](\.exe)?$/i;
const RELAY_GUARDED_GAMES = new Set(['cs2']);
const RELAY_GUARDED_PROCESSES = /^cs2(\.exe)?$/i;
const relayLog = [];
const relayNote = (gameId, text) => {
  relayLog.push({ at: Date.now(), gameId, text });
  if (relayLog.length > 40) relayLog.shift();
  console.log(`\x1b[33m[RELAY]\x1b[0m ${gameId}: ${text}`);
};
function disarmRelay(gameId) {
  const r = relays[gameId];
  if (!r) return;
  try { r.child?.kill(); } catch {}
  try { r.socket?.destroy(); } catch {}
  delete relays[gameId];
  relayNote(gameId, 'off');
}
function relayDeliver(r, line) {
  if (r.transport === 'console-tcp') {
    if (!r.socket || r.socket.destroyed) {
      r.socket = net.connect({ host: '127.0.0.1', port: r.port });
      r.socket.on('error', (err) => { relayNote(r.gameId, `console not reachable on ${r.port} (${err.code ?? err.message}): start the game with ${r.launchOption ?? `-netconport ${r.port}`}`); r.socket?.destroy(); });
    }
    r.socket.write(`${line}\n`);
    relayNote(r.gameId, `sent ${line}`);
    return;
  }
  if (!r.child || r.child.exitCode !== null) {
    r.child = spawn(samplerShell(), ['-NoProfile', '-File', path.join(ROOT, 'scripts/input-relay.ps1'), '-Process', r.process], { stdio: ['pipe', 'pipe', 'pipe'] });
    let rest = '';
    r.child.stdout.on('data', (d) => { const parts = (rest + d).split(/\r?\n/); rest = parts.pop() ?? ''; for (const l of parts) if (l.trim()) relayNote(r.gameId, l.trim()); });
    r.child.stderr.on('data', (d) => relayNote(r.gameId, `helper: ${String(d).trim().slice(0, 200)}`));
  }
  r.child.stdin.write(`${line}\n`);
}
process.on('exit', () => { for (const id of Object.keys(relays)) disarmRelay(id); });
/** The conversation + telemetry log, newest last; seq is monotonic. */
const events = [];
let nextSeq = 1;
const EVENT_CAP = 500;
let lastGamePoll = 0;

function pushEvent(event) {
  events.push({ seq: nextSeq++, at: Date.now(), ...event });
  if (events.length > EVENT_CAP) events.splice(0, events.length - EVENT_CAP);
}

// ---- the kit defaults' shape check: the same rules as apps/web/src/play/kit-defaults.ts ----
const KIT_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:@._-]{0,63}$/;
const PART_PATH_RE = /^[A-Za-z0-9_\-[\]#:][A-Za-z0-9_\-[\]/#:]{0,127}$/;
const MATERIAL_RE = /^[A-Za-z0-9_:.#=+,/-]{1,2048}$/;
const NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_KITS = 64;
const MAX_PATHS = 256;
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const numbers = (v) => (isRecord(v) && Object.entries(v).every(([k, n]) => NAME_RE.test(k) && typeof n === 'number' && Number.isFinite(n)) ? { ...v } : null);
const materials = (v) => (isRecord(v) && Object.entries(v).every(([k, m]) => NAME_RE.test(k) && typeof m === 'string' && MATERIAL_RE.test(m)) ? { ...v } : null);

/** One part's override, or null when any field is wrong. */
function checkPartOverride(v) {
  if (!isRecord(v)) return null;
  const out = {};
  for (const [k, f] of Object.entries(v)) {
    if (k === 'material') { if (typeof f !== 'string' || !MATERIAL_RE.test(f)) return null; out.material = f; }
    else if (k === 'hidden') { if (typeof f !== 'boolean') return null; out.hidden = f; }
    else if (k === 'gen') { if (typeof f !== 'string' || !NAME_RE.test(f)) return null; out.gen = f; }
    else if (k === 'params') { const p = numbers(f); if (!p) return null; out.params = p; }
    else if (k === 'slotMaterials') { const s = materials(f); if (!s) return null; out.slotMaterials = s; }
    else if (k === 'ops') {
      if (!Array.isArray(f) || f.length > 16) return null;
      const ops = [];
      for (const op of f) {
        if (!isRecord(op) || typeof op.op !== 'string' || !NAME_RE.test(op.op)) return null;
        const params = op.params === undefined ? {} : numbers(op.params);
        if (!params) return null;
        ops.push({ op: op.op, params });
      }
      out.ops = ops;
    } else return null;
  }
  return out;
}

/** A kit's overrides, strictly: one bad path or part refuses the whole request (a writer gets told, not silently trimmed). */
function checkKitOverrides(v) {
  if (!isRecord(v)) return { error: 'overrides must be an object of part paths' };
  const entries = Object.entries(v);
  if (entries.length > MAX_PATHS) return { error: `at most ${MAX_PATHS} parts` };
  const out = {};
  for (const [p, o] of entries) {
    if (!PART_PATH_RE.test(p)) return { error: `bad part path: ${JSON.stringify(p).slice(0, 80)}` };
    const c = checkPartOverride(o);
    if (!c) return { error: `bad override on ${p}` };
    out[p] = c;
  }
  return { overrides: out };
}

function readDefaults() {
  try {
    const raw = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
    return isRecord(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Writes the defaults file atomically (a temp file renamed over it), keys sorted so a diff shows only what changed. */
function writeDefaults(all) {
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, Object.fromEntries(Object.keys(all[k]).sort().map((p) => [p, all[k][p]]))]));
  const tmp = `${DEFAULTS_FILE}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(DEFAULTS_FILE), { recursive: true });
  fs.writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
  fs.renameSync(tmp, DEFAULTS_FILE);
  return sorted;
}

// ---- HTTP ----
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** Reads a JSON body up to the cap; resolves the parsed value, or rejects. */
function readJson(req, cap = BODY_CAP) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > cap) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

const json = (res, code, value) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value, null, 2));
};

const handle = async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;
  const origin = req.headers.origin;

  // CORS for the game's own localhost page only; curl and node send no Origin and are local by the listen address
  if (origin && LOCAL_ORIGIN_RE.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  // a page on another site must not drive the game or write files, even with a request the browser sends without asking
  // (an <img> GET carries no Origin, but the browser marks it cross-site: refuse those too)
  const crossSite = req.headers['sec-fetch-site'] === 'cross-site' && !(origin && LOCAL_ORIGIN_RE.test(origin));
  if (crossSite || (req.method === 'POST' && origin && !LOCAL_ORIGIN_RE.test(origin))) {
    json(res, 403, { ok: false, error: 'origin not allowed' });
    return;
  }

  if (pathname === '/status') {
    const lastTelemetry = [...events].reverse().find((e) => e.type === 'telemetry') ?? null;
    const lastPing = [...events].reverse().find((e) => e.type === 'ping') ?? null;
    json(res, 200, {
      gameLinked: Date.now() - lastGamePoll < 6000,
      pendingCommands: pendingCommands.length,
      eventCount: events.length,
      defaultsFile: DEFAULTS_FILE,
      frames: lastFrames,
      lastTelemetry,
      lastPing,
    });
    return;
  }

  // The game drains its command queue here (companion-chat.tsx polls every 1.5 s)
  if (pathname === '/poll' && req.method === 'GET') {
    lastGamePoll = Date.now();
    // a bridged game's stream goes to the tab that opened that bridge (two FIDELITY tabs share one bridge in the
    // self-bridge); everything else goes to whichever tab polls first, as before
    const client = url.searchParams.get('client');
    const out = [], keep = [];
    for (const c of pendingCommands) (!c.to || c.to === client ? out : keep).push(c);
    pendingCommands.length = 0;
    pendingCommands.push(...keep);
    json(res, 200, { commands: out });
    return;
  }

  // The game appends player speech, companion replies, pings and telemetry here
  if (pathname === '/event' && req.method === 'POST') {
    try {
      const e = await readJson(req);
      if (!isRecord(e) || typeof e.type !== 'string') throw new Error('an event is an object with a type');
      pushEvent(e);
      // the bridge session drives the sampler: it runs only while the player has a game bridged
      if (e.type === 'bridge-active' && typeof e.gameId === 'string' && typeof e.client === 'string') sessionClients[e.gameId] = e.client.slice(0, 64);
      if (e.type === 'bridge-closed' && typeof e.gameId === 'string') { delete sessionClients[e.gameId]; disarmRelay(e.gameId); }
      if (e.type === 'bridge-active' && typeof e.gameId === 'string') {
        if (sampler?.gameId !== e.gameId) startSampler(e.gameId, typeof e.process === 'string' ? e.process : null);
      }
      if (e.type === 'bridge-closed') stopSampler();
      if (e.type === 'player-say') console.log(`\x1b[36m[PISKRIEK]\x1b[0m ${e.text}${e.intent && e.intent !== 'chat' ? `  \x1b[90m(${e.intent}, run in game)\x1b[0m` : ''}`);
      if (e.type === 'ping' && isRecord(e.target)) {
        const t = e.target;
        const part = t.kitId ? `  kit=${t.kitId}${t.partId ? ` part=${t.partId}` : ''}${t.material ? ` material=${t.material}` : ''}` : '';
        console.log(`\x1b[35m[PING]\x1b[0m ${e.label ?? t.entityType} @ (${t.x}, ${t.y}, ${t.z}) ${t.distance} m${part}`);
      }
      if (e.type === 'kit-result') console.log(`\x1b[33m[KIT]\x1b[0m ${e.result}`);
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }

  // Plan 51 Wave 2: which processes are running (the drone ranks them as the game the player means). Names only.
  if (pathname === '/running-games' && req.method === 'GET') {
    json(res, 200, { processes: await runningProcesses() });
    return;
  }
  // the drone asks the AI on the bridge to check a game's terms live; the answer is a `bridge-profile` command
  // Plan 53: the input relay, armed only by the player's consent from their game tab
  if (pathname === '/input-relay/arm' && req.method === 'POST') {
    try {
      const b = await readJson(req);
      const gameId = typeof b.gameId === 'string' && /^[a-z0-9][a-z0-9._-]{0,47}$/.test(b.gameId) ? b.gameId : null;
      if (!gameId) throw new Error('a relay needs the bridged game');
      // the consent again, on this side: the box and the word
      if (b.ticked !== true || typeof b.typed !== 'string' || b.typed.trim().toUpperCase() !== 'RELAY') throw new Error('the relay needs the box ticked and RELAY typed');
      const transport = b.transport === 'console-tcp' || b.transport === 'synthetic-keys' ? b.transport : null;
      if (!transport) throw new Error('unknown relay transport');
      const port = Number.isInteger(b.port) && b.port >= 1024 && b.port <= 65535 ? b.port : null;
      if (transport === 'console-tcp' && !port) throw new Error('a console relay needs its port');
      const proc = typeof b.process === 'string' && /^[\w .()-]{1,64}$/.test(b.process) ? b.process : null;
      if (transport === 'synthetic-keys' && !proc) throw new Error('a key relay needs the game\'s process');
      if (RELAY_GUARDED_GAMES.has(gameId) || (proc && RELAY_GUARDED_PROCESSES.test(proc))) throw new Error('that game is guarded by an anti-cheat: nothing is sent into it');
      const guard = (await runningProcesses()).find((p) => RELAY_ANTI_CHEAT_PROCESS.test(p.trim()));
      if (guard) throw new Error(`an anti-cheat is running (${guard.trim()}): nothing is sent into any game while it runs`);
      disarmRelay(gameId);
      const token = randomUUID();
      relays[gameId] = { gameId, token, transport, port, process: proc, launchOption: typeof b.launchOption === 'string' ? b.launchOption.slice(0, 64) : null, child: null, socket: null };
      relayNote(gameId, `on by the player's consent (${transport}${port ? ` :${port}` : ''}${proc ? `, ${proc}` : ''})`);
      json(res, 200, { ok: true, token });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }
  if ((pathname === '/input-relay/press' || pathname === '/input-relay/disarm') && req.method === 'POST') {
    try {
      const b = await readJson(req);
      const r = typeof b.gameId === 'string' ? relays[b.gameId] : undefined;
      if (!r || b.token !== r.token) throw new Error('no relay armed for that game by this player');
      if (pathname === '/input-relay/disarm') { disarmRelay(r.gameId); json(res, 200, { ok: true }); return; }
      const line = typeof b.line === 'string' ? b.line.trim() : '';
      if (!(r.transport === 'console-tcp' ? RELAY_CONSOLE_LINE : RELAY_KEY_LINE).test(line)) throw new Error(`not a relayable press: ${line.slice(0, 40)}`);
      relayDeliver(r, line);
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }
  if (pathname === '/input-relay' && req.method === 'GET') {
    json(res, 200, { armed: Object.values(relays).map((r) => ({ gameId: r.gameId, transport: r.transport })), log: relayLog.slice(-20) });
    return;
  }
  if (pathname === '/bridge-request' && req.method === 'POST') {
    try {
      const r = await readJson(req);
      if (!isRecord(r) || typeof r.gameId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,47}$/.test(r.gameId)) throw new Error('a bridge request names a gameId');
      const title = typeof r.title === 'string' ? r.title.slice(0, 96) : r.gameId;
      pushEvent({ type: 'bridge-request', gameId: r.gameId, title, process: typeof r.process === 'string' ? r.process.slice(0, 96) : null, known: profiles[r.gameId] ?? null });
      console.log(`\x1b[35m[BRIDGE REQUEST]\x1b[0m ${title} (${r.gameId}): an AI should check its terms and answer {action:'bridge-profile', profile}`);
      json(res, 200, { ok: true, known: profiles[r.gameId] ?? null });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }
  // an official integration (a game's state integration, a telemetry adapter) posts here; relayed to the game, which maps
  // it through the bridged game's mapping preset into samples and gates them (its mechanics always cross, never its assets;
  // its names cross as labels unless its checked profile allows them)
  const tel = /^\/telemetry\/([a-z0-9][a-z0-9._-]{0,47})$/.exec(pathname);
  if (tel && req.method === 'POST') {
    try {
      const payload = await readJson(req, TELEMETRY_CAP);
      const queued = pendingCommands.filter((c) => c.action === 'telemetry');
      if (queued.length >= TELEMETRY_QUEUE) pendingCommands.splice(pendingCommands.indexOf(queued[0]), 1);
      pendingCommands.push({ action: 'telemetry', gameId: tel[1], payload, at: Date.now() / 1000, ...(sessionClients[tel[1]] ? { to: sessionClients[tel[1]] } : {}) });
      telemetryCount[tel[1]] = (telemetryCount[tel[1]] ?? 0) + 1;
      lastTelemetryPayload[tel[1]] = { at: Date.now(), payload };
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }
  if (tel && req.method === 'GET') {
    json(res, 200, { gameId: tel[1], count: telemetryCount[tel[1]] ?? 0, last: lastTelemetryPayload[tel[1]] ?? null });
    return;
  }
  if (pathname === '/bridge-profiles' && req.method === 'GET') {
    json(res, 200, { profiles, telemetry: telemetryCount });
    return;
  }

  // Plan 51: a mechanic observed in a game running on the PC (from the best channel that game permits: telemetry, a mod
  // SDK, a permitted loader, its files, the screen last), relayed to the game, whose harness decompiles it into presets
  if (pathname === '/observe-mechanic' && req.method === 'POST') {
    try {
      const obs = await readJson(req, OBSERVATION_CAP);
      const ladder = ['telemetry', 'mod-sdk', 'mod-loader', 'game-files', 'screen', 'input-audio', 'synthetic'];
      if (!isRecord(obs) || typeof obs.game !== 'string' || obs.game.length > 64 || !ladder.includes(obs.channel)) throw new Error('an observation has a game (string) and a channel: ' + ladder.join(' | '));
      if (!isRecord(obs.trajectory) && !isRecord(obs.shots) && !Array.isArray(obs.events)) throw new Error('an observation carries a trajectory, shots or events');
      dispatchCommand({ action: 'mimic', observation: obs });
      const counts = { trajectory: isRecord(obs.trajectory) && Array.isArray(obs.trajectory.t) ? obs.trajectory.t.length : 0, shots: isRecord(obs.shots) && Array.isArray(obs.shots.t) ? obs.shots.t.length : 0, events: Array.isArray(obs.events) ? obs.events.length : 0 };
      pushEvent({ type: 'mechanic-observed', game: obs.game, channel: obs.channel, ...counts });
      console.log(`\x1b[36m[OBSERVED]\x1b[0m ${obs.game} via ${obs.channel}: ${JSON.stringify(counts)}`);
      json(res, 200, { ok: true, queued: true, ...counts });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }

  // Plan 50: the AI's eyes — the game posts a JPEG of what the player sees (FIDELITY's view, or a linked game's screen)
  // every few seconds; the latest lands at shots-run/bridge/frame-<source>.jpg for the AI to look at. Loopback only.
  if (pathname === '/frame' && req.method === 'POST') {
    const source = (url.searchParams.get('source') ?? 'game').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'game';
    const chunks = [];
    let size = 0;
    let refused = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > FRAME_CAP) { refused = true; req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (refused) return;
      const buf = Buffer.concat(chunks);
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) { json(res, 400, { ok: false, error: 'a frame is a JPEG' }); return; }
      const file = path.join(FRAME_DIR, `frame-${source}.jpg`);
      const tmp = `${file}.${process.pid}.tmp`;
      // a frame is replaced every few seconds; on Windows the old one can be held open a moment (a viewer, the scanner),
      // and a failed rename here used to throw out of this callback and take the whole bridge down. Skip that frame instead.
      try {
        fs.mkdirSync(FRAME_DIR, { recursive: true });
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, file);
      } catch (err) {
        try { fs.rmSync(tmp, { force: true }); } catch {}
        json(res, 503, { ok: false, error: `frame not saved (${err instanceof Error ? err.code ?? err.message : err}); the next one replaces it` });
        return;
      }
      lastFrames[source] = { file: path.relative(ROOT, file).replaceAll('\\', '/'), at: Date.now(), bytes: buf.length };
      json(res, 200, { ok: true, ...lastFrames[source] });
    });
    return;
  }

  // Plan 49: "save as default" — the game sends one kit's overrides; they replace that kit's entry in the defaults file
  if (pathname === '/kit-defaults' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!isRecord(body) || typeof body.key !== 'string' || !KIT_KEY_RE.test(body.key)) throw new Error('key must be a kit id');
      const checked = checkKitOverrides(body.overrides);
      if (checked.error) throw new Error(checked.error);
      const all = readDefaults();
      if (!(body.key in all) && Object.keys(all).length >= MAX_KITS) throw new Error(`at most ${MAX_KITS} kits`);
      if (Object.keys(checked.overrides).length === 0) delete all[body.key];
      else all[body.key] = checked.overrides;
      const written = writeDefaults(all);
      pushEvent({ type: 'kit-default-written', key: body.key, parts: Object.keys(checked.overrides).length, file: DEFAULTS_FILE });
      console.log(`\x1b[32m[DEFAULT]\x1b[0m ${body.key}: ${Object.keys(checked.overrides).length} part overrides -> ${path.relative(ROOT, DEFAULTS_FILE)}`);
      json(res, 200, { ok: true, file: path.relative(ROOT, DEFAULTS_FILE).replaceAll('\\', '/'), defaults: written });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }
  if (pathname === '/kit-defaults' && req.method === 'GET') {
    json(res, 200, { file: DEFAULTS_FILE, defaults: readDefaults() });
    return;
  }

  // The mirror's stream (server-sent events) for one game tab: its bridged game's key changes, as they happen
  if (pathname === '/mirror' && req.method === 'GET') {
    const client = url.searchParams.get('client') ?? '';
    if (!/^[a-z0-9]{4,64}$/i.test(client)) { json(res, 400, { ok: false, error: 'the mirror needs the tab\'s client id' }); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': mirror\n\n');
    const old = mirrorStreams.get(client);
    if (old) { try { old.end(); } catch {} }
    mirrorStreams.set(client, res);
    req.on('close', () => { if (mirrorStreams.get(client) === res) mirrorStreams.delete(client); });
    return;
  }

  // An outside AI reads the conversation and telemetry here
  if (pathname === '/events' && req.method === 'GET') {
    const after = parseInt(url.searchParams.get('after') ?? '0', 10) || 0;
    json(res, 200, { events: events.filter((e) => e.seq > after) });
    return;
  }

  if (pathname === '/companion/say' && req.method === 'GET') {
    const text = url.searchParams.get('text') || 'Overwatch comms link verified.';
    dispatchCommand({ action: 'say', text });
    json(res, 200, { ok: true, dispatched: { action: 'say', text } });
    return;
  }

  if (pathname === '/command' && req.method === 'POST') {
    try {
      const cmd = await readJson(req);
      if (!isRecord(cmd) || typeof cmd.action !== 'string') throw new Error('a command is an object with an action');
      json(res, 200, { ok: dispatchCommand(cmd), cmd });
    } catch (err) {
      json(res, 400, { ok: false, error: String(err instanceof Error ? err.message : err) });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
};
const server = http.createServer(handle);

/** The names of the running processes (Windows: tasklist; elsewhere: ps), or the --fake-processes list in tests. */
/**
 * The process list, cached for a few seconds with one scan in flight: on the min-spec laptop with a game running,
 * tasklist takes about 5 s (a 4 s limit once returned an empty list, and "bridge <game>" then found no process).
 */
let processCache = { at: 0, list: [] };
let processScan = null;
async function runningProcesses() {
  if (FAKE_PROCESSES) return FAKE_PROCESSES;
  if (Date.now() - processCache.at < 8000 && processCache.list.length) return processCache.list;
  processScan ??= scanProcesses().then((list) => { if (list.length) processCache = { at: Date.now(), list }; processScan = null; return list.length ? list : processCache.list; });
  return processScan;
}
async function scanProcesses() {
  const { execFile } = await import('node:child_process');
  const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { timeout: 20000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => resolve(err ? '' : String(out))));
  if (process.platform === 'win32') {
    const out = await run('tasklist', ['/fo', 'csv', '/nh']);
    return [...new Set(out.split(/\r?\n/).map((l) => /^"([^"]+)"/.exec(l)?.[1]).filter(Boolean))];
  }
  const out = await run('ps', ['-eo', 'comm=']);
  return [...new Set(out.split(/\n/).map((l) => l.trim().split('/').pop()).filter(Boolean))];
}

function dispatchCommand(cmd) {
  // Plan 51 Wave 2: a game's permission profile is kept, so the verdict survives a bridge restart
  if (cmd.action === 'bridge-profile' && isRecord(cmd.profile) && typeof cmd.profile.gameId === 'string' && /^[a-z0-9][a-z0-9._-]{0,47}$/.test(cmd.profile.gameId)) {
    profiles[cmd.profile.gameId] = cmd.profile;
    try {
      fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
      fs.writeFileSync(PROFILES_FILE, `${JSON.stringify(profiles, null, 2)}\n`);
    } catch { /* the in-memory copy still serves */ }
  }
  // a game's profile goes to the tab that bridged that game: with two tabs open, the other one would drop it
  if (cmd.action === 'bridge-profile' && !cmd.to && isRecord(cmd.profile) && typeof cmd.profile.gameId === 'string' && sessionClients[cmd.profile.gameId]) {
    cmd = { ...cmd, to: sessionClients[cmd.profile.gameId] };
  }
  pendingCommands.push(cmd);
  pushEvent({ type: 'command', cmd });
  console.log(`\x1b[35m[COMPANION BRIDGE]\x1b[0m Queued command:`, cmd);
  return true;
}

// loopback only, on both families: 'localhost' resolves to ::1 first on some Windows setups
http.createServer(handle).on('error', () => {}).listen(PORT, '::1');
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`\x1b[35m  SETMIX MULTIVERSE // IN-GAME AI COMPANION NEURAL BRIDGE (PLANS 48 + 49)\x1b[0m`);
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`  Bridge Server listening on: \x1b[32mhttp://localhost:${PORT}\x1b[0m (127.0.0.1 only)`);
  console.log(`  For the AI agent (Claude, Antigravity, a local LLM, or curl):`);
  console.log(`    GET  http://localhost:${PORT}/events?after=0   what Piskriek says and pings, plus telemetry`);
  console.log(`    POST http://localhost:${PORT}/command          say|follow|goto|hover-at|hold|ground|gesture`);
  console.log(`                                                  mutate-kit-preset|override-kit-part|save-kit-default`);
  console.log(`    GET  http://localhost:${PORT}/companion/say?text=Hello+Piskriek`);
  console.log(`  Kit defaults file: ${path.relative(ROOT, DEFAULTS_FILE)}`);
  console.log(`  For the running game (automatic): GET /poll, POST /event, POST /kit-defaults, GET /status`);
  console.log(`\x1b[35m───────────────────────────────────────────────────────────────────────────\x1b[0m`);
});
