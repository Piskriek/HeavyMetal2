// ============================================================================
// File: packages/plotsim/tests/plan42-gate.test.ts
// PLAN-42-GATE acceptance via @hm/plotsim (wraps the same deterministic helpers):
// movePlotGate, setGateAccessMode, canDialGate, dialRandomOpenGate,
// isEarthSandboxUnlocked. Pure: no Math.random/Date.now/DOM.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDialGate,
  dialRandomOpenGate,
  isEarthSandboxUnlocked,
  movePlotGate,
  newPlot,
  place,
  setGateAccessMode,
  type Env,
  type GateDirectoryEntry,
} from '../src/index';

const PLOT = {
  gate: { x: 0, y: 0, z: 0, yaw: 0, access: 'open' as const, addressCode: 'EARTH1' },
  machines: [{ kind: 'mill' as const, x: 20, z: 20 }],
  foundations: [{ x: -30, z: -30, halfX: 4, halfZ: 4 }],
  plotRadius: 480,
};

const ENV: Env = { gate: { x: 0, z: 0 }, plotRadius: 480, richness: () => 1 };

test('PLAN-42-GATE (plotsim): movePlotGate accepts valid grounded coordinates', () => {
  const r = movePlotGate(PLOT, { x: -60, y: 0, z: 40, yaw: 0.5 });
  assert.equal(r.ok, true);
  assert.equal(r.gate.x, -60);
  assert.equal(r.gate.z, 40);
  assert.equal(r.gate.access, 'open');
  assert.equal(r.gate.addressCode, 'EARTH1');
});

test('PLAN-42-GATE (plotsim): movePlotGate rejects out-of-bounds or colliding placements', () => {
  assert.equal(movePlotGate(PLOT, { x: 900, y: 0, z: 0, yaw: 0 }).ok, false);
  assert.equal(movePlotGate(PLOT, { x: 5, y: -1, z: 5, yaw: 0 }).ok, false);
  // mill footprint (kind radius 1.5) blocks the gate
  const hit = movePlotGate(PLOT, { x: 20, y: 0, z: 20, yaw: 0 });
  assert.equal(hit.ok, false);
  assert.equal(hit.reason, 'collides-machine');
  assert.equal(movePlotGate(PLOT, { x: -30, y: 0, z: -30, yaw: 0 }).ok, false);
});

test('PLAN-42-GATE (plotsim): movePlotGate works over a real PlotState with placed machines', () => {
  let s = newPlot();
  s = place(s, ENV, 'mill', 12, 0, 0);
  const plot = { ...s, gate: { x: 0, y: 0, z: 0, yaw: 0, access: 'open' as const, addressCode: 'MOON02' }, plotRadius: 480 };
  const blocked = movePlotGate(plot, { x: 12, y: 0, z: 0, yaw: 0 });
  assert.equal(blocked.ok, false);
  const clear = movePlotGate(plot, { x: -40, y: 0, z: -40, yaw: 0 });
  assert.equal(clear.ok, true);
  assert.equal(clear.gate.x, -40);
});

test('PLAN-42-GATE (plotsim): setGateAccessMode + canDialGate enforce open/code-only/closed', () => {
  const shut = setGateAccessMode(PLOT, 'closed');
  assert.equal(shut.gate.access, 'closed');
  const entry: GateDirectoryEntry = { plotId: 'p', addressCode: shut.gate.addressCode, access: shut.gate.access };
  assert.equal(canDialGate(entry, 'EARTH1'), false);
  assert.equal(canDialGate({ ...entry, access: 'open' }), true);
  assert.equal(canDialGate({ ...entry, access: 'code-only' }, 'EARTH1'), true);
  assert.equal(canDialGate({ ...entry, access: 'code-only' }, 'NOPE01'), false);
});

test('PLAN-42-GATE (plotsim): dialRandomOpenGate is seed-deterministic and skips closed/caller', () => {
  const directory: GateDirectoryEntry[] = [
    { plotId: 'me', addressCode: 'ME0001', access: 'open' },
    { plotId: 'a', addressCode: 'AAAA01', access: 'open' },
    { plotId: 'b', addressCode: 'BBBB02', access: 'code-only' },
    { plotId: 'c', addressCode: 'CCCC03', access: 'closed' },
  ];
  const first = dialRandomOpenGate(directory, 'me', 11);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.target.plotId, 'a');
    assert.equal(first.dialSequence.length, 6);
  }
  assert.deepEqual(dialRandomOpenGate(directory, 'me', 11), first);
  assert.deepEqual(dialRandomOpenGate(directory.slice(0, 1), 'me', 11), { ok: false, reason: 'no-open-gates' });
});

test('PLAN-42-GATE (plotsim): isEarthSandboxUnlocked transitions false at 0..5 to true at 6', () => {
  const maxed = { Pxd: 100, Vtx: 100, Lx: 100, Aq: 100 };
  for (let stage = 0; stage <= 5; stage++) assert.equal(isEarthSandboxUnlocked(stage, maxed), false);
  assert.equal(isEarthSandboxUnlocked(6, maxed), true);
});
