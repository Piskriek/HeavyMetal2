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
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
const quantise = (value) => value.map((channel) => Math.round(channel / 8) * 8);
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
    .map((entry) => ({ hex: `rgb(${entry.rgb.join(',')})`, ...channelsOf(entry.rgb) }));
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
function extract(sheet, rect, sheetMatte) {
  const crop = temp('crop');
  magick([sheet, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', crop]);
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
function sheetMatte(file, name) {
  const matte = matteOf(file);
  manifest.matte[name] = { hex: matte.hex, detected: matte.name, despill: matte.clamp };
  console.log(`  ${name}: ${matte.name} matte ${matte.hex}, despill ${matte.clamp.join('/')}`);
  return matte;
}

/**
 * Hatch circles as fractions of the normalized capsule sprite. Measured against the
 * painted art with an overlay probe (tests/artifacts/hatch-probe.png) and verified for
 * every build, because a guessed anchor would put the pilot through the hull.
 */
const HATCH = { iron: { x: 0.660, y: 0.500, r: 0.133 }, springsteel: { x: 0.648, y: 0.492, r: 0.138 }, siege: { x: 0.660, y: 0.500, r: 0.126 } };
/** Where the eyes sit in a trimmed rider bust, used to seat the pilot inside the hatch. */
const EYE_LINE = 0.44;

/* ---------------------------------- riders ---------------------------------- */

{
  const file = join(sheets, 'riders-sheet.png');
  const sheet = grid(file, 2, 2);
  const matte = sheetMatte(file, 'riders');
  manifest.sheets.riders = sheet;
  ['rivet', 'nix', 'grub', 'sprocket'].forEach((id, index) => {
    const trimmed = extract(file, sheet.cells[index], matte);
    fit(trimmed, join(out, `${id}-portrait.png`), 512);
    fit(trimmed, join(out, `${id}-pilot.png`), 256);
    record(`rider:${id}`, 'riders', sheet, index, `${id}-portrait.png`, {
      action: 'portrait', anchor: 'center', pilot: `art/${id}-pilot.png`,
      pilotRuntime: size(join(out, `${id}-pilot.png`)), eyeLine: EYE_LINE,
    });
  });
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
    const hatch = HATCH[id];
    record(`capsule:${id}`, 'capsules', sheet, index, `${id}-shell.png`, {
      action: 'shell', anchor: 'center', pivot: { x: 0.5, y: 0.5 }, envelope: 1,
      hull: { diameter: 452, canvas: 512, scale: Number(hull.scale.toFixed(4)) },
      hatch: { x: hatch.x, y: hatch.y, radius: hatch.r, measured: true },
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
  manifest.matte[`supply-${id}`] = { hex: matte.hex, detected: matte.name, despill: matte.clamp };
  const sheet = { file: `art/sheets/supply-${id}.png`, width, height, columns: 1, rows: 1, cells: [{ x: 0, y: 0, width, height }] };
  manifest.sheets[`supply-${id}`] = sheet;
  console.log(`  supply-${id}: ${matte.name} matte ${matte.hex}, despill ${matte.clamp.join('/')}`);
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
  const r = Math.round(hatch.radius * 512);
  magick([join(out, `${id}-shell.png`), '-fill', 'none', '-stroke', 'magenta', '-strokewidth', '3',
    '-draw', `circle ${cx},${cy} ${cx},${cy + r}`, target]);
  return target;
});
execFileSync('montage', ['-background', '#22262c', '-tile', '3x', '-geometry', '+6+6', ...probes, join(root, 'tests/artifacts/hatch-probe.png')]);

rmSync(work, { recursive: true, force: true });
