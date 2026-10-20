/**
 * TICKET-32, the owner's loop (plans 38 and 39; rulings in ARGO_NOTE_34): in the lab, the preset bench's Parts page prints a fat
 * green chamfered bolt onto a blank (paid in raw vertices and raw pixels), the cartridge goes in the rifle's port, a tap of
 * Apply at one skid bolt of the capacitor bank changes that bolt only, the change survives a reload, and a hold changes every
 * bolt on the bank.
 *   npm run build && node --import tsx scripts/test-part-cartridge.mjs
 * Shots in shots-run/part-cartridge/ (gitignored). Exit code 1 when a check fails.
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
const shotsDir = path.join(root, 'shots-run/part-cartridge');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8199;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('part-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('part-test-booted', '1');
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// the pack and every store the network reaches (a grant can land in the bridge store; the bill is paid from both)
const stock = (item) => page.evaluate((it) => { const w = window.hmPlay.base.world(); return [w.player, ...w.boxes].reduce((s, b) => s + b.slots.reduce((t, x) => t + (x && x.item === it ? x.n : 0), 0), 0); }, item);
const bolts = () => page.evaluate(() => window.__dev.kitPlaced('capacitor-bank').filter((p) => p.path.startsWith('bolts-')));

const boot = async () => {
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
  // the bank is built once its generated can has loaded
  await page.waitForFunction(() => window.__dev.kitPlaced('capacitor-bank').length > 0, { timeout: 30000 });
};

/** Stands beside the capacitor bank and turns until the beam's aim names a skid bolt; returns its path. */
const aimAtSkidBolt = async () => {
  for (const [x, z] of [[-6.2, 1.9], [-6.2, 0.1]]) {
    for (let p = 0; p < 4; p++) {
      for (let y = 0; y < 16; y++) {
        const yaw = (y / 16) * Math.PI * 2, pitch = -0.5 - p * 0.2;
        await page.evaluate(([xx, zz, yy, pp]) => window.__playScene.debug.teleport('lab', xx, zz, yy, pp), [x, z, yaw, pitch]);
        await frames(2); // the camera follows the player on the next frame
        const hit = await page.evaluate(() => window.__dev.aimKitPart());
        if (hit && hit.path.startsWith('bolts-')) return hit;
      }
    }
  }
  return null;
};

try {
  // the first boot makes the profile; the loop runs on High, where the skid bolts (rank 2) are drawn and so can be hit
  await boot();
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('hm.profile.v2') || 'null');
    if (profile) localStorage.setItem('hm.profile.v2', JSON.stringify({ ...profile, quality: 'high' }));
  });
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });
  await page.evaluate(() => { window.__dev.grantStock('vtx-rough', 40); window.__dev.grantStock('pxd-mono', 40); });
  await frames(5);
  const vtxBefore = await stock('vtx-rough'), pxdBefore = await stock('pxd-mono');
  check('the player holds raw vertices and raw pixels to print with', vtxBefore >= 5 && pxdBefore >= 5, `vtx ${vtxBefore}, pxd ${pxdBefore}`);

  // ---- the bench's Parts page
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator('[data-testid="bench-tab-parts"]').click();
  await page.waitForSelector('[data-testid="bench-parts"]');
  await page.locator('[data-testid="bench-gen-bolt"]').click();
  await page.locator('[data-testid="bench-param-headWidth"]').fill('0.12');
  await page.locator('[data-testid="bench-mat-metal-green"]').click();
  await page.locator('[data-testid="bench-op-chamfer-hard-edges"]').click();
  await page.screenshot({ path: path.join(shotsDir, 'bench-parts.png') });
  check('the bench can print the fat green bolt', await page.locator('[data-testid="bench-print"]').isEnabled());
  await page.locator('[data-testid="bench-print"]').click();
  await frames(5);
  check('printing spends 5 raw vertices and 5 raw pixels (a small fastener)', (await stock('vtx-rough')) === vtxBefore - 5 && (await stock('pxd-mono')) === pxdBefore - 5,
    `vtx ${await stock('vtx-rough')}, pxd ${await stock('pxd-mono')}`);
  await page.evaluate(() => window.__dev.stepLab(25));
  const cart = await page.evaluate(() => window.hmPlay.state().lab.cartridges.find((c) => c.kind === 'part') ?? null);
  check('the bench prints a part cartridge carrying the fat green chamfered bolt', !!cart && cart.part.gen === 'bolt' && cart.part.params.headWidth === 0.12 && cart.part.slotMaterials.metal === 'green' && cart.part.ops[0]?.op === 'chamfer-hard-edges',
    cart ? `${cart.name}: ${JSON.stringify(cart.part.params)}` : 'none');
  await page.evaluate(() => window.hmPlay.openLabPanel(null));

  // ---- into the rifle
  check('the part cartridge loads into the rifle port', await page.evaluate((id) => window.__dev.loadCartridge(id), cart.id));

  // ---- a tap at one skid bolt
  const before = await bolts();
  check('the bank has four skid bolts, all gunmetal', before.length === 4 && before.every((b) => b.material === 'gunmetal'), JSON.stringify(before.map((b) => b.material)));
  const hit = await aimAtSkidBolt();
  check('the beam can aim at a skid bolt', !!hit, hit ? hit.path : 'none');
  await page.screenshot({ path: path.join(shotsDir, 'aimed-bolt.png') });
  const n1 = await page.evaluate(() => window.__dev.applyPart(false));
  await frames(5);
  const afterTap = await bolts();
  const changed = afterTap.filter((b) => b.material === 'green');
  check('a tap changes exactly the bolt it hits', n1 === 1 && changed.length === 1 && changed[0].path === hit.path, JSON.stringify(changed.map((b) => b.path)));
  check('the changed bolt carries the cartridge: fat head, chamfer', changed[0]?.params?.headWidth === 0.12 && changed[0]?.ops?.[0] === 'chamfer-hard-edges', JSON.stringify(changed[0]));
  await page.screenshot({ path: path.join(shotsDir, 'one-green-bolt.png') });

  // ---- the change survives a reload
  await boot();
  const saved = await page.evaluate(() => window.__dev.kitOverrides());
  const reloaded = await bolts();
  check('after a reload the green bolt is still green, the others are not', reloaded.filter((b) => b.material === 'green').map((b) => b.path).join() === hit.path,
    JSON.stringify(Object.keys(saved['capacitor-bank'] ?? {})));

  // ---- a hold changes every bolt of that kind on the bank
  const portAfter = await page.evaluate(() => window.__dev.port());
  check('the part cartridge is still in the rifle port after a reload', portAfter?.part?.gen === 'bolt' && portAfter.part.slotMaterials.metal === 'green', JSON.stringify(portAfter));
  const hit2 = await aimAtSkidBolt();
  const n2 = await page.evaluate(() => window.__dev.applyPart(true));
  await frames(5);
  const all = await bolts();
  check('a hold changes every bolt on the bank', !!hit2 && n2 === 4 && all.every((b) => b.material === 'green'), `${n2} changed; ${JSON.stringify(all.map((b) => b.material))}`);
  await page.screenshot({ path: path.join(shotsDir, 'all-green-bolts.png') });

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} part cartridge checks pass`);
process.exit(failed ? 1 : 0);
