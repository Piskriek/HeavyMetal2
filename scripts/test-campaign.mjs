/**
 * TASK-20: the campaign is one game. A fresh profile, against the production build (apps/web/dist), with NO fixture flags
 * (no ?base, ?kit, ?mash): the only URL switch is ?e2e, the debug switch that exposes window.__dev (grant, setStage, ...).
 *
 * The beats, in order:
 *   1 menu, then the expedition (a new profile starts in the lab),
 *   2-7 Acts I to III as in test-playthrough.mjs (the wake, the power, the window, the gate, the Moon, the first machine),
 *   8 on the planet, B opens the one build menu; Structures is locked until the first colour bloom, and says why,
 *   9 the inventory (Tab) opens and holds the starter kit,
 *   10 reload: the inventory and the chain persist, and Act I does not replay.
 * TASK-22, Acts IV to VI (each step is the game's own action; only the plot's stage (__dev.setStage) and 50 units of mining
 * (hmPlay.grindCount) are skipped as grinding):
 *   11 A4-01 starts once the drill runs; G refuses the rifle until it is taken,
 *   12 the journal lists the act, the step and its hint,
 *   13 the armory rack hands over the rifle; G draws it,
 *   14 A4-02: 50 units mined and 10 s of the mill; its line plays,
 *   15 A4-03: the Studio opens from the journal; the line plays on the way back,
 *   16 A4-04: stage 2 ends Act IV; the Structures tab opens; the bridge kit arrives,
 *   17 B-01 the foundation, 18 B-04 a real harvest of raw pixels, 19 B-06 a drafted blueprint, 20 B-05 the bin,
 *   21 B-07 a chassis blueprint, an airlock and life support seal a room,
 *   22 F-01 the hardpoint and the fabricator installed from the machine picker,
 *   23 F-02 the scout printed by the print button (the frame loop runs it), driven for real, the metres topped up,
 *   24 F-03 the weapon bench, the gun forged, fitted and equipped, 25 F-04 and F-05 the stages unlock the hauler and crawler,
 *   26 a death respawns at the gate (the death is a hook until TASK-23b), 27 each chain line once, S-2 skipped for A4-04.
 *
 * Every beat: a shot in docs/shots/campaign/, the FPS over two seconds, and a pass or fail. Console errors and HTTP errors
 * are collected across the whole run. Exit code 1 when any beat fails.
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
const shotsDir = path.join(root, 'docs/shots/campaign');
fs.mkdirSync(shotsDir, { recursive: true });
for (const f of fs.readdirSync(shotsDir)) {
  if (f.endsWith('.png') || f === 'summary.json') fs.unlinkSync(path.join(shotsDir, f));
}

const port = 8094;
const base = `http://localhost:${port}`;
const game = `${base}/?e2e`;
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
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
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
    // the first line says what failed; the "waiting for locator" line says which control it was
    const lines = err.message.split('\n').map((l) => l.trim()).filter(Boolean);
    const waiting = lines.find((l) => /waiting for|locator\(/.test(l));
    row.detail = `error: ${lines[0]}${waiting ? ` [${waiting}]` : ''}`;
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

// ----------------------------------------------------------------------------------------------------------------------
// The beats
// ----------------------------------------------------------------------------------------------------------------------
await beat('1 main menu, Expedition starts a new game in the lab (no fixture flags)', async (row) => {
  await page.goto(`${game}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const expBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  await expBtn.waitFor({ state: 'visible', timeout: 25000 });
  row.shot = await shot('menu');
  await expBtn.click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await dismissCreator();
  await page.waitForTimeout(500);
  const where = await page.evaluate(() => window.hmPlay?.where);
  const hasDev = await page.evaluate(() => typeof window.__dev?.grant === 'function');
  return { ok: where === 'lab' && hasDev, detail: `where=${where} __dev=${hasDev}` };
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

await beat('4 breaker and lever: power on gives A1-04', async (row) => {
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
  await quiet();
  const placed = await page.evaluate(() => {
    window.hmPlay.give(400);
    const scene = window.__playScene;
    const p = scene.debug.position();
    const g = scene.debug.gatePlanet();
    const dx = p.x - g.x, dz = p.z - g.z, h = Math.hypot(dx, dz) || 1;
    return window.hmPlay.placeAt(g.x + (dx / h) * 10, g.z + (dz / h) * 10, 'mill');
  });
  await page.waitForTimeout(800);
  const a3 = await waitSub('A3-03', 4000);
  await page.waitForTimeout(3500);
  const machines = await page.evaluate(() => window.hmPlay.machines());
  row.shot = await shot('first-machine');
  const ok = placed === true && a3 && machines.standing >= 1 && machines.pouring >= 1;
  return { ok, detail: `placed=${placed} A3-03=${a3} standing=${machines.standing} pouring=${machines.pouring}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// The base, in the campaign (TASK-20): no ?base flag, one build menu, one inventory
// ----------------------------------------------------------------------------------------------------------------------
const foundations = () => page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').length);
// the foundation B-01 placed: the bin, the airlock and the hardpoint are placed on it (set in beat 17)
let foundId = null;
// the foundation the life support stands on (set in beat 21): the hardpoint's pad is placed beside it
let roomId = null;
// the hardpoint pad's first foundation (set in beat 22): the weapon bench's foundation is placed beyond it
let padBase = null;
// Stands 3 to 5 m from a base piece, facing a point on it (fx, fz: 0 to 1 across its footprint), and checks that the aim
// (what E places at) lands on that piece.
const lookAtPiece = (id, fx = 0.5, fz = 0.5) => page.evaluate(async ({ id, fx, fz }) => {
  const s = window.__playScene;
  const b = s.debug.pieceBounds(id);
  if (!b) return { ok: false, aim: null, why: 'piece not drawn' };
  // a point just under the top of the piece, on the grid across its footprint
  const t = [b.min[0] + (b.max[0] - b.min[0]) * fx, b.max[1] - 0.05, b.min[2] + (b.max[2] - b.min[2]) * fz];
  const here = s.debug.position();
  let ux = here.x - t[0];
  let uz = here.z - t[2];
  const len = Math.hypot(ux, uz) || 1;
  ux /= len;
  uz /= len;
  let aim = null;
  let normalY = null;
  for (const d of [1.5, 2.5, 3.5]) for (const pitch of [-0.4, -0.6, -0.8]) {
    const px = t[0] + ux * d;
    const pz = t[2] + uz * d;
    // the camera looks along (-sin yaw, -cos yaw)
    window.hmPlay.go('planet', px, pz, Math.atan2(-(t[0] - px), -(t[2] - pz)), pitch);
    await new Promise((r) => setTimeout(r, 150));
    const a = s.aimPoint();
    aim = a?.piece ?? null;
    normalY = a?.normal?.y ?? null;
    // the top of the piece: the aim hits it and its normal points up (a side face would put the piece on the wall)
    if (aim === id && normalY !== null && normalY > 0.7) return { ok: true, aim, normalY: Math.round(normalY * 100) / 100 };
  }
  return { ok: false, aim, why: `the aim never landed on the top of the piece (last piece ${aim}, normal y ${normalY === null ? 'none' : Math.round(normalY * 100) / 100})` };
}, { id, fx, fz });

// Places a piece of a kind on a foundation (baseId): aims at each point of a grid across it until one is free (the piece
// count rises). A spot the game refuses (occupied, no floor) is simply not counted; the next spot is tried.
const placeOnFoundation = async (kindLabel, kind, baseId = foundId) => {
  const count = () => page.evaluate((k) => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === k).length, kind);
  const toasts = [];
  for (const fx of [0.2, 0.5, 0.8]) for (const fz of [0.2, 0.5, 0.8]) {
    const look = await lookAtPiece(baseId, fx, fz);
    if (!look.ok) { toasts.push(`aim: ${look.why}`); continue; }
    const before = await count();
    const toast = await placeFromStructures(kindLabel);
    toasts.push(toast || '(no toast)');
    if ((await count()) > before) return { placed: true, toasts };
  }
  return { placed: false, toasts };
};

// Stands near a ground point, facing it, and checks that the aim lands on open ground there.
const groundNear = (x, z) => page.evaluate(async ({ x, z }) => {
  const s = window.__playScene;
  for (const d of [4, 3, 5]) for (const pitch of [-0.5, -0.7, -0.35]) for (const [ox, oz] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const px = x + ox * d;
    const pz = z + oz * d;
    window.hmPlay.go('planet', px, pz, Math.atan2(-(x - px), -(z - pz)), pitch);
    await new Promise((r) => setTimeout(r, 150));
    const a = s.aimPoint();
    if (a && a.piece === null && a.normal.y > 0.7 && Math.hypot(a.x - x, a.z - z) < 1.5) return { ok: true };
  }
  return { ok: false };
}, { x, z });

// A new Foundation (the Structures tab's own) on open ground beside a base piece: the room the life support and the
// hardpoint go in, since one foundation's top holds only so much. Returns its id.
const freshFoundation = async (nearId, dx = 3) => {
  const at = await page.evaluate(({ id, dx }) => {
    const b = window.__playScene.debug.pieceBounds(id);
    return b ? { x: b.max[0] + dx, z: (b.min[2] + b.max[2]) / 2 } : null;
  }, { id: nearId, dx });
  if (!at) return { ok: false, id: null, why: 'base piece not drawn' };
  const g = await groundNear(at.x, at.z);
  if (!g.ok) return { ok: false, id: null, why: 'no open ground aim beside the base' };
  const before = await foundations();
  const toast = await placeFromStructures('Foundation');
  const after = await foundations();
  const id = after > before ? await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id).pop()) : null;
  return { ok: after > before, id, why: toast || 'no toast' };
};

// The hardpoint's pad: a 2 x 2 block of foundations (the game needs all four cells grounded). Four Foundation placements,
// each aimed at the ground where its cell is, 10 m beyond the first foundation. Returns the id of the block's first foundation.
const buildPad = async () => {
  const geo = await page.evaluate((id) => {
    const b = window.__playScene.debug.pieceBounds(id);
    if (!b) return null;
    return { W: b.max[0] - b.min[0], D: b.max[2] - b.min[2], O: [b.max[0] + 10, (b.min[2] + b.max[2]) / 2] };
  }, foundId);
  if (!geo) return { ok: false, base: null, why: 'base piece not drawn' };
  // each aim lies one metre inside its own cell, on the side of the neighbour it must join (an aim at a cell's centre is too
  // far from that neighbour, and the game then starts a second structure: the hardpoint needs the four in one)
  const targets = [[0, 0], [geo.W - 1, 0], [0, geo.D - 1], [geo.W - 1, geo.D]].map(([dx, dz]) => [geo.O[0] + dx, geo.O[1] + dz]);
  const log = [];
  for (const [x, z] of targets) {
    const g = await groundNear(x, z);
    if (!g.ok) return { ok: false, base: null, why: `no ground aim at ${x.toFixed(1)},${z.toFixed(1)}` };
    const before = await foundations();
    const toast = await placeFromStructures('Foundation');
    const after = await foundations();
    log.push(after > before ? 'placed' : `refused (${toast || 'no toast'})`);
    if (after <= before) return { ok: false, base: null, why: log.join(', ') };
  }
  const base = await page.evaluate((O) => {
    const fs = window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').slice(-4);
    let best = null;
    for (const f of fs) {
      const b = window.__playScene.debug.pieceBounds(f.id);
      if (!b) continue;
      const d = Math.hypot((b.min[0] + b.max[0]) / 2 - O[0], (b.min[2] + b.max[2]) / 2 - O[1]);
      if (best === null || d < best.d) best = { id: f.id, d };
    }
    return best ? best.id : null;
  }, geo.O);
  const cells = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').slice(-4).map((p) => `s${p.s}:${p.i},${p.j},${p.k}`).join(' '));
  return { ok: base !== null, base, why: `${log.join(', ')} [${cells}]` };
};
const slotsJson = () => page.evaluate(() => JSON.stringify(window.hmPlay.base.world().player.slots));

const chainState = () => page.evaluate(() => window.hmPlay.chainState());
const chainCur = () => page.evaluate(() => window.hmPlay.chain().current?.id ?? null);
const toastText = () => page.evaluate(() => document.querySelector('.play-toast b')?.textContent ?? '');
const pauseOn = () => page.evaluate(() => window.hmPlay.setPaused(true));
const pauseOff = () => page.evaluate(() => window.hmPlay.setPaused(false));
const toPlanet = async () => {
  await page.evaluate(() => {
    const g = window.__playScene.debug.gatePlanet();
    window.hmPlay.go('planet', g.x + 3, g.z + 5, Math.PI, -0.6);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 20000 });
};
const openBuildTab = async (tab) => {
  // B toggles the menu: press it only when the menu is shut
  if (!(await page.locator('section.bm').isVisible().catch(() => false))) await page.keyboard.press('KeyB');
  await page.locator(`#bm-tab-${tab}`).click();
};
// Places one piece from the Structures tab (E at the aim). Returns the toast the game showed (a refusal says why).
const placeFromStructures = async (kindLabel) => {
  await openBuildTab('structures');
  await page.locator('.bm-chip', { hasText: kindLabel }).first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__hm.hideOverlays(true));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  const toast = await toastText();
  await page.evaluate(() => window.__hm.hideOverlays(false));
  return toast;
};

await beat('8 on the planet: B opens the one build menu; Structures is locked until the first colour bloom, and says why', async (row) => {
  await quiet();
  await page.evaluate(() => {
    const g = window.__playScene.debug.gatePlanet();
    // look down at the ground (pitch -0.6): a horizon aim cannot place anything
    window.hmPlay.go('planet', g.x + 3, g.z + 5, Math.PI, -0.6);
    window.hmPlay.setPaused?.(false);
    window.hmPlay.setLocked?.(true);
  });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 20000 });
  // 100 ore is 60 kg of the 120 kg carry limit (a foundation costs 20): the shot stays out of the overloaded state
  await page.evaluate(() => window.__dev.grant('ore', 100));
  await page.keyboard.press('KeyB');
  const menuOpen = await page.locator('section.bm').isVisible().catch(() => false);
  const tabs = await page.locator('.bm-tab').allTextContents();
  await page.locator('#bm-tab-structures').click();
  const lock = (await page.locator('.bm-locked').first().textContent().catch(() => '')) ?? '';
  await shot('build-menu-structures-locked');
  await page.locator('.bm-close').click();
  const menuClosed = !(await page.locator('section.bm').isVisible().catch(() => false));
  const ok = menuOpen && tabs.length === 4 && /Needs stage 2/.test(lock) && menuClosed;
  return { ok, detail: `menu=${menuOpen} tabs=${tabs.length} closed=${menuClosed} lock="${lock}"` };
});

await beat('9 the inventory (Tab) opens and holds the starter kit', async (row) => {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  const open = await page.locator('[data-testid="base-inventory-window"]').isVisible().catch(() => false);
  row.shot = await shot('inventory');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const hasKit = await page.evaluate(() => window.hmPlay.base.world().player.slots.some((s) => s && s.item === 'bp:starter'));
  return { ok: open && hasKit, detail: `inventory open=${open} starter-kit=${hasKit}` };
});

await beat('10 reload: the inventory and the chain persist, and Act I does not replay', async (row) => {
  await page.waitForTimeout(2500);
  const beforeSlots = await slotsJson();
  const beforeStep = await page.evaluate(() => window.hmPlay.state?.()?.step ?? null);
  const beforeChain = JSON.stringify(await chainState());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  // a reload opens the main menu: Continue loads the saved profile
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    console.log('menu after reload:', labels.map((l) => l.trim()).join(' | '));
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const afterSlots = await slotsJson();
  const afterStep = await page.evaluate(() => window.hmPlay.state?.()?.step ?? null);
  const afterChain = JSON.stringify(await chainState());
  const replayed = await waitSub('A1-01', 2500);
  row.shot = await shot('after-reload');
  const persisted = afterSlots === beforeSlots && afterChain === beforeChain;
  const noReplay = afterStep === beforeStep && afterStep !== 'create' && !replayed;
  return { ok: persisted && noReplay, detail: `inventory same=${afterSlots === beforeSlots} chain same=${afterChain === beforeChain} step ${beforeStep}->${afterStep} A1-01 replayed=${replayed}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// Acts IV to VI (TASK-22). Every action is the game's own: a placement, a click, a command through the base. The only
// skips are __dev.setStage (the plot's stage is grinding) and hmPlay.grindCount (50 units of mining is grinding).
// ----------------------------------------------------------------------------------------------------------------------
await beat('11 Act IV starts once the drill runs (A4-01); G refuses the rifle until it is taken', async (row) => {
  await quiet();
  await toPlanet();
  await page.evaluate(() => window.__dev.grant('ore', 40));
  let drilled = false;
  for (const [dx, dz] of [[-12, 6], [12, -6], [-14, -4], [8, 12], [-6, 14], [16, 4]]) {
    drilled = await page.evaluate(([dx, dz]) => {
      const g = window.__playScene.debug.gatePlanet();
      return window.hmPlay.placeAt(g.x + dx, g.z + dz, 'drill');
    }, [dx, dz]);
    if (drilled) break;
  }
  await page.waitForTimeout(900);
  const cur = await chainCur();
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(400);
  const toast = await toastText();
  row.shot = await shot('a4-01-start');
  return { ok: drilled && cur === 'A4-01' && toast.includes('armory'), detail: `drill placed=${drilled} current=${cur} G toast="${toast}"` };
});

await beat('12 the journal (Esc menu) lists the acts, the current step and its hint', async (row) => {
  await pauseOn();
  await page.locator('.play-pause button', { hasText: 'Journal' }).click();
  const journal = page.locator('[data-testid="journal"]');
  await journal.waitFor({ state: 'visible', timeout: 5000 });
  const text = (await journal.textContent()) ?? '';
  row.shot = await shot('journal-act4');
  await page.locator('.journal-close').click();
  await pauseOff();
  const ok = text.includes('Act IV') && text.includes('Take the extraction rifle') && text.includes('armory rack');
  return { ok, detail: `journal act IV=${text.includes('Act IV')} step=${text.includes('Take the extraction rifle')} hint=${text.includes('armory rack')}` };
});

await beat('13 A4-01: the armory rack hands over the rifle (the button is the action); G draws it on the planet', async (row) => {
  await page.evaluate(() => window.hmPlay.go('lab', 0, 3, 0, 0));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.hmPlay.openLabPanel('rack'));
  const btn = page.locator('.play-pickup');
  const visible = await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  row.shot = await shot('rifle-pickup');
  if (visible) await btn.click();
  await page.waitForTimeout(500);
  const cur = await chainCur();
  const sub = await waitSub('A4-01', 8000);
  await page.evaluate(() => window.hmPlay.openLabPanel(null));
  await toPlanet();
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(400);
  const toast = await toastText();
  const drawn = toast.includes('Extraction beam');
  return { ok: visible && cur === 'A4-02' && sub && drawn, detail: `button=${visible} current=${cur} A4-01 line=${sub} G draws=${drawn} toast="${toast}"` };
});

await beat('14 A4-02: the rifle mines dirt for real (a stroke on a boulder), grinding tops up to 50, and the texture mill runs 10 s: its line plays', async (row) => {
  await quiet();
  await toPlanet();
  // aim the drawn rifle at the nearest boulder: stand 4 to 8 m off it, face it, and look down a little until the aim lands
  const aimed = await page.evaluate(async () => {
    const scene = window.__playScene.debug;
    const g = scene.gatePlanet();
    const b = scene.boulders().filter((x) => x.ore > 0).sort((p, q) => Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(q.x - g.x, q.z - g.z))[0];
    if (!b) return { ok: false, why: 'no boulder' };
    // the player stands on the gate side of the boulder, at d metres (the aim reaches 5 m), facing it
    const L = Math.hypot(b.x - g.x, b.z - g.z) || 1;
    const ux = (b.x - g.x) / L, uz = (b.z - g.z) / L;
    for (const d of [3, 4, 4.5]) for (const pitch of [-0.2, -0.35, -0.5, -0.1]) {
      const px = b.x - ux * d, pz = b.z - uz * d;
      // the camera looks along (-sin yaw, -cos yaw); try that convention, then its opposite
      for (const yaw of [Math.atan2(-ux, -uz), Math.atan2(ux, uz)]) {
        window.hmPlay.go('planet', px, pz, yaw, pitch);
        // the aim is read on the frame loop: let two frames pass before reading it
        await new Promise((r) => setTimeout(r, 120));
        if (scene.aimedBoulder() === b.id) return { ok: true, id: b.id };
      }
    }
    return { ok: false, why: 'the aim never landed on the boulder' };
  });
  let minedReal = 0;
  if (aimed.ok) {
    await page.waitForTimeout(400);
    // the stroke needs the pointer lock, which this test stubs: the canvas counts as locked for the stroke only
    await page.evaluate(() => {
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('canvas') });
    });
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(4000);
    await page.mouse.up();
    await page.evaluate(() => { delete document.pointerLockElement; });
    minedReal = (await chainState()).counts['mined:beam'] ?? 0;
  }
  const realOk = aimed.ok && minedReal > 0;
  // the rest of the 50 is grinding: the stroke above was the real mining, the top-up is the skip
  await page.evaluate((n) => window.hmPlay.grindCount('mined:beam', Math.max(0, 50 - n)), minedReal);
  const t0 = Date.now();
  let milled = 0;
  while (Date.now() - t0 < 30000) {
    milled = (await chainState()).counts.milled ?? 0;
    if (milled >= 10) break;
    await page.waitForTimeout(500);
  }
  const cur = await chainCur();
  const sub = await waitSub('A4-02', 9000);
  row.shot = await shot('a4-02-milled');
  return { ok: realOk && milled >= 10 && cur === 'A4-03' && sub, detail: `real stroke: aimed=${aimed.ok ? aimed.id : aimed.why} mined=${minedReal}; milled=${milled} current=${cur} A4-02 line=${sub}` };
});

await beat('15 A4-03: the Studio opens from the journal; the Act IV line plays on the way back', async (row) => {
  await pauseOn();
  await page.locator('.play-pause button', { hasText: 'Journal' }).click();
  const btn = page.locator('.journal-studio');
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  row.shot = await shot('journal-a4-03');
  await btn.click();
  await page.waitForTimeout(2500);
  const leftPlay = (await page.locator('.play').count()) === 0;
  await shot('studio-opened');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 25000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const studioCount = (await chainState()).counts['studio:open'] ?? 0;
  const cur = await chainCur();
  const sub = await waitSub('A4-03', 9000);
  return { ok: leftPlay && studioCount >= 1 && cur === 'A4-04' && sub, detail: `left the game=${leftPlay} studio:open=${studioCount} current=${cur} A4-03 line=${sub}` };
});

await beat('16 A4-04: stage 2 (the bloom) ends Act IV; the Structures tab opens and the bridge kit arrives', async (row) => {
  await quiet();
  await page.evaluate(() => window.__dev.setStage(2));
  // ruling 4: the stage-2 event plays A4-04 (the journal step), and S-2 is skipped
  const a404 = await waitSub('A4-04', 4000);
  await page.waitForTimeout(800);
  const s2Heard = await page.evaluate(() => window.hmPlay.heard().includes('S-2'));
  const cur = await chainCur();
  const kit = await page.evaluate(() => {
    const b = window.hmPlay.base.world().boxes.find((x) => x.id === -2);
    const c = {};
    for (const st of b?.slots ?? []) if (st) c[st.item] = (c[st.item] ?? 0) + st.n;
    return c;
  });
  await toPlanet();
  await openBuildTab('structures');
  const locks = await page.locator('.bm-locked').count();
  row.shot = await shot('structures-open');
  await page.locator('.bm-close').click();
  const ok = cur === 'B-01' && (kit['prim-cube'] ?? 0) >= 4 && locks === 0 && a404 && !s2Heard;
  return { ok, detail: `A4-04 line=${a404} S-2 heard=${s2Heard} current=${cur} bridge cube=${kit['prim-cube'] ?? 0} beam=${kit['prim-beam'] ?? 0} maps=${kit['map-basalt'] ?? 0} tab locks=${locks}` };
});

await beat('17 B-01: a foundation placed from the Structures tab with E', async (row) => {
  await quiet();
  const before = await foundations();
  await placeFromStructures('Foundation');
  const after = await foundations();
  foundId = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'foundation').map((p) => p.id).pop() ?? null);
  row.shot = await shot('foundation-placed');
  const cur = await chainCur();
  const sub = await waitSub('B-01', 6000);
  return { ok: after === before + 1 && cur === 'B-04' && sub, detail: `foundations ${before}->${after} current=${cur} B-01 line=${sub}` };
});

await beat('18 B-04: raw pixels harvested with the beam from a field node (a real harvest through the base)', async (row) => {
  // a chroma or dither node yields raw pixels (the beam's own rates: about one unit a second on a full node)
  // the chroma or dither node nearest the gate (the planet is walkable only near the gate): stand 3 m from it, on the gate side
  const node = await page.evaluate(() => {
    const w = window.hmPlay.base.world();
    const g = window.__playScene.debug.gatePlanet();
    const cands = w.field.nodes.filter((x) => x.kind === 'chroma' || x.kind === 'dither')
      .sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z));
    const n = cands[0];
    if (!n) return null;
    const L = Math.hypot(g.x - n.x, g.z - n.z) || 1;
    const ux = (g.x - n.x) / L;
    const uz = (g.z - n.z) / L;
    window.hmPlay.go('planet', n.x + ux * 3, n.z + uz * 3, Math.atan2(-(n.x - (n.x + ux * 3)), -(n.z - (n.z + uz * 3))), -0.5);
    return { id: n.id, kind: n.kind, x: n.x, z: n.z, reserve: Math.round(n.reserve), gateDist: Math.round(Math.hypot(n.x - g.x, n.z - g.z)) };
  });
  if (!node) return { ok: false, detail: 'no chroma or dither node in the field' };
  await page.waitForTimeout(500);
  const dbg = await page.evaluate((n) => {
    const w = window.hmPlay.base.world();
    const p = window.__playScene.debug.position();
    return { beam: w.equipment.beam?.item ?? null, player: [Math.round(p.x), Math.round(p.z)], node: [Math.round(n.x), Math.round(n.z)] };
  }, node);
  const seen = new Set();
  let items = 0;
  let lost = 0;
  for (let i = 0; i < 400 && items === 0; i++) {
    const r = await page.evaluate((n) => {
      const p = window.__playScene.debug.position();
      const res = window.hmPlay.base.apply({ t: 'tick', at: { x: p.x, z: p.z }, dt: 0.1, beam: { node: n.id, power: 1 }, power: {} });
      const evs = res?.events ?? [];
      const got = evs.filter((e) => e.type === 'harvested');
      return { types: evs.map((e) => (e.type === 'refused' ? `refused:${e.why}` : e.type)), got: got.map((e) => e.items.reduce((s, x) => s + x.n, 0)), lost: got.reduce((s, e) => s + e.lost.reduce((a, x) => a + x.n, 0), 0) };
    }, node);
    for (const t of r.types) seen.add(t);
    items += r.got.reduce((s, k) => s + k, 0);
    lost += r.lost;
  }
  const counts = (await chainState()).counts;
  const cur = await chainCur();
  row.shot = await shot('b04-harvest');
  const ok = (counts['harvest:pxd'] ?? 0) >= 1 && cur === 'B-06';
  return { ok, detail: `node ${node.kind} at (${dbg.node}) reserve ${node.reserve}; beam=${dbg.beam} player (${dbg.player}): harvested ${items} (lost ${lost}) events=${[...seen].join('/') || 'none'} harvest:pxd=${counts['harvest:pxd'] ?? 0} current=${cur}` };
});

// The drafting table is a Bench piece (the starter shelter's). A draft needs the player within 5 m of one.
// draftSpot is where the player stood to draft last (the table is beside it).
let draftSpot = null;
const draftAtBench = (item) => page.evaluate(async ({ item, spot }) => {
  const api = window.hmPlay.base;
  const offsets = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2.5, 2.5], [-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5]];
  for (const [dx, dz] of offsets) {
    const at = spot ? { x: spot.x + dx, z: spot.z + dz } : null;
    if (at) window.hmPlay.go('planet', at.x, at.z, 0, -0.5);
    await new Promise((r) => setTimeout(r, 60));
    const p = window.__playScene.debug.position();
    const res = api.apply({ t: 'draft', at: { x: p.x, z: p.z }, primitive: item.primitive, map: item.map });
    if (res?.events?.some((e) => e.type === 'drafted')) return { ok: true, spot: { x: p.x, z: p.z }, events: res.events.map((e) => e.type) };
    if (!res?.events?.some((e) => e.type === 'refused' && e.why === 'no-bench')) return { ok: false, why: res?.events?.map((e) => e.why ?? e.type).join(',') };
  }
  return { ok: false, why: 'no-bench' };
}, { item, spot: draftSpot });

await beat('19 B-06: the drafting table (the starter shelter\'s bench) is walked to; a cube blueprint drafted at it (a real draft command)', async (row) => {
  await quiet();
  await toPlanet();
  // the starter shelter's Bench is the drafting table (benchNear); the player stands by it, facing it, to draft
  const bench = await page.evaluate(() => window.hmPlay.base.world().base.pieces.find((p) => p.kind === 'bench')?.id ?? null);
  if (bench === null) return { ok: false, detail: 'no bench stands in the base' };
  // stand 2.5 m from its centre (the draft needs it within 5 m), facing it
  const stood = await page.evaluate(async (id) => {
    const s = window.__playScene;
    const b = s.debug.pieceBounds(id);
    if (!b) return { ok: false, why: 'bench not drawn' };
    const c = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
    const px = c[0] + 2.5;
    const pz = c[2];
    window.hmPlay.go('planet', px, pz, Math.atan2(-(c[0] - px), -(c[2] - pz)), -0.5);
    await new Promise((r) => setTimeout(r, 300));
    const p = s.debug.position();
    return { ok: true, x: p.x, z: p.z, dist: Math.round(Math.hypot(p.x - c[0], p.z - c[2]) * 10) / 10 };
  }, bench);
  if (!stood.ok) return { ok: false, detail: `could not stand at the bench: ${stood.why}` };
  draftSpot = { x: stood.x, z: stood.z };
  const dr = await draftAtBench({ primitive: 'cube', map: 'basalt' });
  const drafted = dr.ok && (await page.evaluate(() => window.hmPlay.base.world().player.slots.some((s) => s?.item === 'bp:cube:basalt')));
  if (dr.ok) draftSpot = dr.spot;
  const cur = await chainCur();
  row.shot = await shot('b06-drafted');
  return { ok: drafted && cur === 'B-05', detail: `bench ${bench} at ${stood.dist} m draft=${dr.ok ? 'drafted' : dr.why} blueprint in pack=${drafted} current=${cur}` };
});

await beat('20 B-05: a linked bin on the foundation (its contents join the bridge storage)', async (row) => {
  const before = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'bin').length);
  const r = await placeOnFoundation('Bin', 'bin');
  const after = await page.evaluate(() => window.hmPlay.base.world().base.pieces.filter((p) => p.kind === 'bin').length);
  const cur = await chainCur();
  row.shot = await shot('b05-bin');
  return { ok: r.placed && after === before + 1 && cur === 'B-07', detail: `bins ${before}->${after} current=${cur} tries: ${r.toasts.join(' | ')}` };
});

await beat('21 B-07: a chassis blueprint is drafted at the bench; an airlock and life support seal a room (placed from the Structures tab)', async (row) => {
  await quiet();
  await toPlanet();
  if (draftSpot) await page.evaluate((s) => window.hmPlay.go('planet', s.x, s.z, 0, -0.5), draftSpot);
  const dr = await draftAtBench({ primitive: 'chassis', map: 'basalt' });
  if (dr.ok) draftSpot = dr.spot;
  const airlock = await placeOnFoundation('Airlock', 'airlock');
  // the life support needs its own floor: a second foundation beside the first
  const room = await freshFoundation(foundId);
  roomId = room.id;
  const life = room.ok ? await placeOnFoundation('Life support', 'lifeSupport', room.id) : { placed: false, toasts: [`room: ${room.why}`] };
  const cur = await chainCur();
  row.shot = await shot('b07-sealed');
  return { ok: dr.ok && airlock.placed && life.placed && cur === 'F-01', detail: `draft=${dr.ok ? 'drafted' : dr.why} airlock=${airlock.placed} (${airlock.toasts.join(' | ')}) life support=${life.placed} (${life.toasts.join(' | ')}) current=${cur}` };
});

const grantAll = (pairs) => page.evaluate((list) => { for (const [item, n] of list) window.__dev.grant(item, n); }, pairs);
const basePos = () => page.evaluate(() => window.__playScene.debug.position());

await beat('22 F-01: a hardpoint from the Structures tab; the fabricator installed on it from the machine picker', async (row) => {
  await quiet();
  await toPlanet();
  // the fabricator's bill and the hardpoint's are grinding: granted (the install and the pay are the game's own)
  await grantAll([['ore', 240], ['prim-beam', 10], ['prim-column', 4], ['prim-chassis', 6], ['map-basalt', 3]]);
  // the hardpoint stands on a 2 x 2 pad of foundations (buildPad); its own grid then aims across the pad's first foundation
  const pad = await buildPad();
  padBase = pad.base;
  const hpPlace = pad.ok ? await placeOnFoundation('Hardpoint', 'hardpoint', pad.base) : { placed: false, toasts: [`pad: ${pad.why}`] };
  // diagnostic only when the hardpoint is refused: the structure rules' own reason for the pad's first cell
  const probe = !hpPlace.placed && pad.ok ? await page.evaluate((base) => {
    const api = window.hmPlay.base;
    const f = api.world().base.pieces.find((p) => p.id === base);
    const p = window.__playScene.debug.position();
    const res = api.apply({ t: 'place', at: { x: p.x, z: p.z }, blueprint: 'bp:chassis:basalt', piece: { s: f.s, kind: 'hardpoint', i: f.i, j: f.j, k: f.k, r: 0 } });
    return (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused:${e.why}` : e.type)).join(',') || 'no event';
  }, pad.base) : '';
  const hp = await page.evaluate(() => window.hmPlay.base.world().base.pieces.find((p) => p.kind === 'hardpoint')?.id ?? null);
  // the pad (80 ore) and the hardpoint (60 ore) took the first grant: the install's own bill is topped up (grinding)
  await grantAll([['ore', 300], ['prim-beam', 8], ['prim-column', 6], ['prim-chassis', 6]]);
  if (hp !== null) await page.evaluate((id) => window.hmPlay.base.openMachinePicker(id), hp);
  const btn = page.locator('[data-testid="install-btn-fabricator"]');
  const visible = await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  if (visible) await btn.click();
  await page.waitForTimeout(700);
  const installed = await page.evaluate(() => window.hmPlay.base.world().machines.some((m) => m.kind === 'fabricator'));
  row.shot = await shot('f01-fabricator');
  await page.keyboard.press('Escape').catch(() => {});
  const cur = await chainCur();
  return { ok: hpPlace.placed && hp !== null && visible && installed && cur === 'F-02', detail: `pad: ${pad.why} | probe: ${probe} | hardpoint=${hp} (${hpPlace.toasts.join(' | ')}) button=${visible} fabricator installed=${installed} current=${cur}` };
});

await beat('23 F-02: the scout printed at the fabricator (the print button, then the frame loop runs it), driven for real, the metres topped up to 200', async (row) => {
  await quiet();
  await toPlanet();
  const fab = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.id ?? null);
  // the print is the fabricator's own button; the modal is opened from the machine (the test's hook, as a click would)
  await page.evaluate((id) => window.hmPlay.base.openFabricator(id), fab);
  await page.locator('[data-testid="rover-card-scout"]').click({ timeout: 6000 }).catch(() => {});
  const printBtn = page.locator('[data-testid="print-btn-scout"]');
  const canPrint = await printBtn.isEnabled({ timeout: 3000 }).catch(() => false);
  if (canPrint) await printBtn.click();
  await page.waitForTimeout(400);
  const queued = await page.evaluate(() => window.hmPlay.base.world().machines.find((m) => m.kind === 'fabricator')?.jobs.length ?? 0);
  row.shot = await shot('f02-printing');
  await page.locator('[data-testid="fabricator-close-btn"]').click({ timeout: 4000 }).catch(() => {});
  // closing the modal leaves the game paused (the pointer lock is gone): the E key needs the game running, as toPlanet sets it
  await page.evaluate(() => { window.hmPlay.setPaused?.(false); window.hmPlay.setLocked?.(true); });
  await page.waitForTimeout(300);
  // the print runs in the game's own loop (120 s of plot power): wait for the scout to land at the fabricator
  const printEnd = Date.now() + 150000;
  let scouts = 0;
  while (Date.now() < printEnd) {
    scouts = await page.evaluate(() => window.hmPlay.base.world().vehicles.filter((v) => v.kind === 'scout').length);
    if (scouts >= 1) break;
    await page.waitForTimeout(1000);
  }
  // get in (E, within 3.5 m), face forward and drive for real: 10 s of W
  const v = await page.evaluate(() => window.hmPlay.base.world().vehicles.find((x) => x.kind === 'scout') ?? null);
  let entered = false;
  let driven = 0;
  let vDiag = null;
  let viaHook = false;
  if (v) {
    // stand within 3 m of the scout (the walk can be pushed off the hull): try the sides until the position holds, facing it
    for (const [ox, oz] of [[-1.2, 0], [1.2, 0], [0, 1.2], [0, -1.2], [-2, 0], [2, 0], [0, 2], [0, -2]]) {
      await page.evaluate(({ v, ox, oz }) => window.hmPlay.go('planet', v.x + ox, v.z + oz, Math.atan2(ox, oz), 0), { v, ox, oz });
      await page.waitForTimeout(400);
      vDiag = await page.evaluate(() => ({ where: window.hmPlay.where, p: window.__playScene.debug.position() }));
      if (Math.hypot(vDiag.p.x - v.x, vDiag.p.z - v.z) <= 3) break;
    }
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    entered = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
    // E only reaches a vehicle within 3.5 m; where the walk is pushed out beyond that (the pad beside the scout), the scene's own
    // enterVehicle (what E calls once in reach) gets the player in, and the rest of the beat drives for real
    if (!entered) {
      await page.evaluate((id) => window.hmPlay.base.enterVehicle(id), v.id);
      await page.waitForTimeout(300);
      entered = (await page.evaluate(() => window.hmPlay.base.driving())) !== null;
      viaHook = entered;
    }
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(10000);
    await page.keyboard.up('KeyW');
    driven = (await chainState()).counts['driven:m'] ?? 0;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
  }
  // the rest of the 200 m is grinding (the drive's metres are the same count; the real drive above is the action)
  await page.evaluate((n) => window.hmPlay.grindCount('driven:m', Math.max(0, 200 - n)), driven);
  const cur = await chainCur();
  row.shot = await shot('f02-scout');
  const realDrive = entered && driven >= 20;
  return { ok: scouts >= 1 && realDrive && cur === 'F-03', detail: `queued=${queued} scouts=${scouts} vehicle at ${v ? `${Math.round(v.x)},${Math.round(v.z)}` : 'none'} player ${vDiag ? `${Math.round(vDiag.p.x)},${Math.round(vDiag.p.z)} where=${vDiag.where}` : '-'} entered=${entered}${viaHook ? ' (via enterVehicle: E out of reach)' : ''} real drive=${driven}m current=${cur}` };
});

await beat('24 F-03: a weapon bench; the frame and parts forged, a barrel swapped, the gun equipped to the sidearm', async (row) => {
  await quiet();
  await toPlanet();
  await grantAll([['ore', 120], ['prim-chassis', 2], ['prim-beam', 2], ['prim-cube', 2], ['prim-column', 2]]);
  // the weapon bench is a fixture: it stands on a foundation of its own, 8 m beyond the pad
  const wbFound = await freshFoundation(padBase, 8);
  const wb = wbFound.ok ? await placeOnFoundation('Weapon bench', 'weaponBench', wbFound.id) : { placed: false, toasts: [`foundation: ${wbFound.why}`] };
  const at = await basePos();
  // the pack is over its 120 kg after the grants: the quick stack (the game's own command) puts the pack into the bridge storage
  const stacked = await page.evaluate((p) => { const res = window.hmPlay.base.apply({ t: 'quickStack', at: p }); return (res?.events ?? []).map((e) => e.type).join('+') || 'none'; }, at);
  const idxOf = (item) => page.evaluate((it) => window.hmPlay.base.world().player.slots.findIndex((s) => s && s.item === it), item);
  // each command is the game's own; its events say what happened (a refusal names its reason)
  const forged = await page.evaluate((p) => {
    const api = window.hmPlay.base;
    const evs = (res) => (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused-${e.why}` : e.type)).join('+') || 'none';
    const pos = window.__playScene.debug.position();
    return ['wpn-frame', 'core-semi', 'barrel-short', 'barrel-scatter'].map((item) => `${item}:${evs(api.apply({ t: 'forge', at: p, item }))}`)
      .concat([`(at ${Math.round(pos.x)},${Math.round(pos.z)})`]);
  }, at);
  const frame = await idxOf('wpn-frame');
  const fitted = await page.evaluate(({ frame, p }) => {
    const api = window.hmPlay.base;
    const evs = (res) => (res?.events ?? []).map((e) => (e.type === 'refused' ? `refused-${e.why}` : e.type)).join('+') || 'none';
    return [
      `move:${evs(api.apply({ t: 'move', at: p, from: { at: 'inventory', index: frame }, to: { at: 'equipment', slot: 'sidearm' }, n: 1 }))}`,
      `core:${evs(api.apply({ t: 'fit', slot: 'core', item: 'core-semi' }))}`,
      `barrel:${evs(api.apply({ t: 'fit', slot: 'barrel', item: 'barrel-short' }))}`,
      `barrel2:${evs(api.apply({ t: 'fit', slot: 'barrel', item: 'barrel-scatter' }))}`,
    ];
  }, { frame, p: at });
  const equipped = await page.evaluate(() => !!window.hmPlay.base.world().equipment.sidearm);
  const monsters = await page.evaluate(() => window.hmPlay.chainState().monstersUnlocked);
  row.shot = await shot('f03-gun');
  const cur = await chainCur();
  return { ok: wb.placed && equipped && cur === 'F-04' && monsters === true, detail: `weapon bench=${wb.placed} (${wb.toasts.join(' | ')}) quick stack ${stacked} forge ${forged.join(' ')} fit ${fitted.join(' ')} sidearm=${equipped} current=${cur} monsters unlocked=${monsters}` };
});

await beat('25 F-04 and F-05: stages 2 to 6 (the plot stage is grinding, skipped) unlock the hauler and the crawler', async (row) => {
  const seen = [];
  for (const st of [3, 4, 5, 6]) {
    await page.evaluate((s) => window.__dev.setStage(s), st);
    await page.waitForTimeout(400);
    seen.push(`${st}:${await chainCur()}`);
  }
  row.shot = await shot('stage6-chain-done');
  const cur = await chainCur();
  return { ok: cur === null, detail: `stages ${seen.join(' ')} chain current=${cur}` };
});

await beat('26 a death respawns at the gate; the inventory and the chain are kept (the death source is TASK-23b)', async (row) => {
  await toPlanet();
  const slotsBefore = await slotsJson();
  // the chain is kept when its progress and its monsters flag are the same and no counter went down (the counters keep
  // growing on their own: the mill runs, the print and the drive move on)
  const chainBefore = await chainState();
  await page.evaluate(() => window.hmPlay.die());
  await page.waitForTimeout(800);
  const deaths = (await chainState()).counts.deaths ?? 0;
  const at = await basePos();
  const gate = await page.evaluate(() => window.__playScene.debug.gatePlanet());
  const nearGate = Math.hypot(at.x - gate.x, at.z - gate.z) < 10;
  const kept = (await slotsJson()) === slotsBefore;
  const chainNow = await chainState();
  const chainKept = JSON.stringify(chainNow.progress) === JSON.stringify(chainBefore.progress)
    && chainNow.monstersUnlocked === chainBefore.monstersUnlocked
    && Object.entries(chainBefore.counts).every(([k, v]) => (chainNow.counts[k] ?? 0) >= v);
  row.shot = await shot('respawn-at-gate');
  return { ok: deaths === 1 && nearGate && kept && chainKept, detail: `deaths=${deaths} near gate=${nearGate} inventory kept=${kept} chain kept=${chainKept}` };
});

await beat('27 each chain narration line played once; the radio log holds no repeats', async (row) => {
  // stage 2 plays A4-04 (ruling 4), so S-2 is not in the list: it must NOT be heard (checked below)
  const want = ['A4-01', 'A4-02', 'A4-03', 'A4-04', 'B-01', 'B-04', 'B-06', 'B-05', 'B-07', 'F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'S-3', 'S-4', 'S-5', 'S-6'];
  let heard = [];
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    heard = await page.evaluate(() => window.hmPlay.heard());
    if (want.every((id) => heard.includes(id))) break;
    await page.waitForTimeout(1000);
  }
  const missing = want.filter((id) => !heard.includes(id));
  const repeats = heard.length - new Set(heard).size;
  const s2Heard = heard.includes('S-2');
  row.shot = await shot('radio-log');
  return { ok: missing.length === 0 && repeats === 0 && !s2Heard, detail: `missing=${missing.join(',') || 'none'} repeats=${repeats} S-2 heard=${s2Heard}` };
});

// ----------------------------------------------------------------------------------------------------------------------
// The report
// ----------------------------------------------------------------------------------------------------------------------
const zeroErrors = consoleErrors.length === 0;
console.log(`console errors: ${consoleErrors.length}${zeroErrors ? '' : ' ' + JSON.stringify(consoleErrors.slice(0, 5))}`);
console.log(`http errors: ${httpErrors.length}${httpErrors.length ? ' ' + JSON.stringify(httpErrors.slice(0, 5)) : ''}`);
const passed = results.filter((r) => r.ok).length;
fs.writeFileSync(path.join(shotsDir, 'summary.json'), JSON.stringify({ results, consoleErrors, httpErrors }, null, 2));
console.log(`${passed} of ${results.length} beats PASS`);

server.kill();
await browser.close();
process.exit(passed === results.length && zeroErrors ? 0 : 1);
