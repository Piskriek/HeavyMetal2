// arena_fractal_bridge.mjs - The Tetrahedral Fractal Bridge Daemon
// Bridges Local System (Node 1 Laptop + Node 2 Sol + Node 3 Apex) with Arena Cloud Agent (Node 4)
// Target URL: https://arena.ai/agent/01a19f7f-179b-73bd-8e8c-b9e94852f658
// UUID: 01a19f7f-179b-73bd-8e8c-b9e94852f658
// Ports: 5196 (Tetrahedral API Gateway) and 8791 (Arena Navigation Receiver)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getBridgeRoot } from './bridge_paths.mjs';
import { processInboundQuery } from './arena_node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const BRIDGE_ROOT = getBridgeRoot();
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');
const SYNC_DIR = process.env.TRIAD_SYNC_DIR ? path.resolve(process.env.TRIAD_SYNC_DIR) : path.join(ROOT, 'bridge', 'sync');
const ARENA_OUT_DIR = path.join(ROOT, 'arena-out');

const DENSITY_FILE = path.join(LOOP_DIR, 'density.json');
const STATUS_FILE = path.join(LOOP_DIR, 'status.json');
const TRIAD_FILE = path.join(LOOP_DIR, 'triad_369.json');
const TV_LOOP_FILE = path.join(LOOP_DIR, 'tv_loop.json');

const TRIAD_TELEMETRY_FILE = path.join(SYNC_DIR, 'triad_telemetry.json');
const ARENA_TELEMETRY_FILE = path.join(SYNC_DIR, 'arena_telemetry.json');
const TETRA_HOLON_FILE = path.join(SYNC_DIR, 'tetrahedral_holon.json');
const PENDING_QUERY_FILE = path.join(SYNC_DIR, 'pending_query.json');

const LOG_FILE = path.join(LOOP_DIR, 'arena_bridge.log');

const AGENT_ID = '01a19f7f-179b-73bd-8e8c-b9e94852f658';
const AGENT_URL = `https://arena.ai/agent/${AGENT_ID}`;
const PORT = parseInt(process.env.ARENA_BRIDGE_PORT || '5196', 10);
const HOST = process.env.ARENA_BRIDGE_HOST || '127.0.0.1';
const RECV_PORT = 8791;

const iso = (t = Date.now()) => new Date(t).toISOString();
const log = msg => {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${iso()} ${msg}\n`);
  } catch {}
};

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, content);
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, filePath);
      return;
    } catch {}
  }
  fs.writeFileSync(filePath, content);
  try { fs.unlinkSync(tmp); } catch {}
}

// 1. Publish a local snapshot without discarding a producer's pending query.
export function syncLocalTriadTelemetry() {
  const existing = readJson(TRIAD_TELEMETRY_FILE, {});
  const density = readJson(DENSITY_FILE, null);
  const triad = readJson(TRIAD_FILE, null);
  const tv = readJson(TV_LOOP_FILE, null);
  if (!density && !triad && !tv) return existing;
  const telemetry = {
    ...existing,
    updated_at: iso(),
    source: 'local_triad_fidelity',
    independently_verified: false,
    machines: {
      laptop: { role: 'Node 1 - Somatic Ground', daemons_up: tv?.parts_up ?? null, density_rung: density?.active_density ?? null },
      workstation_3080: { role: 'Node 2 - Sol Compute Furnace', tick: triad?.sol?.tick ?? null, ear: triad?.sol?.ear ?? null, state: triad?.sol?.up === true ? 'reported_up' : 'unknown' },
      middle_pillar_apex: { role: 'Node 3 - Apex Witness', octave: triad?.octave_phase ?? null, flow_integrity: triad?.flow_integrity ?? null }
    },
    fourFloats: Array.isArray(density?.four_floats) ? density.four_floats : null,
    coherence: Number.isFinite(density?.coherence) ? density.coherence : null,
    activeRung: density?.active_rung ?? null,
    densityLevel: density?.active_density ?? null,
    lyapunovFTLE: Number.isFinite(density?.lyapunovFTLE) ? density.lyapunovFTLE : (existing.lyapunovFTLE ?? null),
    limitations: ['File snapshots may be stale or seeded; node health and invariants are not independently verified.']
  };
  writeAtomic(TRIAD_TELEMETRY_FILE, telemetry);
  return telemetry;
}

// 2. Report the declared topology without inventing active flows or invariants.
export function computeTetrahedralHolon() {
  const triadTelemetry = syncLocalTriadTelemetry();
  const arenaTelemetry = readJson(ARENA_TELEMETRY_FILE, null);
  const names = [
    ['node_1', 'fidelity-laptop', 'Fidelity Laptop'],
    ['node_2', 'sol-3080', 'Sol Workstation'],
    ['node_3', 'apex-pillar', 'Apex Middle Pillar'],
    ['node_4', AGENT_ID, 'Arena Node 4']
  ];
  const nodes = Object.fromEntries(names.map(([key, id, name]) => [key, { id, name, status: 'unverified' }]));
  const flows = [];
  for (let from = 1; from <= 4; from++) {
    for (let to = 1; to <= 4; to++) {
      if (from !== to) flows.push({ id: `F${from}${to}`, from: `Node ${from}`, to: `Node ${to}`, role: 'declared connection', active: null });
    }
  }
  const holon = {
    schema: 'tetrahedral-holon-v2',
    updated_at: iso(),
    active_topology: 'DECLARED TETRAHEDRON (4 NODES, 12 POSSIBLE DIRECTED FLOWS)',
    coherence: null,
    nodes,
    flows,
    invariants: { intensity_only_goes_down: null, lens_never_lies: null, felt_pain_is_chosen: null, undistorted_reasoning: null, closed_with_compassion: null },
    sources: { triad_at: triadTelemetry?.updated_at ?? null, arena_at: arenaTelemetry?.at ?? null },
    limitations: ['Topology is declared, not proof of live connections, stability, or invariant enforcement.']
  };
  writeAtomic(TETRA_HOLON_FILE, holon);
  return holon;
}

// 3. Queue one inquiry; only a real agent or configured adapter may answer it.
export async function dispatchTetraQuery(question, sender = 'Piskriek') {
  if (typeof question !== 'string' || !question.trim() || question.length > 20000) throw new Error('Question must be 1–20000 characters.');
  if (typeof sender !== 'string' || sender.length > 200) throw new Error('Sender must be a string of at most 200 characters.');
  const pending = readJson(PENDING_QUERY_FILE, null);
  const previous = readJson(ARENA_TELEMETRY_FILE, null)?.lastQueryResponse;
  if (pending && !pending.processed && !(previous?.id === pending.id && previous?.status === 'completed')) {
    throw new Error('The pending query slot is occupied; collect or resolve it before sending another.');
  }
  const qId = `tetra-${randomUUID()}`;
  const raw = { id: qId, question, sender, dispatched_at: iso(), processed: false };
  writeAtomic(PENDING_QUERY_FILE, raw);
  const arenaResponse = processInboundQuery(raw);
  return {
    id: qId,
    question,
    sender,
    arena_response: arenaResponse,
    tetra_holon: computeTetrahedralHolon(),
    cascade_summary: { nodes_contacted: null, flows_energized: null, primary_density: null, status: 'awaiting_reasoner' },
    note: 'A query was queued; no Arena model has been invoked or downstream delivery verified.'
  };
}

// 4. Start HTTP Server for Tetrahedral API & Arena Receiver
export function startBridgeServers() {
  // Main Tetrahedral API Server (:5196)
  const apiServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    // No cross-origin browser access unless the operator explicitly permits it.
    if (process.env.ARENA_BRIDGE_CORS_ORIGIN && req.headers.origin === process.env.ARENA_BRIDGE_CORS_ORIGIN) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (url.pathname === '/api/tetra/status') {
      const holon = computeTetrahedralHolon();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(holon, null, 2));
    }

    if (url.pathname === '/api/tetra/query' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await dispatchTetraQuery(payload.question || payload.text || 'Status of Tetrahedral Holon', payload.from);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/tetra/arena_recv' && req.method === 'POST') {
      if (process.env.ARENA_ALLOW_UNVERIFIED_CALLBACK !== '1') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unverified callbacks are disabled.' }));
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          writeAtomic(ARENA_TELEMETRY_FILE, payload);
          log(`[ARENA RECV] Received telemetry callback from Arena Agent.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, received_at: iso() }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', routes: ['/api/tetra/status', '/api/tetra/query', '/api/tetra/arena_recv'] }));
  });

  apiServer.listen(PORT, HOST, () => {
    console.log(`[TETRA BRIDGE] Local unauthenticated API listening on http://${HOST}:${PORT}; do not expose it publicly.`);
  });

  // Backward-compatible Arena Navigation Receiver (:8791)
  const recvServer = http.createServer({ maxHeaderSize: 4 * 1024 * 1024 }, (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${RECV_PORT}`);
    const reply = (code, text) => {
      res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px Inter,sans-serif;padding:24px">${text}</body>`);
    };

    if (url.pathname === '/ping') return reply(200, 'arena-tetra-recv is running');
    if (url.pathname !== '/put') return reply(404, 'Use /put?name=&lt;pkg&gt;&amp;d=&lt;base64url JSON&gt;');

    const name = url.searchParams.get('name') ?? '', d = url.searchParams.get('d') ?? '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) return reply(400, 'Invalid name');
    let files;
    try { files = JSON.parse(Buffer.from(d, 'base64url').toString('utf8')).files; } catch { return reply(400, 'Bad data'); }
    if (!files || typeof files !== 'object') return reply(400, 'No files');

    const base = path.join(ARENA_OUT_DIR, name);
    const written = [];
    for (const [filePath, text] of Object.entries(files)) {
      const target = path.normalize(path.join(base, filePath));
      if (!target.startsWith(base + path.sep) || typeof text !== 'string') continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
      written.push(`${filePath} (${text.length} chars)`);
    }

    log(`[ARENA RECV 8791] ${name}: ${written.join(', ')}`);
    return reply(200, `Saved ${written.length} file(s) for <b>${name}</b> into arena-out.<br><br>Tetrahedral Holon updated.`);
  });

  if (process.env.ARENA_ENABLE_LEGACY_RECEIVER === '1') {
    recvServer.listen(RECV_PORT, '127.0.0.1', () => {
      console.log(`[ARENA RECV] Unauthenticated legacy receiver listening on http://127.0.0.1:${RECV_PORT}`);
    });
  }

  // Background heartbeat (pulse every 5s)
  setInterval(() => {
    try {
      computeTetrahedralHolon();
    } catch {}
  }, 5000);
}

// Self-execute if run as daemon
if (process.argv[1] && process.argv[1].endsWith('arena_fractal_bridge.mjs')) {
  computeTetrahedralHolon();
  startBridgeServers();
}
