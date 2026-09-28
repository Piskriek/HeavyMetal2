import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDir = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395';

function getExecutablePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ];
  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return undefined;
}

async function run() {
  const executablePath = getExecutablePath();
  console.log('Using browser executable:', executablePath || 'bundled chromium');

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Navigate through Menu into the Race
  console.log('Navigating through Menu into Race...');
  await page.getByRole('button', { name: /New Game/i }).click();
  await page.waitForTimeout(400);

  if (await page.getByRole('radio', { name: /Tournament/i }).count()) {
    await page.getByRole('radio', { name: /Tournament/i }).click();
  }
  await page.waitForTimeout(300);

  const chooseBtn = page.getByRole('button', { name: /Choose Your Crew/i });
  if (await chooseBtn.count()) await chooseBtn.click();
  await page.waitForTimeout(300);

  const setBtn = page.getByRole('button', { name: /Set the Race/i });
  if (await setBtn.count()) await setBtn.click();
  await page.waitForTimeout(300);

  const enterBtn = page.getByRole('button', { name: /Enter the Cup/i });
  if (await enterBtn.count()) await enterBtn.click();

  console.log('Waiting for game stage to mount...');
  await page.waitForSelector('.game-stage', { timeout: 20000 });

  // Dismiss loading screen when ready
  console.log('Waiting for Race Loading Screen enter button...');
  const enterGridBtn = page.locator('.race-loading-enter');
  await enterGridBtn.waitFor({ state: 'visible', timeout: 20000 });
  await enterGridBtn.click();
  await page.waitForTimeout(500);

  await page.waitForFunction(() => !!window.__gameEngine && !document.querySelector('.race-loading-screen'), null, { timeout: 15000 });
  console.log('Game stage loaded and on grid! Capturing ready screenshot...');
  await page.screenshot({ path: join(outputDir, 'preview_ready_t0s.png') });

  // 1. Start / Launch the race
  console.log('Launching the race in default third-person camera...');
  await page.evaluate(() => {
    if (window.__gameEngine) {
      window.__gameEngine.launch();
    }
  });

  // Take screenshots every 5 seconds for 30 seconds
  for (let sec = 5; sec <= 30; sec += 5) {
    await page.waitForTimeout(5000);
    console.log(`Capturing run screenshot at ~${sec}s...`);
    await page.screenshot({ path: join(outputDir, `run_t${sec}s.png`) });
  }

  // 2. Teleport to each of the 7 sections with 0.2s delay as requested
  const sections = [
    { id: 'alpine', name: 'Stage 1: Alpine Downhill', x: 2000 },
    { id: 'lip', name: 'Stage 2: Canyon Lip (90° Swing)', x: 24000 },
    { id: 'waterfall', name: 'Stage 3: Waterfall Drop', x: 28000 },
    { id: 'cavern', name: 'Stage 4: Cavern Maw', x: 48000 },
    { id: 'mine', name: 'Stage 5: Mine Coaster & Lava', x: 54000 },
    { id: 'breakthrough', name: 'Stage 6: Breakthrough', x: 68400 },
    { id: 'stadium', name: 'Stage 7: Stadium Finish', x: 70500 },
  ];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    console.log(`Teleporting to ${sec.name} at x=${sec.x}...`);
    await page.evaluate((x) => {
      if (window.__gameDebug) {
        window.__gameDebug.teleport(x);
      }
    }, sec.x);

    // User specifically asked for 0.2s delay so we get the full picture in the moment
    await page.waitForTimeout(200);
    const filename = `preview_stage_${i + 1}_${sec.id}.png`;
    await page.screenshot({ path: join(outputDir, filename) });
    console.log(`Saved ${filename}`);
  }

  // 3. Test Map Building Debug Mode
  console.log('Entering Map Building Debug Mode...');
  await page.evaluate(() => {
    if (window.__gameDebug) {
      window.__gameDebug.toggleBuildMode();
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outputDir, 'preview_map_builder_active.png') });
  console.log('Saved preview_map_builder_active.png');

  // Focus on the selected obstacle to show 3D Manipulation Gizmo and Inspector
  console.log('Focusing on selected obstacle to display 3D Manipulation Gizmo...');
  await page.evaluate(() => {
    if (window.__gameDebug) {
      window.__gameDebug.focusSelected();
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outputDir, 'preview_map_builder_gizmo.png') });
  console.log('Saved preview_map_builder_gizmo.png');

  // Test Save Track
  console.log('Testing Save Track...');
  const saveResult = await page.evaluate(() => {
    if (window.__gameDebug) {
      window.__gameDebug.saveTrack();
      return {
        hasLocalStorage: !!localStorage.getItem('hm2_custom_track'),
        hasGlobalTrack: !!window.__customTrack,
        trackCount: window.__customTrack ? window.__customTrack.length : 0,
      };
    }
    return null;
  });
  console.log('Save Track Result:', saveResult);

  await browser.close();
  console.log('Preview run completed successfully!');
}

run().catch((err) => {
  console.error('Error running preview script:', err);
  process.exit(1);
});
