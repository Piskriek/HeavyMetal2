#!/usr/bin/env node
/**
 * MP-T14: the simulation may not call engine-dependent transcendentals. Math.sin/cos/tan/atan/atan2/
 * asin/acos/exp/log/pow/hypot/cbrt are only approximately specified, so V8, SpiderMonkey and
 * JavaScriptCore can differ in the last bit and fork a replay. Use src/game/sim/det-math.ts instead.
 * Math.sqrt is allowed (IEEE-754 correctly rounded). Exit 1 on any hit.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/game/sim/', import.meta.url));
const FORBIDDEN = /Math\.(sin|cos|tan|atan2?|asin|acos|exp|expm1|log(?:1p|2|10)?|pow|hypot|cbrt|sinh|cosh|tanh)\(/g;
export function findTranscendentals() {
  const hits = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'det-math.ts')) {
    readFileSync(join(dir, name), 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      for (const m of code.matchAll(FORBIDDEN)) hits.push(`src/game/sim/${name}:${i + 1} ${m[0]}`);
    });
  }
  return hits;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hits = findTranscendentals();
  for (const hit of hits) console.log(hit);
  console.log(`${hits.length} disallowed Math call(s) in the sim`);
  process.exit(hits.length ? 1 : 0);
}
