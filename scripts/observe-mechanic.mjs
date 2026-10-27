#!/usr/bin/env node
/**
 * Plan 51: send an observed mechanic to the Neural Bridge, so the harness in the running game decompiles it into presets.
 *
 * Any observer can use it: a game's official telemetry adapter, a mod, a log or replay reader, or (the last resort) a
 * screen tracker. It sends numbers only, never pixels or assets.
 *
 *   node scripts/observe-mechanic.mjs <observation.json> [--port 8220]
 *   node scripts/observe-mechanic.mjs --demo [--port 8220]   (a synthetic low-gravity run with jumps, as a check)
 *
 * observation.json: { "game": "...", "channel": "telemetry|mod-sdk|mod-loader|game-files|screen",
 *   "trajectory": { "t": [s], "x": [m], "y": [m], "z": [m] }, "shots": { "t": [s], "kick": [m] }, "events": [{ "t": s, "name": "..." }] }
 * Then say "apply the mimic" in the game (the player's word puts it in force; "undo" takes it off).
 */
import fs from 'node:fs';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const port = parseInt(arg('--port') ?? '8220', 10);

/** A run on a body with gravity g and jump impulse v0: walking, then running, jumping every 3 s for 10 s (60 Hz). */
function demo(g = 3.6, v0 = 4.6, walk = 3.2, run = 6.0) {
  const dt = 1 / 60;
  const t = [], x = [], y = [], z = [];
  let h = 0, vy = 0, px = 0;
  for (let f = 0; f < 600; f++) {
    if (h <= 0 && f % 180 === 20) vy = v0;
    vy -= g * dt;
    h = Math.max(0, h + vy * dt);
    if (h === 0) vy = 0;
    px += (f < 300 ? walk : run) * dt;
    t.push(+(f * dt).toFixed(4)); x.push(+px.toFixed(4)); y.push(+h.toFixed(4)); z.push(0);
  }
  return { game: 'Demo (synthetic)', channel: 'synthetic', trajectory: { t, x, y, z } };
}

const file = process.argv.find((a, i) => i >= 2 && !a.startsWith('--') && process.argv[i - 1] !== '--port');
const obs = process.argv.includes('--demo') ? demo() : file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
if (!obs) {
  console.error('usage: node scripts/observe-mechanic.mjs <observation.json> | --demo [--port 8220]');
  process.exit(2);
}
const res = await fetch(`http://127.0.0.1:${port}/observe-mechanic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obs) });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
