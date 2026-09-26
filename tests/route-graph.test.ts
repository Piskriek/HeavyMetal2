/**
 * ROUTE-1 — forks on engine x. The law: no fork graph is the old game, character for character, and
 * a graph with nothing tagged changes nothing in the sim either (only racer contacts across branches
 * are dropped, which the engine does, not the step). A control proves branches are wired to physics.
 *
 * Run with: node --import tsx --test tests/route-graph.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, routed, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { driveCpu, type CpuContext } from '../src/game/sim/cpu-driver';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';
import { RADIUS, laneZ } from '../src/game/scene';
import type { Obstacle } from '../src/game/scene';
import {
  advanceRoute, chooseBranch, onRoute, openBranches, sameRoad, sectionAt, validateRouteGraph, RouteGraphError,
  type RouteGraph,
} from '../src/game/sim/route';

const GRAPH: RouteGraph = {
  sections: [
    { id: 'rim', x0: 20000, x1: 30000, branches: [{ id: 'outer', name: 'Outer rim' }, { id: 'ledge', name: 'Lava ledge' }] },
    { id: 'tube', x0: 40000, x1: 52000, branches: [{ id: 'main', name: 'Main tube' }, { id: 'vent', name: 'Side vent' }, { id: 'crumble', name: 'Crumbling ledge' }] },
  ],
};

test('route: sections, lateral branch bands, commitment at the split', () => {
  validateRouteGraph(GRAPH);
  assert.equal(sectionAt(GRAPH, 19999), null);
  assert.equal(sectionAt(GRAPH, 20000)?.id, 'rim');
  assert.equal(sectionAt(GRAPH, 30000), null, 'x1 is the merge: back on the shared road');
  // Left half → first branch, right half → second; three branches share the width in thirds.
  assert.equal(chooseBranch(GRAPH.sections[0], -300), 'outer');
  assert.equal(chooseBranch(GRAPH.sections[0], 300), 'ledge');
  assert.deepEqual([-400, 0, 400].map((z) => chooseBranch(GRAPH.sections[1], z)), ['main', 'vent', 'crumble']);
  // A closed branch gives its band to the open ones.
  const layout = { open: { tube: ['main', 'crumble'] } };
  assert.deepEqual(openBranches(GRAPH.sections[1], layout).map((b) => b.id), ['main', 'crumble']);
  assert.equal(chooseBranch(GRAPH.sections[1], 10, layout), 'crumble');
  // Commit once: a later swerve inside the section does not change the choice.
  let route = advanceRoute(undefined, 20010, -200, GRAPH);
  assert.deepEqual(route, { rim: 'outer' });
  const same = advanceRoute(route, 25000, 400, GRAPH);
  assert.equal(same, route, 'no change, same object');
  route = advanceRoute(route, 41000, 400, GRAPH);
  assert.deepEqual(route, { rim: 'outer', tube: 'crumble' });
  assert.equal(onRoute(undefined, undefined), true, 'untagged content is everywhere');
  assert.equal(onRoute({ section: 'rim', branch: 'ledge' }, route), false);
  assert.equal(onRoute({ section: 'rim', branch: 'outer' }, route), true);
});

test('route: bad graphs fail at load; racers on different branches are on different roads', () => {
  assert.throws(() => validateRouteGraph({ sections: [{ id: 'a', x0: 10, x1: 5, branches: GRAPH.sections[0].branches }] }), RouteGraphError);
  assert.throws(() => validateRouteGraph({ sections: [GRAPH.sections[0], { ...GRAPH.sections[0], id: 'b', x0: 25000 }] }), RouteGraphError);
  assert.throws(() => validateRouteGraph({ sections: [{ id: 'a', x0: 0, x1: 5, branches: [GRAPH.sections[0].branches[0]] }] }), RouteGraphError);
  assert.equal(sameRoad({ x: 21000, route: { rim: 'outer' } }, { x: 21050, route: { rim: 'ledge' } }, GRAPH), false);
  assert.equal(sameRoad({ x: 21000, route: { rim: 'outer' } }, { x: 21050, route: { rim: 'outer' } }, GRAPH), true);
  assert.equal(sameRoad({ x: 31000, route: { rim: 'outer' } }, { x: 31050, route: { rim: 'ledge' } }, GRAPH), true, 'merged again');
  assert.equal(sameRoad({ x: 21000 }, { x: 21050 }, null), true);
});

test('world: untagged is the world itself; a tagged obstacle exists only on its branch, as one live record', () => {
  const plain = createSimWorld('ridge', createTrackLayout('ridge', { skipBeforeX: 0 }));
  assert.equal(plain.routed, false);
  assert.equal(plain.forRoute({ rim: 'outer' }), plain);
  const ramp: Obstacle = { kind: 'ramp', x: 22000, width: 400, height: 120, hit: false, hitAt: -100, lane: 1, route: { section: 'rim', branch: 'ledge' } };
  const world = createSimWorld('ridge', [ramp]);
  assert.equal(world.routed, true);
  const ledge = world.forRoute({ rim: 'ledge' });
  const outer = world.forRoute({ rim: 'outer' });
  assert.equal(world.forRoute({ rim: 'ledge' }), ledge, 'views are cached per route');
  assert.equal(ledge.forRoute({ rim: 'outer' }), ledge, 'a view is already on its route');
  assert.equal(ledge.surfaceAt(22200, laneZ(1)).ramp, ramp);
  assert.equal(outer.surfaceAt(22200, laneZ(1)).ramp, null);
  assert.equal(ledge.obstaclesNear(22200)[0], ramp, 'the view shares the live record (hits and breaks stay one truth)');
});

// ── Parity and control: whole seeded races, as tests/lane-parity.test.ts runs them ──
function race(seed: number, options: { route?: RacerStepContext['route']; tag?: boolean } = {}) {
  const obstacles = createTrackLayout('ridge', { skipBeforeX: 0 });
  if (options.tag) {
    // The control: everything inside the rim section belongs to the ledge branch only.
    for (const o of obstacles) if (o.x >= 20000 && o.x < 30000) o.route = { section: 'rim', branch: 'ledge' };
  }
  const world = createSimWorld('ridge', obstacles, createAirPickups('ridge', obstacles));
  const racers = createRacers();
  const random = () => ((seed % 97) + 1) / 100;
  let tick = 0;
  const context: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random,
    get runTime() { return tick / 120; },
    get wallTime() { return tick / 120; },
    ...(options.route === undefined ? {} : { route: options.route }),
  };
  const cpu: CpuContext = {
    step: context, difficulty: 'racer', others: racers,
    get paceTargetX() { return racers[0].x; },
    stagger: (racer) => racer.id * 0.023,
  };
  const pushes = racers.map((racer) => startPushVelocity(racer.pace, 0x5eed ^ seed, racer.id));
  for (let pushTick = 1; pushTick <= PUSH_TICKS; pushTick++) {
    tick++;
    for (let i = 0; i < racers.length; i++) {
      applyPushTick(racers[i], pushTick, pushes[i]);
      racers[i].x += racers[i].vx * FIXED_STEP;
      racers[i].y = world.y(racers[i].x) - RADIUS;
    }
  }
  const frames: string[] = [];
  for (; tick < 6000; tick++) {
    for (const racer of racers) {
      if (racer.finished) continue;
      driveCpu(racer, cpu); stepRacer(racer, context, FIXED_STEP);
    }
    if (tick % 120 === 0) frames.push(racers.map((r) => `${r.x.toFixed(2)}/${r.z.toFixed(2)}/${r.vx.toFixed(1)}/${r.recoveries}`).join(' '));
    if (racers.every((r) => r.finished)) break;
  }
  return { digest: frames.join('|'), routes: racers.map((r) => r.route) };
}

test('parity: no route, a null route and a graph with nothing tagged are the same race, over 10 seeds', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const absent = race(seed);
    assert.equal(race(seed, { route: null }).digest, absent.digest, `seed ${seed}: null`);
    const graphed = race(seed, { route: { graph: GRAPH } });
    assert.equal(graphed.digest, absent.digest, `seed ${seed}: an untagged graph`);
    assert.ok(graphed.routes.every((r) => r?.rim && r?.tube), 'every racer still chose at both forks');
  }
});

test('control: branch-tagged obstacles change the race, so forks are wired to physics', () => {
  const differs = [1, 2, 3, 4, 5].some((seed) => race(seed, { route: { graph: GRAPH }, tag: true }).digest !== race(seed).digest);
  assert.ok(differs, 'moving the rim obstacles onto one branch must change at least one race');
});

test('routed(): the same context object when nothing is tagged', () => {
  const ctx: RacerStepContext = {
    world: createSimWorld('ridge', createTrackLayout('ridge', { skipBeforeX: 0 })), fx: HEADLESS_SIM_FX,
    recovery: LEGACY_RECOVERY, random: () => 0.5, runTime: 0, wallTime: 0,
  };
  assert.equal(routed(ctx, createRacers()[0]), ctx);
});
