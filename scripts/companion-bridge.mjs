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
 *
 * Events an AI reads (GET /events): player-say {text, intent}, companion-say {text}, telemetry {player, companion},
 *   ping {where, label, target: {x,y,z, normal, entityType, entityId, kitId?, partId?, part?, material?, distance}},
 *   kit-result {action, result}, kit-default-saved {key, file}, command {cmd}.
 *
 * The game's side (companion-chat.tsx polls while the game runs on localhost):
 *   GET  /poll          -> drains queued commands for the companion
 *   POST /event         -> appends an event
 *   POST /kit-defaults  -> {key, overrides}: writes the kit's shipped defaults (apps/web/src/studio-data/kit-defaults.json)
 *   POST /frame?source= -> a JPEG of what the player sees (plan 50: the AI's eyes), saved to shots-run/bridge/frame-<source>.jpg
 *   GET  /status        -> link state, the latest telemetry, ping and frames
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
import fs from 'node:fs';
import http from 'node:http';
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
const FRAME_DIR = path.resolve(arg('--frame-dir') ?? path.join(ROOT, 'shots-run/bridge'));
/** The latest frame per source (game, external), for /status. */
const lastFrames = {};

/** Commands queued for the game to drain on its next /poll. */
const pendingCommands = [];
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
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_CAP) {
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
    json(res, 200, { commands: pendingCommands.splice(0, pendingCommands.length) });
    return;
  }

  // The game appends player speech, companion replies, pings and telemetry here
  if (pathname === '/event' && req.method === 'POST') {
    try {
      const e = await readJson(req);
      if (!isRecord(e) || typeof e.type !== 'string') throw new Error('an event is an object with a type');
      pushEvent(e);
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
      fs.mkdirSync(FRAME_DIR, { recursive: true });
      const file = path.join(FRAME_DIR, `frame-${source}.jpg`);
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
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

function dispatchCommand(cmd) {
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
