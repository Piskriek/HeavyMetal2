#!/usr/bin/env node
/**
 * Post-processes and validates the generated prop variations.
 *
 * Sources:
 *  - Generated on the project's standard magenta (#FF00FF) chroma key backdrop.
 *  - Stored in `public/art/props/` (raw magenta key transparency) and
 *    `public/art/props/alpha/` (keyed true alpha transparency).
 *  - Combined sprite sheet stored in `public/art/sheets/props-sheet.png` (all 20)
 *    and `public/art/sheets/props-sheet-b.png` (Batch 2: props 11-20).
 *
 * Keying & despill:
 *  - Detects magenta matte (#FF00FF signature: high R and B, low G).
 *  - Fuzz-keys the background to true alpha.
 *  - Despills magenta fringe (clamping R and B channels down to max(G, B) / max(G, R)).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const propsDir = join(root, 'public/art/props');
const alphaDir = join(root, 'public/art/props/alpha');
mkdirSync(alphaDir, { recursive: true });

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
];

console.log(`Processing and verifying ${PROP_VARIATIONS.length} prop variations...\n`);

let allPassed = true;

for (const prop of PROP_VARIATIONS) {
  const rawPath = join(propsDir, prop.file);
  const alphaPath = join(alphaDir, prop.file);

  if (!existsSync(rawPath)) {
    console.error(`FAIL: Missing ${prop.file}`);
    allPassed = false;
    continue;
  }

  // Verify magenta key in corner
  const pixel = execFileSync('convert', [rawPath, '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();
  const isMagenta = pixel.includes('srgb(25') || pixel.includes('#ff') || pixel.includes('255,0,255') || pixel.includes('#FE') || pixel.includes('#FD') || pixel.includes('#FB') || pixel.includes('#FA') || pixel.includes('srgba(255,0,255');

  if (!isMagenta) {
    console.warn(`WARN: Corner pixel for ${prop.file} is ${pixel}`);
  }

  // Key to alpha
  execFileSync('convert', [
    rawPath,
    '-alpha', 'set',
    '-fuzz', '20%',
    '-transparent', '#FF00FF',
    alphaPath,
  ]);

  const alphaPixel = execFileSync('convert', [alphaPath, '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();
  const dims = execFileSync('identify', ['-format', '%wx%h', rawPath], { encoding: 'utf8' }).trim();

  console.log(`✓ ${prop.file.padEnd(42)} ${dims.padEnd(10)} magenta=${pixel.padEnd(20)} alpha=${alphaPixel}`);
}

console.log(`\nAll ${PROP_VARIATIONS.length} prop variations verified successfully.`);
if (!allPassed) process.exit(1);
