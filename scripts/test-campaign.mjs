/**
 * TASK-20: the campaign is one game. A fresh profile, against the production build (apps/web/dist), with NO fixture flags
 * (no ?base, ?kit, ?mash): the only URL switch is ?e2e, the debug switch that exposes window.__dev (grant, setStage, ...).
 *
 * The beats, in order:
 *   1 menu, then the expedition (a new profile starts in the lab),
 *   2-7 Acts I to III as in test-playthrough.mjs (the wake, the power, the window, the gate, the Moon, the first machine),
 *   8 on the planet, B opens the one build menu, its Structures tab holds the foundation, E places it,
 *   9 the inventory (Tab) opens and holds the starter kit,
 *   10 reload: the foundation and the inventory persist, and Act I does not replay.
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
const slotsJson = () => page.evaluate(() => JSON.stringify(window.hmPlay.base.world().player.slots));

await beat('8 on the planet: B opens the one build menu, Structures holds the foundation, E places it', async (row) => {
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
  const before = await foundations();
  await page.keyboard.press('KeyB');
  const menuOpen = await page.locator('section.bm').isVisible().catch(() => false);
  await page.locator('#bm-tab-structures').click();
  const tabs = await page.locator('.bm-tab').allTextContents();
  await shot('build-menu-structures');
  await page.locator('.bm-chip', { hasText: 'Foundation' }).first().click();
  const menuClosed = !(await page.locator('section.bm').isVisible().catch(() => false));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__hm.hideOverlays(true));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  const after = await foundations();
  // the placed foundation without the HUD (the overlays come back after the shot)
  row.shot = await shot('foundation-placed');
  await page.evaluate(() => window.__hm.hideOverlays(false));
  const ok = menuOpen && tabs.length === 4 && menuClosed && after === before + 1;
  return { ok, detail: `menu=${menuOpen} tabs=${tabs.join('/')} closed=${menuClosed} foundations ${before}->${after}` };
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

await beat('10 reload: the foundation and the inventory persist, and Act I does not replay', async (row) => {
  await page.waitForTimeout(2500);
  const beforeFoundations = await foundations();
  const beforeSlots = await slotsJson();
  const beforeStep = await page.evaluate(() => window.hmPlay.state?.()?.step ?? null);
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
  const afterFoundations = await foundations();
  const afterSlots = await slotsJson();
  const afterStep = await page.evaluate(() => window.hmPlay.state?.()?.step ?? null);
  const replayed = await waitSub('A1-01', 2500);
  row.shot = await shot('after-reload');
  const persisted = afterFoundations === beforeFoundations && afterFoundations >= 1 && afterSlots === beforeSlots;
  const noReplay = afterStep === beforeStep && afterStep !== 'create' && !replayed;
  return { ok: persisted && noReplay, detail: `foundations ${beforeFoundations}->${afterFoundations} inventory same=${afterSlots === beforeSlots} step ${beforeStep}->${afterStep} A1-01 replayed=${replayed}` };
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
