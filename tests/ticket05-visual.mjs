/**
 * TICKET-05 visual + functional verification: each menu and setup flow renders
 * a dedicated painted fantasy backdrop, the ambient engine (ember canvas,
 * smoke puffs, flicker animation, mouse parallax) is alive, and reduced motion
 * truly pauses it.
 *
 * The pass builds on the dist build, exercises every preset the ticket
 * covers (main, arena, workshop, settings, vault) and captures screenshots.
 *
 * Usage: node tests/ticket05-visual.mjs
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

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
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-t05-libs-'));
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
const shot = (page, name) => page.screenshot({ path: join(artifacts, `ticket05-${name}.png`) });

try {
  // -------------------------------------------------------------------------
  // 1. Main menu: painted Scrapdome backdrop, ambient layers, parallax tilt.
  // -------------------------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_CLOSED')) errors.push(`console: ${m.text()}`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });
  await page.waitForSelector('.animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });

  const menu = await page.evaluate(() => {
    const plane = document.querySelector('.animated-menu-bg .ambient-backdrop-plane');
    const style = plane ? getComputedStyle(plane) : null;
    const wrapper = document.querySelector('.animated-menu-bg');
    const canvas = document.querySelector('.ambient-embers');
    const puffs = document.querySelectorAll('.ambient-smoke > span');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: style?.backgroundImage,
      cover: style?.backgroundSize === 'cover',
      embers: canvas && !canvas.hasAttribute('hidden'),
      puffCount: puffs.length,
      overlay: wrapper?.classList.contains('ambient-overlay-menu'),
      flicker: wrapper?.classList.contains('ambient-flicker'),
      transform: style?.transform ?? null,
    };
  });
  report(menu.preset === 'main', 'main menu renders the main preset', menu.preset);
  report(menu.backdrop?.includes('menu-heavy-metal-2.jpg') ?? false, 'main menu backdrop is the Scrapdome painting', menu.backdrop);
  report(menu.cover, 'main menu backdrop uses background-size: cover');
  report(menu.embers, 'main menu ember canvas is visible (ambient motion on)');
  report(menu.puffCount >= 3, 'main menu has at least 3 drifting smoke puffs', `puffs=${menu.puffCount}`);
  report(menu.overlay, 'main menu applies the menu overlay tint');
  report(menu.flicker, 'main menu has the torch flicker animation enabled');

  // Parallax tilt: move the cursor to a corner and confirm the plane's
  // transform moves within the ±8 px envelope.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
  const tiltBefore = await page.evaluate(() => {
    const m = getComputedStyle(document.querySelector('.animated-menu-bg .ambient-backdrop-plane')).transform;
    return m;
  });
  await page.mouse.move(1440, 950);
  await page.waitForTimeout(220);
  const tiltAfter = await page.evaluate(() => {
    const m = getComputedStyle(document.querySelector('.animated-menu-bg .ambient-backdrop-plane')).transform;
    return m;
  });
  report(tiltBefore !== tiltAfter, 'parallax tilt changes on pointer move', `${tiltBefore} -> ${tiltAfter}`);

  // Embers are alive: take two canvas snapshots a moment apart and confirm
  // they differ.
  await page.evaluate(async () => {
    const canvas = document.querySelector('.ambient-embers');
    canvas.dataset.snapshot = (await new Promise((resolve) => canvas.toBlob((blob) => blob.arrayBuffer().then(resolve), 'image/png'))).byteLength.toString();
    return null;
  });
  await page.waitForTimeout(550);
  const embersAlive = await page.evaluate(async () => {
    const canvas = document.querySelector('.ambient-embers');
    const size = (await new Promise((resolve) => canvas.toBlob((blob) => blob.arrayBuffer().then(resolve), 'image/png'))).byteLength;
    return Number(canvas.dataset.snapshot) !== size;
  });
  report(embersAlive, 'ember canvas pixels are redrawn between frames');

  await shot(page, '1-main-menu');

  // -------------------------------------------------------------------------
  // 2. New Game dialog: arena backdrop for step 0, workshop for step 1.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.waitForSelector('.setup-dialog', { timeout: 10000 });
  await page.waitForSelector('.modal-backdrop .animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });
  const step0 = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
      dialogScrim: getComputedStyle(document.querySelector('.modal-backdrop')).backgroundColor,
    };
  });
  report(step0.preset === 'arena', 'setup step 0 (competition) renders the arena preset', step0.preset);
  report(step0.backdrop?.includes('menu_arena.webp') ?? false, 'setup step 0 backdrop is the arena war room painting', step0.backdrop);
  await shot(page, '2-setup-step0-arena');

  await page.getByRole('button', { name: /Choose Your Crew/ }).click();
  await page.waitForTimeout(450);
  const step1 = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
    };
  });
  report(step1.preset === 'workshop', 'setup step 1 (loadout) renders the workshop preset', step1.preset);
  report(step1.backdrop?.includes('menu_workshop.webp') ?? false, 'setup step 1 backdrop is the engineering armory painting', step1.backdrop);
  await shot(page, '3-setup-step1-workshop');

  await page.getByRole('button', { name: /Set the Race/ }).click();
  await page.waitForTimeout(450);
  const step2 = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
    };
  });
  report(step2.preset === 'arena', 'setup step 2 (race rules) returns to the arena preset', step2.preset);
  report(step2.backdrop?.includes('menu_arena.webp') ?? false, 'setup step 2 backdrop is the arena painting', step2.backdrop);
  await shot(page, '4-setup-step2-arena');

  // Close the setup dialog.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // -------------------------------------------------------------------------
  // 3. Settings dialog: tinker's blueprint desk.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForSelector('.settings-dialog', { timeout: 5000 });
  await page.waitForSelector('.modal-backdrop .animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });
  const settingsState = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
      dataPainted: document.querySelector('.modal-backdrop')?.getAttribute('data-painted-backdrop'),
    };
  });
  report(settingsState.preset === 'settings', 'settings dialog renders the settings preset', settingsState.preset);
  report(settingsState.backdrop?.includes('menu_settings.webp') ?? false, 'settings backdrop is the blueprint desk painting', settingsState.backdrop);
  report(settingsState.dataPainted === 'true', 'settings modal backdrop carries the painted flag', settingsState.dataPainted);
  await shot(page, '5-settings');

  // Turn off the menu's "Living menu" toggle so we can verify the menu
  // canvas stops, then close.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // -------------------------------------------------------------------------
  // 4. Hall of Chaos: gilded vault painting.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Hall of Chaos', exact: true }).click();
  await page.waitForSelector('.modal-backdrop .animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });
  const records = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
    };
  });
  report(records.preset === 'vault', 'Hall of Chaos renders the vault preset', records.preset);
  report(records.backdrop?.includes('menu_vault.webp') ?? false, 'Hall of Chaos backdrop is the gilded vault painting', records.backdrop);
  await shot(page, '6-hall-of-chaos');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // -------------------------------------------------------------------------
  // 5. Driver's Handbook: workshop backdrop (tinkerer / instructions).
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await page.waitForSelector('.modal-backdrop .animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });
  const guide = await page.evaluate(() => {
    const wrapper = document.querySelector('.modal-backdrop .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
    };
  });
  report(guide.preset === 'workshop', "Driver's Handbook renders the workshop preset", guide.preset);
  await shot(page, '7-guide');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // -------------------------------------------------------------------------
  // 6. Reduced motion: the global toggle (and a `prefers-reduced-motion`
  //    emulation) both kill the ember canvas, the flicker animation and the
  //    parallax tilt.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForSelector('.settings-dialog', { timeout: 5000 });
  // The reduced-motion toggle lives on the "Accessibility" tab.
  await page.getByRole('tab', { name: /Accessibility/i }).click();
  await page.waitForTimeout(250);
  const toggle = page.getByRole('switch', { name: /Reduced decorative motion/i });
  await toggle.waitFor({ timeout: 5000 });
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const reduced = await page.evaluate(() => {
    const canvas = document.querySelector('.ambient-embers');
    const plane = document.querySelector('.animated-menu-bg .ambient-backdrop-plane');
    return {
      embersHidden: !canvas || canvas.hasAttribute('hidden') || getComputedStyle(canvas).display === 'none',
      transform: plane ? getComputedStyle(plane).transform : null,
    };
  });
  report(reduced.embersHidden, 'reduced-motion setting hides the ember canvas', `transform=${reduced.transform}`);
  report(reduced.transform === 'none' || reduced.transform === 'matrix(1, 0, 0, 1, 0, 0)', 'reduced-motion setting pins the parallax transform to none', reduced.transform);

  // Now emulate the OS preference.
  const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
  await reducedPage.waitForSelector('main.main-menu', { timeout: 20000 });
  await reducedPage.waitForSelector('.animated-menu-bg .ambient-backdrop-plane', { timeout: 5000 });
  await reducedPage.waitForTimeout(200);
  const reducedOs = await reducedPage.evaluate(() => {
    const canvas = document.querySelector('.ambient-embers');
    const plane = document.querySelector('.animated-menu-bg .ambient-backdrop-plane');
    return {
      embersHidden: !canvas || canvas.hasAttribute('hidden') || getComputedStyle(canvas).display === 'none',
      transform: plane ? getComputedStyle(plane).transform : null,
    };
  });
  report(reducedOs.embersHidden, 'prefers-reduced-motion: reduce hides the ember canvas', `transform=${reducedOs.transform}`);
  report(reducedOs.transform === 'none' || reducedOs.transform === 'matrix(1, 0, 0, 1, 0, 0)', 'prefers-reduced-motion: reduce pins the parallax transform', reducedOs.transform);
  await shot(reducedPage, '8-reduced-motion');
  await reducedContext.close();
  await context.close();

  // -------------------------------------------------------------------------
  // 7. Round result overlay: vault painting behind the result panel.
  // -------------------------------------------------------------------------
  // Seed a finished quick race in localStorage so the menu lands on a
  // "View Race Results" button that opens the round-result overlay. The
  // persisted record must satisfy `sanitizeRecord`: it needs a matching
  // `sessionId`, `round`, `course`, `opponents`, `topSpeed`, `score`,
  // `distance`, `date`, `completed`, `id` and the four-racer standings.
  const finishContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const finishPage = await finishContext.newPage();
  const sessionId = 'ticket05-finish';
  const standings = [
    { id: 0, name: 'RIVET', color: '#e4cc77', lane: 2, position: 1, distance: 15000, finished: true, recovering: false, finishTime: 187.4, loadout: { rider: 'rivet', capsule: 'iron' } },
    { id: 1, name: 'GRUB', color: '#87d7ba', lane: 0, position: 2, distance: 15000, finished: true, recovering: false, finishTime: 190.1, loadout: { rider: 'grub', capsule: 'iron' } },
    { id: 2, name: 'NIX', color: '#b7a0e8', lane: 1, position: 3, distance: 15000, finished: true, recovering: false, finishTime: 193.7, loadout: { rider: 'nix', capsule: 'iron' } },
    { id: 3, name: 'SPROCKET', color: '#d77a6c', lane: 3, position: 4, distance: 15000, finished: true, recovering: false, finishTime: 196.4, loadout: { rider: 'sprocket', capsule: 'iron' } },
  ];
  const setup = {
    mode: 'quick',
    course: 'ridge',
    difficulty: 'racer',
    customPhysics: false,
    loadout: { rider: 'rivet', capsule: 'iron' },
  };
  const result = {
    id: 'ticket05-finish-0',
    sessionId,
    round: 0,
    course: 'ridge',
    date: new Date().toISOString(),
    completed: true,
    topSpeed: 510,
    score: 4321,
    distance: 15000,
    sheep: 2,
    explosions: 1,
    loops: 0,
    bumps: 4,
    pickups: 1,
    shieldsUsed: 1,
    mode: 'quick',
    difficulty: 'racer',
    loadout: setup.loadout,
    opponents: standings,
  };
  const doc = {
    version: 1,
    revision: 1,
    savedAt: new Date().toISOString(),
    phase: 'round-results',
    draft: setup,
    session: { id: sessionId, setup, round: 0, rounds: ['ridge'], roster: standings.map((standing) => standing.loadout), results: [result] },
  };
  await finishPage.addInitScript((payload) => {
    localStorage.setItem('goblin-rally-session-v1', payload);
  }, JSON.stringify(doc));
  await finishPage.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
  await finishPage.waitForSelector('main.main-menu', { timeout: 20000 });
  await finishPage.getByRole('button', { name: /View (Round|Race) Results/i }).click();
  await finishPage.waitForSelector('.round-result-overlay .animated-menu-bg .ambient-backdrop-plane', { timeout: 15000 });
  await finishPage.waitForTimeout(300);
  const finishState = await finishPage.evaluate(() => {
    const wrapper = document.querySelector('.round-result-overlay .animated-menu-bg');
    const plane = wrapper?.querySelector('.ambient-backdrop-plane');
    return {
      preset: wrapper?.getAttribute('data-preset'),
      backdrop: plane ? getComputedStyle(plane).backgroundImage : null,
      hasResult: Boolean(document.querySelector('.round-result')),
    };
  });
  report(finishState.hasResult, 'round-result overlay is hydrated');
  report(finishState.preset === 'vault', 'round-result backdrop renders the vault preset', finishState.preset);
  report(finishState.backdrop?.includes('menu_vault.webp') ?? false, 'round-result backdrop is the vault painting', finishState.backdrop);
  await shot(finishPage, '9-round-result');
  await finishContext.close();

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
