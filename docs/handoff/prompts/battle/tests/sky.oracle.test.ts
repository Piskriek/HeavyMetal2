// Hidden oracle for the sky battle (TICKET-02 item D). Not shown to the models. Run against one answer:
//   SKY_MODULE=arena-out/sky/A/src/sky.ts node --import tsx --test docs/handoff/prompts/battle/tests/sky.oracle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const path = resolve(process.env.SKY_MODULE ?? '');
const m: any = await import(pathToFileURL(path).href);

const D = Math.PI / 180;
/** Direction at elevation el and azimuth az (degrees); azimuth 0 points along +x. */
const dirAt = (elDeg: number, azDeg = 0): [number, number, number] => [Math.cos(elDeg * D) * Math.cos(azDeg * D), Math.sin(elDeg * D), Math.cos(elDeg * D) * Math.sin(azDeg * D)];
const lum = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
const grad = (sun: number[], stage: number) => { const out = new Float32Array(m.SKY_ROWS * 3); m.skyGradient(sun, stage, out); return out; };
const row = (g: Float32Array, r: number) => [g[r * 3]!, g[r * 3 + 1]!, g[r * 3 + 2]!];
const finiteIn = (v: number) => Number.isFinite(v) && v >= 0 && v <= 10;

test('exports and density = smoothstep(2, 4.5, stage)', () => {
  for (const k of ['density', 'skyAt', 'skyGradient', 'sunColour', 'bakeSkyLut']) assert.equal(typeof m[k], 'function', k);
  assert.equal(m.SKY_ROWS, 64);
  const ss = (s: number) => { const t = Math.min(1, Math.max(0, (s - 2) / 2.5)); return t * t * (3 - 2 * t); };
  for (const s of [0, 1, 2, 2.5, 3, 3.25, 4, 4.5, 5, 6]) assert.ok(Math.abs(m.density(s) - ss(s)) < 1e-9, `stage ${s}`);
});

test('1. no air: black sky', () => {
  for (const st of [0, 1, 2]) {
    for (const [el, az] of [[90, 0], [30, 40], [2, 180], [0.5, 270]]) for (const c of m.skyAt(dirAt(el!, az), dirAt(40, 10), st)) assert.ok(Math.abs(c) < 1e-6);
    for (const v of grad(dirAt(40), st)) assert.ok(Math.abs(v) < 1e-6);
  }
  assert.deepEqual([...m.sunColour(dirAt(30), 1)], [1, 1, 1]);
});

test('2. noon at stage 6: blue zenith, paler horizon', () => {
  const g = grad(dirAt(60), 6), zen = row(g, 0), hor = row(g, 60);
  assert.ok(zen[2]! > zen[1]! && zen[1]! > zen[0]!, `zenith ${zen}`);
  assert.ok(hor[2]! / hor[0]! < zen[2]! / zen[0]!, `horizon B/R ${hor[2]! / hor[0]!} vs zenith ${zen[2]! / zen[0]!}`);
});

test('3. low sun: warm horizon toward the sun, red sun disc', () => {
  const c = m.skyAt(dirAt(2, 0), dirAt(3, 0), 6);
  assert.ok(c[0] > c[2], `toward sun ${c}`);
  const s = m.sunColour(dirAt(3), 6);
  assert.ok(s[0] >= s[1] && s[1] >= s[2] && s[2] < 0.6, `sun ${s}`);
  assert.ok(Math.abs(Math.max(...s) - 1) < 1e-6, 'normalised to max 1');
});

test('4. high sun: near-white sun disc', () => {
  const s = m.sunColour(dirAt(60), 6);
  assert.ok(s[2] > 0.8, `sun ${s}`);
});

test('5. zenith luminance never drops from stage 2 to 4.5', () => {
  let prev = -1;
  for (let st = 2; st <= 4.5001; st += 0.1) { const l = lum(m.skyAt([0, 1, 0], dirAt(45, 30), st)); assert.ok(l >= prev - 1e-9, `stage ${st.toFixed(1)}`); prev = l; }
  assert.ok(prev > 0.01, 'a visible sky at 4.5');
});

test('6. brighter toward the sun', () => {
  const sun = dirAt(30, 0);
  assert.ok(lum(m.skyAt(dirAt(20, 0), sun, 6)) > lum(m.skyAt(dirAt(20, 180), sun, 6)));
});

test('7. sun below the horizon: dim, finite', () => {
  const g = grad(dirAt(-10), 6);
  for (let r = 0; r < 64; r++) { const c = row(g, r); assert.ok(c.every(finiteIn)); assert.ok(lum(c) < 0.05, `row ${r} ${lum(c)}`); }
});

test('8. never NaN or Infinity, values in [0, 10]', () => {
  const dirs: number[][] = [[0, 0, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [1e-12, 1e-12, 0], [3, 4, 5]];
  for (let k = 0; k < 300; k++) dirs.push([Math.sin(k * 1.7), Math.sin(k * 2.3) * 1.2, Math.cos(k * 0.9)]);
  const suns = [[0, 0, 0], [0, 1, 0], [0, -1, 0], dirAt(0.01), dirAt(-89)];
  for (const sun of suns) for (const st of [0, 3, 4.5, 6, 7, -1]) {
    for (const d of dirs) for (const c of m.skyAt(d, sun, st)) assert.ok(finiteIn(c), `skyAt ${d} sun ${sun} st ${st}: ${c}`);
    for (const v of grad(sun, st)) assert.ok(finiteIn(v));
    for (const c of m.sunColour(sun, st)) assert.ok(finiteIn(c));
  }
  for (const c of m.skyAt(dirAt(-5), dirAt(40), 6)) assert.equal(c, 0, 'below the horizon is 0');
});

test('9. deterministic', () => {
  const a = grad(dirAt(25, 70), 5.3), b = grad(dirAt(25, 70), 5.3);
  assert.deepEqual(a, b);
  assert.deepEqual(m.skyAt(dirAt(10, 3), dirAt(25, 70), 5.3), m.skyAt(dirAt(10, 3), dirAt(25, 70), 5.3));
});

test('gradient rows are the azimuth average of skyAt', () => {
  const sun = dirAt(35, 20), g = grad(sun, 6);
  for (const r of [0, 16, 32, 48, 62]) {
    const el = 90 - (r * 90) / 63;
    const avg = [0, 0, 0];
    for (let k = 0; k < 128; k++) { const c = m.skyAt(dirAt(el, (k * 360) / 128), sun, 6); for (let ch = 0; ch < 3; ch++) avg[ch]! += c[ch] / 128; }
    const got = row(g, r);
    for (let ch = 0; ch < 3; ch++) assert.ok(Math.abs(got[ch]! - avg[ch]!) <= 0.05 * avg[ch]! + 1e-5, `row ${r} ch ${ch}: ${got[ch]} vs ${avg[ch]}`);
  }
});

test('LUT layout: zenith row uniform, sun side brighter', () => {
  const w = 32, h = 16, out = new Float32Array(w * h * 3);
  m.bakeSkyLut(dirAt(20, 0), 6, w, h, out);
  for (const v of out) assert.ok(finiteIn(v));
  const at = (c: number, r: number) => [out[(r * w + c) * 3]!, out[(r * w + c) * 3 + 1]!, out[(r * w + c) * 3 + 2]!];
  const z0 = lum(at(0, 0));
  for (let c = 0; c < w; c++) assert.ok(Math.abs(lum(at(c, 0)) - z0) <= 0.02 * z0 + 1e-6, 'zenith row is azimuth-independent');
  assert.ok(lum(at(0, h - 3)) > lum(at(w / 2, h - 3)), 'column 0 faces the sun');
});

test('10. speed (spec 3 ms and 15 ms; oracle allows double)', () => {
  const med = (f: () => void) => { const t: number[] = []; for (let k = 0; k < 7; k++) { const t0 = performance.now(); f(); t.push(performance.now() - t0); } t.sort((p, q) => p - q); return t[3]!; };
  const out = new Float32Array(64 * 3), lut = new Float32Array(32 * 16 * 3);
  const g = med(() => m.skyGradient(dirAt(30, 10), 6, out)), l = med(() => m.bakeSkyLut(dirAt(30, 10), 6, 32, 16, lut));
  console.log(`sky gradient ${g.toFixed(2)} ms, lut ${l.toFixed(2)} ms`);
  assert.ok(g < 6 && l < 30);
});

test('purity: no imports, randomness, clocks or DOM', () => {
  const src = readFileSync(path, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of [/\bimport\s/, /\brequire\(/, /Math\.random/, /\bDate\b/, /\bdocument\b/, /\bwindow\b/, /performance\.now/]) assert.ok(!bad.test(src), String(bad));
});
