import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CABLE_REACH, FRESH, SYNC_SECONDS, arrived, created, loadState, objective, placeCheck, placed, poweredOn, returned, stepSync } from './quest';

test('the first Play runs create, power, explore, build, done', () => {
  let s = FRESH;
  assert.equal(s.step, 'create');
  s = created(s, 'avatar-1');
  assert.equal(s.step, 'power');
  assert.equal(s.gateOn, false);
  s = poweredOn(s);
  assert.equal(s.step, 'explore');
  assert.equal(s.gateOn, true);
  // coming back without having stepped through does not count
  assert.equal(returned(s).step, 'explore');
  s = returned(arrived(s));
  assert.equal(s.step, 'build');
  s = placed(s, { kind: 'texture-mill', x: 8, z: 3, yaw: 0 });
  assert.equal(s.step, 'done');
  assert.equal(s.stage, 1);
  assert.equal(s.machines.length, 1);
});

test('a save is checked: nothing odd traps a player', () => {
  assert.deepEqual(loadState(null), FRESH);
  assert.deepEqual(loadState('x'), FRESH);
  // a step past create with no human goes back to create, with the gate off
  const noHuman = loadState({ step: 'build', gateOn: true, stage: 1 });
  assert.equal(noHuman.step, 'create');
  assert.equal(noHuman.gateOn, false);
  const good = loadState({ v: 1, step: 'done', avatarId: 'a', visited: true, stage: 9, machines: [{ kind: 'texture-mill', x: 5, z: 6, yaw: 1 }, { kind: 'chimney' }, 4] });
  assert.equal(good.stage, 6);
  assert.equal(good.gateOn, true);
  assert.deepEqual(good.machines, [{ kind: 'texture-mill', x: 5, z: 6, yaw: 1 }]);
  assert.deepEqual(loadState(JSON.parse(JSON.stringify(good))), good);
});

test('every step tells you what to do, in the lab and on the planet', () => {
  for (const step of ['create', 'power', 'explore', 'build', 'done'] as const) for (const where of ['lab', 'planet'] as const) {
    const o = objective({ ...FRESH, step }, where);
    assert.ok(o.title.length > 0 && o.hint.length > 0);
  }
  assert.notEqual(objective({ ...FRESH, step: 'explore' }, 'lab').title, objective({ ...FRESH, step: 'explore' }, 'planet').title);
});

test('sync drains on the planet in about a minute and refills in the lab', () => {
  let level = 1, t = 0;
  while (level > 0 && t < 600) { level = stepSync(level, 0.5, { onPlanet: true, stage: 0, nearMachine: false }); t += 0.5; }
  assert.ok(Math.abs(t - SYNC_SECONDS) <= 1, `ran out after ${t} s`);
  assert.equal(stepSync(0.2, 10, { onPlanet: false, stage: 0, nearMachine: false }), 1);
  // from stage 1 a running machine holds your sync up; away from one it drains, more slowly
  assert.ok(stepSync(0.5, 1, { onPlanet: true, stage: 1, nearMachine: true }) > 0.5);
  const away = 0.5 - stepSync(0.5, 1, { onPlanet: true, stage: 1, nearMachine: false });
  assert.ok(away > 0 && away < 1 / SYNC_SECONDS);
});

test('a machine stands near the gate, in cable reach, apart from others', () => {
  const gate = { x: 0, z: 0 };
  assert.equal(placeCheck(1, 1, gate, []).ok, false);
  assert.equal(placeCheck(CABLE_REACH + 1, 0, gate, []).ok, false);
  assert.equal(placeCheck(10, 0, gate, []).ok, true);
  assert.equal(placeCheck(10, 0, gate, [{ kind: 'texture-mill', x: 11, z: 1, yaw: 0 }]).ok, false);
  assert.ok(placeCheck(40, 0, gate, []).why.length > 0);
});
