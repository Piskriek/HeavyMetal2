import test from 'node:test';
import assert from 'node:assert/strict';
import { PIXEL, dig, place, total, type Grid } from '../src/index';
import { regrow, worth } from '../src/index';

const grid = (): Grid => ({ cols: 5, rows: 5, cell: 1, heights: new Float32Array(25).fill(2), surface: new Uint8Array(25).fill(4), floor: new Float32Array(25).fill(0) });
test('a dig at one cell with radius under one cell takes that cell only', () => {
  const r = dig(grid(), { pixels: {} }, { maxDug: 1000, dug: 0 }, 2, 2, 0.5, 1);
  assert.ok(Math.abs(r.grid.heights[12]! - 1) < 1e-6);
  assert.equal(r.grid.heights[11], 2);
  assert.equal(r.store.pixels[4], 8); // 1 m^3 = 8 pixels
  assert.equal(r.budget.dug, 8);
  assert.equal(total(r.store), 8);
});
test('place puts them back', () => {
  const g = grid();
  const r = place(g, { pixels: { 4: 8 } }, 4, 8, 2, 2, 0.5);
  assert.equal(r.placed, 8);
  assert.ok(Math.abs(r.grid.heights[12]! - 3) < 1e-6);
  assert.equal(total(r.store), 0);
  assert.equal(g.heights[12], 2, 'the input grid is not changed');
  assert.equal(PIXEL, 0.125);
});

test('dig stops at the floor and returns fractional pixels', () => {
  const g = grid();
  g.floor.fill(1.95);

  const r = dig(g, { pixels: {} }, { maxDug: 1000, dug: 0 }, 2, 2, 0.5, 1);

  assert.equal(r.grid.heights[12], g.floor[12]);
  assert.equal(r.grid.heights[11], 2);
  assert.equal(r.store.pixels[4] ?? 0, 0);
  assert.ok(Math.abs(r.remainder[4]! - 0.4) < 1e-5);
});

test('dig respects its pixel budget on the last cell', () => {
  const r = dig(grid(), { pixels: {} }, { maxDug: 4, dug: 0 }, 2, 2, 0.5, 1);

  assert.ok(Math.abs(r.grid.heights[12]! - 1.5) < 1e-6);
  assert.equal(r.store.pixels[4], 4);
  assert.equal(r.budget.dug, 4);
});

test('place is limited by the store and changes the raised surface', () => {
  const g = grid();
  const store = { pixels: { 4: 2 } };
  const r = place(g, store, 9, 8, 2, 2, 0.5);

  assert.equal(r.placed, 2);
  assert.equal(r.store.pixels[4], 0);
  assert.equal(r.grid.heights[12], 2.25);
  assert.equal(r.grid.surface[12], 9);
  assert.equal(store.pixels[4], 2);
});

test('regrow never overshoots the original height', () => {
  const g = grid();
  const original = new Float32Array(g.heights);
  g.heights[12] = 1;
  g.heights[13] = 3;

  const r = regrow(g, original, 4, 1);

  assert.equal(r.heights[12], 2);
  assert.equal(r.heights[13], 3);
  assert.equal(g.heights[12], 1);
  assert.equal(original[12], 2);
});

test('worth handles explicit prices and the default rate', () => {
  assert.equal(worth({ pixels: { 4: 20 } }, { 4: 2 }), 40);
  assert.equal(worth({ pixels: { 4: 19 } }, {}), 1);
});

test('dig does not mutate its grid, store, or budget inputs', () => {
  const g = grid();
  const heights = Array.from(g.heights);
  const surfaces = Array.from(g.surface);
  const floors = Array.from(g.floor);
  const store = { pixels: { 4: 4 } };
  const budget = { maxDug: 100, dug: 0 };

  dig(g, store, budget, 2, 2, 0.5, 1);

  assert.deepEqual(Array.from(g.heights), heights);
  assert.deepEqual(Array.from(g.surface), surfaces);
  assert.deepEqual(Array.from(g.floor), floors);
  assert.deepEqual(store, { pixels: { 4: 4 } });
  assert.deepEqual(budget, { maxDug: 100, dug: 0 });
});