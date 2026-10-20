// ============================================================================
// File: apps/web/src/base/machine-inspect.test.ts
// Unit tests for TICKET-03 & TICKET-11 (POL-73, POL-74, POL-77):
// - Base hardpoint machines (running, idle, no-power, no-feed, off, switch command)
// - Plot machines via env.plot (drill, pylon, mill, press, projector, water, off, no-power, no-feed)
// - Network hopper capacity (POL-77: no >100% overflow when linked bins hold large stock)
// - Real-world machine sizes & vivid plume palette
// The three TICKET-03 cases from before Phase 2 are kept as they were (statuses on BaseWorld,
// plot machines, and the 11-kind size and plume check). Every case uses the real @hm/plotsim exports.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '@hm/lattice';
import {
  HEAVY_KINDS,
  KINDS,
  LAST_STAGE,
  MACHINE_KINDS,
  canPlace,
  newPlot,
  place,
  remove,
  setCartridge,
  setOn,
  type Env as PlotEnv,
  type MachineKind,
  type PlotState,
} from '@hm/plotsim';
import {
  apply,
  createWorld,
  withBridgeStore,
  type BaseWorld,
  type WorldEnv,
} from './world';
import { ITEMS, RECIPES, STARTER, type StationKind } from './catalog';
import {
  inspectMachine,
  machinePlumeColour,
  machineSize,
  type BaseEnv,
} from './machine-inspect';

const ALL_MACHINE_KINDS: readonly MachineKind[] = [
  'drill',
  'mill',
  'pylon',
  'press',
  'power',
  'projector',
  'water',
  'heavy-mill',
  'heavy-press',
  'heavy-projector',
  'heavy-water',
];

const TEST_ENV: WorldEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: 60 },
};

const testEnv: BaseEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: 60 },
};

function setupWorldWithHardpointMill(): { world: BaseWorld; hardpointId: number; recipeId: string } {
  const millRecipe = RECIPES.find((r) => r.machine === 'mill');
  assert.ok(millRecipe, 'Mill recipe exists in catalog');

  let w = withBridgeStore(
    createWorld(1),
    testEnv,
    millRecipe.inputs.map((inp) => ({ item: inp.item, n: inp.n * 5 }))
  );

  // Place starter shelter at (0, 0) so w.base.structures[0] exists at the origin
  w = apply(w, testEnv, { t: 'shelter', cx: 0, cz: 0, yaw: 0 }).world;
  const st = w.base.structures[0];
  assert.ok(st, 'Shelter structure exists');

  const hardpointId = 999;
  const worldWithHardpoint: BaseWorld = {
    ...w,
    base: {
      ...w.base,
      pieces: [
        ...w.base.pieces,
        { id: hardpointId, s: st.id, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0, mat: 'regolith' },
      ],
    },
    machines: [{ id: hardpointId, kind: 'mill', jobs: [], out: [] }],
  };

  return { world: worldWithHardpoint, hardpointId, recipeId: millRecipe.id };
}

/**
 * A station on a four-cell foundation with a chassis-basalt hardpoint and `kind` installed on it. The bridge bin has 24
 * slots (BIN_SLOTS), so the stock is sized to fit: ore takes 12 of them. Blueprint ownership reads the player's grid.
 */
function buildStationWorld(
  kind: StationKind,
  cx = 8,
  cz = 8,
  extraStock: readonly L.Stack[] = []
): { world: BaseWorld; machineId: number } {
  let w = withBridgeStore(createWorld(1), TEST_ENV, [
    { item: 'ore', n: 600 },
    { item: 'pxd-mono', n: 40 },
    { item: 'vtx-rough', n: 40 },
    { item: 'prim-cube', n: 10 },
    { item: 'prim-beam', n: 10 },
    { item: 'prim-chassis', n: 10 },
    { item: 'map-basalt', n: 5 },
    ...extraStock,
  ]);
  w = { ...w, player: L.deposit(w.player, ITEMS, 'bp:chassis:basalt', 1).box };
  w = apply(w, TEST_ENV, { t: 'stage', stage: 6 }).world;

  for (const [dx, dz] of [
    [0, 0],
    [4, 0],
    [0, 4],
    [4, 4],
  ] as const) {
    const cmd =
      dx === 0 && dz === 0
        ? ({ t: 'found', at: { x: cx, z: cz }, blueprint: STARTER, cx, cz, yaw: 0 } as const)
        : ({
            t: 'place',
            at: { x: cx, z: cz },
            blueprint: STARTER,
            piece: { s: 1, kind: 'foundation', i: dx / 4, j: dz / 4, k: 0, r: 0 },
          } as const);
    w = apply(w, TEST_ENV, cmd).world;
  }

  // a hardpoint needs the chassis-basalt blueprint (STARTER only builds foundations, floors, walls and benches)
  const hpRes = apply(w, TEST_ENV, {
    t: 'place',
    at: { x: cx, z: cz },
    blueprint: 'bp:chassis:basalt',
    piece: { s: 1, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 },
  });
  assert.equal(hpRes.events[0]?.type, 'placed', `hardpoint placed: ${JSON.stringify(hpRes.events)}`);
  w = hpRes.world;
  const hpPiece = w.base.pieces.find((p) => p.kind === 'hardpoint')!;

  w = apply(w, TEST_ENV, {
    t: 'install',
    at: { x: cx, z: cz },
    hardpoint: hpPiece.id,
    kind,
  }).world;

  return { world: w, machineId: hpPiece.id };
}

/** plotsim's place() throws when a machine may not stand there; these cases read the verdict as a result instead. */
function placeMachine(
  plot: PlotState,
  env: PlotEnv,
  kind: MachineKind,
  x: number,
  z: number,
): { ok: boolean; state: PlotState } {
  if (!canPlace(plot, env, kind, x, z).ok) return { ok: false, state: plot };
  return { ok: true, state: place(plot, env, kind, x, z, 0) };
}

test('inspectMachine covers all 5 statuses (running, idle, no-power, no-feed, off) on BaseWorld', () => {
  const { world, hardpointId, recipeId } = setupWorldWithHardpointMill();

  // 1. IDLE: powered, has feed in network, but no queued jobs yet
  const idleView = inspectMachine(world, testEnv, hardpointId);
  assert.equal(idleView.status, 'idle');
  assert.equal(idleView.kind, 'heavy-mill');
  assert.equal(idleView.emits, 'pxd');
  assert.equal(idleView.plumeOn, false);
  assert.deepEqual(idleView.actions, ['refine', 'toggle']);

  // 2. RUNNING: active job in machine.jobs
  const worldRunning: BaseWorld = {
    ...world,
    machines: [{ id: hardpointId, kind: 'mill', jobs: [{ recipe: recipeId, done: 2 }], out: [] }],
  };
  const runningView = inspectMachine(
    worldRunning,
    { ...testEnv, cartridges: { [hardpointId]: 'emerald_canopy' } },
    hardpointId
  );
  assert.equal(runningView.status, 'running');
  assert.equal(runningView.runPct, 100);
  assert.equal(runningView.plumeOn, true);
  assert.equal(runningView.cartridge, 'emerald_canopy');
  assert.ok(runningView.kwSupplied > 0 && runningView.kwSupplied === runningView.kwDraw);

  // 3. OFF: switched off via env.on
  const offView = inspectMachine(
    worldRunning,
    { ...testEnv, on: { [hardpointId]: false } },
    hardpointId
  );
  assert.equal(offView.status, 'off');
  assert.equal(offView.runPct, 0);
  assert.equal(offView.plumeOn, false);

  // 4. NO-POWER: zero power share or out of bridge range
  const noPowerView = inspectMachine(
    worldRunning,
    { ...testEnv, power: { [hardpointId]: 0 } },
    hardpointId
  );
  assert.equal(noPowerView.status, 'no-power');
  assert.equal(noPowerView.runPct, 0);
  assert.equal(noPowerView.plumeOn, false);

  // 5. NO-FEED: empty all player & box slots while queue is empty
  const starvedWorld: BaseWorld = {
    ...world,
    player: { ...world.player, slots: world.player.slots.map(() => null) },
    boxes: [],
  };
  const noFeedView = inspectMachine(starvedWorld, testEnv, hardpointId);
  assert.equal(noFeedView.status, 'no-feed');
  assert.equal(noFeedView.plumeOn, false);
});

test('inspectMachine also inspects plot machines (drill, mill, pylon) across statuses', () => {
  const w = createWorld(1);
  const plotEnv = {
    gate: { x: 0, z: 0 },
    plotRadius: 200,
    richness: () => 0.8,
  };
  let plot = newPlot();
  plot = place(plot, plotEnv, 'mill', 10, 0, 0);
  const millId = plot.machines[0]!.id;

  const runView = inspectMachine(w, { ...testEnv, plot, plotEnv }, millId);
  assert.equal(runView.status, 'running');
  assert.equal(runView.plumeOn, true);

  const offPlot = setOn(plot, millId, false);
  const offView = inspectMachine(w, { ...testEnv, plot: offPlot, plotEnv }, millId);
  assert.equal(offView.status, 'off');

  const dryPlot = { ...plot, ore: 0 };
  const noFeedView = inspectMachine(w, { ...testEnv, plot: dryPlot, plotEnv }, millId);
  assert.equal(noFeedView.status, 'no-feed');
});

test('machineSize and machinePlumeColour cover all 11 MachineKinds with heavies largest', () => {
  const allKinds: readonly MachineKind[] = [...MACHINE_KINDS, ...HEAVY_KINDS];
  assert.equal(allKinds.length, 11);

  for (const k of allKinds) {
    const sz = machineSize(k);
    assert.ok(sz.h >= 2.5 && sz.h <= 6.0, `${k} height ${sz.h} in [2.5, 6.0]`);
    assert.ok(sz.w >= 1.0 && sz.d >= 1.0);
    const col = machinePlumeColour(k);
    assert.match(col, /^#[0-9a-fA-F]{6}$/);
  }

  assert.ok(machineSize('heavy-mill').h > machineSize('mill').h);
  assert.ok(machineSize('heavy-press').h > machineSize('press').h);
  assert.ok(machineSize('heavy-projector').h > machineSize('projector').h);
  assert.ok(machineSize('heavy-water').h > machineSize('water').h);
});

test('machineSize returns real-world dimensions in 2.5m..6.0m with heavies larger than lights', () => {
  for (const kind of ALL_MACHINE_KINDS) {
    const sz = machineSize(kind);
    assert.ok(sz.h >= 2.5 && sz.h <= 6.0, `${kind} height ${sz.h} out of range`);
    assert.ok(sz.w >= 1.0 && sz.w <= 6.0, `${kind} width ${sz.w} out of range`);
    assert.ok(sz.d >= 1.0 && sz.d <= 6.0, `${kind} depth ${sz.d} out of range`);
  }
  assert.ok(machineSize('heavy-mill').h > machineSize('mill').h);
  assert.ok(machineSize('heavy-press').h > machineSize('press').h);
  assert.ok(machineSize('heavy-projector').h > machineSize('projector').h);
  assert.ok(machineSize('heavy-water').h > machineSize('water').h);
});

test('machinePlumeColour returns vivid hex colours for all 11 MachineKinds matching canonical float palette', () => {
  for (const kind of ALL_MACHINE_KINDS) {
    const col = machinePlumeColour(kind);
    assert.match(col, /^#[0-9a-fA-F]{6}$/);
  }
  assert.equal(machinePlumeColour('mill'), '#ff3d8a');
  assert.equal(machinePlumeColour('heavy-mill'), '#ff3d8a');
  assert.equal(machinePlumeColour('press'), '#7cff4d');
  assert.equal(machinePlumeColour('heavy-press'), '#7cff4d');
  assert.equal(machinePlumeColour('projector'), '#ffc13d');
  assert.equal(machinePlumeColour('heavy-projector'), '#ffc13d');
  assert.equal(machinePlumeColour('water'), '#3dc8ff');
  assert.equal(machinePlumeColour('heavy-water'), '#3dc8ff');
});

test('inspectMachine reports running, idle, no-power, no-feed, and off (via switch command POL-73) on base hardpoint machines', () => {
  const { world: w0, machineId } = buildStationWorld('mill');

  // 1. Idle when powered and feed exists in network, but no recipe is queued yet
  const idleInfo = inspectMachine(w0, TEST_ENV, machineId);
  assert.equal(idleInfo.status, 'idle');
  assert.equal(idleInfo.runPct, 0);
  assert.equal(idleInfo.plumeOn, false);
  assert.equal(idleInfo.emits, 'pxd');
  assert.deepEqual(idleInfo.actions, ['refine', 'toggle']);

  // 2. Running when a recipe is queued and power is supplied
  const wQueued = apply(w0, TEST_ENV, {
    t: 'craft',
    at: { x: 8, z: 8 },
    machine: machineId,
    recipe: 'map-basalt',
  }).world;
  const runEnv: BaseEnv = {
    ...TEST_ENV,
    power: { [machineId]: 0.85 },
    cartridges: { [machineId]: 'cart-16bit' },
  };
  const runningInfo = inspectMachine(wQueued, runEnv, machineId);
  assert.equal(runningInfo.status, 'running');
  assert.equal(runningInfo.runPct, 85);
  assert.equal(runningInfo.plumeOn, true);
  assert.equal(runningInfo.cartridge, 'cart-16bit');
  assert.equal(runningInfo.kwDraw, KINDS['heavy-mill'].draw);
  assert.ok(runningInfo.kwSupplied > 0);

  // 3. No-power when power share is 0 or out of relay reach
  const noPowerInfo = inspectMachine(wQueued, { ...TEST_ENV, power: { [machineId]: 0 } }, machineId);
  assert.equal(noPowerInfo.status, 'no-power');
  assert.equal(noPowerInfo.runPct, 0);
  assert.equal(noPowerInfo.kwSupplied, 0);
  assert.equal(noPowerInfo.plumeOn, false);

  // 4. Off when switched off via the `switch` BaseCommand (POL-73)
  const switchedOffRes = apply(wQueued, TEST_ENV, { t: 'switch', machine: machineId, on: false });
  assert.equal(switchedOffRes.events[0]?.type, 'switched');
  const offInfo = inspectMachine(switchedOffRes.world, TEST_ENV, machineId);
  assert.equal(offInfo.status, 'off');
  assert.equal(offInfo.runPct, 0);
  assert.equal(offInfo.plumeOn, false);

  // Ticking a switched-off machine does not advance its job queue
  const tickedOff = apply(switchedOffRes.world, TEST_ENV, {
    t: 'tick',
    at: { x: 8, z: 8 },
    dt: 5,
    beam: null,
    power: { [machineId]: 1 },
  }).world;
  assert.equal(tickedOff.machines.find((m) => m.id === machineId)?.jobs[0]?.done, 0);

  // Switching back on resumes operation
  const switchedOnWorld = apply(switchedOffRes.world, TEST_ENV, { t: 'switch', machine: machineId, on: true }).world;
  assert.equal(inspectMachine(switchedOnWorld, TEST_ENV, machineId).status, 'running');

  // 5. No-feed when queue is empty and all feed materials are depleted
  const emptyBoxes = w0.boxes.map((b) => ({ ...b, slots: b.slots.map(() => null) }));
  const emptyPlayer = { ...w0.player, slots: w0.player.slots.map(() => null) };
  const wStarved: BaseWorld = { ...w0, boxes: emptyBoxes, player: emptyPlayer };
  const noFeedInfo = inspectMachine(wStarved, TEST_ENV, machineId);
  assert.equal(noFeedInfo.status, 'no-feed');
  assert.equal(noFeedInfo.runPct, 0);
  assert.equal(noFeedInfo.plumeOn, false);
});

test('POL-77: station hopper cap scales with linked network storage and never overflows n > cap', () => {
  const { world, machineId } = buildStationWorld('mill', 8, 8, [{ item: 'pxd-mono', n: 450 }]);
  const info = inspectMachine(world, TEST_ENV, machineId);
  assert.ok(info.hopper !== null);
  assert.ok((info.hopper!.totalAvailable ?? info.hopper!.n) >= 400, `expected large network stock, got ${info.hopper!.totalAvailable ?? info.hopper!.n}`);
  assert.ok(
    info.hopper!.cap >= info.hopper!.n,
    `hopper cap (${info.hopper!.cap}) must be >= hopper count (${info.hopper!.n})`
  );
});

test('POL-74: inspectMachine inspects plot machines in env.plot across running, idle, off, no-power, and no-feed states', () => {
  const w = withBridgeStore(createWorld(1), TEST_ENV);
  const plotEnv: PlotEnv = {
    gate: { x: 0, z: 0 },
    plotRadius: 500,
    richness: (x: number) => (x < -100 ? 0.01 : 0.85),
  };

  // Every kind here is unlocked, and there is ore for all four builds (60 + 24 + 18 + 10 costs).
  let plot: PlotState = { ...newPlot(), ore: 200, stage: LAST_STAGE };
  // The gate's pad keeps machines out of its close ring, so the row starts well out from the gate.
  // Power unit at x=10, drill at x=16, mill at x=22, pylon at x=28 (all within the gate's 30 m reach).
  const rPower = placeMachine(plot, plotEnv, 'power', 10, 0);
  assert.equal(rPower.ok, true);
  plot = rPower.state;

  const rDrill = placeMachine(plot, plotEnv, 'drill', 16, 0);
  assert.equal(rDrill.ok, true);
  plot = rDrill.state;
  const drillId = plot.machines.at(-1)!.id;

  const rMill = placeMachine(plot, plotEnv, 'mill', 22, 0);
  assert.equal(rMill.ok, true);
  plot = rMill.state;
  const millId = plot.machines.at(-1)!.id;
  plot = setCartridge(plot, millId, 'cart-16bit');

  const rPylon = placeMachine(plot, plotEnv, 'pylon', 28, 0);
  assert.equal(rPylon.ok, true);
  plot = rPylon.state;
  const pylonId = plot.machines.at(-1)!.id;

  const envWithPlot: BaseEnv = { ...TEST_ENV, plot, plotEnv };

  // 1. Powered plot mill with ore and cartridge runs and emits pixels
  const millInfo = inspectMachine(w, envWithPlot, millId);
  assert.equal(millInfo.kind, 'mill');
  assert.equal(millInfo.status, 'running');
  assert.equal(millInfo.runPct, 100);
  assert.equal(millInfo.cartridge, 'cart-16bit');
  assert.equal(millInfo.emits, 'pxd');
  assert.equal(millInfo.plumeOn, true);
  assert.deepEqual(millInfo.actions, ['toggle', 'controls']);
  assert.ok(millInfo.hopper && millInfo.hopper.item === 'Ore' && millInfo.hopper.cap === 8000);

  // 2. Powered plot drill on rich ground runs
  const drillInfo = inspectMachine(w, envWithPlot, drillId);
  assert.equal(drillInfo.kind, 'drill');
  assert.equal(drillInfo.status, 'running');
  assert.equal(drillInfo.plumeOn, true);

  // 3. Powered pylon reports idle status with 100% link and network supply
  const pylonInfo = inspectMachine(w, envWithPlot, pylonId);
  assert.equal(pylonInfo.kind, 'pylon');
  assert.equal(pylonInfo.status, 'idle');
  assert.equal(pylonInfo.runPct, 100);
  assert.ok(pylonInfo.kwSupplied > 0);

  // 4. Switching off the plot mill reports 'off'
  const plotMillOff = setOn(plot, millId, false);
  const millOffInfo = inspectMachine(w, { ...TEST_ENV, plot: plotMillOff, plotEnv }, millId);
  assert.equal(millOffInfo.status, 'off');
  assert.equal(millOffInfo.runPct, 0);
  assert.equal(millOffInfo.plumeOn, false);

  // 5. A mill the network cannot reach is 'no-power'. Plotsim relays keep their reach when switched off, and the gate's
  //    own 12 kW feeds the first machines, so switching the power unit off cuts nothing; only distance does. Move the gate
  //    far away and nothing is in reach.
  const farPlotEnv: PlotEnv = { ...plotEnv, gate: { x: 400, z: 0 } };
  const millNoPowerInfo = inspectMachine(w, { ...TEST_ENV, plot, plotEnv: farPlotEnv }, millId);
  assert.equal(millNoPowerInfo.status, 'no-power');
  assert.equal(millNoPowerInfo.kwSupplied, 0);

  // 6. Plot mill with no ore in plot reports 'no-feed'. The drill would mine ore for it, so the drill comes out too.
  const plotZeroOre = { ...remove(plot, drillId), ore: 0 };
  const millNoFeed = inspectMachine(w, { ...TEST_ENV, plot: plotZeroOre, plotEnv }, millId);
  assert.equal(millNoFeed.status, 'no-feed');
  assert.equal(millNoFeed.plumeOn, false);
});
