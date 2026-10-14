/**
 * TASK-24: frame time on the GPU, at four places, on Low and Medium (TASK-19 review 2's V7 method).
 *   - headed Chrome with --use-angle=d3d11 --force_high_performance_gpu --disable-gpu-vsync, on the production single file
 *     (apps/web/dist/index.html), the renderer string logged from WEBGL_debug_renderer_info;
 *   - per run: 3 s to settle, then 10 s of requestAnimationFrame deltas: the median and the 95th-percentile frame ms;
 *   - the places: the lab (act I's save), the gate (act IV's save, from the planet side), the base (act V's save, beside a
 *     built piece) and mid-fight (stage 6 with the monsters unlocked: eight monsters placed 5 to 12 m off, in the Normal setting);
 *   - tiers: Low is the profile's quality 'low' (V7's "Lite"), Medium is 'medium' (V7's "Full"). The tier is written to the
 *     Checkpoint profile's device settings, which a checkpoint load keeps.
 * Needs scripts/test-campaign.mjs's checkpoints (apps/web/public/checkpoints) in a build. Shots: shots-run/fps/.
 * Writes shots-run/fps/fps.json. Exits 1 when a run cannot be measured.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/fps');
fs.mkdirSync(outDir, { recursive: true });
const port = 8196;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu', '--disable-gpu-vsync'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const renderer = await (async () => {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
})();
console.log(`renderer: ${renderer}`);

/** Opens a checkpoint (or the saved game) and waits until the game is ready. */
const open = async (checkpoint) => {
  await page.goto(`${base}/?e2e${checkpoint ? `&checkpoint=${checkpoint}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    await page.locator('.sm-menu button', { hasText: labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition' }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
};

/** The tier of the Checkpoint profile's device settings. */
const setQuality = async (quality) => {
  await page.evaluate((q) => {
    const reg = JSON.parse(localStorage.getItem('hm.profiles') ?? '{"active":"checkpoint"}');
    const cur = JSON.parse(localStorage.getItem('hm.p.checkpoint.hm.profile.v2') ?? '{}');
    localStorage.setItem('hm.p.checkpoint.hm.profile.v2', JSON.stringify({ ...cur, quality: q }));
    return reg.active;
  }, quality);
};

/** Ten seconds of frame deltas, from requestAnimationFrame. */
const frames = (ms = 10000) => page.evaluate((ms) => new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  const tick = (now) => {
    deltas.push(now - last);
    last = now;
    if (now - t0 < ms) requestAnimationFrame(tick);
    else resolve(deltas.slice(1));
  };
  requestAnimationFrame(tick);
}), ms);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

const PLACES = {
  // the lab from its spawn view (act I's save)
  lab: { checkpoint: 'act1-wake', setup: async () => {} },
  // the gate, from the planet side, 10 m out and looking at it (act IV's save, the gate is powered)
  gate: {
    checkpoint: 'act4-start',
    setup: async () => {
      await page.evaluate(() => {
        const g = window.__playScene.debug.gatePlanet();
        window.hmPlay.go('planet', g.x, g.z - 10, 0, -0.2);
        window.hmPlay.setLocked?.(true);
      });
      await page.waitForTimeout(1200);
    },
  },
  // beside a built piece of the base (act V's save), looking at it
  base: {
    checkpoint: 'act5-start',
    setup: async () => {
      await page.evaluate(() => {
        const pieces = window.hmPlay.base.world().base.pieces;
        const b = pieces.map((p) => window.__playScene.debug.pieceBounds(p.id)).find((x) => x);
        const c = b ? [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2) : [0, 0, 0];
        window.hmPlay.go('planet', c[0], c[2] - 6, 0, -0.35);
        window.hmPlay.setLocked?.(true);
      });
      await page.waitForTimeout(1200);
    },
  },
  // mid-fight: stage 6, the monsters unlocked (the stage-6 save), eight of them placed 5 to 12 m off, Normal
  fight: {
    checkpoint: 'stage6-monsters',
    setup: async () => {
      await page.evaluate(() => {
        const g = window.__playScene.debug.gatePlanet();
        window.hmPlay.go('planet', g.x, g.z - 14, 0, -0.2);
        window.hmPlay.setLocked?.(true);
        window.__dev.setMonstersSetting('normal');
        window.__dev.setHp(100);
        ['charger', 'brute', 'swarmer', 'charger', 'brute', 'swarmer', 'charger', 'brute'].forEach((k, i) => window.__dev.placeMob(k, 5 + i * 1));
      });
      await page.waitForTimeout(1500);
    },
  },
};

const results = [];
try {
  // the Checkpoint profile is made by the first load; its device settings carry the tier
  await open('act1-wake');
  for (const tier of ['low', 'medium']) {
    for (const [place, spec] of Object.entries(PLACES)) {
      await open(spec.checkpoint);
      await setQuality(tier);
      await open(spec.checkpoint);
      await spec.setup();
      await page.waitForTimeout(3000);
      const deltas = await frames(10000);
      const med = pct(deltas, 50), p95 = pct(deltas, 95);
      const fps = Math.round((deltas.length * 1000) / deltas.reduce((a, b) => a + b, 0));
      const shot = path.join(outDir, `${tier}-${place}.png`);
      await page.screenshot({ path: shot });
      const row = { tier, place, renderer, frames: deltas.length, median: Math.round(med * 10) / 10, p95: Math.round(p95 * 10) / 10, fps };
      results.push(row);
      console.log(`${tier.padEnd(6)} ${place.padEnd(6)} median ${row.median} ms  p95 ${row.p95} ms  ${row.fps} fps  (${row.frames} frames in 10 s)`);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, 'fps.json'), `${JSON.stringify({ renderer, results, pageErrors }, null, 2)}\n`);
  server.kill();
  await browser.close();
}
if (results.length < 8) process.exitCode = 1;
