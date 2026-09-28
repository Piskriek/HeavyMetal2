import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395';

const STAGES = [
  { name: 'stage1_alpine_downhill', x: 2000, desc: 'Stage 1: Alpine Downhill' },
  { name: 'stage2_canyon_lip_turn', x: 24000, desc: 'Stage 2: Canyon Lip 90° Turn & Rock Cutouts' },
  { name: 'stage3_waterfall_vertical_drop', x: 28000, desc: 'Stage 3: Waterfall Cliff Vertical Drop' },
  { name: 'stage4_cavern_maw_plunge', x: 48000, desc: 'Stage 4: Cavern Maw Plunge' },
  { name: 'stage5_mine_coaster_lava', x: 54000, desc: 'Stage 5: Subterranean Spaghetti Rails & Lava' },
  { name: 'stage6_stadium_breakthrough', x: 68400, desc: 'Stage 6: Waterfall Curtain Breakthrough' },
  { name: 'stage7_stadium_finish', x: 70500, desc: 'Stage 7: Stadium Victory Finish' },
];

async function run() {
  console.log('Launching browser to capture stage screenshots...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 855 },
  });

  const page = await context.newPage();
  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 15000 });
  console.log('Game canvas found. Waiting for engine initialization...');
  await page.waitForTimeout(2000);

  // Start race directly via window.__startRace
  console.log('Starting race via window.__startRace...');
  await page.evaluate(() => {
    if (typeof window.__startRace === 'function') {
      window.__startRace();
    }
  });

  // Wait for __gameDebug to be available on window
  await page.waitForFunction(() => typeof window.__gameDebug !== 'undefined', { timeout: 15000 });
  console.log('__gameDebug is now available!');

  // Wait 1 second for assets to decode, then press Enter to dismiss the loading screen
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  for (const stage of STAGES) {
    console.log(`Teleporting to ${stage.desc} (x = ${stage.x})...`);
    await page.evaluate((targetX) => {
      if (window.__gameDebug) {
        window.__gameDebug.teleport(targetX);
      } else if (window.__gameEngine) {
        window.__gameEngine.teleport(targetX);
      }
    }, stage.x);

    // Wait 400ms for camera and render to settle (t0)
    await page.waitForTimeout(400);
    const outPathT0 = path.join(ARTIFACT_DIR, `${stage.name}_t0.png`);
    await page.screenshot({ path: outPathT0 });
    console.log(`Saved screenshot: ${outPathT0}`);

    // Wait 200ms for active game time (t200ms)
    await page.waitForTimeout(200);
    const outPathT200 = path.join(ARTIFACT_DIR, `${stage.name}_t200ms.png`);
    await page.screenshot({ path: outPathT200 });
    console.log(`Saved screenshot: ${outPathT200}`);
  }

  await browser.close();
  console.log('All stage screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error capturing stages:', err);
  process.exit(1);
});
