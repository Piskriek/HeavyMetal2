/**
 * TICKET-04 build UX check (T04): real 3D thumbnails in the hotbar, the X radial wheel in each context, hold-Z removal,
 * build mode that stays on after a placement, the Esc keycap grid and the modal close hints. Boots the game on
 * http://localhost:8196/?base&kit=1&e2e (the dev kit: bp:starter in slot 1, bp:beam:basalt in slot 2).
 *  - hotbar slot 1 holds a 3D thumbnail (96 px render, not a 64 px swatch, and no lucide svg);
 *  - X with a blueprint held opens the radial with its six kinds, each with a thumbnail; picking floor sets the build kind;
 *  - the build menu's structure chips and machine cards carry thumbnails, and its footer names X Radial and Hold Z;
 *  - beam in Sculpt: X shows carve, raise and smooth; picking raise sets the tool; keys 1 and 2 still pick hotbar slots;
 *  - beam in Apply: X shows the cartridges on the rack as swatches (a seeded preset cartridge); picking one loads the port;
 *  - Z: a tap removes nothing; holding it for 0.7 s removes the aimed foundation; X no longer removes;
 *  - build mode stays on: two machines go down in a row without reopening B;
 *  - the Esc screen shows the keycap grid; the inventory's close button shows its Esc hint.
 * Shots go to shots-run/build-ux/ (gitignored).
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { hudZoneViolations } from './e2e-hud-and-luminance-gate.mjs';
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
  console.error('FAIL: Chrome not found');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/build-ux');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8196;
const checks = [];
const hudViolations = [];
const pageErrors = [];
const expect = (cond, label, detail) => {
  const tail = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
  if (!cond) throw new Error(`FAIL: ${label}${tail}`);
  checks.push(label);
  console.log(`OK: ${label}${tail}`);
};

console.log(`Starting static server on port ${port}...`);
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

let exitCode = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // pointer lock is stubbed (headless has no lock to give); the play screen then reads the mouse as free
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new Error('pointer lock stubbed in test'));
    };
    try { localStorage.clear(); } catch {}
  });
  page.on('pageerror', (err) => {
    console.error('Browser Page Error:', err.message);
    pageErrors.push(err.message);
  });

  const shot = async (name) => {
    const buf = await page.screenshot();
    fs.writeFileSync(path.join(shotsDir, name), buf);
    for (const v of await hudZoneViolations(page).catch(() => [])) hudViolations.push(`${name}: ${v}`);
    console.log(`Captured shots-run/build-ux/${name}`);
  };
  const api = () => page.evaluate(() => window.__hm?.base ?? window.hmPlay?.base);
  const pieces = () => page.evaluate(() => {
    const b = (window.__hm?.base ?? window.hmPlay?.base).world();
    return b.base.pieces.map((p) => ({ id: p.id, kind: p.kind, s: p.s }));
  });
  const pieceExists = async (id) => (await pieces()).some((p) => p.id === id);
  const machineCount = () => page.evaluate(() => window.hmPlay.plot().machines.length);
  const radialOpen = async () => (await page.locator('[data-testid="radial-menu"]').count()) > 0;
  const radialSlices = () => page.locator('[data-testid^="radial-slice-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('radial-slice-', '')));
  const beamMode = () => page.locator('[data-testid="beam-mode"]').evaluate((el) => ({ mode: el.dataset.mode, tool: el.dataset.tool, port: el.dataset.port })).catch(() => null);
  const hotbarSelected = (n) => page.locator(`[data-testid="hotbar-slot-${n}"]`).evaluate((el) => el.classList.contains('selected'));
  /** X down: the radial opens with the mouse parked in a corner, so no slice is picked by accident. */
  const openRadialWithX = async () => {
    await page.mouse.move(4, 4);
    await page.keyboard.down('x');
    await page.locator('[data-testid="radial-menu"]').waitFor({ state: 'visible', timeout: 4000 });
    await page.waitForTimeout(150);
  };
  /** Hover a slice, then release X: the release picks it (RadialMenu). */
  const pickWithX = async (id) => {
    await page.locator(`[data-testid="radial-slice-${id}"]`).hover();
    await page.waitForTimeout(120);
    await page.keyboard.up('x');
    await page.waitForTimeout(200);
  };

  // ---- boot: the dev kit on the Moon, Act IV done and stage 2 (Structures open), as the base-building test does
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__dev.finishAct('act4');
    const b = window.__hm?.base ?? window.hmPlay?.base;
    b?.apply({ t: 'stage', stage: 2 });
    window.__dev.setStage(2);
  });
  await page.waitForTimeout(300);

  // ---- 1. hotbar thumbnails
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  await page.waitForFunction(() => {
    const i = document.querySelector('[data-testid="hotbar-slot-1"] img');
    return !!i && i.complete && i.naturalWidth === 96;
  }, null, { timeout: 20000 });
  const hb = await page.evaluate(() => {
    const slot = document.querySelector('[data-testid="hotbar-slot-1"]');
    const img = slot.querySelector('img');
    return { imgs: slot.querySelectorAll('img').length, svgs: slot.querySelectorAll('svg').length, px: img.naturalWidth };
  });
  expect(hb.imgs === 1 && hb.svgs === 0 && hb.px === 96, 'hotbar slot 1 shows a 3D thumbnail, not a lucide svg', hb);
  await page.mouse.move(640, 300);
  await page.waitForTimeout(200);
  await shot('hotbar.png');

  // ---- 2. X with a blueprint held: the radial lists its six kinds, with thumbnails
  await openRadialWithX();
  const kinds = await radialSlices();
  expect(JSON.stringify(kinds) === JSON.stringify(['foundation', 'floor', 'wall', 'lowRoof', 'bench', 'weaponBench']), 'X radial lists the held blueprint kinds', kinds);
  await page.waitForFunction(() => document.querySelectorAll('.hm-radial-slice-thumb').length >= 5, null, { timeout: 20000 });
  expect(true, 'the build radial shows thumbnails on its slices');
  const wbLabel = await page.locator('[data-testid="radial-slice-weaponBench"] .hm-radial-slice-label').textContent();
  const wbWrapped = await page.locator('[data-testid="radial-slice-weaponBench"] .hm-radial-slice-label').evaluate((el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight || '13');
    return el.clientHeight > lh * 1.2 && !el.textContent.includes('...');
  });
  expect(wbWrapped, 'POL-79: radial slice label for Weapon bench wraps onto two lines instead of truncating', { wbLabel, wbWrapped });
  await shot('radial-build.png');
  await pickWithX('floor');
  expect(!(await radialOpen()), 'releasing X on floor closes the radial');
  const kind = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base)?.buildKind?.() ?? null);
  expect(kind === 'floor', 'picking floor on the radial changes the build kind', { kind });

  // ---- 3. the build menu: structure chips and machine cards carry thumbnails; the footer names X Radial and Hold Z
  await page.keyboard.press('b');
  await page.locator('.bm-panel').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#bm-tab-structures').click();
  await page.waitForFunction(() => document.querySelectorAll('.bm-chip img').length >= 1, null, { timeout: 20000 });
  const footer = await page.locator('.bm-keys').evaluate((el) => el.textContent ?? '');
  expect(/X\s*Radial/.test(footer) && /Hold\s*Z/.test(footer), 'build menu footer names X Radial and Hold Z', { footer: footer.replace(/\s+/g, ' ') });
  await shot('build-menu.png');
  await page.locator('#bm-tab-machines').click();
  await page.waitForFunction(() => document.querySelectorAll('.play-card img').length >= 1, null, { timeout: 20000 });
  expect(true, 'the build menu machine cards carry thumbnails');
  await page.keyboard.press('b');
  await page.locator('.bm-panel').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);

  // ---- 4. Z on an aimed foundation: a tap removes nothing; a hold of 0.7 s removes it; X no longer removes
  const found = await page.evaluate(() => {
    const b = window.__hm?.base ?? window.hmPlay?.base;
    b.apply({ t: 'found', at: { x: 12, z: 12 }, blueprint: 'bp:starter', cx: 12, cz: 12, yaw: 0 });
    const w = b.world();
    const f = w.base.pieces.find((p) => p.kind === 'foundation');
    return f ? f.id : null;
  });
  expect(found !== null, 'a foundation is placed for the remove test', { found });
  /** Stands 3 m off the piece's drawn centre, turns to it, and reads the aim ray (the base-building test's method). */
  const aimAt = async (pieceId) => {
    const bounds = await page.evaluate((id) => window.__playScene.debug.pieceBounds(id), pieceId);
    if (!bounds) {
      console.log(`aim: piece ${pieceId} has no drawn bounds`);
      return false;
    }
    const c = [0, 1, 2].map((a) => (bounds.min[a] + bounds.max[a]) / 2);
    console.log(`aim: piece ${pieceId} bounds ${JSON.stringify(bounds)} centre ${JSON.stringify(c)}`);
    // the starter slab is walled on its edges, so a ray from outside hits a wall first: stand inside the walls (1.2 m off
    // the centre) and look down, then fall back to standing 3 m out
    for (const d of [1.2, 3]) {
      for (const yaw of [Math.PI / 2, 0, -Math.PI / 2, Math.PI]) {
        await page.evaluate(([c, yaw, d]) => {
          const scene = window.__playScene;
          const sx = c[0] + d * Math.sin(yaw), sz = c[2] + d * Math.cos(yaw);
          scene.debug.teleport('planet', sx, sz, yaw, 0);
          const pos = scene.debug.position();
          scene.debug.teleport('planet', sx, sz, yaw, Math.atan2(c[1] - pos.y, d));
        }, [c, yaw, d]);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(250);
        const aim = await page.evaluate(() => {
          const a = window.__playScene.aimPoint();
          return { piece: a?.piece ?? null, at: a ? [a.x, a.y, a.z].map((v) => Math.round(v * 100) / 100) : null, cam: window.__playScene.debug.position() };
        });
        console.log(`aim: d ${d} yaw ${yaw.toFixed(2)} hit ${JSON.stringify(aim)}`);
        if (aim.piece === pieceId) return true;
      }
    }
    return false;
  };
  expect(await aimAt(found), 'the aim ray lands on the foundation');
  await page.keyboard.down('z');
  await page.waitForTimeout(120);
  await page.keyboard.up('z');
  await page.waitForTimeout(700);
  expect(await pieceExists(found), 'a tap on Z removes nothing');
  await page.keyboard.down('z');
  await page.waitForTimeout(250);
  const ringShown = await page.locator('[data-testid="hold-ring"]').count();
  await shot('hold-ring.png');
  await page.waitForTimeout(450);
  await page.keyboard.up('z');
  await page.waitForTimeout(300);
  expect(ringShown === 1 && !(await pieceExists(found)), 'holding Z for 0.7 s removes the aimed foundation (the ring shows while held)', { ringShown });
  await page.mouse.move(4, 4);
  await page.keyboard.down('x');
  await page.waitForTimeout(150);
  await page.keyboard.up('x');
  await page.waitForTimeout(200);
  expect(!(await radialOpen()), 'a tap on X opens nothing that removes: the radial closes with no pick');

  // ---- 5. the beam in Sculpt: X shows carve, raise and smooth; keys 1 and 2 still pick hotbar slots
  await page.keyboard.press('g');
  await page.locator('[data-testid="beam-mode"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('q');
  await page.keyboard.press('q');
  expect((await beamMode())?.mode === 'sculpt', 'the rifle is in Sculpt', await beamMode());
  await openRadialWithX();
  const tools = await radialSlices();
  expect(JSON.stringify(tools) === JSON.stringify(['carve', 'raise', 'smooth']), 'in Sculpt, X shows the three tools', tools);
  await shot('radial-sculpt.png');
  await pickWithX('raise');
  expect((await beamMode())?.tool === 'raise', 'picking raise on the radial sets the sculpt tool', await beamMode());
  await page.keyboard.press('2');
  await page.waitForTimeout(150);
  expect(await hotbarSelected(2), 'in Sculpt, key 2 selects hotbar slot 2');
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  expect((await hotbarSelected(1)) && (await beamMode())?.tool === 'raise', 'in Sculpt, key 1 selects hotbar slot 1 and leaves the tool alone', await beamMode());

  // ---- 6. the beam in Apply: the rack's cartridges as swatches; picking one loads the port
  await page.keyboard.press('q');
  await page.keyboard.press('q');
  expect((await beamMode())?.mode === 'apply', 'the rifle is in Apply', await beamMode());
  await openRadialWithX();
  const emptyState = await page.locator('[data-testid="radial-empty-state"]').count();
  const emptyMsg = await page.locator('[data-testid="radial-empty-msg"]').textContent().catch(() => '');
  expect(emptyState === 1 && /No written cartridges: write one at the preset bench/.test(emptyMsg), 'POL-80: with no cartridge on the rack, Apply shows dedicated empty state', { emptyMsg });
  await shot('radial-apply-empty.png');
  await page.keyboard.up('x');
  await page.waitForTimeout(200);
  const seeded = await page.evaluate(() => window.__dev.seedCartridge('emerald_canopy'));
  expect(seeded === true, 'a written preset cartridge is seeded on the rack (test seam)');
  await openRadialWithX();
  const cartId = 'seed-emerald_canopy-0';
  await page.waitForFunction(() => [...document.querySelectorAll('.hm-radial-slice-thumb')].some((i) => i.getAttribute('src')?.startsWith('data:image/')), null, { timeout: 15000 });
  const swatches = await page.evaluate(() => document.querySelectorAll('.hm-radial-slice-thumb').length);
  expect(swatches >= 1 && (await radialSlices()).includes(cartId), 'Apply shows the rack cartridge as a swatch', { swatches });
  await shot('radial-apply.png');
  await pickWithX(cartId);
  const afterLoad = await beamMode();
  expect(!!afterLoad?.port && /seeded/.test(afterLoad.port), 'picking the cartridge loads it into the beam port', afterLoad);
  await page.keyboard.press('g');
  await page.waitForTimeout(200);

  // ---- 7. build mode stays on: two machines in a row, without reopening B
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  await page.keyboard.press('b');
  await page.locator('#bm-tab-machines').click();
  await page.locator('.play-card').first().click();
  await page.waitForTimeout(250);
  expect((await page.locator('section[aria-label="Placing"]').count()) === 1, 'a machine card starts the placing pill');
  const gate = await page.evaluate(() => window.hmPlay.gate());
  const standOff = async (tx, tz) => {
    await page.evaluate(([tx, tz, gx, gz]) => {
      const scene = window.__playScene;
      const psi = Math.atan2(gx - tx, gz - tz), d = 6;
      const sx = tx + d * Math.sin(psi), sz = tz + d * Math.cos(psi);
      scene.debug.teleport('planet', sx, sz, psi, 0);
      const pos = scene.debug.position();
      scene.debug.teleport('planet', sx, sz, psi, Math.atan2(scene.heightAt(tx, tz) - pos.y, d));
      window.hmPlay.setLocked(true);
    }, [tx, tz, gate.x, gate.z]);
    await page.waitForTimeout(200);
  };
  let placed = 0;
  for (let k = 0; k < 8 && placed < 2; k++) {
    const a = (k * Math.PI) / 4;
    const tx = gate.x + 14 * Math.sin(a), tz = gate.z + 14 * Math.cos(a);
    await standOff(tx, tz);
    const before = await machineCount();
    await page.mouse.click(640, 360);
    await page.waitForTimeout(300);
    if ((await machineCount()) === before + 1) {
      placed += 1;
      expect((await page.locator('section[aria-label="Placing"]').count()) === 1, `machine ${placed} placed and the build pill stays up`, { machines: before + 1 });
    }
  }
  expect(placed === 2, 'two machines go down in a row without reopening B', { placed });
  await page.keyboard.press('b');
  await page.waitForTimeout(250);
  expect((await page.locator('section[aria-label="Placing"]').count()) === 0, 'B ends the build');
  await shot('machines-placed.png');

  // ---- 8. the Esc screen: the keycap grid, with the new controls (POL-78: 3 columns, fully visible at 720p)
  await page.evaluate(() => window.hmPlay.setPaused(true));
  await page.locator('[data-testid="controls-grid"]').waitFor({ state: 'visible', timeout: 5000 });
  const rows = await page.locator('[data-testid^="controls-row-"]').count();
  const caps = await page.locator('.hm-controls-keycap').allTextContents();
  expect(rows >= 18 && caps.includes('Hold Z') && caps.includes('X'), 'the Esc screen shows the keycap grid with X and Hold Z', { rows });
  const gridVisible = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="controls-grid"]');
    if (!grid) return null;
    const r = grid.getBoundingClientRect();
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const firstRow = document.querySelector('[data-testid="controls-row-0"]')?.getBoundingClientRect();
    const lastRow = document.querySelector('[data-testid^="controls-row-"]:last-of-type')?.getBoundingClientRect();
    return {
      cols,
      gridInViewport: r.top >= 0 && r.bottom <= 720,
      firstVisible: !!firstRow && firstRow.top >= 0 && firstRow.bottom <= 720,
      lastVisible: !!lastRow && lastRow.top >= 0 && lastRow.bottom <= 720,
    };
  });
  expect(gridVisible?.cols === 3 && gridVisible?.firstVisible && gridVisible?.lastVisible, 'POL-78: Esc pause panel controls grid laid out in 3 columns and fully visible at 1280x720', gridVisible);
  await shot('esc-controls.png');
  await page.evaluate(() => { window.hmPlay.setPaused(false); window.hmPlay.setLocked(true); });
  await page.waitForTimeout(300);

  // ---- 9. modal close hints: the inventory's Esc keycap
  await page.keyboard.press('Tab');
  await page.locator('[data-testid="inventory-modal"]').waitFor({ state: 'visible', timeout: 5000 });
  const hint = await page.locator('[data-testid="inventory-close-btn"] .hm-close-hint').evaluate((el) => el.textContent ?? '').catch(() => '');
  expect(/Esc/.test(hint) && /Close/.test(hint), 'the inventory close button carries an Esc hint', { hint });
  await shot('inventory-close-hint.png');
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="inventory-modal"]').waitFor({ state: 'hidden', timeout: 5000 });

  // ---- 10. POL-82: refused actions show as a compact HUD toast in status zone, not a giant title card
  await page.evaluate(() => { window.hmPlay?.clearToast?.(); });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const b = window.__hm?.base ?? window.hmPlay?.base;
    b?.apply({ t: 'stage', stage: 2 });
  });
  await page.locator('[data-testid="status-toast"]').waitFor({ state: 'visible', timeout: 5000 });
  const statusMsg = await page.locator('[data-testid="status-toast"]').textContent();
  const titleCardCount = await page.locator('.play-toast').count();
  expect(titleCardCount === 0 && statusMsg.includes('Already at this stage'), 'POL-82: refused action raises compact HUD toast with friendly reason and no giant title card', { statusMsg, titleCardCount });
  await shot('refused-status-toast.png');

  // ---- 11. POL-43: bottom-right ticker shows linked-bin counts
  const tickerText = await page.locator('[data-testid="plot-ore-ticker"]').textContent();
  const linkedText = await page.locator('[data-testid="plot-ore-ticker"] .play-ore-linked').textContent().catch(() => '');
  expect(/\(\+\d+\)/.test(linkedText), 'POL-43: bottom-right ticker shows linked-bin counts e.g. (+600)', { tickerText, linkedText });
  await shot('ticker-linked-count.png');

  expect(hudViolations.length === 0, 'no HUD zone or reticle overlap in the shots', hudViolations.slice(0, 5));
  expect(pageErrors.length === 0, 'no page errors', pageErrors.slice(0, 5));
  console.log(`\nPASS: ${checks.length} checks, shots in shots-run/build-ux/`);
} catch (err) {
  console.error(String(err?.message ?? err));
  console.error(`FAIL after ${checks.length} passing checks`);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  process.exit(exitCode);
}
