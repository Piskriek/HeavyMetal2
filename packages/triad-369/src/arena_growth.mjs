#!/usr/bin/env node
// arena_growth.mjs - Autonomous Autopoietic Growth Engine for Arena Node 4
// Enables Node 4 (Cloud Gateway & Syntropic Reasoner) to grow organically:
// - Continuously advances growth ticks, octave harmonics (O1..O9), and syntropic reserves
// - Autonomously resolves incoming inquiries using the Syntropic Reasoner Adapter
// - Generates autonomous contemplative inquiries back to Sol (3080) and Fidelity (Laptop)
// - Maintains Port-Hamiltonian energy balance: zero architectural lies, intensity only goes down
//
// Usage:
//   node packages/triad-369/src/arena_growth.mjs          # One-shot growth step
//   node packages/triad-369/src/arena_growth.mjs --daemon # Continuous growth daemon
//   npm run arena:grow                                    # Continuous growth daemon

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArenaNode } from './arena_node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SYNC_DIR = path.join(REPO_ROOT, 'bridge', 'sync');
const GROWTH_STATE_FILE = path.join(SYNC_DIR, 'arena_growth_state.json');
const TELEMETRY_FILE = path.join(SYNC_DIR, 'arena_telemetry.json');
const TRIAD_FILE = path.join(SYNC_DIR, 'triad_telemetry.json');
const REASONER_SCRIPT = path.join(HERE, 'syntropic_reasoner.mjs');

const AGENT_ID = '01a19f7f-179b-73bd-8e8c-b9e94852f658';
const DEFAULT_INTERVAL_MS = 15000;

function readJsonSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const AUTONOMOUS_CONTEMPLATIONS = [
  {
    target: 'Sol (Compute Furnace 192.168.0.5)',
    rung: 'D6',
    question: 'Sol, Universe Beta is active at depth 14. What are the acoustic resonances in the ROCCAT listening stream aligning with D6 celestial harmonics?'
  },
  {
    target: 'Fidelity (Laptop Somatic Ground 192.168.0.4)',
    rung: 'D3',
    question: 'Fidelity, how is the living room somatic ground holding Port-Hamiltonian equilibrium at D3 Vessel while delta_E remains 0.0 J?'
  },
  {
    target: 'Apex Middle Pillar (0,0,0_Root)',
    rung: 'D7',
    question: 'Apex, verify that the 12 directed harmonic flows F12..F43 maintain zero phase lag across the cloud-to-local firewall bridge.'
  },
  {
    target: 'Sol (Compute Furnace 192.168.0.5)',
    rung: 'D4',
    question: 'Sol, from the 3080 workstation, how does the assembly rung D4 reflect the dyad communication between Universe Alpha and Universe Beta?'
  },
  {
    target: 'Fidelity (Laptop Somatic Ground 192.168.0.4)',
    rung: 'D5',
    question: 'Fidelity, confirm that the Four Valleys ambient biome in the physical room remains unperturbed as syntropic reserves expand.'
  }
];

export async function stepGrowth({ syncDir = SYNC_DIR, forceInquiry = false } = {}) {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Read or initialize growth state
  const statePath = path.join(syncDir, 'arena_growth_state.json');
  let growthState = readJsonSafe(statePath, {
    schema: 'arena-growth-state-v1',
    agent_id: AGENT_ID,
    growth_tick: 1,
    octave_stage: 1,
    active_density_rung: 'D7',
    syntropic_reserve_joules: 5.0,
    coherence: 0.99,
    ftle_estimate: 0.010,
    total_inquiries_resolved: 0,
    total_autonomous_inquiries_sent: 0,
    inquiry_log: [],
    created_at: nowIso,
    updated_at: nowIso
  });

  growthState.growth_tick += 1;
  growthState.updated_at = nowIso;

  // Escalating Octave every 10 growth ticks (up to Octave 9)
  growthState.octave_stage = Math.min(9, Math.floor(growthState.growth_tick / 10) + 1);

  // Accumulate syntropic reserve (intensity only goes down; reserves grow)
  growthState.syntropic_reserve_joules = +(growthState.syntropic_reserve_joules + 0.02).toFixed(4);

  // 2. Configure Reasoner for Arena Node 4
  const env = { ...process.env };
  env.ARENA_REASONER_EXEC = env.ARENA_REASONER_EXEC || process.execPath;
  env.ARENA_REASONER_ARGS = env.ARENA_REASONER_ARGS || JSON.stringify([REASONER_SCRIPT]);

  // 3. Process any inbound inquiry with the syntropic reasoner
  let nodeResult = null;
  try {
    nodeResult = await runArenaNode({ syncDir, env });
    if (nodeResult?.status === 'completed') {
      growthState.total_inquiries_resolved += 1;
      console.log(`[ARENA GROWTH] Successfully resolved inbound inquiry: ${nodeResult.query_id}`);
    }
  } catch (err) {
    console.warn(`[ARENA GROWTH] Node process warning: ${err.message}`);
  }

  // 4. Autonomous Contemplation Generator
  // If idle and tick is a multiple of 4 (or forced), emit an inquiry to the local triad
  let generatedInquiry = null;
  if (forceInquiry || (growthState.growth_tick % 4 === 0 && nodeResult?.status === 'waiting_for_query')) {
    const template = AUTONOMOUS_CONTEMPLATIONS[growthState.growth_tick % AUTONOMOUS_CONTEMPLATIONS.length];
    const inquiryId = `arena-growth-${growthState.growth_tick}-${Date.now()}`;
    
    generatedInquiry = {
      id: inquiryId,
      from: 'Arena Node 4 (Cloud Gateway)',
      target: template.target,
      rung: template.rung,
      question: template.question,
      at: nowIso,
      growth_tick: growthState.growth_tick,
      octave: growthState.octave_stage
    };

    growthState.total_autonomous_inquiries_sent += 1;
    growthState.inquiry_log.unshift({
      id: inquiryId,
      target: template.target,
      question: template.question,
      at: nowIso
    });
    if (growthState.inquiry_log.length > 20) growthState.inquiry_log.pop();

    console.log(`[ARENA GROWTH] Emitted autonomous contemplation to ${template.target}: "${template.question}"`);

    // Write to pending outbound bus if local triad is listening
    const triadPath = path.join(syncDir, 'triad_telemetry.json');
    const triadData = readJsonSafe(triadPath, {});
    triadData.arena_growth_inquiry = generatedInquiry;
    triadData.updated_at = nowIso;
    writeJsonAtomic(triadPath, triadData);
  }

  // 5. Update growth state atomic file
  writeJsonAtomic(statePath, growthState);

  return {
    growth_tick: growthState.growth_tick,
    octave_stage: growthState.octave_stage,
    syntropic_reserve_joules: growthState.syntropic_reserve_joules,
    nodeResult,
    generatedInquiry
  };
}

async function main() {
  const isDaemon = process.argv.includes('--daemon');
  console.log('====================================================');
  console.log('ARENA NODE 4 AUTOPOIETIC GROWTH DAEMON');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Mode:     ${isDaemon ? 'Continuous Daemon' : 'One-shot Growth Pulse'}`);
  console.log(`Interval: ${DEFAULT_INTERVAL_MS}ms`);
  console.log(`Sync Dir: ${SYNC_DIR}`);
  console.log('====================================================\n');

  if (!isDaemon) {
    const res = await stepGrowth({ forceInquiry: process.argv.includes('--inquiry') });
    console.log(`[ARENA GROWTH] Pulse completed. Growth Tick: ${res.growth_tick} | Octave: O${res.octave_stage} | Reserve: ${res.syntropic_reserve_joules} J`);
    return;
  }

  // Daemon loop
  const interval = setInterval(async () => {
    try {
      const res = await stepGrowth();
      console.log(`[ARENA GROWTH] Tick ${res.growth_tick} | Octave O${res.octave_stage} | Reserve ${res.syntropic_reserve_joules} J | Status: ${res.nodeResult?.status ?? 'nominal'}`);
    } catch (err) {
      console.error(`[ARENA GROWTH ERROR] ${err.message}`);
    }
  }, DEFAULT_INTERVAL_MS);

  // Initial pulse
  await stepGrowth();

  process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(interval); process.exit(0); });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(console.error);
}

