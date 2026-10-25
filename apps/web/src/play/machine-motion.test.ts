// ============================================================================
// File: apps/web/src/play/machine-motion.test.ts
// Plan 43 (anim:): a machine's moving parts are declarative `KitMotionSpec`s posed by a pure evaluator, so the ram, the
// projector head and the drill bit land in the same place at the same timestamp — live, scrubbed or replayed — and step
// at the plot's Fidelity Stage rather than at whatever the frame rate happens to be.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluateKitMotion } from '@hm/kinematic';
import { HEAVY_KINDS, MACHINE_KINDS } from '@hm/plotsim';
import {
  DRILL_BIT_SPIN,
  HEAVY_PRESS_RAM_STROKE,
  HEAVY_PRESS_RAM_STROKE_B,
  HOUSING_LED_BLINK,
  MACHINE_MOTION,
  motionFor,
  motionPeriodSeconds,
  PRESS_CORE_RAM_STROKE,
  PRESS_RAM_STROKE,
  PRESS_RAM_STROKE_B,
  PROJECTOR_HEAD_TILT,
  RAM_CADENCE_RAD,
  strokeHz,
  validateMotionSpec,
} from './kit-motion-specs';
import { driven, drivenAll, driveMotion, poseDriven } from './machine-motion';

const close = (a: number | undefined, b: number | undefined, eps = 1e-12): boolean => Math.abs((a ?? Number.NaN) - (b ?? Number.NaN)) <= eps;
const poseAt = (spec: Parameters<typeof evaluateKitMotion>[0], t: number, run = 1, stage = 6) => evaluateKitMotion(spec, t, run, stage);

test('every machine kind is in the motion table, and every spec it names is legal', () => {
  const allKinds = [...MACHINE_KINDS, ...HEAVY_KINDS];
  assert.deepEqual(Object.keys(MACHINE_MOTION).sort(), [...allKinds].sort(), 'the table covers every kind, so no kind animates ad hoc');
  for (const kind of allKinds) {
    const parts = MACHINE_MOTION[kind];
    assert.equal(new Set(parts.map((p) => p.part)).size, parts.length, `${kind}'s part handles are unique`);
    for (const { part, spec } of parts) assert.deepEqual(validateMotionSpec(spec), [], `${kind}/${part}`);
  }
  // the four machines with something moving, and the seven that stand still
  const moving = allKinds.filter((k) => MACHINE_MOTION[k].length > 0);
  assert.deepEqual([...moving].sort(), ['drill', 'heavy-press', 'heavy-projector', 'press', 'projector']);
  assert.equal(motionFor('mill', 'drum'), null, 'a mill drum is not a named mover');
  assert.equal(motionFor('drill', 'bit')?.kind, 'spin');
  assert.equal(motionFor('press', 'ram-b')?.phaseRad, Math.PI, 'the twin strikes half a cycle behind');
  for (const bad of [{ rateHz: 0, amplitude: 1 }, { rateHz: Number.NaN, amplitude: 1 }, { rateHz: 1, amplitude: -1 }]) {
    assert.ok(validateMotionSpec({ kind: 'reciprocate', axis: 'y', ...bad }).length > 0, JSON.stringify(bad));
  }
  assert.ok(validateMotionSpec({ kind: 'spin', axis: 'y', rateHz: 1, amplitude: 1, phaseRad: Number.NaN }).length > 0);
});

test('the ram stroke and the pour cadence are one number, in two units', () => {
  // the plume table is in radians per second (ARGO_NOTE_08 section 3); a motion spec is in Hz
  assert.ok(close(strokeHz(RAM_CADENCE_RAD.fast), 3.1 / (Math.PI * 2)));
  assert.ok(close(PRESS_RAM_STROKE.rateHz, 3.1 / (Math.PI * 2)), 'the Shape Press strikes on its pour beat');
  assert.ok(close(HEAVY_PRESS_RAM_STROKE.rateHz, 2.0 / (Math.PI * 2)), 'the Heavy Shape Press strikes on ram-heavy');
  assert.ok(close(PRESS_CORE_RAM_STROKE.rateHz, PRESS_RAM_STROKE.rateHz), 'a generated core taps on the same beat');
  assert.ok(close(motionPeriodSeconds(PRESS_RAM_STROKE), (Math.PI * 2) / 3.1), 'one stroke per cadence cycle');
  assert.equal(motionPeriodSeconds({ kind: 'spin', axis: 'y', rateHz: 0, amplitude: 1 }), Number.POSITIVE_INFINITY);
  // the twin is the same spec, half a cycle out
  assert.ok(close(PRESS_RAM_STROKE_B.rateHz, PRESS_RAM_STROKE.rateHz));
  assert.ok(close(PRESS_RAM_STROKE_B.amplitude, PRESS_RAM_STROKE.amplitude));
});

test('a pose is pure in (simTime, stage): scrubbing equals stepping, and a period lands where it started', () => {
  const specs = [PRESS_RAM_STROKE, PROJECTOR_HEAD_TILT, DRILL_BIT_SPIN];
  for (const spec of specs) {
    const period = motionPeriodSeconds(spec);
    const step = 1 / 8;  // exact in binary, and on the 60 Hz S6 grid
    const t = step * 27;
    const one = poseAt(spec, t);
    // stepping there one frame at a time leaves the same pose: nothing accumulates
    let stepped = poseAt(spec, 0);
    for (let k = 1; k <= 27; k++) stepped = poseAt(spec, k * step);
    if (!spec.phaseRad) {
      for (let i = 0; i < 3; i++) assert.ok(close(one.posOffset[i], stepped.posOffset[i]), `${spec.kind} pos ${i}`);
      for (let i = 0; i < 3; i++) assert.ok(close(one.rotOffset[i], stepped.rotOffset[i]), `${spec.kind} rot ${i}`);
    }
    // four periods later the pose is back where it was, to within the stage's own grid step (the clock is quantised before
    // the curve is sampled, so a period that is not a whole number of grid steps can land one step out)
    const later = poseAt(spec, t + period * 4);
    const slack = spec.amplitude * Math.PI * 2 * spec.rateHz / 60 + 1e-9;
    for (let i = 0; i < 3; i++) assert.ok(close(one.posOffset[i], later.posOffset[i], slack), `${spec.kind} pos ${i} repeats`);
    for (let i = 0; i < 3; i++) assert.ok(close(one.rotOffset[i], later.rotOffset[i], slack), `${spec.kind} rot ${i} repeats`);
  }
  // a period that is a whole number of grid steps repeats exactly: the LED blink is 2 Hz, 30 steps at S6
  const blinkPeriod = motionPeriodSeconds(HOUSING_LED_BLINK);
  assert.equal(blinkPeriod, 0.5);
  for (const at of [1.5, 2.25, 7.75]) {
    const a = poseAt(HOUSING_LED_BLINK, at), b = poseAt(HOUSING_LED_BLINK, at + blinkPeriod * 9);
    assert.ok(close(a.rotOffset[1], b.rotOffset[1], 1e-12), `blink repeats exactly at ${at}`);
  }
});

test('the pose steps at the stage: 8 Hz at S0, continuous at S6', () => {
  const spec = PRESS_RAM_STROKE;
  // 0.13 s quantises to 0.125 on S0's 8 Hz grid, and to 0.11666... on S6's 60 Hz one
  const a = poseAt(spec, 0.13, 1, 0);
  const b = poseAt(spec, 0.125, 1, 0);
  assert.ok(close(a.posOffset[1], b.posOffset[1]), 'S0 holds the stroke until its next step');
  assert.ok(!close(a.posOffset[1], poseAt(spec, 0.13, 1, 6).posOffset[1], 1e-6), 'S6 is not on S0\'s grid');
  assert.ok(!close(b.posOffset[1], poseAt(spec, 0.13, 1, 1).posOffset[1], 1e-6), 'S1 is not on S0\'s grid either');
  // run 0 parks the part wherever its builder put it, at every stage
  for (const stage of [0, 3, 6]) {
    const p = poseAt(spec, 1.23, 0, stage);
    assert.deepEqual(p.posOffset, [0, 0, 0]);
    assert.deepEqual(p.rotOffset, [0, 0, 0]);
  }
});

test('a driven part remembers its rest pose, and posing never drifts past it', () => {
  const ram = new THREE.Object3D();
  ram.position.set(0.55, 2.1, -0.25);
  ram.rotation.set(0.1, 0.2, 0.3);
  const bound = driven(ram, HEAVY_PRESS_RAM_STROKE);
  assert.deepEqual(bound.restPosition, [0.55, 2.1, -0.25]);
  poseDriven([bound], 0.4, 1);
  assert.ok(ram.position.y < 2.1, 'the ram struck downwards');
  assert.ok(close(ram.position.x, 0.55) && close(ram.position.z, -0.25), 'it only moves on its own axis');
  assert.deepEqual([ram.rotation.x, ram.rotation.y, ram.rotation.z], [0.1, 0.2, 0.3], 'a stroke does not turn the part');
  // an idle machine sits exactly where it was built, however long the clock has run
  poseDriven([bound], 137.25, 0);
  assert.deepEqual([ram.position.x, ram.position.y, ram.position.z], [0.55, 2.1, -0.25]);
  // a second part is bound to its own rest and its own phase
  const twin = new THREE.Object3D();
  twin.position.set(-0.55, 2.1, -0.25);
  const both = [bound, driven(twin, HEAVY_PRESS_RAM_STROKE_B)];
  poseDriven(both, 0.25, 1);
  assert.ok(ram.position.y !== twin.position.y, 'the twins are never at the same height');
});

test('driveMotion is a prop animate, and a frame of nothing is nothing', () => {
  const head = new THREE.Object3D();
  const frames: number[] = [];
  const animate = driveMotion([driven(head, PROJECTOR_HEAD_TILT)]);
  // a little under eighteen seconds a cycle: sample across two of them
  for (const t of [0, 4.5, 9, 13.5, 18]) {
    animate(t, 1, 6);
    frames.push(head.rotation.x);
  }
  // the sway is a sine: it swings both ways rather than winding up
  assert.ok(frames.some((x) => x > 0) && frames.some((x) => x < 0), JSON.stringify(frames));
  assert.ok(frames.every((x) => Math.abs(x) <= PROJECTOR_HEAD_TILT.amplitude + 1e-12));
  // at S1 the same three samples are quantised to 12 Hz: frames 0.5 and 1.5 are exact steps, 2.5 too
  animate(2.51, 1, 1);
  assert.ok(close(head.rotation.x, poseAt(PROJECTOR_HEAD_TILT, 2.5, 1, 1).rotOffset[0]));
  // a kit frame that produced no ram on this tier binds nothing and animates nothing
  assert.deepEqual(drivenAll([[null, HEAVY_PRESS_RAM_STROKE], [undefined, HOUSING_LED_BLINK]]), []);
  const still = driveMotion([]);
  assert.doesNotThrow(() => still(9, 1));
});

test('the kit frame says how its rams move: the socket carries the stroke, not the builder', async () => {
  const { presetSockets } = await import('@hm/kitspec');
  const { PRESS_FRAME_KIT } = await import('./kit-press-frame');
  const sockets = presetSockets(PRESS_FRAME_KIT, 'press-frame');
  assert.deepEqual(sockets.ramLeft?.motion, HEAVY_PRESS_RAM_STROKE, 'the left ram socket carries the ram-heavy stroke');
  assert.deepEqual(sockets.ramRight?.motion, HEAVY_PRESS_RAM_STROKE_B, 'and the right one the same, half a cycle behind');
  assert.deepEqual(sockets.ramLeft?.at, [-0.55, 2.1, 0], 'the socket itself stays where the core put it');
  // the other kits have nothing on a socket that moves: their frames are static, so a builder binds nothing
  const { MILL_FRAME_KIT } = await import('./kit-mill-frame');
  const mill = presetSockets(MILL_FRAME_KIT, 'mill-frame');
  assert.ok(Object.values(mill).every((s) => s.motion === undefined));
});
