import { SIM_DT, type EventBus, type InputFrame, type Replay, type Simulation, type System, type VariableSystem, type World } from '@hm/contracts';
import { createWorld } from './world';

const EMPTY = (tick: number): InputFrame => ({ tick, actors: {} });

export function createSimulation(opts: {
  readonly seed: number; readonly events: EventBus; readonly vars: VariableSystem; readonly systems?: readonly System[];
}): Simulation {
  const world = createWorld({ seed: opts.seed });
  const systems: { system: System; index: number }[] = [];
  let registered = 0;
  let accumulatorMs = 0;
  const dtMs = SIM_DT * 1000;

  const addSystem = (system: System): void => {
    if (systems.some((s) => s.system.name === system.name)) throw new Error(`simulation: a system named "${system.name}" is already registered`);
    systems.push({ system, index: registered++ });
    systems.sort((a, b) => a.system.order - b.system.order || a.index - b.index);
  };
  for (const s of opts.systems ?? []) addSystem(s);

  const sim: Simulation = {
    world,
    rng: world.rng,
    events: opts.events,
    addSystem,
    removeSystem(name) {
      const at = systems.findIndex((s) => s.system.name === name);
      if (at >= 0) systems.splice(at, 1);
    },
    get tick() { return world.tick; },
    step(input) {
      const tick = world.tick;
      const ctx = { dt: SIM_DT, tick, rng: world.rng, events: opts.events, vars: opts.vars, input: input ?? EMPTY(tick) };
      for (const { system } of systems) {
        try {
          system.update(world, ctx);
        } catch (e) {
          throw new Error(`simulation: system "${system.name}" failed at tick ${tick}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      world.advanceTick();
    },
    advance(elapsedMs, inputFor, maxTicksPerCall = 8) {
      accumulatorMs += elapsedMs;
      let ran = 0;
      while (accumulatorMs >= dtMs - 1e-9 && ran < maxTicksPerCall) {
        sim.step(inputFor(world.tick));
        accumulatorMs -= dtMs;
        ran++;
      }
      // A long stall must not make the next frame run hundreds of ticks (spiral of death): drop what we could not run.
      if (accumulatorMs >= dtMs - 1e-9) accumulatorMs = 0;
      return Math.min(Math.max(accumulatorMs / dtMs, 0), 0.999999);
    },
  };
  return sim;
}

/** Records a session: feed it each input frame after stepping, with the world. */
export function createRecorder(seed: number, bundleHash: string, checkpointEvery = 120) {
  const inputs: InputFrame[] = [];
  const checkpoints: { tick: number; hash: string }[] = [];
  return {
    record(frame: InputFrame, world: World): void {
      inputs.push(frame);
      if (checkpointEvery > 0 && world.tick % checkpointEvery === 0) checkpoints.push({ tick: world.tick, hash: world.hash() });
    },
    finish(world: World): Replay {
      return { seed, bundleHash, ticks: inputs.length, inputs, finalHash: world.hash(), checkpoints };
    },
  };
}

/** Plays a replay on a fresh simulation and reports where (at which checkpoint) it first differs. */
export function runReplay(replay: Replay, build: (seed: number) => Simulation) {
  const sim = build(replay.seed);
  const expected = new Map((replay.checkpoints ?? []).map((c) => [c.tick, c.hash]));
  let firstMismatchTick: number | null = null;
  for (const frame of replay.inputs) {
    sim.step(frame);
    const want = expected.get(sim.tick);
    if (want !== undefined && firstMismatchTick === null && sim.world.hash() !== want) firstMismatchTick = sim.tick;
  }
  const finalHash = sim.world.hash();
  const matches = finalHash === replay.finalHash && firstMismatchTick === null;
  if (!matches && firstMismatchTick === null) firstMismatchTick = replay.ticks;
  return { finalHash, matches, firstMismatchTick };
}
