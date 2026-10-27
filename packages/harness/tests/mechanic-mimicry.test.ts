// Plan 51: the mechanic mimicry transducer, held to oracles. A mechanic is simulated with FIDELITY's own solver and a KNOWN
// preset, observed as numbers, and the transducer must recover that preset's values: no mimic is claimed unless the oracle
// confirms it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVerticalJumpState, decodeKitMotionCode, decodeLocomotionCode, encodeKitMotionCode, encodeLocomotionCode,
  LOCOMOTION_PRESETS, stepVerticalJump, type LocomotionPreset,
} from '@hm/kinematic';
import { decodeLogicCode, encodeLogicCode, validateWireGraph } from '@hm/wiregraph';
import { createItemMemory, hypervectorSimilarity, isMechanicObservation, randomHypervector, transduceMechanic, type MechanicObservation } from '../src/index';

const within = (actual: number, expected: number, rel: number): boolean => Math.abs(actual - expected) <= Math.abs(expected) * rel;

/** Walks for 3 s then runs for 3 s along x at 60 Hz, jumping every 1.5 s, with the given preset: the "other game". */
function simulate(preset: LocomotionPreset, seconds = 6): MechanicObservation {
  const dt = 1 / 60;
  let s = createVerticalJumpState();
  let x = 0;
  const t: number[] = [], xs: number[] = [], ys: number[] = [], zs: number[] = [];
  for (let f = 0; f < Math.round(seconds / dt); f++) {
    const time = f * dt;
    const speed = time < seconds / 2 ? preset.walkSpeedMps : preset.runSpeedMps;
    const jumpHeld = f % 90 >= 20 && f % 90 < 23;
    s = stepVerticalJump(s, { dt, jumpHeld }, preset);
    x += speed * dt;
    t.push(time); xs.push(x); ys.push(s.heightAboveFloor); zs.push(0);
  }
  return { game: 'Test Game', channel: 'synthetic', trajectory: { t, x: xs, y: ys, z: zs } };
}

test('locomotion: gravity, jump impulse, walk and run are recovered within 5% of the known preset, and the shelf match names it', () => {
  for (const id of ['lunar-low-g', 'earth-standard', 'arcade-quake'] as const) {
    const truth = LOCOMOTION_PRESETS[id];
    const r = transduceMechanic(simulate(truth));
    assert.ok(r.locomotion, id);
    const m = r.locomotion!;
    assert.ok(within(m.gravityMps2, truth.gravityMps2, 0.05), `${id} gravity ${m.gravityMps2} vs ${truth.gravityMps2}`);
    assert.ok(within(m.jumpImpulseMps, truth.jumpImpulseMps, 0.05), `${id} jump ${m.jumpImpulseMps} vs ${truth.jumpImpulseMps}`);
    assert.ok(within(m.walkSpeedMps, truth.walkSpeedMps, 0.05), `${id} walk ${m.walkSpeedMps} vs ${truth.walkSpeedMps}`);
    assert.ok(within(m.runSpeedMps, truth.runSpeedMps, 0.05), `${id} run ${m.runSpeedMps} vs ${truth.runSpeedMps}`);
    assert.equal(r.nearest.locomotion?.id, id, `${id} nearest ${r.nearest.locomotion?.id}`);
    assert.ok(r.evidence.jumps >= 2);
    assert.ok(r.sieve && r.sieve.structuralModeCount > 0, 'the MDL sieve finds structure in the height signal');
    assert.ok(r.notes.some((n) => /mapped/.test(n)), 'the harness sliders say they are mapped, not identified');
  }
});

test('the mimicked locomotion travels as a loc: code and decodes to the same numbers; curated presets keep their names', () => {
  const r = transduceMechanic(simulate(LOCOMOTION_PRESETS['lunar-low-g']));
  const code = encodeLocomotionCode(r.locomotion!);
  assert.match(code, /^loc:v1:/);
  const back = decodeLocomotionCode(code)!;
  for (const k of ['walkSpeedMps', 'runSpeedMps', 'jumpImpulseMps', 'gravityMps2', 'airControl'] as const) assert.ok(Math.abs(back[k] - r.locomotion![k]) < 1e-3, k);
  assert.equal(encodeLocomotionCode(LOCOMOTION_PRESETS['earth-standard']), 'loc:earth-standard');
  assert.equal(decodeLocomotionCode('loc:v1:1:2:3'), null, 'a short code is refused');
  assert.equal(decodeLocomotionCode('loc:v1:99:2:3:4:0.5:0.1:0.1:0.5:3:100:10'), null, 'an out-of-range walk speed is refused');
});

test('fire: 3-round bursts become a valid logic graph (one delayed fire per round) and a recoil motion at the round rate', () => {
  const t: number[] = [], kick: number[] = [];
  for (let b = 0; b < 6; b++) for (let k = 0; k < 3; k++) { t.push(b * 0.66 + k * 0.08); kick.push(0.03); }
  const r = transduceMechanic({ game: 'Test Game', channel: 'telemetry', shots: { t, kick } });
  assert.deepEqual({ burst: r.fire!.burst, round: Math.round(r.fire!.roundGapS * 1000), gap: Math.round(r.fire!.burstGapS * 1000) }, { burst: 3, round: 80, gap: 500 });
  assert.ok(r.logic && validateWireGraph(r.logic).length === 0);
  assert.deepEqual(r.logic!.nodes.map((n) => n.delayMs), [0, 80, 160]);
  assert.equal(r.logic!.actuators.filter((a) => a.kind === 'fire-turret').length, 3);
  assert.deepEqual(r.motion, { kind: 'reciprocate', axis: 'z', rateHz: 12.5, amplitude: 0.03, phaseRad: 0 });
  // the codes round-trip
  assert.deepEqual(decodeLogicCode(encodeLogicCode(r.logic!)), r.logic);
  assert.deepEqual(decodeKitMotionCode(encodeKitMotionCode(r.motion!)), r.motion);
  // full auto: one latched fire at the rate
  const auto = transduceMechanic({ game: 'G', channel: 'telemetry', shots: { t: Array.from({ length: 20 }, (_, i) => i * 0.1) } });
  assert.equal(auto.fire!.burst, 1);
  assert.equal(auto.logic!.actuators[0]!.value, 600);
});

test('trigger → effect: a steady delay becomes a delay node, an every-Nth effect a counter, words pick the sensor and actuator', () => {
  const events: { t: number; name: string }[] = [];
  for (let i = 0; i < 5; i++) { events.push({ t: 1 + i * 2, name: 'enter-zone' }); events.push({ t: 1.25 + i * 2, name: 'door-open' }); }
  for (let i = 0; i < 12; i++) { events.push({ t: 20 + i * 0.5, name: 'hit' }); if (i % 3 === 2) events.push({ t: 20 + i * 0.5 + 0.1, name: 'chain-arc' }); }
  events.sort((a, b) => a.t - b.t);
  const r = transduceMechanic({ game: 'Rule Game', channel: 'game-files', events });
  assert.ok(r.logic && validateWireGraph(r.logic).length === 0);
  const door = r.logic!.actuators.find((a) => a.target === 'door-open')!;
  assert.equal(door.kind, 'open-door');
  assert.equal(r.logic!.nodes.find((n) => n.id === door.input)?.delayMs, 250);
  assert.equal(r.logic!.sensors.find((s) => s.target === 'enter-zone')?.kind, 'proximity');
  const arc = r.logic!.actuators.find((a) => a.target === 'chain-arc')!;
  assert.equal(arc.kind, 'fire-turret');
  assert.ok(r.logic!.nodes.some((n) => n.kind === 'counter' && n.counterTarget === 3), 'every third hit');
});

test('the VSA-4096 item memory preserves similarity (unlike the integrity signature): identical 1, unrelated about 0.5, monotone in distance', () => {
  const mem = createItemMemory([{ min: 0, max: 10 }, { min: 0, max: 10 }, { min: 0, max: 10 }]);
  const a = mem.encode([5, 5, 5]);
  assert.equal(hypervectorSimilarity(a, mem.encode([5, 5, 5])), 1);
  const r = hypervectorSimilarity(randomHypervector(1), randomHypervector(2));
  assert.ok(r > 0.45 && r < 0.55, `unrelated ${r}`);
  const s1 = hypervectorSimilarity(a, mem.encode([6, 5, 5]));
  const s3 = hypervectorSimilarity(a, mem.encode([8, 5, 5]));
  const s5 = hypervectorSimilarity(a, mem.encode([10, 5, 5]));
  assert.ok(s1 > s3 && s3 > s5 && s1 < 1, `${s1} > ${s3} > ${s5}`);
});

test('deterministic, guarded, and honest about the last-resort channel', () => {
  const obs = simulate(LOCOMOTION_PRESETS['earth-standard']);
  assert.deepEqual(transduceMechanic(obs), transduceMechanic(obs));
  const screen = transduceMechanic({ ...obs, channel: 'screen' });
  assert.ok(screen.confidence < transduceMechanic(obs).confidence, 'the screen rung is trusted less');
  assert.ok(screen.notes.some((n) => /last-resort/.test(n)));
  assert.equal(isMechanicObservation(obs), true);
  assert.equal(isMechanicObservation({ game: 'x', channel: 'memory-hack', events: [] }), false, 'no such rung');
  assert.equal(isMechanicObservation({ game: 'x', channel: 'telemetry' }), false, 'nothing observed');
  assert.equal(isMechanicObservation({ game: 'x', channel: 'telemetry', shots: { t: [0, 'a'] } }), false);
  // too little to read: no locomotion claimed beyond the shelf, and it says so
  const thin = transduceMechanic({ game: 'x', channel: 'telemetry', trajectory: { t: [0, 1], x: [0, 1], y: [0, 0], z: [0, 0] } });
  assert.ok(thin.notes.some((n) => /too short/.test(n)));
});
