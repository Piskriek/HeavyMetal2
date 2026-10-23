// ============================================================================
// File: packages/coopnet/tests/plan42-gate.test.ts
// PLAN-42-GATE acceptance: movable/lockable/random-dialable Stargate + Stage-6 unlock.
// Pure deterministic checks: no Math.random/Date.now/DOM.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDialGate,
  dialRandomOpenGate,
  isEarthSandboxUnlocked,
  movePlotGate,
  setGateAccessMode,
  type GateDirectoryEntry,
} from '../src/gate-dialer';

const OPEN_PLOT = {
  gate: { x: 0, y: 0, z: 0, yaw: 0, access: 'open' as const, addressCode: 'MOON01' },
  machines: [{ x: 20, z: 20, radius: 2 }],
  foundations: [{ x: -30, z: -30, radius: 4 }],
  plotRadius: 480,
};

test('PLAN-42-GATE: movePlotGate accepts valid grounded coordinates', () => {
  const r = movePlotGate(OPEN_PLOT, { x: 120, y: 4.5, z: -80, yaw: 1.2 });
  assert.equal(r.ok, true);
  assert.equal(r.gate.x, 120);
  assert.equal(r.gate.y, 4.5);
  assert.equal(r.gate.z, -80);
  assert.ok(r.gate.yaw >= 0 && r.gate.yaw < Math.PI * 2 + 1e-6);
  // access + share code preserved across a move
  assert.equal(r.gate.access, 'open');
  assert.equal(r.gate.addressCode, 'MOON01');
  // reducer style: the result is also the next plot
  assert.equal((r.plot as typeof OPEN_PLOT).gate.x, 120);
  // arrival pad sits 3.5 m in front of the gate
  const dx = r.arrivalPad.x - r.gate.x;
  const dz = r.arrivalPad.z - r.gate.z;
  assert.ok(Math.abs(Math.hypot(dx, dz) - 3.5) < 0.01);
  // input plot never mutated
  assert.equal(OPEN_PLOT.gate.x, 0);
});

test('PLAN-42-GATE: movePlotGate rejects out-of-bounds, below-ground, and colliding placements', () => {
  const far = movePlotGate(OPEN_PLOT, { x: 500, y: 0, z: 200, yaw: 0 });
  assert.equal(far.ok, false);
  assert.equal(far.reason, 'out-of-plot-bounds');
  assert.equal(far.gate.x, 0);

  const sunk = movePlotGate(OPEN_PLOT, { x: 10, y: -0.5, z: 10, yaw: 0 });
  assert.equal(sunk.ok, false);
  assert.equal(sunk.reason, 'below-ground');

  const onMachine = movePlotGate(OPEN_PLOT, { x: 20, y: 0, z: 20, yaw: 0 });
  assert.equal(onMachine.ok, false);
  assert.equal(onMachine.reason, 'collides-machine');

  const onFoundation = movePlotGate(OPEN_PLOT, { x: -30, y: 0, z: -30, yaw: 0 });
  assert.equal(onFoundation.ok, false);
  assert.equal(onFoundation.reason, 'collides-foundation');

  const bad = movePlotGate(OPEN_PLOT, { x: Number.NaN, y: 0, z: 0, yaw: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid-coords');
});

test('PLAN-42-GATE: setGateAccessMode cycles open/code-only/closed while preserving pose', () => {
  const locked = setGateAccessMode(OPEN_PLOT, 'closed');
  assert.equal(locked.ok, true);
  assert.equal(locked.gate.access, 'closed');
  assert.equal(locked.gate.x, 0);
  assert.equal(locked.gate.addressCode, 'MOON01');

  const unlisted = setGateAccessMode(locked.plot, 'code-only');
  assert.equal(unlisted.gate.access, 'code-only');

  const open = setGateAccessMode(unlisted.plot, 'open');
  assert.equal(open.gate.access, 'open');
});

test('PLAN-42-GATE: canDialGate enforces open, code-only, and closed states deterministically', () => {
  const open: GateDirectoryEntry = { plotId: 'plot-a', addressCode: 'AAAAAA', access: 'open' };
  const codeOnly: GateDirectoryEntry = { plotId: 'plot-b', addressCode: 'BBBBBB', access: 'code-only' };
  const closed: GateDirectoryEntry = { plotId: 'plot-c', addressCode: 'CCCCCC', access: 'closed' };

  assert.equal(canDialGate(open), true);
  assert.equal(canDialGate(open, 'WRONG1'), true);
  assert.equal(canDialGate(codeOnly), false);
  assert.equal(canDialGate(codeOnly, 'WRONG1'), false);
  assert.equal(canDialGate(codeOnly, 'BBBBBB'), true);
  assert.equal(canDialGate(closed), false);
  assert.equal(canDialGate(closed, 'CCCCCC'), false);

  // legacy PublishedGateListing shape (code) also enforced
  assert.equal(canDialGate({ code: 'DDDDDD', ownerId: 'o', world: 'moon', stage: 3, access: 'open' }), true);
  assert.equal(canDialGate({ code: 'DDDDDD', ownerId: 'o', world: 'moon', stage: 3, access: 'closed' }, 'DDDDDD'), false);
});

test('PLAN-42-GATE: dialRandomOpenGate never dials closed/code-only/caller and is seed-deterministic', () => {
  const directory: GateDirectoryEntry[] = [
    { plotId: 'caller', addressCode: 'CALLER', access: 'open' },
    { plotId: 'plot-open-1', addressCode: 'OPEN01', access: 'open' },
    { plotId: 'plot-open-2', addressCode: 'OPEN02', access: 'open' },
    { plotId: 'plot-secret', addressCode: 'SECRET', access: 'code-only' },
    { plotId: 'plot-shut', addressCode: 'SHUT01', access: 'closed' },
  ];
  for (const seed of [0, 1, 7, 42, 123456, -5]) {
    const r = dialRandomOpenGate(directory, 'caller', seed);
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    assert.ok(r.target.plotId === 'plot-open-1' || r.target.plotId === 'plot-open-2');
    assert.notEqual(r.target.plotId, 'caller');
    assert.equal(r.target.access, 'open');
    assert.equal(r.code.length, 6);
    assert.equal(r.dialSequence.length, 6);
    assert.equal(r.chevrons.length, 6);
    assert.deepEqual([...r.dialSequence], r.code.split(''));
  }

  const a = dialRandomOpenGate(directory, 'caller', 42);
  const b = dialRandomOpenGate(directory, 'caller', 42);
  assert.deepEqual(a, b);

  const none = dialRandomOpenGate(
    [
      { plotId: 'x', addressCode: 'XXXXXX', access: 'closed' },
      { plotId: 'y', addressCode: 'YYYYYY', access: 'code-only' },
    ],
    'caller',
    9,
  );
  assert.deepEqual(none, { ok: false, reason: 'no-open-gates' });

  const onlyCaller = dialRandomOpenGate([{ plotId: 'caller', addressCode: 'CALLER', access: 'open' }], 'caller', 3);
  assert.deepEqual(onlyCaller, { ok: false, reason: 'no-open-gates' });
});

test('PLAN-42-GATE: isEarthSandboxUnlocked transitions false at Stage 0..5 to true at Stage 6', () => {
  const maxed = { Pxd: 100, Vtx: 100, Lx: 100, Aq: 100 };
  for (let stage = 0; stage <= 5; stage++) {
    assert.equal(isEarthSandboxUnlocked(stage, maxed), false);
    assert.equal(isEarthSandboxUnlocked(stage), false);
  }
  assert.equal(isEarthSandboxUnlocked(6, maxed), true);
  assert.equal(isEarthSandboxUnlocked(6), true);
  assert.equal(isEarthSandboxUnlocked(7, maxed), true);
  // normalized 0..1 cardinals supported; unmet thresholds stay locked
  assert.equal(isEarthSandboxUnlocked(6, { Pxd: 1, Vtx: 1, Lx: 1, Aq: 1 }), true);
  assert.equal(isEarthSandboxUnlocked(6, { Pxd: 0, Vtx: 0, Lx: 0, Aq: 0 }), false);
  assert.equal(isEarthSandboxUnlocked(6, { pxd: 100, vtx: 100, lx: 100, aq: 100 }), true);
});
