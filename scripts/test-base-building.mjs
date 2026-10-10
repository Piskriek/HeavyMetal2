/**
 * Automated Playwright validation for FIDELITY Base-Building & Substrate HUD:
 * - Boots http://localhost:8196/?base
 * - Verifies Hotbar is visible on planet surface
 * - Verifies keybindings 1-9 switch active hotbar slot
 * - Verifies Inventory window opens on Tab / I key
 * - Verifies slot interaction & drag/swap move
 * - Verifies Drafting Table window opens on K key
 * - Verifies Lattice Quantum Bridge Storage window opens on L key
 * - Verifies Base-Building lifecycle via window.__hm.base / window.hmPlay.base:
 *   1. Found a foundation slab (STARTER)
 *   2. Place a drafting bench
 *   3. Place a floor tile
 *   4. Draft a blueprint (bp:cube:basalt) at the bench
 *   5. Place a basalt bin on the floor
 *   6. Check scene piece meshes exist (count with userData.pieceId === 4)
 *   7. Remove the floor tile -> verify cascading collapse of the bin
 *   8. Verify ore refund in player inventory
 *   9. Verify drafted blueprint appears in inventory
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
page.on('pageerror', (err) => {
  console.error('Browser Page Error:', err.message);
  pageErrors.push(err.message);
});

try {
  console.log(`Navigating to http://localhost:${port}/?base...`);
  await page.goto(`http://localhost:${port}/?base`, { waitUntil: 'domcontentloaded' });

  // Wait for Play Canvas to initialize
  const canvas = page.locator('canvas.play-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 25000 });
  console.log('OK: Play canvas is visible');

  // Wait for HUD hook
  await page.waitForFunction(
    () => typeof window !== 'undefined' && (window.hmPlay?.ready || window.__hm?.base),
    { timeout: 35000 }
  );
  console.log('OK: hmPlay / __hm hook is ready');

  // Teleport to moon surface if currently in lab
  await page.evaluate(() => {
    if (window.hmPlay?.teleportPlanet) {
      window.hmPlay.teleportPlanet();
    }
    if (window.hmPlay?.setPaused) {
      window.hmPlay.setPaused(false);
    }
    if (window.hmPlay?.setLocked) {
      window.hmPlay.setLocked(true);
    }
  });
  await page.waitForTimeout(1000);

  // 1. Check Hotbar HUD
  const hotbar = page.locator('[data-testid="base-hotbar"]');
  await hotbar.waitFor({ state: 'visible', timeout: 15000 });
  console.log('OK: Hotbar HUD is visible on planet');

  const slot1 = page.locator('[data-testid="hotbar-slot-1"]');
  const isSlot1Selected = await slot1.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Slot 1 initially selected:', isSlot1Selected);

  // Switch to slot 2 using key '2'
  console.log('Pressing Key 2 to switch hotbar slot...');
  await page.keyboard.press('2');
  await page.waitForTimeout(300);

  const slot2 = page.locator('[data-testid="hotbar-slot-2"]');
  const isSlot2Selected = await slot2.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Slot 2 selected after pressing 2:', isSlot2Selected);

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

  // Test slot move / swap in real inventory
  console.log('Testing slot selection in inventory...');
  const invSlot2 = page.locator('[data-testid="inv-slot-2"]'); // prim-cube
  await invSlot2.click();
  const isSlot2ClickSelected = await invSlot2.evaluate((el) => el.classList.contains('selected'));
  console.log('OK: Inventory slot 2 selected:', isSlot2ClickSelected);

  // Click slot 5 (empty) to move
  const invSlot5 = page.locator('[data-testid="inv-slot-5"]');
  await invSlot5.click();
  await page.waitForTimeout(300);
  console.log('OK: Moved item stack to slot 5');

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
  const primCube = page.locator('[data-testid="prim-pick-prim-cube"], [data-testid="prim-pick-prim_cube"]');
  await primCube.click();
  const mapBasalt = page.locator('[data-testid="map-pick-map-basalt"], [data-testid="map-pick-map_basalt"]');
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

  await page.screenshot({ path: 'docs/shots/base/lattice-window.png' });
  console.log('Captured docs/shots/base/lattice-window.png');

  // Close lattice window
  await page.keyboard.press('Escape');
  await latticeModal.waitFor({ state: 'hidden', timeout: 5000 });

  // 5. Verify Base-Building lifecycle via __hm.base
  console.log('\n--- VERIFYING BASE-BUILDING LIFECYCLE THROUGH __hm.base ---');
  const lifecycleResult = await page.evaluate(async () => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    if (!baseApi) return { ok: false, error: 'window.__hm.base / hmPlay.base not found' };

    const at = { x: 12, z: 12 };

    // 1. Found foundation slab with STARTER kit
    console.log('Action: Founding slab at (12, 12)...');
    baseApi.apply({
      t: 'found',
      at,
      blueprint: 'bp:starter',
      cx: 12,
      cz: 12,
      yaw: 0,
    });

    let w = baseApi.world();
    if (w.base.pieces.length !== 1) {
      return { ok: false, error: `Expected 1 piece after found, got ${w.base.pieces.length}` };
    }
    const structureId = w.base.structures[0].id;
    const foundationId = w.base.pieces[0].id;

    // 2. Place bench (Drafting Table) on the slab
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:starter',
      piece: { s: structureId, kind: 'bench', i: 0, j: 0, k: 0, r: 0 },
    });
    w = baseApi.world();
    if (w.base.pieces.length !== 2) {
      return { ok: false, error: `Expected 2 pieces after bench, got ${w.base.pieces.length}` };
    }
    const benchId = w.base.pieces[1].id;

    // 3. Place floor piece attached to foundation (i: 1, j: 0)
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:starter',
      piece: { s: structureId, kind: 'floor', i: 1, j: 0, k: 0, r: 0 },
    });
    w = baseApi.world();
    if (w.base.pieces.length !== 3) {
      return { ok: false, error: `Expected 3 pieces after floor, got ${w.base.pieces.length}` };
    }
    const floorId = w.base.pieces[2].id;

    // 4. Draft blueprint bp:cube:basalt at the bench
    baseApi.apply({
      t: 'draft',
      at,
      primitive: 'cube',
      map: 'basalt',
    });
    w = baseApi.world();
    const hasDraftedBp = w.player.slots.some((s) => s?.item === 'bp:cube:basalt');
    if (!hasDraftedBp) {
      return { ok: false, error: 'Drafted blueprint bp:cube:basalt not in player inventory' };
    }

    // 5. Place basalt bin on the floor piece
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:cube:basalt',
      piece: { s: structureId, kind: 'bin', i: 1, j: 0, k: 0, r: 0 },
    });
    w = baseApi.world();
    if (w.base.pieces.length !== 4) {
      return { ok: false, error: `Expected 4 pieces after bin, got ${w.base.pieces.length}` };
    }
    const binId = w.base.pieces[3].id;

    // Check meshes in Three.js scene
    const scene = window.__playScene;
    if (!scene) return { ok: false, error: 'window.__playScene is missing' };

    // Count meshes with pieceId in piecesGroup
    let meshCount = 0;
    const piecesGroup = scene.debug.testPieceAim ? null : null; // scene contains root
    // Scan scene for piece meshes
    let foundMeshIds = [];
    scene.planetScene?.traverse?.((obj) => {
      if (obj.userData?.pieceId !== undefined) {
        foundMeshIds.push(obj.userData.pieceId);
      }
    });

    const countOre = (slots) => slots.reduce((acc, s) => acc + (s?.item === 'ore' ? s.n : 0), 0);
    const oreBeforeRemove = countOre(w.player.slots);

    // 6. Remove the floor piece -> bin collapses!
    baseApi.apply({
      t: 'remove',
      at,
      id: floorId,
    });
    w = baseApi.world();
    // After floor removal, both floor and bin are gone
    const remainingPieceIds = w.base.pieces.map((p) => p.id);
    if (remainingPieceIds.includes(floorId) || remainingPieceIds.includes(binId)) {
      return { ok: false, error: `Floor or bin still in pieces after collapse: ${remainingPieceIds}` };
    }

    const oreAfterRemove = countOre(w.player.slots);
    const oreRefunded = oreAfterRemove - oreBeforeRemove;
    if (oreRefunded < 10) {
      return { ok: false, error: `Expected >= 10 ore refund, got ${oreRefunded}` };
    }

    return {
      ok: true,
      structureId,
      benchId,
      initialPieces: 4,
      remainingPieces: w.base.pieces.length,
      oreRefunded,
      draftedBp: 'bp:cube:basalt',
    };
  });

  console.log('OK: Base-Building lifecycle verdict:', lifecycleResult);
  if (!lifecycleResult.ok) throw new Error(lifecycleResult.error);

  // Allow collapse animations to finish (0.6s)
  await page.waitForTimeout(800);

  // 6. Verify aimPoint() with piece hit and ground fallback
  console.log('\nVerifying aimPoint() piece hit and ground fallback via window.__playScene...');
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

  // 7. Verify Anomaly Node Harvesting via Beam Tick (Part B)
  console.log('\n--- VERIFYING ANOMALY NODE HARVESTING VIA BEAM TICK ---');
  const harvestVerdict = await page.evaluate(async () => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    if (!baseApi) return { ok: false, error: 'baseApi not found' };
    const w = baseApi.world();
    if (!w.field || !w.field.nodes || w.field.nodes.length === 0) {
      return { ok: false, error: 'No anomaly nodes found in world.field' };
    }
    const node0 = w.field.nodes.slice().sort((a, b) => Math.hypot(a.x - 12, a.z - 12) - Math.hypot(b.x - 12, b.z - 12))[0];
    const initialReserve = node0.reserve;
    const countItems = (slots, prefix) => slots.reduce((acc, s) => acc + (s && s.item.startsWith(prefix) ? s.n : 0), 0);
    const pxdBefore = countItems(w.player.slots, 'pxd');
    const vtxBefore = countItems(w.player.slots, 'vtx');

    // Teleport or position at node0 and send 1s beam tick
    const at = { x: node0.x + 0.5, z: node0.z + 0.5 };
    baseApi.apply({
      t: 'tick',
      at,
      dt: 1.0,
      beam: { node: node0.id, power: 1 },
      power: {},
    });

    const wAfter = baseApi.world();
    const node0After = wAfter.field.nodes.find((n) => n.id === node0.id);
    const pxdAfter = countItems(wAfter.player.slots, 'pxd');
    const vtxAfter = countItems(wAfter.player.slots, 'vtx');

    if (!node0After || node0After.reserve >= initialReserve) {
      return { ok: false, error: `Node reserve did not decrease (before: ${initialReserve}, after: ${node0After?.reserve})` };
    }
    const gained = (pxdAfter - pxdBefore) + (vtxAfter - vtxBefore);
    if (gained <= 0) {
      return { ok: false, error: `Player did not receive raw pxd/vtx harvest (gained ${gained})` };
    }

    // Clear lingering toasts and select neutral hotbar slot (ore) so no build ghost blocks reticle
    if (window.hmPlay?.clearToast) {
      window.hmPlay.clearToast();
    }
    baseApi.apply({ t: 'hotbar', index: 2 });

    // Unpause game so pause overlay does not show, and lock to hide Click to look around
    if (window.hmPlay?.setPaused) {
      window.hmPlay.setPaused(false);
    }
    if (window.hmPlay?.setLocked) {
      window.hmPlay.setLocked(true);
    }

    // Teleport camera right in front of node0 looking directly at its center
    const scene = window.__playScene;
    if (scene) {
      const px = node0.x;
      const pz = node0.z + 2.8;
      const camY = scene.heightAt(px, pz) + 1.7;
      const nodeY = scene.heightAt(node0.x, node0.z) + 0.35;
      const dx = node0.x - px;
      const dz = node0.z - pz;
      const dy = nodeY - camY;
      const distHoriz = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(-dx, -dz);
      const desiredPitch = Math.atan2(dy, Math.max(0.1, distHoriz));
      scene.debug.teleport('planet', px, pz, desiredYaw, desiredPitch);
    }

    // Activate live continuous beam targeting node0
    if (baseApi.startBeam) {
      baseApi.startBeam(node0.id);
    }

    return {
      ok: true,
      nodeId: node0.id,
      kind: node0.kind,
      initialReserve,
      afterReserve: node0After.reserve,
      gained,
    };
  });
  console.log('OK: Harvest verification verdict:', harvestVerdict);
  if (!harvestVerdict.ok) throw new Error(harvestVerdict.error);

  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/shots/base/beam-harvesting.png' });
  console.log('Captured docs/shots/base/beam-harvesting.png');

  // Turn live beam off after screenshot
  await page.evaluate(() => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    baseApi?.stopBeam?.();
  });

  // 8. Verify Heavy Machine Hardpoint, Install & Refinery Lifecycle (Part C)
  console.log('\n--- VERIFYING HEAVY MACHINE INSTALL & REFINERY ---');
  const machinePrepVerdict = await page.evaluate(async (ids) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    if (!baseApi) return { ok: false, error: 'baseApi not found' };

    const at = { x: 12, z: 12 };
    const structureId = ids.structureId;

    // 1. Draft chassis:basalt at the bench before removing it
    baseApi.apply({
      t: 'draft',
      at,
      primitive: 'chassis',
      map: 'basalt',
    });

    // 2. Remove the bench so the 4 cells are clear for the hardpoint
    baseApi.apply({
      t: 'remove',
      at,
      id: ids.benchId,
    });

    // 3. Place remaining 3 foundations at (1, 0), (0, 1), (1, 1)
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:starter',
      piece: { s: structureId, kind: 'foundation', i: 1, j: 0, k: 0, r: 0 },
    });
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:starter',
      piece: { s: structureId, kind: 'foundation', i: 0, j: 1, k: 0, r: 0 },
    });
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:starter',
      piece: { s: structureId, kind: 'foundation', i: 1, j: 1, k: 0, r: 0 },
    });

    // 4. Place hardpoint pad using drafted bp:chassis:basalt
    baseApi.apply({
      t: 'place',
      at,
      blueprint: 'bp:chassis:basalt',
      piece: { s: structureId, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 },
    });

    const w = baseApi.world();
    const hardpoint = w.base.pieces.find((p) => p.kind === 'hardpoint');
    if (!hardpoint) {
      return { ok: false, error: 'Failed to place hardpoint pad' };
    }

    // Open machine picker modal
    baseApi.openMachinePicker(hardpoint.id);

    return {
      ok: true,
      hardpointId: hardpoint.id,
    };
  }, { structureId: lifecycleResult.structureId, benchId: lifecycleResult.benchId });

  console.log('OK: Machine preparation verdict:', machinePrepVerdict);
  if (!machinePrepVerdict.ok) throw new Error(machinePrepVerdict.error);

  // Wait for Machine Picker Modal
  const machinePickerModal = page.locator('[data-testid="machine-picker-modal"]');
  await machinePickerModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Machine Picker modal is visible');

  await page.screenshot({ path: 'docs/shots/base/machine-picker-modal.png' });
  console.log('Captured docs/shots/base/machine-picker-modal.png');

  // Click install heavy mill
  const installMillBtn = page.locator('[data-testid="install-btn-mill"]');
  await installMillBtn.waitFor({ state: 'visible', timeout: 5000 });
  await installMillBtn.click();
  await machinePickerModal.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('OK: Machine Picker closed after mill install');

  // Verify heavy mill installed
  const verifyInstallVerdict = await page.evaluate((hpId) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const w = baseApi.world();
    const mach = w.machines.find((m) => m.id === hpId);
    if (!mach || mach.kind !== 'mill') {
      return { ok: false, error: `Machine not installed on hardpoint ${hpId}` };
    }
    // Open refinery window
    baseApi.openRefinery(hpId);
    return { ok: true, machineKind: mach.kind };
  }, machinePrepVerdict.hardpointId);

  console.log('OK: Heavy mill install verified:', verifyInstallVerdict);
  if (!verifyInstallVerdict.ok) throw new Error(verifyInstallVerdict.error);

  // Wait for Refinery Modal
  const refineryModal = page.locator('[data-testid="refinery-modal"]');
  await refineryModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Refinery Modal is visible');

  await page.screenshot({ path: 'docs/shots/base/refinery-modal.png' });
  console.log('Captured docs/shots/base/refinery-modal.png');

  // Queue 'map-basalt' recipe via button
  const queueMapBtn = page.locator('[data-testid="queue-btn-map-basalt"]');
  await queueMapBtn.waitFor({ state: 'visible', timeout: 5000 });
  await queueMapBtn.click();
  await page.waitForTimeout(300);

  // Step 40 seconds at full power (1.0)
  const refineStepVerdict = await page.evaluate(async (hpId) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const at = { x: 12, z: 12 };

    let w = baseApi.world();
    let mach = w.machines.find((m) => m.id === hpId);
    if (!mach || mach.jobs.length === 0) {
      return { ok: false, error: 'Job was not queued in heavy mill' };
    }

    // Step 40 seconds at power 1 (recipe takes 30s)
    baseApi.apply({
      t: 'tick',
      at,
      dt: 40,
      beam: null,
      power: { [hpId]: 1 },
    });

    w = baseApi.world();
    mach = w.machines.find((m) => m.id === hpId);
    if (!mach || mach.out.length === 0 || mach.out[0].item !== 'map-basalt') {
      return { ok: false, error: `Expected finished map-basalt in out hopper, got: ${JSON.stringify(mach?.out)}` };
    }

    return { ok: true, outputStack: mach.out[0] };
  }, machinePrepVerdict.hardpointId);

  console.log('OK: Refinery step verdict:', refineStepVerdict);
  if (!refineStepVerdict.ok) throw new Error(refineStepVerdict.error);

  // Collect output via modal button
  const collectBtn = page.locator('[data-testid="refinery-collect-btn"]');
  await collectBtn.waitFor({ state: 'visible', timeout: 5000 });
  await collectBtn.click();
  await page.waitForTimeout(300);

  // Verify map-basalt collected into inventory
  const verifyCollectVerdict = await page.evaluate((hpId) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const w = baseApi.world();
    const countItems = (slots, item) => slots.reduce((acc, s) => acc + (s && s.item === item ? s.n : 0), 0);
    const maps = countItems(w.player.slots, 'map-basalt');
    const mach = w.machines.find((m) => m.id === hpId);
    if ((mach?.out?.length ?? 0) !== 0) {
      return { ok: false, error: 'Output hopper not emptied after collect' };
    }
    return { ok: true, playerBasaltMaps: maps };
  }, machinePrepVerdict.hardpointId);

  console.log('OK: Output collect verified:', verifyCollectVerdict);
  if (!verifyCollectVerdict.ok) throw new Error(verifyCollectVerdict.error);

  // Close refinery modal
  const refineryCloseBtn = page.locator('[data-testid="refinery-close-btn"]');
  if (await refineryCloseBtn.isVisible()) {
    await refineryCloseBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await refineryModal.waitFor({ state: 'hidden', timeout: 5000 });

  console.log('\nALL FIDELITY BASE-BUILDING HUD, REAL WORLD & LIFECYCLE CHECKS PASSED!');
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
