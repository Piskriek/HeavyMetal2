/**
 * M01 · T2 — the merge, headless: entry order must become exit order.
 *
 * Run with: `node --import tsx --test tests/merge-race.test.ts` (also registered in scripts/check.mjs).
 *
 * This is the acceptance ticket's own claim, driven end to end with the shipping physics: a full
 * field is shoved off the hill, everyone queues at the first-loop gate, the pool readies up and
 * releases them one at a time, and the order they come out of the ring in has to be the order they
 * went in — *with the bump pass running*, so the order is proven under real contact physics and not
 * in a world where nothing can touch.
 *
 * The harness below mirrors `GameEngine.stepRace`/`stepMerge`/`resolveBumps` line for line (the same
 * pattern `tests/start-zone.test.ts` uses for `stepPush`): the same pool, the same swept gate
 * crossing, the same hold, the same ordered release, the same contact filter. Three things are
 * measured beyond the ordering law itself, because they are what makes it hold:
 *
 *   - a held rider's z is *exactly* its own glide (nothing bumped them off their place in the queue);
 *   - a held rider's x never leaves the gate plane;
 *   - the instrument can see such a bump: with the filter removed, held riders are knocked about.
 */
import { statusSimulates } from '../src/game/engine';
import {
  POOL_GOBLIN_CALL, POOL_GOBLIN_COUNT, POOL_GOBLIN_FPS, POOL_GOBLIN_HOLD, POOL_GOBLIN_SWEEP,
  poolGoblinFrame, poolGoblinSheetPosition,
} from '../src/game/merge/goblin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSES, type CourseId } from '../src/game/types';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import {
  DEFAULT_SEGMENT_PROVIDER, createQualifyingGate, evaluateCrossing, segmentForStep,
} from '../src/game/qualifying/gate';
import {
  PASSAGE_CENTRE_Z, PASSAGE_GHOST_CAP_S, PASSAGE_GHOST_TAIL_S, insidePassage, passageExitX,
  passageMouthX, passageProgress,
} from '../src/game/qualifying/passage';
import { GRAVITY, LANE, RADIUS, closestLane } from '../src/game/scene';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';
import {
  HELD_DAMPING, HELD_RESPONSE, MERGE_GATE_HALF_WIDTH, MERGE_RELEASE_VX,
  POOL_PLAYER_GRACE_TICKS,
  MergePool,
} from '../src/game/merge/pool';

const DIAMETER = RADIUS * 2 + 4;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** The engine's own lateral glide for a held rider, so a hold can be *predicted* and compared. */
function heldGlide(z: number, vz: number, slotZ: number, dt: number): { z: number; vz: number } {
  const steering = (slotZ - z) * HELD_RESPONSE - vz * HELD_DAMPING;
  let nextVz = clamp(vz + steering * dt, -650, 650);
  const nextZ = clamp(z + nextVz * dt, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
  if (nextZ === z && Math.abs(nextVz) > 1) nextVz *= -0.25;
  return { z: nextZ, vz: nextVz };
}

interface BumpReport {
  /** Overlapping pairs of ordinary riders the pass separated. */
  resolved: number;
  /** Pairs the held/ghost filter took out of contact. */
  skipped: number;
  /** Pairs involving a held or ghost rider that got resolved anyway: zero with the filter on. */
  onHeldOrGhost: number;
}

/**
 * `GameEngine.resolveBumps`, verbatim in policy: same skip list, same penetration split, same
 * impulse, same sideways shove. `skipHeldGhost` is the engine's own filter — turning it off is how
 * this file proves the filter is load-bearing rather than decorative.
 */
function resolveBumps(
  racers: readonly Racer[], runTime: number, collisionTimes: Float64Array, skipHeldGhost: boolean,
): BumpReport {
  const report: BumpReport = { resolved: 0, skipped: 0, onHeldOrGhost: 0 };
  for (let i = 0; i < racers.length - 1; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i]; const b = racers[j];
      if (a.finished || b.finished || a.falling || b.falling || a.loopRide || b.loopRide) continue;
      if (runTime < a.immuneUntil || runTime < b.immuneUntil) continue;
      const intangible = a.mergeHeld || b.mergeHeld || a.mergeGhost || b.mergeGhost;
      const dx = b.x - a.x; const dz = b.z - a.z; const dy = b.y - a.y;
      const distance = Math.hypot(dx, dz, dy);
      if (distance >= DIAMETER || Math.abs(dy) > RADIUS * 1.55) continue;
      if (intangible) {
        report.skipped += 1;
        if (!skipHeldGhost) report.onHeldOrGhost += 1;
        continue;
      }
      report.resolved += 1;
      const planar = Math.hypot(dx, dz) || 1;
      const nx = dx / planar; const nz = dz / planar;
      const sum = a.weight + b.weight;
      const penetration = (DIAMETER - distance + 1) * 0.55;
      a.x -= nx * penetration * b.weight / sum; b.x += nx * penetration * a.weight / sum;
      a.z -= nz * penetration * b.weight / sum; b.z += nz * penetration * a.weight / sum;
      a.z = clamp(a.z, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      b.z = clamp(b.z, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      const pair = i * 4 + j;
      if (runTime - collisionTimes[pair] < 0.38) continue;
      collisionTimes[pair] = runTime;
      const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relative < 0) {
        const impulse = -(1.38 * relative) / (1 / a.weight + 1 / b.weight);
        a.vx = clamp(a.vx - impulse * nx / a.weight, 100, a.maximumSpeed);
        b.vx = clamp(b.vx + impulse * nx / b.weight, 100, b.maximumSpeed);
      }
      let side = Math.abs(dz) > 8 ? Math.sign(dz) : closestLane(b.z) === 0 ? -1 : closestLane(b.z) === 3 ? 1 : ((i + j) % 2 ? 1 : -1);
      if (!side) side = 1;
      const closing = Math.min(380, Math.abs(a.vx - b.vx) + Math.abs(a.vz - b.vz));
      const kick = (270 + closing * 0.22) * (closing > 200 || Math.abs(a.vx - b.vx) > 150 ? 2.5 : 1);
      const shove = (racer: Racer, direction: number, speed: number) => {
        racer.targetLane = clamp(closestLane(racer.z) - Math.sign(direction), 0, 3);
        racer.vz = clamp(racer.vz + direction * speed, -650, 650);
        racer.z = clamp(racer.z + direction * 5, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      };
      shove(a, -side, kick * Math.min(1.65, b.weight / a.weight));
      shove(b, side, kick * Math.min(1.65, a.weight / b.weight));
    }
  }
  return report;
}

interface RaceResult {
  /** Entry order and exit order, both as racer ids. */
  readonly entryOrder: number[];
  readonly exitOrder: number[];
  /** The closest two exits came, converted to x-units at the barrel's own speed (see `runMerge`). */
  readonly minExitSpacing: number;
  readonly bumpsOnHeldOrGhost: number;
  readonly heldGlideErrors: number;
  readonly heldOffPlane: number;
  /** Largest and smallest single-tick x movement with contact excluded: the merge machinery's own. */
  readonly mergeStepMax: number;
  readonly mergeStepMin: number;
  /** Largest single-tick x movement including contact resolution. */
  readonly contactStepMax: number;
  /** Largest backward correction applied by the gate snap-back: the overshoot of one tick. */
  readonly snapBackMax: number;
  /** Riders that moved backwards on flat ground, with no loop ride to explain it. */
  readonly backwardOnFlat: number;
  /** Feeding the post-merge field two overlapped ordinary riders: the contact pass must separate them. */
  readonly resumeOrdinary: number;
  readonly resumeSeparated: number;
  /** The same overlap with one rider ghosted: the contact pass must take the pair out of contact. */
  readonly resumeGhostSkipped: number;
  readonly resumeGhostResolved: number;
  readonly fingerprint: string;
  readonly ticks: number;
  readonly exitTick: number;
  /** True when the pool had retired by the last tick of the run. */
  readonly poolDone: boolean;
  /** The held/ghost filter's control: an overlapping pair the resolver must skip. */
  readonly mergeGhostOverlap: { readonly skipped: number; readonly onHeldOrGhost: number;
    readonly separation: number; readonly after: number };
  /** Ticks from the first rider's entry to the last rider's exit: the pool's own work, no run-up. */
  readonly mergeTicks: number;
}

/** Drives the whole merge for one course. `seed` feeds the push; everything else is deterministic. */
function runMerge(seed: number, course: CourseId = 'ridge', skipHeldGhost = true): RaceResult {
  const bare = createTrackLayout(course);
  // M01 · T1d: the sort is anchored at the **mouth of the track's own 360° geometry loop**
  // (`passageMouthX`), while the start zone still ends at the first ring's entry plane — so the field
  // rides the descent's rings on the way down before it queues (T1c), and the loop itself is geometry.
  const startZone = createQualifyingGate(course, bare);
  const mergeGate = { ...startZone, x: passageMouthX(), z: PASSAGE_CENTRE_Z, halfWidth: MERGE_GATE_HALF_WIDTH };
  const layout = createTrackLayout(course, { skipBeforeX: passageMouthX(), keepLoopsFromX: startZone.x });
  const world = createSimWorld(course, layout, createAirPickups(course, layout));
  const loopZ = PASSAGE_CENTRE_Z;
  const racers = createRacers();
  const collisionTimes = new Float64Array(racers.length * racers.length).fill(-100);
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; }, get wallTime() { return runTime; },
  };
  const pool = new MergePool({
    gateX: mergeGate.x, loopZ, racerIds: racers.map((racer) => racer.id), playerId: 0,
  });

  // The goblin push, verbatim from `GameEngine.stepPush`.
  const targets = racers.map((racer) => startPushVelocity(racer.pace, seed, racer.id));
  for (let k = 1; k <= PUSH_TICKS; k++) {
    runTime += FIXED_STEP;
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      applyPushTick(racer, k, targets[i]);
      racer.x += racer.vx * FIXED_STEP;
      racer.y = world.y(racer.x) - RADIUS;
      racer.rotation += racer.vx * FIXED_STEP / RADIUS;
    }
  }

  // Raw crossings, kept with the pool's own order key so the expected order can be derived here
  // rather than read back out of the pool.
  const crossings: { racerId: number; order: number }[] = [];
  const exitOrder: number[] = [];
  const exited: { racer: Racer; tick: number }[] = [];
  /** Riders already counted out of the geometry loop. */
  const riding = new Set<number>();
  /** The filter's control, measured once inside the loop, on clones. */
  let ghostOverlapControl: RaceResult['mergeGhostOverlap'] | null = null;
  // Who has actually queued. The field rides the run-up loops on the way down to the sorting gate
  // (T1c), and a ride before the gate is not this rider's turn in the ring.
  const queued = new Set<number>();
  let firstEntryTick = -1;
  let lastReleased: number | null = null;
  let bumpsOnHeldOrGhost = 0;
  let heldGlideErrors = 0;
  let heldOffPlane = 0;
  let mergeStepMax = 0;
  let mergeStepMin = 0;
  let contactStepMax = 0;
  let snapBackMax = 0;
  let backwardOnFlat = 0;
  let tick = PUSH_TICKS;
  let mergeFinishedTick = -1;
  let exitTick = -1;
  // A probe cap, not a law: it only has to be large enough for the run-up the field rides before the
  // sorting gate. What the pool itself may cost is asserted separately, from `mergeTicks`.
  const budget = PUSH_TICKS + 12000;

  for (; tick < budget; tick++) {
    runTime += FIXED_STEP;
    // The pre-tick state: the gate crossing test, the held glide prediction and the no-teleport
    // check all read it.
    const before = racers.map((racer) => ({
      x: racer.x, z: racer.z, vz: racer.vz, slotZ: racer.mergeSlotZ, held: racer.mergeHeld,
      loop: racer.loopRide, recoveries: racer.recoveries,
    }));

    // 1. One physics step per racer. No CPU driver: the harness leaves every bot in the lane it was
    //    given, so what is measured is the merge and not the rubber-band.
    for (const racer of racers) stepRacer(racer, ctx, FIXED_STEP);

    // 2. Gate crossings, exactly as `GameEngine.stepMerge` finds them.
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (racer.mergeHeld || racer.finished) continue;
      if (pool.entries.some((entry) => entry.racerId === racer.id)) continue;
      const from = before[i];
      if (!(from.x < mergeGate.x && racer.x >= mergeGate.x)) continue;
      const segment = segmentForStep(
        DEFAULT_SEGMENT_PROVIDER,
        { x: from.x, loop: null },
        { x: racer.x, loop: racer.loopRide?.obstacle ?? null },
      );
      const outcome = evaluateCrossing(world, mergeGate, from, racer, segment);
      if (!outcome.ok) continue;
      const entered = pool.enter(racer.id, tick, outcome.fraction, mergeGate.x);
      if (!entered.ok) continue;
      if (firstEntryTick < 0) firstEntryTick = tick;
      queued.add(racer.id);
      // The pool keys the queue on the *crossing* time — the tick plus the fraction of the tick the
      // plane was crossed at — and breaks exact ties by racer id. This is that key, derived here.
      crossings.push({ racerId: racer.id, order: tick + outcome.fraction });
      racer.mergeHeld = true;
      racer.mergeGhost = false;
      racer.mergeSlotZ = entered.value.slotZ;
      // The snap-back is the overshoot of a single tick's motion: the rider ended this tick past the
      // plane, so the correction is strictly less than the distance they covered in the tick.
      snapBackMax = Math.max(snapBackMax, mergeGate.x - from.x);
      racer.x = mergeGate.x;
      racer.vx = 0; racer.vy = 0; racer.vz = 0;
      racer.falling = false; racer.grounded = true;
      racer.y = world.y(racer.x) - RADIUS;
    }

    // 3. The next rider slides into the ring's lane; everyone else waits in their slot.
    const next = pool.next;
    for (const entry of pool.entries) {
      if (entry.releaseTick !== null) continue;
      const racer = racers.find((candidate) => candidate.id === entry.racerId);
      if (!racer) continue;
      racer.mergeSlotZ = entry === next ? pool.loopZ : entry.slotZ;
    }

    // 4. The pool: occupancy from the previous release's own progress through the geometry loop, then
    //    the ordered release.
    const previousRacer = lastReleased === null ? null : racers.find((racer) => racer.id === lastReleased) ?? null;
    const candidate = next ? racers.find((racer) => racer.id === next.racerId) ?? null : null;
    const released = pool.step(tick, {
      previousProgress: previousRacer ? passageProgress(previousRacer.x) : 1,
      candidateAligned: candidate !== null
        && Math.abs(candidate.z - pool.loopZ) <= 6
        && Math.abs(candidate.vz) <= 30,
      expected: racers.filter((racer) => !racer.finished).length,
    });
    for (const racerId of released) {
      const racer = racers.find((candidateRacer) => candidateRacer.id === racerId);
      if (!racer) continue;
      racer.mergeHeld = false;
      racer.mergeGhost = true;
      racer.vx = MERGE_RELEASE_VX; racer.vy = 0; racer.vz = 0;
      racer.grounded = false; racer.falling = false;
      // Aimed through the tunnel portal, at the centre of the corridor.
      racer.targetLane = closestLane(pool.loopZ);
      racer.loopExitTime = -100;
      racer.mergeGhostUntil = runTime + PASSAGE_GHOST_TAIL_S;
      lastReleased = racerId;
    }

    // 4c. The barrel carries the field, single file (the engine does the same): a released rider inside
    //     the geometry loop runs it at the release speed, on the ribbon, and nothing can stop them.
    for (const racer of racers) {
      if (!racer.mergeGhost || racer.loopRide !== null || !insidePassage(racer.x)) continue;
      racer.vx = MERGE_RELEASE_VX; racer.vy = 0;
      racer.falling = false; racer.grounded = true;
      racer.y = world.y(racer.x) - RADIUS;
    }

    // 5. Contact, with the engine's own held/ghost filter.
    const bumps = resolveBumps(racers, runTime, collisionTimes, skipHeldGhost);
    // Recounted here rather than inside the merge block, and it excludes the same two non-contact
    // actors: a ring's own arc, and a recovery's respawn (`LEGACY_RECOVERY` moves a wrecked rider 200
    // units back by design). What is left is the merge plus contact.
    for (let i = 0; i < racers.length; i++) {
      if (racers[i].recoveries !== before[i].recoveries) continue;
      if (before[i].loop != null || racers[i].loopRide !== null) continue;
      contactStepMax = Math.max(contactStepMax, Math.abs(racers[i].x - before[i].x));
    }
    bumpsOnHeldOrGhost += bumps.onHeldOrGhost;

    // 5b. The filter's own control, taken while the merge state is real and on *clones*, so the run is
    //     untouched: a ghost overlapped onto a held rider must be skipped with the filter on, and the
    //     same pair must separate with the filter off. (Inside the geometry loop the field is spaced by
    //     the release gap, so a healthy run produces no accidental contact to count.)
    if (!ghostOverlapControl) {
      const held = racers.find((racer) => racer.mergeHeld) ?? null;
      const ghost = racers.find((racer) => racer.mergeGhost) ?? null;
      if (held && ghost) {
        // One unit apart, not coincident: the resolver's normal is undefined at exactly zero distance,
        // so a coincident pair would "resolve" without moving and prove nothing.
        const overlap = (cloneHeld: boolean, cloneGhost: boolean) => {
          const pair = [{ ...held }, { ...ghost }];
          for (const clone of pair) {
            clone.falling = false; clone.loopRide = null; clone.immuneUntil = -100; clone.finished = false;
          }
          if (cloneHeld) pair[0].mergeHeld = true; else pair[0].mergeHeld = false;
          if (cloneGhost) pair[1].mergeGhost = true; else pair[1].mergeGhost = false;
          pair[1].mergeHeld = false; pair[0].mergeGhost = false;
          pair[1].x = pair[0].x + 1; pair[1].z = pair[0].z; pair[1].y = pair[0].y;
          pair[1].vx = pair[0].vx; pair[1].vz = pair[0].vz;
          const separation = Math.hypot(pair[1].x - pair[0].x, pair[1].z - pair[0].z);
          // `skipHeldGhost: false` is the resolver asked to *report* what it skipped as well as what it
          // resolved — with the flags cleared there is nothing to report, so it simply separates them.
          const report = resolveBumps(pair, runTime, collisionTimes, false);
          return { report, separation, after: Math.hypot(pair[1].x - pair[0].x, pair[1].z - pair[0].z) };
        };
        // With the filter in place the pair must be left alone; with the flags cleared — the same
        // geometry, the same resolver — it must be separated. Both halves, or the control proves nothing.
        const filtered = overlap(true, true);
        const free = overlap(false, false);
        ghostOverlapControl = {
          skipped: filtered.report.skipped, onHeldOrGhost: filtered.report.onHeldOrGhost,
          separation: filtered.separation, after: free.after,
        };
      }
    }

    // 4b. The merge machinery's own displacement, with contact still to come: the gate snap-back, the
    //     hold and the release together may not move anyone further than one tick of their own speed.
    for (let i = 0; i < racers.length; i++) {
      const moved = racers[i].x - before[i].x;
      // A ring ride travels an arc — and its exit places the racer at `loop.x + 3` — so an arcing tick
      // is the ring's own geometry, not the merge's. A fall can lose ground the same way. The merge's
      // displacement cap is measured on the ticks that are the merge's.
      // A recovery is the course's own policy (`LEGACY_RECOVERY` respawns 200 units back by design) and
      // not the merge's doing, so its tick is excluded the same way a ring's arc is.
      const recovered = racers[i].recoveries !== before[i].recoveries;
      const arcing = before[i].loop != null || racers[i].loopRide !== null || recovered;
      if (!arcing) mergeStepMax = Math.max(mergeStepMax, moved);
      if (!arcing && !racers[i].falling) {
        mergeStepMin = Math.min(mergeStepMin, moved);
        if (moved < -1e-9) {
          backwardOnFlat += 1;
          if (process.env.MR_DEBUG) {
            const r = racers[i];
            console.log(`BACK ${course} tick ${tick} id ${r.id} moved ${moved.toFixed(2)} x ${before[i].x.toFixed(1)}->${r.x.toFixed(1)} vx ${r.vx.toFixed(1)} held ${r.mergeHeld} ghost ${r.mergeGhost} y ${r.y.toFixed(1)} fall ${r.falling} visited ${r.visited.size}`);
          }
        }
      }
    }

    // 6. Ghost tails, and the two events worth recording: engaging the ring and leaving it. The tail is
    //    the engine's own law now — intangible until clear of the geometry loop, with a cap (T1d).
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (racer.mergeGhost && runTime >= racer.mergeGhostUntil
        && (racer.x >= passageExitX() || runTime >= racer.mergeGhostUntil + PASSAGE_GHOST_CAP_S)) {
        racer.mergeGhost = false;
      }
      // A held rider must still be on its own glide, and on the gate plane.
      if (before[i].held) {
        const predicted = heldGlide(before[i].z, before[i].vz, before[i].slotZ, FIXED_STEP);
        if (Math.abs(racer.z - predicted.z) > 1e-9) heldGlideErrors += 1;
        if (racer.x !== mergeGate.x) heldOffPlane += 1;
      }
      // "Coming out of the loop" is the geometry loop's exit now (T1d): the sorting plane is its mouth,
      // so a racer has left it once they are past the far side. The order they do that in is the order
      // they went in.
      if (queued.has(racer.id) && !riding.has(racer.id) && racer.x >= passageExitX()) {
        riding.add(racer.id);
        exitOrder.push(racer.id);
        exited.push({ racer, tick });
        if (exited.length === racers.length) exitTick = tick;
      }
    }

    if (pool.phase === 'done' && mergeFinishedTick < 0) mergeFinishedTick = tick;
    if (mergeFinishedTick >= 0 && exitTick >= 0 && racers.every((racer) => !racer.mergeGhost)) break;
  }

  // How far apart the field left the loop, in x-units: the gap between two consecutive exits, in ticks,
  // at the speed the barrel carries everyone. (The exit is a plane now, so every rider's own x there is
  // the same number — the spacing is the *time* between them.)
  let minExitSpacing = Number.POSITIVE_INFINITY;
  for (let index = 1; index < exited.length; index++) {
    const gapTicks = exited[index].tick - exited[index - 1].tick;
    minExitSpacing = Math.min(minExitSpacing, gapTicks / 120 * MERGE_RELEASE_VX);
  }

  // Contact resumes: the merge is over, so the contact pass has to bite again. Overlap two of the
  // field's own post-merge riders and let the resolver run — it must separate them. Then ghost one of
  // the pair and run it again — the same resolver must leave it alone. Mutating here is safe: the run
  // is finished and nothing reads these racers afterwards.
  const probe = (ghosted: boolean) => {
    const a = racers[0]; const b = racers[1];
    for (const racer of [a, b]) {
      racer.mergeHeld = false;
      racer.mergeGhost = false;
      racer.falling = false;
      racer.finished = false;
      racer.loopRide = null;
      racer.immuneUntil = -1;
    }
    if (ghosted) b.mergeGhost = true;
    b.x = a.x + 1; b.z = a.z; b.y = a.y;
    b.vx = a.vx; b.vz = a.vz;
    const separation = Math.hypot(b.x - a.x, b.z - a.z);
    const report = resolveBumps(racers, runTime, new Float64Array(racers.length * racers.length).fill(-100), skipHeldGhost);
    const after = Math.hypot(b.x - a.x, b.z - a.z);
    return { resolved: report.resolved, skipped: report.skipped, violations: report.onHeldOrGhost, separation, after };
  };
  const ordinaryProbe = probe(false);
  const ghostProbe = probe(true);

  const entryOrder = [...crossings]
    .sort((a, b) => a.order - b.order || a.racerId - b.racerId)
    .map((crossing) => crossing.racerId);

  const fingerprint = [
    `entries=${pool.entries.map((entry) => `${entry.racerId}@${entry.entryTick}`).join(',')}`,
    `ready=${pool.entries.map((entry) => `${entry.racerId}@${entry.readyTick}`).join(',')}`,
    `releases=${pool.entries.map((entry) => `${entry.racerId}@${entry.releaseTick}`).join(',')}`,
    `flags=${pool.entries.map((entry) => `${entry.racerId}:${entry.flags.join('+')}`).join(',')}`,
    `exit=${exitOrder.join(',')}`,
  ].join('|');

  return {
    entryOrder, exitOrder, minExitSpacing, bumpsOnHeldOrGhost,
    heldGlideErrors, heldOffPlane, mergeStepMax, mergeStepMin, contactStepMax, snapBackMax, backwardOnFlat,
    resumeOrdinary: ordinaryProbe.resolved,
    resumeSeparated: ordinaryProbe.after - ordinaryProbe.separation,
    resumeGhostSkipped: ghostProbe.skipped,
    resumeGhostResolved: ghostProbe.resolved,
    mergeGhostOverlap: ghostOverlapControl ?? { skipped: 0, onHeldOrGhost: 0, separation: 0, after: 0 },
    poolDone: pool.phase === 'done',
    fingerprint, ticks: tick, exitTick,
    mergeTicks: firstEntryTick < 0 || exitTick < 0 ? -1 : exitTick - firstEntryTick,
  };
}

/* -----------------------------------------------------------------------------
   AC-2/AC-3/AC-4: the ordering law, under contact
   -------------------------------------------------------------------------- */

test('exit order equals entry order (100 seeds × 3 courses)', () => {
  assert.equal(COURSES.length, 3, 'all three authored courses are covered');
  const seedsPerCourse: Record<CourseId, number> = { ridge: 100, boomtown: 24, sheep: 24 };
  for (const course of COURSES) {
    for (let seed = 0; seed < seedsPerCourse[course.id]; seed++) {
      const run = runMerge((seed * 2654435761) >>> 0, course.id);
      const context = `${course.id} seed ${seed}`;
      assert.equal(run.entryOrder.length, 4, `${context}: every racer queues`);
      assert.deepEqual(run.exitOrder, run.entryOrder,
        `${context}: exit order ${run.exitOrder.join(',')} ≠ entry order ${run.entryOrder.join(',')}`);
      assert.ok(run.minExitSpacing >= 200,
        `${context}: riders left the ring only ${run.minExitSpacing.toFixed(1)} x-units apart`);
    }
  }
});

test('no contacts while held or ghost', () => {
  // Every seed, plus the margin: a held rider stays exactly on its own glide (nothing knocked them
  // out of the queue) and never leaves the gate plane.
  for (let seed = 0; seed < 24; seed++) {
    const run = runMerge((seed * 40503) >>> 0, 'ridge');
    assert.equal(run.bumpsOnHeldOrGhost, 0, `seed ${seed}: a bump reached a held or ghost rider`);
    assert.equal(run.heldGlideErrors, 0, `seed ${seed}: a held rider left its own glide`);
    assert.equal(run.heldOffPlane, 0, `seed ${seed}: a held rider drifted off the gate plane`);
  }

  // And the instrument is not blind. Inside the geometry loop the field is spaced by the release gap,
  // so a run no longer produces accidental contact — the control is a *deliberate* one: overlap a held
  // rider with a ghost and run the resolver both ways. With the filter on it must leave them alone;
  // with it off it must separate them. (A queued rider shoved sideways would lose their place, which
  // is the whole reason the filter exists.)
  const run = runMerge(DEFAULT_PUSH_SEED, 'ridge');
  assert.equal(run.mergeGhostOverlap.skipped, 1, 'the filter must skip an overlapping ghost');
  assert.equal(run.mergeGhostOverlap.onHeldOrGhost, 1,
    'the control must be a pair the filter is actually holding apart');
  assert.ok(run.mergeGhostOverlap.after - run.mergeGhostOverlap.separation > 1,
    `the control is only meaningful if the unfiltered resolver really separates the pair`
    + ` (${run.mergeGhostOverlap.separation.toFixed(2)} -> ${run.mergeGhostOverlap.after.toFixed(2)})`);
});

test('contacts resume after ghost tail', () => {
  // Ghosts clear, and the contact pass bites again: the resolver takes the field's own post-merge
  // riders, finds them overlapped, and separates them.
  for (let seed = 0; seed < 8; seed++) {
    const run = runMerge((seed * 97 + 11) >>> 0, 'ridge');
    assert.ok(run.exitTick > 0, `seed ${seed}: the whole field left the ring`);
    assert.ok(run.resumeOrdinary >= 1, `seed ${seed}: the contact pass did not resolve two ordinary riders`);
    assert.ok(run.resumeSeparated > 0, `seed ${seed}: the overlap was not pushed apart`);
    assert.equal(run.resumeGhostSkipped, 1, `seed ${seed}: the ghosted pair was not taken out of contact`);
    assert.equal(run.resumeGhostResolved, 0, `seed ${seed}: the contact pass resolved a ghosted pair`);
  }
});

test('no teleport', () => {
  // The merge machinery may not place anyone: on every tick of the whole run, after the gate
  // snap-back, the hold and the release but *before* contact, a rider's x has moved forward by at
  // most one tick of its own speed and never backwards at all. (Contact resolution does move riders,
  // by design, and by no more than its own penetration split.)
  const fastest = Math.max(...createRacers().map((racer) => racer.maximumSpeed));
  const penetrationCap = (DIAMETER + 1) * 0.55;
  // `stepRacer` clamps `vx` to the racer's maximum *after* the integration (`racer-physics.ts:527`),
  // so a tick spent on a slope integrates the pre-clamp speed: the worst case is one tick of downhill
  // acceleration on top of maximum speed. The downhill term is `stageGravity · slope / (1 + slope²) /
  // 1.4`, which peaks at `stageGravity / 2.8` — and stage gravity is `GRAVITY · 1.45` in its band.
  const slopeStep = GRAVITY * 1.45 / 2.8 * FIXED_STEP * FIXED_STEP;
  for (const course of COURSES) {
    const run = runMerge(DEFAULT_PUSH_SEED, course.id);
    assert.equal(run.entryOrder.length, 4, `${course.id}: the whole field queues`);
    // Anti-stall law: the pool's whole window — first entry to last exit — stays well inside its 50 s
    // backstop, so a healthy field never reaches the fallback. The run-up the field rides first is not
    // part of this window (T1c moved the sort deeper).
    assert.ok(run.mergeTicks > 0 && run.mergeTicks < POOL_PLAYER_GRACE_TICKS,
      `${course.id}: the pool leaned on its backstop — ${run.mergeTicks} ticks from entry to exit`);
    assert.equal(run.heldOffPlane, 0, `${course.id}: held riders stayed on the plane`);
    assert.ok(run.mergeStepMax <= fastest * FIXED_STEP + slopeStep + 1e-9,
      `${course.id}: the merge moved a rider ${run.mergeStepMax.toFixed(4)} forward in one tick`);
    assert.equal(run.backwardOnFlat, 0,
      `${course.id}: the merge moved a rider ${run.mergeStepMin.toFixed(4)} backwards on flat ground`);
    assert.ok(run.snapBackMax <= fastest * FIXED_STEP + 1e-9,
      `${course.id}: the gate snap-back moved a rider ${run.snapBackMax.toFixed(4)}`);
    assert.ok(run.contactStepMax <= fastest * FIXED_STEP + slopeStep + penetrationCap + 1e-9,
      `${course.id}: contact moved a rider ${run.contactStepMax.toFixed(4)} in one tick`);
  }
});

test('deterministic fingerprint', () => {
  const first = runMerge(DEFAULT_PUSH_SEED, 'ridge');
  const again = runMerge(DEFAULT_PUSH_SEED, 'ridge');
  assert.equal(first.fingerprint, again.fingerprint, 'the same seed replays the same merge');
  assert.equal(first.ticks, again.ticks, 'and finishes on the same tick');
  // A different push seed changes who arrives first — and the law still holds for it.
  const other = runMerge(0x1234, 'ridge');
  assert.notEqual(first.fingerprint, other.fingerprint, 'the seed really does change the run');
  assert.deepEqual(other.exitOrder, other.entryOrder);
});

/* -----------------------------------------------------------------------------
   The engine's wiring — so the mirror above cannot silently drift
   -------------------------------------------------------------------------- */

test('the simulation steps while the pool holds the field', () => {
  // The order of the merge is only worth anything if the merge is allowed to happen. The frame loop
  // steps the physics during exactly the statuses this predicate allows, and the pool's own clock is
  // driven from `stepRace` — so `checkpoint`/`countdown` have to be in here, or the field would be
  // held for ever at the gate with nothing left to release it.
  for (const status of ['flying', 'pushing', 'checkpoint', 'countdown'] as const) {
    assert.equal(statusSimulates(status), true, `the sim must step while "${status}"`);
  }
  for (const status of ['loading', 'ready', 'paused', 'finished'] as const) {
    assert.equal(statusSimulates(status), false, `the sim must not step while "${status}"`);
  }
});

test('the engine drives the pool the way this harness does', () => {
  // A structural check on the wiring itself. The harness mirrors `GameEngine`, and this is what keeps
  // the mirror honest: if the engine stops calling the pool, stops filtering contact, stops pinning
  // the release lane, or loses the ready command, the mirrored proof above would quietly stop meaning
  // anything about the shipping game — so that fails here instead.
  const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(source, /this\.stepMerge\(\);/, 'the pool must be driven from the race step');
  assert.match(source, /a\.mergeHeld \|\| b\.mergeHeld \|\| a\.mergeGhost \|\| b\.mergeGhost/,
    'the contact pass must take held and ghost riders out of contact');
  assert.match(source, /this\.mergeGateFor\(\)\.x;/, 'a held rider is pinned to the gate plane');
  assert.match(source, /racer\.targetLane = closestLane\(PASSAGE_CENTRE_Z\);/,
    'a release must aim the rider through the tunnel portal at the mouth of the geometry loop');
  assert.match(source, /previousProgress: previousRacer \? passageProgress\(previousRacer\.x\) : 1,/,
    'the occupancy rule must read the previous rider\'s progress through the geometry loop');
  assert.match(source, /const x = passageMouthX\(\);/,
    'the sorting plane must be the mouth of the track\'s geometry loop (T1d)');
  assert.match(source, /racer\.mergeGhostUntil = this\.runTime \+ PASSAGE_GHOST_TAIL_S;/,
    'a release must stamp the ghost clock the tail law reads');
  assert.match(source, /racer\.x >= passageExitX\(\) \|\| this\.runTime >= racer\.mergeGhostUntil \+ PASSAGE_GHOST_CAP_S/,
    'the ghost tail must end once the rider is clear of the loop, with the cap behind it');
  assert.match(source, /ready = \(\) => \{/, 'the player\'s ready must be the engine\'s own command');
  // The pool owns two statuses, and every place that used to ask "are we racing?" asks the shared
  // predicate instead — including the frame loop, whose answer decides whether the pool ever advances.
  assert.match(source, /const simulating = statusSimulates\(this\.status\);/,
    'the frame loop must step the simulation during the pool');
  assert.match(source, /private get pausable\(\): boolean \{[\s\S]{0,200}?status === 'checkpoint'/,
    'a pause taken during the pool has to be allowed, and has to come back to the pool');
});

test('the pool goblin holds a pose per phase and sweeps the field off', () => {
  // The overlay's own law, asserted like the rest of the presentation in this project: one pose per
  // phase, and the sweep animates — all four cells at 12 fps — only while GO! is on screen.
  const plain = false;
  assert.equal(poolGoblinFrame('open', false, 0, plain), POOL_GOBLIN_HOLD);
  assert.equal(poolGoblinFrame('closed', false, 9.5, plain), POOL_GOBLIN_CALL);
  assert.equal(poolGoblinFrame('countdown', false, 3.4, plain), POOL_GOBLIN_COUNT);
  // An open GO! window cycles every cell, in order, and repeats: floor(t·fps) mod 4.
  const seen = new Set<number>();
  for (let tick = 0; tick < 24; tick++) {
    seen.add(poolGoblinFrame('releasing', true, tick / POOL_GOBLIN_FPS, plain));
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3], 'the sweep plays every pose');
  assert.equal(poolGoblinFrame('releasing', true, 1 / (POOL_GOBLIN_FPS * 2), plain), 0);
  assert.equal(poolGoblinFrame('releasing', true, 3.9 / POOL_GOBLIN_FPS, plain), 3);
  assert.equal(poolGoblinFrame('releasing', true, 4 / POOL_GOBLIN_FPS, plain), 0, 'and wraps');
  // Reduced motion holds the first sweep cell instead of animating.
  for (const seconds of [0, 1 / POOL_GOBLIN_FPS, 7.3]) {
    assert.equal(poolGoblinFrame('releasing', true, seconds, true), POOL_GOBLIN_SWEEP);
  }
  // The sheet is a 2x2 grid: the cells walk left-right, then the next row, and every one fits.
  assert.deepEqual(poolGoblinSheetPosition(0), { x: 0, y: 0 });
  assert.deepEqual(poolGoblinSheetPosition(1), { x: 100, y: 0 });
  assert.deepEqual(poolGoblinSheetPosition(2), { x: 0, y: 100 });
  assert.deepEqual(poolGoblinSheetPosition(3), { x: 100, y: 100 });
  assert.deepEqual(poolGoblinSheetPosition(-1), { x: 100, y: 100 }, 'a wrapped index still lands on a cell');
});

/* -----------------------------------------------------------------------------
   The pool's own bookkeeping, from the race side
   -------------------------------------------------------------------------- */

test('pool retires after the last release', () => {
  const run = runMerge(DEFAULT_PUSH_SEED, 'ridge');
  assert.equal(run.entryOrder.length, 4);
  assert.equal(run.exitOrder.length, 4);
  assert.ok(run.poolDone, 'the pool retires');
  assert.ok(run.exitTick > 0 && run.exitTick <= run.ticks,
    'the whole field is out of the loop by the time the run stops');
});
