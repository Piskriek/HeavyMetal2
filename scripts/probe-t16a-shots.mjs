// Probe (Opus, reviewing F-23 / TICKET-16 part a): the title screen on a fresh save (menu hero, Dr. Haddy's CRT
// portrait, and no Ending Credits item until the finale), the same screen with endingSeen set, and the play HUD's portrait.
//   npm run build && node scripts/probe-t16a-shots.mjs     shots in shots-run/t16a/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'shots-run/t16a');
fs.mkdirSync(out, { recursive: true });
const port = 8232;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stubbed')); }; });
  const menuLabels = () => page.evaluate(() => [...document.querySelectorAll('.sm-menu button')].map((b) => (b.textContent || '').trim().slice(0, 40)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('hm-store'); });
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const fresh = await menuLabels();
  console.log('fresh save menu:', JSON.stringify(fresh));
  console.log(fresh.some((l) => /Ending Credits/.test(l)) ? 'FAIL: Ending Credits shows on a fresh save' : 'OK  : no Ending Credits on a fresh save');
  if (fresh.some((l) => /Ending Credits/.test(l))) errors.push('Ending Credits shows on a fresh save');

  // Bounding-box check helper for title screen
  const checkTitleOverlap = async () => page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const portrait = r('.hud-haddy-crt-portrait, [class*="haddy"], [class*="crt-portrait"]');
    const logo = r('.sm-brand, .fidelity-brand');
    const menu = r('.sm-menu, .fidelity-menu');
    if (!portrait) return { ok: false, error: 'portrait not found' };
    if (!logo) return { ok: false, error: 'logo not found' };
    if (!menu) return { ok: false, error: 'menu not found' };
    const hitLogo = !(portrait.right <= logo.left || logo.right <= portrait.left || portrait.bottom <= logo.top || logo.bottom <= portrait.top);
    const hitMenu = !(portrait.right <= menu.left || menu.right <= portrait.left || portrait.bottom <= menu.top || menu.bottom <= portrait.top);
    return {
      ok: !hitLogo && !hitMenu,
      hitLogo,
      hitMenu,
      portrait: { left: Math.round(portrait.left), right: Math.round(portrait.right), top: Math.round(portrait.top), bottom: Math.round(portrait.bottom) },
      logo: { left: Math.round(logo.left), right: Math.round(logo.right), top: Math.round(logo.top), bottom: Math.round(logo.bottom) },
      menu: { left: Math.round(menu.left), right: Math.round(menu.right), top: Math.round(menu.top), bottom: Math.round(menu.bottom) },
    };
  });

  const overlap720 = await checkTitleOverlap();
  console.log('title portrait bounding box (1280x720):', JSON.stringify(overlap720));
  if (!overlap720.ok) {
    console.log(`FAIL: title portrait overlaps ${overlap720.hitLogo ? 'logo ' : ''}${overlap720.hitMenu ? 'menu ' : ''}at 1280x720`);
    errors.push('title portrait overlap at 1280x720');
  } else {
    console.log('OK  : title portrait overlaps neither logo nor menu at 1280x720');
  }
  await page.screenshot({ path: path.join(out, 'title-fresh.png') });

  // 1920x1080 check
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  const overlap1080 = await checkTitleOverlap();
  console.log('title portrait bounding box (1920x1080):', JSON.stringify(overlap1080));
  if (!overlap1080.ok) {
    console.log(`FAIL: title portrait overlaps ${overlap1080.hitLogo ? 'logo ' : ''}${overlap1080.hitMenu ? 'menu ' : ''}at 1920x1080`);
    errors.push('title portrait overlap at 1920x1080');
  } else {
    console.log('OK  : title portrait overlaps neither logo nor menu at 1920x1080');
  }
  await page.screenshot({ path: path.join(out, 'title-1080p.png') });

  // restore 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);

  // Check endingSeen unlock
  await page.evaluate(() => {
    localStorage.setItem('hm.endingSeen', '1');
  });
  await page.reload();
  await page.waitForSelector('.sm-home', { timeout: 30000 });
  await page.waitForTimeout(1000);
  const unlocked = await menuLabels();
  const hasCredits = unlocked.some((l) => /Ending Credits/.test(l));
  console.log(hasCredits ? 'OK  : Ending Credits appears after endingSeen' : 'FAIL: Ending Credits missing after endingSeen');
  if (!hasCredits) errors.push('Ending Credits missing after endingSeen');
  await page.screenshot({ path: path.join(out, 'title-credits-unlocked.png') });

  await page.goto(`http://127.0.0.1:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => { window.hmPlay?.teleportPlanet?.(); window.hmPlay?.setPaused?.(false); window.hmPlay?.setLocked?.(true); });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, 'play-hud-portrait.png') });
  const overlap = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const portrait = r('[class*="haddy"], [data-testid*="haddy"], [class*="crt-portrait"]');
    const stage = r('[data-testid="stage-panel"], [class*="stage-panel"], .hud-stage');
    if (!portrait || !stage) return { portrait: !!portrait, stage: !!stage };
    const hit = !(portrait.right <= stage.left || stage.right <= portrait.left || portrait.bottom <= stage.top || stage.bottom <= portrait.top);
    return { portrait: true, stage: true, overlap: hit };
  });
  console.log('portrait vs stage panel:', JSON.stringify(overlap));
  if (overlap.overlap) {
    console.log('FAIL: play HUD portrait overlaps stage panel');
    errors.push('play HUD portrait overlaps stage panel');
  } else {
    console.log('OK  : play HUD portrait clear of stage panel');
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 4))}` : 'page errors: 0');
process.exit(errors.length === 0 ? 0 : 1);
