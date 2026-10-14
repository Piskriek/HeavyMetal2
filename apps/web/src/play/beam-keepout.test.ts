import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_APRON, MACHINE_REACH, PIECE_REACH, PLOT_EDGE, STRUCTURE_REACH, keepOutZones, keptOut } from './beam-keepout';

test('the zones: the gate apron, then each structure origin, each piece and each machine, with its own reach', () => {
  const zones = keepOutZones({ gate: { x: 0, z: 0 }, structures: [{ x: 30, z: -12 }], pieces: [{ x: 30, z: -12 }], machines: [{ x: -40, z: 22 }] });
  assert.deepEqual(zones.map((z) => z.r), [GATE_APRON, STRUCTURE_REACH, PIECE_REACH, MACHINE_REACH]);
  assert.deepEqual([zones[2]!.x, zones[2]!.z], [30, -12], 'the piece is where its cell centre is');
  assert.deepEqual([zones[3]!.x, zones[3]!.z], [-40, 22]);
});

test('a cut is kept out on the gate pad and its apron, and clear of it beyond the apron', () => {
  const zones = keepOutZones({ gate: { x: 0, z: 0 }, structures: [], pieces: [], machines: [] });
  assert.equal(keptOut(zones, 0, 0), true, 'the gate itself');
  assert.equal(keptOut(zones, 1.9, 1.25), true, 'the pad corner');
  assert.equal(keptOut(zones, GATE_APRON - 0.5, 0), true, 'the apron');
  assert.equal(keptOut(zones, GATE_APRON + 0.5, 0), false, 'just outside the apron');
  assert.equal(keptOut(zones, 40, 40), false, 'open ground is cut');
});

test('a long structure is kept out along its whole length: every piece keeps its own footprint out', () => {
  // a row of pieces every 4 m from the origin out to 40 m: the far end is protected, not only the origin
  const pieces = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40].map((x) => ({ x, z: 0 }));
  const zones = keepOutZones({ gate: { x: 0, z: 0 }, structures: [{ x: 0, z: 0 }], pieces, machines: [] });
  assert.equal(keptOut(zones, 40, 0), true, 'the far piece is kept out');
  assert.equal(keptOut(zones, 40, PIECE_REACH - 0.2), true, 'and its footprint, to the side');
  assert.equal(keptOut(zones, 40, PIECE_REACH + 0.5), false, 'beyond its footprint the ground is cut');
});

test('a machine keeps its footprint out, and no more', () => {
  const zones = keepOutZones({ gate: { x: 0, z: 0 }, structures: [], pieces: [], machines: [{ x: -50, z: 0 }] });
  assert.equal(keptOut(zones, -50 + MACHINE_REACH - 0.2, 0), true);
  assert.equal(keptOut(zones, -50 + MACHINE_REACH + 0.2, 0), false);
});

test('the plot edge: the outer band of the field is kept out, and everything beyond the field', () => {
  assert.equal(keptOut([], 160 - PLOT_EDGE + 0.5, 0), true, 'inside the band');
  assert.equal(keptOut([], 160 - PLOT_EDGE - 0.5, 0), false, 'just inside the band');
  assert.equal(keptOut([], 0, -170), true, 'beyond the field');
  assert.equal(keptOut([], Number.NaN, 0), true, 'a broken coordinate is kept out');
});
