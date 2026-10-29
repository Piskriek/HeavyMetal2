import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(fs.existsSync);

if (!chromePath) {
  console.error('Chrome executable not found');
  process.exit(1);
}

const outDir = 'C:/Users/Pierro/.gemini/antigravity/brain/ee547afe-9da1-4250-84f6-13bed1b204a4';
const outPath = path.join(outDir, 'live-play-verified.jpg');

console.log('Launching browser to capture live play screenshot...');
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--enable-webgl']
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.resolve();
    };
  });

  console.log('Navigating to http://localhost:5173/?e2e ...');
  await page.goto('http://localhost:5173/?e2e', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for the home menu
  await page.waitForSelector('.sm-menu button', { timeout: 15000 });
  console.log('Home menu loaded. Clicking Expedition / Play...');

  const playBtn = page.locator('.sm-menu button', { hasText: /Expedition|Play/i }).first();
  await playBtn.click();

  // Wait for play to be ready or scene rendered
  console.log('Waiting for Play scene to initialize...');
  try {
    await page.waitForFunction(() => window.hmPlay?.ready === true, { timeout: 25000 });
  } catch (e) {
    console.log('hmPlay.ready wait timed out, continuing to allow frame settle...');
  }

  // Allow 4 seconds for full world rendering, foliage scatter and lighting
  await page.waitForTimeout(4000);

  // Inspect DOM state
  const report = await page.evaluate(() => {
    const goalTitle = document.querySelector('.play-goal h2')?.textContent?.trim() ?? '';
    const goalHint = document.querySelector('.play-goal p')?.textContent?.trim() ?? '';
    const hasA401 = document.body.innerText.includes('armory rack') || document.body.innerText.includes('Take the extraction rifle');
    const computedRoot = window.getComputedStyle(document.documentElement);
    const uiAccent = computedRoot.getPropertyValue('--ui-accent').trim();
    const uiBg = computedRoot.getPropertyValue('--ui-bg').trim();
    const hotbarSlot = document.querySelector('.hm-hotbar-slot');
    const hotbarBorder = hotbarSlot ? window.getComputedStyle(hotbarSlot).borderColor : 'none';

    return {
      goalTitle,
      goalHint,
      hasA401,
      uiAccent,
      uiBg,
      hotbarBorder,
      bodyTextSnippet: document.body.innerText.slice(0, 300)
    };
  });

  console.log('In-Play Inspection Report:', JSON.stringify(report, null, 2));

  // Capture verified screenshot
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
  console.log(`Saved verified screenshot to ${outPath}`);

} finally {
  await browser.close().catch(() => {});
}

