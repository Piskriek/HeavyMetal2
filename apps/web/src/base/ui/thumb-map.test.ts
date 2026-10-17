// ============================================================================
// File: apps/web/src/base/ui/thumb-map.test.ts
// Unit tests for thumbAssetFor and swatchFor (TICKET-04 Items A & B).
// Verifies every blueprint kind and every machine kind maps to an existing
// asset ID in apps/web/src/assets/gen/registry.json.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FAMILY, HEAVY, ITEMS, MAPS, PRIMITIVES, STARTER, VEHICLES, blueprint, blueprintId } from '../catalog';
import { HEAVY_KINDS, MACHINE_KINDS } from '@hm/plotsim';
import { REGISTRY_ASSET_IDS, thumbAssetFor } from './thumb-map';
import { swatchFor } from './use-item-thumb';

const candidatePaths = [
  path.resolve(process.cwd(), 'apps/web/src/assets/gen/registry.json'),
  path.resolve(process.cwd(), 'src/assets/gen/registry.json'),
];
const registryPath = candidatePaths.find((p) => fs.existsSync(p)) ?? candidatePaths[0]!;
const realRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Record<string, unknown>;
const realRegistryKeys = new Set(Object.keys(realRegistry));

test('REGISTRY_ASSET_IDS matches apps/web/src/assets/gen/registry.json', () => {
  assert.equal(REGISTRY_ASSET_IDS.size, realRegistryKeys.size);
  for (const id of REGISTRY_ASSET_IDS) {
    assert.ok(realRegistryKeys.has(id), `Expected ${id} to exist in registry.json`);
  }
});

test('every blueprint kind in STARTER and FAMILY maps to an existing registry.json asset ID', () => {
  const starterBp = blueprint(STARTER);
  assert.ok(starterBp, 'Starter blueprint exists');

  const allBlueprintKinds = new Set<string>(starterBp.kinds);
  for (const p of PRIMITIVES) {
    for (const k of FAMILY[p]) {
      allBlueprintKinds.add(k);
    }
  }

  assert.ok(allBlueprintKinds.size >= 23, `Expected at least 23 blueprint kinds, got ${allBlueprintKinds.size}`);

  for (const kind of allBlueprintKinds) {
    const assetId = thumbAssetFor({ kind });
    assert.ok(assetId, `Blueprint kind "${kind}" should map to a non-null asset ID`);
    assert.ok(
      realRegistryKeys.has(assetId),
      `Blueprint kind "${kind}" mapped to "${assetId}", which is missing from registry.json`
    );
  }
});

test('every field, heavy, and station machine kind maps to an existing registry.json asset ID', () => {
  const allMachines = new Set<string>([
    ...MACHINE_KINDS,
    ...HEAVY_KINDS,
    ...HEAVY,
    'fabricator',
  ]);

  for (const machine of allMachines) {
    const byMachine = thumbAssetFor({ machine });
    assert.ok(byMachine, `Machine kind "${machine}" should map to a non-null asset ID`);
    assert.ok(
      realRegistryKeys.has(byMachine),
      `Machine kind "${machine}" mapped to "${byMachine}", which is missing from registry.json`
    );

    const byKind = thumbAssetFor({ kind: machine });
    assert.equal(byKind, byMachine);
  }
});

test('blueprints, vehicles, primitives, and weapon parts map to registry assets while raw/map items use swatchFor', () => {
  // Blueprints
  assert.equal(thumbAssetFor({ item: STARTER }), 'foundation');
  for (const p of PRIMITIVES) {
    for (const m of MAPS) {
      const bpId = blueprintId(p, m);
      const assetId = thumbAssetFor({ item: bpId });
      assert.ok(assetId && realRegistryKeys.has(assetId), `Blueprint ${bpId} -> ${assetId}`);
    }
  }

  // Vehicles
  for (const v of VEHICLES) {
    const assetId = thumbAssetFor({ item: `vehicle:${v}` });
    assert.ok(assetId && realRegistryKeys.has(assetId), `Vehicle ${v} -> ${assetId}`);
  }

  // Raw pixels, raw vertices, and texture maps return null from thumbAssetFor and produce a valid data URL from swatchFor
  for (const swatchItem of ['pxd-mono', 'pxd-chroma', 'vtx-rough', 'vtx-fine', 'map-basalt', 'map-obsidian', 'map-quartz', 'map-moss']) {
    assert.equal(thumbAssetFor({ item: swatchItem }), null);
    const spec = ITEMS[swatchItem];
    const url = swatchFor({ item: swatchItem, tint: spec?.tint });
    assert.ok(url && url.startsWith('data:image/'), `swatchFor(${swatchItem}) returned ${url}`);
  }

  // Cartridge presets also produce valid swatch data URLs
  for (const cart of ['basalt', 'obsidian', 'quartz', 'moss', 'emerald_canopy', 'arid_badlands']) {
    const url = swatchFor({ item: cart });
    assert.ok(url && url.startsWith('data:image/'), `swatchFor(${cart}) returned ${url}`);
  }
});
