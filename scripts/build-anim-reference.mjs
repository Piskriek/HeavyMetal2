#!/usr/bin/env node
/**
 * Builds a 2x2 reference template for the image generator.
 *
 * The model reproduces whatever layout it is shown, so instead of asking it to
 * invent a 2x2 spritesheet (it usually fills the canvas and the frames end up
 * sliced by the centre cut), we hand it a sheet that ALREADY has four copies of
 * the still art in a 2x2 grid with wide magenta gutters. The prompt then only
 * has to ask for the animation to differ per panel.
 *
 * Usage: node scripts/build-anim-reference.mjs [sheet-px] [gutter-px]
 *   writes art-src/animated/<name>-reference.png for every ANIMATED_SOURCE entry
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAGENTA = '#FF00FF';
const SHEET = Number(process.argv[2] ?? 1024);
const GUTTER = Number(process.argv[3] ?? 48);
const MARGIN = 18;
const PAD = 10;

const SOURCE_ART = {
  'anim-01-torchbearer-flame': 'goblins/alpha/goblin-04-torchbearer.png',
  'anim-02-firework-sparkler': 'goblins/alpha/goblin-18-firework-crew.png',
  'anim-03-torch-crowd': 'goblins/alpha/goblin-24-torch-crowd.png',
  'anim-04-lantern-warden': 'goblins/alpha/goblin-11-lantern-warden.png',
  'anim-05-smelting-crucible': 'props/alpha/prop-04-smelting-crucible.png',
  'anim-06-molten-cauldron': 'props/alpha/prop-07-tripod-cauldron-molten.png',
  'anim-07-slag-channel': 'props/alpha/prop-41-molten-slag-channel.png',
  'anim-08-waterwheel-cascade': 'props/alpha/prop-28-cavern-waterwheel-cascade.png',
  'anim-09-plunge-basin': 'props/alpha/prop-42-waterfall-plunge-basin.png',
  'anim-10-waterfall-curtain': 'track-parts/waterfall-curtain.png',
  'anim-11-tnt-fuse-spark': 'goblins/alpha/goblin-07-tnt-handler.png',
  'anim-12-drum-podium-braziers': 'goblins/alpha/goblin-22-drum-podium-mob.png',
  'anim-13-horn-riser-lantern': 'goblins/alpha/goblin-25-horn-riser.png',
  'anim-14-fan-aisle-torches': 'goblins/alpha/goblin-30-fan-aisle.png',
  'anim-15-triple-lantern-post': 'props/alpha/prop-01-lantern-post-triple.png',
  'anim-16-molten-rock-arch': 'props/alpha/prop-16-molten-rock-natural-arch.png',
  'anim-17-arch-gate-lanterns': 'props/alpha/prop-40-timber-arch-gate-lanterns.png',
  'anim-18-torch-sconce': 'props/alpha/prop-56-arch-torch-sconce.png',
  'anim-19-waterfall-splash': 'track-parts/waterfall-splash.png',
  'anim-20-waterfall-splash-b': 'track-parts/waterfall-splash-b.png',
  'anim-21-flag-waver': 'goblins/alpha/goblin-01-flag-waver.png',
  'anim-22-war-drummer': 'goblins/alpha/goblin-02-war-drummer.png',
  'anim-23-pit-mechanic': 'goblins/alpha/goblin-03-pit-mechanic.png',
  'anim-24-ore-miner': 'goblins/alpha/goblin-05-ore-miner.png',
  'anim-25-horn-blower': 'goblins/alpha/goblin-06-horn-blower.png',
  'anim-26-track-marshal': 'goblins/alpha/goblin-08-track-marshal.png',
  'anim-27-blacksmith': 'goblins/alpha/goblin-09-blacksmith.png',
  'anim-28-tankard-celebrant': 'goblins/alpha/goblin-10-tankard-celebrant.png',
  'anim-29-ball-loader': 'goblins/alpha/goblin-12-ball-loader.png',
  'anim-30-bell-ringer': 'goblins/alpha/goblin-13-bell-ringer.png',
};

const outDir = join(root, 'art-src/animated');
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'anim-ref-'));
const magick = (args) => execFileSync('convert', args, { encoding: 'utf8' });

const panel = Math.floor((SHEET - 2 * MARGIN - GUTTER) / 2);
const inner = panel - 2 * PAD;
const offA = MARGIN;
const offB = MARGIN + panel + GUTTER;
const positions = [[offA, offA], [offB, offA], [offA, offB], [offB, offB]];

try {
  let built = 0;
  for (const [name, rel] of Object.entries(SOURCE_ART)) {
    const src = join(root, 'public/art', rel);
    if (!existsSync(src)) {
      console.warn(`skip ${name}: missing ${rel}`);
      continue;
    }
    const panelPath = join(tmp, 'panel.png');
    magick([
      '-size', `${panel}x${panel}`, `xc:${MAGENTA}`,
      '(', src, '-background', MAGENTA, '-alpha', 'remove', '-alpha', 'off',
      '-resize', `${inner}x${inner}`, ')',
      '-gravity', 'center', '-composite', panelPath,
    ]);
    const out = join(outDir, `${name}-reference.png`);
    const args = ['-size', `${SHEET}x${SHEET}`, `xc:${MAGENTA}`];
    for (const [x, y] of positions) {
      args.push('(', panelPath, ')', '-geometry', `+${x}+${y}`, '-composite');
    }
    args.push('-strip', out);
    magick(args);
    built += 1;
  }
  console.log(`Built ${built} reference templates (${SHEET}x${SHEET}, panel ${panel}, gutter ${GUTTER}) in art-src/animated/`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
