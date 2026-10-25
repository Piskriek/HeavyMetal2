import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_PRESETS, ALL_MACHINE_VEHICLE_KIT_IDS, GAME_MACHINE_KINDS, MultiverseGamePresetSchema,
  PRESET_CIRCUIT_RALLY as rally, PRESET_ARENA_SURVIVOR as arena, PRESET_ECO_OBSERVER as eco, PRESET_SANDBOX_BUILDER as sandbox,
  assertPlayablePreset, gameRigKit, gateSandboxPreset, resolveStandaloneGame,
} from './game-presets';
import { gameBaseWorld, gamePlayState, gameStage, gameSpawn, NEW_GAME_PROGRESS, CIRCUIT_CHECKPOINTS, CIRCUIT_LAPS, stepGameProgress, gameGoal, type GameProgress, type GameProgressInput } from './game-mode';
import { SIDEARM_ITEM_ID } from './armory-rack';
import { FRESH } from './quest';

const input: GameProgressInput = { dt: 0.1, x: 0, z: 0, livingWaveMobs: 0, visibleCreatureIds: [] };
test('the four Rung 5 presets are deep frozen JSON and bind to real existing rigs and roster IDs', () => {
  assert.equal(GAME_PRESETS.length, 4);
  for (const preset of GAME_PRESETS) {
    assert.deepEqual(MultiverseGamePresetSchema.parse(JSON.parse(JSON.stringify(preset))), preset);
    assert.deepEqual(assertPlayablePreset(preset), preset);
    assert.ok(Object.isFrozen(preset)); assert.ok(Object.isFrozen(preset.activeRules)); assert.ok(Object.isFrozen(preset.rosterOverrides));
    assert.ok(gameRigKit(preset.playerRigId));
  }
  assert.equal(rally.cameraMode, 'vehicle-chase'); assert.equal(rally.playerRigId, 'kit:scout-rover'); assert.equal(gameStage(rally), 6);
  assert.equal(arena.playerRigId, 'kit:astro-suit'); assert.equal(arena.activeRules.targetScoreOrTimeSec, 10);
  assert.equal(eco.cameraMode, 'third-person-orbit'); assert.deepEqual(eco.rosterOverrides, ['theropod', 'avian-drone']);
  assert.equal(sandbox.cameraMode, 'isometric-tactical'); assert.equal(sandbox.hudBlade, 'sandbox-freeplay');
  assert.equal(ALL_MACHINE_VEHICLE_KIT_IDS.length, 14); assert.equal(new Set(ALL_MACHINE_VEHICLE_KIT_IDS).size, 14);
  assert.deepEqual(sandbox.rosterOverrides, ALL_MACHINE_VEHICLE_KIT_IDS);
});

test('query options override exactly seed and rig without mutating a canonical preset; invalid links are refused', () => {
  const changed = resolveStandaloneGame({ gameId: 'circuit-rally', worldSeed: 0, playerRig: 'theropod' });
  assert.equal(changed.worldSeed, 0); assert.equal(changed.playerRigId, 'theropod'); assert.equal(changed.hudBlade, rally.hudBlade);
  assert.equal(rally.worldSeed, 42069); assert.equal(rally.playerRigId, 'kit:scout-rover'); assert.ok(Object.isFrozen(changed));
  for (const seed of [NaN, Infinity, -1, 1.5, 0x1_0000_0000]) assert.throws(() => resolveStandaloneGame({ gameId: 'circuit-rally', worldSeed: seed }));
  assert.throws(() => resolveStandaloneGame({ gameId: 'missing' }), /Unknown game/);
  assert.throws(() => resolveStandaloneGame({ gameId: 'arena-survivor', playerRig: 'https://attacker/rig.js' }));
  assert.throws(() => assertPlayablePreset({ ...rally, rosterOverrides: ['kit:unknown'] }), /Unknown roster/);
  assert.throws(() => assertPlayablePreset({ ...rally, stageBiomeId: 'unknown-biome' }), /Unknown stage/);
});

test('frozen schema is strict: four cameras, five HUDs, four win conditions, finite rules and 8..60 Hz', () => {
  assert.ok(Object.isFrozen(MultiverseGamePresetSchema));
  assert.equal(MultiverseGamePresetSchema.safeParse({ ...rally, activeRules: { ...rally.activeRules, stageAnimRateHz: 8 } }).success, true);
  for (const bad of [
    { ...rally, version: 2 }, { ...rally, cameraMode: 'another-renderer' }, { ...rally, hudBlade: 'custom-code' },
    { ...rally, extra: 1 }, { ...rally, activeRules: { ...rally.activeRules, stageAnimRateHz: 7.999 } },
    { ...rally, activeRules: { ...rally.activeRules, stageAnimRateHz: 60.001 } },
    { ...rally, activeRules: { ...rally.activeRules, gravityScale: NaN } },
    { ...rally, activeRules: { ...rally.activeRules, winCondition: () => true } },
  ]) assert.equal(MultiverseGamePresetSchema.safeParse(bad).success, false);
});

test('standalone initializers are pure, bypass the prologue, isolate campaign data, seed Earth, equip arena, and unlock all 14 sandbox kits', () => {
  const freshBefore = structuredClone(FRESH);
  for (const preset of GAME_PRESETS) {
    const a = gamePlayState(preset), b = gamePlayState(preset);
    assert.deepEqual(a, b); assert.equal(a.step, 'done'); assert.equal(a.gateOn, true); assert.equal(a.visited, true);
    assert.notEqual(a, FRESH); assert.notEqual(a.plot, FRESH.plot);
    assert.deepEqual(gameBaseWorld(preset), gameBaseWorld(preset));
  }
  const world = gameBaseWorld(sandbox), plot = gamePlayState(sandbox).plot;
  assert.equal(world.field.seed, sandbox.worldSeed); assert.equal(world.stage, 6); assert.equal(world.biome.world, 'moon');
  assert.equal(plot.machines.length, Object.keys(GAME_MACHINE_KINDS).length);
  assert.equal(plot.machines.length + world.vehicles.length, 14);
  assert.equal(new Set(plot.machines.map((m) => m.kind)).size, 11);
  assert.deepEqual(new Set(world.vehicles.map((v) => v.kind)), new Set(['scout', 'crawler', 'hauler']));
  assert.equal(gameBaseWorld(rally).biome.world, 'earth');
  assert.equal(gameBaseWorld(arena).equipment.sidearm?.item, SIDEARM_ITEM_ID);
  assert.equal(gameBaseWorld(eco).equipment.sidearm, null);
  assert.equal(gameStage(arena), 3); assert.equal(gameStage(sandbox), 6);
  assert.ok(Number.isFinite(gameSpawn(rally).yaw)); assert.deepEqual(FRESH, freshBefore);
});

test('circuit checkpoints are ordered, require real proximity, wrap laps, and complete after exactly three circuits', () => {
  let progress: GameProgress = NEW_GAME_PROGRESS;
  const far = stepGameProgress(rally, progress, { ...input, x: 1000, z: 1000 }).state;
  assert.equal(far.checkpoint, 0);
  for (let lap = 0; lap < CIRCUIT_LAPS; lap++) for (let i = 0; i < CIRCUIT_CHECKPOINTS.length; i++) {
    const point = CIRCUIT_CHECKPOINTS[i]!;
    progress = stepGameProgress(rally, progress, { ...input, ...point }).state;
    assert.equal(progress.checkpoint, (i + 1) % CIRCUIT_CHECKPOINTS.length);
    assert.equal(progress.laps, lap + (i === CIRCUIT_CHECKPOINTS.length - 1 ? 1 : 0));
  }
  assert.equal(progress.status, 'complete'); assert.match(gameGoal(rally, progress).title, /complete/);
  assert.equal(stepGameProgress(rally, progress, input).state, progress);
  assert.equal(NEW_GAME_PROGRESS.laps, 0);
});

test('circuit timeout does not mint a win and the step caps large frame deltas deterministically', () => {
  const before = { ...NEW_GAME_PROGRESS, elapsed: rally.activeRules.targetScoreOrTimeSec - 0.05 };
  const next = stepGameProgress(rally, before, { ...input, dt: 50 }).state;
  assert.equal(next.status, 'time-up'); assert.equal(next.elapsed, before.elapsed + 0.1);
  assert.match(gameGoal(rally, next).hint, /Restart/);
});

test('ten-wave assault emits each wave once, waits for actual mob death, and respects a three-second intermission', () => {
  let state: GameProgress = NEW_GAME_PROGRESS;
  for (let wave = 1; wave <= 10; wave++) {
    let result = stepGameProgress(arena, state, input);
    if (wave > 1) {
      assert.equal(result.spawnWave, 0);
      state = { ...result.state, elapsed: result.state.nextWaveAt - 0.1 };
      result = stepGameProgress(arena, state, input);
    }
    assert.equal(result.spawnWave, wave); assert.equal(result.state.wave, wave); assert.equal(result.state.wavePending, false);
    state = stepGameProgress(arena, result.state, { ...input, livingWaveMobs: 1 }).state;
    assert.equal(state.wave, wave); assert.equal(state.status, 'playing'); assert.equal(state.wavePending, false);
    const clear = stepGameProgress(arena, state, input); state = clear.state;
    assert.equal(clear.spawnWave, 0);
    if (wave < 10) { assert.equal(state.wavePending, true); assert.equal(state.nextWaveAt, state.elapsed + 3); }
  }
  assert.equal(state.status, 'complete'); assert.equal(state.wave, 10);
  assert.equal(stepGameProgress(arena, state, input).spawnWave, 0);
});

test('observer quota counts unique visible creature IDs, while sandbox freeplay stays open', () => {
  let result = stepGameProgress(eco, NEW_GAME_PROGRESS, { ...input, visibleCreatureIds: [1, 1, 2] });
  assert.deepEqual(result.state.observed, [1, 2]); assert.equal(result.state.status, 'playing'); assert.equal(result.spawnWave, 0);
  result = stepGameProgress(eco, result.state, { ...input, visibleCreatureIds: [2, 3, 4, 5, 6, 7, 8] });
  assert.equal(result.state.status, 'complete'); assert.equal(result.state.observed.length, 8);
  assert.equal(stepGameProgress(sandbox, NEW_GAME_PROGRESS, input).state.status, 'playing');
});

test('stargate escape consumes a real gate crossing, not elapsed time or an incidental score', () => {
  const preset = assertPlayablePreset({ ...arena, hudBlade: 'exploration-o2', activeRules: { ...arena.activeRules, winCondition: 'stargate-escape' } });
  assert.equal(stepGameProgress(preset, NEW_GAME_PROGRESS, input).state.status, 'playing');
  assert.equal(stepGameProgress(preset, NEW_GAME_PROGRESS, { ...input, escaped: true }).state.status, 'complete');
});

test('campaign Earth/Moon horizons resolve through the same frozen sandbox preset data as the URL and Spore gateways', () => {
  for (const world of ['earth', 'moon'] as const) {
    const preset = gateSandboxPreset(world, 9876);
    assert.equal(preset.stageBiomeId, world === 'earth' ? 'earth-restored' : 'moon-plot');
    assert.equal(preset.worldSeed, 9876); assert.equal(preset.hudBlade, 'sandbox-freeplay');
    assert.equal(preset.activeRules.winCondition, 'sandbox-freeplay'); assert.deepEqual(preset.rosterOverrides, sandbox.rosterOverrides);
    assert.ok(Object.isFrozen(preset)); assert.ok(Object.isFrozen(preset.activeRules)); assert.equal(gameStage(preset), 6);
    assert.equal(gameBaseWorld(preset).biome.world, world);
  }
});
