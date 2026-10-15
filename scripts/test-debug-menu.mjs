/**
 * The debug menu, in the production build (apps/web/dist, NO ?e2e): Esc opens the pause menu, "Debug menu" opens the panel,
 * "Jump to act" reloads from a checkpoint, "Complete this step" moves the chain exactly one step, "Grant" puts 100 ore in the
 * pack and the panel shows the new count, and Esc closes the panel back to the pause menu. The last part starts the Act VI
 * checkpoint (with the e2e switch, to lay a starter base and a fabricator), and checks Instant builds: off is real time
 * (a queued scout is not out after 3 s); on, the queued scout is out within a few seconds, and so is the next one.
 *
 * Run `npm run build` first (the test serves apps/web/dist). Exit code 1 when any check fails.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/debug-menu');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8096;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
};
const shot = (name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`) }).catch(() => {});

const currentStep = () => page.evaluate(() => window.hmPlay?.chain?.().current?.id ?? null);
const isDebugOpen = () => page.locator('[data-testid="debug-menu"]').isVisible().catch(() => false);
const pressEsc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
const readPack = async () => Number((await page.locator('[data-testid="pack-count"]').textContent()) ?? 'NaN');

const dismissCreator = () => page.evaluate(() => {
  const done = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Done'));
  done?.click();
});

/** Opens the debug menu from the game: Esc (the pause menu), then the Debug menu button. */
async function openDebugFromGame() {
  if (!(await page.locator('[data-testid="debug-open"]').isVisible().catch(() => false))) await pressEsc();
  await page.locator('[data-testid="debug-open"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="debug-open"]').click();
  await page.locator('[data-testid="debug-menu"]').waitFor({ state: 'visible', timeout: 10000 });
}

try {
  // 1. a fresh profile, the production build: the main menu, then Expedition
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  await expBtn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(400);
  check('production build: no e2e switch, the game is ready', (await page.evaluate(() => typeof window.__dev)) === 'undefined');

  // 2. Esc opens the pause menu; it has a Debug menu button; the button opens the panel
  await openDebugFromGame();
  check('Esc, then Debug menu, opens the debug panel', await isDebugOpen());
  await shot('01-panel-lab');
  await pressEsc();
  check('Esc closes the debug panel back to the pause menu', !(await isDebugOpen()) && (await page.locator('.play-pause button', { hasText: 'Resume' }).isVisible()));

  // 3. Jump to act: Act IV (the drill) reloads from its checkpoint and the chain sits at A4-01
  await openDebugFromGame();
  const cpButtons = await page.locator('[data-checkpoint]').count();
  check('Jump to act lists the checkpoints from index.json', cpButtons >= 5, `${cpButtons} buttons`);
  await page.locator('[data-checkpoint="act4-start"]').click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  const cont = page.locator('.sm-menu button', { hasText: 'Continue' });
  if (await cont.count()) await cont.first().click();
  else await page.locator('.sm-menu button', { hasText: 'Expedition' }).first().click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(400);
  const before = await currentStep();
  check('Jump to act: the checkpoint loads and the chain is on A4-01', before === 'A4-01', `step ${before}`);

  // 4. Complete this step: the chain advances exactly one step
  await openDebugFromGame();
  const stepText = await page.locator('[data-testid="dbg-step"]').textContent();
  check('the panel shows the current step id and title', (stepText ?? '').includes('A4-01'), stepText ?? '');
  await page.locator('[data-testid="dbg-complete-step"]').click();
  await page.waitForTimeout(250);
  const after = await currentStep();
  check('Complete this step advances the chain one step (A4-01 to A4-01b)', after === 'A4-01b', `step ${after}`);
  await shot('02-step-completed');

  // 5. Grant 100 ore: the pack count rises by exactly 100
  const packBefore = await readPack();
  await page.locator('[data-testid="dbg-item"]').selectOption('ore');
  await page.locator('[data-testid="dbg-amount"]').fill('100');
  await page.locator('[data-testid="dbg-grant"]').click();
  await page.waitForTimeout(250);
  const packAfter = await readPack();
  check('Grant 100 ore: the pack count shows +100', packAfter === packBefore + 100, `${packBefore} to ${packAfter}`);
  const toast = await page.locator('[data-testid="dbg-toast"]').textContent().catch(() => '');
  check('a grant shows a confirmation in the panel', (toast ?? '').includes('100'), toast ?? '');
  await shot('03-granted-ore');

  // 6. Esc closes the panel
  await pressEsc();
  check('Esc closes the panel', !(await isDebugOpen()));

  // 7. Instant builds: off by default; on, a queued scout print is out within a few seconds. The scout needs a fabricator,
  // so this run starts the Act VI checkpoint (the e2e switch, as the base-building test does) and installs one on its hardpoint.
  await page.goto(`${base}/?checkpoint=act6-start&e2e`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  const cont6 = page.locator('.sm-menu button', { hasText: 'Continue' });
  if (await cont6.count()) await cont6.first().click();
  else await page.locator('.sm-menu button', { hasText: 'Expedition' }).first().click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(400);

  const prep = await page.evaluate(() => {
    const api = window.hmPlay?.base;
    const scene = window.__playScene;
    if (!api || !scene) return { ok: false, why: 'no base hook' };
    const stock = [
      { item: 'ore', n: 1200 }, { item: 'prim-chassis', n: 40 }, { item: 'prim-beam', n: 40 }, { item: 'prim-column', n: 40 },
      { item: 'prim-cube', n: 40 }, { item: 'map-basalt', n: 40 }, { item: 'map-quartz', n: 40 },
    ];
    api.apply({ t: 'grant', stock });
    if (api.world().stage < 2) { window.hmPlay.raise?.(2); api.apply({ t: 'stage', stage: 2 }); }
    const p = scene.debug.position();
    const at = { x: Math.round(p.x), z: Math.round(p.z) };
    // the checkpoint's base is empty: found a starter slab here, then a hardpoint pad on it (the base-building test's sequence)
    if (!api.world().base.pieces.some((q) => q.kind === 'hardpoint')) {
      const f = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: at.x, cz: at.z, yaw: 0 });
      const fr = f.events.find((e) => e.type === 'refused');
      if (fr) return { ok: false, why: `found refused: ${JSON.stringify(fr).slice(0, 160)}` };
      const sId = api.world().base.structures[0]?.id;
      if (sId === undefined) return { ok: false, why: 'no structure after found' };
      // the starter kit holds cell (0, 0). A hardpoint pad at (i, j) stands on foundations at (i, j+1), (i+1, j) and (i+1, j+1)
      // (structure's needs-pad rule), so those go down first, then the pad (the base-building test's sequence)
      const why = [];
      let placed = false;
      for (const [i, j] of [[1, 0], [0, 1], [2, 0]]) {
        for (const [fi, fj] of [[i, j + 1], [i + 1, j], [i + 1, j + 1]]) {
          api.apply({ t: 'place', at, blueprint: 'bp:starter', piece: { s: sId, kind: 'foundation', i: fi, j: fj, k: 0, r: 0 } });
        }
        const pl = api.apply({ t: 'place', at, blueprint: 'bp:chassis:basalt', piece: { s: sId, kind: 'hardpoint', i, j, k: 0, r: 0 } });
        const pr = pl.events.find((e) => e.type === 'refused');
        if (!pr) { placed = true; break; }
        why.push(`${i},${j}: ${pr.why}`);
      }
      if (!placed) return { ok: false, why: `no hardpoint cell: ${why.join('; ')}`.slice(0, 400) };
    }
    const hp = api.world().base.pieces.find((q) => q.kind === 'hardpoint');
    if (!hp) return { ok: false, why: 'no hardpoint after placing one' };
    const r = api.apply({ t: 'install', at, hardpoint: hp.id, kind: 'fabricator' });
    const refused = r.events.find((e) => e.type === 'refused');
    if (refused) return { ok: false, why: `fabricator not installed: ${JSON.stringify(refused).slice(0, 160)}` };
    return { ok: true, stage: api.world().stage };
  });
  check('the Act VI checkpoint: a fabricator is installed on the hardpoint (e2e hook)', prep.ok, prep.why ?? `stage ${prep.stage}`);
  if (!prep.ok) throw new Error(prep.why);

  await openDebugFromGame();
  const instantState = () => page.locator('[data-testid="dbg-instant-state"]').textContent();
  const tagShown = () => page.locator('[data-testid="instant-builds-tag"]').isVisible().catch(() => false);
  check('Instant builds is off by default, with no tag', (await instantState()) === 'Off' && !(await tagShown()));
  const scouts = () => page.evaluate(() => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length);
  /** Waits until the scout count rises above `before`; returns the seconds it took, or null after `limitMs`. */
  const waitForScout = async (before, limitMs) => {
    const start = Date.now();
    while (Date.now() - start < limitMs) {
      if ((await scouts()) > before) return (Date.now() - start) / 1000;
      await page.waitForTimeout(100);
    }
    return null;
  };

  // the control: with the switch off, a queued scout takes its real two minutes, so it is not out after 3 s
  const scoutsA = await scouts();
  await page.locator('[data-vehicle="scout"]').click();
  await page.waitForTimeout(3000);
  check('control: with Instant builds off, a queued scout is not out after 3 s (real time)', (await scouts()) === scoutsA);

  // the switch on: the queued scout finishes at once
  await page.locator('[data-testid="dbg-instant"]').click();
  await page.waitForTimeout(200);
  check('Instant builds turns on: the state reads On and the INSTANT BUILDS tag shows', (await instantState()) === 'On' && (await tagShown()));
  await shot('04-instant-on');
  const outA = await waitForScout(scoutsA, 8000);
  check('turning Instant builds on: the queued scout is out within a few seconds', outA !== null, outA !== null ? `${outA.toFixed(1)} s` : 'not out after 8 s');

  // the owner's check: on, queue a scout print, and it is out within a few seconds
  const scoutsB = await scouts();
  await page.locator('[data-vehicle="scout"]').click();
  const outB = await waitForScout(scoutsB, 8000);
  check('with Instant builds on, a queued scout print is out within a few seconds', outB !== null, outB !== null ? `${outB.toFixed(1)} s` : 'not out after 8 s');
  await shot('05-instant-scout-out');
  await pressEsc();
  check('the tag stays up with the panel closed', await tagShown());

  check('no console errors or page errors in the run', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the run completes', false, String(err?.message ?? err).split('\n')[0]);
  await shot('99-failure');
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
