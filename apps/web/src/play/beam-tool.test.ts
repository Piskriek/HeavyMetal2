import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { emptyField } from '@hm/terrainbrush';
import { handPose, viewPose } from './rifle-hold';
import { BEAM_START, boulderBeamRate, cycleBeamMode, runStroke, SCULPT_RULES, sculptToolForKey, strokeOf, STROKE_RADIUS, type BeamState } from './beam-tool';

const RULES = { maxDepth: 2, maxHeight: 2, orePerCubicMetre: 1, ratePerSecond: 1 };
const flat = (): number => 0;
const at = (x: number, z: number) => ({ x, z });
const SIZE = 16, CELL = 1;
const centre = (f: { readonly delta: readonly number[] }): number => f.delta[(SIZE / 2) * SIZE + SIZE / 2] ?? 0;

test('the mode cycle goes Extract, Apply, Sculpt and wraps both ways', () => {
  assert.equal(cycleBeamMode('extract', 1), 'apply');
  assert.equal(cycleBeamMode('apply', 1), 'sculpt');
  assert.equal(cycleBeamMode('sculpt', 1), 'extract');
  assert.equal(cycleBeamMode('extract', -1), 'sculpt');
  assert.equal(cycleBeamMode('sculpt', -1), 'apply');
  assert.equal(BEAM_START.mode, 'extract', 'the beam starts in Extract');
});

test('in Sculpt, keys 1 to 3 pick carve, raise and smooth; other keys pick nothing', () => {
  assert.equal(sculptToolForKey('Digit1'), 'carve');
  assert.equal(sculptToolForKey('Digit2'), 'raise');
  assert.equal(sculptToolForKey('Digit3'), 'smooth');
  assert.equal(sculptToolForKey('Digit4'), null);
  assert.equal(sculptToolForKey('KeyE'), null);
});

test('a stroke: Extract makes none, Apply needs a cartridge, Sculpt makes the chosen tool', () => {
  const aim = at(4, 4);
  const extract: BeamState = { ...BEAM_START };
  assert.equal(strokeOf(extract, aim, 0.5), null);
  const applyEmpty: BeamState = { ...BEAM_START, mode: 'apply' };
  assert.equal(strokeOf(applyEmpty, aim, 0.5), null, 'an empty port paints nothing');
  const applyLoaded: BeamState = { ...BEAM_START, mode: 'apply', cartridge: 'preset:moss' };
  assert.deepEqual(strokeOf(applyLoaded, aim, 0.5), { kind: 'paint', x: 4, z: 4, radius: STROKE_RADIUS, strength: 1, dt: 0.5, preset: 'preset:moss' });
  const raise: BeamState = { ...BEAM_START, mode: 'sculpt', sculpt: 'raise' };
  assert.equal(strokeOf(raise, aim, 0.5)?.kind, 'raise');
});

test('carving gains ore; a carve moves the ground down and the ore up', () => {
  const field = emptyField(SIZE, CELL);
  const op = strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'carve' }, at(8, 8), 1)!;
  const r = runStroke(field, flat, op, RULES, 0);
  assert.ok(r.ore > 0 && r.balance === r.ore, `ore rises (${r.ore})`);
  assert.ok(centre(r.field) < 0, 'the ground at the aim point drops');
});

test('raising spends ore; with none it changes nothing; the ore never goes below zero', () => {
  const field = emptyField(SIZE, CELL);
  const op = strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'raise' }, at(8, 8), 1)!;
  const broke = runStroke(field, flat, op, RULES, 0);
  assert.equal(broke.ore, 0, 'no ore, no raise');
  assert.equal(broke.balance, 0);
  assert.equal(centre(broke.field), 0, 'the ground stays put');
  const rich = runStroke(field, flat, op, RULES, 50);
  assert.ok(rich.ore < 0 && rich.balance < 50, `raising spends ore (${rich.ore})`);
  assert.ok(rich.balance >= 0, 'never below zero');
  assert.ok(centre(rich.field) > 0, 'the ground rises');
  const partial = runStroke(field, flat, op, RULES, 0.25);
  assert.ok(partial.balance >= 0 && partial.balance <= 0.25, `a raise is limited by the ore (${partial.balance})`);
  const nan = runStroke(field, flat, op, RULES, Number.NaN);
  assert.equal(nan.balance, 0, 'a broken ore count is treated as none');
});

test('painting costs no ore; the preset lands on the ground under the aim', () => {
  const field = emptyField(SIZE, CELL);
  const op = strokeOf({ ...BEAM_START, mode: 'apply', cartridge: 'preset:moss' }, at(8, 8), 1)!;
  const r = runStroke(field, flat, op, RULES, 12);
  assert.equal(r.ore, 0, 'applying changes no ore');
  assert.equal(r.balance, 12, 'applying costs no ore');
  assert.ok(r.field.paint.some((p) => p === 'preset:moss'), 'a cell is painted with the preset');
});

test('the rifle in the hand: the grip socket sits at the hand bone, the barrel runs along the hand (+Y)', () => {
  // the beamkit prop's own sockets: grip, then muzzle ahead of it
  const grip = new THREE.Vector3(0, -0.111, -0.137), muzzle = new THREE.Vector3(0, 0.026, 0.45);
  const pose = handPose(grip, muzzle);
  const atHand = grip.clone().applyQuaternion(pose.quaternion).add(pose.position);
  assert.ok(atHand.length() < 1e-6, `the grip lands on the hand origin (${atHand.length()})`);
  const ahead = muzzle.clone().applyQuaternion(pose.quaternion).add(pose.position);
  assert.ok(Math.abs(ahead.x) < 1e-6 && Math.abs(ahead.z) < 1e-6 && ahead.y > 0.5, `the muzzle is up the hand's +Y (${ahead.toArray()})`);
  const view = viewPose();
  const barrel = muzzle.clone().sub(grip).normalize().applyQuaternion(view.quaternion);
  assert.ok(barrel.z < -0.9, `in the view the barrel points forward, down -Z (${barrel.z})`);
});

test('the beam takes about 4 ore a second from a boulder on rock, and more on scree', () => {
  assert.equal(boulderBeamRate(1, 0), 4, 'pure rock is the ruled 4 ore a second');
  assert.equal(boulderBeamRate(0, 1), 7, 'pure scree is 4 plus the 3 scree bonus');
  assert.equal(boulderBeamRate(0.5, 0.5), 5.5, 'an even mix is halfway');
  assert.equal(boulderBeamRate(0, 0), 4, 'a boulder on neither still gives the base rate');
  assert.equal(boulderBeamRate(Number.NaN, 2), 7, 'a broken weight counts as none');
  assert.equal(boulderBeamRate(-1, -1), 4, 'negative weights count as none');
});

test('the sculpt rules: a carve gains ore, a raise is paid from the ore held, a smooth moves no ore', () => {
  const field = emptyField(SIZE, CELL);
  const carve = runStroke(field, flat, strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'carve' }, at(8, 8), 1)!, SCULPT_RULES, 0);
  assert.ok(carve.ore > 0 && carve.balance === carve.ore, `a carve gains ore at the rules' price (${carve.ore})`);
  const raise = runStroke(field, flat, strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'raise' }, at(8, 8), 1)!, SCULPT_RULES, 0.5);
  assert.ok(raise.ore <= 0 && raise.balance >= 0 && raise.balance <= 0.5, `a raise is paid from the ore held (${raise.balance})`);
  const smooth = runStroke(field, flat, strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'smooth' }, at(8, 8), 1)!, SCULPT_RULES, 7);
  assert.equal(smooth.ore, 0, 'a smooth moves no ore');
  assert.equal(smooth.balance, 7, 'and the balance stays');
});

test('a protected cell is never cut: a stroke on a fully protected area changes nothing and keeps the ore', () => {
  const field = emptyField(SIZE, CELL);
  const op = strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: 'carve' }, at(8, 8), 1)!;
  const r = runStroke(field, flat, op, SCULPT_RULES, 12, () => true);
  assert.equal(r.changed.length, 0, 'no cell changed');
  assert.equal(r.balance, 12, 'the ore is kept');
  assert.equal(centre(r.field), 0, 'the ground stays put');
});
