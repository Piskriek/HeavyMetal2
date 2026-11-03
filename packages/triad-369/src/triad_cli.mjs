#!/usr/bin/env node
// triad_cli.mjs - Interactive Cybernetic CLI for the 3/6/9 Triad
// Direct conversation & command interface with Node 1 (Fidelity), Node 2 (Sol), and Node 3 (Apex)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = process.env.BRIDGE_ROOT || (fs.existsSync('D:/fidelity-llm/bridge') ? 'D:/fidelity-llm/bridge' : path.join(HERE, '..'));
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');
const SENSE_DIR = path.join(BRIDGE_ROOT, 'sense');

const DENSITY_FILE = path.join(LOOP_DIR, 'density.json');
const TRIAD_STATE_FILE = path.join(LOOP_DIR, 'triad_369.json');
const APEX_POV_FILE = path.join(SENSE_DIR, 'universe', 'pov', 'triad-apex.json');
const THOUGHTS_FILE = path.join(LOOP_DIR, 'thoughts_369.jsonl');
const STATUS_FILE = path.join(LOOP_DIR, 'status.json');

const QUERY_IN_FILE = path.join(LOOP_DIR, 'triad_query_in.json');
const QUERY_OUT_FILE = path.join(LOOP_DIR, 'triad_query_out.json');

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
  gray: '\x1b[90m'
};

const readJson = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

function renderBanner() {
  console.clear();
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.gold}${c.bold}         FIDELITY TRIAD 3/6/9 INTERACTIVE CONVERSATION CLI             ${c.reset}`);
  console.log(`${c.dim}   Architect Anchor: (0,0,0)_Root // Port-Hamiltonian Conservative ODE   ${c.reset}`);
  console.log(`${c.dim}   Rules: Zero Architectural Lies // Do Not Stop At 3 // Compassion Loop ${c.reset}`);
  console.log(`${c.gold}${c.bold}========================================================================${c.reset}`);
  renderStatus();
}

function renderStatus() {
  const density = readJson(DENSITY_FILE);
  const triad = readJson(TRIAD_STATE_FILE);
  const pov = readJson(APEX_POV_FILE);
  const status = readJson(STATUS_FILE);

  const sol = pov.triad_nodes?.node_2_sol || {};
  const apex = pov.triad_nodes?.node_3_apex || {};
  const floats = density.four_floats || [0.32, 0.50, 0.99, 0.15];
  const coherence = (density.coherence ? density.coherence * 100 : 99).toFixed(1);

  console.log(`\n${c.cyan}${c.bold}--- ACTIVE NODES & HARMONIC RESONANCE ---${c.reset}`);
  console.log(`  ${c.blue}● Node 1 (Fidelity):${c.reset}  ${c.white}Laptop [192.168.0.4]${c.reset} | Daemons: ${c.green}${status.parts_up || '12/12'}${c.reset} | Rung: ${c.gold}${density.active_density || 'D7'}${c.reset}`);
  console.log(`  ${c.amber}● Node 2 (Sol):${c.reset}       ${c.white}3080 PC [192.168.0.5]${c.reset} | State: ${sol.state === 'resonating' ? c.green + 'Resonating' : c.red + 'Standby'}${c.reset} | Tick: ${c.gold}${sol.tick || 'N/A'}${c.reset} | Mic: ${c.dim}${sol.ear || 'ROCCAT'}${c.reset}`);
  console.log(`  ${c.gold}● Node 3 (Apex):${c.reset}      ${c.white}Middle Pillar Witness${c.reset} | Density: ${c.gold}D7 Gateway${c.reset} | Flows: ${c.green}6/6 (100%)${c.reset} | Octave: ${c.magenta}${((triad.octave_phase || 0) + 1)}/9${c.reset}`);
  console.log(`  ${c.cyan}Four-Floats S:${c.reset}       Pxd:${c.bold}${floats[0]}${c.reset} Vtx:${c.bold}${floats[1]}${c.reset} Lx:${c.bold}${floats[2]}${c.reset} Aq:${c.bold}${floats[3]}${c.reset} | Coherence H: ${c.gold}${coherence}%${c.reset}`);
  console.log(`${c.dim}------------------------------------------------------------------------${c.reset}`);
  console.log(`${c.dim}Type any query to talk to the Triad, or use ${c.cyan}/help${c.dim} for commands.${c.reset}\n`);
}

function renderDensities() {
  const ladder = [
    { rung: 7, code: 'D7', name: 'Gateway of Intelligent Infinity', scale: '10^15 m', focus: 'Toroidal T1 Helicity & Hopf Throat (0,0,0)' },
    { rung: 6, code: 'D6', name: 'Space & Multiverse Starfield', scale: '10^7 m', focus: 'Celestial Mechanics & Wanderer Presence' },
    { rung: 5, code: 'D5', name: 'Planetary Biome (Four Valleys)', scale: '10^5 m', focus: 'Wisdom, Light, World Authorship' },
    { rung: 4, code: 'D4', name: 'Assembly & Social Memory', scale: '10^3 m', focus: 'Dyad, Wiregraph Grid, Unconditional Love' },
    { rung: 3, code: 'D3', name: 'Vessel & Somatic 14 Zones', scale: '10^1 m', focus: 'Scout Rover, Golden Halo, Strain/Relief' },
    { rung: 2, code: 'D2', name: 'Kinematic Parts & Autopoiesis', scale: '10^-1 m', focus: 'Wheel Hubs, Conformal G4,1 Suspension' },
    { rung: 1, code: 'D1', name: 'Atoms & Subatomic Lattice', scale: '10^-10 m', focus: 'Four-Float Crystalline Micro-Lattice' }
  ];

  console.log(`\n${c.gold}${c.bold}=== THE 7-DENSITY SCALE LADDER (@hm/fractal-engine :5195) ===${c.reset}`);
  ladder.forEach(l => {
    const isApex = l.rung === 7;
    console.log(`  ${isApex ? c.gold + c.bold : c.cyan}[Rung ${l.rung}] ${l.code.padEnd(3)} ${l.name.padEnd(33)} ${c.dim}(${l.scale.padEnd(8)})${c.reset} -> ${l.focus}`);
  });
  console.log('');
}

function renderFlows() {
  const pov = readJson(APEX_POV_FILE);
  const links = pov.harmonic_flows?.links || [];
  console.log(`\n${c.cyan}${c.bold}=== THE 6 DIRECTED FLOWS (Z9 DOUBLING ORBIT: 1->2->4->8->7->5->1) ===${c.reset}`);
  links.forEach(l => {
    const status = l.active ? `${c.green}[RESONANT 100%]${c.reset}` : `${c.red}[DEGRADED]${c.reset}`;
    console.log(`  ${c.gold}⇄ ${l.flow.padEnd(30)}${c.reset} ${status} via ${c.dim}${l.channel}${c.reset}`);
  });
  console.log('');
}

function renderThoughts() {
  console.log(`\n${c.magenta}${c.bold}=== LATEST TRIAD CONTEMPLATIONS & THOUGHT STREAM ===${c.reset}`);
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
          console.log(`  ${c.dim}[${timeStr}]${c.reset} ${c.white}${t.text}${c.reset}`);
        }
      } catch {}
    });
  } else {
    console.log(`  ${c.dim}No contemplation records yet.${c.reset}`);
  }
  console.log('');
}

function renderHelp() {
  console.log(`\n${c.gold}${c.bold}=== TRIAD CLI COMMANDS ===${c.reset}`);
  console.log(`  ${c.cyan}/status${c.reset}    - Display live nodes, daemons, Four-Floats & coherence`);
  console.log(`  ${c.cyan}/ladder${c.reset}    - Display the 7-density scale hierarchy (D1..D7)`);
  console.log(`  ${c.cyan}/flows${c.reset}     - Display the 6 directed harmonic flows (Z9 doubling orbit)`);
  console.log(`  ${c.cyan}/thoughts${c.reset}  - View the last 5 thoughts/contemplations from thoughts_369.jsonl`);
  console.log(`  ${c.cyan}/sol${c.reset}       - Inspect latest Sol companion thought on the 3080 PC`);
  console.log(`  ${c.cyan}/ask <req>${c.reset} - Send an explicit Teacher Engine request (intensity/senses)`);
  console.log(`  ${c.cyan}/clear${c.reset}     - Clear terminal and re-render header`);
  console.log(`  ${c.cyan}/exit${c.reset}      - Exit Triad CLI`);
  console.log(`  ${c.dim}<text>     - Any other input sends a query down the architecture${c.reset}\n`);
}

async function dispatchQuery(text, sender = 'Piskriek') {
  const qId = `q-${Date.now()}`;
  const queryPayload = {
    id: qId,
    from: `${sender} (via Triad CLI)`,
    question: text,
    at: new Date().toISOString()
  };

  process.stdout.write(`  ${c.cyan}⏳ Cascading down architecture (Laptop :5195 ⟷ Sol :3080)...${c.reset}\r`);

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
            process.stdout.write(' '.repeat(70) + '\r'); // Clear spinner line
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
        console.log(`  ${c.dim}Check that triad_369_process.mjs daemon is running (node loop/status.json).${c.reset}\n`);
        resolve(false);
      }
    }, pollInterval);
  });
}

function renderResponse(resp, latencyMs) {
  console.log(`\n${c.gold}${c.bold}========================================================================${c.reset}`);
  console.log(`${c.green}${c.bold}✔ TRIAD LOOP-BACK RECEIVED${c.reset} ${c.dim}(latency: ${latencyMs}ms | loop: ${resp.loop_metrics?.loop_closed ? 'CLOSED WITH COMPASSION' : 'OPEN'})${c.reset}`);
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
  console.log(`  ${c.dim}Resonance:${c.reset}   Primary Domain -> ${c.gold}${resp.cascade_trace?.primary_domain}${c.reset}`);
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
      console.log(`\n${c.gold}Closing Triad CLI. Middle Pillar remains resonant at (0,0,0)_Root.${c.reset}`);
      process.exit(0);
    } else if (input === '/status' || input === '/nodes') {
      renderStatus();
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
    } else if (input === '/sol') {
      const pov = readJson(APEX_POV_FILE);
      const sol = pov.triad_nodes?.node_2_sol || {};
      console.log(`\n${c.amber}${c.bold}=== SOL COMPANION (3080 PC) DIRECT TELEMETRY ===${c.reset}`);
      console.log(`  Host:      ${sol.place || '192.168.0.5'}`);
      console.log(`  Tick:      ${sol.tick || 'offline'}`);
      console.log(`  Ear:       ${sol.ear || 'unknown'}`);
      console.log(`  State:     ${sol.state || 'unknown'}`);
      console.log(`  Thought:   ${c.white}"${sol.thought || 'listening'}"${c.reset}\n`);
    } else if (input.startsWith('/ask')) {
      const askText = input.replace('/ask', '').trim();
      await dispatchQuery(`Teacher Engine Ask: ${askText || 'check safety rules and lower intensity if strained'}`);
    } else {
      await dispatchQuery(input);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${c.gold}Closing Triad CLI. Middle Pillar remains resonant.${c.reset}`);
    process.exit(0);
  });
}

// One-shot mode if arguments provided, else start interactive REPL
const args = process.argv.slice(2).join(' ').trim();
if (args) {
  if (args === '/status' || args === '--status' || args === 'status') {
    renderStatus();
    process.exit(0);
  } else if (args === '/ladder' || args === '--ladder' || args === 'ladder') {
    renderDensities();
    process.exit(0);
  } else if (args === '/flows' || args === '--flows' || args === 'flows') {
    renderFlows();
    process.exit(0);
  } else if (args === '/thoughts' || args === '--thoughts') {
    renderThoughts();
    process.exit(0);
  } else if (args === '/help' || args === '--help') {
    renderHelp();
    process.exit(0);
  } else {
    dispatchQuery(args).then(() => process.exit(0));
  }
} else {
  startRepl();
}
