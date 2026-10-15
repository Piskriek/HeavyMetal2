/**
 * The debug menu, in the production build (apps/web/dist, NO ?e2e): Esc opens the pause menu, "Debug menu" opens the panel,
 * "Jump to act" reloads from a checkpoint, "Complete this step" moves the chain exactly one step, "Grant" puts 100 ore in the
 * pack and the panel shows the new count, and Esc closes the panel back to the pause menu.
 *
 * Run `npm run build` first (the test serves apps/web/dist). Exit code 1 when any check fails.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/debug-menu');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8096;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
};
const shot = (name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`) }).catch(() => {});

const currentStep = () => page.evaluate(() => window.hmPlay?.chain?.().current?.id ?? null);
const isDebugOpen = () => page.locator('[data-testid="debug-menu"]').isVisible().catch(() => false);
const pressEsc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
const readPack = async () => Number((await page.locator('[data-testid="pack-count"]').textContent()) ?? 'NaN');

const dismissCreator = () => page.evaluate(() => {
  const done = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Done'));
  done?.click();
});

/** Opens the debug menu from the game: Esc (the pause menu), then the Debug menu button. */
async function openDebugFromGame() {
  if (!(await page.locator('[data-testid="debug-open"]').isVisible().catch(() => false))) await pressEsc();
  await page.locator('[data-testid="debug-open"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="debug-open"]').click();
  await page.locator('[data-testid="debug-menu"]').waitFor({ state: 'visible', timeout: 10000 });
}

try {
  // 1. a fresh profile, the production build: the main menu, then Expedition
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  await expBtn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(400);
  check('production build: no e2e switch, the game is ready', (await page.evaluate(() => typeof window.__dev)) === 'undefined');

  // 2. Esc opens the pause menu; it has a Debug menu button; the button opens the panel
  await openDebugFromGame();
  check('Esc, then Debug menu, opens the debug panel', await isDebugOpen());
  await shot('01-panel-lab');
  await pressEsc();
  check('Esc closes the debug panel back to the pause menu', !(await isDebugOpen()) && (await page.locator('.play-pause button', { hasText: 'Resume' }).isVisible()));

  // 3. Jump to act: Act IV (the drill) reloads from its checkpoint and the chain sits at A4-01
  await openDebugFromGame();
  const cpButtons = await page.locator('[data-checkpoint]').count();
  check('Jump to act lists the checkpoints from index.json', cpButtons >= 5, `${cpButtons} buttons`);
  await page.locator('[data-checkpoint="act4-start"]').click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  const cont = page.locator('.sm-menu button', { hasText: 'Continue' });
  if (await cont.count()) await cont.first().click();
  else await page.locator('.sm-menu button', { hasText: 'Expedition' }).first().click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(400);
  const before = await currentStep();
  check('Jump to act: the checkpoint loads and the chain is on A4-01', before === 'A4-01', `step ${before}`);

  // 4. Complete this step: the chain advances exactly one step
  await openDebugFromGame();
  const stepText = await page.locator('[data-testid="dbg-step"]').textContent();
  check('the panel shows the current step id and title', (stepText ?? '').includes('A4-01'), stepText ?? '');
  await page.locator('[data-testid="dbg-complete-step"]').click();
  await page.waitForTimeout(250);
  const after = await currentStep();
  check('Complete this step advances the chain one step (A4-01 to A4-01b)', after === 'A4-01b', `step ${after}`);
  await shot('02-step-completed');

  // 5. Grant 100 ore: the pack count rises by exactly 100
  const packBefore = await readPack();
  await page.locator('[data-testid="dbg-item"]').selectOption('ore');
  await page.locator('[data-testid="dbg-amount"]').fill('100');
  await page.locator('[data-testid="dbg-grant"]').click();
  await page.waitForTimeout(250);
  const packAfter = await readPack();
  check('Grant 100 ore: the pack count shows +100', packAfter === packBefore + 100, `${packBefore} to ${packAfter}`);
  const toast = await page.locator('[data-testid="dbg-toast"]').textContent().catch(() => '');
  check('a grant shows a confirmation in the panel', (toast ?? '').includes('100'), toast ?? '');
  await shot('03-granted-ore');

  // 6. Esc closes the panel
  await pressEsc();
  check('Esc closes the panel', !(await isDebugOpen()));

  check('no console errors or page errors in the run', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the run completes', false, String(err?.message ?? err).split('\n')[0]);
  await shot('99-failure');
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
