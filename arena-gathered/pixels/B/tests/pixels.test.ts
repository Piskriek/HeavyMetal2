import test from 'node:test';
import assert from 'node:assert/strict';
import { PIXEL, dig, place, total, type Grid } from '../src/index';
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

import { regrow, worth } from '../src/index';

test('the floor stops digging', () => {
  const g = grid();
  g.floor[12] = 1.75;

  const r = dig(g, { pixels: {} }, { maxDug: 100, dug: 0 }, 2, 2, 0.5, 1);

  assert.ok(Math.abs(r.grid.heights[12]! - 1.75) < 1e-6);
  assert.equal(r.store.pixels[4], 2);
  assert.equal(r.budget.dug, 2);
});

test('the budget stops digging with a partial final cell', () => {
  const r = dig(grid(), { pixels: {} }, { maxDug: 3, dug: 0 }, 2, 2, 0.5, 1);

  assert.ok(Math.abs(r.grid.heights[12]! - 1.625) < 1e-6);
  assert.equal(r.store.pixels[4], 3);
  assert.equal(r.budget.dug, 3);
});

test('place needs pixels in the store', () => {
  const r = place(grid(), { pixels: { 4: 3 } }, 4, 8, 2, 2, 0.5);

  assert.equal(r.placed, 3);
  assert.ok(Math.abs(r.grid.heights[12]! - 2.375) < 1e-6);
  assert.equal(r.store.pixels[4], 0);
});

test('place sets the surface when the cell rises enough', () => {
  const r = place(grid(), { pixels: { 7: 8 } }, 7, 8, 2, 2, 0.5);

  assert.equal(r.grid.surface[12], 7);
  assert.equal(r.grid.surface[11], 4);
});

test('regrow never overshoots the original height', () => {
  const g = grid();
  g.heights[12] = 1;
  const original = new Float32Array(g.heights);
  original[12] = 2;

  const r = regrow(g, original, 10, 1);

  assert.equal(r.grid?.heights, undefined);
  assert.equal(r.heights[12], 2);
  assert.equal(g.heights[12], 1);
});

test('worth uses prices and the fallback price', () => {
  const store = { pixels: { 2: 3, 4: 11 } };

  assert.equal(worth(store, { 2: 2 }), 7);
  assert.equal(worth(store, {}), 1);
});

test('inputs are not mutated and outputs are new objects', () => {
  const g = grid();
  const store = { pixels: { 4: 8 } };
  const budget = { maxDug: 100, dug: 0 };
  const heights = new Float32Array(g.heights);
  const surfaces = new Uint8Array(g.surface);
  const floors = new Float32Array(g.floor);

  const dug = dig(g, store, budget, 2, 2, 0.5, 1);

  assert.deepEqual(g.heights, heights);
  assert.deepEqual(g.surface, surfaces);
  assert.deepEqual(g.floor, floors);
  assert.deepEqual(store, { pixels: { 4: 8 } });
  assert.deepEqual(budget, { maxDug: 100, dug: 0 });
  assert.notEqual(dug.grid, g);
  assert.notEqual(dug.grid.heights, g.heights);
  assert.notEqual(dug.store, store);
  assert.notEqual(dug.budget, budget);

  const placed = place(g, store, 4, 8, 2, 2, 0.5);
  assert.deepEqual(g.heights, heights);
  assert.deepEqual(g.surface, surfaces);
  assert.deepEqual(store, { pixels: { 4: 8 } });
  assert.notEqual(placed.grid, g);
  assert.notEqual(placed.store, store);
});