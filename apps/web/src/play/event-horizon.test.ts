// ============================================================================
// File: apps/web/src/play/event-horizon.test.ts
// JOB-08b: the Stargate's event horizon. Every envelope is a pure function of (simTime, gateState, lastEventTime), the
// kawoosh's 0.18 s attack and 1.1 s decay are monotonic, the shutdown cools monotonically to exactly 0.0, and the rim
// clamp reaches exactly 0.0 at the glyph wall.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CHEVRON_COUNT,
  EVENT_HORIZON_FRAGMENT,
  applyEventHorizon,
  createEventHorizonMaterial,
  eventHorizonUniforms,
  horizonEdgeAt,
  kawooshBurst,
  lockEnvelope,
  shutdownFade,
  steadyHorizon,
  type GateHorizonState,
} from './event-horizon';

const OPEN: GateHorizonState = { open: true, irisClosed: false, chevrons: CHEVRON_COUNT };
const CLOSED: GateHorizonState = { open: false, irisClosed: true, chevrons: 0 };

test('the kawoosh bursts for a monotonic 0.18 s attack and a monotonic 1.1 s decay, then is exactly 0', () => {
  assert.equal(kawooshBurst(0), 0);
  assert.equal(kawooshBurst(-1), 0, 'an event in the future has not happened');
  let prev = -1;
  for (let i = 1; i <= 18; i++) {
    const v = kawooshBurst((i / 18) * 0.18);
    assert.ok(v >= prev - 1e-12, `attack is monotonic at ${i}`);
    assert.ok(v >= 0 && v <= 1, `attack in range at ${i}: ${v}`);
    prev = v;
  }
  assert.ok(Math.abs(kawooshBurst(0.18) - 1) < 1e-12, 'the peak is exactly 1.0 at the end of the attack');
  prev = 2;
  for (let i = 1; i <= 110; i++) {
    const v = kawooshBurst(0.18 + (i / 110) * 1.1);
    assert.ok(v <= prev + 1e-12, `decay is monotonic at ${i}`);
    assert.ok(v >= 0, 'never negative');
    prev = v;
  }
  assert.equal(kawooshBurst(0.18 + 1.1), 0, 'the burst is spent at 1.28 s');
  assert.equal(kawooshBurst(0.18 + 40), 0);
});

test('the lock envelope is nine discrete chevron steps from 0.0 to exactly 1.0', () => {
  assert.equal(CHEVRON_COUNT, 9);
  assert.equal(lockEnvelope(0), 0);
  assert.equal(lockEnvelope(9), 1);
  let prev = -1;
  const values = new Set<number>();
  for (let n = 0; n <= 9; n++) {
    const v = lockEnvelope(n);
    values.add(v);
    assert.ok(v > prev, `step ${n} locks`);
    prev = v;
  }
  assert.equal(values.size, 10, 'nine steps plus the open state');
  assert.equal(lockEnvelope(12), 1, 'clamped');
  assert.equal(lockEnvelope(-3), 0, 'clamped');
});

test('the shutdown cools monotonically from 1.0 to exactly 0.0, so closing never pops', () => {
  assert.equal(shutdownFade(0), 1, 'the closing frame is still at full strength');
  let prev = 2;
  for (let i = 1; i <= 90; i++) {
    const v = shutdownFade((i / 90) * 0.9);
    assert.ok(v <= prev + 1e-12, `cooling is monotonic at ${i}`);
    assert.ok(v >= 0, 'never negative');
    prev = v;
  }
  assert.equal(shutdownFade(0.9), 0, 'exactly 0.0 at the end');
  assert.equal(shutdownFade(3), 0);
});

test('the steady pool is pushed aside by the burst and settles back to full', () => {
  assert.equal(steadyHorizon(0), 1);
  assert.ok(Math.abs(steadyHorizon(1) - 0.15) < 1e-12, `damped to ${steadyHorizon(1)}`);
  let lowest = 2;
  for (let i = 0; i <= 20; i++) lowest = Math.min(lowest, steadyHorizon(i / 20));
  assert.ok(Math.abs(lowest - 0.15) < 1e-12, 'the floor is the burst at full strength');
  assert.ok(steadyHorizon(0.5) < steadyHorizon(0.25), 'the burst damps the ripples');
});

test('the uniforms are a pure function of (simTime, gateState, lastEventTime): no accumulated frame delta', () => {
  const state: GateHorizonState = { open: true, irisClosed: false, chevrons: 9 };
  const direct = eventHorizonUniforms(40, state, 39.5);
  // a thousand sequential frames must not drift the value away from the one the clock alone gives
  let last = direct;
  for (let i = 0; i <= 1000; i++) last = eventHorizonUniforms(40, state, 39.5);
  assert.deepEqual(last, direct);
  // and a scrub straight to 40 s equals the frame the play-through reached at 40 s
  const stepped: unknown[] = [];
  for (let f = 0; f <= 2400; f++) stepped.push(eventHorizonUniforms(f / 60, state, 39.5));
  assert.deepEqual(stepped[2400], direct);
  // the burst is the same 0.5 s after the event whatever the absolute clock says (`uTime` is the clock itself, so it is
  // the one field that must differ: nothing else may)
  const later = eventHorizonUniforms(400, state, 399.5);
  assert.deepEqual({ ...later, uTime: 0 }, { ...direct, uTime: 0 });
});

test('an open gate holds the pool; a closed one fades to exactly 0 and masks the kawoosh behind the iris', () => {
  const open = eventHorizonUniforms(12, OPEN, 11.9);
  assert.equal(open.uShutdownFade, 1);
  assert.equal(open.uIrisMask, 0);
  assert.equal(open.uLockEnvelope, 1);
  assert.ok(open.uKawooshBurst > 0 && open.uKawooshBurst <= 1);

  const iris = eventHorizonUniforms(12, { ...OPEN, irisClosed: true }, 11.9);
  assert.equal(iris.uIrisMask, 1, 'the iris is locked');
  assert.equal(iris.uKawooshBurst, open.uKawooshBurst, 'the envelope is unchanged: the shader clamps what reaches the ring');

  const closing = eventHorizonUniforms(20, CLOSED, 20);
  assert.equal(closing.uShutdownFade, 1, 'the closing frame is not a pop');
  assert.equal(closing.uKawooshBurst, 0, 'a closing gate is not a kawoosh');
  const gone = eventHorizonUniforms(21, CLOSED, 20);
  assert.equal(gone.uShutdownFade, 0, 'cooled to exactly 0.0');
  const never = eventHorizonUniforms(0, CLOSED, -Infinity);
  assert.equal(never.uShutdownFade, 0, 'a gate that never connected draws nothing');
});

test('the aperture edge reaches exactly 0.0 at the glyph wall and exactly 1.0 a rim inside it', () => {
  const inner = 1.32;
  const rim = 0.18;
  assert.equal(horizonEdgeAt(inner - rim, inner, rim), 1);
  assert.equal(horizonEdgeAt(inner - rim - 0.3, inner, rim), 1);
  assert.equal(horizonEdgeAt(inner, inner, rim), 0, 'exactly 0.0 on the wall');
  assert.equal(horizonEdgeAt(inner + 0.4, inner, rim), 0, 'nothing outside the wall');
  let prev = 2;
  for (let i = 0; i <= 40; i++) {
    const r = inner - rim - 0.2 + (i / 40) * (rim + 0.4);
    const v = horizonEdgeAt(r, inner, rim);
    assert.ok(v <= prev + 1e-12, `the edge is monotonic at r=${r.toFixed(3)}`);
    assert.ok(v >= 0 && v <= 1, 'in range');
    prev = v;
  }
  // the mid-rim value is the smoothstep's own 0.5, which is what keeps the wall seam-free
  assert.ok(Math.abs(horizonEdgeAt(inner - rim / 2, inner, rim) - 0.5) < 1e-9);
});

test('the shader declares every envelope and clamps the rim through the same smoothstep the CPU proves', () => {
  for (const name of ['uLockEnvelope', 'uKawooshBurst', 'uSteadyHorizon', 'uShutdownFade', 'uIrisMask', 'uInnerRadius', 'uRimWidth', 'uDispersion']) {
    assert.ok(EVENT_HORIZON_FRAGMENT.includes(`uniform float ${name}`), `declares ${name}`);
  }
  assert.ok(EVENT_HORIZON_FRAGMENT.includes('smoothstep(uInnerRadius, uInnerRadius - uRimWidth, r)'), 'the rim clamp');
  assert.ok(EVENT_HORIZON_FRAGMENT.includes('uIrisMask'), 'the iris clamp');
  assert.ok(EVENT_HORIZON_FRAGMENT.includes('uShutdownFade'), 'the shutdown fade');
  // no uniform is ever written to: every envelope is an input the CPU evaluates, never something the shader accumulates
  assert.ok(!/^\s*u[A-Za-z0-9]+\s*(?:\+=|-=|\*=|\/=)/m.test(EVENT_HORIZON_FRAGMENT), 'no uniform accumulation in the shader');
});

test('the material holds the horizon uniforms and one frame writes them all, twice the same', () => {
  const material = createEventHorizonMaterial({ innerRadius: 1.32, rimWidth: 0.18 });
  assert.ok(material.uniforms.uInnerRadius);
  assert.equal(material.uniforms.uInnerRadius?.value, 1.32);
  assert.equal(material.depthWrite, false);
  const u = eventHorizonUniforms(8, OPEN, 7.8);
  applyEventHorizon(material, u);
  const first = JSON.stringify(Object.fromEntries(Object.entries(material.uniforms).map(([k, v]) => [k, v.value])));
  applyEventHorizon(material, u);
  const second = JSON.stringify(Object.fromEntries(Object.entries(material.uniforms).map(([k, v]) => [k, v.value])));
  assert.equal(second, first);
  assert.equal(material.uniforms.uKawooshBurst?.value, u.uKawooshBurst);
  assert.equal(material.uniforms.uSteadyHorizon?.value, u.uSteadyHorizon);
  assert.equal(material.uniforms.uShutdownFade?.value, 1);
  material.dispose();
  assert.ok(THREE.REVISION.length > 0);
});
