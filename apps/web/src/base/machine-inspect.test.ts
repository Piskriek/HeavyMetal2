// ============================================================================
// File: apps/web/src/base/machine-inspect.test.ts
// Unit tests for inspectMachine, machineSize, and machinePlumeColour (TICKET-03).
// Tests all 5 statuses: 'running', 'idle', 'no-power', 'no-feed', 'off'.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectMachine,
  machinePlumeColour,
  machineSize,
  type BaseEnv,
} from './machine-inspect';
import { apply, createWorld, withBridgeStore, type BaseWorld } from './world';
import { RECIPES } from './catalog';
import { HEAVY_KINDS, MACHINE_KINDS, newPlot, place, setOn, type MachineKind } from '@hm/plotsim';

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

test('inspectMachine covers all 5 statuses (running, idle, no-power, no-feed, off) on BaseWorld', () => {
  const { world, hardpointId, recipeId } = setupWorldWithHardpointMill();

  // 1. IDLE: powered, has feed in network, but no queued jobs yet
  const idleView = inspectMachine(world, testEnv, hardpointId);
  assert.equal(idleView.status, 'idle');
  assert.equal(idleView.kind, 'heavy-mill');
  assert.equal(idleView.emits, 'pxd');
  assert.equal(idleView.plumeOn, false);
  assert.deepEqual(idleView.actions, ['refine']);

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
