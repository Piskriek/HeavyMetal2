/**
 * Plan 39 section 7: the player's own presets. On each bench page (Parts, Species, Lights), Save as preset keeps the
 * current one; it shows under "Yours" after the named presets with its own preview (a thumbnail, or a glowing ball for a
 * light); hovering it tries it on, clicking it loads it; saving the same one again adds nothing; a reload keeps them.
 *   npm run build && node --import tsx scripts/test-my-presets.mjs
 * Shots in shots-run/my-presets/ (gitignored). Exit code 1 when a check fails.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/my-presets');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8205;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('mine-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('mine-test-booted', '1');
    }
  } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const boot = async () => {
  await page.goto(`http://localhost:${port}/?story&e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
};
const openTab = async (tab) => {
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator(`[data-testid="bench-tab-${tab}"]`).click();
  await frames(10);
};
const mine = () => page.evaluate(() => window.__dev.myPresets().list.map((q) => `${q.id}:${q.kind}:${q.name}`));

try {
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });

  // ---- a part
  await openTab('parts');
  await page.locator('[data-testid="bench-gen-bolt"]').click();
  await page.locator('[data-testid="bench-param-headWidth"]').fill('0.12');
  await page.locator('[data-testid="bench-mat-metal-green"]').click();
  await page.locator('[data-testid="bench-save-part"]').click();
  await frames(10);
  check('Save as preset keeps the part in the profile', (await mine()).join() === 'my1:part:Bolt, signal green', (await mine()).join());
  const chip = page.locator('[data-testid="bench-mine-my1"]');
  check('the saved part shows under Yours, with its own thumbnail', await chip.isVisible() && await page.waitForFunction(() => !!document.querySelector('[data-testid="bench-mine-my1"] img'), null, { timeout: 8000 }).then(() => true, () => false));
  await page.locator('[data-testid="bench-save-part"]').click();
  await frames(5);
  check('saving the same part again adds nothing', (await mine()).length === 1);
  // change the part, then hover and click the saved one
  await page.locator('[data-testid="bench-gen-panel"]').click();
  await chip.hover();
  const trying = await page.locator('[data-testid="part-preview-trying"]').textContent().catch(() => '');
  check('hovering a saved part tries it on in the preview', /bolt, signal green/i.test(trying ?? ''), trying ?? '');
  await chip.click();
  await frames(5);
  const head = await page.locator('[data-testid="bench-param-headWidth"]').inputValue().catch(() => '');
  check('clicking a saved part loads it: the bolt, its fat head', head === '0.12', head);
  await page.screenshot({ path: path.join(shotsDir, 'parts-yours.png') });

  // ---- a species and a light
  await openTab('species');
  await page.locator('[data-testid="bench-species-autumn-oak"]').click();
  await page.locator('[data-testid="bench-tree-height"]').fill('13');
  await page.locator('[data-testid="bench-save-species"]').click();
  await openTab('lights');
  await page.locator('[data-testid="bench-light-ember"]').click();
  await page.locator('[data-testid="bench-light-intensity"]').fill('2.5');
  await page.locator('[data-testid="bench-save-light"]').click();
  await frames(10);
  check('the species and the light are saved too, each under its kind', (await mine()).join() === 'my1:part:Bolt, signal green,my2:species:Oak, autumn gold, 13.0 m,my3:light:1700 K, flicker', (await mine()).join());
  check('the saved light shows under Yours as a glowing ball', await page.locator('[data-testid="bench-mine-my3"] .bench-light-ball').isVisible());
  await page.screenshot({ path: path.join(shotsDir, 'lights-yours.png') });

  // ---- a reload keeps them
  await boot();
  check('after a reload the three presets are still the player\'s', (await mine()).length === 3);
  await openTab('species');
  check('and the saved species shows under Yours with its thumbnail', await page.waitForFunction(() => !!document.querySelector('[data-testid="bench-mine-my2"] img'), null, { timeout: 10000 }).then(() => true, () => false));
  await page.screenshot({ path: path.join(shotsDir, 'species-yours.png') });

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} my-presets checks pass`);
process.exit(failed ? 1 : 0);
