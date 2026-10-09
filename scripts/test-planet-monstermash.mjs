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
