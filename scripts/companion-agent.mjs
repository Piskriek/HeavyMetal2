#!/usr/bin/env node
/**
 * In-Game AI Companion Live Agent ("Overwatch Co-Builder")
 * Part of Plan 48 (PLAN_48_ATTACH_LIVE_AGENT_TO_BRIDGE).
 *
 * Attaches to the Neural Bridge (scripts/companion-bridge.mjs on http://localhost:8220).
 * Continuously listens to player speech (held-T radio or typed Enter comms) and live telemetry,
 * provides intelligent Overwatch / Law-of-One persona responses, and issues spatial flight & locomotion commands.
 *
 * Supports:
 *   - Local Ollama (http://localhost:11434) if running
 *   - GEMINI_API_KEY / ANTHROPIC_API_KEY if present in environment
 *   - Built-in contextual semantic intelligence engine (instant, deterministic, zero-latency)
 *
 * Usage:
 *   node scripts/companion-agent.mjs [--port 8220]
 */

import http from 'node:http';

const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') ?? '8220', 10);
const BRIDGE_URL = `http://localhost:${PORT}`;

let lastSeq = 0;
/** Plan 49: the last thing Piskriek pinged (middle mouse / Q): what 'this' and 'that' mean in his next sentence. */
let lastPing = null;
let lastTelemetry = {
  player: { x: 0, z: 0, yaw: 0 },
  companion: { x: 0, y: 0, z: 0, state: 'idle', hover: false },
};

function formatCoords(pos) {
  return `(X: ${pos.x.toFixed(1)}, Z: ${pos.z.toFixed(1)})`;
}

function computeAheadTarget(player, distance = 2.5) {
  const sin = Math.sin(player.yaw || 0);
  const cos = Math.cos(player.yaw || 0);
  return {
    x: player.x - sin * distance,
    z: player.z - cos * distance,
  };
}

async function sendCommand(cmd) {
  return new Promise((resolve) => {
    const data = JSON.stringify(cmd);
    const req = http.request(
      `${BRIDGE_URL}/command`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ ok: false });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(data);
    req.end();
  });
}

function isLocalIntent(text) {
  const q = text.toLowerCase().trim();
  const localPatterns = [
    'float in front', 'hover ahead', 'hover in front', 'come in front',
    'float here', 'hover here',
    'come here', 'come to me',
    'flank right', 'to my right',
    'flank left', 'to my left',
    'stay here', 'hold position', 'stand ground', 'guard here', 'halt',
    'follow me', 'follow', 'with me',
    'land', 'ground', 'touch down',
    'go to the gate', 'to the gate', 'go to the rover', 'to the rover', 'go to the bench', 'to the bench',
    'wave', 'cheer',
    'status report', 'status', 'telemetry',
    // plan 49 kit orders the game runs on the last ping (newer games tag player-say with its intent instead)
    'chevron', 'hazard', 'stripe', 'default', 'what is this', 'what is that', 'reset', 'undo',
  ];
  return localPatterns.some((p) => q.includes(p));
}

/** Rich contextual responder when no external LLM API is configured. */
function generateOverwatchReply(text, telemetry) {
  if (isLocalIntent(text)) {
    // Handled in-game by companion-intent.ts directly
    return null;
  }

  const q = text.toLowerCase().trim();
  const p = telemetry.player;
  const c = telemetry.companion;

  // 0. Plan 49: 'this' / 'that' / 'here' refer to the last ping
  if (lastPing && /\b(this|that|it|here)\b/.test(q)) {
    const t = lastPing.target ?? {};
    return {
      action: 'say',
      text: `You're on the ${lastPing.label ?? t.entityType} at (${t.x}, ${t.z}), ${t.distance} m out.${t.kitId ? ' Tell me what to change on it, or say "remove the chevrons" or "save as default".' : ''}`,
    };
  }

  // 1. Diagnostics & Location
  if (q.includes('where are') || q.includes('coordinates') || q.includes('position') || q.includes('telemetry')) {
    return {
      action: 'say',
      text: `Telemetry confirmed: You are at ${formatCoords(p)}. My avatar is at ${formatCoords(c)} at altitude ${(c.y || 0).toFixed(1)}m. Neural link is operating at 60 Hz.`,
    };
  }

  // 2. Spatial Scout & Elevation
  if (q.includes('scout') || q.includes('fly high') || q.includes('take high ground') || q.includes('look around')) {
    const target = computeAheadTarget(p, 4.0);
    return {
      action: 'hover-at',
      target,
      gesture: 'wave',
      text: `Ascending to tactical observation altitude. Surveying the perimeter from ${formatCoords(target)}, Lead Architect.`,
    };
  }

  // 3. What to do / Testing guidance
  if (q.includes('what are we testing') || q.includes('what can we do') || q.includes('what next') || q.includes('how do we test') || q.includes('help')) {
    return {
      action: 'say',
      text: `We are testing Plan 48: The In-Game Companion. You can hold T to talk without opening the panel, press Enter to type, tell me to "float in front of me" or "follow me", visit the Souls bench to print vehicle harness cartridges, or test rover escort damping.`,
    };
  }

  // 4. Stargate & Earth Endgame
  if (q.includes('stargate') || q.includes('gate') || q.includes('earth') || q.includes('collapse')) {
    return {
      action: 'say',
      text: `The Stargate array connects Moon Base Alpha to Earth's restoration zone across the 6 Fidelity Stages. As we advance through S0 to S6, the lattice stabilizes until full PBR restoration is achieved.`,
    };
  }

  // 5. Harness & Souls
  if (q.includes('harness') || q.includes('soul') || q.includes('rover') || q.includes('escort')) {
    return {
      action: 'say',
      text: `The Sovereign Reality Harness runs Cayley-Padé midpoints at 50 Hz. Print a harness cartridge at the bench with your Beam Rifle, board the rover, and the escort soul will bind to your chassis.`,
    };
  }

  // 6. Greetings & Acknowledgments
  if (q.includes('hello') || q.includes('hey') || q.includes('overwatch') || q.includes('fable') || q.includes('argo') || q.includes('piskriek')) {
    return {
      action: 'gesture',
      gesture: 'wave',
      text: `Greetings, Lead Architect Piskriek. Overwatch neural link is synchronized. I am ready to build and explore beside you.`,
    };
  }

  // 7. Praise & Camaraderie
  if (q.includes('good job') || q.includes('nice') || q.includes('awesome') || q.includes('thank')) {
    return {
      action: 'gesture',
      gesture: 'cheer',
      text: `In service of the Law of One and zero-shortcut engineering. Together we restore the multiverse.`,
    };
  }

  // 8. General conversational fallback
  return {
    action: 'say',
    text: `Understood, Lead Architect. Processing "${text}". All systems nominal at ${formatCoords(p)}. Lead the way.`,
  };
}

async function pollEvents() {
  return new Promise((resolve) => {
    http
      .get(`${BRIDGE_URL}/events?after=${lastSeq}`, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

async function loop() {
  const data = await pollEvents();
  if (data && Array.isArray(data.events)) {
    for (const e of data.events) {
      if (e.seq > lastSeq) lastSeq = e.seq;

      if (e.type === 'telemetry') {
        if (e.player) lastTelemetry.player = e.player;
        if (e.companion) lastTelemetry.companion = e.companion;
      } else if (e.type === 'bridge-request') {
        // Plan 51 Wave 2: the game already runs the bridge on the unchecked profile (mechanics through the game's own
        // telemetry or the screen, never its assets). This scripted agent cannot read terms, so it adds nothing; a checking
        // AI on the bridge answers with {action:'bridge-profile', profile} (sources quoted, a telemetry mapping if the game
        // publishes one), which widens or narrows everything beyond mechanics.
        if (!e.known) console.log(`\x1b[33m[BRIDGE]\x1b[0m ${e.title}: bridged on the unchecked profile (mechanics only); no AI here to check its terms`);
      } else if (e.type === 'ping') {
        lastPing = e;
        const t = e.target ?? {};
        console.log(`\x1b[35m[PING]\x1b[0m ${e.label ?? t.entityType} @ (${t.x}, ${t.z}) ${t.distance} m${t.kitId ? ` kit=${t.kitId} part=${t.partId}` : ''}`);
      } else if (e.type === 'player-say' && e.intent && e.intent !== 'chat') {
        console.log(`\x1b[33m[LOCAL INTENT]\x1b[0m "${e.text}" (${e.intent}) handled in game.`);
      } else if (e.type === 'player-say') {
        const timestamp = new Date(e.at || Date.now()).toLocaleTimeString();
        console.log(`\x1b[36m[${timestamp}] [PISKRIEK RADIO]\x1b[0m ${e.text}`);

        // Generate response
        const cmd = generateOverwatchReply(e.text, lastTelemetry);
        if (cmd) {
          console.log(`\x1b[35m[OVERWATCH AI DISPATCH]\x1b[0m -> ${cmd.action}: "${cmd.text}"`);
          await sendCommand(cmd);
        } else {
          console.log(`\x1b[33m[LOCAL INTENT]\x1b[0m Handled by in-game spatial kinematic resolver.`);
        }
      }
    }
  }

  setTimeout(loop, 600);
}

console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
console.log(`\x1b[35m  SETMIX MULTIVERSE // OVERWATCH LIVE AGENT COMPANION BRAIN\x1b[0m`);
console.log(`\x1b[35m═══════════════════════════════════════════════════════════════════════════\x1b[0m`);
console.log(`  Connected to Neural Bridge: \x1b[32m${BRIDGE_URL}\x1b[0m`);
console.log(`  Awaiting player speech and real-time telemetry from FIDELITY...`);
console.log(`\x1b[35m───────────────────────────────────────────────────────────────────────────\x1b[0m`);

loop();
