// ============================================================================
// TICKET-08a check: the Planetary Grid screen (the menu's button), the dark Settings and Community modals, and the Studio's Audio tab.
//   npm run build && node --import tsx scripts/test-grid-menus.mjs
// It serves apps/web/dist itself on a free port (the built game, as the owner plays it), seeds two saves through the game's own
// plot encoder (the gate dark, then powered), and saves its screenshots to shots-run/grid-menus/ (gitignored).
// The tsx loader is only for importing the plot codec and the plot and lab packages (TypeScript sources).
// On a slower PC multiply every wait with E2E_SLOW=3.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { newPlot, place } from '@hm/plotsim';
import { newLab } from '@hm/cartlab';
import { encodePlot } from '../apps/web/src/play/plot-code.ts';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('FAIL: Chrome not found');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shots = path.join(root, 'shots-run/grid-menus');
fs.mkdirSync(shots, { recursive: true });
const port = 8198;
const slow = Math.max(1, Number(process.env.E2E_SLOW) || 1);
const T = (ms) => Math.round(ms * slow);

const results = [];
const pageErrors = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  const tail = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
  console.log(`${ok ? 'OK  ' : 'FAIL'}: ${label}${tail}`);
};

// the saves: one plot with a mill 12 m from the gate, the gate dark in one and powered in the other
const env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.8 };
const avatar = { kind: 'scientist', name: 'Francois', visor: '#f59e0b' };
const plot = { ...place(newPlot(), env, 'mill', 12, 0, 0), stage: 1 };
const saveBase = { v: 5, step: 'build', avatar, avatarId: 'scientist', gateOn: false, visited: true, plot, lab: newLab() };
// loadState derives gateOn from the step (power = the gate still dark), so the locked save sits on the power step
const LOCKED = JSON.stringify({ ...saveBase, step: 'power' });
const POWERED = JSON.stringify({ ...saveBase, gateOn: true, step: 'drill' });
const predicted = encodePlot(saveBase, { x: 0, z: 0 });
if (!predicted.ok) throw new Error(`the seed plot does not encode: ${predicted.why}`);

console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
let exitCode = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(T(30000));
  // pointer lock is stubbed (headless has no lock to give); the audio hook counts the buffers the Studio starts
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
    window.__audioStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { window.__audioStarts += 1; return start.apply(this, args); };
  });
  page.on('pageerror', (err) => pageErrors.push(err.message.slice(0, 200)));

  const menu = (label) => page.locator('.sm-menu button', { hasText: label }).first();
  const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`) });
  const section = async (name, fn) => {
    try { await fn(); } catch (err) {
      results.push({ label: `${name} (section crashed)`, ok: false });
      console.log(`FAIL: ${name} crashed: ${err.message.split('\n')[0]}`);
    }
  };
  /** The dark-theme check: no opaque light surface and no dark text on a dark ground inside the modal. */
  const darkReport = (sel) => page.evaluate((s) => {
    const root = document.querySelector(s);
    if (!root) return { missing: true };
    const parse = (css) => {
      const m = css.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((x) => parseFloat(x));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const luma = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    const opaqueBg = (el) => {
      for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
        const c = parse(getComputedStyle(cur).backgroundColor);
        if (c && c.a >= 0.5) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const light = [];
    const dark = [];
    for (const el of root.querySelectorAll('*')) {
      // decorative and content pieces are not surfaces: the status dot, the island maps, and gradient-filled buttons (their accent is the gradient)
      if (el.tagName === 'OPTION' || el.closest('option') || el.tagName === 'CANVAS' || el.classList.contains('dm-indicator')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (cs.backgroundImage !== 'none') continue;
      const tag = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ')[0]}`;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a >= 0.5 && luma(bg) > 0.55) light.push(tag);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (hasText) {
        const fg = parse(cs.color);
        if (fg && luma(fg) < 0.35 && luma(opaqueBg(el)) < 0.35) dark.push(`${tag}: "${el.textContent.trim().slice(0, 28)}"`);
      }
    }
    const win = root.querySelector('.shell-window');
    return { light: light.length, lightSample: light.slice(0, 6), dark: dark.length, darkSample: dark.slice(0, 6), windowPosition: win ? getComputedStyle(win).position : null };
  }, sel);

  // ---- first boot: a clean profile, then the seeded save with the gate dark ----
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('hm-store'); });
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: T(30000) });

  await section('the Planetary Grid screen', async () => {
    await page.evaluate((s) => localStorage.setItem('hm.setmix.play', s), LOCKED);
    await page.reload();
    await page.waitForSelector('.sm-home');
    await menu('Planetary Grid').click();
    await page.waitForSelector('[data-testid="planetary-grid-screen"]');
    check('the Planetary Grid button opens the grid screen (not the play screen)', await page.locator('[data-testid="planetary-grid-screen"]').isVisible() && (await page.evaluate(() => !window.hmPlay)));

    const code = (await page.locator('[data-testid="pg-my-code"] code').innerText()).trim();
    check('the grid shows your plot code', code.length > 20, { length: code.length });
    check("the grid's code is the plot encoder's code for this save", code === predicted.code);
    check('the sync mode starts on DESYNCED', (await page.getAttribute('[data-testid="pg-sync-desynced"]', 'aria-pressed')) === 'true');
    check('the gate spawn is locked while the gate is dark', await page.locator('[data-testid="pg-spawn-gate"]').isDisabled()
      && /LOCKED/.test(await page.locator('[data-testid="pg-spawn-gate"]').innerText()));
    await page.waitForTimeout(T(400));
    await shot('grid-screen');

    await page.click('[data-testid="pg-copy-btn"]');
    check('the copy button confirms the copy', /COPIED/.test(await page.locator('[data-testid="pg-copy-btn"]').innerText()));
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check('the copied text is the plot code', clip === code, { clip: clip.slice(0, 16) });

    await page.fill('[data-testid="pg-visit-input"]', 'not-a-valid-plot-code-!!!');
    const status = (await page.locator('[data-testid="pg-visit-status"]').innerText()).trim();
    check('an invalid code shows its reason', status === 'Invalid or corrupted plot code.', { status });
    check('an invalid code keeps the visit button off', await page.locator('[data-testid="pg-visit-btn"]').isDisabled());
    await page.fill('[data-testid="pg-visit-input"]', '');

    await page.click('[data-testid="pg-sync-synced"]');
    check('the sync toggle flips to SYNCED and is remembered', (await page.getAttribute('[data-testid="pg-sync-synced"]', 'aria-pressed')) === 'true'
      && (await page.evaluate(() => localStorage.getItem('hm.setmix.play.sync'))) === 'synced');
    check('an unclaimed slot says so', /UNCLAIMED/.test(await page.locator('[data-testid="pg-slot-readout"]').innerText()));

    await page.keyboard.press('Escape');
    await page.waitForSelector('.sm-home');
    check('Esc returns to the main menu', await page.locator('.sm-home').isVisible());
    globalThis.__code = code;
  });

  await section('visit by code', async () => {
    await page.evaluate((s) => localStorage.setItem('hm.setmix.play', s), POWERED);
    await page.reload();
    await page.waitForSelector('.sm-home');
    await menu('Planetary Grid').click();
    await page.waitForSelector('[data-testid="planetary-grid-screen"]');
    check('the gate spawn is open once the gate is powered', !(await page.locator('[data-testid="pg-spawn-gate"]').isDisabled()));
    const code = globalThis.__code;
    await page.fill('[data-testid="pg-visit-input"]', code);
    const status = (await page.locator('[data-testid="pg-visit-status"]').innerText()).trim();
    check('a valid code is verified with its owner, stage and machines', /Outpost verified: Francois · Stage 1 · 1 machine/.test(status), { status });
    await page.click('[data-testid="pg-visit-btn"]');
    await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready === true && window.hmPlay.visiting?.() === 'Francois', null, { timeout: T(240000) });
    check('a valid code visits: the play screen dials the outpost (visiting Francois)', true);
    const recent = await page.evaluate(() => localStorage.getItem('hm.setmix.grid.recent'));
    check('the visited code is remembered in the recent list', (recent ?? '').includes(code));
  });

  await section('lab spawn', async () => {
    await page.reload();
    await page.waitForSelector('.sm-home');
    await menu('Planetary Grid').click();
    await page.waitForSelector('[data-testid="pg-spawn-lab"]');
    await page.click('[data-testid="pg-spawn-lab"]');
    await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready === true, null, { timeout: T(240000) });
    await page.waitForFunction(() => window.hmPlay.where === 'lab', null, { timeout: T(30000) });
    const at = await page.evaluate(() => ({ where: window.hmPlay.where, pose: window.hmPlay.pose() }));
    // the lab's spawn beside the cot (LAB_SPAWN in play.tsx): the scene starts here too, so the pose is the proof
    const near = Math.hypot(at.pose.x + 2.5, at.pose.z - 1.0) < 0.3;
    check('the Earth lab spawn lands in the lab, beside the cot', at.where === 'lab' && near, at);
  });

  await section('gate spawn', async () => {
    await page.reload();
    await page.waitForSelector('.sm-home');
    await menu('Planetary Grid').click();
    await page.waitForSelector('[data-testid="pg-spawn-gate"]');
    await page.click('[data-testid="pg-spawn-gate"]');
    await page.waitForFunction(() => window.hmPlay && window.hmPlay.ready === true, null, { timeout: T(240000) });
    await page.waitForFunction(() => window.hmPlay.where === 'planet', null, { timeout: T(60000) });
    const got = await page.evaluate(() => {
      const exit = window.hmPlay.gateExit();
      const pose = window.hmPlay.pose();
      const gate = window.hmPlay.gate();
      return { exit, pose, gate };
    });
    const dx = Math.abs(got.pose.x - got.exit.x);
    const dz = Math.abs(got.pose.z - got.exit.z);
    let dyaw = Math.abs(got.pose.yaw - got.exit.yaw) % (2 * Math.PI);
    if (dyaw > Math.PI) dyaw = 2 * Math.PI - dyaw;
    const fromGate = Math.hypot(got.pose.x - got.gate.x, got.pose.z - got.gate.z);
    check('the moon gate spawn lands at the gate exit', dx < 0.6 && dz < 0.6, { dx: +dx.toFixed(2), dz: +dz.toFixed(2) });
    check('the moon gate spawn faces out, away from the gate', dyaw < 0.05, { dyaw: +dyaw.toFixed(3) });
    check('the moon gate spawn stands about 3 m out from the gate', fromGate > 2.5 && fromGate < 3.5, { fromGate: +fromGate.toFixed(2) });
  });

  await section('Settings in the dark modal', async () => {
    await page.reload();
    await page.waitForSelector('.sm-home');
    await menu('Settings').click();
    await page.waitForSelector('[data-testid="dark-modal"][aria-label="Settings"]');
    check('Settings opens in the dark modal', (await page.locator('[data-testid="dark-modal"]').count()) === 1 && (await page.locator('.settings-body').count()) === 1);
    const rep = await darkReport('[data-testid="dark-modal"]');
    check('Settings has no light surface and no dark text', rep.light === 0 && rep.dark === 0, { light: rep.light, lightSample: rep.lightSample, dark: rep.dark, darkSample: rep.darkSample });
    check('the legacy window sits in the flow, not centred on the page', rep.windowPosition === null || rep.windowPosition === 'static', { windowPosition: rep.windowPosition });
    await page.waitForTimeout(T(300));
    await shot('settings');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="dark-modal"]', { state: 'detached' });
    check('Esc closes Settings', await page.locator('.sm-home').isVisible());
  });

  await section('Community in the dark modal', async () => {
    await menu('Community').click();
    await page.waitForSelector('[data-testid="dark-modal"][aria-label="Community"]');
    check('Community opens in the dark modal with its listings', (await page.locator('.shell-activity').count()) > 0);
    const rep = await darkReport('[data-testid="dark-modal"]');
    check('Community has no light surface and no dark text', rep.light === 0 && rep.dark === 0, { light: rep.light, lightSample: rep.lightSample, dark: rep.dark, darkSample: rep.darkSample });
    await page.waitForTimeout(T(300));
    await shot('community');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="dark-modal"]', { state: 'detached' });
    check('Esc closes Community', await page.locator('.sm-home').isVisible());
  });

  await section('the Studio Audio tab', async () => {
    await menu('The Studio').click();
    await page.waitForSelector('.sx-tabs');
    await page.locator('.sx-tabs button', { hasText: 'Audio' }).click();
    await page.waitForSelector('[data-testid="studio-audio-tab"]');
    const rows = await page.locator('[data-testid^="audio-row-"]').count();
    check('the Audio tab lists the sounds in public/audio/levels.json', rows >= 40, { rows });
    check('the built game shows the Audio tab read-only', /READ-ONLY BUILD/.test(await page.locator('[data-testid="audio-writable-badge"]').innerText()));
    const before = await page.evaluate(() => window.__audioStarts);
    await shot('audio-tab');
    const rowPlay = page.locator('[data-testid="audio-play-sfx-mill"]');
    const rowOk = await rowPlay.click({ timeout: T(15000) }).then(() => true, async (err) => {
      // diagnostics for the row's Play button: its box, computed style, ancestry, and what sits at its centre
      const diag = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="audio-play-sfx-mill"]');
        if (!b) return { missing: true };
        const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
        const s = getComputedStyle(b);
        const chain = [];
        for (let el = b, i = 0; el && i < 6; el = el.parentElement, i += 1) {
          chain.push({ t: el.tagName.toLowerCase(), c: String(el.getAttribute('class') ?? '').slice(0, 40), id: el.getAttribute('data-testid'), box: box(el), pos: getComputedStyle(el).position });
        }
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          html: b.outerHTML.slice(0, 200),
          style: { pos: s.position, disp: s.display, w: s.width, h: s.height, pe: s.pointerEvents, tr: s.transform },
          chain,
          hit: hit ? `${hit.tagName.toLowerCase()}[${hit.getAttribute('data-testid') ?? ''}]` : null,
          rows: document.querySelectorAll('[data-testid^="audio-row-"]').length,
        };
      });
      console.log(`audio diag: ${JSON.stringify(diag)}`);
      console.log(`audio row play click: ${String(err.message).slice(0, 200)}`);
      return false;
    });
    check('the row Play button on sfx-mill is clickable', rowOk);
    if (!rowOk) {
      // the same sound from the inspector: select the row by its name, then press the inspector's Play
      await page.click('[data-testid="audio-row-sfx-mill"] .sx-audio-id');
      await page.click('[data-testid="audio-inspector-play"]');
    }
    await page.waitForSelector('[data-testid="audio-stop-sfx-mill"], [data-testid="audio-inspector-stop"]', { timeout: T(30000) });
    const after = await page.evaluate(() => window.__audioStarts);
    check('Play starts an audio node for sfx-mill', after > before, { before, after, via: rowOk ? 'row' : 'inspector' });
    await page.waitForTimeout(T(400));
    await shot('audio-tab');
    await page.locator('[data-testid="audio-stop-sfx-mill"], [data-testid="audio-inspector-stop"]').first().click().catch(() => undefined);
  });

  check('no page error while the screens ran', pageErrors.length === 0, pageErrors.slice(0, 3));

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed} of ${results.length} checks passed. Shots: shots-run/grid-menus/`);
  if (passed !== results.length) exitCode = 1;
  await context.close();
} catch (err) {
  console.error(`FAIL: ${err.message.split('\n')[0]}`);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  process.exit(exitCode);
}
