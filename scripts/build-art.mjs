#!/usr/bin/env node
/**
 * Converts the generated source sheets in `public/art/sheets/` into the runtime
 * sprites in `public/art/` and writes `src/game/art-manifest.json` (frame rectangles,
 * runtime sizes, normalized hull geometry, hatch circles) that the typed manifest reads.
 *
 * All pixel work happens here, at build time, with ImageMagick. The browser only decodes
 * finished PNGs; it never keys, crops or converts art at runtime.
 *
 *  - Matte detection: every key colour painted on a cell's own border is found by
 *    scanning the border pixels (the generator shades the matte across a sheet, so one
 *    sheet-wide key would leave whole cells opaque). Magenta #FF00FF is preferred, because
 *    goblins are green; #00FF00 is still supported.
 *  - Despill: the fringe is clamped to the matte-free channels only, so olive skin, mint
 *    springs and teal metal keep their colour instead of turning grey.
 *  - Capsule normalisation: every shell is scaled to one common hull diameter and
 *    re-centred, so armour never changes the collision envelope and the pilot insert
 *    lands in the same place in all three shells.
 *
 * Usage: node scripts/build-art.mjs
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sheets = join(root, 'public/art/sheets');
const out = join(root, 'public/art');
const work = join(root, 'tests/artifacts/art-build');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const magick = (args) => {
  if (process.env.ART_DEBUG) console.error('convert', args.join(' '));
  return execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
};
const identify = (format, file) => execFileSync('identify', ['-format', format, file], { encoding: 'utf8' }).trim();
const size = (file) => identify('%wx%h', file).split('x').map(Number);

let step = 0;
const temp = (tag) => join(work, `${tag}-${step}.png`);

/* ------------------------------- matte handling ------------------------------ */

const channelsOf = ([r, g, b]) => (r > 150 && b > 150 && g < 110 ? { name: 'magenta', clamp: ['R', 'B'] }
  : g > 120 && r < 110 && b < 110 && g > r + 60 && g > b + 60 ? { name: 'green', clamp: ['G'] } : null);
// Quantised to 8-step buckets (and clamped, so a rounded 256 cannot become a 4-digit hex).
const quantise = (value) => value.map((channel) => Math.min(255, Math.max(0, Math.round(channel / 8) * 8)));
const hexOf = (rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const rgbOf = (text) => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Reads pixel values in bulk: one ImageMagick call per strip instead of one per pixel. */
function stripColours(file, crop, tag) {
  const target = join(work, `strip-${tag}-${step}.png`);
  magick([file, '-crop', crop, '+repage', target]);
  const text = execFileSync('convert', [target, 'txt:-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  const counts = new Map();
  for (const line of text.split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const value = rgbOf(line.slice(separator + 1));
    if (value.length < 3) continue;
    const key = quantise(value).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Every key colour painted on a region's own border, most frequent first. */
function borderKeys(file, rect) {
  const totals = new Map();
  const strips = [
    `${rect.width}x3+0+0`, `${rect.width}x3+0+${rect.height - 3}`,
    `3x${rect.height}+0+0`, `3x${rect.height}+${rect.width - 3}+0`,
  ];
  for (const strip of strips) {
    for (const [key, hits] of stripColours(file, strip, 'scan')) totals.set(key, (totals.get(key) ?? 0) + hits);
  }
  return [...totals.entries()]
    .map(([key, hits]) => ({ rgb: key.split(',').map(Number), hits }))
    .filter((entry) => channelsOf(entry.rgb))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5)
    .map((entry) => ({ hex: hexOf(entry.rgb), ...channelsOf(entry.rgb) }));
}

function matteOf(file) {
  const [width, height] = size(file);
  const keys = borderKeys(file, { x: 0, y: 0, width, height });
  if (!keys.length) throw new Error(`No matte found on ${file}`);
  return keys[0];
}

/**
 * Clamps the matte's colour channels to the strongest remaining channel, but only on the
 * anti-aliased fringe. Opaque interior pixels keep their painted colour, which is why
 * green skin survives a green matte and pink trim would survive a magenta matte.
 */
function despill(file, matte) {
  const channels = {};
  for (const name of ['R', 'G', 'B']) {
    const target = temp(`chan${name}`);
    magick([file, '-channel', name, '-separate', target]);
    channels[name] = target;
  }
  const alpha = temp('alpha');
  magick([file, '-alpha', 'extract', alpha]);
  const interior = temp('interior');
  magick([alpha, '-threshold', '96%', interior]);

  const others = matte.clamp.includes('R') ? ['G', 'B'] : matte.clamp.includes('G') ? ['R', 'B'] : ['R', 'G'];
  const ceiling = temp('ceiling');
  magick([channels[others[0]], channels[others[1]], '-compose', 'Lighten', '-composite', ceiling]);

  const output = {};
  for (const name of ['R', 'G', 'B']) {
    if (!matte.clamp.includes(name)) { output[name] = channels[name]; continue; }
    const clamped = temp(`clamp${name}`);
    magick([channels[name], ceiling, '-compose', 'Darken', '-composite', clamped]);
    const kept = temp(`keep${name}`);
    magick([channels[name], interior, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', kept]);
    const merged = temp(`merge${name}`);
    magick([clamped, kept, '-compose', 'Over', '-composite', merged]);
    output[name] = merged;
  }
  // `-combine` in ImageMagick 6 silently drops a fourth channel, so alpha is attached
  // afterwards with CopyOpacity rather than being passed to -combine.
  const rgb = temp('rgb');
  magick([output.R, output.G, output.B, '-combine', '-alpha', 'off', rgb]);
  const result = temp('despilled');
  magick([rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', result]);
  return result;
}

/**
 * Crops a cell, keys every matte colour painted on that cell's border, despills and trims
 * to the real object bounds.
 */
function extract(sheet, rect, sheetMatte, { shave = 6 } = {}) {
  const crop = temp('crop');
  // Shaving the cell border first drops the faint divider lines the painter draws
  // between grid cells; without it they survive keying as stray white edges.
  magick([sheet, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', '-shave', `${shave}x${shave}`, crop]);
  const cellKeys = borderKeys(crop, { x: 0, y: 0, width: rect.width, height: rect.height });
  const keys = [...new Set([sheetMatte.hex, ...cellKeys.map((entry) => entry.hex)])];
  const clamp = [...new Set([sheetMatte.clamp, ...cellKeys.flatMap((entry) => entry.clamp)])];
  const args = [crop];
  for (const key of keys) args.push('-fuzz', '16%', '-transparent', key);
  const keyed = temp('keyed');
  magick([...args, keyed]);
  const clean = despill(keyed, { clamp });
  const trimmed = temp('trimmed');
  magick([clean, '-trim', '+repage', trimmed]);
  step += 1;
  return trimmed;
}

/** Bounding box of the largest opaque blob: the real drawn object, not the sheet cell. */
function hullBox(file) {
  const mask = temp('hull');
  magick([file, '-alpha', 'extract', '-threshold', '50%', mask]);
  const output = execFileSync('convert', [mask, '-define', 'connected-components:verbose=true', '-connected-components', '4', 'null:'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let best = null;
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*\d+:\s+(\d+)x(\d+)\+([\d-]+)\+([\d-]+)\s+([\d.]+),([\d.]+)\s+(\d+)/);
    if (!match) continue;
    const area = Number(match[7]);
    if (!best || area > best.area) best = { area, width: Number(match[1]), height: Number(match[2]), x: Number(match[3]), y: Number(match[4]) };
  }
  return best;
}

/** Scales a sprite so its hull diameter matches the target, then centres it on a square canvas. */
function normalize(trimmed, target, { diameter, canvas }) {
  const hull = hullBox(trimmed);
  const [width, height] = size(trimmed);
  const reference = Math.max(hull ? hull.width : width, hull ? hull.height : height);
  const scale = diameter / reference;
  const scaled = temp('scaled');
  magick([trimmed, '-resize', `${Math.max(1, Math.round(width * scale))}x${Math.max(1, Math.round(height * scale))}`, scaled]);
  const centreX = (hull ? hull.x + hull.width / 2 : width / 2) * scale;
  const centreY = (hull ? hull.y + hull.height / 2 : height / 2) * scale;
  const shiftX = Math.round(canvas / 2 - centreX);
  const shiftY = Math.round(canvas / 2 - centreY);
  const padded = temp('padded');
  const [scaledWidth, scaledHeight] = size(scaled);
  // Pad with transparent pixels, then roll the object to the canvas centre.
  magick([scaled, '-background', 'none', '-gravity', 'none',
    '-extent', `${scaledWidth + Math.abs(shiftX)}x${scaledHeight + Math.abs(shiftY)}`,
    '-roll', `${shiftX >= 0 ? -shiftX : -shiftX}+${shiftY >= 0 ? -shiftY : -shiftY}`, padded]);
  magick([padded, '-background', 'none', '-gravity', 'center', '-extent', `${canvas}x${canvas}`, '-strip', target]);
  return { scale, hull };
}

/** Fits a sprite inside a square box and centres it, keeping the whole silhouette. */
function fit(trimmed, target, box) {
  magick([trimmed, '-resize', `${box}x${box}>`, '-background', 'none', '-gravity', 'center', '-extent', `${box}x${box}`, '-strip', target]);
}

function grid(file, columns, rows) {
  const [width, height] = size(file);
  const cellWidth = Math.floor(width / columns);
  const cellHeight = Math.floor(height / rows);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) cells.push({ x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight });
  }
  return { file: `art/sheets/${file.split('/').pop()}`, width, height, columns, rows, cells };
}

const manifest = { generatedAt: new Date().toISOString().slice(0, 10), matte: {}, sheets: {}, cells: {} };
const record = (key, sheetName, sheet, index, target, extra = {}) => {
  const runtime = size(join(out, target));
  manifest.cells[key] = { sheet: sheetName, sheetCell: index, image: `art/${target}`, runtime: { width: runtime[0], height: runtime[1] }, ...extra };
};
/** Canonical key colour each detected matte targets, so the UI can state the intent. */
const CANONICAL = { magenta: '#FF00FF', green: '#00FF00' };
function sheetMatte(file, name) {
  const matte = matteOf(file);
  manifest.matte[name] = { hex: matte.hex, detected: matte.name, canonical: CANONICAL[matte.name], despill: matte.clamp };
  console.log(`  ${name}: ${matte.name} matte ${matte.hex} (target ${CANONICAL[matte.name]}), despill ${matte.clamp.join('/')}`);
  return matte;
}

/**
 * Measures the open cockpit hatch of a normalized shell: the near-black, fully opaque
 * blob in the lower-right quadrant of the sprite. Automatic, because a guessed anchor
 * would put the pilot through the hull; `tests/artifacts/hatch-probe.png` draws the
 * measurement over the art for every build so a bad measurement is visible immediately.
 */
function hatchOf(sprite, canvas = 512) {
  const alpha = temp('hatchalpha');
  magick([sprite, '-alpha', 'extract', '-threshold', '60%', alpha]);
  const dark = temp('hatchdark');
  magick([sprite, '-colorspace', 'gray', '-threshold', '12%', '-negate', dark]);
  const both = temp('hatchboth');
  magick([dark, alpha, '-compose', 'Multiply', '-composite', both]);
  const output = execFileSync('convert', [both, '-define', 'connected-components:verbose=true', '-connected-components', '8', 'null:'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let best = null;
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*\d+:\s+(\d+)x(\d+)\+([\d-]+)\+([\d-]+)\s+([\d.]+),([\d.]+)\s+(\d+)/);
    if (!match) continue;
    const [, width, height, x, y, cx, cy, area] = match;
    // The hatch is the big opening towards the viewer, low and right of centre.
    if (Number(cx) < canvas * 0.5 || Number(cy) < canvas * 0.35) continue;
    if (!best || Number(area) > best.area) {
      best = { area: Number(area), width: Number(width), height: Number(height), x: Number(x), y: Number(y), cx: Number(cx), cy: Number(cy) };
    }
  }
  if (!best || best.area < canvas * canvas * 0.005) return null;
  const rx = best.width / 2 / canvas;
  const ry = best.height / 2 / canvas;
  return { x: best.cx / canvas, y: best.cy / canvas, rx, ry, radius: Math.max(rx, ry), measured: true };
}
/** Where the eyes sit in a trimmed rider bust, used to seat the pilot inside the hatch. */
const EYE_LINE = 0.44;

/* ---------------------------------- riders ---------------------------------- */

/**
 * The four riders are repurposed from the predecessor project's painted portrait sheet
 * (`PreGame/assets/portraits/user_portraits.png`). That art already carries a real alpha
 * channel, so it is only cropped, trimmed and scaled here - no keying, no loss of the soft
 * edge antialiasing. Cells are chosen to match the existing rider personalities.
 */
const RIDER_CELLS = [
  { id: 'rivet', cell: 0, note: 'leather aviator cap and brass goggles' },
  { id: 'nix', cell: 8, note: 'asymmetric hair, goggles, wide grin' },
  { id: 'grub', cell: 11, note: 'battered spiked helmet, heavy jaw' },
  { id: 'sprocket', cell: 3, note: 'coiled-helmet tinkerer' },
];

{
  const source = join(root, 'PreGame/assets/portraits/user_portraits.png');
  const shipped = join(sheets, 'riders-source.png');
  copyFileSync(source, shipped);
  const sheet = grid(shipped, 5, 3);
  manifest.sheets.riders = { ...sheet, file: 'art/sheets/riders-source.png', alpha: 'painted' };
  for (const rider of RIDER_CELLS) {
    const rect = sheet.cells[rider.cell];
    const crop = temp(`rider-${rider.id}`);
    magick([shipped, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', '-shave', '6x6', crop]);
    const trimmed = temp(`rider-trim-${rider.id}`);
    magick([crop, '-trim', '+repage', trimmed]);
    fit(trimmed, join(out, `${rider.id}-portrait.png`), 512);
    // The cockpit insert is the head, so the face fills the hatch opening.
    const [width, height] = size(trimmed);
    const head = temp(`rider-head-${rider.id}`);
    magick([trimmed, '-crop', `${width}x${Math.round(height * 0.68)}+0+0`, '+repage', head]);
    fit(head, join(out, `${rider.id}-pilot.png`), 256);
    record(`rider:${rider.id}`, 'riders', sheet, rider.cell, `${rider.id}-portrait.png`, {
      action: 'portrait', anchor: 'center', note: rider.note, pilot: `art/${rider.id}-pilot.png`,
      pilotRuntime: size(join(out, `${rider.id}-pilot.png`)), eyeLine: EYE_LINE,
    });
  }
}

/* --------------------------------- capsules --------------------------------- */

{
  const file = join(sheets, 'capsules-sheet.png');
  const sheet = grid(file, 3, 1);
  const matte = sheetMatte(file, 'capsules');
  manifest.sheets.capsules = sheet;
  ['iron', 'springsteel', 'siege'].forEach((id, index) => {
    const trimmed = extract(file, sheet.cells[index], matte);
    const hull = normalize(trimmed, `${id}-shell.png`, { diameter: 452, canvas: 512 });
    const sprite = join(out, `${id}-shell.png`);
    const hatch = hatchOf(sprite) ?? { x: 0.66, y: 0.5, rx: 0.09, ry: 0.13, radius: 0.13, measured: false };
    console.log(`  capsule ${id}: hatch at ${hatch.x.toFixed(3)},${hatch.y.toFixed(3)} rx ${hatch.rx.toFixed(3)} ry ${hatch.ry.toFixed(3)}${hatch.measured ? '' : ' (fallback measurement)'}`);
    record(`capsule:${id}`, 'capsules', sheet, index, `${id}-shell.png`, {
      action: 'shell', anchor: 'center', pivot: { x: 0.5, y: 0.5 }, envelope: 1,
      hull: { diameter: 452, canvas: 512, scale: Number(hull.scale.toFixed(4)) },
      hatch,
    });
  });
}

/* --------------------------------- supplies --------------------------------- */

// The supplies are generated as individual single-subject images keyed on magenta: a
// blue glow keyed against a green matte bakes a green rim into the artwork, and a shaded
// matte cannot be removed by a single sheet-wide key.
['fuel', 'shield', 'bounce'].forEach((id) => {
  const file = join(sheets, `supply-${id}.png`);
  const [width, height] = size(file);
  const matte = matteOf(file);
  manifest.matte[`supply-${id}`] = { hex: matte.hex, detected: matte.name, canonical: CANONICAL[matte.name], despill: matte.clamp };
  const sheet = { file: `art/sheets/supply-${id}.png`, width, height, columns: 1, rows: 1, cells: [{ x: 0, y: 0, width, height }] };
  manifest.sheets[`supply-${id}`] = sheet;
  console.log(`  supply-${id}: ${matte.name} matte ${matte.hex} (target ${CANONICAL[matte.name]}), despill ${matte.clamp.join('/')}`);
  fit(extract(file, sheet.cells[0], matte), join(out, `${id}-supply.png`), 256);
  record(`supply:${id}`, `supply-${id}`, sheet, 0, `${id}-supply.png`, { action: 'icon', anchor: 'center' });
});

/* -------------------------------- landmarks --------------------------------- */

{
  const file = join(sheets, 'landmarks-sheet.png');
  const sheet = grid(file, 2, 2);
  const matte = sheetMatte(file, 'landmarks');
  manifest.sheets.landmarks = sheet;
  ['pines', 'quarry', 'windmill', 'pasture'].forEach((id, index) => {
    const trimmed = extract(file, sheet.cells[index], matte);
    magick([trimmed, '-resize', '512x512>', '-strip', join(out, `landmark-${id}.png`)]);
    // Props stand on the ground, so their baseline is the bottom of the trimmed sprite.
    record(`landmark:${id}`, 'landmarks', sheet, index, `landmark-${id}.png`, { action: 'prop', anchor: 'bottom', baseline: 1 });
  });
}

/* ----------------------------------- blimp ---------------------------------- */

{
  const file = join(sheets, 'blimp.png');
  const [width, height] = size(file);
  const matte = sheetMatte(file, 'blimp');
  const sheet = { file: 'art/sheets/blimp.png', width, height, columns: 1, rows: 1, cells: [{ x: 0, y: 0, width, height }] };
  manifest.sheets.blimp = sheet;
  const trimmed = extract(file, sheet.cells[0], matte);
  magick([trimmed, '-resize', '900x900>', '-strip', join(out, 'blimp.png')]);
  record('prop:blimp', 'blimp', sheet, 0, 'blimp.png', { action: 'prop', anchor: 'center', facing: 'right' });
}

/* --------------------------------- courses ---------------------------------- */

{
  const file = join(sheets, 'courses-sheet.png');
  const sheet = grid(file, 1, 3);
  manifest.sheets.courses = sheet;
  ['ridge', 'boomtown', 'sheep'].forEach((id, index) => {
    const rect = sheet.cells[index];
    magick([file, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage',
      '-resize', '800x440^', '-gravity', 'center', '-extent', '800x440', '-strip', '-quality', '92', join(out, `${id}-course.png`)]);
    record(`course:${id}`, 'courses', sheet, index, `${id}-course.png`, { action: 'preview', source: rect });
  });
}

writeFileSync(join(root, 'src/game/art-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(root, 'tests/artifacts/art-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${Object.keys(manifest.cells).length} sprites from ${Object.keys(manifest.sheets).length} sheets.`);

/* ------------------------- verification contact sheets ---------------------- */

const verify = ['rivet-portrait.png', 'nix-portrait.png', 'grub-portrait.png', 'sprocket-portrait.png',
  'iron-shell.png', 'springsteel-shell.png', 'siege-shell.png', 'fuel-supply.png', 'shield-supply.png',
  'bounce-supply.png', 'blimp.png', 'landmark-pines.png', 'landmark-quarry.png', 'landmark-windmill.png', 'landmark-pasture.png'];

const tiles = verify.map((name, index) => {
  const tile = join(work, `tile-${index}.png`);
  magick(['-size', '340x340', 'pattern:checkerboard', '-resize', '340x340!', join(out, name), '-resize', '300x300>',
    '-gravity', 'center', '-composite', '-bordercolor', '#2b3128', '-border', '1', tile]);
  return tile;
});
execFileSync('montage', ['-background', '#171b14', '-tile', '4x', '-geometry', '+8+8', ...tiles, join(root, 'tests/artifacts/alpha-check.png')]);

const probes = ['iron', 'springsteel', 'siege'].map((id, index) => {
  const target = join(work, `hatch-${index}.png`);
  const hatch = manifest.cells[`capsule:${id}`].hatch;
  const cx = Math.round(hatch.x * 512);
  const cy = Math.round(hatch.y * 512);
  const rx = Math.round((hatch.rx ?? hatch.radius) * 512);
  const ry = Math.round((hatch.ry ?? hatch.radius) * 512);
  magick([join(out, `${id}-shell.png`), '-fill', 'none', '-stroke', 'magenta', '-strokewidth', '3',
    '-draw', `ellipse ${cx},${cy} ${rx},${ry} 0,360`, target]);
  return target;
});
execFileSync('montage', ['-background', '#22262c', '-tile', '3x', '-geometry', '+6+6', ...probes, join(root, 'tests/artifacts/hatch-probe.png')]);

rmSync(work, { recursive: true, force: true });
