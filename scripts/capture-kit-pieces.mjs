/**
 * TASK-10b shots in docs/shots/base/: one built outpost at stage 1 and at stage 6, and a close-up where the two roof
 * corners meet. The foundations and the plain walls go through the game's own commands. The round-4 kinds (roofs,
 * ridge caps, gables, window walls, doors, half walls, stairs, the airlock and the ramp) are not in every blueprint
 * family yet, so this script writes them straight into the live base world, then forces a base sync.
 *
 * Also prints every apply result, so a refused command shows up in the log.
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
  console.log('Chrome not found, skipping browser capture');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'docs/shots/base');
fs.mkdirSync(shotsDir, { recursive: true });

async function takeScreenshot(page, filepath) {
  await page.evaluate(() => {
    const selectors = [
      '.play-prompt', '.play-goal', '.play-plot', '.play-build', '.gr-bar', '.gr-window',
      '.play-sync', '.hm-draw-calls-badge', '.play-crosshair', '.play-toast', '.hm-shelter-chip',
      '.play-hud-hotbar', '.gr-footer', '.play-sync-indicator', '.play-dot', '.play-mash-btn',
      '.hm-build-readout', '.hm-hotbar', '.play-build-reticle', '.mentor-subtitle', '.radio-hud-btn', '.play-start',
    ];
    for (const s of selectors) document.querySelectorAll(s).forEach((el) => (el.style.display = 'none'));
    window.hmPlay?.setLocked?.(true);
    window.__hm?.hideOverlays?.(true);
    window.__hm?.clearToast?.();
    window.__playScene?.setPlanGhosts?.([]);
  });
  await new Promise((r) => setTimeout(r, 400));
  const buf = await page.screenshot();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filepath, buf);
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  console.log(`Captured ${path.relative(root, filepath)}`);
}

const port = 8202;
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
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in capture'));
  };
  try {
    localStorage.clear();
  } catch {}
});
page.on('pageerror', (err) => console.error('[Browser Page Error]:', err.message));

try {
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas.play-canvas', { timeout: 35000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 45000 });
  console.log('OK: play scene ready');

  // Stock the pack and the bridge store, as the base test does, so the commands can pay.
  await page.evaluate(() => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const stock = [{ item: 'ore', n: 1200 }, { item: 'map-basalt', n: 50 }, { item: 'prim-chassis', n: 50 }, { item: 'prim-beam', n: 50 }, { item: 'prim-cube', n: 50 }, { item: 'prim-column', n: 50 }];
    const w = baseApi.world();
    let idx = 5;
    for (const it of stock) w.player.slots[idx++] = { item: it.item, n: it.n };
    const box = w.boxes.find((b) => b.id === -2);
    if (box) stock.forEach((it, i) => (box.slots[i] = { item: it.item, n: it.n }));
  });

  // Found the 2 x 2 block with the game's own commands.
  const built = await page.evaluate(() => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const at = { x: 12, z: 12 };
    const log = [];
    const r0 = baseApi.apply({ t: 'found', at, blueprint: 'bp:starter', cx: 12, cz: 12, yaw: 0 });
    log.push(['found', r0.events.map((e) => e.type).join(',')]);
    const s = baseApi.world().base.pieces.find((p) => p.kind === 'foundation').s;
    for (const [i, j] of [[1, 0], [0, 1], [1, 1]]) {
      const r = baseApi.apply({ t: 'place', at, blueprint: 'bp:starter', piece: { s, kind: 'foundation', i, j, k: 0, r: 0 } });
      log.push([`foundation ${i},${j}`, r.events.map((e) => e.type).join(',')]);
    }
    return { s, log };
  });
  console.log('Foundation commands:', JSON.stringify(built.log));

  // The round-4 kinds, written straight into the live base world (see the header).
  const placed = await page.evaluate((s) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const w = baseApi.world();
    const add = (kind, i, j, k, r) => {
      const id = Math.max(0, ...w.base.pieces.map((p) => p.id)) + 1;
      w.base.pieces.push({ id, s, kind, i, j, k, r, mat: 'regolith' });
    };
    // ground walls on the block's outer edges
    add('windowWall', 0, 0, 0, 0);
    add('wall', 1, 0, 0, 0);
    add('wall', 0, 0, 0, 1);
    add('halfWall', 0, 1, 0, 1);
    add('wall', 1, 0, 0, 1);
    add('airlock', 1, 1, 0, 1);
    add('door', 0, 1, 0, 0);
    add('windowWall', 1, 1, 0, 0);
    // a ramp and stairs at the front
    add('ramp', 0, 2, 0, 0);
    add('stairs', 1, 2, 0, 0);
    // the roof: two back-to-back pitches with a ridge, gables at the ends, and the two corners
    add('roofOuter', 0, 0, 1, 0);
    add('roof', 1, 0, 1, 0);
    add('roof', 0, 1, 1, 2);
    add('roofInner', 1, 1, 1, 2);
    add('ridgeCap', 0, 1, 1, 0);
    add('ridgeCap', 1, 1, 1, 0);
    add('gable', 0, 0, 1, 1);
    add('gable', 0, 1, 1, 1);
    add('gable', 2, 0, 1, 1);
    add('gable', 2, 1, 1, 1);
    baseApi.apply({ t: 'hotbar', index: 3 });
    return w.base.pieces.length;
  }, built.s);
  console.log('Pieces in the base after writing the round-4 kinds:', placed);

  const framing = (stage, fidelity) => page.evaluate(
    ({ stage, fidelity, s }) => {
      const baseApi = window.__hm?.base ?? window.hmPlay?.base;
      const scene = window.__playScene;
      baseApi.apply({ t: 'stage', stage });
      scene?.setFidelityStage(fidelity);
      baseApi.toggleIntegrity(false);
      const w = baseApi.world();
      const st = w.base.structures.find((x) => x.id === s);
      const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
      const toWorld = (lx, ly, lz) => ({ x: st.x + lx * cosY - lz * sinY, y: st.y + ly, z: st.z + lx * sinY + lz * cosY });
      // the outpost's centre, from its cells
      const mine = w.base.pieces.filter((p) => p.s === s);
      let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
      for (const p of mine) { minI = Math.min(minI, p.i); maxI = Math.max(maxI, p.i); minJ = Math.min(minJ, p.j); maxJ = Math.max(maxJ, p.j); }
      const centre = toWorld(((minI + maxI + 1) * 4) / 2, 1.5, ((minJ + maxJ + 1) * 4) / 2);
      // a 3/4 view from the front-left, above the roof and the stairs
      const from = toWorld(-6, 8, 17);
      const target = toWorld(4, 1.5, 5.5);
      const dx = target.x - from.x, dy = target.y - from.y, dz = target.z - from.z;
      scene?.debug.setAltCam?.(from, Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz));
      scene?.frame(0, 0.016, { move: { x: 0, z: 0 }, look: { dx: 0, dy: 0 }, run: false, altCam: true });
      return { ok: true, pieces: mine.length };
    },
    { stage, fidelity, s: built.s },
  );

  const closeUp = (s) => page.evaluate((s) => {
    const baseApi = window.__hm?.base ?? window.hmPlay?.base;
    const scene = window.__playScene;
    const st = baseApi.world().base.structures.find((x) => x.id === s);
    const cosY = Math.cos(st.yaw), sinY = Math.sin(st.yaw);
    const toWorld = (lx, ly, lz) => ({ x: st.x + lx * cosY - lz * sinY, y: st.y + ly, z: st.z + lx * sinY + lz * cosY });
    // where the two roof corners meet: the middle of the block at roof height, from the back-left
    const target = toWorld(4, 2.8, 4);
    const from = toWorld(0, 5.5, -1.5);
    const dx = target.x - from.x, dy = target.y - from.y, dz = target.z - from.z;
    scene?.debug.setAltCam?.(from, Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz));
    scene?.frame(0, 0.016, { move: { x: 0, z: 0 }, look: { dx: 0, dy: 0 }, run: false, altCam: true });
  }, s);

  // stage 1 and stage 6, same layout
  await framing(1, 1);
  await page.waitForTimeout(700);
  await takeScreenshot(page, path.join(shotsDir, 'kit-pieces-s1.png'));

  await framing(6, 4);
  await page.waitForTimeout(700);
  await takeScreenshot(page, path.join(shotsDir, 'kit-pieces-s6.png'));

  await closeUp(built.s);
  await page.waitForTimeout(700);
  await takeScreenshot(page, path.join(shotsDir, 'kit-roof-corners.png'));

  await page.evaluate(() => window.__playScene?.debug.clearAltCam?.());
  console.log('DONE');
} catch (err) {
  console.error('CAPTURE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
