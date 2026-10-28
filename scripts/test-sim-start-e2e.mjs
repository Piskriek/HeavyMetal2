/**
 * Plan 57 §14 (step 1b): the simulation start. The lab and the story are stripped for parts: a new avatar arrives on the world
 * at stage 3, the drone along, with no lab, no story steps, no mentor lines and no sync to run down; a reload keeps it so.
 * The parked story still begins with `?story` (its own e2e scripts use that seam).
 *
 * Boots the built game (run `npm run build` first); shots to shots-run/sim-start/.
 *   node scripts/test-sim-start-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/sim-start');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }
const port = 8237;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { window.speechSynthesis.speak = () => {}; } catch {}
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const play = () => page.evaluate(() => ({ ready: window.hmPlay?.ready ?? false, where: window.hmPlay?.where ?? null, step: window.hmPlay?.step ?? null, sync: window.hmPlay?.sync ?? null }));
const enterPlay = async () => {
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene, { timeout: 90000 });
};

try {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // the home: the grid room, built after the menu paints
  await page.waitForFunction(() => window.hmRoom?.ready === true, { timeout: 90000 });
  const room = await page.evaluate(() => ({ sceneMs: window.hmRoom.sceneMs, mountMs: window.hmRoom.mountMs }));
  check('the home warms in the grid room, built after the menu first paints', typeof room.sceneMs === 'number', JSON.stringify(room));

  await enterPlay();
  const done = page.locator('.play-create .btns button', { hasText: 'Done' }).first();
  check('a new avatar is made first, and its button goes into the world, not the lab', /into the world/.test(await done.innerText()), await done.innerText());
  await done.click();
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', { timeout: 15000 }).catch(() => {});
  let p = await play();
  check('Done puts you straight on the world, with the story done (no lab steps)', p.where === 'planet' && p.step === 'done', JSON.stringify(p));
  const saved = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('hm.setmix.play')); try { return k ? JSON.parse(localStorage.getItem(k)) : null; } catch { return null; } });
  check('...at stage 3, saved as a simulation start', saved?.start === 'sim' && saved?.plot?.stage === 3 && saved?.step === 'done', JSON.stringify({ start: saved?.start, stage: saved?.plot?.stage, step: saved?.step }));
  check('...with your drone at your side', await page.evaluate(() => Boolean(window.__companion)));
  // the story's HUD stays out: the mentor's portrait, the chain's next step, the sync meter; the goal card reads the real stage
  await page.waitForTimeout(1500);
  check('no mentor portrait, no story chain line, no sync meter', await page.evaluate(() => !document.querySelector('.hud-portrait-in') && !document.querySelector('.play-next') && !document.querySelector('.play-sync')));
  check('the goal card reads the real stage', /Stage 3/.test(await page.locator('.play-goal h2').innerText()), await page.locator('.play-goal h2').innerText());
  // the sync holds: no lab to refill it in, so nothing drains and nothing recalls you
  await page.waitForTimeout(6000);
  p = await play();
  check('the sync holds full and you are not recalled to a lab', p.sync === 1 && p.where === 'planet', JSON.stringify(p));
  // the loop steps its own copy of the plot and saves it: stage 3 must still be there
  const later = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('hm.setmix.play')); try { return k ? JSON.parse(localStorage.getItem(k)) : null; } catch { return null; } });
  check('...and the world stays at stage 3 as the game runs and saves', later?.plot?.stage === 3 && /Stage 3/.test(await page.locator('.play-goal h2').innerText()), String(later?.plot?.stage));
  check('no mentor line played (her story is parked)', await page.evaluate(() => !document.querySelector('.hud-portrait-in')));
  await shot('01-arrived-on-the-world');

  // a reload: the save opens on the world again
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await enterPlay();
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', { timeout: 15000 }).catch(() => {});
  p = await play();
  check('after a reload the simulation save opens on the world, not in the lab', p.where === 'planet' && p.step === 'done' && (await page.locator('.play-create').count()) === 0, JSON.stringify(p));

  // the parked story still begins with ?story (its e2e seam)
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`http://localhost:${port}/?story&e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await enterPlay();
  const storyDone = page.locator('.play-create .btns button', { hasText: 'Done' }).first();
  check('with ?story the creator still goes into the lab', /into the lab/.test(await storyDone.innerText()), await storyDone.innerText());
  await storyDone.click();
  await page.waitForTimeout(1500);
  p = await play();
  check('...and the story begins in the lab at its first step', p.where === 'lab' && p.step === 'power', JSON.stringify(p));

  check('no page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, `${e.message}${pageErrors.length ? ` | page errors: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} sim-start checks passed`);
process.exit(failed.length ? 1 : 0);
