/**
 * H11: CPU riders pick their shoves (mass edge, shields, hazards) instead of flipping a coin, and a
 * shove into a rival's lane is telegraphed: the bot holds its lane and wobbles for `ramTell` seconds
 * before it slams across.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { driveCpu, ramMassEdge, ramTell, ramWorth, type CpuContext } from '../src/game/sim/cpu-driver';
import type { Difficulty } from '../src/game/session';
import { laneZ } from '../src/game/scene';

function setup(difficulty: Difficulty = 'racer') {
  const world = createSimWorld('ridge', [], []);
  let runTime = 10;
  const effects: string[] = [];
  const step: RacerStepContext = {
    world, fx: { ...HEADLESS_SIM_FX, effect: (kind) => { effects.push(kind); } }, recovery: LEGACY_RECOVERY,
    random: () => 0.5,
    get runTime() { return runTime; },
    get wallTime() { return runTime; },
  };
  const racers = createRacers();
  const [, bot, rival] = racers;
  // Bot in lane 1, rival just ahead in lane 2, both rolling, nothing else on the road.
  for (const racer of racers) { racer.x = 5000 + racer.id * 2000; racer.vx = 900; racer.grounded = true; racer.y = world.y(racer.x) - 31; }
  bot.x = 20000; bot.targetLane = bot.lane = 1; bot.z = laneZ(1);
  rival.x = 20060; rival.targetLane = rival.lane = 2; rival.z = laneZ(2);
  bot.weight = 150; rival.weight = 100;
  bot.lastLaneChange = -100; bot.boosts = 0;
  const cpu: CpuContext = { step, difficulty, others: racers, paceTargetX: null, stagger: () => 0 };
  return { cpu, bot, rival, effects, at: (t: number) => { runTime = t; } };
}

test('H11: a ram is weighed, not flipped', () => {
  const { cpu, bot, rival } = setup();
  assert.ok(ramWorth(bot, rival, cpu) > 0, 'heavier bot goes for a lighter rival');
  rival.shieldUntil = 99;
  assert.ok(ramWorth(bot, rival, cpu) < 0, 'never into a shield');
  rival.shieldUntil = -100; rival.immuneUntil = 99;
  assert.ok(ramWorth(bot, rival, cpu) < 0, 'nor a rival still immune after a hit');
  rival.immuneUntil = -100; bot.weight = 90;
  assert.ok(ramWorth(bot, rival, cpu) < 0, 'a lighter bot keeps out of the heavier ball\'s lane');
  // Rookies only pick on much lighter balls.
  assert.equal(ramMassEdge('rookie'), 1.25);
  const rookie = setup('rookie');
  rookie.bot.weight = 115;
  assert.ok(ramWorth(rookie.bot, rookie.rival, rookie.cpu) < 0);
  rookie.bot.weight = 130;
  assert.ok(ramWorth(rookie.bot, rookie.rival, rookie.cpu) > 0);
});

test('H11: the same moment gives the same decision (no noise)', () => {
  const a = setup(); const b = setup();
  a.at(10); b.at(10);
  driveCpu(a.bot, a.cpu); driveCpu(b.bot, b.cpu);
  assert.deepEqual(
    [a.bot.ramTargetId, a.bot.ramTellUntil, a.bot.targetLane],
    [b.bot.ramTargetId, b.bot.ramTellUntil, b.bot.targetLane],
  );
});

for (const difficulty of ['racer', 'veteran', 'rookie'] as const) {
  test(`H11 (${difficulty}): the bot wobbles for ${ramTell(difficulty)} s, then slams into the rival's lane`, () => {
    const { cpu, bot, rival, effects, at } = setup(difficulty);
    const tell = ramTell(difficulty);
    at(10);
    driveCpu(bot, cpu);
    assert.equal(bot.ramTargetId, rival.id, 'the bot winds up on the rival');
    assert.equal(bot.targetLane, 1, 'no lane change yet: this is the tell');
    assert.ok(Math.abs(bot.ramTellUntil - (10 + tell)) < 1e-9);
    assert.ok(effects.includes('sparks'), 'the wind-up scrapes sparks');
    at(10 + tell - 0.01);
    driveCpu(bot, cpu);
    assert.equal(bot.targetLane, 1, 'still holding during the tell');
    rival.x += 20; // the rival rolls on, still in reach
    at(10 + tell + 0.01);
    driveCpu(bot, cpu);
    assert.equal(bot.targetLane, 2, 'the shove lands after the tell');
    assert.equal(bot.ramTargetId, null);
  });
}

test('H11: a rival who reacts during the tell (shield up, or gone) is spared', () => {
  for (const react of [(r: Racer) => { r.shieldUntil = 99; }, (r: Racer) => { r.x += 900; }]) {
    const { cpu, bot, rival, at } = setup();
    at(10);
    driveCpu(bot, cpu);
    assert.equal(bot.ramTargetId, rival.id);
    react(rival);
    at(10.4);
    driveCpu(bot, cpu);
    assert.equal(bot.targetLane, 1, 'the bot stays in its lane');
    assert.equal(bot.ramTargetId, null, 'and drops the attack');
  }
});

test('H11: the legacy tactics keep the coin flip (parity recordings)', () => {
  const { cpu, bot } = setup();
  const legacy: CpuContext = { ...cpu, tactics: 'legacy' };
  driveCpu(bot, legacy);
  assert.equal(bot.ramTargetId, null, 'no tell in legacy mode');
});
