/**
 * Automated Playwright check for TICKET-07 part B (T07b): vehicle juice (boost, tyre tracks, wheel dust,
 * print gantry) and the extraction beam dealing chip damage to monsters.
 *
 * Verifies:
 * 1. Printing a vehicle plays the gantry sweep before the vehicle appears;
 * 2. Holding Shift while driving raises speed above normal cap and drains boost energy meter;
 * 3. Driving leaves tyre tracks on terrain that fade over time;
 * 4. Driving emits wheel dust roost particles;
 * 5. Extract beam deals continuous chip damage to monsters, while Seal mode does none;
 * 6. Low-spec driving FPS holds at least 45 fps.
 *
 * Writes shots to shots-run/ticket07b-*.png.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
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
const shots = fileURLToPath(new URL('../shots-run/', import.meta.url));
fs.mkdirSync(shots, { recursive: true });
const port = 8196;
console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed'));
  };
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

const dev = (fn, ...args) => page.evaluate(([name, a]) => window.__dev[name](...a), [fn, args]);
const teleport = (where, x, z, yaw = 0, pitch = 0) => page.evaluate(([w, a, b, c, d]) => window.hmPlay.teleport(w, a, b, c, d), [where, x, z, yaw, pitch]);

try {
  await page.goto(`http://localhost:${port}/?mash&e2e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev && !!window.hmPlay && !!window.__playScene, null, { timeout: 35000 });
  await page.waitForTimeout(1000);

  // ---- 1. Teleport to Planet and Fabricate Rover (Gantry Verification)
  await teleport('planet', 0, -4, 0, 0);
  await page.waitForTimeout(500);

  // Print scout rover at (0, 3) through base world
  const scout = await page.evaluate(() => {
    const w = window.hmPlay?.base?.world?.();
    if (!w) return null;
    if (!w.vehicles) w.vehicles = [];
    const v = { id: 10, kind: 'scout', x: 0, z: 3, yaw: 0 };
    w.vehicles.push(v);
    window.__playScene.setVehicles(w.vehicles);
    return v;
  });
  check('spawned rover into base world', !!scout);

  // Check that print gantry is playing immediately
  const gantries = await page.evaluate(() => {
    const list = window.__playScene.debug.gantries();
    return list.map((g) => ({ playing: g.isPlaying(), progress: g.progress() }));
  });
  check('printing a vehicle plays the gantry before it appears', gantries.length > 0 && gantries[0].playing === true, `gantries: ${JSON.stringify(gantries)}`);

  // Capture shot of gantry in action
  await page.screenshot({ path: `${shots}ticket07b-gantry.png` });

  // Wait for gantry animation to finish (1.6s duration)
  await page.waitForTimeout(1800);

  // ---- 2. Entering Rover and Boost Verification
  const entered = await page.evaluate((id) => window.hmPlay.base.enterVehicle(id), scout.id);
  check('entered scout rover', entered === true);

  // Drive forward with W
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1400);

  const normalSpeed = await page.evaluate(() => window.__playScene.getDrivingVehicle()?.speed ?? 0);
  const initialEnergy = await page.evaluate(() => window.__playScene.debug.roverBoostEnergy());
  check('rover drives forward at normal speed', normalSpeed > 1.8, `speed ${normalSpeed.toFixed(2)} m/s`);
  check('boost energy starts full', initialEnergy >= 0.95, `energy ${initialEnergy.toFixed(2)}`);

  // Hold Shift to trigger boost
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1400);

  const boostedSpeed = await page.evaluate(() => window.__playScene.getDrivingVehicle()?.speed ?? 0);
  const boostedEnergy = await page.evaluate(() => window.__playScene.debug.roverBoostEnergy());
  const isBoosting = await page.evaluate(() => window.__playScene.getDrivingVehicle()?.boosting ?? false);

  check('holding Shift raises speed above normal speed', boostedSpeed > normalSpeed + 0.5, `boosted ${boostedSpeed.toFixed(2)} m/s vs normal ${normalSpeed.toFixed(2)} m/s`);
  check('boosting flag is active', isBoosting === true);
  check('boost drains energy meter', boostedEnergy < initialEnergy - 0.15, `energy drained to ${boostedEnergy.toFixed(2)}`);

  // Verify HUD badge shows speed, boost meter, and BOOSTING text
  const speedBadge = page.locator('[data-testid="speed-hud-badge"]');
  check('speed HUD badge is visible while driving', (await speedBadge.count()) === 1);
  const boostBar = page.locator('[data-testid="speed-hud-boost"]');
  check('speed HUD badge contains boost meter', (await boostBar.count()) === 1);
  const badgeText = (await speedBadge.textContent()) ?? '';
  check('badge displays BOOSTING state', /BOOSTING/i.test(badgeText), `text: "${badgeText.trim()}"`);

  await page.screenshot({ path: `${shots}ticket07b-boost.png` });

  // Release Shift, verify recovery
  await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(1000);
  const recoveredEnergy = await page.evaluate(() => window.__playScene.debug.roverBoostEnergy());
  check('releasing Shift recharges boost energy', recoveredEnergy > boostedEnergy, `recharged to ${recoveredEnergy.toFixed(2)}`);

  // ---- 3. Tyre Tracks and Wheel Dust Verification
  const trackCount = await page.evaluate(() => window.__playScene.debug.tracks().count());
  const roostCount = await page.evaluate(() => window.__playScene.debug.roost().count());
  check('driving creates tyre track decals', trackCount > 0, `tracks: ${trackCount}`);
  check('driving emits wheel dust particles', roostCount > 0, `particles: ${roostCount}`);

  await page.screenshot({ path: `${shots}ticket07b-tracks.png` });
  await page.screenshot({ path: `${shots}ticket07b-dust.png` });

  // Test tyre track age fading
  const initialOpacity = await page.evaluate(() => {
    const marks = window.__playScene.debug.tracks().marks();
    return marks.length > 0 ? marks[0].opacity : 0;
  });
  // Advance tracks by 6 seconds
  await page.evaluate(() => window.__playScene.debug.tracks().update(6));
  const fadedOpacity = await page.evaluate(() => {
    const marks = window.__playScene.debug.tracks().marks();
    return marks.length > 0 ? marks[0].opacity : 0;
  });
  check('tyre tracks fade over time', fadedOpacity < initialOpacity, `opacity ${initialOpacity.toFixed(3)} -> ${fadedOpacity.toFixed(3)}`);

  // ---- 4. Low-Spec Driving FPS Measurement (>= 45 fps)
  await page.evaluate(() => window.__dev.setQuality?.('low'));
  await page.waitForTimeout(200);

  const fps = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let count = 0;
      const start = performance.now();
      const tick = () => {
        count++;
        if (count >= 60) {
          const elapsed = (performance.now() - start) / 1000;
          resolve(count / elapsed);
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  });
  check('low-spec driving FPS holds at least 45 fps', fps >= 45, `fps ${fps.toFixed(1)}`);

  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.hmPlay.base.exitVehicle());
  await page.waitForTimeout(400);

  // ---- 5. Extract Beam Damage vs Seal Mode on Monsters
  const aim = await page.evaluate(() => window.__playScene.aimGround());
  const mobX = aim.origin.x + aim.dir.x * 4;
  const mobZ = aim.origin.z + aim.dir.z * 4;
  const mobId = await page.evaluate(({ x, z }) => {
    return window.__playScene.monsters.placeMob('charger', x, z);
  }, { x: mobX, z: mobZ });
  check('placed monster in front of player', typeof mobId === 'number');

  const getMobHp = (id) => page.evaluate((mid) => {
    const mob = window.__playScene.monsters.getMobList().find((m) => m.id === mid);
    return mob ? mob.hp : null;
  }, id);

  const hp0 = await getMobHp(mobId);
  check('initial monster HP recorded', typeof hp0 === 'number' && hp0 > 0, `hp: ${hp0}`);

  // Turn on Extract mode beam firing
  await page.evaluate(() => {
    window.hmPlay.setBeamHeld(true, 'extract');
    window.hmPlay.setBeamSealing(false);
    window.hmPlay.setBeamFiring(true);
  });
  await page.waitForTimeout(800);

  const hp1 = await getMobHp(mobId);
  check('extract beam deals continuous chip damage to monster', typeof hp1 === 'number' && hp1 < hp0, `HP: ${hp0} -> ${hp1}`);

  // Now switch to Seal mode
  await page.evaluate(() => {
    window.hmPlay.setBeamHeld(true, 'seal');
    window.hmPlay.setBeamSealing(true);
    window.hmPlay.setBeamFiring(true);
  });
  await page.waitForTimeout(800);

  const hp2 = await getMobHp(mobId);
  check('seal mode deals 0 damage to monster', hp2 === hp1, `HP in seal: ${hp1} -> ${hp2}`);

  // Turn off beam
  await page.evaluate(() => {
    window.hmPlay.setBeamFiring(false);
    window.hmPlay.setBeamHeld(false, 'extract');
  });

  check('no unhandled page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`\n${passed} checks pass, 0 fail: ALL OK`);
} catch (err) {
  console.log(String(err && err.message ? err.message : err));
  console.log(`${passed} checks passed before the failure.`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
process.exit(process.exitCode ?? 0);
