/**
 * TASK-21 F3: the base paths that TASK-20 wired and nothing exercised. On a fresh kit boot (?base&kit=1), production
 * build or dev server, real keys and clicks where the game has them:
 *   1 the Heavy tab: aim at a hardpoint, press, the machine picker opens (B, then the Heavy tab);
 *   2 the Plans tab: save a layout at the drafting table (K), the Plans tab lists it, and placing it adds a plan;
 *   3 E on a bin opens the lattice (the bin is aimed at, E is pressed, the lattice window shows).
 * The profile-delete check is a unit test (apps/web/src/storage/profile-storage.test.ts).
 * Shots (gitignored, shots-run/tabs/), each one looked at before it is posted. Exit code 1 when any beat fails.
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
const shotsDir = path.join(root, 'shots-run/tabs');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8197;
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
  try { localStorage.clear(); } catch {}
});

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
/** The shots have no overlays: the subtitle, the goal, the sync and the hotbar are hidden (the menus and windows stay). */
const HIDE_OVERLAYS = '.mentor-subtitle, .radio-hud-btn, .play-goal, .play-sync, .play-sync-indicator, .play-hud-hotbar, .hm-hotbar, .gr-bar, .play-dot, .hm-shelter-chip, .play-crosshair, .play-toast, .play-prompt { display: none !important; }';
const shot = async (file) => {
  await page.addStyleTag({ content: HIDE_OVERLAYS });
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

/** Teleports the camera around (cx, cz) until aimPoint() hits the piece. The camera turns on a frame, so each try waits one. */
const aimAtPiece = (pieceId, cx, cz) =>
  page.evaluate(
    async ({ pieceId, cx, cz }) => {
      const scene = window.__playScene;
      if (!scene) return { ok: false, sample: 'no scene', pos: '' };
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
      for (const [ox, oz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
        const tx = cx + ox, tz = cz + oz;
        for (const r of [4, 6]) {
          for (let a = 0; a < 8; a++) {
            const ang = (a * Math.PI) / 4;
            const px = tx + Math.sin(ang) * r;
            const pz = tz + Math.cos(ang) * r;
            const yaw = Math.atan2(-(tx - px), -(tz - pz));
            for (const pitch of [-0.2]) {
              scene.debug.teleport('planet', px, pz, yaw, pitch);
              await frame();
              await frame();
              const hit = scene.aimPoint();
              if (hit && hit.piece === pieceId) return { ok: true, px, pz, yaw, pitch };
            }
          }
        }
      }
      scene.debug.teleport('planet', cx, cz + 3, 0, -0.2);
      await frame();
      await frame();
      return { ok: false, sample: JSON.stringify(scene.aimPoint())?.slice(0, 160), pos: JSON.stringify(scene.debug.position()) };
    },
    { pieceId, cx, cz },
  );

/** Looks at the open ground at (tx, tz) from 4 m to its south. Returns true when the aim lands on ground (no piece). */
const aimAtGround = (tx, tz) =>
  page.evaluate(
    async ({ tx, tz }) => {
      const scene = window.__playScene;
      if (!scene) return { ok: false, hit: 'no scene' };
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
      scene.debug.teleport('planet', tx, tz - 4, Math.PI, -0.4);
      await frame();
      await frame();
      const hit = scene.aimPoint();
      return { ok: !!hit && hit.piece === null, hit: JSON.stringify(hit)?.slice(0, 120) };
    },
    { tx, tz },
  );

try {
  await page.goto(`http://localhost:${port}/?base&kit=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 35000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 15000 });
  await page.addStyleTag({ content: '.mentor-subtitle { display: none !important; }' });

  // The build, on the kit's shelter (?base&kit=1 starts with its structure, a foundation, the bench at (0, 0) and walls).
  // The hardpoint, a floor and a bin go on the first free cells that take them (the placement is refused when a cell is
  // taken), so this does not depend on the shelter's exact layout. The drafted cube sits at the kit's bench.
  const built = await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    if (!api) return { ok: false, error: 'no base api' };
    const w0 = api.world();
    const st = w0.base.structures[0];
    const at = { x: st?.x ?? 0, z: st?.z ?? 0 };
    const ev = [];
    ev.push(['struct', JSON.stringify(st ?? null).slice(0, 300)]);
    const A = (c) => { const r = api.apply(c); ev.push([c.t, c.blueprint ?? c.primitive ?? '', c.piece?.kind ?? '', (r.events ?? []).map((e) => JSON.stringify(e)).join(',')]); return r; };
    const placedOk = (r) => (r.events ?? []).some((e) => e.type === 'placed');
    const s = w0.base.structures[0]?.id;
    if (s === undefined) return { ok: false, error: 'no structure' };
    A({ t: 'draft', at, primitive: 'chassis', map: 'basalt' });
    // A hardpoint needs a 2 by 2 pad of foundations under it (its own cell free). Find the first free pad in a small grid.
    let hp = null;
    search: for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const pad = [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]];
      for (const [i, j] of pad) A({ t: 'place', at, blueprint: 'bp:starter', piece: { s, kind: 'foundation', i, j, k: 0, r: 0 } });
      const r = A({ t: 'place', at, blueprint: 'bp:chassis:basalt', piece: { s, kind: 'hardpoint', i: a, j: b, k: 0, r: 0 } });
      if (placedOk(r)) { hp = api.world().base.pieces.find((p) => p.kind === 'hardpoint')?.id ?? null; break search; }
    }
    A({ t: 'draft', at, primitive: 'cube', map: 'basalt' });
    let bin = null;
    for (const [i, j] of [[1, 0], [0, -1], [-1, 0], [1, 1], [0, 2]]) {
      if (bin) break;
      const f = A({ t: 'place', at, blueprint: 'bp:starter', piece: { s, kind: 'floor', i, j, k: 0, r: 0 } });
      if (!placedOk(f)) continue;
      const b = A({ t: 'place', at, blueprint: 'bp:cube:basalt', piece: { s, kind: 'bin', i, j, k: 0, r: 0 } });
      if (placedOk(b)) bin = api.world().base.pieces.find((p) => p.kind === 'bin')?.id ?? null;
    }
    const w = api.world();
    const bench = w.base.pieces.find((p) => p.kind === 'bench');
    const error = !hp ? 'no hardpoint' : !bin ? 'no bin' : !bench ? 'no bench' : undefined;
    return { ok: !error, error, cx: at.x, cz: at.z, hardpoint: hp, bin, bench: bench?.id ?? null, log: JSON.stringify(ev).slice(0, 1500) };
  });
  check('the test base is built (a hardpoint on a pad)', built.ok, built.error ?? `hardpoint ${built.hardpoint}`);
  if (!built.ok) throw new Error(built.error ?? 'base not built');

  // ---- 1. Heavy tab
  const aimHp = await aimAtPiece(built.hardpoint, built.cx, built.cz);
  check('the camera aims at the hardpoint', !!aimHp?.ok, aimHp?.ok ? `yaw ${aimHp.yaw.toFixed(2)}` : `no aim; sample ${aimHp?.sample} at ${aimHp?.pos}`);
  if (!aimHp?.ok) throw new Error('could not aim at the hardpoint');
  await page.keyboard.press('b');
  const menu = page.locator('section.bm');
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#bm-tab-heavy').click();
  const heavyCard = page.locator('#bm-panel button.play-card').first();
  await heavyCard.waitFor({ state: 'visible', timeout: 5000 });
  const aimedText = (await heavyCard.textContent()) ?? '';
  check('the Heavy tab sees the aimed hardpoint', aimedText.includes('Aimed: press to install'), aimedText.trim().slice(-60));
  await shot('01-heavy-tab-aimed.png');
  await heavyCard.click();
  const picker = page.locator('[data-testid="machine-picker-modal"]');
  await picker.waitFor({ state: 'visible', timeout: 5000 }).then(
    () => check('pressing a heavy card opens the machine picker', true),
    () => check('pressing a heavy card opens the machine picker', false, 'the picker did not open'),
  );
  await shot('02-machine-picker.png');
  await page.locator('[data-testid="machine-picker-close-btn"]').click();
  await picker.waitFor({ state: 'hidden', timeout: 5000 });

  // ---- 2. Plans tab: save a layout at the drafting table, then the Plans tab places it
  const beforeLayouts = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().layouts.length);
  await aimAtPiece(built.bench, built.cx, built.cz);
  await page.keyboard.press('k');
  const draft = page.locator('[data-testid="drafting-modal"]');
  const draftOpen = await draft.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (draftOpen) {
    await page.locator('[data-testid="drafting-tab-layouts"]').click();
    await page.locator('[data-testid="save-layout-name-input"]').fill('Tab Outpost');
    await page.locator('[data-testid="save-layout-btn"]').click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await draft.waitFor({ state: 'hidden', timeout: 5000 });
  }
  const afterLayouts = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().layouts.length);
  check('a layout is saved at the drafting table', afterLayouts > beforeLayouts, `${beforeLayouts} to ${afterLayouts}`);

  await page.keyboard.press('b');
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#bm-tab-plans').click();
  const planCard = page.locator('#bm-panel button.play-card').filter({ hasText: 'Tab Outpost' }).first();
  const planVisible = await planCard.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
  check('the Plans tab lists the saved layout', planVisible);
  await shot('03-plans-tab.png');
  if (planVisible) {
    const plansBefore = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().plans.length);
    await planCard.click();
    const placing = await page.evaluate(() => (document.body.textContent ?? '').includes('Aim at foundation ground'));
    check('choosing a plan starts the placement', placing);
    await shot('04-plan-placing.png');
    // Place it: aim at the foundation's ground, then click.
    // The click needs the pointer locked to the canvas, and the test stubs pointer lock: report the canvas as locked here.
    await page.evaluate(() => {
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('canvas.play-canvas') });
    });
    // The layout's footprint must fit: try open ground around the shelter until the plan takes (the others are refused as occupied).
    let groundHits = 0;
    for (const [dx, dz] of [[10, 6], [-12, 8], [14, -6], [-10, -10], [20, 4], [-18, 12], [6, 22]]) {
      const ground = await aimAtGround(built.cx + dx, built.cz + dz);
      if (!ground.ok) continue;
      groundHits += 1;
      await page.mouse.click(640, 360);
      await page.waitForTimeout(300);
      const now = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().plans.length);
      if (now > plansBefore) break;
    }
    check('the placement aims at open ground', groundHits > 0, '' + groundHits + ' spots');
    await page.evaluate(() => { delete document.pointerLockElement; });
    // A layout placed in the world is a plan (its ghost pieces, built with F), so the plan list grows.
    const plansAfter = await page.evaluate(() => (window.__hm?.base ?? window.hmPlay?.base).world().plans.length);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.play-toast, .play-prompt, .hm-toast')].map((e) => e.textContent?.trim()).join(' | ').slice(0, 200));
    check('placing the layout adds a plan to the world', plansAfter > plansBefore, `${plansBefore} to ${plansAfter}; toast: ${toast}`);
  }

  // ---- 3. E on a bin opens the lattice
  const bin = built.bin ? { id: built.bin } : null;
  if (!bin) {
    check('a bin is placed for E', false, 'the bin was not placed');
  } else {
    const aimBin = await aimAtPiece(bin.id, built.cx, built.cz);
    check('the camera aims at the bin', !!aimBin?.ok);
    if (aimBin?.ok) {
      // E places a blueprint held in the hotbar; select an empty slot so E interacts with what is aimed.
      const emptySlot = await page.evaluate(() => {
        const api = window.__hm?.base ?? window.hmPlay?.base;
        const slots = api.world().player.slots;
        const idx = [...Array(9).keys()].find((i) => !slots[i] || slots[i].n <= 0);
        if (idx !== undefined) api.apply({ t: 'hotbar', index: idx });
        return idx ?? null;
      });
      check('an empty hotbar slot is selected for E', emptySlot !== null, `slot ${emptySlot}`);
      await page.keyboard.press('e');
      const lattice = page.locator('[data-testid="lattice-modal"]');
      const opened = await lattice.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
      check('E on a bin opens the lattice', opened);
      await shot('05-bin-lattice.png');
      if (opened) {
        await page.keyboard.press('Escape');
        await lattice.waitFor({ state: 'hidden', timeout: 5000 });
      }
    }
  }
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
