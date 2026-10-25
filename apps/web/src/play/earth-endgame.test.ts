// ============================================================================
// File: apps/web/src/play/earth-endgame.test.ts
// JOB-09 (Plan 42 part 3): the Earth endgame is a pure function of (stage, cardinals, gate state, plot, clock, world
// stats). These tests pin the parts the game leans on: the transit rule and its reasons, the horizon crossing, the
// dual-world telemetry hook, the monument, the credit roll's clock, and the World v5 save block.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_BIOME_PRESET, MOON_BIOME_PRESET } from '../base/biome-preset';
import {
  EARTH_ARRIVAL_SECTOR,
  EARTH_GATE_PLACEMENT,
  ENDGAME_STAGE,
  FIDELITY_CREDITS_SECONDS,
  GATE_CHEVRONS,
  MOON_RETURN_SECTOR,
  arrivalSector,
  cardinalLike,
  creditsFinished,
  creditsProgress,
  crossedHorizon,
  dualWorldGateTelemetry,
  earthEndgameState,
  endgameMonument,
  endgameSaveFor,
  endgameUnlocked,
  fidelityEndingCredits,
  gateTransit,
  isEndgameActive,
  readEndgameSave,
  transitArrival,
  transitEventFor,
  type EndgameInput,
} from './earth-endgame';
import { DEFAULT_GATE_PLACEMENT, isEarthSandboxUnlocked } from '@hm/coopnet/gate-dialer';

/** A finished plot: stage six, four cardinals, a powered and live gate, the breach stabilised, standing on Earth. */
const finished = (over: Partial<EndgameInput> = {}): EndgameInput => ({
  stage: ENDGAME_STAGE,
  cardinals: 100,
  plot: 'earth',
  gate: { powered: true, open: true, irisClosed: false, access: 'open', chevrons: GATE_CHEVRONS, addressCode: EARTH_GATE_PLACEMENT.addressCode },
  breachStabilised: true,
  stats: { machinesPowered: 9, machinesTotal: 11, cartridgesApplied: 14, auditsGreen: true, coverage: 0.72 },
  simTime: 1000,
  lastGateEventTime: 990,
  ...over,
});

test('the endgame unlocks on stage six and the four cardinals, and on nothing less', () => {
  assert.equal(ENDGAME_STAGE, 6);
  assert.equal(endgameUnlocked({ stage: 6, cardinals: 100 }), true);
  assert.equal(endgameUnlocked({ stage: 6, cardinals: 99 }), false, 'three cardinals held is not four');
  assert.equal(endgameUnlocked({ stage: 5, cardinals: 100 }), false);
  assert.equal(endgameUnlocked({ stage: 6, cardinals: { Pxd: 100, Vtx: 100, Lx: 100, Aq: 100 } }), true);
  assert.equal(endgameUnlocked({ stage: 6, cardinals: { Pxd: 100, Vtx: 100, Lx: 100, Aq: 0 } }), false);
  // the module reads the same rule the gate dialer does, on both of its scales
  assert.equal(endgameUnlocked({ stage: 6, cardinals: 1 }), isEarthSandboxUnlocked(6, cardinalLike(1)));
  assert.deepEqual(cardinalLike(100), { Pxd: 100, Vtx: 100, Lx: 100, Aq: 100 });
});

test('a live, un-irised horizon on a powered gate is the only way through, and it says why when it is not', () => {
  const open = gateTransit(finished({ plot: 'moon' }));
  assert.equal(open.ready, true);
  assert.equal(open.to, 'earth');

  const home = gateTransit(finished());
  assert.equal(home.ready, true);
  assert.equal(home.to, 'moon');

  assert.equal(gateTransit(finished({ stage: 5 })).ready, false);
  assert.match(gateTransit(finished({ stage: 5 })).why, /stage 6/);
  assert.match(gateTransit(finished({ gate: { ...finished().gate, powered: false } })).why, /no power/);
  assert.match(gateTransit(finished({ gate: { ...finished().gate, irisClosed: true } })).why, /iris/);
  assert.match(gateTransit(finished({ gate: { ...finished().gate, open: false } })).why, /chevrons/);
  assert.match(gateTransit(finished({ gate: { ...finished().gate, chevrons: 8 } })).why, /8 of 9/);
});

test('a step crosses the horizon only through the aperture, whichever way the gate faces', () => {
  const aperture = { centre: [0, 2.6, 0] as const, radius: 2.2, yaw: 0 };
  // straight through the middle
  assert.equal(crossedHorizon({ x: 0, y: 2.6, z: 1 }, { x: 0, y: 2.6, z: -1 }, aperture), true);
  // walking beside the ring, not through it
  assert.equal(crossedHorizon({ x: 9, y: 2.6, z: 1 }, { x: 9, y: 2.6, z: -1 }, aperture), false);
  // under the sill: the ring's centre is at 2.6 m and the aperture is 2.2 m across
  assert.equal(crossedHorizon({ x: 0, y: 0.2, z: 1 }, { x: 0, y: 0.2, z: -1 }, aperture), false);
  // never reaching the plane at all
  assert.equal(crossedHorizon({ x: 0, y: 2.6, z: 1 }, { x: 0, y: 2.6, z: 2 }, aperture), false);
  // a gate turned by 90 degrees: the plane is the z axis now
  assert.equal(crossedHorizon({ x: 1, y: 2.6, z: 0 }, { x: -1, y: 2.6, z: 0 }, { ...aperture, yaw: Math.PI / 2 }), true);
  assert.equal(crossedHorizon({ x: 1, y: 2.6, z: 0 }, { x: -1, y: 2.6, z: 0 }, aperture), false);
  // a fast drive and a slow walk cross on the frame they pass the plane, not after a delay
  assert.equal(crossedHorizon({ x: 0, y: 2.6, z: 30 }, { x: 0, y: 2.6, z: -30 }, aperture), true);
});

test('the transit event is the crossing plus the rule, and nothing else', () => {
  assert.equal(transitEventFor(finished({ plot: 'moon' }), true), 'to-earth');
  assert.equal(transitEventFor(finished(), true), 'to-moon');
  assert.equal(transitEventFor(finished({ plot: 'moon' }), false), null);
  assert.equal(transitEventFor(finished({ plot: 'moon', gate: { ...finished().gate, irisClosed: true } }), true), null);
});

test('the arrival is one deterministic object: sector, biome, chevrons and the event', () => {
  const toEarth = transitArrival(finished({ plot: 'moon' }));
  assert.ok(toEarth);
  assert.equal(toEarth!.to, 'earth');
  assert.deepEqual(toEarth!.sector, EARTH_ARRIVAL_SECTOR);
  assert.equal(toEarth!.biome, EARTH_BIOME_PRESET);
  assert.equal(toEarth!.chevrons, GATE_CHEVRONS);
  assert.equal(toEarth!.event, 'to-earth');

  const home = transitArrival(finished());
  assert.ok(home);
  assert.deepEqual(home!.sector, MOON_RETURN_SECTOR);
  assert.equal(home!.biome, MOON_BIOME_PRESET);
  assert.equal(home!.event, 'to-moon');

  assert.equal(transitArrival(finished({ gate: { ...finished().gate, powered: false } })), null);
  assert.deepEqual(arrivalSector('earth'), EARTH_ARRIVAL_SECTOR);
  assert.deepEqual(arrivalSector(null), MOON_RETURN_SECTOR);
});

test('the Earth arrival pad is the gate dialer’s own placement maths, 3.5 m in front of the gate', () => {
  // `EARTH_ARRIVAL_SECTOR` is `resolveMovedGatePose(placement).arrivalPad`, so walking out of the horizon faces the plot
  assert.equal(EARTH_GATE_PLACEMENT.addressCode, DEFAULT_GATE_PLACEMENT.addressCode);
  assert.ok(Math.hypot(EARTH_ARRIVAL_SECTOR.x - EARTH_GATE_PLACEMENT.x, EARTH_ARRIVAL_SECTOR.z - EARTH_GATE_PLACEMENT.z) > 3, 'the pad stands clear of the ring');
  assert.equal(typeof EARTH_ARRIVAL_SECTOR.yaw, 'number');
});

test('the dual-world telemetry links the two gates only while power reaches both, and offers the return dial', () => {
  const powered = dualWorldGateTelemetry(finished({ plot: 'moon' }));
  assert.equal(powered.powered, true);
  assert.equal(powered.moonGate.world, 'moon');
  assert.equal(powered.earthGate.world, 'earth');
  assert.equal(powered.moonGate.dialable, true);
  assert.equal(powered.earthGate.dialable, true);
  assert.equal(powered.returnDial.ready, false, 'the return dial is offered from the Earth side');
  assert.equal(powered.returnDial.code, EARTH_GATE_PLACEMENT.addressCode);
  // the Earth gate's pose comes from `movePlotGate`, so a moved gate is resolved, never hand-placed
  assert.deepEqual(
    { x: powered.earthGate.pose.x, y: powered.earthGate.pose.y, z: powered.earthGate.pose.z, yaw: powered.earthGate.pose.yaw },
    { x: EARTH_GATE_PLACEMENT.x, y: EARTH_GATE_PLACEMENT.y, z: EARTH_GATE_PLACEMENT.z, yaw: EARTH_GATE_PLACEMENT.yaw },
  );

  const onEarth = dualWorldGateTelemetry(finished());
  assert.equal(onEarth.returnDial.ready, true);

  const unpowered = dualWorldGateTelemetry(finished({ gate: { ...finished().gate, powered: false } }));
  assert.equal(unpowered.powered, false);
  assert.equal(unpowered.moonGate.dialable, false);
  assert.equal(unpowered.earthGate.dialable, false);
  assert.equal(unpowered.returnDial.ready, false);

  const closed = dualWorldGateTelemetry(finished({ gate: { ...finished().gate, access: 'closed' } }));
  assert.equal(closed.returnDial.ready, false, 'a closed gate does not answer a return dial');
  assert.equal(closed.earthGate.access, 'closed');
});

test('the monument reports deterministic build stats and keeps the sandbox open', () => {
  const monument = endgameMonument(finished());
  assert.equal(monument.title, 'Multiverse Telemetry');
  assert.equal(monument.interactive, true, 'post-win building, driving and cartridges stay on');
  const stats = Object.fromEntries(monument.stats.map((s) => [s.label, s.value]));
  assert.equal(stats.Power, '82%'); // 9 of 11
  assert.equal(stats.Cartridges, '14');
  assert.equal(stats.Audits, 'green');
  assert.equal(stats.Coverage, '72%');
  assert.equal(stats.Worlds, 'linked');
  // the same inputs give the same monument, every call
  assert.deepEqual(endgameMonument(finished()), monument);
  // and an unpowered gate reads as one world, not two
  assert.equal(endgameMonument(finished({ gate: { ...finished().gate, powered: false } })).stats.at(-1)?.value, 'one');
});

test('the credit roll is pure data started at the clock reading, and its progress is a function of the clock', () => {
  const credits = fidelityEndingCredits(finished({ simTime: 500 }));
  assert.equal(credits.startedAt, 500);
  assert.equal(credits.seconds, FIDELITY_CREDITS_SECONDS);
  assert.equal(credits.title, 'FIDELITY');
  assert.ok(credits.chapters.length >= 4);
  assert.ok(credits.chapters.every((c) => c.lines.length > 0));
  assert.equal(creditsProgress(credits, 500), 0);
  assert.equal(creditsProgress(credits, 500 + FIDELITY_CREDITS_SECONDS / 2), 0.5);
  assert.equal(creditsProgress(credits, 500 + FIDELITY_CREDITS_SECONDS), 1);
  assert.equal(creditsProgress(credits, 1e9), 1, 'the roll clamps; it never runs backwards past its end');
  assert.equal(creditsFinished(credits, 500 + FIDELITY_CREDITS_SECONDS), true);
  assert.equal(creditsFinished(credits, 500 + FIDELITY_CREDITS_SECONDS - 1), false);
  // a scrub lands on the same line: two calls with the same clock agree
  assert.equal(creditsProgress(credits, 620), creditsProgress(credits, 620));
});

test('the endgame is active only on the Earth plot with the breach stable', () => {
  assert.equal(isEndgameActive(finished()), true);
  assert.equal(isEndgameActive(finished({ plot: 'moon' })), false);
  assert.equal(isEndgameActive(finished({ breachStabilised: false })), false);
  assert.equal(isEndgameActive(finished({ stage: 5 })), false);
  // and the state carries the whole answer: unlocked, active, transit, monument, telemetry, credits and biome
  const state = earthEndgameState(finished());
  assert.equal(state.unlocked, true);
  assert.equal(state.endgameActive, true);
  assert.ok(state.credits);
  assert.equal(state.biome, EARTH_BIOME_PRESET);
  assert.equal(state.transit.to, 'moon');
  assert.equal(state.monument.interactive, true);
  assert.equal(state.telemetry.powered, true);
  // before the end, there is no roll and the plot is the moon's
  const early = earthEndgameState(finished({ plot: 'moon', breachStabilised: false }));
  assert.equal(early.endgameActive, false);
  assert.equal(early.credits, null);
  assert.equal(early.biome, MOON_BIOME_PRESET);
});

test('the state is stateless: the same inputs give the same answer, and time alone never flips it', () => {
  const a = earthEndgameState(finished({ simTime: 10 }));
  const b = earthEndgameState(finished({ simTime: 10 }));
  assert.deepEqual(a, b);
  const later = earthEndgameState(finished({ simTime: 5000 }));
  assert.equal(later.endgameActive, a.endgameActive, 'the clock moves the roll, not the win');
  assert.equal(creditsProgress(later.credits!, 5000), 0, 'a later start is still the first frame of the roll');
});

test('the World v5 save block records arrival, plot, credits seen and the Earth gate’s access', () => {
  const save = endgameSaveFor(finished(), { creditsSeen: true });
  assert.equal(save.v, 5);
  assert.deepEqual(save.endgame, { arrived: true, plot: 'earth', creditsSeen: true, earthGateAccess: EARTH_GATE_PLACEMENT.access });
  // a fresh plot has not arrived anywhere
  const fresh = endgameSaveFor(finished({ stage: 1, plot: 'moon', breachStabilised: false }));
  assert.equal(fresh.endgame.arrived, false);
  assert.equal(fresh.endgame.plot, 'moon');
  // reading a save that predates the endgame (or a corrupt one) gives the fresh default, never a throw
  const defaults = { arrived: false, plot: 'moon', creditsSeen: false, earthGateAccess: EARTH_GATE_PLACEMENT.access };
  assert.deepEqual(readEndgameSave(undefined), defaults);
  assert.deepEqual(readEndgameSave({ v: 4, base: {} }), defaults);
  assert.deepEqual(readEndgameSave({ endgame: { plot: 'earth', arrived: true } }), { ...defaults, plot: 'earth', arrived: true });
  assert.deepEqual(readEndgameSave('nonsense'), defaults);
});
