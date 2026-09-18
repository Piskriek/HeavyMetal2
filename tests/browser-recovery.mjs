/**
 * Browser-level verification of the Part 4.1 reload-recovery flow.
 *
 * Serves the production build in `dist/` (run `npm run build` first), launches the
 * bundled headless Chromium, and drives the real UI: start a cup, launch a race,
 * reload mid-round, resume, and view a completed cup. Screenshots and a TAP log are
 * written to `tests/artifacts/` (gitignored).
 *
 * Usage: node scripts/browser-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import { test } from 'node:test';

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
const report = (ok, name, detail = '') => {
  tap.push(`${ok ? 'ok' : 'not ok'} - ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? ` :: ${detail}` : ''}`);
};
const failures = [];

async function openPage(context, { seed, plugins } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  if (seed) await page.addInitScript(seed);
  if (plugins) await page.addInitScript(plugins);
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });
  return { page, errors };
}

const sessionDoc = (session, phase) => JSON.stringify({ version: 1, revision: 4, savedAt: new Date().toISOString(), phase, draft: session.setup, session });
const standings = (playerPosition) => {
  const definitions = [
    { id: 0, name: 'YOU', color: '#f0a15b', lane: 2 }, { id: 1, name: 'GRUB', color: '#87d7ba', lane: 0 },
    { id: 2, name: 'NIX', color: '#b7a0e8', lane: 1 }, { id: 3, name: 'RIVET', color: '#e4cc77', lane: 3 },
  ];
  const placements = new Map([[0, playerPosition]]);
  let next = 1;
  for (const id of [1, 2, 3]) { if (next === playerPosition) next++; placements.set(id, next++); }
  return definitions.map((definition) => ({
    ...definition, position: placements.get(definition.id), distance: 15000, finished: true, recovering: false,
    finishTime: 400 + placements.get(definition.id) * 3, loadout: { rider: 'rivet', capsule: 'iron' },
  }));
};

const completedCup = (() => {
  const setup = { mode: 'tournament', course: 'ridge', loadout: { rider: 'rivet', capsule: 'iron' }, difficulty: 'racer', customPhysics: false };
  const rounds = ['ridge', 'boomtown', 'sheep'];
  const results = rounds.map((course, round) => ({
    id: `cup-${round}`, distance: 15000, topSpeed: 500, score: 9000, sheep: 1, explosions: 2, loops: 0, course,
    date: new Date().toISOString(), completed: true, trackLength: 15000, position: 1, raceTime: 401, opponent: undefined,
    opponents: standings(1), sessionId: 'cup-session', mode: 'tournament', round, loadout: setup.loadout,
    difficulty: 'racer', pickups: 1, shieldsUsed: 0, bumps: 3,
  }));
  return { id: 'cup-session', setup, rounds, round: 2, roster: [], results };
})();

try {
  // A: a fresh browser starts in the setup phase with no invented event.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const { page } = await openPage(context);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-rally-session-v1') ?? 'null'));
    report(Boolean(stored) && stored.phase === 'setup' && stored.session === null, 'fresh load stores an explicit setup phase', JSON.stringify(stored && { phase: stored.phase, session: stored.session }));
    report(await page.getByRole('button', { name: 'New Game', exact: true }).count() === 1, 'fresh load offers New Game');

    // Start a real cup through the UI.
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await page.getByRole('radio', { name: /Tournament/ }).click();
    await page.getByRole('button', { name: /Choose Your Crew/ }).click();
    await page.getByRole('button', { name: /Set the Race/ }).click();
    await page.getByRole('button', { name: /Enter the Cup/ }).click();
    await page.waitForSelector('.game-stage', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 20000 });
    const started = await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-rally-session-v1') ?? 'null'));
    report(started?.phase === 'grid' && started.session?.round === 0 && started.session.results.length === 0, 'starting a cup persists phase grid, round 0 and an empty result list', JSON.stringify(started && { phase: started.phase, round: started.session?.round }));
    report(JSON.stringify(started?.session?.rounds) === JSON.stringify(['ridge', 'boomtown', 'sheep']), 'the persisted event keeps the Scrapdome round order');
    report(started?.session?.roster?.length === 4, 'the persisted event keeps a four-racer roster');
    await page.screenshot({ path: join(artifacts, 'browser-1-grid.png') });

    // Launch the race and confirm the live phase is persisted. The loading cover owns
    // Enter until dismissed, and a keypress can also land in the render gap after the
    // status flip, so dismiss the cover and retry the launch until the race flies.
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
    await page.waitForTimeout(1400);
    const racing = await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-rally-session-v1') ?? 'null'));
    report(racing?.phase === 'racing', 'launching persists the racing phase', String(racing?.phase));
    await page.screenshot({ path: join(artifacts, 'browser-2-racing.png') });

    // B: reload mid-race -> menu, contextual continue, explicit restart wording.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('main.main-menu', { timeout: 20000 });
    const resume = page.getByRole('button', { name: /Continue Tournament/ });
    report(await resume.count() === 1, 'a reload mid-race offers Continue Tournament');
    const note = await page.locator('.menu-resume-note').textContent();
    report(/was interrupted before the finish|restarts from the starting grid/.test(note ?? ''), 'the menu explains that the interrupted round restarts', note ?? '');
    const layout = await page.evaluate(() => {
      const motto = document.querySelector('.menu-motto')?.getBoundingClientRect();
      const footer = document.querySelector('.menu-footer')?.getBoundingClientRect();
      const actions = document.querySelector('.main-menu-actions')?.getBoundingClientRect();
      return { mottoBottom: motto?.bottom ?? 0, footerTop: footer?.top ?? 0, actionsBottom: actions?.bottom ?? 0 };
    });
    report(layout.mottoBottom <= layout.footerTop + 1 || layout.mottoBottom <= layout.actionsBottom + 2,
      'the recovery note does not push the menu motto into the footer',
      `motto bottom ${Math.round(layout.mottoBottom)} / footer top ${Math.round(layout.footerTop)}`);
    await page.screenshot({ path: join(artifacts, 'browser-3-reloaded-menu.png') });

    await resume.click();
    await page.waitForSelector('.game-stage', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.game-stage')?.className.includes('status-ready'), null, { timeout: 20000 });
    const gridNote = await page.locator('.grid-recovery').textContent().catch(() => '');
    report(/restarts from the starting grid|interrupted/.test(gridNote ?? ''), 'the starting grid repeats the restart warning', gridNote ?? '');
    report(await page.locator('.game-loading').count() === 0, 'the race screen is not stuck behind the loading overlay');
    const afterResume = await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-rally-session-v1') ?? 'null'));
    report(afterResume?.phase === 'grid' && afterResume.session.results.length === 0, 'resuming rewrites the phase to grid without inventing a result');
    await page.screenshot({ path: join(artifacts, 'browser-4-restarted-grid.png') });
    await context.close();
  }

  // C: a completed cup hydrates straight into its standings, with no live engine.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const { page } = await openPage(context, {
      seed: ((doc) => `if (!localStorage.getItem('goblin-test-seed')) { localStorage.setItem('goblin-test-seed', '1'); localStorage.setItem('goblin-rally-session-v1', ${JSON.stringify(doc)}); }`)(sessionDoc(completedCup, 'cup-results')),
    });
    const view = page.getByRole('button', { name: /View Cup Results/ });
    report(await view.count() === 1, 'a completed cup offers View Cup Results');
    await view.click();
    await page.waitForSelector('.round-result', { timeout: 20000 });
    const text = await page.locator('.round-result').textContent();
    report(/Final Cup Standings/.test(text ?? ''), 'the restored results screen shows final cup standings');
    report(/27 pts|9 pts/.test(text ?? ''), 'the restored standings carry the committed points', (text ?? '').slice(0, 120));
    report(await page.locator('.game-loading').count() === 0, 'a committed round never waits on a fresh race engine');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-rally-session-v1') ?? 'null'));
    report(stored?.session?.results?.length === 3, 'restoring a completed cup does not duplicate or drop results', String(stored?.session?.results?.length));
    await page.screenshot({ path: join(artifacts, 'browser-5-cup-results.png') });
    await context.close();
  }

  // D: a corrupt primary falls back to the backup copy and says so.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const backup = sessionDoc({ ...completedCup, results: completedCup.results.slice(0, 1), round: 0 }, 'round-results');
    const { page } = await openPage(context, {
      seed: `if (!localStorage.getItem('goblin-test-seed')) { localStorage.setItem('goblin-test-seed', '1'); localStorage.setItem('goblin-rally-session-v1', '{"version":1,"phase":'); localStorage.setItem('goblin-rally-session-v1-backup', ${JSON.stringify(backup)}); }`,
    });
    const note = await page.locator('.menu-resume-note').textContent().catch(() => '');
    report(/previous good copy/.test(note ?? ''), 'a corrupt primary restores the backup and explains why', note ?? '');
    report(await page.getByRole('button', { name: /View Round Results/ }).count() === 1, 'the backup restores the committed round results view');
    await context.close();
  }

  // E: refused storage is reported instead of silently dropping progress.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const { page } = await openPage(context, {
      plugins: "Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('denied', 'SecurityError'); } });",
    });
    await page.waitForTimeout(400);
    const warning = await page.locator('.menu-storage-warning').textContent().catch(() => '');
    report(/could not be saved|blocking local storage/.test(warning ?? ''), 'denied storage is announced on the menu', warning ?? '');
    report(await page.getByRole('button', { name: 'New Game', exact: true }).count() === 1, 'the game stays playable when storage is denied');
    await page.screenshot({ path: join(artifacts, 'browser-6-storage-denied.png') });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(libraryDir, { recursive: true, force: true });
}

const summary = tap.length ? `${tap.filter((line) => line.startsWith('ok')).length} passed / ${failures.length} failed` : 'no checks ran';
await writeFile(join(artifacts, 'browser-recovery.tap'), `${tap.join('\n')}\n# ${summary}\n`);
console.log(tap.join('\n'));
console.log(`# ${summary}`);
if (failures.length) process.exit(1);
