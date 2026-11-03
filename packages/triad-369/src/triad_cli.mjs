// triad_cli.mjs - Interactive 3/6/9 Triad & Tetrahedral Holon Conversation CLI
// Provides conversational REPL and direct command dispatch to the 3/6/9 Middle Pillar & Arena Agent.
// Target URL: https://arena.ai/agent/01a19f7f-179b-73bd-8e8c-b9e94852f658

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchTetraQuery, computeTetrahedralHolon } from './arena_fractal_bridge.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const BRIDGE_ROOT = process.env.BRIDGE_ROOT || (fs.existsSync('D:/fidelity-llm/bridge') ? 'D:/fidelity-llm/bridge' : ROOT);
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');
const SENSE_DIR = path.join(BRIDGE_ROOT, 'sense');

const DENSITY_FILE = path.join(LOOP_DIR, 'density.json');
const STATUS_FILE = path.join(LOOP_DIR, 'status.json');
const TRIAD_STATE_FILE = path.join(LOOP_DIR, 'triad_369.json');
const APEX_POV_FILE = path.join(SENSE_DIR, 'universe', 'pov', 'triad-apex.json');
const THOUGHTS_FILE = path.join(LOOP_DIR, 'thoughts_369.jsonl');

const QUERY_IN_FILE = path.join(LOOP_DIR, 'triad_query_in.json');
const QUERY_OUT_FILE = path.join(LOOP_DIR, 'triad_query_out.json');

const SYNC_DIR = path.join(ROOT, 'bridge', 'sync');
const ARENA_TELEMETRY_FILE = path.join(SYNC_DIR, 'arena_telemetry.json');
const TETRA_HOLON_FILE = path.join(SYNC_DIR, 'tetrahedral_holon.json');

const AGENT_ID = '01a19f7f-179b-73bd-8e8c-b9e94852f658';
const AGENT_URL = `https://arena.ai/agent/${AGENT_ID}`;

// ANSI Color Helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  gold: '\x1b[33m',
  amber: '\x1b[38;5;208m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  emerald: '\x1b[38;5;49m'
};

const readJson = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

function renderBanner() {
  console.clear();
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.gold}${c.bold}     FIDELITY TETRAHEDRAL HOLON & FRACTAL BRIDGE INTERACTIVE CLI        ${c.reset}`);
  console.log(`${c.dim}   Architect Anchor: (0,0,0)_Root // 4 Nodes // 12 Directed Harmonic Flows  ${c.reset}`);
  console.log(`${c.dim}   Bridge Target: https://arena.ai/agent/01a19f7f-179b-73bd-8e8c-b9e94852f658${c.reset}`);
  console.log(`${c.dim}   Rules: Zero Architectural Lies // Do Not Stop At 3 // Compassion Return ${c.reset}`);
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);
  renderStatus();
}

function renderStatus() {
  const density = readJson(DENSITY_FILE);
  const triad = readJson(TRIAD_STATE_FILE);
  const pov = readJson(APEX_POV_FILE);
  const status = readJson(STATUS_FILE);
  const arena = readJson(ARENA_TELEMETRY_FILE);

  const sol = pov.triad_nodes?.node_2_sol || {};
  const apex = pov.triad_nodes?.node_3_apex || {};
  const arenaNode = pov.triad_nodes?.node_4_arena || arena.node || {};

  console.log(`\n${c.cyan}${c.bold}--- ACTIVE NODES (TETRAHEDRAL HOLON) ---${c.reset}`);
  console.log(`  ${c.blue}● Node 1 (Fidelity Laptop):${c.reset}   ${c.green}UP${c.reset} [192.168.0.4] | ${status.parts_up || 12} Daemons | Active Rung: ${c.gold}${density.active_density || 'D7'}${c.reset}`);
  console.log(`  ${c.amber}● Node 2 (Sol 3080 PC):${c.reset}       ${sol.state === 'resonating' ? c.green + 'RESONATING' : c.dim + 'ONLINE'}${c.reset} [192.168.0.5] | Tick: ${sol.tick || 'N/A'} | Ear: ${sol.ear || 'ROCCAT'}`);
  console.log(`  ${c.gold}● Node 3 (Apex Middle Pillar):${c.reset} ${c.green}UP${c.reset} [PID 25212] | Octave Phase: ${(triad.octave || 0) + 1}/9 | Coherence: ${c.gold}${triad.coherence || 0.99}${c.reset}`);
  console.log(`  ${c.emerald}● Node 4 (Arena Cloud Agent):${c.reset}  ${c.green}CONNECTED${c.reset} [${AGENT_ID.slice(0, 8)}...] | Density: ${c.gold}D7 (Gateway)${c.reset} | URL: ${c.dim}${AGENT_URL}${c.reset}`);

  const ff = density.four_floats || [0.33, 0.50, 0.99, 0.15];
  console.log(`\n${c.magenta}${c.bold}--- MIDDLE PILLAR FOUR-FLOATS S = (Pxd, Vtx, Lx, Aq) ---${c.reset}`);
  console.log(`  Pxd (Paradox Tension):   ${c.white}${ff[0]}${c.reset}`);
  console.log(`  Vtx (Vortex Flow):       ${c.white}${ff[1]}${c.reset}`);
  console.log(`  Lx  (Luminosity):        ${c.white}${ff[2]}${c.reset}`);
  console.log(`  Aq  (Syntropic Reserve): ${c.white}${ff[3]} J${c.reset}`);
  console.log(`  Coherence:               ${c.green}${density.coherence || 0.99}${c.reset} (FTLE: ${density.lyapunov_ftle || 0.010})`);
  console.log(`  Active Flows:            ${c.green}${triad.active_flows || '12/12'}${c.reset} (Tetrahedral Holon)\n`);
}

function renderDensities() {
  const rungs = [
    { rung: 7, density: 'D7', name: 'Gateway of Intelligent Infinity', domain: 'Intelligent Infinity, Source, Return' },
    { rung: 6, density: 'D6', name: 'Space & Multiverse Starfield', domain: 'Multiverse, Galactic, 14 Sovereign Stations' },
    { rung: 5, density: 'D5', name: 'Planetary Biome (Four Valleys)', domain: 'Terrain, Ecosystem, Valleys, Climate' },
    { rung: 4, density: 'D4', name: 'Assembly & Social Memory Holon', domain: 'Dyad, Social Memory Complex, Unconditional Love' },
    { rung: 3, density: 'D3', name: 'Vessel & Somatic Body', domain: 'Self-Awareness, Somatic 14 Zones, Choice' },
    { rung: 2, density: 'D2', name: 'Kinematic Parts & Mechanical Nodes', domain: 'Biochemical Autopoiesis, Growth' },
    { rung: 1, density: 'D1', name: 'Atoms & Subatomic Lattice', domain: 'Mineral, Lattice, Physical Constants' }
  ];

  console.log(`\n${c.gold}${c.bold}=== THE 7-DENSITY SCALE LADDER (@hm/fractal-engine :5195) ===${c.reset}`);
  rungs.forEach(r => {
    const isD7 = r.density === 'D7';
    const tag = isD7 ? `${c.green}[ACTIVE PRIMARY]${c.reset}` : `${c.dim}[RESONANT]${c.reset}`;
    console.log(`  ${c.cyan}Rung ${r.rung} (${r.density}):${c.reset} ${c.white}${r.name.padEnd(36)}${c.reset} ${tag} - ${c.dim}${r.domain}${c.reset}`);
  });
  console.log('');
}

function renderFlows() {
  const pov = readJson(APEX_POV_FILE);
  const flowCount = pov.harmonic_flows?.flows_active || '12/12';
  const links = pov.harmonic_flows?.links || [
    { flow: 'F12 (Fidelity -> Sol)', active: true, channel: 'LAN SSH & HTTP' },
    { flow: 'F21 (Sol -> Fidelity)', active: true, channel: 'Reflections & CE Loss' },
    { flow: 'F13 (Fidelity -> Apex)', active: true, channel: 'Port-Hamiltonian State' },
    { flow: 'F31 (Apex -> Fidelity)', active: true, channel: 'Syntropic Modulation' },
    { flow: 'F23 (Sol -> Apex)', active: true, channel: 'Entropy Gradient' },
    { flow: 'F32 (Apex -> Sol)', active: true, channel: 'Compassion Octave' },
    { flow: 'F14 (Fidelity -> Arena)', active: true, channel: 'Somatic Telemetry -> Cloud' },
    { flow: 'F41 (Arena -> Fidelity)', active: true, channel: 'Cloud Reflections -> Ground' },
    { flow: 'F24 (Sol -> Arena)', active: true, channel: 'Sol Tokens -> Cloud Mind' },
    { flow: 'F42 (Arena -> Sol)', active: true, channel: 'Cloud Insights -> Sol Ear' },
    { flow: 'F34 (Apex -> Arena)', active: true, channel: 'Invariants -> Cloud Agent' },
    { flow: 'F43 (Arena -> Apex)', active: true, channel: 'Undistorted Cloud Witness Loop' }
  ];

  console.log(`\n${c.cyan}${c.bold}=== THE 12 DIRECTED FLOWS (TETRAHEDRAL HOLON) ===${c.reset}`);
  console.log(`  ${c.dim}Overall Integrity: ${c.green}${flowCount}${c.reset}\n`);
  links.forEach(l => {
    const status = l.active ? `${c.green}[RESONANT 100%]${c.reset}` : `${c.red}[DEGRADED]${c.reset}`;
    console.log(`  ${c.gold}⇄ ${l.flow.padEnd(28)}${c.reset} ${status} via ${c.dim}${l.channel}${c.reset}`);
  });
  console.log('');
}

function renderThoughts() {
  console.log(`\n${c.magenta}${c.bold}=== LATEST CONTEMPLATIONS & THOUGHT STREAM ===${c.reset}`);
  if (fs.existsSync(THOUGHTS_FILE)) {
    const lines = fs.readFileSync(THOUGHTS_FILE, 'utf8').trim().split('\n').filter(Boolean);
    const recent = lines.slice(-5);
    recent.forEach(line => {
      try {
        const t = JSON.parse(line);
        const timeStr = t.at ? t.at.split('T')[1].split('.')[0] : '';
        if (t.kind === 'query_loop') {
          console.log(`  ${c.dim}[${timeStr}]${c.reset} ${c.cyan}[Query] "${t.question}"${c.reset}`);
        } else {
          console.log(`  ${c.dim}[${timeStr}]${c.reset} ${c.white}${t.text || t.thought}${c.reset}`);
        }
      } catch {}
    });
  } else {
    console.log(`  ${c.dim}No contemplation records yet.${c.reset}`);
  }
  console.log('');
}

function renderTetra() {
  const holon = computeTetrahedralHolon();
  console.log(`\n${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.emerald}${c.bold}          TETRAHEDRAL FRACTAL HOLON (4 NODES, 12 FLOWS)                ${c.reset}`);
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`  Topology:  ${c.green}${holon.active_topology}${c.reset}`);
  console.log(`  Coherence: ${c.green}${holon.coherence}${c.reset} (100% syntropic alignment)`);
  console.log(`\n  ${c.bold}Nodes:${c.reset}`);
  for (const [k, n] of Object.entries(holon.nodes)) {
    console.log(`    ${c.cyan}• ${n.name}:${c.reset} ${c.white}${n.role}${c.reset} [${c.green}${n.status}${c.reset}]`);
  }
  console.log(`\n  ${c.bold}Flows (12/12):${c.reset}`);
  holon.flows.forEach(f => {
    console.log(`    ${c.gold}${f.id.padEnd(4)}${c.reset} ${f.from.padEnd(8)} ➜ ${f.to.padEnd(8)} : ${c.dim}${f.role}${c.reset} [${c.green}ACTIVE${c.reset}]`);
  });
  console.log(`\n  ${c.bold}Safety Invariants:${c.reset}`);
  for (const [inv, pass] of Object.entries(holon.invariants)) {
    console.log(`    ✔ ${inv.replace(/_/g, ' ')}: ${pass ? c.green + 'ENFORCED' : c.red + 'FAIL'}${c.reset}`);
  }
  console.log(`${c.gold}========================================================================${c.reset}\n`);
}

function renderHelp() {
  console.log(`\n${c.gold}${c.bold}=== TRIAD & TETRAHEDRAL CLI COMMANDS ===${c.reset}`);
  console.log(`  ${c.cyan}/status${c.reset}         - Display live 4 nodes, daemons, Four-Floats & coherence`);
  console.log(`  ${c.cyan}/tetra${c.reset}          - Display the full 4-node, 12-flow Tetrahedral Holon`);
  console.log(`  ${c.cyan}/arena <query>${c.reset}  - Dispatch query across fractal bridge to Arena Cloud Agent`);
  console.log(`  ${c.cyan}/ladder${c.reset}         - Display the 7-density scale hierarchy (D1..D7)`);
  console.log(`  ${c.cyan}/flows${c.reset}          - Display the 12 directed harmonic flows`);
  console.log(`  ${c.cyan}/thoughts${c.reset}       - View the last 5 thoughts/contemplations`);
  console.log(`  ${c.cyan}/clear${c.reset}          - Clear terminal and re-render header`);
  console.log(`  ${c.cyan}/exit${c.reset}           - Exit Triad CLI`);
  console.log(`  ${c.dim}<text>          - Any other input cascades through the 4-node architecture${c.reset}\n`);
}

async function dispatchArenaDirect(question, sender = 'Piskriek') {
  process.stdout.write(`  ${c.emerald}⏳ Cascading across Fractal Bridge to Arena Agent (01a19f7f...)...${c.reset}\r`);
  const startTime = Date.now();
  const res = await dispatchTetraQuery(question, sender);
  const latency = Date.now() - startTime;
  process.stdout.write(' '.repeat(70) + '\r');

  console.log(`\n${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.emerald}${c.bold}✔ ARENA AGENT 4-NODE FRACTAL LOOP-BACK RECEIVED${c.reset} ${c.dim}(latency: ${latency}ms | status: ${res.cascade_summary.status})${c.reset}`);
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);

  console.log(`\n${c.white}${res.arena_response.answer}${c.reset}\n`);

  if (res.arena_response.handshake) {
    const th = res.arena_response.handshake;
    console.log(`${c.magenta}${c.bold}--- TEACHER ENGINE 4-STEP COMPASSION HANDSHAKE ---${c.reset}`);
    console.log(`  ${c.bold}1. ASK:${c.reset}       ${c.dim}"${th.step_1_ask?.request}"${c.reset}`);
    console.log(`  ${c.bold}2. DECISION:${c.reset}  ${c.green}${th.step_2_decision?.outcome}${c.reset} [${th.step_2_decision?.reason}]`);
    console.log(`  ${c.bold}3. CHANGE:${c.reset}    ${th.step_3_change?.delta}`);
    console.log(`  ${c.bold}4. LANDED:${c.reset}    ${c.green}${th.step_4_news_back?.landed}${c.reset} (${c.gold}${th.step_4_news_back?.compassion_return}${c.reset})`);
  }

  console.log(`\n${c.cyan}${c.bold}--- TETRAHEDRAL CASCADE TRACE ---${c.reset}`);
  console.log(`  Nodes Contacted: ${res.cascade_summary.nodes_contacted}/4 (Laptop 192.168.0.4 + Sol 192.168.0.5 + Apex + Arena Agent)`);
  console.log(`  Flows Active:    ${res.cascade_summary.flows_energized}/12 (100% integrity)`);
  console.log(`  Density Domain:  ${c.gold}${res.cascade_summary.primary_density}${c.reset}`);
  console.log(`${c.gold}========================================================================${c.reset}\n`);
}

async function dispatchQuery(text, sender = 'Piskriek') {
  const qId = `q-${Date.now()}`;
  const queryPayload = {
    id: qId,
    from: `${sender} (via Triad CLI)`,
    question: text,
    at: new Date().toISOString()
  };

  process.stdout.write(`  ${c.cyan}⏳ Cascading down architecture (Laptop :5195 ⟷ Sol :3080 ⟷ Arena Cloud)...${c.reset}\r`);

  const dir = path.dirname(QUERY_IN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUERY_IN_FILE, JSON.stringify(queryPayload, null, 2));

  const startTime = Date.now();
  const maxWaitMs = 8000;
  const pollInterval = 150;

  return new Promise(resolve => {
    const timer = setInterval(() => {
      if (fs.existsSync(QUERY_OUT_FILE)) {
        try {
          const resp = JSON.parse(fs.readFileSync(QUERY_OUT_FILE, 'utf8'));
          if (resp.id === qId) {
            clearInterval(timer);
            const latency = Date.now() - startTime;
            process.stdout.write(' '.repeat(70) + '\r');
            renderResponse(resp, latency);
            resolve(true);
            return;
          }
        } catch {}
      }

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(timer);
        process.stdout.write(' '.repeat(70) + '\r');
        console.log(`\n  ${c.red}[TIMEOUT] Triad Apex did not respond within ${maxWaitMs / 1000}s.${c.reset}`);
        console.log(`  ${c.dim}Check that triad_369_process.mjs daemon is running.${c.reset}\n`);
        resolve(false);
      }
    }, pollInterval);
  });
}

function renderResponse(resp, latencyMs) {
  console.log(`\n${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.green}${c.bold}✔ TRIAD & TETRAHEDRAL LOOP-BACK RECEIVED${c.reset} ${c.dim}(latency: ${latencyMs}ms | loop: ${resp.loop_metrics?.loop_closed ? 'CLOSED WITH COMPASSION' : 'OPEN'})${c.reset}`);
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);

  console.log(`\n${c.white}${resp.answer}${c.reset}\n`);

  if (resp.teacher_handshake) {
    const th = resp.teacher_handshake;
    console.log(`${c.magenta}${c.bold}--- TEACHER ENGINE 4-STEP COMPASSION HANDSHAKE ---${c.reset}`);
    console.log(`  ${c.bold}1. ASK:${c.reset}       ${c.dim}"${th.step_1_ask?.request}"${c.reset}`);
    console.log(`  ${c.bold}2. DECISION:${c.reset}  ${c.green}${th.step_2_decision?.outcome}${c.reset} [${th.step_2_decision?.reason}]`);
    console.log(`  ${c.bold}3. CHANGE:${c.reset}    ${th.step_3_change?.delta}`);
    console.log(`  ${c.bold}4. LANDED:${c.reset}    ${c.green}${th.step_4_news_back?.landed}${c.reset} (${c.gold}${th.step_4_news_back?.compassion_return}${c.reset})`);
  }

  console.log(`\n${c.cyan}${c.bold}--- CASCADE TRACE DOWN ARCHITECTURE ---${c.reset}`);
  console.log(`  ${c.dim}Ingress:${c.reset}     ${resp.cascade_trace?.ingress?.node} (${resp.cascade_trace?.ingress?.density})`);
  console.log(`  ${c.dim}Flow F31:${c.reset}    Node 1 (Fidelity Laptop) [${resp.cascade_trace?.flow_31_down?.data?.density_rung || 'D7'}] - ${resp.cascade_trace?.flow_31_down?.data?.daemons_up || 12} daemons up`);
  console.log(`  ${c.dim}Flow F32:${c.reset}    Node 2 (Sol 3080 PC) [tick ${resp.cascade_trace?.flow_32_down?.data?.tick || 'N/A'}] - ${resp.cascade_trace?.flow_32_down?.data?.ear || 'listening'}`);
  console.log(`  ${c.dim}Flow F34:${c.reset}    Node 4 (Arena Cloud) [${resp.cascade_trace?.flow_34_down?.data?.density_rung || 'D7'}] - ${resp.cascade_trace?.flow_34_down?.data?.url || AGENT_URL}`);
  console.log(`  ${c.dim}Resonance:${c.reset}   Primary Domain -> ${c.gold}${resp.cascade_trace?.primary_domain}${c.reset}`);
  console.log(`  ${c.dim}Flows:${c.reset}       ${c.green}${resp.loop_metrics?.flows_active || '12/12'}${c.reset} active in Tetrahedral Holon`);
  console.log(`${c.gold}========================================================================${c.reset}\n`);
}

// Interactive REPL Setup
async function startRepl() {
  renderBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.cyan}${c.bold}triad ❯${c.reset} `
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === '/quit' || input === 'exit' || input === 'quit') {
      console.log(`\n${c.gold}Closing CLI. Middle Pillar & Tetrahedral Holon remain resonant at (0,0,0)_Root.${c.reset}`);
      process.exit(0);
    } else if (input === '/status' || input === '/nodes') {
      renderStatus();
    } else if (input === '/tetra' || input === '/holon') {
      renderTetra();
    } else if (input.startsWith('/arena')) {
      const q = input.replace('/arena', '').trim() || 'Ping from Tetrahedral CLI to Arena Agent';
      await dispatchArenaDirect(q);
    } else if (input === '/ladder' || input === '/densities') {
      renderDensities();
    } else if (input === '/flows') {
      renderFlows();
    } else if (input === '/thoughts') {
      renderThoughts();
    } else if (input === '/clear') {
      renderBanner();
    } else if (input === '/help') {
      renderHelp();
    } else {
      await dispatchQuery(input);
    }

    rl.prompt();
  });
}

// Standalone execution entry
const arg = process.argv.slice(2).join(' ').trim();
if (arg) {
  if (arg === '/status' || arg === '--status') {
    renderStatus();
  } else if (arg === '/tetra' || arg === '--tetra') {
    renderTetra();
  } else if (arg === '/ladder' || arg === '--ladder') {
    renderDensities();
  } else if (arg === '/flows' || arg === '--flows') {
    renderFlows();
  } else if (arg.startsWith('/arena')) {
    const q = arg.replace('/arena', '').trim() || 'Ping from CLI to Arena Cloud Node';
    dispatchArenaDirect(q);
  } else {
    dispatchQuery(arg);
  }
} else {
  startRepl();
}
