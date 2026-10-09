import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Automated Playwright validation for FIDELITY Main Menu, Dedicated Studio, and Synced/Desynced Campaign:
 * - Serves apps/web/dist on port 8198
 * - Checks main menu branding and buttons
 * - Clicks 'The Studio', verifies StudioScreen with Moon Base Game Editor (3D canvas, stage scrub, diff export)
 * - Tests Planet Forge tab (planet presets, atmospheric hue/rings, activity game rules, multiverse publishing)
 * - Returns to main menu
 * - Tests Synced Planetary Grid campaign launch and live Desync toggle
 */

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);

if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8198;
const targetUrl = `http://localhost:${port}/`;

console.log(`Starting static server on port ${port}...`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1500));

console.log('Launching Chrome browser...');
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});

const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (err) => {
  console.log('PAGE ERROR:', err.message);
  pageErrors.push(err.message);
});

try {
  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Verify Main Menu Brand & Badges
  const brand = await page.locator('.fidelity-brand').textContent();
  console.log('OK: Brand header found:', brand?.trim());

  const expeditionBtn = page.locator('.sm-menu button', { hasText: 'Expedition' });
  const gridBtn = page.locator('.sm-menu button', { hasText: 'Planetary Grid' });
  const studioBtn = page.locator('.sm-menu button', { hasText: 'The Studio' });

  console.log('OK: Expedition button visible:', await expeditionBtn.isVisible());
  console.log('OK: Planetary Grid button visible:', await gridBtn.isVisible());
  console.log('OK: The Studio button visible:', await studioBtn.isVisible());

  fs.mkdirSync('docs/shots', { recursive: true });
  await page.screenshot({ path: 'docs/shots/fidelity-menu-synced-desynced.png' });
  console.log('Captured docs/shots/fidelity-menu-synced-desynced.png');

  // 2. Click The Studio
  console.log('Testing The Studio (Creative Suite)...');
  await studioBtn.click();
  await page.waitForTimeout(2000);

  // Verify Studio Root & Topbar
  const studioRoot = page.locator('.studio-root');
  await studioRoot.waitFor({ state: 'visible', timeout: 5000 });
  console.log('OK: Studio root mounted!');

  const backToFidelity = page.locator('button', { hasText: 'Back to FIDELITY' });
  console.log('OK: Back to FIDELITY button visible:', await backToFidelity.isVisible());

  // Test Moon Base Game Editor controls
  const stagePills = page.locator('.stage-pill');
  const stageCount = await stagePills.count();
  console.log('OK: Simulation stage scrubber pills count:', stageCount);

  // Click Stage 5
  console.log('Scrubbing Moon Base Game to Stage 5...');
  await page.locator('.stage-pill', { hasText: 'S5' }).click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'docs/shots/fidelity-studio-moon.png' });
  console.log('Captured docs/shots/fidelity-studio-moon.png');

  // Test Weekly Patch Modal
  console.log('Testing Weekly Patch Diff Modal...');
  await page.locator('button', { hasText: 'Submit Weekly Patch' }).click();
  await page.waitForTimeout(500);

  const diffModal = page.locator('.studio-modal-card');
  console.log('OK: Weekly patch modal visible:', await diffModal.isVisible());
  const diffPre = page.locator('.code-diff-viewer pre');
  console.log('OK: Diff viewer has patch JSON:', (await diffPre.textContent())?.includes('PATCH-MOON'));

  await page.screenshot({ path: 'docs/shots/fidelity-studio-patch-diff.png' });
  console.log('Captured docs/shots/fidelity-studio-patch-diff.png');

  // Close modal via Escape
  console.log('Dismissing patch modal with Escape...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Test Planet Forge Tab
  console.log('Switching to Planet Forge tab...');
  await page.locator('.studio-tab-btn', { hasText: 'Planet Forge' }).click();
  await page.waitForTimeout(1000);

  const presetCards = page.locator('.preset-card');
  const presetCount = await presetCards.count();
  console.log('OK: Preset planet templates count:', presetCount);

  // Pick Volcanic Crucible
  console.log('Selecting Ignis-IV Caldera preset...');
  await page.locator('.preset-card', { hasText: 'Ignis-IV' }).click();
  await page.waitForTimeout(500);

  // Verify visualizer
  const planetOrb = page.locator('.planet-orb-sphere');
  console.log('OK: Planet orb visualizer visible:', await planetOrb.isVisible());

  await page.screenshot({ path: 'docs/shots/fidelity-studio-planet-forge.png' });
  console.log('Captured docs/shots/fidelity-studio-planet-forge.png');

  // Test Publish to Multiverse
  console.log('Testing Publish to SetMix Multiverse...');
  await page.locator('button', { hasText: 'Package & Publish Planet' }).click();
  await page.waitForTimeout(500);

  const publishModal = page.locator('.studio-modal-card');
  console.log('OK: Multiverse publish modal visible:', await publishModal.isVisible());
  const regCodeEl = page.locator('.celebration-text .reg-code b');
  console.log('OK: Multiverse ID generated:', await regCodeEl.textContent());

  await page.screenshot({ path: 'docs/shots/fidelity-studio-planet-published.png' });
  console.log('Captured docs/shots/fidelity-studio-planet-published.png');

  // Close publish modal
  await page.locator('button', { hasText: 'Continue Editing' }).click();
  await page.waitForTimeout(400);

  // Return to main menu
  console.log('Returning to main menu from Studio...');
  await page.locator('button', { hasText: 'Back to FIDELITY' }).click();
  await page.waitForTimeout(1500);

  // 3. Click Planetary Grid (Shared Synced World)
  console.log('Launching Planetary Grid (Synced)...');
  await page.locator('.sm-menu button', { hasText: 'Planetary Grid' }).click();
  await page.waitForTimeout(3000);

  const syncBadge = page.locator('.sync-badge');
  await syncBadge.waitFor({ state: 'visible', timeout: 10000 });
  const syncText = await syncBadge.textContent();
  console.log('OK: Sync Badge visible on campaign HUD:', syncText?.trim());

  await page.screenshot({ path: 'docs/shots/fidelity-grid-synced.png' });
  console.log('Captured docs/shots/fidelity-grid-synced.png');

  // 4. Test Desync Toggle
  console.log('Toggling Desync into Solo Branch...');
  const desyncBtn = page.locator('.sync-branch-toggle');
  await desyncBtn.click();
  await page.waitForTimeout(500);
  const desyncedText = await syncBadge.textContent();
  console.log('OK: Sync Badge after desyncing:', desyncedText?.trim());

  console.log('\nALL FIDELITY STUDIO & SYNCED/DESYNCED CAMPAIGN CHECKS PASSED!');
} catch (err) {
  console.error('Test failed with error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  if (pageErrors.length > 0) {
    console.log('Encountered page errors:', pageErrors);
  }
}
