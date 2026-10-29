import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARVESTED_CATEGORIES,
  HARVESTED_SOURCE_GAMES,
   findHarvestedPresetById,
  queryHarvestedShelf,
} from '../src/index.js';

test('Plan 58 W3 (Track 1): queryHarvestedShelf lazily indexes all 2,606 presets across 8 games and 9 categories without startup bloat', () => {
  const allPage = queryHarvestedShelf({ limit: 12, offset: 0 });
  assert.equal(allPage.totalCatalogCount, 2606);
  assert.equal(allPage.items.length, 12);

  for (const game of HARVESTED_SOURCE_GAMES) {
    assert.ok(allPage.byGame[game] > 0, `expected > 0 presets for ${game}, got ${allPage.byGame[game]}`);
  }
  for (const cat of HARVESTED_CATEGORIES) {
    assert.ok(allPage.byCategory[cat] > 0, `expected > 0 presets for category ${cat}, got ${allPage.byCategory[cat]}`);
  }

  // Filter by Dwarf Fortress elements + search "iron"
  const dfIron = queryHarvestedShelf({ sourceGame: 'Dwarf Fortress', category: 'element', search: 'iron', limit: 5 });
  assert.ok(dfIron.matchedCount >= 1);
  assert.equal(dfIron.items[0]!.sourceGame, 'Dwarf Fortress');
  assert.equal(dfIron.items[0]!.category, 'element');
  assert.equal(dfIron.items[0]!.rung, 1);
  assert.ok(dfIron.items[0]!.fourFloats.vtx > 50);

  // Filter by thruster-propulsion
  const thrusters = queryHarvestedShelf({ category: 'thruster-propulsion', limit: 10 });
  assert.ok(thrusters.matchedCount > 20);
  assert.equal(thrusters.items[0]!.category, 'thruster-propulsion');
  assert.equal(thrusters.items[0]!.rung, 4);

  // Lookup by ID
  const found = findHarvestedPresetById(dfIron.items[0]!.id);
  assert.ok(found);
  assert.equal(found.id, dfIron.items[0]!.id);
  assert.equal(findHarvestedPresetById('nonexistent:00000000'), null);
});

