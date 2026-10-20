/**
 * TASK-21, 21b, 21c and 21d: the extraction rifle held in hand. On a kit boot (?base&kit=1) on the planet:
 *   1 G draws the rifle: the first-person view model, the mode chip, and no build readout while it is out;
 *   1b the rim and the floor are on at stage 1 (P0-LIGHT-01), and a mouse flick sways the view model, which settles (21d);
 *   2 Q cycles Extract, Apply, Sculpt (the chip follows), each mode shot in first person;
 *   3 Extract mines: a field node the held rifle reaches loses reserve, and a boulder it is aimed at loses ore (about 4 ore a
 *     second on rock, more on scree) while the left button is held; the stream of chunks runs from the boulder to the muzzle (21d);
 *   3c the rifle in the character's hand at stage 1: the rim and the floor light the character (21d, a shot);
 *   4 R reloads the port from the lab rack: a written cartridge the rack holds goes into the port, and the port shows its name;
 *   5 Apply paints the loaded preset under the aim point (cells painted, no ore spent);
 *   5b Sculpt (21d): the ring takes Sculpt's colour; carve digs the ground under the aim and gains ore; Raise, picked on the X radial
 *     (TICKET-04), builds it up and spends ore; Smooth costs no ore; the gate pad is kept out; the ring takes each mode's colour and
 *     Seal's amber; the cut, the paint and the port survive a reload;
 *   6 V puts the rifle in the character's hand (third person), the rifle clips play, and the character stands on the ground;
 *   7 the frame rate over two seconds in each mode with the beam firing (the left button held: a boulder, the paint, the cut);
 *   8 G holsters the rifle.
 * Shots are gitignored (shots-run/beam/), overlays hidden. Each shot is looked at before it is posted.
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
const shotsDir = path.join(root, 'shots-run/beam');
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
    // the Low section (9) boots on the Low tier: the profile's quality is set before the game reads it
    if (sessionStorage.getItem('beam-test-low')) {
      const profile = JSON.parse(localStorage.getItem('hm.profile.v2') || 'null');
      if (profile && profile.quality !== 'low') {
        profile.quality = 'low';
        localStorage.setItem('hm.profile.v2', JSON.stringify(profile));
      }
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
const HIDE = '.mentor-subtitle, .radio-hud-btn, .play-goal, .play-sync, .play-sync-indicator, .play-hud-hotbar, .hm-hotbar, .hm-hotbar-container, [data-testid="base-hotbar"], .hm-weapon-hud-badge, [data-testid="weapon-hud-badge"], .hm-harvest-counter, [data-testid="base-harvest-counter"], .gr-bar, .play-dot, .hm-shelter-chip, .play-crosshair, .play-toast, .play-prompt, .play-plot, .play-build-reticle, .hm-beam-chip, .hm-build-readout-hud { display: none !important; }';
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
    return el ? { mode: el.getAttribute('data-mode'), port: el.getAttribute('data-port'), tool: el.getAttribute('data-tool'), text: el.textContent } : null;
  });
const buildReadout = () => page.evaluate(() => document.querySelector('[data-testid="build-readout-hud"]') !== null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ring = () => page.evaluate(() => window.__playScene.debug.ringColour());
const edit = (p) => page.evaluate(([x, z]) => window.__playScene.debug.groundEdit(x, z), [p.x, p.z]);
const aimAt = () => page.evaluate(() => window.__playScene.beamAim(25));
const plotOre = () => page.evaluate(() => window.hmPlay.plot().ore);
/**
 * Picks a sculpt tool on the X radial (TICKET-04: keys 1 to 9 always pick the hotbar, X picks carve, raise or smooth): X down with the
 * mouse parked in a corner, hover the slice, release X. The test reports the canvas as locked, so the mouse moves can turn the view:
 * the Apply and Sculpt pose (60, 60, yaw 0.3, pitch -0.5) is put back after the pick, so the stroke lands on the same aim point.
 */
const pickSculptTool = async (tool) => {
  await page.mouse.move(4, 4);
  await page.keyboard.down('x');
  await page.locator('[data-testid="radial-menu"]').waitFor({ state: 'visible', timeout: 4000 });
  await wait(150);
  await page.locator(`[data-testid="radial-slice-${tool}"]`).hover();
  await wait(120);
  await page.keyboard.up('x');
  await wait(250);
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 60, 60, 0.3, -0.5));
  await wait(300);
};
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

/** Boots the planet from the kit: waits for the game, teleports onto the planet, and captures the mouse (the test stubs the lock). */
const bootPlanet = async () => {
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  // the boot is slow on a loaded PC (the build is one 18 MB file): give it time before the checks start
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 15000 });
  await page.mouse.click(640, 360);
};

try {
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 90000 });
  // the first load wrote the save; reload so the init script marks the rifle's step done in it
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bootPlanet();
  // the tier the per-mode numbers below are taken on (the headless browser's own choice unless the profile names one)
  console.log(`tier of the per-mode numbers: ground budget ${await page.evaluate(() => window.__playScene.debug.detail().groundBudget)} triangles`);

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

  // 1b. the rim and the floor are on in stage 1 (P0-LIGHT-01); a mouse flick sways the view model, and it settles (P0-VFX-01)
  check('the rim and the floor are on at stage 1 (the rifle and the character stay lit)', await page.evaluate(() => window.__playScene.debug.rimFloorOn()));
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 60, movementY: 0 })));
  await wait(60);
  const flick = await page.evaluate(() => window.__playScene.debug.rifleFeelOffset());
  check('a mouse flick sways the view model', Math.abs(flick[0] ?? 0) > 0.001, JSON.stringify(flick.map((v) => Number(v.toFixed(4)))));
  await wait(2500);
  const settled = await page.evaluate(() => window.__playScene.debug.rifleFeelOffset());
  check('the sway settles back to rest', Math.abs(settled[0] ?? 1) < 0.002 && Math.abs(settled[1] ?? 1) < 0.002, JSON.stringify(settled.map((v) => Number(v.toFixed(4)))));

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
    const b0 = await boulderOre(boulder.id);
    const p0 = await plotOre();
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(800);
    const streamOn = await page.evaluate(() => window.__playScene.debug.streamShown());
    check('Extract draws the stream of chunks from the boulder to the muzzle while it mines (21d)', streamOn === true, `stream ${streamOn}`);
    await shot('03b-extract-stream-first-person.png');
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const b1 = await boulderOre(boulder.id);
    const p1 = await plotOre();
    const taken = (b0 ?? 0) - (b1 ?? 0);
    check('the rifle takes ore from the boulder it is aimed at (the boulder shrinks)', taken > 2, `${b0} to ${b1}`);
    check('the ore reaches the plot', p1 > p0, `plot ${p0.toFixed(1)} to ${p1.toFixed(1)}`);
    check('the stream stops when the beam stops', (await page.evaluate(() => window.__playScene.debug.streamShown())) === false);
  }

  // 3c. in the character's hand at stage 1 (the rim and the floor on the character), before the stage is raised
  await page.keyboard.press('v');
  await wait(3000);
  check('V puts the rifle in the hand (stage 1)', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'hand');
  await shot('03c-extract-third-person-stage1.png');
  await page.keyboard.press('v');
  await wait(400);

  // 4. R reloads the port from the lab rack (the preset opens at stage 1, so the plot is raised to 4 first)
  await page.evaluate(() => window.hmPlay.setStage(4));
  await wait(7000);
  // the shown stage (and the rim with it) changes when the wave has passed: poll, up to 20 s
  const rimOff = await page.waitForFunction(() => window.__playScene.debug.rimFloorOn() === false, null, { timeout: 20000, polling: 250 }).then(() => true).catch(() => false);
  check('the rim and the floor switch off once stage 3 is shown (the lit ground does the work)', rimOff);
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
  const portName = (await chip())?.port ?? '';
  const paintedBeforeSave = painted1;

  // 5b. Sculpt (21d): carve, raise and smooth on the ground under the aim point; the gate pad kept out; the ring's colours
  await page.keyboard.press('q');
  await wait(250);
  c = await chip();
  check('Q moves the rifle to Sculpt, with the Carve tool', c?.mode === 'sculpt' && c?.tool === 'carve', `${c?.mode} ${c?.tool}`);
  check('the ground ring is in Sculpt\'s colour (#7cff4d)', (await ring()) === '#7cff4d', `ring ${await ring()}`);
  await shot('06-sculpt-ring-first-person.png');
  const aim0 = await aimAt();
  check('the beam has a ground point to cut', !!aim0, aim0 ? `(${aim0.x.toFixed(1)}, ${aim0.z.toFixed(1)})` : 'none');
  const e0 = await edit(aim0);
  const o0 = await plotOre();
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const e1 = await edit(aim0);
  const o1 = await plotOre();
  check('Carve digs the ground under the aim point (the height drops)', e1 < e0 - 0.05, `${e0.toFixed(2)} m to ${e1.toFixed(2)} m`);
  check('Carve gains ore (the plot\'s ore rises)', o1 > o0, `ore ${o0.toFixed(1)} to ${o1.toFixed(1)}`);
  check('the cut is counted in the sculpted cells', (await page.evaluate(() => window.__playScene.debug.sculptedCells())) > 0);
  // the chunks are re-planned as the eye moves, and the cut is drawn once they settle (a stale chunk can stand over it until then)
  const groundSettledNow = await page.waitForFunction(() => window.__playScene.debug.groundSettled() === true, null, { timeout: 15000, polling: 200 }).then(() => true).catch(() => false);
  check('the ground settles after the cut (every wanted chunk built, none stale)', groundSettledNow);
  // the drawn ground follows the cut: the chunk meshes under the aim (a ray down through them) are at the sculpted height
  const surf = await page.evaluate(([x, z]) => ({ mesh: window.__playScene.debug.surfaceAt(x, z), height: window.__playScene.heightAt(x, z) }), [aim0.x, aim0.z]);
  check('the drawn ground follows the cut: the chunk mesh under the aim is at the sculpted height (21d)', surf.mesh !== null && Math.abs(surf.mesh - surf.height) < 0.06, `mesh ${surf.mesh === null ? 'none' : surf.mesh.toFixed(3)} m, height ${surf.height.toFixed(3)} m`);
  await shot('07-sculpt-carved-first-person.png');

  await pickSculptTool('raise');
  c = await chip();
  check('the X radial picks Raise in Sculpt (the chip shows it)', c?.tool === 'raise', c?.tool ?? 'none');
  const e2 = await edit(aim0);
  const o2 = await plotOre();
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const e3 = await edit(aim0);
  const o3 = await plotOre();
  check('Raise builds the ground up under the aim point (the height rises)', e3 > e2 + 0.05, `${e2.toFixed(2)} m to ${e3.toFixed(2)} m`);
  check('Raise spends ore (the plot\'s ore falls)', o3 < o2, `ore ${o2.toFixed(1)} to ${o3.toFixed(1)}`);

  await pickSculptTool('smooth');
  c = await chip();
  check('the X radial picks Smooth', c?.tool === 'smooth', c?.tool ?? 'none');
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await page.waitForTimeout(300);
  // the machines draw the plot's ore too, so the stroke is read on its own: a smooth returns the same balance it was given
  const smooth = await page.evaluate(([x, z]) => window.__playScene.beamSculpt(x, z, 'smooth', 0.5, 50), [aim0.x, aim0.z]);
  check('Smooth costs no ore (its stroke leaves the balance as it was)', smooth.ore === 50 && smooth.gained === 0, JSON.stringify(smooth));
  await pickSculptTool('carve');
  check('the X radial picks Carve again', (await chip())?.tool === 'carve');

  // a low look at the cut, from 6 m off the aim point (the shape of the hollow, for the shot)
  await page.evaluate(([x, z]) => {
    const s = window.__playScene;
    const ux = 60 - x, uz = 60 - z, L = Math.hypot(ux, uz) || 1;
    const px = x + (ux / L) * 6, pz = z + (uz / L) * 6;
    const eye = s.heightAt(px, pz) + 1.7;
    const dx = x - px, dz = z - pz;
    s.debug.teleport('planet', px, pz, Math.atan2(-dx, -dz), Math.atan2(s.heightAt(x, z) - eye, Math.hypot(dx, dz)));
  }, [aim0.x, aim0.z]);
  await wait(600);
  await shot('07b-sculpt-pit-first-person.png');

  const pad = await page.evaluate(() => {
    const r = window.__playScene.beamSculpt(0, 0, 'carve', 1, 100);
    return { cells: r.cells, ore: r.ore, edit: window.__playScene.debug.groundEdit(0, 0) };
  });
  check('the gate pad is untouched: a carve on it cuts nothing and gains no ore', pad.cells === 0 && pad.ore === 100 && pad.edit === 0, JSON.stringify(pad));

  // the ring in each mode and under Seal (Extract, Apply, Sculpt; then Seal's amber on the ring while sealing)
  await page.keyboard.press('q');
  await wait(200);
  check('the ring is in Extract\'s colour (#3dc8ff)', (await chip())?.mode === 'extract' && (await ring()) === '#3dc8ff', `ring ${await ring()}`);
  await page.keyboard.press('q');
  await wait(200);
  check('the ring is in Apply\'s colour (#ff3d8a)', (await chip())?.mode === 'apply' && (await ring()) === '#ff3d8a', `ring ${await ring()}`);
  await page.keyboard.press('q');
  await wait(200);
  // the frame loop seals from the leak under the beam every frame (TASK-23b-2), so the seal is held through the game's test hook
  await page.evaluate(() => window.hmPlay.setBeamSealing(true));
  await wait(200);
  check('Seal turns the ring amber (#ffc13d) while sealing, in any mode', (await ring()) === '#ffc13d', `ring ${await ring()}`);
  await page.evaluate(() => window.hmPlay.setBeamSealing(false));
  await wait(200);
  check('the ring goes back to the mode\'s colour when the seal is off', (await ring()) === '#7cff4d', `ring ${await ring()}`);

  // the edits, the paint and the port survive a reload
  await wait(2500); // the save writes every 1.5 s while the edits and the port change
  const kept = { x: aim0.x, z: aim0.z, height: await edit(aim0) };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bootPlanet();
  const afterReload = await edit({ x: kept.x, z: kept.z });
  check('the cut and the raise survive a reload (the same height at the same point)', Math.abs(afterReload - kept.height) < 0.02, `${kept.height.toFixed(3)} m before, ${afterReload.toFixed(3)} m after`);
  const paintedAfter = await page.evaluate(() => window.__playScene.debug.paintedCells());
  check('the paint survives a reload', paintedAfter === paintedBeforeSave && paintedAfter > 0, `${paintedBeforeSave} cells before, ${paintedAfter} after`);
  await page.keyboard.press('g');
  await page.waitForFunction(() => document.querySelector('[data-testid="beam-mode"]') !== null, null, { timeout: 4000 }).catch(() => {});
  c = await chip();
  check('the port is loaded again after a reload (the chip shows its cartridge)', !!c?.port && c.port === portName, `port ${c?.port ?? 'none'} (was ${portName})`);

  // 6. V puts the rifle in the character's hand (third person), the rifle clips play
  await page.keyboard.press('v');
  await wait(3000);
  check('V puts the rifle in the character\'s hand', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'hand');
  // the clips are polled for up to 8 s, with the trace and the frame rate in the detail: the rifle idle starts once the hold's draw
  // has played, and after a reload the frames are still settling, so a late start is a timing fact the report must say
  const clipFps = await fps(1500);
  const clipTrace = [];
  const clipStart = Date.now();
  let weights = { idle: 0, unarmed: 0 };
  while (Date.now() - clipStart < 8000) {
    weights = await page.evaluate(() => ({
      idle: window.hmPlay.clipWeight('rifle-idle') + window.hmPlay.clipWeight('rifle-aiming-idle'),
      unarmed: window.hmPlay.clipWeight('breathing-idle'),
    }));
    clipTrace.push(`${((Date.now() - clipStart) / 1000).toFixed(1)}s:${weights.idle.toFixed(2)}`);
    if (weights.idle > 0.5 && weights.unarmed < 0.1) break;
    await wait(500);
  }
  check('the rifle clips play in third person (the rifle idle is on, the unarmed idle is off)', weights.idle > 0.5 && weights.unarmed < 0.1, `${JSON.stringify(weights)}; fps ${clipFps}; trace ${clipTrace.join(' ')}`);
  const av = await page.evaluate(() => ({ ...window.__playScene.debug.avatar(), ground: window.__playScene.heightAt(window.__playScene.debug.avatar().at[0], window.__playScene.debug.avatar().at[2]) }));
  const height = av.box[1][1] - av.box[0][1];
  check('the character stands on the ground: its feet on the ground under it, and about 1.7 m tall', Math.abs(av.box[0][1] - av.ground) < 0.15 && height > 1.4 && height < 2.0, `feet ${av.box[0][1].toFixed(2)}, ground ${av.ground.toFixed(2)}, height ${height.toFixed(2)}`);
  await shot('08-apply-third-person.png');
  await page.keyboard.press('q');
  await wait(400);
  await shot('09-sculpt-third-person.png');
  await page.keyboard.press('q');
  await wait(400);
  await shot('10-extract-third-person.png');
  await page.keyboard.press('v');
  await wait(400);
  check('V puts the rifle back in the view', (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'view');

  // 7. the frame rate per mode with the beam firing: the left button held in each (a boulder, the paint, the cut)
  const rates = {};
  for (const mode of ['extract', 'apply', 'sculpt']) {
    for (let presses = 0; presses < 6 && (await chip())?.mode !== mode; presses++) {
      await page.keyboard.press('q');
      await wait(120);
    }
    if (mode === 'extract') {
      // a boulder in reach, so the beam mines (and the stream runs) while the button is held
      await page.evaluate(() => {
        const s = window.__playScene;
        const p = s.debug.position();
        const b = window.hmPlay.boulders().filter((x) => x.ore >= 5).map((x) => ({ ...x, d: Math.hypot(x.x - p.x, x.z - p.z) })).filter((x) => x.d > 8 && x.d < 30).sort((a, q) => a.d - q.d)[0];
        if (!b) return;
        const dx = b.x - p.x, dz = b.z - p.z, L = Math.hypot(dx, dz);
        const px = b.x - (dx / L) * 7, pz = b.z - (dz / L) * 7;
        const eye = s.heightAt(px, pz) + 1.7;
        s.debug.teleport('planet', px, pz, Math.atan2(-dx, -dz), Math.atan2(b.y + b.size * 0.4 - eye, 7));
      });
    } else {
      // open ground ahead, away from the gate pad, so the paint and the cut land
      await page.evaluate(() => window.__playScene.debug.teleport('planet', 60, 60, 0.3, -0.5));
    }
    await wait(600);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await wait(400);
    const firing = await page.evaluate(() => ({ stream: window.__playScene.debug.streamShown(), ring: window.__playScene.debug.ringColour() }));
    // the Extract stream at stage 4 (no dither): the shot the stream's look is judged by, taken while the button is held
    if (mode === 'extract') await shot('07c-extract-stream-first-person-stage4.png');
    rates[mode] = { fps: await fps(2000), firing: mode === 'extract' ? firing.stream : firing.ring !== null };
    await page.mouse.up();
  }
  console.log('fps (headless, SwiftShader, beam firing):', JSON.stringify(rates));
  check('the scene keeps drawing in every mode, with the beam firing', Object.values(rates).every((r) => r.fps > 0), JSON.stringify(rates));

  // 8. G holsters the rifle
  await page.keyboard.press('g');
  await wait(400);
  check('G holsters the rifle (the chip goes, the view model goes)', (await chip()) === null && (await page.evaluate(() => window.__playScene.debug.rifleIn())) === 'none');

  // 9. the Low tier after a wide cut (21d review): the Low budget, the cut's refinement held within its cap, and the frame rate on Low
  // before and after the cut. The profile is set to Low before the reload (the init script sets it while the flag is on)
  await page.evaluate(() => sessionStorage.setItem('beam-test-low', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bootPlanet();
  const budget = await page.evaluate(() => window.__playScene.debug.detail().groundBudget);
  check('the Low tier is on (its ground budget is 75,000 triangles)', budget === 75000, `budget ${budget}`);
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 50, 50, 0.3, -0.5));
  await page.keyboard.press('g');
  await page.waitForFunction(() => document.querySelector('[data-testid="beam-mode"]') !== null, null, { timeout: 4000 }).catch(() => {});
  for (let presses = 0; presses < 4 && (await chip())?.mode !== 'sculpt'; presses++) {
    await page.keyboard.press('q');
    await wait(150);
  }
  await wait(600);
  const fpsLow = {};
  fpsLow.idleBefore = await fps(2000);
  const triBefore = await page.evaluate(() => window.__playScene.debug.groundTriangles());
  // one held stroke first, so the scene sets its keep-out zones (the shelter, the machines) as the frame loop does
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await wait(400);
  await page.mouse.up();
  // a 200 by 200 m square with the eye in its middle (the player stands at (50, 50)): a stroke every 10 m, a second of carving each
  const wide = await page.evaluate(() => {
    const s = window.__playScene;
    const t0 = performance.now();
    let cells = 0;
    for (let x = -50; x <= 150; x += 10) for (let z = -50; z <= 150; z += 10) cells += s.beamSculpt(x, z, 'carve', 1, 0).cells;
    return { cells, ms: Math.round(performance.now() - t0) };
  });
  const settleStart = Date.now();
  const wideSettled = await page.waitForFunction(() => window.__playScene.debug.groundSettled() === true, null, { timeout: 90000, polling: 250 }).then(() => true).catch(() => false);
  const settleSeconds = ((Date.now() - settleStart) / 1000).toFixed(1);
  const triAfter = await page.evaluate(() => window.__playScene.debug.groundTriangles());
  const cutCells = await page.evaluate(() => window.__playScene.debug.sculptedCells());
  check('the wide cut is made and the ground settles (every wanted chunk built, none stale)', wideSettled && cutCells > 0, `${cutCells} cells cut, ${wide.cells} cell changes in ${wide.ms} ms of strokes, settled ${wideSettled} after ${settleSeconds} s`);
  // triangles: a chunk is 2,304 with its skirt; the Low budget is 36 leaves of the eye's own, and the refinement adds at most 48 chunks
  const chunksAfter = triAfter / 2304;
  const chunksBefore = triBefore / 2304;
  check('the wide cut keeps the ground within the Low budget plus the refinement cap (36 + 48 chunks)', chunksAfter <= 36 + 48, `${chunksAfter.toFixed(1)} chunks (${triAfter} triangles), before ${chunksBefore.toFixed(1)} chunks (${triBefore} triangles)`);
  await wait(600);
  await shot('11-wide-carve-low-first-person.png');
  fpsLow.idleAfter = await fps(2000);
  // the beam held on the cut: the stroke runs on ground already cut, so no cell is new and nothing is re-planned
  await page.mouse.down();
  await wait(400);
  fpsLow.sculptAfter = await fps(2000);
  await page.mouse.up();
  console.log('fps on Low (headless, SwiftShader):', JSON.stringify(fpsLow), `triangles before ${triBefore} after ${triAfter}`);
  check('the scene keeps drawing on Low after the wide cut (idle and with the beam firing)', fpsLow.idleAfter > 0 && fpsLow.sculptAfter > 0, JSON.stringify(fpsLow));
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
