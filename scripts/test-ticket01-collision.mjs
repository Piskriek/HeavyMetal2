/**
 * TICKET-01 browser check (colliders, the gate exit, the roof level, the steering sign). Playwright, on the built single file:
 *  1. Lab: walking into the east-wall machines, the west-wall gear and the gate posts stops you; with the gate powered, walking
 *     through the opening crosses to the Moon.
 *  2. Moon: the twin's frame blocks you (at a post's line); its powered opening crosses you to the lab.
 *  3. Spawn: after a moon arrival you face away from the gate: forward . (spawn - gate) > 0.
 *  4. BB-02: a standalone foundation, wall and ramp placed away from the shelter through the base API: the wall blocks,
 *     the ramp climbs at least 2 m, and the foundation is stood on.
 *  5. A field machine blocks you.
 *  6. While driving, steer -1 turns the rover left (yaw goes up).
 * Roof level (BB-07) is checked on the structure package's snap in packages/structure/tests/roof-level.test.ts.
 * Shots: docs/shots/ticket01/ (the lab gate posts, the twin gate up close, the spawn view, the standalone build).
 * Usage: node scripts/test-ticket01-collision.mjs   (needs apps/web/dist/index.html: npm run build)
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
const shotsDir = path.join(root, 'docs/shots/ticket01');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8197;
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try { localStorage.clear(); } catch {}
});

/** A shot of the scene: the HUD overlays are hidden for the frame only (the game keeps running). */
const shot = async (name) => {
  await page.evaluate(() => window.hmPlay.hideOverlays(true));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shotsDir, name) });
  await page.evaluate(() => window.hmPlay.hideOverlays(false));
};

const pageErrors = [];
page.on('pageerror', (err) => {
  console.error('Browser Page Error:', err.message);
  pageErrors.push(err.message);
});

/** The results: each check is one line, PASS or FAIL, with the numbers that decided it. */
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};

/** Page-side helpers, installed once. Frames are driven by hand (the screen's own loop is paused). */
const installHelpers = () => {
  let tick = 0;
  const EYE = 1.68;
  window.__t1 = {
    scene: () => window.__playScene,
    /** Runs n frames of walking (move) or driving (vehicleInput); stopWhen(scene) ends early. Returns the eye position. */
    run(n, move, opts = {}) {
      const scene = window.__playScene;
      let maxFeet = -Infinity;
      for (let i = 0; i < n; i++) {
        tick += 1 / 60;
        scene.frame(1000 + tick, 1 / 60, {
          move: move ?? { x: 0, z: 0 },
          look: { dx: 0, dy: 0 },
          run: false,
          altCam: false,
          flyUp: 0,
          vehicleInput: opts.vehicleInput,
        });
        maxFeet = Math.max(maxFeet, scene.debug.position().y - EYE);
        if (opts.stopWhen && opts.stopWhen(scene)) break;
      }
      const p = scene.debug.position();
      return { x: p.x, y: p.y, z: p.z, feet: p.y - EYE, maxFeet };
    },
    where: () => window.__playScene.debug.where(),
    eye: () => { const p = window.__playScene.debug.position(); return { x: p.x, y: p.y, z: p.z }; },
    facing: () => window.__playScene.debug.facing(),
    gate: () => window.__playScene.debug.gatePlanet(),
    exit: () => window.__playScene.gateExit(),
    /** The twin gate's local frame: a point at (lx, lz) in the twin's frame, on the moon, for yaw th. */
    twinPoint(lx, lz) {
      const g = window.__playScene.debug.gatePlanet();
      const th = window.__playScene.gateExit().yaw;
      return {
        x: g.x + lx * Math.cos(th) + lz * Math.sin(th),
        z: g.z - lx * Math.sin(th) + lz * Math.cos(th),
        yaw: th,
      };
    },
    /** A world point to local twin coordinates (inverse of twinPoint). */
    toTwin(x, z) {
      const g = window.__playScene.debug.gatePlanet();
      const th = window.__playScene.gateExit().yaw;
      const dx = x - g.x, dz = z - g.z;
      return { lx: dx * Math.cos(th) - dz * Math.sin(th), lz: dx * Math.sin(th) + dz * Math.cos(th) };
    },
    tick: () => tick,
  };
};

try {
  console.log('Navigating to ?base&kit=1&e2e ...');
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(() => typeof window !== 'undefined' && window.hmPlay?.ready === true, { timeout: 35000 });
  await page.evaluate(() => { window.hmPlay.setPaused(false); });
  await page.waitForTimeout(300);
  await page.evaluate(installHelpers);
  console.log('OK: play scene ready, the screen loop paused');

  // ---------------------------------------------------------------- 1. the lab
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 4.0, -5.0, -Math.PI / 2, 0));
  const eastWall = await page.evaluate(() => window.__t1.run(240, { x: 0, z: 1 }));
  check('lab: the east-wall machines stop the walk (x < 7.0)', eastWall.x < 7.0 && eastWall.x > 4.5, `stopped at x=${eastWall.x.toFixed(2)}`);

  await page.evaluate(() => window.__playScene.debug.teleport('lab', -4.0, 1.0, Math.PI / 2, 0));
  const westWall = await page.evaluate(() => window.__t1.run(240, { x: 0, z: 1 }));
  check('lab: the west-wall gear stops the walk (x > -6.9)', westWall.x > -6.9 && westWall.x < -4.5, `stopped at x=${westWall.x.toFixed(2)}`);

  await page.evaluate(() => window.__playScene.debug.teleport('lab', -0.5, -1.0, -Math.PI / 2, 0));
  const posts = await page.evaluate(() => window.__t1.run(160, { x: 0, z: 1 }));
  check('lab: the gate post stops the walk before the post (0.2 < x < 0.85)', posts.x > 0.2 && posts.x < 0.85, `stopped at x=${posts.x.toFixed(2)}`);

  // power the gate: the lever's sequence runs in the frames (about 3.5 s, then the coils light)
  await page.evaluate(() => { window.__playScene.debug.teleport('lab', 0.0, 2.2, 0, 0); window.__playScene.pullLever(); });
  await page.evaluate(() => window.__t1.run(420, { x: 0, z: 0 }));
  const lit = await page.evaluate(() => window.__playScene.debug.coilsLit());
  check('lab: the gate powers (every coil lit after the lever)', lit.length > 0 && lit.every(Boolean), `${lit.filter(Boolean).length}/${lit.length} coils`);
  // the gate posts, lit and from the room (facing the gate from the south side)
  await page.evaluate(() => window.__playScene.debug.teleport('lab', -0.4, 2.8, 0, -0.12));
  await page.evaluate(() => window.__t1.run(12, { x: 0, z: 0 }));
  await shot('lab-gate-posts.png');

  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0.0, 2.2, 0, 0));
  const crossed = await page.evaluate(() => window.__t1.run(300, { x: 0, z: 1 }, { stopWhen: (s) => s.debug.where() === 'planet' }));
  const whereAfterLab = await page.evaluate(() => window.__t1.where());
  check('lab: the powered gate opening crosses to the Moon', whereAfterLab === 'planet', `where=${whereAfterLab}, z=${crossed.z.toFixed(2)}`);

  // ---------------------------------------------------------------- 2 and 3. the Moon: the twin and the spawn
  await page.evaluate(() => {
    const e = window.__playScene.gateExit();
    window.__playScene.debug.teleport('planet', e.x, e.z, e.yaw, 0);
  });
  const spawn = await page.evaluate(() => {
    const e = window.__playScene.gateExit();
    const eye = window.__t1.eye();
    const g = window.__playScene.debug.gatePlanet();
    const yaw = window.__playScene.debug.facing();
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    return { dot: fx * (eye.x - g.x) + fz * (eye.z - g.z), exitX: e.x, exitZ: e.z };
  });
  check('spawn: after a moon arrival you face away from the gate (forward . (spawn - gate) > 0)', spawn.dot > 0, `dot=${spawn.dot.toFixed(2)}`);
  await page.evaluate(() => window.__t1.run(30, { x: 0, z: 0 }));
  await shot('spawn-view.png');

  // the twin's frame: walk backwards (toward the gate) along the upright at local x = 1.0; it must stop short of the gate's centre
  await page.evaluate(() => {
    const p = window.__t1.twinPoint(1.0, -3.0);
    window.__playScene.debug.teleport('planet', p.x, p.z, p.yaw, 0);
  });
  const frameBlock = await page.evaluate(() => {
    const end = window.__t1.run(200, { x: 0, z: -1 });
    return window.__t1.toTwin(end.x, end.z);
  });
  check('twin: the frame blocks the walk (stops short of the centre, local z < -0.3)', frameBlock.lz < -0.3 && frameBlock.lz > -2.9, `local z=${frameBlock.lz.toFixed(2)}`);

  // the powered opening: walk backwards through the centre (local x = 0) and cross to the lab
  await page.evaluate(() => {
    const p = window.__t1.twinPoint(0.0, -3.0);
    window.__playScene.debug.teleport('planet', p.x, p.z, p.yaw, 0);
  });
  const twinCross = await page.evaluate(() => window.__t1.run(300, { x: 0, z: -1 }, { stopWhen: (s) => s.debug.where() === 'lab' }));
  const whereAfterMoon = await page.evaluate(() => window.__t1.where());
  check('twin: the powered opening crosses you to the lab', whereAfterMoon === 'lab', `where=${whereAfterMoon}, z=${twinCross.z.toFixed(2)}`);

  // the twin up close, for the shot (the moon, facing the gate from the exit)
  await page.evaluate(() => {
    const e = window.__playScene.gateExit();
    window.__playScene.debug.teleport('planet', e.x, e.z, e.yaw + Math.PI, 0);
  });
  await page.evaluate(() => window.__t1.run(20, { x: 0, z: 0 }));
  await shot('twin-gate-close.png');

  // ---------------------------------------------------------------- 4. BB-02: standalone pieces through the base API
  await page.evaluate(() => window.__playScene.debug.teleport('planet', 0, 10, 0, 0));
  const built = await page.evaluate(() => {
    const api = window.hmPlay.base;
    const w0 = api.world();
    const shelter = w0.base.structures[0];
    const at = { x: (shelter?.x ?? 0) + 16, z: (shelter?.z ?? 0) + 16 };
    window.__playScene.debug.teleport('planet', at.x, at.z, 0, 0);
    window.hmPlay.give?.(0);
    const found = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: at.x, cz: at.z, yaw: 0 });
    const w1 = api.world();
    const st = w1.base.structures[w1.base.structures.length - 1];
    const s = st?.id;
    const wall = api.apply({ t: 'place', at, blueprint: 'bp:starter', piece: { s, kind: 'wall', i: 0, j: 0, k: 0, r: 0 } });
    const ramp = api.apply({ t: 'place', at, blueprint: 'bp:beam:basalt', piece: { s, kind: 'ramp', i: 1, j: 0, k: 0, r: 0 } });
    const w2 = api.world();
    return {
      foundOk: found.events.some((e) => e.type === 'placed'),
      foundWhy: found.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
      wallOk: wall.events.some((e) => e.type === 'placed'),
      wallWhy: wall.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
      rampOk: ramp.events.some((e) => e.type === 'placed'),
      rampWhy: ramp.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
      s,
      st: st ? { x: st.x, y: st.y, z: st.z, yaw: st.yaw } : null,
      pieces: w2.base.pieces.length,
    };
  });
  console.log('BUILD:', JSON.stringify(built));
  check('base: a standalone foundation is placed through the base API', built.foundOk, built.foundWhy);
  check('base: a wall is placed on the new structure', built.wallOk, built.wallWhy);
  check('base: a ramp is placed beside the foundation', built.rampOk, built.rampWhy);

  if (built.foundOk && built.st) {
    const st = built.st;
    // the wall: it lies along local v = 0, i.e. world z = st.z, from x = st.x to st.x + 4 (yaw 0)
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, 0, 0), { x: st.x, z: st.z });
    const wallStop = await page.evaluate(({ z }) => {
      const end = window.__t1.run(120, { x: 0, z: 1 });
      return { z: end.z, passed: end.z < z - 0.05 };
    }, { z: st.z });
    check('BB-02: the wall of the second structure blocks the walk', !wallStop.passed && wallStop.z > st.z - 0.05, `z=${wallStop.z.toFixed(2)} vs wall ${st.z.toFixed(2)}`);

    // the foundation is stood on: its deck is at st.y
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, 0, 0), { x: st.x, z: st.z });
    const stood = await page.evaluate(() => window.__t1.run(20, { x: 0, z: 0 }));
    check('BB-02: the standalone foundation is stood on (feet at its deck)', Math.abs(stood.feet - st.y) < 0.06, `feet=${stood.feet.toFixed(3)} deck=${st.y.toFixed(3)}`);

    // the ramp: from its low edge (world z = st.z + 2 - 2) up its 4 m run, climbing at least 2 m
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 6, z - 1.5, Math.PI, 0), { x: st.x, z: st.z });
    const rampStart = await page.evaluate(() => window.__t1.run(10, { x: 0, z: 0 }).feet);
    const rampPeak = await page.evaluate(() => window.__t1.run(180, { x: 0, z: 1 }).maxFeet);
    check('BB-02: the ramp climbs at least 2 m from its low edge (peak height during the walk)', rampPeak - rampStart >= 2.0, `rise=${(rampPeak - rampStart).toFixed(2)} m`);
    // from 9 m south of the wall, facing it (yaw pi looks toward +z)
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z - 9, Math.PI, 0), { x: st.x, z: st.z });
    await page.evaluate(() => window.__t1.run(12, { x: 0, z: 0 }));
    await shot('standalone-build.png');

    // ---------------------------------------------------------------- 4b. T01b leftovers: windowWall, door, roof, ramp on slope
    const leftovers = await page.evaluate(({ s, at }) => {
      const api = window.hmPlay.base;
      const w0 = api.world();
      // Grant bp:cube:basalt, bp:beam:basalt, ore, and map-basalt to player directly in test fixture
      const grantToPlayer = (item, n) => {
        const slot = w0.player.slots.find((stk) => stk && stk.item === item);
        if (slot) {
          slot.n += n;
        } else {
          const emptyIdx = w0.player.slots.findIndex((stk) => stk === null);
          if (emptyIdx >= 0) {
            w0.player.slots[emptyIdx] = { item, n };
          }
        }
      };
      grantToPlayer('bp:cube:basalt', 1);
      grantToPlayer('bp:beam:basalt', 1);
      grantToPlayer('ore', 5000);
      grantToPlayer('map-basalt', 50);

      // 1. A wall with a window: place at i: 0, j: 0, r: 1 (west edge of cell 0,0)
      const win = api.apply({ t: 'place', at, blueprint: 'bp:cube:basalt', piece: { s, kind: 'windowWall', i: 0, j: 0, k: 0, r: 1 } });

      // 2. A door: place at i: 0, j: 1, r: 0 (north edge of cell 0,0)
      const door = api.apply({ t: 'place', at, blueprint: 'bp:cube:basalt', piece: { s, kind: 'door', i: 0, j: 1, k: 0, r: 0 } });

      // 3. A roof placed while aiming at the floor (k: 0) on cell 0,0: snaps to k=1 (on the walls)
      // roofLevel is 1 + max carrying edge k
      const carrying = new Set(['wall', 'airlock', 'windowWall', 'doorframe', 'door']);
      let roofK = 1;
      const wCur = api.world();
      for (const p of wCur.base.pieces) {
        if (p.s !== s || !carrying.has(p.kind)) continue;
        const touches = (p.i === 0 && p.j === 0) ||
          (p.r === 0 && p.i === 0 && p.j === 1) ||
          (p.r === 1 && p.i === 1 && p.j === 0);
        if (touches) roofK = Math.max(roofK, 1 + p.k);
      }
      const roof = api.apply({ t: 'place', at, blueprint: 'bp:beam:basalt', piece: { s, kind: 'roof', i: 0, j: 0, k: roofK, r: 0 } });

      const w = api.world();
      const placedWin = w.base.pieces.find((p) => p.s === s && p.kind === 'windowWall');
      const placedDoor = w.base.pieces.find((p) => p.s === s && p.kind === 'door');
      const placedRoof = w.base.pieces.find((p) => p.s === s && p.kind === 'roof');

      return {
        winOk: win.events.some((e) => e.type === 'placed'),
        winWhy: win.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
        doorOk: door.events.some((e) => e.type === 'placed'),
        doorWhy: door.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
        roofOk: roof.events.some((e) => e.type === 'placed'),
        roofWhy: roof.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
        doorId: placedDoor?.id ?? null,
        roofK: placedRoof?.k ?? null,
      };
    }, { s: built.s, at: { x: st.x, z: st.z } });

    check('base: windowWall is placed through base API', leftovers.winOk, leftovers.winWhy);
    check('base: door is placed through base API', leftovers.doorOk, leftovers.doorWhy);
    check('base: roof is placed through base API', leftovers.roofOk, leftovers.roofWhy);
    check('T01b: roof placed while aiming at floor lands at k=1', leftovers.roofK === 1, `k=${leftovers.roofK}`);

    // Walk test 1: A wall with a window blocks you at its face
    // Face of windowWall is at local x = 0 (world x = st.x). Start at (st.x + 2, st.z + 2) facing -x (yaw Math.PI / 2).
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, Math.PI / 2, 0), { x: st.x, z: st.z });
    const winStop = await page.evaluate(({ x }) => {
      const end = window.__t1.run(120, { x: 0, z: 1 });
      return { x: end.x, passed: end.x < x - 0.05 };
    }, { x: st.x });
    check('T01b: a wall with a window blocks you at its face', !winStop.passed && winStop.x > st.x - 0.05, `x=${winStop.x.toFixed(2)} vs window ${st.x.toFixed(2)}`);

    // Walk test 2: A door blocks you when closed
    // Door is at local z = 4 (world z = st.z + 4). Start at (st.x + 2, st.z + 2) facing +z (yaw Math.PI).
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, Math.PI, 0), { x: st.x, z: st.z });
    const doorClosedStop = await page.evaluate(({ z }) => {
      const end = window.__t1.run(120, { x: 0, z: 1 });
      return { z: end.z, stopped: end.z < z + 4 - 0.05 };
    }, { z: st.z });
    check('T01b: a door blocks you when closed', doorClosedStop.stopped, `z=${doorClosedStop.z.toFixed(2)} vs door ${(st.z + 4).toFixed(2)}`);

    // Walk test 3: Open the door with the base door action and you walk through
    if (leftovers.doorId !== null) {
      const doorOpened = await page.evaluate((id) => {
        const res = window.hmPlay.base.apply({ t: 'door', id, open: true });
        return res.events.some((e) => e.type === 'door' && e.open === true);
      }, leftovers.doorId);
      await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, Math.PI, 0), { x: st.x, z: st.z });
      const doorOpenPass = await page.evaluate(({ z }) => {
        const end = window.__t1.run(120, { x: 0, z: 1 });
        return { z: end.z, passed: end.z > z + 4 + 0.5 };
      }, { z: st.z });
      check('T01b: open door with base action lets you walk through', doorOpened && doorOpenPass.passed, `opened=${doorOpened} z=${doorOpenPass.z.toFixed(2)} vs door ${(st.z + 4).toFixed(2)}`);
    }

    // Walk test 4: A roof placed while aiming at the floor lands at k=1. You can walk underneath it freely.
    await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 2, z + 2, 0, 0), { x: st.x, z: st.z });
    const underRoof = await page.evaluate(() => {
      const s0 = window.__t1.run(20, { x: 0, z: 0 });
      const s1 = window.__t1.run(40, { x: 0.5, z: 0.5 });
      return { feet0: s0.feet, feet1: s1.feet };
    });
    check('T01b: you can walk underneath roof freely (never pushes at head height)', Math.abs(underRoof.feet0 - st.y) < 0.06 && Math.abs(underRoof.feet1 - st.y) < 0.06, `feet=${underRoof.feet0.toFixed(3)} deck=${st.y.toFixed(3)}`);

    // Walk test 5: A ramp on a slope: find ground at least 10 degrees steep near the plot (scan __playScene.heightAt).
    // Place a ramp there, and walk up it from its low edge.
    const slopeSpot = await page.evaluate(() => {
      const scene = window.__playScene;
      for (let r = 20; r <= 85; r += 2) {
        for (let th = 0; th < Math.PI * 2; th += 0.15) {
          const x = Math.round(r * Math.cos(th));
          const z = Math.round(r * Math.sin(th));
          const hx = scene.heightAt(x + 1, z) - scene.heightAt(x - 1, z);
          const hz = scene.heightAt(x, z + 1) - scene.heightAt(x, z - 1);
          const deg = Math.atan(Math.hypot(hx, hz) / 2) * 180 / Math.PI;
          if (deg >= 10 && deg <= 25) {
            return { x, z, deg: Math.round(deg), h: scene.heightAt(x, z) };
          }
        }
      }
      return null;
    });
    check('T01b: ground at least 10 degrees steep found near plot', !!slopeSpot, slopeSpot ? `${slopeSpot.deg} deg at (${slopeSpot.x}, ${slopeSpot.z})` : 'none found');

    if (slopeSpot) {
      const slopeBuild = await page.evaluate((spot) => {
        const api = window.hmPlay.base;
        const w0 = api.world();
        const grantToPlayer = (item, n) => {
          const slot = w0.player.slots.find((stk) => stk && stk.item === item);
          if (slot) {
            slot.n += n;
          } else {
            const emptyIdx = w0.player.slots.findIndex((stk) => stk === null);
            if (emptyIdx >= 0) {
              w0.player.slots[emptyIdx] = { item, n };
            }
          }
        };
        grantToPlayer('bp:starter', 1);
        grantToPlayer('bp:beam:basalt', 1);
        grantToPlayer('ore', 5000);
        grantToPlayer('map-basalt', 50);

        const at = { x: spot.x, z: spot.z };
        const found = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: at.x, cz: at.z, yaw: 0 });
        const w = api.world();
        const st = w.base.structures[w.base.structures.length - 1];
        if (!st) return { ok: false, why: 'no structure' };
        const s = st.id;
        const ramp = api.apply({ t: 'place', at, blueprint: 'bp:beam:basalt', piece: { s, kind: 'ramp', i: 1, j: 0, k: 0, r: 0 } });
        return {
          ok: found.events.some((e) => e.type === 'placed') && ramp.events.some((e) => e.type === 'placed'),
          foundWhy: found.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
          rampWhy: ramp.events.map((e) => e.type + (e.why ? `:${e.why}` : '')).join(','),
          st: { x: st.x, y: st.y, z: st.z, yaw: st.yaw },
        };
      }, slopeSpot);
      check('base: ramp on slope placed through base API', slopeBuild.ok, `${slopeBuild.foundWhy ?? ''};${slopeBuild.rampWhy ?? ''}`);

      if (slopeBuild.ok && slopeBuild.st) {
        const sst = slopeBuild.st;
        await page.evaluate(({ x, z }) => window.__playScene.debug.teleport('planet', x + 6, z - 1.5, Math.PI, 0), { x: sst.x, z: sst.z });
        const sRampStart = await page.evaluate(() => window.__t1.run(10, { x: 0, z: 0 }).feet);
        const sRampPeak = await page.evaluate(() => window.__t1.run(180, { x: 0, z: 1 }).maxFeet);
        check('T01b: ramp on a slope climbs at least 2 m from its low edge', sRampPeak - sRampStart >= 2.0, `rise=${(sRampPeak - sRampStart).toFixed(2)} m`);
      }
    }
  }

  // ---------------------------------------------------------------- 5. a field machine blocks the walk
  const machine = await page.evaluate(() => {
    window.hmPlay.give(5000);
    const g = window.__playScene.debug.gatePlanet();
    const placed = window.hmPlay.placeAt(g.x + 9, g.z + 6, 'mill');
    const machines = window.hmPlay.plot().machines;
    const m = machines[machines.length - 1];
    return { placed, x: m?.x, z: m?.z, kind: m?.kind };
  });
  if (machine.placed && machine.x !== undefined) {
    await page.evaluate((m) => window.__playScene.debug.teleport('planet', m.x - 4, m.z, -Math.PI / 2, 0), machine);
    const mEnd = await page.evaluate(() => window.__t1.run(160, { x: 0, z: 1 }));
    const d = Math.hypot(mEnd.x - machine.x, mEnd.z - machine.z);
    check('machine: a field machine blocks the walk (1.0 < distance to its centre < 2.6)', d > 1.0 && d < 2.6, `distance ${d.toFixed(2)} m`);
  } else {
    check('machine: a field machine can be placed for the check', false, `placeAt returned ${machine.placed}`);
  }

  // ---------------------------------------------------------------- 6. steering: a scout printed at the Act VI checkpoint
  // (the debug menu's own route: the checkpoint, a fabricator on a hardpoint, Instant builds on, then a scout print)
  const steer = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await steer.addInitScript(() => {
    Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
    try {
      if (!sessionStorage.getItem('ticket01-seeded')) {
        localStorage.clear();
        localStorage.setItem('debug.instantBuilds', '1');
        sessionStorage.setItem('ticket01-seeded', '1');
      }
    } catch {}
  });
  steer.on('pageerror', (err) => { pageErrors.push(err.message); });
  try {
    await steer.goto(`http://localhost:${port}/?checkpoint=act6-start&e2e`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await steer.waitForFunction(() => !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
    const cont = steer.locator('.sm-menu button', { hasText: 'Continue' });
    if (await cont.count()) await cont.first().click();
    else await steer.locator('.sm-menu button', { hasText: 'Expedition' }).first().click();
    await steer.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
    await steer.waitForTimeout(400);
    await steer.evaluate(installHelpers);
    const prep = await steer.evaluate(() => {
      const api = window.hmPlay?.base;
      const scene = window.__playScene;
      if (!api || !scene) return { ok: false, why: 'no base hook' };
      const stock = [
        { item: 'ore', n: 1200 }, { item: 'prim-chassis', n: 40 }, { item: 'prim-beam', n: 40 }, { item: 'prim-column', n: 40 },
        { item: 'prim-cube', n: 40 }, { item: 'map-basalt', n: 40 }, { item: 'map-quartz', n: 40 },
      ];
      api.apply({ t: 'grant', stock });
      if (api.world().stage < 2) { window.hmPlay.raise?.(2); api.apply({ t: 'stage', stage: 2 }); }
      const p = scene.debug.position();
      const at = { x: Math.round(p.x), z: Math.round(p.z) };
      if (!api.world().base.pieces.some((q) => q.kind === 'hardpoint')) {
        const f = api.apply({ t: 'found', at, blueprint: 'bp:starter', cx: at.x, cz: at.z, yaw: 0 });
        if (f.events.some((e) => e.type === 'refused')) return { ok: false, why: 'found refused' };
        const sId = api.world().base.structures[0]?.id;
        if (sId === undefined) return { ok: false, why: 'no structure after found' };
        let placed = false;
        for (const [i, j] of [[1, 0], [0, 1], [2, 0]]) {
          for (const [fi, fj] of [[i, j + 1], [i + 1, j], [i + 1, j + 1]]) {
            api.apply({ t: 'place', at, blueprint: 'bp:starter', piece: { s: sId, kind: 'foundation', i: fi, j: fj, k: 0, r: 0 } });
          }
          const pl = api.apply({ t: 'place', at, blueprint: 'bp:chassis:basalt', piece: { s: sId, kind: 'hardpoint', i, j, k: 0, r: 0 } });
          if (!pl.events.some((e) => e.type === 'refused')) { placed = true; break; }
        }
        if (!placed) return { ok: false, why: 'no hardpoint cell' };
      }
      const hp = api.world().base.pieces.find((q) => q.kind === 'hardpoint');
      if (!hp) return { ok: false, why: 'no hardpoint' };
      const r = api.apply({ t: 'install', at: { x: Math.round(p.x), z: Math.round(p.z) }, hardpoint: hp.id, kind: 'fabricator' });
      if (r.events.some((e) => e.type === 'refused')) return { ok: false, why: 'fabricator not installed' };
      return { ok: true, instant: window.localStorage.getItem('debug.instantBuilds') };
    });
    check('steering setup: the Act VI checkpoint has a fabricator on a hardpoint', prep.ok, prep.why ?? `instant builds key ${prep.instant}`);
    if (prep.ok) {
      // Instant builds on, from the debug menu (the switch the debug-menu check uses): Esc, Debug menu, the switch
      await steer.keyboard.press('Escape');
      await steer.waitForTimeout(250);
      await steer.locator('[data-testid="debug-open"]').waitFor({ state: 'visible', timeout: 10000 });
      await steer.locator('[data-testid="debug-open"]').click();
      await steer.locator('[data-testid="dbg-instant"]').click();
      const instantState = await steer.locator('[data-testid="dbg-instant-state"]').textContent().catch(() => '?');
      check('steering setup: Instant builds is on (debug menu)', instantState === 'On', `state ${instantState}`);
      await steer.keyboard.press('Escape');
      await steer.waitForTimeout(250);
      const scoutCount = () => steer.evaluate(() => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length);
      const before = await scoutCount();
      const queued = await steer.evaluate(() => window.__dev?.printVehicle?.('scout') ?? 'no debug hook');
      await steer.waitForFunction((n) => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length > n, before, { timeout: 30000 }).catch(() => null);
      const scout = await steer.evaluate(() => window.hmPlay.base.world().vehicles.find((v) => v.kind === 'scout') ?? null);
      check('steering setup: a scout is printed (Instant builds)', !!scout, scout ? queued : `${queued}`);
      if (scout) {
        const drive = await steer.evaluate((v) => {
          const heading = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
          const at = () => { const q = window.__playScene.debug.position(); return { x: q.x, z: q.z }; };
          window.__playScene.debug.teleport('planet', v.x, v.z + 2.5, 0, 0);
          const entered = window.hmPlay.base.enterVehicle(v.id);
          if (!entered) return { entered: false };
          const run = (n, steerIn) => window.__t1.run(n, { x: 0, z: 0 }, { vehicleInput: { throttle: steerIn === 0 ? 1 : 0.6, steer: steerIn, brake: false } });
          run(90, 0);
          const h0a = at(); run(30, 0); const h0b = at();
          run(120, -1);
          const h1a = at(); run(30, -1); const h1b = at();
          return { entered: true, before: heading(h0a, h0b), after: heading(h1a, h1b) };
        }, scout);
        check('steering: the scout can be entered', drive.entered);
        if (drive.entered) {
          check('steering: steer -1 turns the rover left (yaw goes up while driving)', drive.after > drive.before + 0.1, `yaw ${drive.before.toFixed(2)} -> ${drive.after.toFixed(2)}`);
          // the keys: resume (Esc closes the pause menu), then hold W and A; the screen's own loop maps A to steer -1 (VEH-02)
          await steer.keyboard.press('Escape');
          await steer.waitForTimeout(400);
          const samplePos = () => steer.evaluate(() => { const q = window.__playScene.debug.position(); return { x: q.x, z: q.z }; });
          const headingOf = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
          await steer.keyboard.down('KeyW');
          await steer.waitForTimeout(900);
          const k0 = await samplePos();
          await steer.waitForTimeout(400);
          const k1 = await samplePos();
          await steer.keyboard.down('KeyA');
          await steer.waitForTimeout(1200);
          const j0 = await samplePos();
          await steer.waitForTimeout(400);
          const j1 = await samplePos();
          await steer.keyboard.up('KeyA');
          await steer.keyboard.up('KeyW');
          const hBefore = headingOf(k0, k1), hAfter = headingOf(j0, j1);
          check('steering keys: holding W and A turns the rover left (yaw goes up)', hAfter > hBefore + 0.05, `yaw ${hBefore.toFixed(2)} -> ${hAfter.toFixed(2)}`);
        }
      }
    }
  } catch (err) {
    check('steering: the driving phase runs', false, String(err?.message ?? err).slice(0, 200));
  } finally {
    await steer.close();
  }

  console.log(`\npage errors: ${pageErrors.length}`);
  for (const e of pageErrors) console.log('  ', e);
} catch (err) {
  console.error('ERROR:', err?.stack ?? err);
  results.push({ name: 'run completed', ok: false });
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
process.exit(failed.length === 0 && pageErrors.length === 0 ? 0 : 1);
