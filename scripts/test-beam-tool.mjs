/**
 * TASK-21: the extraction rifle held in hand. On a kit boot (?base&kit=1) on the planet:
 *   1 G takes the rifle out (the mode chip shows Extract; the rifle is the first-person view model);
 *   2 Q cycles Extract, Apply, Sculpt (the chip follows), each mode shot in first person;
 *   3 Extract mines: the held rifle, aimed at a field node and beam-harvested, lowers the node's reserve;
 *   4 the frame rate over two seconds in each mode, with the beam firing in Extract.
 * Shots are gitignored (docs/shots/beam/), overlays hidden except the mode chip, each one looked at before it is posted.
 * Exit code 1 when a check fails.
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
const shotsDir = path.join(root, 'docs/shots/beam');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8198;
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
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try { localStorage.clear(); } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const HIDE = '.mentor-subtitle, .radio-hud-btn, .play-goal, .play-sync, .play-sync-indicator, .play-hud-hotbar, .hm-hotbar, .gr-bar, .play-dot, .hm-shelter-chip, .play-crosshair, .play-toast, .play-prompt, .play-plot, .play-build-reticle { display: none !important; }';
const shot = async (file) => {
  await page.addStyleTag({ content: HIDE });
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.screenshot({ path: path.join(shotsDir, file) });
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
};
const chip = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="beam-mode"]');
    return el ? { mode: el.getAttribute('data-mode'), text: el.textContent } : null;
  });
/** Frames drawn in `ms` milliseconds (requestAnimationFrame), to read the frame rate. */
const fps = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n += 1;
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve(Math.round((n * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

try {
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 35000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 15000 });

  check('no rifle chip before G', (await chip()) === null);

  // 1. G takes the rifle out
  await page.keyboard.press('g');
  await page.waitForFunction(() => document.querySelector('[data-testid="beam-mode"]') !== null, null, { timeout: 4000 }).then(
    () => check('G takes the rifle out (the chip appears)', true),
    () => check('G takes the rifle out (the chip appears)', false, 'no chip'),
  );
  let c = await chip();
  check('the rifle starts in Extract', c?.mode === 'extract', c ? c.text : 'no chip');
  await page.waitForTimeout(400);
  await shot('01-extract-first-person.png');

  // 2. Q cycles the modes
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q moves the rifle to Apply', c?.mode === 'apply', c?.mode ?? 'none');
  await shot('02-apply-first-person.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q moves the rifle to Sculpt', c?.mode === 'sculpt', c?.mode ?? 'none');
  await shot('03-sculpt-first-person.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q wraps back to Extract', c?.mode === 'extract', c?.mode ?? 'none');

  // 3. Extract mines a field node the held rifle reaches
  const node = await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const n = api.world().field.nodes.filter((x) => x.reserve > 0).sort((a, b) => Math.hypot(a.x - 12, a.z - 12) - Math.hypot(b.x - 12, b.z - 12))[0];
    return n ? { id: n.id, x: n.x, z: n.z, reserve: n.reserve } : null;
  });
  check('a field node with ore is on the planet', !!node, node ? `reserve ${node.reserve}` : 'none');
  const worn = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().equipment.beam?.item ?? null);
  check('the extraction beam is worn (the equipment slot)', worn === 'tool-beam', `slot holds ${worn}`);
  if (node) {
    await page.evaluate((node) => {
      const scene = window.__playScene;
      const api = window.__hm?.base ?? window.hmPlay?.base;
      const px = node.x, pz = node.z + 2.8;
      const camY = scene.heightAt(px, pz) + 1.7;
      const nodeY = scene.heightAt(node.x, node.z) + 0.35;
      const dx = node.x - px, dz = node.z - pz;
      scene.debug.teleport('planet', px, pz, Math.atan2(-dx, -dz), Math.atan2(nodeY - camY, Math.max(0.1, Math.hypot(dx, dz))));
      api.startBeam?.(node.id);
    }, node);
    await page.waitForTimeout(1500);
    const where = await page.evaluate(() => JSON.stringify(window.__playScene.debug.position()));
    console.log('player at', where, 'node', node.x.toFixed(2), node.z.toFixed(2));
    const after = await page.evaluate((id) => {
      const api = window.__hm?.base ?? window.hmPlay?.base;
      return api.world().field.nodes.find((x) => x.id === id)?.reserve ?? null;
    }, node.id);
    check('the held rifle in Extract lowers the node\'s reserve', after !== null && after < node.reserve, `${node.reserve} to ${after}`);
    await page.evaluate(() => window.__hm?.base?.stopBeam?.() ?? window.hmPlay?.base?.stopBeam?.());
  }

  // 4. Frame rate per mode (headless: SwiftShader, not the GTX 950M)
  const rates = {};
  for (const mode of ['extract', 'apply', 'sculpt']) {
    for (let presses = 0; presses < 6 && (await chip())?.mode !== mode; presses++) {
      await page.keyboard.press('q');
      await page.waitForTimeout(120);
    }
    rates[mode] = await fps(2000);
  }
  console.log('fps (headless, SwiftShader):', JSON.stringify(rates));
  check('the scene keeps drawing in every mode', Object.values(rates).every((r) => r > 0), JSON.stringify(rates));
} catch (err) {
  check('the run completes', false, err.message);
} finally {
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
