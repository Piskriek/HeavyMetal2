/**
 * Browser smoke test of the PRODUCTION build with the installed Chrome (no download): it must boot with no page error, and no screen may be a trap.
 *   node scripts/e2e-smoke.mjs          (serves apps/web/dist itself on a free port; run `npm run build` first)
 * Skipped with a note when Chrome is not installed. Software rendering is slow, so the timeouts are generous.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chromePaths.some(existsSync)) { console.log('e2e-smoke: Chrome not found, skipped'); process.exit(0); }
const { chromium } = await import('playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8197;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const failures = [];
const check = (name, ok, extra = '') => { if (!ok) failures.push(`${name}${extra ? ` (${extra})` : ''}`); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // NEVER let a test hold the real pointer lock: on Windows a locked headless Chrome clips the user's real mouse cursor to its window
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock is stubbed in tests')); }; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.shell-menu', { timeout: 30000 });
  check('boots to the main menu with no page error', errors.length === 0, errors.join(' | '));
  check('main menu order', JSON.stringify(await page.$$eval('.shell-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Multiplayer', 'My Island', 'Settings']));

  const text = (sel, t) => page.locator(sel, { hasText: t }).first();
  await text('.shell-menu button', 'Settings').click();
  check('settings opens', await page.locator('[aria-label="Settings"]').count() === 1);
  await text('[aria-label="Settings"] button', 'Close').click();
  check('settings closes back to the menu', await page.locator('.shell-menu').count() === 1);

  await text('.shell-menu button', 'Play').click();
  check('Play shows the activities window', await page.locator('[aria-label="Activities"]').count() === 1);
  await text('.shell-activity button', 'Play').click();
  await page.waitForSelector('.shell-racing');
  for (const s of ['Tournaments', 'Spectate', 'Rankings', 'Settings', 'My Goblin', 'The Bookie', 'Quick Race']) await text('.shell-racing-nav button', s).click();
  check('every Goblin Racing section opens', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Esc leaves the activity menu', await page.locator('.shell-racing').count() === 0);
  if (await page.locator('.shell-menu').count() === 0) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  check('and ends on the main menu', await page.locator('.shell-menu').count() === 1);

  await text('.shell-menu button', 'Multiplayer').click();
  await page.waitForSelector('.shell-top');
  await text('.shell-top .tabs button', 'Community').click();
  check('community tab lists presets', await page.locator('.shell-window.wide .shell-activity').count() > 0);
  await text('.shell-top button', 'Main menu').click();
  check('hub returns to the main menu', await page.locator('.shell-menu').count() === 1);

  await text('.shell-menu button', 'My Island').click();
  await page.waitForSelector('.hotbar', { timeout: 60000 });
  check('My Island reaches the island with the hotbar', true);
  // the first Esc skips the arrival cinematic (slow under software rendering); keep pressing until the menu shows
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(700); }
  check('Esc opens the jump menu on the island', await page.locator('.island-menu').count() === 1);
  check('and the galaxy bar comes down', await page.locator('.galaxy-bar.open').count() === 1);
  const dom = (fn) => page.evaluate(fn); // software rendering starves the page: click through the DOM instead of waiting for Playwright stability checks
  await dom(() => { [...document.querySelectorAll('.galaxy-bar button')].find((b) => b.getAttribute('aria-label') === 'Up one level')?.click(); });
  await page.waitForTimeout(400);
  check('up one level shows the island overview', await page.locator('.galaxy-bar.open').count() === 1);
  await dom(() => { [...document.querySelectorAll('.galaxy-bar button')].find((b) => b.getAttribute('aria-label') === 'Into the selected')?.click(); });
  await page.waitForTimeout(300);
  for (let i = 0; i < 6 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Build mode')?.click(); });
  await page.waitForSelector('.maker', { timeout: 30000 });
  check('Build mode opens inside the shell', true);
  for (let i = 0; i < 3 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  check('Esc opens the menu in build mode', await page.locator('.maker .island-menu').count() === 1);
  await dom(() => { [...document.querySelectorAll('.maker .island-menu button')].find((b) => b.textContent === 'Back to Island')?.click(); });
  await page.waitForSelector('.hotbar', { timeout: 30000 });
  check('Back to Island returns from build mode', true);
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Main menu')?.click(); });
  await page.waitForTimeout(600);
  check('jump menu returns to the main menu', await page.locator('.shell-menu').count() === 1);
  check('no page errors during the whole tour', errors.length === 0, errors.join(' | '));
} catch (e) {
  failures.push(`exception: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
} finally {
  await browser.close();
  server.kill();
  if (process.platform === 'win32') {
    // belt and braces: release any cursor clip a crashed browser might have left behind
    const { spawnSync } = await import('node:child_process');
    spawnSync('powershell', ['-NoProfile', '-Command', "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class U { [DllImport(\"user32.dll\")] public static extern bool ClipCursor(IntPtr r); }'; [U]::ClipCursor([IntPtr]::Zero) | Out-Null"], { stdio: 'ignore' });
  }
}
if (failures.length) { console.error(`\ne2e-smoke FAILED:\n - ${failures.join('\n - ')}`); process.exit(1); }
console.log('\ne2e-smoke passed');
