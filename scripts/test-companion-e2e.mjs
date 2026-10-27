/**
 * Plan 48 In-Game AI Companion E2E Verification Suite.
 * Asserts the companion's presence, the comms HUD toggle, chat interaction,
 * and the companion's 3D entity state.
 *
 * Run:
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

const port = 8225;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1600));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
  } catch {}
});

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

try {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent?.startsWith('Done'))?.click();
  });
  await page.waitForTimeout(1500);

  // 2. Assert Comms Toggle Button is in DOM
  const toggle = page.locator('[data-testid="companion-comms-toggle"]');
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  check('companion comms HUD toggle button is visible', (await toggle.count()) === 1);
  await shot('01-comms-toggle');

  // 3. Open Comms Panel
  await toggle.click();
  const panel = page.locator('[data-testid="companion-comms-panel"]');
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  check('clicking comms toggle opens the companion panel', (await panel.count()) === 1);
  await shot('02-comms-panel-open');

  // 4. Send Message to Companion
  const input = page.locator('.companion-chat-input');
  await input.fill('Follow me');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);

  // 5. Assert Companion Reply
  const reply = page.locator('.chat-bubble.companion').last();
  const replyText = await reply.textContent();
  check('companion responds in comms chat', replyText?.includes('formation') || replyText?.includes('shoulder'), replyText ?? '');
  await shot('03-comms-replied');

  // 6. Assert In-Game 3D Companion Entity
  const compState = await page.evaluate(() => {
    const comp = window.__companion;
    if (!comp) return null;
    return comp.getState();
  });
  check('companion 3D entity is active in the scene', compState !== null, compState ? `state=${compState.state}, x=${compState.x.toFixed(1)}, z=${compState.z.toFixed(1)}` : 'null');
  check('companion speech bubble was triggered', compState?.speech !== undefined);

  // 7. Test Quick Action Chip
  const waveChip = page.locator('.companion-chip:has-text("Wave")');
  await waveChip.click();
  await page.waitForTimeout(900);
  const waveReply = page.locator('.chat-bubble.companion').last();
  const waveText = await waveReply.textContent();
  check('clicking quick action chip sends command and triggers gesture', waveText?.includes('Greetings') || waveText?.includes('telemetry'), waveText ?? '');
  await shot('04-comms-gesture');

  // 8. Assert zero page errors
  check('no page errors during companion session', pageErrors.length === 0, pageErrors.join('; '));

  console.log(`\n======================================================`);
  const passed = results.filter((r) => r.ok).length;
  console.log(`  PLAN 48 COMPANION E2E: ${passed}/${results.length} PASSED`);
  console.log(`======================================================\n`);

  if (passed !== results.length) {
    process.exit(1);
  }
} catch (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
  server.kill('SIGTERM');
}
