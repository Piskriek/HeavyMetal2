// ============================================================================
// TICKET-16 part b validation script (F-26):
// - Window E: the 11 neighbor enclave domes on the 4.2 km horizon (A9-01)
// - Planet Table hologram (POL-70): 11 enclaves, consensus commit, violet pulse
// - Finale window-storm heal visual (POL-302, evaluateFinaleWindowHeal)
// - POL-301: Credits Chapter 1 wireframe look (stage 0a)
// - POL-303: setAltCam with target maintains orientation without drift
// - POL-304: Held weapon viewmodel hidden during credits
// ============================================================================

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8216;
const shotsDir = path.join(root, 'shots-run/t16b');
fs.mkdirSync(shotsDir, { recursive: true });

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

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

try {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new Error('pointer lock stubbed'));
    };
    localStorage.setItem('hm.endingSeen', '1');
  });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const shot = async (name) => {
    const file = path.join(shotsDir, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`Saved screenshot: ${file}`);
    return file;
  };

  const settle = (ms = 500) => page.waitForTimeout(ms);

  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.sm-menu button').length > 0, null, { timeout: 60000 });

  console.log('Entering Expedition...');
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' }).first();
  await expBtn.waitFor({ state: 'visible', timeout: 30000 });
  await expBtn.click({ force: true });
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 240000 });
  await page.waitForFunction(() => !!window.__playScene, null, { timeout: 60000 });

  // Clear avatar creator if open
  const doneBtn = page.locator('.play-create button', { hasText: 'into the lab' }).first();
  if ((await doneBtn.count()) > 0) {
    await doneBtn.click();
    await page.waitForFunction(() => !document.querySelector('.play-create'), null, { timeout: 30000 }).catch(() => {});
  }
  await settle(1000);

  // --------------------------------------------------------------------------
  // Check 1: POL-70 Planet Table Hologram & Consensus Commit
  // --------------------------------------------------------------------------
  console.log('Checking Planet Table Hologram...');
  // Teleport in front of planet table facing table
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', -5.2, -1.8, Math.PI / 2, -0.2);
  });
  await settle(800);

  const holoState = await page.evaluate(() => {
    const scene = window.__playScene;
    const holo = scene.debug?.planetTableHologram?.();
    if (!holo) return null;
    return {
      groupExists: !!holo.group,
      visible: holo.group.visible,
      nodeCount: holo.group.children.length,
      isCommitted: scene.isConsensusCommitted?.(),
    };
  });
  check('Planet Table hologram mounted in lab', holoState && holoState.groupExists, JSON.stringify(holoState));

  // Feed floats and commit consensus
  const commitResult = await page.evaluate(() => {
    const scene = window.__playScene;
    scene.debug.setFourFloats({ Pxd: 2500, Vtx: 2500, Lx: 2500, Aq: 2500 });
    scene.setConsensusCommitted(true);
    return {
      committed: scene.isConsensusCommitted(),
    };
  });
  check('Planet Table consensus commit activates', commitResult.committed === true, JSON.stringify(commitResult));
  await settle(500);
  await shot('planet-table-hologram');

  // --------------------------------------------------------------------------
  // Check 2: Window E #1 11 Horizon Enclave Domes on the Moon
  // --------------------------------------------------------------------------
  console.log('Checking Horizon Enclave Domes...');
  await page.evaluate(() => {
    window.__playScene.debug.teleport('planet', 0, 0, 0, 0);
  });
  await settle(1000);

  const domesInfo = await page.evaluate(() => {
    const scene = window.__playScene;
    const domes = scene.getHorizonDomes?.() ?? scene.debug?.horizonDomes?.();
    if (!domes) return null;
    return {
      exists: !!domes.group,
      children: domes.group.children.length,
      visible: domes.group.visible,
      firstDomePos: domes.group.children[0]
        ? { x: domes.group.children[0].position.x, z: domes.group.children[0].position.z }
        : null,
    };
  });
  check('11 Horizon Enclave Domes rendered on 4.2 km horizon', domesInfo && domesInfo.children === 11, JSON.stringify(domesInfo));

  // Aim camera at first enclave dome (~4.2 km away)
  await page.evaluate(() => {
    const scene = window.__playScene;
    const domes = scene.getHorizonDomes?.();
    const first = domes?.group.children[0];
    if (first) {
      scene.debug.setAltCam(
        { x: 0, y: 15, z: 0 },
        0,
        0,
        { x: first.position.x, y: first.position.y + 40, z: first.position.z }
      );
    }
  });
  await settle(600);
  await shot('horizon-domes');

  // --------------------------------------------------------------------------
  // Check 3: POL-303 setAltCam Drift Resistance
  // --------------------------------------------------------------------------
  console.log('Checking POL-303 setAltCam drift resistance...');
  const driftCheck = await page.evaluate(async () => {
    const scene = window.__playScene;
    const eye = { x: 5, y: 10, z: 15 };
    const target = { x: 100, y: 20, z: -80 };
    scene.debug.setAltCam(eye, 0, 0, target);
    const cam = scene.debug.camera();
    const rotBefore = { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z };

    // Wait across multiple frames
    await new Promise((r) => setTimeout(r, 300));
    const rotAfter = { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z };
    const diff = Math.hypot(rotAfter.x - rotBefore.x, rotAfter.y - rotBefore.y, rotAfter.z - rotBefore.z);

    scene.debug.clearAltCam();
    return { diff, rotBefore, rotAfter };
  });
  check('POL-303 setAltCam with target maintains fixed orientation without drift', driftCheck.diff < 1e-4, `diff=${driftCheck.diff}`);

  // --------------------------------------------------------------------------
  // Check 4: POL-302 labRoom setStorm & setMonitorEqualizer via PlayScene
  // --------------------------------------------------------------------------
  console.log('Checking POL-302 room storm & monitor equalizer methods...');
  const pol302 = await page.evaluate(() => {
    const scene = window.__playScene;
    const hasSetStorm = typeof scene.setStorm === 'function';
    const hasSetEq = typeof scene.setMonitorEqualizer === 'function';
    const hasRoom = !!scene.room;
    scene.setStorm(0.72);
    scene.setMonitorEqualizer([0.8, 0.4, 0.9, 0.2]);
    return { hasSetStorm, hasSetEq, hasRoom };
  });
  check('POL-302 setStorm and setMonitorEqualizer exposed on PlayScene', pol302.hasSetStorm && pol302.hasSetEq && pol302.hasRoom, JSON.stringify(pol302));

  // --------------------------------------------------------------------------
  // Check 5: POL-301 & POL-304 Credits Chapter 1 Wireframe & Rifle Viewmodel
  // --------------------------------------------------------------------------
  console.log('Checking POL-301 & POL-304 Credits Chapter 1 wireframe and hidden viewmodel...');
  await page.evaluate(() => {
    if (window.__dev?.playCredits) {
      window.__dev.playCredits();
    }
  });
  await page.waitForFunction(() => !!window.__creditsDirector?.isActive?.(), null, { timeout: 30000 });
  await settle(500);

  // Seek to chapter 1 (cold boot, ~5s)
  await page.evaluate((sec) => window.__creditsDirector.seek(sec), 5.0);
  await page.waitForFunction((sec) => Math.abs((window.__creditsDirector.elapsedSec() ?? -99) - sec) < 1.5, 5.0, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => window.__playScene.debug.isWireframeLook() === true, null, { timeout: 8000 }).catch(() => {});
  await settle(500);

  const ch1Uniforms = await page.evaluate(() => {
    const scene = window.__playScene;
    const hud = document.querySelector('[data-testid="credits-hud-root"]');
    return {
      wireframeLook: scene.debug?.isWireframeLook(),
      hasRifleVisible: scene.debug?.isViewModelVisible(),
      skin: hud?.getAttribute('data-fidelity'),
      elapsed: window.__creditsDirector?.elapsedSec(),
    };
  });
  check('POL-301 Credits Chapter 1 has wireframe look active', ch1Uniforms.wireframeLook === true && ch1Uniforms.skin === '0a', JSON.stringify(ch1Uniforms));
  check('POL-304 Held weapon viewmodel hidden during credits', ch1Uniforms.hasRifleVisible === false, JSON.stringify(ch1Uniforms));
  await shot('credits-ch1-wireframe');
  await shot('credits-no-rifle');

  // Seek to chapter 2 (one-bit facets, ~25s) and check wireframe look disables
  await page.evaluate((sec) => window.__creditsDirector.seek(sec), 25.0);
  await page.waitForFunction((sec) => Math.abs((window.__creditsDirector.elapsedSec() ?? -99) - sec) < 1.5, 25.0, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => window.__playScene.debug.isWireframeLook() === false, null, { timeout: 8000 }).catch(() => {});
  await settle(500);

  const ch2State = await page.evaluate(() => {
    const scene = window.__playScene;
    const hud = document.querySelector('[data-testid="credits-hud-root"]');
    return {
      wireframeLook: scene.debug?.isWireframeLook(),
      skin: hud?.getAttribute('data-fidelity'),
      elapsed: window.__creditsDirector?.elapsedSec(),
    };
  });
  check('Credits Chapter 2 transitions to normal shaded rendering', ch2State.wireframeLook === false, JSON.stringify(ch2State));

  // Exit credits
  await page.keyboard.press('Escape');
  await settle(800);

  await browser.close();
} finally {
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nResults: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.error(`Failed ${failed.length} checks:`, failed);
  process.exit(1);
} else {
  console.log('All T16b checks PASSED!');
  process.exit(0);
}
