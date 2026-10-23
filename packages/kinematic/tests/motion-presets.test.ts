import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_SHELF, MOTION_PRESET_SCHEMA, createKinematicMotionState, stepKinematicMotion, validateMotionPreset, resolveMotionCartridge, applyMotionCartridge, parseMotionPreset, serializeMotionPreset, type MotionPreset } from '../src/index';

const DT = 1 / 60;
function run(spec: MotionPreset, steps: number) {
  let s = createKinematicMotionState();
  const out = [s];
  for (let i = 0; i < steps; i++) { s = stepKinematicMotion(spec, s, { move: [1, 0], jumpPressed: i === 0 }, DT); out.push(s); }
  return out;
}
test('MOTION_SHELF: at least 6 canonical presets, all validate + schema covers Plan-43 tunables', () => {
  assert.ok(Object.keys(MOTION_SHELF).length >= 6);
  for (const id of ['hazmat-standard', 'lunar-low-g', 'heavy-exo-march', 'scout-agile', 'zero-g-thruster', 'retro-doom-glide']) assert.ok(MOTION_SHELF[id], id);
  for (const preset of Object.values(MOTION_SHELF)) assert.deepEqual(validateMotionPreset(preset), [], preset.id);
  const keys = new Set(MOTION_PRESET_SCHEMA.params.map((p) => p.key));
  for (const k of ['moveSpeed', 'sprintMultiplier', 'jumpHeight', 'gravityScale', 'airControl', 'coyoteTimeMs', 'stepFrequency', 'strideLength', 'hipBob', 'footIkWeight']) assert.ok(keys.has(k), k);
  assert.equal(new Set(MOTION_PRESET_SCHEMA.params.map((p) => p.key)).size, MOTION_PRESET_SCHEMA.params.length, 'schema keys unique');
});
test('every shelf preset evaluates deterministically across fixed dt steps', () => {
  for (const preset of Object.values(MOTION_SHELF)) assert.deepEqual(run(preset, 90), run(preset, 90), preset.id);
});
test('stepKinematicMotion honours jumpHeight and gravityScale identically across repeated runs', () => {
  const spec = MOTION_SHELF['hazmat-standard']!;
  const apex = Math.max(...run(spec, 120).map((s) => s.pos[1]));
  assert.ok(apex > 0.85 && apex < 1.3, `apex ${apex} should approximate jumpHeight 1.1`);
  const lowG: MotionPreset = { ...spec, jump: { ...spec.jump, gravityScale: 0.25 }, kinematic: { ...spec.kinematic, gravityScale: 0.25 } };
  const lowApex = Math.max(...run(lowG, 300).map((s) => s.pos[1]));
  assert.ok(lowApex > 0.85 && lowApex < 1.3, `low-g apex ${lowApex} still approximates jumpHeight`);
  const airTime = (p: MotionPreset): number => run(p, 400).findIndex((s, i) => i > 1 && s.onGround);
  assert.ok(airTime(lowG) > airTime(spec), 'lower gravity = longer hang time for same jumpHeight');
});
test('coyoteTimeMs: jump still fires inside the window, not after it', () => {
  const spec = MOTION_SHELF['hazmat-standard']!;
  const airborne = { ...createKinematicMotionState([0, 2, 0]), onGround: false, coyoteMs: spec.jump.coyoteTimeMs };
  assert.equal(stepKinematicMotion(spec, airborne, { move: [0, 0], jumpPressed: true }, DT).justJumped, true);
  let s = airborne;
  for (let i = 0; i < 30; i++) s = stepKinematicMotion(spec, s, { move: [0, 0] }, DT);
  assert.equal(stepKinematicMotion(spec, s, { move: [0, 0], jumpPressed: true }, DT).justJumped, false);
});
test('mot: cartridge hook resolves, applies and round-trips JSON', () => {
  assert.equal(resolveMotionCartridge('mot:scout-agile')?.id, 'scout-agile');
  assert.equal(resolveMotionCartridge('logic:scout-agile'), null);
  assert.equal(resolveMotionCartridge('mot:nope'), null);
  const applied = applyMotionCartridge({ kind: 'avatar' }, 'mot:lunar-low-g');
  assert.equal(applied?.motionPresetId, 'lunar-low-g'); assert.equal(applied?.kind, 'avatar');
  for (const preset of Object.values(MOTION_SHELF)) assert.deepEqual(parseMotionPreset(serializeMotionPreset(preset)), preset);
});
