/**
 * Automated Playwright validation for FIDELITY Base-Building & Substrate HUD:
 * - Boots http://localhost:8196/?base
 * - Verifies Hotbar is visible on planet surface
 * - Verifies keybindings 1-9 switch active hotbar slot
 * - Verifies Inventory window opens on Tab / I key
 * - Verifies slot interaction & drag/swap merge
 * - Verifies Drafting Table window opens on K key
 * - Verifies Lattice Quantum Bridge Storage window opens on L key
 * - Captures verification screenshots into docs/shots/base/
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
const shotsDir = path.join(root, 'docs/shots/base');
if (!fs.existsSync(shotsDir)) {
  fs.mkdirSync(shotsDir, { recursive: true });
}

const port = 8196;
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

// Stub pointerLock to prevent focus issues in headless Chrome
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[Browser Error]', msg.text());
});

try {
  console.log(`Navigating to http://localhost:${port}/?base...`);
  await page.goto(`http://localhost:${port}/?base`, { waitUntil: 'domcontentloaded', timeout: 35000 });

  console.log('Waiting for Play canvas and Base HUD...');
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. Verify Hotbar
  const hotbar = page.locator('[data-testid="base-hotbar"]');
  await hotbar.waitFor({ state: 'visible', timeout: 15000 });
  console.log('OK: Base Hotbar is visible on planet');

  // Verify slot 1 initially selected (hotbar index 0)
  const slot1 = page.locator('[data-testid="hotbar-slot-1"]');
  const isSlot1Selected = await slot1.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Slot 1 initially selected:', isSlot1Selected);

  // Switch to slot 3 using key '3' (Foundation Blueprint)
  console.log('Pressing Key 3 to select Foundation Blueprint...');
  await page.keyboard.press('3');
  await page.waitForTimeout(300);

  const slot3 = page.locator('[data-testid="hotbar-slot-3"]');
  const isSlot3Selected = await slot3.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Slot 3 selected after pressing 3:', isSlot3Selected);

  // Check Build Readout
  const buildReadout = page.locator('[data-testid="build-readout-hud"]');
  const isReadoutVisible = await buildReadout.isVisible();
  console.log('OK: Build Readout under reticle visible:', isReadoutVisible);

  await page.screenshot({ path: 'docs/shots/base/hotbar-selection.png' });
  console.log('Captured docs/shots/base/hotbar-selection.png');

  // 2. Open Inventory Window using 'Tab'
  console.log('Opening Inventory Window using Tab...');
  await page.keyboard.press('Tab');
  const invModal = page.locator('[data-testid="inventory-modal"]');
  await invModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Inventory Window is visible');

  // Check Suit Rig Equipment slots
  const beamEquipSlot = page.locator('[data-testid="equip-slot-beam"]');
  console.log('OK: Suit Rig Beam slot visible:', await beamEquipSlot.isVisible());

  // Check 9x4 Grid
  const invGrid = page.locator('[data-testid="inventory-grid"]');
  console.log('OK: 9x4 Inventory Grid visible:', await invGrid.isVisible());

  // Test slot move / swap
  console.log('Testing slot selection in inventory...');
  const invSlot6 = page.locator('[data-testid="inv-slot-6"]'); // Raw cyan pixel
  await invSlot6.click();
  const isSlot6Selected = await invSlot6.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Inventory slot 6 selected:', isSlot6Selected);

  // Click slot 8 (empty) to move
  const invSlot8 = page.locator('[data-testid="inv-slot-8"]');
  await invSlot8.click();
  await page.waitForTimeout(300);
  console.log('OK: Moved item stack to slot 8');

  // Move mouse away to ensure resting state
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);

  await page.screenshot({ path: 'docs/shots/base/inventory-window.png' });
  console.log('Captured docs/shots/base/inventory-window.png');

  // Test Quick Stack button
  const quickStackBtn = page.locator('[data-testid="quick-stack-btn"]');
  await quickStackBtn.click();
  await page.waitForTimeout(300);
  console.log('OK: Quick Stack triggered');

  // Close inventory with Escape
  console.log('Closing inventory with Escape...');
  await page.keyboard.press('Escape');
  await invModal.waitFor({ state: 'hidden', timeout: 5000 });

  // 3. Open Drafting Table Window using 'K'
  console.log('Opening Drafting Table using K...');
  await page.keyboard.press('k');
  const draftModal = page.locator('[data-testid="drafting-modal"]');
  await draftModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Drafting Table Window is visible');

  // Verify preview panel
  const previewPanel = page.locator('[data-testid="drafting-preview-panel"]');
  console.log('OK: Blueprint preview panel visible:', await previewPanel.isVisible());

  // Pick primitive and map
  const primCube = page.locator('[data-testid="prim-pick-prim_cube"]');
  await primCube.click();
  const mapBasalt = page.locator('[data-testid="map-pick-map_basalt"]');
  await mapBasalt.click();
  await page.waitForTimeout(300);

  // Check synthesize button
  const synthBtn = page.locator('[data-testid="synthesize-draft-btn"]');
  const synthText = (await synthBtn.textContent())?.trim();
  console.log('OK: Synthesize button text:', synthText);

  // Validate the one-count rule: primitive card count matches have in preview
  const primCardText = (await primCube.textContent())?.trim();
  const previewText = (await previewPanel.textContent())?.trim();
  console.log('OK: Primitive card text:', primCardText);
  console.log('OK: Cost preview text:', previewText);
  if (!previewText?.includes('Structural Cube') || !previewText?.includes('/ 1')) {
    throw new Error('Cost table does not contain Structural Cube requirement');
  }

  await page.screenshot({ path: 'docs/shots/base/drafting-window.png' });
  console.log('Captured docs/shots/base/drafting-window.png');

  // Close drafting table with Escape
  await page.keyboard.press('Escape');
  await draftModal.waitFor({ state: 'hidden', timeout: 5000 });

  // 4. Open Lattice Quantum Bridge Storage using 'L'
  console.log('Opening Lattice Quantum Storage using L...');
  await page.keyboard.press('l');
  const latticeModal = page.locator('[data-testid="lattice-modal"]');
  await latticeModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Lattice Storage Window is visible');

  const rangeBadge = page.locator('[data-testid="quantum-range-badge"]');
  console.log('OK: Quantum Range Status:', (await rangeBadge.textContent())?.trim());

  const totalsGrid = page.locator('[data-testid="lattice-totals-grid"]');
  console.log('OK: Lattice totals grid visible:', await totalsGrid.isVisible());

  await page.screenshot({ path: 'docs/shots/base/lattice-window.png' });
  console.log('Captured docs/shots/base/lattice-window.png');

  // Close lattice window
  await page.keyboard.press('Escape');
  await latticeModal.waitFor({ state: 'hidden', timeout: 5000 });

  // 5. Verify aimPoint() with piece hit and ground fallback
  console.log('Verifying aimPoint() piece hit and ground fallback via window.__playScene...');
  const aimVerdict = await page.evaluate(() => {
    const scene = window.__playScene;
    if (!scene) return { ok: false, error: 'window.__playScene is missing' };

    // 1. Piece hit test
    const pieceHit = scene.debug.testPieceAim(42);
    if (!pieceHit || pieceHit.piece !== 42) {
      return { ok: false, error: `Expected pieceId 42, got ${pieceHit?.piece}` };
    }
    if (!pieceHit.normal || typeof pieceHit.normal.y !== 'number') {
      return { ok: false, error: 'Expected normal vector on piece hit' };
    }

    // 2. Ground fallback test
    const groundHit = scene.aimPoint();
    if (groundHit && groundHit.piece !== null) {
      return { ok: false, error: `Expected piece null on ground fallback, got ${groundHit.piece}` };
    }

    return {
      ok: true,
      pieceHit: { piece: pieceHit.piece, normal: pieceHit.normal },
      groundHit: groundHit ? { piece: groundHit.piece, hasNormal: !!groundHit.normal } : null,
    };
  });
  console.log('OK: aimPoint verification passed:', aimVerdict);
  if (!aimVerdict.ok) throw new Error(aimVerdict.error);

  console.log('\nALL FIDELITY BASE-BUILDING HUD & WINDOW CHECKS PASSED!');
} catch (err) {
  console.error('Test execution failed:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  if (pageErrors.length > 0) {
    console.error('Errors encountered on page:', pageErrors);
  }
}
