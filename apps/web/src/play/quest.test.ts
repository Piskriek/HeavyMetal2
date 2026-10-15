import { test } from 'node:test';
import assert from 'node:assert/strict';
import { place, step, type Env, type PlotState } from '@hm/plotsim';
import { FRESH, SHELTER_REFILL, SYNC_SECONDS, arrived, created, isFreeDrill, loadState, objective, poweredOn, returned, stepSync, withPlot, type PlayState } from './quest';

const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.8 };
/** The plot run until a pixel machine gives its first output (stage 1), with ore to burn. A standing machine is not output. */
const firstOutput = (p: PlotState): PlotState => { let t: PlotState = { ...p, ore: Math.max(p.ore, 200) }; for (let i = 0; i < 300 && t.stage === 0; i++) t = step(t, env, 1).state; return t; };

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
  // a drill first does not end the tutorial; the first pixel machine (stage 1) does
  s = withPlot(s, place(s.plot, env, 'drill', -9, 3, 0));
  assert.equal(s.step, 'build');
  s = withPlot(s, place(s.plot, env, 'mill', 8, 3, 0));
  assert.equal(s.plot.stage, 0, 'a standing mill is not output');
  assert.equal(s.step, 'build');
  s = withPlot(s, firstOutput(s.plot));
  assert.equal(s.step, 'done');
  assert.equal(s.plot.stage, 1);
  assert.equal(s.plot.machines.length, 2);
});

test('placing the first mill without a drill enters drill step, where the first drill is free', () => {
  let s: PlayState = { ...FRESH, step: 'build' };
  s = withPlot(s, place(s.plot, env, 'mill', 8, 3, 0));
  assert.equal(s.plot.stage, 0, 'a standing mill is not output');
  s = withPlot(s, firstOutput(s.plot));
  assert.equal(s.step, 'drill');
  assert.equal(s.plot.stage, 1);
  assert.equal(objective(s, 'planet').title, 'Feed your mill');
  assert.match(objective(s, 'planet').hint, /rock drill/);
  assert.equal(isFreeDrill(s, 'drill'), true);
  assert.equal(isFreeDrill(s, 'mill'), false);
  s = withPlot(s, place(s.plot, env, 'drill', -9, 3, 0));
  assert.equal(s.step, 'done');
  assert.equal(isFreeDrill(s, 'drill'), false);
});

test('a save is checked: nothing odd traps a player', () => {
  assert.deepEqual(loadState(null), FRESH);
  assert.deepEqual(loadState('x'), FRESH);
  // a step past create with no human goes back to create, with the gate off
  const noHuman = loadState({ step: 'build', gateOn: true, stage: 1 });
  assert.equal(noHuman.step, 'create');
  assert.equal(noHuman.gateOn, false);
  // a first-version save (a list of texture mills and a stage) becomes the plot's mills at that stage, and migrates to drill if no drill
  const old = loadState({ v: 1, step: 'done', avatarId: 'a', visited: true, stage: 9, machines: [{ kind: 'texture-mill', x: 5, z: 6, yaw: 1 }, { kind: 'chimney' }, 4] });
  assert.equal(old.v, 5);
  assert.equal(old.step, 'drill');
  assert.equal(old.plot.stage, 6);
  assert.equal(old.gateOn, true);
  assert.deepEqual(old.plot.machines.map((m) => [m.kind, m.x, m.z, m.yaw]), [['mill', 5, 6, 1]]);
  assert.deepEqual(old.avatar, { kind: 'scientist', name: 'Scientist', visor: '#f59e0b' });
  assert.equal(old.lab.v, 1);
  assert.deepEqual(loadState(JSON.parse(JSON.stringify(old))), old);

  // a v2 save with avatarId migrates to scientist avatar
  const v2 = loadState({ v: 2, step: 'power', avatarId: 'avatar-ada', name: 'Ada', gateOn: false, visited: false });
  assert.equal(v2.v, 5);
  assert.equal(v2.step, 'power');
  assert.deepEqual(v2.avatar, { kind: 'scientist', name: 'Ada', visor: '#f59e0b' });
  assert.equal(v2.lab.v, 1);

  // a v3 custom avatar round-trips cleanly
  const v3Custom = loadState({ v: 3, step: 'build', avatar: { kind: 'custom', name: 'Gordan', key: 'hm.avatar.custom.123' }, gateOn: true, visited: true });
  assert.equal(v3Custom.v, 5);
  assert.deepEqual(v3Custom.avatar, { kind: 'custom', name: 'Gordan', key: 'hm.avatar.custom.123' });

  // an old save whose plot machine holds a vault preset id migrates it to a written cartridge in the lab slotted into that machine
  const v3Cart = loadState({
    v: 3, step: 'done', avatar: { kind: 'scientist', name: 'Ada', visor: '#f59e0b' }, gateOn: true, visited: true,
    plot: {
      v: 1, stage: 1, points: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, ore: 50, nextId: 2,
      machines: [{ id: 1, kind: 'mill', x: 5, z: 6, yaw: 0, on: true, cartridge: 'red_ochre_silt', built: 0 }],
    },
  });
  assert.equal(v3Cart.v, 5);
  assert.equal(v3Cart.step, 'drill');
  assert.equal(v3Cart.lab.cartridges.length, 1);
  const migratedCart = v3Cart.lab.cartridges[0]!;
  assert.equal(migratedCart.id, 'c1');
  assert.equal(migratedCart.name, 'Red Ochre Silt');
  assert.equal(migratedCart.kind, 'preset');
  assert.equal(migratedCart.preset, 'red_ochre_silt');
  assert.equal(migratedCart.slot, 1);
  assert.equal(v3Cart.plot.machines[0]?.cartridge, 'c1');
});

test('migration: a plot at done with a drill stays done', () => {
  const withDrill = loadState({
    v: 4,
    step: 'done',
    avatar: { kind: 'scientist', name: 'Ada', visor: '#f59e0b' },
    gateOn: true,
    visited: true,
    plot: {
      v: 1, stage: 1, points: { pxd: 10, vtx: 0, lx: 0, aq: 0 }, ore: 10, nextId: 3,
      machines: [
        { id: 1, kind: 'mill', x: 5, z: 6, yaw: 0, on: true, cartridge: null, built: 0 },
        { id: 2, kind: 'drill', x: -5, z: 6, yaw: 0, on: true, cartridge: null, built: 0 },
      ],
    },
  });
  assert.equal(withDrill.v, 5);
  assert.equal(withDrill.step, 'done');
  assert.equal(isFreeDrill(withDrill, 'drill'), false);
});

test('every step tells you what to do, in the lab and on the planet', () => {
  for (const step of ['create', 'power', 'explore', 'build', 'drill', 'done'] as const) for (const where of ['lab', 'planet'] as const) {
    const o = objective({ ...FRESH, step }, where);
    assert.ok(o.title.length > 0 && o.hint.length > 0);
  }
  assert.notEqual(objective({ ...FRESH, step: 'explore' }, 'lab').title, objective({ ...FRESH, step: 'explore' }, 'planet').title);
  // after the tutorial, the next stage's needs
  const plotWithBoth = firstOutput(place(place(FRESH.plot, env, 'mill', 8, 3, 0), env, 'drill', -9, 3, 0));
  const done = withPlot({ ...FRESH, step: 'drill' }, plotWithBoth);
  assert.equal(done.step, 'done');
  assert.match(objective(done, 'planet').hint, /Stage 2 needs texture 15, shape 10/);
});

test('sync drains over 90 s on raw ground at every stage and refills in the lab', () => {
  assert.equal(SYNC_SECONDS, 90);
  for (const stage of [0, 1]) {
    let level = 1, t = 0;
    while (level > 0 && t < 600) { level = stepSync(level, 0.5, { onPlanet: true, stage, nearMachine: false }); t += 0.5; }
    assert.ok(Math.abs(t - SYNC_SECONDS) <= 1, `stage ${stage} ran out after ${t} s`);
  }
  assert.equal(stepSync(0.2, 10, { onPlanet: false, stage: 0, nearMachine: false }), 1);
  // from stage 1 a running machine holds your sync up (the machine rule is unchanged); away from one it drains
  assert.ok(stepSync(0.5, 1, { onPlanet: true, stage: 1, nearMachine: true }) > 0.5);
  const away = 0.5 - stepSync(0.5, 1, { onPlanet: true, stage: 1, nearMachine: false });
  assert.ok(Math.abs(away - 1 / SYNC_SECONDS) < 1e-9);
});

test('inside a safe dome sync never drains and refills at 20% a second, at stage 0 too', () => {
  assert.equal(SHELTER_REFILL, 0.2);
  assert.ok(Math.abs(stepSync(0.5, 1, { onPlanet: true, stage: 0, nearMachine: false, inDome: true }) - 0.7) < 1e-9, 'stage 0 in a dome refills');
  assert.equal(stepSync(0.5, 0, { onPlanet: true, stage: 0, nearMachine: false, inDome: true }), 0.5);
  let level = 0.2, t = 0;
  while (level < 1 && t < 60) { level = stepSync(level, 0.5, { onPlanet: true, stage: 0, nearMachine: false, inDome: true }); t += 0.5; }
  assert.ok(Math.abs(t - 4) < 0.6, `refilled from 20% in ${t} s`);
  for (let k = 0; k < 400; k++) assert.ok(stepSync(0.4, 0.5, { onPlanet: true, stage: 0, nearMachine: false, inDome: true }) >= 0.4, 'never drains in a dome');
});

test('the zero-loss recall (TASK-26): returning to the lab keeps the plot, the lab, the chain and the avatar', () => {
  const plotWithMill = firstOutput(place(FRESH.plot, env, 'mill', 8, 3, 0));
  const s: PlayState = { ...FRESH, step: 'explore', visited: true, avatar: { kind: 'scientist', name: 'Scientist', visor: '#f59e0b' }, avatarId: 'scientist', plot: plotWithMill };
  const back = returned(s);
  assert.equal(back.plot, s.plot, 'the plot is kept as it was');
  assert.equal(back.lab, s.lab, 'the lab is kept');
  assert.equal(back.chain, s.chain, 'the campaign chain is kept');
  assert.deepEqual(back.avatar, s.avatar, 'the avatar is kept');
  assert.equal(back.step, 'build', 'the first look round is done, so the build step follows');
});
