/**
 * P6: a ball grinding along the road-edge wall throws a trail of sparks (a burst every 0.07 s, sized
 * by speed). Presentation only: the physics is untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { LEGACY_RECOVERY, createRecordingFx, type RacerStepContext } from '../src/game/sim/context';
import { SCRAPE_SPARK_EVERY, scrapeSparks, stepRacer } from '../src/game/sim/racer-physics';
import { LANE_Z_LIMIT } from '../src/game/lane-network';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { RADIUS, courseY } from '../src/game/scene';

function setup() {
  const fx = createRecordingFx();
  let runTime = 20;
  const ctx: RacerStepContext = {
    world: createSimWorld('ridge', [], []), fx, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; }, get wallTime() { return runTime; },
  };
  const racer = createRacers()[1];
  racer.x = 30000; racer.y = courseY(racer.x, 'ridge') - RADIUS; racer.z = LANE_Z_LIMIT;
  racer.vx = 900; racer.grounded = true;
  const sparks = () => fx.log.filter((e) => e.type === 'effect' && e.kind === 'sparks').length;
  return { ctx, racer, sparks, advance: (dt: number) => { runTime += dt; } };
}

test('P6: pinned to the road edge and pushing into it at speed: a spark burst every 0.07 s', () => {
  const { ctx, racer, sparks, advance } = setup();
  for (let tick = 0; tick < 120; tick++) { scrapeSparks(racer, 200, ctx); advance(FIXED_STEP); }
  const expected = Math.ceil(1 / SCRAPE_SPARK_EVERY);
  assert.ok(Math.abs(sparks() - expected) <= 1, `${sparks()} bursts in a second (≈ ${expected})`);
});

test('P6: no sparks off the edge, away from it, slow, or airborne', () => {
  for (const [label, change, push] of [
    ['mid-road', (r: ReturnType<typeof setup>['racer']) => { r.z = 0; }, 200],
    ['pulling away', () => {}, -200],
    ['crawling', (r: ReturnType<typeof setup>['racer']) => { r.vx = 60; }, 200],
    ['in the air', (r: ReturnType<typeof setup>['racer']) => { r.grounded = false; }, 200],
  ] as const) {
    const { ctx, racer, sparks } = setup();
    change(racer);
    scrapeSparks(racer, push, ctx);
    assert.equal(sparks(), 0, label);
  }
});

test('P6: a faster scrape throws bigger sparks, and the physics is untouched', () => {
  const slow = setup(); slow.racer.vx = 300; scrapeSparks(slow.racer, 200, slow.ctx);
  const fast = setup(); fast.racer.vx = 1200; scrapeSparks(fast.racer, 200, fast.ctx);
  const scale = (log: typeof slow.ctx.fx) => ((log as unknown as { log: { scale?: number }[] }).log[0]?.scale ?? 0);
  assert.ok(scale(fast.ctx.fx) > scale(slow.ctx.fx));
  const { ctx, racer } = setup();
  const before = { x: racer.x, z: racer.z, vx: racer.vx, vz: racer.vz };
  scrapeSparks(racer, 200, ctx);
  assert.deepEqual({ x: racer.x, z: racer.z, vx: racer.vx, vz: racer.vz }, before);
});

test('P6: a real step against the edge scrapes', () => {
  const { ctx, racer, sparks, advance } = setup();
  racer.ropeSince = 19.9; // just knocked: the rope has slack, so the road edge is the bound
  racer.vz = 300;
  for (let tick = 0; tick < 30; tick++) { stepRacer(racer, ctx, FIXED_STEP); advance(FIXED_STEP); }
  assert.ok(sparks() > 0, 'sparks while grinding the wall');
});
