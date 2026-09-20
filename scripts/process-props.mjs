#!/usr/bin/env node
/**
 * Post-processes and validates the generated prop variations.
 *
 * Sources:
 *  - Generated on the project's standard magenta (#FF00FF) chroma key backdrop.
 *  - Stored in `public/art/props/` (raw magenta key transparency) and
 *    `public/art/props/alpha/` (keyed true alpha transparency).
 *  - Combined sprite sheets stored in:
 *    - `public/art/sheets/props-sheet.png` (all 40 variations, 5x8)
 *    - `public/art/sheets/props-sheet-b.png` (Batch 2: props 11-20, 5x2)
 *    - `public/art/sheets/props-sheet-c.png` (Batch 3: props 21-30, 5x2)
 *    - `public/art/sheets/props-sheet-d.png` (Batch 4: props 31-40, 5x2)
 *
 * Keying & despill:
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
 *  1. Generate props N+1..N+10 on flat magenta, one subject per file, complete
 *     uncropped silhouettes, no text baked into grid sheets.
 *  2. Save raws as `public/art/props/prop-<NN>-<slug>.png`.
 *  3. Append 10 entries to PROP_VARIATIONS below (file/original/concept).
 *  4. Run `node scripts/process-props.mjs` — it normalises, keys, despills and
 *     rebuilds the batch sheet + full sheet automatically.
 *  5. Register the 10 in PROP_DEFINITIONS (`src/game/track-builder-3d.ts`).
 *  6. Document the batch in `docs/EXPANSION_PROGRESS.md` (same format as below).
 *  7. Inspect the alpha contact sheet + a checkerboard edge crop, then commit
 *     to this branch and update the open props PR (never open a second PR).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const propsDir = join(root, 'public/art/props');
const alphaDir = join(root, 'public/art/props/alpha');
const sheetsDir = join(root, 'public/art/sheets');
mkdirSync(alphaDir, { recursive: true });
mkdirSync(sheetsDir, { recursive: true });

const MAGENTA = '#FF00FF';
const KEY_FUZZ = '20%';

export const PROP_VARIATIONS = [
  // --- Batch 1 (Props 01 - 10) ---
  {
    file: 'prop-01-lantern-post-triple.png',
    original: 'public/art/track-parts/lantern-post.png',
    concept: 'Triple-lantern goblin timber watchpost with chains, skull sign, and cobblestone footing',
  },
  {
    file: 'prop-02-ore-cart-spilling.png',
    original: 'public/art/track-parts/ore-cart.png',
    concept: 'Tilted goblin minecart spilling glowing lava rocks, gold ore, and volcanic embers on wooden ties',
  },
  {
    file: 'prop-03-tnt-powder-kegs.png',
    original: 'public/art/track-parts/tnt-crate.png',
    concept: 'Pyramid cluster of three gunpowder kegs with dynamite sticks, skull TNT stencils, and sparking fuse',
  },
  {
    file: 'prop-04-smelting-crucible.png',
    original: 'public/art/track-parts/ore-bucket.png',
    concept: 'Hanging iron smelting crucible with spiked bands, goblin gear crest, and dripping molten gold',
  },
  {
    file: 'prop-05-rail-turntable-switch.png',
    original: 'public/art/track-parts/rail-switch.png',
    concept: 'Crossing railway switch track with dual red-handle levers, cog gear box, and indicator lantern',
  },
  {
    file: 'prop-06-crystal-rock-deflector.png',
    original: 'public/art/track-parts/rock-deflector.png',
    concept: 'Chipped granite boulder deflector embedded with glowing amber crystal geode clusters and moss',
  },
  {
    file: 'prop-07-tripod-cauldron-molten.png',
    original: 'public/art/track-parts/cauldron-molten.png',
    concept: 'A-frame tripod smelting cauldron with molten metal pouring onto hot glowing charcoal embers',
  },
  {
    file: 'prop-08-goblin-windmill-gears.png',
    original: 'public/art/landmark-windmill.png',
    concept: 'Goblin windmill tower with patched canvas sails, exposed brass gears, and smoking chimney',
  },
  {
    file: 'prop-09-pine-lookout-outcrop.png',
    original: 'public/art/landmark-pines.png',
    concept: 'Alpine pine tree cluster on cliff outcrop with wooden scout platform, hanging lantern, and ladder',
  },
  {
    file: 'prop-10-scout-blimp-zeppelin.png',
    original: 'public/art/sheets/blimp.png',
    concept: 'Goblin scout blimp airship with riveted brass ribs, spinning side propellers, and hanging gondola',
  },
  // --- Batch 2 (Props 11 - 20) ---
  {
    file: 'prop-11-broken-rope-bridge.png',
    original: 'public/art/track-parts/bridge-wooden-broken.png',
    concept: 'Broken wooden suspension rope bridge with snapped planks, fraying thick hemp ropes, and bolted timber anchor posts',
  },
  {
    file: 'prop-12-goblin-scaffold-tower.png',
    original: 'public/art/track-parts/cliff-scaffolding.png',
    concept: 'Rickety goblin timber watchtower with thatched roof, ladder, iron brackets, red skull flag, and lantern',
  },
  {
    file: 'prop-13-cavern-mine-gate.png',
    original: 'public/art/track-parts/mine-gate.png',
    concept: 'Heavy cavern mine entrance archway with jagged stone frame, timber beams, burning iron torches, and skull keystone',
  },
  {
    file: 'prop-14-scrapdome-finish-gantry.png',
    original: 'public/art/track-parts/stadium-gantry.png',
    concept: 'Racetrack finish line gantry arch with riveted iron trusses, brass cogs, checkered flag banner, and brass horns',
  },
  {
    file: 'prop-15-goblin-spectator-terrace.png',
    original: 'public/art/track-parts/goblin-bleacher-a.png',
    concept: 'Tiered wooden bleacher terrace on mossy stone outcrop with spiked railings, skull banner, and flaming brazier',
  },
  {
    file: 'prop-16-molten-rock-natural-arch.png',
    original: 'public/art/track-parts/rock-arch-wide.png',
    concept: 'Jagged basalt rock arch bridge with glowing orange lava fissures and dripping molten slag stalactites',
  },
  {
    file: 'prop-17-goblin-war-drums.png',
    original: 'public/art/track-parts/rock-platform-drums.png',
    concept: 'Giant goblin war drum with stretched hide skin, spiked bronze rims, iron brackets, skull charms, and mallets',
  },
  {
    file: 'prop-18-goblin-slingshot-launcher.png',
    original: 'public/art/slingshot.png',
    concept: 'Heavy mechanical track slingshot catapult launcher with torsion winch, brass cog gear, and spiked anchor sled',
  },
  {
    file: 'prop-19-racetrack-grandstand.png',
    original: 'public/art/grandstand.png',
    concept: 'Covered wooden racetrack grandstand with tiered bench seating, corrugated rusty tin roof, and festive goblin pennant bunting',
  },
  {
    file: 'prop-20-goblin-springboard-platform.png',
    original: 'public/art/track-parts/rock-platform-springboard.png',
    concept: 'Goblin springboard catapult ledge on craggy stone outcrop with torch brazier, checkered flag, and cheering goblin spectators',
  },
  // --- Batch 3 (Props 21 - 30) ---
  {
    file: 'prop-21-quarry-excavation-crane.png',
    original: 'public/art/landmark-quarry.png',
    concept: 'Heavy timber A-frame goblin quarry crane with steam boiler, brass gears, and suspended iron claw gripping sandstone boulder',
  },
  {
    file: 'prop-22-armored-sheep-pen.png',
    original: 'public/art/landmark-pasture.png',
    concept: 'Armored goblin racing sheep in wooden paddock pen with barbed wire, glowing mushroom feed trough, and horned skull gatepost',
  },
  {
    file: 'prop-23-hazard-sign-sheep.png',
    original: 'public/art/sign-sheep.png',
    concept: 'Rustic timber roadside caution signpost with painted yellow warning diamond depicting explosive racing sheep, wooden arrow, and lantern',
  },
  {
    file: 'prop-24-hazard-sign-explosives.png',
    original: 'public/art/sign-tnt.png',
    concept: 'Roadside hazard signpost with stenciled BOOM-TOWN TNT, red dynamite bundle, sparking fuse, and skull warning plate',
  },
  {
    file: 'prop-25-timber-coaster-loop.png',
    original: 'public/art/timber-loop.png',
    concept: 'Vertical timber roller coaster loop-de-loop with heavy notched pine beams, iron tie brackets, hanging amber lanterns, and guide rails',
  },
  {
    file: 'prop-26-granite-tunnel-portal.png',
    original: 'public/art/track-parts/tunnel-mouth-stone.png',
    concept: 'Heavy chiseled granite mountain tunnel entrance archway with reinforced timber lintels, beast skull trophy keystone, and burning iron sconces',
  },
  {
    file: 'prop-27-rock-spire-lookout.png',
    original: 'public/art/track-parts/rock-platform-spire.png',
    concept: 'Towering jagged rock needle pinnacle with goblin lookout crow\'s nest, hanging brass gong, rope ladder, and fluttering pennant',
  },
  {
    file: 'prop-28-cavern-waterwheel-cascade.png',
    original: 'public/art/track-parts/waterfall-curtain.png',
    concept: 'Roaring alpine waterfall tumbling over stepped slate rocks with heavy mossy wooden goblin waterwheel, brass scoops, and splash trough',
  },
  {
    file: 'prop-29-spiked-boulder-barricade.png',
    original: 'public/art/track-parts/rock-boulder-a.png',
    concept: 'Cluster of rugged sandstone boulders fortified with sharpened wooden palisade spikes, chains, glowing green mushrooms, goblin shield, and war horn',
  },
  {
    file: 'prop-30-goblin-slingshot-downrange.png',
    original: 'public/art/slingshot-downrange.png',
    concept: 'Heavy mechanical track slingshot catapult launcher with steam boiler, brass gear winch, and timber forks viewed downrange',
  },
  // --- Batch 4 (Props 31 - 40): seam-hiding dressing + trackside structures ---
  {
    file: 'prop-31-grass-seam-fringe-wide.png',
    original: 'public/art/decals/grass-fringe.png',
    concept: 'Wide dense grass fringe seam patch with tall blades, clover tufts, wildflowers, dirt clumps, and pebbles',
  },
  {
    file: 'prop-32-mossy-embankment-skirt.png',
    original: 'public/art/track-parts/rock-floor-ledge.png',
    concept: 'Mossy dirt embankment skirt wedge with grass lip, hanging moss, exposed roots, and embedded stones',
  },
  {
    file: 'prop-33-rubble-gravel-seam-strip.png',
    original: 'public/art/track-parts/rock-boulder-b.png',
    concept: 'Loose rubble and gravel seam strip with crushed granite chunks, cracked slabs, dirt clumps, and pebbles',
  },
  {
    file: 'prop-34-timber-crib-retaining-wall.png',
    original: 'public/art/track-parts/wall-timber-braced.png',
    concept: 'Timber crib retaining wall of stacked notched logs with iron spikes, brackets, moss, and dirt footing',
  },
  {
    file: 'prop-35-granite-strata-seam-wall.png',
    original: 'public/art/track-parts/wall-granite-strata.png',
    concept: 'Layered granite strata seam wall with chiseled bands, iron pitons, hanging moss, ferns, and rubble footing',
  },
  {
    file: 'prop-36-glowcap-mushroom-thicket.png',
    original: 'public/art/decals/grass-fringe.png',
    concept: 'Glowing green-capped mushroom thicket cluster with mossy logs, drifting spores, and ferns',
  },
  {
    file: 'prop-37-fern-bramble-undergrowth.png',
    original: 'public/art/decals/grass-fringe.png',
    concept: 'Dense fern and bramble undergrowth patch with curled fronds, thorny vines, red berries, and leaf litter',
  },
  {
    file: 'prop-38-scrap-iron-barricade.png',
    original: 'public/art/track-parts/stadium-gantry.png',
    concept: 'Scrap-iron junk barricade of leaning riveted plates, brass gears, chains, posts, and warning lantern',
  },
  {
    file: 'prop-39-goblin-pit-canopy-tent.png',
    original: 'public/art/track-parts/goblin-bleacher-a.png',
    concept: 'Goblin pit-crew canopy tent with patched canvas awning, timber poles, tool crates, tire stack, and pennants',
  },
  {
    file: 'prop-40-timber-arch-gate-lanterns.png',
    original: 'public/art/track-parts/tunnel-mouth-timber.png',
    concept: 'Heavy timber arch gate with crossed beams, iron brackets, hanging amber lanterns, and skull totem',
  },
];

const magick = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8' }).trim();

console.log(`Processing and verifying ${PROP_VARIATIONS.length} prop variations...\n`);

let allPassed = true;
const tmp = mkdtempSync(join(tmpdir(), 'props-'));
const T = (name) => join(tmp, `${name}.miff`);

try {
  for (const prop of PROP_VARIATIONS) {
    const rawPath = join(propsDir, prop.file);
    const alphaPath = join(alphaDir, prop.file);

    if (!existsSync(rawPath)) {
      console.error(`FAIL: Missing ${prop.file}`);
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
    console.log(`✓ ${prop.file.padEnd(44)} ${dims.padEnd(11)} magenta=${pixel.padEnd(20)} alpha=${alphaPixel}`);
  }

  // 6. Sprite sheets from the normalised raws (magenta backdrop, 512px cells).
  const raws = PROP_VARIATIONS.map((p) => join(propsDir, p.file));
  const batchCount = Math.ceil(raws.length / 10);
  const lastBatch = raws.slice((batchCount - 1) * 10);
  const batchLetter = String.fromCharCode('a'.charCodeAt(0) + batchCount - 1);
  const batchSheet = join(sheetsDir, `props-sheet-${batchLetter}.png`);
  console.log(`\nBuilding ${batchSheet} (${lastBatch.length} cells, 5x2)...`);
  execFileSync('montage', [
    ...lastBatch, '-tile', '5x2', '-geometry', '512x512+0+0>',
    '-background', MAGENTA, '-gravity', 'center', '-strip', batchSheet,
  ]);
  const fullSheet = join(sheetsDir, 'props-sheet.png');
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

console.log(`\nAll ${PROP_VARIATIONS.length} prop variations verified successfully.`);
if (!allPassed) process.exit(1);
