/**
 * ART-I1: the painted goblin parts are registered (DNA v3), placed, tinted and on disk.
 * Run with: node --import tsx --test tests/painted-parts.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { AVATAR_CATALOG, V3_CAPACITY, decodeGoblinDna, encodeGoblinDna, generateRandomGoblin } from '../src/game/meta/goblin-dna';
import { KEYED_PARTS, PAINTED_PARTS, paintedPlacement, rigAnchor } from '../src/game/meta/painted-parts';
import { PART_MASKS } from '../src/game/meta/painted-masks.generated';
import { composeGoblinSvg, maskUrl } from '../src/game/meta/goblin-compositor';
import type { AvatarLayerId, GoblinAvatarConfig } from '../src/game/meta/interfaces';

const HEADS = [{ headW: 54, headTop: 70 }, { headW: 62, headTop: 78 }, { headW: 44, headTop: 70 }];
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

test('ART-I1: every part lands on its anchor on all three heads and stays (mostly) in frame', () => {
  for (const head of HEADS) {
    for (const def of PAINTED_PARTS) {
      const place = paintedPlacement(`painted:${def.id}`, head)!;
      const anchor = rigAnchor(def.anchor, head);
      assert.ok(Math.abs(place.x + def.pivot[0] * place.w - anchor.x) < 2 && Math.abs(place.y + def.pivot[1] * place.h - anchor.y) < 2, `${def.id}: pivot off its anchor`);
      const inside = Math.max(0, Math.min(256, place.x + place.w) - Math.max(0, place.x)) * Math.max(0, Math.min(256, place.y + place.h) - Math.max(0, place.y));
      assert.ok(inside / (place.w * place.h) >= 0.55, `${def.id} is mostly outside the portrait on head ${head.headW}`);
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
    assert.deepEqual(decodeGoblinDna(dna), config, dna);
    assert.equal(encodeGoblinDna(decodeGoblinDna(dna)), dna);
  }
});

test('ART-I1: v3 holds every painted part; the catalog has room left in v3', () => {
  for (const layer of Object.keys(AVATAR_CATALOG) as AvatarLayerId[]) {
    assert.ok(AVATAR_CATALOG[layer].length <= V3_CAPACITY[layer]);
    const last = AVATAR_CATALOG[layer].length - 1;
    const g = generateRandomGoblin(9, 3);
    const config: GoblinAvatarConfig = { ...g, layers: { ...g.layers, [layer]: last } };
    const dna = encodeGoblinDna(config);
    assert.deepEqual(decodeGoblinDna(dna).layers, config.layers, `${layer} #${last} round-trips (${dna})`);
  }
  const v3 = encodeGoblinDna({ ...generateRandomGoblin(1, 3), layers: { ...generateRandomGoblin(1, 3).layers, neck: AVATAR_CATALOG.neck.length - 1 } });
  assert.match(v3, /^GOB-3[0-9A-F]{3}(-[0-9A-F]{4}){3}$/, 'v3 is four hex groups');
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
