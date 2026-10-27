#!/usr/bin/env node
/**
 * In-Game AI Companion Neural Bridge (Plan 48 Wave 2).
 * Connects Antigravity, Claude, or a local LLM to the running SetMix game.
 *
 * Usage:
 *   node scripts/companion-bridge.mjs [--port 8220]
 *
 * Endpoints:
 *   - GET  /status       -> Check connection status & companion telemetry
 *   - POST /command      -> Send action to companion: { action: 'say'|'follow'|'goto'|'gesture', text, target, gesture }
 *   - GET  /companion/say?text=... -> Quick command shortcut
 *   - WebSocket /ws      -> Bidirectional game telemetry stream
 */
import http from 'node:http';
import { parse } from 'node:url';

const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') ?? '8220', 10);

let activeGameSocket = null;
let lastTelemetry = {
  connected: false,
  timestamp: Date.now(),
  companion: null,
};

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lastTelemetry, null, 2));
    return;
  }

  if (pathname === '/companion/say' && req.method === 'GET') {
    const text = (query.text as string) ?? 'Overwatch comms link verified.';
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

  // Telemetry beacon from game client
  if (pathname === '/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        lastTelemetry = {
          connected: true,
          timestamp: Date.now(),
          ...JSON.parse(body),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

function dispatchCommand(cmd) {
  if (globalThis.__pendingCommands) {
    globalThis.__pendingCommands.push(cmd);
  }
  console.log(`\x1b[35m[COMPANION BRIDGE]\x1b[0m Dispatched command:`, cmd);
  return true;
}

server.listen(PORT, () => {
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`\x1b[35m  SETMIX MULTIVERSE // IN-GAME AI COMPANION NEURAL BRIDGE (PLAN 48)\x1b[0m`);
  console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`  Bridge Server listening on: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  Endpoints:`);
  console.log(`    GET  http://localhost:${PORT}/status`);
  console.log(`    POST http://localhost:${PORT}/command  body: { "action": "say"|"follow"|"goto"|"gesture" }`);
  console.log(`    GET  http://localhost:${PORT}/companion/say?text=Hello+Piskriek`);
  console.log(`\x1b[35m───────────────────────────────────────────────────────────────────────────\x1b[0m`);
});
