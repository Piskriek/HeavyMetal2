/**
 * Plan 48 companion e2e (reworked on the owner's 27 Oct feedback). Verifies in a real browser:
 *  - HOLD T is push-to-talk: the TX pill shows, the comms panel does NOT open; release ends TX.
 *  - Enter is the ONLY key that opens the typed comms panel; Esc closes it.
 *  - "float in front of me" hovers the companion ~2.2 m along the player's facing at eye level.
 *  - "stay here" holds a guard stance; "follow me" resumes formation.
 * Boots the built game (run `npm run build` first); shots to shots-run/companion/.
 *   node scripts/test-companion-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/companion');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(fs.existsSync);
if (!chromePath) {
  console.error('Chrome/Chromium not found; set CHROME_PATH.');
  process.exit(1);
}
const port = 8226;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const panelOpen = () => page.locator('[data-testid="companion-comms-panel"]').count();
const txShown = () => page.locator('[data-testid="companion-tx-indicator"]').count();

/** Sends an order through the typed comms panel and waits for it to land. */
const order = async (text) => {
  if ((await panelOpen()) === 0) {
    await page.keyboard.press('Enter');
    await page.locator('[data-testid="companion-comms-panel"]').waitFor({ state: 'visible', timeout: 5000 });
  }
  await page.locator('.companion-chat-input').fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500); // the companion acknowledges after ~300 ms
};

try {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
  await page.waitForFunction(() => Boolean(window.__companion), { timeout: 30000 });
  check('the companion entity spawns', true);

  // --- 1. HOLD T: push-to-talk with the TX pill only — the panel must NOT open ---
  check('no comms panel at rest', (await panelOpen()) === 0);
  await page.keyboard.down('T');
  await page.waitForTimeout(350);
  check('holding T shows the TX transmission pill', (await txShown()) === 1);
  check('holding T does NOT open the comms panel', (await panelOpen()) === 0);
  await shot('01-ptt-hold');
  await page.keyboard.up('T');
  await page.waitForTimeout(350);
  check('releasing T ends the transmission pill', (await txShown()) === 0);
  check('releasing T still leaves the panel closed', (await panelOpen()) === 0);

  // --- 2. Enter opens the typed panel; Esc closes it ---
  await page.keyboard.press('Enter');
  await page.locator('[data-testid="companion-comms-panel"]').waitFor({ state: 'visible', timeout: 5000 });
  check('Enter opens the typed comms panel', (await panelOpen()) === 1);
  await shot('02-comms-panel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Esc closes the comms panel', (await panelOpen()) === 0);

  // --- 3. "float in front of me": hover to player + fwd * 2.2 at eye level ---
  const pose = await page.evaluate(() => window.hmPlay.pose());
  await order('float in front of me');
  const ack = await page.evaluate(() => window.__companion.getState());
  check('the order is acknowledged with a hover state', ack.hover === true, `state=${ack.state}`);
  // glide time varies with the panel-focused frame rate: wait for the settle state, not a clock
  await page.waitForFunction(() => window.__companion.getState().state === 'hover', { timeout: 9000 }).catch(() => {});
  const after = await page.evaluate(() => window.__companion.getState());
  const expX = pose.x + -Math.sin(pose.yaw) * 2.2;
  const expZ = pose.z + -Math.cos(pose.yaw) * 2.2;
  const planarErr = Math.hypot(after.x - expX, after.z - expZ);
  check('the companion floats to ~2.2 m along the player facing', planarErr < 0.6, `err=${planarErr.toFixed(2)} m`);
  check('the companion holds eye-level altitude', after.y > 1.0 && after.y < 1.9, `y=${after.y.toFixed(2)}`);
  check('arrival settles into the hover stance', after.state === 'hover', after.state);
  await shot('03-hover-front');

  // --- 4. "stay here" guards; "follow me" resumes formation ---
  await order('stay here');
  const guard = await page.evaluate(() => window.__companion.getState());
  check('"stay here" enters the guard stance on the ground', guard.state === 'guard' && guard.hover === false, guard.state);
  await order('follow me');
  const follow = await page.evaluate(() => window.__companion.getState());
  check('"follow me" resumes formation follow', follow.state === 'follow', follow.state);
  await page.keyboard.press('Escape');
  await shot('04-follow');

  check('no page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, e.message);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} companion checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
