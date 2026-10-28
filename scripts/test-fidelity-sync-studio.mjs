import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The FIDELITY home, the Studio, and the Planetary Grid's synced and desynced play (rewritten 28 Oct, Plan 57 §14.2):
 * - the home: the FIDELITY brand and its menu, the grid room ready behind it;
 * - the Studio: the menu opens the Studio app, the rung-based editor (the old Moon editor and Planet Forge are no longer
 *   mounted: the Studio route renders StudioApp, which does not use its renderPrototype). It is driven through its AI bridge
 *   (window.__studioBridge): its manifest lists workspaces and kits, a rung and a kit can be chosen, and Back returns home;
 * - the Planetary Grid: synced, spawned in the lab (the parked story's start, so ?story), the sync badge shows; the desync
 *   toggle switches it to the solo branch.
 * It asserts what it sees (the version before only printed it). Boots the built game: run `npm run build` first.
 */

const chromePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8198;
const targetUrl = `http://localhost:${port}/?story`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
fs.mkdirSync('shots-run', { recursive: true });

try {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.sm-home', { timeout: 30000 });

  // 1. the home
  check('the brand is FIDELITY', (await page.locator('.fidelity-brand b').innerText()).trim() === 'FIDELITY');
  const items = await page.$$eval('.sm-menu button b', (b) => b.map((x) => x.textContent));
  check('the menu holds Expedition, Planetary Grid and The Studio', ['Expedition', 'Planetary Grid', 'The Studio'].every((t) => items.includes(t)), items.join(', '));
  check('the grid room is ready behind it', await page.waitForFunction(() => window.hmRoom?.ready === true, null, { timeout: 90000 }).then(() => true, () => false));
  await page.screenshot({ path: 'shots-run/fidelity-menu-synced-desynced.png' });

  // 2. the Studio, through its AI bridge
  await page.locator('.sm-menu button', { hasText: 'The Studio' }).click();
  const opened = await page.waitForFunction(() => Boolean(window.__studioBridge), null, { timeout: 30000 }).then(() => true, () => false);
  check('The Studio opens the Studio app (its AI bridge is up)', opened);
  const manifest = await page.evaluate(() => window.__studioBridge?.getManifest() ?? null);
  check('its manifest lists workspaces and kits', (manifest?.workspaces?.length ?? 0) > 0 && (manifest?.kits?.length ?? 0) > 0, `${manifest?.workspaces?.length ?? 0} workspaces, ${manifest?.kits?.length ?? 0} kits`);
  await page.evaluate(() => window.__studioBridge.setActiveRung(4));
  check('a rung can be chosen (Kits & Assemblies)', await page.evaluate(() => window.__studioBridge.getSnapshot().activeRung === 4));
  const kit = manifest?.kits?.find((k) => k.id !== manifest.activeKitId)?.id ?? null;
  if (kit) await page.evaluate((id) => window.__studioBridge.selectKit(id), kit);
  check('a kit can be chosen', kit !== null && await page.evaluate((id) => window.__studioBridge.getSnapshot().activeKitId === id, kit), String(kit));
  await page.screenshot({ path: 'shots-run/fidelity-studio.png' });
  await page.locator('[data-testid="studio-back-btn"]').click();
  check('Back returns to the home', await page.waitForSelector('.sm-home', { timeout: 15000 }).then(() => true, () => false));

  // 3. the Planetary Grid: synced, then the desync toggle
  await page.locator('.sm-menu button', { hasText: 'Planetary Grid' }).click();
  await page.locator('[data-testid="pg-sync-synced"]').click({ timeout: 15000 });
  // the spawn panel (cards and a deploy button since 846a2a39): the Earth lab, then deploy
  await page.locator('.pg-spawn-card', { hasText: 'Earth Observation Lab' }).click({ timeout: 15000 });
  await page.locator('.pg-deploy-cta').click({ timeout: 15000 });
  // a fresh grid profile opens the character creator first (the parked story's start: ?story)
  await page.locator('button', { hasText: 'Done: into the lab' }).click({ timeout: 30000 }).catch(() => {});
  const syncBadge = page.locator('.sync-badge');
  const badge = await syncBadge.waitFor({ state: 'visible', timeout: 60000 }).then(() => true, () => false);
  const synced = badge ? (await syncBadge.textContent())?.trim() ?? '' : '';
  check('the synced grid shows its sync badge', badge && /sync/i.test(synced), synced);
  await page.screenshot({ path: 'shots-run/fidelity-grid-synced.png' });
  // the HUD's Manage button opens the grid's panel over play; its DESYNCED button switches to the solo branch
  await page.locator('.sync-branch-toggle').click();
  await page.locator('[data-testid="pg-sync-desynced"]').click({ timeout: 15000 });
  await page.waitForTimeout(500);
  const desynced = (await syncBadge.textContent())?.trim() ?? '';
  check('the grid panel in play switches it to the solo branch', desynced !== synced && /desync|solo/i.test(desynced), desynced);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (err) {
  check('script completed', false, err.message);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} home, Studio and grid checks passed`);
process.exit(failed.length ? 1 : 0);
