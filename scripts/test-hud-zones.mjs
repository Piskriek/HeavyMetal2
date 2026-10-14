/**
 * TASK-25 browser checks: the nine-zone HUD, the build ribbon, the hologram lock, the aim-gated machine labels and the
 * stage-reactive skin. Boots the built game (apps/web/dist, so run `npm run build` first) in clean-shot mode
 * (?cleanShot=1), asserts each state, and saves its shots to shots-run/hud/. Exits 1 on any failed check.
 *   node scripts/test-hud-zones.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hudZoneViolations } from './e2e-hud-and-luminance-gate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/hud');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.error('Chrome not found; install Chrome or set the path in this script.');
  process.exit(1);
}
const port = 8199;
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
const shot = async (name) => {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
};
const zoneGate = async (step) => {
  const v = await hudZoneViolations(page).catch((e) => [`gate error: ${e.message}`]);
  check(`no zone overlap, no reticle intrusion: ${step}`, v.length === 0, v.join('; '));
};
/** Zone leaves that sit in the centre 60% of the screen (x 20-80%, y 20-80%), leaving out the centre zone's own readouts. */
const centreIntruders = () => page.evaluate(() => {
  const L = innerWidth * 0.2, R = innerWidth * 0.8, T = innerHeight * 0.2, B = innerHeight * 0.8;
  return [...document.querySelectorAll('[data-hud-zone]')].filter((el) => {
    if (el.getAttribute('data-hud-zone') === 'centre') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    return r.right > L && r.left < R && r.bottom > T && r.top < B;
  }).map((el) => `${el.getAttribute('data-hud-zone')}`);
});

try {
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e&cleanShot=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 35000 });
  await page.evaluate(() => { window.hmPlay.teleportPlanet?.(); window.hmPlay.give?.(200); window.hmPlay.hideOverlays?.(false); });
  await page.waitForTimeout(1500);

  // a mill to aim at, and a view down at the ground next to the gate
  const mill = await page.evaluate(() => {
    const g = window.hmPlay.gate();
    return { ok: window.hmPlay.placeAt(g.x + 7, g.z + 5, 'mill'), mx: g.x + 7, mz: g.z + 5, gx: g.x, gz: g.z };
  });
  check('a mill can be placed next to the gate', mill.ok === true);
  await page.evaluate(({ gx, gz }) => window.hmPlay.go('planet', gx + 1, gz + 1, 0, -0.5), mill);
  await page.waitForTimeout(1200);
  await zoneGate('the Moon, no build UI');
  await shot('01-planet-hud');

  // B opens the ribbon: a bottom drawer with the four tabs and the key strip
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(500);
  check('B opens the build ribbon', (await page.locator('.bm-ribbon').count()) === 1);
  check('the ribbon has the four tabs', (await page.locator('.bm-tabs [role="tab"]').count()) === 4);
  const ribbonBox = await page.locator('.bm-ribbon').boundingBox();
  check('the ribbon is docked at the bottom, at most 136 px tall and 820 px wide',
    ribbonBox && ribbonBox.height <= 136.5 && ribbonBox.width <= 820.5 && ribbonBox.y + ribbonBox.height > 600,
    ribbonBox ? `${Math.round(ribbonBox.width)} x ${Math.round(ribbonBox.height)} at y ${Math.round(ribbonBox.y)}` : 'no box');
  await zoneGate('the ribbon open');
  await shot('02-ribbon-open');

  // a card collapses the drawer to the pill, and the centre 60% stays clear for the ghost
  await page.locator('.bm-ribbon .play-card:not([disabled])').first().click();
  await page.waitForTimeout(700);
  check('a card collapses the drawer', (await page.locator('.bm-ribbon').count()) === 0);
  check('the placement pill shows', (await page.locator('.bm-pill').count()) === 1);
  await zoneGate('the pill, placing');
  const intruders = await centreIntruders();
  check('the centre 60% of the screen is free of HUD boxes while placing', intruders.length === 0, intruders.join(', '));
  await shot('03-ribbon-picked');

  // H locks the hologram; the arrow keys nudge it 0.5 m; H or Esc releases it
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(300);
  const a0 = await page.evaluate(() => window.hmPlay.lockAim());
  check('H locks the hologram', a0.locked === true);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const a1 = await page.evaluate(() => window.hmPlay.lockAim());
  const dx = a0.aim && a1.aim ? a1.aim.x - a0.aim.x : NaN;
  check('the right arrow nudges the locked ghost 0.5 m to the right (yaw 0)', Math.abs(dx - 0.5) < 0.05, `moved ${Number.isFinite(dx) ? dx.toFixed(2) : 'n/a'} m in x`);
  await shot('04-hologram-locked');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Esc releases the hologram', (await page.evaluate(() => window.hmPlay.lockAim())).locked === false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // machine labels: shown within 14 m and 8 degrees, hidden at 22 m, all shown with Alt
  await page.evaluate(({ mx, mz }) => window.hmPlay.go('planet', mx - 6, mz, -Math.PI / 2, -0.05), mill);
  await page.waitForTimeout(900);
  const near = await page.locator('.hud-machine-label').count();
  check('a machine label shows when aimed within 14 m', near >= 1, `${near} label(s)`);
  await zoneGate('a machine aimed at');
  await shot('05-machine-aimed');
  await page.evaluate(({ mx, mz }) => window.hmPlay.go('planet', mx - 22, mz, -Math.PI / 2, -0.1), mill);
  await page.waitForTimeout(900);
  check('no machine label at 22 m without Alt', (await page.locator('.hud-machine-label').count()) === 0);
  await page.keyboard.down('Alt');
  await page.waitForTimeout(400);
  const alt = await page.locator('.hud-machine-label').count();
  check('all machine labels show with Alt held', alt >= 1, `${alt} label(s)`);
  await shot('06-machine-alt');
  await page.keyboard.up('Alt');
  await page.waitForTimeout(200);

  // the skin follows the stage under the player (plan 28): stage 1 is EGA, 3 Gouraud, 6 the suit-cam glass
  const skinAt = async (stage) => {
    await page.evaluate((s) => window.hmPlay.setStage(s), stage);
    await page.waitForTimeout(1400);
    return page.evaluate(() => document.querySelector('[data-hud-root]')?.getAttribute('data-fidelity') ?? null);
  };
  const expect = { 1: '1', 2: '2', 3: '3', 6: '4-6' };
  for (const [stage, skin] of Object.entries(expect)) {
    const got = await skinAt(Number(stage));
    check(`stage ${stage} applies skin ${skin}`, got === skin, `got ${got}`);
    if (stage === '3' || stage === '6') await shot(`07-skin-stage-${stage}`);
  }
  await zoneGate('after the stage changes');

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the HUD checks ran to the end', false, err.message);
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} HUD checks passed`);
process.exit(failed === 0 ? 0 : 1);
