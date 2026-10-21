/**
 * Plan 41's perf gate: what the layered material costs a frame, on this laptop (the min spec: GTX 950M), on Medium, at
 * 1080p. TASK-24's method (scripts/measure-fps-gpu.mjs): headed Chrome on the real GPU (ANGLE D3D11, high performance,
 * no vsync), the production single file, requestAnimationFrame deltas after a settle.
 *   1. the lab on Medium, standing about 2 m in front of the capacitor bank so it fills most of the view: 6 s of frames;
 *   2. every part of the bank (its cans excepted) dressed in a six-layer material (rust bucket with moss on top),
 *      compiled, settled: 6 s of frames again.
 * The gate: the median frame grows by at most 1 ms, and the draw calls stay at the lab's budget or under.
 *   npm run build && node scripts/perf-layered-material.mjs
 * Writes shots-run/perf/layered-material.json and the two views' shots. Exits 1 when the gate fails.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/perf');
fs.mkdirSync(outDir, { recursive: true });
const port = 8207;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu', '--disable-gpu-vsync'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('perf-booted')) {
      localStorage.clear();
      sessionStorage.setItem('perf-booted', '1');
    }
  } catch {}
});

const boot = async () => {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.sm-menu button', { timeout: 60000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 120000 });
  await page.evaluate(() => [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click());
  await page.waitForFunction(() => window.__dev.kitPlaced('capacitor-bank').length > 0, { timeout: 60000 });
};

/** Frame deltas for `ms`, from requestAnimationFrame. */
const frames = (ms) => page.evaluate((ms) => new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  const tick = (t) => {
    deltas.push(t - last);
    last = t;
    if (t - t0 < ms) requestAnimationFrame(tick);
    else resolve(deltas);
  };
  requestAnimationFrame(tick);
}), ms);
const summary = (d) => {
  const s = [...d].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: d.length, median: Math.round(q(0.5) * 100) / 100, p95: Math.round(q(0.95) * 100) / 100 };
};

/** Stands about 2 m in front of the capacitor bank, looking at it. */
const faceBank = () => page.evaluate(async () => {
  let mesh = null;
  window.__playScene.room.group.traverse((o) => { if (o.isMesh && /^kit:/.test(o.name)) mesh = mesh ?? o; });
  const bank = mesh.parent;
  bank.updateMatrixWorld(true);
  const e = bank.matrixWorld.elements;
  const nx = -e[8], nz = -e[10], l = Math.hypot(nx, nz);
  const sx = e[12] + (nx / l) * 2.1, sz = e[14] + (nz / l) * 2.1;
  window.__playScene.debug.teleport('lab', sx, sz, Math.atan2(-(e[12] - sx), -(e[14] - sz)), -0.32);
});

let failed = false;
try {
  // the tier lives in the profile's device settings: Medium, then a fresh start so the game builds at that tier
  await boot();
  await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('hm.profile.v2') ?? '{}');
    localStorage.setItem('hm.profile.v2', JSON.stringify({ ...cur, quality: 'medium' }));
  });
  await boot();
  await page.evaluate(() => window.__dev.powerGate());
  const renderer = await page.evaluate(() => {
    const g = document.createElement('canvas').getContext('webgl2');
    const x = g?.getExtension('WEBGL_debug_renderer_info');
    return g && x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  await faceBank();
  await page.waitForTimeout(3000);
  const before = summary(await frames(6000));
  const callsBefore = await page.evaluate(() => window.__playScene.debug.stats().calls);
  await page.screenshot({ path: path.join(outDir, 'bank-plain.png') });

  const dressed = await page.evaluate(() => window.__dev.dressKit('capacitor-bank', 'mat:rust-bucket', ['moss']));
  await page.waitForTimeout(4000);
  await faceBank();
  await page.waitForTimeout(2000);
  const after = summary(await frames(6000));
  const callsAfter = await page.evaluate(() => window.__playScene.debug.stats().calls);
  await page.screenshot({ path: path.join(outDir, 'bank-layered.png') });

  const growth = Math.round((after.median - before.median) * 100) / 100;
  const ok = growth <= 1 && callsAfter <= 190;
  failed = !ok;
  const row = { renderer, tier: 'medium', viewport: '1920x1080', dressedParts: dressed.parts, before, after, growthMs: growth, callsBefore, callsAfter, gate: ok ? 'pass' : 'fail' };
  fs.writeFileSync(path.join(outDir, 'layered-material.json'), JSON.stringify(row, null, 2));
  console.log(`renderer: ${renderer}`);
  console.log(`plain:   median ${before.median} ms, p95 ${before.p95} ms (${before.frames} frames), ${callsBefore} draw calls`);
  console.log(`layered: median ${after.median} ms, p95 ${after.p95} ms (${after.frames} frames), ${callsAfter} draw calls; ${dressed.parts} parts in six layers`);
  console.log(`the median grew ${growth} ms: gate ${ok ? 'PASS' : 'FAIL'} (at most 1 ms, at most 190 draw calls)`);
} catch (err) {
  failed = true;
  console.log('the measurement did not finish:', String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
