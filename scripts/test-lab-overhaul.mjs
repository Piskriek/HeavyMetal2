/**
 * TICKET-06 (the lab overhaul, Argo's bundle): an automated Playwright check of the lab room.
 * - serves apps/web/dist on port 8206 and enters the lab from the menu (Play), as capture-lab-sheet21.mjs does
 * - the six E stations exist, and nearestStation finds the preset rack from its wall and nothing from the middle of the room
 * - every station rig stands on the floor (its lowest corner is at y = 0, within 3 cm): nothing floats
 * - the gate's coils ignite over 3.5 s, bottom to top: 0, 3 and 6 coils lit at 0, 1.75 and 3.5 s into the ignition
 * - shots (docs/shots/ticket06/): the ceiling, the power wall, the east wall (the four machines), the gate, the three coil moments,
 *   and the window at storm 0, 0.5 and 1 in all three views (static, lite, full). The shots are for a human to look at
 *   (no floating parts, no pink or purple cubes); the script only checks that each one was written.
 * - MEASURE: the lab at Low, the draw calls (renderer.info) and fps at the gate view, printed as one JSON line for the before/after budget
 * Exits 1 on the first failed check, and kills its server and browser.
 */
import { spawn } from 'node:child_process';
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
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, process.env.SHOTS_DIR ?? 'docs/shots/ticket06');
fs.mkdirSync(shotsDir, { recursive: true });
const port = 8206;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
    // Low, as the budget is judged (the laptop's GTX 950M is the minimum spec)
    localStorage.setItem('hm.profile.v2', JSON.stringify({ name: 'Goblin', credits: 500, grownUp: true, tutorialDone: true, style: 'voxel', skin: 'flat', favIslands: [], quality: 'low', fpsTarget: 60, graphics: { vegetation: 'low' }, gpu: 'fast', controls: { sensitivity: 1, invertY: false, fov: 75 }, cameraView: 'first' }));
  } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`[Browser error]: ${msg.text()}`);
});

let passed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`OK: ${name}${detail ? ` (${detail})` : ''}`);
};

/** Hides the HUD, takes one shot into docs/shots/ticket06/ and checks that it was written. */
const shot = async (name) => {
  await page.evaluate(() => {
    const selectors = ['.play-prompt', '.play-goal', '.play-plot', '.play-build', '.gr-bar', '.gr-window', '.play-sync', '.hm-draw-calls-badge',
      '.play-crosshair', '.play-toast', '.hm-shelter-chip', '.play-hud-hotbar', '.gr-footer', '.play-sync-indicator', '.play-dot', '.play-mash-btn',
      '.hm-build-readout', '.hm-hotbar', '.play-build-reticle', '.play-create', '.play-start'];
    for (const s of selectors) document.querySelectorAll(s).forEach((el) => (el.style.display = 'none'));
  });
  const file = path.join(shotsDir, `${name}.png`);
  fs.writeFileSync(file, await page.screenshot());
  check(`shot ${name}.png written`, fs.statSync(file).size > 10000);
};
const frames = async (n = 30) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
const cam = async (eye, target) => {
  await page.evaluate(([e, t]) => window.__playScene.debug.setAltCam(e, 0, 0, t), [eye, target]);
  await frames(12);
};
const setPower = (p) => page.evaluate((x) => window.__playScene.room.setPower(x), p);
/** Power with the gate's coils at `coils` (0..1); the strip banks, relays and emergency lamps as they are when the gate is drawing. */
const powerWith = (coils, main = 1) => ({
  relays: 1, beacons: 1, pulse: 1, coils, banks: [1, 1, 1], main, hologram: 1, emergency: 0, static: 0, arc: 0,
});

try {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(40);

  const quality = await page.evaluate(() => window.__playScene.debug.detail());
  console.log('detail:', JSON.stringify(quality));

  // ---- the stations: six E stations, the nearest-station lookup, and the grounding of every rig
  const stations = await page.evaluate(() => window.__playScene.room.stations.map((s) => s.id));
  for (const id of ['preset-rack', 'preset-bench', 'preset-combiner', 'fabricator', 'planet-table', 'weapon-bench']) {
    check(`station ${id} exists`, stations.includes(id));
  }
  const near = await page.evaluate(() => ({
    rack: window.__playScene.room.nearestStation({ x: 6.9, z: -7.0 })?.id ?? null,
    middle: window.__playScene.room.nearestStation({ x: 0, z: 0 })?.id ?? null,
  }));
  check('nearestStation finds the preset rack from its wall', near.rack === 'preset-rack', JSON.stringify(near));
  check('nearestStation finds nothing from the middle of the room', near.middle === null, JSON.stringify(near));

  // The lowest world-space corner of every station rig (its userData.stationId group), from the meshes' boxes and matrices.
  const rigs = await page.evaluate(() => {
    const out = {};
    window.__playScene.room.group.traverse((obj) => {
      const id = obj.userData?.stationId;
      if (!id || out[id] !== undefined) return;
      let lowest = Infinity;
      obj.updateWorldMatrix(true, true);
      obj.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox;
        const e = m.matrixWorld.elements;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          if (wy < lowest) lowest = wy;
        }
      });
      out[id] = Number.isFinite(lowest) ? lowest : null;
    });
    return out;
  });
  for (const id of ['preset-rack', 'preset-bench', 'preset-combiner', 'fabricator', 'planet-table', 'weapon-bench']) {
    check(`${id} stands on the floor (lowest point ${rigs[id]?.toFixed?.(3)} m)`, rigs[id] !== null && rigs[id] !== undefined && rigs[id] <= 0.03 && rigs[id] >= -0.03, String(rigs[id]));
  }

  // ---- the gate's coil ignition, through the room's own power path (the lever's sequence sets this power each frame)
  // 0, 1.75 and 3.5 s into the 3.5 s ignition: the coils lit bottom to top, none, three, then all six
  await cam({ x: 0, y: 1.7, z: 2.6 }, { x: 0, y: 1.5, z: -1.0 });
  for (const [name, coils, lit] of [['coil-ignition-0s', 0, 0], ['coil-ignition-1.75s', 0.5, 3], ['coil-ignition-3.5s', 1, 6]]) {
    await setPower(powerWith(coils));
    await frames(20);
    const count = await page.evaluate(() => window.__playScene.room.coilsLit().filter(Boolean).length);
    check(`${name}: ${lit} of 6 coils lit`, count === lit, `counted ${count}`);
    await shot(name);
  }
  const lit = await page.evaluate(() => window.__playScene.room.coilsLit());
  check('the coils light bottom to top (none above an unlit coil)', lit.every((on, i) => !on || i === 0 || lit[i - 1]));

  // ---- the ceiling, the power wall, the east wall and the gate
  await setPower(powerWith(1, 0.8));
  await cam({ x: 0, y: 1.6, z: 2.0 }, { x: 0, y: 4.9, z: -1.0 });
  await shot('ceiling-up');
  await cam({ x: -1.2, y: 1.7, z: -3.5 }, { x: -7.5, y: 1.6, z: -3.5 });
  await shot('left-wall-power');
  await cam({ x: 1.5, y: 1.7, z: -4.5 }, { x: 7.5, y: 1.4, z: -5.0 });
  await shot('right-wall-studio');
  await cam({ x: 2.6, y: 1.8, z: -1.6 }, { x: 7.45, y: 1.3, z: -4.9 });
  await shot('right-wall-machines');
  await cam({ x: 0, y: 1.7, z: 2.6 }, { x: 0, y: 1.5, z: -1.0 });
  await setPower(powerWith(1, 1));
  await frames(20);
  await shot('gate-lit');

  // ---- the window: storm 0, 0.5 and 1 in each of its three views
  const windowCam = async () => cam({ x: -1.5, y: 1.6, z: -5.0 }, { x: 0, y: 1.95, z: -9.0 });
  await windowCam();
  for (const view of ['static', 'lite', 'full']) {
    await page.evaluate((v) => window.__playScene.room.setWindowView(v), view);
    for (const storm of [0, 0.5, 1]) {
      await page.evaluate((s) => window.__playScene.room.setStorm(s), storm);
      await frames(20);
      await shot(`window-${view}-storm-${storm}`);
    }
  }
  await page.evaluate(() => window.__playScene.room.setWindowView('full'));
  await page.evaluate(() => window.__playScene.room.setStorm(0));

  // ---- MEASURE: draw calls and fps at the gate view (Low), in the state the lab is seen in when powered
  await cam({ x: 0, y: 1.7, z: 2.6 }, { x: 0, y: 1.5, z: -1.0 });
  await setPower(powerWith(1, 1));
  await frames(40);
  const measured = await page.evaluate(async () => {
    const n = 120;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
    const ms = (performance.now() - t0) / n;
    const s = window.__playScene.debug.stats();
    return { fps: Math.round((1000 / ms) * 10) / 10, frameMs: Math.round(ms * 100) / 100, calls: s.calls, triangles: s.triangles };
  });
  console.log(`MEASURE ${JSON.stringify({ quality: quality?.quality ?? quality?.tier ?? null, ...measured })}`);

  check('no page errors while the lab runs', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\nAll ${passed} lab overhaul checks passed. Shots in ${path.relative(root, shotsDir)}.`);
} finally {
  await browser.close();
  server.kill();
}
