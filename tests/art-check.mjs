/**
 * Visual check of the Part 4.2 art integration.
 *
 * Drives the built app in headless Chromium and captures the screens where generated art
 * appears: the setup rider/capsule picker, the cup itinerary, the starting grid, and a race
 * frame. Reports any broken image (naturalWidth 0) so a missing PNG cannot slip through.
 *
 * Usage:
 *   node tests/art-check.mjs                  serves the built dist/ and checks it
 *   node tests/art-check.mjs http://127.0.0.1:5173   checks a running server, e.g. the
 *                                             live preview, so the checked art is the
 *                                             art the user is looking at
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import chromiumBundle from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'tests/artifacts');
const dist = join(root, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const live = process.argv[2] ?? '';
let server = null;
if (!live && !existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first, or pass a URL.');
  process.exit(1);
}

if (!live) {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const file = join(dist, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
    const target = existsSync(file) && extname(file) ? file : join(dist, 'index.html');
    try {
      const body = await readFile(target);
      response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      response.end(body);
    } catch { response.writeHead(404).end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}
const baseUrl = live || `http://127.0.0.1:${server.address().port}`;

await mkdir(artifacts, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-art-libs-'));
const archive = await readFile(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
const extraction = spawnSync('tar', ['-xf', '-', '-C', libraryDir], { input: brotliDecompressSync(archive) });
if (extraction.status !== 0) throw new Error('Could not extract the bundled browser libraries.');
chromiumBundle.setGraphicsMode = false;
const browser = await chromium.launch({
  args: [...chromiumBundle.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
  executablePath: await chromiumBundle.executablePath(),
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `${libraryDir}/lib:${libraryDir}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`, FONTCONFIG_PATH: join(tmpdir(), 'fonts') },
});

const results = [];
const failures = [];
const check = (ok, name, detail = '') => {
  results.push(`${ok ? 'ok' : 'not ok'} - ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

/** Every <img> that is present and visible must have decoded pixels. */
async function brokenImages(page) {
  return page.evaluate(() => [...document.images]
    .filter((image) => image.offsetParent !== null || image.getClientRects().length > 0)
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src));
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  // A dev server (live mode) points its HMR socket at the proxied preview port, so a direct
  // 127.0.0.1 load cannot reach it. That transport noise is not an art defect; everything
  // else that fails still counts.
  const noise = (text) => /WebSocket|websocket|vite:client|\[vite\]/.test(text);
  page.on('pageerror', (error) => { if (!noise(error.message)) errors.push(error.message); });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Ignore CDN problems from the sandbox network; only this app's own failures count.
    const location = message.location()?.url ?? '';
    if (location && new URL(location, baseUrl).origin !== new URL(baseUrl).origin) return;
    if (noise(message.text())) return;
    errors.push(message.text());
  });
  // Only this app's own resources matter here: the sandbox blocks third-party font CDNs,
  // which is an environment limitation, not an art defect.
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (new URL(url).origin !== new URL(baseUrl).origin) return;
    if (noise(url) || url.includes('token=')) return;
    failed.push(`${url} (${request.failure()?.errorText ?? 'unknown'})`);
  });

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });

  // Setup: riders, capsules and course previews are the screens with the most art.
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('radio', { name: /Tournament/ }).click();
  await page.getByRole('button', { name: /Choose Your Crew/ }).click();
  await page.waitForSelector('.rider-deck img', { timeout: 15000 });
  await page.waitForTimeout(600);
  const riders = await page.evaluate(() => {
    const images = [...document.querySelectorAll('.rider-deck img')];
    return images.map((image) => ({ src: image.getAttribute('src'), width: image.naturalWidth }));
  });
  check(riders.length === 4, 'four painted rider portraits are offered', String(riders.length));
  check(riders.every((image) => image.width > 0), 'every rider portrait decodes', JSON.stringify(riders.map((r) => r.width)));
  // TICKET-04: the broken cockpit-hole composite is retired - no goblin head in a hatch.
  check(await page.locator('.racer-pilot-window').count() === 0, 'the cockpit hatch composite is retired');
  check(await page.locator('.character-showcase .showcase-rider').count() >= 1, 'the stage shows a full-body rider');
  check(await page.locator('.character-showcase .showcase-ball').count() >= 1, 'the stage shows a standalone ball');
  const figures = await page.evaluate(() => {
    const rider = document.querySelector('.showcase-rider');
    const ball = document.querySelector('.showcase-ball');
    return {
      rider: rider ? { w: rider.naturalWidth, h: rider.naturalHeight } : null,
      ball: ball ? { w: ball.naturalWidth, h: ball.naturalHeight } : null,
    };
  });
  check(Boolean(figures.rider) && figures.rider.h > figures.rider.w, 'the rider render is a full-body portrait figure', JSON.stringify(figures.rider));
  check(Boolean(figures.ball) && figures.ball.w > 0 && Math.abs(figures.ball.w - figures.ball.h) <= 2, 'the ball render is a clean square sprite', JSON.stringify(figures.ball));
  await page.screenshot({ path: join(artifacts, 'art-1-loadout.png') });
  await page.locator('.loadout-stage').screenshot({ path: join(artifacts, 'art-1b-capsule-closeup.png') });

  // Swapping rider and ball has to swap both painted figures.
  await page.locator('.rider-card').nth(2).click();
  await page.locator('.ball-card').nth(1).click();
  await page.waitForTimeout(800);
  const swapped = await page.evaluate(() => {
    const rider = document.querySelector('.showcase-rider');
    const ball = document.querySelector('.showcase-ball');
    return {
      rider: (rider?.getAttribute('src') ?? '').split('/').pop(), ball: (ball?.getAttribute('src') ?? '').split('/').pop(),
      ready: Boolean(rider && rider.naturalWidth > 0 && ball && ball.naturalWidth > 0),
    };
  });
  check(swapped.rider === 'grub_full.png' && swapped.ball === 'springsteel-ball.png' && swapped.ready,
    'choosing another rider and ball swaps both painted figures', JSON.stringify(swapped));
  await page.locator('.rider-card').nth(0).click();
  await page.locator('.ball-card').nth(0).click();
  await page.waitForTimeout(500);

  // Ball picker: all three standalone renders.
  const balls = await page.evaluate(() => [...document.querySelectorAll('.ball-deck img')].map((image) => image.naturalWidth));
  check(balls.length === 3 && balls.every((width) => width > 0), 'all three standalone ball renders decode', JSON.stringify(balls));

  // Course art in the itinerary step.
  await page.getByRole('button', { name: /Set the Race/ }).click();
  await page.waitForTimeout(700);
  const courses = await page.evaluate(() => [...document.querySelectorAll('.course-thumbnail')].map((image) => ({ width: image.naturalWidth, src: image.getAttribute('src') })));
  check(courses.length >= 3 && courses.every((course) => course.width >= 400), 'course previews are the painted rasters', JSON.stringify(courses.map((c) => c.width)));
  check(courses.every((course) => (course.src ?? '').includes('-course.png')), 'course previews no longer use inline SVG', JSON.stringify(courses.map((c) => c.src)));
  await page.screenshot({ path: join(artifacts, 'art-2-courses.png') });

  const brokenSetup = await brokenImages(page);
  check(brokenSetup.length === 0, 'no broken images on the setup screen', brokenSetup.join(', '));

  // Race: capsule sprites in the world and the pickup icons in the HUD.
  await page.getByRole('button', { name: /Enter the Cup|To the Starting Line/ }).click();
  await page.waitForSelector('.game-stage', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const hudIcons = await page.evaluate(() => [...document.querySelectorAll('.hud-supplies img')].map((image) => image.naturalWidth));
  check(hudIcons.length >= 3 && hudIcons.every((width) => width > 0), 'HUD supply icons are the painted PNGs', JSON.stringify(hudIcons));
  await page.screenshot({ path: join(artifacts, 'art-3-grid.png') });

  // The loading cover owns Enter until dismissed (there is no auto-dismiss); dismiss it
  // explicitly, then launch. Enter can also land in a render gap after the status flip,
  // so the launch is retried until the race actually flies.
  if (await page.locator('.race-loading-screen').count()) await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.race-loading-screen'), null, { timeout: 15000 });
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('Enter');
    try {
      await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 1200 });
      break;
    } catch { /* landed in a gap; retry */ }
  }
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(artifacts, 'art-4-race.png') });

  // The canvas frame must actually contain the painted capsules: sample the drawn pixels.
  const painted = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    if (!canvas) return { ok: false, reason: 'no canvas' };
    const probe = document.createElement('canvas');
    probe.width = canvas.width; probe.height = canvas.height;
    probe.getContext('2d')?.drawImage(canvas, 0, 0);
    const paint = probe.getContext('2d');
    const data = paint?.getImageData(0, 0, probe.width, probe.height).data;
    if (!data) return { ok: false, reason: 'no pixels' };
    let metallic = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 60 && r < 200 && g > 55 && b < 130 && r > b + 25 && g > b + 15) metallic += 1;
    }
    return { ok: true, metallic, width: probe.width, height: probe.height };
  });
  check(painted.ok && painted.metallic > 40, 'the race frame contains painted metal/brass pixels', JSON.stringify(painted));
  check(errors.length === 0 && failed.length === 0, 'no failed requests or page errors while painting the race',
    [...errors, ...failed].slice(0, 4).join(' | '));

  // Back to the grid: immersion hides the site header while racing or paused, and the
  // workshop is opened from the header navigation.
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 30000 });
  await page.waitForTimeout(400);

  // The workshop sprite lab must offer the art that is actually used in the game. The
  // race screen has no header nav; the workshop lives in the gear menu.
  await page.mouse.move(720, 480);
  await page.getByRole('button', { name: 'Race menu' }).click();
  await page.getByRole('menuitem', { name: /The workshop/i }).click();
  await page.getByRole('tab', { name: /SPRITE LAB/ }).click();
  await page.waitForSelector('.art-tile img', { timeout: 15000 });
  await page.waitForTimeout(800);
  const gallery = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.art-tile')];
    const images = [...document.querySelectorAll('.art-tile img')];
    return {
      tiles: tiles.length,
      broken: images.filter((image) => image.complete && image.naturalWidth === 0).length,
      sources: images.map((image) => image.getAttribute('src') ?? ''),
    };
  });
  check(gallery.tiles >= 20, 'the sprite lab lists the whole runtime library', String(gallery.tiles));
  check(gallery.broken === 0, 'every gallery sprite decodes', String(gallery.broken));
  check(gallery.sources.every((src) => src.endsWith('.png')), 'gallery entries are PNG files, not inline vectors',
    gallery.sources.filter((src) => !src.endsWith('.png')).slice(0, 2).join(', '));
  await page.screenshot({ path: join(artifacts, 'art-5-sprite-lab.png') });

  await page.getByRole('tab', { name: /SOURCE SHEETS/ }).click();
  await page.waitForTimeout(700);
  const sheets = await page.evaluate(() => [...document.querySelectorAll('.art-tile.sheet em')].map((node) => node.textContent ?? ''));
  check(sheets.filter((text) => /magenta key .*target #FF00FF/.test(text)).length >= 5,
    'every keyed sheet records a detected colour and the magenta #FF00FF target', sheets.join(' / '));
  check(sheets.some((text) => text.includes('painted alpha')),
    'the repurposed portrait sheet is described as painted alpha, not keyed', sheets.join(' / '));
  await page.screenshot({ path: join(artifacts, 'art-6-source-sheets.png') });

  await page.getByRole('button', { name: /Close dialog/ }).click();
  await page.waitForTimeout(300);
  await page.mouse.move(720, 480);
  await page.getByRole('button', { name: 'Race menu' }).click();
  await page.getByRole('menuitem', { name: /Main menu/i }).click();
  await page.waitForSelector('main.main-menu', { timeout: 15000 });
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(libraryDir, { recursive: true, force: true });
}

await writeFile(join(artifacts, 'art-check.tap'), `${results.join('\n')}\n`);
console.log(results.join('\n'));
console.log(`# ${results.filter((line) => line.startsWith('ok')).length} passed / ${failures.length} failed`);
if (failures.length) process.exit(1);
