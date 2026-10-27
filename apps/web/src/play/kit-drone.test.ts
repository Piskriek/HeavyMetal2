// Plan 50: Overwatch's drone body is a kit like every machine, held to kitspec's own audit (nothing floats, nothing sinks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, sourceBounds, transformBox, validate } from '@hm/kitspec';
import { DRONE_CENTRE_Y, DRONE_KIT, DRONE_MUZZLE, DRONE_ROTOR_PIVOTS, isDroneRotor } from './kit-drone';

test('the drone passes the kit audit: every part reaches the skids, nothing below them', () => {
  assert.deepEqual(validate(DRONE_KIT, 'drone'), []);
  assert.deepEqual(validate(DRONE_KIT, 'drone-rotor'), []);
});

test('four rotors, each on its motor top, left out of the main build to spin on their own pivots', () => {
  const placed = flatten(DRONE_KIT, 'drone');
  const rotors = placed.filter((p) => isDroneRotor(p.path));
  assert.equal(rotors.length, 4);
  assert.equal(DRONE_ROTOR_PIVOTS.length, 4);
  for (const pivot of DRONE_ROTOR_PIVOTS) {
    const blade = rotors.find((r) => r.path === `rotor-${pivot.name}`);
    assert.ok(blade, pivot.name);
    const b = transformBox(sourceBounds(blade.source), blade.matrix);
    // the blade's bottom sits on the motor's top, centred on the pivot
    assert.ok(Math.abs(b.min[1] - pivot.at[1]) < 1e-9, `${pivot.name} blade bottom ${b.min[1]} vs pivot ${pivot.at[1]}`);
    assert.ok(Math.abs((b.min[0] + b.max[0]) / 2 - pivot.at[0]) < 1e-9);
    assert.ok(Math.abs((b.min[2] + b.max[2]) / 2 - pivot.at[2]) < 1e-9);
  }
  // nothing else is mistaken for a rotor
  assert.equal(placed.filter((p) => !isDroneRotor(p.path) && p.part === 'rotor').length, 0);
});

test('the muzzle is the barrel\'s front end and the lens faces forward', () => {
  const placed = flatten(DRONE_KIT, 'drone');
  const barrel = placed.find((p) => p.path === 'barrel');
  const lens = placed.find((p) => p.path === 'lens');
  assert.ok(barrel && lens);
  const bb = transformBox(sourceBounds(barrel.source), barrel.matrix);
  assert.ok(Math.abs(bb.max[2] - DRONE_MUZZLE[2]) < 1e-9, `barrel tip z ${bb.max[2]}`);
  assert.ok(DRONE_MUZZLE[1] > bb.min[1] && DRONE_MUZZLE[1] < bb.max[1]);
  const lb = transformBox(sourceBounds(lens.source), lens.matrix);
  assert.ok(lb.max[2] > bb.max[2], 'the lens is the most forward part, so the drone reads as facing where it looks');
  assert.ok(DRONE_CENTRE_Y > 0.15 && DRONE_CENTRE_Y < 0.25);
});

test('square sections only: every part is a box, about 0.95 m across the rotors', () => {
  const placed = flatten(DRONE_KIT, 'drone');
  assert.ok(placed.every((p) => p.source.kind === 'box'));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of placed) {
    const b = transformBox(sourceBounds(p.source), p.matrix);
    minX = Math.min(minX, b.min[0]);
    maxX = Math.max(maxX, b.max[0]);
  }
  assert.ok(maxX - minX > 0.8 && maxX - minX < 1.1, `span ${maxX - minX}`);
});

test('the vacuum module: four thruster pods with nozzles under them, no rotors (rotors give no lift on the Moon)', async () => {
  const { DRONE_NOZZLES } = await import('./kit-drone');
  assert.deepEqual(validate(DRONE_KIT, 'drone-vacuum'), []);
  const placed = flatten(DRONE_KIT, 'drone-vacuum');
  assert.equal(placed.filter((p) => p.part === 'rotor' || p.part.startsWith('shroud')).length, 0);
  const nozzles = placed.filter((p) => p.part === 'nozzle');
  assert.equal(nozzles.length, 4);
  for (const n of DRONE_NOZZLES) {
    const part = nozzles.find((p) => p.path === `nozzle-${n.name}`);
    assert.ok(part, n.name);
    const b = transformBox(sourceBounds(part.source), part.matrix);
    assert.ok(Math.abs(b.min[1] - n.at[1]) < 1e-9, 'the plume starts at the nozzle exit');
    assert.ok(n.at[1] > 0.05, 'the nozzles clear the skids');
  }
  // both modules share the frame: the lens, the barrel and the hull are the same parts in the same places
  const air = new Map(flatten(DRONE_KIT, 'drone').map((p) => [p.path, p.matrix.join(',')]));
  for (const key of ['hull', 'lens', 'barrel', 'battery', 'skid-left']) assert.equal(air.get(key), placed.find((p) => p.path === key)?.matrix.join(','));
});

test('the blades sweep clear of the arms (the audit counts overlap as contact, so this is checked on its own)', () => {
  const placed = flatten(DRONE_KIT, 'drone');
  const armTop = Math.max(...placed.filter((p) => p.part === 'arm').map((p) => transformBox(sourceBounds(p.source), p.matrix).max[1]));
  for (const pivot of DRONE_ROTOR_PIVOTS) assert.ok(pivot.at[1] > armTop + 1e-6, `${pivot.name}: blade at ${pivot.at[1]}, arm top ${armTop}`);
});
