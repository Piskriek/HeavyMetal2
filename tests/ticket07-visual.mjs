/**
 * TICKET-07 visual verification: ball-chase camera, off-screen edge pointer, and the
 * airborne ground decal, exercised in a real browser against the production build.
 *
 * Serves dist/ (builds it first), drives a custom-physics practice race with a max
 * launch so the ball leaves the viewport, and captures screenshots of the indicator
 * and decal in both camera modes. Screenshots + TAP log land in tests/artifacts/.
 *
 * Usage: node tests/ticket07-visual.mjs
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
    console.error(`[ticket07-visual] missing: ${url.pathname}`);
    response.writeHead(404).end('not found');
  }
});
server.on('connection', (socket) => socket.on('error', () => {}));
// Close each connection after its response: a reused keep-alive socket that idles out
// mid-race surfaces as a spurious ERR_CONNECTION_CLOSED in the browser console.
server.keepAliveTimeout = 0;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

await mkdir(artifacts, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-browser-libs-'));
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
const shot = (page, name) => page.screenshot({ path: join(artifacts, `ticket07-${name}.png`) });

const loftyLaunch = async (page) => {
  // Steep aim with ~60% power: a ~300-unit apex that stays under the pit-crew
  // recovery ceiling (altitude 360) so the ball actually flies, decal and all.
  for (let i = 0; i < 11; i++) await page.keyboard.press('ArrowUp'); // 36 -> 68 degrees
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft'); // 0.8 -> 0.6 power
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Chrome retries a GET whose keep-alive socket closed underneath it; the retry
    // always succeeds here, so this one message is noise from the tiny static server.
    if (message.type() === 'error' && !message.text().includes('ERR_CONNECTION_CLOSED')) errors.push(`console: ${message.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });

  // Start a custom-physics quick race through the real UI.
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('radio', { name: /Quick Race/ }).click();
  await page.getByRole('button', { name: /Choose Your Crew/ }).click();
  await page.getByRole('button', { name: /Set the Race/ }).click();
  await page.getByRole('checkbox', { name: /Custom physics practice/i }).check();
  await page.getByRole('button', { name: /To the Starting Line/ }).click();
  await page.waitForSelector('.game-stage', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 20000 });

  // Follow-ball mode (the default): a max launch catapults the ball off the top.
  await loftyLaunch(page);
  await shot(page, '1-ready-follow');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
  await page.waitForTimeout(450);
  await shot(page, '2-follow-airborne');
  // An air bounce over open track puts the ball high with a clean view of the decal.
  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  await shot(page, '2b-follow-bounce-decal');
  await page.waitForTimeout(330);
  await shot(page, '3-follow-decend');
  await page.waitForTimeout(2500);

  // Switch to the fixed course camera mid-race and repeat the catapult launch.
  await page.getByRole('button', { name: /THE WORKSHOP/i }).click();
  await page.waitForSelector('#race-camera-mode', { timeout: 10000 });
  const modeValue = await page.locator('#race-camera-mode').inputValue();
  report(modeValue === 'follow_ball', 'in-race select exposes follow_ball as the default', modeValue);
  await page.locator('#race-camera-mode').selectOption('fixed');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 15000 });
  await loftyLaunch(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
  await page.waitForTimeout(450);
  await shot(page, '4-fixed-airborne');
  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  await shot(page, '4b-fixed-bounce-decal');
  await page.waitForTimeout(330);
  await shot(page, '5-fixed-decend');
  await page.waitForTimeout(2500);

  const fps = await page.evaluate(() => document.querySelector('canvas.game-canvas, canvas')?.dataset?.renderFps ?? '');
  report(fps !== '' && Number(fps) > 10, 'renderer keeps producing frames with the new overlays', `renderFps=${fps}`);
  report(errors.length === 0, 'no page or console errors during both camera modes', errors.slice(0, 3).join(' | '));
} catch (error) {
  report(false, 'script completed', String(error));
} finally {
  await browser.close();
  server.close();
  await writeFile(join(artifacts, 'ticket07-visual.tap'), [...tap, `1..${tap.length}`].join('\n') + '\n');
  console.log(tap.join('\n'));
  if (failures.length) process.exit(1);
}
