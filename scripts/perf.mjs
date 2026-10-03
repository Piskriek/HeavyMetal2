/**
 * Frame-rate check of the PRODUCTION build on this PC's graphics card, for the owner's minimum spec (2026-10-03: "if it can run smooth on low settings we will be happy").
 *   npm run build && node scripts/perf.mjs [tiers] [seconds]      e.g. node scripts/perf.mjs low,medium,high 6
 * Holds each screen still for a few seconds per quality tier and prints frames per second (average and the slowest 5% of frames) and the
 * real cost of a frame in ms (under 16.7 ms = a steady 60 fps is possible).
 * Runs headless at 1920x1080; Chrome picks the graphics card it would pick for a page (on Optimus laptops that is the integrated one). */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const tiers = (process.argv[2] ?? 'low,medium,high').split(',');
const seconds = Number(process.argv[3] ?? 6);
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8198;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const rows = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(120000);
  // never hold the owner's real mouse (see e2e-smoke)
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock is stubbed in tests')); }; });
  await page.goto(`http://127.0.0.1:${port}/`);
  const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const x = g?.getExtension('WEBGL_debug_renderer_info'); return g && x ? String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)) : 'unknown'; });
  // a returning player: tour done, quality fixed by hand (so auto does not change it under the measurement)
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('hm.profile.v2', JSON.stringify({ name: 'Perf', tutorialDone: true, quality: 'low' })); });
  await page.reload();
  await page.waitForSelector('.shell-menu');

  const measure = async (screen, tier) => {
    await page.evaluate((q) => { (window).hmRenderer?.setQuality(q); }, tier);
    await page.waitForTimeout(2000); // settle: shader compiles, shadow maps, post chain rebuild
    const dts = await page.evaluate((ms) => new Promise((done) => {
      const r = (window).hmRenderer;
      if (!r) { done([]); return; }
      const out = [];
      const off = r.onFrame((dt) => out.push(dt));
      setTimeout(() => { off(); done(out); }, ms);
    }), seconds * 1000);
    if (!dts.length) { rows.push({ screen, tier, fps: 'no frames', p95: '' }); return; }
    // what a frame really costs: render, then read one pixel back, which waits for the graphics chip to finish (frames above snap to 16.7 / 33.3 ms)
    const work = await page.evaluate((ms) => new Promise((done) => {
      const r = (window).hmRenderer, gl = r.debug?.webgl.getContext(), px = new Uint8Array(4), out = [];
      if (!gl) { done(0); return; }
      const orig = r.render;
      r.render = (a) => { const s = performance.now(); orig.call(r, a); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(performance.now() - s); };
      setTimeout(() => { r.render = orig; out.sort((a, b) => a - b); done(out[Math.floor(out.length / 2)] ?? 0); }, ms);
    }), 2500);
    const sorted = [...dts].sort((a, b) => a - b);
    const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? avg;
    rows.push({ screen, tier, fps: (1000 / avg).toFixed(1), slowest5: (1000 / p95).toFixed(1), frames: dts.length, workMs: work.toFixed(1) });
    console.log(`${screen.padEnd(22)} ${tier.padEnd(7)} ${(1000 / avg).toFixed(1).padStart(6)} fps   slowest 5%: ${(1000 / p95).toFixed(1).padStart(6)} fps   frame cost ${work.toFixed(1).padStart(5)} ms`);
  };
  const skin = async (name) => { await page.evaluate((n) => { [...document.querySelectorAll('.mode-bar button')].find((b) => b.textContent === n)?.click(); }, name); await page.waitForTimeout(1500); };

  console.log(`renderer: ${gpu}\n`);
  await page.waitForTimeout(4000);
  for (const t of tiers) await measure('main menu', t);

  await page.evaluate(() => { [...document.querySelectorAll('.shell-menu button')].find((b) => b.textContent === 'My Island')?.click(); });
  await page.waitForSelector('.hotbar');
  await page.waitForTimeout(6000); // the arrival flight
  await skin('Flat');
  for (const t of tiers) await measure('island, flat ground', t);
  await skin('PBR');
  for (const t of tiers) await measure('island, PBR ground', t);
} finally {
  await browser.close();
  server.kill();
  if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class U { [DllImport(\"user32.dll\")] public static extern bool ClipCursor(IntPtr r); }'; [U]::ClipCursor([IntPtr]::Zero) | Out-Null"], { stdio: 'ignore' });
}
