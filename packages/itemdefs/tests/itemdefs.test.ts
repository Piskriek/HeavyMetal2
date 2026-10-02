import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_PRESETS, itemPresetById, validateItem, validateSet, normalizeItem,
  bucketOf, rollTable, rollItem, balanceReport, setItem, addItem,
  removeItem, duplicateItem, itemsToJson, itemsFromJson, type ItemDef
} from '../src/index';

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('presets validate and the preset set validates', () => {
  assert.equal(ITEM_PRESETS.length, 8);
  for (const preset of ITEM_PRESETS) {
    const res = validateItem(preset);
    assert.equal(res.ok, true, `Preset ${preset.id} failed: ${res.errors.join(', ')}`);
  }
  const setRes = validateSet(ITEM_PRESETS);
  assert.equal(setRes.ok, true, `Set validation failed: ${setRes.errors.join(', ')}`);
  assert.equal(itemPresetById('boost')?.id, 'boost');
  assert.equal(itemPresetById('nonexistent'), undefined);
});

test('bucketOf for 8 racers: positions 1..8 give 0,0,0,1,1,1,2,2', () => {
  const expected = [0, 0, 0, 1, 1, 1, 2, 2];
  for (let pos = 1; pos <= 8; pos++) {
    assert.equal(bucketOf(pos, 8), expected[pos - 1]);
  }
  assert.equal(bucketOf(-5, 8), 0);
  assert.equal(bucketOf(99, 8), 2);
  assert.equal(bucketOf(1, 0), 0);
  assert.equal(bucketOf(1, -10), 0);
});

test('rollItem is deterministic and respects weights over 10000 seeded rolls', () => {
  const seed = 42;
  const rng1 = mulberry32(seed);
  const rng2 = mulberry32(seed);
  for (let i = 0; i < 50; i++) {
    assert.equal(rollItem(ITEM_PRESETS, 1, 8, rng1)?.id, rollItem(ITEM_PRESETS, 1, 8, rng2)?.id);
  }

  const rngFront = mulberry32(12345);
  const rngBack = mulberry32(12345);
  let frontBoost = 0, frontFreeze = 0, backBoost = 0, backFreeze = 0;

  for (let i = 0; i < 10000; i++) {
    const f = rollItem(ITEM_PRESETS, 1, 8, rngFront);
    if (f?.id === 'boost') frontBoost++;
    if (f?.id === 'freeze') frontFreeze++;
    const b = rollItem(ITEM_PRESETS, 8, 8, rngBack);
    if (b?.id === 'boost') backBoost++;
    if (b?.id === 'freeze') backFreeze++;
  }
  assert.ok(backBoost > frontBoost * 3, `Expected backBoost > frontBoost * 3`);
  assert.ok(frontFreeze > backFreeze * 3, `Expected frontFreeze > backFreeze * 3`);
});

test('disabled items never roll', () => {
  const disabledBoost = setItem(ITEM_PRESETS, 'boost', { enabled: false });
  const rng = mulberry32(999);
  for (let i = 0; i < 1000; i++) {
    assert.notEqual(rollItem(disabledBoost, 8, 8, rng)?.id, 'boost');
  }
});

test('rollTable sums to 1', () => {
  for (const bucket of [0, 1, 2] as const) {
    const table = rollTable(ITEM_PRESETS, bucket);
    assert.ok(table.length > 0);
    const sum = table.reduce((acc, row) => acc + row.chance, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-9);
    for (let i = 0; i < table.length - 1; i++) {
      assert.ok(table[i]!.chance >= table[i + 1]!.chance);
    }
  }
});

test('balanceReport on presets has no "never rolled" warning and warns on broken sets', () => {
  const presetReport = balanceReport(ITEM_PRESETS);
  assert.equal(presetReport.warnings.some(w => w.includes('never be rolled')), false);

  const brokenItems: ItemDef[] = [
    {
      id: 'super-boost', label: 'Super Boost', icon: '⚡', effect: 'boost', kind: 'self',
      durationMs: 3000, power: 2, radius: 0, weights: [10, 10, 10], enabled: true
    },
    {
      id: 'tiny-jump', label: 'Tiny Jump', icon: '⬆️', effect: 'jump', kind: 'self',
      durationMs: 500, power: 1, radius: 0, weights: [1, 1, 1], enabled: true
    },
    {
      id: 'ghost', label: 'Ghost', icon: '👻', effect: 'ghost', kind: 'self',
      durationMs: 4000, power: 1, radius: 0, weights: [0, 0, 0], enabled: false
    }
  ];

  const brokenReport = balanceReport(brokenItems);
  assert.ok(brokenReport.warnings.some(w => w.includes("'ghost' can never be rolled")));
  assert.ok(brokenReport.warnings.some(w => w.includes('more than 45% roll chance')));
  assert.ok(brokenReport.warnings.some(w => w.includes('no enabled area items')));
});

test('validation messages are readable and never throw on null, numbers, or arrays', () => {
  for (const input of [null, undefined, 42, 'string', [], {}, { id: 123 }, { effect: 'invalid' }]) {
    assert.doesNotThrow(() => {
      const res = validateItem(input);
      assert.equal(typeof res.ok, 'boolean');
      assert.ok(Array.isArray(res.errors));
    });
  }
  assert.equal(validateSet(null).ok, false);
});

test('normalize fixes kind and clamps values', () => {
  const abnormal: ItemDef = {
    id: '  custom  ',
    label: 'A Very Long Label That Definitely Exceeds The Max Allowed Limit',
    icon: '🚀',
    effect: 'oil',
    kind: 'self',
    durationMs: 50000,
    power: 10,
    radius: 120,
    weights: [-2, 0, 0],
    enabled: true
  };

  const normalized = normalizeItem(abnormal);
  assert.equal(normalized.id, 'custom');
  assert.equal(normalized.kind, 'drop');
  assert.equal(normalized.durationMs, 20000);
  assert.equal(normalized.power, 4);
  assert.equal(normalized.radius, 80);
  assert.equal(normalized.label.length, 24);
  assert.deepEqual(normalized.weights, [1, 1, 1]);
});

test('edit helpers do not mutate inputs and keep ids unique', () => {
  const original = ITEM_PRESETS;
  const originalJson = JSON.stringify(original);

  const updated = setItem(original, 'boost', { power: 2 });
  assert.equal(updated[0]?.power, 2);
  assert.equal(original[0]?.power, 1);

  const added = addItem(original, original[0]!, 'boost');
  assert.equal(added.length, original.length + 1);
  assert.equal(added[added.length - 1]?.id, 'boost-2');

  const duplicated = duplicateItem(original, 'ghost');
  assert.equal(duplicated.length, original.length + 1);
  assert.equal(duplicated[duplicated.length - 1]?.id, 'ghost-copy');

  const removed = removeItem(original, 'freeze');
  assert.equal(removed.length, original.length - 1);
  assert.equal(removed.some(i => i.id === 'freeze'), false);

  assert.equal(JSON.stringify(original), originalJson);
});

test('json round trip preserves data and stable key order', () => {
  const json = itemsToJson(ITEM_PRESETS);
  const parsed = itemsFromJson(json);
  assert.equal(parsed.errors.length, 0);
  assert.notEqual(parsed.items, null);
  assert.equal(parsed.items?.length, ITEM_PRESETS.length);
  assert.deepEqual(parsed.items, ITEM_PRESETS as ItemDef[]);

  const badJson = itemsFromJson('{ invalid json }');
  assert.equal(badJson.items, null);
  assert.ok(badJson.errors.length > 0);
});
