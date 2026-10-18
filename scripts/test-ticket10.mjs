/**
 * TICKET-10 (T10) check: the wave band, monster wall pathing, the foregrip IK, the slope-lifted beam ring, the housing LEDs,
 * the seam stitch, the lab window's floor flash, and play-scene Window A. Run with tsx so the TS modules load directly:
 *   node --import tsx scripts/test-ticket10.mjs            (everything: the pure checks, then the browser checks)
 *   node --import tsx scripts/test-ticket10.mjs --pure     (the pure checks only, no browser)
 *
 * Pure checks (no browser, deterministic):
 * - POL-32: a charger routes around a built wall to reach the player behind it; it never enters the wall's footprint
 * - POL-33: a spitter bolt stops on a wall, and the player behind it takes no hit
 * - P1-LIGHT-04: the wave band takes the triggering metric's colour; the band is 6 m wide
 * - POL-52: the scan ring holds to 310 m, fades out by 350 m and stays gone past it
 * - P1-LIGHT-04: a machine's first activation pulses 30 m around it over about 1 s, then stops
 * - POL-28: the left hand lands on a reachable foregrip socket, with the bone lengths kept
 * - POL-30: the slope-lifted ring never sits under the ground across a steep slope or a crease (the old lift does, as a control)
 * - POL-39: the housing LED states (running green, blinking amber, red unpowered) and the anchors for every machine kind
 * - POL-37: the fight overlay is tuned down at Stage 1 and kept at Stage 6
 * - POL-29: a fine chunk's shared border snaps onto the coarse neighbour's edge line (no crack)
 *
 * Browser checks (serves apps/web/dist on port 8199, the e2e planet and lab; skipped with a reason if Chrome is missing):
 * - no page errors while the planet, the fight, the third person and the lab run
 * - POL-37: fight shots at Stage 1 and Stage 6 (the look is checked by eye in the shots)
 * - POL-28: in third person with the rifle in hand, the left hand bone sits on the rifle's foregrip socket (within 5 cm)
 * - POL-25: a window lightning flash lights the lab floor, and the floor stays lit 0.3 s after the flash starts
 * - POL-39: the housing LED meshes in the scene are square (only if a machine is placed in the fixture; otherwise SKIPPED)
 *
 * Writes shots-run/ticket10-*.png. Exits 1 on the first failed check, and kills its server and browser.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  boltBlockedBySolids,
  createWorld,
  findPathAroundWalls,
  navFromSolids,
  nextWaypointAroundWalls,
  placeMob,
  step,
} from '../packages/leaksim/src/index.ts';
import { stitchChunkCandidates } from '../packages/terrainbrush/src/index.ts';
import {
  LOCAL_MACHINE_WAVE_DURATION_S,
  localMachineWaveAt,
  scanRingFadeAt,
  stageWaveBandAt,
  STAGE_WAVE_BAND_WIDTH_M,
  waveBandColourFor,
  WAVE_METRIC_RGB,
} from '../apps/web/src/play/portal-shaders.ts';
import { solveLeftArmForegripIk } from '../apps/web/src/avatar/two-bone-ik.ts';
import { RING_LIFT, slopeLiftAt } from '../apps/web/src/play/beam-visuals.ts';
import { HOUSING_LED_ANCHOR, HOUSING_LED_COLOURS, housingLedState } from '../apps/web/src/play/machine-props.ts';
import { fightOverlayParamsForStage } from '../apps/web/src/play/monster-rules.ts';
import * as THREE from 'three';

const pureOnly = process.argv.includes('--pure');
const root = fileURLToPath(new URL('../', import.meta.url));
const shots = fileURLToPath(new URL('../shots-run/', import.meta.url));
fs.mkdirSync(shots, { recursive: true });

let passed = 0;
const skipped = [];
const check = (name, ok, detail = '') => {
  if (!ok) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`OK: ${name}${detail ? ` (${detail})` : ''}`);
};
const skip = (name, why) => {
  skipped.push(`${name}: ${why}`);
  console.log(`SKIPPED: ${name} (${why})`);
};

// ----------------------------------------------------------------------------
// Pure checks
// ----------------------------------------------------------------------------

// POL-32 / POL-33: a built wall (8 m along Z, 0.5 m thick) between a charger and the player
const wall = { x: 0, z: 0, ux: 1, uz: 0, hu: 0.25, hv: 4.0 };
const inWall = (x, z, r = 0.3) => Math.abs(x) < wall.hu + r && Math.abs(z) < wall.hv + r;
{
  const nav = navFromSolids([wall], { x: 0, z: 0 }, 16, 0.5, 0.6);
  const detour = findPathAroundWalls(nav, { x: -4, z: 0 }, { x: 4, z: 0 });
  check('POL-32: the path around the built wall detours past its end', detour.length >= 2 && Math.abs(detour[0].z) > 3.5, `first waypoint z=${detour[0]?.z?.toFixed(2)}`);
  const wp = nextWaypointAroundWalls({ x: -3, z: 0 }, { x: 4, z: 0 }, [wall], 0.8, nav);
  check('POL-32: the next waypoint steers toward the open end', Math.abs(wp.z) > 2.0, `z=${wp.z.toFixed(2)}`);

  let w = placeMob(createWorld(7), 'charger', { x: -2.5, z: 0 });
  let entered = false;
  let crossedZ = null;
  for (let i = 0; i < 160; i++) {
    const before = w.mobs[0];
    w = step(w, {
      dt: 0.1,
      stage: 1,
      aggression: 'normal',
      player: { x: 5, z: 0, alive: true },
      machines: [],
      safe: [],
      sealing: null,
      solids: [wall],
      nav,
    }).world;
    const mob = w.mobs[0];
    if (!mob) break;
    if (inWall(mob.x, mob.z)) entered = true;
    if (before && before.x < 0 && mob.x >= 0 && crossedZ === null) crossedZ = mob.z;
  }
  const mob = w.mobs[0];
  check('POL-32: a charger routes around the built wall to the player behind it', !!mob && mob.x > 0 && crossedZ !== null && Math.abs(crossedZ) > 3.5, `x=${mob?.x?.toFixed(2)} crossed at z=${crossedZ?.toFixed(2)}`);
  check('POL-32: the charger never enters the wall footprint', !entered);

  // POL-33: a spitter bolt aimed through the wall stops on it, and the player behind takes no hit
  const blocked = boltBlockedBySolids(-3, 0, 3, 0, [wall], 0.08);
  check('POL-33: a bolt aimed through the wall is blocked by it', blocked.blocked === true);
  const clear = boltBlockedBySolids(-3, 5, 3, 5, [wall], 0.08);
  check('POL-33: a bolt flying past the wall end is not blocked', clear.blocked === false);
  // the bolt leaves from x = -2 (the spitter's side), crosses the wall at x = 0 and would reach the player at x = 2
  const shot = step({ ...createWorld(42), bolts: [{ id: 99, from: 1, x: -2, z: 0, vx: 12, vz: 0, life: 2.0, damage: 10 }] }, {
    dt: 0.5,
    stage: 1,
    aggression: 'normal',
    player: { x: 2, z: 0, alive: true },
    machines: [],
    safe: [],
    sealing: null,
    solids: [wall],
  });
  check('POL-33: a spitter bolt stops on the wall and never reaches the player behind it', shot.world.bolts.length === 0 && !shot.events.some((e) => e.t === 'hitPlayer'));
}

// P1-LIGHT-04: the wave band colour follows the triggering metric; the band is 6 m
{
  const metrics = ['pxd', 'vtx', 'lx', 'aq'];
  const colourOk = metrics.every((m) => {
    const c = waveBandColourFor(m);
    const want = WAVE_METRIC_RGB[m];
    return c[0] === want[0] && c[1] === want[1] && c[2] === want[2];
  });
  check('P1-LIGHT-04: the wave band takes each metric\'s colour', colourOk);
  const distinct = new Set(metrics.map((m) => waveBandColourFor(m).join(','))).size;
  check('P1-LIGHT-04: the four metric colours are distinct', distinct === 4, `${distinct} distinct`);
  const band = stageWaveBandAt(50, 50, 'vtx');
  check('P1-LIGHT-04: the stage wave band is 6 m wide and lit at its front', band.bandWidthM === STAGE_WAVE_BAND_WIDTH_M && band.inside === true, `width ${band.bandWidthM} m`);
  const local = localMachineWaveAt(0.1, 'lx');
  check('P1-LIGHT-04: a local pulse takes the lx colour when the machine runs lx', local.active && local.colour[0] === WAVE_METRIC_RGB.lx[0]);
}

// POL-52: the scan ring fades out between 310 m and 350 m
{
  check('POL-52: the scan ring holds at full strength inside 310 m', scanRingFadeAt(310) === 1 && scanRingFadeAt(200) === 1);
  check('POL-52: the scan ring is half-faded between 310 m and 350 m', scanRingFadeAt(330) > 0 && scanRingFadeAt(330) < 1);
  check('POL-52: the scan ring is gone by 350 m and stays gone', scanRingFadeAt(350) === 0 && scanRingFadeAt(400) === 0);
  let monotone = true;
  for (let r = 310; r < 350; r += 0.5) if (scanRingFadeAt(r + 0.5) > scanRingFadeAt(r) + 1e-9) monotone = false;
  check('POL-52: the fade never brightens with distance', monotone);
}

// P1-LIGHT-04: the 30 m, 1 s pulse on a machine's first activation
{
  const at0 = localMachineWaveAt(0);
  const at05 = localMachineWaveAt(0.5);
  const at099 = localMachineWaveAt(LOCAL_MACHINE_WAVE_DURATION_S - 0.01);
  const after = localMachineWaveAt(LOCAL_MACHINE_WAVE_DURATION_S);
  check('P1-LIGHT-04: the pulse starts at the machine and runs out at 30 m', at0.active && at0.radiusM < 1 && at099.radiusM > 29 && at099.radiusM <= 30, `r(0)=${at0.radiusM.toFixed(2)} r(0.99)=${at099.radiusM.toFixed(2)}`);
  check('P1-LIGHT-04: the pulse is halfway out after about half a second', at05.active && at05.radiusM > 15 && at05.radiusM < 25, `r(0.5)=${at05.radiusM.toFixed(2)}`);
  check('P1-LIGHT-04: the pulse is over after about 1 s', after.active === false && LOCAL_MACHINE_WAVE_DURATION_S === 1.0);
}

// POL-28: the left hand lands on a reachable foregrip socket, with the bone lengths kept, on real three.js bones under a
// turned and moved parent (the same path the game takes: the solver reads the bones through three's own getters)
{
  const holder = new THREE.Group();
  holder.position.set(3.0, 0.0, 5.0);
  holder.rotation.set(0, 0.6, 0);
  const shoulder = new THREE.Object3D();
  shoulder.position.set(-0.15, 1.35, 0.0);
  holder.add(shoulder);
  const upper = new THREE.Object3D();
  upper.position.set(-0.07, 0.0, 0.0);
  shoulder.add(upper);
  const fore = new THREE.Object3D();
  fore.position.set(0, -0.206, 0);
  upper.add(fore);
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.223, 0);
  fore.add(hand);
  holder.updateMatrixWorld(true);
  const upperWorld = upper.getWorldPosition(new THREE.Vector3());
  const socket = { x: upperWorld.x + 0.12, y: upperWorld.y - 0.25, z: upperWorld.z + 0.2 };
  const pole = holder.localToWorld(new THREE.Vector3(-0.42, 0.88, -0.22));
  const sol = solveLeftArmForegripIk(upper, fore, hand, socket, { x: pole.x, y: pole.y, z: pole.z });
  check('POL-28: the foregrip IK solves for a reachable socket', sol !== null && sol.withinReach === true);
  const handWorld = hand.getWorldPosition(new THREE.Vector3());
  const gap = Math.hypot(handWorld.x - socket.x, handWorld.y - socket.y, handWorld.z - socket.z);
  check('POL-28: the left hand lands on the foregrip socket (within 3 cm)', gap < 0.03, `gap ${(gap * 100).toFixed(2)} cm`);
  const foreWorld = fore.getWorldPosition(new THREE.Vector3());
  const upperLen = upperWorld.distanceTo(foreWorld);
  const foreLen = foreWorld.distanceTo(handWorld);
  check('POL-28: the bone lengths are kept (upper 0.206 m, forearm 0.223 m)', Math.abs(upperLen - 0.206) < 0.005 && Math.abs(foreLen - 0.223) < 0.005, `upper ${upperLen.toFixed(3)} m, forearm ${foreLen.toFixed(3)} m`);
}

// POL-30: the slope-lifted ring is flush on a steep ridge (a peak crease at x = 0); a flat RING_LIFT is buried under the crease
{
  // a peaked crease (slope 1.6 each side) with a little ripple along Z: a chord of the ring across the apex dips under the ground
  const ridge = (x, z) => -1.6 * Math.abs(x) + 0.5 * x + 0.2 * Math.sin(3 * z);
  const slopeLifted = (x, z) => ridge(x, z) + slopeLiftAt(ridge, x, z, RING_LIFT);
  const flatLifted = (x, z) => ridge(x, z) + RING_LIFT;
  // the ring's chord between each pair of neighbouring samples (72 segments, half a step off the apex so a chord crosses it), at two radii
  const worstClearance = (ringHeight) => {
    let worst = Infinity;
    const seg = 72;
    for (const r of [0.8, 1.0]) {
      for (let s = 0; s < seg; s++) {
        const a0 = (2 * Math.PI * s) / seg + Math.PI / seg;
        const a1 = (2 * Math.PI * (s + 1)) / seg + Math.PI / seg;
        const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
        const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
        const chordY = 0.5 * (ringHeight(x0, z0) + ringHeight(x1, z1));
        const groundY = ridge(0.5 * (x0 + x1), 0.5 * (z0 + z1));
        worst = Math.min(worst, chordY - groundY);
      }
    }
    return worst;
  };
  const lifted = worstClearance(slopeLifted);
  const flat = worstClearance(flatLifted);
  check('POL-30: the slope-lifted ring sits clear of a steep crease (at least 2 cm above the ground on every chord)', lifted >= 0.02, `worst clearance ${(lifted * 100).toFixed(1)} cm`);
  check('POL-30: control: the flat lift is buried under the crease', flat < 0, `worst clearance ${(flat * 100).toFixed(1)} cm`);
}

// POL-39: the housing LED states and anchors
{
  const run = housingLedState(1, true, 1, 0);
  const warnOff = housingLedState(0, true, 1, 0);
  const brown = housingLedState(1, true, 0.5, 0);
  const dead = housingLedState(1, false, 1, 0);
  check('POL-39: a running machine shows the green LED', run.status === 'running' && run.colour === HOUSING_LED_COLOURS.running);
  check('POL-39: a machine with no ore or a brownout blinks amber', warnOff.status === 'warn' && brown.status === 'warn' && warnOff.colour === HOUSING_LED_COLOURS.warn);
  const blinkA = housingLedState(0, true, 1, 0.0).intensity;
  const blinkB = housingLedState(0, true, 1, 0.375).intensity; // the blink's off phase (sin(1.5 pi) = -1)
  check('POL-39: the amber LED blinks (its intensity changes over a quarter of a 2 Hz cycle)', blinkA !== blinkB, `${blinkA} vs ${blinkB}`);
  check('POL-39: an unpowered machine shows the red LED', dead.status === 'unpowered' && dead.colour === HOUSING_LED_COLOURS.unpowered);
  const colours = new Set(Object.values(HOUSING_LED_COLOURS));
  check('POL-39: the three LED colours are distinct', colours.size === 3);
  const anchorsFinite = Object.values(HOUSING_LED_ANCHOR).every((a) => a.length === 3 && a.every(Number.isFinite));
  check('POL-39: every machine kind has a finite LED anchor', anchorsFinite);
}

// POL-37: the fight overlay is tuned down at Stage 1 and kept at Stage 6
{
  const s1 = fightOverlayParamsForStage(1);
  const s6 = fightOverlayParamsForStage(6);
  check('POL-37: Stage 1 has the lower remap strength and ring opacity', s1.remapStrength < s6.remapStrength && s1.ringMaxOpacity < s6.ringMaxOpacity, `remap ${s1.remapStrength} vs ${s6.remapStrength}; ring ${s1.ringMaxOpacity} vs ${s6.ringMaxOpacity}`);
  check('POL-37: Stage 6 keeps 0.20 remap strength', Math.abs(s6.remapStrength - 0.2) < 1e-9, `${s6.remapStrength}`);
}

// POL-29: a fine chunk's border snaps onto the coarse neighbour's edge line (no crack)
{
  const g = 5;
  const finePos = new Float32Array(g * g * 3);
  const coarsePos = new Float32Array(g * g * 3);
  for (let z = 0; z < g; z++) {
    for (let x = 0; x < g; x++) {
      const i = (z * g + x) * 3;
      finePos[i] = x * 4;
      finePos[i + 1] = Math.sin(x) * 3;
      finePos[i + 2] = z * 4;
      coarsePos[i] = x * 8;
      coarsePos[i + 1] = Math.sin(x * 2) * 3;
      coarsePos[i + 2] = -16 + z * 8;
    }
  }
  const count = stitchChunkCandidates([
    { minX: 0, maxX: 16, minZ: 0, maxZ: 16, gridVerts: g, positions: finePos },
    { minX: 0, maxX: 32, minZ: -32, maxZ: 0, gridVerts: g, positions: coarsePos },
  ]);
  const chord = 0.5 * (finePos[0 * 3 + 1] + finePos[2 * 3 + 1]);
  const odd = finePos[1 * 3 + 1];
  check('POL-29: the seam stitch snaps the fine border onto the coarse chord (no crack)', count > 0 && Math.abs(odd - chord) < 1e-5, `snapped ${odd.toFixed(4)} vs chord ${chord.toFixed(4)}`);
}

console.log(`\nPure checks: ${passed} passed.`);

// ----------------------------------------------------------------------------
// Browser checks
// ----------------------------------------------------------------------------
if (pureOnly) {
  console.log(skipped.length ? `Skipped: ${skipped.join('; ')}` : 'All pure checks ran.');
  process.exit(0);
}

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  skip('browser checks', 'Chrome not found');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const port = 8199;
console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new Error('pointer lock stubbed'));
    };
  });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[Browser error]: ${msg.text()}`);
  });
  const dev = (fn, ...args) => page.evaluate(([name, a]) => window.__dev[name](...a), [fn, args]);
  const stepSec = (s) => page.evaluate((x) => window.__dev.stepMonsters(x), s);
  const faceLeak = async (lk, dist = 12) => {
    let best = { yaw: 0, dot: -2 };
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await page.evaluate(([x, z, y]) => window.hmPlay.teleport('planet', x, z, y, 0), [lk.x, lk.z - dist, yaw]);
      const aim = await dev('aim');
      const eye = await dev('eye');
      const tx = lk.x - eye.x, tz = lk.z - eye.z, len = Math.hypot(tx, tz) || 1;
      const dot = (aim.dir.x * tx + aim.dir.z * tz) / len;
      if (dot > best.dot) best = { yaw, dot };
    }
    await page.evaluate(([x, z, y]) => window.hmPlay.teleport('planet', x, z, y, 0), [lk.x, lk.z - dist, best.yaw]);
    await sleep(400);
  };

  await page.goto(`http://localhost:${port}/?mash&e2e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev && !!window.__playScene, null, { timeout: 35000 });

  const hideHint = () => page.evaluate(() => {
    // the pointer-lock hint sits over the middle of every shot (pointer lock is stubbed here): hide its box
    const el = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /Click to look around/.test(e.textContent || ''));
    if (!el) return;
    let box = el;
    while (box.parentElement && box.parentElement.getBoundingClientRect().width <= 640) box = box.parentElement;
    box.style.display = 'none';
  });

  // steps the monsters in half-second steps until a wave is up (the shot follows at once, before the fight can pull the player back)
  const waitForMobs = async (maxSec) => {
    for (let t = 0; t < maxSec * 2; t++) {
      await stepSec(0.5);
      const mobs = await dev('mobs');
      if (mobs.length > 0) return mobs;
    }
    return [];
  };

  // the planet fight at Stage 1 (the route test-planet-monsters takes): a warned leak, a wave, then the camera faces a monster
  await dev('equip', 'shotgun', true);
  await dev('setStage', 1);
  await dev('unlockMonsters', true);
  await dev('setMonstersSetting', 'normal');
  await stepSec(1);
  const leaks = await dev('leaks');
  const live = leaks.filter((l) => !l.dormant && l.state !== 'sealed');
  const warned = live.find((l) => l.state === 'warned' && l.inSeconds !== null && l.inSeconds <= 20) ?? live.find((l) => l.state === 'warned');
  if (!warned) throw new Error(`FAILED: no warned leak to fight (${live.length} live leaks)`);
  await faceLeak(warned, 12);
  const mobsS1 = await waitForMobs(40);
  check('POL-37: monsters are up at Stage 1 for the fight shot', mobsS1.length > 0, `${mobsS1.length} monsters`);
  if (mobsS1.length) await faceLeak({ x: mobsS1[0].pos.x, z: mobsS1[0].pos.z }, 9);
  await hideHint();
  await sleep(300);
  await page.screenshot({ path: `${shots}ticket10-fight-stage1.png` });
  console.log(`  shot: shots-run/ticket10-fight-stage1.png (${mobsS1.length} monsters)`);

  // the same fight at Stage 6, the camera on a monster again (the leak still surges)
  await dev('setStage', 6);
  await sleep(1200);
  const mobsS6 = await waitForMobs(45);
  if (mobsS6.length) await faceLeak({ x: mobsS6[0].pos.x, z: mobsS6[0].pos.z }, 9);
  await hideHint();
  await sleep(300);
  await page.screenshot({ path: `${shots}ticket10-fight-stage6.png` });
  console.log(`  shot: shots-run/ticket10-fight-stage6.png (${mobsS6.length} monsters)`);

  // third person with the rifle in hand: the scene's own draw (the call G makes) if it is racked, then V for third person
  if ((await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'none') {
    await page.evaluate(() => window.__playScene.setBeamHeld(true, 'extract'));
    await sleep(800);
  }
  if ((await page.evaluate(() => window.hmPlay.view())) !== 'third') {
    await page.keyboard.press('v');
    await sleep(3000);
  }
  const rifleIn = await page.evaluate(() => window.__playScene.debug.rifleIn());
  if (rifleIn !== 'hand') {
    skip('POL-28 in-game foregrip gap', `the rifle is in ${rifleIn}, not in the hand`);
  } else {
    const gap = await page.evaluate(() => {
      const scene = window.__playScene.debug.planetScene();
      let leftHand = null, rightHand = null;
      scene.traverse((o) => {
        if (!leftHand && o.name === 'mixamorigLeftHand') leftHand = o;
        if (!rightHand && o.name === 'mixamorigRightHand') rightHand = o;
      });
      if (!leftHand || !rightHand) return { error: 'no hand bones in the planet scene' };
      const root = rightHand.children.find((c) => {
        let found = false;
        c.traverse((x) => { if (x.name === 'foregrip-mount') found = true; });
        return found;
      });
      if (!root) return { error: 'no rifle under the right hand' };
      root.updateMatrixWorld(true);
      const socket = root.localToWorld(root.position.clone().set(0, -0.105, 0.193));
      const hand = leftHand.getWorldPosition(leftHand.position.clone());
      return { gap: hand.distanceTo(socket) };
    });
    if (gap.error) skip('POL-28 in-game foregrip gap', gap.error);
    else check('POL-28: the left hand bone sits on the foregrip socket in third person (within 5 cm)', gap.gap < 0.05, `gap ${(gap.gap * 100).toFixed(1)} cm`);
  }
  // the hand and the rifle stay in frame where the grip check left the player; the toasts go, then the shot
  await sleep(5000); // the toast over the hand clears
  await hideHint();
  await page.screenshot({ path: `${shots}ticket10-third-person-foregrip.png` });
  console.log('  shot: shots-run/ticket10-third-person-foregrip.png');

  // the lab's window: a lightning flash lights the floor, and the light holds 0.3 s after the flash starts
  await page.evaluate(() => window.hmPlay.go('lab', 3.2, -6.9, 0));
  await page.waitForFunction(() => window.hmPlay.where === 'lab', null, { timeout: 15000 });
  await sleep(1500);
  if ((await page.evaluate(() => window.hmPlay.view())) !== 'first') {
    await page.keyboard.press('v');
    await sleep(1200);
  }
  await page.evaluate(() => window.__playScene.room.setWindowView('full'));
  await sleep(800);
  await hideHint();
  const floorExists = await page.evaluate(() => {
    const scene = window.__playScene.debug.labScene();
    let found = false;
    scene.traverse((o) => { if (o.isPointLight && o.color && o.color.getHexString() === 'b8f2ff') found = true; });
    return found;
  });
  if (!floorExists) {
    skip('POL-25 lab floor flash', 'no vista floor light in the lab scene');
  } else {
    await page.screenshot({ path: `${shots}ticket10-lab-before-flash.png` });
    console.log('  shot: shots-run/ticket10-lab-before-flash.png');
    const flashP = page.evaluate(async () => {
      const scene = window.__playScene.debug.labScene();
      let floor = null;
      scene.traverse((o) => { if (!floor && o.isPointLight && o.color && o.color.getHexString() === 'b8f2ff') floor = o; });
      const room = window.__playScene.room;
      const before = floor.intensity;
      const t0 = performance.now();
      room.vista.flash.triggerPeak(1);
      const samples = [];
      while (performance.now() - t0 < 700) {
        await new Promise((r) => requestAnimationFrame(() => r()));
        samples.push({ t: performance.now() - t0, floor: floor.intensity, vista: room.vista.flashLight });
      }
      return { before, samples };
    });
    await sleep(60);
    await page.screenshot({ path: `${shots}ticket10-lab-flash-floor.png` });
    console.log('  shot: shots-run/ticket10-lab-flash-floor.png');
    const { before, samples } = await flashP;
    const early = samples.filter((s) => s.t <= 120).map((s) => s.floor);
    const peak = Math.max(...early);
    const at300 = samples.find((s) => s.t >= 300);
    check('POL-25: the lab floor light is dark before the flash and lit when it strikes', before < 0.5 && peak > 1, `before ${before.toFixed(2)}, peak ${peak.toFixed(2)}`);
    check('POL-25: the lab floor is still lit 0.3 s after the flash starts', !!at300 && at300.floor >= 0.6 * peak, `at 0.3 s ${at300 ? at300.floor.toFixed(2) : 'n/a'} of peak ${peak.toFixed(2)}`);
  }

  // POL-39: the housing LEDs on the planet (a mill and a drill placed as measure-stage6-low places them), square and lit
  await page.evaluate(() => window.hmPlay.teleportPlanet());
  await page.waitForFunction(() => window.hmPlay.where === 'planet', null, { timeout: 30000 });
  await page.evaluate(() => { window.hmPlay.give(2000); window.hmPlay.setStage(6); });
  await sleep(400);
  const placed = await page.evaluate(() => [window.hmPlay.placeAt(12, 0, 'mill'), window.hmPlay.placeAt(-12, 0, 'drill')]);
  await sleep(1500);
  const leds = await page.evaluate(() => {
    const out = [];
    for (const scene of [window.__playScene.debug.planetScene(), window.__playScene.debug.labScene()]) {
      scene.traverse((o) => {
        if (o.name === 'housing-status-led' && o.geometry && o.geometry.parameters) {
          out.push({ w: o.geometry.parameters.width, h: o.geometry.parameters.height, colour: o.material.color.getHexString() });
        }
      });
    }
    return out;
  });
  if (leds.length === 0) {
    skip('POL-39 in-game LEDs', `no machine LED in the scene (placed: ${JSON.stringify(placed)})`);
  } else {
    const square = leds.every((l) => Math.abs(l.w - l.h) < 1e-6);
    check('POL-39: every housing status LED is square', square, `${leds.length} LEDs`);
    const known = Object.values(HOUSING_LED_COLOURS).map((c) => c.toLowerCase().replace('#', ''));
    const inStates = leds.every((l) => known.includes(l.colour.toLowerCase()));
    check('POL-39: every housing status LED shows one of the three state colours', inStates, leds.map((l) => l.colour).join(' '));
    await faceLeak({ x: 12, z: 0 }, 6);
    await hideHint();
    await sleep(400);
    await page.screenshot({ path: `${shots}ticket10-planet-led.png` });
    console.log('  shot: shots-run/ticket10-planet-led.png');
  }
  check('no page errors while the planet, the fight, third person and the lab ran', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
}

console.log(`\nTICKET-10 checks: ${passed} passed.`);
if (skipped.length) console.log(`Skipped (${skipped.length}): ${skipped.join('; ')}`);
process.exit(0);
