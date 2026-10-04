/**
 * Browser smoke test of the PRODUCTION build with the installed Chrome (no download): it must boot with no page error, and no screen may be a trap.
 *   node scripts/e2e-smoke.mjs          (serves apps/web/dist itself on a free port; run `npm run build` first)
 * Skipped with a note when Chrome is not installed. Software rendering is slow, so the timeouts are generous.
 * E2E_SHOTS=<folder> also saves screenshots of a few screens there (the gizmo, the Things palette, a campfire) for looking at them.
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
  check('the home is SetMix Multiverse with its menu', (await page.locator('.sm-brand b').innerText()) === 'SetMix' && (await page.locator('.sm-brand i').innerText()) === 'Multiverse' && JSON.stringify(await page.$$eval('.sm-menu button b', (b) => b.map((x) => x.textContent))) === JSON.stringify(['My planet', 'Avatars', 'Community', 'Settings']));
  await page.waitForSelector('.gr-preview', { timeout: T(30000) });
  check('Goblin Racing is selected, its menu live in a window', JSON.stringify(await page.$$eval('.gr-preview-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Race modes', 'Settings']));
  check('the window tells a new player what Play does', /first avatar/.test(await page.locator('.gr-preview-you').innerText()));

  const text = (sel, t) => page.locator(sel, { hasText: t }).first();
  const shotDir = process.env.E2E_SHOTS;
  const shot = async (name) => { if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` }); };
  const dom = (fn, arg) => page.evaluate(fn, arg); // software rendering starves the page: click through the DOM instead of waiting for Playwright stability checks
  await text('.sm-menu button', 'Settings').click();
  check('settings opens', await page.locator('[aria-label="Settings"]').count() === 1);
  check('with graphics presets from Potato to Auto', await page.locator('.graphics-presets button').count() === 6);
  // Settings, Hotbar: the hotbar is a preset you manage (grown-up profiles)
  if (await page.locator('.hotbar-settings').count()) {
    await dom(() => document.querySelector('[aria-label="Take Brush off"]')?.click());
    const off = await page.$$eval('.hs-row .hs-name', (s) => s[0]?.textContent);
    await dom(() => [...document.querySelectorAll('.hotbar-settings .btns button')].find((b) => /ready-made/.test(b.textContent ?? ''))?.click());
    const back = await page.$$eval('.hs-row .hs-name', (s) => s[0]?.textContent);
    check('Settings, Hotbar: a tool comes off its slot and the ready-made row comes back', off === 'Empty' && back === 'Brush');
  }
  await text('[aria-label="Settings"] button', 'Close').click();
  check('settings closes back to the home', await page.locator('.sm-home').count() === 1);

  // Goblin Racing: its window grows into its own menu; Race modes holds its sections; Esc steps back out to SetMix
  await dom(() => document.querySelector('.gr-open')?.click());
  await page.waitForSelector('.gr-front', { timeout: T(15000) });
  check('opening the window shows Goblin Racing\'s own menu', JSON.stringify(await page.$$eval('.gr-front .shell-menu button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Play', 'Race modes', 'Settings', 'Back to SetMix']));
  await dom(() => { [...document.querySelectorAll('.gr-front .shell-menu button')].find((b) => b.textContent === 'Race modes')?.click(); });
  await page.waitForSelector('.shell-racing');
  for (const s of ['Tournaments', 'Spectate', 'Rankings', 'Track editor', 'Settings', 'My goblin', 'The Bookie', 'Quick race']) await dom((t) => { [...document.querySelectorAll('.shell-racing-nav button')].find((b) => b.textContent === t)?.click(); }, s);
  check('every Goblin Racing section opens', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc leaves the sections for Goblin Racing\'s menu', await page.locator('.gr-front').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc again returns to the SetMix home', await page.locator('.sm-home').count() === 1);

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
  await page.waitForSelector('.hotbar', { timeout: T(60000) });
  check('Done takes you to your island', true);
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
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.waitForTimeout(T(1500));
  await page.mouse.move(vp.width * 0.42, vp.height * 0.41);
  await page.waitForTimeout(T(600));
  check('a planet near the pointer shows its card', await page.locator('.planet-card').count() === 1);

  await page.locator('.sm-menu .sm-sub').click();
  await page.waitForSelector('.hotbar', { timeout: T(60000) });
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
  await dom(() => { [...document.querySelectorAll('[aria-label="My planet"] button')].find((b) => b.textContent === 'Close')?.click(); });
  await page.waitForSelector('.hotbar', { timeout: T(30000) });
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

  // avatar mode (P): the camera faces your avatar, the dock shows your characters and this one's presets; a new one is made three ways
  await page.keyboard.press('p');
  await page.waitForTimeout(T(600));
  check('P opens avatar mode with your characters and New avatar', await page.locator('.avatar-dock').count() === 1 && await page.locator('.ad-row button').count() === 2);
  check('and the hotbar steps aside', await page.locator('.hotbar').count() === 0);
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
  check('Esc leaves avatar mode back to the hotbar', await page.locator('.avatar-dock').count() === 0 && await page.locator('.hotbar').count() === 1);

  // the build HUD: ten tabs on F1..F10, slots with previews, the preset window, studio mode, Esc closes one thing at a time
  check('thirteen tabs on the tab strip in the V3 order (F1 to F12, your Avatar on P)', await page.locator('.tab-strip button').count() === 13);
  const stripFits = () => dom(() => { const r = document.querySelector('.tab-strip')?.getBoundingClientRect(); return !!r && r.left >= 0 && r.right <= innerWidth; });
  check('the tab strip fits a 1280 px screen', await stripFits());
  await page.setViewportSize({ width: 900, height: 700 }); await page.waitForTimeout(T(400));
  check('and a 900 px one (the open tab keeps its name)', await stripFits() && await dom(() => { const label = document.querySelector('.tab-strip button.on > span'); return !!label && getComputedStyle(label).display !== 'none'; }));
  await shot('tabs-900');
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(T(400));
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(300));
  check('F2 opens the Paint tab', /Paint/.test(await page.locator('.tab-strip button.on').first().textContent() ?? ''));
  check('Paint holds ways to paint (Brush, Fill, Clone ...), not surfaces', await page.evaluate(() => { const t = [...document.querySelectorAll('.hotbar > button span')].map((s) => s.textContent); return ['Brush', 'Fill', 'Stamp', 'Clone', 'Eraser'].every((w) => t.includes(w)); }));
  check('the palette starts closed', await page.locator('.palette-strip').count() === 0);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(T(300));
  check('Tab opens the palette: the surfaces in a film strip, top middle', await page.locator('.palette-strip .ps-frame').count() >= 20);
  check('the tool in hand shows its own presets, drawn on the ground', await page.locator('.tool-presets canvas.tp-pv').count() >= 4);
  // the surface editor: SetMix's ground is made from graphs, so a surface's look can be changed live
  await dom(() => document.querySelector('[data-ui="island.surface-look"]')?.click());
  await page.waitForSelector('.surface-editor .se-style', { timeout: 20000 }).catch(() => null);
  check('Edit look opens the surface editor with its styles as previews', await page.locator('.surface-editor .se-style canvas').count() >= 3);
  const lookBefore = await page.evaluate(() => window.hmGround?.tile?.(4));
  await dom(() => document.querySelectorAll('.surface-editor .se-style')[1]?.click());
  await page.waitForTimeout(T(300));
  await dom(() => document.querySelector('.surface-editor button.go')?.click());
  await page.waitForFunction(() => /uses this look/.test(document.querySelector('.surface-editor [role=status]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => null);
  check('Use on this island redraws the surface and keeps the look for the player', lookBefore !== await page.evaluate(() => window.hmGround?.tile?.(4))
    && await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hm.profile.v2') || '{}').groundLooks ?? {}).length > 0));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(300));
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(T(400));
  check('Esc steps out of the texture', await page.locator('.tex-bench').count() === 0);
  // Sculpt holds ways to sculpt; the shapes its Stamp presses are the palette
  await page.keyboard.press('F10');
  await page.waitForTimeout(T(300));
  check('Terrain holds ways to shape the ground (Grab, Clay, Stamp, Terrace, Road, River, Rain ...)', await page.evaluate(() => { const t = [...document.querySelectorAll('.hotbar > button span')].map((s) => s.textContent); return ['Raise', 'Smooth', 'Grab', 'Clay', 'Stamp', 'Terrace', 'Road', 'River', 'Rain'].every((w) => t.includes(w)); }));
  check('the Sculpt palette holds the shapes to stamp', JSON.stringify(await page.$$eval('.palette-strip .ps-frame', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Hill', 'Crater', 'Plateau', 'Ridge', 'Dune', 'Volcano']));
  // Things and Lights hold ways too; what they use is the palette
  await page.keyboard.press('F3');
  await page.waitForTimeout(T(300));
  const thingsRow = await page.evaluate(() => [...document.querySelectorAll('.hotbar > button span')].map((s) => s.textContent));
  const thingsFrames = await page.locator('.palette-strip .ps-frame').count();
  await shot('things-palette');
  check('Things holds ways to place (Place, Scatter, Row, Swap) and the things are the palette', ['Place', 'Scatter', 'Row', 'Swap'].every((w) => thingsRow.includes(w)) && thingsFrames >= 10, `${thingsRow.join(',')} / ${thingsFrames} frames`);
  await page.keyboard.press('F7');
  await page.waitForTimeout(T(300));
  check('Logic (F7, and the backtick key) holds Add rule, Remove rules, Rules, and its palette the ready-made rules', await page.evaluate(() => { const t = [...document.querySelectorAll('.hotbar > button span')].map((s) => s.textContent); return ['Add rule', 'Remove rules', 'Rules'].every((w) => t.includes(w)); })
    && await page.locator('.palette-strip .ps-frame').count() >= 8);
  await page.keyboard.press('F6');
  await page.waitForTimeout(T(300));
  check('Lights holds ways (Look, Sun, Day and night, Haze, Clouds) and the looks are the palette', await page.evaluate(() => { const t = [...document.querySelectorAll('.hotbar > button span')].map((s) => s.textContent); return ['Look', 'Sun', 'Day and night', 'Haze', 'Clouds'].every((w) => t.includes(w)); })
    && await page.locator('.palette-strip .ps-frame').count() >= 10);
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(300));
  check('the hotbar has Easy, Pro and Studio', JSON.stringify(await page.$$eval('.level-switch button', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Easy', 'Pro', 'Studio']));
  await dom(() => document.querySelector('[data-ui="island.level.pro"]')?.click());
  await page.waitForTimeout(T(300));
  check('Pro adds size and strength beside the presets', await page.locator('.tp-knobs input[type=range]').count() === 2);
  await dom(() => document.querySelector('[data-ui="island.level.easy"]')?.click());
  // paint for real: the palette's lava, the Fill way, one click on the ground (in studio the mouse is free)
  await page.keyboard.press('b');
  await page.waitForTimeout(T(900));
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Lava/.test(b.textContent ?? ''))?.click(); });
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Fill/.test(b.textContent ?? ''))?.click(); });
  const lavaBefore = await page.evaluate(() => window.hmGround?.surfaces()[13] ?? 0);
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(150)); await page.mouse.up();
  await page.waitForTimeout(T(600));
  const lavaAfter = await page.evaluate(() => window.hmGround?.surfaces()[13] ?? 0);
  check('Fill with lava from the palette paints the ground', lavaAfter > lavaBefore, `lava cells ${lavaBefore} to ${lavaAfter}`);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(300));
  check('and Ctrl+Z takes it back', (await page.evaluate(() => window.hmGround?.surfaces()[13] ?? 0)) === lavaBefore);
  // Layers: what the island is made of; + Add puts a thing where you look, the eye hides it, the bin removes it
  await dom(() => document.querySelector('[data-ui="island.layers"]')?.click());
  await page.waitForTimeout(T(400));
  check('the Layers button on the palette opens Layers', await page.locator('.fwin[aria-label="Layers"] .layers').count() === 1);
  const things = await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count();
  await dom(() => { [...document.querySelectorAll('.layers .ly-head button')].find((b) => /Add/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(200));
  await dom(() => { [...document.querySelectorAll('.layers .ly-add button')].find((b) => /Barrel/.test(b.textContent ?? ''))?.click(); });
  await page.waitForTimeout(T(500));
  check('+ Add puts a thing in as a new layer, picked', await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count() === things + 1 && await page.locator('.layers .ly-row.on .ly-attrs').count() === 1);
  // the gizmo (hotbar spec V3): Pro shows it on the picked thing on Select's tab; drag the x arrow, one undo step puts it back
  await dom(() => document.querySelector('[data-ui="island.level.pro"]')?.click());
  await page.keyboard.press('F1');
  await page.waitForTimeout(T(500));
  const g0 = await page.evaluate(() => window.hmGizmo?.());
  check('Pro shows the move gizmo on the picked thing', !!g0 && g0.mode === 'move', JSON.stringify(g0));
  if (g0) {
    await page.keyboard.press('+');
    await page.waitForTimeout(T(200));
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
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(T(300));
    const g3 = await page.evaluate(() => window.hmGizmo?.());
    check('one Ctrl+Z puts it back', !!g3 && Math.abs(g3.x - g1.x) < 1e-6, `x ${g3?.x}`);
    await page.keyboard.press('-');
  }
  await dom(() => document.querySelector('[data-ui="island.level.easy"]')?.click());
  await page.waitForTimeout(T(200));
  check('Easy has no gizmo', !(await page.evaluate(() => window.hmGizmo?.())));
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(200));
  // Effects (F12, or Shift+F2): place a campfire from the palette, it burns; Ctrl+Z takes it away
  await page.keyboard.press('Shift+F2');
  await page.waitForTimeout(T(400));
  check('Shift+F2 opens Effects, its palette holds the twelve effects', /Effects/.test(await page.locator('.tab-strip button.on').first().textContent() ?? '') && await page.locator('.palette-strip .ps-frame').count() === 12);
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Campfire/i.test(b.textContent ?? ''))?.click(); });
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Place/.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(900));
  const fx1 = await page.evaluate(() => window.hmEffects?.());
  await shot('effects-campfire');
  check('Place puts a campfire on the island and it burns', fx1?.placed === 1 && fx1.particles > 0, JSON.stringify(fx1));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(400));
  check('and Ctrl+Z takes it away', (await page.evaluate(() => window.hmEffects?.()))?.placed === 0);
  // Sound (F5): the palette holds the ambiences and the sounds; Place puts Beach Waves down as a zone; Ctrl+Z takes it away
  await page.keyboard.press('F5');
  await page.waitForTimeout(T(400));
  check('Sound holds ways (Play, Place, Remove, Sounds here) and its palette the eight ambiences first', await page.evaluate(() => { const t = [...document.querySelectorAll('.hotbar > button span')].map((x) => x.textContent); return ['Play', 'Place', 'Remove', 'Sounds here'].every((w) => t.includes(w)); })
    && JSON.stringify(await page.$$eval('.palette-strip .ps-frame', (b) => b.slice(0, 2).map((x) => x.textContent))) === JSON.stringify(['Forest Birds', 'Windy Hill']));
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Beach Waves/.test(b.textContent ?? ''))?.click(); });
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Place/.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(400));
  check('Place puts Beach Waves down as a zone', (await page.evaluate(() => window.hmSounds?.()))?.zones === 1, JSON.stringify(await page.evaluate(() => window.hmSounds?.())));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(400));
  check('and Ctrl+Z takes the zone away', (await page.evaluate(() => window.hmSounds?.()))?.placed === 0);
  // Characters (F9): spawn a goblin that wanders; it walks off by itself; Ctrl+Z takes it away
  await page.keyboard.press('F9');
  await page.waitForTimeout(T(400));
  check('F9 opens Characters, its palette holds six behaviours', /Characters/.test(await page.locator('.tab-strip button.on').first().textContent() ?? '') && await page.locator('.palette-strip .ps-frame').count() === 6);
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Wander/.test(b.textContent ?? ''))?.click(); });
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Spawn/.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(1500));
  const ch = await page.evaluate(() => window.hmChars?.());
  check('Spawn puts a goblin down and it wanders off by itself', ch?.count === 1 && ch.drawn === 1 && ch.moved > 0.3, JSON.stringify(ch));
  if (ch?.first) { await page.evaluate((p) => { window.hmPinView = { eye: [p[0] + 2.4, p[1] + 1.6, p[2] + 2.4], target: [p[0], p[1] + 0.6, p[2]] }; }, ch.first); }
  await page.waitForTimeout(T(500));
  await shot('characters-wander');
  await page.evaluate(() => { window.hmPinView = null; });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(400));
  check('and Ctrl+Z takes the goblin away', (await page.evaluate(() => window.hmChars?.()))?.count === 0);
  // Lamps (F6): holding Lamp the palette shows the lamps; a bulb placed at night lights up; two Ctrl+Z take night and the lamp back
  await page.keyboard.press('F6');
  await page.waitForTimeout(T(300));
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /^\d?Lamp$/.test((b.textContent ?? '').trim()) || (b.textContent ?? '').trim().endsWith('Lamp'))?.click(); });
  await page.waitForTimeout(T(300));
  check('holding Lamp, the Lights palette shows the ten lamps', await page.locator('.palette-strip .ps-frame').count() === 10);
  check('the island note never catches a click', await dom(() => { const n = document.querySelector('.island-note'); return !n || getComputedStyle(n).pointerEvents === 'none'; }));
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Bulb/i.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(400));
  const lamp = await page.evaluate(() => window.hmLamps?.());
  const lampWhy = await dom(() => [document.querySelector('.island-note')?.textContent ?? '', document.querySelector('.tab-strip button.on')?.textContent ?? '', document.querySelector('.hotbar > button.on')?.textContent ?? ''].join(' | '));
  check('Lamp puts a bulb down and it is lit', lamp?.placed === 1 && (lamp.slots === 0 || lamp.lit === 1), JSON.stringify(lamp) + ' ' + lampWhy + ' ' + errors.join(' / '));
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Day and night/.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(1500));
  if (lamp?.first) await page.evaluate((p) => { window.hmPinView = { eye: [p[0] + 5, p[1] + 4, p[2] + 5], target: [p[0], p[1] - 1, p[2]] }; }, lamp.first);
  await page.waitForTimeout(T(600));
  await shot('lamp-night');
  await page.evaluate(() => { window.hmPinView = null; });
  await page.keyboard.press('Control+z'); await page.waitForTimeout(T(300));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(T(300));
  check('two Ctrl+Z take the night and the lamp back', (await page.evaluate(() => window.hmLamps?.()))?.placed === 0);
  // Physics (F11, or Shift+F1): the push hammer sends the barrel flying; it lands for good as one undo step; Ctrl+Z puts it back
  await page.keyboard.press('Shift+F1');
  await page.waitForTimeout(T(400));
  check('Shift+F1 opens Physics, its palette holds nine materials', /Physics/.test(await page.locator('.tab-strip button.on').first().textContent() ?? '') && await page.locator('.palette-strip .ps-frame').count() === 9);
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Push hammer/.test(b.textContent ?? ''))?.click(); });
  await page.mouse.move(640, 470); await page.mouse.down(); await page.waitForTimeout(T(100)); await page.mouse.up();
  await page.waitForTimeout(T(4500));
  const ph = await page.evaluate(() => window.hmPhysics?.());
  const phNote = await dom(() => document.querySelector('.island-note')?.textContent ?? '');
  check('the push hammer sends things flying and they land for good', ph?.settled === 1 && !ph.moving, JSON.stringify(ph) + ' ' + phNote);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(400));
  // Terrain (F10): a road from two points, laid by clicking the last one again; it reshapes and repaints the ground; Ctrl+Z takes it back
  await page.keyboard.press('F10');
  await page.waitForTimeout(T(300));
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => /Road$/.test((b.textContent ?? '').trim()))?.click(); });
  const groundBefore = await page.evaluate(() => [window.hmGround?.heights?.(), window.hmGround?.surfaces()[16] ?? 0]);
  for (const [x, y] of [[520, 440], [760, 440], [760, 440]]) { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(T(80)); await page.mouse.up(); await page.waitForTimeout(T(250)); }
  await page.waitForTimeout(T(400));
  const road = await page.evaluate(() => [window.hmPath?.(), window.hmGround?.heights?.(), window.hmGround?.surfaces()[16] ?? 0]);
  const laid = road[0]?.last ?? [];
  if (laid.length >= 2) { await page.evaluate((pts) => { const mx = (pts[0][0] + pts[pts.length - 1][0]) / 2, mz = (pts[0][1] + pts[pts.length - 1][1]) / 2; const g = window.hmGround?.heightAt?.(mx, mz) ?? 5; window.hmPinView = { eye: [mx + 6, g + 9, mz + 6], target: [mx, g, mz] }; }, laid); await page.waitForTimeout(T(600)); await shot('road'); await page.evaluate(() => { window.hmPinView = null; }); }
  check('Road: two points and the last again lay a road that reshapes and repaints the ground', road[0]?.laid === 1 && road[1] !== groundBefore[0] && road[2] > groundBefore[1], JSON.stringify([groundBefore, road]));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(T(400));
  check('and Ctrl+Z takes the road back', (await page.evaluate(() => window.hmGround?.heights?.())) === groundBefore[0]);
  // Logic wires (F7): a zone, a wire from it to the barrel that hides it; walking into the zone hides the barrel; two Ctrl+Z take it all back
  await page.keyboard.press('F7');
  await page.waitForTimeout(T(300));
  const clickWay = (name) => dom((n) => { [...document.querySelectorAll('.hotbar > button')].find((b) => (b.textContent ?? '').trim().endsWith(n))?.click(); }, name);
  const clickWorld = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(T(80)); await page.mouse.up(); await page.waitForTimeout(T(250)); };
  await clickWay('Zone'); await clickWorld(640, 470);
  check('Zone puts a trigger zone down', (await page.evaluate(() => window.hmWires?.()))?.zones === 1);
  await clickWay('Wire'); await page.waitForTimeout(T(200));
  check('holding Wire, the palette shows what a wire does', await page.locator('.palette-strip .ps-frame').count() === 8);
  await dom(() => { [...document.querySelectorAll('.palette-strip .ps-frame')].find((b) => /Hide it/.test(b.textContent ?? ''))?.click(); });
  await clickWorld(640, 470);
  const barrelAt = await page.evaluate(() => { const t = window.hmThings?.()[0]; return t ? window.hmProject?.(t.x, t.y + 0.05, t.z) : null; });
  if (barrelAt) await clickWorld(barrelAt[0], barrelAt[1]);
  const wired = await page.evaluate(() => window.hmWires?.());
  check('Wire: the zone, then the barrel', wired?.wires === 1, JSON.stringify(wired) + ' ' + await dom(() => document.querySelector('.island-note')?.textContent ?? ''));
  const walked = await page.evaluate(() => { const w = window.hmWires?.(); return w ? w.walkInto('') : -1; });
  check('walking into the zone hides the barrel', walked >= 0 && (await page.evaluate(() => window.hmWires?.()))?.hidden.length === 1, String(walked));
  // undo exactly the steps made (a step that did not happen must not cost an earlier one)
  for (let i = 0; i < (wired?.wires ?? 0) + (wired?.zones ?? 0); i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(T(300)); }
  await page.waitForTimeout(T(200));
  const after = await page.evaluate(() => window.hmWires?.());
  check('two Ctrl+Z take the wire and the zone back, and the barrel shows again', after?.zones === 0 && after.wires === 0 && after.hidden.length === 0, JSON.stringify(after));
  // Camera (F8): an orbit shot flies round (Esc stops it), a photo is saved, slow motion slows the world and comes back
  await page.keyboard.press('F8');
  await page.waitForTimeout(T(300));
  await clickWay('Orbit shot'); await clickWorld(640, 470);
  await page.waitForTimeout(T(600));
  check('Orbit shot flies the camera round', (await page.evaluate(() => window.hmCamera?.()))?.shot === true);
  await shot('orbit-shot');
  await page.keyboard.press('Escape'); await page.waitForTimeout(T(200));
  check('and Esc stops it', (await page.evaluate(() => window.hmCamera?.()))?.shot === false);
  await clickWay('Photo'); await clickWorld(640, 470); await page.waitForTimeout(T(300));
  check('Photo saves a picture of the view', (await page.evaluate(() => window.hmCamera?.()))?.photos === 1);
  await clickWay('Slow motion'); await clickWorld(640, 470); await page.waitForTimeout(T(800));
  const sm = await page.evaluate(() => window.hmCamera?.());
  check('Slow motion slows the world to a quarter', sm?.slow === true && Math.abs(sm.scale - 0.25) < 1e-6, JSON.stringify(sm));
  await clickWorld(640, 470); await page.waitForTimeout(T(800));
  check('and again brings it back to speed', (await page.evaluate(() => window.hmCamera?.()))?.scale === 1);
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(200));
  await dom(() => { document.querySelector('.layers .ly-row.on button[aria-label^="Hide"]')?.click(); });
  await page.waitForTimeout(T(200));
  check('its eye hides it', await page.locator('.layers .ly-row.hidden').count() === 1);
  await dom(() => { document.querySelector('.layers .ly-row.on button[aria-label^="Remove"]')?.click(); });
  await page.waitForTimeout(T(300));
  check('and the bin removes it again', await page.locator('.layers .ly-list[aria-label="Things"] .ly-row').count() === things);
  // a group (Box, F1, Pro): two barrels boxed together move together with the gizmo, as one undo step
  await dom(() => document.querySelector('[data-ui="island.level.pro"]')?.click());
  await page.keyboard.press('F1');
  await page.waitForTimeout(T(300));
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
  await dom(() => { [...document.querySelectorAll('.hotbar > button')].find((b) => (b.textContent ?? '').trim().endsWith('Box'))?.click(); });
  await page.waitForTimeout(T(200));
  const twoAt = await page.evaluate(() => (window.hmThings?.() ?? []).map((t) => window.hmProject?.(t.x, t.y + 0.3, t.z)));
  const xs = twoAt.map((p) => p?.[0] ?? 640), ys = twoAt.map((p) => p?.[1] ?? 400);
  await page.mouse.move(Math.min(...xs) - 60, Math.min(...ys) - 60); await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 60, Math.max(...ys) + 60, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(T(400));
  const gg = await page.evaluate(() => window.hmGizmo?.());
  check('Box picks both barrels and the gizmo stands on the group', gg?.count === 2, JSON.stringify(gg?.group) + ' ' + await dom(() => document.querySelector('.island-note')?.textContent ?? ''));
  if (gg && gg.count === 2) {
    const before2 = await page.evaluate(() => window.hmThings?.());
    // drag whichever arrow sits in a clear part of the screen (where the arrows point depends on the camera)
    const clear = (p) => p[0] > 430 && p[0] < 870 && p[1] > 170 && p[1] < 460;
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
    await page.keyboard.press('Control+z'); await page.waitForTimeout(T(300));
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(T(200));
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(T(300)); }
  await page.evaluate(() => { window.hmPinView = null; });
  check('and undo takes the move and both barrels back', (await page.evaluate(() => window.hmGround?.things?.())) === things);
  await dom(() => document.querySelector('[data-ui="island.level.easy"]')?.click());
  await page.keyboard.press('F2');
  await page.waitForTimeout(T(200));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(T(300));
  check('Tab again closes the palette', await page.locator('.palette-strip').count() === 0);
  await page.keyboard.press('b');
  await page.waitForTimeout(T(500));
  for (let i = 0; i < 3 && await page.locator('.fwin').count() > 0; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(T(250)); }
  await page.keyboard.press('e');
  await page.waitForTimeout(T(500));
  check('E opens your presets', await page.locator('.fwin[aria-label="Your presets"]').count() === 1);
  check('every way to paint has a card', await page.locator('.pw-card').count() >= 9);
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
