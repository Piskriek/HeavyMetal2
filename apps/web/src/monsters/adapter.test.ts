// The adapter (adapter.ts) and the packed roster (roster.ts): the same archetype and era give the same skin for the same seed; every
// archetype has skins in more than one era; the fallbacks are core skins; and the roster matches docs/monsters/packed.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fallbackFor, hash32, skinFor } from './adapter';
import { FALLBACK_SKIN, SKINS, kitBySkinId, skinById, type Archetype, type Era } from './roster';

const ARCHETYPES: readonly Archetype[] = ['charger', 'spitter', 'swarmer', 'flyer', 'brute', 'sapper'];
const ERAS: readonly Era[] = ['sprite', 'early3d', 'modern3d'];
const root = fileURLToPath(new URL('../../../../', import.meta.url));

test('the same archetype, era and seed always give the same skin, and it is of that archetype and era', () => {
  for (const kind of ARCHETYPES) {
    for (const era of ERAS) {
      for (let seed = 0; seed < 50; seed++) {
        const a = skinFor(kind, era, seed), b = skinFor(kind, era, seed);
        assert.equal(a, b);
        const info = skinById(a);
        assert.ok(info, `${a} is in the roster`);
        assert.equal(info.archetype, kind);
        // the era is kept whenever the roster has that archetype in it; swarmers have no early 3D skin, so theirs come from another era
        const hasEra = SKINS.some((s) => s.archetype === kind && s.era === era);
        if (hasEra) assert.equal(info.era, era, `seed ${seed}: ${kind} ${era} gave ${a}`);
      }
    }
  }
});

test('the seed varies the skin within an era: a leak of many monsters is not one face', () => {
  for (const kind of ARCHETYPES) {
    for (const era of ERAS) {
      const pool = SKINS.filter((s) => s.archetype === kind && s.era === era);
      if (pool.length < 2) continue;
      const seen = new Set(Array.from({ length: 200 }, (_, seed) => skinFor(kind, era, seed)));
      assert.equal(seen.size, pool.length, `${kind} ${era}: every skin of the pool is picked by some seed`);
    }
  }
});

test('every archetype has at least three skins, across more than one era', () => {
  for (const kind of ARCHETYPES) {
    const pool = SKINS.filter((s) => s.archetype === kind);
    assert.ok(pool.length >= 3, `${kind}: ${pool.length}`);
    assert.ok(new Set(pool.map((s) => s.era)).size >= 2, `${kind} spans two eras`);
  }
});

test('a missing era falls back to the archetype from another era, and an unknown archetype to the era fallback', () => {
  const sapperSprite = skinFor('sapper', 'sprite', 1);
  assert.equal(skinById(sapperSprite)?.archetype, 'sapper');
  const none = [SKINS.find((s) => s.era === 'modern3d' && s.archetype === 'charger')!];
  assert.equal(skinFor('charger', 'sprite', 3, none), none[0]!.id, 'only the charger skin there is');
  assert.equal(skinFor('flyer', 'sprite', 3, none), FALLBACK_SKIN.sprite, 'no flyer at all: the era fallback');
});

test('the fallback of any skin is a core skin of the same kind', () => {
  for (const s of SKINS) {
    const fb = fallbackFor(s.id);
    const info = skinById(fb);
    assert.ok(info, `fallback ${fb} is in the roster`);
    assert.equal(info.core, true, `${fb} is core, so it always loads`);
    assert.equal(info.era === 'sprite', s.era === 'sprite', `${s.id} falls back to a skin of its own kind (sprite or 3D)`);
  }
  assert.equal(fallbackFor('no-such-skin'), FALLBACK_SKIN.sprite);
});

test('the hash is an integer mix: stable, and different seeds give different hashes', () => {
  assert.equal(hash32(7), hash32(7));
  assert.notEqual(hash32(7), hash32(8));
  assert.ok(Number.isInteger(hash32(123456)) && hash32(123456) >= 0);
});

test('the roster matches docs/monsters/packed.json, and every skin resolves its procedural @hm/creature genome', () => {
  const packed = JSON.parse(readFileSync(`${root}docs/monsters/packed.json`, 'utf8')) as {
    monsters: Record<string, { id: string; era: Era; archetype: Archetype; heightM: number; where: string; source: string }>;
  };
  const fromManifest = Object.values(packed.monsters).map((m) => ({ id: m.id, era: m.era, archetype: m.archetype, heightM: m.heightM, core: m.where === 'core', source: m.source })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(SKINS.map((s) => ({ id: s.id, era: s.era, archetype: s.archetype, heightM: s.heightM, core: s.core, source: s.source })), fromManifest, 'roster.ts is generated from the manifest: regenerate it if this fails');
  for (const s of SKINS) {
    assert.equal(s.genome.id, s.id, `${s.id}: genome id matches skin id`);
    assert.ok(s.genome.skinPaletteId.length > 0, `${s.id}: skinPaletteId is bound`);
    assert.ok(s.genome.voiceStemId.length > 0, `${s.id}: voiceStemId is bound`);
    assert.ok(kitBySkinId(s.id), `${s.id}: builds a procedural kit`);
  }
  // Rule 8a: static binary .glb models and .webp sprite sheets are eradicated
  assert.equal(existsSync(`${root}apps/web/src/assets/monsters`), false, 'core static monster assets are purged');
  const onDisk = readdirSync(`${root}apps/web/public/monsters`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(onDisk, [], 'public static monster directories are purged');
});
