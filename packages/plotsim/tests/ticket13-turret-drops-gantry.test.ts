// ============================================================================
// TICKET-13 (T13a) unit suite, plotsim side:
//  a) turret-brain.ts: sappers before swarmers within 35 m, 25 m Gate and 15 m Pylon domes, solids and the player block
//     the line of fire, brownout slows the rate of fire, the emitter follows the gun's pose, the measured sockets;
//  b) peaceful drops: every real monster drop (leaksim's table, via the monsters' item mapping) has a seal reward and a
//     Lab combiner recipe; a control with one recipe removed fails;
//  c) vehicle-bay.ts: the 3 s gantry timeline, the Scout 1 and Hauler 3 rear sockets, the 8 m hardpoint check;
//  d) the scatter sidearm, Ruling 06 (the blue-sky push, in plotsim's stage rule) and the turret's 2 kW on the gate.
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
  gunPointToMount,
} from '../src/turret-brain';
import { verifyPeacefulDropParity } from '../src/peaceful-drops';
import { evaluateHeavyProjectorBlueSkyPush, BLUE_SKY_STAGE_FLOOR } from '../src/blue-sky';
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
import { newPlot, place, network, running, step, KINDS, type Env, type PlotState } from '../src/index';
import { PEACEFUL_COMBINER_RECIPES } from '../../cartlab/src/index';
import { ARCHETYPES } from '../../leaksim/src/index';
import { CORE_ITEM, DORMANT_REWARD, killDrop, PIXEL_ITEM, SEAL_REWARD, VERTEX_ITEM } from '../../../apps/web/src/monsters/policy';
import {
  evaluateHeavyProjectorBlueSkyPush as hooksBlueSky,
  POL51_ROVER_DRIVE_TEST_PLAN,
  SCATTER_SIDEARM_PRESET,
} from '../../../apps/web/src/play/window-c-hooks';
import { weaponStats } from '../../../apps/web/src/base/weapons';

test('a) turret-brain: sappers before swarmers within 35 m, the 25 m Gate and 15 m Pylon domes, solids, the player, brownout', () => {
  assert.equal(TURRET_POWER_DRAW_KW, 2.0);
  assert.equal(TURRET_RANGE_M, 35.0);
  assert.equal(GATE_SAFE_DOME_RADIUS_M, 25.0);
  assert.equal(PYLON_SAFE_DOME_RADIUS_M, 15.0);

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
      { id: 11, kind: 'sapper', x: 45, z: 0, hp: 35 }, // inside 15 m Pylon dome
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

  // 5. Unpowered: still, no laser, no draw
  const dark = stepTurretBrain({
    turret: { x: 40, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 0,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    mobs: [{ id: 40, kind: 'swarmer', x: 55, z: 0, hp: 20 }],
  });
  assert.equal(dark.laserActive, false);
  assert.equal(dark.fired, false);
  assert.equal(dark.powerDrawKw, 0);
});

test('a) turret-brain: the measured sockets, and the emitter follows the gun pose', () => {
  const C = TURRET_SOCKET_CONSTANTS;
  assert.equal(C.YAW_AXIS_HEIGHT_M, 0.672);
  assert.equal(C.TRUNNION_HEIGHT_ON_YOKE_M, 0.639);
  assert.equal(C.TOTAL_TRUNNION_HEIGHT_M, 1.311);
  assert.equal(Number((C.YAW_AXIS_HEIGHT_M + C.TRUNNION_HEIGHT_ON_YOKE_M).toFixed(3)), C.TOTAL_TRUNNION_HEIGHT_M);
  assert.deepEqual([...C.GUN_MESH_OFFSET_FROM_PIVOT_M], [0, -0.241, -0.091]);
  assert.deepEqual([...C.BARREL_COLLAR_OFFSET_M], [0, 0.059, 0.359]);
  assert.deepEqual([...C.LASER_EMITTER_OFFSET_M], [0, -0.101, 0.359]);
  assert.deepEqual([...C.MUZZLE_TIP_OFFSET_M], [0, 0.059, 1.039]);
  assert.equal(C.BARREL_CYLINDER_RADIUS_M, 0.045);

  // a target due east (+x): the yoke yaws a quarter turn, so the emitter's +z offset moves onto +x
  const east = stepTurretBrain({
    turret: { x: 0, y: 0, z: 0, cooldownLeftS: 0 },
    satisfaction0to1: 1,
    dt: 0.016,
    gateDome: { x: 0, z: 0, r: 25 },
    mobs: [{ id: 1, kind: 'swarmer', x: 30, z: 0, hp: 20 }],
  });
  assert.ok(Math.abs(east.yaw - Math.PI / 2) < 1e-3);
  // level gun: the +z offset turns onto +x, the emitter sits 0.359 m out in the aim direction
  const level = gunPointToMount(C.LASER_EMITTER_OFFSET_M, Math.PI / 2, 0);
  assert.ok(Math.abs(level.x - 0.359) < 1e-3, `level emitter x ${level.x}`);
  assert.ok(Math.abs(level.z) < 1e-3, `level emitter z ${level.z}`);
  assert.ok(Math.abs(level.y - -0.101) < 1e-3);
  // the pitched gun (aimed down at the mob's centre) moves the emitter by the same rotation
  const pitched = gunPointToMount(C.LASER_EMITTER_OFFSET_M, east.yaw, east.pitch);
  assert.ok(Math.abs(east.laserFrom.x - pitched.x) < 1e-3, `emitter x ${east.laserFrom.x}`);
  assert.ok(Math.abs(east.laserFrom.z - pitched.z) < 1e-3, `emitter z ${east.laserFrom.z}`);
  assert.ok(Math.abs(east.laserFrom.y - (C.TOTAL_TRUNNION_HEIGHT_M + pitched.y)) < 1e-3);

  // whatever the pose, the emitter is the pivot plus the rotated offset
  const north = stepTurretBrain({
    turret: { x: 5, y: 2, z: -3, cooldownLeftS: 0 },
    satisfaction0to1: 1,
    dt: 0.016,
    gateDome: { x: -100, z: 0, r: 25 },
    mobs: [{ id: 2, kind: 'sapper', x: 9, z: 20, y: 0, hp: 35 }],
  });
  const p = gunPointToMount(C.LASER_EMITTER_OFFSET_M, north.yaw, north.pitch);
  assert.ok(Math.abs(north.laserFrom.x - (5 + p.x)) < 1e-3);
  assert.ok(Math.abs(north.laserFrom.y - (2 + C.TOTAL_TRUNNION_HEIGHT_M + p.y)) < 1e-3);
  assert.ok(Math.abs(north.laserFrom.z - (-3 + p.z)) < 1e-3);
});

test('b) peaceful drops: every real monster drop has a seal reward and a combiner recipe (leaksim table, not our own list)', () => {
  // leaksim's real drop table, mapped to items the way the monsters do it (killDrop = policy.ts over ARCHETYPES)
  const drops = new Set<string>();
  for (const kind of Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[]) drops.add(killDrop(kind).item);
  assert.deepEqual([...drops].sort(), [PIXEL_ITEM, VERTEX_ITEM].sort(), 'leaksim drops pixels and vertices only');
  drops.add(CORE_ITEM); // the dormant anomaly's core: a core a monster can carry is a drop too (Rule 23)

  const sources = {
    seal: [...SEAL_REWARD, ...DORMANT_REWARD].map((r) => r.item),
    combiner: PEACEFUL_COMBINER_RECIPES.map((r) => r.output.item),
  };
  const parity = verifyPeacefulDropParity([...drops], sources);
  assert.equal(parity.ok, true, `missing: seal ${parity.withoutSeal.join(',')} combiner ${parity.withoutCombiner.join(',')}`);
  assert.deepEqual(parity.withoutSeal, []);
  assert.deepEqual(parity.withoutCombiner, []);

  // control: take the vertex recipe away and the check must fail on exactly that item
  const broken = verifyPeacefulDropParity([...drops], {
    seal: sources.seal,
    combiner: sources.combiner.filter((item) => item !== VERTEX_ITEM),
  });
  assert.equal(broken.ok, false);
  assert.deepEqual(broken.withoutCombiner, [VERTEX_ITEM]);
  assert.deepEqual(broken.withoutSeal, []);
});

test('c) vehicle-bay: the 3 s gantry, the Scout 1 and Hauler 3 rear sockets, and the 8 m heavy hardpoint', () => {
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
  const scoutLoadout = createVehicleLoadout('scout');
  assert.equal(scoutLoadout.slots.length, SCOUT_REAR_SOCKET_COUNT);
  assert.equal(attachVehicleSocketModule(scoutLoadout, 0, 'perimeter-turret').ok, false);
  const scoutBeacon = attachVehicleSocketModule(scoutLoadout, 0, 'sync-beacon');
  assert.equal(scoutBeacon.ok, true);
  assert.equal(evaluateVehicleSocketEffects(scoutBeacon.state).safeDomeRadiusM, 15.0);

  // Hauler 3 rear sockets: bulk ore, a linked bin and a turret
  let haulerLoadout = createVehicleLoadout('hauler');
  assert.equal(haulerLoadout.slots.length, HAULER_REAR_SOCKET_COUNT);
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 0, 'bulk-ore-pod').state;
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 1, 'linked-ore-bin').state;
  haulerLoadout = attachVehicleSocketModule(haulerLoadout, 2, 'perimeter-turret').state;
  const hFx = evaluateVehicleSocketEffects(haulerLoadout);
  assert.equal(hFx.extraOreCapacity, 800);
  assert.equal(hFx.linkedBridgeBinActive, true);
  assert.equal(hFx.mountedTurretCount, 1);

  // heavy terraformers need an 8 m hardpoint and, for the press, water and mill, a linked bin feed
  assert.equal(
    canOperateHeavyTerraformer({ kind: 'heavy-press', onSnapped2x2Hardpoint: false, hardpointWidthM: 4, hasLinkedBinFeed: true, availableOreInBin: 100 }).canPlace,
    false,
  );
  const heavyProj = canOperateHeavyTerraformer({ kind: 'heavy-projector', onSnapped2x2Hardpoint: true, hardpointWidthM: 8, hasLinkedBinFeed: false, availableOreInBin: 0 });
  assert.equal(heavyProj.canRun, true);
  assert.equal(heavyProj.hasFeedHopper, false);
  assert.equal(heavyProj.livePlumeCount, 200);
  assert.equal(heavyProj.triggersBlueSkyWave, true);
  assert.equal(USE_MODULAR_SCOUT, true);
  assert.equal(snapAerialToShellY(1.4), Number((1.4 - MODULAR_SCOUT_SOCKETS.aerialEmbedDepthM).toFixed(4)));
  assert.ok(VEHICLE_FIT.hauler.lengthM > VEHICLE_FIT.scout.lengthM);
});

test('d) the scatter sidearm forges from the packed parts; Ruling 06 pushes the stage once; the turret draws on the gate', () => {
  assert.deepEqual(SCATTER_SIDEARM_PRESET.parts, { frame: 'wpn-frame', core: 'core-burst', barrel: 'barrel-scatter' });
  const stats = weaponStats(SCATTER_SIDEARM_PRESET.loadout);
  assert.ok(stats, 'the scatter loadout fires');
  assert.equal(stats.pellets, 7);
  assert.equal(stats.mode, 'burst');

  // the blue-sky rule: once, on the first running projector, to at least stage 4
  const first = evaluateHeavyProjectorBlueSkyPush({ heavyProjectorsRunning: 1, hadHeavyProjectorBefore: false, currentStage: 2, projectorPos: { x: 14, z: -18 } });
  assert.equal(first.shouldTriggerBlueSkyWave, true);
  assert.equal(first.targetStage, BLUE_SKY_STAGE_FLOOR);
  assert.equal(hooksBlueSky({ heavyProjectorsRunning: 1, hadHeavyProjectorBefore: true, currentStage: 2, projectorPos: { x: 0, z: 0 } }).shouldTriggerBlueSkyWave, false);
  assert.equal(POL51_ROVER_DRIVE_TEST_PLAN.length, 3);

  const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.5 };
  const withProjector: PlotState = { ...place({ ...newPlot(), stage: 2, ore: 500 }, env, 'heavy-projector', 12, 0, 0) };
  const pushed = step(withProjector, env, 1);
  assert.equal(pushed.state.stage, BLUE_SKY_STAGE_FLOOR, 'the first running projector pushes the plot to stage 4');
  assert.equal(pushed.state.blueSky, true);
  assert.equal(pushed.events.filter((e) => e.type === 'stage-up' && e.stage === BLUE_SKY_STAGE_FLOOR).length, 1);
  const again = step(pushed.state, env, 1);
  assert.equal(again.events.filter((e) => e.type === 'stage-up').length, 0, 'the push fires once');

  // the turret's 2 kW counts against the gate: the same plot, with four turrets' draw, is more short of power
  const alone = network(withProjector, env);
  const turrets = network(withProjector, { ...env, extraDrawKw: () => 4 * TURRET_POWER_DRAW_KW });
  assert.equal(turrets.demand, alone.demand + 4 * TURRET_POWER_DRAW_KW);
  assert.ok(turrets.satisfaction < alone.satisfaction);
  const projector = withProjector.machines.find((m) => m.kind === 'heavy-projector')!;
  assert.ok((running(withProjector, env).get(projector.id) ?? 0) > 0);
  assert.equal(KINDS['heavy-projector'].draw, 32);
});
