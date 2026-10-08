import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotOf, encodePlot, decodePlot, plotOfSnapshot } from './plot-code';
import { FRESH, type PlayState } from './quest';

test('plot-code: round-trip keeps machines, stage, points and cartridges', () => {
  const gate = { x: 86, z: 30 };
  const base = FRESH;

  const state: PlayState = {
    ...base,
    avatar: { kind: 'scientist', name: 'Ada Lovelace', visor: '#f59e0b' },
    plot: {
      v: 1,
      stage: 3,
      time: 120.5,
      ore: 250,
      points: { pxd: 450, vtx: 300, lx: 150, aq: 80 },
      machines: [
        { id: 1, kind: 'drill', x: gate.x - 8, z: gate.z + 6, yaw: 0.5, on: true, cartridge: null, built: 10 },
        { id: 2, kind: 'mill', x: gate.x + 7, z: gate.z + 5, yaw: -1.2, on: true, cartridge: 'c1', built: 20 },
        { id: 3, kind: 'press', x: gate.x + 12, z: gate.z - 4, yaw: 3.0, on: false, cartridge: null, built: 30 },
      ],
      nextId: 4,
    },
    lab: {
      v: 1,
      time: 120,
      cartridges: [
        {
          id: 'c1',
          name: 'Crater Calcite',
          kind: 'preset',
          preset: 'crater_calcite',
          from: [],
          affinity: { pxd: 1.12, vtx: 1.0, lx: 1.0, aq: 1.0 },
          slot: 2,
        },
      ],
      bench: null,
      combiner: null,
      nextId: 2,
      catalogueUntil: 0,
    },
  };

  const snap = snapshotOf(state, gate);
  assert.ok(snap, 'snapshot was created');
  assert.equal(snap.owner, 'Ada Lovelace');
  assert.equal(snap.stage, 3);
  assert.equal(snap.points.pxd, 450);
  assert.equal(snap.machines.length, 3);
  assert.equal(snap.cartridges.length, 1);
  assert.equal(snap.cartridges[0]!.name, 'Crater Calcite');

  const res = encodePlot(state, gate);
  assert.ok(res.ok, 'encoding succeeded');
  const code = (res as { ok: true; code: string }).code;
  assert.ok(typeof code === 'string' && code.length > 0);

  const decoded = decodePlot(code);
  assert.ok(decoded, 'decoding succeeded');
  assert.equal(decoded.owner, 'Ada Lovelace');
  assert.equal(decoded.stage, 3);
  assert.equal(decoded.points.pxd, 450);
  assert.equal(decoded.cartridges[0]!.name, 'Crater Calcite');
  assert.equal(decoded.machines.length, 3);

  // Check machines precision
  assert.equal(decoded.machines[0]!.kind, 'drill');
  assert.ok(Math.abs(decoded.machines[0]!.x - -8) < 0.01);
  assert.ok(Math.abs(decoded.machines[0]!.z - 6) < 0.01);
  assert.ok(Math.abs(decoded.machines[0]!.yaw - 0.5) < 0.005);
  assert.equal(decoded.machines[0]!.on, true);
  assert.equal(decoded.machines[0]!.cartridge, -1);

  assert.equal(decoded.machines[1]!.kind, 'mill');
  assert.equal(decoded.machines[1]!.cartridge, 0);

  // Reconstruct visited plot
  const reconstructed = plotOfSnapshot(decoded, gate);
  assert.equal(reconstructed.plot.stage, 3);
  assert.equal(reconstructed.plot.machines.length, 3);
  assert.ok(Math.abs(reconstructed.plot.machines[0]!.x - (gate.x - 8)) < 0.01);
  assert.ok(Math.abs(reconstructed.plot.machines[0]!.z - (gate.z + 6)) < 0.01);
  assert.equal(reconstructed.plot.machines[1]!.cartridge, 'visit-cart-0');
  assert.equal(reconstructed.lab.cartridges[0]!.name, 'Crater Calcite');
});

test('plot-code: machine too far out leaves code with plain refusal', () => {
  const gate = { x: 86, z: 30 };
  const base = FRESH;

  const state: PlayState = {
    ...base,
    plot: {
      ...base.plot,
      machines: [
        { id: 1, kind: 'drill', x: gate.x + 550, z: gate.z, yaw: 0, on: true, cartridge: null, built: 0 },
      ],
    },
  };

  assert.equal(snapshotOf(state, gate), null);
  const res = encodePlot(state, gate);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.why, /too far/i);
  }
});

test('plot-code: corrupt or damaged code is safely refused', () => {
  assert.equal(decodePlot(''), null);
  assert.equal(decodePlot('not-a-valid-plot-code'), null);
  assert.equal(decodePlot('HM12345'), null);
});
