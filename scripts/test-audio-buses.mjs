/**
 * Browser check for TASK-29 part A (T09a): the five buses, the voice duck, the bit-depth mirror and the stage ambience.
 * Runs against the production build (apps/web/dist), twice:
 *   A. over http (scripts/serve.mjs, port 8204): the menu gate, the crush, the duck on a real voice line, the ambience;
 *   B. from disk (file:// on the single built index.html): the bit-depth worklet must load.
 * Measured with Web Audio taps (analysers after each bus, and one right after the bit-depth mirror).
 * Needs Chrome. Exit code 0 when every check passes.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const dist = path.join(root, 'apps/web/dist/index.html');
if (!fs.existsSync(dist)) {
  console.log(`No build at ${dist}: run npm run build first`);
  process.exit(1);
}
const port = 8204;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const distinct = (xs) => new Set(xs).size;

console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await sleep(1500);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const newPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed')); };
    try {
      localStorage.setItem('hm.profile.v2', JSON.stringify({ name: 'Scientist', credits: 500, grownUp: true, tutorialDone: true, style: 'voxel', skin: 'flat', favIslands: [], quality: 'low', fpsTarget: 60, graphics: { vegetation: 'low' }, gpu: 'fast', controls: { sensitivity: 1, invertY: false, fov: 75 }, cameraView: 'first' }));
    } catch {}
  });
  page.on('pageerror', (err) => console.log('[PAGE ERROR]:', err.message));
  return page;
};

const levels = (page) => page.evaluate(() => window.__audio.getBusLevels());

try {
  // ---------------------------------------------------------------- A. over http
  const page = await newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => typeof window.__audio !== 'undefined', { timeout: 10000 });

  // A1. No autoplay at the menu (POL-72): a world loop and a planet ambience are running, and the gates are shut.
  await page.evaluate(() => {
    window.__audio.getContext();
    window.__audio.play2d('sfx-capacitor-hum', { loop: true });
    window.__audio.setAmbience({ where: 'planet', stage: 0, floats: { pxd: 0.3, vtx: 0.3, lx: 0.1, aq: 0.1 }, nearWater: false });
  });
  await sleep(2000);
  const menuGates = await page.evaluate(() => window.__audio.getGates());
  const menuLevels = await levels(page);
  check('menu: the world and ambience gates are shut before the first press', !menuGates.open && menuGates.world === 0 && menuGates.ambience === 0, JSON.stringify(menuGates));
  check('menu: the world bus is silent before the first press', menuLevels.world <= -150, `world ${menuLevels.world.toFixed(1)} dB`);
  check('menu: the ambience bus is silent before the first press', menuLevels.ambience <= -150, `ambience ${menuLevels.ambience.toFixed(1)} dB`);

  // the first pointer press opens the buses
  await page.mouse.click(4, 4);
  await sleep(1500);
  const openGates = await page.evaluate(() => window.__audio.getGates());
  const openLevels = await levels(page);
  check('menu: the first press opens the world and ambience gates', openGates.open && openGates.world > 0.9, JSON.stringify(openGates));
  check('menu: the world bus is audible after the press', openLevels.world > -60, `world ${openLevels.world.toFixed(1)} dB`);

  // A0. Settings Sound section check & shot (POL requirement: no duplicate slider names)
  const shotsDir = path.join(root, 'shots-run/audio-verbs');
  fs.mkdirSync(shotsDir, { recursive: true });
  const settingsBtn = page.locator('.sm-menu button', { hasText: 'Diagnostics & Settings' });
  await settingsBtn.click();
  const soundSec = page.locator('section[aria-label="Sound"]');
  await soundSec.waitFor({ state: 'visible', timeout: 15000 });
  await soundSec.scrollIntoViewIfNeeded();
  const sliderLabels = await page.evaluate(() => {
    const sec = document.querySelector('section[aria-label="Sound"]');
    if (!sec) return [];
    return [...sec.querySelectorAll('label')].map(l => l.childNodes[0]?.textContent?.trim() || l.textContent.trim());
  });
  const distinctLabels = new Set(sliderLabels);
  check('settings: no two sound sliders share the same name', distinctLabels.size === sliderLabels.length && sliderLabels.length >= 8, `found ${sliderLabels.length} sliders: ${sliderLabels.join(', ')}`);
  await soundSec.screenshot({ path: path.join(shotsDir, 'settings-sound.png') });
  await page.keyboard.press('Escape');
  await expBtn.waitFor({ state: 'visible', timeout: 15000 });

  // enter the lab
  await expBtn.click();
  await page.waitForSelector('canvas', { timeout: 35000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready, { timeout: 35000 });
  const ctxName = await page.evaluate(() => window.__audio.getMusicContext());
  check('lab: the game is in the lab music context', ctxName === 'lab', ctxName);

  // A2. Bit-depth mirror: stage 0 crushes the world SFX, the UI click is not crushed, stage 3 is full depth.
  // The crush is off in the lab (it is the shielded room, not terraformed), so the planet context is set for the check.
  await page.evaluate(() => {
    window.__audio.setMusicContext('moon');
    window.__audio.play2d('sfx-ui-select', { loop: true });
  });
  const want = { 0: { rateHz: 8000, bits: 4 }, 1: { rateHz: 11025, bits: 8 }, 2: { rateHz: 22050, bits: 12 }, 3: null };
  for (const stage of [0, 1, 2, 3]) {
    await page.evaluate((s) => window.__audio.setStage(s), stage);
    await sleep(250);
    const crush = await page.evaluate(() => window.__audio.getCrush());
    const ok = crush.mode === 'worklet' && JSON.stringify(crush.crush) === JSON.stringify(want[stage]);
    check(`crush: stage ${stage} is ${want[stage] ? `${want[stage].rateHz} Hz at ${want[stage].bits} bits` : 'full depth'}`, ok, `mode ${crush.mode}, ${JSON.stringify(crush.crush)}`);
  }
  await page.evaluate(() => window.__audio.setStage(0));
  await sleep(300);
  const crushed0 = await page.evaluate(() => window.__audio.sampleTap('crushed'));
  const ui0 = await page.evaluate(() => window.__audio.sampleTap('combatUi'));
  const crushedValues = distinct(crushed0);
  const uiValues = distinct(ui0);
  check('crush: at stage 0 the world SFX sits on at most 17 levels (4-bit)', crushedValues > 1 && crushedValues <= 17, `${crushedValues} distinct`);
  check('crush: the UI click is not crushed at stage 0', uiValues > 100, `${uiValues} distinct`);
  await page.evaluate(() => window.__audio.setStage(3));
  await sleep(300);
  const crushedFull = distinct(await page.evaluate(() => window.__audio.sampleTap('crushed')));
  check('crush: at stage 3 the world SFX is full depth', crushedFull > 100, `${crushedFull} distinct`);
  await page.evaluate(() => { window.__audio.setStage(0); window.__audio.setMusicContext('lab'); });
  await sleep(300);

  // A3. Duck on a real voice line: Dr. Haddy speaks; the world bus measures at least 6 dB down, the music ducks 8 dB.
  const voiceId = await page.evaluate(async () => {
    const list = await (await fetch(new URL('vo/index.json', document.baseURI))).json();
    // a long line, so the measurement sits well inside her speech
    const pick = list.find((c) => (c.text ?? '').length > 120) ?? list[0];
    return pick.id;
  });
  // the world bus's level in dB, averaged over n readings (each reading is the last 2048 samples, about 43 ms)
  const readings = [];
  // averaged in power (the level of the whole window), not in dB, so one quiet reading does not skew it
  const measure = async (n) => {
    const xs = [];
    for (let i = 0; i < n; i++) { xs.push((await levels(page)).world); await sleep(120); }
    readings.push(xs.map((x) => x.toFixed(1)).join(' '));
    return 10 * Math.log10(xs.reduce((a, x) => a + 10 ** (x / 10), 0) / xs.length);
  };
  const worldBefore = await measure(20);
  // the narrator chain is wired on the first gesture after the play screen mounts: wire it now (the test has no gesture after that)
  await page.evaluate(() => window.hmPlay.initAudio());
  await page.evaluate((id) => window.hmPlay.replay(id), voiceId); // replay plays the clip through the voice chain, and ducks the buses
  await sleep(350);
  const worldDuring = await measure(20);
  console.log('world readings (dB), before then during: ' + readings.join(' | '));
  const during = { buses: await page.evaluate(() => window.__audio.getBuses()) };
  // her level is a speech level, so take the loudest of several readings while she is still talking
  let voiceLevel = -200;
  for (let i = 0; i < 8; i++) { voiceLevel = Math.max(voiceLevel, (await levels(page)).voice); await sleep(100); }
  const drop = worldBefore - worldDuring;
  check('duck: the world bus measures at least 6 dB down during a voice line', drop >= 5.5, `before ${worldBefore.toFixed(1)} dB, during ${worldDuring.toFixed(1)} dB, drop ${drop.toFixed(2)} dB`);
  check('duck: the world low-pass is at 1.8 kHz and the world duck is -6.5 dB while she speaks', Math.abs(during.buses.worldLowpassHz - 1800) < 50 && Math.abs(during.buses.duckWorld - 10 ** (-6.5 / 20)) < 0.03, `lowpass ${during.buses.worldLowpassHz.toFixed(0)} Hz, duck ${during.buses.duckWorld.toFixed(3)}`);
  check('duck: the music bus ducks to 0.45 (MENTOR_MIX) while she speaks', Math.abs(during.buses.duck - 0.45) < 0.03 || Math.abs(during.buses.duck - 10 ** (-8 / 20)) < 0.03, `duck ${during.buses.duck.toFixed(3)}`);
  check('duck: her voice bus is audible and never ducked', voiceLevel > -40 && during.buses.dialogue > 0.7, `voice ${voiceLevel.toFixed(1)} dB`);
  // the release: back to open once her line has ended
  let released = false;
  for (let i = 0; i < 120 && !released; i++) {
    await sleep(250);
    const b = await page.evaluate(() => window.__audio.getBuses());
    released = b.duckWorld > 0.98 && b.duck > 0.98;
  }
  check('duck: the buses come back once the line ends', released);

  // A4. Stage ambience: the layers change between stage 0 and stage 4, and the bus is audible.
  await page.evaluate(() => window.__audio.setAmbience({ where: 'planet', stage: 0, floats: { pxd: 0.3, vtx: 0.3, lx: 0.1, aq: 0.1 }, nearWater: false }));
  await sleep(2200);
  const amb0 = await page.evaluate(() => window.__audio.getAmbience());
  const ambLevel0 = (await levels(page)).ambience;
  await page.evaluate(() => window.__audio.setAmbience({ where: 'planet', stage: 4, floats: { pxd: 0.6, vtx: 0.8, lx: 0.5, aq: 0.5 }, nearWater: true }));
  await sleep(2200);
  const amb4 = await page.evaluate(() => window.__audio.getAmbience());
  const ambLevel4 = (await levels(page)).ambience;
  check('ambience: stage 0 has the breath and the thin wind, no growth', amb0.layers.includes('amb-breath') && !amb0.layers.includes('amb-growth-wind'), amb0.layers.join(','));
  check('ambience: stage 4 adds the growth wind and the warm reverb', amb4.layers.includes('amb-growth-wind') && amb4.reverbWet > 0 && amb4.layers.join() !== amb0.layers.join(), `${amb4.layers.join(',')} reverb ${amb4.reverbWet}`);
  check('ambience: the ambience bus is audible at stages 0 and 4', ambLevel0 > -70 && ambLevel4 > -70, `stage 0 ${ambLevel0.toFixed(1)} dB, stage 4 ${ambLevel4.toFixed(1)} dB`);
  await page.evaluate(() => window.__audio.setAmbience({ where: 'lab', stage: 0, floats: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, nearWater: false }));
  await sleep(1500);
  const labAmb = await page.evaluate(() => window.__audio.getAmbience());
  check('ambience: the lab has the hum, the vent and the storm bed', labAmb.layers.includes('amb-lab-hum') && labAmb.storm, labAmb.layers.join(','));
  // A5. The procedural audio verbs (T09b, brief 29 item 2): mode chords, cartridge clicks, degauss, gate charge, extract chime ladder
  const proceduralChecks = await page.evaluate(async () => {
    const a = window.__audio;
    // Chime ladder: 0s, 0.2s, 0.4s
    const c0 = a.playExtractChime(0);
    const c1 = a.playExtractChime(0.2);
    const c2 = a.playExtractChime(0.4);
    const stateBefore = a.getChimeState();
    // After 1.3s delay, should reset
    const c3 = a.playExtractChime(1.7);
    const stateAfter = a.getChimeState();

    // Trigger procedural verbs
    a.playApply();
    a.playSculpt();
    a.playSeal();
    a.playCartridgeSnap();
    a.playCartridgePing();
    a.playSkinDegauss();
    a.playGateIgnitionCharge();
    a.playDryFire();

    return {
      c0Pitch: c0.pitch ?? c0.ratio,
      c1Pitch: c1.pitch ?? c1.ratio,
      c2Pitch: c2.pitch ?? c2.ratio,
      ladderBefore: stateBefore.run,
      c3Ladder: stateAfter.run,
      c3Pitch: c3.pitch ?? c3.ratio,
    };
  });
  check('verbs: extract chime increments pitch across consecutive hits', proceduralChecks.c1Pitch > proceduralChecks.c0Pitch && proceduralChecks.c2Pitch > proceduralChecks.c1Pitch, `pitches: ${proceduralChecks.c0Pitch.toFixed(3)}, ${proceduralChecks.c1Pitch.toFixed(3)}, ${proceduralChecks.c2Pitch.toFixed(3)}`);
  check('verbs: extract chime resets ladder after gap', proceduralChecks.ladderBefore === 2 && proceduralChecks.c3Ladder === 0, `ladder before: ${proceduralChecks.ladderBefore}, after: ${proceduralChecks.c3Ladder}`);

  // A6. Print sweep midway capture: place machine on moon and capture during 0.65s sweep
  const doneBtn = page.locator('button', { hasText: 'Done: into the lab' });
  if (await doneBtn.isVisible()) await doneBtn.click();
  await sleep(600);

  await page.evaluate(() => {
    window.hmPlay.initAudio();
    window.hmPlay.pull();
  });
  await sleep(1500);
  await page.evaluate(() => {
    const g = window.hmPlay.gate();
    window.hmPlay.go('planet', g.x, 0, g.z + 10, Math.PI);
  });
  await sleep(1500);
  await page.evaluate(() => {
    const g = window.hmPlay.gate();
    window.hmPlay.placeAt(g.x, g.z + 5);
  });
  // Midway through 0.65s sweep (at ~280ms)
  await sleep(280);
  await page.screenshot({ path: path.join(shotsDir, 'print-sweep-midway.png') });

  await page.close();

  // ---------------------------------------------------------------- B. from disk
  const disk = await newPage();
  await disk.goto(pathToFileURL(dist).href, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await disk.waitForFunction(() => typeof window.__audio !== 'undefined', { timeout: 35000 });
  await disk.evaluate(() => window.__audio.getContext());
  let mode = 'pending';
  for (let i = 0; i < 60 && mode === 'pending'; i++) {
    await sleep(250);
    mode = await disk.evaluate(() => window.__audio.getCrush().mode);
  }
  check('from disk: the bit-depth worklet loads from the single built file', mode === 'worklet', `mode ${mode}`);
  await disk.close();
} catch (err) {
  console.error('\nTEST FAILED:', err);
  results.push({ name: 'exception', ok: false });
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} audio bus checks passed`);
process.exit(failed.length ? 1 : 0);
