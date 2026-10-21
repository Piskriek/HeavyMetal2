/**
 * Plan 39 section 6 (Lx): the light loop. In the lab, the bench's Lights page shows a live lamp lighting a floor, the
 * presets as glowing balls and a hover try-on; it prints Hazard strobe onto a blank (a blank and the bench's time); the
 * cartridge loads into the rifle. Fired at the capacitor bank, a tap sets one charge lamp, a hold every lamp on the bank,
 * a bolt refuses it (like for like), and the lamps keep their light over a reload.
 *   npm run build && node --import tsx scripts/test-light-cartridge.mjs
 * Shots in shots-run/lights/ (gitignored). Exit code 1 when a check fails.
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
const shotsDir = path.join(root, 'shots-run/lights');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8203;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('light-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('light-test-booted', '1');
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
const lamps = () => page.evaluate(() => window.__dev.kitPlaced('capacitor-bank').filter((p) => p.path.endsWith('/lamp')).map((p) => ({ path: p.path, material: p.material })));

/** Stands in front of the bank's nearest lamp and points the camera straight at it (the lamps are 5 cm across). */
const aimAtLamp = () => page.evaluate(async () => {
  const room = window.__playScene.room;
  let mesh = null;
  room.group.traverse((o) => { if (o.isMesh && /^kit:(lamp|lx:)/.test(o.name)) mesh = mesh ?? o; });
  if (!mesh) return null;
  mesh.updateMatrixWorld(true);
  const e = mesh.matrixWorld.elements;
  const pos = mesh.geometry.getAttribute('position'), pid = mesh.geometry.getAttribute('partId');
  const sums = new Map();
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(pid.getX(i)) ?? [0, 0, 0, 0];
    s[0] += pos.getX(i); s[1] += pos.getY(i); s[2] += pos.getZ(i); s[3]++;
    sums.set(pid.getX(i), s);
  }
  const world = [...sums.values()].map(([x, y, z, n]) => {
    const lx = x / n, ly = y / n, lz = z / n;
    return [e[0] * lx + e[4] * ly + e[8] * lz + e[12], e[1] * lx + e[5] * ly + e[9] * lz + e[13], e[2] * lx + e[6] * ly + e[10] * lz + e[14]];
  });
  // the lamps face the bank's local -z, toward the room
  const nx = -e[8], nz = -e[10], nl = Math.hypot(nx, nz);
  const t = world.sort((a, b) => (b[0] * nx + b[2] * nz) - (a[0] * nx + a[2] * nz))[0];
  const sx = t[0] + (nx / nl) * 1.3, sz = t[2] + (nz / nl) * 1.3;
  const frame2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__playScene.debug.teleport('lab', sx, sz, Math.atan2(-(t[0] - sx), -(t[2] - sz)), 0);
  await frame2();
  const eye = window.__playScene.debug.camera().position;
  const dx = t[0] - eye.x, dy = t[1] - eye.y, dz = t[2] - eye.z;
  window.__playScene.debug.teleport('lab', sx, sz, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  await frame2();
  return window.__dev.aimKitPart();
});

try {
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });

  // ---- the bench's Lights page
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator('[data-testid="bench-tab-lights"]').click();
  await page.waitForSelector('[data-testid="bench-lights"]');
  check('the Lights page shows a live lamp, with its temperature', await page.locator('[data-testid="light-preview"] canvas').isVisible()
    && /2000 K/.test((await page.locator('.light-preview figcaption').textContent()) ?? ''));
  await page.locator('[data-testid="bench-light-cold-lab"]').hover();
  const trying = await page.locator('[data-testid="light-preview-trying"]').textContent().catch(() => '');
  check('hovering a named light tries it on in the preview', /cold lab/i.test(trying ?? ''), trying ?? '');
  await page.locator('[data-testid="bench-light-mode-signal"]').click();
  check('the signal colour is its own mode: the Kelvin slider gives way to the signal colours',
    (await page.locator('[data-testid="bench-light-kelvin"]').count()) === 0 && (await page.locator('[data-testid^="bench-light-signal-"]').count()) === 8);
  await page.locator('[data-testid="bench-light-hazard-strobe"]').click();
  await page.screenshot({ path: path.join(shotsDir, 'lights-page.png') });
  await page.locator('[data-testid="bench-print-light"]').click();
  await page.evaluate(() => window.__dev.stepLab(25));
  const cart = await page.evaluate(() => window.hmPlay.state().lab.cartridges.find((c) => c.kind === 'light') ?? null);
  check('the bench prints a light cartridge: Hazard strobe, amber, blinking', !!cart && cart.light.colour === '#ffb02a' && cart.light.pattern === 'blink' && cart.name === 'Hazard strobe',
    cart ? JSON.stringify(cart.light) : 'none');
  await page.evaluate(() => window.hmPlay.openLabPanel(null));
  check('the light cartridge loads into the rifle port', await page.evaluate((id) => window.__dev.loadCartridge(id), cart?.id) && (await page.evaluate(() => window.__dev.port()?.light?.pattern)) === 'blink');

  // ---- a tap sets one lamp
  const before = await lamps();
  check('the capacitor bank carries six charge lamps', before.length === 6 && before.every((l) => l.material === 'lamp'), JSON.stringify(before.map((l) => l.material)));
  const hit = await aimAtLamp();
  check('the beam can aim at a charge lamp', !!hit && hit.path.endsWith('/lamp'), hit ? hit.path : 'none');
  const tapped = hit ? await page.evaluate(() => window.__dev.applyLight(false)) : 0;
  await frames(5);
  const afterTap = (await lamps()).filter((l) => l.material.startsWith('lx:'));
  check('a tap sets exactly that lamp to the strobe', tapped === 1 && afterTap.length === 1 && afterTap[0].path === hit?.path && afterTap[0].material === 'lx:4000:2.00:blink:ffb02a',
    JSON.stringify(afterTap));
  await page.screenshot({ path: path.join(shotsDir, 'one-lamp.png') });

  // ---- like for like: a bolt refuses it
  const boltRefused = await page.evaluate(async () => {
    for (const [x, z] of [[-6.2, 1.9], [-6.2, 0.1]]) {
      for (let p = 0; p < 4; p++) for (let y = 0; y < 16; y++) {
        window.__playScene.debug.teleport('lab', x, z, (y / 16) * Math.PI * 2, -0.5 - p * 0.2);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const h = window.__dev.aimKitPart();
        if (h && h.path.startsWith('bolts-')) return { path: h.path, n: window.__dev.applyLight(false) };
      }
    }
    return null;
  });
  check('a light fired at a bolt is refused (like for like)', !!boltRefused && boltRefused.n === 0, JSON.stringify(boltRefused));

  // ---- a hold sets every lamp on the bank, and a reload keeps them
  await aimAtLamp();
  const held = await page.evaluate(() => window.__dev.applyLight(true));
  await frames(5);
  check('a hold sets all six lamps', held === 6 && (await lamps()).every((l) => l.material === 'lx:4000:2.00:blink:ffb02a'), `${held}`);
  await boot();
  check('after a reload the six lamps keep the strobe', (await lamps()).every((l) => l.material === 'lx:4000:2.00:blink:ffb02a'), JSON.stringify((await lamps()).map((l) => l.material)));

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} light cartridge checks pass`);
process.exit(failed ? 1 : 0);
