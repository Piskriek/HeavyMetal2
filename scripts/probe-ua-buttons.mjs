// Probe (Opus, after F-20's POL-175 scoped studio.css's global button rule): lists visible buttons that fall back to
// the browser's default look (13.33 px UA font, outset border or ButtonFace grey) on the title screen, its Settings
// window, and the play screen with its Esc menu and build radial.
//   npm run build && node scripts/probe-ua-buttons.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8231;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
let bad = 0;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stubbed')); }; });
  const report = async (where) => {
    const r = await page.evaluate(() => {
      const ua = [];
      let n = 0;
      for (const b of document.querySelectorAll('button')) {
        const rect = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        if (rect.width < 2 || rect.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        n++;
        const why = [];
        if (cs.fontSize === '13.3333px') why.push('UA font size');
        if (cs.borderTopStyle === 'outset') why.push('outset border');
        if (['rgb(239, 239, 239)', 'rgb(240, 240, 240)', 'rgb(233, 233, 237)'].includes(cs.backgroundColor)) why.push('ButtonFace');
        if (why.length) ua.push(`${b.className || '(no class)'} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24)}": ${why.join(', ')}`);
      }
      return { n, ua };
    });
    bad += r.ua.length;
    console.log(`${r.ua.length ? 'FAIL' : 'OK  '}: ${where}: ${r.n} visible buttons, ${r.ua.length} with the browser default look`);
    for (const l of r.ua.slice(0, 12)) console.log(`        ${l}`);
  };
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('.sm-home', { timeout: 30000 });
  await report('title screen');
  await page.locator('.sm-menu button', { hasText: 'Diagnostics & Settings' }).first().click();
  await page.waitForTimeout(800);
  await report('Settings window');

  await page.goto(`http://127.0.0.1:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => { window.hmPlay?.teleportPlanet?.(); window.hmPlay?.setPaused?.(false); window.hmPlay?.setLocked?.(true); });
  await page.waitForTimeout(2500);
  await report('play screen (HUD)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await report('play screen, Esc menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.mouse.move(4, 4);
  await page.keyboard.down('x');
  await page.waitForTimeout(600);
  await report('play screen, build radial');
  await page.keyboard.up('x');
} finally {
  await browser.close();
  server.kill();
}
console.log(bad ? `RESULT: ${bad} buttons with the browser default look` : 'RESULT: none');
process.exit(bad ? 1 : 0);
