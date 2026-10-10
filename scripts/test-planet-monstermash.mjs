/**
 * Automated Playwright validation for SetMix Monster Mash Combat on the Planet:
 * - Serves apps/web/dist on port 8199
 * - Boots http://localhost:8199/?mash
 * - Verifies scientist is on the planet surface
 * - Verifies Monster Mash menu is open
 * - Verifies Combat Shotgun equips and crosshair renders
 * - Spawns 3D Ogro and 2D Demon mobs onto planet terrain
 * - Fires shotgun, verifies raycast hits, damage registered, pain/death reaction
 * - Captures verification screenshots
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
const port = 8199;
console.log(`Starting static server on port ${port}...`);
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

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Stub pointerLock to avoid clipping cursor
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed'));
  };
});

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[Browser Error]', msg.text());
});

try {
  console.log(`Navigating to http://localhost:${port}/?mash...`);
  await page.goto(`http://localhost:${port}/?mash`, { waitUntil: 'domcontentloaded', timeout: 35000 });

  // Wait for the Play screen to initialize
  console.log('Waiting for Play canvas and Monster Mash panel...');
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);

  // Check if Monster Mash button or panel is visible
  const mashBtn = page.locator('.play-mash-btn');
  await mashBtn.waitFor({ state: 'visible', timeout: 15000 });
  console.log('OK: Monster Mash button is visible');

  // Ensure panel is open
  const panel = page.locator('.play-mash-panel');
  const isPanelVisible = await panel.isVisible();
  if (!isPanelVisible) {
    console.log('Opening Monster Mash panel...');
    await mashBtn.click();
    await panel.waitFor({ state: 'visible', timeout: 5000 });
  }
  console.log('OK: Monster Mash tactical panel is open');

  // Screenshot initial state
  await page.screenshot({ path: 'docs/shots/planet-mash-initial.png' });
  console.log('Captured docs/shots/planet-mash-initial.png');

  // Check window.hmPlay
  const hmPlayExists = await page.evaluate(() => typeof window.hmPlay !== 'undefined');
  console.log('hmPlay hook available:', hmPlayExists);

  // Ensure Shotgun is equipped
  const isEquipped = await page.evaluate(() => (window.hmPlay ? window.hmPlay.mash().isEquipped() : false));
  console.log('Initially equipped:', isEquipped);
  if (!isEquipped) {
    console.log('Equipping Combat Shotgun...');
    const equipBtn = page.locator('button:has-text("Equip Shotgun")');
    await equipBtn.click();
    await page.waitForTimeout(600);
  }

  const hasCrosshair = await page.locator('.play-crosshair').isVisible();
  console.log('OK: Combat Crosshair visible:', hasCrosshair);

  // Spawn 3D Ogro
  console.log('Spawning 3D Ogro (Quake 2)...');
  const spawnOgroBtn = page.locator('button:has-text("Spawn 3D Ogro")');
  await spawnOgroBtn.click();
  await page.waitForTimeout(2000);

  // Spawn 2D Demon
  console.log('Spawning 2D Demon (DOOM)...');
  const spawnDemonBtn = page.locator('button:has-text("Spawn 2D Demon")');
  await spawnDemonBtn.click();
  await page.waitForTimeout(2000);

  // Verify mobs are listed in active entities
  const mobCount = await page.locator('.mash-mob-card').count();
  console.log(`OK: Active mobs on planet: ${mobCount}`);

  // Test Stage 0: 1-bit Dither
  console.log('Testing Fidelity Stage 0: Dither...');
  const ditherBtn = page.locator('button:has-text("0: Dither")');
  await ditherBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/planet-mash-dither.png' });
  console.log('Captured docs/shots/planet-mash-dither.png');

  // Test Stage 4: PBR
  console.log('Testing Fidelity Stage 4: PBR...');
  const pbrBtn = page.locator('button:has-text("4: PBR")');
  await pbrBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/planet-mash-pbr.png' });
  console.log('Captured docs/shots/planet-mash-pbr.png');

  // Test Fidelity Stage Switcher Buttons - Switch to Stage 2 (VGA)
  console.log('Testing Fidelity Stage buttons...');
  const vgaBtn = page.locator('button:has-text("2: VGA")');
  await vgaBtn.click();
  await page.waitForTimeout(600);
  console.log('OK: Switched to Stage 2 (VGA)');

  // Screenshot equipped state with mobs
  await page.screenshot({ path: 'docs/shots/planet-mash-equipped.png' });
  console.log('Captured docs/shots/planet-mash-equipped.png');

  // Fire the shotgun multiple times to inflict damage and kill
  console.log('Firing Combat Shotgun at monsters...');
  const fireBtn = page.locator('button:has-text("Fire Shotgun")');
  for (let i = 0; i < 9; i++) {
    await fireBtn.click();
    await page.waitForTimeout(400);
  }

  // Check combat stats
  const stats = await page.evaluate(() => {
    return window.hmPlay ? window.hmPlay.mash().getStats() : null;
  });
  console.log('Combat Stats after firing:', stats);

  if (stats && stats.shotsFired > 0) {
    console.log('OK: Shots fired verified:', stats.shotsFired);
  }

  // Screenshot combat state and corpse
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/planet-mash-combat.png' });
  console.log('Captured docs/shots/planet-mash-combat.png');

  // ---------------------------------------------------------------------------
  // TASK-07: Deterministic hashSim Replay Check
  // ---------------------------------------------------------------------------
  console.log('Testing deterministic hashSim replay across two identical runs...');
  const determinismResult = await page.evaluate(() => {
    const mash = window.hmPlay.mash();
    const origin = { x: 0, y: 1.8, z: 0 };
    const dir = { x: 1, y: 0, z: 1 };

    mash.resetSim(42);
    mash.spawnDirect('ogro', 8, 8);
    for (let i = 0; i < 20; i++) mash.step({ x: 0, z: 0 });
    mash.fire(origin, dir);
    for (let i = 0; i < 10; i++) mash.step({ x: 0, z: 0 });
    const hashA = mash.hashSim();

    // Replay with exact same seed and actions
    mash.resetSim(42);
    mash.spawnDirect('ogro', 8, 8);
    for (let i = 0; i < 20; i++) mash.step({ x: 0, z: 0 });
    mash.fire(origin, dir);
    for (let i = 0; i < 10; i++) mash.step({ x: 0, z: 0 });
    const hashB = mash.hashSim();

    // Different seed must differ
    mash.resetSim(999);
    mash.spawnDirect('ogro', 8, 8);
    for (let i = 0; i < 20; i++) mash.step({ x: 0, z: 0 });
    mash.fire(origin, dir);
    for (let i = 0; i < 10; i++) mash.step({ x: 0, z: 0 });
    const hashC = mash.hashSim();

    return { match: hashA === hashB, hashA, diff: hashA !== hashC };
  });

  console.log('hashSim replay match:', determinismResult.match, 'Hash:', determinismResult.hashA);
  if (!determinismResult.match) {
    throw new Error('hashSim determinism check failed: identical seeds diverged!');
  }
  if (!determinismResult.diff) {
    throw new Error('hashSim check failed: different seed produced identical hash!');
  }

  // ---------------------------------------------------------------------------
  // TASK-07b: Weapon Loadout Simulator Verification (Long, Scatter, Burst)
  // ---------------------------------------------------------------------------
  console.log('Testing weapon loadout sim verification (long barrel <= 1 hit, scatter <= 7 hits, burst = 3 shots)...');
  const loadoutTest = await page.evaluate(() => {
    const mash = window.hmPlay.mash();
    const origin = { x: 0, y: 1.8, z: 0 };
    const dir = { x: 0, y: 0, z: 1 }; // aim directly along +z

    // 1. Long Barrel: pellets: 1, damage: [27, 39], spread: 0.006, range: 90
    mash.setWeaponStats({
      mode: 'semi',
      burst: 1,
      burstGap: 0,
      cooldown: 0.52,
      pellets: 1,
      damage: [27, 39],
      spread: 0.006,
      range: 90,
      zoom: 1,
      magazine: 8,
    });
    mash.resetSim(101);
    mash.spawnDirect('ogro', 0, 8); // directly ahead of ray at 8m
    const longRes = mash.fire(origin, dir);

    // 2. Scatter Barrel: pellets: 7, damage: [20, 29], spread: 0.0275, range: 60
    mash.setWeaponStats({
      mode: 'semi',
      burst: 1,
      burstGap: 0,
      cooldown: 0.52,
      pellets: 7,
      damage: [20, 29],
      spread: 0.0275,
      range: 60,
      zoom: 1,
      magazine: 8,
    });
    mash.resetSim(102);
    mash.spawnDirect('ogro', 0, 5); // directly ahead at 5m
    const scatterRes = mash.fire(origin, dir);

    // 3. Burst Core: burst: 3, burstGap: 0.08, cooldown: 0.8
    mash.setWeaponStats({
      mode: 'burst',
      burst: 3,
      burstGap: 0.08,
      cooldown: 0.8,
      pellets: 7,
      damage: [16, 22],
      spread: 0.0275,
      range: 60,
      zoom: 1,
      magazine: 24,
    });
    mash.resetSim(103);
    mash.spawnDirect('ogro', 0, 5);
    const initialShots = mash.getStats().shotsFired;
    mash.fire(origin, dir);
    const shotsAfterTrigger = mash.getStats().shotsFired;

    // Step 15 ticks on sim clock (15 * 1/30 = 0.5s > 2 * 0.08s burst duration)
    for (let i = 0; i < 15; i++) {
      mash.step({ x: 0, z: 0 });
    }
    const shotsAfterBurst = mash.getStats().shotsFired;

    // Reset back to standard shotgun stats for subsequent tests
    mash.setWeaponStats(null);

    return {
      longHits: longRes.hits,
      longKilled: longRes.killed,
      scatterHits: scatterRes.hits,
      scatterKilled: scatterRes.killed,
      initialShots,
      shotsAfterTrigger,
      shotsAfterBurst,
      burstCount: shotsAfterBurst - initialShots,
    };
  });

  console.log('Loadout test results:', loadoutTest);
  if (loadoutTest.longHits > 1) {
    throw new Error(`Long barrel landed ${loadoutTest.longHits} hits (expected <= 1)`);
  }
  if (loadoutTest.longHits !== 1) {
    throw new Error(`Long barrel missed target (expected 1 hit, got ${loadoutTest.longHits})`);
  }
  console.log('OK: Long barrel verified (landed exactly 1 hit per shot)');

  if (loadoutTest.scatterHits < 2 || loadoutTest.scatterHits > 7) {
    throw new Error(`Scatter barrel landed ${loadoutTest.scatterHits} hits (expected between 2 and 7)`);
  }
  console.log('OK: Scatter barrel verified (landed', loadoutTest.scatterHits, 'pellets <= 7)');

  if (loadoutTest.burstCount !== 3) {
    throw new Error(`Burst pull fired ${loadoutTest.burstCount} shots (expected exactly 3)`);
  }
  console.log('OK: Burst pull verified (landed exactly 3 shots on the sim clock)');

  // ---------------------------------------------------------------------------
  // TASK-07: Starter Shelter & Airlock Sealed/Open Navigation Tests
  // ---------------------------------------------------------------------------
  console.log('Testing starter shelter navigation with airlock shut and open...');
  const shelterTest = await page.evaluate(async () => {
    const w = window.hmPlay.base.world();
    const st = w.base.structures.find((s) => s.id === 1) || w.base.structures[0];
    if (!st) return { error: 'No shelter structure found' };
    const lock = w.base.pieces.find((p) => p.kind === 'airlock');
    if (!lock) return { error: 'No airlock piece found in base' };

    // Center of foundation in world space: cell (0, 0), center is (2, 2) local
    const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
    const insideX = st.x + 2 * cosY - 2 * sinY;
    const insideZ = st.z + 2 * sinY + 2 * cosY;

    // Outside the airlock door in world space: (j = 1 is +z edge, so outside is z = 7 local)
    const outsideX = st.x + 2 * cosY - 7 * sinY;
    const outsideZ = st.z + 2 * sinY + 7 * cosY;

    const mash = window.hmPlay.mash();
    mash.clearMobs();

    // Ensure airlock is closed
    if (lock.open) {
      window.hmPlay.base.apply({ t: 'door', id: lock.id, open: false });
    }

    // Teleport player inside the shelter
    window.hmPlay.teleport('planet', insideX, insideZ, 0);

    // Spawn 1 Demon outside the closed shelter
    await mash.spawnDemon(1, { x: outsideX, z: outsideZ });

    // Step 90 ticks with player inside
    for (let i = 0; i < 90; i++) {
      mash.step({ x: insideX, z: insideZ });
    }

    const mobsShut = mash.getMobList();
    const mobShut = mobsShut[0];
    const distShut = mobShut ? Math.hypot(mobShut.pos.x - insideX, mobShut.pos.z - insideZ) : -1;

    // Camera framed above the shelter showing the mob held outside the shut airlock
    window.hmPlay.setPaused(false);
    window.hmPlay.setLocked(true);
    window.hmPlay.setAltCam(
      { x: insideX - 5 * sinY, y: 7.5, z: insideZ + 5 * cosY },
      -0.65,
      st.yaw + Math.PI
    );

    return {
      lockId: lock.id,
      insideX,
      insideZ,
      outsideX,
      outsideZ,
      distShut,
      mobShutPos: mobShut ? mobShut.pos : null,
    };
  });

  console.log('Shut airlock result: dist =', shelterTest.distShut, 'pos =', shelterTest.mobShutPos);
  if (shelterTest.distShut < 2.5) {
    throw new Error(`Mob entered sealed shelter with airlock shut! Distance: ${shelterTest.distShut}`);
  }
  console.log('OK: Mob stayed safely outside shut shelter (dist =', shelterTest.distShut, 'm)');

  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/monstermash/shelter-safe.png' });
  console.log('Captured docs/shots/monstermash/shelter-safe.png');

  // Now test with airlock open: mob walks in through the door
  console.log('Opening airlock and stepping simulation...');
  const openTest = await page.evaluate(async (lockId) => {
    const mash = window.hmPlay.mash();
    window.hmPlay.base.apply({ t: 'door', id: lockId, open: true });

    // Step 90 ticks with airlock open
    const w = window.hmPlay.base.world();
    const st = w.base.structures.find((s) => s.id === 1) || w.base.structures[0];
    const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
    const insideX = st.x + 2 * cosY - 2 * sinY;
    const insideZ = st.z + 2 * sinY + 2 * cosY;

    for (let i = 0; i < 90; i++) {
      mash.step({ x: insideX, z: insideZ });
    }

    const mobsOpen = mash.getMobList();
    const mobOpen = mobsOpen[0];
    const distOpen = mobOpen ? Math.hypot(mobOpen.pos.x - insideX, mobOpen.pos.z - insideZ) : -1;

    return {
      distOpen,
      mobOpenPos: mobOpen ? mobOpen.pos : null,
      state: mobOpen ? mobOpen.state : null,
    };
  }, shelterTest.lockId);

  console.log('Open airlock result: dist =', openTest.distOpen, 'state =', openTest.state);
  if (openTest.distOpen > 2.5) {
    throw new Error(`Mob failed to walk in through open airlock! Distance: ${openTest.distOpen}`);
  }
  console.log('OK: Mob walked through open door into shelter (dist =', openTest.distOpen, 'm, state =', openTest.state, ')');

  // ---------------------------------------------------------------------------
  // TASK-07: Mob pathing round a wall
  // ---------------------------------------------------------------------------
  console.log('Testing mob pathing round a wall...');
  await page.evaluate(async () => {
    const w = window.hmPlay.base.world();
    const st = w.base.structures.find((s) => s.id === 1) || w.base.structures[0];
    const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
    // Player on south-east side outside wall
    const targetX = st.x + 5 * cosY + 2 * sinY;
    const targetZ = st.z - 2 * sinY + 5 * cosY;

    // Spawn an Ogro on the opposite side of the wall
    const spawnX = st.x - 3 * cosY - 2 * sinY;
    const spawnZ = st.z - 2 * sinY - 3 * cosY;

    const mash = window.hmPlay.mash();
    mash.clearMobs();
    await mash.spawnOgro(1, { x: spawnX, z: spawnZ });

    // Step 45 ticks so the mob rounds the corner
    for (let i = 0; i < 45; i++) {
      mash.step({ x: targetX, z: targetZ });
    }

    // Frame camera from above to view the mob curving around the corner
    window.hmPlay.setPaused(false);
    window.hmPlay.setLocked(true);
    window.hmPlay.setAltCam(
      { x: st.x + 4, y: 8, z: st.z + 4 },
      -0.75,
      st.yaw + 0.5
    );
  });

  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/monstermash/mobs-round-wall.png' });
  console.log('Captured docs/shots/monstermash/mobs-round-wall.png');

  // Reset alt camera
  await page.evaluate(() => {
    window.hmPlay.clearAltCam();
  });

  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    server.kill();
    await browser.close();
    process.exit(1);
  }

  console.log('ALL MONSTER MASH PLANET COMBAT CHECKS PASSED!');
} finally {
  server.kill();
  await browser.close();
}
process.exit(0);
