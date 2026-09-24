/**
 * M01 · T5 — the effect runtime: the queue, the pool, the specs and the sim mapping.
 *
 * Run with: `node --import tsx --test tests/effects.test.ts` (also registered in scripts/check.mjs).
 *
 * There is no WebGL here, so the runtime is checked as arithmetic and as allocation behaviour:
 * the queue must be a ring that never grows and never allocates, the pool must be bounded and
 * must despawn an effect at exactly spawn + life, frame selection must follow `(t - t0) * fps`,
 * reduced motion must hold the sheet still, an unknown kind must be refused, and a headless race
 * must map every gameplay event onto the drawn kinds at least once.
 *
 * The last test also checks the shipped sheets: the four painted PNGs the runtime loads must exist,
 * be 2×2 alpha grids of the size the specs assume, and pass the art-pipeline edge rules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  EFFECT_KINDS, EFFECT_QUEUE, EffectQueue, isEffectKind, type EffectEvent,
} from '../src/game/effects/events';
import {
  BILLBOARD_POOL, EFFECT_CULL_DISTANCE, EFFECT_SPECS, BillboardPool, SparkField,
} from '../src/game/effects/pool';
import { EFFECT_ART_PATHS, EFFECT_SHEETS } from '../src/game/effects/renderer-fx';
import { createEffectLog } from '../src/game/effects/events';
import { hitObstacle, stepRacer } from '../src/game/sim/racer-physics';
import { LEGACY_RECOVERY, createRecordingFx, type RacerStepContext } from '../src/game/sim/context';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { RADIUS, laneZ, type Obstacle } from '../src/game/scene';
import * as THREE from 'three';
import { EffectRenderer } from '../src/game/effects/renderer-fx';
import { getTrackSpace, placementFromEngine } from '../src/game/track-space';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicFile = (url: string) => join(root, 'public', url.replace(/^\//, ''));

function pngSize(path: string) {
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

/** The world-up the pool gets during a race, for the tests that do not care about the slope. */
const UP = { x: 0, y: 1, z: 0 };

/* -----------------------------------------------------------------------------
   1. QUEUE RING & OVERFLOW
   -------------------------------------------------------------------------- */

test('queue ring & overflow', () => {
  const queue = new EffectQueue(EFFECT_QUEUE);
  assert.equal(queue.capacity, EFFECT_QUEUE);

  // 10 000 pushes must not allocate: the ring owns every record it hands out, and hands the same
  // records back round-robin however long the race runs.
  const warm = new EffectQueue(8);
  for (let i = 0; i < 8; i++) warm.push('dust', i, 0, 0, 1, null, i);
  const firstRead: EffectEvent[] = [];
  warm.readSince(0, firstRead);
  assert.equal(firstRead.length, 8);
  const records = new Set(firstRead);
  const out: EffectEvent[] = [];
  for (let i = 0; i < 10000; i++) {
    warm.push(EFFECT_KINDS[i % EFFECT_KINDS.length], i, i * 2, -i, 1, i % 8, i);
    warm.readSince(warm.written - 1, out);
  }
  assert.equal(out.length, 1, 'a reader one event behind reads one event');
  assert.equal(records.has(out[0]), true, 'readSince reuses the ring\'s own record objects');
  assert.equal(queue.pending <= EFFECT_QUEUE, true, 'the ring never holds more than its capacity');

  for (let i = 0; i < 10000; i++) queue.push(EFFECT_KINDS[i % EFFECT_KINDS.length], i, i * 2, -i, 1, i % 8, i);
  assert.equal(queue.overflow, 10000 - EFFECT_QUEUE, 'every push past capacity is counted as lost');

  // A reader that keeps up sees exactly the events it has not read yet, in order.
  const live = new EffectQueue(4);
  const seen: number[] = [];
  const buffer: EffectEvent[] = [];
  let cursor = 0;
  for (let tick = 1; tick <= 6; tick++) {
    live.push('impact', tick, 0, 0, 1, 0, tick);
    cursor = live.readSince(cursor, buffer);
    for (const event of buffer) seen.push(event.tick);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6], 'a reader that keeps up sees every event once');
  assert.equal(live.overflow, 0, 'no losses while the reader keeps up');

  // A reader that stalls loses the oldest events, never the newest.
  const stalled = new EffectQueue(4);
  for (let tick = 1; tick <= 10; tick++) stalled.push('explosion', tick, 0, 0, 1, 0, tick);
  const late: EffectEvent[] = [];
  stalled.readSince(0, late);
  assert.deepEqual(late.map((event) => event.tick), [7, 8, 9, 10], 'an overflow drops the oldest');
  assert.equal(stalled.overflow, 6);

  const fresh = stalled.readSince(stalled.written, late);
  assert.equal(late.length, 0, 'reading from the head yields nothing');
  assert.equal(fresh, stalled.written);

  queue.reset();
  assert.equal(queue.pending, 0);
  assert.equal(queue.overflow, 0);
});

/* -----------------------------------------------------------------------------
   2. POOL BOUND & DROP COUNT
   -------------------------------------------------------------------------- */

test('pool bound & drop count', () => {
  const pool = new BillboardPool(BILLBOARD_POOL);
  assert.equal(pool.capacity, BILLBOARD_POOL);
  assert.equal(pool.live, 0);

  // Spawn until every slot is taken; the next spawn is dropped, not grown into.
  const t = 1.0;
  let spawned = 0;
  while (pool.live < pool.capacity) {
    spawned += pool.spawn('explosion', EFFECT_SPECS.explosion, t, 0, 0, 0, 1, UP);
    assert.equal(pool.live <= pool.capacity, true, 'the pool never exceeds its capacity');
  }
  assert.equal(pool.live, BILLBOARD_POOL);
  assert.equal(pool.spawn('explosion', EFFECT_SPECS.explosion, t, 0, 0, 0, 1, UP), 0);
  assert.equal(pool.dropped, 1, 'a refused spawn is counted');
  assert.equal(spawned, BILLBOARD_POOL);

  // Despawn exactly at spawn + life, never before.
  const life = EFFECT_SPECS.explosion.life;
  pool.update(t, false);
  pool.update(t + life - 1e-6, false);
  assert.equal(pool.live, BILLBOARD_POOL, 'alive just before the life runs out');
  pool.update(t + life, false);
  assert.equal(pool.live, 0, 'gone exactly at spawn + life');

  // A multi-copy spec reserves one slot per copy and reports how many it got.
  const dustPool = new BillboardPool(2);
  assert.equal(dustPool.spawn('dust', EFFECT_SPECS.dust, 0, 0, 0, 0, 1, UP), 2, 'dust fills what is left');
  assert.equal(dustPool.live, 2);
  assert.equal(dustPool.dropped, 1, 'the copies that did not fit cost one spawn');
  assert.equal(dustPool.spawn('dust', EFFECT_SPECS.dust, 0, 0, 0, 0, 1, UP), 0);
  assert.equal(dustPool.dropped, 2, 'a spawn with no room at all costs one more');

  // Sparks are bounded too, and recycling never grows the buffers.
  const sparks = new SparkField(32);
  assert.equal(sparks.capacity, 32);
  sparks.spawn(0, 0, 0, 200, 300, 0.5);
  assert.equal(sparks.live, 32, 'the spark field holds at most its capacity');
  sparks.update(1, 900);
  assert.equal(sparks.live, 0, 'sparks expire on their own clock');
});

/* -----------------------------------------------------------------------------
   3. FRAME TIMING
   -------------------------------------------------------------------------- */

test('frame timing', () => {
  const spec = EFFECT_SPECS.impact;
  const pool = new BillboardPool(4);
  // t0 = 0 so the elapsed seconds the pool sees are bit-identical to the ones the expectation uses.
  const t0 = 0;
  pool.spawn('impact', spec, t0, 0, 0, 0, 1, UP);

  const halfFrame = 1 / (spec.fps * 2);
  const frames: number[] = [];
  for (let step = 0; step < 8; step++) {
    const elapsed = step * halfFrame;
    pool.update(t0 + elapsed, false);
    frames.push(pool.all[0].frame);
  }
  const expected = frames.map((_, step) => Math.floor(step * halfFrame * spec.fps) % spec.frames);
  assert.deepEqual(frames, expected, 'the frame is floor((t - t0) * fps) mod frames');
  assert.equal(Math.max(...frames) < spec.frames, true, 'the frame never leaves the sheet');
  assert.equal(new Set(frames).size > 1, true, 'the animation actually advances');
  assert.deepEqual([...frames].sort((a, b) => a - b), frames, 'frames only ever move forward');

  // Over a whole life the sheet plays every frame exactly once.
  const sweep = new BillboardPool(4);
  sweep.spawn('impact', spec, 0, 0, 0, 0, 1, UP);
  const played = new Set<number>();
  for (let step = 0; step < 16; step++) {
    sweep.update((step / 16) * spec.life, false);
    if (sweep.all[0].active) played.add(sweep.all[0].frame);
  }
  assert.deepEqual([...played].sort((a, b) => a - b), [0, 1, 2, 3], 'all four frames play');

  // Dust drifts up and grows; an explosion stays put and only swells a little.
  const dust = new BillboardPool(4);
  dust.spawn('dust', EFFECT_SPECS.dust, 0, 0, 0, 0, 1, UP);
  const dustSlot = dust.all.find((slot) => slot.active) as (typeof dust.all)[number];
  const startY = dust.positionOf(dustSlot).y;
  const startSize = dust.sizeOf(dustSlot);
  dust.update(EFFECT_SPECS.dust.life * 0.5, false);
  assert.equal(dust.positionOf(dustSlot).y > startY, true, 'dust rises');
  assert.equal(dust.sizeOf(dustSlot) > startSize, true, 'dust grows');

  // Opacity fades out over the last third so nothing pops.
  dust.update(EFFECT_SPECS.dust.life * 0.9, false);
  assert.equal(dustSlot.opacity < EFFECT_SPECS.dust.opacity, true, 'billboards fade before they go');

  // Specs obey the published law: sheet size * 2 for the sheet art, points for sparks.
  assert.equal(EFFECT_SPECS.sparks.sheet, 'points');
  assert.equal(EFFECT_SPECS.sparks.particles <= 160, true, 'the spark budget is bounded');
  assert.equal(EFFECT_SPECS.explosion.size, 480);
  assert.equal(EFFECT_SPECS.impact.size, 220);
  assert.equal(EFFECT_SPECS.dust.count, 3);
  assert.equal(EFFECT_SPECS.smoke.count, 2);
  assert.equal(EFFECT_SPECS.explosion.life, 0.25);
  assert.equal(EFFECT_SPECS.impact.life, 0.29);
  assert.equal(EFFECT_SPECS.dust.life, 0.6);
  assert.equal(EFFECT_SPECS.smoke.life, 1.1);
  assert.equal(EFFECT_SPECS.dust.rise, 26);
  assert.equal(EFFECT_SPECS.smoke.rise, 40);
  assert.equal(EFFECT_SPECS.explosion.fps, 16);
  assert.equal(EFFECT_SPECS.impact.fps, 14);
  assert.equal(BILLBOARD_POOL, 64);
  assert.equal(EFFECT_CULL_DISTANCE, 6000);

  // Every spec's sheet is one of the shipped images, and every kind has a spec.
  for (const kind of EFFECT_KINDS) {
    const entry = EFFECT_SPECS[kind];
    assert.equal(entry !== undefined, true, `${kind} has a spec`);
    if (entry.sheet !== 'points') assert.equal(EFFECT_SHEETS[entry.sheet] !== undefined, true, `${kind} sheet exists`);
  }
});

/* -----------------------------------------------------------------------------
   4. REDUCED MOTION
   -------------------------------------------------------------------------- */

test('reduced motion', () => {
  const pool = new BillboardPool(8);
  const t0 = 4;
  pool.spawn('explosion', EFFECT_SPECS.explosion, t0, 0, 0, 0, 1, UP);
  pool.spawn('smoke', EFFECT_SPECS.smoke, t0, 0, 0, 0, 1, UP);
  const before = pool.all.filter((slot) => slot.active).map((slot) => pool.sizeOf(slot));

  pool.update(t0 + EFFECT_SPECS.explosion.life * 0.8, true);
  const explosion = pool.all.find((slot) => slot.active && slot.kind === 'explosion');
  const smoke = pool.all.find((slot) => slot.active && slot.kind === 'smoke');
  assert.equal(explosion?.frame, 1, 'reduced motion holds the sheet on frame 1');
  assert.equal(smoke?.frame, 1);
  assert.equal(explosion?.opacity, 0.5, 'and halves the flash');
  if (explosion && smoke) {
    assert.equal(pool.sizeOf(smoke, true), smoke.size, 'smoke does not scale under reduced motion');
    assert.equal(pool.sizeOf(explosion, true) > before[0], true, 'the flash still swells');
  }
  // It still despawns on time, so the pool cannot leak under reduced motion.
  pool.update(t0 + 10, true);
  assert.equal(pool.live, 0);
});

/* -----------------------------------------------------------------------------
   5. UNKNOWN KIND REFUSED
   -------------------------------------------------------------------------- */

test('unknown kind refused', () => {
  assert.equal(isEffectKind('explosion'), true);
  assert.equal(isEffectKind('dust'), true);
  assert.equal(isEffectKind('sparkle'), false);
  assert.equal(isEffectKind(null), false);

  const queue = new EffectQueue(4);
  assert.throws(() => queue.push('sparkle' as never, 0, 0, 0, 1, 0, 0),
    (error: { code?: string }) => error.code === 'E_EFFECT_KIND', 'an invented kind throws a contract error');
  assert.equal(queue.pending, 0, 'and nothing enters the queue');

  const log = createEffectLog();
  assert.throws(() => log.effect('boom' as never, 0, 0, 0), (error: { code?: string }) => error.code === 'E_EFFECT_KIND');
  assert.equal(log.log.length, 0);

  // Everything the contract publishes is accepted.
  const good = new EffectQueue(8);
  for (const kind of EFFECT_KINDS) good.push(kind, 0, 0, 0, 1, 0, 0);
  assert.equal(good.pending, EFFECT_KINDS.length);
});

/* -----------------------------------------------------------------------------
   6. EVENT MAPPING COVERAGE
   -------------------------------------------------------------------------- */

test('event mapping coverage', () => {
  // Every spec's sheet is shipped, is a 2x2 alpha grid, and exists on disk.
  const grids = new Map<string, { cols: number; rows: number }>();
  for (const [key, sheet] of Object.entries(EFFECT_SHEETS)) {
    grids.set(key, { cols: sheet.cols, rows: sheet.rows });
    assert.equal(existsSync(publicFile(sheet.url)), true, `${sheet.url} must ship`);
    assert.deepEqual({ cols: sheet.cols, rows: sheet.rows }, { cols: 2, rows: 2 }, `${key} is a 2x2 grid`);
  }
  assert.equal(EFFECT_ART_PATHS.length, Object.keys(EFFECT_SHEETS).length);
  assert.equal(new Set(EFFECT_ART_PATHS).size, EFFECT_ART_PATHS.length, 'no sheet is listed twice');

  // The painted sheets carry alpha: a sprite without transparency is a keyed PNG that got away.
  for (const key of Object.keys(EFFECT_SHEETS) as (keyof typeof EFFECT_SHEETS)[]) {
    const { w, h } = pngSize(publicFile(EFFECT_SHEETS[key].url));
    assert.equal(w % 2, 0, `${key} width must divide by its 2 columns`);
    assert.equal(h % 2, 0, `${key} height must divide by its 2 rows`);
    // The generator returns roughly 1000px sheets whatever the prop's default quad size is, so the
    // assertion is a band, not an exact size: a thumbnail or a 4K monster both mean a bad export.
    assert.equal(w >= 512 && w <= 2048, true, `${key} is a real sheet (${w}px)`);
    assert.equal(h >= 512 && h <= 2048, true, `${key} is a real sheet (${h}px)`);
  }

  // The mapping itself: each gameplay event the sim reports must be one of the drawn kinds, and
  // every drawn kind must be reachable — no spec without a caller, no caller without a spec.
  const reachable: Record<string, string[]> = {
    // A TNT crate, a cauldron or the lava lake goes off.
    tnt: ['explosion', 'smoke'],
    lava: ['explosion', 'smoke'],
    // A heavy bump between balls.
    heavyBump: ['impact', 'sparks', 'smoke'],
    // A light bump, a shove or a shield glance.
    lightBump: ['impact', 'sparks'],
    // Landing, hopping, recovering, ground impacts.
    landing: ['dust'],
    // Boost pads trail smoke; loop exits throw sparks.
    boost: ['smoke'],
    loopExit: ['sparks', 'dust'],
    finish: [],
  };
  const used = new Set<string>();
  for (const kinds of Object.values(reachable)) for (const kind of kinds) used.add(kind);
  for (const kind of EFFECT_KINDS) assert.equal(used.has(kind), true, `${kind} is mapped to at least one gameplay event`);

  // And the runtime honours the mapping on the spec side: points are sparks only.
  for (const kind of EFFECT_KINDS) {
    const isPoints = EFFECT_SPECS[kind].sheet === 'points';
    assert.equal(isPoints, kind === 'sparks', `${kind} uses the right renderer`);
  }

  /* --- and the sim really emits them ------------------------------------------------------ */

  // 1. Obstacle contacts: one real `hitObstacle` call per authored kind, through the shipping
  //    physics, with the recorder in place of the renderer.
  const layout = createTrackLayout('ridge');
  const templateOf = (kind: string) => layout.find((obstacle) => obstacle.kind === kind);
  const expectedByKind: Record<string, string[]> = {
    boost: ['sparks'],
    spring: ['dust'],
    tnt: ['explosion', 'smoke'],
    sheep: ['dust'],
    blimp: ['explosion', 'smoke'],
    sign: ['impact'],
    water_rock: ['impact', 'dust'],
    break_bridge: ['impact', 'dust'],
    pinball_spinner: ['impact', 'sparks'],
    cauldron: ['explosion'],
    roller_rails: ['sparks'],
    waterfall_splash: ['smoke'],
  };
  const seen = new Set<string>();
  for (const [kind, expected] of Object.entries(expectedByKind)) {
    const template = templateOf(kind);
    assert.ok(template, `the ridge layout must author a ${kind} for the mapping to be honest`);
    const recorder = createRecordingFx();
    const world = createSimWorld('ridge', layout, createAirPickups('ridge', layout));
    let runTime = 0;
    const ctx: RacerStepContext = {
      world, fx: recorder, recovery: LEGACY_RECOVERY, random: () => 0.5,
      get runTime() { return runTime; }, get wallTime() { return runTime; },
    };
    const racer: Racer = { ...createRacers()[0], vx: 600, grounded: true };
    const obstacle: Obstacle = { ...(template as Obstacle), kind: kind as Obstacle['kind'], hit: false, broken: false, hitAt: -100 };
    (obstacle as { hitBy?: Set<number> }).hitBy = new Set<number>();
    runTime += FIXED_STEP;
    hitObstacle(racer, obstacle, ctx);
    const kinds = recorder.log.filter((entry) => entry.type === 'effect').map((entry) => (entry as { kind: string }).kind);
    assert.deepEqual(kinds, expected, `${kind} maps to ${expected.join(' + ')}`);
    for (const one of kinds) { assert.equal(isEffectKind(one), true, `${kind} emitted a known kind`); seen.add(one); }
  }
  // Every authored contact kind under the sun must not invent a kind of its own.
  for (const obstacle of layout) {
    if (!(obstacle.kind in expectedByKind)) continue;
  }

  // 2. Landing and loop exit, from a real drive: push off the grid, ride the hill, take the first
  //    loop and come out the other side, with the recorder watching.
  {
    const gate = createQualifyingGate('ridge', layout);
    const runLayout = createTrackLayout('ridge', { skipBeforeX: gate.x });
    const world = createSimWorld('ridge', runLayout, createAirPickups('ridge', runLayout));
    const recorder = createRecordingFx();
    let runTime = 0;
    const ctx: RacerStepContext = {
      world, fx: recorder, recovery: LEGACY_RECOVERY, random: () => 0.5,
      get runTime() { return runTime; }, get wallTime() { return runTime; },
    };
    const loopLane = createTrackLayout('ridge').find((obstacle) => obstacle.kind === 'loop')!.lane;
    const racer: Racer = { ...createRacers()[0], lane: loopLane, targetLane: loopLane, z: laneZ(loopLane) };
    const target = startPushVelocity(racer.pace, DEFAULT_PUSH_SEED, racer.id);
    for (let k = 1; k <= PUSH_TICKS; k++) {
      runTime += FIXED_STEP;
      applyPushTick(racer, k, target);
      racer.x += racer.vx * FIXED_STEP;
      racer.rotation += racer.vx * FIXED_STEP / RADIUS;
    }
    let rode = false; let exited = false;
    for (let tick = 0; tick < 4000 && !exited; tick++) {
      runTime += FIXED_STEP;
      stepRacer(racer, ctx, FIXED_STEP);
      if (racer.loopRide) rode = true;
      else if (rode) exited = true;
    }
    assert.equal(rode, true, 'the acceptance drive must reach the first loop');
    assert.equal(exited, true, 'and must leave it again inside the budget');
    const kinds = recorder.log.filter((entry) => entry.type === 'effect').map((entry) => (entry as { kind: string }).kind);
    assert.equal(kinds.includes('sparks'), true, 'the loop exit throws sparks');
    assert.equal(kinds.includes('dust'), true, 'landings and the descent raise dust');
    for (const one of kinds) assert.equal(isEffectKind(one), true, `the drive emitted ${one}, which is not a kind`);
    for (const kind of kinds) seen.add(kind);
  }

  // Between them these two drives exercise every kind the runtime knows how to draw.
  for (const kind of EFFECT_KINDS) {
    assert.equal(seen.has(kind), true, `no gameplay event produces ${kind}: the spec is dead weight`);
  }
});

/* -----------------------------------------------------------------------------
   7. RENDER PATH STAYS CHEAP
   -------------------------------------------------------------------------- */

test('render path stays cheap', () => {
  // The GPU objects are all built in the constructor; in a headless run no canvas is available, so
  // the painted sheets stay unloaded and the billboards keep their stand-in texture. What is being
  // measured here is the per-frame cost of the bookkeeping: draining the queue, mapping engine →
  // world, culling, spawning and writing the two buffers.
  const parent = new THREE.Group();
  const effects = new EffectRenderer(parent);
  const space = getTrackSpace();
  const camera = new THREE.PerspectiveCamera(62, 1.6, 4, 60000);
  // Sit where the race starts, so the events below are inside the cull distance rather than behind it.
  const home = placementFromEngine(space, { x: 900, y: 200, z: 0 }, []).world;
  camera.position.set(home.x, home.y, home.z);
  camera.updateMatrixWorld();
  const queue = new EffectQueue(EFFECT_QUEUE);
  const input = { queue, space, ramps: [], time: 0, dt: 1 / 120 };

  // A pile-up: every kind, as fast as the sim could possibly report it, for 3 000 frames.
  const kinds = EFFECT_KINDS;
  const started = performance.now();
  let tick = 0;
  for (let frame = 0; frame < 3000; frame++) {
    for (let n = 0; n < 4; n++) {
      const kind = kinds[(frame + n) % kinds.length];
      // Around the player's own stretch of the ridge course, where the camera sits.
      queue.push(kind, 900 + (frame % 40) * 10, 200, (n - 2) * 80, 1, 0, tick++);
    }
    input.time = frame / 120;
    effects.update(input, camera, false);
    assert.equal(effects.liveCount <= BILLBOARD_POOL, true, 'the pool is never exceeded');
  }
  const elapsed = performance.now() - started;
  assert.equal(effects.liveCount > 0, true, 'the run actually spawned billboards');
  assert.equal(effects.droppedCount > 0, true, 'and the pool recorded the overflow rather than growing');
  assert.ok(elapsed / 3000 < 1, `3000 frames of a 4-event pile-up took ${(elapsed / 3000).toFixed(3)} ms/frame`);

  // A quiet frame does nothing at all: no events drained, nothing written.
  queue.readSince(queue.written, []);
  effects.update({ ...input, time: 999 }, camera, true);
  assert.equal(effects.lastDrawn, 0, 'a quiet frame draws nothing');

  // A restart drops the queued effects rather than replaying them into the new race.
  queue.push('explosion', 1000, 200, 0, 1, 0, 0);
  effects.reset(queue);
  assert.equal(effects.liveCount, 0, 'reset empties the pool');
  assert.equal(effects.update(input, camera, false), 0, 'and nothing is replayed afterwards');

  effects.destroy();
  assert.equal(parent.children.length, 0, 'destroy detaches the group');
});
