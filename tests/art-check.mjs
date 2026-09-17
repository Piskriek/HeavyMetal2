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
  await page.waitForSelector('.rider-options img', { timeout: 15000 });
  await page.waitForTimeout(600);
  const riders = await page.evaluate(() => {
    const images = [...document.querySelectorAll('.rider-options img')];
    return images.map((image) => ({ src: image.getAttribute('src'), width: image.naturalWidth }));
  });
  check(riders.length === 4, 'four painted rider portraits are offered', String(riders.length));
  check(riders.every((image) => image.width > 0), 'every rider portrait decodes', JSON.stringify(riders.map((r) => r.width)));
  check(await page.locator('.racer-figure .racer-shell').count() === 1, 'the showcase composites shell + pilot');
  check(await page.locator('.racer-pilot-window').count() === 1, 'the pilot is clipped to the measured hatch');
  await page.screenshot({ path: join(artifacts, 'art-1-loadout.png') });

  const shellWidth = await page.evaluate(() => document.querySelector('.racer-shell')?.naturalWidth ?? 0);
  const pilotWidth = await page.evaluate(() => document.querySelector('.racer-pilot')?.naturalWidth ?? 0);
  check(shellWidth > 0 && pilotWidth > 0, 'shell and pilot PNGs are decoded', `${shellWidth}x${pilotWidth}`);

  // Geometry, not just presence: the pilot has to sit ON the measured hatch opening rather
  // than floating over the shell, which is the defect that made the capsule picker wrong.
  const geometry = await page.evaluate(() => {
    const figure = document.querySelector('.selected-capsule .racer-figure');
    const shell = figure?.querySelector('.racer-shell');
    const window_ = figure?.querySelector('.racer-pilot-window');
    const pilot = figure?.querySelector('.racer-pilot');
    if (!figure || !shell || !window_ || !pilot) return null;
    const shellRect = shell.getBoundingClientRect();
    const pilotRect = pilot.getBoundingClientRect();
    const clip = getComputedStyle(window_).clipPath;
    const numbers = (clip.match(/[\d.]+/g) ?? []).map(Number);
    return {
      clip,
      hatch: numbers.length >= 4
        ? { rx: numbers[0] / 100, ry: numbers[1] / 100, x: numbers[2] / 100, y: numbers[3] / 100 } : null,
      pilotInside: pilotRect.left >= shellRect.left - 1 && pilotRect.right <= shellRect.right + 1
        && pilotRect.top >= shellRect.top - 1 && pilotRect.bottom <= shellRect.bottom + 1,
    };
  });
  check(Boolean(geometry?.hatch), 'the pilot window exposes a measured hatch clip', geometry?.clip ?? 'none');
  if (geometry?.hatch) {
    const { x, y, rx, ry } = geometry.hatch;
    // The painted cockpit is the ringed porthole on the shell's face, and its fitted centre
    // lands near 0.81 / 0.61 on all three capsules. The wide top hatch is the cockpit's own
    // opening; a bust seated there disappears behind its front rim, so it is not the seat.
    check(Math.abs(x - 0.812) < 0.05 && Math.abs(y - 0.612) < 0.05,
      'the pilot window sits on the painted port, not on the top hatch', `x=${x.toFixed(3)} y=${y.toFixed(3)}`);
    check(rx > 0.06 && rx < 0.14 && ry > 0.09 && ry < 0.18,
      'the hatch window matches the measured ellipse radii', `rx=${rx.toFixed(3)} ry=${ry.toFixed(3)}`);
    // The bust is square: a wildly non-square pilot box is what squashed the face before.
    const pilotBox = await page.evaluate(() => {
      const pilot = document.querySelector('.selected-capsule .racer-pilot');
      if (!pilot) return null;
      const rect = pilot.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    });
    check(pilotBox !== null && Math.abs(pilotBox.w - pilotBox.h) < 2,
      'the pilot keeps the bust aspect instead of being stretched', pilotBox ? `${pilotBox.w.toFixed(1)}x${pilotBox.h.toFixed(1)}` : 'none');

    // And the bust has to stay inside the painted opening: the reported defect was a pilot
    // scaled to 3.4x the port, whose helmet clipped over the brass ring. This compares the
    // shell's own near-black pixels around the port against the pilot PNG's alpha bounding box
    // in sprite coordinates, so it cannot drift with CSS box behaviour. It is a loose bound -
    // the exact fit is the ellipse clip the check above reads - but it fails loudly for the
    // 3.4x-style overshoot that caused the defect.
    const seat = await page.evaluate(async () => {
      const figure = document.querySelector('.selected-capsule .racer-figure');
      const pilot = figure?.querySelector('.racer-pilot');
      const shell = figure?.querySelector('.racer-shell');
      if (!figure || !pilot || !shell) return null;
      const sample = async (image) => {
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const paint = canvas.getContext('2d');
        paint.drawImage(image, 0, 0);
        return { data: paint.getImageData(0, 0, canvas.width, canvas.height), width: canvas.width, height: canvas.height };
      };
      const shellPixels = await sample(shell);
      // Opening: near-black opaque pixels in the port's corner of the shell sprite.
      let opening = { left: 1, top: 1, right: 0, bottom: 0 };
      for (let y = 0; y < shellPixels.height; y += 1) {
        for (let x = 0; x < shellPixels.width; x += 1) {
          const index = (y * shellPixels.width + x) * 4;
          const [r, g, b, a] = [shellPixels.data.data[index], shellPixels.data.data[index + 1], shellPixels.data.data[index + 2], shellPixels.data.data[index + 3]];
          if (a < 200 || r + g + b > 80) continue;
          if (x / shellPixels.width < 0.66 || y / shellPixels.height < 0.44) continue;
          opening = {
            left: Math.min(opening.left, x / shellPixels.width), top: Math.min(opening.top, y / shellPixels.height),
            right: Math.max(opening.right, x / shellPixels.width), bottom: Math.max(opening.bottom, y / shellPixels.height),
          };
        }
      }
      const pilotPixels = await sample(pilot);
      let head = { left: 1, top: 1, right: 0, bottom: 0 };
      for (let y = 0; y < pilotPixels.height; y += 1) {
        for (let x = 0; x < pilotPixels.width; x += 1) {
          if (pilotPixels.data.data[(y * pilotPixels.width + x) * 4 + 3] < 24) continue;
          head = {
            left: Math.min(head.left, x / pilotPixels.width), top: Math.min(head.top, y / pilotPixels.height),
            right: Math.max(head.right, x / pilotPixels.width), bottom: Math.max(head.bottom, y / pilotPixels.height),
          };
        }
      }
      // Where the pilot box puts that alpha box, in shell-sprite fractions.
      const box = { left: parseFloat(pilot.style.left) / 100, top: parseFloat(pilot.style.top) / 100, size: parseFloat(pilot.style.width) / 100 };
      const placed = {
        left: box.left + head.left * box.size, right: box.left + head.right * box.size,
        top: box.top + head.top * box.size, bottom: box.top + head.bottom * box.size,
      };
      return { opening, placed, covered: (opening.right - opening.left) * (opening.bottom - opening.top) };
    });
    const slack = 0.012;
    check(Boolean(seat) && seat.placed.left >= seat.opening.left - slack && seat.placed.right <= seat.opening.right + slack
      && seat.placed.top >= seat.opening.top - slack && seat.placed.bottom <= seat.opening.bottom + slack,
      'the bust stays inside the dark area around the painted port, not over the brass ring',
      seat ? `bust ${seat.placed.left.toFixed(3)},${seat.placed.top.toFixed(3)}-${seat.placed.right.toFixed(3)},${seat.placed.bottom.toFixed(3)} vs port ${seat.opening.left.toFixed(3)},${seat.opening.top.toFixed(3)}-${seat.opening.right.toFixed(3)},${seat.opening.bottom.toFixed(3)}` : 'no composite');
    check(Boolean(seat) && (seat.opening.right - seat.opening.left) * (seat.opening.bottom - seat.opening.top) > 0.02,
      'the measured port covers a plausible share of the shell', seat ? `${(seat.covered * 100).toFixed(1)}% of the sprite` : 'none');
  }
  check(geometry?.pilotInside === true, 'the pilot image stays inside the capsule silhouette');
  await page.locator('.selected-capsule').screenshot({ path: join(artifacts, 'art-1b-capsule-closeup.png') });

  // Swapping rider and capsule has to swap both painted layers.
  await page.locator('.rider-option').nth(2).click();
  await page.locator('.capsule-option').nth(1).click();
  await page.waitForTimeout(800);
  const swapped = await page.evaluate(() => {
    const shell = document.querySelector('.selected-capsule .racer-shell');
    const pilot = document.querySelector('.selected-capsule .racer-pilot');
    return {
      shell: (shell?.getAttribute('src') ?? '').split('/').pop(), pilot: (pilot?.getAttribute('src') ?? '').split('/').pop(),
      ready: Boolean(shell && shell.naturalWidth > 0 && pilot && pilot.naturalWidth > 0),
    };
  });
  check(swapped.shell === 'springsteel-shell.png' && swapped.pilot === 'grub-pilot.png' && swapped.ready,
    'choosing another rider and capsule swaps both painted layers', JSON.stringify(swapped));
  await page.locator('.rider-option').nth(0).click();
  await page.locator('.capsule-option').nth(0).click();
  await page.waitForTimeout(500);

  // Capsule picker: all three painted shells.
  const capsules = await page.evaluate(() => [...document.querySelectorAll('.capsule-options img')].map((image) => image.naturalWidth));
  check(capsules.length === 3 && capsules.every((width) => width > 0), 'all three capsule shells decode', JSON.stringify(capsules));

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
  const hudIcons = await page.evaluate(() => [...document.querySelectorAll('.air-supplies img')].map((image) => image.naturalWidth));
  check(hudIcons.length >= 3 && hudIcons.every((width) => width > 0), 'HUD supply icons are the painted PNGs', JSON.stringify(hudIcons));
  await page.screenshot({ path: join(artifacts, 'art-3-grid.png') });

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-flying'), null, { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(artifacts, 'art-4-race.png') });
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(400);

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

  // The workshop sprite lab must offer the art that is actually used in the game.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'THE WORKSHOP' }).click();
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
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'MAIN MENU' }).click();
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
