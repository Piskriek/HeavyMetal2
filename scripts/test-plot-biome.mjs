/**
 * T02F browser validation: Plotbiome tufts, bushes and trees in the moon world.
 * - Boots http://localhost:8195/?base&kit=1&e2e
 * - Teleports to moon with camera overlooking plot
 * - Calls setFidelityStage with 0, 2, 4, 6
 * - Asserts instance counts never decrease, are 0 below stage 2, and include trees at stage 6
 * - Takes screenshots: stage-0.png, stage-2.png, stage-4.png, stage-6.png, stage-6-close.png
 * - Measures FPS, draw calls and triangles at stage 6 on Low tier (must hold >= 30 fps)
 * - Asserts 0 console errors and 0 page errors
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/plot-biome');
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

const port = 8195;
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
  args: [
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-angle=d3d11',
    '--disable-gpu-vsync',
  ],
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

let exitCode = 0;

try {
  console.log(`Navigating to http://localhost:${port}/?base&kit=1&e2e...`);
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('canvas.play-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  console.log('OK: Play canvas visible');

  await page.waitForFunction(
    () => typeof window !== 'undefined' && window.hmPlay?.ready === true && window.__playScene !== undefined,
    { timeout: 35000 }
  );
  console.log('OK: hmPlay and __playScene ready');

  // Teleport onto moon
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
  console.log('OK: Teleported to moon');

  // Place two operating machines and one water machine before baking/testing stages
  await page.evaluate(() => {
    window.hmPlay.placeAt(12, 0, 'mill');
    window.hmPlay.placeAt(-12, 0, 'drill');
    window.hmPlay.placeAt(0, 12, 'water');
  });
  await page.waitForTimeout(500);
  console.log('OK: Placed 2 operating machines and 1 water machine');

  // Position camera on hill overlooking plot
  await page.evaluate(() => {
    const exit = window.__playScene.gateExit();
    window.__playScene.debug.teleport('planet', exit.x - 5, exit.z + 14, 0.4, -0.22);
  });
  await page.waitForTimeout(400);

  const stagesToTest = [0, 2, 4, 6];
  const stageResults = {};

  for (const s of stagesToTest) {
    const counts = await page.evaluate((stageNum) => {
      window.__playScene.setFidelityStage(stageNum);
      return window.__playScene.getBiomeCounts();
    }, s);

    await page.waitForTimeout(300);

    const shotPath = path.join(outDir, `stage-${s}.png`);
    await page.screenshot({ path: shotPath });
    stageResults[s] = counts;

    console.log(
      `Stage ${s}: Total=${counts.total}, Trees=${counts.trees}, Tufts=${counts.byKind.tuft}, Bushes=${counts.byKind.bush}, Pine=${counts.byKind.pine}, Oak=${counts.byKind.oak}, Birch=${counts.byKind.birch} -> saved ${shotPath}`
    );

    // Close shots near machine at stages 2 and 4
    if (s === 2) {
      await page.evaluate(() => {
        window.__playScene.debug.teleport('planet', 12, 4.0, 0, -0.2);
      });
      await page.waitForTimeout(300);
      const close2Path = path.join(outDir, 'stage-2-close.png');
      await page.screenshot({ path: close2Path });
      console.log(`Saved stage 2 close shot near mill: ${close2Path}`);
      // return camera to hill
      await page.evaluate(() => {
        const exit = window.__playScene.gateExit();
        window.__playScene.debug.teleport('planet', exit.x - 5, exit.z + 14, 0.4, -0.22);
      });
      await page.waitForTimeout(300);
    } else if (s === 4) {
      await page.evaluate(() => {
        window.__playScene.debug.teleport('planet', 0, 15.5, Math.PI, -0.2);
      });
      await page.waitForTimeout(300);
      const close4Path = path.join(outDir, 'stage-4-close.png');
      await page.screenshot({ path: close4Path });
      console.log(`Saved stage 4 close shot near water machine: ${close4Path}`);
      // return camera to hill
      await page.evaluate(() => {
        const exit = window.__playScene.gateExit();
        window.__playScene.debug.teleport('planet', exit.x - 5, exit.z + 14, 0.4, -0.22);
      });
      await page.waitForTimeout(300);
    }
  }

  // Close shot at stage 6
  await page.evaluate(() => {
    window.__playScene.debug.teleport('planet', 12, 10, -1.2, -0.15);
  });
  await page.waitForTimeout(400);
  const closeShotPath = path.join(outDir, 'stage-6-close.png');
  await page.screenshot({ path: closeShotPath });
  console.log(`Saved stage 6 close shot: ${closeShotPath}`);

  // Measure draw calls, triangles and FPS at stage 6
  const perf = await page.evaluate(async () => {
    const triangles = window.__playScene.debug.biomeTriangles();
    const drawCalls = window.__playScene.debug.biomeDrawCalls();

    // Measure FPS over 40 frames
    const frames = 40;
    const times = [];
    await new Promise((resolve) => {
      let count = 0;
      let last = performance.now();
      function tick(now) {
        times.push(now - last);
        last = now;
        count++;
        if (count >= frames) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });

    const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
    const fps = Math.round(1000 / avgMs);
    return { triangles, drawCalls, fps, avgMs };
  });

  console.log(
    `Performance at stage 6: FPS=${perf.fps} (${perf.avgMs.toFixed(2)} ms/frame), Biome Triangles=${perf.triangles}, Biome DrawCalls=${perf.drawCalls}`
  );

  // 1. Assert stage 0 has 0 instances
  if (stageResults[0].total !== 0) {
    console.error(`FAIL: Stage 0 expected 0 instances, got ${stageResults[0].total}`);
    exitCode = 1;
  } else {
    console.log('PASS: Stage 0 has 0 instances');
  }

  // 2. Assert stage 2 has tufts > 0 on Low tier
  if (stageResults[2].byKind.tuft <= 0) {
    console.error(`FAIL: Stage 2 expected tufts > 0 on Low tier, got ${stageResults[2].byKind.tuft}`);
    exitCode = 1;
  } else {
    console.log(`PASS: Stage 2 has ${stageResults[2].byKind.tuft} tufts on Low tier`);
  }

  // 3. Assert stage 4 has bushes > 0
  if (stageResults[4].byKind.bush <= 0) {
    console.error(`FAIL: Stage 4 expected bushes > 0, got ${stageResults[4].byKind.bush}`);
    exitCode = 1;
  } else {
    console.log(`PASS: Stage 4 has ${stageResults[4].byKind.bush} bushes`);
  }

  // 4. Assert monotone instance count growth (never decreases)
  let prevTotal = stageResults[0].total;
  for (const s of [2, 4, 6]) {
    const curTotal = stageResults[s].total;
    if (curTotal < prevTotal) {
      console.error(`FAIL: Monotonicity violation: stage ${s} (${curTotal}) < prev stage (${prevTotal})`);
      exitCode = 1;
    } else {
      console.log(`PASS: Monotone growth stage ${s}: ${curTotal} >= ${prevTotal}`);
    }
    prevTotal = curTotal;
  }

  // 5. Assert trees appear at stage 6
  if (stageResults[6].trees <= 0) {
    console.error(`FAIL: Stage 6 expected trees > 0, got ${stageResults[6].trees}`);
    exitCode = 1;
  } else {
    console.log(`PASS: Stage 6 has ${stageResults[6].trees} trees`);
  }

  // 6. Assert FPS >= 30 fps
  if (perf.fps < 30) {
    console.error(`FAIL: FPS below 30 (got ${perf.fps} fps)`);
    exitCode = 1;
  } else {
    console.log(`PASS: FPS ${perf.fps} holds >= 30 fps threshold`);
  }

  // 5. Assert 0 page / console errors
  if (pageErrors.length > 0) {
    console.error(`FAIL: Page errors detected:`, pageErrors);
    exitCode = 1;
  } else {
    console.log('PASS: 0 page errors');
  }

  if (consoleErrors.length > 0) {
    console.error(`FAIL: Console errors detected:`, consoleErrors);
    exitCode = 1;
  } else {
    console.log('PASS: 0 console errors');
  }

} catch (err) {
  console.error('Test execution failed:', err);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill('SIGTERM');
  console.log(exitCode === 0 ? 'ALL CHECKS PASSED' : 'TESTS FAILED');
  process.exit(exitCode);
}
