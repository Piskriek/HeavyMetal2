/**
 * WIRE-4: the builder's shelves and the setup screen's arc gauges are painted art, not SVG strokes.
 *
 * Run with: `node --import tsx --test tests/painted-icons.test.ts` (also registered in scripts/check.mjs).
 *
 * As with the cockpit suite, correctness is arithmetic plus facts about the finished PNGs: every
 * primitive and light preset must point at a painted icon that exists on disk, no data-URI SVG may
 * remain in the two catalogues, and the arc gauge's needle maths must agree with the sweep its
 * painted face actually prints — ticks from the lower left, over the top, to the lower right, with
 * the orange danger band at the end — measured here straight from the shipped pixels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PRIMITIVE_DEFINITIONS } from '../src/game/builder/primitives';
import { LIGHT_DEFINITIONS } from '../src/game/builder/light-rig';
import {
  ARC_FACE_URL, ARC_NEEDLE_URL, ARC_VIEWBOX, ARC_START_DEG, ARC_SWEEP_DEG, ARC_FACE_RECT,
  ARC_NEEDLE_HUB, ARC_NEEDLE_TIP_Y, ARC_NEEDLE_TIP_RADIUS, ARC_NEEDLE_RECT, arcNeedleAngle,
} from '../src/components/ui/BlizzardGauge';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicFile = (url: string) => join(root, 'public', url.replace(/^\//, ''));
const srcFile = (name: string) => readFileSync(join(root, 'src', name), 'utf8');

/** Minimal PNG reader for the shipped sprites: 8-bit RGBA, non-interlaced (all of them are). */
function decodePng(path: string): { w: number; h: number; at: (x: number, y: number) => [number, number, number, number] } {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
  assert.equal(buf.readUInt32BE(16) > 0 && buf[8 + 8 + 8], 8, `${path} must be 8-bit`);
  let pos = 8, w = 0, h = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  assert.equal(colorType, 6, `${path} must be RGBA (keyed art)`);
  const channels = 4, stride = w * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * channels);
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = row[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  return {
    w, h,
    at: (x, y) => {
      const o = (y * w + x) * channels;
      return [out[o], out[o + 1], out[o + 2], out[o + 3]];
    },
  };
}

/** A painted icon must exist, be a real PNG and be shelf-sized (the set is 256 px class). */
function assertPaintedIcon(url: string) {
  assert.match(url, /^\/art\/ui\/icons\//, `${url} must be a painted UI icon under /art/ui/icons/`);
  const path = publicFile(url);
  assert.ok(existsSync(path), `${url} must exist on disk`);
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${url} must be a PNG`);
  assert.ok(buffer.readUInt32BE(16) >= 128 && buffer.readUInt32BE(20) >= 128, `${url} must be shelf-sized art`);
}

test('primitives: every shape on the shelf has its painted icon, under its painted name', () => {
  // The shelf name and the file can differ: the ramp is painted as a wedge, the plane as a panel.
  const expected: Record<string, string> = {
    prim_box: 'box', prim_sphere: 'sphere', prim_cylinder: 'cylinder', prim_cone: 'cone', prim_torus: 'torus',
    prim_ramp: 'wedge', prim_plane: 'panel', prim_rock: 'rock', prim_capsule: 'capsule', prim_arch: 'arch',
  };
  const primitives = PRIMITIVE_DEFINITIONS.filter((d) => d.category === 'primitives');
  assert.equal(primitives.length, 10, 'ten primitive shapes');
  for (const def of primitives) {
    const file = expected[def.type];
    assert.ok(file, `${def.type} is a known shape`);
    assert.equal(def.url, `/art/ui/icons/builder-prim-${file}.png`, `${def.type} points at its painted icon`);
    assertPaintedIcon(def.url);
  }
});

test('lights: every preset has its painted icon', () => {
  const expected: Record<string, string> = {
    light_lantern: 'lantern', light_torch: 'torch', light_crystal: 'crystal', light_lava: 'lava',
    light_worklamp: 'worklamp', light_bulb: 'bulb',
  };
  const lights = LIGHT_DEFINITIONS.filter((d) => d.category === 'lights');
  assert.equal(lights.length, 6, 'six light presets');
  for (const def of lights) {
    const file = expected[def.type];
    assert.ok(file, `${def.type} is a known preset`);
    assert.equal(def.url, `/art/ui/icons/builder-light-${file}.png`, `${def.type} points at its painted icon`);
    assertPaintedIcon(def.url);
  }
});

test('no amber line drawings remain in the two catalogues', () => {
  for (const name of ['game/builder/primitives.ts', 'game/builder/light-rig.ts']) {
    const source = srcFile(name);
    assert.ok(!source.includes('data:image/svg'), `${name} must not build SVG data-URI icons`);
  }
});

test('arc gauge: the needle maths is start + fraction × sweep, clamped, like the SVG version was', () => {
  assert.equal(ARC_SWEEP_DEG, 270, 'the sweep is still 270°');
  assert.equal(arcNeedleAngle(0, 10), ARC_START_DEG, 'zero rests at the start');
  assert.equal(arcNeedleAngle(10, 10), ARC_START_DEG + 270, 'the max lands at the end of the sweep');
  assert.equal(arcNeedleAngle(5, 10), ARC_START_DEG + 135, 'halfway is straight up');
  assert.equal(arcNeedleAngle(3, 10), ARC_START_DEG + 81);
  assert.equal(arcNeedleAngle(-4, 10), ARC_START_DEG, 'below the range clamps');
  assert.equal(arcNeedleAngle(99, 10), ARC_START_DEG + 270, 'above the range clamps');
  assert.equal(arcNeedleAngle(7), ARC_START_DEG + 189, 'max defaults to 10 as before');
});

test('arc gauge: the painted face prints the sweep the needle turns through', () => {
  assertPaintedIcon(ARC_FACE_URL);
  assert.ok(existsSync(publicFile(ARC_NEEDLE_URL)), `${ARC_NEEDLE_URL} must exist on disk`);
  const face = decodePng(publicFile(ARC_FACE_URL));
  assert.deepEqual([face.w, face.h], [256, 256], 'the face is the 256² sprite');

  // The dial is centred: the solid (keyed) art's bounding box is the bezel, and it is centred.
  let minX = 256, minY = 256, maxX = -1, maxY = -1;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (face.at(x, y)[3] > 128) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  assert.ok(Math.abs(centre.x - 127.5) <= 3 && Math.abs(centre.y - 127.5) <= 3, `the dial is centred (${centre.x}, ${centre.y})`);
  // Drawn over the whole viewBox, that centre is the gauge centre to well under a unit.
  const drawnCentre = ARC_FACE_RECT.w * (centre.x / face.w);
  assert.ok(Math.abs(drawnCentre - ARC_VIEWBOX / 2) <= 0.75, `the drawn dial centre is (60, 60), got ${drawnCentre.toFixed(2)}`);

  // Classify 5° slots around the tick band (r 78..88 px): marked = a tick, engraved mark or the
  // orange danger band; clean = bare dial. Angles are clockwise from 12 o'clock, as the gauge's.
  const slots: { deg: number; marked: number; orange: number }[] = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg / 360) * Math.PI * 2 - Math.PI / 2;
    let marked = 0, orange = 0;
    for (let r = 78; r <= 88; r++) {
      const x = Math.round(centre.x + Math.cos(rad) * r);
      const y = Math.round(centre.y + Math.sin(rad) * r);
      const [R, G, B] = face.at(x, y);
      const isOrange = R > 140 && G > 30 && G < 140 && B < 70 && R - B > 90;
      const isEngraved = (R < 60 && R - B > 12) || (R > 80 && G > 55 && B < 80 && R >= G);
      if (isOrange) { marked++; orange++; } else if (isEngraved) marked++;
    }
    slots.push({ deg, marked, orange });
  }
  const isMarked = (deg: number) => slots.find((s) => s.deg === deg)!.marked >= 5;
  const isOrange = (deg: number) => slots.find((s) => s.deg === deg)!.orange >= 5;

  // The one long clean run is the gap under the sweep's rest position (straight down).
  let best = { start: 0, length: 0 };
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].marked >= 5) continue;
    let length = 0;
    while (length < slots.length && slots[(i + length) % slots.length].marked < 5) length++;
    if (length > best.length) best = { start: slots[i].deg, length };
    i += length; // skip the whole run
  }
  assert.ok(best.length >= 8 && best.length <= 16, `one painted gap, ${best.length * 5}° wide (not a scattering of holes)`);
  const gapStart = best.start - 2.5, gapEnd = best.start + best.length * 5 - 2.5;
  const gapCentre = (gapStart + gapEnd) / 2;
  assert.ok(Math.abs(gapCentre - 180) <= 12, `the gap sits straight down (centred ${gapCentre}°)`);
  // The needle's rest gap is the mirror sector (135°, 225°) around it.
  assert.ok(gapEnd <= ARC_START_DEG && ARC_START_DEG <= gapEnd + 25, `rest ${ARC_START_DEG}° sits just inside the painted ticks (gap ends ${gapEnd}°)`);
  const maxDeg = (ARC_START_DEG + ARC_SWEEP_DEG) % 360;
  assert.ok(gapStart - 25 <= maxDeg && maxDeg <= gapStart, `max ${maxDeg}° sits just inside the painted ticks (gap starts ${gapStart}°)`);
  // And the sweep itself never points into the gap.
  for (let deg = 0; deg < 360; deg += 5) {
    const inGap = deg > gapStart + 2 && deg < gapEnd - 2;
    const norm = (deg - ARC_START_DEG + 360) % 360;
    if (inGap) assert.ok(norm > ARC_SWEEP_DEG, `${deg}° is in the painted gap, the needle must never point there`);
  }
  // The major ticks every 30° inside the sweep are all painted.
  for (let deg = 240; deg <= 480; deg += 30) assert.ok(isMarked(deg % 360), `${deg % 360}° carries a painted tick inside the sweep`);

  // The orange danger band is one run at the end of the sweep, and the needle's max lands inside it.
  // (The run walk bridges the dark major ticks painted across the band: single 5° slots.)
  const orangeAt = (deg: number) => isOrange(deg);
  let danger = { start: 0, length: 0 };
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    if (!orangeAt(deg)) continue;
    let length = 0, miss = 0;
    while (length + miss < 72) {
      if (orangeAt((deg + (length + miss) * 5) % 360)) { length += miss + 1; miss = 0; }
      else if (miss < 2) miss++;
      else break;
    }
    if (length > danger.length) danger = { start: deg, length };
  }
  const dangerEnd = danger.start + danger.length * 5 - 2.5;
  assert.ok(danger.length >= 15, `a real danger band, ${danger.length * 5}° of orange`);
  assert.ok(danger.start <= 60 && dangerEnd >= 130, `the band covers the last third of the sweep (${danger.start}°..${dangerEnd}°)`);
  assert.ok(maxDeg >= danger.start && maxDeg <= dangerEnd, `the needle's max (${maxDeg}°) lands inside the painted danger band`);
});

test('arc gauge: the needle sprite is drawn hub-on-centre, tip as far as the old SVG needle reached', () => {
  const needle = decodePng(publicFile(ARC_NEEDLE_URL));
  assert.deepEqual([needle.w, needle.h], [53, 256], 'the needle is the 53×256 sprite');

  // Measure the sprite the way the component's constants claim it: the blade tip at the top, the
  // hub the wide dark knob at the bottom, its centre on the sprite's centre line.
  const solid = (x: number, y: number) => needle.at(x, y)[3] > 128;
  let minY = 256;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 53; x++) if (solid(x, y)) { if (y < minY) minY = y; y = 256; break; }
  assert.ok(minY <= 6, `the blade reaches the top of the sprite (tip row ${minY})`);
  assert.ok(Math.abs(minY - ARC_NEEDLE_TIP_Y) <= 5, `the tip row matches the constant (${ARC_NEEDLE_TIP_Y})`);
  let widest = { y: 0, w: 0, cx: 0 };
  const rows: number[] = [];
  for (let y = 128; y < 256; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < 53; x++) if (solid(x, y)) { if (l < 0) l = x; r = x; }
    const w = r - l + 1;
    if (w > widest.w) { widest = { y, w, cx: (l + r) / 2 }; rows.length = 0; rows.push(y); }
    else if (w === widest.w) rows.push(y);
  }
  const hubY = rows[Math.floor(rows.length / 2)];
  assert.ok(widest.w >= 40, `the hub is the wide knob at the bottom (${widest.w} px)`);
  assert.ok(Math.abs(widest.cx - ARC_NEEDLE_HUB.x) <= 3, `the hub sits on the sprite's centre line (measured ${widest.cx})`);
  assert.ok(Math.abs(hubY - ARC_NEEDLE_HUB.y) <= 4, `the hub centre row matches the constant (measured ${hubY})`);

  // The drawn rectangle puts that hub exactly on the dial centre and the tip 36 units out.
  const scale = ARC_NEEDLE_RECT.w / needle.w;
  assert.ok(Math.abs(ARC_NEEDLE_RECT.x + ARC_NEEDLE_HUB.x * scale - ARC_VIEWBOX / 2) <= 0.01, 'the hub is drawn on the dial centre (x)');
  assert.ok(Math.abs(ARC_NEEDLE_RECT.y + ARC_NEEDLE_HUB.y * scale - ARC_VIEWBOX / 2) <= 0.01, 'the hub is drawn on the dial centre (y)');
  const tipRadius = (ARC_NEEDLE_HUB.y - ARC_NEEDLE_TIP_Y) * scale;
  assert.ok(Math.abs(tipRadius - ARC_NEEDLE_TIP_RADIUS) <= 0.01, 'the blade tip stops at the constant radius');
  assert.ok(ARC_NEEDLE_TIP_RADIUS >= 34 && ARC_NEEDLE_TIP_RADIUS <= 38, 'the tip reaches as far as the old SVG needle did (36)');
  // Measured against the pixels, not just the constants.
  const measuredTip = (hubY - minY) * scale;
  assert.ok(measuredTip >= ARC_NEEDLE_TIP_RADIUS - 2 && measuredTip <= ARC_NEEDLE_TIP_RADIUS + 2, `the painted blade's measured reach is ${measuredTip.toFixed(1)} units`);
});

test('arc gauge: the variant renders the two sprites, no SVG strokes, and honours reduced motion', () => {
  const source = srcFile('components/ui/BlizzardGauge.tsx');
  const arcBody = source.slice(source.indexOf('function ArcGauge'), source.indexOf('function DialGauge'));
  assert.ok(arcBody.includes(`href={ARC_FACE_URL}`) && arcBody.includes(`href={ARC_NEEDLE_URL}`), 'the arc draws the painted face and needle');
  assert.ok(arcBody.includes('gauge-needle arc-needle'), 'the needle keeps the transition class, tagged as the arc one');
  for (const stroke of ['<circle', 'gauge-tick', 'arcPath', 'gauge-value-arc', 'gauge-bezel']) {
    assert.ok(!arcBody.includes(stroke), `the arc variant no longer draws SVG ${stroke}`);
  }
  assert.ok(source.slice(source.indexOf('function DialGauge'), source.indexOf('function MeterBar')).includes('gauge-bezel'), 'the dial variant is untouched');
  // The CSS transition survives, and switches off under prefers-reduced-motion.
  const css = srcFile('hud.css');
  assert.match(css, /\.gauge-needle \{[^}]*transition: transform \.55s/, 'the needle glide is still a CSS transition');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.blizzard-gauge \.arc-needle \{ transition: none; \} \}/, 'no glide under reduced motion');
});

test('the builder warms its painted shelf icons as it opens', () => {
  const source = srcFile('components/TrackBuilderUI.tsx');
  assert.match(source, /const PAINTED_SHELF_ICON_URLS = \[[\s\S]*?category === 'primitives' \|\| p\.category === 'lights'[\s\S]*?custom-model\.png/, 'the preload list covers the shelves');
  assert.match(source, /useEffect\(\(\) => \{\s*for \(const url of PAINTED_SHELF_ICON_URLS\)/, 'the list is warmed when the builder opens');
  // And every URL it would warm exists.
  for (const def of [...PRIMITIVE_DEFINITIONS, ...LIGHT_DEFINITIONS]) assertPaintedIcon(def.url);
  assertPaintedIcon('/art/ui/icons/custom-model.png');
});
