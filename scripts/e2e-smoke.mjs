/**
 * Browser smoke test of the PRODUCTION build with the installed Chrome (no download): it must boot with no page error, and no screen may be a trap.
 *   node scripts/e2e-smoke.mjs          (serves apps/web/dist itself on a free port; run `npm run build` first)
 * Skipped with a note when Chrome is not installed. Software rendering is slow, so the timeouts are generous.
 * E2E_SHOTS=<folder> also saves screenshots of a few screens there (the gizmo, the Things palette, a campfire) for looking at them.
 * On a slower PC multiply every wait (`E2E_SLOW=3`) and/or render on the graphics card (`E2E_GPU=1`), e.g. `E2E_GPU=1 E2E_SLOW=2 node scripts/e2e-smoke.mjs`.
 */
import { spawn } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chromePaths.some(existsSync)) { console.log('e2e-smoke: Chrome not found, skipped'); process.exit(0); }
const { chromium } = await import('playwright-core');
const { PNG } = await import('pngjs');
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
  const text = (sel, t) => page.locator(sel, { hasText: t }).first();
  const shotDir = process.env.E2E_SHOTS;
  const shot = async (name) => { if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` }); };
  const dom = (fn, arg) => page.evaluate(fn, arg); // software rendering starves the page: click through the DOM instead of waiting for Playwright stability checks
  await page.goto(`http://127.0.0.1:${port}/`);
  // the saves live in IndexedDB too (storage/big-store.ts): the delete waits for this page to close, then the reload starts clean
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('hm-store'); });
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  check('boots to the SetMix home with no page error', errors.length === 0, errors.join(' | '));
  console.log(`     renderer: ${await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const x = g?.getExtension('WEBGL_debug_renderer_info'); return g && x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; })}`);
  check('the home is SetMix Multiverse with its menu', (await page.locator('.sm-brand b').innerText()) === 'SetMix' && (await page.locator('.sm-brand i').innerText()) === 'Multiverse' && JSON.stringify(await page.$$eval('.sm-menu button b', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Studio', 'My planet', 'Avatars', 'Community', 'Settings']));
  // the home is the lab (STATUS SM11): the finished planet shows through its arch once its trees and looks are built
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });
  check('the home is the lab, with the finished planet through its arch', await page.locator('.lab-home.ready').count() === 1);
  check('the menu lab has the free-standing gate and no arch', await dom(() => window.hmLab.gate && !window.hmLab.arch));
  await page.waitForFunction(() => window.hmLab && typeof window.hmLab.scientistArmAngle === 'function' && window.hmLab.scientistArmAngle() !== null, null, { timeout: T(30000) });
  const armAngle = await dom(() => window.hmLab.scientistArmAngle());
  check('in the menu, the figure upper arms hang down (no T-pose)', typeof armAngle === 'number' && Math.abs(armAngle) > 0.5, `arm angle: ${armAngle}`);
  await shot('menu-setmix');

  // Profile menu (TASK-09): chip in top right shows active profile; menu allows switching and opening manager
  check('active profile chip shows Main', (await page.locator('.sm-profile-label').innerText()).trim() === 'Main');
  await page.locator('.sm-profile-chip').click();
  await page.waitForSelector('.sm-profile-menu', { timeout: T(5000) });
  check('profile menu lists Main and actions', await page.locator('.sm-profile-menu').count() === 1);
  await shot('profile-menu');
  await dom(() => { [...document.querySelectorAll('.sm-profile-item')].find((b) => b.textContent.includes('Manage profiles'))?.click(); });
  await page.waitForSelector('[aria-label="Manage profiles"]', { timeout: T(5000) });
  check('Manage profiles opens from chip menu', await page.locator('[aria-label="Manage profiles"]').count() === 1);
  check('Main profile cannot be deleted (no delete button)', await page.locator('.profile-manager-window .delete-profile-btn').count() === 0);
  await page.locator('[aria-label="Manage profiles"] button[aria-label="Close"]').click();
  await page.waitForSelector('[aria-label="Manage profiles"]', { state: 'detached', timeout: T(5000) });

  await text('.sm-menu button', 'Settings').click();
  check('settings opens', await page.locator('[aria-label="Settings"]').count() === 1);
  check('with graphics presets from Potato to Auto', await page.locator('.graphics-presets button').count() === 6);
  check('Settings has Manage profiles button', await page.locator('.manage-profiles-btn').count() === 1);
  // the dither distance (owner: it looked good at his feet and crappy 2 m away): its far end blends everywhere
  await dom(() => { const el = document.querySelector('[data-ui="settings.dither"] input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; if (el) { set?.call(el, el.max); el.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.waitForTimeout(T(200));
  check('Graphics has a dither distance slider whose far end is Unlimited', /^Unlimited$/.test(await dom(() => document.querySelector('[data-ui="settings.dither"] output')?.textContent ?? '')));
  await text('[aria-label="Settings"] button', 'Close').click();
  check('settings closes back to the home', await page.locator('.sm-home').count() === 1);

  // the Goblin Racing version of the same build (owner, 2026-10-06 20:30): Goblin Racing tops its menu, and only there
  await page.goto(`http://127.0.0.1:${port}/?edition=goblin-racing`);
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });
  await shot('menu-goblin-racing');
  check('the Goblin Racing version lists Goblin Racing first', JSON.stringify(await page.$$eval('.sm-menu button b', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Goblin Racing', 'Play', 'Studio', 'My planet', 'Avatars', 'Community', 'Settings']));
  // Goblin Racing: its menu entry opens its own menu; Race modes holds its sections; Esc steps back out to SetMix
  await dom(() => { [...document.querySelectorAll('.sm-menu button')].find((b) => b.querySelector('b')?.textContent === 'Goblin Racing')?.click(); });
  await page.waitForSelector('.gr-front', { timeout: T(15000) });
  check('Goblin Racing opens its own menu', JSON.stringify(await page.$$eval('.gr-front .shell-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Race modes', 'Settings', 'Back to SetMix']));
  check('its menu tells a new player what Play does', /first avatar/.test(await page.locator('.gr-front .shell-foot').innerText()));
  await text('.gr-front .shell-menu button', 'Race modes').click();
  await page.waitForSelector('.shell-racing', { timeout: T(30000) });
  for (const s of ['Tournaments', 'Spectate', 'Rankings', 'Track editor', 'Settings', 'My goblin', 'The Bookie', 'Quick race']) await dom((t) => { [...document.querySelectorAll('.shell-racing-nav button')].find((b) => b.textContent === t)?.click(); }, s);
  check('every Goblin Racing section opens', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc leaves the sections for Goblin Racing\'s menu', await page.locator('.gr-front').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc again returns to the SetMix home', await page.locator('.sm-home').count() === 1);
  // back to the SetMix version for the rest
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });

  // the Resolution Crafter preview (?crafter, a test view): the moon builds behind a loading bar; a stage jump sends a wave out from your plot's centre; Esc returns home
  const crafterErrors = errors.length;
  await page.goto(`http://127.0.0.1:${port}/?crafter`);
  await page.waitForFunction(() => window.hmCrafter && window.hmCrafter.frames > 5, null, { timeout: T(30000) });
  check('the Resolution Crafter builds its moon and draws it', await page.locator('.rc-console').count() === 1 && await dom(() => window.hmCrafter.shown.startsWith('lunar_anorthosite@1@')));
  await dom(() => [...document.querySelectorAll('.rc-ladder button')][2]?.click());
  await page.waitForFunction(() => window.hmCrafter.radius > 0 && window.hmCrafter.target.includes('@3@'), null, { timeout: T(15000) });
  check('a stage jump sends a wave out from your plot\'s centre', true);
  await page.waitForFunction(() => window.hmCrafter.shown.includes('@3@') && window.hmCrafter.radius < 0, null, { timeout: T(30000) });
  check('the wave crosses the moon and stage 3 settles', /Stage 3 of 6/.test(await page.locator('.rc-stage-line').innerText()));
  await shot('crafter-stage-3');
  await dom(() => document.querySelector('.rc-run')?.click());
  await page.waitForTimeout(T(1200));
  check('Climb takes the world up the stages', await dom(() => window.hmCrafter.p > 0.429));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc leaves the Resolution Crafter for the SetMix home', await page.locator('.sm-home').count() === 1 && await dom(() => !window.hmCrafter));
  check('the Resolution Crafter raised no page error', errors.length === crafterErrors, errors.slice(crafterErrors).join(' | '));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });


  // My planet shows your islands drawn from above; going into one the first time makes your first avatar (look and name), then dives
  await text('.sm-menu button', 'My planet').click();
  await page.waitForSelector('[aria-label="My planet"]', { timeout: T(10000) });
  check('My planet shows your islands drawn from above', await page.locator('[aria-label="My planet"] canvas.island-map').count() >= 1);
  await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => b.textContent === 'Go in')?.click(); });
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
  await page.waitForSelector('.v3', { timeout: T(60000) });
  check('Done takes you to your island', true);
  check('the island draws with the dither distance from Settings (Unlimited)', await page.evaluate(() => window.hmRenderer?.graphics?.ditherDistance) === 0, String(await page.evaluate(() => window.hmRenderer?.graphics?.ditherDistance)));
  // D20 (the island starts in the voxel look; the tour reveal below switches to painted): in the voxel look, where two surfaces meet the blocks dither between them (a pixel-art blend, not a scatter of whole squares)
  const edge = await page.evaluate(() => window.hmGround?.edge?.());
  check('the island has a place where two surfaces meet half and half', !!edge);
  if (edge) { await page.evaluate((p) => { window.hmPinView = { eye: [p[0] + 2.2, p[1] + 2.4, p[2] + 2.2], target: [p[0], p[1], p[2]] }; }, edge); await page.waitForTimeout(T(800)); await shot('flat-shore'); await page.evaluate(() => { window.hmPinView = null; }); }
  // the dither does not flicker as you move (owner, 2026-10-04): two pictures of the far shore, the camera 3 cm apart, differ little
  if (edge) {
    const far = (dd) => page.evaluate(([p, d]) => { window.hmPinView = { eye: [p[0] + 9 + d, p[1] + 6, p[2] + 9], target: [p[0], p[1], p[2]] }; }, [edge, dd]);
    const pic = async () => PNG.sync.read(await page.screenshot({ clip: { x: 440, y: 280, width: 400, height: 160 } }));
    const change = (a, b) => { let d = 0; for (let i = 0; i < a.data.length; i += 4) d += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return d / (a.width * a.height * 3); };
    // the far view settles first (its ground streaming in, the camera arriving): a still camera gives the same picture twice.
    // Measured before it settled, a still camera changed by 85 and the check failed on a cold PC; settled it is 0.01 still, 4.1 moved
    await far(0);
    let p0 = await pic(), still = Infinity;
    for (let i = 0; i < 16 && still >= 1; i++) { await page.waitForTimeout(T(500)); const q = await pic(); still = change(p0, q); p0 = q; }
    await far(0.03);
    await page.waitForTimeout(T(600));
    const p1 = await pic();
    await page.evaluate(() => { window.hmPinView = null; });
    const diff = change(p0, p1);
    console.log(`     dither flicker: ${diff.toFixed(2)} (mean colour change, 0..255, the camera moved 3 cm; a still camera ${still.toFixed(2)})`);
    check('the far dither does not shimmer as you move (filtered: it was 10.4 before)', diff < 7, diff.toFixed(2));
    if (shotDir) { fs.writeFileSync(`${shotDir}/flicker-a.png`, PNG.sync.write(p0)); fs.writeFileSync(`${shotDir}/flicker-b.png`, PNG.sync.write(p1)); }
  }
  await page.waitForSelector('.tour', { timeout: T(15000) }).catch(() => undefined);
  check('the island tour starts on your first visit', await page.locator('.tour h3').count() === 1);
  const missing = await page.evaluate(() => (window.hmTourTargets ?? ['(none published)']).filter((t) => !document.querySelector(`[data-ui="${t}"]`)));
  check('every control the tour points at is on the island (B15)', missing.length === 0, missing.join(', '));
  for (let i = 0; i < 12 && await page.locator('.tour-reveal').count() === 0; i++) { await page.locator('.tour button', { hasText: 'Skip' }).click(); await page.waitForTimeout(T(120)); }
  check('the tour ends on the PBR reveal', await page.locator('.tour-reveal').count() === 1);
  await page.locator('.tour-reveal').click();
  await page.waitForTimeout(T(400));
  check('Show me switches the ground to PBR', await page.locator('.mode-bar button.on', { hasText: 'PBR' }).count() === 1);
  // the last step closes by itself after 7 s: Not now only while it is still up
  if (await page.locator('.tour button', { hasText: 'Not now' }).count()) await dom(() => { [...document.querySelectorAll('.tour button')].find((b) => b.textContent === 'Not now')?.click(); });
  await page.waitForTimeout(T(300));
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
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });
  check('coming home opens the lab again', await page.locator('.lab-home.ready').count() === 1);

  await page.locator('.sm-menu .sm-sub').click();
  await page.waitForSelector('.v3', { timeout: T(60000) });
  check('My island reaches the island with the hotbar', true);
  // the first Esc skips the arrival cinematic (slow under software rendering); keep pressing until the menu shows
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(700)); }
  check('Esc opens the jump menu on the island', await page.locator('.island-menu').count() === 1);
  check('and the galaxy bar comes down', await page.locator('.galaxy-bar.open').count() === 1);
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'My planet')?.click(); });
  await page.waitForSelector('[aria-label="My planet"]', { timeout: T(5000) }).catch(() => undefined);
  check('My planet lists the first island', await page.locator('[aria-label="My planet"] article.planet-island').count() >= 1);
  await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => /New island/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(300));
  check('New island offers Quick setup, Setup wizard and Manual', JSON.stringify(await page.$$eval('.nc-way b', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Quick setup', 'Setup wizard', 'Manual']));
  await dom(() => { [...document.querySelectorAll('.nc-way')].find((b) => /Quick setup/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(600));
  check('Quick setup shows the ready-made islands as maps', await page.locator('.ni-grid canvas.island-map').count() >= 5);
  await dom(() => { document.querySelector('.ni-grid button')?.click(); });
  await page.waitForTimeout(T(400));
  check('one click makes the island', await page.locator('[aria-label="My planet"] article.planet-island').count() >= 2);
  await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => b.getAttribute('aria-label') === 'Undo')?.click(); });
  await page.waitForTimeout(T(300));
  check('Undo takes it away again', await page.locator('[aria-label="My planet"] article.planet-island').count() === 1);
  // an island to a .setmix file and back (RELEASE_PLAN Milestone 0.5)
  {
    const first = await page.locator('[aria-label="My planet"] article.planet-island h4').first().innerText();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: T(10000) }), page.locator('[aria-label="My planet"] button[title="Export to a file"]').first().click()]);
    const path = await download.path();
    check('Export saves the island as a .setmix file', download.suggestedFilename().endsWith('.setmix') && !!path, download.suggestedFilename());
    await page.locator('input[aria-label="Island file to import"]').setInputFiles(path);
    await page.waitForTimeout(T(800));
    const names = await page.locator('[aria-label="My planet"] article.planet-island h4').allInnerTexts();
    check('Import a file brings it back as a new island', names.length === 2 && names.every((n) => n.startsWith(first)), JSON.stringify(names));
    await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => b.getAttribute('aria-label') === 'Undo')?.click(); });
    await page.waitForTimeout(T(300));
  }
  await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => b.textContent === 'Close')?.click(); });
  await page.waitForSelector('.v3', { timeout: T(30000) });
  check('Close returns to the island', true);
  for (let i = 0; i < 8 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(700)); }
  await dom(() => { [...document.querySelectorAll('.island-menu button')].find((b) => b.textContent === 'Share this island')?.click(); });
  await page.waitForSelector('.share', { timeout: T(5000) }).catch(() => undefined);
  check('Share this island asks who gets it', await page.locator('.share-vis button').count() === 4);
  await page.locator('.share-vis button', { hasText: 'Up for sale' }).click();
  await page.locator('.share input[type=number]').fill('0');
  check('a price of 0 is refused with a reason', await page.locator('.share .go').isDisabled() && /whole number of credits/.test(await page.locator('.share-problems').textContent() ?? ''));
  await page.locator('.share-vis button', { hasText: 'Share freely' }).click();
  await page.locator('.share .go').click();
  await page.waitForTimeout(T(300));
  check('sharing closes the dialog and says where it went', await page.locator('.share').count() === 0 && /Your shares/.test(await page.locator('.island-note').textContent() ?? ''));

  // avatar mode (My avatar, top right): the camera faces your avatar, the dock shows your characters and this one's presets; a new one is made three ways
  await dom(() => document.querySelector('[data-ui="island.avatar"]')?.click());
  await page.waitForTimeout(T(600));
  check('My avatar opens avatar mode with your characters and New avatar', await page.locator('.avatar-dock').count() === 1 && await page.locator('.ad-row button').count() === 2);
  check('and the hotbar steps aside', await page.locator('.v3').count() === 0);
  await dom(() => { document.querySelector('.ad-row .ad-new')?.click(); });
  await page.waitForTimeout(T(300));
  await dom(() => { [...document.querySelectorAll('.avatar-dock .nc-way')].find((b) => /Quick setup/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(300));
  await dom(() => { document.querySelectorAll('.avatar-dock .ad-looks button')[2]?.click(); });
  await page.waitForTimeout(T(300));
  await dom(() => { [...document.querySelectorAll('.avatar-dock .btns .go')].find((b) => /^Make/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(500));
  check('Quick setup makes a second character and wears it', await page.locator('.ad-row button').count() === 3 && await page.locator('.ad-row button.on').count() === 1);
  await dom(() => { document.querySelectorAll('.ad-row button')[1]?.click(); });
  await page.waitForTimeout(T(300));
  check('one click swaps back to the first', await page.locator('.ad-row button.on').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(500));
  check('Esc leaves avatar mode back to the hotbar', await page.locator('.avatar-dock').count() === 0 && await page.locator('.v3').count() === 1);

  // the V3 hotbar (docs/HOTBAR_V3_SPEC.md): twelve tabs with each mode's names, each mode's own layout under them
  const clickWorld = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(T(80)); await page.mouse.up(); await page.waitForTimeout(T(250)); };
  const slots = () => page.$$eval('.v3-slot > span', (b) => b.map((x) => x.textContent));
  const tabNames = () => page.$$eval('.v3-tabs button', (b) => b.map((x) => (x.getAttribute('data-label') ?? '').replace(/ \(.*$/, '')));
  const tabOn = () => dom(() => document.querySelector('.v3-tabs button.on')?.textContent ?? '');
  const mode = async (id) => { await dom((m) => document.querySelector(`[data-ui="island.mode.${m}"]`)?.click(), id); await page.waitForTimeout(T(250)); };
  const slot = async (name) => { await dom((n) => { [...document.querySelectorAll('.v3-slot')].find((b) => b.querySelector('span')?.textContent === n)?.click(); }, name); await page.waitForTimeout(T(200)); };
  const chip = async (name) => { await dom((n) => { [...document.querySelectorAll('.v3-chips button')].find((b) => (b.textContent ?? '').trim() === n)?.click(); }, name); await page.waitForTimeout(T(200)); };
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(T(300)); };
  const note = () => dom(() => document.querySelector('.island-note')?.textContent ?? '');
  check('twelve tabs on the hotbar, F1 to F12', await page.locator('.v3-tabs button').count() === 12);
  check('Game Mode names its tabs as the spec does', JSON.stringify(await tabNames()) === JSON.stringify(['Grab Tool', 'Color Spray', 'Blocks and Clay', 'Puppet Show', 'Boombox', 'Lantern', 'Magic Cord', 'Photo Cam', 'Toy Box', 'Dirt and Trees', 'Physics Play', 'Magic Wand']), JSON.stringify(await tabNames()));
  check('the switch at the end reads Game, Simplified, Advanced', JSON.stringify(await page.$$eval('.v3-modes button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Game', 'Simplified', 'Advanced']));
  const stripFits = () => dom(() => { const r = document.querySelector('.v3-tabs')?.getBoundingClientRect(); return !!r && r.left >= 0 && r.right <= innerWidth; });
  check('the tabs fit a 1280 px screen', await stripFits());
  await page.setViewportSize({ width: 900, height: 700 }); await page.waitForTimeout(T(400));
  check('and a 900 px one (the open tab keeps its name)', await stripFits() && await dom(() => { const label = document.querySelector('.v3-tabs button.on > span'); return !!label && getComputedStyle(label).display !== 'none'; }));
  await shot('tabs-900');
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(T(400));
  await key('F3');
  check('Game Mode F3 holds Blocks and Clay\'s numbered presets (Prop Box added in V3.1)', JSON.stringify(await slots()) === JSON.stringify(['Toy Brick', 'Smooth Ball', 'Ramp / Slide', 'Clay Plump', 'Clay Scoop', 'Clay Flatten', 'Punch Hole', 'Prop Box']), JSON.stringify(await slots()));
  check('a preset that is coming carries its pip', await page.locator('.v3-slot.coming .v3-pip').count() >= 1);
  await shot('v3-game');
  await key('`');
  check('the backtick switches to Simplified: F3 is Shapes and Sculpt, its sub-tools on the hotbar', /Shapes and Sculpt/.test(await tabOn()) && JSON.stringify(await slots()) === JSON.stringify(['Add Building Block', 'Clay Modeling', 'Cut & Carve (Booleans)', 'Place Props']), `${await tabOn()} ${JSON.stringify(await slots())}`);
  check('Simplified shows the sub-tool\'s presets and its sliders under the tab\'s own name', /Basic Shapes & Clay Sculpt/.test(await dom(() => document.querySelector('.v3-panel header b')?.textContent ?? '')) && await page.locator('.v3-chips button').count() === 6 && await page.locator('.v3-sliders input[type=range]').count() >= 2);
  await dom(() => { const el = document.querySelector('.v3-range input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; set?.call(el, '3'); el?.dispatchEvent(new Event('input', { bubbles: true })); el?.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(T(200));
  const moved = await dom(() => document.querySelector('.v3-range output')?.textContent ?? '');
  await dom(() => { [...document.querySelectorAll('.v3-reset')].find((b) => b.textContent === 'Reset')?.click(); });
  await page.waitForTimeout(T(200));
  check('a slider moves, and Reset puts it back', moved === '3.0 m' && await dom(() => document.querySelector('.v3-range output')?.textContent ?? '') === '1.0 m', moved);
  await shot('v3-simplified');
  await key('`');
  check('again: Advanced, F3 is Geometry with its tools, seven presets and its keys', /Geometry/.test(await tabOn()) && (await slots()).includes('Primitive Generator') && await page.locator('.v3-panel .v3-chips button').count() === 7 && await page.locator('.v3-keys > div').count() === 3);
  await shot('v3-advanced');
  await key('F1');
  check('Advanced F1 shows the Selection filters, the ones coming dashed', await page.locator('.v3-filters button').count() === 6 && await page.locator('.v3-filters button.coming').count() === 5);
  const flip = () => dom(() => { [...document.querySelectorAll('.v3-filters button')].find((b) => /Static Mesh/.test(b.textContent ?? ''))?.click(); });
  await flip(); await page.waitForTimeout(T(150));
  const offNow = await page.locator('.v3-filters button[aria-pressed="false"]').count();
  await flip(); await page.waitForTimeout(T(150));
  check('a filter switches off and on again', offNow === 1 && await page.locator('.v3-filters button[aria-pressed="false"]').count() === 0);
  await key('F3');
  await key('`');
  check('and again: back to Game', await page.locator('.v3-modes button.on', { hasText: 'Game' }).count() === 1);
  await slot('Prop Box');
  check('Prop Box (V3.1) opens the box of the island props above the hotbar', await page.locator('.v3-options button').count() === 10, String(await page.locator('.v3-options button').count()));
  await shot('v3-prop-box');
  // Find a tool (/): type a few letters, Enter puts it in your hand
  await key('/');
  await page.keyboard.type('flat'); await page.waitForTimeout(T(200));
  check('/ finds a tool by the start of its words', (await page.$$eval('.v3-find li b', (b) => b.map((x) => x.textContent))).includes('Clay Flatten'));
  await page.keyboard.press('Enter'); await page.waitForTimeout(T(300));
  check('and Enter puts it in your hand', /Clay Flatten/.test(await dom(() => document.querySelector('.v3-slot.on')?.textContent ?? '')) && await page.locator('.v3-find').count() === 0);
  // paint the ground for real: Simplified, Ground Material (V3.1), Lava, one dab where the cursor is (in studio the mouse is free)
  await key('b'); await page.waitForTimeout(T(600));
  await mode('simplified');
  await key('F2');
  await slot('Ground Material'); await chip('Lava');
  const lavaBefore = await page.evaluate(() => window.hmGround?.shows?.(13) ?? 0);
  await clickWorld(640, 420); await page.waitForTimeout(T(400));
  const lavaAfter = await page.evaluate(() => window.hmGround?.shows?.(13) ?? 0);
  check('Ground Material: Lava paints the ground where you click', lavaAfter > lavaBefore, `lava cells ${lavaBefore} to ${lavaAfter}; ${await note()}`);
  await key('Control+z');
  check('and Ctrl+Z takes it back', (await page.evaluate(() => window.hmGround?.shows?.(13) ?? 0)) === lavaBefore);
  // the surface editor: SetMix's ground is made from graphs, so a surface's look can be changed live (Edit this ground's look)
  await chip('Grass');
  await dom(() => document.querySelector('[data-ui="island.surface-look"]')?.click());
  await page.waitForSelector('.surface-editor .se-style', { timeout: 20000 }).catch(() => null);
  check('Edit this ground\'s look opens the surface editor with its styles as previews', await page.locator('.surface-editor .se-style canvas').count() >= 3);
  const lookBefore = await page.evaluate(() => window.hmGround?.tile?.(4));
  await dom(() => document.querySelectorAll('.surface-editor .se-style')[1]?.click());
  await page.waitForTimeout(T(300));
  await dom(() => document.querySelector('.surface-editor button.go')?.click());
  await page.waitForFunction(() => /uses this look/.test(document.querySelector('.surface-editor [role=status]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => null);
  check('Use on this island redraws the surface and keeps the look for the player', lookBefore !== await page.evaluate(() => window.hmGround?.tile?.(4))
    && await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hm.profile.v2') || '{}').groundLooks ?? {}).length > 0));
  await key('Escape');
  check('Esc closes the surface editor', await page.locator('.surface-editor').count() === 0);
  // texture mode (MASTER_PLAN 6.4): step into the texture; the hotbar paints it; Esc steps out and the island keeps it
  await dom(() => document.querySelector('[data-ui="island.surface-look"]')?.click());
  await page.waitForSelector('[data-ui="island.texture-step-in"]', { timeout: 20000 }).catch(() => null);
  await dom(() => document.querySelector('[data-ui="island.texture-step-in"]')?.click());
  await page.waitForSelector('.tex-bench canvas', { timeout: 20000 }).catch(() => null);
  check('Paint and sculpt it by hand steps into the texture', await page.locator('.tex-bench canvas').count() === 1);
  const texBefore = await page.evaluate(() => window.hmGround?.tile?.(4));
  const tb = await page.locator('.tex-bench canvas').boundingBox();
  if (tb) { await page.mouse.move(tb.x + tb.width * 0.3, tb.y + tb.height * 0.4); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(tb.x + tb.width * (0.3 + k * 0.05), tb.y + tb.height * 0.4); await page.mouse.up(); }
  await page.waitForTimeout(T(600));
  check('the hotbar paints the texture and the island shows it', texBefore !== await page.evaluate(() => window.hmGround?.tile?.(4)));
  for (let i = 0; i < 3 && await page.locator('.tex-bench').count() > 0; i++) await key('Escape');
  check('Esc steps out of the texture', await page.locator('.tex-bench').count() === 0);
  // Layers (L): what the island is made of; + Add puts a thing where you look, the eye hides it, the bin removes it
  await key('l');
  check('L opens Layers', await page.locator('.fwin[aria-label="Layers"] .layers').count() === 1);
  const things = await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count();
  await page.mouse.move(640, 470); await page.waitForTimeout(T(200));
  await dom(() => { [...document.querySelectorAll('.layers .ly-head button')].find((b) => /Add/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(200));
  await dom(() => { [...document.querySelectorAll('.layers .ly-add button')].find((b) => /Barrel/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(500));
  check('+ Add puts a thing in as a new layer, picked', await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count() === things + 1 && await page.locator('.layers .ly-row.on .ly-attrs').count() === 1);
  // the gizmo (Simplified and Advanced): on the picked thing; drag the x arrow, one undo step puts it back
  await key('F1');
  const g0 = await page.evaluate(() => window.hmGizmo?.());
  check('Simplified shows the move gizmo on the picked thing', !!g0 && g0.mode === 'move', JSON.stringify(g0));
  if (g0) {
    await key('+');
    const g1 = await page.evaluate(() => window.hmGizmo?.());
    check('+ grows the gizmo', !!g1 && g1.size > 1.1, String(g1?.size));
    await page.mouse.move(g1.xArrow[0], g1.xArrow[1]);
    await page.waitForTimeout(T(300));
    const hot = (await page.evaluate(() => window.hmGizmo?.()))?.hot;
    await shot('gizmo-hover-x');
    check('pointing at the x arrow lights it', hot?.kind === 'axis' && hot?.axis === 'x', JSON.stringify(hot));
    await page.mouse.down(); await page.waitForTimeout(T(100));
    await page.mouse.move(g1.xFar[0], g1.xFar[1], { steps: 6 }); await page.waitForTimeout(T(200));
    await page.mouse.up(); await page.waitForTimeout(T(300));
    const g2 = await page.evaluate(() => window.hmGizmo?.());
    check('dragging the x arrow moves the thing along x only', !!g2 && g2.x - g1.x > 0.2 && Math.abs(g2.z - g1.z) < 1e-6 && Math.abs(g2.y - g1.y) < 1e-6, `x ${g1.x} to ${g2?.x}; before ${JSON.stringify(g1)}; after ${JSON.stringify(g2)}`);
    console.log(`     gizmo drag: x ${g1.x.toFixed(3)} to ${g2?.x.toFixed(3)} (arrow ${g1.len.toFixed(3)} m long)`);
    await key('Control+z');
    const g3 = await page.evaluate(() => window.hmGizmo?.());
    check('one Ctrl+Z puts it back', !!g3 && Math.abs(g3.x - g1.x) < 1e-6, `x ${g3?.x}`);
    await key('F5');
    check('the gizmo stays on the picked thing in every tab (V3.1)', !!(await page.evaluate(() => window.hmGizmo?.())));
    await key('-');
  }
  await mode('game');
  check('Game Mode has no gizmo', !(await page.evaluate(() => window.hmGizmo?.())));
  // the tools below click the ground: let go of the barrel so its gizmo is not in the way
  await page.evaluate(() => window.hmSelect?.(null));
  // Magic Wand (F12, or Shift+F2): Bonfire Flame burns where you click; Ctrl+Z takes it away
  await key('Shift+F2');
  check('Shift+F2 opens Magic Wand', /Magic Wand/.test(await tabOn()));
  await slot('Bonfire Flame');
  await clickWorld(640, 420); await page.waitForTimeout(T(700));
  const fx1 = await page.evaluate(() => window.hmEffects?.());
  await shot('effects-campfire');
  check('Bonfire Flame puts a campfire on the island and it burns', fx1?.placed === 1 && fx1.particles > 0, JSON.stringify(fx1) + ' ' + await note());
  await key('Control+z');
  check('and Ctrl+Z takes it away', (await page.evaluate(() => window.hmEffects?.()))?.placed === 0);
  // Audio (Simplified F5): Forest Birds as an ambience zone; Ctrl+Z takes it away
  await mode('simplified');
  await key('F5');
  await slot('Background Ambience Zone'); await chip('Forest Birds');
  await clickWorld(640, 420);
  check('Background Ambience Zone puts Forest Birds down as a zone', (await page.evaluate(() => window.hmSounds?.()))?.zones === 1, JSON.stringify(await page.evaluate(() => window.hmSounds?.())) + ' ' + await note());
  await key('Control+z');
  check('and Ctrl+Z takes the zone away', (await page.evaluate(() => window.hmSounds?.()))?.placed === 0);
  // Characters (Simplified F9): a Wandering Animal walks off by itself; Ctrl+Z takes it away
  await key('F9');
  await slot('Spawn Character'); await chip('Wandering Animal');
  await clickWorld(640, 420); await page.waitForTimeout(T(1300));
  const ch = await page.evaluate(() => window.hmChars?.());
  check('Spawn Character puts a goblin down and it wanders off by itself', ch?.count === 1 && ch.drawn === 1 && ch.moved > 0.3, JSON.stringify(ch));
  if (ch?.first) { await page.evaluate((p) => { window.hmPinView = { eye: [p[0] + 2.4, p[1] + 1.6, p[2] + 2.4], target: [p[0], p[1] + 0.6, p[2]] }; }, ch.first); }
  await page.waitForTimeout(T(500));
  await shot('characters-wander');
  await page.evaluate(() => { window.hmPinView = null; });
  await key('Control+z');
  check('and Ctrl+Z takes the goblin away', (await page.evaluate(() => window.hmChars?.()))?.count === 0);
  // Lantern (Game F6): a Sticky Flashlight lights up; Turn to Night; two Ctrl+Z take the night and the light back
  await mode('game');
  await key('F6');
  await slot('Sticky Flashlight');
  check('the island note never catches a click', await dom(() => { const n = document.querySelector('.island-note'); return !n || getComputedStyle(n).pointerEvents === 'none'; }));
  await clickWorld(640, 420);
  const lamp = await page.evaluate(() => window.hmLamps?.());
  check('Sticky Flashlight puts a light orb down and it is lit', lamp?.placed === 1 && (lamp.slots === 0 || lamp.lit === 1), JSON.stringify(lamp) + ' ' + await note() + ' ' + errors.join(' / '));
  // the island budget (RELEASE_PLAN Milestone 0.5): fill the lamps to this tier's budget, and the next one is refused in plain words
  {
    const budget = await page.evaluate(() => { const b = window.hmBudget; const tier = b.tier(); const max = { potato: 40, low: 100, medium: 200, high: 400, ultra: 800 }[tier]; b.fillLamps(max - b.counts().lamps); return { tier, max, lamps: b.counts().lamps }; });
    await clickWorld(640, 420);
    const after = await page.evaluate(() => window.hmLamps?.());
    check(`the lamp past the ${budget.tier} budget is refused (${budget.max})`, budget.lamps === budget.max && after?.placed === budget.max && /full of lamps/.test(await note()), JSON.stringify(budget) + ' ' + JSON.stringify(after) + ' ' + await note());
    await key('Control+z');
    check('one Ctrl+Z takes the test lamps away', (await page.evaluate(() => window.hmLamps?.()))?.placed === 1);
  }
  await slot('Turn to Night');
  await clickWorld(640, 420); await page.waitForTimeout(T(1300));
  if (lamp?.first) await page.evaluate((p) => { window.hmPinView = { eye: [p[0] + 5, p[1] + 4, p[2] + 5], target: [p[0], p[1] - 1, p[2]] }; }, lamp.first);
  await page.waitForTimeout(T(600));
  await shot('lamp-night');
  await page.evaluate(() => { window.hmPinView = null; });
  await key('Control+z'); await key('Control+z');
  check('two Ctrl+Z take the night and the light back', (await page.evaluate(() => window.hmLamps?.()))?.placed === 0);
  // Physics Play (Game F11, or Shift+F1): the Push Hammer sends the barrel flying; it lands for good as one undo step
  await key('Shift+F1');
  check('Shift+F1 opens Physics Play', /Physics Play/.test(await tabOn()));
  await slot('Push Hammer');
  await clickWorld(640, 420); await page.waitForTimeout(T(4300));
  const ph = await page.evaluate(() => window.hmPhysics?.());
  check('the Push Hammer sends things flying and they land for good', ph?.settled === 1 && !ph.moving, JSON.stringify(ph) + ' ' + await note());
  await key('Control+z');
  // Terrain (Simplified F10): Paths & Water (V3.1), a Stone Road from two points, laid by clicking the last one again; Ctrl+Z takes it back
  await mode('simplified');
  await key('F10');
  await slot('Paths & Water'); await chip('Stone Road');
  const groundBefore = await page.evaluate(() => [window.hmGround?.heights?.(), window.hmGround?.surfaces()[24] ?? 0]);
  for (const [x, y] of [[520, 410], [760, 410], [760, 410]]) await clickWorld(x, y);
  await page.waitForTimeout(T(400));
  const road = await page.evaluate(() => [window.hmPath?.(), window.hmGround?.heights?.(), window.hmGround?.surfaces()[24] ?? 0]);
  const laid = road[0]?.last ?? [];
  if (laid.length >= 2) { await page.evaluate((pts) => { const mx = (pts[0][0] + pts[pts.length - 1][0]) / 2, mz = (pts[0][1] + pts[pts.length - 1][1]) / 2; const g = window.hmGround?.heightAt?.(mx, mz) ?? 5; window.hmPinView = { eye: [mx + 6, g + 9, mz + 6], target: [mx, g, mz] }; }, laid); await page.waitForTimeout(T(600)); await shot('road'); await page.evaluate(() => { window.hmPinView = null; }); }
  check('Stone Road: two points and the last again lay a cobbled road that reshapes the ground', road[0]?.laid === 1 && road[1] !== groundBefore[0] && road[2] > groundBefore[1], JSON.stringify([groundBefore, road]));
  await key('Control+z');
  check('and Ctrl+Z takes the road back', (await page.evaluate(() => window.hmGround?.heights?.())) === groundBefore[0]);
  // Rules (Simplified F7): a zone (Player Enters Area), an Action Link from it to the barrel (Open Door); walking in hides the barrel; undo takes it all back
  await key('F7');
  await slot('Trigger Zones'); await chip('Player Enters Area');
  await clickWorld(640, 420);
  check('Player Enters Area puts a trigger zone down', (await page.evaluate(() => window.hmWires?.()))?.zones === 1);
  await slot('Action Links'); await chip('Open Door');
  await clickWorld(640, 420);
  const barrelAt = await page.evaluate(() => { const t = window.hmThings?.()[0]; return t ? window.hmProject?.(t.x, t.y + 0.05, t.z) : null; });
  if (barrelAt) await clickWorld(barrelAt[0], barrelAt[1]);
  const wired = await page.evaluate(() => window.hmWires?.());
  check('Action Links: the zone, then the barrel', wired?.wires === 1, JSON.stringify(wired) + ' ' + await note());
  const walked = await page.evaluate(() => { const w = window.hmWires?.(); return w ? w.walkInto('') : -1; });
  check('walking into the zone opens (hides) the barrel', walked >= 0 && (await page.evaluate(() => window.hmWires?.()))?.hidden.length === 1, String(walked));
  // Advanced F7: the Visual Wire Graph draws the zone, the barrel and the cord between them
  await mode('advanced');
  await key('F7');
  await slot('Visual Wire Graph');
  await page.waitForTimeout(T(300));
  check('Visual Wire Graph shows the zone and the barrel joined by a cord', await page.locator('.wg .node.zone').count() === 1 && await page.locator('.wg .cord').count() === 1, `${await page.locator('.wg .node').count()} nodes, ${await page.locator('.wg .cord').count()} cords`);
  await shot('wire-graph');
  await key('Escape');
  await mode('simplified');
  // undo exactly the steps made (a step that did not happen must not cost an earlier one)
  for (let i = 0; i < (wired?.wires ?? 0) + (wired?.zones ?? 0); i++) await key('Control+z');
  const after = await page.evaluate(() => window.hmWires?.());
  check('Ctrl+Z takes the link and the zone back, and the barrel shows again', after?.zones === 0 && after.wires === 0 && after.hidden.length === 0, JSON.stringify(after));
  // Magic Cord (Game F7): Step-Pad to Door, the pad then the barrel; the Wire Cutter snips it
  await mode('game');
  await key('F7');
  await slot('Step-Pad to Door');
  await clickWorld(640, 420);
  const barrelAt2 = await page.evaluate(() => { const t = window.hmThings?.()[0]; return t ? window.hmProject?.(t.x, t.y + 0.05, t.z) : null; });
  if (barrelAt2) await clickWorld(barrelAt2[0], barrelAt2[1]);
  const cord = await page.evaluate(() => window.hmWires?.());
  check('Step-Pad to Door: a pad, then the barrel, joined by a cord', cord?.zones === 1 && cord.wires === 1, JSON.stringify(cord) + ' ' + await note());
  await slot('Wire Cutter');
  if (barrelAt2) await clickWorld(barrelAt2[0], barrelAt2[1]);
  check('the Wire Cutter snips it', (await page.evaluate(() => window.hmWires?.()))?.wires === 0, await note());
  for (let i = 0; i < 3; i++) await key('Control+z');
  check('and undo takes the pad away', (await page.evaluate(() => window.hmWires?.()))?.zones === 0, JSON.stringify(await page.evaluate(() => window.hmWires?.())));
  // Photo Cam (Game F8): Instant Polaroid saves a picture; Slow-Mo Cam drops the world to 20% and back; (Simplified) Spin Around Object flies round
  await key('F8');
  await slot('Instant Polaroid'); await clickWorld(640, 420); await page.waitForTimeout(T(300));
  check('Instant Polaroid saves a picture of the view', (await page.evaluate(() => window.hmCamera?.()))?.photos === 1);
  await slot('Slow-Mo Cam'); await clickWorld(640, 420); await page.waitForTimeout(T(800));
  const sm = await page.evaluate(() => window.hmCamera?.());
  check('Slow-Mo Cam slows the world to 20%', sm?.slow === true && Math.abs(sm.scale - 0.2) < 1e-6, JSON.stringify(sm));
  await clickWorld(640, 420); await page.waitForTimeout(T(800));
  check('and again brings it back to speed', (await page.evaluate(() => window.hmCamera?.()))?.scale === 1);
  await mode('simplified');
  await slot('Fly-Through Track'); await chip('Spin Around Object');
  await clickWorld(640, 420); await page.waitForTimeout(T(600));
  check('Spin Around Object flies the camera round', (await page.evaluate(() => window.hmCamera?.()))?.shot === true);
  await shot('orbit-shot');
  await key('Escape');
  check('and Esc stops it', (await page.evaluate(() => window.hmCamera?.()))?.shot === false);
  // Walk Path Creator (Simplified F4): click the barrel, two points, the last again: it walks there and back by itself; Ctrl+Z stops it
  await key('F4');
  await slot('Walk Path Creator'); await chip('Back & Forth Loop');
  const wt = (await page.evaluate(() => window.hmThings?.() ?? []))[0];
  if (wt) {
    await page.evaluate((t) => { window.hmPinView = { eye: [t.x + 5, t.y + 5, t.z + 5], target: [t.x + 1, t.y, t.z + 1] }; }, wt);
    await page.waitForTimeout(T(400));
    const scr = await page.evaluate((t) => { const g = (x, z) => window.hmGround?.heightAt?.(x, z) ?? t.y; return [window.hmProject?.(t.x, t.y + 0.05, t.z), window.hmProject?.(t.x + 2, g(t.x + 2, t.z), t.z), window.hmProject?.(t.x + 2, g(t.x + 2, t.z + 2), t.z + 2)]; }, wt);
    for (const p of [scr[0], scr[1], scr[2], scr[2]]) if (p) await clickWorld(p[0], p[1]);
    // it waits a moment at each point (Wait at Stop): watch for a few seconds and keep the farthest it got
    let wk = null, far = 0;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(T(400)); wk = await page.evaluate(() => window.hmWalks?.()); far = Math.max(far, wk?.moved ?? 0); }
    check('Walk Path Creator: the barrel walks its path by itself', wk?.count === 1 && far > 0.3, JSON.stringify(wk) + ' ' + await note());
    if (wk?.count === 1) await key('Control+z');
    check('and Ctrl+Z stops it', (await page.evaluate(() => window.hmWalks?.()))?.count === 0);
    await page.evaluate(() => { window.hmPinView = null; });
  }
  // Color Spray (Game F2) and Clay Scoop (Game F3): the barrel's blocks under the pointer; each is one undo step
  const bt = (await page.evaluate(() => window.hmThings?.() ?? []))[0];
  if (bt) {
    await mode('game');
    await page.evaluate((t) => { window.hmPinView = { eye: [t.x + 3, t.y + 2.5, t.z + 3], target: [t.x, t.y + 0.5, t.z] }; }, bt);
    await page.waitForTimeout(T(400));
    const mid = await page.evaluate((t) => window.hmProject?.(t.x, t.y + 0.5, t.z), bt);
    await key('F2');
    await slot('Rainbow Spray');
    const e0 = (await page.evaluate(() => window.hmBlocks?.()))?.edits ?? 0;
    if (mid) await clickWorld(mid[0], mid[1]);
    check('Rainbow Spray paints the part of the barrel you click', (await page.evaluate(() => window.hmBlocks?.()))?.edits === e0 + 1, await note());
    await slot('Water Sponge');
    if (mid) await clickWorld(mid[0], mid[1]);
    check('the Water Sponge wipes it back to the colours it was made with', (await page.evaluate(() => window.hmBlocks?.()))?.edits === e0 + 2, await note());
    await key('Control+z'); await key('Control+z');
    await key('F3');
    await slot('Clay Scoop');
    if (mid) await clickWorld(mid[0], mid[1]);
    check('Clay Scoop takes a bite out of the barrel', (await page.evaluate(() => window.hmBlocks?.()))?.edits === e0 + 3, JSON.stringify(await page.evaluate(() => window.hmBlocks?.())) + ' ' + await note());
    await shot('carve');
    await key('Control+z');
    await page.evaluate(() => { window.hmPinView = null; });
  }
  // the barrel again in Layers: its eye hides it, the bin removes it
  if (await page.locator('.fwin[aria-label="Layers"]').count() === 0) await key('l');
  await dom(() => { const rows = document.querySelectorAll('.layers .ly-list[aria-label="Things"] .ly-row'); const last = rows[rows.length - 1]; if (last && !last.classList.contains('on')) last.querySelector('.ly-name')?.click(); });
  await page.waitForTimeout(T(300));
  await dom(() => { document.querySelector('.layers .ly-row.on button[aria-label^="Hide"]')?.click(); });
  await page.waitForTimeout(T(200));
  check('its eye hides it', await page.locator('.layers .ly-row.hidden').count() === 1);
  await dom(() => { document.querySelector('.layers .ly-row.on button[aria-label^="Remove"]')?.click(); });
  await page.waitForTimeout(T(300));
  check('and the bin removes it again', await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count() === things);
  // a group (Simplified F1, Box Drag): two barrels boxed together move together with the gizmo, as one undo step
  await mode('simplified');
  await key('F1');
  // the new things go where the pointer is: a few metres ahead, so the gizmo's arrows stay on the screen
  await page.mouse.move(640, 360); await page.waitForTimeout(T(200));
  for (let i = 0; i < 2; i++) {
    await dom(() => { [...document.querySelectorAll('.layers .ly-head button')].find((b) => /Add/.test(b.textContent ?? ''))?.click(); });
    await page.waitForTimeout(T(200));
    await dom(() => { [...document.querySelectorAll('.layers .ly-add button')].find((b) => /Barrel/.test(b.textContent ?? ''))?.click(); });
    await page.waitForTimeout(T(400));
  }
  // look at the barrels from a few metres away (the studio camera may be right on top of them)
  const t0 = (await page.evaluate(() => window.hmThings?.() ?? []))[0];
  if (t0) await page.evaluate((t) => { window.hmPinView = { eye: [t.x + 5, t.y + 4, t.z + 5], target: [t.x, t.y + 0.5, t.z] }; }, t0);
  await page.waitForTimeout(T(400));
  await slot('Box Drag'); await chip('Touch Any Part');
  const twoAt = await page.evaluate(() => (window.hmThings?.() ?? []).map((t) => window.hmProject?.(t.x, t.y + 0.3, t.z)));
  const xs = twoAt.map((p) => p?.[0] ?? 640), ys = twoAt.map((p) => p?.[1] ?? 400);
  await page.mouse.move(Math.min(...xs) - 60, Math.min(...ys) - 60); await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 60, Math.max(...ys) + 60, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(T(400));
  const gg = await page.evaluate(() => window.hmGizmo?.());
  check('Box Drag picks both barrels and the gizmo stands on the group', gg?.count === 2, JSON.stringify(gg?.group) + ' ' + await note());
  if (gg && gg.count === 2) {
    const before2 = await page.evaluate(() => window.hmThings?.());
    // drag whichever arrow sits in a clear part of the screen (where the arrows point depends on the camera)
    const clear = (p) => p[0] > 430 && p[0] < 870 && p[1] > 170 && p[1] < 430;
    const axis = ['x', 'z', 'y'].find((k) => clear(gg.arrows[k][0]) && clear(gg.arrows[k][1])) ?? 'x';
    const [from2, to2] = gg.arrows[axis];
    await page.mouse.move(from2[0], from2[1]); await page.waitForTimeout(T(300));
    const hot2 = await page.evaluate(() => { const g = window.hmGizmo?.(); return { hot: g?.hot ?? null, count: g?.count ?? 0, cam: window.hmCamera?.() }; });
    await page.mouse.down(); await page.waitForTimeout(T(100));
    await page.mouse.move(to2[0], to2[1], { steps: 6 }); await page.waitForTimeout(T(200));
    await page.mouse.up(); await page.waitForTimeout(T(300));
    const after2 = await page.evaluate(() => window.hmThings?.());
    const d = after2.map((t, i) => t[axis] - before2[i][axis]);
    check('dragging the arrow moves the whole group the same way', d.length === 2 && d[0] > 0.1 && Math.abs(d[0] - d[1]) < 1e-6, axis + ' ' + JSON.stringify(d) + ' ' + JSON.stringify(hot2) + ' ' + JSON.stringify(gg.arrows));
    await key('Control+z');
  }
  await key('Escape');
  for (let i = 0; i < 2; i++) await key('Control+z');
  await page.evaluate(() => { window.hmPinView = null; });
  check('and undo takes the move and both barrels back', (await page.evaluate(() => window.hmGround?.things?.())) === things);
  await mode('game');
  await key('b');
  // Esc closes the windows one at a time (Layers, what you hold), and only then the menu
  const wins = await page.locator('.fwin').count();
  for (let i = 0; i < wins; i++) await key('Escape');
  check('Esc closes the windows one at a time', await page.locator('.fwin').count() === 0 && await page.locator('.island-menu').count() === 0, `${wins} windows`);
  await page.keyboard.press('1');
  await page.waitForTimeout(T(300));
  await page.keyboard.press('b');
  await page.waitForTimeout(T(800));
  check('B switches to studio mode', /Studio/.test(await page.locator('.mode-bar .seg button.on').first().textContent() ?? ''));
  check('studio opens the settings of what you hold', await page.locator('.fwin').count() >= 1);
  check('in studio the Walk/Studio toggles sit on top of the open hierarchy bar (S3)', await page.evaluate(() => { const b = document.querySelector('.mode-bar button'); if (!b) return false; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && !!top.closest('.mode-bar'); }));
  await page.keyboard.press('F10');
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
  await dom(() => { [...document.querySelectorAll('.gr-front .shell-menu button')].find((b) => b.textContent === 'Race modes')?.click(); });
  await page.waitForSelector('.shell-racing');
  await dom(() => { [...document.querySelectorAll('.shell-racing-nav button')].find((b) => b.textContent === 'Track editor')?.click(); });
  await dom(() => { [...document.querySelectorAll('.shell-racing-main button')].find((b) => b.textContent === 'Open the track editor')?.click(); });
  await page.waitForSelector('.maker', { timeout: T(30000) });
  check('the race track editor opens from the Goblin Racing menu', true);
  check('on the Goblin Racing island', /Goblin Racing island/.test(await page.locator('.maker .crumbs').textContent() ?? ''));
  for (let i = 0; i < 3 && await page.locator('.island-menu').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(400)); }
  check('Esc opens the menu in the track editor', await page.locator('.maker .island-menu').count() === 1);
  await dom(() => { [...document.querySelectorAll('.maker .island-menu button')].find((b) => b.textContent === 'Back to Goblin Racing')?.click(); });
  await page.waitForSelector('.shell-racing', { timeout: T(30000) });
  check('Back to Goblin Racing returns to its race modes', true);
  for (let i = 0; i < 4 && await page.locator('.sm-home').count() === 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(900)); }
  check('Esc steps back out to the SetMix home', await page.locator('.sm-home').count() === 1);
  // the saves (RELEASE_PLAN Milestone 0.5): islands live in IndexedDB, and nothing big is left in localStorage
  const saved = await page.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('hm-store');
    r.onsuccess = () => { const q = r.result.transaction('kv', 'readonly').objectStore('kv').getAllKeys(); q.onsuccess = () => { r.result.close(); ok({ idb: q.result.map(String), ls: Object.keys(localStorage).filter((k) => k.startsWith('hm.island')) }); }; q.onerror = () => ok({ idb: [], ls: [] }); };
    r.onerror = () => ok({ idb: [], ls: [] });
  }));
  check('island saves are in IndexedDB, none in localStorage', saved.idb.some((k) => k.startsWith('hm.island.')) && saved.idb.includes('hm.islands.v1') && saved.ls.length === 0, JSON.stringify(saved));

  // the first Play runs last: your human made in the lab is your first avatar, and the island tour above needs a new player
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('.sm-home', { timeout: T(30000) });
  await page.waitForFunction(() => window.hmLab && window.hmLab.ready && window.hmLab.frames > 5, null, { timeout: T(60000) });

  // Play: the first Play (STATUS SM22). Your human is made in the lab; the main lever turns the gate on; you walk through onto
  // the stage-0 planet, where sync runs down; you walk back; the first texture mill lifts the plot to stage 1; Esc pauses
  const playErrors = errors.length;
  await text('.sm-menu button', 'Play').click();
  await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready && window.hmPlay.frames > 5, null, { timeout: T(90000) });
  check('Play opens the lab and asks who you are, in the lab', await page.locator('.play-create .create-goblin.in-lab').count() === 1);
  check('the scientist is the only default in the lab', await page.locator('.play-create .create-scientist').count() === 1 && await page.locator('.play-create .cg-looks').count() === 0);
  check('the import option is there', await page.locator('.play-create .custom-dropzone button').count() >= 1);
  await page.waitForFunction(() => window.hmCreator && typeof window.hmCreator.getBonePosition === 'function', null, { timeout: T(20000) });
  const bonePos0 = await page.evaluate(() => window.hmCreator.getBonePosition('mixamorigSpine'));
  await page.waitForTimeout(T(400));
  const bonePos1 = await page.evaluate(() => window.hmCreator.getBonePosition('mixamorigSpine'));
  const boneMoved = bonePos0 && bonePos1 && (Math.abs(bonePos0.y - bonePos1.y) > 1e-5 || Math.abs(bonePos0.z - bonePos1.z) > 1e-5 || Math.abs(bonePos0.x - bonePos1.x) > 1e-5);
  check('in the creator, a bone of the scientist moves between two frames', boneMoved, `pos0: ${JSON.stringify(bonePos0)}, pos1: ${JSON.stringify(bonePos1)}`);
  await shot('creator-scientist');
  await dom(() => { [...document.querySelectorAll('.play-create .visor-chip')][1]?.click(); });
  await page.fill('.play-create .cg-name input', 'Ada');
  await dom(() => { [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click(); });
  await page.waitForFunction(() => window.hmPlay.state().step === 'power', null, { timeout: T(10000) });
  check('Done leads into the lab', await page.locator('.play-create').count() === 0);
  check('made: next, turn on the gate', /Turn on the gate/.test(await page.locator('.play-goal h2').innerText()));
  await dom(() => window.hmPlay.pull());
  await page.waitForTimeout(T(200));
  check('the lever plays the lever clip', await dom(() => window.hmPlay.currentOneShot() === 'lever' || window.hmPlay.clipWeight('pulling-lever') > 0));
  await page.waitForFunction(() => window.hmPlay.state().gateOn, null, { timeout: T(30000) });
  check('the main lever turns the gate on', /Step through the gate/.test(await page.locator('.play-goal h2').innerText()));
  await shot('play-gate-on');

  // V key switches between first and third person; while walking, walk clip weight > 0.5
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(T(300));
  check('V gives third person', await dom(() => window.hmPlay.view() === 'third'));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(T(500));
  const walkWeight = await dom(() => window.hmPlay.clipWeight('walking'));
  await page.keyboard.up('KeyW');
  check('while walking, walk clip weight is above 0.5', walkWeight > 0.5, `walk weight: ${walkWeight}`);
  // walk through the gate: stand in front of it in the lab, facing it, and walk
  const walk = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await dom(() => window.hmPlay.go('lab', 3.2, -6.9, 0));
  await walk('KeyW', T(1400));
  await page.waitForFunction(() => window.hmPlay.where === 'planet', null, { timeout: T(8000) });
  check('walking through the gate takes you onto your plot', true);
  await page.waitForTimeout(T(2500));
  check('sync runs down on the planet', await dom(() => window.hmPlay.sync < 0.99) && await page.locator('.play-sync li').count() === 20);
  await shot('play-stage-0');
  await walk('KeyS', T(1700));
  await page.waitForFunction(() => window.hmPlay.where === 'lab', null, { timeout: T(8000) });
  check('walking back through the gate takes you home; next, build', await dom(() => window.hmPlay.state().step === 'build'));
  await dom(() => window.hmPlay.go('lab', 3.2, -6.9, 0));
  await walk('KeyW', T(1400));
  await page.waitForFunction(() => window.hmPlay.where === 'planet', null, { timeout: T(8000) });
  check('a mill too far from the gate is refused', await dom(() => { const g = window.hmPlay.gate(); return !window.hmPlay.placeAt(g.x + 60, g.z); }));
  check('the first mill stands near the gate', await dom(() => { const g = window.hmPlay.gate(); return window.hmPlay.placeAt(g.x + 7, g.z + 5); }));
  check('the first machine lifts the plot to stage 1', await dom(() => window.hmPlay.state().step === 'done' && window.hmPlay.plot().stage === 1));
  // the plot's game loop (STATUS SM30): a drill mines ore, a press needs stage 1, the build menu lists every machine
  check('a rock drill stands on the plot and mines ore', await dom(() => { const g = window.hmPlay.gate(); return window.hmPlay.placeAt(g.x - 8, g.z + 6, 'drill'); }));
  const oreBefore = await dom(() => window.hmPlay.plot().ore);
  await page.waitForTimeout(T(3000));
  check('ore rises while the drill runs', await dom(() => window.hmPlay.plot().ore) > oreBefore, String(oreBefore));
  check('the shape press is unlocked at stage 1 and runs', await dom(() => { window.hmPlay.give(100); const g = window.hmPlay.gate(); return window.hmPlay.placeAt(g.x + 12, g.z - 4, 'press'); }));
  await page.waitForTimeout(T(1500));
  check('both pixel machines pour their pixels', await dom(() => window.hmPlay.machines().pouring === 2 && window.hmPlay.machines().standing === 3));
  await page.keyboard.press('KeyB');
  check('the build menu lists the seven machines, the later ones locked', await dom(() => document.querySelectorAll('.play-card').length === 7 && document.querySelectorAll('.play-card.shut').length === 2));
  await page.keyboard.press('KeyB');
  check('the plot HUD shows ore, power and the four levels', await dom(() => /ore/.test(document.querySelector('.play-ore')?.textContent ?? '') && document.querySelectorAll('.play-levels li').length === 4));

  // the lab makes cartridges, the plot's machines take them (TASK-04, POL-10)
  const panelButton = (label) => dom((l) => { [...document.querySelectorAll('.play-machine button')].find((b) => b.textContent === l)?.click(); }, label);
  // 1. rack: make a blank
  await dom(() => window.hmPlay.go('lab', -7.5, -5.5, Math.PI / 2, -0.1));
  await page.waitForTimeout(T(300));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine[aria-label="Cartridge Rack"]', { timeout: T(5000) });
  check('E on the rack opens the Cartridge Rack panel', await page.locator('.play-machine[aria-label="Cartridge Rack"]').count() === 1);
  await shot('play-cart-rack');
  const blankOreBefore = await dom(() => window.hmPlay.plot().ore);
  await dom(() => { [...document.querySelectorAll('.play-machine button')].find((b) => /Make a blank/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(200));
  check('make a blank adds a blank to the rack and uses 12 ore', (await dom(() => window.hmPlay.lab().cartridges.length === 1 && window.hmPlay.lab().cartridges[0].kind === 'blank')) && Math.abs((await dom(() => window.hmPlay.plot().ore)) - (blankOreBefore - 12)) < 1.0);
  await panelButton('Back to the lab');
  await page.waitForTimeout(T(200));

  // 2. bench: write a preset onto the blank
  await dom(() => window.hmPlay.go('lab', 7.5, -3.4, -Math.PI / 2, -0.1));
  await page.waitForTimeout(T(300));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine[aria-label="Preset Bench"]', { timeout: T(5000) });
  check('E on the bench opens the Preset Bench panel', await page.locator('.play-machine[aria-label="Preset Bench"]').count() === 1);
  await shot('play-cart-bench');
  await dom(() => { [...document.querySelectorAll('.play-select-grid button')].find((b) => /Crater Calcite/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(200));
  await dom(() => { [...document.querySelectorAll('.play-machine button')].find((b) => b.textContent === 'Start writing')?.click(); });
  await page.waitForTimeout(T(200));
  check('writing starts on the bench', await dom(() => window.hmPlay.lab().bench !== null));
  await panelButton('Back to the lab');
  await page.waitForTimeout(T(200));
  await shot('play-bench-pour');
  await dom(() => window.hmPlay.labStep(25));
  check('fast-forward finishes the write, cartridge is written', await dom(() => { const c = window.hmPlay.lab().cartridges[0]; return c && c.kind === 'preset' && c.preset === 'crater_calcite'; }));

  // 3. combiner panel
  await dom(() => window.hmPlay.go('lab', 7.5, -0.6, -Math.PI / 2, -0.1));
  await page.waitForTimeout(T(300));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine[aria-label="Preset Combiner"]', { timeout: T(5000) });
  check('E on the combiner opens the Preset Combiner panel', await page.locator('.play-machine[aria-label="Preset Combiner"]').count() === 1);
  await shot('play-cart-combiner');
  await panelButton('Back to the lab');
  await page.waitForTimeout(T(200));

  // 4. slot into the mill on the planet
  const pxdBefore = await dom(() => window.hmPlay.rates().points.pxd);
  await dom(() => { const g = window.hmPlay.gate(); window.hmPlay.go('planet', g.x + 7, g.z + 7.5, 0, -0.15); });
  await page.waitForTimeout(T(500));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine', { timeout: T(5000) });
  check('E on the mill opens its panel', await dom(() => document.querySelector('.play-machine h3')?.textContent === 'Texture mill'));
  await dom(() => document.querySelector('.play-carts button')?.click());
  check('the written cartridge slots into the mill', await dom(() => !!window.hmPlay.plot().machines.find((m) => m.kind === 'mill')?.cartridge));
  await panelButton('Back to the plot');
  await page.waitForTimeout(T(200));
  const pxdAfter = await dom(() => window.hmPlay.rates().points.pxd);
  check('the mill metric rate changes by the cartridge affinity', pxdAfter > pxdBefore, `${pxdBefore} -> ${pxdAfter}`);

  // unslot from mill so the shape press can test slotting it
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine', { timeout: T(5000) });
  await dom(() => document.querySelector('.play-carts button')?.click());
  check('the cartridge unslots back to the rack', await dom(() => !window.hmPlay.plot().machines.find((m) => m.kind === 'mill')?.cartridge));
  await panelButton('Back to the plot');
  await page.waitForTimeout(T(200));

  // the machine panel (E on a machine you look at): switch it off and on, put a cartridge from the rack in
  await dom(() => { const g = window.hmPlay.gate(); window.hmPlay.go('planet', g.x + 12, g.z - 0.5, 0, -0.15); });
  await page.waitForTimeout(T(500));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.play-machine', { timeout: T(5000) }).catch(() => null);
  check('E on a machine opens its panel', await dom(() => document.querySelector('.play-machine h3')?.textContent === 'Shape press'));
  const pressOn = () => dom(() => window.hmPlay.plot().machines.find((m) => m.kind === 'press')?.on);
  await panelButton('Switch off');
  const wasOff = await pressOn();
  await panelButton('Switch on');
  check('the panel switches the machine off and on', wasOff === false && await pressOn() === true, String(wasOff));
  await dom(() => document.querySelector('.play-carts button')?.click());
  check('a cartridge from the rack goes in', await dom(() => !!window.hmPlay.plot().machines.find((m) => m.kind === 'press')?.cartridge));
  await panelButton('Back to the plot');
  await page.waitForTimeout(T(200));
  check('Back to the plot closes the panel', await page.locator('.play-machine').count() === 0);
  await page.waitForFunction(() => window.hmPlay.wave > 1e6, null, { timeout: T(40000) });
  check('the wave crosses the plot', true);
  // the display governor may have changed the tier by now: the stage's look stays, the plume follows the tier
  const detail = await dom(() => ({ ...window.hmPlay.detail(), tier: window.hmPlay.tier, pouring: window.hmPlay.machines().pouring }));
  check('stage 1 is drawn about 240 lines tall, whatever the tier', detail.planet[1] >= 200 && detail.planet[1] <= 280, JSON.stringify(detail));
  const tierWay = detail.tier === 'potato' ? 'dither' : 'cubes';
  check('the plume is drawn the way the tier asks, with as many pixels as it asks', detail.plumes === tierWay && detail.pixels === detail.pouring * Math.floor(220 * detail.plumeDensity + 1e-6), JSON.stringify(detail));
  await shot('play-stage-1');
  // teleport back into the lab with the gate on, standing ~2 m away from the planet table looking at it (-z)
  await dom(() => window.hmPlay.go('lab', -3.6, -3.0, 0, -0.32));
  await page.waitForTimeout(T(300));
  check('the planet table hologram is visible and tracks the machines', await dom(() => { const h = window.hmPlay.holo(); return h.visible && h.machines === 3; }));
  await shot('play-holo-table');

  // ---- task 06: plot codes and visiting plots
  await dom(() => window.hmPlay.go('lab', 0, -1.8, 0, -0.2));
  await page.waitForTimeout(T(200));
  const myCode = await dom(() => window.hmPlay.plotCode());
  check('your plot produces a valid plot code', typeof myCode === 'string' && myCode.length > 20, String(myCode));
  await dom(() => window.hmPlay.openDial());
  await page.waitForSelector('.play-dial-panel', { timeout: T(5000) });
  await shot('play-dial');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(200));

  check('damaged code is refused by dial', await dom(() => !window.hmPlay.dial('damaged-code-xyz')));
  check('your code dials your own plot back', await dom((c) => window.hmPlay.dial(c), myCode));
  check('visiting returns player name', await dom(() => window.hmPlay.visiting() === window.hmPlay.state().avatar.name));
  check('visiting plot has same number of machines', await dom(() => window.hmPlay.machines().standing === 3));

  await dom(() => { const g = window.hmPlay.gate(); window.hmPlay.go('planet', g.x + 3, g.z + 5, 0); });
  await page.waitForFunction(() => window.hmPlay.where === 'planet', null, { timeout: T(8000) });
  await page.waitForTimeout(T(200));
  await shot('play-visiting');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(T(200));
  await shot('play-third-person-walking');
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyB');
  await page.waitForTimeout(T(200));
  check('build menu is refused while visiting', await page.locator('.play-build').count() === 0);

  await dom(() => window.hmPlay.go('lab', 0, -2.5, 0));
  await page.waitForFunction(() => window.hmPlay.where === 'lab', null, { timeout: T(8000) });
  await page.waitForTimeout(T(200));
  check('walking back ends the visit', await dom(() => window.hmPlay.visiting() === null));

  await page.keyboard.press('Escape');
  await page.waitForSelector('.play-pause', { timeout: T(5000) });
  await dom(() => { [...document.querySelectorAll('.play-pause button')].find((b) => b.textContent === 'Back to SetMix')?.click(); });
  await page.waitForSelector('.sm-home', { timeout: T(15000) });
  check('Esc pauses and Back to SetMix goes home', await dom(() => !window.hmPlay));

  // TASK-09 Profile lifecycle: fresh start, save isolation, deletion
  const mainPlaySave = await page.evaluate(() => localStorage.getItem('hm.setmix.play'));
  check('Main has play save with stage >= 1', typeof mainPlaySave === 'string' && JSON.parse(mainPlaySave).plot?.stage >= 1);

  // 1. Create a profile "E2E fresh" and switch to it: Play starts at the scientist creator (a fresh start).
  await page.locator('.sm-profile-chip').click();
  await page.waitForSelector('.sm-profile-menu', { timeout: T(5000) });
  await dom(() => { [...document.querySelectorAll('.sm-profile-item')].find((b) => b.textContent.includes('New profile...'))?.click(); });
  await page.waitForSelector('.sm-profile-new-input', { timeout: T(5000) });
  await page.fill('.sm-profile-new-input', 'E2E fresh');
  await page.evaluate(() => { window.__beforeReload = true; });
  await dom(() => { [...document.querySelectorAll('.sm-profile-create-btns button')].find((b) => b.textContent.includes('Create'))?.click(); });
  await page.waitForFunction(() => !window.__beforeReload && document.querySelector('.sm-profile-label')?.textContent?.trim() === 'E2E fresh' && window.hmLab && window.hmLab.ready, null, { timeout: T(30000) });
  check('switched to fresh profile E2E fresh', (await page.locator('.sm-profile-label').innerText()).trim() === 'E2E fresh');

  // Verify Play starts fresh at scientist creator
  await text('.sm-menu button', 'Play').click();
  await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready && window.hmPlay.frames > 5, null, { timeout: T(90000) });
  check('E2E fresh profile starts fresh at scientist creator', await page.locator('.play-create .create-scientist').count() === 1);

  // 2. Make an avatar, then switch back to Main: Main's Play save is exactly as before.
  await page.fill('.play-create .cg-name input', 'Fresh Scientist');
  await dom(() => { [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click(); });
  await page.waitForFunction(() => window.hmPlay.state().avatar?.name === 'Fresh Scientist', null, { timeout: T(10000) });
  check('avatar created on fresh profile', await dom(() => window.hmPlay.state().avatar?.name === 'Fresh Scientist'));

  await page.keyboard.press('Escape');
  await page.waitForSelector('.play-pause', { timeout: T(5000) });
  await dom(() => { [...document.querySelectorAll('.play-pause button')].find((b) => b.textContent === 'Back to SetMix')?.click(); });
  await page.waitForSelector('.sm-home', { timeout: T(15000) });

  // Switch back to Main
  await page.locator('.sm-profile-chip').click();
  await page.waitForSelector('.sm-profile-menu', { timeout: T(5000) });
  await page.evaluate(() => { window.__beforeReload = true; });
  await dom(() => { [...document.querySelectorAll('.sm-profile-item')].find((b) => b.querySelector('.sm-profile-item-name')?.textContent?.trim() === 'Main')?.click(); });
  await page.waitForFunction(() => !window.__beforeReload && document.querySelector('.sm-profile-label')?.textContent?.trim() === 'Main' && window.hmLab && window.hmLab.ready, null, { timeout: T(30000) });
  check('switched back to Main profile', (await page.locator('.sm-profile-label').innerText()).trim() === 'Main');

  // Verify Main's Play save is intact
  const mainPlayAfter = await page.evaluate(() => localStorage.getItem('hm.setmix.play'));
  check('Main Play save is exactly as before', mainPlayAfter === mainPlaySave);
  await text('.sm-menu button', 'Play').click();
  await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready && window.hmPlay.frames > 5, null, { timeout: T(90000) });
  check('Main Play has saved avatar Ada (no creator shown)', await page.locator('.play-create').count() === 0 && await dom(() => window.hmPlay.state().avatar?.name === 'Ada'));
  check('Main Play plot stage is still >= 1', await dom(() => window.hmPlay.plot().stage >= 1));
  await page.keyboard.press('Escape');
  await page.waitForSelector('.play-pause', { timeout: T(5000) });
  await dom(() => { [...document.querySelectorAll('.play-pause button')].find((b) => b.textContent === 'Back to SetMix')?.click(); });
  await page.waitForSelector('.sm-home', { timeout: T(15000) });

  // 3. Delete "E2E fresh": no hm.p.<id>. key is left, and its database is gone.
  await page.locator('.sm-profile-chip').click();
  await page.waitForSelector('.sm-profile-menu', { timeout: T(5000) });
  await dom(() => { [...document.querySelectorAll('.sm-profile-item')].find((b) => b.textContent.includes('Manage profiles'))?.click(); });
  await page.waitForSelector('.profile-manager-window', { timeout: T(5000) });
  await dom(() => {
    const row = [...document.querySelectorAll('.profile-row')].find((r) => r.querySelector('.profile-name')?.textContent?.includes('E2E fresh'));
    row?.querySelector('.delete-profile-btn')?.click();
  });
  await page.waitForSelector('.profile-delete-confirm', { timeout: T(5000) });
  check('delete confirmation asks plainly with profile name', /Delete profile 'E2E fresh'\? Its Play save/.test(await page.locator('.confirm-text').innerText()));
  await shot('profile-delete-confirm');
  await page.locator('.delete-confirm-btn').click();
  await page.waitForSelector('.profile-delete-confirm', { state: 'detached', timeout: T(5000) });
  await page.locator('[aria-label="Manage profiles"] button[aria-label="Close"]').click();
  await page.waitForSelector('[aria-label="Manage profiles"]', { state: 'detached', timeout: T(5000) });

  const leftoverKeys = await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hm.p.')) keys.push(k);
    }
    return keys;
  });
  check('no hm.p.<id>. keys left in localStorage after deleting E2E fresh', leftoverKeys.length === 0, leftoverKeys.join(', '));

  check('the first Play raised no page error', errors.length === playErrors, errors.slice(playErrors).join(' | '));
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
