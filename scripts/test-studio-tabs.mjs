// ============================================================================
// TICKET-08b check: the Studio's Look and Scene tabs, the sockets and plumes gizmo, and the 4-angle review panel.
//   npm run build && node --import tsx scripts/test-studio-tabs.mjs
// It serves apps/web/dist itself on a free port (the built game, the Studio read-only, as the owner opens it) and saves its
// shots to shots-run/studio-tabs/ (gitignored). Pixel checks use sharp, which the repository already has.
// On a slower PC multiply every wait with E2E_SLOW=3.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('FAIL: Chrome not found');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const shots = path.join(root, 'shots-run/studio-tabs');
fs.mkdirSync(shots, { recursive: true });
const port = Number(process.env.STUDIO_TABS_PORT ?? 8195);
const slow = Math.max(1, Number(process.env.E2E_SLOW) || 1);
const T = (ms) => Math.round(ms * slow);

const results = [];
const pageErrors = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  const tail = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
  console.log(`${ok ? 'OK  ' : 'FAIL'}: ${label}${tail}`);
};

/** The channel means of a PNG, as [r, g, b]. */
const meanOf = async (png) => {
  const { channels } = await sharp(png).stats();
  return channels.slice(0, 3).map((c) => c.mean);
};
/** How far two mean colours are apart (the sum of the channel gaps). */
const gap = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
/** The mean colours of the left and right halves of a PNG. */
const halvesOf = async (png) => {
  const { width, height } = await sharp(png).metadata();
  const half = Math.floor(width / 2);
  const left = await sharp(png).extract({ left: 0, top: 0, width: half, height }).png().toBuffer();
  const right = await sharp(png).extract({ left: half, top: 0, width: width - half, height }).png().toBuffer();
  return { left: await meanOf(left), right: await meanOf(right) };
};
/** How many pixels differ between two PNGs of the same size (a channel differing by more than 24 counts). */
const differingPixels = async (a, b) => {
  const load = async (png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const A = await load(a);
  const B = await load(b);
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return -1;
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (Math.abs(A.data[i] - B.data[i]) > 24 || Math.abs(A.data[i + 1] - B.data[i + 1]) > 24 || Math.abs(A.data[i + 2] - B.data[i + 2]) > 24) n++;
  }
  return n;
};

async function waitForHttp(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no server at ${url}`);
}

console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await waitForHttp(`http://localhost:${port}/`, 20000);

const base = `http://localhost:${port}`;
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
let exitCode = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(T(60000));
  page.on('pageerror', (err) => pageErrors.push(err.message.slice(0, 200)));
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  // a rejected promise in the Studio is not an uncaught error, so it is recorded here as well
  await page.addInitScript(() => {
    window.__rejections = [];
    window.addEventListener('unhandledrejection', (e) => window.__rejections.push(String((e.reason && e.reason.message) || e.reason).slice(0, 200)));
  });

  const tab = (name) => page.locator('.sx-tabs button', { hasText: new RegExp(`^${name}$`) });
  /** What the Studio shows when a section fails: the viewport's tags, the placed items, and any rejection or console error. */
  const diag = async () => {
    try {
      const info = await page.evaluate(() => ({
        tags: document.querySelectorAll('.sx-world-tag').length,
        canvases: document.querySelectorAll('.sx-scene-view canvas').length,
        placed: document.querySelectorAll('ul[aria-label="Placed scene items"] li').length,
        readout: document.querySelector('[data-testid="scene-gizmo-readout"]')?.textContent ?? null,
        rejections: window.__rejections ?? [],
      }));
      console.log(`DIAG ${JSON.stringify(info).slice(0, 600)}`);
      console.log(`DIAG console errors ${JSON.stringify(consoleErrors.slice(0, 5))}`);
    } catch (err) {
      console.log(`DIAG unavailable: ${err.message.split('\n')[0]}`);
    }
  };
  const section = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      results.push({ label: `${name} (section crashed)`, ok: false });
      console.log(`FAIL: ${name} crashed: ${err.message.split('\n')[0]}`);
      await diag();
      await page.screenshot({ path: path.join(shots, `crash-${name.replace(/\W+/g, '-').toLowerCase()}.png`) }).catch(() => undefined);
    }
  };

  await page.goto(`${base}/?studio`, { waitUntil: 'domcontentloaded', timeout: T(180000) });
  await page.waitForSelector('.sx', { timeout: T(120000) });

  // ---- Look: the scrubber moves the preview between stages 1 and 6, and the A/B split shows two halves ----
  await section('Look', async () => {
    await tab('Look').click();
    await page.waitForSelector('[data-testid="studio-look-tab"] .sx-look-canvas-host canvas');
    const host = page.locator('.sx-look-canvas-host');
    await page.locator('[aria-label="Stage presets"] button', { hasText: /^S1$/ }).click();
    await page.waitForTimeout(T(2000));
    const s1 = await host.screenshot();
    await page.locator('[aria-label="Stage presets"] button', { hasText: /^S6$/ }).click();
    await page.waitForTimeout(T(2000));
    const s6 = await host.screenshot();
    fs.writeFileSync(path.join(shots, 'look-stage-1.png'), s1);
    fs.writeFileSync(path.join(shots, 'look-stage-6.png'), s6);
    const g = gap(await meanOf(s1), await meanOf(s6));
    check('Look: the scrubber changes the preview from stage 1 to stage 6', g > 8, { meanGap: Math.round(g) });
    const badge = await page.locator('.sx-look-badge').first().innerText();
    check('Look: the stage badge reads stage 6', badge.includes('Stage 6.0'), badge);

    await page.locator('button[aria-label="Toggle A/B stage split"]').click();
    await page.waitForSelector('.sx-look-ab-divider');
    await page.locator('[aria-label="Stage B presets"] button', { hasText: /^S1$/ }).click();
    await page.waitForTimeout(T(2000));
    const ab = await host.screenshot();
    fs.writeFileSync(path.join(shots, 'look-ab-split.png'), ab);
    fs.writeFileSync(path.join(shots, 'look-tab-full.png'), await page.screenshot());
    const halves = await halvesOf(ab);
    const hg = gap(halves.left, halves.right);
    check('Look: the A/B split shows two different halves (stage 6 left, stage 1 right)', hg > 8, { halfGap: Math.round(hg) });
    check('Look: both A and B pills show', (await page.locator('.sx-look-ab-pill').count()) === 2);
  });

  // ---- Scene: the viewport, the placed copies, the gizmo, and save, reload and load ----
  await section('Scene', async () => {
    await tab('Scene').click();
    await page.waitForSelector('[data-testid="studio-scene-tab"]');
    await page.waitForFunction(() => document.querySelectorAll('.sx-scene-view .sx-world-tag:not(.sx-world-figure)').length === 3, null, { timeout: T(120000) });
    const starter = await page.locator('ul[aria-label="Placed scene items"] li').count();
    check('Scene: the starter layout places three copies', starter === 3, { starter });
    check('Scene: the gizmo readout counts the plume vents of the starter', (await page.locator('[data-testid="scene-gizmo-readout"]').innerText()).includes('0 socket markers, 3 plume vents'));

    // a rover body has sockets in the game's fit table, so its markers show
    await page.locator('select[aria-label="Pick asset to place"]').selectOption('hauler-body');
    await page.locator('button', { hasText: /^\+ Place$/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sx-scene-view .sx-world-tag:not(.sx-world-figure)').length === 4, null, { timeout: T(120000) });
    check('Scene: the selected hauler lists its three sockets', (await page.locator('ul[aria-label="Selected item sockets"] li').count()) === 3);
    const readout = await page.locator('[data-testid="scene-gizmo-readout"]').innerText();
    check('Scene: the gizmo marks the three sockets of the hauler', readout.includes('3 socket markers'), readout);
    const overflow = await page.evaluate(() => {
      const side = document.querySelector('.sx-scene-side').getBoundingClientRect();
      return [...document.querySelectorAll('.sx-scene-side input, .sx-scene-side select')].filter((el) => el.getBoundingClientRect().right > side.right + 1).length;
    });
    check('Scene: no field runs past the edge of the panel', overflow === 0, { overflow });
    await page.waitForTimeout(T(1500));
    const on = await page.locator('.sx-scene-view').screenshot();
    fs.writeFileSync(path.join(shots, 'scene-gizmo-on.png'), on);
    fs.writeFileSync(path.join(shots, 'scene-tab-full.png'), await page.screenshot());

    await page.locator('button[aria-label="Toggle sockets and plumes gizmo"]').click();
    await page.waitForTimeout(T(1500));
    const off = await page.locator('.sx-scene-view').screenshot();
    fs.writeFileSync(path.join(shots, 'scene-gizmo-off.png'), off);
    const changed = await differingPixels(on, off);
    check('Scene: turning the gizmo off changes the viewport (the markers and vents leave)', changed > 200, { pixels: changed });
    check('Scene: the readout says the gizmo is off', (await page.locator('[data-testid="scene-gizmo-readout"]').innerText()).startsWith('Off'));
    await page.locator('button[aria-label="Toggle sockets and plumes gizmo"]').click();
    await page.waitForFunction(() => !(document.querySelector('[data-testid="scene-gizmo-readout"]')?.textContent ?? 'Off').startsWith('Off'), null, { timeout: T(30000) });

    // placed copies: a fresh layout, two copies, saved in this browser, the page reloaded, and the layout loaded again
    await page.locator('button', { hasText: /^New$/ }).click();
    check('Scene: New starts with no copies', (await page.locator('ul[aria-label="Placed scene items"] li').count()) === 0);
    await page.locator('select[aria-label="Pick asset to place"]').selectOption('mill');
    await page.locator('button', { hasText: /^\+ Place$/ }).click();
    await page.locator('select[aria-label="Pick asset to place"]').selectOption('press-frame');
    await page.locator('button', { hasText: /^\+ Place$/ }).click();
    await page.locator('input[aria-label="Scene layout name"]').fill('Test Pad');
    await page.locator('.sx-scene-card button.sx-go').click();
    const saved = await page.locator('[role="status"].sx-scene-status').innerText();
    check('Scene: Save keeps the layout in this browser', saved.includes('Saved "Test Pad" in this browser'), saved.slice(0, 80));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: T(180000) });
    await page.waitForSelector('.sx', { timeout: T(120000) });
    await tab('Scene').click();
    await page.waitForSelector('[data-testid="studio-scene-tab"]');
    const options = await page.locator('select[aria-label="Load saved layout"] option').allInnerTexts();
    check('Scene: after a reload the saved layout is still listed', options.some((o) => o.includes('Test Pad (2 items)')), options);
    await page.locator('select[aria-label="Load saved layout"]').selectOption('Test Pad');
    const ids = await page.locator('ul[aria-label="Placed scene items"] li b').allInnerTexts();
    check('Scene: loading the saved layout restores its two copies', ids.length === 2 && ids[0] === 'mill-1' && ids[1] === 'press-2', ids);
    await page.waitForFunction(() => document.querySelectorAll('.sx-scene-view .sx-world-tag:not(.sx-world-figure)').length === 2, null, { timeout: T(120000) });
    fs.writeFileSync(path.join(shots, 'scene-layout-restored.png'), await page.locator('[data-testid="studio-scene-tab"]').locator('xpath=ancestor::aside').screenshot());

    // Copy JSON and Load JSON use the same format; a bad paste is refused with the reason
    await page.locator('button', { hasText: /^Copy JSON$/ }).click();
    await page.waitForFunction(() => /Copied 2 scene items/.test(document.querySelector('[role="status"].sx-scene-status')?.textContent ?? ''), null, { timeout: T(20000) });
    const doc = { name: 'Pasted Pad', items: [{ id: 'water-1', assetId: 'watermaker', t: { offset: [0, 0, -5.5], yaw: 0, scale: 1 } }] };
    await page.locator('input[aria-label="Import SceneDoc JSON"]').fill(JSON.stringify(doc));
    await page.locator('button', { hasText: /^Load JSON$/ }).click();
    const loaded = await page.locator('[role="status"].sx-scene-status').innerText();
    check('Scene: Load JSON reads a pasted layout', loaded.includes('Loaded layout "Pasted Pad"'), loaded);
    check('Scene: the pasted layout places its one copy', (await page.locator('ul[aria-label="Placed scene items"] li').count()) === 1);
    await page.locator('input[aria-label="Import SceneDoc JSON"]').fill('{not json');
    await page.locator('button', { hasText: /^Load JSON$/ }).click();
    const bad = await page.locator('[role="status"].sx-scene-status').innerText();
    check('Scene: a bad paste is refused with the reason', bad.includes('Invalid scene JSON'), bad.slice(0, 60));
  });

  // ---- Assets: the 4-angle review of a machine, and its refresh ----
  await section('4-angle review', async () => {
    await tab('Assets').click();
    await page.locator('button[aria-label="Place mill"]').click();
    const grid = '[aria-label="4-Angle Review"] .sx-four-angle-cell img';
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 4, grid, { timeout: T(180000) });
    const srcs = await page.$$eval(grid, (els) => els.map((e) => e.getAttribute('src') ?? ''));
    check('4-angle: the machine has four views', srcs.length === 4);
    check('4-angle: each view is a rendered PNG', srcs.every((s) => s.startsWith('data:image/png') && s.length > 2000), srcs.map((s) => s.length));
    check('4-angle: the four views differ', new Set(srcs).size === 4);
    fs.writeFileSync(path.join(shots, 'four-angle-panel.png'), await page.locator('[aria-label="4-Angle Review"]').screenshot());
    fs.writeFileSync(path.join(shots, 'assets-details-full.png'), await page.screenshot());

    await page.locator('button[aria-label="Refresh 4-angle views"]').click();
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 4, grid, { timeout: T(180000) });
    check('4-angle: Refresh draws the four views again', (await page.$$eval(grid, (els) => els.length)) === 4);
  });

  check('no page errors in the Studio', pageErrors.length === 0, pageErrors.slice(0, 3));
} catch (err) {
  check('the run completed', false, err instanceof Error ? err.message.split('\n')[0] : String(err));
} finally {
  await browser.close().catch(() => undefined);
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
exitCode = failed.length === 0 ? 0 : 1;
process.exit(exitCode);
