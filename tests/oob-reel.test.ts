/**
 * H6: crossing an authored out-of-bounds node is a 1 s rope-goblin recovery, not an instant
 * teleport: the ball is put back on its lane, held while the crew hauls it in (drawn easing back
 * from where it went out), then released rolling forward.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, createRecordingFx, type RacerStepContext } from '../src/game/sim/context';
import { OOB_REEL_S, OOB_RELEASE_VX, stepRacer } from '../src/game/sim/racer-physics';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { sampleLaneNetwork } from '../src/game/lane-network';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { RADIUS, laneZ } from '../src/game/scene';
import { RopeReelView, ROPE_REEL_ART, ropeCrewFrame } from '../src/game/rope-reel-view';
import { getTrackSpace } from '../src/game/track-space';

function spurRun(fx = HEADLESS_SIM_FX) {
  const network = sampleLaneNetwork('ridge');
  const obstacles = createTrackLayout('ridge', { skipBeforeX: 0 });
  const world = createSimWorld('ridge', obstacles, createAirPickups('ridge', obstacles));
  let tick = 0;
  const ctx: RacerStepContext = {
    world, fx, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return tick / 120; }, get wallTime() { return tick / 120; }, laneNetwork: network,
  };
  const racer = createRacers()[0];
  racer.pathId = 'ridge-spur';
  racer.x = 67900; racer.z = laneZ(0); racer.targetLane = racer.lane = 0;
  racer.y = world.y(racer.x) - RADIUS; racer.grounded = true; racer.vx = 400;
  const step = () => { stepRacer(racer, ctx, FIXED_STEP); tick += 1; };
  return { racer, ctx, step, now: () => tick / 120 };
}

test('H6: crossing the OOB node starts a 1 s reel: held on the lane, then released rolling', () => {
  const { racer, step, now } = spurRun();
  let startedAt = -1;
  for (let i = 0; i < 400 && startedAt < 0; i++) { step(); if (racer.reel) startedAt = now(); }
  assert.ok(racer.reel, 'the crew has the ball');
  assert.equal(racer.recoveries, 1);
  assert.ok(racer.reel!.fromX >= 68000 - 10, 'it went out at the node');
  assert.ok(racer.x < 68000, 'and is already back on its lane behind the node');
  const heldX = racer.x;
  while (now() < startedAt + OOB_REEL_S - 2 * FIXED_STEP) {
    step();
    assert.equal(racer.x, heldX, 'held while the rope goblins haul it in');
    assert.equal(racer.vx, 0);
  }
  for (let i = 0; i < 3; i++) step();
  assert.equal(racer.reel, null, 'let go after the reel');
  assert.ok(racer.vx >= OOB_RELEASE_VX, `rolling forward again (${racer.vx.toFixed(0)})`);
  step();
  assert.ok(racer.x > heldX, 'and moving');
});

test('H6: the player hears the ratchet and is told what is happening', () => {
  const fx = createRecordingFx();
  const { racer, step } = spurRun(fx);
  for (let i = 0; i < 400 && !racer.reel; i++) step();
  assert.ok(fx.log.some((e) => e.type === 'audio' && e.cue === 'rope_reel'));
  assert.ok(fx.log.some((e) => e.type === 'say' && /ROPE GOBLINS/.test(e.text)));
});

test('H6: the crew is drawn on the lane with a rope to the ball, and the sheet animates', () => {
  assert.equal(ROPE_REEL_ART.url, '/art/animated/alpha/anim-33-rope-heave-trio.png', 'the existing trio art, no new images');
  assert.equal(ropeCrewFrame(0.2, false), 1);
  assert.equal(ropeCrewFrame(0.7, false), 0, 'four frames at 6 fps loop');
  assert.equal(ropeCrewFrame(0.7, true), 0, 'still under reduced motion');
  const scene = new THREE.Scene();
  const view = new RopeReelView(scene, getTrackSpace());
  const base = { lane: 0, x: 67000, y: 0, z: -200, vx: 0, vy: 0, rotation: 0, falling: false, finished: false, bumpAt: -100, immuneUntil: 0, shieldUntil: 0, shieldHitAt: 0, pickupAt: 0, launchOrigin: { x: 0, y: 0 }, grounded: false };
  const drawn = view.update([
    { ...base, reelBack: { toX: 67100, toY: 0, toZ: 0, t: 0.4 } },
    { ...base },
  ], 'ridge', 1, false);
  assert.equal(drawn, 1, 'one crew for the one ball being reeled');
  const [crew, rope] = view.root.children as [THREE.Sprite, THREE.Line];
  assert.ok(crew.visible && rope.visible);
  assert.equal(view.update([], 'ridge', 1.1, false), 0);
  assert.equal(crew.visible, false, 'hidden once the ball is home');
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test('H6: the engine draws a reeled ball easing back, and no boost on the rope', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /rendered\.x = racer\.reel\.fromX \+ \(racer\.x - racer\.reel\.fromX\) \* ease;/);
  assert.match(engine, /if \(this\.status !== 'flying' \|\| this\.player\.reel\) return;/);
  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /\[\.\.\.EFFECT_ART_PATHS, ROPE_REEL_ART\.url\]/, 'the trio is decoded before the race');
});
