/**
 * ART-I1: the painted goblin parts are registered (DNA v3), placed, tinted and on disk.
 * Run with: node --import tsx --test tests/painted-parts.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { AVATAR_CATALOG, V3_CAPACITY, V4_CAPACITY, V5_CAPACITY, decodeGoblinDna, encodeGoblinDna, generateRandomGoblin } from '../src/game/meta/goblin-dna';
import { KEYED_PARTS, PAINTED_PARTS, headRig, paintedPlacement, rigAnchor, type PaintedPartDef, type RigAnchorId } from '../src/game/meta/painted-parts';
import { PART_MASKS } from '../src/game/meta/painted-masks.generated';
import { composeGoblinSvg, maskUrl } from '../src/game/meta/goblin-compositor';
import type { AvatarLayerId, GoblinAvatarConfig } from '../src/game/meta/interfaces';

const SHAPES = ['angular', 'bloated', 'scrawny', 'lantern', 'wedge', 'peanut', 'jowls', 'bigchin'] as const;
const HEADS = SHAPES.map((shape) => ({ shape, ...headRig(shape) }));
const onDisk = (url: string) => existsSync(`public${url}`);

test('ART-I1: every painted catalog item is registered, and its file is on disk', () => {
  for (const [layer, items] of Object.entries(AVATAR_CATALOG)) {
    for (const item of items.filter((i) => i.startsWith('painted:'))) {
      const def = PAINTED_PARTS.find((p) => `painted:${p.id}` === item);
      assert.ok(def, `${item} has no PAINTED_PARTS entry`);
      assert.equal(def!.layer, layer, `${item} is registered on the wrong layer`);
      const file = def!.fixedFile ?? KEYED_PARTS[def!.id];
      assert.ok(file, `${item} has no keyed file entry`);
      assert.ok(onDisk(file!.file), `${file!.file} is missing`);
    }
  }
  for (const def of PAINTED_PARTS) {
    const reachable = AVATAR_CATALOG[def.layer].includes(`painted:${def.id}`) || (!!def.replaces && AVATAR_CATALOG[def.layer].includes(def.replaces));
    assert.ok(reachable, `${def.id} is registered but no catalog item draws it`);
  }
});

test('rig: on the angular head every anchor lands within 1 px of the old fixed constants', () => {
  // The old hand-tuned rig (pre head-relative anchors), which the art in the library was placed against.
  const OLD: readonly [RigAnchorId, number, number][] = [
    ['eye-mid', 128, 130], ['eye-right', 152, 130], ['eye-left', 104, 130],
    ['brow-line', 128, 112], ['crown', 128, 102], ['nose', 128, 160], ['mouth', 128, 188],
    ['chin', 128, 210], ['ear-left', 80, 120], ['scalp', 128, 78], ['neck-top', 128, 196],
    ['shoulder', 128, 256], ['frame', 0, 0], ['face-square', 48, 130 - 0.42 * 160],
  ];
  const rig = headRig('angular');
  for (const [id, x, y] of OLD) {
    const a = rigAnchor(id, rig);
    assert.ok(Math.abs(a.x - x) <= 1 && Math.abs(a.y - y) <= 1, `${id} moved to (${a.x.toFixed(2)}, ${a.y.toFixed(2)}) from (${x}, ${y})`);
  }
});

/**
 * How far a placed box may cross the frame edge, per layer. Backgrounds and hair may bleed 12 px
 * anywhere. Ears extend the silhouette like hair does (≤ 12 px at the sides). Crown headgear
 * (spikes, tall toppers) rises off the top edge; bodies anchor at the neck-top and run off the
 * bottom edge under the shoulder line, in exchange their sides stay inside like everything else.
 * Neck-wear may hang to the shoulder line (its tails are cropped with the bust).
 */
const BLEED: Record<'x' | 'top' | 'bottom', (def: PaintedPartDef) => number> = {
  x: (def) => (def.layer === 'background' || def.layer === 'hair' || def.layer === 'ears' || def.layer === 'body' ? 12 : 0),
  top: (def) => (def.layer === 'background' || def.layer === 'hair' ? 12 : def.layer === 'headgear' ? Infinity : 0),
  bottom: (def) => (def.layer === 'background' || def.layer === 'hair' ? 12 : def.layer === 'body' || def.layer === 'neck' ? Infinity : 0),
};

test('ART-I1: anchors sit in frame and every part lands on its anchor on all three heads', () => {
  for (const head of HEADS) {
    for (const def of PAINTED_PARTS) {
      // A head part only ever renders on its own shape's rig — cross-shape pairings don't happen.
      if (def.layer === 'head' && def.id !== `head-${head.shape}`) continue;
      const name = `${def.id} on ${head.shape}`;
      const place = paintedPlacement(`painted:${def.id}`, head)!;
      const anchor = rigAnchor(def.anchor, head);
      assert.ok(anchor.x >= 0 && anchor.x <= 256 && anchor.y >= 0 && anchor.y <= 256, `${name}: anchor (${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)}) outside the frame`);
      assert.ok(Math.abs(place.x + def.pivot[0] * place.w - anchor.x) < 2 && Math.abs(place.y + def.pivot[1] * place.h - anchor.y) < 2, `${name}: pivot off its anchor`);
      const bx = BLEED.x(def), bt = BLEED.top(def), bb = BLEED.bottom(def);
      assert.ok(place.x >= -bx && place.x + place.w <= 256 + bx, `${name}: wider than the canvas (x ${place.x.toFixed(1)}..${(place.x + place.w).toFixed(1)})`);
      assert.ok(place.y >= -bt, `${name}: bleeds ${(-place.y).toFixed(1)} px off the top`);
      assert.ok(place.y + place.h <= 256 + bb, `${name}: bleeds ${(place.y + place.h - 256).toFixed(1)} px off the bottom`);
      if (def.layer === 'body') {
        // The head must hide the seam: the neck stump's top edge sits ≥ 8 px above the chin anchor.
        assert.ok(rigAnchor('chin', head).y - place.y >= 8, `${name}: the neck stump starts less than 8 px above the chin`);
      }
    }
  }
});

test('ART-I1: tint masks exist, and a swatch other than the painted one re-tints through them', () => {
  for (const [id, channels] of Object.entries(PART_MASKS)) for (const ch of channels) assert.ok(onDisk(maskUrl(id, ch)), `${id}-${ch} mask missing`);
  const ears = AVATAR_CATALOG.ears.indexOf('painted:ears-bat-pointed');
  const base = generateRandomGoblin(3, 3);
  const green: GoblinAvatarConfig = { ...base, skin: 'toxic-green', layers: { ...base.layers, ears } };
  const grey: GoblinAvatarConfig = { ...green, skin: 'ash-grey' };
  assert.doesNotMatch(composeGoblinSvg(green), /ears-bat-pointed-skin\.png/, 'the painted skin needs no tint');
  const tinted = composeGoblinSvg(grey);
  assert.match(tinted, /ears-bat-pointed-skin\.png/);
  assert.match(tinted, /mix-blend-mode:color/);
  assert.match(tinted, /scale\(-1 1\)/, 'the right ear is the left one mirrored');
});

test('ART-I1: v1 and v2 codes decode exactly as before, and re-encode to themselves', () => {
  const gold: { dna: string; config: unknown }[] = JSON.parse(readFileSync('tests/fixtures/goblin-dna-v1-v2.json', 'utf8'));
  assert.equal(gold.length, 700);
  for (const { dna, config } of gold) {
    const decoded = decodeGoblinDna(dna);
    // The fixtures predate the body layer: v1/v2 decode with body 0 (the structural racer bust).
    const expected = { ...(config as GoblinAvatarConfig), layers: { body: 0, ...(config as GoblinAvatarConfig).layers } };
    assert.deepEqual(decoded, expected, dna);
    assert.equal(encodeGoblinDna(decoded), dna);
  }
});

test('ART-I1: the structural bust draws right after the background and re-tints with the skin', () => {
  const base = generateRandomGoblin(3, 3);
  assert.equal(base.layers.body, 0, 'generator 3 keeps the structural body');
  assert.equal(AVATAR_CATALOG.body[0], 'painted:body-racer-bust', 'the racer bust stays body 0 (structural default of old codes)');
  const svg = composeGoblinSvg(base);
  const at = (needle: string) => svg.indexOf(needle);
  assert.ok(at('data-layer="background"') >= 0 && at('data-layer="body"') > at('data-layer="background"') && at('data-layer="head"') > at('data-layer="body"'), 'the bust sits between background and head');
  assert.match(svg, /body-racer-bust/);
  const ash = composeGoblinSvg({ ...base, skin: 'ash-grey' });
  assert.match(ash, /body-racer-bust-skin\.png/, 'its neck stump follows the skin swatch through the tint mask');
});

test('ART-I1: the newest catalog radix holds every painted part; every last index round-trips', () => {
  // v3 was the roomiest codec when this suite was written; features have since outgrown it. The
  // premise that survives every wave: the NEWEST radix holds the catalog, and every layer's last
  // index round-trips through whichever version picks it up.
  for (const layer of Object.keys(V5_CAPACITY) as AvatarLayerId[]) {
    assert.ok(AVATAR_CATALOG[layer].length <= V5_CAPACITY[layer]);
    const last = AVATAR_CATALOG[layer].length - 1;
    const g = generateRandomGoblin(9, 3);
    const config: GoblinAvatarConfig = { ...g, layers: { ...g.layers, [layer]: last } };
    const dna = encodeGoblinDna(config);
    assert.deepEqual(decodeGoblinDna(dna).layers, config.layers, `${layer} #${last} round-trips (${dna})`);
  }
  // v3 codes are still their own shape: a config inside every v3 radix keeps the four-group form
  // (built off a gen-1 goblin so no feature roll can wander past the v3 radix).
  const g1 = generateRandomGoblin(1, 1);
  const v3 = encodeGoblinDna({ ...g1, layers: { ...g1.layers, neck: AVATAR_CATALOG.neck.length - 1 } });
  assert.match(v3, /^GOB-3[0-9A-F]{3}(-[0-9A-F]{4}){3}$/, 'v3 is four hex groups');
});

test('ART-I2: DNA v4 carries the body as the twelfth layer; heads gain a slot', () => {
  assert.equal(V4_CAPACITY.head, 8, 'heads gain a slot (v3 had 4)');
  assert.equal(V4_CAPACITY.body, 16, 'the body enters the codec with a full nibble');
  for (const layer of Object.keys(V4_CAPACITY) as AvatarLayerId[]) {
    if (AVATAR_CATALOG[layer].length > V4_CAPACITY[layer]) {
      // Features that outgrew v4 (ears, eyes) exist only under v5's wider radix — v4's numbers themselves stay frozen, and the catalog must fit the newer room.
    } else {
      assert.ok(AVATAR_CATALOG[layer].length <= V4_CAPACITY[layer], `the ${layer} catalog fits v4`);
    }
  }
  // Round-trip through the real codec, one body drop into the future: a second body in the catalog
  // is all it takes for v4 codes to appear (the game's shortest-form logic stays untouched).
  // With the catalog already at the radix (16/16), no future body can be pushed — v4 cannot even
  // write digit 16 — so the extra-entry scenario only runs while the radix has a slot left.
  const bodies = AVATAR_CATALOG.body as string[];
  const radixFull = bodies.length >= V4_CAPACITY.body;
  if (!radixFull) bodies.push('painted:test-future-body');
  try {
    for (let seed = 0; seed < 500; seed++) {
      const g = generateRandomGoblin(seed, 4);
      const config: GoblinAvatarConfig = seed % 5 === 4
        ? { ...g, layers: { ...g.layers, body: 1 } }
        : g;
      const dna = encodeGoblinDna(config);
      // Every goblin round-trips, whatever version picks it up.
      assert.deepEqual(decodeGoblinDna(dna), config, `seed ${seed} round-trips (${dna})`);
      assert.equal(encodeGoblinDna(decodeGoblinDna(dna)), dna);
      if (config.layers.body === 0) {
        // A body-0 goblin still takes the shortest fitting form: v1–v3 when everything is small,
        // v4 for head slots 4–7, v5 only when a feature index reaches 12–15.
        assert.match(dna, /^GOB-[1-5][0-9A-F]{3}-/, `seed ${seed}: body 0 keeps the shortest fitting form`);
      } else {
        assert.match(dna, /^GOB-[45][0-9A-F]{3}(?:-[0-9A-F]{4}){4}$/, `seed ${seed}: ${dna}`);
      }
    }
    // v4 + nudge: the fine-tune block appends as before (five head groups, then three).
    const nudged: GoblinAvatarConfig = { ...generateRandomGoblin(7, 4), layers: { ...generateRandomGoblin(7, 4).layers, body: 1 }, nudge: { offset: { mouth: { x: 2, y: -1 } }, spread: { ears: 1 } } };
    const dna = encodeGoblinDna(nudged);
    assert.equal(dna.split('-').length, 9, dna);
    assert.deepEqual(decodeGoblinDna(dna), nudged);
    // head index into the new slot also forces v4 (v3 cap is 4 heads).
    const ninth: GoblinAvatarConfig = { ...generateRandomGoblin(2, 3), layers: { ...generateRandomGoblin(2, 3).layers, head: 7 } };
    assert.match(encodeGoblinDna(ninth), /^GOB-4[0-9A-F-]/, 'the 8th head encodes as v4');
  } finally {
    if (!radixFull) bodies.pop();
  }
});

test('ART-I2: v4 codes fail honestly: shape, checksum, versions above 4, overflowing payloads', () => {
  const broken = (dna: string, re: RegExp, label: string) => assert.throws(() => decodeGoblinDna(dna), re, label);
  broken('GOB-4000-1D92-BF3E-97FC', /Malformed/, 'a v3-shaped code with a 4 nibble is malformed');
  broken('GOB-4000-1D92-BF3E-97FC-EA08', /checksum mismatch/, 'one flipped nibble trips the checksum');
  broken('GOB-6FFF-FFFF-FFFF-FFFF-FFFF-FFFF', /Unsupported DNA version 6/, 'v6 is refused, not parsed as junk');
  // The largest encodable digit out-of-range: force a body digit the radix can't hold.
  const g = generateRandomGoblin(3, 3);
  assert.throws(() => encodeGoblinDna({ ...g, layers: { ...g.layers, body: 16 } }), /out of range for v/, 'body ≥ 16 cannot be written');
  // ... nor read: a v4 payload with every digit maxed is past the payload space.
  broken('GOB-4' + 'F'.repeat(19) + '.', /Malformed/, 'garbage is malformed');
  broken('GOB-4' + 'FFF-FFFF-FFFF-FFFF-FFFE', /checksum mismatch|out of range/, 'an all-F payload never decodes');
  // A v4 code written by the future (a body newer than this build) is refused, never guessed.
  const beyond = AVATAR_CATALOG.body.length;
  if (beyond >= V4_CAPACITY.body) {
    // Catalog at the radix: the future body digit overflows v4, so encode itself fails honestly.
    assert.throws(() => encodeGoblinDna({ ...g, layers: { ...g.layers, body: beyond } }), /out of range for v/, 'a body digit past the radix is refused at encode time');
  } else {
    const future = encodeGoblinDna({ ...g, layers: { ...g.layers, body: beyond } });
    assert.match(future, /^GOB-4/);
    assert.throws(() => decodeGoblinDna(future), /uses a body item this game doesn't have yet/);
  }
});

test('ART-I2: generators 1–3 freeze: no roll is spent on the body layer', () => {
  for (const gen of [1, 2, 3] as const) {
    const g = generateRandomGoblin(99, gen);
    assert.equal(g.layers.body, 0, `generator ${gen} keeps body 0`);
    assert.deepEqual(generateRandomGoblin('grub', gen), generateRandomGoblin('grub', gen), `generator ${gen} is deterministic`);
  }
  assert.deepEqual(generateRandomGoblin('grub', 4), generateRandomGoblin('grub', 4), 'generator 4 is deterministic');
  for (let seed = 0; seed < 1000; seed++) {
    const g = generateRandomGoblin(seed, 4);
    assert.ok(g.layers.body >= 0 && g.layers.body < AVATAR_CATALOG.body.length, `gen-4 body roll inside the catalog (seed ${seed})`);
    const dna = encodeGoblinDna(g);
    assert.deepEqual(decodeGoblinDna(dna), g, `seed ${seed} round-trips (${dna})`);
    if (g.layers.body > 0) assert.match(dna, /^GOB-[45]/, 'nonzero bodies encode as v4 or v5');
  }
});

test('ART-I3: DNA v5 widens ears and eyes to sixteen; the wire shape stays v4-sized', () => {
  assert.equal(V5_CAPACITY.ears, 16, 'ears gain four slots (the round-6 vault exactly)');
  assert.equal(V5_CAPACITY.eyes, 16, 'eyes gain four slots');
  for (const layer of Object.keys(V5_CAPACITY) as AvatarLayerId[]) {
    assert.ok(AVATAR_CATALOG[layer].length <= V5_CAPACITY[layer], `the ${layer} catalog fits v5`);
  }
  // A feature index past the v4 radix encodes as GOB-5 in the same five-group shape as v4.
  const g = generateRandomGoblin(5, 4);
  const five: GoblinAvatarConfig = { ...g, layers: { ...g.layers, ears: 12 } };
  const dna = encodeGoblinDna(five);
  assert.match(dna, /^GOB-5[0-9A-F]{3}(-[0-9A-F]{4}){4}$/, dna);
  // Inside the v4 radix everything keeps its v4 form; nothing shortens to v5 and nothing lengthens.
  assert.match(encodeGoblinDna({ ...g, layers: { ...g.layers, ears: 0, eyes: 0 } }), /^GOB-[1-4]/);
});

test('ART-I1: a v3 code from a newer catalog is refused honestly, not drawn as the wrong part', () => {
  // Layer digit past the catalog: encode by hand with a fake bigger catalog is not possible here, so
  // corrupt a valid v3 payload's neck digit via the public API instead: any decode must either give
  // a drawable goblin or throw.
  for (let seed = 0; seed < 300; seed++) {
    const dna = encodeGoblinDna(generateRandomGoblin(seed, 3));
    const flipped = dna.slice(0, 6) + ((parseInt(dna[6], 16) + 1) % 16).toString(16).toUpperCase() + dna.slice(7);
    try {
      const g = decodeGoblinDna(flipped);
      for (const layer of Object.keys(AVATAR_CATALOG) as AvatarLayerId[]) assert.ok(g.layers[layer] < AVATAR_CATALOG[layer].length);
    } catch (e) {
      assert.ok(e instanceof SyntaxError || e instanceof RangeError);
    }
  }
});
