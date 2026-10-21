/**
 * Plan 41: the bench's Materials page (Machines shelf) and the material cartridge. The page shows a live test piece and
 * the shelf as thumbnails; hovering a material tries it on; paint, a new layer and the age make the material the
 * player's own (a code); the mask view shows where a layer lands; Save keeps it under Yours; the bench prints it; the
 * rifle loads it; a tap dresses one part of the capacitor bank (its skid), a hold every part that wore the same; the
 * dressed part draws with the layered material, and a reload keeps it.
 *   npm run build && node --import tsx scripts/test-material-cartridge.mjs
 * Shots in shots-run/materials/ (gitignored). Exit code 1 when a check fails.
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
const shotsDir = path.join(root, 'shots-run/materials');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8206;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('material-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('material-test-booted', '1');
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
  await page.goto(`http://localhost:${port}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
  await page.waitForFunction(() => window.__dev.kitPlaced('capacitor-bank').length > 0, { timeout: 30000 });
};
const skid = () => page.evaluate(() => window.__dev.kitPlaced('capacitor-bank').find((p) => p.path === 'skid')?.material ?? null);

/** Walks round the capacitor bank (its front, then both ends) looking down at the skid until the beam names it. */
const aimAtSkid = () => page.evaluate(async () => {
  const room = window.__playScene.room;
  let mesh = null;
  room.group.traverse((o) => { if (o.isMesh && /^kit:/.test(o.name)) mesh = mesh ?? o; });
  if (!mesh) return null;
  const bank = mesh.parent;
  bank.updateMatrixWorld(true);
  const e = bank.matrixWorld.elements;
  const ox = e[12], oz = e[14];
  const frame2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // the bank's front is its local -z, toward the room; its ends are local +x and -x
  for (const [ax, az] of [[-e[8], -e[10]], [e[0], e[2]], [-e[0], -e[2]]]) {
    const l = Math.hypot(ax, az);
    for (const dist of [1.6, 2.0, 2.4]) {
      const sx = ox + (ax / l) * dist, sz = oz + (az / l) * dist;
      for (const pitch of [-0.7, -0.8, -0.6, -0.9, -0.5, -1.0]) {
        window.__playScene.debug.teleport('lab', sx, sz, Math.atan2(-(ox - sx), -(oz - sz)), pitch);
        await frame2();
        const hit = window.__dev.aimKitPart();
        if (hit && hit.path === 'skid') return hit;
      }
    }
  }
  return null;
});

try {
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });

  // ---- the page
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator('[data-testid="bench-tab-presets"]').click();
  check('the Materials page opens on the ground shelf, as before', await page.locator('.play-select-grid button').count() > 0);
  await page.locator('[data-testid="bench-shelf-machines"]').click();
  await page.waitForSelector('[data-testid="bench-materials"]');
  check('the Machines shelf shows a live test piece and the shelf of materials', await page.locator('[data-testid="material-preview"] canvas').isVisible()
    && (await page.locator('[data-testid^="bench-mat-"]').count()) === 16);
  const thumbs = await page.waitForFunction(() => document.querySelectorAll('.bench-materials .bench-parts-gens.tiles img').length >= 4, null, { timeout: 30000 }).then(() => true, () => false);
  check('the shelf fills with thumbnails of the test piece, without blocking', thumbs);
  await page.locator('[data-testid="bench-mat-moon-dusted"]').hover();
  const trying = await page.locator('[data-testid="material-preview-trying"]').textContent().catch(() => '');
  check('hovering a material tries it on in the preview', /moon/i.test(trying ?? ''), trying ?? '');

  // ---- make it the player's own
  await page.locator('[data-testid="bench-mat-rust-bucket"]').click();
  await page.locator('[data-testid="bench-paint1-3c9a5a"]').click();
  await page.locator('[data-testid="bench-add-moss"]').click();
  const layers = await page.locator('.bench-layer').count();
  check('a new layer goes on top of the stack and opens', layers === 6 && (await page.locator('.bench-layer.open').count()) === 1, `${layers} layers`);
  await page.locator('[data-testid="bench-show-where"]').check();
  await frames(5);
  const caption = await page.locator('.material-preview figcaption').textContent();
  check('the mask view shows where the open layer lands', /where the layer lands/i.test(caption ?? ''), caption ?? '');
  await page.screenshot({ path: path.join(shotsDir, 'mask-view.png') });
  await page.locator('[data-testid="bench-show-where"]').uncheck();
  await page.locator('[data-testid="bench-material-age"]').fill('0.9');
  const name = await page.locator('.bench-materials .bench-parts-cost b').textContent();
  check('a changed shelf material is the player\'s, named after it', name === 'Rust bucket, tuned', name ?? '');
  await page.screenshot({ path: path.join(shotsDir, 'machines-page.png') });

  // ---- save it
  await page.locator('[data-testid="bench-save-material"]').click();
  await frames(5);
  const mine = await page.evaluate(() => window.__dev.myPresets().list.map((q) => ({ id: q.id, kind: q.kind, ref: q.print.material?.ref ?? '' })));
  check('Save as preset keeps it as a code (matc:), not a shelf id', mine.length === 1 && mine[0].kind === 'material' && mine[0].ref.startsWith('matc:'),
    JSON.stringify(mine.map((m) => ({ ...m, ref: m.ref.slice(0, 12) }))));
  check('it shows under Yours', await page.locator(`[data-testid="bench-mine-${mine[0]?.id}"]`).isVisible().catch(() => false));

  // ---- print, load, apply
  await page.locator('[data-testid="bench-print-material"]').click();
  await page.evaluate(() => window.__dev.stepLab(25));
  const cart = await page.evaluate(() => window.hmPlay.state().lab.cartridges.find((c) => c.kind === 'material') ?? null);
  check('the bench prints a material cartridge carrying the code', !!cart && cart.name === 'Rust bucket, tuned' && cart.material.ref === mine[0]?.ref, cart ? cart.name : 'none');
  await page.evaluate(() => window.hmPlay.openLabPanel(null));
  check('the material cartridge loads into the rifle port', await page.evaluate((id) => window.__dev.loadCartridge(id), cart?.id)
    && (await page.evaluate(() => window.__dev.port()?.material?.name)) === 'Rust bucket, tuned');
  check('the skid wears dark steel to start with', (await skid()) === 'darkSteel', await skid());
  const hit = await aimAtSkid();
  check('the beam can aim at the bank\'s skid', !!hit, hit ? hit.path : 'none');
  const tapped = hit ? await page.evaluate(() => window.__dev.applyMaterial(false)) : 0;
  await frames(10);
  check('a tap dresses exactly the skid in the material', tapped === 1 && (await skid()) === mine[0]?.ref, `${tapped} part(s)`);
  const drawn = await page.evaluate(() => {
    let found = null;
    window.__playScene.room.group.traverse((o) => { if (o.isMesh && /^kit:matc:/.test(o.name)) found = found ?? { layered: !!o.material.userData.matstack, attrs: Object.keys(o.geometry.attributes).sort().join(',') }; });
    return found;
  });
  check('the dressed skid draws with the layered material', !!drawn && drawn.layered, drawn ? drawn.attrs : 'no mesh');
  await page.screenshot({ path: path.join(shotsDir, 'dressed-skid.png') });

  // ---- a reload keeps it
  await boot();
  check('after a reload the skid still wears it', (await skid()) === mine[0]?.ref);
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 500));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} material cartridge checks pass`);
process.exit(failed ? 1 : 0);
