#!/usr/bin/env node
/**
 * Summarises a Plasma world or device save read by read-odin-save.mjs (read-only; for the mimic work): its devices, each device's
 * behaviours (agents) by type with their properties and ports, its parts with their physics, joints, and every Sketch graph's
 * nodes and connections.
 *
 *   node scripts/plasma-save-summary.mjs <save.world|.device> [--json <out.json>] [--dump-device <n>]
 */
import fs from 'node:fs';
import { readOdin } from './read-odin-save.mjs';

/** An Odin array: a typed reference node wrapping the array (in $items), or the array itself. */
export const arr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.$items?.[0]) ? v.$items[0] : Array.isArray(v?.$items) ? v.$items : []);
const short = (t) => String(t ?? '').split(',')[0];
const prune = (v, d = 0) => {
  if (d > 7) return '…';
  if (Array.isArray(v)) return v.slice(0, 3).map((x) => prune(x, d + 1)).concat(v.length > 3 ? [`…+${v.length - 3}`] : []);
  if (v && typeof v === 'object') {
    if (v.$prim) return `[prim ${v.length}x${v.elementSize}${v.values ? `: ${v.values.slice(0, 6).map((x) => +x.toFixed?.(3) || x).join(',')}` : ''}]`;
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === '$type' ? short(x) : prune(x, d + 1);
    return o;
  }
  return v;
};

const file = process.argv[2];
const res = readOdin(fs.readFileSync(file));
const root = res.root;
const devices = arr(root.devices);
const dumpAt = process.argv.indexOf('--dump-device');
if (dumpAt > 0) {
  console.log(JSON.stringify(prune(devices[Number(process.argv[dumpAt + 1])]), null, 1));
  process.exit(0);
}
console.log(`${short(root.$type)}: ${devices.length} devices`);
console.log('device fields:', Object.keys(devices[0] ?? {}).join(', '));
