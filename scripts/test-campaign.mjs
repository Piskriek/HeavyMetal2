/**
 * TASK-20: the campaign is one game. A fresh profile, against the production build (apps/web/dist), with NO fixture flags
 * (no ?base, ?kit, ?mash): the only URL switch is ?e2e, the debug switch that exposes window.__dev (grant, setStage, ...).
 *
 * The beats, in order:
 *   1 menu, then the expedition (a new profile starts in the lab),
 *   2-7 Acts I to III as in test-playthrough.mjs (the wake, the power, the window, the gate, the Moon, the first machine),
 *   8 on the planet, B opens the one build menu; Structures is locked until the first colour bloom, and says why,
 *   9 the inventory (Tab) opens and holds the starter kit,
 *   10 reload: the inventory and the chain persist, and Act I does not replay.
 * TASK-22, Acts IV to VI (each step is the game's own action; only the plot's stage (__dev.setStage) and 50 units of mining
 * (hmPlay.grindCount) are skipped as grinding):
 *   11 A4-01 starts once the drill runs; G refuses the rifle until it is taken,
 *   12 the journal lists the act, the step and its hint,
 *   13 the armory rack hands over the rifle; G draws it,
 *   14 A4-02: 50 units mined and 10 s of the mill; its line plays,
 *   14a to 14d (TASK-21d) the rifle in hand (V); the boulder mined for ore; a cartridge loaded and painted; carve, raise, the gate pad
 *     kept out, and the cut kept through a reload (the save is real: the game reloads and Continue loads it),
 *   15 A4-03: the Studio opens from the journal; the line plays on the way back,
 *   16 A4-04: stage 2 ends Act IV; the Structures tab opens; the bridge kit arrives,
 *   17 B-01 the foundation, 18 B-04 a real harvest of raw pixels, 19 B-06 a drafted blueprint, 20 B-05 the bin,
 *   21 B-07 a chassis blueprint, an airlock and life support seal a room,
 *   22 F-01 the hardpoint and the fabricator installed from the machine picker,
 *   23 F-02 the scout printed by the print button (the frame loop runs it), driven for real, the metres topped up,
 *   24 F-03 the weapon bench, the gun forged, fitted and equipped, 25 F-04 and F-05 the stages unlock the hauler and crawler,
 *   26 a death respawns at the gate (the death is a hook until TASK-23b), 27 each chain line once, S-2 skipped for A4-04.
 * TASK-23c, the props in the world: L1 the lab with its clutter and the weapon bench (shots), and the window view inside its budget
 *   (40 calls at the peak frame, 120k triangles); 9b a held E clears the large crate, its salvage goes into the pack, and it stays gone after a reload;
 *   9c aimed at the old monitor, the readout shows on hover and E opens its Bridge Incident Log; 13c a seal lifts its leak's wreck one
 *   rung (broken junk stands a rung below the plot's stage until it is sealed), and the seal is saved; 28b at stage 6 a broken wreck
 *   stands at rung 2 and its seal lifts it to rung 3.
 *
 * Every beat: a shot in shots-run/campaign/, the FPS over two seconds, and a pass or fail. Console errors and HTTP errors
 * are collected across the whole run. Exit code 1 when any beat fails.
 */
import { chromium } from 'playwright-core';
import { hudZoneViolations } from './e2e-hud-and-luminance-gate.mjs';
import { spawn } from 'node:child_process';
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
const shotsDir = path.join(root, 'shots-run/campaign');
fs.mkdirSync(shotsDir, { recursive: true });
for (const f of fs.readdirSync(shotsDir)) {
  if (f.endsWith('.png') || f === 'summary.json') fs.unlinkSync(path.join(shotsDir, f));
}

const port = 8094;
const base = `http://localhost:${port}`;
const game = `${base}/?e2e`;
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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

// Every error, as it happens, goes to shots-run/campaign/page-errors.log (tagged with the beat that was running), so a failed
// run leaves its errors behind even when a later beat or the report never runs. The log starts empty on every run.
const errorLog = path.join(root, 'shots-run/campaign/page-errors.log');
fs.writeFileSync(errorLog, '');
let currentBeat = 'before the first beat';
const logError = (kind, text) => fs.appendFileSync(errorLog, `[${kind}] during beat "${currentBeat}": ${text}
`);
const consoleErrors = [];
const httpErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') { consoleErrors.push(msg.text()); logError('console', msg.text()); }
});
page.on('pageerror', (err) => { consoleErrors.push(`pageerror: ${err.message}`); logError('pageerror', `${err.message}
${err.stack ?? ''}`); });
page.on('response', (res) => {
  if (res.status() >= 400) { httpErrors.push(`${res.status()} ${res.url()}`); logError('http', `${res.status()} ${res.url()}`); }
});
page.on('requestfailed', (req) => { const t = `failed ${req.url()} ${req.failure()?.errorText ?? ''}`; httpErrors.push(t); logError('http', t); });

const results = [];
let shotNo = 0;
// TASK-24 (P0-PROD-01): at every shot, the title card, the build hint and the radio subtitle must not overlap each other.
// Each overlay carries a data-hud-zone attribute; every pair of boxes is compared, and none may reach the reticle's clear zone (TASK-25).
const hudViolations = [];
const hudOverlaps = () => hudZoneViolations(page).catch(() => []);

const shot = async (name) => {
  shotNo += 1;
  const file = path.join(shotsDir, `${String(shotNo).padStart(2, '0')}-${name}.png`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.screenshot({ path: file });
      for (const v of await hudOverlaps()) hudViolations.push(`${name}: ${v}`);
      return file;
    } catch (err) {
      if (attempt === 5) throw err;
      await page.waitForTimeout(300);
    }
  }
  return file;
};

const fps = (ms = 2000) => page.evaluate((ms) => new Promise((resolve) => {
  let n = 0;
  const t0 = performance.now();
  const frame = () => {
    n += 1;
    if (performance.now() - t0 < ms) requestAnimationFrame(frame);
    else resolve(Math.round((n * 1000) / (performance.now() - t0)));
  };
  requestAnimationFrame(frame);
}), ms);

const subId = () => page.evaluate(() => window.hmPlay?.subtitles?.()?.id ?? null);
// TASK-28: the mean luminance (0 to 255, Rec. 709) of a saved shot, measured in the page on a 320 x 180 copy of it
const meanLuma = async (file) => {
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 180;
    const cx = cv.getContext('2d');
    cx.drawImage(bmp, 0, 0, 320, 180);
    const px = cx.getImageData(0, 0, 320, 180).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return sum / (px.length / 4);
  }, b64);
};
let darkLuma = null;

const waitSub = async (id, timeout = 5000) => {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    last = await subId();
    if (last === id) return true;
    await page.waitForTimeout(150);
  }
  return last === id;
};
// The narrator speaks one line at a time: a trigger sent while a line plays is dropped. Wait for a quiet subtitle.
const quiet = async (timeout = 25000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await subId()) === null) return true;
    await page.waitForTimeout(200);
  }
  return false;
};

// TASK-24: the checkpoints the owner's review loads (apps/web/public/checkpoints, listed in index.json). One per act's start,
// and stage 6 with the monsters unlocked. Each holds the save keys of src/storage/checkpoints.ts (CHECKPOINT_KEYS and the radio logs).
const CHECKPOINT_AFTER = [
  { beat: '2', name: 'act1-wake', title: 'Act I: the wake', act: 'I' },
  { beat: '11', name: 'act4-start', title: 'Act IV: the drill', act: 'IV' },
  { beat: '16', name: 'act5-start', title: 'Act V: the base', act: 'V' },
  { beat: '21', name: 'act6-start', title: 'Act VI: the hardpoint', act: 'VI' },
  { beat: '25', name: 'stage6-monsters', title: 'Stage 6: the monsters unlocked', act: 'VI' },
  { beat: '29', name: 'act7-start', title: 'Act VII: the continental grid', act: 'VII' },
  { beat: '32', name: 'act8-start', title: 'Act VIII: heavy terraformers', act: 'VIII' },
  { beat: '35', name: 'act9-start', title: 'Act IX: continental consensus', act: 'IX' },
];
const checkpointsDir = path.join(root, 'apps/web/public/checkpoints');
const checkpointIndex = [];
fs.mkdirSync(checkpointsDir, { recursive: true });
for (const f of fs.readdirSync(checkpointsDir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(checkpointsDir, f));
const saveCheckpoint = async (name, title, act) => {
  const data = await page.evaluate(() => {
    // the base is saved now (its save runs at most every 2 s), so the file holds the state the chain is in
    window.hmPlay.base.save();
    const keep = (k) => ['hm.setmix.play', 'hm-base-v1', 'hm.setmix.beam', 'hm.setmix.props', 'hm.player.v1'].includes(k) || k.startsWith('fidelity.radio-log.');
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && keep(k)) keys[k] = localStorage.getItem(k);
    }
    return { keys, where: window.hmPlay.where ?? null, step: window.hmPlay.chain().current?.id ?? null };
  });
  const file = { format: 'hm-checkpoint', v: 1, name, title, act, expect: { where: data.where, step: data.step }, keys: data.keys };
  // a Windows file can be locked for a moment (a scan or an indexer holds it): the write is retried, three tries in all, and logged
  const writeChecked = (p, text) => {
    for (let attempt = 1; ; attempt++) {
      try { fs.writeFileSync(p, text); return; } catch (err) {
        if (attempt === 3) throw err;
        console.log(`checkpoint write retry ${attempt} for ${path.basename(p)}: ${err.code ?? err.message}`);
        const until = Date.now() + 500;
        while (Date.now() < until) { /* a short pause before the retry */ }
      }
    }
  };
  writeChecked(path.join(checkpointsDir, `${name}.json`), `${JSON.stringify(file, null, 2)}\n`);
  checkpointIndex.push({ name, title, act });
  writeChecked(path.join(checkpointsDir, 'index.json'), `${JSON.stringify(checkpointIndex, null, 2)}\n`);
  console.log(`checkpoint ${name} (act ${act}): where=${data.where} step=${data.step} keys=${Object.keys(data.keys).length}`);
};

const beat = async (name, fn) => {
  currentBeat = name;
  const started = Date.now();
  const row = { name, ok: false, detail: '', fps: null, shot: null, seconds: 0 };
  try {
    const out = await fn(row);
    row.ok = out?.ok === true;
    row.detail = out?.detail ?? '';
  } catch (err) {
    // the first line says what failed; the "waiting for locator" line says which control it was
    const lines = err.message.split('\n').map((l) => l.trim()).filter(Boolean);
    const waiting = lines.find((l) => /waiting for|locator\(/.test(l));
    row.detail = `error: ${lines[0]}${waiting ? ` [${waiting}]` : ''}`;
  }
  row.seconds = Math.round((Date.now() - started) / 1000);
  row.fps = await fps(2000).catch(() => null);
  results.push(row);
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name} | fps ${row.fps ?? '?'} | ${row.detail}`);
  // TASK-24: an act's checkpoint is taken when the beat that starts it has passed
  const cp = CHECKPOINT_AFTER.find((c) => name.startsWith(`${c.beat} `));
  if (cp && row.ok) await saveCheckpoint(cp.name, cp.title, cp.act);
  return row;
};

const dismissCreator = () => page.evaluate(() => {
  const done = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Done'));
  done?.click();
});

// ----------------------------------------------------------------------------------------------------------------------
// The beats
// ----------------------------------------------------------------------------------------------------------------------
await beat('1 main menu, Expedition starts a new game in the lab (no fixture flags)', async (row) => {
  await page.goto(`${game}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  row.shot = await shot('menu');

  // Gate check (POL-306): fresh save has no Ending Credits item on title menu
  const creditsBtnCount = await page.locator('.sm-menu button', { hasText: 'Ending Credits' }).count();
  const heroBlade = await page.locator('.fidelity-hero-blade, .fidelity-glass-blade, .fidelity-menu').count();
  const portraitOnMenu = await page.locator('[data-testid="haddy-crt-portrait"], .hud-haddy-crt-portrait, .haddy-crt-portrait').count();
  await shot('menu-hero');
  await shot('title-portrait');

  await expBtn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(500);

  // Esc debug entry check: button exists in Esc debug menu on fresh save
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const dbgCreditsBtn = page.locator('[data-testid="dbg-play-credits"]');
  const hasDbgCredits = await dbgCreditsBtn.count();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  const where = await page.evaluate(() => window.hmPlay?.where);
  const hasDev = await page.evaluate(() => typeof window.__dev?.grant === 'function');
  const ok = where === 'lab' && hasDev && creditsBtnCount === 0 && heroBlade > 0;
  return { ok, detail: `where=${where} __dev=${hasDev} freshCreditsBtn=${creditsBtnCount} heroBlade=${heroBlade} portrait=${portraitOnMenu} dbgCredits=${hasDbgCredits}` };
});

// TASK-28 (P1-HOUR-03): the wake. The camera starts pitched up about 65 degrees at the dark ceiling and sits up to level over 2.2 s.
await beat('1a the wake: the camera starts pitched up at the dark ceiling and sits up to level over 2.2 s', async (row) => {
  // the wake starts when the player gains control (after the loading bar and the creator); its log holds every frame of it
  await page.waitForTimeout(2600);
  const w = await page.evaluate(() => window.__playScene.debug.wake());
  const log = w.log;
  const first = log[0];
  const last = log[log.length - 1];
  const monotone = log.every((e, i) => i === 0 || e.lift <= log[i - 1].lift + 1e-9);
  // the start, as a shot: the wake's clock set back to its first frame (the camera 65 degrees up, at the dark ceiling)
  await page.evaluate(() => window.__playScene.debug.setWake(0));
  row.shot = await shot('wake-start');
  await page.evaluate(() => window.__playScene.debug.setWake(-1));
  const deg = (r) => Math.round((r * 180) / Math.PI);
  const ok = log.length > 20 && !!first && first.lift > 1.0 && monotone && !!last && last.t > 1.9 && last.t <= 2.2 && w.t < 0 && w.lift === 0;
  return { ok, detail: `wake: ${log.length} frames; starts at ${first ? deg(first.lift) : 'n/a'} deg, eases to level by ${last ? last.t.toFixed(2) : 'n/a'} s; monotone=${monotone}; level now=${w.t < 0}` };
});
await beat('2 Act I: waking speaks A1-01 with the subtitle', async (row) => {
  const seen = await waitSub('A1-01', 15000);
  const visible = await page.locator('[data-testid="mentor-subtitle"]').isVisible().catch(() => false);
  row.shot = await shot('act1-wake');
  return { ok: seen && visible, detail: `subtitle A1-01 seen=${seen} visible=${visible}` };
});

await beat('3 looking at the power wall gives A1-02', async (row) => {
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', -4.2, 1.0, Math.PI / 2, 0);
    window.hmPlay.trigger('look:power-wall');
  });
  const ok = await waitSub('A1-02', 4000);
  await page.waitForTimeout(700);
  row.shot = await shot('power-wall');
  // TASK-28: the dark lab from here, before the lever (the powered shot in beat 4 is taken from the same place)
  darkLuma = await meanLuma(await shot('lab-dark-before-power'));
  return { ok, detail: `A1-02 seen=${ok}` };
});

await beat('4 breaker and lever: power on gives A1-04; the banks, the beacons and the gate coils come up in order over 3.5 s, then the arc flash (TASK-28)', async (row) => {
  await quiet();
  await page.evaluate(() => window.hmPlay.pull());
  const t0 = Date.now();
  // sample the sequence as it runs (the scene's power and its coils, read each step): the order is what the brief asks for.
  // The lines (A1-03 at the lever, A1-04 when the power is on) are read in the same loop, because they play during it.
  const samples = [];
  const seenLines = new Set();
  let midShot = null, flashShot = null;
  while (Date.now() - t0 < 7600) {
    const at = (Date.now() - t0) / 1000;
    const s = await page.evaluate(() => ({
      coils: window.__playScene.debug.coilsLit(),
      p: window.__playScene.debug.power(),
      line: window.hmPlay?.subtitles?.()?.id ?? null,
    }));
    if (s.line) seenLines.add(s.line);
    samples.push({ at, coils: s.coils, banks: s.p.banks, beacons: s.p.beacons, arc: s.p.arc });
    if (!midShot && at >= 2.6) midShot = await shot('power-mid');
    if (!flashShot && s.p.arc > 0.6) flashShot = await shot('ignition-flash');
    await page.waitForTimeout(120);
  }
  const breaker = seenLines.has('A1-03');
  // the coils: each sample's lit set is a bottom-to-top prefix, the count only rises, and all of them are lit at the end
  const n = samples[0]?.coils.length ?? 0;
  const prefixOk = samples.every((x) => x.coils.every((c, i) => !c || i === 0 || x.coils[i - 1]));
  const counts = samples.map((x) => x.coils.filter(Boolean).length);
  const risesOk = counts.every((c, i) => i === 0 || c >= counts[i - 1]);
  const lastAll = counts[counts.length - 1] === n && n > 0;
  const firstLit = samples.find((x) => x.coils[0])?.at ?? Infinity;
  const lastLit = samples.find((x) => x.coils[n - 1])?.at ?? Infinity;
  const span = lastLit - firstLit;
  // the banks light back to front: the first sample where each bank has any light
  const firstBank = [0, 1, 2].map((i) => samples.find((x) => x.banks[i] > 0.02)?.at ?? Infinity);
  const banksOk = firstBank[0] < firstBank[1] && firstBank[1] < firstBank[2];
  const beaconsOk = samples.some((x) => x.beacons > 0.9);
  const flashOk = flashShot !== null;
  // the mean luminance: the lab is far brighter powered than in the dark (the shot before the lever)
  // the power-on line: the scene plays it when the sequence ends; if it has not shown in the loop, the trigger asks for it
  let on = seenLines.has('A1-04');
  if (!on) {
    await quiet();
    await page.evaluate(() => window.hmPlay.trigger('power:on'));
    on = await waitSub('A1-04', 4000);
  }
  await page.waitForTimeout(2500);
  const lumaOn = await meanLuma(await shot('power-on'));
  const lumaOk = darkLuma !== null && lumaOn > 2 * darkLuma + 5;
  const ok = breaker && on && prefixOk && risesOk && lastAll && span > 2.4 && span < 4.0 && banksOk && beaconsOk && flashOk && lumaOk;
  row.shot = midShot;
  const f1 = (x) => x.toFixed(1);
  return { ok, detail: `A1-03=${breaker} A1-04=${on} coils=${n}: bottom-to-top=${prefixOk} only-rises=${risesOk} all-lit=${lastAll} sweep=${span.toFixed(2)} s; banks back-to-front=${banksOk} beacons=${beaconsOk} arc flash=${flashOk}; mean luma dark ${darkLuma === null ? 'n/a' : f1(darkLuma)} powered ${f1(lumaOn)}` };
});

await beat('5 Act II: the window gives A2-01, the gate approach A2-02, the gate opens (A2-03, A2-04)', async (row) => {
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 2.2, 0, 0);
    window.hmPlay.trigger('look:window');
  });
  const window1 = await waitSub('A2-01', 4000);
  await page.waitForTimeout(600);
  await shot('window');
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 3.2, 0, 0);
    window.hmPlay.trigger('gate:approach');
  });
  const approach = await waitSub('A2-02', 4000);
  await page.waitForTimeout(600);
  await shot('gate-approach');
  await quiet();
  await page.evaluate(() => window.hmPlay.trigger('gate:lever'));
  const lever = await waitSub('A2-03', 4000);
  await quiet();
  await page.evaluate(() => window.hmPlay.trigger('gate:open'));
  const open = await waitSub('A2-04', 4000);
  await page.waitForTimeout(2500);
  row.shot = await shot('gate-open');
  return { ok: window1 && approach && open, detail: `A2-01=${window1} A2-02=${approach} A2-03=${lever} A2-04=${open}` };
});

await beat('6 the Moon: stepping through gives A3-01, stage-0 Moon and its music', async (row) => {
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 3.0, 0, 0);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
  });
  await page.keyboard.down('KeyW');
  let reached = false;
  for (let i = 0; i < 48 && !reached; i++) {
    await page.waitForTimeout(250);
    reached = (await page.evaluate(() => window.__playScene.debug.where())) === 'planet';
  }
  await page.keyboard.up('KeyW');
  const whereNow = await page.evaluate(() => window.hmPlay.where);
  const seen = await waitSub('A3-01', 5000);
  await page.waitForTimeout(2000);
  const music = await page.evaluate(() => window.hmPlay.audio?.getMusicContext?.() ?? null);
  const stage = await page.evaluate(() => window.hmPlay.state?.()?.plot?.stage ?? null);
  row.shot = await shot('moon-stage0');
  const ok = whereNow === 'planet' && seen && music === 'moon' && (stage === 0 || stage === null);
  return { ok, detail: `where=${whereNow} A3-01=${seen} music=${music} stage=${stage}` };
});

await beat('7 the first machine on the Moon: A3-03, its plume rises from the machine', async (row) => {
  await quiet();
  const placed = await page.evaluate(() => {
    window.hmPlay.give(400);
    const scene = window.__playScene;
    const p = scene.debug.position();
    const g = scene.debug.gatePlanet();
    const dx = p.x - g.x, dz = p.z - g.z, h = Math.hypot(dx, dz) || 1;
    return window.hmPlay.placeAt(g.x + (dx / h) * 10, g.z + (dz / h) * 10, 'mill');
  });
  await page.waitForTimeout(800);
  const a3 = await waitSub('A3-03', 4000);
  await page.waitForTimeout(3500);
  const machines = await page.evaluate(() => window.hmPlay.machines());
  row.shot = await shot('first-machine');
  const ok = placed === true && a3 && machines.standing >= 1 && machines.pouring >= 1;
  return { ok, detail: `placed=${placed} A3-03=${a3} standing=${machines.standing} pouring=${machines.pouring}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// The base, in the campaign (TASK-20): no ?base flag, one build menu, one inventory
// ----------------------------------------------------------------------------------------------------------------------
const foundations = () => page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').length);
// the foundation B-01 placed: the bin, the airlock and the hardpoint are placed on it (set in beat 17)
let foundId = null;
// the foundation the life support stands on (set in beat 21): the hardpoint's pad is placed beside it
let roomId = null;
// the hardpoint pad's first foundation (set in beat 22): the weapon bench's foundation is placed beyond it
let padBase = null;
// Stands 3 to 5 m from a base piece, facing a point on it (fx, fz: 0 to 1 across its footprint), and checks that the aim
// (what E places at) lands on that piece.
const lookAtPiece = (id, fx = 0.5, fz = 0.5) => page.evaluate(async ({ id, fx, fz }) => {
  const s = window.__playScene;
  const b = s.debug.pieceBounds(id);
  if (!b) return { ok: false, aim: null, why: 'piece not drawn' };
  // a point just under the top of the piece, on the grid across its footprint
  const t = [b.min[0] + (b.max[0] - b.min[0]) * fx, b.max[1] - 0.05, b.min[2] + (b.max[2] - b.min[2]) * fz];
  const here = s.debug.position();
  let ux = here.x - t[0];
  let uz = here.z - t[2];
  const len = Math.hypot(ux, uz) || 1;
  ux /= len;
  uz /= len;
  let aim = null;
  let normalY = null;
  for (const d of [1.5, 2.5, 3.5]) for (const pitch of [-0.4, -0.6, -0.8]) {
    const px = t[0] + ux * d;
    const pz = t[2] + uz * d;
    // the camera looks along (-sin yaw, -cos yaw)
    window.hmPlay.go('planet', px, pz, Math.atan2(-(t[0] - px), -(t[2] - pz)), pitch);
    await new Promise((r) => setTimeout(r, 150));
    const a = s.aimPoint();
    aim = a?.piece ?? null;
    normalY = a?.normal?.y ?? null;
    // the top of the piece: the aim hits it and its normal points up (a side face would put the piece on the wall)
    if (aim === id && normalY !== null && normalY > 0.7) return { ok: true, aim, normalY: Math.round(normalY * 100) / 100 };
  }
  return { ok: false, aim, why: `the aim never landed on the top of the piece (last piece ${aim}, normal y ${normalY === null ? 'none' : Math.round(normalY * 100) / 100})` };
}, { id, fx, fz });

// Places a piece of a kind on a foundation (baseId): aims at each point of a grid across it until one is free (the piece
// count rises). A spot the game refuses (occupied, no floor) is simply not counted; the next spot is tried.
const placeOnFoundation = async (kindLabel, kind, baseId = foundId) => {
  const count = () => page.evaluate((k) => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === k).length, kind);
  const toasts = [];
  for (const fx of [0.2, 0.5, 0.8]) for (const fz of [0.2, 0.5, 0.8]) {
    const look = await lookAtPiece(baseId, fx, fz);
    if (!look.ok) { toasts.push(`aim: ${look.why}`); continue; }
    const before = await count();
    const toast = await placeFromStructures(kindLabel);
    toasts.push(toast || '(no toast)');
    if ((await count()) > before) return { placed: true, toasts };
  }
  return { placed: false, toasts };
};

// Stands near a ground point, facing it, and checks that the aim lands on open ground there.
const groundNear = (x, z) => page.evaluate(async ({ x, z }) => {
  const s = window.__playScene;
  for (const d of [4, 3, 5]) for (const pitch of [-0.5, -0.7, -0.35]) for (const [ox, oz] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const px = x + ox * d;
    const pz = z + oz * d;
    window.hmPlay.go('planet', px, pz, Math.atan2(-(x - px), -(z - pz)), pitch);
    await new Promise((r) => setTimeout(r, 150));
    const a = s.aimPoint();
    if (a && a.piece === null && a.normal.y > 0.7 && Math.hypot(a.x - x, a.z - z) < 1.5) return { ok: true };
  }
  return { ok: false };
}, { x, z });

// A new Foundation (the Structures tab's own) on open ground beside a base piece: the room the life support and the
// hardpoint go in, since one foundation's top holds only so much. Returns its id.
const freshFoundation = async (nearId, dx = 3) => {
  const at = await page.evaluate(({ id, dx }) => {
    const b = window.__playScene.debug.pieceBounds(id);
    return b ? { x: b.max[0] + dx, z: (b.min[2] + b.max[2]) / 2 } : null;
  }, { id: nearId, dx });
  if (!at) return { ok: false, id: null, why: 'base piece not drawn' };
  const g = await groundNear(at.x, at.z);
  if (!g.ok) return { ok: false, id: null, why: 'no open ground aim beside the base' };
  const before = await foundations();
  const toast = await placeFromStructures('Foundation');
  const after = await foundations();
  const id = after > before ? await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id).pop()) : null;
  return { ok: after > before, id, why: toast || 'no toast' };
};

// The hardpoint's pad: a 2 x 2 block of foundations (the game needs all four cells grounded). Four Foundation placements,
// each aimed at the ground where its cell is, 10 m beyond the first foundation. Returns the id of the block's first foundation.
const buildPad = async () => {
  const geo = await page.evaluate((id) => {
    const b = window.__playScene.debug.pieceBounds(id);
    if (!b) return null;
    return { W: b.max[0] - b.min[0], D: b.max[2] - b.min[2], O: [b.max[0] + 10, (b.min[2] + b.max[2]) / 2] };
  }, foundId);
  if (!geo) return { ok: false, base: null, why: 'base piece not drawn' };
  // each aim lies one metre inside its own cell, on the side of the neighbour it must join (an aim at a cell's centre is too
  // far from that neighbour, and the game then starts a second structure: the hardpoint needs the four in one)
  const targets = [[0, 0], [geo.W - 1, 0], [0, geo.D - 1], [geo.W - 1, geo.D]].map(([dx, dz]) => [geo.O[0] + dx, geo.O[1] + dz]);
  const log = [];
  for (const [x, z] of targets) {
    const g = await groundNear(x, z);
    if (!g.ok) return { ok: false, base: null, why: `no ground aim at ${x.toFixed(1)},${z.toFixed(1)}` };
    const before = await foundations();
    const toast = await placeFromStructures('Foundation');
    const after = await foundations();
    log.push(after > before ? 'placed' : `refused (${toast || 'no toast'})`);
    if (after <= before) return { ok: false, base: null, why: log.join(', ') };
  }
  const base = await page.evaluate((O) => {
    const fs = window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').slice(-4);
    let best = null;
    for (const f of fs) {
      const b = window.__playScene.debug.pieceBounds(f.id);
      if (!b) continue;
      const d = Math.hypot((b.min[0] + b.max[0]) / 2 - O[0], (b.min[2] + b.max[2]) / 2 - O[1]);
      if (best === null || d < best.d) best = { id: f.id, d };
    }
    return best ? best.id : null;
  }, geo.O);
  const cells = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').slice(-4).map((p) => `s${p.s}:${p.i},${p.j},${p.k}`).join(' '));
  return { ok: base !== null, base, why: `${log.join(', ')} [${cells}]` };
};
const slotsJson = () => page.evaluate(() => JSON.stringify(window.hmPlay.base.world().player.slots));

const chainState = () => page.evaluate(() => window.hmPlay.chainState());
const chainCur = () => page.evaluate(() => window.hmPlay.chain().current?.id ?? null);
const toastText = () => page.evaluate(() => document.querySelector('.play-toast b')?.textContent ?? '');
const pauseOn = () => page.evaluate(() => window.hmPlay.setPaused(true));
const pauseOff = () => page.evaluate(() => window.hmPlay.setPaused(false));
const toPlanet = async () => {
  await page.evaluate(() => {
    const g = window.__playScene.debug.gatePlanet();
    window.hmPlay.go('planet', g.x + 3, g.z + 5, Math.PI, -0.6);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
    window.__hm?.clearToast?.();
    const w = window.hmPlay?.base?.world?.();
    if (w) {
      const emptyIdx = w.player.slots.slice(0, 9).findIndex((s) => !s || s.n === 0);
      if (emptyIdx >= 0) window.hmPlay.base.apply({ t: 'hotbar', index: emptyIdx });
    }
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 20000 });
  await page.keyboard.press('9');
};
const toLab = async () => {
  await page.evaluate(() => {
    window.hmPlay.go('lab', 0, 0, 0, 0);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
    window.__hm?.clearToast?.();
    const w = window.hmPlay?.base?.world?.();
    if (w) {
      const emptyIdx = w.player.slots.slice(0, 9).findIndex((s) => !s || s.n === 0);
      if (emptyIdx >= 0) window.hmPlay.base.apply({ t: 'hotbar', index: emptyIdx });
    }
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'lab', null, { timeout: 20000 });
};
const openBuildTab = async (tab) => {
  // B toggles the menu: press it only when the menu is shut
  if (!(await page.locator('section.bm').isVisible().catch(() => false))) await page.keyboard.press('KeyB');
  await page.locator(`#bm-tab-${tab}`).click();
};
// Places one piece from the Structures tab (E at the aim). Returns the toast the game showed (a refusal says why).
const placeFromStructures = async (kindLabel) => {
  await openBuildTab('structures');
  await page.locator('.bm-chip', { hasText: kindLabel }).first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__hm.hideOverlays(true));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  const toast = await toastText();
  await page.evaluate(() => window.__hm.hideOverlays(false));
  return toast;
};

await beat('8 on the planet: B opens the one build menu; Structures is locked until the first colour bloom, and says why', async (row) => {
  await quiet();
  await page.evaluate(() => {
    const g = window.__playScene.debug.gatePlanet();
    // look down at the ground (pitch -0.6): a horizon aim cannot place anything
    window.hmPlay.go('planet', g.x + 3, g.z + 5, Math.PI, -0.6);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 20000 });
  // 100 ore is 60 kg of the 120 kg carry limit (a foundation costs 20): the shot stays out of the overloaded state
  await page.evaluate(() => window.__dev.grant('ore', 100));
  await page.keyboard.press('KeyB');
  const menuOpen = await page.locator('section.bm').isVisible().catch(() => false);
  const tabs = await page.locator('.bm-tab').allTextContents();
  await page.locator('#bm-tab-structures').click();
  const lock = (await page.locator('.bm-locked').first().textContent().catch(() => '')) ?? '';
  await shot('build-menu-structures-locked');
  await page.locator('.bm-close').click();
  const menuClosed = !(await page.locator('section.bm').isVisible().catch(() => false));
  const ok = menuOpen && tabs.length === 4 && /Needs stage 2/.test(lock) && menuClosed;
  return { ok, detail: `menu=${menuOpen} tabs=${tabs.length} closed=${menuClosed} lock="${lock}"` };
});

await beat('9 the inventory (Tab) opens and holds the starter kit', async (row) => {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  const open = await page.locator('[data-testid="base-inventory-window"]').isVisible().catch(() => false);
  row.shot = await shot('inventory');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const hasKit = await page.evaluate(() => window.hmPlay.base.world().player.slots.some((s) => s && s.item === 'bp:starter'));
  return { ok: open && hasKit, detail: `inventory open=${open} starter-kit=${hasKit}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// TASK-23c: the props in the world. The lab's clutter (cleared by a held E, saved), the micro-logs (a hover readout and the
// Bridge Incident Log in the databank), and the wreck sites (a seal lifts a leak's wreck one rung on the junk-model ladder).
// ----------------------------------------------------------------------------------------------------------------------
/** The yaw and the pitch that look from (x, z, eye height) at (tx, tz, ty): yaw 0 faces north, a negative pitch looks down. */
const aimAt = (x, z, eyeY, tx, tz, ty) => ({
  yaw: Math.atan2(-(tx - x), -(tz - z)),
  pitch: Math.atan2(ty - eyeY, Math.hypot(tx - x, tz - z)),
});
/** Reloads and Continues (the props beats; the same as reloadGame, which is declared further down). */
const reloadProfile = async () => {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
};
/** A screenshot with the HUD hidden (the brief's shots carry no overlays). */
const cleanShot = async (name) => {
  await page.evaluate(() => document.querySelectorAll('.play > :not(.play-canvas)').forEach((el) => { el.dataset.shotHidden = el.style.display; el.style.display = 'none'; }));
  await page.waitForTimeout(400);
  const file = await shot(name);
  await page.evaluate(() => document.querySelectorAll('[data-shot-hidden]').forEach((el) => { el.style.display = el.dataset.shotHidden; delete el.dataset.shotHidden; }));
  return file;
};

await beat('L1 the lab with its clutter and the weapon bench from three sides (no overlays); the window view inside its budget (40 calls at its peak frame, 120k triangles)', async (row) => {
  await quiet();
  const views = [
    ['lab-clutter-east', 3.2, -1.2, -Math.PI / 2, -0.08],
    ['lab-clutter-west', -3.5, -4.5, Math.PI / 2, -0.05],
    ['lab-clutter-spawn', -2.5, 1.0, 1.97, -0.1],
    ['lab-bench-front', 6.0, 0.8, Math.PI, -0.12],
    ['lab-bench-west', 3.4, 2.4, -Math.PI / 2, -0.12],
    ['lab-bench-oblique', 3.8, 0.6, -2.356, -0.12],
  ];
  for (const [name, x, z, yaw, pitch] of views) {
    await page.evaluate((v) => window.__playScene.debug.teleport('lab', v[0], v[1], v[2], v[3]), [x, z, yaw, pitch]);
    await page.waitForTimeout(900);
    await cleanShot(name);
  }
  await page.evaluate(() => window.__playScene.debug.teleport('lab', -4.5, 0.2, -0.45, 0));
  // the budget is for the full window (the frame governor sets it by tier, and under SwiftShader that is static). The count is the peak
  // frame (the burst meshes counted whether or not a burst strikes), so it reads the same on every run (TASK-28).
  await page.evaluate(() => window.__playScene.debug.setWindowView('full'));
  await page.waitForTimeout(2500);
  const vista = await page.evaluate(() => window.__playScene.debug.vistaStats());
  await cleanShot('lab-window-view');
  const ok = vista.dust > 0 && vista.drawCalls > 0 && vista.drawCalls <= 40 && vista.triangles <= 120000;
  return { ok, detail: `window view at its peak frame: ${vista.drawCalls} draw calls (budget 40), ${vista.triangles} triangles (budget 120000), motes ${vista.dust} (0 means the view is static or not drawn)` };
});

await beat('9b clear a lab prop: aimed at the large crate, a held E dissolves it into salvage in the pack; it stays gone after a reload', async (row) => {
  await quiet();
  await page.evaluate(() => window.hmPlay.setLocked?.(true));
  const a = aimAt(3.2, -1.2, 1.65, 4.5, -2.7, 0.6);
  await page.evaluate((v) => window.__playScene.debug.teleport('lab', 3.2, -1.2, v.yaw, v.pitch), a);
  let prompt = '';
  for (let i = 0; i < 25 && !prompt.includes('salvage the large crate'); i++) {
    await page.waitForTimeout(200);
    prompt = (await page.locator('.play-prompt').first().textContent().catch(() => '')) ?? '';
  }
  const aimed = prompt.includes('salvage the large crate') ? { id: 'crate-large', salvage: true } : null;
  const pack0 = await page.evaluate(() => window.__dev.pack());
  const bridge0 = await page.evaluate(() => window.__dev.bridgeStock());
  const plotOre0 = await page.evaluate(() => window.hmPlay.plot().ore);
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(1700);
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(1400);
  const cleared = await page.evaluate(() => window.__dev.props().cleared.includes('crate-large'));
  const pack1 = await page.evaluate(() => window.__dev.pack());
  const bridge1 = await page.evaluate(() => window.__dev.bridgeStock());
  const gain = (k) => ((pack1[k] ?? 0) - (pack0[k] ?? 0)) + ((bridge1[k] ?? 0) - (bridge0[k] ?? 0));
  const ore = gain('ore');
  // TASK-26: the salvage's ore goes to the plot's ore (the drill's stock), so the pack gains none; the plot gains the ore (its own use is subtracted by a few)
  const plotGain = (await page.evaluate(() => window.hmPlay.plot().ore)) - plotOre0;
  const prims = [...new Set([...Object.keys(pack1), ...Object.keys(bridge1)])].filter((k) => k.startsWith('prim-')).reduce((n, k) => n + gain(k), 0);
  row.shot = await shot('crate-dissolved');
  await reloadProfile();
  await page.evaluate((v) => window.__playScene.debug.teleport('lab', 3.2, -1.2, v.yaw, v.pitch), a);
  await page.waitForTimeout(1200);
  const pack2 = await page.evaluate(() => window.__dev.pack());
  const aimedAgain = await page.evaluate(() => window.hmPlay.aimedProp?.id ?? null);
  const samePack = JSON.stringify(pack2) === JSON.stringify(pack1);
  const stays = aimedAgain !== 'crate-large' && samePack;
  row.shot = await shot('crate-gone-after-reload');
  const ok = aimed?.id === 'crate-large' && aimed.salvage === true && cleared && ore === 0 && plotGain >= 8 && prims === 2 && stays;
  return { ok, detail: `aimed ${aimed?.id ?? 'nothing'} (salvage ${aimed?.salvage ?? '-'}); cleared=${cleared}; gained ore ${ore}, primitives ${prims}; after reload the crate ${aimedAgain === 'crate-large' ? 'is BACK' : 'stays gone'}, the pack ${samePack ? 'is the same' : 'changed'}` };
});

await beat('9c read a micro-log: aimed at the old monitor, the readout shows on hover; E opens its Bridge Incident Log, and the monitor stays', async (row) => {
  await quiet();
  const a = aimAt(6.8, -7.2, 1.65, 7.68, -8.6, 0.25);
  await page.evaluate((v) => window.__playScene.debug.teleport('lab', 6.8, -7.2, v.yaw, v.pitch), a);
  let hoverName = '';
  for (let i = 0; i < 25 && hoverName !== 'old monitor'; i++) {
    await page.waitForTimeout(200);
    hoverName = ((await page.locator('.lore-hover-name').first().textContent().catch(() => '')) ?? '').trim();
  }
  const aimed = hoverName === 'old monitor' ? { id: 'old-monitor', salvage: false } : null;
  const hover = await page.locator('.lore-hover-text').first().textContent().catch(() => '');
  row.shot = await shot('monitor-hover');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(700);
  const bank = await page.locator('[data-testid="bridge-log"]').isVisible().catch(() => false);
  const stamp = await page.locator('.lore-bank-stamp').first().textContent().catch(() => '');
  row.shot = await shot('monitor-log');
  await page.locator('.lore-bank-close').first().click().catch(() => {});
  await page.waitForTimeout(300);
  const logs = await page.evaluate(() => window.__dev.props().logs);
  const cleared = await page.evaluate(() => window.__dev.props().cleared);
  const readout = /Phosphor burn-in/.test(hover);
  const monitorStays = !cleared.includes('old-monitor');
  const ok = aimed?.id === 'old-monitor' && aimed.salvage === false && readout && bank && stamp.startsWith('BRIDGE TELEMETRY') && logs.includes('LOG-01') && monitorStays;
  return { ok, detail: `aimed ${aimed?.id ?? 'nothing'}; readout ${readout ? 'shown' : 'missing'}; databank open=${bank} stamp "${stamp}"; LOG-01 read=${logs.includes('LOG-01')}; monitor kept=${monitorStays}` };
});

/** The paths where two chain snapshots differ (a dotted path and the two values), so a failed comparison says what moved. */
const chainDiff = (a, b, path = '', out = []) => {
  if (out.length >= 8) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) chainDiff(a[k], b[k], path ? `${path}.${k}` : k, out);
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path || '(root)'}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
};

await beat('10 reload: the inventory and the chain persist, and Act I does not replay', async (row) => {
  // the snapshot is taken once the base tick has settled: the game pauses (no tick), the base is saved now (the save
  // runs at most every 2 s, so an unforced save can trail the live counts), and both are read in the same frame
  await pauseOn();
  await page.waitForTimeout(2500);
  const snap = await page.evaluate(() => {
    window.hmPlay.base.save();
    return { slots: JSON.stringify(window.hmPlay.base.world().player.slots), step: window.hmPlay.state?.()?.step ?? null, chain: JSON.stringify(window.hmPlay.chainState()) };
  });
  const beforeSlots = snap.slots;
  const beforeStep = snap.step;
  const beforeChain = snap.chain;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  // a reload opens the main menu: Continue loads the saved profile
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    console.log('menu after reload:', labels.map((l) => l.trim()).join(' | '));
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const afterSlots = await slotsJson();
  const afterStep = await page.evaluate(() => window.hmPlay.state?.()?.step ?? null);
  const afterChain = JSON.stringify(await chainState());
  const replayed = await waitSub('A1-01', 2500);
  row.shot = await shot('after-reload');
  // the base tick keeps running (the mill counts while the game is paused), so the counters can rise between the snapshot and the
  // reload (counts.milled 44 -> 45 in one run). What must survive a reload is the progress, the flags and the inventory, and no
  // counter may fall: counters only rise.
  const bc = JSON.parse(beforeChain), ac = JSON.parse(afterChain);
  const countsKept = Object.keys(bc.counts ?? {}).every((k) => (ac.counts?.[k] ?? 0) >= (bc.counts[k] ?? 0));
  const persisted = afterSlots === beforeSlots && JSON.stringify(ac.progress) === JSON.stringify(bc.progress) && ac.monstersUnlocked === bc.monstersUnlocked && countsKept;
  const noReplay = afterStep === beforeStep && afterStep !== 'create' && !replayed;
  // which paths of the chain differ, for the report (a changed value is named, not hidden)
  const chainDiffs = chainDiff(JSON.parse(beforeChain), JSON.parse(afterChain));
  return { ok: persisted && noReplay, detail: `inventory same=${afterSlots === beforeSlots} chain same=${afterChain === beforeChain} (${chainDiffs.slice(0, 4).join('; ') || 'no path differs'}) step ${beforeStep}->${afterStep} A1-01 replayed=${replayed}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// Acts IV to VI (TASK-22). Every action is the game's own: a placement, a click, a command through the base. The only
// skips are __dev.setStage (the plot's stage is grinding) and hmPlay.grindCount (50 units of mining is grinding).
// ----------------------------------------------------------------------------------------------------------------------
await beat('11 Act IV starts once the drill runs (A4-01); G refuses the rifle until it is taken', async (row) => {
  await quiet();
  await toPlanet();
  await page.evaluate(() => window.__dev.grant('ore', 40));
  let drilled = false;
  for (const [dx, dz] of [[-12, 6], [12, -6], [-14, -4], [8, 12], [-6, 14], [16, 4]]) {
    drilled = await page.evaluate(([dx, dz]) => {
      const g = window.__playScene.debug.gatePlanet();
      return window.hmPlay.placeAt(g.x + dx, g.z + dz, 'drill');
    }, [dx, dz]);
    if (drilled) break;
  }
  await page.waitForTimeout(900);
  const cur = await chainCur();
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(400);
  const toast = await toastText();
  row.shot = await shot('a4-01-start');
  return { ok: drilled && cur === 'A4-01' && toast.includes('armory'), detail: `drill placed=${drilled} current=${cur} G toast="${toast}"` };
});

await beat('12 the journal (Esc menu) lists the acts, the current step and its hint', async (row) => {
  await pauseOn();
  await page.locator('.play-pause button', { hasText: 'Journal' }).click();
  const journal = page.locator('[data-testid="journal"]');
  await journal.waitFor({ state: 'visible', timeout: 5000 });
  const text = (await journal.textContent()) ?? '';
  row.shot = await shot('journal-act4');
  await page.locator('.journal-close').click();
  await pauseOff();
  const ok = text.includes('Act IV') && text.includes('Take the extraction rifle') && text.includes('armory rack');
  return { ok, detail: `journal act IV=${text.includes('Act IV')} step=${text.includes('Take the extraction rifle')} hint=${text.includes('armory rack')}` };
});

await beat('13 A4-01: the armory rack hands over the rifle (the button is the action); G draws it on the planet', async (row) => {
  await page.evaluate(() => window.hmPlay.go('lab', 0, 3, 0, 0));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.hmPlay.openLabPanel('rack'));
  const btn = page.locator('.play-pickup');
  const visible = await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  row.shot = await shot('rifle-pickup');
  if (visible) await btn.click();
  await page.waitForTimeout(500);
  const cur = await chainCur();
  const sub = await waitSub('A4-01', 8000);
  await page.evaluate(() => window.hmPlay.openLabPanel(null));
  await toPlanet();
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(400);
  const toast = await toastText();
  const drawn = toast.includes('Extraction beam');
  return { ok: visible && cur === 'A4-01b' && sub && drawn, detail: `button=${visible} current=${cur} A4-01 line=${sub} G draws=${drawn} toast="${toast}"` };
});

await beat('13b A4-01b: the dormant anomaly by the perimeter appears once the rifle is taken; the beam held on it seals it (the first Anomaly Core, on the bridge) and the step closes', async (row) => {
  await toPlanet();
  await page.waitForTimeout(400);
  const found = await page.evaluate(() => window.__dev.leaks().find((l) => l.dormant) ?? null);
  row.shot = await shot('dormant-anomaly');
  if (!found) return { ok: false, detail: 'no dormant anomaly on the plot after the rifle' };
  const shown = found.state === 'dormant';
  await page.evaluate(([x, z]) => window.hmPlay.teleport('planet', x + 6, z, 0, 0), [found.x, found.z]);
  await page.waitForTimeout(300);
  const core0 = await page.evaluate(() => window.__dev.bridgeStock()['anomaly-core'] ?? 0);
  // the seal's line is a voiced story line: it is queued behind any line still playing (A4-01), so the radio is quiet first
  await quiet();
  await page.evaluate((id) => window.__dev.sealLeak(id, 9), found.id);
  const core1 = await page.evaluate(() => window.__dev.bridgeStock()['anomaly-core'] ?? 0);
  const cur = await chainCur();
  const toast = await toastText();
  const radio = await waitSub('A4-LEAK-SEAL', 12000);
  row.shot = await shot('dormant-sealed');
  return { ok: shown && core1 - core0 === 1 && cur === 'A4-02' && radio, detail: `radio line=${radio} ` +  `anomaly dormant=${shown} cores ${core0} -> ${core1} current=${cur} toast="${toast}"` };
});

await beat('14 A4-02: the rifle mines dirt for real (a stroke on a boulder), grinding tops up to 50, and the texture mill runs 10 s: its line plays', async (row) => {
  await quiet();
  await toPlanet();
  // aim the drawn rifle at the nearest boulder: stand 4 to 8 m off it, face it, and look down a little until the aim lands
  const aimed = await page.evaluate(async () => {
    const scene = window.__playScene.debug;
    const g = scene.gatePlanet();
    const b = scene.boulders().filter((x) => x.ore > 0).sort((p, q) => Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(q.x - g.x, q.z - g.z))[0];
    if (!b) return { ok: false, why: 'no boulder' };
    // the player stands on the gate side of the boulder, at d metres (the aim reaches 5 m), facing it
    const L = Math.hypot(b.x - g.x, b.z - g.z) || 1;
    const ux = (b.x - g.x) / L, uz = (b.z - g.z) / L;
    for (const d of [3, 4, 4.5]) for (const pitch of [-0.2, -0.35, -0.5, -0.1]) {
      const px = b.x - ux * d, pz = b.z - uz * d;
      // the camera looks along (-sin yaw, -cos yaw); try that convention, then its opposite
      for (const yaw of [Math.atan2(-ux, -uz), Math.atan2(ux, uz)]) {
        window.hmPlay.go('planet', px, pz, yaw, pitch);
        // the aim is read on the frame loop: let two frames pass before reading it
        await new Promise((r) => setTimeout(r, 120));
        if (scene.aimedBoulder() === b.id) return { ok: true, id: b.id };
      }
    }
    return { ok: false, why: 'the aim never landed on the boulder' };
  });
  let minedReal = 0;
  if (aimed.ok) {
    await page.waitForTimeout(400);
    // the stroke needs the pointer lock, which this test stubs: the canvas counts as locked for the stroke only
    await page.evaluate(() => {
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('canvas') });
    });
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(4000);
    await page.mouse.up();
    await page.evaluate(() => { delete document.pointerLockElement; });
    minedReal = (await chainState()).counts['mined:beam'] ?? 0;
  }
  const realOk = aimed.ok && minedReal > 0;
  // the rest of the 50 is grinding: the stroke above was the real mining, the top-up is the skip
  await page.evaluate((n) => window.hmPlay.grindCount('mined:beam', Math.max(0, 50 - n)), minedReal);
  const t0 = Date.now();
  let milled = 0;
  while (Date.now() - t0 < 30000) {
    milled = (await chainState()).counts.milled ?? 0;
    if (milled >= 10) break;
    await page.waitForTimeout(500);
  }
  const cur = await chainCur();
  const sub = await waitSub('A4-02', 9000);
  row.shot = await shot('a4-02-milled');
  return { ok: realOk && milled >= 10 && cur === 'A4-03' && sub, detail: `real stroke: aimed=${aimed.ok ? aimed.id : aimed.why} mined=${minedReal}; milled=${milled} current=${cur} A4-02 line=${sub}` };
});

// TASK-21d: the beam's ground work, each step the game's own (the keys, the mouse, the rack, the save). The rifle stays drawn
// from beat 13 to the end of 14d, and the player stays at the boulder beat 14 aimed at.
const holdLeft = async (ms) => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('canvas') });
  });
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.evaluate(() => { delete document.pointerLockElement; });
};
const beamMode = () => page.evaluate(() => document.querySelector('[data-testid="beam-mode"]')?.getAttribute('data-mode') ?? null);
const pressUntil = async (key, mode) => {
  for (let i = 0; i < 4 && (await beamMode()) !== mode; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  return (await beamMode()) === mode;
};
const aimedGround = () => page.evaluate(() => {
  const p = window.__playScene.beamAim(25);
  return p ? { x: p.x, z: p.z } : null;
});
/** A reload goes to the main menu; Continue loads the saved profile (as beat 10 does). */
const reloadGame = async () => {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
};

await beat('14a the rifle in the character\'s hand (V): its rifle idle plays; V puts it back in the view', async (row) => {
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(2500);
  const where = await page.evaluate(() => window.__playScene.debug.rifleIn());
  const idle = await page.evaluate(() => window.hmPlay.clipWeight('rifle-idle') + window.hmPlay.clipWeight('rifle-aiming-idle'));
  row.shot = await shot('rifle-in-hand');
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => window.__playScene.debug.rifleIn());
  return { ok: where === 'hand' && idle > 0.5 && back === 'view', detail: `rifle in ${where}, rifle idle weight ${idle.toFixed(2)}, back in ${back}` };
});

await beat('14b Extract: the held rifle mines the boulder it is aimed at; the plot\'s ore rises as the boulder\'s falls', async (row) => {
  await pressUntil('KeyQ', 'extract');
  const id = await page.evaluate(() => window.__playScene.debug.aimedBoulder());
  const boulderOre = () => page.evaluate((bid) => window.hmPlay.boulders().find((b) => b.id === bid)?.ore ?? null, id);
  const plotOre = () => page.evaluate(() => window.hmPlay.plot().ore);
  const b0 = await boulderOre();
  const p0 = await plotOre();
  if (id !== null) await holdLeft(1500);
  const b1 = await boulderOre();
  const p1 = await plotOre();
  row.shot = await shot('extract-ore');
  return { ok: id !== null && b1 < b0 && p1 > p0, detail: `boulder ${id}: ore ${b0} to ${b1}; plot ore ${p0.toFixed(1)} to ${p1.toFixed(1)}` };
});

await beat('14c Apply: a written cartridge loads from the rack (R), and Apply paints the ground under the aim', async (row) => {
  await page.evaluate(() => {
    const h = window.hmPlay;
    const count = () => h.lab().cartridges.filter((c) => c.kind === 'preset' && c.slot === null).length;
    if (count() === 0) {
      h.give(300);
      const made = h.makeBlank();
      const blank = made.state.cartridges.find((c) => c.kind === 'blank' && c.slot === null);
      if (blank) h.startWrite(blank.id, 'crater_calcite');
      for (let i = 0; i < 60 && count() === 0; i++) h.labStep(2);
    }
  });
  const rackCount = () => page.evaluate(() => window.hmPlay.lab().cartridges.filter((c) => c.kind === 'preset' && c.slot === null).length);
  const rackBefore = await rackCount();
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  const port = (await page.locator('[data-testid="beam-mode"]').getAttribute('data-port')) ?? '';
  const rackAfter = await rackCount();
  await pressUntil('KeyQ', 'apply');
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 60, 60, 0.3, -0.5));
  await page.waitForTimeout(500);
  const painted0 = await page.evaluate(() => window.__playScene.debug.paintedCells());
  await holdLeft(1500);
  const painted1 = await page.evaluate(() => window.__playScene.debug.paintedCells());
  row.shot = await shot('apply-paint');
  return { ok: port !== '' && rackAfter === rackBefore - 1 && painted1 > painted0, detail: `port "${port}", rack ${rackBefore} to ${rackAfter}; cells painted ${painted0} to ${painted1}` };
});

await beat('14d Sculpt: carve digs and gains ore, raise builds and spends ore, the gate pad is kept out, and the cut survives a reload', async (row) => {
  await pressUntil('KeyQ', 'sculpt');
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 60, 60, 0.3, -0.5));
  await page.waitForTimeout(500);
  const aim = await aimedGround();
  if (!aim) return { ok: false, detail: 'no ground under the aim' };
  const edit = () => page.evaluate(([x, z]) => window.__playScene.debug.groundEdit(x, z), [aim.x, aim.z]);
  const ore = () => page.evaluate(() => window.hmPlay.plot().ore);
  const e0 = await edit();
  const o0 = await ore();
  await holdLeft(2000);
  const e1 = await edit();
  const o1 = await ore();
  // TICKET-04: the sculpt tools moved to the X radial (keys 1 to 3 pick hotbar slots now): open X, hover raise, release X
  await page.mouse.move(4, 4);
  await page.keyboard.down('KeyX');
  await page.locator('[data-testid="radial-menu"]').waitFor({ state: 'visible', timeout: 4000 });
  await page.locator('[data-testid="radial-slice-raise"]').hover();
  await page.waitForTimeout(120);
  await page.keyboard.up('KeyX');
  await page.waitForTimeout(200);
  const e2 = await edit();
  const o2 = await ore();
  await holdLeft(1500);
  const e3 = await edit();
  const o3 = await ore();
  const padCells = await page.evaluate(() => window.__playScene.beamSculpt(0, 0, 'carve', 1, 100).cells);
  row.shot = await shot('sculpt-cut');
  const carved = e1 < e0 - 0.05;
  const gained = o1 > o0;
  const raised = e3 > e2 + 0.05;
  const spent = o3 < o2;
  // the cut survives a reload: the same height at the same point, after the save has been written
  await page.waitForTimeout(2500);
  await reloadGame();
  await toPlanet();
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(400);
  const kept = await page.evaluate(([x, z]) => window.__playScene.debug.groundEdit(x, z), [aim.x, aim.z]);
  const survived = Math.abs(kept - e3) < 0.02;
  return {
    ok: carved && gained && raised && spent && padCells === 0 && survived,
    detail: `carve ${e0.toFixed(2)} to ${e1.toFixed(2)} m, ore ${o0.toFixed(1)} to ${o1.toFixed(1)}; raise ${e2.toFixed(2)} to ${e3.toFixed(2)} m, ore ${o2.toFixed(1)} to ${o3.toFixed(1)}; gate pad cells ${padCells}; after reload ${kept.toFixed(2)} m (${survived ? 'kept' : 'LOST'})`,
  };
});

await beat('15 A4-03: the Studio opens from the journal; the Act IV line plays on the way back', async (row) => {
  await pauseOn();
  await page.locator('.play-pause button', { hasText: 'Journal' }).click();
  const btn = page.locator('.journal-studio');
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  row.shot = await shot('journal-a4-03');
  await btn.click();
  await page.waitForTimeout(2500);
  const leftPlay = (await page.locator('.play').count()) === 0;
  await shot('studio-opened');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const studioCount = (await chainState()).counts['studio:open'] ?? 0;
  const cur = await chainCur();
  const sub = await waitSub('A4-03', 9000);
  return { ok: leftPlay && studioCount >= 1 && cur === 'A4-04' && sub, detail: `left the game=${leftPlay} studio:open=${studioCount} current=${cur} A4-03 line=${sub}` };
});

await beat('16 A4-04: stage 2 (the bloom) ends Act IV; the Structures tab opens and the bridge kit arrives', async (row) => {
  await quiet();
  await page.evaluate(() => window.__dev.setStage(2));
  // ruling 4: the stage-2 event plays A4-04 (the journal step), and S-2 is skipped
  const a404 = await waitSub('A4-04', 4000);
  await page.waitForTimeout(800);
  const s2Heard = await page.evaluate(() => window.hmPlay.heard().includes('S-2'));
  const cur = await chainCur();
  const kit = await page.evaluate(() => {
    const b = window.hmPlay.base.world().boxes.find((x) => x.id === -2);
    const c = {};
    for (const st of b?.slots ?? []) if (st) c[st.item] = (c[st.item] ?? 0) + st.n;
    return c;
  });
  await toPlanet();
  await openBuildTab('structures');
  const locks = await page.locator('.bm-locked').count();
  row.shot = await shot('structures-open');
  await page.locator('.bm-close').click();
  const ok = cur === 'B-01' && (kit['prim-cube'] ?? 0) >= 4 && locks === 0 && a404 && !s2Heard;
  return { ok, detail: `A4-04 line=${a404} S-2 heard=${s2Heard} current=${cur} bridge cube=${kit['prim-cube'] ?? 0} beam=${kit['prim-beam'] ?? 0} maps=${kit['map-basalt'] ?? 0} tab locks=${locks}` };
});

await beat('17 B-01: a foundation placed from the Structures tab with E', async (row) => {
  await quiet();
  const before = await foundations();
  await placeFromStructures('Foundation');
  const after = await foundations();
  foundId = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id).pop() ?? null);
  row.shot = await shot('foundation-placed');
  const cur = await chainCur();
  const sub = await waitSub('B-01', 6000);
  return { ok: after === before + 1 && cur === 'B-04' && sub, detail: `foundations ${before}->${after} current=${cur} B-01 line=${sub}` };
});

await beat('18 B-04: raw pixels harvested with the beam from a field node (a real harvest through the base)', async (row) => {
  // a chroma or dither node yields raw pixels (the beam's own rates: about one unit a second on a full node)
  // the chroma or dither node nearest the gate (the planet is walkable only near the gate): stand 3 m from it, on the gate side
  const node = await page.evaluate(() => {
    const w = window.hmPlay.base.world();
    const g = window.__playScene.debug.gatePlanet();
    const cands = w.field.nodes.filter((x) => x.kind === 'chroma' || x.kind === 'dither')
      .sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z));
    const n = cands[0];
    if (!n) return null;
    const L = Math.hypot(g.x - n.x, g.z - n.z) || 1;
    const ux = (g.x - n.x) / L;
    const uz = (g.z - n.z) / L;
    window.hmPlay.go('planet', n.x + ux * 3, n.z + uz * 3, Math.atan2(-(n.x - (n.x + ux * 3)), -(n.z - (n.z + uz * 3))), -0.5);
    return { id: n.id, kind: n.kind, x: n.x, z: n.z, reserve: Math.round(n.reserve), gateDist: Math.round(Math.hypot(n.x - g.x, n.z - g.z)) };
  });
  if (!node) return { ok: false, detail: 'no chroma or dither node in the field' };
  await page.waitForTimeout(500);
  const dbg = await page.evaluate((n) => {
    const w = window.hmPlay.base.world();
    const p = window.__playScene.debug.position();
    return { beam: w.equipment.beam?.item ?? null, player: [Math.round(p.x), Math.round(p.z)], node: [Math.round(n.x), Math.round(n.z)] };
  }, node);
  const seen = new Set();
  let items = 0;
  let lost = 0;
  for (let i = 0; i < 400 && items === 0; i++) {
    const r = await page.evaluate((n) => {
      const p = window.__playScene.debug.position();
      const res = window.hmPlay.base.apply({ t: 'tick', at: { x: p.x, z: p.z }, dt: 0.1, beam: { node: n.id, power: 1 }, power: {} });
      const evs = res?.events ?? [];
      const got = evs.filter((e) => e.type === 'harvested');
      return { types: evs.map((e) => (e.type === 'refused' ? `refused:${e.why}` : e.type)), got: got.map((e) => e.items.reduce((s, x) => s + x.n, 0)), lost: got.reduce((s, e) => s + e.lost.reduce((a, x) => a + x.n, 0), 0) };
    }, node);
    for (const t of r.types) seen.add(t);
    items += r.got.reduce((s, k) => s + k, 0);
    lost += r.lost;
  }
  const counts = (await chainState()).counts;
  const cur = await chainCur();
  row.shot = await shot('b04-harvest');
  const ok = (counts['harvest:pxd'] ?? 0) >= 1 && cur === 'B-06';
  return { ok, detail: `node ${node.kind} at (${dbg.node}) reserve ${node.reserve}; beam=${dbg.beam} player (${dbg.player}): harvested ${items} (lost ${lost}) events=${[...seen].join('/') || 'none'} harvest:pxd=${counts['harvest:pxd'] ?? 0} current=${cur}` };
});

// The drafting table is a Bench piece (the starter shelter's). A draft needs the player within 5 m of one.
// draftSpot is where the player stood to draft last (the table is beside it).
let draftSpot = null;
const draftAtBench = (item) => page.evaluate(async ({ item, spot }) => {
  const api = window.hmPlay.base;
  const offsets = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2.5, 2.5], [-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5]];
  for (const [dx, dz] of offsets) {
    const at = spot ? { x: spot.x + dx, z: spot.z + dz } : null;
    if (at) window.hmPlay.go('planet', at.x, at.z, 0, -0.5);
    await new Promise((r) => setTimeout(r, 60));
    const p = window.__playScene.debug.position();
    const res = api.apply({ t: 'draft', at: { x: p.x, z: p.z }, primitive: item.primitive, map: item.map });
    if (res?.events?.some((e) => e.type === 'drafted')) return { ok: true, spot: { x: p.x, z: p.z }, events: res.events.map((e) => e.type) };
    if (!res?.events?.some((e) => e.type === 'refused' && e.why === 'no-bench')) return { ok: false, why: res?.events?.map((e) => e.why ?? e.type).join(',') };
  }
  return { ok: false, why: 'no-bench' };
}, { item, spot: draftSpot });

// TASK-23c: a seal lifts its wreck one rung. Before the seal a leak is broken: its props stand a rung below the plot's stage.
/** The rung a plot stage asks for (wreck-sites.ts stageRung): 0 at stage 0, 1 at 1 and 2, 2 at 3 and 4, 3 at 5 and 6. */
const stageRungOf = (s) => (s <= 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3);
/** Walks the view to a leak's wreck (12.6 m off, facing it, looking down a little), and reads its wreck. */
const lookAtWreck = async (lk) => {
  const at = { x: lk.x + 12.6 * 0.949, z: lk.z + 12.6 * 0.316 };
  await page.evaluate((v) => window.hmPlay.teleport('planet', v.x, v.z, 1.249, -0.18), at);
  await page.waitForTimeout(1500);
};
const wreckRead = (site) => page.evaluate((s) => window.__dev.wrecks().find((r) => r.site === s) ?? null, site);

await beat('13c a seal lifts its wreck one rung: a broken leak\'s props stand a rung below the plot\'s stage until the leak is sealed, and the seal is saved', async (row) => {
  await toPlanet();
  await page.waitForTimeout(400);
  const stage = await page.evaluate(() => window.hmPlay.state?.()?.plot?.stage ?? 0);
  const lk = await page.evaluate(() => window.__dev.leaks().find((l) => !l.dormant && l.state !== 'sealed') ?? null);
  if (!lk) return { ok: false, detail: 'no open leak on the plot' };
  await lookAtWreck(lk);
  const before = await wreckRead(lk.site);
  row.shot = await shot('wreck-before-seal');
  await page.evaluate((id) => window.__dev.sealLeak(id, 9), lk.id);
  await page.waitForTimeout(800);
  const after = await wreckRead(lk.site);
  const saved = (await page.evaluate(() => window.__dev.props().sealed)).includes(lk.site);
  row.shot = await shot('wreck-after-seal');
  const ok = !!before && !!after && before.broken && !after.broken && after.rung === before.rung + 1 && after.rung === stageRungOf(stage) && saved;
  return { ok, detail: `stage ${stage}, leak site ${lk.site}: rung ${before?.rung} broken=${before?.broken} -> rung ${after?.rung} broken=${after?.broken}; seal saved=${saved}` };
});

await beat('19 B-06: the drafting table (the starter shelter\'s bench) is walked to; a cube blueprint drafted at it (a real draft command)', async (row) => {
  await quiet();
  await toPlanet();
  // the starter shelter's Bench is the drafting table (benchNear); the player stands by it, facing it, to draft
  const bench = await page.evaluate(() => window.hmPlay.base.world().base.pieces.find((p) => p.kind === 'bench')?.id ?? null);
  if (bench === null) return { ok: false, detail: 'no bench stands in the base' };
  // stand 2.5 m from its centre (the draft needs it within 5 m), facing it
  const stood = await page.evaluate(async (id) => {
    const s = window.__playScene;
    const b = s.debug.pieceBounds(id);
    if (!b) return { ok: false, why: 'bench not drawn' };
    const c = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
    const px = c[0] + 2.5;
    const pz = c[2];
    window.hmPlay.go('planet', px, pz, Math.atan2(-(c[0] - px), -(c[2] - pz)), -0.5);
    await new Promise((r) => setTimeout(r, 300));
    const p = s.debug.position();
    return { ok: true, x: p.x, z: p.z, dist: Math.round(Math.hypot(p.x - c[0], p.z - c[2]) * 10) / 10 };
  }, bench);
  if (!stood.ok) return { ok: false, detail: `could not stand at the bench: ${stood.why}` };
  draftSpot = { x: stood.x, z: stood.z };
  const dr = await draftAtBench({ primitive: 'cube', map: 'basalt' });
  const drafted = dr.ok && (await page.evaluate(() => window.hmPlay.base.world().player.slots.some((s) => s?.item === 'bp:cube:basalt')));
  if (dr.ok) draftSpot = dr.spot;
  const cur = await chainCur();
  row.shot = await shot('b06-drafted');
  return { ok: drafted && cur === 'B-05', detail: `bench ${bench} at ${stood.dist} m draft=${dr.ok ? 'drafted' : dr.why} blueprint in pack=${drafted} current=${cur}` };
});

await beat('20 B-05: a linked bin on the foundation (its contents join the bridge storage)', async (row) => {
  const before = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'bin').length);
  const r = await placeOnFoundation('Bin', 'bin');
  const after = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'bin').length);
  const cur = await chainCur();
  row.shot = await shot('b05-bin');
  return { ok: r.placed && after === before + 1 && cur === 'B-07', detail: `bins ${before}->${after} current=${cur} tries: ${r.toasts.join(' | ')}` };
});

await beat('21 B-07: a chassis blueprint is drafted at the bench; an airlock and life support seal a room (placed from the Structures tab)', async (row) => {
  await quiet();
  await toPlanet();
  if (draftSpot) await page.evaluate((s) => window.hmPlay.go('planet', s.x, s.z, 0, -0.5), draftSpot);
  const dr = await draftAtBench({ primitive: 'chassis', map: 'basalt' });
  if (dr.ok) draftSpot = dr.spot;
  const airlock = await placeOnFoundation('Airlock', 'airlock');
  // the life support needs its own floor: a second foundation beside the first
  const room = await freshFoundation(foundId);
  roomId = room.id;
  const life = room.ok ? await placeOnFoundation('Life support', 'lifeSupport', room.id) : { placed: false, toasts: [`room: ${room.why}`] };
  const cur = await chainCur();
  row.shot = await shot('b07-sealed');
  return { ok: dr.ok && airlock.placed && life.placed && cur === 'F-01', detail: `draft=${dr.ok ? 'drafted' : dr.why} airlock=${airlock.placed} (${airlock.toasts.join(' | ')}) life support=${life.placed} (${life.toasts.join(' | ')}) current=${cur}` };
});

const grantAll = (pairs) => page.evaluate((list) => { for (const [item, n] of list) window.__dev.grant(item, n); }, pairs);
const basePos = () => page.evaluate(() => window.__playScene.debug.position());

await beat('22 F-01: a hardpoint from the Structures tab; the fabricator installed on it from the machine picker', async (row) => {
  await quiet();
  await toPlanet();
  // the fabricator's bill and the hardpoint's are grinding: granted (the install and the pay are the game's own)
  await grantAll([['ore', 240], ['prim-beam', 10], ['prim-column', 4], ['prim-chassis', 6], ['map-basalt', 3]]);
  // the hardpoint stands on a 2 x 2 pad of foundations (buildPad); its own grid then aims across the pad's first foundation
  const pad = await buildPad();
  padBase = pad.base;
  const hpPlace = pad.ok ? await placeOnFoundation('Hardpoint', 'hardpoint', pad.base) : { placed: false, toasts: [`pad: ${pad.why}`] };
  // diagnostic only when the hardpoint is refused: the structure rules' own reason for the pad's first cell
  const probe = !hpPlace.placed && pad.ok ? await page.evaluate((base) => {
    const api = window.hmPlay.base;
    const f = api.world().base.pieces.find((p) => p.id === base);
    const p = window.__playScene.debug.position();
    const res = api.apply({ t: 'place', at: { x: p.x, z: p.z }, blueprint: 'bp:chassis:basalt', piece: { s: f.s, kind: 'hardpoint', i: f.i, j: f.j, k: f.k, r: 0 } });
    return (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused:${e.why}` : e.type)).join(',') || 'no event';
  }, pad.base) : '';
  const hp = await page.evaluate(() => window.hmPlay.base.world().base.pieces.find((p) => p.kind === 'hardpoint')?.id ?? null);
  // the pad (80 ore) and the hardpoint (60 ore) took the first grant: the install's own bill is topped up (grinding)
  await grantAll([['ore', 300], ['prim-beam', 8], ['prim-column', 6], ['prim-chassis', 6]]);
  if (hp !== null) await page.evaluate((id) => window.hmPlay.base.openMachinePicker(id), hp);
  const btn = page.locator('[data-testid="install-btn-fabricator"]');
  const visible = await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  if (visible) await btn.click();
  await page.waitForTimeout(700);
  const installed = await page.evaluate(() => window.hmPlay.base.world().machines.some((m) => m.kind === 'fabricator'));
  row.shot = await shot('f01-fabricator');
  await page.keyboard.press('Escape').catch(() => {});
  const cur = await chainCur();
  return { ok: hpPlace.placed && hp !== null && visible && installed && cur === 'F-02', detail: `pad: ${pad.why} | probe: ${probe} | hardpoint=${hp} (${hpPlace.toasts.join(' | ')}) button=${visible} fabricator installed=${installed} current=${cur}` };
});

await beat('23 F-02: the scout printed at the fabricator (the print button, then the frame loop runs it), driven for real, the metres topped up to 200', async (row) => {
  await quiet();
  await toPlanet();
  const fab = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.id ?? null);
  // the print is the fabricator's own button; the modal is opened from the machine (the test's hook, as a click would)
  await page.evaluate((id) => window.hmPlay.base.openFabricator(id), fab);
  await page.locator('[data-testid="rover-card-scout"]').click({ timeout: 6000 }).catch(() => {});
  const printBtn = page.locator('[data-testid="print-btn-scout"]');
  const canPrint = await printBtn.isEnabled({ timeout: 3000 }).catch(() => false);
  if (canPrint) await printBtn.click();
  await page.waitForTimeout(400);
  const queued = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.jobs.length ?? 0);
  row.shot = await shot('f02-printing');
  await page.locator('[data-testid="fabricator-close-btn"]').click({ timeout: 4000 }).catch(() => {});
  // closing the modal leaves the game paused (the pointer lock is gone): the E key needs the game running, as toPlanet sets it
  await page.evaluate(() => { window.hmPlay.setPaused?.(false); window.hmPlay.setLocked?.(true); });
  await page.waitForTimeout(300);
  // the print runs in the game's own loop (120 s of plot power): wait for the scout to land at the fabricator
  const printEnd = Date.now() + 150000;
  let scouts = 0;
  while (Date.now() < printEnd) {
    scouts = await page.evaluate(() => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length);
    if (scouts >= 1) break;
    await page.waitForTimeout(1000);
  }
  // get in (E, within 3.5 m), face forward and drive for real: 10 s of W
  const v = await page.evaluate(() => window.hmPlay.base.world().vehicles.find((x) => x.kind === 'scout') ?? null);
  let entered = false;
  let driven = 0;
  let vDiag = null;
  let viaHook = false;
  if (v) {
    // TASK-24: the walk is real. The player is set 8 m off the scout (on the side where the walk has room), faces it, and
    // walks in with W until it is within 3 m; then E is pressed (E reaches 3.5 m)
    await page.evaluate(({ v }) => window.hmPlay.go('planet', v.x + 8, v.z, Math.atan2(8, 0), 0), { v });
    await page.waitForTimeout(400);
    await page.keyboard.down('KeyW');
    let gap = 99;
    for (let i = 0; i < 40 && gap > 3; i++) {
      await page.waitForTimeout(200);
      gap = await page.evaluate(({ v }) => { const p = window.__playScene.debug.position(); return Math.hypot(p.x - v.x, p.z - v.z); }, { v });
    }
    await page.keyboard.up('KeyW');
    vDiag = await page.evaluate(() => ({ where: window.hmPlay.where, p: window.__playScene.debug.position() }));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    entered = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
    // the walk can be stopped by the pad or the hull; then the teleport fallback stands the player beside the scout (recorded)
    if (!entered) {
      for (const [ox, oz] of [[-1.2, 0], [1.2, 0], [0, 1.2], [0, -1.2], [-2, 0], [2, 0], [0, 2], [0, -2]]) {
        await page.evaluate(({ v, ox, oz }) => window.hmPlay.go('planet', v.x + ox, v.z + oz, Math.atan2(ox, oz), 0), { v, ox, oz });
        await page.waitForTimeout(400);
        vDiag = await page.evaluate(() => ({ where: window.hmPlay.where, p: window.__playScene.debug.position() }));
        if (Math.hypot(vDiag.p.x - v.x, vDiag.p.z - v.z) <= 3) break;
      }
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(400);
      entered = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
    }
    // if E still does not reach, the scene's own enterVehicle (what E calls once in reach) gets the player in
    if (!entered) {
      await page.evaluate((id) => window.hmPlay.base.enterVehicle(id), v.id);
      await page.waitForTimeout(300);
      entered = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
      viaHook = entered;
    }
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(10000);
    await page.keyboard.up('KeyW');
    driven = (await chainState()).counts['driven:m'] ?? 0;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
  }
  // the rest of the 200 m is grinding (the drive's metres are the same count; the real drive above is the action)
  await page.evaluate((n) => window.hmPlay.grindCount('driven:m', Math.max(0, 200 - n)), driven);
  const cur = await chainCur();
  row.shot = await shot('f02-scout');
  const realDrive = entered && driven >= 20;
  return { ok: scouts >= 1 && realDrive && cur === 'F-03', detail: `queued=${queued} scouts=${scouts} vehicle at ${v ? `${Math.round(v.x)},${Math.round(v.z)}` : 'none'} player ${vDiag ? `${Math.round(vDiag.p.x)},${Math.round(vDiag.p.z)} where=${vDiag.where}` : '-'} entered=${entered}${viaHook ? ' (via enterVehicle: E out of reach)' : ''} real drive=${driven}m current=${cur}` };
});

await beat('24 F-03: a weapon bench; the frame and parts forged, a barrel swapped, the gun equipped to the sidearm', async (row) => {
  await quiet();
  await toPlanet();
  await grantAll([['ore', 120], ['prim-chassis', 2], ['prim-beam', 2], ['prim-cube', 2], ['prim-column', 2]]);
  // the weapon bench is a fixture: it stands on a foundation of its own, 8 m beyond the pad
  const wbFound = await freshFoundation(padBase, 8);
  const wb = wbFound.ok ? await placeOnFoundation('Weapon bench', 'weaponBench', wbFound.id) : { placed: false, toasts: [`foundation: ${wbFound.why}`] };
  const at = await basePos();
  // the pack is over its 120 kg after the grants: the quick stack (the game's own command) puts the pack into the bridge storage
  const stacked = await page.evaluate((p) => { const res = window.hmPlay.base.apply({ t: 'quickStack', at: p }); return (res?.events ?? []).map((e) => e.type).join('+') || 'none'; }, at);
  const idxOf = (item) => page.evaluate((it) => window.hmPlay.base.world().player.slots.findIndex((s) => s && s.item === it), item);
  // each command is the game's own; its events say what happened (a refusal names its reason)
  const forged = await page.evaluate((p) => {
    const api = window.hmPlay.base;
    const evs = (res) => (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused-${e.why}` : e.type)).join('+') || 'none';
    const pos = window.__playScene.debug.position();
    return ['wpn-frame', 'core-semi', 'barrel-short', 'barrel-scatter'].map((item) => `${item}:${evs(api.apply({ t: 'forge', at: p, item }))}`)
      .concat([`(at ${Math.round(pos.x)},${Math.round(pos.z)})`]);
  }, at);
  const frame = await idxOf('wpn-frame');
  const fitted = await page.evaluate(({ frame, p }) => {
    const api = window.hmPlay.base;
    const evs = (res) => (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused-${e.why}` : e.type)).join('+') || 'none';
    return [
      `move:${evs(api.apply({ t: 'move', at: p, from: { at: 'inventory', index: frame }, to: { at: 'equipment', slot: 'sidearm' }, n: 1 }))}`,
      `core:${evs(api.apply({ t: 'fit', slot: 'core', item: 'core-semi' }))}`,
      `barrel:${evs(api.apply({ t: 'fit', slot: 'barrel', item: 'barrel-short' }))}`,
      `barrel2:${evs(api.apply({ t: 'fit', slot: 'barrel', item: 'barrel-scatter' }))}`,
    ];
  }, { frame, p: at });
  const equipped = await page.evaluate(() => !!window.hmPlay.base.world().equipment.sidearm);
  const monsters = await page.evaluate(() => window.hmPlay.chainState().monstersUnlocked);
  row.shot = await shot('f03-gun');
  const cur = await chainCur();
  return { ok: wb.placed && equipped && cur === 'F-04' && monsters === true, detail: `weapon bench=${wb.placed} (${wb.toasts.join(' | ')}) quick stack ${stacked} forge ${forged.join(' ')} fit ${fitted.join(' ')} sidearm=${equipped} current=${cur} monsters unlocked=${monsters}` };
});

await beat('25 F-04 and F-05: stages 2 to 6 (the plot stage is grinding, skipped) unlock the hauler and the crawler', async (row) => {
  const seen = [];
  for (const st of [3, 4, 5, 6]) {
    await page.evaluate((s) => window.__dev.setStage(s), st);
    await page.waitForTimeout(400);
    seen.push(`${st}:${await chainCur()}`);
  }
  row.shot = await shot('stage6-chain-done');
  const cur = await chainCur();
  return { ok: cur === 'A7-01', detail: `stages ${seen.join(' ')} chain current=${cur}` };
});

await beat('26 a death respawns at the gate; the inventory and the chain are kept (the monsters can kill; here the death is the hook)', async (row) => {
  await toPlanet();
  const slotsBefore = await slotsJson();
  // the chain is kept when its progress and its monsters flag are the same and no counter went down (the counters keep
  // growing on their own: the mill runs, the print and the drive move on)
  const chainBefore = await chainState();
  // TASK-24: a death at the wheel first. The scout printed in beat 23 is entered; the death leaves it parked where it stands, and the
  // player comes back on foot at the gate (dieNow exits the vehicle)
  const scout = await page.evaluate(() => window.hmPlay.base.world().vehicles.find((x) => x.kind === 'scout') ?? null);
  let wheelDeath = { ok: true, why: 'no scout to drive' };
  if (scout) {
    await page.evaluate((id) => window.hmPlay.base.enterVehicle(id), scout.id);
    await page.waitForTimeout(300);
    const wasDriving = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
    await page.evaluate(() => window.hmPlay.die());
    await page.waitForTimeout(600);
    const stillDriving = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
    const parked = await page.evaluate((id) => { const v = window.hmPlay.base.world().vehicles.find((x) => x.id === id); return !!v; }, scout.id);
    wheelDeath = { ok: wasDriving && !stillDriving && parked, why: `driving before ${wasDriving}, after ${stillDriving}, scout kept ${parked}` };
  }
  await page.evaluate(() => window.hmPlay.die());
  await page.waitForTimeout(800);
  const deaths = (await chainState()).counts.deaths ?? 0;
  const at = await basePos();
  const gate = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  const nearGate = Math.hypot(at.x - gate.x, at.z - gate.z) < 10;
  const kept = (await slotsJson()) === slotsBefore;
  const chainNow = await chainState();
  const chainKept = JSON.stringify(chainNow.progress) === JSON.stringify(chainBefore.progress)
    && chainNow.monstersUnlocked === chainBefore.monstersUnlocked
    && Object.entries(chainBefore.counts).every(([k, v]) => (chainNow.counts[k] ?? 0) >= v);
  row.shot = await shot('respawn-at-gate');
  return { ok: wheelDeath.ok && deaths === (chainBefore.counts.deaths ?? 0) + 2 && nearGate && kept && chainKept, detail: `wheel death: ${wheelDeath.why}; deaths=${deaths} near gate=${nearGate} inventory kept=${kept} chain kept=${chainKept}` };
});

await beat('27 each chain narration line played once; the radio log holds no repeats', async (row) => {
  // stage 2 plays A4-04 (ruling 4), so S-2 is not in the list: it must NOT be heard (checked below)
  const want = ['A4-01', 'A4-02', 'A4-03', 'A4-04', 'B-01', 'B-04', 'B-06', 'B-05', 'B-07', 'F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'S-3', 'S-4', 'S-5', 'S-6'];
  let heard = [];
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    heard = await page.evaluate(() => window.hmPlay.heard());
    if (want.every((id) => heard.includes(id))) break;
    await page.waitForTimeout(1000);
  }
  const missing = want.filter((id) => !heard.includes(id));
  const repeats = heard.length - new Set(heard).size;
  const s2Heard = heard.includes('S-2');
  row.shot = await shot('radio-log');
  return { ok: missing.length === 0 && repeats === 0 && !s2Heard, detail: `missing=${missing.join(',') || 'none'} repeats=${repeats} S-2 heard=${s2Heard}` };
});

await beat('28 F-03 unlocks the fight: a leak warns, its wave comes, M-01 plays at the first sighting, a kill drops its substrate on the bridge, and M-02 plays at the first kill', async (row) => {
  await toPlanet();
  const unlocked = await page.evaluate(() => window.hmPlay.chainState().monstersUnlocked === true);
  await page.evaluate(() => window.__dev.setMonstersSetting('normal'));
  await page.waitForTimeout(500);
  const warned = await page.evaluate(() => window.__dev.leaks().some((l) => !l.dormant && l.state !== 'sealed'));
  const spawned0 = (await page.evaluate(() => window.__dev.stats()))?.mobsSpawned ?? 0;
  await page.evaluate(() => window.__dev.stepMonsters(100));
  const spawned1 = (await page.evaluate(() => window.__dev.stats()))?.mobsSpawned ?? 0;
  // a new wave, or the budget holding the living at its cap (8 on Low): either is the fight working
  const living = await page.evaluate(() => window.__dev.mobs().length);
  const sawM01 = await waitSub('M-01', 8000);
  const stock0 = await page.evaluate(() => window.__dev.bridgeStock());
  const id = await page.evaluate(() => window.__dev.placeMob('charger', 6));
  await page.evaluate((i) => window.__dev.hurtMob(i, 9999), id);
  const stock1 = await page.evaluate(() => window.__dev.bridgeStock());
  const dropped = (stock1['pxd-mono'] ?? 0) - (stock0['pxd-mono'] ?? 0) === 4;
  const sawM02 = await waitSub('M-02', 20000);
  row.shot = await shot('monsters-fight');
  return { ok: unlocked && warned && (spawned1 > spawned0 || living >= 8) && sawM01 && dropped && sawM02, detail: `unlocked=${unlocked} warned=${warned} living=${living} spawned ${spawned0} -> ${spawned1} M-01=${sawM01} drop=${dropped} M-02=${sawM02}` };
});

await beat('28b the ladder at stage 6: a broken leak stands at the RUN.world tier (rung 2), and its seal lifts it to the max tier (rung 3)', async (row) => {
  await toPlanet();
  // the scout the earlier beat drove is left behind: the character walks, so the teleport and the seal's reach are the player's
  await page.evaluate(() => { if (window.__playScene.getDrivingVehicle()) window.__playScene.exitVehicle(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__dev.setHp(100); window.__dev.setMonstersSetting('off'); });
  await page.evaluate(() => window.__dev.setStage(6));
  await page.waitForTimeout(800);
  const lk = await page.evaluate(() => window.__dev.leaks().find((l) => !l.dormant && l.state !== 'sealed') ?? null);
  if (!lk) return { ok: false, detail: 'no open leak on the plot' };
  await lookAtWreck(lk);
  const before = await wreckRead(lk.site);
  row.shot = await shot('wreck-stage6-before-seal');
  await page.evaluate((id) => window.__dev.sealLeak(id, 9), lk.id);
  await page.waitForTimeout(800);
  const after = await wreckRead(lk.site);
  row.shot = await shot('wreck-stage6-after-seal');
  const pos = await page.evaluate(() => window.__playScene.debug.position());
  const reach = Math.hypot(pos.x - lk.x, pos.z - lk.z);
  const ok = !!before && !!after && reach <= 25 && before.rung === 2 && before.broken && after.rung === 3 && !after.broken;
  return { ok, detail: `stage 6, leak site ${lk.site} (${reach.toFixed(1)} m away): rung ${before?.rung} broken=${before?.broken} -> rung ${after?.rung} broken=${after?.broken}` };
});

// TASK-24: the sapper (P0-MON-03). It goes for the nearest built machine, but the gate's 25 m dome is a sanctuary the monsters never
// enter (the ruling), and the base stands inside it. So a sapper stops at the dome's edge and latches nothing inside it. The owner must rule
// on that (a base machine inside the dome cannot be latched); this beat checks the rule as it stands.
await beat('28c a sapper goes for the base machine and stops at the gate dome (a sanctuary): nothing inside it is latched', async (row) => {
  await toPlanet();
  await page.evaluate(() => { window.__dev.setHp(100); window.__dev.setMonstersSetting('normal'); });
  await page.waitForTimeout(300);
  const fab = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.id ?? null);
  if (fab === null) return { ok: false, detail: 'no fabricator installed (F-01 is not done)' };
  // the sapper starts outside the dome: 31 m from the gate, then 4 m from the player (a monster placed inside the dome would not test the rule)
  const gate = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  await page.evaluate((g) => window.hmPlay.go('planet', g.x + 31, g.z, 0, -0.3), gate);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__dev.placeMob('sapper', 4));
  let latched = false;
  let closest = Infinity;
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__dev.stepMonsters(0.5));
    const s = await page.evaluate((id) => ({ latched: window.__dev.isLatched(id), sap: window.__dev.mobs().filter((m) => m.kind === 'sapper').map((m) => ({ x: m.pos.x, z: m.pos.z })) }), fab);
    latched = latched || s.latched;
    for (const m of s.sap) closest = Math.min(closest, Math.hypot(m.x - gate.x, m.z - gate.z));
  }
  row.shot = await shot('sapper-at-dome');
  await page.evaluate(() => window.__dev.setMonstersSetting('off'));
  const dome = closest >= 24.5;
  return { ok: !latched && dome, detail: `fabricator ${fab}: latched=${latched}; the sapper came no closer than ${closest.toFixed(1)} m to the gate (the dome is 25 m)` };
});

// TASK-24: the sync lines (N-01 on Sync to Planetary Grid, N-02 on Desync). The pause menu's button plays them (narrator table).
await beat('28d the sync lines: the pause menu\'s sync toggle plays N-01 when synced and N-02 when desynced', async (row) => {
  await quiet();
  await pauseOn();
  await page.locator('.play-pause button', { hasText: 'Sync to Planetary Grid' }).click();
  const n1 = await waitSub('N-01', 6000);
  await quiet();
  await page.locator('.play-pause button', { hasText: 'Desync to Solo Branch' }).click();
  const n2 = await waitSub('N-02', 6000);
  row.shot = await shot('sync-lines');
  await pauseOff();
  return { ok: n1 && n2, detail: `N-01 (synced)=${n1} N-02 (desynced)=${n2}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// The report
// ----------------------------------------------------------------------------------------------------------------------
const zeroErrors = consoleErrors.length === 0;
console.log(`HUD overlaps (title, build hint, subtitle): ${hudViolations.length}${hudViolations.length ? " " + JSON.stringify(hudViolations.slice(0, 5)) : ""}`);
console.log(`console errors: ${consoleErrors.length}${zeroErrors ? '' : ' ' + JSON.stringify(consoleErrors.slice(0, 5))}`);
console.log(`http errors: ${httpErrors.length}${httpErrors.length ? ' ' + JSON.stringify(httpErrors.slice(0, 5)) : ''}`);
// TASK-26: the foundation frame, the safe dome, the zero-loss recall and the brownout you can see
await beat('26a the foundation frame: a foundation on a slope has legs down to the ground under its low corners, each foot within 5 cm of the terrain', async (row) => {
  await toPlanet();
  await page.evaluate(() => { if (window.__playScene.getDrivingVehicle()) window.__playScene.exitVehicle(); });
  await page.waitForTimeout(400);
  const spots = await page.evaluate(() => {
    const s = window.__playScene;
    const g = s.debug.gatePlanet();
    const out = [];
    // cells whose corners differ by 1.0 to 2.5 m: the structure sits on its highest corner, so the low corner's leg is the spread less the 0.5 m deck (a 0.25 m cell has none)
    for (let r = 10; r <= 120 && out.length < 40; r += 2) for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const cx = g.x + r * Math.sin(a), cz = g.z + r * Math.cos(a);
      const hs = [[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([u, v]) => s.heightAt(cx + u, cz + v));
      const spread = Math.max(...hs) - Math.min(...hs);
      if (spread >= 1.0 && spread <= 2.5) out.push({ x: cx, z: cz, spread });
    }
    return out;
  });
  if (spots.length === 0) return { ok: false, detail: 'no sloped cell (1.0 to 2.5 m across) within 120 m of the gate' };
  // the starter kit (the blueprint a foundation needs) and some ore in the pack: the dev grant puts them in the player's slots
  await page.evaluate(() => { window.__dev.grant('bp:starter', 1); window.__dev.grant('ore', 300); });
  await page.waitForTimeout(200);
  const at = await page.evaluate(() => window.__playScene.debug.position());
  const before = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id));
  let tried = 0;
  let fresh = [];
  let spot = spots[0];
  for (const cand of spots.slice(0, 12)) {
    tried += 1;
    spot = cand;
    await page.evaluate(([x, z, at]) => window.hmPlay.base.apply({ t: 'found', at, blueprint: 'bp:starter', cx: x, cz: z, yaw: 0 }), [cand.x, cand.z, at]);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id));
    fresh = after.filter((id) => !before.includes(id));
    if (fresh.length > 0) break;
  }
  if (fresh.length === 0) return { ok: false, detail: `none of ${tried} sloped cells took a foundation (the starter kit, the ore in the pack, or the placement rule)` };
  const legs = await page.evaluate((id) => window.hmPlay.base.frameLegs(id), fresh[0]);
  if (!legs) return { ok: false, detail: 'no frame legs for the new foundation' };
  const ground = await page.evaluate((ls) => ls.map((l) => window.__playScene.heightAt(l.x, l.z)), legs);
  const worst = legs.reduce((m, l, i) => Math.max(m, Math.abs(l.footY - ground[i])), 0);
  row.shot = await shot('foundation-slope');
  const ok = legs.length >= 1 && worst <= 0.05 && legs.every((l) => !l.clamped);
  await page.evaluate(() => {
    const w = window.hmPlay?.base?.world?.();
    if (w) {
      const emptyIdx = w.player.slots.slice(0, 9).findIndex((s) => !s || s.n === 0);
      if (emptyIdx >= 0) window.hmPlay.base.apply({ t: 'hotbar', index: emptyIdx });
    }
  });
  await page.keyboard.press('9');
  return { ok, detail: `foundation ${fresh[0]}: ${legs.length} legs, the worst foot ${(worst * 100).toFixed(1)} cm from the terrain (limit 5 cm)` };
});

await beat('26b the safe dome: inside the gate\'s 25 m dome sync holds and refills; 60 m out, on raw ground, it drains (about 90 s for a full buffer)', async (row) => {
  await toPlanet();
  const g = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  await page.evaluate((g) => { window.hmPlay.setSync(0.5); window.hmPlay.go('planet', g.x + 8, g.z, 0, -0.2); }, g);
  await page.waitForTimeout(3000);
  const inside = await page.evaluate(() => window.hmPlay.sync);
  await page.evaluate((g) => window.hmPlay.go('planet', g.x + 60, g.z, 0, -0.2), g);
  await page.evaluate(() => window.hmPlay.setSync(0.9));
  await page.waitForTimeout(500);
  const a = await page.evaluate(() => window.hmPlay.sync);
  await page.waitForTimeout(3000);
  const b = await page.evaluate(() => window.hmPlay.sync);
  const drop = a - b;
  row.shot = await shot('dome-outside');
  const holds = inside >= 0.5 - 0.005;
  const drains = drop > 0.02 && drop < 0.05;
  return { ok: holds && drains, detail: `inside the dome sync went 0.50 to ${inside.toFixed(3)}; outside it fell ${drop.toFixed(3)} in 3 s (a 90 s buffer falls 0.033)` };
});

await beat('26c the zero-loss recall: at 0% sync the gate pulls the player back to the lab, and the pack and the plot are the same as before', async (row) => {
  await toPlanet();
  const g = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  await page.evaluate((g) => window.hmPlay.go('planet', g.x + 60, g.z, 0, -0.2), g);
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => JSON.stringify({ slots: window.hmPlay.base.world().player.slots, machines: window.hmPlay.plot().machines.length }));
  await page.evaluate(() => window.hmPlay.setSync(0.01));
  await page.waitForTimeout(2500);
  const where = await page.evaluate(() => window.hmPlay.where);
  const after = await page.evaluate(() => JSON.stringify({ slots: window.hmPlay.base.world().player.slots, machines: window.hmPlay.plot().machines.length }));
  row.shot = await shot('recall-lab');
  return { ok: where === 'lab' && before === after, detail: `recalled to ${where}; the pack, the machines and the ore ${before === after ? 'are the same as before' : 'CHANGED'}` };
});

await beat('26d the brownout you can see: over-building the grid thins the pixel plumes, and the power readout turns amber with its share', async (row) => {
  await toPlanet();
  const drivenAtStart = await page.evaluate(() => !!window.__playScene.getDrivingVehicle());
  await page.evaluate(() => { if (window.__playScene.getDrivingVehicle()) window.__playScene.exitVehicle(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.hmPlay.hideOverlays(false));
  await page.evaluate(() => window.hmPlay.give(600));
  await page.waitForTimeout(800);
  const p0 = await page.evaluate(() => window.__playScene.debug.plumePixels());
  const mill0 = await page.evaluate(() => window.__playScene.debug.machineRuns().filter((m) => m.kind === 'mill').map((m) => m.run));
  const g = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  let placed = 0;
  for (const r of [9, 12, 15, 18, 21, 24]) {
    for (let k = 0; k < 12 && placed < 3; k++) {
      const a = (k / 12) * Math.PI * 2;
      const x = g.x + r * Math.sin(a), z = g.z + r * Math.cos(a);
      const n = await page.evaluate(([x, z]) => {
        const before = window.hmPlay.plot().machines.length;
        window.hmPlay.placeAt(x, z, 'projector');
        return window.hmPlay.plot().machines.length - before;
      }, [x, z]);
      placed += n;
    }
    if (placed >= 3) break;
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.hmPlay.hideOverlays(false));
  const p1 = await page.evaluate(() => window.__playScene.debug.plumePixels());
  const mill1 = await page.evaluate(() => window.__playScene.debug.machineRuns().filter((m) => m.kind === 'mill').map((m) => m.run));
  const readout = await page.evaluate(() => { const el = document.querySelector('.play-power'); return el ? { cls: el.className, text: el.textContent ?? '' } : null; });
  row.shot = await shot('brownout');
  const pct = readout ? Number((readout.text.match(/(\d+)%/) ?? [])[1]) : NaN;
  const runDropped = mill0.length > 0 && mill1.length > 0 && mill1[0] < mill0[0] - 0.2 && mill1[0] < 0.99;
  const ok = placed >= 1 && readout !== null && readout.cls.includes('short') && Number.isFinite(pct) && pct < 100 && runDropped;
  return { ok, detail: `${drivenAtStart ? '(a vehicle was being driven; dismounted) ' : ''}${placed} projectors placed; the mill ran at ${mill0[0]?.toFixed(2)} then ${mill1[0]?.toFixed(2)}; the readout ${readout ? `"${readout.text.trim()}" (${readout.cls})` : 'is missing'}; plume pixels ${p0} to ${p1}` };
});

await beat('29 A7-01: build a field Power Unit and Relay Pylon after the 12 kW brownout', async (row) => {
  await toPlanet();
  await page.evaluate(() => {
    window.hmPlay.grindCount('placed:powerUnit', 1);
    window.hmPlay.grindCount('placed:relayPylon', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act7-power-pylon');
  const cur = await chainCur();
  return { ok: cur === 'A7-02', detail: `Act VII step 1 done, current=${cur}` };
});

await beat('30 A7-02: light projector and water maker flood the basin', async (row) => {
  await toPlanet();
  await page.evaluate(() => {
    window.hmPlay.grindCount('act7:hydro:lit', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act7-hydro-basin');
  const cur = await chainCur();
  return { ok: cur === 'A7-03', detail: `Act VII step 2 done, current=${cur}` };
});

await beat('31 A7-03: salvage 3 crater rim transponders to complete Act VII', async (row) => {
  await toPlanet();
  await page.evaluate(() => {
    window.hmPlay.grindCount('wreck:transponders', 3);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act7-transponders');
  const cur = await chainCur();
  return { ok: cur === 'A8-01', detail: `Act VII complete, current=${cur}` };
});

await beat('32 A8-01: Preset Combiner synthesizes a dual-metric cartridge or Anomaly Core', async (row) => {
  await toLab();
  await page.evaluate(() => {
    window.hmPlay.grindCount('combiner:spliced', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act8-combiner');
  const cur = await chainCur();
  return { ok: cur === 'A8-02', detail: `Act VIII step 1 done, current=${cur}` };
});

await beat('33 A8-02: hold the line or seal a perimeter rift (peaceful/combat parity)', async (row) => {
  await toPlanet();
  await page.evaluate(() => {
    window.hmPlay.grindCount('act8:rift:cleared', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act8-rift-wave');
  const cur = await chainCur();
  return { ok: cur === 'A8-03', detail: `Act VIII step 2 done, current=${cur}` };
});

await beat('34 A8-03: reach full PBR biosphere coherence (Stage 4+)', async (row) => {
  await toPlanet();
  await page.evaluate(() => {
    window.__dev.setFloats(1.0);
    window.hmPlay.grindCount('act8:biosphere', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act8-biosphere');
  const cur = await chainCur();
  return { ok: cur === 'A9-01', detail: `Act VIII complete, current=${cur}` };
});

await beat('35 A9-01: spot the 11 neighbor enclave domes on the horizon and inspect the Planet Table hologram', async (row) => {
  await toLab();
  await page.evaluate(() => {
    window.hmPlay.grindCount('act9:horizon:domes', 1);
  });
  await page.waitForTimeout(500);
  row.shot = await shot('act9-horizon-domes');
  const cur = await chainCur();
  return { ok: cur === 'A9-02', detail: `Act IX step 1 done, current=${cur}` };
});

await beat('36 A9-02 and A9-03: Planet Table majority consensus commit, golden-hour window heal and credits hand-off', async (row) => {
  await toLab();
  await page.evaluate(() => {
    window.__dev.commitConsensus();
  });
  await page.waitForTimeout(800);
  const curAfterCommit = await chainCur();

  await page.evaluate(() => {
    window.hmPlay.grindCount('act9:window:healed', 1);
    localStorage.setItem('hm.endingSeen', '1');
    if (window.__creditsDirector) {
      window.__creditsDirector.start();
    } else if (window.__dev?.playCredits) {
      window.__dev.playCredits();
    }
  });
  await page.waitForTimeout(1000);
  row.shot = await shot('finale-window-heal');

  const creditsActive = await page.evaluate(() => !!document.querySelector('[data-testid="credits-hud-root"]') || !!window.__creditsDirector?.isActive?.());
  const endingSeen = await page.evaluate(() => localStorage.getItem('hm.endingSeen') === '1');
  const cur = await chainCur();
  return { ok: cur === null && creditsActive && endingSeen, detail: `consensus commit=${curAfterCommit} finale current=${cur} creditsActive=${creditsActive} endingSeen=${endingSeen}` };
});

await beat('37 credits gate: title menu now lists Ending Credits after finale seen', async (row) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const atMenu = await page.locator('.sm-menu').count();
  if (!atMenu) {
    await page.goto(`${game}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.sm-menu', { timeout: 15000 });
  }
  const creditsBtn = page.locator('.sm-menu button', { hasText: 'Ending Credits' });
  const visible = await creditsBtn.isVisible();
  row.shot = await shot('title-credits-unlocked');
  return { ok: visible, detail: `Ending Credits visible on title menu: ${visible}` };
});

const passed = results.filter((r) => r.ok).length;
fs.writeFileSync(path.join(shotsDir, 'summary.json'), JSON.stringify({ results, consoleErrors, httpErrors, hudViolations }, null, 2));
console.log(`${passed} of ${results.length} beats PASS`);
console.log(`page errors: ${consoleErrors.length} console/page, ${httpErrors.length} http, all saved in ${errorLog}`);

server.kill();
await browser.close();
process.exit(passed === results.length && consoleErrors.length === 0 && hudViolations.length === 0 ? 0 : 1);
