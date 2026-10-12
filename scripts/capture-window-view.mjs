/**
 * The view from the lab window (WINDOW_SCENE_PLAN): shots of the 3D wasteland outside the north window, and the vista's draw calls and
 * triangles. Needs the dev server (npm run dev in apps/web, port 5192, or WINDOW_URL). Saves to docs/shots/window/.
 *   node scripts/capture-window-view.mjs            all shots
 *   WINDOW_ONLY=flash node scripts/capture-window-view.mjs   one shot (spawn, progress, flash, pocket, parallax, beside, lite, static)
 */
import { chromium } from 'playwright-core';
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
  console.log('Chrome not found, skipping the window view capture');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'docs/shots/window');
fs.mkdirSync(shotsDir, { recursive: true });
const URL_ROOT = process.env.WINDOW_URL ?? 'http://localhost:5192/';
const only = process.env.WINDOW_ONLY ?? null;

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stubbed')); };
  try { localStorage.clear(); } catch { /* storage blocked */ }
});
page.on('pageerror', (err) => console.error('[page error]', err.message));
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });

const HIDE = ['.play-prompt', '.play-goal', '.play-plot', '.play-build', '.gr-bar', '.gr-window', '.play-sync', '.hm-draw-calls-badge', '.play-crosshair', '.play-toast', '.hm-shelter-chip', '.play-hud-hotbar', '.gr-footer', '.play-sync-indicator', '.play-dot', '.play-mash-btn', '.hm-build-readout', '.hm-hotbar', '.play-build-reticle', '.play-create', '.play-start'];
async function shot(name) {
  if (only && only !== name.replace(/\.png$/, '')) return;
  await page.evaluate((sels) => { for (const s of sels) document.querySelectorAll(s).forEach((el) => { el.style.display = 'none'; }); }, HIDE);
  await new Promise((r) => setTimeout(r, 250));
  fs.writeFileSync(path.join(shotsDir, name), await page.screenshot());
  console.log('saved', name);
}
/** Puts the debug camera where the shot needs it, then waits a couple of frames. */
async function cam(pos, look) {
  await page.evaluate(([p, l]) => {
    const ps = window.__playScene;
    ps.debug.setAltCam(p, 0, 0, l);
  }, [pos, look]);
  await new Promise((r) => setTimeout(r, 700));
}
async function setView(progress, view) {
  await page.evaluate(([p, v]) => {
    const ps = window.__playScene;
    ps.room.setStorm(p);
    if (v) ps.setDetail({ ...ps.debug.detail(), windowView: v });
  }, [progress, view ?? null]);
}

try {
  await page.goto(URL_ROOT, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sm-menu button', { timeout: 60000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 90000 });
  await page.evaluate(() => {
    const done = [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'));
    done?.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // the lab at power on, from the spawn by the cot, eye height, looking north at the window
  await page.evaluate(() => {
    const ps = window.__playScene;
    ps.room.setPower({ relays: 1, pulse: 1, coils: 1, main: 1, emergency: 0, static: 0 });
  });
  const spawn = { x: -2.5, y: 1.65, z: 1.0 };
  const windowLook = { x: 0, y: 1.9, z: -9 };

  const info = await page.evaluate(() => {
    const ps = window.__playScene;
    return { view: ps.room.vista.view, spawn: ps.room.spawn, drawCalls: ps.room.vista.stats() };
  });
  console.log('vista at boot:', JSON.stringify(info));

  await setView(0, 'full');
  await cam(spawn, windowLook);
  await shot('spawn-p0.png');
  await setView(0.5, 'full');
  await cam(spawn, windowLook);
  await shot('spawn-p05.png');
  await setView(1, 'full');
  await cam(spawn, windowLook);
  await shot('spawn-p1.png');
  await setView(0, 'full');

  // beside the gate, a little right of it, looking out through the window
  await cam({ x: 2.6, y: 1.65, z: -0.6 }, { x: 0, y: 1.9, z: -9 });
  await shot('beside-gate-p0.png');

  // parallax: the same view moved 2 m sideways
  await cam({ x: spawn.x + 2, y: spawn.y, z: spawn.z }, windowLook);
  await shot('spawn-plus2m.png');

  // a flash: wait for a burst to be lit, then shoot it at once
  if (!only || only === 'flash') {
    await cam(spawn, windowLook);
    const flashed = await page.waitForFunction(() => (window.__playScene.room.vista.flashLight ?? 0) > 0.35, null, { timeout: 90000, polling: 50 }).then(() => true, () => false);
    console.log('flash lit:', flashed);
    await shot('flash-mid.png');
  }

  // a pocket close-up through the window: the camera inside the lab at the glass, looking at the first pocket's home
  await cam({ x: 0, y: 1.7, z: -7.8 }, { x: -14, y: 0.5, z: -70 });
  await shot('pocket-close.png');

  // the storm's progress again, from the spawn: Lite and Static
  await setView(0.5, 'lite');
  await cam(spawn, windowLook);
  await shot('lite-spawn-p05.png');
  await setView(0.5, 'static');
  await cam(spawn, windowLook);
  await shot('static-spawn-p05.png');
  await setView(0.5, 'full');

  const stats = await page.evaluate(() => window.__playScene.room.vista.stats());
  console.log('vista stats (full):', JSON.stringify(stats));
  const errors = await page.evaluate(() => (window.__playScene ? 'ok' : 'no scene'));
  console.log('scene:', errors);
} finally {
  await browser.close();
}
