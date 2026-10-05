import test from 'node:test';
import assert from 'node:assert/strict';
import { BUDGETS, BUDGET_KINDS, meter, overBudget, tierOf } from './budget';

test('every tier holds at least as much as the one below', () => {
  const tiers = ['potato', 'low', 'medium', 'high', 'ultra'] as const;
  for (let i = 1; i < tiers.length; i++) for (const k of BUDGET_KINDS) assert.ok(BUDGETS[tiers[i]!][k] >= BUDGETS[tiers[i - 1]!][k], `${tiers[i]} ${k}`);
});

test('the 101st lamp on Low is refused, in plain words', () => {
  assert.equal(overBudget('low', { lamps: 99 }, 'lamps'), null);
  const no = overBudget('low', { lamps: 100 }, 'lamps');
  assert.match(no ?? '', /full of lamps on Low graphics \(100 at most\)/);
  assert.equal(overBudget('medium', { lamps: 100 }, 'lamps'), null, 'Medium takes more');
});

test('a big model is checked by its blocks', () => {
  assert.equal(overBudget('low', { voxels: 400_000 }, 'voxels', 100_000), null);
  assert.match(overBudget('low', { voxels: 400_000 }, 'voxels', 100_001) ?? '', /blocks/);
});

test('the meter names the fullest part', () => {
  const m = meter('low', { things: 30, lamps: 90, characters: 1 });
  assert.equal(m.kind, 'lamps');
  assert.equal(m.label, '90% full (lamps)');
  assert.equal(meter('low', {}).share, 0);
});

test('graphics quality maps to a budget tier; auto counts as Low', () => {
  assert.equal(tierOf('high'), 'high');
  assert.equal(tierOf('auto'), 'low');
});
