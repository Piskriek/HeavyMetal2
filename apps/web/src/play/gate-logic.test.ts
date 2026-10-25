// ============================================================================
// File: apps/web/src/play/gate-logic.test.ts
// Plan 43 (logic:): the Stargate's iris and its ramp door are decided by the `stargate-iris-lock` wiregraph, not by an `if`
// beside it — a plot listed open admits, a valid code opens a `code-only` gate, and a `closed` plot opens for nobody.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { logicCartridgeId, resolveLogicCartridge, validateWireGraph, WIREGRAPH_SHELF } from '@hm/wiregraph';
import {
  accessFromIris,
  createGateLogicState,
  GATE_LOGIC_PRESET_ID,
  gateLogicSpec,
  gateStateNow,
  irisAccessFor,
  irisClosedForAccess,
  stepGateLogic,
} from './gate-logic';
import { stargateIrisClosed } from './kit-stargate';
import { GATE_ACCESS_MODES } from '../base/world';

test('the gate rule is a shelf preset that validates, and it drives the iris and the door', () => {
  const spec = gateLogicSpec();
  assert.equal(spec.id, GATE_LOGIC_PRESET_ID);
  assert.deepEqual(validateWireGraph(spec), []);
  assert.equal(WIREGRAPH_SHELF[GATE_LOGIC_PRESET_ID], spec, 'the game runs the shelf preset itself, not a copy of it');
  assert.ok(spec.actuators.some((a) => a.kind === 'lock-iris'), 'the iris is an actuator');
  assert.ok(spec.actuators.some((a) => a.kind === 'open-door'), 'so is the ramp door');
  assert.deepEqual(spec.sensors.map((s) => s.id).sort(), ['code', 'privacy-closed', 'privacy-open']);
  // and the Beam Rifle can carry it: `logic:stargate-iris-lock` resolves to the same graph
  assert.equal(resolveLogicCartridge(logicCartridgeId(GATE_LOGIC_PRESET_ID))?.id, spec.id);
});

test('open admits, code-only needs the code, closed admits nobody', () => {
  const open = gateStateNow({ access: 'open' });
  assert.equal(open.irisClosed, false);
  assert.equal(open.doorOpen, true, 'the ramp door opens exactly when the iris does');

  const codeNoCode = gateStateNow({ access: 'code-only' });
  assert.equal(codeNoCode.irisClosed, true, 'the shield stands on a code-only plot');
  assert.equal(codeNoCode.doorOpen, false);

  const codeWithCode = gateStateNow({ access: 'code-only', codeAccepted: true });
  assert.equal(codeWithCode.irisClosed, false, 'a visitor with the code gets through a code-only gate');
  assert.equal(codeWithCode.doorOpen, true);

  for (const codeAccepted of [false, true]) {
    const closed = gateStateNow({ access: 'closed', codeAccepted });
    assert.equal(closed.irisClosed, true, `a closed plot stays shut (code ${codeAccepted})`);
    assert.equal(closed.doorOpen, false);
  }
});

test('the kit rule and the world map are the graph\'s own answers', () => {
  // the kit's question has one answer per mode, and it is the rule's (this is the behaviour the world shipped, now derived)
  for (const mode of GATE_ACCESS_MODES) {
    assert.equal(stargateIrisClosed(mode), mode !== 'open', mode);
    assert.equal(irisClosedForAccess(mode), mode !== 'open', mode);
    assert.equal(irisAccessFor({ access: mode }), mode, `${mode} round-trips through the graph`);
  }
  // and the mapping back: a shut iris keeps the plot's own mode when it is closed, otherwise the shield reads as code-only
  assert.equal(accessFromIris(false), 'open');
  assert.equal(accessFromIris(true, 'closed'), 'closed');
  assert.equal(accessFromIris(true, 'code-only'), 'code-only');
  assert.equal(accessFromIris(true, 'open'), 'code-only', 'a shut iris is never reported as an open gate');
});

test('the graph is deterministic: the same readings give the same gate, however many times it is asked', () => {
  const readings = [{ access: 'code-only' as const }, { access: 'open' as const }, { access: 'code-only' as const, codeAccepted: true }];
  const first = readings.map((r) => gateStateNow(r));
  const second = readings.map((r) => gateStateNow(r));
  assert.deepEqual(first.map((s) => [s.irisClosed, s.doorOpen]), second.map((s) => [s.irisClosed, s.doorOpen]));
  // stepping a kept state gives the same answer as stepping a fresh one (nothing latches, so a scrub cannot drift)
  let state = createGateLogicState();
  for (const r of readings) state = stepGateLogic(state, r, 16).state;
  const again = stepGateLogic(state, readings[0]!, 16);
  const fresh = stepGateLogic(createGateLogicState(), readings[0]!, 16);
  assert.deepEqual([again.irisClosed, again.doorOpen], [fresh.irisClosed, fresh.doorOpen]);
  // a bad dt is clamped, not propagated
  const clamped = stepGateLogic(createGateLogicState(), readings[1]!, Number.NaN);
  assert.equal(clamped.doorOpen, true);
});
