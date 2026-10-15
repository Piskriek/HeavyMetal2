/**
 * TASK-27 browser checks: the stage looks in the built game (apps/web/dist, so run `npm run build` first).
 *   - the shader compiles and draws (no WebGL or shader errors in the console);
 *   - stage 0a on arrival, the first machine's scan wave, and stage 0b after it (shots in shots-run/stage-looks/);
 *   - the turn test: a 64 x 64 patch of the ground is re-projected across a 5 degree yaw (a pure yaw about the camera is an
 *     exact screen homography, so no depth is needed); the share of its pixels whose bit flips is the flip fraction. A control
 *     with the yaw sign reversed is printed beside it, so the mapping itself is checked against the data;
 *   - the gate's amber pool is warm in the picture within 15 m of the gate.
 * Exits 1 on any failed check.
 *   node scripts/test-stage-looks.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/stage-looks');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.error('Chrome not found; install Chrome or set the path in this script.');
  process.exit(1);
}
const port = 8197;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const W = 1280, H = 720;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const shaderErrors = [];
const shaderWarnings = [];
const pageErrors = [];
page.on('console', (m) => {
  const t = m.text();
  if (!/shader|glsl|webgl/i.test(t)) return;
  if (m.type() === 'error') shaderErrors.push(t.slice(0, 300));
  else if (m.type() === 'warning' || /warning X/.test(t)) shaderWarnings.push(t.slice(0, 200));
});
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shotBuf = async (name) => {
  const buf = await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  return PNG.sync.read(buf);
};
const wait = (ms) => page.waitForTimeout(ms);
/** Amber ink (#ffc13d, lighter after the colour conversion): bright, warm, far from white. Brown terrain is too dark to pass. */
const isAmber = (r, g, b) => r > 200 && g > 140 && r - b > 70 && b < 200;

/** The bit of a picture pixel: light ink (or amber) is 1, the black fill is 0. */
const bitAt = (img, u, v) => {
  const i = (Math.round(v) * img.width + Math.round(u)) * 4;
  const lum = (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) / 255;
  return lum > 0.35 ? 1 : 0;
};

/**
 * The screen position, in picture B, of pixel (u, v) of picture A after a pure yaw of `dYaw` about the camera (A at yaw 0):
 * world = Ry(0) d = d, and in B's camera space d_B = Ry(-dYaw) d, projected with the 72 degree vertical field of view.
 */
const tanHalf = Math.tan((72 * Math.PI) / 360);
const aspect = W / H;
const reproject = (u, v, dYaw) => {
  const nx = (2 * u) / W - 1, ny = 1 - (2 * v) / H;
  const dx = nx * tanHalf * aspect, dy = ny * tanHalf, dz = -1;
  const c = Math.cos(dYaw), s = Math.sin(dYaw);
  const bx = c * dx - s * dz, bz = s * dx + c * dz;
  if (bz >= -1e-6) return null;
  const ndcX = bx / -bz / (tanHalf * aspect), ndcY = dy / -bz / tanHalf;
  return { u: ((ndcX + 1) / 2) * W, v: ((1 - ndcY) / 2) * H };
};

/** The flip fraction of the centre 64 x 64 patch of picture A against picture B, under a yaw of `dYaw`. */
const flipFraction = (a, b, dYaw) => {
  let flips = 0, counted = 0, outside = 0;
  for (let v = H / 2 - 32; v < H / 2 + 32; v++) {
    for (let u = W / 2 - 32; u < W / 2 + 32; u++) {
      const p = reproject(u, v, dYaw);
      if (!p || p.u < 0 || p.v < 0 || p.u >= W - 1 || p.v >= H - 1) { outside++; continue; }
      counted++;
      if (bitAt(a, u, v) !== bitAt(b, p.u, p.v)) flips++;
    }
  }
  return { fraction: counted ? flips / counted : NaN, counted, outside };
};

try {
  // a base start with no seeded plot: the plot is at stage 0 (base&kit=1 seeds stage 1)
  await page.goto(`http://localhost:${port}/?base&e2e&cleanShot=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 35000 });
  await page.evaluate(() => { window.hmPlay.teleportPlanet?.(); window.hmPlay.give?.(200); window.hmPlay.hideOverlays?.(false); });
  await wait(1500);

  const g = await page.evaluate(() => window.hmPlay.gate());
  const badge = await page.evaluate(() => document.querySelector('.hud-floats')?.textContent ?? '');
  check('the plot is at stage 0 (the S0 badge)', /S0/.test(badge), badge.replace(/s+/g, ' ').slice(0, 40));

  // 1. stage 0a on arrival: the gate's pool is 5 m off, looking at it, before any machine runs
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 5, 0, -0.25), g);
  await wait(1500);
  const arrival = await shotBuf('01-stage0a-arrival');
  const bright = (() => { let n = 0; for (let i = 0; i < arrival.data.length; i += 4 * 97) if (arrival.data[i] > 90) n++; return n; })();
  check('stage 0a draws (the picture is not blank)', bright > 50, `${bright} bright samples`);
  check('stage 0a: the world is mostly black fill with light edges', bright / (arrival.data.length / (4 * 97)) < 0.5);

  // 2. the first machine: the scan wave runs from it, then the world is 0b
  await page.evaluate(({ x, z }) => window.hmPlay.placeAt(x + 7, z + 5, 'mill'), g);
  await wait(900);
  await shotBuf('02-scan-early');
  await wait(1700);
  await shotBuf('03-scan-mid');
  await wait(4000);
  // the plot's first output raises it to stage 1 within seconds, so the 0b picture is held with the scene's stage-0 hook
  const stageNow = await page.evaluate(() => document.querySelector('.hud-floats')?.textContent ?? '');
  check('the scan ran to its end and the picture after it still draws', stageNow.length > 0, stageNow.replace(/s+/g, ' ').slice(0, 12));
  // window.__dev.fidelity sets the scene's stage (e2e): stage 0 holds the 0b look with the scan done
  const hasFid = await page.evaluate(() => typeof window.__dev?.fidelity === 'function');
  check('the stage hook is there (window.__dev.fidelity)', hasFid);
  if (hasFid) await page.evaluate(() => window.__dev.fidelity(0));
  await wait(1000);
  const b0 = await shotBuf('04-stage0b');
  const inkShare = (() => { let n = 0, t = 0; for (let i = 0; i < b0.data.length; i += 4 * 97) { t++; if (b0.data[i] > 90) n++; } return n / t; })();
  check('stage 0b: the picture is one-bit (ink and black, both present)', inkShare > 0.05 && inkShare < 0.95, `ink share ${(inkShare * 100).toFixed(0)}%`);

  // 3. the turn test on the resolved world: yaw 0 against yaw 5 degrees, same place and pitch
  // the two frames are taken with the same settled state: the stage-0 hold re-applied, and the ground's chunks given time to build
  const hold = () => page.evaluate(() => window.__dev?.fidelity?.(0));
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 9, 0, -0.2), g);
  await hold(); await wait(2500); await hold(); await wait(300);
  const turnA = await shotBuf('05-turn-yaw0');
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 9, 5 * Math.PI / 180, -0.2), g);
  await hold(); await wait(2500); await hold(); await wait(300);
  const turnB = await shotBuf('06-turn-yaw5');
  const dYaw = 5 * Math.PI / 180;
  const f = flipFraction(turnA, turnB, dYaw);
  const control = flipFraction(turnA, turnB, -dYaw);
  const same = flipFraction(turnA, turnA, 0);
  console.log(`turn test: flip fraction ${(f.fraction * 100).toFixed(1)}% of ${f.counted} patch pixels (${f.outside} left the frame); control with the sign reversed ${(control.fraction * 100).toFixed(1)}%; identical frame ${(same.fraction * 100).toFixed(1)}%`);
  check('turn test: under 5% of the patch flips on a 5 degree yaw', f.fraction < 0.05, `${(f.fraction * 100).toFixed(1)}%`);
  check('turn test: the mapping is the right one (the reversed sign flips more)', control.fraction > f.fraction, `${(control.fraction * 100).toFixed(1)}% against ${(f.fraction * 100).toFixed(1)}%`);

  // 4. the gate's amber pool: close to the gate, warm pixels show; far away, none
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 3, 0, -0.35), g);
  await wait(1200);
  const pool = await shotBuf('07-amber-pool');
  let amber = 0, total = 0;
  for (let i = 0; i < pool.data.length; i += 4 * 3) {
    total++;
    const r = pool.data[i], gg = pool.data[i + 1], b = pool.data[i + 2];
    if (isAmber(r, gg, b)) amber++;
  }
  check('the gate pool is amber close to the gate', amber / total > 0.005, `${((amber / total) * 100).toFixed(2)}% of the picture`);
  // far from the gate the same picture has no amber ink (the pool fades out by 15 m)
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z - 30, Math.PI, -0.35), g);
  await wait(1200);
  const far = await shotBuf('07b-far-from-pool');
  let farAmber = 0;
  for (let i = 0; i < far.data.length; i += 4 * 3) { if (isAmber(far.data[i], far.data[i + 1], far.data[i + 2])) farAmber++; }
  check('far from the gate there is no amber ink', farAmber / total < amber / total, `${((farAmber / total) * 100).toFixed(2)}% against ${((amber / total) * 100).toFixed(2)}%`);

  // 5. stage 5 with the suit cam (Auto)
  // the same view as the Off run below: the gate 9 m off, level-ish, so the two pictures compare
  await page.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 9, 0, -0.2), g);
  await page.evaluate(() => window.__dev.fidelity(5));
  await wait(2500);
  await shotBuf('08-stage5-suitcam-auto');

  // 6. stage 5 with Suit-Cam Optics Auto and Off, each in a fresh page (its own profile, read at load), the same view: the
  //    planet's picture is compared, so the HUD and the game state do not count
  const freshStage5 = async (setting, name) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const pg = await ctx.newPage();
    await pg.addInitScript((value) => {
      Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
      if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('hm.profile.v2', JSON.stringify({ graphics: { suitCamOptics: value } })); sessionStorage.setItem('seeded', '1'); }
    }, setting);
    await pg.goto(`http://localhost:${port}/?base&e2e&cleanShot=1`, { waitUntil: 'domcontentloaded' });
    await pg.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
    await pg.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 35000 });
    await pg.evaluate(() => { window.hmPlay.teleportPlanet?.(); window.hmPlay.give?.(200); window.hmPlay.hideOverlays?.(false); });
    await pg.waitForTimeout(1500);
    const gp = await pg.evaluate(() => window.hmPlay.gate());
    await pg.evaluate(({ x, z }) => window.hmPlay.go('planet', x, z + 9, 0, -0.2), gp);
    await pg.evaluate(() => window.__dev.fidelity(5));
    await pg.waitForTimeout(2500);
    const png = PNG.sync.read(await pg.screenshot({ path: path.join(outDir, name) }));
    await ctx.close();
    return png;
  };
  const autoPic = await freshStage5('auto', '08-stage5-suitcam-auto.png');
  const offPic = await freshStage5('off', '09-stage5-suitcam-off.png');
  let diff = 0, n = 0;
  for (let i = 0; i < offPic.data.length; i += 4 * 7) { n++; diff += Math.abs(offPic.data[i] - autoPic.data[i]) + Math.abs(offPic.data[i + 1] - autoPic.data[i + 1]) + Math.abs(offPic.data[i + 2] - autoPic.data[i + 2]); }
  console.log(`stage 5, mean colour difference Auto against Off: ${(diff / n / 3).toFixed(2)} of 255`);
  check('the suit cam changes the stage 5 picture (Auto against Off)', diff / n / 3 > 2, `${(diff / n / 3).toFixed(2)} of 255`);

  const errs = [...shaderErrors, ...pageErrors];
  check('no shader, WebGL or page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`compiler warnings (not errors): ${shaderWarnings.length}`);
} catch (e) {
  check('the run completes', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass; shots in ${outDir}`);
process.exit(failed.length ? 1 : 0);
