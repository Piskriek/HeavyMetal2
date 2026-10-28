/**
 * Plan 57 §14: times play's loading steps (each label change) for a fresh start, so a strip can show what it saved.
 *   node scripts/measure-play-load.mjs [query]   (default ?e2e; ?story&e2e for the parked story's start)
 * Boots the built game (run `npm run build` first).
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }
const port = 8239;
const query = process.argv[2] ?? '?e2e';
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
    Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed')); };
  });
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  // poll the loading label and timestamp each change, until play is ready
  await page.evaluate(() => {
    window.__steps = [];
    let last = '';
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector('.play-loading span');
      const l = el ? el.textContent : (window.hmPlay?.ready ? 'READY' : '');
      if (l && l !== last) { window.__steps.push([l, Math.round(performance.now() - t0)]); last = l; }
      if (l !== 'READY') setTimeout(tick, 20);
    };
    tick();
  });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 120000 });
  await page.waitForTimeout(100);
  const steps = await page.evaluate(() => window.__steps);
  const merged = {};
  steps.forEach(([l, t], i) => { merged[l] = (merged[l] ?? 0) + ((steps[i + 1]?.[1] ?? t) - t); });
  for (const [l, ms] of Object.entries(merged).sort((a, b) => b[1] - a[1])) console.log(`${String(ms).padStart(6)} ms  ${l}`);
  console.log(`total ${steps.at(-1)?.[1] ?? 0} ms to ready (${query})`);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
