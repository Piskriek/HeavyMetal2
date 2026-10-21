/**
 * Plan 39 section 6 (Aq): the species loop. In the lab, the bench's Species page shows a live tree, thumbnails and a hover
 * try-on; it prints Autumn oak onto a blank (a blank and the bench's time, no raw stock); the cartridge loads into the
 * rifle. On the plot, a tap of Apply at a tree regrows that tree as the preset; a hold regrows its kind within 12 m; the
 * trees survive a reload; and a seventh preset is refused at the cap.
 *   npm run build && node --import tsx scripts/test-species-cartridge.mjs
 * Shots in shots-run/species/ (gitignored). Exit code 1 when a check fails.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/species');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8201;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('species-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('species-test-booted', '1');
    }
  } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const boot = async () => {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
};
const toPlanet = async () => {
  await page.evaluate(() => { window.hmPlay.teleportPlanet(); window.hmPlay.setPaused?.(false); window.hmPlay.setLocked?.(true); });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 30000 });
  await page.evaluate(() => window.hmPlay.setStage(6));
  await frames(40);
};
/** Walks a grid round the gate until the beam's aim names a tree; returns the hit and where the player stood. */
const findTree = async (want = () => true) => {
  for (let x = -60; x <= 60; x += 6) {
    for (let z = -60; z <= 60; z += 6) {
      for (let k = 0; k < 8; k++) {
        const yaw = (k / 8) * Math.PI * 2;
        await page.evaluate(([xx, zz, yy]) => window.__playScene.debug.teleport('planet', xx, zz, yy, -0.05), [x, z, yaw]);
        await frames(2);
        const hit = await page.evaluate(() => window.__dev.aimTree());
        if (hit && want(hit)) return { hit, at: [x, z, yaw] };
      }
    }
  }
  return null;
};

try {
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });

  // ---- the bench's Species page
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator('[data-testid="bench-tab-species"]').click();
  await page.waitForSelector('[data-testid="bench-species"]');
  check('the Species page shows a live tree, with its height', await page.locator('[data-testid="species-preview"] canvas').isVisible()
    && /m tall/.test((await page.locator('.species-preview figcaption').textContent()) ?? ''));
  const thumbs = await page.waitForFunction(() => document.querySelectorAll('.bench-species .bench-parts-gens img').length, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => 0);
  check('every named tree carries a thumbnail', thumbs === 6, `${thumbs} of 6`);
  await page.locator('[data-testid="bench-species-hydro-birch"]').hover();
  const trying = await page.locator('[data-testid="species-preview-trying"]').textContent().catch(() => '');
  check('hovering a named tree tries it on in the preview', /hydro birch/i.test(trying ?? ''), trying ?? '');
  await page.locator('[data-testid="bench-species-autumn-oak"]').click();
  await page.locator('[data-testid="bench-tree-height"]').fill('12');
  await page.screenshot({ path: path.join(shotsDir, 'species-page.png') });
  await page.locator('[data-testid="bench-print-species"]').click();
  await page.evaluate(() => window.__dev.stepLab(25));
  const cart = await page.evaluate(() => window.hmPlay.state().lab.cartridges.find((c) => c.kind === 'species') ?? null);
  check('the bench prints a species cartridge: an oak with the autumn canopy, 12 m', !!cart && cart.species.species === 'oak' && cart.species.params.tint === 1 && cart.species.params.height === 12,
    cart ? `${cart.name}: ${JSON.stringify(cart.species.params)}` : 'none');
  await page.evaluate(() => window.hmPlay.openLabPanel(null));
  check('the species cartridge loads into the rifle port', await page.evaluate((id) => window.__dev.loadCartridge(id), cart?.id) && (await page.evaluate(() => window.__dev.port()?.species?.species)) === 'oak');

  // ---- on the plot: a tap regrows one tree
  await toPlanet();
  const first = await findTree();
  check('the beam can aim at a tree on the plot', !!first, first ? `${first.hit.kind} at ${first.hit.place}` : 'none');
  const tapped = first ? await page.evaluate(() => window.__dev.applySpecies(false)) : 0;
  await frames(5);
  const again = first ? await page.evaluate(() => window.__dev.aimTree()) : null;
  check('a tap regrows that tree as the cartridge\'s oak, and only it', tapped === 1 && again?.place === first?.hit.place && again?.species === 'oak' && again?.kind.startsWith('oak:12,'),
    JSON.stringify(again));
  await page.screenshot({ path: path.join(shotsDir, 'regrown-tree.png') });

  // ---- a hold regrows its kind nearby
  const other = await findTree((h) => h.place !== first?.hit.place && !h.kind.startsWith('oak:12,'));
  const like = other ? await page.evaluate((p) => window.__playScene.treesLike(p, 12).length, other.hit.place) : 0;
  const held = other ? await page.evaluate(() => window.__dev.applySpecies(true)) : 0;
  check('a hold regrows every tree of that kind within 12 m', !!other && held === like && held >= 1, `${held} of ${like}`);

  // ---- a reload keeps them
  const saved = await page.evaluate(() => Object.keys(window.__dev.treeOverrides()).length);
  await boot();
  await toPlanet();
  await page.evaluate(([x, z, yaw]) => window.__playScene.debug.teleport('planet', x, z, yaw, -0.05), first?.at ?? [0, 0, 0]);
  await frames(3);
  const back = await page.evaluate(() => window.__dev.aimTree());
  check('after a reload the regrown trees are still oaks', saved === 1 + held && back?.place === first?.hit.place && back?.kind.startsWith('oak:12,'), `${saved} saved; ${JSON.stringify(back)}`);

  // ---- the cap: with six other presets on the plot, the oak would be a seventh, so the shot is refused
  await page.evaluate(() => {
    const six = {};
    for (let i = 0; i < 6; i++) six[`${i},0`] = { species: 'pine', params: { height: 4 + i } };
    window.__dev.setTreeOverrides(six);
  });
  await frames(5);
  const refused = await page.evaluate(() => window.__dev.applySpecies(false));
  const unchanged = await page.evaluate(() => window.__dev.aimTree());
  check('at the cap of six presets, a seventh is refused and the tree stays as it is', refused === 0 && !unchanged?.kind.startsWith('oak:12,')
    && Object.keys(await page.evaluate(() => window.__dev.treeOverrides())).length === 6, JSON.stringify(unchanged));

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} species cartridge checks pass`);
process.exit(failed ? 1 : 0);
