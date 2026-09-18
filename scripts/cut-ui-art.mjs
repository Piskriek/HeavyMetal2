#!/usr/bin/env node
/**
 * Cuts the hand-painted UI art (generated sources in `public/art/sheets/ui/` and
 * `PreGame/public/art/*-src.png`) into the runtime PNGs the UI actually loads.
 *
 * This is the UI-facing sibling of `build-art.mjs`: the same matte rules (magenta
 * #FF00FF detected on the border, fuzz-keyed, fringe-only despill that clamps only the
 * matte's own channels — ported from build-art.mjs's despill()), but for single
 * full-frame paintings rather than gridded sprite sheets.
 *
 *  - `emblem-src.png`    -> `public/art/goblin-emblem.png`  (keyed, mounted on a solid
 *                           painted-iron disc so the delicate ring crest stays chunky)
 *  - `aim-arrow-src.png` -> `public/art/aim-arrow.png`       (keyed, trimmed, 480px wide)
 *  - `favicon-src.png`   -> `public/favicon.png`             (256px, rounded corners)
 *  - `frame-src.png`     -> `public/ui/frame-gold.png`       (512px, 9-slice panel frame)
 *  - `frame-src.png`     -> `public/ui/stone-tile.png`       (quiet centre crop, app backdrop)
 *  - `button-src.png`    -> `public/ui/button-gold.png`      (ornate button plate)
 *  - `button-hover-src`  -> `public/ui/button-gold-hover.png`
 *  - `menu-vista-src`    -> `public/art/menu-vista.png`      (main-menu painting)
 *  - `dirt-src.png`      -> `public/art/dirt-tile.png`       (seamless via 2x2 windmill)
 *  - PreGame `map-panel-src.png`  -> `PreGame/public/art/map-panel.png`  (keyed, 900px tall)
 *  - PreGame `exit-glyph-src.png` -> `PreGame/public/art/exit-glyph.png` (keyed, 80px)
 *
 * Usage: node scripts/cut-ui-art.mjs
 * Requires ImageMagick 6 on PATH, exactly like the sprite pipeline. Idempotent: sources
 * that are already keyed are detected and only despilled again.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = (file) => join(root, 'public/art/sheets/ui', file);
const preSrc = (file) => join(root, 'PreGame/public/art', file);
const out = (file) => join(root, 'public', file);
const preOut = (file) => join(root, 'PreGame/public/art', file);
mkdirSync(join(root, 'public/ui'), { recursive: true });
mkdirSync(join(root, 'public/art/ui'), { recursive: true });
mkdirSync(join(root, 'tmp-art'), { recursive: true });

let step = 0;
const temp = (tag) => join(root, 'tmp-art', `${tag}-${step++}.png`);
const run = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const size = (file) => execFileSync('identify', ['-format', '%wx%h', file], { encoding: 'utf8' }).trim();
const rgbOf = (text) => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Matte detection: most frequent quantised border colour with a magenta signature.
 *  Returns null when the border is already transparent (idempotent re-runs). */
function matteOf(file) {
  const [width, height] = size(file).split('x').map(Number);
  const strips = [`1x${height}+0+0`, `1x${height}+${width - 1}+0`, `${width}x1+0+0`, `${width}x1+0+${height - 1}`];
  const counts = new Map();
  for (const strip of strips) {
    const text = execFileSync('convert', [file, '-crop', strip, '+repage', 'txt:-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const line of text.split('\n')) {
      const at = line.indexOf(':');
      if (at < 0) continue;
      const [r, g, b] = rgbOf(line.slice(at + 1));
      if (![r, g, b].every(Number.isFinite)) continue;
      if (!(r > 150 && b > 150 && g < 110)) continue;
      const key = [r, g, b].map((v) => Math.round(v / 8) * 8).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (!counts.size) return null;
  const [r, g, b] = [...counts.entries()].sort((a, c) => c[1] - a[1])[0][0].split(',').map(Number);
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}`;
}

/** build-art.mjs's despill(), verbatim strategy: clamp the matte's own channels (R and B
 *  for magenta) to the strongest remaining channel, only on the anti-aliased fringe. */
function despill(file) {
  const channels = {};
  for (const name of ['R', 'G', 'B']) {
    const target = temp(`chan${name}`);
    run([file, '-channel', name, '-separate', target]);
    channels[name] = target;
  }
  const alpha = temp('alpha');
  run([file, '-alpha', 'extract', alpha]);
  const interior = temp('interior');
  run([alpha, '-threshold', '96%', interior]);

  const output = {};
  for (const [name, others] of [['R', ['G', 'B']], ['B', ['G', 'R']]]) {
    const ceiling = temp('ceiling');
    run([channels[others[0]], channels[others[1]], '-compose', 'Lighten', '-composite', ceiling]);
    const clamped = temp('clamped');
    run([channels[name], ceiling, '-compose', 'Darken', '-composite', clamped]);
    const kept = temp('kept');
    run([channels[name], interior, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', kept]);
    const merged = temp('merged');
    run([clamped, kept, '-compose', 'Over', '-composite', merged]);
    output[name] = merged;
  }
  const rgb = temp('rgb');
  run([output.R, channels.G, output.B, '-combine', '-alpha', 'off', rgb]);
  const result = temp('despilled');
  run([rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', result]);
  run([result, file]);
  return file;
}

/** Fuzz-key the border matte when present, then always despill the fringe. */
function keyOut(file) {
  const hex = matteOf(file);
  if (hex) {
    run([file, '-fuzz', '18%', '-transparent', hex, file]);
    run([file, '-fuzz', '34%', '-transparent', hex, file]);
  }
  despill(file);
  return Boolean(hex);
}

const log = (label, file) => console.log(`${label.padEnd(30)} ${file.replace(root, '')}  ${size(file)}`);

const isGray = (file) => /Colorspace:\s*Gray/.test(
  execFileSync('identify', ['-verbose', file], { encoding: 'utf8', maxBuffer: 1 << 26 }));

/** Gilds a grayscale painting through a gold colour ramp (umber shadows, bronze mids,
 *  pale-gold highlights) with a 5-stop CLUT. Recovers art whose colour was lost while it
 *  was being keyed, and reads as intentional painted gilt. Alpha is preserved. */
function gild(file, stops) {
  if (!isGray(file)) return false;
  const ramp = temp('ramp');
  const colors = stops ?? ['#1d150b', '#4a3417', '#9a7433', '#cfa752', '#f2dfae'];
  const draw = [];
  colors.forEach((hex, index) => draw.push('-fill', hex, '-draw', `point ${index},0`));
  run(['-size', `${colors.length}x1`, 'xc:none', ...draw, '-resize', '256x1!', ramp]);
  run([file, '-colorspace', 'srgb', ramp, '-clut', file]);
  return true;
}

/* 1. Goblin emblem -------------------------------------------------------------------
 * A solid shield keys to one chunky blob and is cut as-is. A delicate openwork crest
 * (alpha coverage below half) is mounted on a painted-iron disc so it stays chunky. */
keyOut(src('emblem-src.png'));
gild(src('emblem-src.png'));
{
  const emblem = src('emblem-src.png');
  const coverage = parseFloat(execFileSync('convert', [emblem, '-alpha', 'extract', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' }));
  if (coverage < 0.5) {
    const [width, height] = size(emblem).split('x').map(Number);
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);
    const radius = Math.round(Math.min(width, height) / 2) - 14;
    const disc = temp('disc');
    run(['-size', `${2 * radius}x${2 * radius}`, 'radial-gradient:#394036-#14180f', disc]);
    const discMask = temp('disc-mask');
    run(['-size', `${2 * radius}x${2 * radius}`, 'xc:none', '-fill', 'white',
      '-draw', `circle ${radius},${radius} ${radius},0`, discMask]);
    run([disc, discMask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', disc]);
    const placed = temp('disc-placed');
    run(['-size', `${width}x${height}`, 'xc:none', disc, '-geometry', `+${cx - radius}+${cy - radius}`, '-compose', 'Over', '-composite', placed]);
    const grained = temp('disc-grain');
    run([placed, '-attenuate', '1.1', '+noise', 'Gaussian', grained]);
    const rimmed = temp('disc-rim');
    run([grained,
      '-stroke', '#8a6f3a', '-strokewidth', '9', '-fill', 'none', '-draw', `circle ${cx},${cy} ${cx},${cy - radius + 4}`,
      '-stroke', '#d9b96f', '-strokewidth', '2', '-draw', `circle ${cx},${cy} ${cx},${cy - radius + 10}`,
      rimmed]);
    const rivet = (angle) => {
      const x = Math.round(cx + Math.cos(angle) * (radius - 26));
      const y = Math.round(cy + Math.sin(angle) * (radius - 26));
      return ['-fill', '#c9a558', '-stroke', '#4a3a1c', '-strokewidth', '2',
        '-draw', `circle ${x},${y} ${x},${y + 7}`];
    };
    const riveted = temp('disc-rivets');
    run([rimmed, ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => rivet((i * Math.PI) / 4 + Math.PI / 8)), riveted]);
    // The crest art sits on top of its shield.
    run([riveted, emblem, '-compose', 'Over', '-composite', emblem]);
  }
  run([emblem, '-trim', '+repage', '-resize', '512x512', out('art/goblin-emblem.png')]);
  log('goblin emblem', out('art/goblin-emblem.png'));
}

/* 2. Keyed cutouts ------------------------------------------------------------------ */
keyOut(src('aim-arrow-src.png'));
gild(src('aim-arrow-src.png'));
run([src('aim-arrow-src.png'), '-trim', '+repage', '-resize', '480x', out('art/aim-arrow.png')]);
log('aim arrow', out('art/aim-arrow.png'));

for (const [file, target, box, stops] of [
  [preSrc('map-panel-src.png'), preOut('map-panel.png'), 'x900',
    ['#201509', '#6b4a22', '#8a6a3d', '#c8a978', '#ecdcb8']],
  [preSrc('exit-glyph-src.png'), preOut('exit-glyph.png'), '80x80>', null],
]) {
  keyOut(file);
  gild(file, stops);
  run([file, '-trim', '+repage', '-resize', box, target]);
  log('cutout', target);
}

/* Heavy Metal GP 2 identity ---------------------------------------------------------
 * Chroma-green generated stickers are keyed before resize. They remain independent
 * overlays at runtime: the browser never scales them to match a panel or button. */
for (const [source, target, box] of [
  [src('menu-endcap-src.png'), out('art/ui/ornament-endcap.png'), '180x180>'],
  [src('heavymetal2-badge-src.png'), out('art/ui/emblem-heavy-metal-2.png'), '300x300>'],
]) {
  run([source, '-fuzz', '15%', '-transparent', '#00ff00', '-trim', '+repage', '-resize', box, target]);
  // Remove green and magenta contamination from anti-aliased edge pixels. Gold is
  // untouched because it is red/yellow dominant rather than green- or RB-dominant.
  run([target, '-channel', 'G', '-fx', 'g > 1.35*r && g > 1.35*b ? max(r,b) : g', '+channel', target]);
  run([target, '-channel', 'RB', '-fx', 'a < 0.96 && r > 1.12*g && b > 1.12*g ? g : u', '+channel', target]);
  log('HM2 keyed sticker', target);
}
run(['-size', '780x190', 'xc:none',
  '(', join(root, 'PreGame/src/assets/ui/logo.webp'), '-resize', '650x115>', ')', '-gravity', 'west', '-geometry', '+8+0', '-composite',
  '(', out('art/ui/emblem-heavy-metal-2.png'), '-resize', '150x150>', ')', '-gravity', 'east', '-geometry', '+8+0', '-composite',
  out('art/ui/logo-heavymetal2.png')]);
log('HM2 logo', out('art/ui/logo-heavymetal2.png'));
run([src('menu-heavy-metal-2-src.jpg'), '-resize', '1920x1080^', '-gravity', 'center', '-extent', '1920x1080', '-quality', '88', out('art/ui/menu-heavy-metal-2.jpg')]);
log('HM2 menu painting', out('art/ui/menu-heavy-metal-2.jpg'));
run([out('art/ui/emblem-heavy-metal-2.png'), '-resize', '220x220>', '-gravity', 'center', '-background', 'none', '-extent', '256x256', out('favicon-heavy-metal-2.png')]);
log('HM2 favicon', out('favicon-heavy-metal-2.png'));

/* 3. Favicon: rounded stone tile ----------------------------------------------------- */
run([src('favicon-src.png'), '-resize', '256x256',
  '(', '-size', '256x256', 'xc:none', '-draw', 'roundrectangle 0,0 255,255 44,44', ')',
  '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', out('favicon.png')]);
log('favicon', out('favicon.png'));

/* 4. UI chrome: frame, buttons, quiet stone backdrop --------------------------------- */
run([src('frame-src.png'), '-resize', '512x512', out('ui/frame-gold.png')]);
log('gold frame', out('ui/frame-gold.png'));
run([src('button-src.png'), '-resize', '720x', out('ui/button-gold.png')]);
log('gold button', out('ui/button-gold.png'));
run([src('button-hover-src.png'), '-resize', '720x', out('ui/button-gold-hover.png')]);
log('gold button (hover)', out('ui/button-gold-hover.png'));
run([src('frame-src.png'), '-gravity', 'center', '-crop', '310x310+0+0', '+repage', '-resize', '384x384',
  '-modulate', '78,62', '-fill', '#0e120d', '-colorize', '38', out('ui/stone-tile.png')]);
log('stone backdrop tile', out('ui/stone-tile.png'));

/* 5. Paintings: menu vista, seamless dirt -------------------------------------------- */
copyFileSync(src('menu-vista-src.png'), out('art/menu-vista.png'));
log('menu vista', out('art/menu-vista.png'));
// Windmill construction: a 2x2 of the crop and its mirrors is seamless by construction.
const dirt = src('dirt-src.png');
run([dirt, '-gravity', 'center', '-crop', '768x768+0+0', '+repage', dirt]);
run([dirt, '(', '-clone', '0', '-flop', ')', '-background', 'none', '+append', '+repage', dirt]);
run([dirt, '(', '-clone', '0', '-rotate', '180', ')', '-background', 'none', '-append', '+repage', dirt]);
run([dirt, '-resize', '1024x1024', out('art/dirt-tile.png')]);
log('seamless dirt tile', out('art/dirt-tile.png'));

console.log(`\nUI runtime art in public/ui: ${readdirSync(join(root, 'public/ui')).join(', ')}`);
