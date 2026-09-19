/**
 * TICKET-08 visual verification: the Waterfall Cliff Zigzag and Pinball Chasm.
 *
 * Drives a real custom-practice race through the built app in headless Chromium and
 * follows the ball from the Scrap Fall Crest all the way into the Drowned Maw, capturing
 * screenshots of the crest launch, the pinball rockfield, the wet foam run, the rope
 * bridge and the maw, plus the HUD surface readout that goes with each one. The screens
 * are inspected as images, so this suite reports both what the DOM says and which frames
 * were captured.
 *
 * Usage: node tests/section-two-visual.mjs
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'tests/artifacts');
const dist = join(root, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = join(dist, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  const target = existsSync(file) && extname(file) ? file : join(dist, 'index.html');
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
server.on('connection', (socket) => socket.on('error', () => {}));
server.keepAliveTimeout = 0;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

await mkdir(artifacts, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-section2-libs-'));
const archive = await readFile(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
const extraction = spawnSync('tar', ['-xf', '-', '-C', libraryDir], { input: brotliDecompressSync(archive) });
if (extraction.status !== 0) throw new Error('Could not extract the bundled browser libraries.');
chromium.setGraphicsMode = false;
const browser = await playwright.launch({
  args: [...chromium.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
  executablePath: await chromium.executablePath(),
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `${libraryDir}/lib:${libraryDir}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`, FONTCONFIG_PATH: join(tmpdir(), 'fonts') },
});

const tap = [];
const failures = [];
const report = (ok, name, detail = '') => {
  tap.push(`${ok ? 'ok' : 'not ok'} - ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures.push(name);
};
const shot = (page, name) => page.screenshot({ path: join(artifacts, `section2-${name}.png`) });
const hud = (page) => page.evaluate(() => ({
  sector: document.querySelector('.trackbar-sector')?.textContent ?? '',
  surface: document.querySelector('.trackbar-surface')?.textContent ?? '',
  remaining: document.querySelector('.trackbar-remaining')?.textContent ?? '',
  status: document.querySelector('.game-stage')?.className.match(/status-\w+/)?.[0] ?? '',
  fps: document.querySelector('canvas.game-canvas, canvas')?.dataset?.renderFps ?? '',
  notice: document.querySelector('.game-notice')?.textContent ?? '',
}));

const launchWithEnter = async (page) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('Enter');
    try {
      await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 1200 });
      return;
    } catch { /* landed in a render/effect gap; retry */ }
  }
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
};

/** Waits until the HUD sector name reaches (or passes) the given Section 2 zone. */
const awaitSector = async (page, name, timeout = 90000) =>
  page.waitForFunction((sector) => (document.querySelector('.trackbar-sector')?.textContent ?? '') === sector, name, { timeout })
    .then(() => true).catch(() => false);

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_CONNECTION_CLOSED')) errors.push(`console: ${message.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });

  // A custom-physics quick race on Rustbucket Ridge: the same path a player takes.
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('radio', { name: /Quick Race/ }).click();
  await page.getByRole('button', { name: /Choose Your Crew/ }).click();
  await page.getByRole('button', { name: /Set the Race/ }).click();
  await page.getByRole('checkbox', { name: /Custom physics practice/i }).check();
  await page.getByRole('button', { name: /To the Starting Line/ }).click();
  await page.waitForSelector('.game-stage', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 20000 });
  if (await page.locator('.race-loading-screen').count()) await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.race-loading-screen'), null, { timeout: 15000 });
  await page.locator('canvas.game-canvas').focus();
  await shot(page, '0-grid');

  const stageOne = await hud(page);
  report(stageOne.sector === 'THE LAUNCH RIDGE', 'the grid still starts Stage 1 in the launch ridge', stageOne.sector);
  report(stageOne.surface === '', 'no Section 2 surface chip on Stage 1 dirt', JSON.stringify(stageOne.surface));

  await launchWithEnter(page);
  // Ride the alpine downhill. The engine simulates up to 12 physics steps per rendered
  // frame, so the 24 km circuit resolves in well under a minute of wall clock.
  const reachedCrest = await awaitSector(page, 'SCRAP FALL CREST');
  report(reachedCrest, 'the race reaches the Scrap Fall Crest', JSON.stringify(await hud(page)));
  await shot(page, '1-crest');

  const reachedHairpins = await awaitSector(page, 'THE HAIRPIN BERMS');
  report(reachedHairpins, 'the switchback cascade follows the crest');
  await page.waitForTimeout(120);
  await shot(page, '2-hairpin-berms');
  const hairpin = await hud(page);
  report(/WET TIMBER|RIVETED STEEL|MOSSY SLATE/.test(hairpin.surface), 'the HUD names the wet Section 2 deck', hairpin.surface);

  const reachedChasm = await awaitSector(page, 'THE PINBALL ROCKFIELD');
  report(reachedChasm, 'the pinball rockfield is reached');
  await shot(page, '3-pinball-entry');
  const pinball = await hud(page);
  report(pinball.surface === 'RIVETED STEEL', 'the rockfield runs on riveted steel', pinball.surface);
  // Two more frames mid-rockfield: pegs, springs and rings are all in this window.
  await page.waitForTimeout(700);
  await shot(page, '3b-pinball-field');
  await page.waitForTimeout(700);
  await shot(page, '3c-pinball-field');
  const pinballNotice = (await hud(page)).notice;
  report(true, 'rockfield notice text (informational)', pinballNotice || 'none in this window');

  const reachedFoam = await awaitSector(page, 'THE WET FOAM RUN');
  report(reachedFoam, 'the wet foam run is reached');
  await shot(page, '4-wet-foam');
  const foam = await hud(page);
  report(/WET TIMBER|MOSSY SLATE/.test(foam.surface), 'the foam run reports a wet surface', foam.surface);

  const reachedBridge = await awaitSector(page, 'THE ROPE BRIDGE');
  report(reachedBridge, 'the rope bridge is reached');
  await shot(page, '5-rope-bridge');
  await page.waitForTimeout(600);
  await shot(page, '5b-rope-bridge');

  const reachedMaw = await awaitSector(page, 'THE DROWNED MAW');
  report(reachedMaw, 'the Drowned Maw is reached');
  await shot(page, '6-drowned-maw');
  const maw = await hud(page);
  report(maw.surface === 'LAVA SLAG' || maw.surface === 'WET TIMBER', 'the maw reports its own surface', maw.surface);

  // The finish is a provisional line inside the maw until TICKET-09 lands Stage 3.
  const finished = await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-finished'), null, { timeout: 90000 })
    .then(() => true).catch(() => false);
  report(finished, 'the 24 km circuit is completable end to end');
  await shot(page, '7-finish');

  const final = await hud(page);
  report(Number.parseFloat(final.fps) > 10, 'the renderer keeps producing frames through the whole chasm', `renderFps=${final.fps}`);
  const remaining = Number.parseInt((final.remaining.match(/[\d,]+/) ?? ['0'])[0].replace(/,/g, ''), 10);
  report(remaining < 2000, 'the finish distance readout runs down to the maw', final.remaining.trim());
  report(errors.length === 0, 'no page or console errors through the whole run', errors.slice(0, 3).join(' | '));
} catch (error) {
  report(false, 'script completed', String(error));
} finally {
  await browser.close();
  server.close();
  await writeFile(join(artifacts, 'section-two-visual.tap'), [...tap, `1..${tap.length}`].join('\n') + '\n');
  console.log(tap.join('\n'));
  if (failures.length) process.exit(1);
}
