/**
 * Race feel rework: the yoke follows the player's hands, a hit shoots the lane rope out (the ball is
 * knocked across the road, even into the tree line, then reeled back into its own lane), the course's
 * loops are scenery, and nobody touches anybody inside the giant loop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { YOKE_HOLD_S, YOKE_RETURN_S, yokeSteer } from '../src/game/cockpit';
import { ROPE_PAYOUT_S, ROPE_REEL_S, ropeAt } from '../src/game/sim/rope';
import { withoutLoopRides } from '../src/game/sim/decor-loops';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { RADIUS, courseY, laneZ } from '../src/game/scene';
import { LANE_Z_LIMIT } from '../src/game/lane-network';
import { createTrackLayout } from '../src/game/track-layout';

test('the yoke answers the press: full lock, then back to centre', () => {
  assert.equal(yokeSteer(-1, 10, 10), -1, 'left press = full left');
  assert.equal(yokeSteer(1, 10, 10 + YOKE_HOLD_S), 1);
  const mid = yokeSteer(-1, 10, 10 + YOKE_HOLD_S + YOKE_RETURN_S / 2);
  assert.ok(mid < 0 && mid > -1, 'easing back');
  assert.equal(yokeSteer(-1, 10, 10 + YOKE_HOLD_S + YOKE_RETURN_S + 0.01), 0, 'centred');
  assert.equal(yokeSteer(0, 10, 10), 0);
  assert.equal(yokeSteer(1, Number.NaN, 10), 0);
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /if \(this\.status === 'flying' \|\| this\.status === 'pushing'\) \{ this\.steerPress = Math\.sign\(direction\); this\.steerPressAt = this\.time; \}\n[\s\S]{0,40}if \(this\.status !== 'flying'/,
    'recorded before any refusal, so a refused press still turns the wheel');
});

test('the rope: slack right after a hit, taut again by ROPE_REEL_S', () => {
  assert.deepEqual(ropeAt(undefined, 5), { spring: 1, damping: 1, slack: false });
  const early = ropeAt(10, 10 + ROPE_PAYOUT_S / 2);
  assert.ok(early.slack && early.spring < 0.1 && early.damping < 0.2);
  const reel = ropeAt(10, 10 + (ROPE_PAYOUT_S + ROPE_REEL_S) / 2);
  assert.ok(reel.slack && reel.spring > early.spring && reel.spring < 1);
  assert.deepEqual(ropeAt(10, 10 + ROPE_REEL_S + 0.001), { spring: 1, damping: 1, slack: false });
});

function knocked(vz: number) {
  const world = createSimWorld('ridge', [], []);
  const x = 20000;
  const racer: Racer = { ...createRacers()[0], lane: 1, targetLane: 1, z: laneZ(1), x, y: courseY(x, 'ridge') - RADIUS, vx: 900, vy: 0, vz, grounded: true, ropeSince: 0 };
  let t = 0;
  const events: string[] = [];
  const ctx: RacerStepContext = {
    world, fx: { ...HEADLESS_SIM_FX, effect: (kind: string) => { events.push(kind); } } as never,
    recovery: LEGACY_RECOVERY, random: () => 0.5, get runTime() { return t; }, get wallTime() { return t; },
  };
  let maxZ = racer.z; const home = racer.z;
  for (let i = 0; i < 360; i++) { t += FIXED_STEP; stepRacer(racer, ctx, FIXED_STEP); maxZ = Math.max(maxZ, racer.z); }
  return { racer, maxZ, home, events };
}

test('a hit knocks the ball well out of its lane, and the rope reels it back to the same lane', () => {
  const { racer, maxZ, home } = knocked(450);
  assert.ok(maxZ - home > 120, `knocked ${(maxZ - home).toFixed(0)} units sideways (half a lane or more)`);
  assert.ok(Math.abs(racer.z - home) < 12, `back in its own lane after 3 s (off by ${(racer.z - home).toFixed(1)})`);
  assert.equal(racer.targetLane, 1, 'a hit never changes the lane the ball belongs to');
});

test('a big hit smashes the ball into the tree line at the road edge', () => {
  const { maxZ, events } = knocked(650);
  assert.ok(maxZ >= LANE_Z_LIMIT - 1, `reached the edge (${maxZ.toFixed(0)} of ${LANE_Z_LIMIT})`);
  assert.ok(events.includes('impact'), 'and it is a visible smash');
});

test('the course loops are scenery: no ring rides left in the race layout', () => {
  const layout = createTrackLayout('ridge');
  assert.ok(layout.some((o) => o.kind === 'loop'), 'the layout has loops to remove');
  const race = withoutLoopRides(layout);
  assert.equal(race.filter((o) => o.kind === 'loop' || o.kind === 'lava_loop').length, 0);
  assert.equal(race.length, layout.filter((o) => o.kind !== 'loop' && o.kind !== 'lava_loop').length);
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /this\.obstacles = withoutLoopRides\(this\.obstacles\);/);
});

test('ghost until fully out of the giant loop, and no contact inside it at all', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /\|\| insidePassage\(a\.x\) \|\| insidePassage\(b\.x\)/);
  assert.match(engine, /if \(racer\.x >= passageExitX\(\) \|\| racer\.x < this\.mergeGateFor\(\)\.x - 1\) \{\n\s*racer\.mergeGhost = false;/);
  assert.doesNotMatch(engine, /PASSAGE_GHOST_CAP_S/, 'no time cap that ends the ghost inside the loop');
});
