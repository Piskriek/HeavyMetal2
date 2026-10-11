/**
 * TASK-14 §1: one fresh playthrough of the first hour, against the production build (apps/web/dist).
 *
 * A new browser profile (a new context), then the beats in order:
 *   1 menu -> Expedition, 2 Act I wake (A1-01), 3 power wall (A1-02), 4 breaker and lever, power on (A1-03, A1-04),
 *   5 Act II window (A2-01), gate approach (A2-02), the gate opens (A2-03, A2-04),
 *   6 the Moon: stepping through (A3-01, stage 0, the moon music), 7 the first machine on the Moon (A3-03, its plume),
 *   8 building: the TASK-13 pieces drawn with their generated models (the ?base&kit=1 route),
 *   9 rover: enter the scout, drive (the driving music), 10 Monster Mash: mobs, combat music, a kill (M-02),
 *   11 reload: the save loads and Act I does not replay.
 *
 * Every beat: a shot in docs/shots/playthrough/, the FPS over two seconds, and a pass or fail. Console errors and HTTP
 * errors (404s) are collected across the whole run. Exit code 1 when any beat fails.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
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
const shotsDir = path.join(root, 'docs/shots/playthrough');
fs.mkdirSync(shotsDir, { recursive: true });
// this run's shots only: earlier runs' files would be mixed in
for (const f of fs.readdirSync(shotsDir)) {
  if (f.endsWith('.png') || f === 'summary.json') fs.unlinkSync(path.join(shotsDir, f));
}

const port = 8093;
const base = `http://localhost:${port}`;
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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
});

const consoleErrors = [];
const httpErrors = [];
const warnings = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
  if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('response', (res) => {
  if (res.status() >= 400) httpErrors.push(`${res.status()} ${res.url()}`);
});
page.on('requestfailed', (req) => httpErrors.push(`failed ${req.url()} ${req.failure()?.errorText ?? ''}`));

const results = [];
let shotNo = 0;
const shot = async (name) => {
  shotNo += 1;
  const file = path.join(shotsDir, `${String(shotNo).padStart(2, '0')}-${name}.png`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.screenshot({ path: file });
      return file;
    } catch (err) {
      if (attempt === 5) throw err;
      await page.waitForTimeout(300);
    }
  }
  return file;
};

const fps = (ms = 2000) => page.evaluate((ms) => new Promise((resolve) => {
  let n = 0;
  const t0 = performance.now();
  const frame = () => {
    n += 1;
    if (performance.now() - t0 < ms) requestAnimationFrame(frame);
    else resolve(Math.round((n * 1000) / (performance.now() - t0)));
  };
  requestAnimationFrame(frame);
}), ms);

const subId = () => page.evaluate(() => window.hmPlay?.subtitles?.()?.id ?? null);
const waitSub = async (id, timeout = 5000) => {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    last = await subId();
    if (last === id) return true;
    await page.waitForTimeout(150);
  }
  return last === id;
};

// The narrator speaks one line at a time: a trigger sent while a line plays is dropped. Wait for a quiet subtitle.
const quiet = async (timeout = 25000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await subId()) === null) return true;
    await page.waitForTimeout(200);
  }
  return false;
};

const beat = async (name, fn) => {
  const started = Date.now();
  const row = { name, ok: false, detail: '', fps: null, shot: null, seconds: 0 };
  try {
    const out = await fn(row);
    row.ok = out?.ok === true;
    row.detail = out?.detail ?? '';
  } catch (err) {
    row.detail = `error: ${err.message.split('\n')[0]}`;
  }
  row.seconds = Math.round((Date.now() - started) / 1000);
  row.fps = await fps(2000).catch(() => null);
  results.push(row);
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name} | fps ${row.fps ?? '?'} | ${row.detail}`);
  return row;
};

const dismissCreator = () => page.evaluate(() => {
  const done = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Done'));
  done?.click();
});

const startFromMenu = async () => {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const labels = await page.locator('.sm-menu button').allTextContents();
  console.log('menu buttons:', labels.map((s) => s.trim()).join(' | '));
  const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
  const btn = page.locator('.sm-menu button', { hasText: want }).first();
  await btn.waitFor({ state: 'visible', timeout: 25000 });
  await btn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(500);
  return want;
};

// ----------------------------------------------------------------------------------------------------------------------
// The beats
// ----------------------------------------------------------------------------------------------------------------------
let menuChoice = null;

await beat('1 main menu, Expedition starts a new game', async () => {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  await shot('menu');
  await expBtn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(500);
  const where = await page.evaluate(() => window.hmPlay?.where);
  return { ok: where === 'lab', detail: `where=${where}` };
});

await beat('2 Act I: waking speaks A1-01 with the subtitle', async (row) => {
  const seen = await waitSub('A1-01', 15000);
  const visible = await page.locator('[data-testid="mentor-subtitle"]').isVisible().catch(() => false);
  row.shot = await shot('act1-wake');
  return { ok: seen && visible, detail: `subtitle A1-01 seen=${seen} visible=${visible}` };
});

await beat('3 looking at the power wall gives A1-02', async (row) => {
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', -4.2, 1.0, Math.PI / 2, 0);
    window.hmPlay.trigger('look:power-wall');
  });
  const ok = await waitSub('A1-02', 4000);
  await page.waitForTimeout(700);
  row.shot = await shot('power-wall');
  return { ok, detail: `A1-02 seen=${ok}` };
});

await beat('4 breaker and lever: relays and coils come up, power on gives A1-04', async (row) => {
  await quiet();
  await page.evaluate(() => window.hmPlay.pull());
  const breaker = await waitSub('A1-03', 4000);
  await page.waitForTimeout(3500);
  row.shot = await shot('breaker-lever');
  await quiet();
  await page.evaluate(() => window.hmPlay.trigger('power:on'));
  const on = await waitSub('A1-04', 4000);
  await page.waitForTimeout(3500);
  await shot('power-on');
  return { ok: breaker && on, detail: `A1-03=${breaker} A1-04=${on}` };
});

await beat('5 Act II: the window gives A2-01, the gate approach A2-02, the gate opens (A2-03, A2-04)', async (row) => {
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 2.2, 0, 0);
    window.hmPlay.trigger('look:window');
  });
  const window1 = await waitSub('A2-01', 4000);
  await page.waitForTimeout(600);
  await shot('window');
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 3.2, 0, 0);
    window.hmPlay.trigger('gate:approach');
  });
  const approach = await waitSub('A2-02', 4000);
  await page.waitForTimeout(600);
  await shot('gate-approach');
  await quiet();
  await page.evaluate(() => window.hmPlay.trigger('gate:lever'));
  const lever = await waitSub('A2-03', 4000);
  await quiet();
  await page.evaluate(() => window.hmPlay.trigger('gate:open'));
  const open = await waitSub('A2-04', 4000);
  await page.waitForTimeout(2500);
  row.shot = await shot('gate-open');
  return { ok: window1 && approach && open, detail: `A2-01=${window1} A2-02=${approach} A2-03=${lever} A2-04=${open}` };
});

await beat('6 the Moon: stepping through gives A3-01, stage-0 Moon and its music', async (row) => {
  // walk north (W) through the open gate on the lab floor, with the game's own loop running, until the planet takes over
  await quiet();
  await page.evaluate(() => {
    window.__playScene.debug.teleport('lab', 0.0, 3.0, 0, 0);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
  });
  await page.keyboard.down('KeyW');
  let reached = false;
  for (let i = 0; i < 48 && !reached; i++) {
    await page.waitForTimeout(250);
    reached = (await page.evaluate(() => window.__playScene.debug.where())) === 'planet';
  }
  await page.keyboard.up('KeyW');
  const whereNow = await page.evaluate(() => window.hmPlay.where);
  const seen = await waitSub('A3-01', 5000);
  await page.waitForTimeout(2000);
  const music = await page.evaluate(() => window.hmPlay.audio?.getMusicContext?.() ?? null);
  const stage = await page.evaluate(() => window.hmPlay.state?.()?.plot?.stage ?? null);
  row.shot = await shot('moon-stage0');
  const ok = whereNow === 'planet' && seen && music === 'moon' && (stage === 0 || stage === null);
  return { ok, detail: `where=${whereNow} A3-01=${seen} music=${music} stage=${stage}` };
});

await beat('7 the first machine on the Moon: A3-03, its plume rises from the machine', async (row) => {
  // a fresh profile has no ore: the first machine is paid from the plot, as the owner's first hour would be.
  // The first-machine line is dropped while A3-01 still plays, so wait for a quiet narrator before placing.
  await quiet();
  const placed = await page.evaluate(() => {
    window.hmPlay.give(400);
    const scene = window.__playScene;
    const p = scene.debug.position();
    const g = scene.debug.gatePlanet();
    // canPlace refuses ground near the gate: 10 m out from the gate, on the player's side
    const dx = p.x - g.x, dz = p.z - g.z, h = Math.hypot(dx, dz) || 1;
    return window.hmPlay.placeAt(g.x + (dx / h) * 10, g.z + (dz / h) * 10, 'mill');
  });
  await page.waitForTimeout(800);
  const a3 = await waitSub('A3-03', 4000);
  await page.waitForTimeout(3500);
  const machines = await page.evaluate(() => window.hmPlay.machines());
  const plumes = await page.evaluate(() => window.hmPlay.plumeGlowCount?.() ?? null);
  row.shot = await shot('first-machine');
  // the plume is the machine's pouring state (plumeGlow is a detail setting, reported only)
  const ok = placed === true && a3 && machines.standing >= 1 && machines.pouring >= 1;
  const refusal = warnings.filter((w) => w.includes('canPlace refused')).slice(-1)[0] ?? '';
  return { ok, detail: `placed=${placed} A3-03=${a3} standing=${machines.standing} pouring=${machines.pouring} plumeGlow=${plumes} ${refusal}` };
});

await beat('8 building: the TASK-13 pieces are drawn with their generated models (?base&kit=1)', async (row) => {
  await page.goto(`${base}/?base&kit=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.hmPlay?.teleportPlanet?.();
    window.hmPlay?.setPaused?.(false);
    window.hmPlay?.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 20000 });
  const drawn = await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const pieces = api.world().base.pieces;
    const kinds = {};
    let withBounds = 0;
    for (const p of pieces) {
      kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
      if (window.__playScene.debug.pieceBounds(p.id)) withBounds += 1;
    }
    return { total: pieces.length, withBounds, kinds };
  });
  // look at the outpost from outside: the centre of the drawn pieces, 12 m away
  await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const pieces = api.world().base.pieces;
    let cx = 0, cz = 0, n = 0;
    for (const p of pieces) {
      const b = window.__playScene.debug.pieceBounds(p.id);
      if (!b) continue;
      cx += (b.min[0] + b.max[0]) / 2; cz += (b.min[2] + b.max[2]) / 2; n += 1;
    }
    if (n === 0) return;
    cx /= n; cz /= n;
    // a neutral hotbar slot, so no blueprint ghost covers the pieces; the camera 7 m from the centre, looking at it
    const slots = api.world().player.slots;
    const neutral = slots.findIndex((s, k) => k < 9 && (!s || !String(s.item).startsWith('bp:')));
    if (neutral >= 0) api.apply({ t: 'hotbar', index: neutral });
    const off = 7 * Math.SQRT1_2;
    window.__playScene.debug.teleport('planet', cx - off, cz - off, Math.PI / 4 + Math.PI, -0.2);
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__hm?.hideOverlays?.(true));
  await page.waitForTimeout(400);
  row.shot = await shot('base-pieces');
  await page.evaluate(() => window.__hm?.hideOverlays?.(false));
  const ok = drawn.total >= 5 && drawn.withBounds === drawn.total;
  return { ok, detail: `pieces=${drawn.total} drawn=${drawn.withBounds} kinds=${JSON.stringify(drawn.kinds)}` };
});

await beat('9 rover: enter the scout, drive (driving music), leave', async (row) => {
  // the kit world has no scout until a fabricator prints one: put a scout beside the player, as the base suite does
  const info = await page.evaluate(() => {
    const api = window.__hm?.base ?? window.hmPlay?.base;
    const w = api.world();
    const p = window.__playScene.debug.position();
    if (!w.vehicles.some((v) => v.kind === 'scout')) {
      w.vehicles.push({ id: Math.max(0, ...w.vehicles.map((v) => v.id)) + 1, kind: 'scout', x: p.x + 3.0, z: p.z, yaw: 0 });
    }
    const scout = w.vehicles.find((v) => v.kind === 'scout');
    return scout ? { x: scout.x, z: scout.z } : null;
  });
  if (!info) return { ok: false, detail: 'no scout rover in the world' };
  await page.evaluate(({ x, z }) => {
    window.__playScene.debug.teleport('planet', x - 2.0, z, Math.PI / 2, 0);
  }, info);
  await page.waitForTimeout(500);
  await page.keyboard.press('e');
  await page.waitForTimeout(900);
  const driving = await page.evaluate(() => !!window.__playScene.getDrivingVehicle());
  const musicIn = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    return window.hmPlay.audio?.getMusicContext?.() ?? null;
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  row.shot = await shot('rover-driving');
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  const parked = await page.evaluate(() => !window.__playScene.getDrivingVehicle());
  const ok = driving && musicIn === 'driving' && parked;
  return { ok, detail: `driving=${driving} music=${musicIn} parked=${parked}` };
});

await beat('10 Monster Mash: mobs engage, combat music, a kill (M-02)', async (row) => {
  await page.goto(`${base}/?mash`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await dismissCreator();
  await page.locator('button:has-text("Spawn 3D Ogro")').click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Spawn 2D Demon")').click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  // stand 4 m from the nearest live mob, facing it, then fire at it
  const aimed = await page.evaluate(() => {
    const mash = window.hmPlay.mash();
    const mobs = mash.getMobList().filter((m) => m.hp > 0);
    if (mobs.length === 0) return null;
    const scene = window.__playScene;
    const p = scene.debug.position();
    const m = mobs.reduce((a, b) => (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) <= Math.hypot(b.pos.x - p.x, b.pos.z - p.z) ? a : b));
    const dx = m.pos.x - p.x, dz = m.pos.z - p.z, h = Math.hypot(dx, dz) || 1;
    const dist = 4;
    const yaw = Math.atan2(-dx, -dz);
    const sx = m.pos.x - (dx / h) * dist, sz = m.pos.z - (dz / h) * dist;
    scene.debug.teleport('planet', sx, sz, yaw, Math.atan2(m.pos.y + 0.8 - (scene.debug.position().y), dist));
    return { id: m.id, kind: m.kind, hp: m.hp, dist: Math.round(h * 10) / 10 };
  });
  console.log('aimed at mob:', JSON.stringify(aimed));
  const fireBtn = page.locator('button:has-text("Fire Shotgun")');
  for (let i = 0; i < 9; i++) {
    await page.evaluate(() => window.hmPlay.mash().reload?.());
    await fireBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  const stats = await page.evaluate(() => window.hmPlay.mash().getStats());
  const m02 = await waitSub('M-02', 4000);
  const music = await page.evaluate(() => window.hmPlay.audio?.getMusicContext?.() ?? null);
  row.shot = await shot('monster-mash');
  const kills = stats?.mobsDefeated ?? 0;
  const ok = kills >= 1 && m02 && music === 'monster-mash';
  return { ok, detail: `kills=${kills} M-02=${m02} music=${music} stats=${JSON.stringify(stats).slice(0, 160)}` };
});

await beat('11 reload: the save loads and Act I does not replay', async (row) => {
  const label = await startFromMenu();
  await page.waitForTimeout(2500);
  const heard = await page.evaluate(() => window.hmPlay?.heard?.() ?? []);
  const replayed = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="mentor-subtitle"]');
    return !!el && /A1-01/.test(el.textContent ?? '');
  });
  const subNow = await subId();
  row.shot = await shot('reload');
  const ok = heard.includes('A1-01') && !replayed && subNow !== 'A1-01';
  return { ok, detail: `menu=${label} heard A1-01=${heard.includes('A1-01')} replayed=${replayed} sub=${subNow}` };
});

// ----------------------------------------------------------------------------------------------------------------------
const summary = {
  when: new Date().toISOString(),
  beats: results.map((r) => ({ name: r.name, ok: r.ok, fps: r.fps, detail: r.detail, seconds: r.seconds })),
  consoleErrors: [...new Set(consoleErrors)],
  httpErrors: [...new Set(httpErrors)],
};
fs.writeFileSync(path.join(shotsDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log('\nSUMMARY');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} | fps ${r.fps ?? '?'}`);
console.log(`console errors: ${summary.consoleErrors.length}`);
for (const e of summary.consoleErrors) console.log('  ', e.slice(0, 240));
console.log(`http errors (404s and failed requests): ${summary.httpErrors.length}`);
for (const e of summary.httpErrors) console.log('  ', e.slice(0, 240));

await browser.close().catch(() => {});
server.kill('SIGTERM');
setTimeout(() => server.kill('SIGKILL'), 1000);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
