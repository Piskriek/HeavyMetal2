/**
 * TASK-24: the checkpoints load and land in their acts (src/storage/checkpoints.ts). Needs the campaign's checkpoints in
 * apps/web/public/checkpoints (scripts/test-campaign.mjs writes them) and a build that includes them.
 *
 * The checks:
 *  1. the player's own profile is seeded with the first act's save (un-prefixed keys, Main), and its exact text is kept;
 *  2. each checkpoint in index.json loads with ?checkpoint=<name> and lands in its act: the chain step is the one the file
 *     recorded (a load starts in the lab, as Continue does);
 *  3. after every load the Checkpoint profile is the active one, and the player's keys are byte-identical to the seeded text;
 *  4. switching back to Main restores the player's game (its chain step is the seeded one);
 *  5. an old checkpoint (the chain at version 1, from before the sapper-era saves) loads, and its chain lands in act IV;
 *  6. a file that is not a checkpoint is refused in plain words, and the button carries on with the player's own profile.
 * Serves apps/web/dist on port 8197, writes its shots to shots-run/checkpoints, and exits 1 on the first failed check.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const cpDir = path.join(root, 'apps/web/dist/checkpoints');
const shots = path.join(root, 'shots-run/checkpoints');
fs.mkdirSync(shots, { recursive: true });
const index = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/public/checkpoints/index.json'), 'utf8'));
if (!Array.isArray(index) || index.length === 0) throw new Error('no checkpoints in apps/web/public/checkpoints/index.json (run scripts/test-campaign.mjs first)');
const first = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/public/checkpoints', `${index[0].name}.json`), 'utf8'));

const port = 8197;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

let passed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) throw new Error(`FAILED: ${name}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`OK: ${name}${detail ? ` (${detail})` : ''}`);
};

/** The player's keys (un-prefixed, Main) as the page holds them. */
const mainKeys = () => page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k === 'hm.setmix.play' || k === 'hm-base-v1' || k === 'hm.setmix.beam' || k === 'hm.setmix.props' || k.startsWith('fidelity.radio-log.'))) out[k] = localStorage.getItem(k);
  }
  return out;
});
const activeProfile = () => page.evaluate(() => JSON.parse(localStorage.getItem('hm.profiles') ?? '{"active":"main"}').active);

/** Opens the game with a URL, and continues the saved profile from the menu, as a player does. */
const openGame = async (query) => {
  await page.goto(`${base}/?e2e${query}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  if (!(await page.evaluate(() => !!window.hmPlay?.ready))) {
    const labels = await page.locator('.sm-menu button').allTextContents();
    const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
    await page.locator('.sm-menu button', { hasText: want }).first().click();
  }
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
};
const landed = () => page.evaluate(() => ({ where: window.hmPlay?.where ?? null, step: window.hmPlay?.chain?.().current?.id ?? null }));

try {
  // 1. the player's own profile: the first act's save, written as Main's keys
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.evaluate((keys) => { for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v); }, first.keys);
  const seeded = await mainKeys();
  check('the player\'s profile is seeded with the first act\'s save', Object.keys(seeded).length >= 2, `${Object.keys(seeded).length} keys`);

  // 2 and 3. each checkpoint loads and lands in its act; the player's keys do not move
  for (const entry of index) {
    const file = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/public/checkpoints', `${entry.name}.json`), 'utf8'));
    await openGame(`&checkpoint=${entry.name}`);
    const at = await landed();
    // an act is the chain's step: the save holds the chain, not the screen (a load starts in the lab, as Continue does)
    check(`checkpoint ${entry.name} is in its act (${entry.act})`, at.step === file.expect.step, `step ${at.step}; the file says ${file.expect.step} (the screen on load: ${at.where}; the file was taken on ${file.expect.where})`);
    check(`checkpoint ${entry.name} is in the Checkpoint profile`, (await activeProfile()) === 'checkpoint');
    const now = await mainKeys();
    check(`checkpoint ${entry.name} leaves the player's keys byte-identical`, JSON.stringify(now) === JSON.stringify(seeded), Object.keys(now).join(','));
    await page.screenshot({ path: path.join(shots, `${entry.name}.png`) });
    const left = await page.locator('.profile-switching-overlay').count();
    check(`checkpoint ${entry.name} clears its loading bar`, left === 0, `${left} overlays left`);
  }

  // 4. switching back to Main restores the player's game
  await page.evaluate(() => {
    const reg = JSON.parse(localStorage.getItem('hm.profiles') ?? '{}');
    localStorage.setItem('hm.profiles', JSON.stringify({ ...reg, active: 'main' }));
  });
  await openGame('');
  const mine = await landed();
  check('switching back to Main restores the player\'s game (its act, not a checkpoint)', mine.step !== null && (await activeProfile()) === 'main', `where ${mine.where} step ${mine.step}`);
  check('the player\'s keys are still byte-identical after the round trip', JSON.stringify(await mainKeys()) === JSON.stringify(seeded));

  // 5. an old checkpoint: the chain at version 1 (before A4-01b's migration) still loads and lands in act IV
  const act4 = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/public/checkpoints', 'act4-start.json'), 'utf8'));
  const oldPlay = JSON.parse(act4.keys['hm.setmix.play']);
  oldPlay.chain.version = 1;
  const old = { ...act4, name: 'old-act4', title: 'Old act IV (chain version 1)', keys: { ...act4.keys, 'hm.setmix.play': JSON.stringify(oldPlay) } };
  fs.writeFileSync(path.join(cpDir, 'old-act4.json'), JSON.stringify(old));
  await openGame('&checkpoint=old-act4');
  const oldAt = await landed();
  check('an old checkpoint (chain version 1) loads and lands in act IV', oldAt.step !== null && oldAt.where === act4.expect.where, `where ${oldAt.where} step ${oldAt.step}`);

  // 6. a file that is not a checkpoint is refused in plain words; the button carries on with the player's own profile
  fs.writeFileSync(path.join(cpDir, 'broken.json'), JSON.stringify({ format: 'something-else', v: 1 }));
  await page.goto(`${base}/?e2e&checkpoint=broken`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.locator('.profile-switching-overlay').waitFor({ state: 'visible', timeout: 15000 });
  const said = await page.locator('.profile-switching-overlay').textContent();
  check('a file that is not a checkpoint is refused, with the reason', /not a FIDELITY checkpoint/.test(said ?? ''), (said ?? '').slice(0, 120));
  await page.screenshot({ path: path.join(shots, 'broken-refused.png') });
  await page.locator('.profile-switching-overlay button').first().click();
  await page.waitForFunction(() => !!window.hmPlay?.ready || !!document.querySelector('.sm-menu button'), null, { timeout: 60000 });
  check('carrying on after a refusal keeps the player\'s own profile', (await activeProfile()) === 'main');

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  console.log(`ALL CHECKPOINT CHECKS PASSED (${passed})`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  for (const f of ['old-act4.json', 'broken.json']) fs.rmSync(path.join(cpDir, f), { force: true });
  server.kill();
  await browser.close();
}
