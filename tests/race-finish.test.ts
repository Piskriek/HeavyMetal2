/**
 * Picked finishes: a race can end at a finish line placed along the island instead of the course's end.
 *
 *   node --import tsx --test tests/race-finish.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { FINISH, RADIUS, START_X, TRACK_DISTANCE, courseY, laneZ } from '../src/game/scene';
import { createSession, sessionConfig, type RaceSetup } from '../src/game/session';
import { recoverSession, sanitizeSetup } from '../src/game/save';

/** Rolls one racer from `fromX` for up to `seconds`; returns it. */
function roll(fromX: number, finishX: number | undefined, seconds = 3): Racer {
  const world = createSimWorld('basalt', [], []);
  const lane = 1;
  const racer: Racer = { ...createRacers()[0], lane, targetLane: lane, z: laneZ(lane), x: fromX, y: courseY(fromX, 'basalt') - RADIUS, vx: 900, vy: 0, grounded: true };
  let t = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return t; }, get wallTime() { return t; }, finishX,
  };
  for (let i = 0; i < seconds / FIXED_STEP && !racer.finished; i++) { t += FIXED_STEP; stepRacer(racer, ctx, FIXED_STEP); }
  return racer;
}

test('a picked finish ends the race there, with the distance to that line', () => {
  const finishX = 30000;
  const racer = roll(finishX - 400, finishX);
  assert.ok(racer.finished, 'crossed the picked line');
  assert.equal(racer.distance, (finishX - START_X) / 2);
  assert.ok(racer.x < finishX + 100, 'stopped at the picked line, not the course end');
  assert.ok(racer.finishTime !== undefined && racer.finishTime > 0);
});

test('without a picked finish the old finish is exactly where it was', () => {
  const past = roll(30000 - 400, undefined);
  assert.equal(past.finished, false, 'rolling past 30000 does not end a full race');
  const end = roll(FINISH - 400, undefined);
  assert.ok(end.finished);
  assert.equal(end.distance, TRACK_DISTANCE);
  assert.equal(end.x, FINISH + 12);
});

const setup = (over: Partial<RaceSetup> = {}): RaceSetup => ({
  mode: 'quick', course: 'basalt', loadout: { rider: 'rivet', capsule: 'iron' }, difficulty: 'racer', customPhysics: false, fieldSize: 4, ...over,
});

test('a quick race carries its finish into the race config and through a save', () => {
  const session = createSession(setup({ finish: { x: 30000, name: 'The Serpent Bend' } }));
  assert.equal(sessionConfig(session).finishX, 30000);
  assert.deepEqual(sanitizeSetup({ ...setup(), finish: { x: 30000, name: 'The Serpent Bend' } }, 'basalt')?.finish, { x: 30000, name: 'The Serpent Bend' });
  assert.equal(sanitizeSetup({ ...setup(), finish: { x: 'far' } }, 'basalt')?.finish, undefined, 'a broken finish is dropped');
  assert.equal(sessionConfig(createSession(setup())).finishX, undefined, 'no finish: the full course');
});

test('a cup picks a finish per round, and the picks survive a save', () => {
  const session = createSession(setup({ mode: 'tournament' }));
  session.finishes = [{ x: 20000, name: 'Short' }, null, { x: 50000, name: 'Long' }];
  assert.equal(sessionConfig(session).finishX, 20000);
  assert.equal(sessionConfig({ ...session, round: 1 }).finishX, undefined, 'a round with no pick runs the full course');
  const restored = recoverSession(JSON.parse(JSON.stringify(session)), 'grid');
  assert.deepEqual(restored?.session.finishes, session.finishes);
});
