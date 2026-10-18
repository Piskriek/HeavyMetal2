/**
 * TPOL rift shots (POL-98, POL-100): the S-Space rift at an open leak, at stages 0a, 0b, 3 and 6, open and sealing.
 * Serves apps/web/dist on port 8217 and boots ?mash&e2e with a fixed seed (the same plot in every run).
 * - first person: the avatar (the player's own body) is hidden, so it cannot stand in front of the leak (V toggles the view)
 * - the camera is turned to the open leak by its own matrix, and must face it (dot >= 0.9) before a shot is taken
 * - 10 m from the leak; the overlays are hidden; the monsters are off
 * Writes shots-run/pol95-103/rift-s<stage>-<open|sealing>.png and prints one JSON line per shot.
 * Exits 1 when a shot cannot be framed (the avatar stays, the camera does not face the leak, or no open leak).
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = fileURLToPath(new URL('../shots-run/pol95-103/', import.meta.url));
fs.mkdirSync(outDir, { recursive: true });
const port = 8217;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed'));
  };
  // a fixed seed, so the leaks and the plot are the same in every run
  let seed = 1234567;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const dev = (fn, ...args) => page.evaluate(([name, a]) => window.__dev[name](...a), [fn, args]);
const teleport = (where, x, z, yaw = 0, pitch = 0) => page.evaluate(([w, a, b, c, d]) => window.hmPlay.teleport(w, a, b, c, d), [where, x, z, yaw, pitch]);
const frames = (n) => page.evaluate((k) => new Promise((res) => { let c = 0; const f = () => { if (++c >= k) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
const avatarVisible = () => page.evaluate(() => window.__playScene.debug.avatar().visible);

// the render camera's horizontal view toward a point (1 = straight at it), read from its own matrix
const camFacing = (lk) => page.evaluate(({ lx, lz }) => {
  const sc = window.__playScene.debug.planetScene();
  let cam = null;
  sc.traverse((o) => { if (o.isPerspectiveCamera && o.parent === sc) cam = o; });
  const e = cam.matrixWorld.elements;
  const f = [-e[8], -e[10]];
  const d = [lx - e[12], lz - e[14]];
  const fl = Math.hypot(f[0], f[1]) || 1, dl = Math.hypot(d[0], d[1]) || 1;
  return (f[0] * d[0] + f[1] * d[1]) / (fl * dl);
}, { lx: lk.x, lz: lk.z });

// stands `dist` metres south of the leak, looking north at it; the yaw is atan2(-dx, -dz) (the camera looks along -z at yaw 0)
const DIST = 8;
const faceLeak = async (lk) => {
  const px = lk.x, pz = lk.z - DIST;
  const yaw = Math.atan2(-(lk.x - px), -(lk.z - pz));
  let cam = NaN;
  for (let attempt = 0; attempt < 3 && !(cam >= 0.9); attempt++) {
    await teleport('planet', px, pz, yaw, 0);
    await frames(40);
    cam = await camFacing(lk);
  }
  if (!(cam >= 0.9)) throw new Error(`the camera does not face leak ${lk.id} (dot ${cam})`);
  return cam;
};

const boot = async () => {
  await page.goto(`http://localhost:${port}/?mash&e2e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev && !!window.hmPlay && !!window.__playScene, null, { timeout: 35000 });
  await frames(30);
  await page.evaluate(() => { window.__hm?.hideOverlays?.(true); window.hmPlay.setLocked(true); });
  // first person: the avatar's holder is shown only in the third-person view, so V until it is hidden
  for (let i = 0; i < 3 && (await avatarVisible()); i++) {
    await page.keyboard.press('KeyV');
    await frames(30);
  }
  if (await avatarVisible()) throw new Error('the avatar stays visible after V (third-person view)');
  await dev('setMonstersSetting', 'off');
  await frames(10);
};

// 0a: a fresh scan wave (wireframe); 0b: the wave has run (stage 1 marks it done, then stage 0 again)
const STAGES = [
  { label: '0a', seq: [0] },
  { label: '0b', seq: [1, 0] },
  { label: '3', seq: [3] },
  { label: '6', seq: [6] },
];

let exitCode = 0;
try {
  for (const st of STAGES) {
    await boot();
    const leaks = await dev('leaks');
    const open = leaks.find((l) => !l.dormant && l.state === 'open');
    if (!open) throw new Error(`no open leak (stage ${st.label}); leaks ${leaks.length}`);
    await page.evaluate((seq) => { for (const v of seq) window.__playScene.setFidelityStage(v); }, st.seq);
    const facing = await faceLeak(open);
    await frames(30);
    await page.evaluate(() => {
      let cam = null;
      window.__playScene.debug.planetScene().traverse((o) => { if (o.isPerspectiveCamera && o.parent === window.__playScene.debug.planetScene()) cam = o; });
      cam.children.forEach((c) => { c.visible = false; });
    });
    await frames(10);
    // the frame's draw calls (renderer.info, the DRAWS readout), the median of five frames
    const drawSamples = [];
    for (let i = 0; i < 5; i++) { await frames(2); drawSamples.push(await page.evaluate(() => window.__playScene.debug.stats().calls)); }
    const draws = drawSamples.slice().sort((a, b) => a - b)[2];
    await page.screenshot({ path: `${outDir}rift-s${st.label}-open.png` });
    console.log(`SHOT ${JSON.stringify({ stage: st.label, state: 'open', leak: open.id, dist: DIST, camFacing: Math.round(facing * 100) / 100, avatar: await avatarVisible(), drawsNearOpenLeak8m: draws, drawSamples })}`);
    // the play screen sets the seal every frame from the aim (play.tsx): pin it for the shot, then release it
    await page.evaluate((id) => { const m = window.__playScene.monsters; window.__sealOrig = m.setSealing.bind(m); window.__sealPin = id; m.setSealing = (l) => window.__sealOrig(window.__sealPin ?? l); }, open.id);
    await frames(40);
    await page.screenshot({ path: `${outDir}rift-s${st.label}-sealing.png` });
    await page.evaluate(() => { const m = window.__playScene.monsters; window.__sealPin = null; if (window.__sealOrig) m.setSealing = window.__sealOrig; window.__sealOrig = null; m.setSealing(null); });
    const sealRead = await page.evaluate((l) => { let u = null; window.__playScene.debug.planetScene().traverse((o) => { if (o.name === 'rift-unified-mesh' && Math.abs(o.matrixWorld.elements[12] - l.x) < 0.5 && Math.abs(o.matrixWorld.elements[14] - l.z) < 0.5) u = o.material.uniforms.uState.value; }); return u; }, { x: open.x, z: open.z });
    const sealLeak = (await dev('leaks')).find((l) => l.id === open.id);
    console.log(`SHOT ${JSON.stringify({ stage: st.label, state: 'sealing', leak: open.id, dist: DIST, uState: sealRead, leakState: sealLeak?.state ?? null })}`);
  }
  if (pageErrors.length) {
    console.log(`PAGE ERRORS ${pageErrors.length}: ${pageErrors.slice(0, 3).join(' | ')}`);
    exitCode = 1;
  }
  console.log(`wrote ${outDir}`);
} catch (err) {
  console.log(`FAILED: ${err.message}`);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill('SIGTERM');
  process.exit(exitCode);
}
