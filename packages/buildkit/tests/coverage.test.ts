import test from 'node:test';
import assert from 'node:assert/strict';
import { hotbarCoverage, TOOLS, WORLD_KINDS, type ToolPreset } from '../src/index';

test('the hotbar audit has a row for every kind of thing in the world', () => {
  const { rows } = hotbarCoverage();
  assert.deepEqual(rows.map((r) => r.kind.id), WORLD_KINDS.map((k) => k.id));
});

test('a kind Select can pick and a tool can change has no gap; the rest say what is missing', () => {
  const { rows } = hotbarCoverage();
  const thing = rows.find((r) => r.kind.id === 'thing')!;
  assert.equal(thing.selectable, true);
  assert.equal(thing.gap, null);
  assert.ok((thing.changedBy.things ?? []).length > 0, 'Things places them');
  const surface = rows.find((r) => r.kind.id === 'ground-surface')!;
  assert.ok((surface.changedBy.paint ?? []).length > 0, 'Paint changes surfaces');
  for (const r of rows) assert.ok(r.gap === null || r.gap.length > 0);
});

test('it reads the tools it is given: a tool that changes a kind fills its row', () => {
  const raise = TOOLS.find((t) => t.id === 'raise')!;
  const without = hotbarCoverage(TOOLS.filter((t) => t.tab !== 'sculpt')).rows.find((r) => r.kind.id === 'ground-height')!;
  assert.equal(without.changedBy.sculpt, undefined);
  const withOne = hotbarCoverage([raise] as ToolPreset[]).rows.find((r) => r.kind.id === 'ground-height')!;
  assert.deepEqual(withOne.changedBy.sculpt, ['Raise']);
});

test('design gaps: Paint holding surfaces and Sculpt holding stamped shapes are named', () => {
  const ids = hotbarCoverage().design.map((d) => d.id);
  const paintIsSurfaces = TOOLS.filter((t) => t.tab === 'paint').every((t) => t.surface > 0);
  assert.equal(ids.includes('paint-materials'), paintIsSurfaces);
  assert.equal(hotbarCoverage(TOOLS.filter((t) => t.tab !== 'paint')).design.some((d) => d.id === 'paint-materials'), false);
});
