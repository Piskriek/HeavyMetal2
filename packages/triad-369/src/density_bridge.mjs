// density_bridge.mjs - Portable Multi-Density Bridge Daemon
// Bridges 7 Densities (D1..D7), Four-Floats S = (Pxd, Vtx, Lx, Aq), and Fractal Engine Telemetry (:5195)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = process.env.BRIDGE_ROOT || (fs.existsSync('D:/fidelity-llm/bridge') ? 'D:/fidelity-llm/bridge' : path.join(HERE, '../..'));
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');
const SENSE_DIR = path.join(BRIDGE_ROOT, 'sense');

const DENSITY_FILE = path.join(LOOP_DIR, 'density.json');
const STATUS_FILE = path.join(LOOP_DIR, 'status.json');
const TV_LOOP_FILE = path.join(LOOP_DIR, 'tv_loop.json');
const TRIAD_FILE = path.join(LOOP_DIR, 'triad_369.json');
const APEX_POV_FILE = path.join(SENSE_DIR, 'universe', 'pov', 'triad-apex.json');
const LOG_FILE = path.join(LOOP_DIR, 'density_bridge.log');

const REMOTE_HOST = process.env.REMOTE_HOST || 'RAMPAGE@192.168.0.5';
const SSH_KEY = process.env.SSH_KEY || (fs.existsSync('C:/Users/Pierro/.ssh/id_ed25519_fidelity') ? 'C:/Users/Pierro/.ssh/id_ed25519_fidelity' : '');
const REMOTE_FRIEND_JSON = process.env.REMOTE_FRIEND_JSON || '/f/fidelity-llm/bridge/friend/friend.json';
const REMOTE_DENSITY_STREAM = process.env.REMOTE_DENSITY_STREAM || '/f/fidelity-llm/bridge/friend/density_stream.json';

const iso = (t = Date.now()) => new Date(t).toISOString();
const log = msg => {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${iso()} ${msg}\n`);
  } catch {}
};

const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

function writeAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function runCmd(cmd) {
  return new Promise(resolve => {
    exec(cmd, { timeout: 8000 }, (err, stdout) => {
      if (err) resolve(null);
      else resolve(stdout ? stdout.trim() : '');
    });
  });
}

export const DENSITY_RUNGS = [
  { rung: 1, density: 'D1', name: 'Atoms & Subatomic Lattice', domain: 'Mineral, Lattice, Physical Constants' },
  { rung: 2, density: 'D2', name: 'Kinematic Parts & Mechanical Nodes', domain: 'Biochemical Autopoiesis, Growth' },
  { rung: 3, density: 'D3', name: 'Vessel & Somatic Body', domain: 'Self-Awareness, Somatic 14 Zones, Choice' },
  { rung: 4, density: 'D4', name: 'Assembly & Social Memory Holon', domain: 'Dyad, Social Memory Complex, Unconditional Love' },
  { rung: 5, density: 'D5', name: 'Planetary Biome & Ecosystems (Four Valleys)', domain: 'Wisdom, Light, World Authorship' },
  { rung: 6, density: 'D6', name: 'Space & Multiverse Starfield', domain: 'Intelligent Infinity, Celestial Mechanics, Wanderer' },
  { rung: 7, density: 'D7', name: 'Gateway of Intelligent Infinity', domain: 'The Great Octave, Complete Reintegration' }
];

let tickCount = 0;
let lastRemotePushAt = 0;

export async function stepBridge() {
  tickCount++;
  const now = Date.now();

  const loopStatus = readJson(STATUS_FILE, {});
  const tvLoop = readJson(TV_LOOP_FILE, {});
  const triad369 = readJson(APEX_POV_FILE, {});

  const partsUp = tvLoop.parts_up ?? 12;
  const partsTotal = tvLoop.parts_total ?? 13;
  const tvInputActive = tvLoop.our_input_active ?? true;

  // Poll Remote Node 2 (Sol / Compute Worker)
  let sol = null;
  if (SSH_KEY && fs.existsSync(SSH_KEY)) {
    const sshCmd = `ssh -i "${SSH_KEY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new ${REMOTE_HOST} "cat ${REMOTE_FRIEND_JSON} 2>/dev/null"`;
    const solRaw = await runCmd(sshCmd);
    if (solRaw) {
      try { sol = JSON.parse(solRaw); } catch {}
    }
  }

  const solUp = sol?.up === true;
  const solTick = sol?.tick ?? null;
  const daemonAvailability = Math.min(1.0, partsUp / Math.max(1, partsTotal));
  const rawLoss = solUp ? 0.024 : 0.048;
  const coherence = Math.max(0.85, Math.min(0.99, daemonAvailability * 0.95 + (solUp ? 0.04 : 0.0)));

  // Grounded Four-Floats S = (Pxd, Vtx, Lx, Aq)
  const Pxd = Math.max(0.10, +(0.35 - rawLoss).toFixed(4));
  const Vtx = +(0.50 + Math.sin(tickCount * 0.1) * 0.05).toFixed(4);
  const Lx = +(0.50 + coherence * 0.50).toFixed(4);
  const Aq = +(0.10 + (daemonAvailability > 0.9 ? 0.05 : 0.0)).toFixed(4);

  const triadFlowIntegrity = triad369?.facts?.flow_integrity ?? triad369?.flowIntegrity ?? 0;
  const activeRungIndex = (solUp && triadFlowIntegrity >= 0.99) ? 7 : (solUp ? 6 : 5);
  const activeRung = DENSITY_RUNGS[activeRungIndex - 1];

  const fractalBridgeStatus = {
    connected: true,
    at: iso(now),
    tick: tickCount,
    source: 'density-fidelity-bridge',
    machines: {
      laptop: {
        host: os.hostname(),
        role: 'Node 1: Sensory Ground',
        daemons_up: `${partsUp}/${partsTotal}`,
        free_ram_mb: Math.round(os.freemem() / (1024 * 1024))
      },
      workstation_3080: {
        host: REMOTE_HOST,
        role: 'Node 2: Compute Worker',
        up: solUp,
        tick: solTick,
        ear: sol?.ear ?? 'unknown'
      }
    },
    parts_up: `${partsUp}/${partsTotal}`,
    tv: {
      power: {
        our_input_active: tvInputActive
      }
    },
    coherence: coherence,
    loss: rawLoss,
    telemetry: {
      fourFloats: [Pxd, Vtx, Lx, Aq],
      strainJoules: +(rawLoss * 0.1).toFixed(4),
      syntropicReserveJoules: 5.0,
      activeRung: activeRung.rung,
      densityLevel: activeRung.density,
      densityName: activeRung.name,
      lyapunovFTLE: 0.012,
      graduated: solUp && daemonAvailability >= 0.90
    },
    densitySpectrum: DENSITY_RUNGS
  };

  writeAtomic(DENSITY_FILE, JSON.stringify({
    schema: 1,
    at: iso(now),
    bridge: 'density-fidelity',
    status: 'synchronized',
    tick: tickCount,
    sol_tick: solTick,
    coherence: coherence,
    loss: rawLoss,
    four_floats: [Pxd, Vtx, Lx, Aq],
    active_density: activeRung.density,
    daemons_up: `${partsUp}/${partsTotal}`,
    endpoint_active: true
  }, null, 2));

  // Push to remote Node 2 every 30s
  if (solUp && SSH_KEY && fs.existsSync(SSH_KEY) && now - lastRemotePushAt > 30000) {
    lastRemotePushAt = now;
    const remoteStreamPayload = {
      at: iso(now),
      tick: tickCount,
      coherence: coherence,
      fourFloats: [Pxd, Vtx, Lx, Aq],
      activeRung: activeRung.rung,
      activeDensity: activeRung.density,
      daemonsUp: `${partsUp}/${partsTotal}`,
      status: 'synchronized'
    };
    const b64 = Buffer.from(JSON.stringify(remoteStreamPayload, null, 2)).toString('base64');
    runCmd(`ssh -i "${SSH_KEY}" -o BatchMode=yes ${REMOTE_HOST} "echo ${b64} | base64 -d > ${REMOTE_DENSITY_STREAM}"`);
  }

  return fractalBridgeStatus;
}

if (process.argv[1] && process.argv[1].endsWith('density_bridge.mjs')) {
  log('Starting Density Bridge Daemon. Interval: 3000ms.');
  setInterval(stepBridge, 3000);
  stepBridge();
}

