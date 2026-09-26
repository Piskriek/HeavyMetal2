/**
 * Hand-written companion to the generated `legacy-engine-sim.ts` fixture.
 *
 * It rewires a `LegacyEngineSim` host onto `src/game/sim/*`: every member the T04 extraction moved
 * out of `GameEngine` is shadowed with a call into the shared module, and everything else (the tick
 * loop, the buckets, particles, the snapshot, bumps, the HUD publish) stays the copied legacy code.
 *
 * That arrangement is what makes `tests/physics-parity.test.ts` meaningful: host A runs the legacy
 * bodies, host B runs the sim modules, and *the same driver code* steps both. Anything that differs
 * is therefore a difference in the extracted simulation and nothing else.
 *
 * The wiring below is also the exact wiring `src/game/engine.ts` uses, field for field — if the
 * engine ever needs a different `RecoveryPolicy` or a different stagger, this file has to change to
 * match, and the parity test would then be comparing the wrong thing.
 */
import {
  canHop, performBoost, performBounce, performHop, stepRacer,
} from '../../src/game/sim/racer-physics';
import { driveCpu, setLane as setLaneSim, type CpuContext } from '../../src/game/sim/cpu-driver';
import { resolvePickups, type PickupClaim } from '../../src/game/sim/pickups';
import { createSimWorld, type SimWorld } from '../../src/game/sim/world';
import { LEGACY_RECOVERY, type RacerStepContext, type SimFx } from '../../src/game/sim/context';
import type { Racer } from '../../src/game/racers';
import type { Obstacle } from '../../src/game/scene';
import type { LegacyEngineSim } from './legacy-engine-sim';

export interface ModernSimHost {
  readonly host: LegacyEngineSim;
  readonly world: SimWorld;
  readonly ctx: RacerStepContext;
  /** Supply claims recorded by the sim's swept resolution, for the isolation assertions. */
  readonly claims: PickupClaim[];
}

/**
 * Replaces the legacy simulation members on `host` with the shared sim. Returns the world the host
 * is now reading, so tests can poke the same index the physics uses.
 */
export function attachModernSim(host: LegacyEngineSim): ModernSimHost {
  const world = createSimWorld(host.options.course, host.obstacles, host.pickups);
  const claims: PickupClaim[] = [];
  // The engine's own side effects, bound to the fixture's fields: the same object graph the race
  // drives, so a difference in *feedback* shows up in the comparison too.
  const fx: SimFx = {
    emit: (x, y, z, count, color, speed) => host.emit(x, y, z, count, color, speed),
    // T5 effects are cosmetic: they never feed back into the physics the parity harness compares.
    effect: () => {},
    airSheep: (spawn) => { host.airSheep.push({ x: spawn.x, y: spawn.y, z: spawn.z, vx: spawn.vx, vy: spawn.vy, rotation: 0, life: 3.1 }); },
    say: (text) => host.say(text),
    audio: (cue) => { host.audio.play(cue); },
    score: (delta) => { host.snapshot.score = Math.max(0, host.snapshot.score + delta); },
    shake: (amount) => { host.shake = amount; },
    tally: (kind) => { host.counts[kind]++; },
    refreshHud: () => { host.refreshSnapshot(); host.notify(); },
    notifyHud: () => { host.notify(); },
    setHopReady: (ready) => { host.snapshot.hopReady = ready; },
    clearTrail: () => { host.trail.length = 0; },
    pickupCollected: (kind) => {
      host.pickupCount++;
      host.snapshot.lastPickup = kind;
      host.snapshot.pickupNoticeUntil = host.runTime + 2.5;
    },
  };
  const ctx: RacerStepContext = {
    world,
    fx,
    recovery: LEGACY_RECOVERY,
    random: () => Math.random(),
    get runTime() { return host.runTime; },
    get wallTime() { return host.time; },
  };
  const cpuCtx: CpuContext = {
    step: ctx,
    // H11: the frozen legacy driver still flips its coin; the parity run compares like with like.
    tactics: 'legacy',
    get difficulty() { return host.config?.difficulty ?? 'racer'; },
    get others() { return host.racers; },
    get paceTargetX() { return host.racers[0].x; },
    stagger: (racer: Racer) => racer.id * 0.023,
  };
  const reindex = () => { world.configure(host.options.course, host.obstacles, host.pickups); };

  const legacyMakeTrack = host.makeTrack.bind(host);
  host.makeTrack = () => { legacyMakeTrack(); reindex(); };
  const legacySetTrackObstacles = host.setTrackObstacles.bind(host);
  host.setTrackObstacles = (obstacles: Obstacle[]) => { legacySetTrackObstacles(obstacles); reindex(); };

  host.stepRacer = (racer: Racer, dt: number) => { stepRacer(racer, ctx, dt); };
  host.driveCPU = (racer: Racer) => { driveCpu(racer, cpuCtx); };
  host.resolvePickups = () => {
    const resolved = resolvePickups(host.racers, ctx, {
      reducedMotion: host.reducedMotion,
      candidates: host.pickupCandidates,
    });
    for (const claim of resolved) claims.push(claim);
  };
  host.canHop = (racer: Racer) => canHop(racer, host.runTime);
  host.performHop = (racer: Racer) => { performHop(racer, ctx); };
  host.performBounce = (racer: Racer) => { performBounce(racer, ctx); };
  host.performBoost = (racer: Racer) => { performBoost(racer, ctx); };
  host.setLane = (racer: Racer, lane: number) => { setLaneSim(racer, lane, host.runTime); };
  host.surfaceAt = (x: number, z: number) => world.surfaceAt(x, z);
  host.inGap = (x: number, z: number) => world.inGap(x, z);
  reindex();

  return { host, world, ctx, claims };
}
