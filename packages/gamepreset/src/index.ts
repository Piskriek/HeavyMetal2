/** Plan 45: Rung 5 is configuration of the one engine, never another game loop. */
import { frozenSchema, id, list, number, oneOf, shape, text } from './schema';
export * from './schema';

export interface MultiverseGamePresetSpec {
  readonly id: string;
  readonly title: string;
  readonly version: 1;
  readonly worldSeed: number;
  readonly stageBiomeId: string;
  readonly cameraMode: 'first-person-suit' | 'third-person-orbit' | 'vehicle-chase' | 'isometric-tactical';
  readonly hudBlade: 'exploration-o2' | 'race-lap-telemetry' | 'arena-wave-survivor' | 'ecosystem-observer' | 'sandbox-freeplay';
  readonly playerRigId: string;
  readonly activeRules: {
    readonly gravityScale: number;
    readonly stageAnimRateHz: number;
    readonly winCondition: 'stargate-escape' | 'checkpoint-circuit' | 'wave-clearance' | 'sandbox-freeplay';
    readonly targetScoreOrTimeSec: number;
  };
  readonly rosterOverrides: readonly string[];
}

export const MultiverseGamePresetSchema = frozenSchema<MultiverseGamePresetSpec>(shape({
  id, title: text(96), version: oneOf([1]), worldSeed: number(0, 0xffff_ffff, true), stageBiomeId: id,
  cameraMode: oneOf(['first-person-suit', 'third-person-orbit', 'vehicle-chase', 'isometric-tactical']),
  hudBlade: oneOf(['exploration-o2', 'race-lap-telemetry', 'arena-wave-survivor', 'ecosystem-observer', 'sandbox-freeplay']),
  playerRigId: id,
  activeRules: shape({
    gravityScale: number(0, 10), stageAnimRateHz: number(8, 60),
    winCondition: oneOf(['stargate-escape', 'checkpoint-circuit', 'wave-clearance', 'sandbox-freeplay']),
    targetScoreOrTimeSec: number(0, 86_400),
  }),
  rosterOverrides: list(id, 128),
}));

/** The eleven machine kits and three vehicles. The Astro suit is a creature, not a fifteenth machine. */
export const ALL_MACHINE_VEHICLE_KIT_IDS: readonly string[] = Object.freeze([
  'kit:power-unit', 'kit:rock-drill', 'kit:texture-mill', 'kit:shape-press', 'kit:relay-pylon',
  'kit:light-projector', 'kit:watermaker', 'kit:heavy-mill', 'kit:heavy-press', 'kit:heavy-projector', 'kit:heavy-water',
  'kit:scout-rover', 'kit:crawler-rig', 'kit:hauler-transporter',
]);

export const PRESET_CIRCUIT_RALLY = MultiverseGamePresetSchema.parse({
  id: 'circuit-rally', title: 'Earth Circuit Rally', version: 1, worldSeed: 42069,
  stageBiomeId: 'earth-restored', cameraMode: 'vehicle-chase', hudBlade: 'race-lap-telemetry', playerRigId: 'kit:scout-rover',
  activeRules: { gravityScale: 1, stageAnimRateHz: 60, winCondition: 'checkpoint-circuit', targetScoreOrTimeSec: 180 },
  rosterOverrides: ['kit:scout-rover', 'kit:crawler-rig', 'kit:hauler-transporter'],
});
export const PRESET_ARENA_SURVIVOR = MultiverseGamePresetSchema.parse({
  id: 'arena-survivor', title: 'Lunar Arena Survivor', version: 1, worldSeed: 26010,
  stageBiomeId: 'moon-sector', cameraMode: 'first-person-suit', hudBlade: 'arena-wave-survivor', playerRigId: 'kit:astro-suit',
  activeRules: { gravityScale: 0.165, stageAnimRateHz: 30, winCondition: 'wave-clearance', targetScoreOrTimeSec: 10 },
  rosterOverrides: ['theropod', 'hexapod', 'arachnid'],
});
export const PRESET_ECO_OBSERVER = MultiverseGamePresetSchema.parse({
  id: 'eco-observer', title: 'Earth Biosphere Observer', version: 1, worldSeed: 45006,
  stageBiomeId: 'earth-restored', cameraMode: 'third-person-orbit', hudBlade: 'ecosystem-observer', playerRigId: 'kit:astro-suit',
  // The quota is read by the observer HUD; the world remains peaceful freeplay after it is met.
  activeRules: { gravityScale: 1, stageAnimRateHz: 60, winCondition: 'sandbox-freeplay', targetScoreOrTimeSec: 8 },
  rosterOverrides: ['theropod', 'avian-drone'],
});
export const PRESET_SANDBOX_BUILDER = MultiverseGamePresetSchema.parse({
  id: 'sandbox-builder', title: 'Lunar Sandbox Builder', version: 1, worldSeed: 45014,
  stageBiomeId: 'moon-plot', cameraMode: 'isometric-tactical', hudBlade: 'sandbox-freeplay', playerRigId: 'kit:astro-suit',
  activeRules: { gravityScale: 0.165, stageAnimRateHz: 60, winCondition: 'sandbox-freeplay', targetScoreOrTimeSec: 0 },
  rosterOverrides: ALL_MACHINE_VEHICLE_KIT_IDS,
});
export const GAME_PRESETS: readonly MultiverseGamePresetSpec[] = Object.freeze([
  PRESET_CIRCUIT_RALLY, PRESET_ARENA_SURVIVOR, PRESET_ECO_OBSERVER, PRESET_SANDBOX_BUILDER,
]);
export function gamePresetById(id: string): MultiverseGamePresetSpec | undefined { return GAME_PRESETS.find((p) => p.id === id); }
