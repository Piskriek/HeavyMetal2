// ============================================================================
// File: packages/plotsim/tests/ticket13-turret-drops-gantry.test.ts
// Purpose: node:test unit suite for TICKET-13 (Brief 32, Window C):
//  a) turret-brain.ts (sappers > swarmers within 35 m, 25 m Gate & 15 m Pylon
//     safe domes, player/solid avoidance, 2 kW draw, brownout ROF, yaw/pitch)
//  b) peaceful-drops.ts (every monster drop has a dormant seal or Combiner recipe)
//  c) vehicle-bay.ts (3 s gantry timeline, Scout 1 / Hauler 3 rear sockets,
//     8 m 2x2 hardpoint + linked bin feed check)
//  d) Scatter sidearm preset (`weapon-frame` + `core-burst` + `barrel-scatter`)
//  e/f) Ruling 06 Blue Sky push, POL-50 modular scout sockets, POL-51 & POL-76
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE_SAFE_DOME_RADIUS_M,
  PYLON_SAFE_DOME_RADIUS_M,
  stepTurretBrain,
  TURRET_BASE_ROF_HZ,
  TURRET_LASER_HEX,
  TURRET_POWER_DRAW_KW,
  TURRET_RANGE_M,
  TURRET_SOCKET_CONSTANTS,
} from '../src/turret-brain';
import {
  MONSTER_DROP_ITEMS,
  PEACEFUL_COMBINER_RECIPES,
  verifyPeacefulDropParity,
} from '../src/peaceful-drops';
import {
  attachVehicleSocketModule,
  canOperateHeavyTerraformer,
  createVehicleLoadout,
  evaluateVehicleSocketEffects,
  FABRICATOR_PLUME_HEX,
  GANTRY_PRINT_DURATION_S,
  HAULER_REAR_SOCKET_COUNT,
  MODULAR_SCOUT_SOCKETS,
  sampleGantryTimeline,
  SCOUT_REAR_SOCKET_COUNT,
  snapAerialToShellY,
  USE_MODULAR_SCOUT,
  VEHICLE_FIT,
} from '../src/vehicle-bay';
import {
  evaluateHeavyProjectorBlueSkyPush,
  GEN_MACHINE_NORMALIZED_SCALE,
  POL51_ROVER_DRIVE_TEST_PLAN,
  resolveGenMachineScale,
  SCATTER_SIDEARM_PRESET,
} from '../../../apps/web/src/play/window-c-hooks';

test('a) turret-brain selects sappers before swarmers within 35 m, respects 25 m Gate and 15 m Pylon domes, and scales with brownout', () => {
  assert.equal(TURRET_POWER_DRAW_KW, 2.0);
  assert.equal(TURRET_RANGE_M, 35.0);
  assert.equal(GATE_SAFE_DOME_RADIUS_M, 25.0);
  assert.equal(PYLON_SAFE_DOME_RADIUS_M, 15.0);
  assert.ok(TURRET_SOCKET_CONSTANTS.TOTAL_TRUNNION_HEIGHT_M > 0);

  // 1. Prioritises sapper at 28 m over closer swarmer at 14 m
  const priorityOut = stepTurretBrain({
    turret: { x: 40, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 1.0,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    mobs: [
      { id: 1, kind: 'swarmer', x: 54, z: 0, hp: 20 },
      { id: 2, kind: 'sapper', x: 68, z: 0, hp: 35 },
      { id: 3, kind: 'sapper', x: 90, z: 0, hp: 35 }, // 50 m away (> 35 m range)
    ],
  });
  assert.equal(priorityOut.targetId, 2);
  assert.equal(priorityOut.targetKind, 'sapper');
  assert.equal(priorityOut.laserActive, true);
  assert.equal(priorityOut.laserColour, TURRET_LASER_HEX);
  assert.equal(priorityOut.fired, true);
  assert.ok(Math.abs(priorityOut.yaw - Math.PI / 2) < 0.01);

  // 2. Ignores mobs inside the 25 m Gate dome or a 15 m Pylon/Beacon dome
  const domeOut = stepTurretBrain({
    turret: { x: 30, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 1.0,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    extraSafeDomes: [{ x: 50, z: 0, r: 15, kind: 'pylon' }],
    mobs: [
      { id: 10, kind: 'swarmer', x: 10, z: 0, hp: 20 }, // inside 25 m Gate dome
      { id: 11, kind: 'sapper', x: 45, z: 0, hp: 35 },  // inside 15 m Pylon dome
    ],
  });
  assert.equal(domeOut.targetId, null);
  assert.equal(domeOut.fired, false);
  assert.equal(domeOut.laserActive, false);

  // 3. Never fires through the player or a built base solid
  const blockedOut = stepTurretBrain({
    turret: { x: 40, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 1.0,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    player: { x: 50, z: 0 },
    solids: [{ minX: 39, maxX: 41, minZ: 8, maxZ: 12 }],
    mobs: [
      { id: 20, kind: 'swarmer', x: 60, z: 0, hp: 20 }, // player is on the line of fire at (50, 0)
      { id: 21, kind: 'sapper', x: 40, z: 20, hp: 35 }, // wall box at z=8..12 blocks line of fire
    ],
  });
  assert.equal(blockedOut.targetId, null);

  // 4. Scales rate of fire under brownout satisfaction (50% satisfaction -> half ROF, double cooldown)
  const brownoutOut = stepTurretBrain({
    turret: { x: 40, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 0.5,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    mobs: [{ id: 30, kind: 'swarmer', x: 55, z: 0, hp: 20 }],
  });
  assert.equal(brownoutOut.effectiveRofHz, TURRET_BASE_ROF_HZ * 0.5);
  assert.equal(brownoutOut.nextCooldownS, Number((1 / (TURRET_BASE_ROF_HZ * 0.5)).toFixed(4)));
});

test('b) peaceful-drops verifies every monster drop has a non-combat source and Combiner recipe', () => {
  const parity = verifyPeacefulDropParity(MONSTER_DROP_ITEMS);
  assert.equal(parity.ok, true);
  assert.deepEqual(parity.missingItems, []);
  assert.ok(PEACEFUL_COMBINER_RECIPES.length >= 7);
  assert.ok(parity.recipesByOutput['anomaly-core']);
});

test('c) vehicle-bay steps the 3 s gantry timeline, enforces Scout 1 / Hauler 3 rear sockets, and checks 8 m heavy hardpoints', () => {
  const t0 = sampleGantryTimeline(0.0, 'scout');
  assert.equal(t0.phase, 'idle');
  assert.equal(t0.complete, false);

  const tMid = sampleGantryTimeline(1.5, 'hauler');
  assert.equal(tMid.phase, 'suspension-and-cab');
  assert.equal(tMid.laserActive, true);
  assert.equal(tMid.plumeColour, FABRICATOR_PLUME_HEX);
  assert.ok(tMid.clipHeight0to1 > 0.4 && tMid.clipHeight0to1 < 0.9);

  const tDone = sampleGantryTimeline(GANTRY_PRINT_DURATION_S, 'hauler');
  assert.equal(tDone.phase, 'complete');
  assert.equal(tDone.complete, true);
  assert.equal(tDone.clipHeight0to1, 1.0);

  // Scout 1 rear socket: accepts linked-ore-bin or sync-beacon, rejects perimeter-turret
  let scoutLoadout = createVehicleLoadout('scout');
  assert.equal(scoutLoadout.slots.length, SCOUT_REAR_SOCKET_COUNT);
  assert.equal(attachVehicleSocketModule(scoutLoadout, 0, 'perimeter-turret').ok, false);
  const scoutBeacon = attachVehicleSocketModule(scoutLoadout, 0, 'sync-beacon');
  assert.equal(scoutBeacon.ok, true);
  assert.equal(evaluateVehicleSocketEffects(scoutBeacon.state).safeDomeRadiusM, 15.0);

  // Hauler 3 rear sockets: accepts bulk-ore-pod and perimeter-turret
  let haulerLoadout = createVehicleLoadout('hauler');
  assert.equal(haulerLoadout.slots.length, HAULER_REAR_SOCKET_COUNT);
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 0, 'bulk-ore-pod').state;
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 1, 'linked-ore-bin').state;
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 2, 'perimeter-turret').state;
  const hFx = evaluateVehicleSocketEffects(haulerLoadout);
  assert.equal(hFx.extraOreCapacity, 800);
  assert.equal(hFx.linkedBridgeBinActive, true);
  assert.equal(hFx.mountedTurretCount, 1);

  // Heavy terraformer 8 m (2x2 foundation) hardpoint & linked bin feed check
  assert.equal(
    canOperateHeavyTerraformer({
      kind: 'heavy-press',
      onSnapped2x2Hardpoint: false,
      hardpointWidthM: 4,
      hasLinkedBinFeed: true,
      availableOreInBin: 100,
    }).canPlace,
    false,
  );
  const heavyProj = canOperateHeavyTerraformer({
    kind: 'heavy-projector',
    onSnapped2x2Hardpoint: true,
    hardpointWidthM: 8,
    hasLinkedBinFeed: false,
    availableOreInBin: 0,
  });
  assert.equal(heavyProj.canRun, true);
  assert.equal(heavyProj.hasFeedHopper, false);
  assert.equal(heavyProj.livePlumeCount, 200);
  assert.equal(heavyProj.triggersBlueSkyWave, true);
});

test('d, e, f) verifies scatter sidearm preset, Ruling 06 blue-sky wave push, POL-50 scout sockets, POL-51 plan, and POL-76 scale', () => {
  assert.deepEqual(SCATTER_SIDEARM_PRESET.parts, {
    frame: 'weapon-frame',
    core: 'core-burst',
    barrel: 'barrel-scatter',
  });
  assert.equal(USE_MODULAR_SCOUT, true);
  assert.equal(snapAerialToShellY(1.4), Number((1.4 - MODULAR_SCOUT_SOCKETS.aerialEmbedDepthM).toFixed(4)));
  assert.ok(VEHICLE_FIT.hauler.lengthM > VEHICLE_FIT.scout.lengthM);

  const blueSky = evaluateHeavyProjectorBlueSkyPush({
    heavyProjectorsRunning: 1,
    hadHeavyProjectorBefore: false,
    currentStage: 2,
    projectorPos: { x: 14, z: -18 },
  });
  assert.equal(blueSky.shouldTriggerBlueSkyWave, true);
  assert.equal(blueSky.targetStage, 4);
  assert.equal(resolveGenMachineScale('heavy-press'), GEN_MACHINE_NORMALIZED_SCALE);
  assert.equal(POL51_ROVER_DRIVE_TEST_PLAN.length, 3);
});
