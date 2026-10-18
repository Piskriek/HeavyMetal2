// Probe (Opus, reviewing F-23 / TICKET-16 part a): the title screen on a fresh save (menu hero, Dr. Haddy's CRT
// portrait, and no Ending Credits item until the finale), the same screen with endingSeen set, and the play HUD's portrait.
//   npm run build && node scripts/probe-t16a-shots.mjs     shots in shots-run/t16a/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'shots-run/t16a');
fs.mkdirSync(out, { recursive: true });
const port = 8232;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stubbed')); }; });
  const menuLabels = () => page.evaluate(() => [...document.querySelectorAll('.sm-menu button')].map((b) => (b.textContent || '').trim().slice(0, 40)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('hm-store'); });
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const fresh = await menuLabels();
  console.log('fresh save menu:', JSON.stringify(fresh));
  console.log(fresh.some((l) => /Ending Credits/.test(l)) ? 'FAIL: Ending Credits shows on a fresh save' : 'OK  : no Ending Credits on a fresh save');
  await page.screenshot({ path: path.join(out, 'title-fresh.png') });
  await page.goto(`http://127.0.0.1:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => { window.hmPlay?.teleportPlanet?.(); window.hmPlay?.setPaused?.(false); window.hmPlay?.setLocked?.(true); });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, 'play-hud-portrait.png') });
  const overlap = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const portrait = r('[class*="haddy"], [data-testid*="haddy"], [class*="crt-portrait"]');
    const stage = r('[data-testid="stage-panel"], [class*="stage-panel"], .hud-stage');
    if (!portrait || !stage) return { portrait: !!portrait, stage: !!stage };
    const hit = !(portrait.right <= stage.left || stage.right <= portrait.left || portrait.bottom <= stage.top || stage.bottom <= portrait.top);
    return { portrait: true, stage: true, overlap: hit };
  });
  console.log('portrait vs stage panel:', JSON.stringify(overlap));
} finally {
  await browser.close();
  server.kill();
}
console.log(errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 4))}` : 'page errors: 0');
