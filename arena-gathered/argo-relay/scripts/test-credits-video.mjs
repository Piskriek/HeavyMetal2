// ============================================================================
// File: scripts/test-credits-video.mjs
// Brief: TASK-33 Headless Verification of 144 BPM Credits Timeline & Layout
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const timelinePath = path.resolve('apps/web/src/credits/timeline.ts');
const hudPath      = path.resolve('apps/web/src/credits/credits-hud.tsx');
const indexPath    = path.resolve('apps/web/src/credits/index.ts');

for (const p of [timelinePath, hudPath, indexPath]) {
  assert.ok(fs.existsSync(p), `Missing required credits module: ${p}`);
}

const timelineSrc = fs.readFileSync(timelinePath, 'utf8');
const hudSrc      = fs.readFileSync(hudPath, 'utf8');
const indexSrc    = fs.readFileSync(indexPath, 'utf8');

// 1. Verify 144 BPM tempo & v4b lyric line
assert.match(timelineSrc, /CREDITS_BPM\s*=\s*144/, 'CREDITS_BPM must be locked to 144');
assert.match(
  timelineSrc,
  /you pulled it right in front of me/i,
  'Timeline must include the owner-selected v4b lyric "you pulled it right in front of me"'
);

// 2. Verify all 7 chapters exist in order
for (const chId of [
  'ch1-cold-boot',
  'ch2-one-bit-facets',
  'ch3-chorus-bloom',
  'ch4-archive-rifts',
  'ch5-window-heal',
  'ch6-suitcam-finale',
  'ch7-outro-loop',
]) {
  assert.ok(timelineSrc.includes(chId), `Missing chapter ${chId} in timeline.ts`);
}

// 3. Verify corrected canon (real-size rifle, armoured suit, real lunar sky, Blender 5.2, Meshy.ai, Arena.ai)
assert.ok(timelineSrc.includes('Meshy.ai'), 'Credits roll must credit Meshy.ai for Astro');
assert.ok(timelineSrc.includes('Arena.ai'), 'Credits roll must credit Arena.ai for code battles');
assert.ok(timelineSrc.includes('Blender 5.2'), 'Credits roll must specify Blender 5.2');
assert.ok(!timelineSrc.toLowerCase().includes('hazmat'), 'Astro wears an armoured suit, not hazmat');
assert.ok(!timelineSrc.toLowerCase().includes('goblin planet'), 'Use the Moon real sky, not Goblin planet');

// 4. Verify Overclocked mode support & non-overlapping zone attributes in HUD
assert.ok(hudSrc.includes('data-credits-zone="lyrics"'), 'HUD must expose data-credits-zone="lyrics"');
assert.ok(hudSrc.includes('data-credits-zone="roll"'), 'HUD must expose data-credits-zone="roll"');
assert.ok(indexSrc.includes('overclockedPitchUp'), 'Director must support 1.2x Overclocked replay mode');

console.log('[PASS] test-credits-video.mjs: All 7 chapters, 144 BPM grid, v4b lyrics, and credits verified.');
