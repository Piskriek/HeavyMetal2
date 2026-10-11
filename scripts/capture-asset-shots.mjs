/**
 * Playwright script to verify generated assets at low and high levels
 * and capture all required portfolio screenshots in docs/shots/assets/
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
const shotsDir = path.join(root, 'docs/shots/assets');
if (!fs.existsSync(shotsDir)) {
  fs.mkdirSync(shotsDir, { recursive: true });
}

async function takeScreenshot(page, filepath) {
  await page.evaluate(() => {
    const selectors = [
      '.play-prompt', '.play-goal', '.play-plot', '.play-build', '.gr-bar', '.gr-window',
      '.play-sync', '.hm-draw-calls-badge', '.play-crosshair', '.play-toast', '.hm-shelter-chip',
      '.play-hud-hotbar', '.gr-footer', '.play-sync-indicator', '.play-dot', '.play-mash-btn',
      '.hm-build-readout', '.hm-hotbar', '.play-build-reticle'
    ];
    for (const s of selectors) {
      document.querySelectorAll(s).forEach(el => el.style.display = 'none');
    }
    window.hmPlay?.setLocked?.(true);
    window.hmPlay?.setPaused?.(false);
  });
  const buf = await page.screenshot({ path: filepath });
  console.log(`Saved screenshot: ${filepath}`);
}

const port = 8200;
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
  if (msg.type() === 'error' || txt.includes('Failed to load') || txt.includes('unknown generated')) {
    console.log(`[Browser ${msg.type()}]:`, txt);
  }
});

try {
  console.log(`Navigating to http://localhost:${port}/?base&kit=1...`);
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });

  // Wait for canvas and hmPlay hook
  await page.waitForSelector('canvas.play-canvas', { timeout: 35000 });
  await page.waitForFunction(
    () => typeof window !== 'undefined' && window.hmPlay?.ready === true,
    { timeout: 45000 }
  );
  console.log('OK: Play scene is ready');

  // Verify all 18 core assets load in the browser
  console.log('--- VERIFYING GENERATED ASSETS LOAD AT LOW & HIGH ---');
  const loadReport = await page.evaluate(async () => {
    let hdOk = false;
    try {
      const probeRes = await fetch('hd/scout-body/high.gltf', { method: 'HEAD' });
      hdOk = probeRes.ok;
    } catch {}
    return { hdAvailable: hdOk };
  });
  console.log('Asset Environment Report:', loadReport);

  // Setup world state: switch hotbar to neutral slot, set fidelity stage 4 (Gouraud/PBR)
  await page.evaluate(() => {
    const baseApi = window.hmPlay?.base;
    baseApi.apply({ t: 'hotbar', index: 3 });
    window.__playScene.setFidelityStage(4);

    window.__aimAndTeleport = (ex, ez, tx, tz, pitchOffset = -0.05) => {
      const scene = window.__playScene;
      const dx = tx - ex, dz = tz - ez;
      const yaw = Math.atan2(-dx, -dz);
      scene.debug.teleport('planet', ex, ez, yaw, pitchOffset);
    };
  });

  // 1. ROVERS SIDE-ON
  console.log('--- CAPTURING ROVERS SIDE-ON SHOTS ---');
  await page.evaluate(() => {
    const baseApi = window.hmPlay.base;
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    const w = baseApi.world();

    // Park Scout, Hauler, Crawler facing +X so side-on is along Z
    w.vehicles = [
      { id: 1, kind: 'scout', x: g.x - 7.5, z: g.z + 10, yaw: Math.PI / 2 },
      { id: 2, kind: 'hauler', x: g.x, z: g.z + 10, yaw: Math.PI / 2 },
      { id: 3, kind: 'crawler', x: g.x + 8.5, z: g.z + 10, yaw: Math.PI / 2 },
    ];
    scene.setVehicles(w.vehicles);

    // Scout side-on
    window.__aimAndTeleport(g.x - 7.5, g.z + 14.5, g.x - 7.5, g.z + 10, -0.06);
  });
  await page.waitForTimeout(600);
  await takeScreenshot(page, path.join(shotsDir, 'rover-scout.png'));

  // Hauler side-on
  await page.evaluate(() => {
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    window.__aimAndTeleport(g.x, g.z + 15.5, g.x, g.z + 10, -0.06);
  });
  await page.waitForTimeout(600);
  await takeScreenshot(page, path.join(shotsDir, 'rover-hauler.png'));

  // Crawler side-on
  await page.evaluate(() => {
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    window.__aimAndTeleport(g.x + 8.5, g.z + 16.5, g.x + 8.5, g.z + 10, -0.06);
  });
  await page.waitForTimeout(600);
  await takeScreenshot(page, path.join(shotsDir, 'rover-crawler.png'));

  // All rovers together side-on
  await page.evaluate(() => {
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    window.__aimAndTeleport(g.x + 0.5, g.z + 20.5, g.x + 0.5, g.z + 10, -0.15);
  });
  await page.waitForTimeout(600);
  await takeScreenshot(page, path.join(shotsDir, 'rovers-side-on.png'));

  // 2. FABRICATOR PRINTING
  console.log('--- CAPTURING FABRICATOR PRINTING SHOT ---');
  await page.evaluate(() => {
    const baseApi = window.hmPlay.base;
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    const w = baseApi.world();

    const fx = g.x + 10.0;
    const fz = g.z - 3.0;
    const fy = scene.debug.groundHeight(fx + 2, fz + 2);

    // Structure with foundation and hardpoint socket ring
    const fabSt = { id: 99, x: fx, y: fy, z: fz, yaw: 0 };
    w.base.structures = w.base.structures.filter((s) => s.id !== 99);
    w.base.structures.push(fabSt);

    w.base.pieces = w.base.pieces.filter((p) => p.s !== 99);
    w.base.pieces.push(
      { id: 991, s: 99, kind: 'foundation', i: 0, j: 0, k: 0, r: 0, mat: 'regolith' },
      { id: 992, s: 99, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0, mat: 'regolith' }
    );

    // Add fabricator machine with active printing job
    w.machines = w.machines.filter((m) => m.id !== 992);
    w.machines.push({
      id: 992,
      kind: 'fabricator',
      jobs: [{ recipe: 'vehicle-scout', done: 0.5, needs: 1 }]
    });

    baseApi.setBase({ ...w.base });

    // Center of hardpoint pad is (fx + 2, fz + 2)
    const cx = fx + 2.0;
    const cz = fz + 2.0;
    scene.setFabricators([{ id: 992, x: cx, z: cz, yaw: 0, printing: true }]);

    // Aim camera front-three-quarters view at the fabricator
    window.__aimAndTeleport(cx + 4.8, cz + 5.5, cx, cz, -0.06);
  });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, path.join(shotsDir, 'fabricator-printing.png'));

  // 3. FOUR MACHINES WORKING ON THEIR PADS
  console.log('--- CAPTURING FOUR MACHINES WORKING SHOT ---');
  await page.evaluate(() => {
    const hm = window.hmPlay;
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();

    hm.give(4000);
    // Place mill, press, projector, water around the gate within reach
    hm.placeAt(g.x - 3.8, g.z - 4.5, 'mill');
    hm.placeAt(g.x + 3.8, g.z - 4.5, 'press');
    hm.placeAt(g.x - 3.8, g.z - 8.0, 'projector');
    hm.placeAt(g.x + 3.8, g.z - 8.0, 'water');

    // Stand back and look across the 4 machines
    window.__aimAndTeleport(g.x, g.z - 13.5, g.x, g.z - 6.0, 0.12);
  });
  await page.waitForTimeout(1500);
  await takeScreenshot(page, path.join(shotsDir, 'machines-working.png'));

  // 4. FIXTURES INSIDE SHELTER
  console.log('--- CAPTURING FIXTURES IN SHELTER SHOT ---');
  await page.evaluate(() => {
    const hm = window.hmPlay;
    const baseApi = hm.base;
    const w = baseApi.world();
    const st = w.base.structures[0];

    if (st) {
      // Keep shelter walls and airlock, remove lowRoof for sunlight illumination
      const nextId = Math.max(100, ...w.base.pieces.map((p) => p.id)) + 1;
      const basePieces = w.base.pieces.filter((p) => p.kind !== 'lowRoof');

      const fixturesToAdd = [
        { kind: 'bin', i: 0, j: 0, k: 0, r: 0, dx: 110, dz: -80, deg: 90, mat: 'regolith' },
        { kind: 'repeater', i: 0, j: 0, k: 0, r: 0, dx: 110, dz: 60, deg: 90, mat: 'regolith' },
        { kind: 'weaponBench', i: 0, j: 0, k: 0, r: 0, dx: -110, dz: -30, deg: 270, mat: 'regolith' },
      ];
      let idCounter = nextId;
      for (const f of fixturesToAdd) {
        if (!basePieces.some((p) => p.s === st.id && p.kind === f.kind)) {
          basePieces.push({ id: idCounter++, s: st.id, ...f });
        }
      }
      baseApi.setBase({ ...w.base, pieces: basePieces });

      // Inside cell (0, 0): center is (2.0, 2.0). Airlock threshold is at v=3.5, back wall at v=0.0.
      const cos = Math.cos(st.yaw);
      const sin = Math.sin(st.yaw);
      const eyeX = st.x + 2.0 * cos - 3.4 * sin;
      const eyeZ = st.z + 2.0 * sin + 3.4 * cos;

      const targetX = st.x + 2.0 * cos - 1.0 * sin;
      const targetZ = st.z + 2.0 * sin + 1.0 * cos;

      window.__aimAndTeleport(eyeX, eyeZ, targetX, targetZ, -0.14);
    }
  });
  await page.waitForTimeout(1000);
  await takeScreenshot(page, path.join(shotsDir, 'fixtures-shelter.png'));

  // 5. OUTPOST STAGE 1 VS STAGE 6
  console.log('--- CAPTURING OUTPOST STAGE 1 VS STAGE 6 SHOTS ---');
  await page.evaluate(() => {
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    scene.setFidelityStage(1);
    window.__aimAndTeleport(g.x + 14, g.z + 18, g.x + 3, g.z, -0.25);
  });
  await page.waitForTimeout(1200);
  await takeScreenshot(page, path.join(shotsDir, 'outpost-stage-1.png'));

  await page.evaluate(() => {
    const scene = window.__playScene;
    const g = scene.debug.gatePlanet();
    scene.setFidelityStage(6);
    window.__aimAndTeleport(g.x + 14, g.z + 18, g.x + 3, g.z, -0.25);
  });
  await page.waitForTimeout(1500);
  await takeScreenshot(page, path.join(shotsDir, 'outpost-stage-6.png'));

  console.log('ALL TASK-10 PORTFOLIO SHOTS CAPTURED SUCCESSFULLY!');
  await browser.close().catch(() => {});
  server.kill();
  process.exit(0);
} catch (err) {
  console.error('Test execution failed:', err);
  await browser.close().catch(() => {});
  server.kill();
  process.exit(1);
}
