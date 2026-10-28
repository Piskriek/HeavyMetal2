/**
 * Plan 49 e2e: the ping and the kit mutation loop, in a real browser against the built game and a PRIVATE Neural Bridge
 * (its own port and a temp defaults file, so a live bridge on 8220 and the repo's kit-defaults.json are never touched).
 *  - aims the camera at the gate dais's lower hazard band and pings: the scene names the kit, part and material, the
 *    violet reticle lives and is gone after 3 s, the ping event reaches the bridge, the companion calls out the target;
 *  - "remove the black and yellow chevrons on the base piece" (typed comms) repaints the four bands of that step;
 *  - an AI's bridge command `override-kit-part` repaints the upper step; `save-kit-default` writes the defaults file;
 *  - `mutate-kit-preset restore-hazard` puts the stripes back; the save keeps the player's overrides; no page errors.
 * Boots the built game (run `npm run build` first); shots to shots-run/ping/.
 *   node scripts/test-ping-kit-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/ping');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(fs.existsSync);
if (!chromePath) {
  console.error('Chrome/Chromium not found; set CHROME_PATH.');
  process.exit(1);
}
const port = 8227;
const bridgePort = 8229;
const bridge = `http://127.0.0.1:${bridgePort}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ping-kit-e2e-'));
const defaultsFile = path.join(tmpDir, 'kit-defaults.json');
fs.writeFileSync(defaultsFile, '{}\n');
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const bridgeProc = spawn(process.execPath, ['scripts/companion-bridge.mjs', '--port', String(bridgePort), '--defaults-file', defaultsFile], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
  // headless Chromium has no voices; the radio's speech is not what this test checks
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
const events = async (type) => (await getJson('/events?after=0')).events.filter((e) => !type || e.type === type);
const until = async (fn, timeoutMs, stepMs = 200) => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, stepMs));
  }
};
const materials = () => page.evaluate(() => Object.fromEntries(window.__dev.kitPlaced('gate-dais').map((p) => [p.path, p.hidden ? 'hidden' : p.material])));
const panelOpen = () => page.locator('[data-testid="companion-comms-panel"]').count();
/** Sends an order through the typed comms panel. */
const order = async (text) => {
  if ((await panelOpen()) === 0) {
    await page.keyboard.press('Enter');
    await page.locator('[data-testid="companion-comms-panel"]').waitFor({ state: 'visible', timeout: 5000 });
  }
  await page.locator('.companion-chat-input').fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600); // the companion acts after ~300 ms
};

try {
  await page.goto(`http://localhost:${port}/?story&e2e&bridge=${bridgePort}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
  await page.waitForFunction(() => Boolean(window.__companion), { timeout: 30000 });

  // --- 0. the game links to the private bridge ---
  const linked = await until(async () => (await getJson('/status')).gameLinked, 15000);
  check('the game links to the private bridge (?bridge=port)', linked);

  // --- 1. the dais is a kit now: two steps and eight hazard bands ---
  const before = await materials();
  check('the gate dais is a kit with 10 parts', Object.keys(before).length === 10, JSON.stringify(before));
  check('its eight bands wear hazard paint', Object.values(before).filter((m) => m === 'hazard').length === 8);

  // --- 2. aim at the lower step's south band (gate at x 0, z -1; band centre z = -1 + 2.39, top 0.212) and ping ---
  // the room's front wall is z 3, so stand just inside it; the pitch is solved from the camera's own position (an
  // over-the-shoulder camera moves with the pitch, so it converges over a few passes)
  const band = { x: 0, y: 0.206, z: -1 + 2.39 };
  const standZ = 2.6;
  let pitch = -0.8;
  for (let i = 0; i < 4; i++) {
    await page.evaluate(({ z, p }) => window.__playScene.debug.teleport('lab', 0, z, 0, p), { z: standZ, p: pitch });
    await frames(6);
    const cam = await page.evaluate(() => { const c = window.__playScene.camera.position; return { x: c.x, y: c.y, z: c.z }; });
    pitch = -Math.atan2(cam.y - band.y, cam.z - band.z);
  }
  await page.evaluate(({ z, p }) => window.__playScene.debug.teleport('lab', 0, z, 0, p), { z: standZ, p: pitch });
  await frames(6);
  const target = await page.evaluate(() => window.__dev.ping());
  check('the ping names the dais band under the crosshair',
    target?.kitId === 'gate-dais' && target?.partId === 'band-lower-south' && target?.entityType === 'machine',
    JSON.stringify(target));
  check('the ping carries the part, its material, a unit normal and the distance',
    target?.part === 'band-lower-long' && target?.material === 'hazard' && Math.abs(Math.hypot(target.normal.x, target.normal.y, target.normal.z) - 1) < 0.01 && target.distance > 1 && target.distance < 6,
    target ? `normal=(${target.normal.x}, ${target.normal.y}, ${target.normal.z}) d=${target.distance}` : 'none');
  await frames(4);
  const age = await page.evaluate(() => window.__dev.pingMarkerAge());
  check('the violet reticle stands on the hit', age !== null && age >= 0 && age < 3, `age=${age}`);
  await shot('01-ping-dais-band');
  const pingEvt = await until(async () => (await events('ping')).at(-1), 5000);
  check('the ping event reaches the bridge with the kit and part',
    pingEvt?.target?.kitId === 'gate-dais' && pingEvt?.target?.partId === 'band-lower-south' && pingEvt?.where === 'lab',
    pingEvt ? pingEvt.label : 'no ping event');
  const callout = await until(async () => (await events('companion-say')).find((e) => /^Target locked: Gate dais/.test(e.text)), 5000);
  check('the companion calls out the target', Boolean(callout), callout?.text ?? 'no callout');
  await page.waitForTimeout(3300);
  check('the reticle is gone after its 3 s life', (await page.evaluate(() => window.__dev.pingMarkerAge())) === null);

  // --- 3. a ping on the wall and the floor names the room ---
  // the south wall (z 3) high above the lockers: yaw PI faces +z, pitch up
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 2.5, 0, Math.PI, 0.4));
  await frames(6);
  const wall = await page.evaluate(() => window.__dev.ping());
  check('a ping high on the south wall reads as that wall', wall?.entityType === 'wall' && wall?.entityId === 'lab-wall-south', JSON.stringify(wall && { type: wall.entityType, id: wall.entityId }));
  // the walkway between the front wall and the dais
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0, 2.6, 0, -1.25));
  await frames(6);
  const floor = await page.evaluate(() => window.__dev.ping());
  check('a ping on the walkway reads as the lab floor', floor?.entityType === 'terrain' && floor?.entityId === 'lab-floor', JSON.stringify(floor && { type: floor.entityType, id: floor.entityId }));
  const prop = await (async () => {
    await page.evaluate(() => window.__playScene.debug.teleport('lab', 4, 2.7, 0, -1.2));
    await frames(6);
    return page.evaluate(() => window.__dev.ping());
  })();
  check('a ping on lab clutter names the prop', prop?.entityType === 'prop' && typeof prop?.entityId === 'string' && prop.entityId.length > 0, JSON.stringify(prop && { type: prop.entityType, id: prop.entityId }));

  // --- 4. back on the band, the voice order strips the step's chevrons ---
  await page.evaluate(({ z, p }) => window.__playScene.debug.teleport('lab', 0, z, 0, p), { z: standZ, p: pitch });
  await frames(6);
  await page.evaluate(() => window.__dev.ping());
  await order('remove the black and yellow chevrons on the base piece');
  const stripped = await until(async () => {
    const m = await materials();
    return ['band-lower-north', 'band-lower-south', 'band-lower-east', 'band-lower-west'].every((p) => m[p] === 'hidden') ? m : null;
  }, 5000);
  check('the voice order takes the four bands of that step out of the build (RULES 8a)', Boolean(stripped), JSON.stringify(stripped ?? (await materials())));
  const m1 = await materials();
  check('the other step keeps its chevrons', ['band-upper-north', 'band-upper-south', 'band-upper-east', 'band-upper-west'].every((p) => m1[p] === 'hazard'));
  // the panel's own close button (Esc would also pause the game), then a wider look at the dais
  await page.locator('.companion-chat-close').click();
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 2.2, 2.6, 0.6, -0.5));
  await frames(20);
  await shot('02-chevrons-stripped');

  // --- 5. an AI on the bridge overrides a part, then saves the kit as the shipped default ---
  await postCommand({ action: 'override-kit-part', kitId: 'gate-dais', partId: 'step-upper', material: 'darkSteel' });
  const overridden = await until(async () => (await materials())['step-upper'] === 'darkSteel', 6000);
  check('a bridge override-kit-part lands on the live kit', overridden);
  const kitResult = await until(async () => (await events('kit-result')).at(-1), 4000);
  check('the game reports the kit result back to the bridge', /now wears? dark steel/.test(kitResult?.result ?? ''), kitResult?.result);
  // plan 50: an AI's edit over the bridge is staged; the player keeps it before it can become a default
  await order('keep it');
  // plan 50 review: the bridge can only suggest a shipped default; the player's own words save it
  await postCommand({ action: 'save-kit-default', kitId: 'gate-dais' });
  const suggested = await until(async () => (await events('companion-say')).find((e) => /suggests saving this kit as the shipped default/.test(e.text)), 4000);
  check('a bridge save-kit-default only suggests it', Boolean(suggested) && fs.readFileSync(defaultsFile, 'utf8').trim() === '{}');
  await order('save as default');
  await page.locator('.companion-chat-close').click();
  const written = await until(async () => {
    const d = JSON.parse(fs.readFileSync(defaultsFile, 'utf8'));
    return d['gate-dais']?.['step-upper']?.material === 'darkSteel' && d['gate-dais']?.['band-lower-north']?.hidden === true ? d : null;
  }, 6000);
  check('save-kit-default writes the kit into the defaults file', Boolean(written), JSON.stringify(written ?? fs.readFileSync(defaultsFile, 'utf8')));
  const saidSaved = await until(async () => (await events('companion-say')).find((e) => /Saved as the default for the Gate dais/.test(e.text)), 4000);
  check('the companion confirms the default', Boolean(saidSaved));

  // --- 6. restore through the bridge; the player's save keeps the edits ---
  await postCommand({ action: 'mutate-kit-preset', kitId: 'gate-dais', mutation: 'restore-hazard' });
  const restored = await until(async () => Object.values(await materials()).filter((m) => m === 'hazard').length === 8, 6000);
  check('mutate-kit-preset restore-hazard puts the stripes back', restored);
  // plan 50: an AI's edit is staged until the player keeps it
  await order('keep it');
  await page.locator('.companion-chat-close').click();
  const saved = await page.evaluate(() => window.__dev.kitOverrides()['gate-dais'] ?? null);
  check('the player save holds the dais overrides', saved?.['step-upper']?.material === 'darkSteel' && saved?.['band-lower-north']?.material === 'hazard', JSON.stringify(saved));

  // --- 7. "what is this" answers from the last ping ---
  await order('what is this');
  const what = await until(async () => (await events('companion-say')).find((e) => /^That is the gate dais/.test(e.text)), 4000);
  check('"what is this" names the pinged part', Boolean(what), what?.text);
  const sayEvt = (await events('player-say')).find((e) => e.text === 'what is this');
  check('player speech carries its intent for agents on the bridge', sayEvt?.intent === 'ping-what', sayEvt?.intent);
  await page.keyboard.press('Escape');

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
console.log(`\n${results.length - failed.length}/${results.length} ping & kit checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
