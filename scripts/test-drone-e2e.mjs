/**
 * Plan 50 e2e: Overwatch the drone, in a real browser against the built game and a PRIVATE bridge (own port, temp defaults,
 * so the live bridge and the repo's kit-defaults.json are never touched).
 *  - the body is the drone kit, at its holder (not 100 m up), rotors in the lab, thrusters on the Moon;
 *  - formation puts it ahead-right of the player, in view;
 *  - an AI's kit edit over the bridge is staged: shown, not saved; "keep it" saves it; "undo" puts it back;
 *  - on the Moon the fast brain engages a placed monster and hurts it; barks reach the bridge;
 *  - orders by voice (hold fire, weapons free, cover my left) set the brain's orders; "find ..." marks a point of interest;
 *  - the eyes post JPEG frames of the view, and of a linked window, to the bridge;
 *  - plan 51: an observed mechanic waits for "apply the mimic"; "bridge <game>" finds the game on a fake process list,
 *    bridges its mechanics even under a refused verdict, mimics its telemetry live, and "stop the bridge" puts all back;
 *  - no page errors.
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
// a made-up PC for "bridge <game>": the OS, a browser, an indie game and a tool (never the real process list)
const bridgeProc = spawn(process.execPath, ['scripts/companion-bridge.mjs', '--port', String(bridgePort), '--defaults-file', defaultsFile, '--frame-dir', path.join(tmpDir, 'frames'), '--fake-processes', 'svchost.exe,chrome.exe,SomeIndie.exe,OtherTool.exe', '--no-sampler'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
// the bridge's log, printed if the run fails (a crashed bridge otherwise shows only as 'fetch failed')
let bridgeLog = '';
for (const s of [bridgeProc.stdout, bridgeProc.stderr]) s.on('data', (d) => { bridgeLog = (bridgeLog + d).slice(-6000); });
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

  // --- 4c. Plan 51 wave 2: "bridge <game>" finds it on the PC, bridges its mechanics out of the box and mimics them LIVE ---
  await order('bridge this game');
  check('with no name and no known engine, the drone asks which game', Boolean(await until(() => said(/running\. Which one\?/), 4000)));
  await order('bridge some indie');
  check('"bridge some indie" finds SomeIndie.exe and bridges it unchecked: mechanics by its telemetry or the screen',
    Boolean(await until(() => said(/^SomeIndie: unchecked\. Nobody checked its terms yet\. Mechanics cross by telemetry > screen/), 5000)));
  const request = await until(async () => (await getJson('/events?after=0')).events.find((e) => e.type === 'bridge-request'), 4000);
  check('...and asks the AI on the bridge to check its terms', request?.gameId === 'someindie' && request?.process === 'SomeIndie.exe', JSON.stringify(request ?? null));
  // a GSI-style feed: position "x, z, y" in centimetres, a shots counter, a phase field; g = 8 m/s², 5 rounds/s
  const telemetryFeed = (n) => {
    const dt = 1 / 30, out = [];
    let h = 0, vy = 0, px = 0, fired = 0;
    for (let f = 0; f < n; f++) {
      if (h <= 0 && f % 75 === 10) vy = 5;
      vy -= 8 * dt;
      h = Math.max(0, h + vy * dt);
      if (h === 0) vy = 0;
      px += (f < 150 ? 3 : 6) * dt;
      if (f % 6 === 0) fired += 1;
      out.push({ provider: { timestamp: f * dt }, player: { position: `${(px * 100).toFixed(2)}, 0, ${(h * 100).toFixed(3)}`, shots: fired }, boss: { state: f < 200 ? 'Calm' : 'Enraged' } });
    }
    return out;
  };
  const postTelemetry = async (payloads) => { for (const p of payloads) await fetch(`${bridge}/telemetry/someindie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); };
  await postTelemetry(telemetryFeed(1));
  check('telemetry with no mapping yet is held back with a plain reason', Boolean(await until(() => said(/nobody has told me which of its fields/), 5000)));
  // the test plays the checking AI, and its verdict is the harshest: the terms refuse. Mechanics must still cross.
  await postCommand({
    action: 'bridge-profile',
    profile: {
      schema: 'hm2:bridge-profile:v1', gameId: 'someindie', title: 'SomeIndie', verdict: 'refused',
      channels: ['mod-loader'], streams: ['mechanics', 'entity-kinds'], soloOnly: false,
      sources: [{ url: 'https://example.com/someindie-eula', quote: 'No third-party tool may modify or inject into the game.' }],
      checkedBy: 'e2e (playing the checking AI)', setup: ['Turn on its telemetry output.'], notes: [],
      telemetry: {
        t: { path: 'provider.timestamp' },
        x: { path: 'player.position', split: ',', index: 0, scale: 0.01 },
        y: { path: 'player.position', split: ',', index: 2, scale: 0.01 },
        z: { path: 'player.position', split: ',', index: 1, scale: 0.01 },
        shotCounter: { path: 'player.shots' },
        events: ['boss.state'],
      },
    },
  });
  check('a refused verdict still bridges its mechanics (no mods, loaders or file reads)', Boolean(await until(() => said(/mechanics still cross by telemetry > screen > input-audio, solo/), 5000)));
  const tuningBefore = await page.evaluate(() => window.__playScene.companionTuning().roundGapS);
  const gPre = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  await postTelemetry(telemetryFeed(330));
  const live = await until(async () => (await getJson('/events?after=0')).events.find((e) => e.type === 'mimic-result' && e.live === true), 12000);
  check('a full telemetry batch becomes a live mimic, with no "apply the mimic"', Boolean(live), JSON.stringify(live?.codes ?? null).slice(0, 120));
  check('...the game\'s names crossed only as labels (the refused profile never allowed them)', live?.dropped?.some((d) => /anonymous labels/.test(d)), JSON.stringify(live?.dropped ?? null));
  const gLive = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  check('the observed gravity is on the body at once', Math.abs(gLive - 8) / 8 < 0.05, `g ${gLive} (was ${gPre})`);
  const gapLive = await page.evaluate(() => window.__playScene.companionTuning().roundGapS);
  check('...and the observed fire rate is on the drone\'s guns', Math.abs(gapLive - 0.2) < 0.02, `round gap ${gapLive} s (was ${tuningBefore})`);
  await order('stop the bridge');
  check('"stop the bridge" says so', Boolean(await until(() => said(/^Unbridged from SomeIndie/), 4000)));
  const gAfter = await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  const gapAfter = await page.evaluate(() => window.__playScene.companionTuning().roundGapS);
  check('...and puts movement and fire back as they were before the bridge', Math.abs(gAfter - gPre) < 1e-6 && Math.abs(gapAfter - tuningBefore) < 1e-9, `g ${gAfter}, gap ${gapAfter}`);
  await postTelemetry(telemetryFeed(330));
  await page.waitForTimeout(2500);
  check('after the bridge closes, its telemetry changes nothing', Math.abs((await page.evaluate(() => window.__dev.activeLocomotion().gravityMps2)) - gPre) < 1e-6);
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
  const contact = Boolean(await until(() => said(/^Contact: brute/), 6000));
  check('it calls out the contact', contact, contact ? '' : JSON.stringify((await getJson('/events?after=0')).events.filter((e) => e.type === 'companion-say').slice(-6).map((e) => e.text.slice(0, 80))));
  await shot('03-drone-fights-on-the-moon');

  // --- 6. Plan 56 W6a: the fight became the drone's memory; leaving the Moon is its dream, told on waking ---
  // the kill comes after the contact callout: wait for the brute to go down
  const fireCats = await until(async () => {
    const cats = await page.evaluate(() => window.__dev.droneMemory().presets.fire.ep.map((e) => e.cat));
    return cats.includes('CONTACT') && cats.includes('TARGET_DOWN') ? cats : null;
  }, 15000);
  check('the fight became the drone\'s experience: the contact and the kill are in its fire preset', Boolean(fireCats), JSON.stringify(fireCats ?? await page.evaluate(() => window.__dev.droneMemory().presets.fire.ep.map((e) => e.cat))));
  // Plan 56 W6b: the Higher Self seat. Hits on the player charge the flight preset; the seat reads that and cues it
  const typed = async (type) => (await getJson('/events?after=0')).events.filter((e) => e.type === type);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__dev.droneNote({ kind: 'hurt', damage: 25 }); });
  const askedBefore = (await typed('ego-perspective')).length;
  await postCommand({ action: 'higher-self-ask' });
  const persp = await until(async () => (await typed('ego-perspective')).slice(askedBefore)[0], 6000);
  const cue = persp?.cueable?.find((c) => c.of === 'loc:f17e');
  check('the Higher Self seat reads the drone\'s perspective: its digest and the episodes worth a cue', Boolean(persp?.lines?.length) && Boolean(cue), JSON.stringify(persp ?? null).slice(0, 200));
  const takenBefore = (await typed('higher-self-cue-taken')).length;
  if (cue) await postCommand({ action: 'higher-self-cue', cues: [{ of: cue.of, t: cue.t }] });
  check('...its cue is held for the next dream', (await until(async () => (await typed('higher-self-cue-taken')).slice(takenBefore)[0], 5000))?.count === 1);
  // Plan 56 W6c: the hits show in the drone's body until it rebalances
  const swayBefore = await page.evaluate(() => { let m = 0; for (let s = 0; s < 60; s++) { const v = window.__playScene.companionSymptomsAt(s).sway; m = Math.max(m, Math.abs(v.x), Math.abs(v.z)); } return m; });
  const ampBefore = await page.evaluate(() => window.__dev.droneSymptoms().flight);
  check('the hits show in the drone\'s body: its flight sways off station while it fights', swayBefore > 0.05 && ampBefore > 0, JSON.stringify({ swayBefore, ampBefore }));
  const dreamsBefore = (await typed('ego-dream')).length;
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0, 2.4, 0, 0));
  await frames(10);
  const dreamt = await until(async () => (await typed('ego-dream')).slice(dreamsBefore)[0], 6000);
  check('back in the lab the drone dreams: the bridge gets the digest, and it tells the dream on the radio', Boolean(dreamt) && Array.isArray(dreamt.digest?.replayed) && dreamt.digest.replayed.length > 0
    && Boolean(await until(() => said(/^I dreamed the (contact|target down|area clear|hits on you|reflex) again/), 4000)), JSON.stringify(dreamt ?? null).slice(0, 200));
  const ampAfter = await page.evaluate(() => window.__dev.droneSymptoms().flight);
  check('...and the dream steadied it: the sway is weaker', ampAfter < ampBefore, JSON.stringify({ ampBefore, ampAfter }));
  check('...and the Higher Self\'s cue steered it: the cued hits were replayed', dreamt?.cuedBy === 'higher-self' && Boolean(cue) && dreamt.digest.replayed.some((r) => r.cued && r.of === cue.of && r.t === cue.t),
    JSON.stringify(dreamt?.digest?.replayed?.slice(0, 3) ?? null));
  await postCommand({ action: 'higher-self-say', words: 'Rest in Presence. The ally beside you is the anchor you were looking for.' });
  check('the drone voices its Higher Self\'s reading, marked as such', Boolean(await until(() => said(/^From my Higher Self: Rest in Presence\. The ally beside you/), 5000)));
  // the game's storage keys are per profile (hm.p.<id>.<key>)
  const saved = await page.evaluate(() => { try { const k = Object.keys(localStorage).find((x) => x.endsWith('hm.drone.memory.v1')); return k ? JSON.parse(localStorage.getItem(k) ?? 'null')?.v ?? null : null; } catch { return 'unreadable'; } });
  check('...and its memory is saved as share codes', saved === 1, String(saved));

  // --- 7. Plan 56 §20: the drone's body. The hits came in (intake), so the flight part's root, its thruster pods, strains left ---
  const pods = await page.evaluate(() => window.__dev.droneBody()?.flight?.zones?.[0] ?? null);
  check('the drone\'s body: the hits left its flight part blocked at the root (thruster pods), on the left: what came in', pods?.mode === 'blocked' && pods?.side === 'left', JSON.stringify(pods));
  // a second trip out and back: the first dream's release shows at this checkpoint, and the part warns up
  const warnsBefore = (await typed('body-warning')).length;
  const gate2 = await page.evaluate(() => window.__dev.gate());
  await page.evaluate((g) => window.__playScene.debug.teleport('planet', g.x + 6, g.z + 14, 0, 0), gate2);
  await frames(30);
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0, 2.4, 0, 0));
  await frames(10);
  const warned = await until(async () => (await typed('body-warning')).slice(warnsBefore)[0], 6000);
  // held in the thruster pods (the root), it shows where the quality it suppresses lives: Presence, at the radio (the throat)
  const podWarn = warned?.warnings?.find((w) => w.source === 'thruster pods' && w.place === 'radio' && w.side === 'left');
  check('...and at the next checkpoint the part warns up: held in its pods, it shows at its radio, on the left, said aloud and sent to the bridge',
    Boolean(podWarn) && Boolean(await until(() => said(/(sharp pain in my radio, on the left|dull ache in my radio, on the left|my radio, on the left: inflamed)/i), 4000)), JSON.stringify(warned ?? null).slice(0, 260));
  check('...with a visible change to show for it, in that zone\'s colour', podWarn?.visual?.hue === '#3c78d2' && ['flash', 'glow', 'stiff', 'flicker', 'tinge', 'crack', 'limp'].includes(podWarn?.visual?.look), JSON.stringify(podWarn?.visual ?? null));
  // drawn on the drone itself (Argon's spec): where it shows (its voice, the left nav lamps) and, by its stage, where it is held
  await frames(20);
  const vis = await page.evaluate(() => {
    const v = window.__companion.bodyVisuals();
    const g = window.__companion.group;
    return { ...v, inScene: v.parts.filter((p) => g.getObjectByName(`body-visual:${p.path}`)).length };
  });
  const lampsLeft = vis.parts.filter((p) => /^(lamp|mast)-.*left$/.test(p.path));
  const lampsStarved = lampsLeft.filter((p) => p.look === 'starve').length;
  check('...drawn on the drone: its left radio mast and nav lamps (its voice) show it, nothing on the right does, and every overlay is in the scene',
    lampsLeft.length > 0 && lampsLeft.every((p) => ['static', 'starve', 'flash', 'tinge'].includes(p.look)) && !vis.parts.some((p) => /^(lamp|mast)-.*right$/.test(p.path)) && lampsLeft.some((p) => p.path === 'mast-left')
      && vis.inScene === vis.parts.length && vis.parts.every((p) => p.opacity >= 0 && p.opacity <= 1)
      // the ache or pain starves their glow (Argon's spec): the voice goes dim on the left
      && (podWarn?.signal === 'itch' || lampsStarved > 0),
    vis.parts.map((p) => `${p.path}:${p.look}`).join(' ').slice(0, 260));
  const rootParts = vis.parts.filter((p) => /^(skid|strut|thruster-|nozzle-|motor-|shroud-)/.test(p.path));
  check('...and where it is held (its pods and feet) shows its stage, on the left only',
    // a part's side is its corner's (shroud-front-left-right is the front-left shroud's right panel), else its suffix
    !podWarn?.sickness || (rootParts.length > 0 && rootParts.every((p) => ['stiff', 'pulse', 'crack', 'flicker', 'limp'].includes(p.look)
      && (/(front|back)-(left|right)/.exec(p.path)?.[2] ?? (/-right$/.test(p.path) ? 'right' : 'left')) === 'left')),
    `${podWarn?.sickness ?? 'no sickness'}: ${rootParts.map((p) => `${p.path}:${p.look}`).join(' ').slice(0, 200)}`);
  // a close look for the record: the camera beside the drone, on its left
  await page.evaluate(() => {
    const THREE = window.__playScene.THREE;
    const g = window.__companion.group;
    g.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(g.getObjectByName('companion-drone')).getCenter(new THREE.Vector3());
    const lamp = g.getObjectsByProperty('type', 'Mesh').find((m) => /^body-visual:mast-left$/.test(m.name) && m.parent?.visible);
    const out = lamp ? new THREE.Vector3().setFromMatrixPosition(lamp.matrixWorld).sub(c).setY(0).normalize() : new THREE.Vector3(1, 0, 0);
    window.__playScene.debug.setAltCam({ x: c.x + out.x * 0.9, y: c.y + 0.4, z: c.z + out.z * 0.9 }, 0, 0, { x: c.x, y: c.y, z: c.z });
    // the HUD off for the shot: every element that does not hold the canvas
    const canvas = document.querySelector('canvas');
    for (const el of document.body.querySelectorAll('*')) if (canvas && !el.contains(canvas)) el.setAttribute('data-e2e-hid', el.style.visibility), el.style.visibility = 'hidden';
  });
  // the static crackles: shoot while a lamp is lit
  for (let i = 0; i < 60; i++) {
    await frames(2);
    if (await page.evaluate(() => window.__companion.bodyVisuals().parts.some((p) => /^(lamp|mast)-/.test(p.path) && p.look !== 'starve' && p.opacity > 0.5))) break;
  }
  await shot('04-drone-body-warning');
  await page.evaluate(() => {
    window.__playScene.debug.clearAltCam();
    for (const el of document.body.querySelectorAll('[data-e2e-hid]')) el.style.visibility = el.getAttribute('data-e2e-hid') ?? '', el.removeAttribute('data-e2e-hid');
  });

  check('no page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, `${e.message}${pageErrors.length ? ` | page errors: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
  await browser.close().catch(() => {});
  server.kill();
  bridgeProc.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
if (failed.length) console.log(`\n--- the bridge's log (tail) ---\n${bridgeLog.slice(-3000)}`);
console.log(`\n${results.length - failed.length}/${results.length} drone checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
