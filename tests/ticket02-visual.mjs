/**
 * TICKET-02 visual + functional verification: decluttered UI, Blizzard gauges,
 * drill-down drawer, and the condensed in-race HUD, exercised in a real browser
 * against the production build.
 *
 * Serves dist/, walks the setup flow to capture the gauge grid and the Tuning
 * Details drawer, launches a race, and captures the decluttered HUD: speedometer
 * dial, position medallion, mini track bar with rival pips, corner supply icons,
 * and the immersion mode that hides page chrome while flying.
 *
 * Usage: node tests/ticket02-visual.mjs
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.json': 'application/json' };

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

await mkdir(artifacts, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-t02-libs-'));
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
const shot = (page, name) => page.screenshot({ path: join(artifacts, `ticket02-${name}.png`) });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_CONNECTION_CLOSED')) errors.push(`console: ${message.text()}`);
  });

  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });

  // ---- Setup: gauges + drawer ----
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.waitForSelector('.setup-dialog', { timeout: 10000 });
  await page.getByRole('button', { name: /Choose Your Crew/ }).click();
  await page.waitForSelector('.loadout-spec', { timeout: 10000 });

  const gauges = await page.locator('.spec-gauges .blizzard-gauge').count();
  report(gauges === 4, 'setup shows the four core gauges', `count=${gauges}`);
  const oldWalls = await page.locator('.spec-description, .physical-stats, .loadout-tradeoffs, .stat-explanation, .rating-row').count();
  report(oldWalls === 0, 'setup spec panel has no text-wall elements', `count=${oldWalls}`);
  await shot(page, '1-setup-gauges');

  // Gauges animate on selection: switch capsule and confirm the value text changes.
  const before = await page.locator('.spec-gauges .gauge-value-text').first().textContent();
  await page.getByRole('radio', { name: /Siegebreaker/ }).click();
  await page.waitForTimeout(700);
  const after = await page.locator('.spec-gauges .gauge-value-text').first().textContent();
  report(before !== after, 'gauge values update when the capsule changes', `${before} -> ${after}`);

  // Drill-down drawer.
  await page.getByRole('button', { name: /Tuning Details/i }).click();
  await page.waitForSelector('.tuning-drawer', { timeout: 5000 });
  const drawerSections = await page.locator('.tuning-drawer .drawer-section').count();
  report(drawerSections >= 5, 'tuning drawer carries balance, lore, trade-offs, math and glossary', `sections=${drawerSections}`);
  await shot(page, '2-drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  report((await page.locator('.tuning-drawer').count()) === 0, 'escape closes the drawer');

  // ---- Race: decluttered HUD ----
  await page.getByRole('radio', { name: /Rustbucket/ }).click();
  await page.getByRole('button', { name: /Set the Race/ }).click();
  await page.getByRole('button', { name: /To the Starting Line/ }).click();
  await page.waitForSelector('.game-stage', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 20000 });
  await page.waitForTimeout(2900); // let the loading cover auto-dismiss
  if (await page.locator('.game-loading-cover').count()) {
    // The first key only dismisses the cover; spend it and move on.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  await shot(page, '3-grid');

  const gridChecks = await page.evaluate(() => ({
    selector: Boolean(document.querySelector('.track-selector')),
    standings: Boolean(document.querySelector('.race-standings')),
    suppliesBar: Boolean(document.querySelector('.air-supplies-title')),
    dial: Boolean(document.querySelector('.blizzard-dial')),
    medallion: Boolean(document.querySelector('.position-medallion')),
    trackbar: document.querySelectorAll('.mini-trackbar .trackbar-pip').length,
    supplies: document.querySelectorAll('.hud-supplies .supply-chip').length,
    gear: Boolean(document.querySelector('.gear-button')),
    banner: Boolean(document.querySelector('.event-race-banner')),
  }));
  report(!gridChecks.selector, 'verbose track selector banner removed');
  report(!gridChecks.standings, 'standings strip removed from the control deck');
  report(!gridChecks.suppliesBar, 'wide air-supplies bar removed');
  report(!gridChecks.banner, 'event race banner removed');
  report(gridChecks.dial, 'speedometer dial present');
  report(gridChecks.medallion, 'position medallion present');
  report(gridChecks.trackbar === 4, 'mini track bar shows player plus three rival pips', `pips=${gridChecks.trackbar}`);
  report(gridChecks.supplies === 3, 'compact supply chips present', `chips=${gridChecks.supplies}`);
  report(gridChecks.gear, 'consolidated gear menu button present');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, '4-flying');

  const flying = await page.evaluate(() => ({
    immersed: document.querySelector('.race-app')?.className.includes('race-immersed') ?? false,
    headerHidden: getComputedStyle(document.querySelector('.site-header')).display === 'none',
    footnoteHidden: getComputedStyle(document.querySelector('.track-footnote')).display === 'none',
    flavor: document.body.textContent?.includes('Looking gloriously irresponsible') ?? true,
    shell: document.querySelector('.game-shell')?.getBoundingClientRect().height ?? 0,
    viewport: innerHeight,
  }));
  report(flying.immersed, 'race enters immersion mode while flying');
  report(flying.headerHidden, 'page header hidden during active play');
  report(flying.footnoteHidden, 'goblin wisdom footnote hidden during active play');
  report(!flying.flavor, 'no flavor paragraph text in the flying HUD');
  report(flying.shell >= flying.viewport - 2, 'game shell expands to the viewport during play', `shell=${Math.round(flying.shell)} viewport=${flying.viewport}`);

  // Auto-hide: after ~2.4s of pointer stillness the gear button fades.
  await page.waitForTimeout(2700);
  const gearHidden = await page.evaluate(() => document.querySelector('.hud-gear')?.className.includes('gear-hidden') ?? false);
  report(gearHidden, 'gear button auto-hides during active play');
  await shot(page, '5-immersed');
  await page.mouse.move(720, 400);
  await page.waitForTimeout(300);
  const gearBack = await page.evaluate(() => !(document.querySelector('.hud-gear')?.className.includes('gear-hidden')));
  report(gearBack, 'gear button returns on pointer activity');

  // Gear menu opens the consolidated navigation.
  await page.getByRole('button', { name: 'Race menu' }).click();
  await page.waitForSelector('.gear-menu', { timeout: 5000 });
  const menuItems = await page.locator('.gear-menu button').count();
  report(menuItems >= 7, 'gear menu consolidates the removed title bars', `items=${menuItems}`);
  await shot(page, '6-gear-menu');
  await page.keyboard.press('Escape');
  const menuClosed = await page.waitForFunction(() => !document.querySelector('.gear-menu'), null, { timeout: 3000 }).then(() => true).catch(() => false);
  report(menuClosed, 'escape closes the gear menu');

  report(errors.length === 0, 'no console or page errors during the pass', errors.slice(0, 3).join(' | '));
} catch (error) {
  report(false, `verification pass crashed: ${error.message}`);
} finally {
  await browser.close();
  server.close();
}

console.log(tap.join('\n'));
console.log(`1..${tap.length}`);
process.exit(failures.length ? 1 : 0);
