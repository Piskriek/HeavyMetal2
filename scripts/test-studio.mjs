import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
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

// ---- the asset bench: the redo runs on the weapon bench, but in a TEMPORARY folder shaped like the repository
// (STUDIO_BENCH_DIR). Its files are synthetic, made by the mock fixture, and every step is the fixture: no real asset,
// no packed game file and no real pack is ever read or written here. The only real file the bench touches is the
// read-only copy of docs/runworld/assets.json. The 3D AI connection goes to a temporary secrets file.
const benchId = 'weapon-bench';
const TOKEN = 'bench-test-token-0123456789';
const benchTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bench-test-'));
const benchDir = path.join(benchTmp, 'zips/runworld/assets', benchId);
const benchGenDir = path.join(benchTmp, 'apps/web/src/assets/gen');
const benchManifest = path.join(benchTmp, 'docs/runworld/assets.json');
const secretsFile = path.join(os.tmpdir(), `studio-secrets-test-${process.pid}.json`);
const mockControl = path.join(benchTmp, 'mock-control.json');
const setControl = (c) => fs.writeFileSync(mockControl, JSON.stringify(c));
const pipeSeen = { auth: false };
let pipe = null;
let pipeUrl = '';

/** The temporary bench: the manifest copied, the folders made, and the first images, model and post made by the fixture (so the bench has old files to archive). */
function seedBench() {
  fs.mkdirSync(path.dirname(benchManifest), { recursive: true });
  fs.copyFileSync(path.join(root, 'docs/runworld/assets.json'), benchManifest);
  fs.mkdirSync(benchGenDir, { recursive: true });
  fs.mkdirSync(path.join(benchTmp, 'apps/web/public/hd'), { recursive: true });
  for (const step of ['images', 'model', 'post']) {
    const r = spawnSync(process.execPath, [path.join(root, 'scripts/studio-bench-mock.mjs'), step, benchId], {
      cwd: root,
      env: { ...process.env, STUDIO_BENCH_DIR: benchTmp },
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`seeding ${step} failed: ${r.stdout}${r.stderr}`);
  }
}

/** A stand-in for the owner's 3D PC: /health answers only to the right bearer token, and adds a field that must not reach the Studio. */
function startPipeline() {
  return new Promise((resolve) => {
    pipe = http.createServer((req, res) => {
      if (req.url !== '/health') { res.statusCode = 404; res.end('no'); return; }
      pipeSeen.auth ||= req.headers.authorization === `Bearer ${TOKEN}`;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ queued: 0, busy: 0, vram_free_gb: 11.3, leak: 'must not reach the Studio' }));
    });
    pipe.listen(0, '127.0.0.1', () => { pipeUrl = `http://127.0.0.1:${pipe.address().port}`; resolve(); });
  });
}

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
  try { fs.rmSync(benchTmp, { recursive: true, force: true }); } catch (e) { console.log('teardown: could not remove the temporary bench', e); }
  try { fs.rmSync(secretsFile, { force: true }); } catch { /* the temporary secrets file */ }
  if (pipe) pipe.close();
  if (browser) await browser.close().catch(() => {});
  if (dev) dev.kill();
  if (prod) prod.kill();
}

try {
  // the unit tests for the endpoint, the tweak maths, the bench and the presets (the npm test glob is shared, so they run from here too)
  const unit = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'apps/web/studio-server/write-back.test.ts', 'apps/web/studio-server/bench.test.ts', 'apps/web/src/assets/gen-tweak.test.ts', 'apps/web/src/studio/studio-presets.test.ts'], { cwd: root, encoding: 'utf8' });
  check('the write-back, bench, tweak and preset unit tests pass', unit.status === 0, `exit ${unit.status}`);

  seedBench();
  setControl({ skip: [], fail: [] });
  await startPipeline();
  dev = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps/web'),
    stdio: 'ignore',
    env: { ...process.env, STUDIO_BENCH_MOCK: '1', STUDIO_BENCH_DIR: benchTmp, STUDIO_SECRETS_FILE: secretsFile },
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

  // ---- the asset bench (TASK-18): the connection, the refusals, the redo with every step mocked, a preset in the game ----
  const bench = '/__studio/bench';
  const j = (r) => JSON.parse(r.body);
  const post = (urlPath, body, host) => raw({ method: 'POST', urlPath, body, contentType: 'application/json', host });
  // the job a click starts is the first one newer than the last job seen before the click, and it has ended
  const jobNow = async () => j(await raw({ method: 'GET', urlPath: `${bench}/job` })).job?.id ?? 0;
  const waitJobAfter = async (afterId) => {
    for (let i = 0; i < 1200; i++) {
      const r = j(await raw({ method: 'GET', urlPath: `${bench}/job` }));
      if (r.job && r.job.id > afterId && !r.running) return r.job;
      await sleep(500);
    }
    return null;
  };
  const freshPage = async () => {
    await sleep(2500);
    await page.waitForSelector('.sx-canvas', { timeout: 120_000 });
    await page.locator('.sx-outline button', { hasText: benchId }).click();
  };
  const noteText = () => page.locator('.sx-redo-note').first().innerText().catch(() => '');
  const waitNote = (text) => page.waitForFunction((t) => document.querySelector('.sx-redo-note')?.textContent?.includes(t) ?? false, text, { timeout: 60_000 });
  const keepEnabled = () => page.waitForFunction(() => {
    const b = [...document.querySelectorAll('.sx-redo button')].find((x) => x.textContent?.trim() === 'Keep');
    return b !== undefined && !b.disabled;
  }, null, { timeout: 60_000 });

  const badConn = await post(`${bench}/connection`, JSON.stringify({ url: 'ftp://nowhere', token: TOKEN }));
  check('a connection with a bad URL is refused', badConn.status === 422, `status ${badConn.status}`);
  const conn = await post(`${bench}/connection`, JSON.stringify({ url: pipeUrl, token: TOKEN }));
  check('the connection is saved to the secrets file', conn.status === 200 && fs.existsSync(secretsFile) && fs.readFileSync(secretsFile, 'utf8').includes(TOKEN));
  check('saving the connection never echoes the token', !conn.body.includes(TOKEN));
  const getConn = await raw({ method: 'GET', urlPath: `${bench}/connection` });
  check('the connection reads back as connected from the Studio, with no token', j(getConn).connected === true && j(getConn).source === 'studio' && !getConn.body.includes(TOKEN));
  const health = await post(`${bench}/test`, '');
  check('Test connection reaches the pipeline with the token', j(health).ok === true && pipeSeen.auth, JSON.stringify(j(health)).slice(0, 120));
  check('the test answer keeps the numbers and drops the rest', typeof j(health).detail?.vram_free_gb === 'number' && !health.body.includes('must not reach'));

  const jobsBeforeRefusals = await jobNow();
  for (const [label, urlPath, body, host, want] of [
    ['a redo step for an id not in assets.json', `${bench}/step/images/nope`, '{}', undefined, 404],
    ['a redo step with a traversal id', `${bench}/step/images/..%2Fasset-tweaks`, '{}', undefined, 404],
    ['a step that is not one of the four', `${bench}/step/rm/${benchId}`, '{}', undefined, 404],
    ['a revert to an archive that does not exist', `${bench}/revert/${benchId}/20000101-000000-model`, '{}', undefined, 404],
    ['a description edit that names another field', `${bench}/describe/${benchId}`, JSON.stringify({ subject: 'a description that is long enough to pass', id: 'bin' }), undefined, 422],
    ['a cancel from another host', `${bench}/cancel`, '', 'evil.example', 403],
  ]) {
    const r = await post(urlPath, body, host);
    check(`${label} is refused`, r.status === want, `status ${r.status}`);
  }
  const notListed = await raw({ method: 'GET', urlPath: `${bench}/file/${benchId}/secret.txt` });
  check('a file that is not on the list is not served', notListed.status === 404);
  check('the refusals started no job', (await jobNow()) === jobsBeforeRefusals);

  const manifestBefore = JSON.parse(fs.readFileSync(benchManifest, 'utf8')).assets;
  const desc = await post(`${bench}/describe/${benchId}`, JSON.stringify({ subject: 'the weapon bench, a test description for the e2e run, long enough' }));
  check('a description is saved for that asset', desc.status === 200, `status ${desc.status}`);
  const manifestAfter = JSON.parse(fs.readFileSync(benchManifest, 'utf8')).assets;
  check('only that asset changed in assets.json', JSON.stringify(manifestAfter.filter((a) => a.id !== benchId)) === JSON.stringify(manifestBefore.filter((a) => a.id !== benchId)));

  // the redo in the browser, every step the fixture (STUDIO_BENCH_MOCK=1), in the temporary bench
  await page.locator('nav.sx-tabs button', { hasText: 'Assets' }).click();
  await page.locator(`button[aria-label="Place ${benchId}"]`).click();
  await page.waitForSelector('.sx-canvas', { timeout: 30_000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(shotsDir, 'bench-before-viewport.png') });
  await page.locator('.sx-right-tabs button', { hasText: 'Redo model' }).click();
  await page.waitForSelector('.sx-steps', { timeout: 60_000 });
  check('the Redo panel shows the connection as connected', (await page.locator('.sx-conn-state').innerText()).trim() === 'connected');
  check('the page never shows the token', !(await page.content()).includes(TOKEN));
  await page.screenshot({ path: path.join(shotsDir, 'bench-redo-connected.png') });

  await page.locator('#sx-subject').fill('the weapon bench, a test description typed in the panel, long enough');
  await page.locator('.sx-describe button', { hasText: 'Save description' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.sx-describe button')].find((b) => b.textContent?.includes('Save description'))?.disabled === true, null, { timeout: 30_000 });
  check('the description saves from the panel', true);

  let seen = await jobNow();
  await page.locator('.sx-step').nth(1).locator('button', { hasText: /Try again|Make the image/ }).click();
  const img = await waitJobAfter(seen);
  check('the new image step runs to the end (fixture)', img?.state === 'ok' && img?.step === 'images', `${img?.state} ${img?.error ?? ''}`);
  await page.locator('.sx-step').nth(1).locator('button', { hasText: 'Use this' }).click();
  const usingThis = await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Using this'), null, { timeout: 20_000 }).then(() => true, () => false);
  if (!usingThis) {
    // a diagnosis for the log: what the panel shows at this moment
    console.log('DIAG note: ' + (await noteText()));
    console.log('DIAG buttons: ' + JSON.stringify(await page.locator('.sx-redo button').evaluateAll((bs) => bs.map((x) => `${x.textContent?.trim()}${x.disabled ? '(off)' : ''}`))));
    console.log('DIAG job: ' + JSON.stringify(j(await raw({ method: 'GET', urlPath: `${bench}/job` })).job?.state));
    console.log('DIAG asset: ' + JSON.stringify(j(await raw({ method: 'GET', urlPath: `${bench}/asset/${benchId}` })).files));
    await page.screenshot({ path: path.join(shotsDir, 'bench-diag-use.png') });
  }
  check('Use this approves the image', usingThis);
  await page.screenshot({ path: path.join(shotsDir, 'bench-redo-image.png') });

  seen = await jobNow();
  await page.locator('.sx-step').nth(2).locator('button', { hasText: /Make the model/ }).click();
  const model = await waitJobAfter(seen);
  check('the 3D step runs to the end (fixture)', model?.state === 'ok' && model?.step === 'model', `${model?.state} ${model?.error ?? ''}`);
  await page.screenshot({ path: path.join(shotsDir, 'bench-redo-model.png') });

  // process and pack: two jobs in order, each awaited by its own id; the panel says so once both have passed
  const levelsBefore = fs.readFileSync(path.join(benchDir, 'low.glb'));
  seen = await jobNow();
  await page.locator('button', { hasText: 'Process and pack' }).click();
  const post1 = await waitJobAfter(seen);
  check('process runs first (fixture)', post1?.state === 'ok' && post1?.step === 'post', `${post1?.state} ${post1?.error ?? ''}`);
  const pack1 = await waitJobAfter(post1?.id ?? seen);
  check('then pack, which writes the game files (fixture, temporary)', pack1?.state === 'ok' && pack1?.step === 'pack', `${pack1?.state} ${pack1?.error ?? ''}`);
  await waitNote('Processed and packed');
  check('the panel reports the pair as done only after both passed', (await noteText()).includes('Processed and packed'), await noteText());
  const levelsNow = fs.readFileSync(path.join(benchDir, 'low.glb'));
  check('the process wrote new levels (the fixture colour changed)', !levelsNow.equals(levelsBefore));
  check('the pack copied the new low level into the temporary game folder', fs.readFileSync(path.join(benchGenDir, `${benchId}.glb`)).equals(levelsNow));
  await keepEnabled();
  check('Keep is enabled after a pack', true);
  await page.screenshot({ path: path.join(shotsDir, 'bench-redo-pack.png') });

  // compare, Keep, and revert
  await freshPage();
  await page.locator('.sx-right-tabs button', { hasText: 'Redo model' }).click();
  await page.waitForSelector('.sx-steps', { timeout: 60_000 });
  await page.locator('button', { hasText: 'Show old and new' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.sx-world-tag').length >= 6, null, { timeout: 120_000 });
  check('the comparison shows old and new at every level', (await page.locator('.sx-world-tag').count()) >= 6);
  await page.screenshot({ path: path.join(shotsDir, 'bench-compare.png') });
  await page.locator('button', { hasText: /^Keep$/ }).click();
  await waitNote('Kept the new model');
  check('Keep leaves the new model and says so', (await noteText()).includes('Kept the new model'));

  await page.locator('button', { hasText: 'Show old and new' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.sx-world-tag').length >= 6, null, { timeout: 120_000 });
  const beforeRevert = fs.readFileSync(path.join(benchDir, 'low.glb'));
  seen = await jobNow();
  await page.locator('button', { hasText: 'Revert to the old' }).click();
  const rev = await waitJobAfter(seen);
  check('revert puts the old model back and packs it (fixture)', rev?.state === 'ok' && rev?.step === 'revert', `${rev?.state} ${rev?.error ?? ''}`);
  const reverted = fs.readFileSync(path.join(benchDir, 'low.glb'));
  check('revert restored the old low level', !reverted.equals(beforeRevert) && reverted.length > 0);
  check('the temporary game folder holds the reverted level', fs.readFileSync(path.join(benchGenDir, `${benchId}.glb`)).equals(reverted));
  await freshPage();
  const inGame = await page.evaluate(async (id) => {
    const m = await import('/src/assets/gen.ts');
    const g = await m.loadGen(id);
    let n = 0;
    g.traverse((o) => { if (o.isMesh) n++; });
    return n;
  }, benchId);
  check('the game still loads the bench after the revert', inGame > 0, `${inGame} meshes`);
  await page.locator('.sx-right-tabs button', { hasText: 'Redo model' }).click();
  await page.waitForSelector('.sx-steps', { timeout: 60_000 });
  await page.screenshot({ path: path.join(shotsDir, 'bench-redo-revert.png') });

  // a process that writes no levels is reported as failed, and the pack never starts (the failure is not masked)
  setControl({ skip: ['post'], fail: [] });
  seen = await jobNow();
  await page.locator('button', { hasText: 'Process and pack' }).click();
  const failedPost = await waitJobAfter(seen);
  check('a process that writes nothing ends failed', failedPost?.state === 'failed' && failedPost?.step === 'post', `${failedPost?.state} ${failedPost?.error ?? ''}`);
  await waitNote('Process failed');
  check('the panel says the process failed, not done', (await noteText()).includes('no new levels'), await noteText());
  check('no pack started after the failed process', (await jobNow()) === failedPost?.id);
  setControl({ skip: [], fail: [] });

  // the three levels side by side, then a material preset, accepted, read back from the game's own loader
  await page.locator('button', { hasText: 'All three' }).click();
  await sleep(1500);
  await page.screenshot({ path: path.join(shotsDir, 'bench-levels.png') });
  await page.locator('.sx-right-tabs button', { hasText: 'Details' }).click();
  await page.waitForSelector('.sx-presets', { timeout: 10_000 });
  await page.screenshot({ path: path.join(shotsDir, 'bench-presets.png') });
  await page.locator('.sx-preset', { hasText: 'Lunar Anorthosite' }).click();
  const benchRows = page.locator('.sx-table tbody tr', { hasText: benchId });
  await page.waitForFunction((id) => [...document.querySelectorAll('.sx-table tbody tr')].filter((r) => r.textContent?.includes(id)).length === 3, benchId, { timeout: 10_000 });
  check('a preset makes three pending rows: colour, metal and rough', (await benchRows.count()) === 3);
  await page.locator('.sx-changes-head button.sx-go').click();
  await page.waitForSelector('.sx-status.ok', { timeout: 15_000 });
  await sleep(2500);
  const look = await page.evaluate(async (id) => {
    const m = await import('/src/assets/gen.ts');
    const g = m.getGenSync(id);
    let mat = null;
    g?.traverse((o) => { if (mat === null && o.isMesh) mat = Array.isArray(o.material) ? o.material[0] : o.material; });
    return mat ? { hex: mat.color.getHexString(), metal: mat.metalness, rough: mat.roughness } : null;
  }, benchId);
  check('the preset is seen in the game (colour, metal 0, rough)', look?.hex === '6b7280' && look?.metal === 0 && Math.abs((look?.rough ?? -1) - 0.87) < 0.01, JSON.stringify(look));
  await page.screenshot({ path: path.join(shotsDir, 'bench-preset.png') });

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
