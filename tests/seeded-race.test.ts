/**
 * M9: the race's one gameplay coin flip (the pinball spinner) is a hash of (seed, tick, racer id),
 * so the same seed and inputs replay the same race; and player input reaches the engine only
 * through `dispatch`, which validates it against the T01 command gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { hitObstacle } from '../src/game/sim/racer-physics';
import { createTrackLayout } from '../src/game/track-layout';
import { validateCommand } from '../src/game/contracts/commands';
import type { GameStatus } from '../src/game/types';
import { heatPhaseOf, raceRandom01 } from '../src/game/engine';

test('M9: raceRandom01 is a pure hash of (seed, tick, racer id) in [0, 1)', () => {
  assert.equal(raceRandom01(7, 1200, 3), raceRandom01(7, 1200, 3));
  const values = new Set<number>();
  let heads = 0;
  for (let tick = 0; tick < 2000; tick++) {
    const v = raceRandom01(0x5eed, tick, tick % 100);
    assert.ok(v >= 0 && v < 1);
    values.add(v);
    if (v > 0.5) heads++;
  }
  assert.ok(values.size > 1990, 'no short cycles');
  assert.ok(heads > 900 && heads < 1100, `a fair coin (${heads} / 2000)`);
  assert.notEqual(raceRandom01(1, 10, 2), raceRandom01(2, 10, 2), 'the seed matters');
  assert.notEqual(raceRandom01(1, 10, 2), raceRandom01(1, 11, 2), 'the tick matters');
  assert.notEqual(raceRandom01(1, 10, 2), raceRandom01(1, 10, 3), 'the racer matters');
});

function spinnerKick(seed: number, tick: number, racerId: number): number {
  const obstacles = createTrackLayout('ridge');
  const spinner = obstacles.find((o) => o.kind === 'pinball_spinner');
  assert.ok(spinner, 'ridge has a pinball spinner');
  const world = createSimWorld('ridge', obstacles, []);
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY,
    random: (id = 0) => raceRandom01(seed, tick, id),
    runTime: tick / 120, wallTime: tick / 120,
  };
  const racer = createRacers()[racerId];
  racer.x = spinner!.x; racer.z = 0; racer.vz = 0;
  hitObstacle(racer, spinner!, ctx);
  return racer.vz;
}

test('M9: the pinball spinner kicks the same way on a replay, and by racer', () => {
  for (let tick = 100; tick < 140; tick++) {
    for (const id of [0, 1, 2, 3]) {
      const kick = spinnerKick(0xbeef, tick, id);
      assert.equal(Math.abs(kick), 440);
      assert.equal(kick, spinnerKick(0xbeef, tick, id), 'same seed, tick and racer: same kick');
      assert.equal(kick, (raceRandom01(0xbeef, tick, id) > 0.5 ? 1 : -1) * 440);
    }
  }
});

test('M9: the live race has no Math.random left in its physics', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /random: \(racerId = 0\) => raceRandom01\(engine\.pushSeed, engine\.tick, racerId\)/);
  assert.doesNotMatch(engine, /random: \(\) => Math\.random\(\)/);
  const physics = readFileSync(new URL('../src/game/sim/racer-physics.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(physics.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /Math\.random/);
});

test('M9: the engine gate refuses what the race cannot do right now', () => {
  const gate = (status: GameStatus) => ({ status, phase: heatPhaseOf(status), inputEnabled: true, racerId: 0, startMode: 'push' as const });
  assert.equal(validateCommand({ type: 'start' }, gate('ready')).ok, true);
  assert.equal(validateCommand({ type: 'start' }, gate('flying')).ok, false, 'no second start');
  assert.equal(validateCommand({ type: 'ready' }, gate('checkpoint')).ok, true);
  assert.equal(validateCommand({ type: 'ready' }, gate('flying')).ok, false);
  assert.equal(validateCommand({ type: 'steer', direction: 1 }, gate('flying')).ok, true);
  assert.equal(validateCommand({ type: 'steer', direction: 1 }, gate('finished')).ok, false);
  assert.equal(validateCommand({ type: 'toggle-pause' }, gate('flying')).ok, true);
  assert.equal(validateCommand({ type: 'toggle-pause' }, gate('paused')).ok, true, 'resume');
  assert.equal(validateCommand({ type: 'toggle-pause' }, gate('ready')).ok, false, 'nothing to pause on the grid');
  assert.equal(validateCommand({ type: 'boost' }, { ...gate('flying'), inputEnabled: false }).ok, false, 'a menu owns input');
});

test('M9: the race screen sends player input through engine.dispatch', () => {
  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  for (const command of [`{ type: 'steer', direction: -1 }`, `{ type: 'steer', direction: 1 }`, `{ type: 'bounce' }`, `{ type: 'boost' }`, `{ type: 'start' }`, `{ type: 'ready' }`, `{ type: 'toggle-pause' }`]) {
    assert.ok(screen.includes(`engine.dispatch(${command})`) || screen.includes(`dispatch(${command})`), command);
  }
  assert.doesNotMatch(screen, /engine\.changeLane\(|engine\.bounce\(\)|engine\.boost\(\)/);
});
