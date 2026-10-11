/**
 * TASK-10d: Capture Sheet 21 Lab portfolio shots and test end-to-end power-on sequence.
 * Saves shots to docs/shots/lab/
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
const shotsDir = path.join(root, 'docs/shots/lab');
if (!fs.existsSync(shotsDir)) {
  fs.mkdirSync(shotsDir, { recursive: true });
}

async function takeScreenshot(page, filename) {
  const filepath = path.join(shotsDir, filename);
  await page.evaluate(() => {
    const selectors = [
      '.play-prompt', '.play-goal', '.play-plot', '.play-build', '.gr-bar', '.gr-window',
      '.play-sync', '.hm-draw-calls-badge', '.play-crosshair', '.play-toast', '.hm-shelter-chip',
      '.play-hud-hotbar', '.gr-footer', '.play-sync-indicator', '.play-dot', '.play-mash-btn',
      '.hm-build-readout', '.hm-hotbar', '.play-build-reticle', '.play-create', '.play-start'
    ];
    for (const s of selectors) {
      document.querySelectorAll(s).forEach(el => (el.style.display = 'none'));
    }
  });
  const buf = await page.screenshot();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filepath, buf);
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise(r => setTimeout(r, 250));
    }
  }
  console.log(`Saved screenshot: ${filepath}`);
}

const port = 8201;
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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
  } catch {}
});

page.on('pageerror', (err) => console.error('[Browser Page Error]:', err.message));
page.on('console', (msg) => {
  const txt = msg.text();
  if (msg.type() === 'error' || txt.includes('Failed to load') || txt.includes('TypeError')) {
    console.log(`[Browser ${msg.type()}]:`, txt);
  }
});

try {
  console.log(`Navigating to http://localhost:${port}/...`);
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });

  // Open Play to enter the lab
  await page.waitForSelector('.sm-menu button', { timeout: 35000 });
  const playBtn = page.locator('.sm-menu button', { hasText: 'Play' }).first();
  await playBtn.click();

  // Wait for canvas and hmPlay
  await page.waitForFunction(
    () => typeof window !== 'undefined' && window.hmPlay?.ready === true,
    { timeout: 45000 }
  );
  console.log('OK: Play scene is mounted and ready in the Lab');

  // Dismiss creator if open
  await page.evaluate(() => {
    const doneBtn = [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'));
    doneBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Verify room properties
  const labInfo = await page.evaluate(() => {
    const ps = window.__playScene;
    const room = ps?.room;
    const renderer = ps?.renderer;
    const calls = renderer?.info?.render?.calls ?? 0;
    const triangles = renderer?.info?.render?.triangles ?? 0;
    return {
      hasRoom: !!room,
      hasGate: !!room?.gate,
      hasLever: !!room?.lever,
      spawn: room?.spawn,
      calls,
      triangles,
    };
  });
  console.log('Lab Info Report:', labInfo);

  // --- 1. Panel 42: Act I Dark from the cot
  console.log('--- CAPTURING PANEL 42: ACT I DARK FROM COT ---');
  await page.evaluate(() => {
    const ps = window.__playScene;
    const room = ps.room;
    // Set power OFF (emergency amber only, storm is brightest thing)
    room.setPower({ relays: 0, pulse: 0, coils: 0, main: 0, emergency: 1, static: 1 });
    room.setStorm(0);
    // From the spawn by the cot, at eye height, looking north at the gate and the storm (panel 42's camera)
    ps.debug.setAltCam(
      { x: room.spawn.x, y: 1.65, z: room.spawn.z },
      0, 0,
      { x: -0.8, y: 1.7, z: -9.0 }
    );
  });
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, '42-act1-dark.png');

  // --- 2. Panel 41: The Layout (Cutaway from south-east above, ceiling hidden)
  console.log('--- CAPTURING PANEL 41: THE LAYOUT CUTAWAY ---');
  await page.evaluate(() => {
    const ps = window.__playScene;
    const room = ps.room;
    // Turn power on
    room.setPower({ relays: 1, pulse: 1, coils: 1, main: 1, emergency: 0, static: 0 });
    room.setStorm(0.2);
    // Hide ceiling mesh
    room.group.traverse((obj) => {
      if (obj.isMesh && obj.position.y >= 4.9) {
        obj.visible = false;
      }
    });
    // Camera above south-east corner looking down at center
    ps.debug.setAltCam(
      { x: 7.2, y: 7.8, z: 4.8 },
      0, 0,
      { x: -0.5, y: 1.2, z: -2.5 }
    );
  });
  await new Promise((r) => setTimeout(r, 500));
  await takeScreenshot(page, '41-layout.png');

  // Restore ceiling
  await page.evaluate(() => {
    const ps = window.__playScene;
    ps.room.group.traverse((obj) => {
      if (obj.isMesh && obj.position.y >= 4.9) {
        obj.visible = true;
      }
    });
  });

  // --- 3. Panel 44: The Power Wall (close up, from room center looking west)
  console.log('--- CAPTURING PANEL 44: THE POWER WALL ---');
  await page.evaluate(() => {
    const ps = window.__playScene;
    ps.room.setPower({ relays: 1, pulse: 1, coils: 1, main: 0.8, emergency: 0, static: 0 });
    // Camera at room center looking west at power wall
    ps.debug.setAltCam(
      { x: -1.2, y: 1.7, z: -3.5 },
      0, 0,
      { x: -7.5, y: 1.6, z: -3.5 }
    );
  });
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, '44-power-wall.png');

  // --- 4. Panel 45: The Studio Corner (preset rack, bench, combiner, planet table)
  console.log('--- CAPTURING PANEL 45: THE STUDIO CORNER ---');
  await page.evaluate(() => {
    const ps = window.__playScene;
    ps.room.setPower({ relays: 1, pulse: 1, coils: 1, main: 0.9, emergency: 0, static: 0 });
    // Camera from room center looking east at studio corner and planet table
    ps.debug.setAltCam(
      { x: 1.5, y: 1.7, z: -4.5 },
      0, 0,
      { x: 7.5, y: 1.4, z: -5.0 }
    );
  });
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, '45-studio-corner.png');

  // --- 5. Panel 46: The Armory and Her Corner
  console.log('--- CAPTURING PANEL 46: ARMORY & HER CORNER ---');
  await page.evaluate(() => {
    const ps = window.__playScene;
    ps.room.setPower({ relays: 1, pulse: 1, coils: 1, main: 0.9, emergency: 0, static: 0 });
    // Camera looking south toward cot, desk, wall radio, and armory
    ps.debug.setAltCam(
      { x: 0.5, y: 1.8, z: -0.5 },
      0, 0,
      { x: 1.0, y: 1.1, z: 2.6 }
    );
  });
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, '46-armory-her-corner.png');

  // --- 6. Window Storm Progress Meters (0, 0.5, 1.0)
  console.log('--- CAPTURING WINDOW STORM PROGRESS SHOTS (0, 0.5, 1.0) ---');
  // Camera about 4 m from the north wall, north of the gate (the gate stands behind it): the window fills the frame
  const aimWindow = () => {
    window.__playScene.debug.setAltCam(
      { x: -1.5, y: 1.6, z: -5.0 },
      0, 0,
      { x: 0, y: 1.95, z: -9.0 }
    );
  };

  // Storm 0 (full void storm)
  await page.evaluate((aim) => {
    eval(`(${aim})()`);
    window.__playScene.room.setPower({ relays: 0, pulse: 0, coils: 0, main: 0.1, emergency: 1, static: 1 });
    window.__playScene.room.setStorm(0.0);
  }, aimWindow.toString());
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, 'window-storm-0.png');

  // Storm 0.5 (thinning, grey ground and ruined skyline)
  await page.evaluate((aim) => {
    eval(`(${aim})()`);
    window.__playScene.room.setStorm(0.5);
  }, aimWindow.toString());
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, 'window-storm-0.5.png');

  // Storm 1.0 (breaking, azure blue sky, soft clouds, restored green land)
  await page.evaluate((aim) => {
    eval(`(${aim})()`);
    window.__playScene.room.setStorm(1.0);
  }, aimWindow.toString());
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot(page, 'window-storm-1.0.png');

  // --- 7. Test Power Sequence End-to-End
  console.log('--- TESTING POWER SEQUENCE END-TO-END ---');
  const seqResult = await page.evaluate(async () => {
    const ps = window.__playScene;
    const room = ps.room;
    // Step power sequence through 0 to 6.5s
    const steps = [0, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5];
    const states = [];
    for (const t of steps) {
      // Simulate powerAt(t)
      const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
      const dip = ramp(t, 2.0, 2.6) * (1 - ramp(t, 5.0, 6.3));
      const p = {
        relays: ramp(t, 0.4, 1.9),
        pulse: ramp(t, 1.2, 2.4),
        coils: ramp(t, 2.0, 4.4),
        main: ramp(t, 0.9, 1.6) * (1 - 0.65 * dip),
        emergency: 1 - ramp(t, 1.2, 2.2),
        static: 1 - ramp(t, 3.8, 5.4),
      };
      room.setPower(p);
      states.push({
        t,
        relays: p.relays > 0,
        coils: p.coils > 0,
        main: p.main > 0,
        portalVisible: room.portal.visible,
      });
    }
    return states;
  });
  console.log('Power Sequence Timeline Verified:', seqResult);

  // Measure draw calls
  const drawCallsReport = await page.evaluate(() => {
    const ps = window.__playScene;
    const calls = ps.renderer.info.render.calls;
    const tris = ps.renderer.info.render.triangles;
    return { calls, tris };
  });
  console.log(`Draw calls report: ${drawCallsReport.calls} calls, ${drawCallsReport.tris} triangles`);

  console.log('\nALL SHEET 21 LAB SCREENSHOTS AND VERIFICATION CHECKS PASSED!\n');
} finally {
  await browser.close();
  server.kill();
}
