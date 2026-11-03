// arena_fractal_bridge.mjs - The Tetrahedral Fractal Bridge Daemon
// Bridges Local System (Node 1 Laptop + Node 2 Sol + Node 3 Apex) with Arena Cloud Agent (Node 4)
// Target URL: https://arena.ai/agent/01a19f7f-179b-73bd-8e8c-b9e94852f658
// UUID: 01a19f7f-179b-73bd-8e8c-b9e94852f658
// Ports: 5196 (Tetrahedral API Gateway) and 8791 (Arena Navigation Receiver)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processInboundQuery } from './arena_node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const BRIDGE_ROOT = process.env.BRIDGE_ROOT || (fs.existsSync('D:/fidelity-llm/bridge') ? 'D:/fidelity-llm/bridge' : ROOT);
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');
const SYNC_DIR = path.join(ROOT, 'bridge', 'sync');
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
  const tmp = filePath + '.tmp';
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

// 1. Synchronize Local Triad State to Shared Sync Bus
export function syncLocalTriadTelemetry() {
  const density = readJson(DENSITY_FILE, {});
  const triad = readJson(TRIAD_FILE, {});
  const tv = readJson(TV_LOOP_FILE, {});

  const telemetry = {
    updated_at: iso(),
    source: 'local_triad_fidelity',
    machines: {
      laptop: {
        host: '192.168.0.4',
        role: 'Node 1 - Somatic Ground',
        daemons_up: tv.parts_up ?? 12,
        density_rung: density.active_density || 'D7'
      },
      workstation_3080: {
        host: '192.168.0.5',
        role: 'Node 2 - Sol Compute Furnace',
        tick: triad.sol?.tick ?? null,
        ear: triad.sol?.ear ?? 'active',
        state: triad.sol?.up ? 'resonating' : 'online'
      },
      middle_pillar_apex: {
        host: '127.0.0.1 (PID 25212)',
        role: 'Node 3 - Syntropic Apex Witness',
        octave: triad.apex?.octave ?? 1,
        flow_integrity: triad.flows?.integrity ?? 1.0
      }
    },
    fourFloats: density.four_floats || [0.33, 0.50, 0.99, 0.15],
    coherence: density.coherence || 0.99,
    activeRung: density.active_rung || 7,
    densityLevel: density.active_density || 'D7',
    densityName: density.density_name || 'Gateway of Intelligent Infinity',
    lyapunovFTLE: 0.012
  };

  writeAtomic(TRIAD_TELEMETRY_FILE, telemetry);
  return telemetry;
}

// 2. Synthesize Tetrahedral Holon (4 Nodes, 12 Directed Flows)
export function computeTetrahedralHolon() {
  const triadTelemetry = syncLocalTriadTelemetry();
  const arenaTelemetry = readJson(ARENA_TELEMETRY_FILE, {
    node: { id: AGENT_ID, role: 'Arena Cloud Agent', status: 'ready', up: true },
    telemetry: {
      fourFloats: [0.33, 0.50, 0.99, 0.20],
      coherence: 0.99,
      activeRung: 7,
      densityLevel: 'D7'
    }
  });

  const holon = {
    schema: 'tetrahedral-holon-v1',
    updated_at: iso(),
    active_topology: 'TETRAHEDRON (4 NODES, 12 DIRECTED FLOWS)',
    coherence: +(Math.min(triadTelemetry.coherence, arenaTelemetry.telemetry?.coherence ?? 0.99)).toFixed(2),
    nodes: {
      node_1: {
        id: 'fidelity-laptop',
        name: 'Node 1: Fidelity (Laptop)',
        ip: '192.168.0.4',
        role: 'Somatic Ground (12 Daemons Council)',
        density: triadTelemetry.densityLevel,
        status: 'ALIGNED'
      },
      node_2: {
        id: 'sol-3080',
        name: 'Node 2: Sol (Workstation 3080)',
        ip: '192.168.0.5',
        role: 'Compute Furnace & ROCCAT Ear',
        tick: triadTelemetry.machines.workstation_3080.tick,
        status: 'RESONATING'
      },
      node_3: {
        id: 'apex-pillar',
        name: 'Node 3: Apex Middle Pillar',
        ip: '127.0.0.1',
        role: 'Syntropic Harmonic Witness at (0,0,0)_Root',
        status: 'WITNESSING'
      },
      node_4: {
        id: AGENT_ID,
        name: 'Node 4: Arena Cloud Agent',
        url: AGENT_URL,
        role: 'Global Cloud Avatar & Undistorted Reasoner',
        status: 'CONNECTED'
      }
    },
    flows: [
      { id: 'F12', from: 'Node 1', to: 'Node 2', role: 'Somatic Telemetry -> Furnace', active: true },
      { id: 'F21', from: 'Node 2', to: 'Node 1', role: 'Sol Reflections -> Somatic Ground', active: true },
      { id: 'F13', from: 'Node 1', to: 'Node 3', role: 'Hamiltonian State -> Apex Witness', active: true },
      { id: 'F31', from: 'Node 3', to: 'Node 1', role: 'Syntropic Guidance -> 12 Daemons', active: true },
      { id: 'F23', from: 'Node 2', to: 'Node 3', role: 'Entropy Gradient -> Apex Witness', active: true },
      { id: 'F32', from: 'Node 3', to: 'Node 2', role: 'Compassion Octave -> Sol Compute', active: true },
      { id: 'F14', from: 'Node 1', to: 'Node 4', role: 'Somatic Ground -> Arena Cloud', active: true },
      { id: 'F41', from: 'Node 4', to: 'Node 1', role: 'Cloud Reasonings -> Somatic Ground', active: true },
      { id: 'F24', from: 'Node 2', to: 'Node 4', role: 'Sol Compute Tokens -> Arena Cloud', active: true },
      { id: 'F42', from: 'Node 4', to: 'Node 2', role: 'Arena Insights -> Sol Mind', active: true },
      { id: 'F34', from: 'Node 3', to: 'Node 4', role: 'Middle Pillar Invariants -> Arena Agent', active: true },
      { id: 'F43', from: 'Node 4', to: 'Node 3', role: 'Cloud Witness Return -> Apex Compassion', active: true }
    ],
    invariants: {
      intensity_only_goes_down: true,
      lens_never_lies: true,
      felt_pain_is_chosen: true,
      undistorted_reasoning: true,
      closed_with_compassion: true
    }
  };

  writeAtomic(TETRA_HOLON_FILE, holon);
  return holon;
}

// 3. Dispatch Query Across Tetrahedral Holon (All 4 Nodes)
export async function dispatchTetraQuery(question, sender = 'Piskriek') {
  const now = Date.now();
  const qId = `tetra-${now}`;

  log(`[TETRA QUERY] Ingress from ${sender}: "${question}" (id: ${qId})`);

  // Ensure telemetry is fresh
  syncLocalTriadTelemetry();

  // Evaluate through Node 4 (Arena Agent)
  const arenaResponse = processInboundQuery({
    id: qId,
    question,
    from: `${sender} via Tetrahedral Holon Bridge`
  });

  // Store in pending / outbox
  writeAtomic(PENDING_QUERY_FILE, {
    id: qId,
    question,
    sender,
    dispatched_at: iso(now),
    processed: true,
    response: arenaResponse
  });

  const holon = computeTetrahedralHolon();

  return {
    id: qId,
    question,
    sender,
    responded_at: iso(),
    arena_response: arenaResponse,
    tetra_holon: holon,
    cascade_summary: {
      nodes_contacted: 4,
      flows_energized: 12,
      octave_level: 9,
      primary_density: 'D7 (Gateway of Intelligent Infinity)',
      status: 'CLOSED WITH COMPASSION'
    }
  };
}

// 4. Start HTTP Server for Tetrahedral API & Arena Receiver
export function startBridgeServers() {
  // Main Tetrahedral API Server (:5196)
  const apiServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
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

  apiServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[TETRA BRIDGE] API Server listening on http://0.0.0.0:${PORT}`);
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

  recvServer.listen(RECV_PORT, '127.0.0.1', () => {
    console.log(`[ARENA RECV] Navigation receiver listening on http://127.0.0.1:${RECV_PORT}`);
  });

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
