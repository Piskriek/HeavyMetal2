/**
 * T03P (ARGO_NOTE_08, brief 29 item 6): every machine pours its own colour from its vent while it operates, and pours nothing
 * when it is off, unpowered, out of ore, or (a pylon) carries no load. Boots ?base&kit=1&e2e on the moon plot at stage 6,
 * places one machine of each field kind and a pylon, then asserts through the play scene's plumes() hook:
 *  - the live state: each placed machine the grid runs has an emitter (logged per kind);
 *  - forced state, all machines running: each kind's emitter is up, in its colour, from a vent on its own prop;
 *  - a machine's pour follows its run share (half the run, about half the pixels);
 *  - a machine switched off (on: false, no run) stops its emitter and its feed cubes; the others keep pouring;
 *  - a machine starved (no run, out of ore) stops its emitter; the others keep pouring;
 *  - a pylon with no load pours nothing, and sparks once a machine on the grid runs;
 *  - putting the run back restarts every emitter.
 * The forced states go through the play scene's own setPlot (the same call play.tsx makes with the solver's running map).
 * Shots go to shots-run/plumes/ (gitignored). Needs npm run build first (it serves apps/web/dist).
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
const shotsDir = path.join(root, 'shots-run/plumes');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8233;
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Colours and rates as ARGO_NOTE_08 has them (machine-props.ts MACHINE_PLUME_SPECS): the full pour is rate x lifetime pixels.
const SPEC = {
  drill: { colour: '#ff7b3d', full: 30 * 0.9 },
  mill: { colour: '#ff3d8a', full: 28 * 1.8 },
  press: { colour: '#7cff4d', full: 32 * 1.4 },
  projector: { colour: '#ffc13d', full: 26 * 2.2 },
  water: { colour: '#3dc8ff', full: 34 * 2.0 },
  power: { colour: '#b46bff', full: 36 * 1.7 },
  pylon: { colour: '#5ce1e6', full: 12 * 0.55 },
  // the heavy water maker (a base hardpoint's kind): placed on the plot directly, as the one heavy kind shot here
  'heavy-water': { colour: '#3dc8ff', full: 78 * 2.6 },
};
// Each kind's footprint on the ground, in metres (machine-inspect.ts MACHINE_SIZES: the largest side): a vent or a feed sits within it.
const REACH = { drill: 2.5, mill: 2.6, press: 2.6, projector: 2.2, water: 3.2, power: 2.7, pylon: 1.5, 'heavy-water': 4.5 };
// The kinds that take material in (their feed hopper is where the ore cubes drop): every other kind has no feed socket.
const FEEDS = ['mill', 'press', 'water', 'power', 'heavy-water'];

// Candidate spots near the gate for each kind (the first one that places wins). The gate and its reach are the same as the stage 6 measure's.
const CANDIDATES = {
  drill: [[-12, 0], [-12, 6], [-14, -6]],
  mill: [[12, 0], [12, 6], [14, -4]],
  press: [[18, -16], [-16, -18], [22, -6]],
  projector: [[-6, 14], [-2, 14], [-10, 14]],
  water: [[0, 12], [8, 12], [14, 10]],
  power: [[-6, -8], [-4, -10], [6, -10]],
  pylon: [[4, -8], [6, -2], [-4, 8]],
  'heavy-water': [[-20, 6], [-22, -10], [18, 14]],
};

console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await sleep(1500);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (err) => {
  console.error('Browser Page Error:', err.message, String(err.stack ?? '').split('\n').slice(0, 3).join(' | '));
  pageErrors.push(err.message);
});
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
    localStorage.setItem('hm.profile.v2', JSON.stringify({
      name: 'Goblin', credits: 500, grownUp: true, tutorialDone: true, style: 'voxel', skin: 'flat', favIslands: [],
      quality: 'low', fpsTarget: 60, graphics: {}, gpu: 'fast', controls: { sensitivity: 1, invertY: false, fov: 75 }, cameraView: 'first',
    }));
  } catch {}
});

/**
 * The forced state: every machine on the plot, its run and switch set by the test. play.tsx pushes the solver's own running map
 * to the scene on its ticks, so the test wraps the scene's setPlot: while an override is set, each call carries the forced runs
 * (the scene's own setPlot does the rest, the same path the solver takes).
 */
const installOverride = () => page.evaluate(() => {
  const s = window.__playScene;
  const orig = s.setPlot.bind(s);
  window.__plumeOverride = null;
  s.setPlot = (plot, running, connected, satisfaction = 1) => {
    const o = window.__plumeOverride;
    if (!o) return orig(plot, running, connected, satisfaction);
    const machines = plot.machines.map((mm) => ({ ...mm, on: !o.off.includes(mm.kind) }));
    const forcedRun = new Map();
    const forcedConnected = new Set();
    for (const mm of machines) {
      forcedConnected.add(mm.id);
      forcedRun.set(mm.id, o.off.includes(mm.kind) ? 0 : (o.runs[mm.kind] ?? 0));
    }
    return orig({ ...plot, machines }, forcedRun, forcedConnected, 1);
  };
});
const force = (runs, offKinds = []) => page.evaluate(({ runs, offKinds }) => {
  window.__plumeOverride = { runs, off: offKinds };
  const plot = window.hmPlay.plot();
  window.__playScene.setPlot(plot, new Map(), new Set(), 1);
  return plot.machines.length;
}, { runs, offKinds });
/** The largest pour each kind shows over eight samples a second apart: a crackle or a ram stroke is off at some instants. */
const peakPlumes = async () => {
  const peak = {};
  for (let i = 0; i < 8; i++) {
    for (const r of await readPlumes()) {
      const p = peak[r.kind];
      if (!p) peak[r.kind] = { ...r };
      else peak[r.kind] = { ...p, emitting: p.emitting || r.emitting, pour: Math.max(p.pour, r.pour), feedCubes: Math.max(p.feedCubes, r.feedCubes) };
    }
    await settle(130);
  }
  return Object.values(peak);
};

const readPlumes = () => page.evaluate(() => window.__playScene.debug.plumes());
const byKind = (rows) => Object.fromEntries(rows.map((r) => [r.kind, r]));
const settle = (ms = 700) => page.waitForTimeout(ms);

let exitCode = 0;
try {
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene !== undefined, null, { timeout: 90000 });
  await page.evaluate(() => { window.hmPlay.teleportPlanet(); window.hmPlay.setPaused?.(false); window.hmPlay.setLocked?.(true); });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 30000 });
  // the machines need ore, and the water maker and the pylon are unlocked from stage 3 (as the stage 6 measure places them)
  await page.evaluate(() => { window.hmPlay.give(2000); window.hmPlay.setStage(6); });
  await settle(400);

  const placed = {};
  for (const [kind, spots] of Object.entries(CANDIDATES)) {
    for (const [x, z] of spots) {
      const ok = await page.evaluate(([k, px, pz]) => window.hmPlay.placeAt(px, pz, k), [kind, x, z]);
      if (ok) { placed[kind] = [x, z]; break; }
    }
  }
  console.log(`placed: ${JSON.stringify(placed)}`);
  for (const kind of Object.keys(SPEC)) check(`${kind} placed on the plot`, kind in placed);
  await settle(2500);

  // the live state, from the solver's own running map (logged: a kind the grid does not run shows here as not emitting)
  const live = byKind(await readPlumes());
  console.log(`live: ${Object.entries(live).map(([k, v]) => `${k}=${v.emitting ? `on(${v.pour})` : 'off'}`).join(' ')}`);

  // forced: every machine running at full, through the scene's own setPlot
  await installOverride();
  await force({ drill: 1, mill: 1, press: 1, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 });
  await settle(900);
  const full = byKind(await peakPlumes());
  for (const kind of Object.keys(SPEC)) {
    const row = full[kind];
    check(`${kind} pours at full run`, Boolean(row && row.emitting && row.pour > 0), row ? `pour ${row.pour}` : 'no row');
    if (!row) continue;
    check(`${kind} pours in its colour`, row.colour === SPEC[kind].colour, row.colour);
    check(`${kind} pours no more than rate x lifetime`, row.pour <= Math.round(SPEC[kind].full) + 1, `${row.pour} <= ${Math.round(SPEC[kind].full)}`);
    const at = placed[kind];
    if (at && row.vent) {
      // the foot is the machine's own plot position (the one the scene builds it at); the placed spot is only a request
      const [vx, vy, vz] = row.vent;
      const [bx, bz] = row.base;
      const dist = Math.hypot(vx - bx, vz - bz);
      const placedGap = Math.hypot(bx - at[0], bz - at[1]);
      check(`${kind} vent is on its own prop (within ${REACH[kind]} m of its foot)`, dist <= REACH[kind] + 0.5, `${dist.toFixed(2)} m from [${bx}, ${bz}], placed at [${at}]${placedGap > 0.01 ? `, moved ${placedGap.toFixed(2)} m` : ''}`);
      check(`${kind} vent is above the ground`, vy > -0.5 && vy < 12, `y ${vy.toFixed(2)}`);
    }
  }
  check('the feed cubes drop at full run for every kind that takes material in', FEEDS.every((k) => !placed[k] || (full[k]?.feedCubes ?? 0) > 0));
  check('a drill and a projector take no ore in (no feed cubes, no feed socket)', (full.drill?.feedCubes ?? 0) === 0 && (full.projector?.feedCubes ?? 0) === 0 && !full.drill?.feed && !full.projector?.feed);
  for (const kind of FEEDS) {
    const row = full[kind];
    if (!placed[kind] || !row) continue;
    if (!row.feed) { check(`${kind} has a feed hopper`, false, 'no feed socket'); continue; }
    const [fx, fy, fz] = row.feed;
    const [bx, bz] = row.base;
    const dist = Math.hypot(fx - bx, fz - bz);
    check(`${kind} feed hopper is on its own prop (within ${REACH[kind]} m of its foot)`, dist <= REACH[kind] + 0.5, `${dist.toFixed(2)} m from [${bx}, ${bz}], feed y ${fy.toFixed(2)}`);
  }

  // the pour follows the run share: half the run, about half the pixels (the same count, scaled)
  await force({ drill: 1, mill: 0.5, press: 1, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 });
  await settle(500);
  const half = byKind(await peakPlumes());
  if (half.mill) {
    const ratio = half.mill.pour / Math.max(1, full.mill.pour);
    check('the mill pours about half its pixels at half the run', ratio > 0.35 && ratio < 0.65, `${half.mill.pour} of ${full.mill.pour}`);
  }

  // a machine that is off: its emitter and feed cubes stop, the others keep pouring
  await force({ drill: 1, mill: 1, press: 1, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 }, ['mill']);
  await settle(500);
  const off = byKind(await peakPlumes());
  check('a machine switched off pours nothing', off.mill && !off.mill.emitting && off.mill.pour === 0 && off.mill.feedCubes === 0, `emitting ${off.mill?.emitting}`);
  check('the others keep pouring while one is off', ['press', 'projector', 'water'].every((k) => !placed[k] || off[k]?.emitting));

  // a machine starved (out of ore: no run): its emitter stops, the others keep pouring
  await force({ drill: 1, mill: 1, press: 0, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 });
  await settle(500);
  const starved = byKind(await peakPlumes());
  check('a starved press (out of ore) pours nothing', starved.press && !starved.press.emitting && starved.press.feedCubes === 0);
  check('the mill keeps pouring beside the starved press', !placed.mill || starved.mill?.emitting);

  // a pylon sparks only under load: no machine on the grid running, it pours nothing
  await force({});
  await settle(500);
  const idle = byKind(await peakPlumes());
  if (placed.pylon) check('a pylon with no load pours nothing', !idle.pylon.emitting && idle.pylon.pour === 0);
  check('no machine pours with the grid idle', Object.values(idle).every((r) => !r.emitting));

  // the run back: every emitter restarts
  await force({ drill: 1, mill: 1, press: 1, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 });
  await settle(700);
  const back = byKind(await readPlumes());
  check('putting the run back restarts the mill', !placed.mill || (back.mill?.emitting && back.mill.pour > 0));
  check('putting the run back restarts every machine', Object.keys(placed).every((k) => back[k]?.emitting));

  // the shots: the stage 6 look at full run (the same fidelity walk the stage 6 measure makes), the overlook, then close looks at
  // the mill and the press with the overlays hidden. Yaw follows the scene's own convention: facing (-sin yaw, -cos yaw).
  await force({ drill: 1, mill: 1, press: 1, projector: 1, water: 1, power: 1, pylon: 1, 'heavy-water': 1 });
  for (const st of [2, 4, 6]) {
    await page.evaluate((s) => window.__playScene.setFidelityStage(s), st);
    await page.evaluate(() => {
      const exit = window.__playScene.gateExit();
      window.__playScene.debug.teleport('planet', exit.x - 5, exit.z + 14, 0.4, -0.22);
    });
    await settle(6000);
  }
  await page.screenshot({ path: path.join(shotsDir, 'plumes-overlook.png') });
  const lookAt = async (name, machine, camX, camZ, pitch) => {
    if (!machine) return;
    await page.evaluate(([cx, cz, tx, tz, p]) => {
      window.hmPlay.hideOverlays?.(true);
      window.__playScene.debug.teleport('planet', cx, cz, Math.atan2(-(tx - cx), -(tz - cz)), p);
    }, [camX, camZ, machine[0], machine[1], pitch]);
    await settle(2500);
    await page.screenshot({ path: path.join(shotsDir, name) });
    await page.evaluate(() => window.hmPlay.hideOverlays?.(false));
  };
  // a slight upward pitch keeps the held slab's ghost (the aim point on the ground) out of the frame
  if (placed.mill) await lookAt('plumes-mill-close.png', placed.mill, placed.mill[0] - 4.5, placed.mill[1] + 1.5, 0.03);
  if (placed.press) await lookAt('plumes-press-close.png', placed.press, placed.press[0] + 5, placed.press[1] + 3.5, 0.03);
  // item 5 of T03P: the water maker, the projector and a heavy machine, close, each with its vent and feed in view
  if (placed.water) await lookAt('plumes-water-close.png', placed.water, placed.water[0] + 4.5, placed.water[1] - 4, 0.03);
  if (placed.projector) await lookAt('plumes-projector-close.png', placed.projector, placed.projector[0] - 4.5, placed.projector[1] - 3.5, 0.03);
  if (placed['heavy-water']) await lookAt('plumes-heavy-water-close.png', placed['heavy-water'], placed['heavy-water'][0] - 10, placed['heavy-water'][1] + 5, -0.06);
  const stats = await page.evaluate(() => window.__playScene.debug.detail().pixels);
  console.log(`plume pixels now: ${stats}`);
} catch (err) {
  console.error('FAILED:', err?.stack ?? err);
  exitCode = 1;
} finally {
  if (pageErrors.length) {
    check('no page errors', false, pageErrors.slice(0, 3).join(' | '));
  } else {
    check('no page errors', true);
  }
  await browser.close().catch(() => {});
  server.kill();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length} of ${checks.length} checks pass`);
if (failed.length || exitCode) process.exit(1);
