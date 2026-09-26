#!/usr/bin/env node
/**
 * Builds the 4-frame animated decoration sheets (2x2, magenta-keyed).
 *
 * Sources:
 *  - Frames are derived from the already-keyed alpha cutouts
 *    (`public/art/goblins/alpha/`, `public/art/props/alpha/`,
 *    `public/art/track-parts/`) so the animation matches the shipped art.
 *  - Raw 2x2 sheets (magenta backdrop) live in `public/art/animated/`.
 *  - Keyed sheets (true alpha) live in `public/art/animated/alpha/`.
 *  - The runtime shows ONE quadrant per frame (TL=f0, TR=f1, BL=f2, BR=f3);
 *    cutting the sheet once horizontally + once vertically through the
 *    centre yields the 4 frames.
 *
 * Animation (per element type, masked so the subject body never moves):
 *  - fire  : travelling brightness bands rising through flame-coloured
 *            pixels (R>150, R>=G, R-B>38) + per-frame flicker lift.
 *  - spark : fire mask plus a pink-burst branch (R>170, B>140, R-G>20)
 *            with a harder flicker (firework strobe).
 *  - water : travelling brightness bands falling through water-coloured
 *            pixels (B>150, G>110, B>=R) plus a foam-white branch.
 *
 * Keying & despill (identical to `scripts/process-goblins.mjs`):
 *  - Each frame is flattened onto pure #FF00FF, appended into the 2x2
 *    sheet, then the sheet is flood-normalised (corner/edge seeds),
 *    fuzz-keyed (20%) and unmix-despilled on a 6px boundary ring.
 *
 * BATCH PROTOCOL (for the next agent adding 10 more):
 *  1. Pick water/fire (or similar elemental) alpha cutouts.
 *  2. Append 10 entries to ANIMATED_VARIATIONS below (file/src/element).
 *  3. Run `node scripts/process-animated.mjs` — it builds frames, sheets,
 *     keys, despills and rebuilds the contact sheet automatically.
 *  4. Register the 10 in PROP_DEFINITIONS (`src/game/track-builder-3d.ts`)
 *     under the `animated` category with isAnimated + animCols/Rows/Fps.
 *  5. Document the batch in `docs/EXPANSION_PROGRESS.md` (same format).
 *  6. Inspect the alpha contact sheet + remnant percentages, then commit
 *     to this branch and update the open animated-decorations PR
 *     (never open a second PR).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const animDir = join(root, 'public/art/animated');
const alphaDir = join(root, 'public/art/animated/alpha');
mkdirSync(alphaDir, { recursive: true });

const MAGENTA = '#FF00FF';
const KEY_FUZZ = '20%';
const MAX_FRAME_EDGE = 768; // long edge cap per frame; sheet = 2x2 frames
const FRAMES = 4;

/**
 * Batch 1 (anim 01-10): fire + water decorations.
 * Batch 2 (anim 11-20): more fire (TNT fuse, braziers, lanterns, lava arch,
 * torch sconce) + splash-burst water.
 * `src` is relative to public/art. `w`/`h` mirror the source PROP_DEFINITIONS
 * entry so the animated twin matches the static one's world size.
 */
export const ANIMATED_VARIATIONS = [
  // --- FIRE: goblins ---
  {
    file: 'anim-01-torchbearer-flame.png',
    src: 'goblins/alpha/goblin-04-torchbearer.png',
    concept: 'Torchbearer goblin thrusting a flaming torch high; flame licks upward',
    element: 'fire',
    w: 375, h: 560,
  },
  {
    file: 'anim-02-firework-sparkler.png',
    src: 'goblins/alpha/goblin-18-firework-crew.png',
    concept: 'Firework crew goblin waving a fizzing pink sparkler; burst strobes',
    element: 'spark',
    w: 1100, h: 600,
  },
  {
    file: 'anim-03-torch-crowd.png',
    src: 'goblins/alpha/goblin-24-torch-crowd.png',
    concept: 'Night crowd thrusting flaming torches high; flames ripple',
    element: 'fire',
    w: 1075, h: 600,
  },
  {
    file: 'anim-04-lantern-warden.png',
    src: 'goblins/alpha/goblin-11-lantern-warden.png',
    concept: 'Night warden holding a glowing amber lantern pole; lamp breathes',
    element: 'fire',
    w: 375, h: 560,
  },
  // --- FIRE: molten props ---
  {
    file: 'anim-05-smelting-crucible.png',
    src: 'props/alpha/prop-04-smelting-crucible.png',
    concept: 'Hanging smelting crucible brimming with glowing molten metal; surface roils',
    element: 'fire',
    w: 460, h: 500,
  },
  {
    file: 'anim-06-molten-cauldron.png',
    src: 'props/alpha/prop-07-tripod-cauldron-molten.png',
    concept: 'Tripod cauldron of bubbling molten slag; surface roils',
    element: 'fire',
    w: 480, h: 520,
  },
  {
    file: 'anim-07-slag-channel.png',
    src: 'props/alpha/prop-41-molten-slag-channel.png',
    concept: 'Molten slag channel; lava flow pulses downstream',
    element: 'fire',
    w: 1100, h: 600,
  },
  // --- WATER: falls & foam ---
  {
    file: 'anim-08-waterwheel-cascade.png',
    src: 'props/alpha/prop-28-cavern-waterwheel-cascade.png',
    concept: 'Waterwheel cascade; falls rush down and foam churns',
    element: 'water',
    w: 700, h: 1400,
  },
  {
    file: 'anim-09-plunge-basin.png',
    src: 'props/alpha/prop-42-waterfall-plunge-basin.png',
    concept: 'Waterfall plunge basin; spray churns in the pool',
    element: 'water',
    w: 1100, h: 600,
  },
  {
    file: 'anim-10-waterfall-curtain.png',
    src: 'track-parts/waterfall-curtain.png',
    concept: 'Sheer waterfall curtain; sheet of water ripples downward',
    element: 'water',
    w: 900, h: 1400,
  },
  // --- Batch 2 (anim 11-20): more fire + splash water ---
  // FIRE: goblins
  {
    file: 'anim-11-tnt-fuse-spark.png',
    src: 'goblins/alpha/goblin-07-tnt-handler.png',
    concept: 'TNT handler hugging a crate of dynamite; the lit fuse spark strobes',
    element: 'spark',
    w: 375, h: 560,
  },
  {
    file: 'anim-12-drum-podium-braziers.png',
    src: 'goblins/alpha/goblin-22-drum-podium-mob.png',
    concept: 'Drum podium ringed by dancing goblins; torch braziers flicker',
    element: 'fire',
    w: 1254, h: 700,
  },
  {
    file: 'anim-13-horn-riser-lantern.png',
    src: 'goblins/alpha/goblin-25-horn-riser.png',
    concept: 'War-horn riser band; hanging lantern sways with light',
    element: 'fire',
    w: 1254, h: 700,
  },
  {
    file: 'anim-14-fan-aisle-torches.png',
    src: 'goblins/alpha/goblin-30-fan-aisle.png',
    concept: 'Victory aisle of cheering fans; torch posts ripple',
    element: 'fire',
    w: 1075, h: 600,
  },
  // FIRE: lantern / molten props
  {
    file: 'anim-15-triple-lantern-post.png',
    src: 'props/alpha/prop-01-lantern-post-triple.png',
    concept: 'Triple lantern post; amber lamps breathe',
    element: 'fire',
    w: 360, h: 480,
  },
  {
    file: 'anim-16-molten-rock-arch.png',
    src: 'props/alpha/prop-16-molten-rock-natural-arch.png',
    concept: 'Molten rock arch; lava veins pulse through the stone',
    element: 'fire',
    w: 1400, h: 760,
  },
  {
    file: 'anim-17-arch-gate-lanterns.png',
    src: 'props/alpha/prop-40-timber-arch-gate-lanterns.png',
    concept: 'Timber arch gate; hanging lanterns breathe',
    element: 'fire',
    w: 1300, h: 700,
  },
  {
    file: 'anim-18-torch-sconce.png',
    src: 'props/alpha/prop-56-arch-torch-sconce.png',
    concept: 'Archway wall torch sconce; flame licks upward',
    element: 'fire',
    w: 320, h: 480,
  },
  // WATER: splash bursts
  {
    file: 'anim-19-waterfall-splash.png',
    src: 'track-parts/waterfall-splash.png',
    concept: 'Waterfall splash burst; foam churns and falls',
    element: 'water',
    w: 650, h: 450,
  },
  {
    file: 'anim-20-waterfall-splash-b.png',
    src: 'track-parts/waterfall-splash-b.png',
    concept: 'Waterfall splash burst variant; foam churns and falls',
    element: 'water',
    w: 650, h: 450,
  },
];

const magick = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8' }).trim();
const meanOf = (path) =>
  parseFloat(execFileSync('convert', [path, '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' }).trim());

console.log(`Building ${FRAMES}-frame sheets for ${ANIMATED_VARIATIONS.length} animated decorations...\n`);

let allPassed = true;
const tmp = mkdtempSync(join(tmpdir(), 'animated-'));
const T = (name) => join(tmp, `${name}.miff`);

try {
  for (const variation of ANIMATED_VARIATIONS) {
    const srcPath = join(root, 'public/art', variation.src);
    const rawPath = join(animDir, variation.file);
    const alphaPath = join(alphaDir, variation.file);
    const tag = variation.file;

    if (!existsSync(srcPath)) {
      console.error(`FAIL: Missing source ${variation.src}`);
      allPassed = false;
      continue;
    }

    // 0. Source must already carry transparency (we animate keyed cutouts).
    const srcOpaque = meanOf(srcPath) >= 0; // placeholder, real check below
    void srcOpaque;
    magick([srcPath, '-alpha', 'extract', T('srcA')]);
    const opaqueMean = meanOf(T('srcA'));
    if (!(opaqueMean > 0.01 && opaqueMean < 0.999)) {
      console.error(`FAIL: ${tag} source lacks real transparency (opaque mean ${opaqueMean.toFixed(4)})`);
      allPassed = false;
      continue;
    }

    // 1. Normalise frame size: shrink long edge, enforce even W/H.
    let [w, h] = identify(['-format', '%w %h', srcPath]).split(' ').map(Number);
    const longEdge = Math.max(w, h);
    const resizeArgs = longEdge > MAX_FRAME_EDGE ? ['-resize', `${MAX_FRAME_EDGE}x${MAX_FRAME_EDGE}>`] : [];
    magick([srcPath, ...resizeArgs, T('sized')]);
    [w, h] = identify(['-format', '%w %h', T('sized')]).split(' ').map(Number);
    const ew = w % 2 === 0 ? w : w + 1;
    const eh = h % 2 === 0 ? h : h + 1;
    if (ew !== w || eh !== h) {
      magick([T('sized'), '-background', 'none', '-gravity', 'center', '-extent', `${ew}x${eh}`, T('frame0base')]);
    } else {
      magick([T('sized'), T('frame0base')]);
    }
    const FW = ew;
    const FH = eh;

    // 2. Element mask from the normalised base frame.
    magick([T('frame0base'), '-channel', 'R', '-separate', '+channel', T('mR')]);
    magick([T('frame0base'), '-channel', 'G', '-separate', '+channel', T('mG')]);
    magick([T('frame0base'), '-channel', 'B', '-separate', '+channel', T('mB')]);
    magick([T('frame0base'), '-alpha', 'extract', '-threshold', '50%', T('mA')]);
    // NOTE: `convert A B -compose Minus -composite` computes B-A (verified on
    // IM 6.9.11), so operand order below is intentional.
    if (variation.element === 'water') {
      magick([T('mR'), T('mB'), '-compose', 'Minus', '-composite', '-threshold', '0%', T('wD')]); // B-R
      magick([T('mB'), '-threshold', '59%', T('wBt')]); // B > 150
      magick([T('mG'), '-threshold', '43%', T('wGt')]); // G > 110
      magick([T('wBt'), T('wGt'), '-compose', 'Multiply', '-composite', T('wD'),
        '-compose', 'Multiply', '-composite', T('mA'), '-compose', 'Multiply', '-composite', T('wCore')]);
      // Foam-white branch: min(R,G,B) > 225.
      magick([T('mR'), T('mG'), '-compose', 'Darken', '-composite', T('mB'),
        '-compose', 'Darken', '-composite', '-threshold', '88%', T('wMin')]);
      magick([T('wMin'), T('mA'), '-compose', 'Multiply', '-composite', T('wFoam')]);
      magick([T('wCore'), T('wFoam'), '-compose', 'Lighten', '-composite', '-blur', '0x1', T('mask')]);
    } else {
      magick([T('mG'), T('mR'), '-compose', 'Minus', '-composite', '-threshold', '0%', T('fRG')]); // R-G
      magick([T('mB'), T('mR'), '-compose', 'Minus', '-composite', '-threshold', '15%', T('fRB')]); // R-B
      magick([T('mR'), '-threshold', '59%', T('fRt')]); // R > 150
      magick([
        T('fRt'), T('fRG'), '-compose', 'Multiply', '-composite', T('fRB'),
        '-compose', 'Multiply', '-composite', T('mA'), '-compose', 'Multiply', '-composite', T('fCore'),
      ]);
      if (variation.element === 'spark') {
        // Pink-burst branch: R>170, B>140, R-G>20.
        magick([T('mR'), '-threshold', '67%', T('sRt')]);
        magick([T('mB'), '-threshold', '55%', T('sBt')]);
        magick([T('mG'), T('mR'), '-compose', 'Minus', '-composite', '-threshold', '8%', T('sRG')]);
        magick([
          T('sRt'), T('sBt'), '-compose', 'Multiply', '-composite', T('sRG'),
          '-compose', 'Multiply', '-composite', T('mA'), '-compose', 'Multiply', '-composite', T('sCore'),
        ]);
        magick([T('fCore'), T('sCore'), '-compose', 'Lighten', '-composite', '-blur', '0x1', T('mask')]);
      } else {
        magick([T('fCore'), '-blur', '0x1', T('mask')]);
      }
    }
    const coverage = meanOf(T('mask')) * 100;
    if (coverage < 0.3) {
      console.error(`FAIL: ${tag} element mask nearly empty (${coverage.toFixed(2)}% — wrong element?)`);
      allPassed = false;
      continue;
    }

    // 3. Four frames: travelling brightness bands through the mask.
    // Fire rises (phase +90/frame), water falls (phase -90/frame), spark
    // strobes (harder flicker). Band range base..base+0.18 per frame.
    const cycles = Math.max(2, Math.round(FH / 28));
    const dir = variation.element === 'water' ? -1 : 1;
    const flick = variation.element === 'spark'
      ? [0.0, 0.1, 0.03, 0.14]
      : variation.element === 'water'
        ? [0.0, 0.04, 0.02, 0.06]
        : [0.0, 0.05, 0.02, 0.08];
    const flats = [];
    for (let f = 0; f < FRAMES; f += 1) {
      const phase = dir * f * 90;
      // NOTE: `-evaluate Add` takes an ABSOLUTE (0..QuantumRange) value, so the
      // lift must be a percent. (A bare 0.91 adds ~1 quantum ≈ 0.)
      // Contrast 0.22/0.30 keeps troughs clearly visible at decoration scale.
      const contrast = variation.element === 'spark' ? '0.30' : '0.22';
      const floor = variation.element === 'spark' ? 0.78 : 0.84;
      const lift = `${Math.round((floor + flick[f]) * 100)}%`;
      magick([
        '-size', `1x${FH}`, 'gradient:', '-function', 'Sinusoid', `${cycles},${phase}`,
        '-evaluate', 'Multiply', contrast, '-evaluate', 'Add', lift,
        '-scale', `${FW}x${FH}!`, '-alpha', 'off', T(`bands${f}`),
      ]);
      magick([T('frame0base'), T(`bands${f}`), '-compose', 'Multiply', '-composite', T(`mod${f}`)]);
      magick([T('frame0base'), T(`mod${f}`), T('mask'), '-composite', T(`fr${f}`)]);
      magick([T(`fr${f}`), '-background', MAGENTA, '-alpha', 'remove', '-alpha', 'off', T(`flat${f}`)]);
      flats.push(T(`flat${f}`));
    }

    // 4. 2x2 sheet (TL=f0, TR=f1, BL=f2, BR=f3) on magenta.
    magick([...flats.slice(0, 2), '+append', T('top')]);
    magick([...flats.slice(2, 4), '+append', T('bot')]);
    magick([T('top'), T('bot'), '-append', T('sheet')]);
    const [sw, sh] = identify(['-format', '%w %h', T('sheet')]).split(' ').map(Number);
    const mx = sw - 1;
    const my = sh - 1;
    const hx = Math.floor(sw / 2);
    const hy = Math.floor(sh / 2);

    // 5. Flood-normalise the connected background to pure magenta.
    magick([
      T('sheet'), '-fuzz', '12%', '-fill', MAGENTA,
      '-draw', 'color 0,0 floodfill', '-draw', `color ${mx},0 floodfill`,
      '-draw', `color 0,${my} floodfill`, '-draw', `color ${mx},${my} floodfill`,
      '-draw', `color ${hx},0 floodfill`, '-draw', `color ${hx},${my} floodfill`,
      '-draw', `color 0,${hy} floodfill`, '-draw', `color ${mx},${hy} floodfill`,
      T('norm'),
    ]);
    const pixel = execFileSync('convert', [T('norm'), '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();
    magick([T('norm'), rawPath]);

    // 6. Fuzz-key the background to (binary) alpha.
    magick([T('norm'), '-alpha', 'set', '-fuzz', KEY_FUZZ, '-transparent', MAGENTA, T('keyed')]);

    // 7. Boundary ring + unmix-despill (magenta), copied from process-goblins.
    magick([T('keyed'), '-alpha', 'extract', T('maskA')]);
    magick([
      T('maskA'), '-negate',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      T('dil'),
    ]);
    magick([T('dil'), T('maskA'), '-compose', 'Multiply', '-composite', T('fringe')]);
    magick([T('keyed'), '-channel', 'R', '-separate', T('kR')]);
    magick([T('keyed'), '-channel', 'G', '-separate', T('kG')]);
    magick([T('keyed'), '-channel', 'B', '-separate', T('kB')]);
    magick([T('keyed'), '-alpha', 'extract', T('kA')]);
    magick([T('kG'), T('kR'), '-compose', 'Minus', '-composite', T('kD1')]);
    magick([T('kG'), T('kB'), '-compose', 'Minus', '-composite', T('kD2')]);
    magick([T('kD1'), T('kD2'), '-compose', 'Darken', '-composite', T('kE')]);
    magick([T('kE'), '-negate', T('kC')]);
    magick([T('kE'), T('kR'), '-compose', 'Minus', '-composite', T('kRm')]);
    magick([T('kC'), T('kRm'), '-compose', 'Divide', '-composite', T('kRu')]);
    magick([T('kC'), T('kG'), '-compose', 'Divide', '-composite', T('kGu')]);
    magick([T('kE'), T('kB'), '-compose', 'Minus', '-composite', T('kBm')]);
    magick([T('kC'), T('kBm'), '-compose', 'Divide', '-composite', T('kBu')]);
    magick([T('kA'), T('kC'), '-compose', 'Multiply', '-composite', T('kAu')]);
    magick([T('kRu'), T('kGu'), T('kBu'), '-combine', '-alpha', 'off', T('kuRGB')]);
    magick([T('kuRGB'), T('kAu'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', T('kunmix')]);
    magick([T('keyed'), '-alpha', 'off', T('kkRGB')]);
    magick([T('kunmix'), '-alpha', 'off', T('kuRGBflat')]);
    magick([T('kkRGB'), T('kuRGBflat'), T('fringe'), '-composite', T('kfRGB')]);
    magick([T('kA'), T('kAu'), T('fringe'), '-composite', T('kfA')]);
    magick([T('kfRGB'), T('kfA'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-strip', alphaPath]);

    // 8. Verify: corner alpha + magenta remnant among opaque pixels.
    const alphaPixel = execFileSync('convert', [alphaPath, '-format', '%[pixel:p{10,10}]', 'info:'], { encoding: 'utf8' }).trim();
    magick([alphaPath, '-channel', 'R', '-separate', '+channel', '-threshold', '59%', T('vR')]);
    magick([alphaPath, '-channel', 'B', '-separate', '+channel', '-threshold', '59%', T('vB')]);
    magick([alphaPath, '-channel', 'G', '-separate', '+channel', '-threshold', '43%', '-negate', T('vGlow')]);
    magick([alphaPath, '-alpha', 'extract', '-threshold', '50%', T('vA')]);
    magick([
      T('vR'), T('vB'), '-compose', 'Multiply', '-composite', T('vGlow'),
      '-compose', 'Multiply', '-composite', '-negate', T('vNotMag'),
    ]);
    // Minus computes second-minus-first: [vNotMag, vA] = opaque AND magenta.
    magick([T('vNotMag'), T('vA'), '-compose', 'Minus', '-composite', T('vRem')]);
    const remnant = (meanOf(T('vRem')) * 100).toFixed(3);
    const dims = `${sw}x${sh}`;
    const flag = parseFloat(remnant) > 0.5 ? '  <-- REMNANT HIGH' : '';
    if (parseFloat(remnant) > 0.5) allPassed = false;
    console.log(
      `✓ ${tag.padEnd(34)} ${dims.padEnd(11)} frame=${FW}x${FH} ${variation.element.padEnd(5)} ` +
      `cover=${coverage.toFixed(1).padStart(5)}% magenta=${pixel.padEnd(18)} alpha=${alphaPixel} remnant=${remnant}%${flag}`,
    );
  }

  // 9. Review contact sheet (keyed sheets, 5x2 @ 384px).
  const sheets = ANIMATED_VARIATIONS.map((v) => join(alphaDir, v.file)).filter((p) => existsSync(p));
  if (sheets.length) {
    const contact = join(root, 'art-src/animated/animated-contact-sheet.png'); // review only, never shipped
    const rows = Math.ceil(sheets.length / 5);
    execFileSync('montage', [
      ...sheets, '-tile', `5x${rows}`, '-geometry', '384x384+4+4>',
      '-background', '#222222', '-gravity', 'center', '-strip', contact,
    ]);
    console.log(`\nContact sheet: ${contact} (${identify(['-format', '%wx%h', contact])}).`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nDone: ${ANIMATED_VARIATIONS.length} animated decorations.`);
if (!allPassed) process.exit(1);
