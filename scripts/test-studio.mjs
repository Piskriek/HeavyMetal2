import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The FIDELITY Studio, end to end (TASK-17):
 * - starts the dev server (the write-back exists only there) on STUDIO_TEST_PORT (default 5199);
 * - opens /?studio, places two assets, edits two fields, undoes and redoes, then Accept writes the file;
 * - reads the file back from disk and checks the dev endpoint refuses bad requests;
 * - opens the Moon (prototype) workspace;
 * - serves apps/web/dist and checks the production build opens the Studio read-only;
 * - restores asset-tweaks.json to the bytes it had before the run (teardown, also on failure).
 * Shots go to docs/shots/studio/ (gitignored).
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const tweaksFile = path.join(root, 'apps/web/src/studio-data/asset-tweaks.json');
const shotsDir = path.join(root, 'docs/shots/studio');
fs.mkdirSync(shotsDir, { recursive: true });

const port = Number(process.env.STUDIO_TEST_PORT ?? 5199);
const prodPort = Number(process.env.STUDIO_TEST_PROD_PORT ?? 8197);
const base = `http://localhost:${port}`;
const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.log('FAIL Chrome not found');
  process.exit(1);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

const original = fs.readFileSync(tweaksFile, 'utf8');
let dev = null;
let prod = null;
let browser = null;

function waitForHttp(url, ms) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http.get(url, (res) => { res.resume(); resolve(); }).on('error', () => {
        if (Date.now() > until) reject(new Error(`no server at ${url}`));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

/** A raw request to the dev server, so the Host and content type can be chosen (a browser sets its own). Retried once or twice: the dev server can drop a socket while it is still starting. */
async function raw(opts, tries = 3) {
  try {
    return await rawOnce(opts);
  } catch (e) {
    if (tries <= 1) throw e;
    await sleep(1000);
    return raw(opts, tries - 1);
  }
}

function rawOnce({ method, urlPath, host = `localhost:${port}`, contentType, body }) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host };
    if (contentType) headers['Content-Type'] = contentType;
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ host: 'localhost', port, method, path: urlPath, headers }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function teardown() {
  try { fs.writeFileSync(tweaksFile, original, 'utf8'); } catch (e) { console.log('teardown: could not restore the file', e); }
  if (browser) await browser.close().catch(() => {});
  if (dev) dev.kill();
  if (prod) prod.kill();
}

try {
  // the unit tests for the endpoint and the tweak maths (the npm test glob is shared, so they run from here too)
  const unit = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'apps/web/studio-server/write-back.test.ts', 'apps/web/src/assets/gen-tweak.test.ts'], { cwd: root, encoding: 'utf8' });
  check('the write-back and tweak unit tests pass', unit.status === 0, `exit ${unit.status}`);

  dev = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps/web'),
    stdio: 'ignore',
  });
  await waitForHttp(`${base}/`, 90_000);

  // ---- the write endpoint refuses what it must (dev server, raw requests) ----
  const get0 = await raw({ method: 'GET', urlPath: '/__studio/data/asset-tweaks' });
  check('GET the tweak file answers JSON', get0.status === 200 && get0.body.trim().startsWith('{'), `status ${get0.status}`);
  for (const name of ['nope', '..%2Fasset-tweaks', 'ASSET-TWEAKS']) {
    const r = await raw({ method: 'GET', urlPath: `/__studio/data/${name}` });
    check(`GET /__studio/data/${name} is refused`, r.status === 404, `status ${r.status}`);
  }
  const evil = await raw({ method: 'POST', urlPath: '/__studio/data/asset-tweaks', host: 'evil.example', contentType: 'application/json', body: '{}' });
  check('POST from another host is refused', evil.status === 403, `status ${evil.status}`);
  const plain = await raw({ method: 'POST', urlPath: '/__studio/data/asset-tweaks', contentType: 'text/plain', body: '{}' });
  check('POST that is not JSON is refused', plain.status === 415, `status ${plain.status}`);
  const bad = await raw({ method: 'POST', urlPath: '/__studio/data/asset-tweaks', contentType: 'application/json', body: '{"headlight":{"yaw":999}}' });
  check('POST out of range is refused', bad.status === 422, `status ${bad.status}`);
  check('a refused POST leaves the file as it was', fs.readFileSync(tweaksFile, 'utf8') === original);

  // ---- the editor in the browser ----
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // domcontentloaded, not load: the page's Google Fonts request can hang offline, and the first dev transform is slow
  await page.goto(`${base}/?studio`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForSelector('.sx', { timeout: 60_000 });
  await page.waitForSelector('.sx-canvas', { timeout: 30_000 });
  check('the Studio opens on ?studio', true);
  check('the dev server is writable (no read-only banner)', (await page.locator('.sx-banner').count()) === 0);
  check('Save is disabled with nothing pending', await page.locator('.sx-top .sx-go').isDisabled());

  await page.waitForSelector('.sx-empty-view', { timeout: 10_000 });
  await page.screenshot({ path: path.join(shotsDir, 'studio-layout.png') });

  await page.locator('button[aria-label="Place headlight"]').click();
  await page.waitForSelector('input[aria-label="Offset x"]', { timeout: 10_000 });
  await page.locator('input[aria-label="Offset x"]').fill('0.25');
  await page.locator('button[aria-label="Place bin"]').click();
  await page.waitForSelector('input[aria-label="Metal value"]', { timeout: 10_000 });
  await page.locator('input[aria-label="Metal value"]').fill('0.4');

  const rows = page.locator('.sx-table tbody tr');
  await page.waitForFunction(() => document.querySelectorAll('.sx-table tbody tr').length === 2, null, { timeout: 10_000 });
  check('two pending rows, one per object', (await rows.count()) === 2);
  check('the rows name both objects', (await rows.nth(0).innerText()).includes('headlight') && (await rows.nth(1).innerText()).includes('bin'));
  await page.screenshot({ path: path.join(shotsDir, 'studio-changes-two.png') });

  // undo and redo, from the button and from the keyboard
  await page.locator('button[aria-label="Undo"]').click();
  check('Undo removes the last edit', (await rows.count()) === 1, `${await rows.count()} row(s)`);
  await page.locator('button[aria-label="Redo"]').click();
  check('Redo brings it back', (await rows.count()) === 2);
  await page.keyboard.press('Control+z');
  check('Ctrl+Z undoes', (await rows.count()) === 1);
  await page.keyboard.press('Control+Shift+z');
  check('Ctrl+Shift+Z redoes', (await rows.count()) === 2);

  // Accept all writes the file, marks the rows saved, and the page stays put (no reload)
  await page.locator('.sx-changes-head button.sx-go').click();
  await page.waitForSelector('.sx-status.ok', { timeout: 15_000 });
  await sleep(2500); // the file write makes Vite update the tweak module; the status must survive it
  check('the status line survives the save (no page reload)', (await page.locator('.sx-status.ok').count()) === 1);
  check('the accepted rows are no longer pending', (await rows.count()) === 0);
  const written = JSON.parse(fs.readFileSync(tweaksFile, 'utf8'));
  check('the file holds both values', JSON.stringify(written) === JSON.stringify({ bin: { metalness: 0.4 }, headlight: { offset: [0.25, 0, 0] } }), JSON.stringify(written));
  const readBack = JSON.parse((await raw({ method: 'GET', urlPath: '/__studio/data/asset-tweaks' })).body);
  check('GET reads the same values back', JSON.stringify(readBack) === JSON.stringify(written));

  // the game's own loader applies the saved tweak, both loadGen and the synchronous getGenSync (the page's module
  // graph, so this is the value the game uses, taken in place without a reload)
  await sleep(500);
  const game = await page.evaluate(async () => {
    const m = await import('/src/assets/gen.ts');
    const g = await m.loadGen('headlight');
    const s = m.getGenSync('headlight');
    const bin = await m.loadGen('bin');
    let metal = null;
    bin.traverse((o) => { if (metal === null && o.isMesh) metal = (Array.isArray(o.material) ? o.material[0] : o.material).metalness; });
    return { loadX: g.position.x, syncX: s ? s.position.x : null, binMetal: metal, untouched: (await m.loadGen('cot')).position.x };
  });
  check('loadGen applies the saved offset', Math.abs(game.loadX - 0.25) < 1e-9, `x ${game.loadX}`);
  check('getGenSync applies the saved offset', game.syncX !== null && Math.abs(game.syncX - 0.25) < 1e-9, `x ${game.syncX}`);
  check('loadGen applies the saved metal to the clone', Math.abs((game.binMetal ?? -1) - 0.4) < 1e-9, `metal ${game.binMetal}`);
  check('an asset with no tweak comes back untouched', game.untouched === 0, `x ${game.untouched}`);

  // the left splitter resizes the content panel, and the size is kept (kv)
  const leftW = async () => page.evaluate(() => getComputedStyle(document.querySelector('.sx-left')).width);
  const before = await leftW();
  const sp = await page.locator('.sx-split.vertical').first().boundingBox();
  await page.mouse.move(sp.x + sp.width / 2, sp.y + sp.height / 2);
  await page.mouse.down();
  await page.mouse.move(sp.x + sp.width / 2 + 60, sp.y + sp.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = await leftW();
  check('the content splitter resizes the panel', parseFloat(after) > parseFloat(before) + 40, `${before} -> ${after}`);
  await page.locator('button', { hasText: 'Classic layout' }).click();
  check('Classic layout puts the panel back', (await leftW()) === before, await leftW());

  // the Moon (prototype) workspace still opens
  await page.locator('button', { hasText: 'Moon (prototype)' }).click();
  await page.waitForSelector('.sx-proto', { timeout: 10_000 });
  await page.waitForFunction(() => (document.querySelector('.sx-proto')?.innerHTML.length ?? 0) > 500, null, { timeout: 30_000 });
  check('Moon (prototype) renders', true);
  await page.screenshot({ path: path.join(shotsDir, 'studio-moon-prototype.png') });
  await page.locator('nav.sx-tabs button', { hasText: 'Assets' }).click();
  await page.waitForSelector('.sx-body', { timeout: 10_000 });

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  // ---- the built game: read-only ----
  await browser.close();
  browser = null;
  prod = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], {
    cwd: root,
    env: { ...process.env, PORT: String(prodPort) },
    stdio: 'ignore',
  });
  await waitForHttp(`http://localhost:${prodPort}/`, 15_000);
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const built = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await built.goto(`http://localhost:${prodPort}/?studio`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await built.waitForSelector('.sx-banner', { timeout: 60_000 });
  const banner = await built.locator('.sx-banner').innerText();
  check('the built game shows the read-only banner', banner.includes('Open STUDIO.bat to save changes'), banner.slice(0, 60));
  check('Save is disabled on the built game', await built.locator('.sx-top .sx-go').isDisabled());
  await built.waitForSelector('.sx-canvas', { timeout: 30_000 }).catch(() => {});
  await built.locator('button[aria-label="Place headlight"]').click();
  await built.waitForSelector('input[aria-label="Offset x"]', { timeout: 10_000 });
  await built.locator('input[aria-label="Offset x"]').fill('0.5');
  await built.waitForFunction(() => document.querySelectorAll('.sx-table tbody tr').length === 1, null, { timeout: 10_000 });
  await built.locator('.sx-changes-head button.sx-go').isDisabled().then((d) => check('Accept is disabled on the built game', d));
  await built.screenshot({ path: path.join(shotsDir, 'studio-readonly.png') });
} catch (e) {
  check('the run completed', false, e instanceof Error ? e.message : String(e));
} finally {
  await teardown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
process.exit(failed.length === 0 ? 0 : 1);
