#!/usr/bin/env node
/**
 * In-Game AI Companion Neural Bridge (Plan 48, reworked on the owner's 27 Oct feedback:
 * "i need to be able to connect you or any ai to the game").
 *
 * The RUNNING GAME polls this bridge for commands and pushes everything the player says (held
 * T radio or typed comms) plus live telemetry as events. ANY outside AI — Claude, Antigravity,
 * a local LLM, or plain curl — drives the companion with three endpoints:
 *
 *   read the conversation:  GET  /events?after=<seq>   -> { events: [{seq, type, text?, ...}] }
 *   act and speak:          POST /command              -> { action: 'say'|'follow'|'goto'|'hover-at'|'hold'|'ground'|'gesture', text?, target?: {x,z}, gesture? }
 *   quick hello:            GET  /companion/say?text=...
 *
 * The game's side (companion-chat.tsx polls while the game runs on localhost):
 *   GET  /poll      -> drains queued commands for the companion
 *   POST /event     -> appends a player-say / companion-say / telemetry event
 *   GET  /status    -> link state and the latest telemetry event
 *
 * Usage:
 *   node scripts/companion-bridge.mjs [--port 8220]
 *
 * Example session for an AI agent:
 *   curl -s localhost:8220/events | jq        # read what Piskriek said
 *   curl -s -X POST localhost:8220/command -H 'Content-Type: application/json' \
 *     -d '{"action":"hover-at","target":{"x":12,"z":-4},"text":"On station above the ridge."}'
 */
import http from 'node:http';
import { parse } from 'node:url';

const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') ?? '8220', 10);

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

const server = http.createServer((req, res) => {
  const { pathname, query } = parse(req.url ?? '/', true);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/status') {
    const lastTelemetry = [...events].reverse().find((e) => e.type === 'telemetry') ?? null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      gameLinked: Date.now() - lastGamePoll < 6000,
      pendingCommands: pendingCommands.length,
      eventCount: events.length,
      lastTelemetry,
    }, null, 2));
    return;
  }

  // The game drains its command queue here (companion-chat.tsx polls every 1.5 s)
  if (pathname === '/poll' && req.method === 'GET') {
    lastGamePoll = Date.now();
    const commands = pendingCommands.splice(0, pendingCommands.length);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ commands }));
    return;
  }

  // The game appends player speech, companion replies and telemetry here
  if (pathname === '/event' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const e = JSON.parse(body);
        pushEvent(e);
        if (e.type === 'player-say') console.log(`\x1b[36m[PISKRIEK]\x1b[0m ${e.text}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  // An outside AI reads the conversation and telemetry here
  if (pathname === '/events' && req.method === 'GET') {
    const after = parseInt(query.after ?? '0', 10) || 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: events.filter((e) => e.seq > after) }, null, 2));
    return;
  }

  if (pathname === '/companion/say' && req.method === 'GET') {
    const text = (typeof query.text === 'string' ? query.text : null) ?? 'Overwatch comms link verified.';
    dispatchCommand({ action: 'say', text });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dispatched: { action: 'say', text } }));
    return;
  }

  if (pathname === '/command' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const cmd = JSON.parse(body);
        const ok = dispatchCommand(cmd);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok, cmd }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

function dispatchCommand(cmd) {
  pendingCommands.push(cmd);
  pushEvent({ type: 'command', cmd });
  console.log(`\x1b[35m[COMPANION BRIDGE]\x1b[0m Queued command:`, cmd);
  return true;
}

server.listen(PORT, () => {
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`\x1b[35m  SETMIX MULTIVERSE // IN-GAME AI COMPANION NEURAL BRIDGE (PLAN 48)\x1b[0m`);
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`  Bridge Server listening on: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  For the AI agent (Claude, Antigravity, a local LLM, or curl):`);
  console.log(`    GET  http://localhost:${PORT}/events?after=0   read what Piskriek says + telemetry`);
  console.log(`    POST http://localhost:${PORT}/command          { "action": "say"|"follow"|"goto"|"hover-at"|"hold"|"ground"|"gesture", "text", "target": {"x","z"}, "gesture" }`);
  console.log(`    GET  http://localhost:${PORT}/companion/say?text=Hello+Piskriek`);
  console.log(`  For the running game (automatic): GET /poll, POST /event, GET /status`);
  console.log(`\x1b[35m───────────────────────────────────────────────────────────────────────────\x1b[0m`);
});
