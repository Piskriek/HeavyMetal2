/**
 * T02A browser validation: Moon sky and world follow fidelity stages 1-6 and wave transitions.
 * - Boots http://localhost:8199/?base&kit=1&e2e
 * - Teleports to moon with fixed camera (sun in view, sky above horizon)
 * - Loops stages 1 to 6 calling __playScene.setFidelityStage(s), takes screenshots to shots-run/stage-world/s<N>.png
 * - Asserts mean colour of sky band (top 25% of frame) changes between stages 1 and 4, and 4 and 6
 * - Tests raiseStage(4) and asserts sky changes after wave completes
 * - Asserts no console / page errors
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/stage-world');
fs.mkdirSync(outDir, { recursive: true });

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

const port = 8199;
console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});

// Wait for server to be responsive
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});

const W = 1280, H = 720;
const page = await browser.newPage({ viewport: { width: W, height: H } });

const pageErrors = [];
const consoleErrors = [];

page.on('pageerror', (err) => {
  console.error('[Browser pageerror]:', err.message);
  pageErrors.push(err.message);
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.error(`[Browser console error]:`, msg.text());
    consoleErrors.push(msg.text());
  }
});

await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
  } catch {}
});

function meanSkyColour(png) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const maxV = Math.floor(png.height / 4); // top quarter of the frame
  for (let v = 0; v < maxV; v++) {
    for (let u = 0; u < png.width; u++) {
      const idx = (v * png.width + u) * 4;
      rSum += png.data[idx];
      gSum += png.data[idx + 1];
      bSum += png.data[idx + 2];
      count++;
    }
  }
  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { r, g, b, lum };
}

let exitCode = 0;

try {
  console.log(`Navigating to http://localhost:${port}/?base&kit=1&e2e...`);
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('canvas.play-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 25000 });
  console.log('OK: Play canvas is visible');

  await page.waitForFunction(
    () => typeof window !== 'undefined' && window.hmPlay?.ready === true && window.__playScene !== undefined,
    { timeout: 35000 }
  );
  console.log('OK: hmPlay and __playScene hooks ready');

  // Teleport to planet
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

  await page.waitForFunction(() => window.hmPlay?.where === 'planet', { timeout: 15000 });
  console.log('OK: Teleported onto moon surface');

  // Fix camera looking toward SUN (SUN = (0.42, 0.34, -0.84))
  // yaw ~ -0.46 rad, pitch ~ 0.30 rad
  await page.evaluate(() => {
    const exit = window.__playScene.gateExit();
    window.__playScene.debug.teleport('planet', exit.x, exit.z, -0.46, 0.30);
  });
  await page.waitForTimeout(300);

  const stageColours = {};

  for (let s = 1; s <= 6; s++) {
    await page.evaluate((stageNum) => {
      window.__playScene.setFidelityStage(stageNum);
    }, s);

    // Wait at least 2 animation frames
    await page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.waitForTimeout(200);

    const shotPath = path.join(outDir, `s${s}.png`);
    const buf = await page.screenshot({ path: shotPath });
    const png = PNG.sync.read(buf);
    const col = meanSkyColour(png);
    stageColours[s] = col;
    console.log(`Stage ${s} Sky Band: R=${col.r.toFixed(1)}, G=${col.g.toFixed(1)}, B=${col.b.toFixed(1)}, Lum=${col.lum.toFixed(3)} -> ${shotPath}`);
  }

  // Delta between stage 1 and 4
  const c1 = stageColours[1];
  const c4 = stageColours[4];
  const c6 = stageColours[6];

  const delta14 = Math.hypot(c4.r - c1.r, c4.g - c1.g, c4.b - c1.b);
  const delta46 = Math.hypot(c6.r - c4.r, c6.g - c4.g, c6.b - c4.b);

  console.log(`Sky colour delta S1->S4: ${delta14.toFixed(2)} (RGB vector distance)`);
  console.log(`Sky colour delta S4->S6: ${delta46.toFixed(2)} (RGB vector distance)`);

  if (delta14 < 10) {
    console.error(`FAIL: Sky band delta between stage 1 and 4 is too small: ${delta14.toFixed(2)} < 10`);
    exitCode = 1;
  } else {
    console.log(`OK: Sky band colour changes significantly between stage 1 and 4 (delta=${delta14.toFixed(2)})`);
  }

  if (delta46 < 5) {
    console.error(`FAIL: Sky band delta between stage 4 and 6 is too small: ${delta46.toFixed(2)} < 5`);
    exitCode = 1;
  } else {
    console.log(`OK: Sky band colour changes significantly between stage 4 and 6 (delta=${delta46.toFixed(2)})`);
  }

  // Test raiseStage transition
  console.log('Testing raiseStage wave transition...');
  // Reset to stage 1 first
  await page.evaluate(() => {
    window.__playScene.setFidelityStage(1);
  });
  await page.waitForTimeout(300);

  const resetBuf = await page.screenshot();
  const resetCol = meanSkyColour(PNG.sync.read(resetBuf));
  console.log(`Pre-wave Stage 1 Sky Band: Lum=${resetCol.lum.toFixed(3)}`);

  // Trigger raiseStage(4)
  await page.evaluate(() => {
    const exit = window.__playScene.gateExit();
    window.__playScene.raiseStage(4, { x: exit.x, z: exit.z });
  });

  // Wait for wave to complete (debug.wave() >= 1e7 when wave finishes)
  console.log('Waiting for stage wave to complete (~15s)...');
  await page.waitForFunction(
    () => window.__playScene.debug.wave() >= 1e7,
    { timeout: 25000 }
  );
  console.log('OK: Wave completed!');

  await page.waitForTimeout(400);
  const waveBuf = await page.screenshot({ path: path.join(outDir, 'wave-s4.png') });
  const waveCol = meanSkyColour(PNG.sync.read(waveBuf));
  const waveDelta = Math.hypot(waveCol.r - resetCol.r, waveCol.g - resetCol.g, waveCol.b - resetCol.b);
  console.log(`Post-wave Stage 4 Sky Band: R=${waveCol.r.toFixed(1)}, G=${waveCol.g.toFixed(1)}, B=${waveCol.b.toFixed(1)}, Lum=${waveCol.lum.toFixed(3)}`);
  console.log(`Post-wave vs Pre-wave delta: ${waveDelta.toFixed(2)}`);

  if (waveDelta < 10) {
    console.error(`FAIL: Sky colour did not change after raiseStage wave: delta=${waveDelta.toFixed(2)}`);
    exitCode = 1;
  } else {
    console.log(`OK: Sky colour changed after raiseStage wave (delta=${waveDelta.toFixed(2)})`);
  }

  if (pageErrors.length > 0) {
    console.error(`FAIL: ${pageErrors.length} page error(s) occurred during test:`, pageErrors);
    exitCode = 1;
  }

  if (consoleErrors.length > 0) {
    console.error(`FAIL: ${consoleErrors.length} console error(s) occurred during test:`, consoleErrors);
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('ALL CHECKS PASSED: Stage world and sky transition verified.');
  }
} catch (err) {
  console.error('Test execution failed:', err);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill('SIGTERM');
  process.exit(exitCode);
}
