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

test('slides along a wall keeps the parallel motion', () => {
  const r = move([0, 0, 0], 2, 1, 0, 0.1, cap, [wall('solid')], flat);
  assert.ok(Math.abs(r.pos[0] - 0.7) < 1e-6); assert.ok(Math.abs(r.pos[2] - 1) < 1e-6);
  assert.equal(r.hitWall, true);
});

test('step onto a 0.25 box', () => {
  const r = move([0, 0, 0], 0, 1, 0, 0.1, cap, [{ min: [-1, 0, -1], max: [1, 0.25, 1], kind: 'solid' }], flat);
  assert.equal(r.pos[1], 0.25); assert.equal(r.onGround, true);
});

test('a 0.5 box blocks', () => {
  const r = move([0, 0, 0], 1, 0, 0, 0.1, cap, [{ min: [1, 0, -1], max: [2, 0.5, 1], kind: 'solid' }], flat);
  assert.ok(Math.abs(r.pos[0] - 0.7) < 1e-6); assert.equal(r.hitWall, true);
  assert.equal(r.pos[1], 0);
});

test('head bump', () => {
  const r = move([0, 0, 0], 0, 0, 10, 0.1, cap, [{ min: [-1, 1.5, -1], max: [1, 3, 1], kind: 'solid' }], flat);
  assert.ok(r.pos[1] < 1.6);
  assert.equal(r.vy, 0);
});

test('ghost walls', () => {
  const r = move([0, 0, 0], 2, 0, 0, 0.1, cap, [wall('ghost')], flat);
  assert.ok(Math.abs(r.pos[0] - 2) < 1e-6);
  assert.equal(r.hitWall, false);
});

test('ladder top', () => {
  const ladderBox: Box = { min: [0.3, 0, -1], max: [1.3, 2, 1], kind: 'ladder' };
  const r = move([0, 0, 0], 1, 0, 0, 0.3, cap, [ladderBox], flat);
  assert.equal(r.pos[0], 0);
  assert.equal(r.pos[1], 0.6);
  assert.equal(r.climbing, true);

  const r2 = move([0, 0, 0], 1, 0, 0, 2.0, cap, [ladderBox], flat);
  assert.equal(r2.pos[1], 2);
  assert.equal(r2.climbing, false);
  assert.equal(r2.onGround, true);
});