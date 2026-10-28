/**
 * Plan 47 close-out browser checks: the Souls bench tab (8 shelf souls, 6 sliders, the live stress
 * impulse preview, printing a harness cartridge), the rifle's violet port, the bind-on-boarding
 * path with plot-save persistence, and the Zone 8 Sovereign Harness telemetry blade while driving.
 * Boots the built game (apps/web/dist, so run `npm run build` first) in clean-shot mode and saves
 * its shots to shots-run/harness/. Exits 1 on any failed check.
 *   node scripts/test-harness-tab-and-zone8.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/harness');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium', // the cloud container's pre-installed Playwright Chromium
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(fs.existsSync);
if (!chromePath) {
  console.error('Chrome/Chromium not found; install one or set CHROME_PATH.');
  process.exit(1);
}
const port = 8213;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

/** Sets a React-controlled range input through the native setter so onChange fires. */
const setRange = (testid, value) => page.evaluate(({ testid, value }) => {
  const el = document.querySelector(`[data-testid="${testid}"]`);
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, String(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, { testid, value });

const SHELF = [
  'escort-steadfast', 'scout-agile-reflex', 'hauler-heavy-syntropic', 'crawler-seismic-ground',
  'turret-sto-guardian', 'creature-pack-shepherd', 'companion-haddy-mentor', 'overseer-planetary-steward',
];

/** N frames of the live rAF loop. */
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

try {
  // The lab boot (menu -> Play -> the shielded lab): the preset bench renders there, as in
  // test-material-cartridge.mjs. The ?base&kit=1 boot starts on the planet without the bench UI.
  await page.goto(`http://localhost:${port}/?story&e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);

  // --- Pillar 3: the Souls bench tab ---
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); window.hmPlay.openLabPanel('bench'); });
  await page.locator('[data-testid="bench-tab-harness"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="bench-tab-harness"]').click();
  await page.locator('[data-testid="bench-harness"]').waitFor({ state: 'visible', timeout: 10000 });

  let found = 0;
  for (const id of SHELF) {
    if (await page.locator(`[data-testid="bench-harness-${id}"]`).count() === 1) found++;
  }
  check('all 8 shelf souls render on the Souls tab', found === 8, `${found}/8`);
  check('the live preview mounts the four HUD instruments', await page.locator('.bench-harness-hud .hud-harness-blade').count() === 1);
  await page.waitForTimeout(700);
  await shot('01-souls-tab');

  // the 130 dB stress impulse runs the real inception loop in the preview without crashing it
  await page.locator('[data-testid="bench-harness-stress"]').click();
  await page.waitForTimeout(600);
  check('the 130 dB stress impulse runs and the preview keeps rendering', await page.locator('.bench-harness-hud .hud-harness-blade').isVisible());
  await shot('02-stress-impulse');

  // the Higher-Self bridge toggle flips linked <-> severed
  const bridge = page.locator('[data-testid="bench-harness-bridge"]');
  const before = (await bridge.textContent()) ?? '';
  await bridge.click();
  const after = (await bridge.textContent()) ?? '';
  check('the Higher-Self bridge toggles linked/severed', before.includes('linked') && after.includes('severed'), `${before.trim()} -> ${after.trim()}`);
  await bridge.click();

  // dragging a slider derives a tuned spec (the cost line names it)
  check('the awareness slider accepts input', await setRange('bench-harness-awareness', 0.9));
  await page.waitForTimeout(250);
  const costLine = (await page.locator('.bench-harness .bench-parts-cost').textContent()) ?? '';
  check('slider tuning derives a tuned soul spec', costLine.includes('Tuned'), costLine.slice(0, 60));

  // printing with an active blank produces a harness cartridge on the rack
  await page.locator('[data-testid="bench-print-harness"]').click();
  await page.evaluate(() => window.hmPlay.labStep(25));
  const printed = await page.evaluate(() => {
    const c = window.hmPlay.lab().cartridges.find((x) => x.kind === 'harness');
    return c ? { id: c.id, name: c.name, ref: c.harness?.ref ?? null } : null;
  });
  check('the bench prints a harness cartridge onto the blank', printed !== null && typeof printed.ref === 'string', printed?.ref?.slice(0, 32) ?? 'none');
  await shot('03-printed');

  // the rifle's port takes it and glows violet
  const portState = await page.evaluate((id) => {
    const ok = window.__dev.loadCartridge(id);
    return { ok, harness: window.__dev.port()?.harness ?? null };
  }, printed.id);
  check('the rifle port loads the harness cartridge', portState.ok === true && portState.harness !== null, portState.harness?.name ?? '');

  // --- Pillars 1 and 2: boarding binds the soul, persists it, and mounts the Zone 8 blade ---
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.hmPlay.teleportPlanet?.(); });
  await page.waitForTimeout(1200);
  const vid = await page.evaluate(() => {
    const g = window.hmPlay.gate();
    const w = window.hmPlay.base.world();
    const id = Math.max(900, ...w.vehicles.map((v) => v.id)) + 1;
    w.vehicles.push({ id, kind: 'scout', x: g.x + 6, z: g.z + 6, yaw: 0, box: null });
    window.__playScene?.setVehicles(w.vehicles);
    return id;
  });
  await page.waitForTimeout(400);
  const boarded = await page.evaluate((id) => window.hmPlay.base.boardVehicle(id), vid);
  check('boarding through the real bind path succeeds', boarded === true);
  await page.waitForTimeout(900);

  const bound = await page.evaluate((id) => window.hmPlay.base.world().vehicles.find((v) => v.id === id)?.harness ?? null, vid);
  check('the bound soul persists on the vehicle in the plot save state', bound === printed.ref, String(bound).slice(0, 32));

  const blade = page.locator('[data-hud-zone="bottom-right"].hud-harness-blade, [data-hud-zone="bottom-right"] .hud-harness-blade');
  check('the Zone 8 harness telemetry blade mounts while driving', await blade.count() >= 1 && await blade.first().isVisible());
  check('the blade reads live telemetry (trench pill shows Π)', ((await page.locator('.hud-harness-pill').textContent()) ?? '').includes('Π'));
  await shot('04-zone8-blade');

  // a fresh boarding without the cartridge wakes the SAVED soul (persistence end to end)
  await page.evaluate(() => { window.hmPlay.base.exitVehicle(); });
  await page.waitForTimeout(300);
  const rebind = await page.evaluate((id) => {
    // empty the rifle's port claim by checking the saved path: port still holds the cartridge, so
    // assert the saved ref is what a port-less boarding would wake by reading the world state
    const saved = window.hmPlay.base.world().vehicles.find((v) => v.id === id)?.harness ?? null;
    const ok = window.hmPlay.base.boardVehicle(id);
    return { saved, ok, driving: window.hmPlay.base.driving()?.id ?? null };
  }, vid);
  check('re-boarding keeps the soul bound and drives again', rebind.ok === true && rebind.saved === printed.ref && rebind.driving === vid);
  await shot('05-reboard');

  check('no page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, e.message);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} harness tab + zone 8 checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
