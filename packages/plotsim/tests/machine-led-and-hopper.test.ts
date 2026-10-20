// ============================================================================
// File: packages/plotsim/tests/machine-led-and-hopper.test.ts
// TICKET-23 unit tests covering POL-281, POL-282, POL-39, POL-73, and POL-77
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MACHINE_PLUME_GRAVITY,
  machinePlumeGravity,
  computePressVentChuteClearanceM,
  evaluateHousingStatusLed,
  computeInspectorHopperView,
} from '../src/machine-led-and-hopper';

test('POL-281 (ruling a, socket kept): the press vents sit behind the top input chute, clear of the ore after fitToTable', () => {
  // Starter press fitted from 3.44 m native to 3.10 m (scale ~0.901): the ruling's 0.77 m
  const starterClearance = computePressVentChuteClearanceM('press', 3.1 / 3.44);
  assert.ok(starterClearance > 0.75, `Expected starter press clearance > 0.75 m, got ${starterClearance.toFixed(3)} m`);
  assert.ok(computePressVentChuteClearanceM('press', 1.0) > 0.85);
  assert.ok(computePressVentChuteClearanceM('heavy-press', 1.0) > 0.85);
});

test('POL-282: machinePlumeGravity assigns ballistic downward gravity to drill/pylon/press and buoyant lift to mills/projectors/water', () => {
  assert.ok(machinePlumeGravity('drill') < -3.0);
  assert.ok(machinePlumeGravity('pylon') < -4.0);
  assert.ok(machinePlumeGravity('press') < 0);
  assert.ok(machinePlumeGravity('heavy-press') < 0);
  assert.ok(machinePlumeGravity('mill') > 0);
  assert.ok(machinePlumeGravity('heavy-projector') > 0);
  assert.ok(machinePlumeGravity('water') > 0);
  assert.equal(Object.keys(MACHINE_PLUME_GRAVITY).length, 12);
});

test('POL-39 & POL-73: evaluateHousingStatusLed reflects running, brownout blink, unpowered, and switched-off states', () => {
  const running = evaluateHousingStatusLed({ running: 1, connected: true, switchedOn: true, satisfaction: 1 });
  assert.equal(running.status, 'running');
  assert.equal(running.colour, '#22c55e');

  const brownout = evaluateHousingStatusLed({ running: 0.6, connected: true, switchedOn: true, satisfaction: 0.6, timeSec: 0 });
  assert.equal(brownout.status, 'warn');
  assert.equal(brownout.colour, '#f59e0b');

  const switchedOff = evaluateHousingStatusLed({ running: 0, connected: true, switchedOn: false });
  assert.equal(switchedOff.status, 'off');
  assert.equal(switchedOff.colour, '#ef4444');
});

test('POL-77: computeInspectorHopperView caps local hopper bar at 100 and reports excess network stock as (+N linked)', () => {
  const view = computeInspectorHopperView('Regolith Ore', 4835, 100);
  assert.equal(view.n, 100);
  assert.equal(view.cap, 100);
  assert.equal(view.linkedReserve, 4735);
  assert.equal(view.fill01, 1);
  assert.equal(view.formatted, 'Regolith Ore: 100 / 100 (+4735 linked)');
});
