#!/usr/bin/env node
/**
 * Plan 51 wave 3: one-time setup for a game whose official telemetry needs a file of its own, so "bridge <game>" streams
 * it to the Neural Bridge. Today: Counter-Strike 2's Game State Integration (Valve's own feature: a cfg file in the game's
 * cfg folder names a local URI, and the game POSTs its state there).
 *
 *   node scripts/bridge-setup.mjs cs2 [--port 8220] [--cfg-dir <dir>] [--dry-run]
 *
 * It finds the game through Steam's library list (libraryfolders.vdf), writes gamestate_integration_fidelity.cfg and
 * changes nothing else. Restart the game afterwards. Remove the file to undo.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const game = args[0];
const port = Number(arg('--port') ?? 8220);
const dry = args.includes('--dry-run');

if (game !== 'cs2') {
  console.error('Usage: node scripts/bridge-setup.mjs cs2 [--port 8220] [--cfg-dir <dir>] [--dry-run]');
  process.exit(2);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error(`--port must be 1024..65535, got ${arg('--port')}`);
  process.exit(2);
}

/** Every Steam library on this PC (the default one first), from libraryfolders.vdf. */
function steamLibraries() {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean).map((p) => path.join(p, 'Steam'));
  const libs = new Set();
  for (const root of roots) {
    const vdf = path.join(root, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) continue;
    libs.add(root);
    for (const m of fs.readFileSync(vdf, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, '\\'));
  }
  return [...libs];
}

function cs2CfgDir() {
  const given = arg('--cfg-dir');
  if (given) return path.resolve(given);
  for (const lib of steamLibraries()) {
    const dir = path.join(lib, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg');
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// what the bridge's CS2 preset reads (CS2_TELEMETRY_MAPPING in @hm/gamebridge); buffer and throttle at 0 so each shot
// arrives as its own post (the default 0.1 s would bunch a fast weapon's rounds together)
const cfg = `"FIDELITY Neural Bridge"
{
  "uri" "http://127.0.0.1:${port}/telemetry/cs2"
  "timeout" "1.0"
  "buffer" "0.0"
  "throttle" "0.0"
  "heartbeat" "5.0"
  "data"
  {
    "provider" "1"
    "map" "1"
    "round" "1"
    "player_id" "1"
    "player_state" "1"
    "player_weapons" "1"
    "player_match_stats" "1"
    "player_position" "1"
  }
}
`;

const dir = cs2CfgDir();
if (!dir) {
  console.error('Counter-Strike 2 was not found in any Steam library on this PC. Install it, or pass --cfg-dir <its game/csgo/cfg folder>.');
  process.exit(1);
}
const file = path.join(dir, 'gamestate_integration_fidelity.cfg');
if (dry) {
  console.log(`Would write ${file}:\n${cfg}`);
  process.exit(0);
}
fs.writeFileSync(file, cfg);
console.log(`Wrote ${file}. Restart Counter-Strike 2, start the Neural Bridge (node scripts/companion-bridge.mjs), then tell the drone "bridge counter strike".`);
