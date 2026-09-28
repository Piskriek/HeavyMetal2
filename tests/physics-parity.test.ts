/**
 * T04 — behaviour parity between the extracted simulation and the engine it came from.
 *
 * Host `a` is `tests/fixtures/legacy-engine-sim.ts`: a generated, verbatim copy of the
 * pre-refactor simulation half of `src/game/engine.ts` at `f9ca189`, the commit before this ticket.
 * Host `b` is the same fixture with **only** the members that moved into `src/game/sim/*` shadowed
 * by calls into the shared modules. `assertParity` steps both in lockstep and compares every
 * physics field, HUD field, particle counter, obstacle mutation and supply claim after every tick.
 *
 * That is the evidence for T04's central claim: an isolated qualifying attempt runs the *real*
 * physics, not a re-implementation of it, and the race did not change while the seam was cut.
 *
 * `Math.random` is pinned during each run — the legacy `emit()` draws four numbers per particle, so
 * two hosts would otherwise consume the shared stream at different rates and the single gameplay
 * coin-flip in the step (the pinball spinner's direction) would diverge. The spinner's
 * *sensitivity* to the stream is what `tests/qualifying-attempt.test.ts` asserts instead.
 *
 * Run with: node scripts/check.mjs   ·   regenerate the fixture: node scripts/build-parity-fixture.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ENGINE_SIM_MEMBERS, LegacyEngineSim,
} from './fixtures/legacy-engine-sim';
import {
  act, assertParity, createParityPair, everyKindLayout, gapTrapLayout, observe, withPinnedRandom,
} from './fixtures/parity-harness';
import { createTrackLayout } from '../src/game/track-layout';
import { RADIUS, laneZ, type Obstacle } from '../src/game/scene';
import { DEFAULT_LOADOUT } from '../src/game/loadouts';

test('fixture: the generated copy covers the whole simulation half of the old engine', () => {
  const members = LEGACY_ENGINE_SIM_MEMBERS as readonly string[];
  assert.ok(members.length > 50, `expected the full simulation surface, got ${members.length} members`);
  for (const name of ['stepRacer', 'recover', 'hitObstacle', 'driveCPU', 'resolvePickups', 'collectPickup', 'resolveBumps', 'stepRace', 'emit', 'notify']) {
    assert.ok(members.includes(name), `fixture is missing ${name}`);
  }
  const prototype = LegacyEngineSim.prototype as unknown as Record<string, unknown>;
  for (const name of ['stepRacer', 'resolveBumps', 'driveCPU', 'schedule']) {
    assert.equal(typeof prototype[name], 'function', `fixture must still expose ${name}()`);
  }
  // Nothing browser-shaped may come along: `frame` is what calls requestAnimationFrame.
  for (const name of ['pointerDown', 'frame', 'destroy', 'setVisible', 'visibilityChanged']) {
    assert.equal(prototype[name], undefined, `fixture must not carry ${name}`);
  }
});

test('parity: Rustbucket Ridge, four racers, twelve seconds of scripted player input', () => {
  withPinnedRandom(() => {
    const pair = createParityPair('ridge', DEFAULT_LOADOUT, 'racer');
    assertParity(pair, 1440, {
      label: 'ridge/racer',
      actions: [
        act(3, 'aimUp'), act(6, 'angleUp'), act(7, 'aimDown'), act(8, 'angleDown'), act(10, 'launch'),
        act(60, 'laneLeft'), act(120, 'boost'), act(200, 'hop'), act(240, 'laneRight'), act(320, 'bounce'),
        act(500, 'laneRight'), act(700, 'boost'), act(900, 'laneLeft'), act(1100, 'hop'), act(1300, 'boost'),
      ],
    });
    const seen = observe(pair.a);
    assert.ok(seen.obstacles.some(([, , hit]) => hit === 1), 'the run must collide with obstacles');
    assert.ok(seen.pickups.some(([, , collectedBy]) => collectedBy !== null), 'the run must claim a supply');
    assert.ok(seen.counts.loops > 0, 'the run must ride the first loop');
    assert.ok(seen.particles > 0 && seen.audio.length > 0, 'feedback must be flowing through the fx');
    assert.ok(seen.racers.some((racer) => racer.distance > 3000), 'the field must have travelled down the course');
  });
});

test('parity: Boomtown Run on Veteran AI with no player input at all', () => {
  withPinnedRandom(() => {
    const pair = createParityPair('boomtown', { rider: 'grub', capsule: 'siege' }, 'veteran');
    assertParity(pair, 1440, { label: 'boomtown/veteran', actions: [act(0, 'launch')] });
    const seen = observe(pair.a);
    assert.ok(seen.racers.slice(1).every((racer) => racer.distance > 1500), 'the CPU field must drive itself down the course');
    assert.ok(seen.counts.sheep + seen.counts.explosions + seen.counts.loops > 0, 'the AI must be taking hits and riding loops');
  });
});

test('parity: Woolly Wasteland on Rookie AI, full-power maximum-angle launch', () => {
  withPinnedRandom(() => {
    const pair = createParityPair('sheep', { rider: 'nix', capsule: 'springsteel' }, 'rookie');
    for (const host of [pair.a, pair.b]) { host.snapshot.power = 1; host.snapshot.angle = 68; }
    assertParity(pair, 1200, { label: 'sheep/rookie', actions: [act(0, 'launch')] });
    assert.ok(observe(pair.a).racers[0].distance > 2000, 'the launch must carry the player down the course');
  });
});

test('parity: every obstacle kind, on a synthetic layout with a four-lane gap', () => {
  withPinnedRandom(() => {
    const pair = createParityPair('ridge', { rider: 'sprocket', capsule: 'springsteel' }, 'racer', everyKindLayout('ridge'));
    assertParity(pair, 1500, {
      label: 'every-kind',
      actions: [act(0, 'launch'), act(40, 'boost'), act(240, 'bounce'), act(400, 'laneLeft')],
    });
    // `hit` is only a flag on the four kinds that can be used up (tnt/sheep/blimp/sign); `hitAt`
    // is written for every kind, so it is the honest "this was collided with" signal. The player's
    // own ledger bit must be set too — otherwise the scenario proves CPU luck, not coverage.
    const touched = observe(pair.a).obstacles.filter(([, , , hitAt]) => hitAt !== -100);
    const byPlayer = touched.filter(([, , , , mask]) => (Number(mask) & 1) !== 0);
    const kinds = [...new Set(touched.map(([kind]) => kind))];
    const playerKinds = [...new Set(byPlayer.map(([kind]) => kind))];
    assert.ok(kinds.length >= 6, `the synthetic layout must actually be collided with (hit kinds: ${kinds.join(', ') || 'none'})`);
    assert.ok(playerKinds.length >= 6, `the player must sweep the synthetic course itself (kinds: ${playerKinds.join(', ') || 'none'})`);
  });
});

test('parity: a fall into a four-lane gap recovers on the same tick on both hosts', () => {
  withPinnedRandom(() => {
    const pair = createParityPair('ridge', DEFAULT_LOADOUT, 'racer', gapTrapLayout());
    pair.a.launch(); pair.b.launch();
    let sawFall = false;
    let sawRecovery = false;
    for (let tick = 0; tick < 400; tick++) {
      assertParity(pair, 1, { label: `gap fall tick ${tick}`, requireProgress: false });
      sawFall = sawFall || pair.a.racers.some((racer) => racer.falling);
      sawRecovery = sawRecovery || pair.a.racers.some((racer) => racer.immuneUntil > 0);
    }
    assert.ok(sawFall, 'the player must fall into the gap');
    assert.ok(sawRecovery, 'the pit crew must have intervened');
    // The recovery ledger is the one deliberate addition on the sim side: the legacy code had
    // nowhere to put it, and the harness compares everything else.
    assert.equal(pair.a.racers[0].recoveries, 0, 'the legacy host does not track recoveries');
    assert.ok(pair.b.racers[0].recoveries >= 1, 'the shared sim must count them');
  });
});

test('parity: the scalable hit ledger agrees with the legacy mask inside its safe range', () => {
  withPinnedRandom(() => {
    const obstacles: Obstacle[] = [];
    for (let index = 0; index < 8; index++) {
      obstacles.push({ kind: 'sheep', x: 800 + index * 90, width: 62, height: 59, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 });
    }
    const pair = createParityPair('ridge', DEFAULT_LOADOUT, 'racer', obstacles);
    for (const host of [pair.a, pair.b]) { host.snapshot.power = 0.9; host.snapshot.angle = 30; }
    assertParity(pair, 260, { label: 'sheep ledger', actions: [act(0, 'launch')] });
    const touched = pair.b.obstacles.filter((obstacle) => (obstacle.hitBy?.size ?? 0) > 0);
    assert.ok(touched.length > 0, 'at least one sheep must be bonked');
    for (const obstacle of touched) {
      const mask = pair.a.obstacles.find((other) => other.x === obstacle.x)?.hitMask ?? 0;
      const fromSet = [...(obstacle.hitBy ?? new Set<number>())].reduce((sum, id) => sum | (1 << id), 0);
      assert.equal(fromSet, mask, 'hitBy and hitMask must agree for four racers');
    }
  });
});

test('parity: the shared world answers exactly like the engine bucket maps', () => {
  const course = 'ridge' as const;
  const pair = createParityPair(course, DEFAULT_LOADOUT, 'racer', createTrackLayout(course));
  const fingerprint = (list: readonly Obstacle[]) => list.map((obstacle) => [obstacle.kind, obstacle.x, obstacle.width, obstacle.lane ?? null, obstacle.laneSpan ?? 1]);
  for (const x of [190, 600, 1370, 5000, 25000, 48000, 68000, 71000]) {
    for (const lane of [0, 1, 2, 3]) {
      const z = laneZ(lane);
      assert.deepEqual(pair.modern.world.surfaceAt(x + RADIUS, z), pair.a.surfaceAt(x + RADIUS, z), `surfaceAt(${x + RADIUS}, lane ${lane})`);
      assert.equal(pair.modern.world.inGap(x, z), pair.a.inGap(x, z), `inGap(${x}, lane ${lane})`);
      assert.deepEqual(fingerprint(pair.modern.world.obstaclesNear(x)), fingerprint(pair.a.nearby(x)), `obstaclesNear(${x})`);
      // The legacy span walk is `for key in floor(from/512)..floor(to/512)`; the shared index must
      // return the same candidates in the same order, because driveCPU scores them in that order.
      const span = 1350;
      const legacySpan: Obstacle[] = [];
      for (let key = Math.floor(x / 512); key <= Math.floor((x + span) / 512); key++) legacySpan.push(...(pair.a.buckets.get(key) ?? []));
      assert.deepEqual(fingerprint(pair.modern.world.obstaclesInSpan(x, x + span)), fingerprint(legacySpan), `obstaclesInSpan(${x})`);
      const legacyPickups: AirPickupSpan[] = [];
      for (let key = Math.floor((x - 65) / 512); key <= Math.floor((x + 65) / 512); key++) legacyPickups.push(...(pair.a.pickupBuckets.get(key) ?? []));
      assert.deepEqual(pair.modern.world.pickupsInSpan(x - 65, x + 65).map((p) => p.id), legacyPickups.map((p) => p.id), `pickupsInSpan(${x})`);
    }
  }
  assert.equal(pair.modern.world.course, pair.a.options.course);
});

type AirPickupSpan = { id: number };
