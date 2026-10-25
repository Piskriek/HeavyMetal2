/** Declarative mode bindings and progress, stepped by PlayScreen's existing frame loop. No renderer or second physics loop. */
import { creatureGenomeById } from '@hm/creature';
import { TARGET, type MachineKind } from '@hm/plotsim';
import type { MultiverseGamePresetSpec } from './game-presets';
import { GAME_MACHINE_KINDS, gameVehicleKind } from './game-presets';
import { FRESH, type PlayState } from './quest';
import { startCampaignWorld } from '../base/campaign-world';
import { EARTH_BIOME_PRESET, MOON_BIOME_PRESET } from '../base/biome-preset';
import { apply, BRIDGE_RANGE, type BaseWorld, type Vehicle } from '../base/world';
import { SIDEARM_ITEM_ID } from './armory-rack';

export function gameStage(preset: MultiverseGamePresetSpec): number { return preset.stageBiomeId === 'moon-sector' ? 3 : 6; }
export function gameSpawn(preset: MultiverseGamePresetSpec): { x: number; z: number; yaw: number } {
  return preset.activeRules.winCondition === 'checkpoint-circuit' ? { x: 0, z: 35, yaw: -Math.PI / 2 } : { x: 0, z: 35, yaw: 0 };
}
export function gamePlayState(preset: MultiverseGamePresetSpec): PlayState {
  const kinds = preset.rosterOverrides.filter((id): id is keyof typeof GAME_MACHINE_KINDS => Object.hasOwn(GAME_MACHINE_KINDS, id));
  return {
    ...FRESH, step: 'done', avatar: { kind: 'scientist', name: 'Multiverse Explorer', visor: '#f59e0b' }, avatarId: 'scientist', gateOn: true, visited: true,
    plot: {
      ...FRESH.plot, stage: gameStage(preset), ore: 8000,
      points: preset.stageBiomeId === 'earth-restored' || preset.hudBlade === 'sandbox-freeplay' ? { ...TARGET } : { pxd: 30_000, vtx: 30_000, lx: 20_000, aq: 0 },
      machines: kinds.map((id, i) => ({ id: i + 1, kind: GAME_MACHINE_KINDS[id] as MachineKind, x: 22 + (i % 4) * 10, z: 10 + Math.floor(i / 4) * 10, yaw: 0, on: false, cartridge: null, built: 0 })),
      nextId: kinds.length + 1,
    },
  };
}
export function gameBaseWorld(preset: MultiverseGamePresetSpec): BaseWorld {
  const fresh = startCampaignWorld(null, { seed: preset.worldSeed, devKit: true }).world;
  // Use the existing base command so the seeded anomaly field, not just its stage label, is promoted.
  const staged = apply(fresh, { heightAt: () => 0, bridge: { x: 0, z: 0, range: BRIDGE_RANGE } }, { t: 'stage', stage: gameStage(preset) }).world;
  const start = gameSpawn(preset);
  const rigKind = gameVehicleKind(preset.playerRigId);
  const kinds = [...new Set([...(rigKind ? [rigKind] : []), ...preset.rosterOverrides.flatMap((id) => { const k = gameVehicleKind(id); return k ? [k] : []; })])];
  const vehicles: Vehicle[] = kinds.map((kind, i) => ({ id: i + 1, kind, x: start.x + i * 7, z: start.z, yaw: Math.PI / 2, box: null }));
  return {
    ...staged, shelter: true, vehicles, nextVehicle: vehicles.length + 1,
    biome: preset.stageBiomeId === 'earth-restored' ? EARTH_BIOME_PRESET : MOON_BIOME_PRESET,
    equipment: { ...staged.equipment, sidearm: preset.hudBlade === 'arena-wave-survivor' ? { item: SIDEARM_ITEM_ID, n: 1 } : null },
  };
}

export const CIRCUIT_CHECKPOINTS: readonly { readonly x: number; readonly z: number }[] = Object.freeze([
  Object.freeze({ x: 45, z: 35 }), Object.freeze({ x: 45, z: -35 }), Object.freeze({ x: -45, z: -35 }), Object.freeze({ x: -45, z: 35 }), Object.freeze({ x: 0, z: 35 }),
]);
export const CIRCUIT_LAPS = 3;
export interface GameProgress {
  readonly elapsed: number;
  readonly checkpoint: number;
  readonly laps: number;
  readonly wave: number;
  readonly wavePending: boolean;
  readonly nextWaveAt: number;
  readonly observed: readonly number[];
  readonly status: 'playing' | 'complete' | 'time-up';
}
export const NEW_GAME_PROGRESS: GameProgress = Object.freeze({ elapsed: 0, checkpoint: 0, laps: 0, wave: 0, wavePending: true, nextWaveAt: 0, observed: Object.freeze([]), status: 'playing' });
export interface GameProgressInput {
  readonly dt: number;
  readonly x: number;
  readonly z: number;
  readonly livingWaveMobs: number;
  readonly visibleCreatureIds: readonly number[];
  readonly escaped?: boolean;
}
export function stepGameProgress(preset: MultiverseGamePresetSpec, before: GameProgress, input: GameProgressInput): { readonly state: GameProgress; readonly spawnWave: number } {
  if (before.status !== 'playing') return { state: before, spawnWave: 0 };
  let state: GameProgress = { ...before, elapsed: before.elapsed + Math.max(0, Math.min(0.1, input.dt)) };
  let spawnWave = 0;
  const target = preset.activeRules.targetScoreOrTimeSec;
  if (preset.hudBlade === 'ecosystem-observer') {
    const observed = [...new Set([...before.observed, ...input.visibleCreatureIds])];
    state = { ...state, observed, status: observed.length >= Math.ceil(target) ? 'complete' : 'playing' };
  } else if (preset.activeRules.winCondition === 'checkpoint-circuit') {
    const point = CIRCUIT_CHECKPOINTS[state.checkpoint]!;
    if (Math.hypot(input.x - point.x, input.z - point.z) <= 7) {
      const checkpoint = (state.checkpoint + 1) % CIRCUIT_CHECKPOINTS.length;
      const laps = state.laps + (checkpoint === 0 ? 1 : 0);
      state = { ...state, checkpoint, laps, status: laps >= CIRCUIT_LAPS ? 'complete' : 'playing' };
    }
    if (target > 0 && state.elapsed >= target && state.status === 'playing') state = { ...state, status: 'time-up' };
  } else if (preset.activeRules.winCondition === 'wave-clearance') {
    if (!state.wavePending && input.livingWaveMobs === 0) {
      state = state.wave >= Math.ceil(target) ? { ...state, status: 'complete' } : { ...state, wavePending: true, nextWaveAt: state.elapsed + 3 };
    }
    if (state.status === 'playing' && state.wavePending && state.elapsed >= state.nextWaveAt) {
      state = { ...state, wave: state.wave + 1, wavePending: false };
      spawnWave = state.wave;
    }
  } else if (preset.activeRules.winCondition === 'stargate-escape' && input.escaped) state = { ...state, status: 'complete' };
  return { state, spawnWave };
}
export function gameGoal(preset: MultiverseGamePresetSpec, state: GameProgress): { title: string; hint: string } {
  if (state.status === 'complete') return { title: 'Objective complete', hint: 'The world stays open. Explore, build, or share a Spore Card.' };
  if (state.status === 'time-up') return { title: 'Circuit time complete', hint: `${state.laps} laps cleared. Restart the preset to try again.` };
  switch (preset.hudBlade) {
    case 'race-lap-telemetry': return { title: `Lap ${Math.min(CIRCUIT_LAPS, state.laps + 1)} / ${CIRCUIT_LAPS}`, hint: `Checkpoint ${state.checkpoint + 1} / ${CIRCUIT_CHECKPOINTS.length} · ${state.elapsed.toFixed(1)} s / ${preset.activeRules.targetScoreOrTimeSec} s` };
    case 'arena-wave-survivor': return { title: `Wave ${state.wave} / ${Math.ceil(preset.activeRules.targetScoreOrTimeSec)}`, hint: state.wavePending ? 'Next assault incoming. Reload and reposition.' : 'Clear the assault. Every creature uses the shared combat simulation.' };
    case 'ecosystem-observer': return { title: `Observed ${state.observed.length} / ${Math.ceil(preset.activeRules.targetScoreOrTimeSec)}`, hint: 'Look at distinct theropod and avian organisms within 40 metres. Wildlife is peaceful.' };
    case 'sandbox-freeplay': return { title: 'All 14 kits unlocked', hint: 'B · Build / E · Enter vehicle / Drop a PNG Spore Card to load a creation.' };
    default: return { title: preset.title, hint: 'Find the Stargate and escape.' };
  }
}
export function gameCreatureIds(preset: MultiverseGamePresetSpec): readonly string[] { return preset.rosterOverrides.filter((id) => !!creatureGenomeById(id)); }
