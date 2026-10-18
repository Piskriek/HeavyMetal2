// ============================================================================
// File: apps/web/src/base/machine-inspect.test.ts
// Unit tests for TICKET-03 & TICKET-11 (POL-73, POL-74, POL-77):
// - Base hardpoint machines (running, idle, no-power, no-feed, off, switch command)
// - Plot machines via env.plot (drill, pylon, mill, press, projector, water, off, no-power, no-feed)
// - Network hopper capacity (POL-77: no >100% overflow when linked bins hold large stock)
// - Real-world machine sizes & vivid plume palette
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '@hm/lattice';
import { KINDS, createPlot, placeMachine, setMachineSwitch, slotCartridge, type MachineKind } from '@hm/plotsim';
import {
  apply,
  createWorld,
  withBridgeStore,
  BRIDGE_STORE,
  type BaseWorld,
  type WorldEnv,
} from './world';
import { ITEMS, STARTER, type StationKind } from './catalog';
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

function stockBridge(w: BaseWorld, stacks: readonly L.Stack[]): BaseWorld {
  const s = L.store(w.boxes, [BRIDGE_STORE], { x: 0, z: 0 }, ITEMS, stacks);
  return { ...w, boxes: s.boxes };
}

function buildStationWorld(
  kind: StationKind,
  cx = 8,
  cz = 8,
  extraStock: readonly L.Stack[] = []
): { world: BaseWorld; machineId: number } {
  let w = withBridgeStore(createWorld(1), TEST_ENV, [
    { item: 'ore', n: 1500 },
    { item: 'pixel-mono', n: 50 },
    { item: 'pixel-32', n: 50 },
    { item: 'vertex-rough', n: 50 },
    { item: 'vertex-low', n: 50 },
    { item: 'wire-frame', n: 20 },
    { item: 'voxel-block', n: 20 },
    { item: 'shader-core', n: 20 },
    { item: 'rel-anchor', n: 10 },
    ...extraStock,
  ]);
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

  const hpRes = apply(w, TEST_ENV, {
    t: 'place',
    at: { x: cx, z: cz },
    blueprint: STARTER,
    piece: { s: 1, kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0 },
  });
  w = hpRes.world;
  const hpPiece = w.base.pieces.find((p) => p.kind === 'hardpoint')!;

  w = stockBridge(w, [
    { item: 'ore', n: 1200 },
    { item: 'pixel-mono', n: 40 },
    { item: 'vertex-rough', n: 40 },
  ]);
  w = apply(w, TEST_ENV, {
    t: 'install',
    at: { x: cx, z: cz },
    hardpoint: hpPiece.id,
    kind,
  }).world;

  return { world: w, machineId: hpPiece.id };
}

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
  assert.equal(idleInfo.emits, 'pixels');
  assert.deepEqual(idleInfo.actions, ['refine', 'toggle']);

  // 2. Running when a recipe is queued and power is supplied
  const wQueued = apply(w0, TEST_ENV, {
    t: 'craft',
    at: { x: 8, z: 8 },
    machine: machineId,
    recipe: 'pixel-32',
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
  const { world, machineId } = buildStationWorld('mill', 8, 8, [{ item: 'pixel-mono', n: 450 }]);
  const info = inspectMachine(world, TEST_ENV, machineId);
  assert.ok(info.hopper !== null);
  assert.ok(info.hopper!.n >= 400, `expected large network stock, got ${info.hopper!.n}`);
  assert.ok(
    info.hopper!.cap >= info.hopper!.n,
    `hopper cap (${info.hopper!.cap}) must be >= hopper count (${info.hopper!.n})`
  );
});

test('POL-74: inspectMachine inspects plot machines in env.plot across running, idle, off, no-power, and no-feed states', () => {
  const w = withBridgeStore(createWorld(1), TEST_ENV);
  const plotEnv = {
    gate: { x: 0, z: 0 },
    plotRadius: 500,
    richness: (x: number, z: number) => (x < -100 ? 0.01 : 0.85),
  };

  let plot = createPlot(100);
  // Place a power generator near the gate (x=4, z=0), a drill (x=8, z=0), a mill (x=12, z=0), and a pylon (x=16, z=0)
  const rPower = placeMachine(plot, plotEnv, 'power', 4, 0);
  assert.equal(rPower.ok, true);
  plot = rPower.state;
  const powerId = plot.machines.at(-1)!.id;

  const rDrill = placeMachine(plot, plotEnv, 'drill', 8, 0);
  assert.equal(rDrill.ok, true);
  plot = rDrill.state;
  const drillId = plot.machines.at(-1)!.id;

  const rMill = placeMachine(plot, plotEnv, 'mill', 12, 0);
  assert.equal(rMill.ok, true);
  plot = rMill.state;
  const millId = plot.machines.at(-1)!.id;
  plot = slotCartridge(plot, millId, 'cart-16bit');

  const rPylon = placeMachine(plot, plotEnv, 'pylon', 16, 0);
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
  assert.equal(millInfo.emits, 'pixels');
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
  const plotMillOff = setMachineSwitch(plot, millId, false);
  const millOffInfo = inspectMachine(w, { ...TEST_ENV, plot: plotMillOff, plotEnv }, millId);
  assert.equal(millOffInfo.status, 'off');
  assert.equal(millOffInfo.runPct, 0);
  assert.equal(millOffInfo.plumeOn, false);

  // 5. Switching off the power station puts the mill into 'no-power'
  const plotNoPower = setMachineSwitch(plot, powerId, false);
  const millNoPowerInfo = inspectMachine(w, { ...TEST_ENV, plot: plotNoPower, plotEnv }, millId);
  assert.equal(millNoPowerInfo.status, 'no-power');
  assert.equal(millNoPowerInfo.kwSupplied, 0);

  // 6. Plot mill with 0 ore in plot reports 'no-feed'
  const plotZeroOre = { ...plot, ore: 0 };
  const millNoFeed = inspectMachine(w, { ...TEST_ENV, plot: plotZeroOre, plotEnv }, millId);
  assert.equal(millNoFeed.status, 'no-feed');
  assert.equal(millNoFeed.plumeOn, false);
});
