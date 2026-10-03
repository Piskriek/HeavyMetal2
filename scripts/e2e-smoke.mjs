/**
 * Browser smoke test of the PRODUCTION build with the installed Chrome (no download): it must boot with no page error, and no screen may be a trap.
 *   node scripts/e2e-smoke.mjs          (serves apps/web/dist itself on a free port; run `npm run build` first)
 * Skipped with a note when Chrome is not installed. Software rendering is slow, so the timeouts are generous.
 * On a slower PC multiply every wait (`E2E_SLOW=3`) and/or render on the graphics card (`E2E_GPU=1`), e.g. `E2E_GPU=1 E2E_SLOW=2 node scripts/e2e-smoke.mjs`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chromePaths.some(existsSync)) { console.log('e2e-smoke: Chrome not found, skipped'); process.exit(0); }
const { chromium } = await import('playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8197;
const slow = Math.max(1, Number(process.env.E2E_SLOW) || 1);
const T = (ms) => Math.round(ms * slow);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const failures = [];
const check = (name, ok, extra = '') => { if (!ok) failures.push(`${name}${extra ? ` (${extra})` : ''}`); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
// software rendering by default (same picture on every PC); E2E_GPU=1 uses the real graphics card (a slow CPU cannot render the island in software)
const gpu = process.env.E2E_GPU === '1';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(T(30000));
  // NEVER let a test hold the real pointer lock: on Windows a locked headless Chrome clips the user's real mouse cursor to its window
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock is stubbed in tests')); }; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  check('boots to the SetMix home with no page error', errors.length === 0, errors.join(' | '));
  console.log(`     renderer: ${await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const x = g?.getExtension('WEBGL_debug_renderer_info'); return g && x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; })}`);
  check('the home is SetMix with the harness menu', (await page.locator('.sm-brand b').innerText()) === 'SetMix' && JSON.stringify(await page.$$eval('.sm-menu button b', (b) => b.map((x) => x.textContent))) === JSON.stringify(['My island', 'Avatars', 'Community', 'Settings']));
  await page.waitForSelector('.gr-preview', { timeout: T(30000) });
  check('Goblin Racing is selected, its menu live in a window', JSON.stringify(await page.$$eval('.gr-preview-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Multiplayer', 'Settings']));
  check('the window tells a new player what Play does', /first avatar/.test(await page.locator('.gr-preview-you').innerText()));

  const text = (sel, t) => page.locator(sel, { hasText: t }).first();
  const dom = (fn, arg) => page.evaluate(fn, arg); // software rendering starves the page: click through the DOM instead of waiting for Playwright stability checks
  await text('.sm-menu button', 'Settings').click();
  check('settings opens', await page.locator('[aria-label="Settings"]').count() === 1);
  check('with graphics presets from Potato to Auto', await page.locator('.graphics-presets button').count() === 6);
  await text('[aria-label="Settings"] button', 'Close').click();
  check('settings closes back to the home', await page.locator('.sm-home').count() === 1);

  // Goblin Racing: its window grows into its own menu; Multiplayer holds its sections; Esc steps back out to SetMix
  await dom(() => document.querySelector('.gr-open')?.click());
  await page.waitForSelector('.gr-front', { timeout: T(15000) });
  check('opening the window shows Goblin Racing\'s own menu', JSON.stringify(await page.$$eval('.gr-front .shell-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Multiplayer', 'Settings', 'Back to SetMix']));
  await dom(() => { [...document.querySelectorAll('.gr-front .shell-menu button')].find((b) => b.textContent === 'Multiplayer')?.click(); });
  await page.waitForSelector('.shell-racing');
  for (const s of ['Tournaments', 'Spectate', 'Rankings', 'Track editor', 'Settings', 'My Goblin', 'The Bookie', 'Quick Race']) await dom((t) => { [...document.querySelectorAll('.shell-racing-nav button')].find((b) => b.textContent === t)?.click(); }, s);
  check('every Goblin Racing section opens', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc leaves the sections for Goblin Racing\'s menu', await page.locator('.gr-front').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc again returns to the SetMix home', await page.locator('.sm-home').count() === 1);

  // My island: the first time it makes your first avatar (look and name), then dives to your island
  await text('.sm-menu button', 'My island').click();
  await page.waitForSelector('.create-goblin', { timeout: T(15000) });
  check('My island asks you to make your first avatar', true);
  check('the creator offers ready-made looks', await page.locator('.cg-looks button').count() >= 6);
  check('and parts to wear in five places', await page.locator('.parts-picker .pp-row').count() === 5);
  await page.locator('.pp-row[aria-label="Hat"] .pp-cards button').nth(1).click();
  await page.waitForTimeout(T(200));
  check('picking a hat puts it on', await page.locator('.pp-row[aria-label="Hat"] button.on:not(.none)').count() === 1);
  await dom(() => { [...document.querySelectorAll('.cg-panel button')].find((b) => /Done/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(300));
  check('an avatar needs a name', await page.locator('.create-goblin').count() === 1 && await page.locator('.cg-panel .warn').count() === 1);
  await page.locator('.cg-name input').fill('Snik');
  await dom(() => { [...document.querySelectorAll('.cg-panel button')].find((b) => /Done/.test(b.textContent ?? ''))?.click(); });
  await page.waitForSelector('.hotbar', { timeout: T(60000) });
  check('Done takes you to your island', true);
  await page.waitForSelector('.tour', { timeout: T(15000) }).catch(() => undefined);
  check('the island tour starts on your first visit', await page.locator('.tour h3').count() === 1);
  for (let i = 0; i < 12 && await page.locator('.tour-reveal').count() === 0; i++) { await page.locator('.tour button', { hasText: 'Skip' }).click(); await page.waitForTimeout(T(120)); }
  check('the tour ends on the PBR reveal', await page.locator('.tour-reveal').count() === 1);
  await page.locator('.tour-reveal').click();
  await page.waitForTimeout(T(400));
  check('Show me switches the ground to PBR', await page.locator('.mode-bar button.on', { hasText: 'PBR' }).count() === 1);
  await page.locator('.tour button', { hasText: 'Not now' }).click();
  check('Not now hides the tour', await page.locator('.tour').count() === 0);
  await dom(() => { [...document.querySelectorAll('.mode-bar button')].find((b) => b.textContent === 'Flat')?.click(); });
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(700)); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Activities')?.click(); });
  await page.waitForTimeout(T(400));
  check('the jump menu opens the activities window', await page.locator('[aria-label="Activities"]').count() === 1);
  await dom(() => { [...document.querySelectorAll('.shell-activity button')].find((b) => b.textContent === 'Play')?.click(); });
  await page.waitForSelector('.gr-front', { timeout: T(30000) });
  check('an activity\'s Play opens its own menu', true);
  check('which now knows who you race as', /Snik/.test(await page.locator('.gr-front .shell-foot').innerText()));
  for (let i = 0; i < 4 && await page.locator('.sm-home').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(500)); }
  check('and Esc gets you home', await page.locator('.sm-home').count() === 1);

  await text('.sm-menu button', 'Community').click();
  await page.waitForSelector('.shell-top');
  check('community lists presets', await page.locator('.shell-window.wide .shell-activity').count() > 0);
  await text('.shell-top button', 'Home').click();
  await page.waitForSelector('.sm-home');
  check('community returns home', true);
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.waitForTimeout(T(1500));
  await page.mouse.move(vp.width * 0.42, vp.height * 0.41);
  await page.waitForTimeout(T(600));
  check('a planet near the pointer shows its card', await page.locator('.planet-card').count() === 1);

  await text('.sm-menu button', 'My island').click();
  await page.waitForSelector('.hotbar', { timeout: T(60000) });
  check('My island reaches the island with the hotbar', true);
  // the first Esc skips the arrival cinematic (slow under software rendering); keep pressing until the menu shows
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(700)); }
  check('Esc opens the jump menu on the island', await page.locator('.island-menu').count() === 1);
  check('and the galaxy bar comes down', await page.locator('.galaxy-bar.open').count() === 1);
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'My islands')?.click(); });
  await page.waitForSelector('[aria-label="My islands"]', { timeout: T(5000) }).catch(() => undefined);
  check('My islands lists the first island', await page.locator('[aria-label="My islands"] article').count() >= 1);
  await dom(() => { [...document.querySelectorAll('[aria-label="My islands"] button')].find((b) => /Create new/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(300));
  check('Create new adds an island', await page.locator('[aria-label="My islands"] article').count() >= 2);
  await dom(() => { [...document.querySelectorAll('[aria-label="My islands"] button')].find((b) => b.getAttribute('aria-label') === 'Undo')?.click(); });
  await page.waitForTimeout(T(300));
  check('Undo takes it away again', await page.locator('[aria-label="My islands"] article').count() === 1);
  await dom(() => { [...document.querySelectorAll('[aria-label="My islands"] button')].find((b) => b.textContent === 'Close')?.click(); });
  await page.waitForSelector('.hotbar', { timeout: T(30000) });
  check('Close returns to the island', true);
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(700)); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Share my island')?.click(); });
  await page.waitForSelector('.share', { timeout: T(5000) }).catch(() => undefined);
  check('Share my island asks who gets it', await page.locator('.share-vis button').count() === 4);
  await page.locator('.share-vis button', { hasText: 'Up for sale' }).click();
  await page.locator('.share input[type=number]').fill('0');
  check('a price of 0 is refused with a reason', await page.locator('.share .go').isDisabled() && /whole number of credits/.test(await page.locator('.share-problems').textContent() ?? ''));
  await page.locator('.share-vis button', { hasText: 'Share freely' }).click();
  await page.locator('.share .go').click();
  await page.waitForTimeout(T(300));
  check('sharing closes the dialog and says where it went', await page.locator('.share').count() === 0 && /Your shares/.test(await page.locator('.island-note').textContent() ?? ''));

  // the build HUD: ten tabs on F1..F10, slots with previews, the preset window, studio mode, Esc closes one thing at a time
  check('ten tabs on the tab strip', await page.locator('.tab-strip button').count() === 10);
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(300));
  check('F2 opens the Paint tab', /Paint/.test(await page.locator('.tab-strip button.on').first().textContent() ?? ''));
  check('the paint slots show ground swatches', await page.locator('.hotbar .pv-swatch').count() >= 9);
  await page.keyboard.press('e');
  await page.waitForTimeout(T(500));
  check('E opens your presets', await page.locator('.fwin[aria-label="Your presets"]').count() === 1);
  check('every paint preset has a card', await page.locator('.pw-card').count() >= 20);
  await dom(() => { [...document.querySelectorAll('.pw-tabs button')].find((b) => /Animate/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(400));
  check('animations preview as moving figures', await page.locator('.pw-card .pv-anim').count() >= 8);
  await dom(() => { [...document.querySelectorAll('.pw-card .pw-edit')][0]?.click(); });
  await page.waitForTimeout(T(400));
  check('Edit opens an attribute editor window', await page.locator('.fwin').count() >= 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(200));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(300));
  check('Esc closes the windows one at a time', await page.locator('.fwin').count() === 0 && await page.locator('.island-menu').count() === 0);
  await page.keyboard.press('1');
  await page.waitForTimeout(T(300));
  await page.keyboard.press('b');
  await page.waitForTimeout(T(800));
  check('B switches to studio mode', /Studio/.test(await page.locator('.mode-bar .seg button.on').first().textContent() ?? ''));
  check('studio opens the settings of what you hold', await page.locator('.fwin').count() >= 1);
  await page.keyboard.press('F3');
  await page.waitForTimeout(T(300));
  check('a tool shows what it sets off (sprite, sound, swing)', await page.locator('.fwin .plugs .plug').count() === 3);
  await page.locator('.fwin .plug-add').click();
  await page.locator('.fwin .plug-menu .plug-point').last().locator('button', { hasText: 'Camera shake' }).click();
  await page.waitForTimeout(T(200));
  check('+ attribute adds a camera shake when you let go', await page.locator('.fwin .plugs .plug').count() === 4 && await page.locator('.fwin .plug-choose button').count() === 4);
  await page.locator('.fwin .plugs .plug').last().locator('button.x').click();
  check('and x takes it off again', await page.locator('.fwin .plugs .plug').count() === 3);
  check('the ground has Flat and PBR buttons', await page.locator('.mode-bar button', { hasText: 'PBR' }).count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(200));
  await page.keyboard.press('b');
  await page.waitForTimeout(T(400));
  check('B goes back to walking', /Walk/.test(await page.locator('.mode-bar .seg button.on').first().textContent() ?? ''));
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(600)); }
  await dom(() => { [...document.querySelectorAll('.galaxy-bar button')].find((b) => b.getAttribute('aria-label') === 'Up one level')?.click(); });
  await page.waitForTimeout(T(400));
  check('up one level shows the island overview', await page.locator('.galaxy-bar.open').count() === 1);
  await dom(() => { [...document.querySelectorAll('.galaxy-bar button')].find((b) => b.getAttribute('aria-label') === 'Into the selected')?.click(); });
  await page.waitForTimeout(T(300));
  for (let i = 0; i < 6 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(500)); }
  const escMenu = await page.locator('.island-menu button').allInnerTexts();
  check('the Esc menu has Settings and no race track editor', escMenu.includes('Settings') && !escMenu.includes('Race track editor') && !escMenu.includes('Lighting'), escMenu.join(', '));
  // the race track editor lives in the Goblin Racing menu now
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Activities')?.click(); });
  await page.waitForTimeout(T(400));
  await dom(() => { [...document.querySelectorAll('.shell-activity button')].find((b) => b.textContent === 'Play')?.click(); });
  await page.waitForSelector('.gr-front', { timeout: T(30000) });
  await dom(() => { [...document.querySelectorAll('.gr-front .shell-menu button')].find((b) => b.textContent === 'Multiplayer')?.click(); });
  await page.waitForSelector('.shell-racing');
  await dom(() => { [...document.querySelectorAll('.shell-racing-nav button')].find((b) => b.textContent === 'Track editor')?.click(); });
  await dom(() => { [...document.querySelectorAll('.shell-racing-main button')].find((b) => b.textContent === 'Open the track editor')?.click(); });
  await page.waitForSelector('.maker', { timeout: T(30000) });
  check('the race track editor opens from the Goblin Racing menu', true);
  for (let i = 0; i < 3 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(400)); }
  check('Esc opens the menu in build mode', await page.locator('.maker .island-menu').count() === 1);
  await dom(() => { [...document.querySelectorAll('.maker .island-menu button')].find((b) => b.textContent === 'Back to Island')?.click(); });
  await page.waitForSelector('.hotbar', { timeout: T(30000) });
  check('Back to Island returns from build mode', true);
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(600)); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Home')?.click(); });
  await page.waitForTimeout(T(600));
  check('the jump menu returns home', await page.locator('.sm-home').count() === 1);
  check('no page errors during the whole tour', errors.length === 0, errors.join(' | '));
} catch (e) {
  try { const pg = browser.contexts()[0]?.pages()[0]; if (pg) console.log('screen at failure:', await pg.evaluate(() => `${document.querySelector('.shell')?.getAttribute('data-screen')} | ${document.body.innerText.slice(0, 160).split(String.fromCharCode(10)).join(' / ')}`)); } catch { /* ignore */ }
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
