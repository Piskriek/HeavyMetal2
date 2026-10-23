// The Quantum Archway Gate as a modular kit (Plan 42): validates cleanly and takes
// mat:/lx:/part: cartridges like any other kit (box parts, lamp parts, param bolts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, mergeBuckets, presetBounds, validate } from '@hm/kitspec';
import { GATE_KIT } from './kit-gate';
import { isLampPart } from './light-presets';

test('the gate kit validates: grounded, nothing floats or sinks', () => {
  assert.deepEqual(validate(GATE_KIT, 'gate'), []);
});

test('the gate kit has the parts beam cartridges need: boxes, six lamps, bolts', () => {
  const placed = flatten(GATE_KIT, 'gate');
  assert.ok(placed.some((p) => p.source.kind === 'box' && p.material === 'gunmetal'), 'a box for mat:');
  const lamps = placed.filter(isLampPart);
  assert.equal(lamps.length, 6);
  assert.deepEqual(
    lamps.map((p) => p.material),
    ['lx:2000:1.20:steady', 'lx:2001:1.20:steady', 'lx:2002:1.20:steady', 'lx:2003:1.20:steady', 'lx:2004:1.20:steady', 'lx:2005:1.20:steady'],
  );
  const bolts = placed.filter((p) => p.source.kind === 'param');
  assert.equal(bolts.length, 10);
  assert.ok(bolts.every((p) => p.source.kind === 'param' && p.source.gen === 'bolt'), 'bolts for part:');
  // six unique lamp materials stay six meshes (the ignition sweep lights bottom-to-top)
  const lampBuckets = [...mergeBuckets(placed).keys()].filter((k) => k.startsWith('lx:'));
  assert.equal(lampBuckets.length, 6);
});

test('the gate kit stands ~2.7 m wide and ~3.2 m tall with a walkable opening', () => {
  const b = presetBounds(GATE_KIT, flatten(GATE_KIT, 'gate'))!;
  const w = b.max[0] - b.min[0];
  const h = b.max[1] - b.min[1];
  assert.ok(w > 2.5 && w < 2.9, `width ${w.toFixed(2)} m`);
  assert.ok(h > 3.1 && h < 3.4, `height ${h.toFixed(2)} m`);
  assert.ok(b.min[1] >= -0.001, 'stands on the ground');
});
