/**
 * ISLAND-ROUTE: the Basalt Isle tile library (public/textures/island-lib, listed in the generated index).
 * The index and the folder must agree, the names must stay stable (the island ground saves them with the
 * owner's choice), and the library must stay a small slice of the art budget.
 *
 *   node --import tsx --test tests/island-library.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { ISLAND_LIB } from '../src/game/island-route/island-lib-index.generated';
import { ISLAND_LIB_DIR, ISLAND_LIB_PBR_DIR, ISLAND_TEXTURE_LIBRARY, KINDS_FOR_SURFACE, libraryTexture, texturesFor } from '../src/game/island-route/island-texture-library';
import { ISLAND_PALETTE } from '../src/game/island-route/island-surfaces';
import { SURFACE_BEACH_GRASS, SURFACE_DRY_MUD } from '../src/game/surface/surface-table';

const dir = new URL('../public/textures/island-lib/', import.meta.url);
const onDisk = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();

test('island-lib: the generated index and the folder list the same files', () => {
  assert.ok(ISLAND_LIB.length > 0, 'the index is empty');
  assert.deepEqual(ISLAND_LIB.map((e) => e.file).sort(), onDisk);
});

test('island-lib: names are <kind>-<descriptor>-<id>.webp and the kind is the first word', () => {
  for (const e of ISLAND_LIB) {
    assert.match(e.file, /^[a-z]+-[a-z0-9-]+-(?:m\d{3}|gp\d{2})\.webp$/, e.file);
    assert.equal(e.file.split('-')[0], e.kind, `${e.file}: the picker reads the kind from the file name`);
    assert.ok(e.status === 'final' || e.status === 'provisional', `${e.file}: status ${e.status}`);
    assert.equal(e.name.includes('provisional'), e.status === 'provisional', `${e.file}: a provisional tile says so in its name`);
  }
});

test('island-lib: every key in the whole library is unique and resolves', () => {
  const keys = ISLAND_TEXTURE_LIBRARY.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const e of ISLAND_LIB) {
    const t = libraryTexture(`lib/${e.file}`);
    assert.ok(t, e.file);
    assert.equal(t.url, ISLAND_LIB_DIR + e.file);
    assert.equal(t.kind, e.kind);
  }
});

test('island-lib: the tiles are a small slice of the art budget', () => {
  const sizes = onDisk.map((f) => statSync(new URL(f, dir)).size);
  const total = sizes.reduce((a, b) => a + b, 0);
  assert.ok(total <= 3 * 1048576, `island-lib is ${(total / 1048576).toFixed(1)} MB: keep it under 3 MB (public/ has ~12 MB of headroom)`);
  assert.ok(Math.max(...sizes) <= 100 * 1024, 'a 256 px tile is never more than 100 KB');
});

test('island-lib: every island surface is offered library tiles first', () => {
  for (const surface of ISLAND_PALETTE) {
    const { suggested } = texturesFor(surface);
    assert.ok(suggested.some((t) => t.key.startsWith('lib/')), `surface ${surface} has no library tile among its suggestions`);
  }
});

test('island-lib: kinds the library adds are suggested where they fit', () => {
  assert.ok(KINDS_FOR_SURFACE[SURFACE_BEACH_GRASS]?.includes('forest'));
  assert.ok(KINDS_FOR_SURFACE[SURFACE_DRY_MUD]?.includes('litter'));
});

test('island-lib: every sheet tile has packed PBR maps, the salvaged ones do not, and nothing else is in the folder', () => {
  const pbrDir = new URL('../public/textures/island-lib-pbr/', import.meta.url);
  const pbrOnDisk = readdirSync(pbrDir).filter((f) => f.endsWith('.webp')).sort();
  const expected = ISLAND_LIB.filter((e) => /-m\d{3}\.webp$/.test(e.file)).map((e) => e.file).sort();
  assert.deepEqual(pbrOnDisk, expected);
  for (const e of ISLAND_LIB) {
    const t = libraryTexture(`lib/${e.file}`);
    assert.equal(t?.pbr, expected.includes(e.file) ? ISLAND_LIB_PBR_DIR + e.file : undefined, e.file);
  }
  const total = pbrOnDisk.reduce((sum, f) => sum + statSync(new URL(f, pbrDir)).size, 0);
  assert.ok(total <= 3 * 1048576, `island-lib-pbr is ${(total / 1048576).toFixed(1)} MB: keep it under 3 MB`);
});
