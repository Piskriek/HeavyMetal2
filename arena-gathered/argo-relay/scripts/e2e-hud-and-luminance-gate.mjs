// ============================================================================
// File: scripts/e2e-hud-and-luminance-gate.mjs
// Brief: TASK-24 & P0-PROD-01 (Automated HUD Overlap & Avatar Luminance Gate)
// ============================================================================

import assert from 'node:assert/strict';

/**
 * Evaluates inside a Playwright/Puppeteer page to assert zero overlap between visible [data-hud-zone] boxes.
 * @param {import('playwright').Page} page
 * @param {string} stepName
 */
export async function assertZeroHudZoneOverlap(page, stepName) {
  const overlaps = await page.evaluate(() => {
    const zones = Array.from(document.querySelectorAll('[data-hud-zone]')).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0.05 &&
        rect.width > 2 &&
        rect.height > 2
      );
    });

    const collisions = [];
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const a = zones[i].getBoundingClientRect();
        const b = zones[j].getBoundingClientRect();
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = xOverlap * yOverlap;
        if (area > 4) {
          collisions.push({
            zoneA: zones[i].getAttribute('data-hud-zone'),
            zoneB: zones[j].getAttribute('data-hud-zone'),
            areaPx2: Math.round(area),
          });
        }
      }
    }
    return collisions;
  });

  assert.equal(
    overlaps.length,
    0,
    `[HUD OVERLAP GATE FAILED at ${stepName}] Overlapping HUD zones detected: ${JSON.stringify(overlaps)}`
  );
}

/**
 * Samples the center WebGL canvas patch (where the third-person avatar/rifle or subject sits)
 * and asserts that mean RGB luminance is above minLuma0to255 (default 35/255), catching black-bake bugs.
 * @param {import('playwright').Page} page
 * @param {string} stepName
 * @param {number} minLuma0to255
 */
export async function assertCenterCanvasLuminance(page, stepName, minLuma0to255 = 35) {
  const meanLuma = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 255;
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 64;
    const ctx = off.getContext('2d');
    if (!ctx) return 255;
    // Sample central 30% of the viewport where the avatar/viewmodel is framed
    const sx = Math.floor(canvas.width * 0.35);
    const sy = Math.floor(canvas.height * 0.35);
    const sw = Math.floor(canvas.width * 0.30);
    const sh = Math.floor(canvas.height * 0.30);
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / pixelCount;
  });

  assert.ok(
    meanLuma >= minLuma0to255,
    `[LUMINANCE GATE FAILED at ${stepName}] Mean center luminance ${meanLuma.toFixed(1)} < ${minLuma0to255} (near-black silhouette regression)`
  );
}
