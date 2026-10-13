/**
 * TASK-21 and TASK-21b: the extraction rifle held in hand. On a kit boot (?base&kit=1) on the planet:
 *   1 G draws the rifle: the first-person view model, the mode chip, and no build readout while it is out;
 *   2 Q cycles Extract, Apply, Sculpt (the chip follows), each mode shot in first person;
 *   3 Extract mines: a field node the held rifle reaches loses reserve, and a boulder it is aimed at loses ore (about 4 ore a
 *     second on rock, more on scree) while the left button is held;
 *   4 R reloads the port from the lab rack: a written cartridge the rack holds goes into the port, and the port shows its name;
 *   5 Apply paints the loaded preset under the aim point (cells painted, no ore spent);
 *   6 V puts the rifle in the character's right hand (third person), the rifle clips play, and the character stands on the ground;
 *   7 the frame rate over two seconds in each mode (headless, SwiftShader: not the GTX 950M).
 * Shots are gitignored (docs/shots/beam/), overlays hidden. Each shot is looked at before it is posted.
 * Exit code 1 when a check fails.
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
const shotsDir = path.join(root, 'docs/shots/beam');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8198;
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  // the left button reaches the game only under pointer lock: the test reports the canvas as locked
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return document.querySelector('canvas.play-canvas'); },
  });
  // a fresh profile on the first load only; the reload below keeps the save it made
  try {
    if (!sessionStorage.getItem('beam-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('beam-test-booted', '1');
    }
    // the rifle is racked until its campaign step (A4-01, the cartridge rack) is done: the test marks that step done in the save
    // (the counter, the quest and the step), so G takes the rifle out
    const raw = localStorage.getItem('hm.setmix.play');
    if (raw && !sessionStorage.getItem('beam-test-a4')) {
      const r = JSON.parse(raw);
      r.chain.counts['tool:pickup'] = 1;
      r.chain.counts['drill:running'] = 1;
      r.chain.progress.quest = 'act4';
      r.chain.progress.step = 1;
      localStorage.setItem('hm.setmix.play', JSON.stringify(r));
      sessionStorage.setItem('beam-test-a4', '1');
    }
  } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const HIDE = '.mentor-subtitle, .radio-hud-btn, .play-goal, .play-sync, .play-sync-indicator, .play-hud-hotbar, .hm-hotbar, .gr-bar, .play-dot, .hm-shelter-chip, .play-crosshair, .play-toast, .play-prompt, .play-plot, .play-build-reticle, .hm-beam-chip, .hm-build-readout-hud { display: none !important; }';
const shot = async (file) => {
  await page.addStyleTag({ content: HIDE });
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.screenshot({ path: path.join(shotsDir, file) });
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
};
const chip = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="beam-mode"]');
    return el ? { mode: el.getAttribute('data-mode'), port: el.getAttribute('data-port'), text: el.textContent } : null;
  });
const buildReadout = () => page.evaluate(() => document.querySelector('[data-testid="build-readout-hud"]') !== null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Frames drawn in `ms` milliseconds (requestAnimationFrame), to read the frame rate. */
const fps = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n += 1;
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve(Math.round((n * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

try {
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  // the boot is slow on a loaded PC (the build is one 18 MB file): give it time before the checks start
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 90000 });
  // the first load wrote the save; reload so the init script marks the rifle's step done in it
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 15000 });
  await page.mouse.click(640, 360);

  check('no rifle chip before G', (await chip()) === null);
  const readoutBefore = await buildReadout();
  check('the build readout shows while the rifle is racked', readoutBefore, readoutBefore ? '' : 'the kit blueprint is not held');

  // 1. G draws the rifle
  await page.keyboard.press('g');
  await page.waitForFunction(() => document.querySelector('[data-testid="beam-mode"]') !== null, null, { timeout: 4000 }).then(
    () => check('G takes the rifle out (the chip appears)', true),
    () => check('G takes the rifle out (the chip appears)', false, 'no chip'),
  );
  let c = await chip();
  check('the rifle starts in Extract', c?.mode === 'extract', c ? c.text : 'no chip');
  check('the rifle is the first-person view model', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'view');
  check('the build readout hides while the rifle is out', !(await buildReadout()));
  await wait(300);
  check('the held blueprint\'s ghost hides while the rifle is out', !(await page.evaluate(() => window.__playScene.debug.pieceGhostShown())));
  await page.waitForTimeout(400);
  await shot('01-extract-first-person.png');

  // 2. Q cycles the modes
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q moves the rifle to Apply', c?.mode === 'apply', c?.mode ?? 'none');
  await shot('02-apply-first-person.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q moves the rifle to Sculpt', c?.mode === 'sculpt', c?.mode ?? 'none');
  await shot('03-sculpt-first-person.png');
  await page.keyboard.press('q');
  await page.waitForTimeout(200);
  c = await chip();
  check('Q wraps back to Extract', c?.mode === 'extract', c?.mode ?? 'none');

  // 3. Extract mines a field node the held rifle reaches
  const node = await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const n = api.world().field.nodes.filter((x) => x.reserve > 0).sort((a, b) => Math.hypot(a.x - 12, a.z - 12) - Math.hypot(b.x - 12, b.z - 12))[0];
    return n ? { id: n.id, x: n.x, z: n.z, reserve: n.reserve } : null;
  });
  check('a field node with ore is on the planet', !!node, node ? `reserve ${node.reserve}` : 'none');
  const worn = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().equipment.beam?.item ?? null);
  check('the extraction beam is worn (the equipment slot)', worn === 'tool-beam', `slot holds ${worn}`);
  if (node) {
    await page.evaluate((node) => {
      const scene = window.__playScene;
      const api = window.__hm?.base ?? window.hmPlay?.base;
      const px = node.x, pz = node.z + 2.8;
      const camY = scene.heightAt(px, pz) + 1.7;
      const nodeY = scene.heightAt(node.x, node.z) + 0.35;
      const dx = node.x - px, dz = node.z - pz;
      scene.debug.teleport('planet', px, pz, Math.atan2(-dx, -dz), Math.atan2(nodeY - camY, Math.max(0.1, Math.hypot(dx, dz))));
      api.startBeam?.(node.id);
    }, node);
    await page.waitForTimeout(1500);
    const after = await page.evaluate((id) => {
      const api = window.__hm?.base ?? window.hmPlay?.base;
      return api.world().field.nodes.find((x) => x.id === id)?.reserve ?? null;
    }, node.id);
    check('the held rifle in Extract lowers the node\'s reserve', after !== null && after < node.reserve, `${node.reserve} to ${after}`);
    await page.evaluate(() => window.__hm?.base?.stopBeam?.() ?? window.hmPlay?.base?.stopBeam?.());
  }

  // 3b. Extract mines a boulder the rifle is aimed at (left button held, out to 25 m)
  const boulder = await page.evaluate(() => {
    const s = window.__playScene;
    const p = s.debug.position();
    const bs = window.hmPlay.boulders().filter((b) => b.ore >= 39).map((b) => ({ ...b, d: Math.hypot(b.x - p.x, b.z - p.z) })).filter((b) => b.d > 8 && b.d < 30).sort((a, b) => a.d - b.d);
    const b = bs[0];
    if (!b) return null;
    const dx = b.x - p.x, dz = b.z - p.z, L = Math.hypot(dx, dz);
    const px = b.x - (dx / L) * 7, pz = b.z - (dz / L) * 7;
    const eye = s.heightAt(px, pz) + 1.7;
    s.debug.teleport('planet', px, pz, Math.atan2(-dx, -dz), Math.atan2(b.y + b.size * 0.4 - eye, 7));
    return { id: b.id };
  });
  check('a boulder with ore is in reach of the rifle', !!boulder);
  if (boulder) {
    await page.waitForTimeout(600);
    const boulderOre = (id) => page.evaluate((id) => window.hmPlay.boulders().find((b) => b.id === id)?.ore ?? null, boulder.id);
    const plotOre = () => page.evaluate(() => window.hmPlay.plot().ore);
    const b0 = await boulderOre(boulder.id);
    const p0 = await plotOre();
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const b1 = await boulderOre(boulder.id);
    const p1 = await plotOre();
    const taken = (b0 ?? 0) - (b1 ?? 0);
    check('the rifle takes ore from the boulder it is aimed at (the boulder shrinks)', taken > 2, `${b0} to ${b1}`);
    check('the ore reaches the plot', p1 > p0, `plot ${p0.toFixed(1)} to ${p1.toFixed(1)}`);
  }

  // 4. R reloads the port from the lab rack (the preset opens at stage 1, so the plot is raised to 4 first)
  await page.evaluate(() => window.hmPlay.setStage(4));
  await wait(7000);
  const rackBefore = await page.evaluate(() => {
    const h = window.hmPlay;
    const count = () => h.lab().cartridges.filter((c) => c.kind === 'preset' && c.slot === null).length;
    const before = count();
    if (before === 0) {
      h.give(300);
      const made = h.makeBlank();
      const blank = made.state.cartridges.find((c) => c.kind === 'blank' && c.slot === null);
      if (blank) h.startWrite(blank.id, 'crater_calcite');
      for (let i = 0; i < 60 && count() === 0; i++) h.labStep(2);
    }
    return { before, after: count() };
  });
  check('the lab rack holds a written cartridge to load', rackBefore.after > 0, `rack ${rackBefore.after}`);
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  c = await chip();
  check('R loads the written cartridge into the port (the chip shows its name)', !!c?.port, c?.port ? `port ${c.port}` : 'empty');
  const rackAfter = await page.evaluate(() => window.hmPlay.lab().cartridges.filter((cc) => cc.kind === 'preset' && cc.slot === null).length);
  check('the cartridge leaves the rack', rackAfter === rackBefore.after - 1, `rack ${rackBefore.after} to ${rackAfter}`);

  // 5. Apply paints under the aim point (away from the gate pad, so the paint shows)
  await page.keyboard.press('q');
  for (let presses = 0; presses < 3 && (await chip())?.mode !== 'apply'; presses++) {
    await page.keyboard.press('q');
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 60, 60, 0.3, -0.5));
  await wait(500);
  c = await chip();
  check('the rifle is in Apply', c?.mode === 'apply', c?.mode ?? 'none');
  await shot('04-apply-first-person.png');
  const painted0 = await page.evaluate(() => window.__playScene.debug.paintedCells());
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const painted1 = await page.evaluate(() => window.__playScene.debug.paintedCells());
  check('Apply paints the plot ground under the aim point', painted1 > painted0, `${painted0} to ${painted1} cells`);
  await shot('05-apply-painted-first-person.png');

  // 6. V puts the rifle in the character's hand (third person), the rifle clips play
  await page.keyboard.press('v');
  await wait(3000);
  check('V puts the rifle in the character\'s hand', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'hand');
  const weights = await page.evaluate(() => ({
    idle: window.hmPlay.clipWeight('rifle-idle') + window.hmPlay.clipWeight('rifle-aiming-idle'),
    unarmed: window.hmPlay.clipWeight('breathing-idle'),
  }));
  check('the rifle clips play in third person (the rifle idle is on, the unarmed idle is off)', weights.idle > 0.5 && weights.unarmed < 0.1, JSON.stringify(weights));
  const av = await page.evaluate(() => ({ ...window.__playScene.debug.avatar(), ground: window.__playScene.heightAt(window.__playScene.debug.avatar().at[0], window.__playScene.debug.avatar().at[2]) }));
  const height = av.box[1][1] - av.box[0][1];
  check('the character stands on the ground: its feet on the ground under it, and about 1.7 m tall', Math.abs(av.box[0][1] - av.ground) < 0.15 && height > 1.4 && height < 2.0, `feet ${av.box[0][1].toFixed(2)}, ground ${av.ground.toFixed(2)}, height ${height.toFixed(2)}`);
  await shot('06-apply-third-person.png');
  await page.keyboard.press('q');
  await wait(400);
  await shot('07-sculpt-third-person.png');
  await page.keyboard.press('q');
  await wait(400);
  await shot('08-extract-third-person.png');
  await page.keyboard.press('v');
  await wait(400);
  check('V puts the rifle back in the view', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'view');

  // 7. the frame rate per mode (headless: SwiftShader, not the GTX 950M)
  const rates = {};
  for (const mode of ['extract', 'apply', 'sculpt']) {
    for (let presses = 0; presses < 6 && (await chip())?.mode !== mode; presses++) {
      await page.keyboard.press('q');
      await wait(120);
    }
    rates[mode] = await fps(2000);
  }
  console.log('fps (headless, SwiftShader):', JSON.stringify(rates));
  check('the scene keeps drawing in every mode', Object.values(rates).every((r) => r > 0), JSON.stringify(rates));

  // 8. G holsters the rifle
  await page.keyboard.press('g');
  await wait(400);
  check('G holsters the rifle (the chip goes, the view model goes)', (await chip()) === null && (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'none');
} catch (err) {
  check('the run completes', false, err.message);
} finally {
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
