import test from 'node:test';
import assert from 'node:assert/strict';
import { move, type Box, type Capsule } from '../src/index';
const flat = { heightAt: () => 0 };
const cap: Capsule = { radius: 0.3, height: 1.6 };
const wall = (kind: Box['kind']): Box => ({ min: [1, 0, -5], max: [2, 3, 5], kind });
test('stands on flat ground', () => {
  const r = move([0, 0, 0], 0, 0, 0, 0.1, cap, [], flat);
  assert.equal(r.onGround, true); assert.equal(r.pos[1], 0); assert.equal(r.vy, 0);
});
test('a solid wall stops you at its face, a ghost does not', () => {
  const r = move([0, 0, 0], 2, 0, 0, 0.1, cap, [wall('solid')], flat);
  assert.ok(Math.abs(r.pos[0] - 0.7) < 1e-6, String(r.pos[0])); assert.equal(r.hitWall, true);
  const g = move([0, 0, 0], 2, 0, 0, 0.1, cap, [wall('ghost')], flat);
  assert.ok(Math.abs(g.pos[0] - 2) < 1e-6); assert.equal(g.hitWall, false);
});
test('slides along a wall', () => {
  const r = move([0, 0, 0], 2, 1, 0, 0.1, cap, [wall('invisible')], flat);
  assert.ok(Math.abs(r.pos[0] - 0.7) < 1e-6); assert.ok(Math.abs(r.pos[2] - 1) < 1e-6);
});
test('falls and lands on a box', () => {
  const r = move([0, 2, 0], 0, 0, -10, 0.5, cap, [{ min: [-1, 0, -1], max: [1, 1, 1], kind: 'solid' }], flat);
  assert.equal(r.pos[1], 1); assert.equal(r.onGround, true);
});

import { near } from '../src/index';

test('sliding along a wall keeps the parallel motion', () => {
  const zWall: Box = { min: [-5, 0, 1], max: [5, 3, 2], kind: 'solid' };
  const r = move([0, 0, 0], 1.5, 2, 0, 0.1, cap, [zWall], flat);
  assert.ok(Math.abs(r.pos[0] - 1.5) < 1e-6);
  assert.ok(Math.abs(r.pos[2] - 0.7) < 1e-6);
  assert.equal(r.hitWall, true);
});

test('step onto a 0.25 box', () => {
  const stepBox: Box = { min: [0.5, 0, -1], max: [1.5, 0.25, 1], kind: 'solid' };
  const r = move([0, 0, 0], 1, 0, 0, 0.1, cap, [stepBox], flat);
  assert.ok(Math.abs(r.pos[0] - 1) < 1e-6);
  assert.equal(r.pos[1], 0.25);
  assert.equal(r.onGround, true);
  assert.equal(r.hitWall, false);
});

test('a 0.5 box blocks', () => {
  const highBox: Box = { min: [1, 0, -1], max: [2, 0.5, 1], kind: 'solid' };
  const r = move([0, 0, 0], 1, 0, 0, 0.1, cap, [highBox], flat);
  assert.ok(Math.abs(r.pos[0] - 0.7) < 1e-6);
  assert.equal(r.pos[1], 0);
  assert.equal(r.hitWall, true);
});

test('head bump', () => {
  const ceiling: Box = { min: [-1, 2, -1], max: [1, 3, 1], kind: 'solid' };
  const r = move([0, 0, 0], 0, 0, 10, 0.1, cap, [ceiling], flat);
  assert.ok(Math.abs(r.pos[1] - 0.4) < 1e-6);
  assert.equal(r.vy, 0);
});

test('ghost walls', () => {
  const ghostWall: Box = { min: [1, 0, -5], max: [2, 3, 5], kind: 'ghost' };
  const r = move([0, 0, 0], 2, 0, 0, 0.1, cap, [ghostWall], flat);
  assert.ok(Math.abs(r.pos[0] - 2) < 1e-6);
  assert.equal(r.hitWall, false);
});

test('ladder top', () => {
  const ladder: Box = { min: [1, 0, -1], max: [2, 2, 1], kind: 'ladder' };
  const climbing = move([0.7, 0.5, 0], 1, 0, 0, 0.1, cap, [ladder], flat);
  assert.equal(climbing.climbing, true);
  assert.ok(Math.abs(climbing.pos[1] - 0.7) < 1e-6);
  assert.equal(climbing.vy, 0);

  const reached = move([0.7, 1.9, 0], 1, 0, 0, 0.1, cap, [ladder], flat);
  assert.equal(reached.pos[1], 2);
  assert.equal(reached.onGround, true);
  assert.equal(reached.climbing, false);
});

test('near broad phase', () => {
  const b: Box = { min: [1, 0, 1], max: [2, 2, 2], kind: 'solid' };
  assert.equal(near([b], [0.5, 1, 1.5], 0.6).length, 1);
  assert.equal(near([b], [0.5, 1, 1.5], 0.4).length, 0);
});