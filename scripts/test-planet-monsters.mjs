/**
 * Automated Playwright check for the monsters on the planet (TASK-23b-2; keeps the TASK-20 checks and adds the leak flow).
 * - serves apps/web/dist on port 8199 and boots http://localhost:8199/?mash&e2e (the planet, the monsters unlocked by the fixture)
 * - the Monster Mash panel and button are gone, and the words are not on the screen
 * - the gate: no wave before the first gun (F-03), and nothing spawns under Off
 * - a leak warns, then a wave comes; the gate's dome holds the monsters out; out of it every hit follows a wind-up
 * - a kill drops its substrate on the bridge; the loadouts fire through the leaks (long barrel, scatter, burst)
 * - a held seal ends a leak's waves for good; the dormant anomaly drops the first Anomaly Core
 * - health: a hit takes it down, low at 30 percent, death sends the player back to the gate at full health
 * - the fidelity looks, and the fps with eight fighting (headless: SwiftShader, not the owner's GPU)
 * Writes docs/shots/planet-*.png. Exits 1 on the first failed check, and kills its server and browser.
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
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shots = fileURLToPath(new URL('../docs/shots/', import.meta.url));
fs.mkdirSync(shots, { recursive: true });
const port = 8199;
console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
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

let passed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`OK: ${name}${detail ? ` (${detail})` : ''}`);
};
const dev = (fn, ...args) => page.evaluate(([name, a]) => window.__dev[name](...a), [fn, args]);
const stepSec = (s) => page.evaluate((x) => window.__dev.stepMonsters(x), s);
const hm = (fn, ...args) => page.evaluate(([name, a]) => window.hmPlay[name](...a), [fn, args]);
const spawnedTotal = async () => (await dev('stats')).mobsSpawned;
// turns the view to a leak from `dist` metres away (the view's yaw is the quarter turn that points at it)
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
  await page.waitForTimeout(400);
  return best.dot;
};
const leakById = async (id) => (await dev('leaks')).find((l) => l.id === id);

try {
  await page.goto(`http://localhost:${port}/?mash&e2e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev, null, { timeout: 35000 });

  const oldUi = (await page.locator('.play-mash-btn').count()) + (await page.locator('.play-mash-panel').count());
  const words = await page.evaluate(() => /monster mash/i.test(document.body.innerText));
  check('the Monster Mash button and panel are gone, and the name is not on the screen', oldUi === 0 && !words, `old controls ${oldUi}`);
  await page.screenshot({ path: `${shots}planet-mash-initial.png` });

  // the gun: the shotgun in hand, the crosshair up
  await dev('equip', 'shotgun', true);
  await page.waitForTimeout(300);
  check('the shotgun equips and the crosshair shows', await page.locator('.play-crosshair').isVisible());

  // the F-03 gate: no wave before the first gun, however the setting reads
  await dev('setStage', 1);
  await dev('unlockMonsters', false);
  await dev('setMonstersSetting', 'normal');
  const gateStart = await spawnedTotal();
  await stepSec(60);
  check('no wave before the first gun (F-03 holds the fight)', (await spawnedTotal()) === gateStart, `spawned ${await spawnedTotal()}`);

  // Off: no leaks open, nothing spawns (the leaks still sit there for the beam)
  await dev('unlockMonsters', true);
  await page.waitForTimeout(300);
  await dev('setMonstersSetting', 'off');
  const offStart = await spawnedTotal();
  await stepSec(60);
  check('Monsters Off spawns nothing', (await spawnedTotal()) === offStart);

  // Normal: a leak warns, then the wave comes
  await dev('setMonstersSetting', 'normal');
  await stepSec(1);
  const leaks = await dev('leaks');
  const live = leaks.filter((l) => !l.dormant && l.state !== 'sealed');
  const warned = live.find((l) => l.state === 'warned' && l.inSeconds !== null && l.inSeconds <= 20);
  check('a leak warns with its countdown', !!warned, warned ? `surge in ${warned.inSeconds.toFixed(1)} s` : `${live.length} live leaks`);
  const warnedLeak = (await dev('leaks')).find((l) => !l.dormant && l.state === 'warned') ?? warned;
  await faceLeak(warnedLeak, 12);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}planet-leak-warned.png` });
  const beforeWave = await spawnedTotal();
  await stepSec(22);
  check('then the wave comes', (await spawnedTotal()) > beforeWave, `spawned ${beforeWave} -> ${await spawnedTotal()}`);

  // the gate's dome holds the monsters out: the player inside the dome is never hit
  const g = await dev('gate');
  const hitsInside0 = (await dev('stats')).hitsOnPlayer;
  check('the gate pad is found', !!g);
  await page.evaluate(([x, z]) => window.hmPlay.teleport('planet', x, z - 2, 0, 0), [g.x, g.z]);
  await stepSec(30);
  check('the gate dome holds the monsters out (no hit on a player inside it)', (await dev('stats')).hitsOnPlayer === hitsInside0, `hits ${hitsInside0} -> ${(await dev('stats')).hitsOnPlayer}`);

  // out of the dome, beside a live leak: the monsters come, and every hit has its wind-up first
  const target = (await dev('leaks')).find((l) => !l.dormant && l.state !== 'sealed');
  await page.evaluate(([x, z]) => window.hmPlay.teleport('planet', x + 8, z, 0, 0), [target.x, target.z]);
  await stepSec(30);
  // a fight in view: the view turned to a leak from 16 m (outside the dome), three brutes placed ahead, a wind-up ring showing
  await faceLeak(target, 16);
  await page.evaluate(() => window.hmPlay.setLocked(true));
  await page.waitForTimeout(3500);
  await dev('setHp', 100);
  for (const d of [7, 9, 11]) await dev('placeMob', 'brute', d);
  await stepSec(0.6);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}planet-fight-world.png` });
  const st = await dev('stats');
  check('out of the dome, the monsters strike', st.hitsOnPlayer > 0, `hits ${st.hitsOnPlayer}`);
  check('every hit follows a wind-up (telegraphs are at least the hits)', st.telegraphs >= st.hitsOnPlayer && st.telegraphs > 0, `telegraphs ${st.telegraphs}, hits ${st.hitsOnPlayer}`);
  await page.screenshot({ path: `${shots}planet-leak-fight.png` });

  // a kill drops its substrate on the bridge
  const stock0 = await dev('bridgeStock');
  const charger = await dev('placeMob', 'charger', 6);
  const hurt = await dev('hurtMob', charger, 9999);
  check('a kill (the death path) reports the kill', !!hurt && hurt.killed === true);
  const stock1 = await dev('bridgeStock');
  check('a charger drops raw pixels on the bridge', (stock1['pxd-mono'] ?? 0) - (stock0['pxd-mono'] ?? 0) === 4, `pixels ${stock0['pxd-mono'] ?? 0} -> ${stock1['pxd-mono'] ?? 0}`);

  // the loadouts: the gun fires through the leaks (the monsters are asleep for these shots, under Off)
  await dev('setMonstersSetting', 'off');
  await dev('setWeapon', { core: 'core-semi', barrel: 'barrel-long', sight: 'sight-iron', cell: 'cell-compact' });
  await dev('placeMob', 'charger', 6);
  const longShot = await dev('fire');
  check('a long barrel lands exactly one pellet at a monster', longShot && longShot.fired && longShot.hits === 1, `hits ${longShot?.hits}`);
  await stepSec(1);
  await dev('setWeapon', { core: 'core-semi', barrel: 'barrel-scatter', sight: 'sight-iron', cell: 'cell-compact' });
  await dev('placeMob', 'brute', 6);
  const scatterShot = await dev('fire');
  check('a scatter barrel lands its pellets (between 2 and 7)', scatterShot && scatterShot.hits >= 2 && scatterShot.hits <= 7, `hits ${scatterShot?.hits}`);
  await stepSec(1);
  await dev('setWeapon', { core: 'core-burst', barrel: 'barrel-scatter', sight: 'sight-iron', cell: 'cell-compact' });
  const shots0 = (await dev('stats')).shotsFired;
  await dev('fire');
  await stepSec(1);
  check('a burst core fires three shots on the sim clock', (await dev('stats')).shotsFired - shots0 === 3, `shots ${(await dev('stats')).shotsFired - shots0}`);
  await dev('setWeapon', { core: 'core-semi', barrel: 'barrel-scatter', sight: 'sight-iron', cell: 'cell-compact' });
  await dev('setMonstersSetting', 'normal');

  // a held seal ends a leak's waves for good (the beam's Seal, within reach)
  const seal = (await dev('leaks')).find((l) => !l.dormant && (l.state === 'open' || l.state === 'warned'));
  check('a live leak to seal', !!seal);
  // the seal is held in peace: the wave from this leak would kill the player six metres away (a death pulls them back to the gate)
  await dev('setMonstersSetting', 'off');
  await page.evaluate(([x, z]) => window.hmPlay.teleport('planet', x + 6, z, 0, 0), [seal.x, seal.z]);
  await page.waitForTimeout(400);
  await dev('sealLeak', seal.id, 9);
  await dev('setMonstersSetting', 'normal');
  const sealed = await leakById(seal.id);
  check('a held seal shuts the leak', sealed?.state === 'sealed', `state ${sealed?.state} seal ${sealed?.seal?.toFixed(2)}`);
  await faceLeak(seal, 12);
  // the sealed leak in view, once the seal's toast has gone (the before and after pair is planet-leak-warned and this one)
  await page.evaluate(() => window.hmPlay.setLocked(true));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${shots}planet-leak-sealed.png` });
  await stepSec(90);
  check('a sealed leak stays shut (no more waves from it)', (await leakById(seal.id))?.state === 'sealed');

  // the dormant anomaly: no spawns, and the seal gives the first Anomaly Core and closes A4-01b
  await hm('grindCount', 'drill:running', 1);
  await hm('grindCount', 'tool:pickup', 1);
  await page.waitForTimeout(600);
  await stepSec(1);
  const dormant = (await dev('leaks')).find((l) => l.dormant);
  check('the dormant anomaly appears once the rifle is taken', !!dormant && dormant.state === 'dormant');
  const core0 = (await dev('bridgeStock'))['anomaly-core'] ?? 0;
  await page.evaluate(([x, z]) => window.hmPlay.teleport('planet', x + 6, z, 0, 0), [dormant.x, dormant.z]);
  await stepSec(40);
  check('the dormant anomaly stays dormant (zero spawns, no warning)', (await leakById(dormant.id))?.state === 'dormant');
  await dev('sealLeak', dormant.id, 9);
  const coreAfter = (await dev('bridgeStock'))['anomaly-core'] ?? 0;
  const cs = await hm('chainState');
  check('sealing the dormant anomaly drops the first Anomaly Core', coreAfter - core0 === 1, `cores ${core0} -> ${coreAfter}`);
  check('and it closes the dormant-seal step (A4-01b)', (cs.counts?.['leak:dormant:sealed'] ?? 0) >= 1);

  // health: a hit takes it down; low at 30; death sends the player back to the gate at full health
  await dev('setHp', 100);
  await dev('hit', 60, 0);
  check('a hit takes health down', (await dev('vitals')).hp === 40, `hp ${(await dev('vitals')).hp}`);
  await dev('hit', 20, 0.5);
  check('at 30 percent or under the player is low', (await dev('vitals')).low === true, `hp ${(await dev('vitals')).hp}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}planet-health-low.png` });
  const deaths0 = (await hm('chainState')).counts?.deaths ?? 0;
  await dev('hit', 999, 0);
  const v = await dev('vitals');
  check('death sends the player back to the gate at full health, and counts the death', v.hp === 100 && ((await hm('chainState')).counts?.deaths ?? 0) === deaths0 + 1, `hp ${v.hp}`);

  // the fidelity looks
  for (const [stage, name] of [[0, 'dither'], [4, 'pbr']]) {
    await dev('fidelity', stage);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${shots}planet-mash-${name}.png` });
    console.log(`Captured docs/shots/planet-mash-${name}.png (stage ${stage})`);
  }
  await dev('fidelity', 2);

  // fps with eight fighting (headless SwiftShader: a number for the trend, not the owner's GPU)
  await dev('setHp', 100);
  for (let i = 0; i < 8; i++) await dev('placeMob', i % 2 ? 'brute' : 'charger', 14 + i);
  await dev('setMonstersSetting', 'hard');
  await stepSec(2);
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      frames += 1;
      if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
      else resolve(frames / ((performance.now() - t0) / 1000));
    };
    requestAnimationFrame(tick);
  }));
  console.log(`fps with eight monsters on the planet (headless, SwiftShader): ${fps.toFixed(1)}`);

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  console.log(`ALL PLANET MONSTER CHECKS PASSED (${passed})`);
} catch (err) {
  console.error(String(err && err.message ? err.message : err));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
