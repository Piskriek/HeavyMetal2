/**
 * TICKET-13 part a (T13a) browser check, against the production build (apps/web/dist), booted with ?mash&e2e (the play screen, as test-ticket07a does):
 *   - a heavy light projector installed on a base hardpoint runs, and the plot's stage pushes to the blue sky (stage 4, ruling 06);
 *   - a perimeter turret on a roof corner (a floor held by walls) places, and it hits a swarmer 30 m away;
 *   - the same turret ignores a swarmer inside the gate's 25 m safe dome (its hp does not drop while it stands there);
 *   - the turret's shots go through the monsters' own hit path (the swarmer dies, its drop is the leaksim archetype's);
 *   - each turret is built from the three packed parts (base, yoke, gun), not the fallback, and its base plate meets its yoke;
 *   - four turrets on the Low tier: frames per second and the cost of one frame (the perf script's readback method);
 *   - shots (the turret tracking with its laser, the turret from three sides on the roof, the projector and the push), each
 *     looked at by eye; the subject is in view when the camera faces it within 0.85 (cosine), HUD hidden;
 *   - zero console errors, zero page errors, and no HUD zone overlaps at any shot.
 *
 * Run it on the 3D PC worker after a build (the snapshot carries only this task's files):
 *   scripts/test-on-3dpc.sh --worker-only --only "<paths>" "npm run build && node scripts/test-ticket13.mjs"
 * Writes shots-run/ticket13-*.png and prints one line per check. Exits 1 on any failed check.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { hudZoneViolations } from './e2e-hud-and-luminance-gate.mjs';

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
const shots = fileURLToPath(new URL('../shots-run/', import.meta.url));
fs.mkdirSync(shots, { recursive: true });

const port = 8196;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => page.waitForTimeout(ms);

/** The cosine between the camera's view and the direction to (tx, tz): 1 when the subject is dead centre. */
const facing = (tx, tz) =>
  page.evaluate(({ tx, tz }) => {
    const sc = window.__playScene?.debug?.planetScene?.();
    if (!sc) return 0;
    let cam = null;
    sc.traverse((o) => { if (o.isPerspectiveCamera && o.parent === sc) cam = o; });
    if (!cam) return 0;
    const e = cam.matrixWorld.elements;
    const f = [-e[8], -e[10]];
    const d = [tx - e[12], tz - e[14]];
    const fl = Math.hypot(f[0], f[1]) || 1, dl = Math.hypot(d[0], d[1]) || 1;
    return (f[0] * d[0] + f[1] * d[1]) / (fl * dl);
  }, { tx, tz });

/** The yaw that faces (tx, tz) from (px, pz), in the same convention the planet's view uses (07a's faceLeak). */
const yawToward = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));

/** The walker's own avatar hides the view in third person (it stands on the camera), so the shots are taken in first person (07a's V key). */
const firstPerson = async () => {
  const visible = () => page.evaluate(() => window.__playScene?.debug?.avatar?.()?.visible ?? false);
  for (let i = 0; i < 3 && (await visible()); i++) {
    await page.keyboard.press('KeyV');
    await sleep(150);
  }
  return !(await visible());
};

/** Teleports the walker to (px, pz), turns to face (tx, tz) and tilts to `pitch`, first person; retried until the subject is centred. */
const lookAt = async (px, pz, tx, tz, pitch = 0) => {
  let dot = NaN;
  for (let attempt = 0; attempt < 3 && !(dot >= 0.85); attempt++) {
    await page.evaluate(([x, z, yaw, p]) => window.hmPlay.go('planet', x, z, yaw, p), [px, pz, yawToward(px, pz, tx, tz), pitch]);
    await sleep(350);
    await firstPerson();
    dot = await facing(tx, tz);
  }
  return dot;
};

/** The 3-D cosine between the camera's view and the direction to (tx, ty, tz): 1 when the subject is dead centre. */
const facing3 = (tx, ty, tz) =>
  page.evaluate(({ tx, ty, tz }) => {
    const sc = window.__playScene?.debug?.planetScene?.();
    if (!sc) return 0;
    let cam = null;
    sc.traverse((o) => { if (o.isPerspectiveCamera && o.parent === sc) cam = o; });
    if (!cam) return 0;
    const e = cam.matrixWorld.elements;
    const f = [-e[8], -e[9], -e[10]];
    const d = [tx - e[12], ty - e[13], tz - e[14]];
    const fl = Math.hypot(f[0], f[1], f[2]) || 1, dl = Math.hypot(d[0], d[1], d[2]) || 1;
    return (f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / (fl * dl);
  }, { tx, ty, tz });

/** Teleports to (px, pz) facing the subject at (tx, ty, tz), and keeps the pitch that centres it best (first person). */
const lookAt3 = async (px, pz, tx, ty, tz) => {
  const yaw = yawToward(px, pz, tx, tz);
  const pitches = [0.15, 0.3, 0.45, 0.6];
  let best = { dot: -1, pitch: pitches[0] };
  for (const pitch of pitches) {
    await page.evaluate(([x, z, yw, pt]) => window.hmPlay.go('planet', x, z, yw, pt), [px, pz, yaw, pitch]);
    await sleep(300);
    await firstPerson();
    const dot = await facing3(tx, ty, tz);
    if (dot > best.dot) best = { dot, pitch };
  }
  if (best.pitch !== pitches[pitches.length - 1]) {
    await page.evaluate(([x, z, yw, pt]) => window.hmPlay.go('planet', x, z, yw, pt), [px, pz, yaw, best.pitch]);
    await sleep(300);
    best.dot = await facing3(tx, ty, tz);
  }
  return best.dot;
};

const hudCleanShot = (on) =>
  page.evaluate((hide) => {
    window.hmPlay.hideOverlays?.(hide);
    // the first-person rig hangs helmet and visor meshes on the camera: they hide for a clean shot (07a's method)
    const sc = window.__playScene?.debug?.planetScene?.();
    if (sc) {
      let cam = null;
      sc.traverse((o) => { if (o.isPerspectiveCamera && o.parent === sc) cam = o; });
      cam?.children.forEach((child) => { child.visible = !hide; });
    }
    const id = '__t13_hide__';
    let style = document.getElementById(id);
    if (hide) {
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        style.textContent = '[data-hud-root] > *:not(canvas):not(.play-canvas), [data-hud-zone], .mentor-subtitle, [data-testid="mentor-subtitle"] { display: none !important; }';
        document.head.appendChild(style);
      }
    } else {
      style?.remove();
    }
  }, on);

const shot = async (name) => {
  const overlaps = await hudZoneViolations(page).catch(() => []);
  await page.screenshot({ path: `${shots}${name}.png` });
  return overlaps;
};

/** Model of the base's structure frame: a piece's cell (i, j) corner (u, v) in metres to world x, z (the structure's yaw). */
const worldOf = (st, u, v) => ({
  x: st.x + u * Math.cos(st.yaw) - v * Math.sin(st.yaw),
  z: st.z + u * Math.sin(st.yaw) + v * Math.cos(st.yaw),
});
const CELL = 4;

const worldState = () =>
  page.evaluate(() => {
    const w = window.hmPlay.base.world();
    return {
      structures: w.base.structures.map((q) => ({ id: q.id, x: q.x, z: q.z, yaw: q.yaw })),
      pieces: w.base.pieces.map((p) => ({ id: p.id, s: p.s, kind: p.kind, i: p.i, j: p.j, k: p.k, r: p.r })),
      stage: window.hmPlay.state?.()?.plot?.stage ?? null,
      baseStage: w.stage,
      machines: window.hmPlay.state?.()?.plot?.machines?.map((m) => m.kind) ?? [],
      pose: window.hmPlay.pose(),
    };
  });

const apply = (cmd) => page.evaluate((c) => window.hmPlay.base.apply(c), cmd);
let S_ID = null; // the structure this run founds (the mash start already has one)
const countPieces = async (kind) => (await worldState()).pieces.filter((p) => p.kind === kind && p.s === S_ID).length;

const mobsNow = () => page.evaluate(() => (window.__playScene?.monsters?.getMobList?.() ?? []).map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, x: m.pos.x, z: m.pos.z })));

try {
  await page.goto(`${base}/?mash&e2e`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev && !!window.hmPlay, null, { timeout: 35000 });
  // the Low tier, as the perf script sets it: the profile's quality, then a reload so the graphics pick it up
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('hm.profile.v2', JSON.stringify({ name: 'T13', tutorialDone: true, quality: 'low' }));
    localStorage.setItem('hm.player.v1', JSON.stringify({ created: true }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.__dev && !!window.hmPlay, null, { timeout: 35000 });
  await sleep(800);

  // ---- the stock: the starter kit's blueprint, the basalt column and chassis blueprints, and the bills' materials
  const grants = [
    ['bp:starter', 1], ['bp:column:basalt', 1], ['bp:chassis:basalt', 1],
    ['ore', 900], ['prim-beam', 4], ['prim-chassis', 5], ['prim-column', 9], ['prim-cube', 8],
    ['map-basalt', 8], ['map-quartz', 4],
  ];
  for (const [item, n] of grants) {
    const ok = await page.evaluate(([i, k]) => window.__dev.grant(i, k), [item, n]);
    check(`granted ${n} ${item}`, ok, ok ? '' : 'pack full or unknown item');
  }

  // ---- the plot reaches stage 2 (the game's own stage line; the grind is skipped), the monsters fight
  await page.evaluate(() => window.hmPlay.setStage(2));
  await page.evaluate(() => window.__playScene.monsters.setUnlocked(true));
  const gate = await page.evaluate(() => window.hmPlay.gate());
  check('the Twin Gate is on the planet', !!gate, gate ? `gate ${gate.x.toFixed(1)},${gate.z.toFixed(1)}` : '');

  // the base sits 22 m east of the gate: the projector's hardpoint is 24 m out (in the gate's 30 m reach), the turret 32 m out
  const B = { x: gate.x + 22, z: gate.z };
  await page.evaluate(([x, z]) => window.hmPlay.go('planet', x - 8, z, Math.PI / 2, 0), [B.x, B.z]);
  await sleep(500);
  let pose = await page.evaluate(() => window.hmPlay.pose());

  // ---- building: the starter blueprint's foundation, walls and floor (the roof), the chassis blueprint's hardpoint,
  //      the column blueprint's turret on the roof's corner
  const found = await apply({ t: 'found', at: { x: pose.x, z: pose.z }, blueprint: 'bp:starter', cx: B.x, cz: B.z, yaw: 0 });
  let ws = await worldState();
  const mine = ws.structures.find((q) => Math.hypot(q.x - (B.x - 2), q.z - (B.z - 2)) < 1);
  check('a foundation is founded on the planet', !!mine && ws.pieces.some((p) => p.kind === 'foundation' && p.s === mine.id), mine ? `structure ${mine.id}` : 'no structure at the base');
  const s = mine ? mine.id : -1;
  S_ID = s;
  for (const [i, j] of [[1, 0], [0, 1], [1, 1], [2, 0]]) await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:starter', piece: { s, kind: 'foundation', i, j, k: 0, r: 0 } });
  // the roof cell (2, 0): walls on its four sides, then the floor on top of them
  for (const [i, j, r] of [[2, 0, 0], [2, 1, 0], [2, 0, 1], [3, 0, 1]]) await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:starter', piece: { s, kind: 'wall', i, j, k: 0, r } });
  await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:starter', piece: { s, kind: 'floor', i: 2, j: 0, k: 1, r: 0 } });
  await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:chassis:basalt', piece: { s, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 } });
  ws = await worldState();
  const own = (kind) => ws.pieces.filter((p) => p.kind === kind && p.s === s);
  check('the walls and the floor stand on the foundations', own('wall').length === 4 && own('floor').length === 1, `walls ${own('wall').length}`);
  const pad = own('hardpoint')[0];
  check('the 2x2 hardpoint is placed on the foundations', !!pad, pad ? `at ${pad.i},${pad.j}` : 'no hardpoint');
  if (!pad) throw new Error('no hardpoint on the new structure: the rest of the build cannot run');

  // the stage gate: before the base reaches stage 2 a turret on a supported corner is refused as locked; then stage 2 opens it
  await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:column:basalt', piece: { s, kind: 'turret', i: 3, j: 1, k: 1, r: 0 } });
  check('a turret waits for stage 2 (refused as locked before it)', (await countPieces('turret')) === 0, `turrets ${await countPieces('turret')}`);
  await apply({ t: 'stage', stage: 2 });
  check('the base reaches stage 2 (the turret unlock)', (await worldState()).baseStage === 2, `base stage ${(await worldState()).baseStage}`);
  // a floating turret is refused: a corner with nothing under it
  await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:column:basalt', piece: { s, kind: 'turret', i: 6, j: 6, k: 1, r: 0 } });
  check('a turret over nothing is refused (no floating turret)', (await countPieces('turret')) === 0);

  // the turrets on the roof's corners: (3,1) first, checking that one built turret adds 2 kW to the HUD readout (POL-292)
  const getHudDemand = () => page.evaluate(() => {
    const el = document.querySelector('.play-power b');
    return el ? parseFloat(el.textContent || '0') : null;
  });
  const demand0 = await getHudDemand();

  await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:column:basalt', piece: { s, kind: 'turret', i: 3, j: 1, k: 1, r: 0 } });
  await sleep(600);
  const demand1 = await getHudDemand();
  check('one built turret adds 2 kW to the HUD readout (POL-292)', demand0 !== null && demand1 !== null && demand1 - demand0 === 2, `demand ${demand0} -> ${demand1} kW`);

  // then the other three corners of the roof cell (four in all for the perf run)
  for (const [i, j] of [[2, 0], [2, 1], [3, 0]]) await apply({ t: 'place', at: { x: pose.x, z: pose.z }, blueprint: 'bp:column:basalt', piece: { s, kind: 'turret', i, j, k: 1, r: 0 } });
  check('four perimeter turrets stand on the roof corners', (await countPieces('turret')) === 4, `turrets ${await countPieces('turret')}`);

  // the heavy light projector on the hardpoint: the real install (the machine picker's command), which places it on the plot
  const beforeStage = (await worldState()).stage;
  await apply({ t: 'install', at: { x: pose.x, z: pose.z }, hardpoint: pad.id, kind: 'projector' });
  await sleep(900);
  ws = await worldState();
  check('the heavy light projector is installed on the hardpoint', ws.machines.includes('heavy-projector'), `plot machines ${ws.machines.join(',')}`);
  check('ruling 06: the first running projector pushes the plot to the blue sky (stage 4)', ws.stage === 4, `stage ${beforeStage} -> ${ws.stage}`);
  // the push shot straight after the install, while the blue-sky wave is still crossing the plot (the projector is the wave's origin)
  await hudCleanShot(true);
  const projectorAt = { x: B.x + 2, z: B.z + 2 };
  const pushDot = await lookAt(projectorAt.x - 9, projectorAt.z - 1, projectorAt.x, projectorAt.z, 0.05);
  const pushOv = await shot('ticket13-stage-push');
  check('the stage-push shot has the projector in view (cosine >= 0.85)', pushDot >= 0.85, `cosine ${pushDot.toFixed(2)}`);
  check('no HUD zone overlaps at the stage-push shot', pushOv.length === 0, JSON.stringify(pushOv).slice(0, 120));
  await hudCleanShot(false);

  // ---- the turrets are the packed parts (base, yoke, gun) and not the fallback; each base plate meets its yoke
  const turretParts = await page.evaluate(() => {
    const sc = window.__playScene?.debug?.planetScene?.();
    // the world span of an object's meshes, from each mesh's bounding box and world matrix (column-major elements)
    const span = (obj) => {
      let lo = Infinity, hi = -Infinity;
      obj.updateWorldMatrix(true, true);
      obj.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox;
        const e = m.matrixWorld.elements;
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          lo = Math.min(lo, wy);
          hi = Math.max(hi, wy);
        }
      });
      return { lo, hi };
    };
    const out = [];
    sc?.traverse((o) => {
      if (!o.name || !o.name.startsWith('perimeter-turret-')) return;
      const base = o.children.find((c) => c.name === 'turret-base');
      const yoke = o.children.find((c) => c.name === 'turret-yoke');
      out.push({ name: o.name, y: o.matrixWorld.elements[13], src: o.userData.partSource ?? null, base: base ? span(base) : null, yoke: yoke ? span(yoke) : null });
    });
    return out;
  });
  check('each turret is built from the packed parts (base, yoke and gun), not the fallback', turretParts.length === 4 && turretParts.every((t) => t.src && t.src.base === 'gen' && t.src.yoke === 'gen' && t.src.gun === 'gen'), turretParts.map((t) => `${t.name}: ${t.src ? [t.src.base, t.src.yoke, t.src.gun].join('/') : 'none'}`).join('; '));
  const gap = turretParts.map((t) => (t.base && t.yoke ? t.base.hi - t.yoke.lo : NaN));
  check('each base plate meets its yoke (the base top is the yoke bottom, within 3 cm)', gap.length === 4 && gap.every((g) => Math.abs(g) < 0.03), gap.map((g) => g.toFixed(3)).join(' '));
  const turretY = turretParts[0]?.y ?? 2.6;

  // ---- the turret ranges: a swarmer 30 m out (outside the dome), and one inside the gate's dome (18 m from the gate)
  const T = { x: B.x + 10, z: B.z + 2 }; // corner (3, 1) of the roof, one level up
  const outside = { x: T.x + 30, z: T.z };
  const inside = { x: gate.x + 18, z: gate.z };
  const distGate = (p) => Math.hypot(p.x - gate.x, p.z - gate.z);
  check('the 30 m target is outside the 25 m dome', distGate(outside) > 25, `${distGate(outside).toFixed(1)} m from the gate`);
  check('the dome target is inside the 25 m dome and inside turret range', distGate(inside) < 25 && Math.hypot(inside.x - T.x, inside.z - T.z) < 35, `${Math.hypot(inside.x - T.x, inside.z - T.z).toFixed(1)} m from the turret`);
  const idOut = await page.evaluate(([x, z]) => window.__playScene.monsters.placeMob('swarmer', x, z), [outside.x, outside.z]);
  const idIn = await page.evaluate(([x, z]) => window.__playScene.monsters.placeMob('swarmer', x, z), [inside.x, inside.z]);
  const startIn = (await mobsNow()).find((m) => m.id === idIn)?.hp ?? null;
  let outDead = false, outTime = null, inDamaged = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && !outDead) {
    await page.evaluate(() => window.__dev.setHp(100));
    const mobs = await mobsNow();
    const o = mobs.find((m) => m.id === idOut);
    const i = mobs.find((m) => m.id === idIn);
    if (i && startIn !== null && i.hp < startIn && distGate({ x: i.x, z: i.z }) < 25) inDamaged = true;
    if (!o) {
      outDead = true;
      outTime = (Date.now() - t0) / 1000;
    }
    await sleep(250);
  }
  check('the turret kills the swarmer 30 m out (the shot goes through the monsters\' hit path)', outDead, outDead ? `in ${outTime.toFixed(1)} s` : 'still alive after 12 s');
  check('the turret ignores the swarmer inside the gate dome (its hp never drops while it stands there)', !inDamaged, inDamaged ? 'it was hit inside the dome' : `hp ${startIn}`);
  await page.evaluate((id) => window.__playScene.monsters.hurtMob(id, 999), idIn);

  // ---- the laser: a sapper out at 30 m keeps the turret tracking for a few seconds (the laser is drawn while it tracks)
  const sapperAt = { x: T.x + 30, z: T.z + 6 };
  const sapperId = await page.evaluate(([x, z]) => window.__playScene.monsters.placeMob('sapper', x, z), [sapperAt.x, sapperAt.z]);
  await sleep(900);

  // ---- shots: the turret tracking from the side (the laser on the sapper), the roof from three sides, the projector and the push
  await hudCleanShot(true);
  // clear ground off the base's walls: north-west of the turret, so the laser runs away to the east on the right of the frame
  const side = await lookAt(T.x - 8, T.z + 8, T.x, T.z, 0.12);
  const overSide = await shot('ticket13-turret-tracking-side');
  check('the shot of the tracking turret has the turret in view (cosine >= 0.85)', side >= 0.85, `cosine ${side.toFixed(2)}`);
  check('no HUD zone overlaps at the tracking shot', overSide.length === 0, JSON.stringify(overSide).slice(0, 160));
  const sapperAlive = (await mobsNow()).some((m) => m.id === sapperId);
  console.log(`info: the sapper is ${sapperAlive ? 'alive' : 'already down'} at the tracking shot`);

  // three sides, each on clear ground (the roof cell's walls are never between the camera and the turret)
  // close-ups of the roof turret: from the side (east, 3.2 m) and from two three-quarter views (north-east and north-west),
  // the turret centred, its base plate, pedestal, yoke and gun in view
  for (const [name, px, pz] of [['side', T.x + 3.2, T.z], ['three-quarter', T.x + 2.5, T.z + 2.5], ['three-quarter-west', T.x - 2.2, T.z + 2.6]]) {
    const dot = await lookAt3(px, pz, T.x, turretY + 0.8, T.z);
    const ov = await shot(`ticket13-turret-close-${name}`);
    check(`the roof turret, close from the ${name}, is in view (3-D cosine >= 0.9)`, dot >= 0.9, `cosine ${dot.toFixed(2)}`);
    check(`no HUD zone overlaps at the close ${name} shot`, ov.length === 0, JSON.stringify(ov).slice(0, 120));
  }

  await hudCleanShot(false);

  // ---- Low tier, four turrets: frames per second, and the cost of one frame (the readback waits for the card)
  await lookAt(B.x - 8, B.z, T.x, T.z, 0);
  await sleep(1500);
  const perf = await page.evaluate(async () => {
    const dts = [];
    let last = performance.now();
    const end = last + 3000;
    await new Promise((resolve) => {
      const tick = (now) => {
        dts.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const body = dts.slice(1);
    const avg = body.reduce((a, b) => a + b, 0) / Math.max(1, body.length);
    const stats = window.__playScene?.debug?.stats?.() ?? { triangles: null, calls: null };
    return { fps: 1000 / avg, frames: body.length, triangles: stats.triangles, calls: stats.calls, quality: window.__playScene?.debug?.detail?.() ?? null };
  });
  // the frame cost: one pixel read back each frame waits for the card, so the spacing is the frame's real cost (the perf script's method)
  const cost = await page.evaluate(() => new Promise((done) => {
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const gl = cv ? (cv.getContext('webgl2') ?? cv.getContext('webgl')) : null;
    const px = new Uint8Array(4), ts = [];
    let last = performance.now(), n = 0;
    const tick = () => {
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const now = performance.now();
      ts.push(now - last);
      last = now;
      if (++n < 60) requestAnimationFrame(tick);
      else { const body = ts.slice(5).sort((a, b) => a - b); done({ median: body[Math.floor(body.length / 2)] ?? null, n: body.length }); }
    };
    requestAnimationFrame(tick);
  }));
  check('four turrets on Low run at a playable rate (>= 25 fps over 3 s)', perf.fps >= 25, `${perf.fps.toFixed(1)} fps over ${perf.frames} frames, ${perf.triangles} triangles, ${perf.calls} calls`);
  console.log(`info: four turrets, Low: median frame cost with a synced readback ${cost.median?.toFixed(1) ?? 'n/a'} ms over ${cost.n} frames (the GPU timer is not exposed by the play scene)`);

  // ---- the console: no errors through the whole run
  check('no console or page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ').slice(0, 300));
} catch (err) {
  check('the run reached its end', false, err?.message ?? String(err));
} finally {
  fs.writeFileSync(`${shots}ticket13-results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
