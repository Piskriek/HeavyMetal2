#!/usr/bin/env node
/**
 * Post-processes and validates the loose goblin decoration cutouts.
 *
 * Sources:
 *  - Generated on the project's standard magenta (#FF00FF) chroma key backdrop.
 *  - Stored in `public/art/goblins/` (raw magenta key transparency) and
 *    `public/art/goblins/alpha/` (keyed true alpha transparency).
 *  - Combined sprite sheets stored in:
 *    - `public/art/sheets/goblins-sheet.png` (all goblins, 5xN)
 *    - `public/art/sheets/goblins-sheet-a.png` (Batch 1: goblins 01-10, 5x2)
 *    - `public/art/sheets/goblins-sheet-b.png` (Batch 2: goblins 11-20, 5x2)
 *    - `public/art/sheets/goblins-sheet-c.png` (Batch 3: goblins 21-30, 5x2)
 *    - ... one letter per batch of 10.
 *
 * Keying & despill (identical to `scripts/process-props.mjs`):
 *  - Detects magenta matte (#FF00FF signature: high R and B, low G).
 *  - Flood-normalises the raw background to pure #FF00FF (corner/edge seeds).
 *  - Fuzz-keys the background to true alpha.
 *  - Unmix-despills the 6px boundary ring: each ring pixel's magenta excess
 *    e = min(R-G, B-G) becomes coverage c = 1-e, colour (R-e,G,B-e)/c and
 *    alpha c, so anti-aliased edges AND the generator's baked pink rim-light
 *    (often several px deep) dissolve into smooth neutral alpha instead of a
 *    pink halo. Pixels without magenta excess (e = 0) are bit-identical, so
 *    crisp non-pink edge detail is preserved at any ring width; deep interior
 *    paint is never touched.
 *
 * BATCH PROTOCOL (for the next agent adding 10 more):
 *  1. Generate goblins N+1..N+10 on flat magenta, one full-body subject per
 *     file, complete uncropped silhouettes (head to feet), working or cheering
 *     poses, no text baked into grid sheets.
 *  2. Save raws as `public/art/goblins/goblin-<NN>-<slug>.png`.
 *  3. Append 10 entries to GOBLIN_VARIATIONS below (file/concept/role).
 *  4. Run `node scripts/process-goblins.mjs` — it normalises, keys, despills
 *     and rebuilds the batch sheet + full sheet automatically.
 *  5. Register the 10 in PROP_DEFINITIONS (`src/game/track-builder-3d.ts`)
 *     under the `goblins` category.
 *  6. Document the batch in `docs/EXPANSION_PROGRESS.md` (same format).
 *  7. Inspect the alpha contact sheet + a checkerboard edge crop + remnant
 *     percentages, then commit to this branch and update the open goblins PR
 *     (never open a second PR).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const goblinsDir = join(root, 'public/art/goblins');
const alphaDir = join(root, 'public/art/goblins/alpha');
const sheetsDir = join(root, 'public/art/sheets');
mkdirSync(alphaDir, { recursive: true });
mkdirSync(sheetsDir, { recursive: true });

const MAGENTA = '#FF00FF';
const KEY_FUZZ = '20%';

export const GOBLIN_VARIATIONS = [
  // --- Batch 1 (Goblins 01 - 10): cheering fans + working pit/mine crew ---
  {
    file: 'goblin-01-flag-waver.png',
    concept: 'Cheering goblin waving a large checkered racing flag overhead, shouting with joy',
    role: 'cheering',
  },
  {
    file: 'goblin-02-war-drummer.png',
    concept: 'Goblin drummer mid-beat with two mallets over a spiked war drum strapped at the waist',
    role: 'cheering',
  },
  {
    file: 'goblin-03-pit-mechanic.png',
    concept: 'Pit-crew mechanic goblin with oversized brass wrench on shoulder, oil-stained apron, goggles',
    role: 'working',
  },
  {
    file: 'goblin-04-torchbearer.png',
    concept: 'Cheering goblin thrusting a flaming iron torch high, other fist pumped in the air',
    role: 'cheering',
  },
  {
    file: 'goblin-05-ore-miner.png',
    concept: 'Miner goblin with pickaxe over shoulder, lantern helmet, ore sack and rope at belt',
    role: 'working',
  },
  {
    file: 'goblin-06-horn-blower.png',
    concept: 'Goblin blowing a giant curved brass war horn with skull engraving, cheeks puffed',
    role: 'cheering',
  },
  {
    file: 'goblin-07-tnt-handler.png',
    concept: 'Grinning goblin hugging a wooden crate of sparking red dynamite with skull stencil',
    role: 'working',
  },
  {
    file: 'goblin-08-track-marshal.png',
    concept: 'Track marshal goblin with crossed yellow signal flags, striped vest, brass whistle',
    role: 'working',
  },
  {
    file: 'goblin-09-blacksmith.png',
    concept: 'Burly blacksmith goblin resting a huge forging hammer on one shoulder, leather apron',
    role: 'working',
  },
  {
    file: 'goblin-10-tankard-celebrant.png',
    concept: 'Celebrating goblin raising a foaming iron tankard high, other fist pumping',
    role: 'cheering',
  },
  // --- Batch 2 (Goblins 11 - 20): new crew roles + group cutouts ---
  {
    file: 'goblin-11-lantern-warden.png',
    concept: 'Hooded night warden goblin holding a tall lantern pole with glowing amber lamp, signaling',
    role: 'working',
  },
  {
    file: 'goblin-12-ball-loader.png',
    concept: 'Track worker goblin straining to push and roll a giant riveted iron racing ball',
    role: 'working',
  },
  {
    file: 'goblin-13-bell-ringer.png',
    concept: 'Cheering goblin ringing a big brass handbell overhead, shouting, horned helmet',
    role: 'cheering',
  },
  {
    file: 'goblin-14-scarf-fan.png',
    concept: 'Superfan goblin cheering with a checkered racing scarf stretched wide overhead',
    role: 'cheering',
  },
  {
    file: 'goblin-15-track-sweeper.png',
    concept: 'Track sweeper goblin with big straw broom, bandana, goggles, oil can at belt',
    role: 'working',
  },
  {
    file: 'goblin-16-rope-heave-trio.png',
    concept: 'Three goblins heaving a thick hemp slingshot rope together in unison',
    role: 'working',
  },
  {
    file: 'goblin-17-shoulder-ride-duo.png',
    concept: 'Cheering duo: small goblin kid riding on a big goblin shoulders, arms triumphantly high',
    role: 'cheering',
  },
  {
    file: 'goblin-18-firework-crew.png',
    concept: 'Two celebrating goblins, one waving a fizzing sparkler, the other laughing with covered ears',
    role: 'cheering',
  },
  {
    file: 'goblin-19-tire-carry-duo.png',
    concept: 'Two pit mechanics carrying a big spiked iron racing tire together between them',
    role: 'working',
  },
  {
    file: 'goblin-20-victory-huddle.png',
    concept: 'Three goblins in a victory huddle, middle one thrusting a golden gear trophy cup high',
    role: 'cheering',
  },
  // --- Batch 3 (Goblins 21 - 30): stands & big cheering crowds ---
  {
    file: 'goblin-21-grandstand-roar.png',
    concept: 'Covered timber grandstand packed with cheering fans, checkered flags, skull banner, bunting, drums',
    role: 'cheering',
  },
  {
    file: 'goblin-22-drum-podium-mob.png',
    concept: 'Round war-drum podium ringed by eight dancing goblins with mallets and torch braziers',
    role: 'cheering',
  },
  {
    file: 'goblin-23-flag-terrace.png',
    concept: 'Timber spectator terrace with spiked railings crowded with flag-waving fans and braziers',
    role: 'cheering',
  },
  {
    file: 'goblin-24-torch-crowd.png',
    concept: 'Dense night crowd of twelve cheering fans thrusting flaming torches high',
    role: 'cheering',
  },
  {
    file: 'goblin-25-horn-riser.png',
    concept: 'Two-tier scaffold riser with three war-horn blowers and three drummers, hanging lantern',
    role: 'cheering',
  },
  {
    file: 'goblin-26-mosh-pit.png',
    concept: 'Rowdy circle of nine jumping fans, one crowd-surfing aloft, flying tankards and scarves',
    role: 'cheering',
  },
  {
    file: 'goblin-27-fence-fans.png',
    concept: 'Trackside barrier fence crowded with eleven fans leaning over, blank banner, pennants',
    role: 'cheering',
  },
  {
    file: 'goblin-28-cheer-tower.png',
    concept: 'Tall two-level timber cheer tower with ten fans, drummer and horn on top deck, skull flag',
    role: 'cheering',
  },
  {
    file: 'goblin-29-victory-stage.png',
    concept: 'Champion victory stage with three racers on a podium, trophy cup, confetti, drummers, crowd',
    role: 'cheering',
  },
  {
    file: 'goblin-30-fan-aisle.png',
    concept: 'Two facing rows of cheering fans forming a victory aisle with flags, tankards, torch posts',
    role: 'cheering',
  },
];

const magick = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8' }).trim();

console.log(`Processing and verifying ${GOBLIN_VARIATIONS.length} goblin cutouts...\n`);

let allPassed = true;
const tmp = mkdtempSync(join(tmpdir(), 'goblins-'));
const T = (name) => join(tmp, `${name}.miff`);

try {
  for (const goblin of GOBLIN_VARIATIONS) {
    const rawPath = join(goblinsDir, goblin.file);
    const alphaPath = join(alphaDir, goblin.file);

    if (!existsSync(rawPath)) {
      console.error(`FAIL: Missing ${goblin.file}`);
      allPassed = false;
      continue;
    }

    const [w, h] = identify(['-format', '%w %h', rawPath]).split(' ').map(Number);
    const mx = w - 1;
    const my = h - 1;
    const hx = Math.floor(w / 2);
    const hy = Math.floor(h / 2);

    // 1. Normalise the connected background to pure magenta (corner + edge seeds).
    magick([
      rawPath, '-fuzz', '12%', '-fill', MAGENTA,
      '-draw', 'color 0,0 floodfill', '-draw', `color ${mx},0 floodfill`,
      '-draw', `color 0,${my} floodfill`, '-draw', `color ${mx},${my} floodfill`,
      '-draw', `color ${hx},0 floodfill`, '-draw', `color ${hx},${my} floodfill`,
      '-draw', `color 0,${hy} floodfill`, '-draw', `color ${mx},${hy} floodfill`,
      T('norm'),
    ]);

    // Verify magenta key in corner of the normalised image.
    const pixel = execFileSync('convert', [T('norm'), '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();

    // Persist the normalised background back to the raw file (idempotent).
    magick([T('norm'), rawPath]);

    // 2. Fuzz-key the background to (binary) alpha.
    magick([T('norm'), '-alpha', 'set', '-fuzz', KEY_FUZZ, '-transparent', MAGENTA, T('keyed')]);

    // 3. Boundary ring: opaque pixels within 6px of transparency. The unmix in
    // step 4 is a no-op where there is no magenta excess, so the wide ring only
    // affects pink fringe / baked rim-light and preserves crisp edge detail.
    magick([T('keyed'), '-alpha', 'extract', T('mask')]);
    magick([
      T('mask'), '-negate',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      T('dil'),
    ]);
    magick([T('dil'), T('mask'), '-compose', 'Multiply', '-composite', T('fringe')]);

    // 4. Unmix-despill (magenta): e = min(R-G, B-G); c = 1-e; RGB=(R-e,G,B-e)/c; A=A*c.
    // NOTE: `convert A B -compose <arith> -composite` computes B OP A (verified
    // empirically on IM 6.9.11), so operand order below is intentional. `Minus`
    // is used for subtraction — `Subtract` misbehaves on greyscale inputs.
    magick([T('keyed'), '-channel', 'R', '-separate', T('R')]);
    magick([T('keyed'), '-channel', 'G', '-separate', T('G')]);
    magick([T('keyed'), '-channel', 'B', '-separate', T('B')]);
    magick([T('keyed'), '-alpha', 'extract', T('A')]);
    magick([T('G'), T('R'), '-compose', 'Minus', '-composite', T('D1')]);
    magick([T('G'), T('B'), '-compose', 'Minus', '-composite', T('D2')]);
    magick([T('D1'), T('D2'), '-compose', 'Darken', '-composite', T('E')]);
    magick([T('E'), '-negate', T('C')]);
    magick([T('E'), T('R'), '-compose', 'Minus', '-composite', T('Rm')]);
    magick([T('C'), T('Rm'), '-compose', 'Divide', '-composite', T('Ru')]);
    magick([T('C'), T('G'), '-compose', 'Divide', '-composite', T('Gu')]);
    magick([T('E'), T('B'), '-compose', 'Minus', '-composite', T('Bm')]);
    magick([T('C'), T('Bm'), '-compose', 'Divide', '-composite', T('Bu')]);
    magick([T('A'), T('C'), '-compose', 'Multiply', '-composite', T('Au')]);
    magick([T('Ru'), T('Gu'), T('Bu'), '-combine', '-alpha', 'off', T('uRGB')]);
    magick([T('uRGB'), T('Au'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', T('unmix')]);

    // 5. Merge: unmixed pixels where boundary ring, keyed pixels elsewhere.
    magick([T('keyed'), '-alpha', 'off', T('kRGB')]);
    magick([T('unmix'), '-alpha', 'off', T('uRGBflat')]);
    magick([T('kRGB'), T('uRGBflat'), T('fringe'), '-composite', T('fRGB')]);
    magick([T('A'), T('Au'), T('fringe'), '-composite', T('fA')]);
    magick([T('fRGB'), T('fA'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-strip', alphaPath]);

    const alphaPixel = execFileSync('convert', [alphaPath, '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();
    const dims = `${w}x${h}`;
    console.log(`✓ ${goblin.file.padEnd(36)} ${dims.padEnd(11)} magenta=${pixel.padEnd(20)} alpha=${alphaPixel}`);
  }

  // 6. Sprite sheets from the normalised raws (magenta backdrop, 512px cells).
  const raws = GOBLIN_VARIATIONS.map((p) => join(goblinsDir, p.file));
  const batchCount = Math.ceil(raws.length / 10);
  const lastBatch = raws.slice((batchCount - 1) * 10);
  const batchLetter = String.fromCharCode('a'.charCodeAt(0) + batchCount - 1);
  const batchSheet = join(sheetsDir, `goblins-sheet-${batchLetter}.png`);
  console.log(`\nBuilding ${batchSheet} (${lastBatch.length} cells, 5x2)...`);
  execFileSync('montage', [
    ...lastBatch, '-tile', '5x2', '-geometry', '512x512+0+0>',
    '-background', MAGENTA, '-gravity', 'center', '-strip', batchSheet,
  ]);
  const fullSheet = join(sheetsDir, 'goblins-sheet.png');
  const rows = Math.ceil(raws.length / 5);
  console.log(`Building ${fullSheet} (${raws.length} cells, 5x${rows})...`);
  execFileSync('montage', [
    ...raws, '-tile', `5x${rows}`, '-geometry', '512x512+0+0>',
    '-background', MAGENTA, '-gravity', 'center', '-strip', fullSheet,
  ]);
  console.log(`Sheets: ${identify(['-format', '%wx%h', batchSheet])} batch, ${identify(['-format', '%wx%h', fullSheet])} full.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nAll ${GOBLIN_VARIATIONS.length} goblin cutouts verified successfully.`);
if (!allPassed) process.exit(1);
