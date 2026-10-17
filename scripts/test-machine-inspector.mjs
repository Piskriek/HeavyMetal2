/**
 * TICKET-03 (BB-09, BB-10, BB-11): the machine inspector, E routing, the Drafting Table on E, and full-size machines.
 * Boots ?base&kit=1&e2e, founds a structure through the base API (a 4 by 2 foundation grid, a mill pad, a fabricator
 * pad and a drafting bench), then aims at each and presses E. Asserts:
 *  - E on the mill opens the inspector (name and a status pill from the five states; Open refinery; no toggle on a pad);
 *  - Open refinery opens the refinery; the refinery closes with Esc;
 *  - a crafted job shows RUNNING in the inspector, with the plume pill;
 *  - E on the fabricator opens the inspector; Open fabricator opens the fabricator;
 *  - Esc closes the inspector without pausing the game; Tab closes it too;
 *  - E on the bench opens the Drafting Table; Esc closes it.
 * Shots go to shots-run/inspector/ (gitignored).
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
const shotsDir = path.join(root, 'shots-run/inspector');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8197;
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => {
  const file = path.join(shotsDir, name);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.screenshot({ path: file });
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(300);
    }
  }
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
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
  } catch {}
});

const pageErrors = [];
page.on('pageerror', (err) => {
  console.error('Browser Page Error:', err.message, String(err.stack ?? '').split('\n').slice(0, 3).join(' | '));
  pageErrors.push(err.message);
});

const inspectorModal = page.locator('[data-testid="machine-inspector-modal"]');
const inspectorStatus = page.locator('[data-testid="machine-inspector-status"]');
const refineryModal = page.locator('[data-testid="refinery-modal"]');
const fabricatorModal = page.locator('[data-testid="fabricator-modal"]');
const draftingModal = page.locator('[data-testid="drafting-modal"]');

/** Stands 6 m out on +z (yaw 0 looks along -z) and tries small offsets until the aim ray hits the piece. */
async function aimAtPiece(pieceId, guess, heights = [0.3, 0.7, 1.1, 1.5]) {
  for (const dy of heights) {
    for (const dx of [0, -2, 2, -3.5, 3.5]) {
      for (const dz of [0, -2, 2]) {
        const hit = await page.evaluate(async ([pid, tx, ty, tz]) => {
          const scene = window.__playScene;
          const dist = 5;
          scene.debug.teleport('planet', tx, tz + dist, 0, 0);
          const p = scene.debug.position();
          scene.debug.teleport('planet', tx, tz + dist, 0, Math.atan2(ty - p.y, dist));
          // two frames, so the camera's matrices follow the teleport before the ray is cast
          for (let k = 0; k < 2; k++) await new Promise((r) => requestAnimationFrame(() => r()));
          return scene.aimPoint()?.piece === pid;
        }, [pieceId, guess.x + dx, guess.y + dy, guess.z + dz]);
        if (hit) return true;
      }
    }
  }
  return false;
}

try {
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 35000 });
  await page.evaluate(() => {
    window.hmPlay.teleportPlanet?.();
    window.hmPlay.setPaused(false);
    window.hmPlay.setLocked(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', { timeout: 15000 });
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 0, 10, 0, 0));

  // ---- build: a found structure, a 4 by 2 foundation grid, a mill pad, a fabricator pad and a bench
  const built = await page.evaluate(() => {
    const api = window.hmPlay.base;
    const w0 = api.world();
    const shelter = w0.base.structures[0];
    // the flattest 24 m by 12 m patch near the shelter whose founding point is its highest ground: a cell is refused
    // (reason: ground) when its terrain rises above the structure's floor (the found point's height), so the origin
    // has to be the high corner. The grid samples the cell corners and centres (every 2 m).
    const sx = (shelter?.x ?? 0) + 28, sz = (shelter?.z ?? 0) + 28;
    const scene = window.__playScene;
    let best = null;
    for (let dx = -48; dx <= 48; dx += 4) {
      for (let dz = -48; dz <= 48; dz += 4) {
        const ox = sx + dx, oz = sz + dz;
        const h0 = scene.heightAt(ox, oz);
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i <= 24; i += 2) {
          for (let j = 0; j <= 10; j += 2) {
            const h = scene.heightAt(ox + i, oz + j);
            lo = Math.min(lo, h);
            hi = Math.max(hi, h);
          }
        }
        if (h0 < hi - 0.02) continue;
        const score = (hi - lo) + Math.hypot(dx, dz) * 0.001;
        if (!best || score < best.score) best = { x: ox, z: oz, score, range: hi - lo };
      }
    }
    if (!best) throw new Error('no flat patch near the shelter');
    const at = { x: best.x, z: best.z };
    window.__playScene.debug.teleport('planet', at.x, at.z, 0, 0);
    const grant = (item, n) => {
      const w = api.world();
      const slot = w.player.slots.find((stk) => stk && stk.item === item);
      if (slot) slot.n += n;
      else {
        const empty = w.player.slots.findIndex((stk, idx) => stk === null && idx !== w.hotbar);
        if (empty >= 0) w.player.slots[empty] = { item, n };
      }
    };
    grant('bp:chassis:basalt', 2);
    grant('bp:starter', 1);
    grant('ore', 5000);
    grant('map-basalt', 200);
    for (const prim of ['prim-beam', 'prim-column', 'prim-chassis', 'prim-cube']) grant(prim, 40);
    const found = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: at.x, cz: at.z, yaw: 0 });
    const s = api.world().base.structures.at(-1)?.id;
    const log = [];
    const place = (piece, blueprint = 'bp:starter') => {
      const r = api.apply({ t: 'place', at, blueprint, piece: { s, ...piece } });
      log.push(`${piece.kind}@${piece.i},${piece.j}:${r.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join('|')}`);
      return r;
    };
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [3, 0], [2, 1], [3, 1], [4, 0]]) {
      if (i === 0 && j === 0) continue;
      place({ kind: 'foundation', i, j, k: 0, r: 0 });
    }
    place({ kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 }, 'bp:chassis:basalt');
    place({ kind: 'hardpoint', i: 2, j: 0, k: 0, r: 0 }, 'bp:chassis:basalt');
    place({ kind: 'bench', i: 4, j: 0, k: 0, r: 0 });
    const w = api.world();
    const pads = w.base.pieces.filter((p) => p.kind === 'hardpoint' && p.s === s).sort((a, b) => a.i - b.i);
    const bench = w.base.pieces.find((p) => p.kind === 'bench' && p.s === s);
    const mill = pads[0];
    const fab = pads[1];
    const milled = mill ? api.apply({ t: 'install', at, hardpoint: mill.id, kind: 'mill' }) : null;
    const fabbed = fab ? api.apply({ t: 'install', at, hardpoint: fab.id, kind: 'fabricator' }) : null;
    // the hotbar must not hold a blueprint, or E places a piece instead of inspecting
    const w2 = api.world();
    w2.player.slots[w2.hotbar] = null;
    return {
      foundOk: found.events.some((e) => e.type === 'placed'),
      s,
      at,
      range: best.range,
      groundY: scene.heightAt(at.x, at.z),
      pads: pads.map((p) => p.id),
      millId: mill?.id ?? null,
      fabId: fab?.id ?? null,
      benchId: bench?.id ?? null,
      millInstall: milled ? milled.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join('|') : 'no pad',
      fabInstall: fabbed ? fabbed.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join('|') : 'no pad',
      log,
    };
  });
  console.log('BUILD:', JSON.stringify(built));
  check('build: a structure is founded through the base API', built.foundOk);
  check('build: the mill pad, fabricator pad and bench are placed', built.millId !== null && built.fabId !== null && built.benchId !== null, JSON.stringify(built.log));
  check('build: the mill installs on its pad', /installed/.test(built.millInstall), built.millInstall);
  check('build: the fabricator installs on its pad', /installed/.test(built.fabInstall), built.fabInstall);
  if (built.millId === null || built.fabId === null || built.benchId === null) throw new Error('build failed');

  const origin = built.at;
  // the pad centres (a 4 m cell, the found point at the corner of cell 0,0), at ground height plus a metre or so
  const guessPad = (i0) => ({ x: origin.x + 4 * (i0 + 1), y: built.groundY, z: origin.z + 4 });
  const guessBench = { x: origin.x + 18, y: built.groundY, z: origin.z + 2 };

  // ---- 1. E on the mill opens the inspector
  const aimedMill = await aimAtPiece(built.millId, guessPad(0));
  check('aim: the reticle lands on the mill pad', aimedMill);
  await page.keyboard.press('e');
  await inspectorModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  const millVisible = await inspectorModal.isVisible().catch(() => false);
  check('E on the mill opens the machine inspector', millVisible);
  if (millVisible) {
    const name = (await page.locator('.hm-insp-name').first().textContent())?.trim() ?? '';
    const status = (await inspectorStatus.textContent())?.trim() ?? '';
    const validStatus = ['RUNNING', 'IDLE // STANDBY', 'NO POWER', 'NO FEED', 'OFFLINE'].includes(status);
    check('inspector names the mill', name === 'HEAVY TEXTURE MILL', name);
    check('inspector shows one of the five statuses', validStatus, status);
    const refineryBtn = await page.locator('[data-testid="machine-inspector-open-refinery"]').count();
    const toggleBtn = await page.locator('[data-testid="machine-inspector-toggle"]').count();
    check('inspector offers Open refinery', refineryBtn === 1);
    check('a pad machine offers no toggle (no world switch yet)', toggleBtn === 0, `toggles=${toggleBtn}`);
    await shot(page, 'inspector-mill.png');
    await page.locator('[data-testid="machine-inspector-open-refinery"]').click();
    await refineryModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const refineryOpen = await refineryModal.isVisible().catch(() => false);
    const inspectorGone = !(await inspectorModal.isVisible().catch(() => false));
    check('Open refinery opens the refinery', refineryOpen);
    check('Open refinery closes the inspector', inspectorGone);
    // a job queued at the refinery makes the inspector show RUNNING with the plume pill
    const recipeId = await page.locator('[data-testid^="queue-btn-"]').first().getAttribute('data-testid').catch(() => null);
    const recipe = recipeId ? recipeId.replace('queue-btn-', '') : null;
    await page.keyboard.press('Escape');
    await refineryModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    check('Esc closes the refinery', !(await refineryModal.isVisible().catch(() => false)));
    if (recipe) {
      const queued = await page.evaluate(([id, rid]) => {
        const api = window.hmPlay.base;
        const p = window.__playScene.debug.position();
        const r = api.apply({ t: 'craft', at: { x: p.x, z: p.z }, machine: id, recipe: rid });
        return r.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join('|');
      }, [built.millId, recipe]);
      console.log('craft:', queued);
      await page.keyboard.press('e');
      await inspectorModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await inspectorModal.isVisible().catch(() => false)) {
        const runStatus = (await inspectorStatus.textContent())?.trim() ?? '';
        const plume = await page.locator('.hm-insp-plume-pill').count();
        check('a queued job shows RUNNING in the inspector', runStatus === 'RUNNING', runStatus);
        check('a running machine shows the plume pill', plume === 1);
        await shot(page, 'inspector-mill-running.png');
      } else {
        check('a queued job shows RUNNING in the inspector', false, 'inspector did not reopen');
      }
    } else {
      check('the refinery lists a queue button to read the recipe from', false);
    }
    // Esc closes the inspector and does not open the pause menu
    await page.keyboard.press('Escape');
    await sleep(300);
    const closedByEsc = !(await inspectorModal.isVisible().catch(() => false));
    const paused = await page.evaluate(() => window.hmPlay.isPaused());
    check('Esc closes the inspector', closedByEsc);
    check('Esc on the inspector does not pause the game', paused === false, `paused=${paused}`);
  }

  // ---- 2. a full-size machine beside the player (the inspector shut): 6 m out, looking at the mill's middle
  await page.evaluate(([x, z, y]) => {
    const scene = window.__playScene;
    const dist = 6;
    scene.debug.teleport('planet', x, z + dist, 0, 0);
    const p = scene.debug.position();
    scene.debug.teleport('planet', x, z + dist, 0, Math.atan2(y - p.y, dist));
  }, [guessPad(0).x, guessPad(0).z, built.groundY + 1.4]);
  await page.evaluate(async () => {
    for (let k = 0; k < 3; k++) await new Promise((r) => requestAnimationFrame(() => r()));
  });
  await sleep(300);
  await shot(page, 'machine-beside-player.png');

  // ---- 3. E on the fabricator opens its inspector; Open fabricator opens the fabricator
  const aimedFab = await aimAtPiece(built.fabId, guessPad(2));
  check('aim: the reticle lands on the fabricator pad', aimedFab);
  await page.keyboard.press('e');
  await inspectorModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await inspectorModal.isVisible().catch(() => false)) {
    const name = (await page.locator('.hm-insp-name').first().textContent())?.trim() ?? '';
    check('inspector names the fabricator', name === 'VEHICLE FABRICATOR', name);
    await shot(page, 'inspector-fabricator.png');
    await page.locator('[data-testid="machine-inspector-open-fabricator"]').click();
    await fabricatorModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check('Open fabricator opens the fabricator', await fabricatorModal.isVisible().catch(() => false));
    await page.locator('[data-testid="fabricator-close-btn"]').click().catch(() => {});
    await fabricatorModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  } else {
    check('E on the fabricator opens the machine inspector', false);
  }

  // ---- 4. Tab closes the inspector too
  await page.evaluate(([x, z]) => window.__playScene.debug.teleport('planet', x, z, 0, 0), [guessPad(2).x, guessPad(2).z + 6]);
  const aimedAgain = await aimAtPiece(built.fabId, guessPad(2));
  if (aimedAgain) {
    await page.keyboard.press('e');
    await inspectorModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await inspectorModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Tab');
      await sleep(300);
      check('Tab closes the inspector', !(await inspectorModal.isVisible().catch(() => false)));
    }
  }

  // ---- 5. E on the bench opens the Drafting Table (BB-11)
  const aimedBench = await aimAtPiece(built.benchId, guessBench, [0.6, 1.0, 1.4, 1.8]);
  check('aim: the reticle lands on the drafting bench', aimedBench);
  if (aimedBench) {
    // the drafting table is locked until Act IV is done (campaign chain A4-04): E then gives the same locked toast as K
    await page.keyboard.press('e');
    await sleep(400);
    const lockedToast = (await page.evaluate(() => document.body.innerText)).includes('Drafting table locked');
    check('E on the bench while locked shows the locked toast', lockedToast);
    check('E on the bench while locked does not open the Drafting Table', !(await draftingModal.isVisible().catch(() => false)));
    // unlock it the way the base test does: the campaign's own Act IV finish and stage-2 event
    await page.evaluate(() => { window.__dev.finishAct('act4'); window.__dev.setStage(2); });
    await sleep(400);
    await page.keyboard.press('e');
    await draftingModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (!(await draftingModal.isVisible().catch(() => false))) {
      console.log('DIAG bench:', JSON.stringify(await page.evaluate(() => ({
        hudHook: typeof window.__hmHud?.openDrafting,
        drafting: document.querySelectorAll('[data-testid="drafting-modal"]').length,
        lockedToast: document.body.innerText.includes('Drafting table locked'),
        toastText: document.body.innerText.match(/Drafting table[^\n]*\n?[^\n]*/)?.[0] ?? null,
        chain: window.hmPlay.chain?.()?.current?.title ?? null,
      }))));
    }
    check('E on the bench opens the Drafting Table', await draftingModal.isVisible().catch(() => false));
    await shot(page, 'drafting-from-bench.png');
    await page.keyboard.press('Escape');
    await draftingModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    check('Esc closes the Drafting Table', !(await draftingModal.isVisible().catch(() => false)));
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  console.error('FAILED:', err.message);
  check('the run completes', false, err.message);
} finally {
  await browser.close();
  server.kill();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length} of ${checks.length} checks pass`);
process.exit(failed.length === 0 ? 0 : 1);
