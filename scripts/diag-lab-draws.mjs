/**
 * Diagnostic (not a test): where the lab's draw calls go at test-lab-overhaul's gate view (Low). Enters the lab like that test, sets the
 * same camera and power, then hooks onBeforeRender on every drawable in the lab and planet scenes for one frame and prints the draws
 * grouped by scene, by ancestor path and by material. Run: npm run build && node scripts/diag-lab-draws.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8216;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stub')); };
  try {
    localStorage.clear();
    localStorage.setItem('hm.profile.v2', JSON.stringify({ name: 'Goblin', credits: 500, grownUp: true, tutorialDone: true, style: 'voxel', skin: 'flat', favIslands: [], quality: 'low', fpsTarget: 60, graphics: { vegetation: 'low' }, gpu: 'fast', controls: { sensitivity: 1, invertY: false, fov: 75 }, cameraView: 'first' }));
  } catch {}
});
const frames = async (n = 30) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
try {
  await page.goto(`http://localhost:${port}/?story`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room, { timeout: 90000 });
  await page.evaluate(() => { [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click(); });
  await frames(40);
  await page.evaluate(() => window.__playScene.debug.teleport('lab', -2.5, 1.0, 0));
  await page.evaluate(() => { window.__playScene.room.setWindowView('full'); window.__playScene.room.setStorm(0); });
  const power = { relays: 1, beacons: 1, pulse: 1, coils: 1, banks: [1, 1, 1], main: 1, hologram: 1, emergency: 0, static: 0, arc: 0 };
  const views = {
    gate: [{ x: 0, y: 1.7, z: 2.6 }, { x: 0, y: 1.5, z: -1.0 }],
    powerwall: [{ x: -2.5, y: 1.8, z: -4.6 }, { x: -7.8, y: 1.3, z: -4.6 }],
  };
  for (const [label, [eye, target]] of Object.entries(views)) {
    await page.evaluate(([e, t]) => window.__playScene.debug.setAltCam(e, 0, 0, t), [eye, target]);
    await page.evaluate((p) => window.__playScene.room.setPower(p), power);
    await frames(40);
    const out = await page.evaluate(async () => {
      const d = window.__playScene.debug;
      const scenes = { lab: d.labScene(), planet: d.planetScene() };
      const log = { lab: [], planet: [] };
      const saved = [];
      const pathOf = (o, top) => { const names = []; let n = o; while (n && n !== top) { names.unshift(n.name || n.type); n = n.parent; } return names; };
      for (const [k, sc] of Object.entries(scenes)) {
        sc.traverse((o) => {
          if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
          const prev = o.onBeforeRender;
          saved.push([o, prev]);
          o.onBeforeRender = function (...a) {
            const mat = a[4];
            log[k].push({ path: pathOf(o, sc), mat: mat ? `${mat.type}#${mat.uuid.slice(0, 6)}${mat.name ? ':' + mat.name : ''}` : '?' });
            return prev.apply(this, a);
          };
        });
      }
      // one whole frame: start on a frame boundary, then record the next frame and read its draw calls
      await new Promise((r) => requestAnimationFrame(r));
      for (const k of Object.keys(log)) log[k].length = 0;
      await new Promise((r) => requestAnimationFrame(r));
      const total = d.stats().calls;
      for (const [o, f] of saved) o.onBeforeRender = f;
      const group = (arr, depth) => { const m = {}; for (const e of arr) { const key = e.path.slice(0, depth).join(' / '); m[key] = (m[key] ?? 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
      const byMat = (arr) => { const m = {}; for (const e of arr) m[e.mat] = (m[e.mat] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40); };
      return {
        total, vista: window.__playScene.room.vista.stats(),
        labDraws: log.lab.length, planetDraws: log.planet.length,
        lab2: group(log.lab, 2), lab3: group(log.lab, 3), lab4: group(log.lab, 4), labMat: byMat(log.lab),
        planet2: group(log.planet, 2), planet3: group(log.planet, 3),
        labFull: (() => { const m = {}; for (const e of log.lab) { const k = `${e.path.join(' / ')}  [${e.mat}]`; m[k] = (m[k] ?? 0) + 1; } return Object.entries(m); })(),
      };
    });
    console.log(`\n===== ${label}: total ${out.total}, lab draws ${out.labDraws}, planet draws ${out.planetDraws}, vista ${JSON.stringify(out.vista)}`);
    for (const k of ['lab2', 'lab3', 'lab4', 'labMat', 'planet2', 'planet3']) {
      console.log(`--- ${k}`);
      for (const [key, n] of out[k]) console.log(`  ${String(n).padStart(4)}  ${key}`);
    }
    if (label === 'gate') { console.log('--- lab, every draw'); for (const [l, n] of out.labFull) console.log(`  ${String(n).padStart(4)}  ${l}`); }
  }
} finally {
  await browser.close();
  server.kill();
}
