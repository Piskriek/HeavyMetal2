/**
 * Plan 50 e2e: Overwatch the drone, in a real browser against the built game and a PRIVATE bridge (own port, temp defaults,
 * so the live bridge and the repo's kit-defaults.json are never touched).
 *  - the body is the drone kit, at its holder (not 100 m up), rotors in the lab, thrusters on the Moon;
 *  - formation puts it ahead-right of the player, in view;
 *  - an AI's kit edit over the bridge is staged: shown, not saved; "keep it" saves it; "undo" puts it back;
 *  - on the Moon the fast brain engages a placed monster and hurts it; barks reach the bridge;
 *  - orders by voice (hold fire, weapons free, cover my left) set the brain's orders; "find ..." marks a point of interest;
 *  - the eyes post JPEG frames of the view, and of a linked window, to the bridge; no page errors.
 * Boots the built game (run `npm run build` first); shots to shots-run/drone/.
 *   node scripts/test-drone-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/drone');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }
const port = 8234;
const bridgePort = 8233;
const bridge = `http://127.0.0.1:${bridgePort}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drone-e2e-'));
const defaultsFile = path.join(tmpDir, 'kit-defaults.json');
fs.writeFileSync(defaultsFile, '{}\n');
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const bridgeProc = spawn(process.execPath, ['scripts/companion-bridge.mjs', '--port', String(bridgePort), '--defaults-file', defaultsFile, '--frame-dir', path.join(tmpDir, 'frames')], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
  try { window.speechSynthesis.speak = () => {}; } catch {}
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const getJson = async (p) => (await fetch(`${bridge}${p}`)).json();
const postCommand = async (cmd) => (await fetch(`${bridge}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })).json();
const said = async (re) => (await getJson('/events?after=0')).events.filter((e) => e.type === 'companion-say').find((e) => re.test(e.text));
const until = async (fn, ms, step = 200) => {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise((r) => setTimeout(r, step)); }
};
const panelOpen = () => page.locator('[data-testid="companion-comms-panel"]').count();
const order = async (text) => {
  if ((await panelOpen()) === 0) {
    await page.keyboard.press('Enter');
    await page.locator('[data-testid="companion-comms-panel"]').waitFor({ state: 'visible', timeout: 5000 });
  }
  await page.locator('.companion-chat-input').fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
};
const closePanel = async () => { if ((await panelOpen()) > 0) await page.locator('.companion-chat-close').click(); };
const daisMaterial = (path) => page.evaluate((p) => window.__dev.kitPlaced('gate-dais').find((x) => x.path === p)?.material ?? null, path);
const body = () => page.evaluate(() => {
  const THREE = window.__playScene.THREE;
  const g = window.__companion.group;
  g.updateMatrixWorld(true);
  const drone = g.getObjectByName('companion-drone');
  const air = g.getObjectByName('drone-air');
  const vac = g.getObjectByName('drone-vacuum');
  const box = new THREE.Box3().setFromObject(drone);
  const c = box.getCenter(new THREE.Vector3());
  const cam = window.__playScene.camera;
  const ndc = c.clone().project(cam);
  const s = window.__companion.getState();
  return { air: air?.visible ?? null, vacuum: vac?.visible ?? null, size: box.getSize(new THREE.Vector3()).toArray(), lift: c.y - s.y, offHolder: Math.hypot(c.x - s.x, c.z - s.z), ndc: [ndc.x, ndc.y, ndc.z] };
});

try {
  await page.goto(`http://localhost:${port}/?e2e&bridge=${bridgePort}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, { timeout: 90000 });
  await page.evaluate(() => { [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click(); });
  await page.waitForFunction(() => Boolean(window.__companion), { timeout: 30000 });
  check('the game links to the private bridge', await until(async () => (await getJson('/status')).gameLinked, 15000));

  // --- 1. the body: the drone kit at its holder, rotors in the lab ---
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0, 2.4, 0, 0));
  await frames(90);
  let b = await body();
  // a world box around a yawed 0.95 m quad is up to sqrt(2) wider (the kit test pins the true span)
  check('the drone body is a small quad (under 1 m, at any yaw)', Math.max(b.size[0], b.size[2]) > 0.7 && Math.max(b.size[0], b.size[2]) < 1.4 && b.size[1] < 0.5, JSON.stringify(b.size.map((v) => +v.toFixed(2))));
  check('the body flies with its holder (not 100 m up)', Math.abs(b.lift) < 0.6 && b.offHolder < 0.6, `lift ${b.lift.toFixed(2)} m, off ${b.offHolder.toFixed(2)} m`);
  check('in the lab it flies on rotors', b.air === true && b.vacuum === false);
  check('formation keeps it ahead and to the right, in view', b.ndc[2] < 1 && b.ndc[0] > 0.05 && b.ndc[0] < 1 && Math.abs(b.ndc[1]) < 1, b.ndc.map((v) => v.toFixed(2)).join(', '));
  await shot('01-drone-in-the-lab');

  // --- 2. an AI's edit is staged: shown, not saved; keep saves it; undo puts it back ---
  await postCommand({ action: 'override-kit-part', kitId: 'gate-dais', partId: 'step-upper', material: 'darkSteel' });
  check('a bridge edit shows live', await until(async () => (await daisMaterial('step-upper')) === 'darkSteel', 6000));
  const unsaved = await page.evaluate(() => window.__dev.kitOverrides()['gate-dais']?.['step-upper'] ?? null);
  check('...but is not saved until the player keeps it', unsaved === null, JSON.stringify(unsaved));
  check('the drone asks for a yes', Boolean(await until(() => said(/keep it/), 4000)));
  await order('keep it');
  const kept = await page.evaluate(() => window.__dev.kitOverrides()['gate-dais']?.['step-upper']?.material ?? null);
  check('"keep it" saves the edit', kept === 'darkSteel', kept);
  await order('undo');
  check('"undo" puts it back, live and saved', (await daisMaterial('step-upper')) === 'paint'
    && (await page.evaluate(() => window.__dev.kitOverrides()['gate-dais']?.['step-upper'] ?? null)) === null);

  // --- 3. orders by voice set the fast brain's orders ---
  await order('hold fire');
  check('"hold fire" sets hold-fire', (await page.evaluate(() => window.__playScene.companionCombat().orders?.mode)) === 'hold-fire');
  await order('cover my left');
  check('"cover my left" sets the cover side', (await page.evaluate(() => window.__playScene.companionCombat().orders?.cover)) === 'left');
  await order('weapons free');
  check('"weapons free" sets weapons-free', (await page.evaluate(() => window.__playScene.companionCombat().orders?.mode)) === 'weapons-free');
  await order('find me guns');
  check('"find me guns" marks the armory sidearm in the lab', Boolean(await until(() => said(/Marked: the sidearm on the armory rack/), 4000)));
  check('...with the ping reticle', (await page.evaluate(() => window.__dev.pingMarkerAge())) !== null);
  await order('any ammo around?');
  check('a category with no source gets a plain answer', Boolean(await until(() => said(/no ammo/), 4000)));
  await closePanel();

  // --- 4. the eyes: a frame of the view reaches the bridge; a linked window gets a screen and its own frames ---
  const viewFrame = await until(async () => (await getJson('/status')).frames?.game, 9000);
  check('the eyes post the player\'s view to the bridge', Boolean(viewFrame) && fs.existsSync(path.join(root, viewFrame.file)), JSON.stringify(viewFrame));
  if (viewFrame) {
    const jpg = fs.readFileSync(path.join(root, viewFrame.file));
    check('...as a JPEG', jpg[0] === 0xff && jpg[1] === 0xd8 && jpg.length > 3000, `${jpg.length} bytes`);
  }
  check('a linked window stands a screen in the world', await page.evaluate(() => window.__dev.linkTestWindow()) && (await page.evaluate(() => window.__playScene.gameScreenShown())));
  check('...and the eyes send the linked window too', Boolean(await until(async () => (await getJson('/status')).frames?.external, 9000)));
  await frames(20);
  await shot('02-linked-window-screen');
  await page.evaluate(() => window.__dev.unlinkWindow());
  check('unlinking takes the screen down', !(await page.evaluate(() => window.__playScene.gameScreenShown())));

  // --- 4b. Plan 51: a mechanic observed in another game becomes presets; the player's word puts it on the body ---
  const observation = (() => {
    // the CLI's demo run (scripts/observe-mechanic.mjs): a 3.6 m/s² body, jumping at 4.6 m/s, walking 3.2 then running 6.0
    const dt = 1 / 60, t = [], x = [], y = [], z = [];
    let h = 0, vy = 0, px = 0;
    for (let f = 0; f < 600; f++) {
      if (h <= 0 && f % 180 === 20) vy = 4.6;
      vy -= 3.6 * dt;
      h = Math.max(0, h + vy * dt);
      if (h === 0) vy = 0;
      px += (f < 300 ? 3.2 : 6.0) * dt;
      t.push(f * dt); x.push(px); y.push(h); z.push(0);
    }
    return { game: 'Demo (synthetic)', channel: 'synthetic', trajectory: { t, x, y, z } };
  })();
  const observed = await fetch(`${bridge}/observe-mechanic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(observation) });
  check('the bridge takes an observed mechanic', observed.ok, String(observed.status));
  const mimicEvt = await until(async () => (await getJson('/events?after=0')).events.find((e) => e.type === 'mimic-result'), 9000);
  check('the harness decompiles it into loc: and harnessc: codes', mimicEvt?.codes?.loc?.startsWith('loc:v1:') && mimicEvt?.codes?.harness?.startsWith('harnessc:'), JSON.stringify(mimicEvt?.codes ?? null).slice(0, 160));
  check('...and its VSA match names the preset it was made with', mimicEvt?.nearest?.locomotion?.id === 'lunar-low-g', mimicEvt?.nearest?.locomotion?.id);
  const gBefore = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  check('an observation alone changes nothing (it is a proposal)', Math.abs(gBefore - 3.6) > 1, `g ${gBefore}`);
  await order('apply the mimic');
  const gMimic = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  check('"apply the mimic" puts the observed gravity on the body', Math.abs(gMimic - 3.6) / 3.6 < 0.05, `g ${gMimic}`);
  await order('undo');
  const gUndone = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  check('"undo" takes the mimic off', Math.abs(gUndone - gBefore) < 1e-6, `g ${gUndone}`);
  await closePanel();

  // --- 5. the Moon: thrusters, and the fast brain fights ---
  const gate = await page.evaluate(() => window.__dev.gate());
  await page.evaluate((g) => window.__playScene.debug.teleport('planet', g.x + 6, g.z + 14, 0, 0), gate);
  await frames(60);
  b = await body();
  check('on the Moon it flies on thrusters', b.vacuum === true && b.air === false);
  const mobId = await page.evaluate(() => window.__dev.placeMob('brute', 9));
  const hp0 = await page.evaluate((id) => window.__playScene.monsters.getMobList().find((m) => m.id === id)?.hp ?? null, mobId);
  const hurt = await until(async () => {
    const m = await page.evaluate((id) => window.__playScene.monsters.getMobList().find((x) => x.id === id) ?? null, mobId);
    return !m || m.hp < hp0;
  }, 12000);
  check('the drone engages a monster and hurts it', hp0 !== null && hurt, `hp ${hp0}`);
  check('it calls out the contact', Boolean(await until(() => said(/^Contact: brute/), 6000)));
  await shot('03-drone-fights-on-the-moon');

  check('no page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, e.message);
} finally {
  await browser.close().catch(() => {});
  server.kill();
  bridgeProc.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} drone checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
