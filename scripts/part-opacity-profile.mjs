#!/usr/bin/env node
// Row-by-row opacity profile for a keyed part PNG: prints trimmed box and per-row
// opaque span/width/centre (downsampled) — for measuring registration pivots.
// Usage: node scripts/part-opacity-profile.mjs public/avatar-parts/keyed/<part>.png
import { decodePng } from './edge-magenta-lib.mjs';
const png = decodePng(process.argv[2]);
const { w: W, h: H, data } = png;
const rows = [];
for (let y = 0; y < H; y++) {
  let l = -1, r = -1, n = 0;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; n++; }
  }
  rows.push({ l, r, n });
}
const top = rows.findIndex((r) => r.n > 0);
const bot = H - 1 - [...rows].reverse().findIndex((r) => r.n > 0);
let left = W, right = 0;
for (const r of rows) if (r.n > 0) { left = Math.min(left, r.l); right = Math.max(right, r.r); }
console.log(`trim box: [${left},${top}] ${right - left + 1}x${bot - top + 1} of ${W}x${H}`);
const step = Math.max(1, Math.floor((bot - top) / 24));
let best = { n: 0 };
for (let y = top; y <= bot; y += step) {
  const r = rows[y];
  if (r.n > best.n) best = { ...r, y };
  const fr = ((y - top) / (bot - top || 1)).toFixed(2);
  const cx = r.n > 0 ? (((r.l + r.r) / 2 - left) / (right - left || 1)).toFixed(2) : ' - ';
  console.log(`y=${fr}  w=${r.n > 0 ? r.r - r.l + 1 : 0}  cx=${cx}  n=${r.n}`);
}
console.log(`widest row: y=${((best.y - top) / (bot - top || 1)).toFixed(3)} w=${best.r - best.l + 1} cx=${(((best.l + best.r) / 2 - left) / (right - left || 1)).toFixed(3)}`);
