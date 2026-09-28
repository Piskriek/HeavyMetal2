/** MP-T01: meta contracts and the pure math core (src/game/meta). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { calculateResurrectionCost, costTable, seasonalNetWorth, wealthCrossover } from '../src/game/meta/shaman';

test('MP-T01: costTable matches the reference table, all 15 cells', () => {
  const elos = [1000, 1800, 2400];
  for (const row of costTable(elos)) {
    elos.forEach((e, i) => assert.equal(row.floors[i], Math.round(250 * (e / 1000) ** 2 * 1.75 ** (row.n - 1)), `n${row.n} elo${e}`));
    assert.equal(row.taxRate, [0.15, 0.25, 0.4, 0.6, 0.85][row.n - 1]);
    assert.equal(row.lockoutHours, [0, 2, 6, 12, 24][row.n - 1]);
  }
});

test('MP-T01: the fee is the larger of the Elo floor and the wealth tax', () => {
  const poor = calculateResurrectionCost(1, 1800, 100);
  assert.equal(poor.fee, poor.eloFloor);
  const rich = calculateResurrectionCost(1, 1000, 1_000_000);
  assert.equal(rich.fee, 150_000);
  const cross = wealthCrossover(2, 1800);
  assert.ok(Math.abs(calculateResurrectionCost(2, 1800, cross).wealthTax - calculateResurrectionCost(2, 1800, cross).eloFloor) <= 1);
});

test('MP-T01: nonsense inputs never throw or go negative', () => {
  for (const bad of [NaN, Infinity, -Infinity, -5, 1e300]) {
    const r = calculateResurrectionCost(bad, bad, bad, bad);
    assert.ok(Number.isFinite(r.fee) && r.fee >= 0, `input ${bad}`);
  }
});

test('MP-T01: seasonal net worth keeps 0.6 of gross inflow when holdings are dumped', () => {
  const dumped = seasonalNetWorth({ liquidWallet: 10, inventoryValue: 0, betEscrow: 0, grossSeasonalInflow: 100_000 });
  assert.equal(dumped.snw, 60_000);
  const held = seasonalNetWorth({ liquidWallet: 90_000, inventoryValue: 5_000, betEscrow: 5_000, grossSeasonalInflow: 100_000 });
  assert.equal(held.snw, 100_000);
});

test('MP-T01: src/game/meta imports neither three nor react', () => {
  const dir = new URL('../src/game/meta/', import.meta.url);
  for (const f of readdirSync(dir)) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /from ['"](three|react)['"]/, f);
  assert.doesNotMatch(readFileSync(new URL('interfaces.ts', dir), 'utf8'), /:\s*any\b/);
});
