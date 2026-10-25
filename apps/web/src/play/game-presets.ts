/** App bindings for the pure Rung 5 schema. No genre owns an engine or a canvas. */
import { creatureGenomeById, buildCreatureKit, CREATURE_PRESET } from '@hm/creature';
import { gamePresetById, PRESET_SANDBOX_BUILDER, MultiverseGamePresetSchema, type MultiverseGamePresetSpec } from '@hm/gamepreset';
import type { Kit } from '@hm/kitspec';
import type { RoverKind } from '@hm/rover';
import { MACHINE_KITS } from './kit-machines';
import { VEHICLE_KITS } from './kit-vehicles';
export * from '@hm/gamepreset';

export const GAME_MACHINE_KINDS = Object.freeze({
  'kit:power-unit': 'power', 'kit:rock-drill': 'drill', 'kit:texture-mill': 'mill', 'kit:shape-press': 'press',
  'kit:relay-pylon': 'pylon', 'kit:light-projector': 'projector', 'kit:watermaker': 'water',
  'kit:heavy-mill': 'heavy-mill', 'kit:heavy-press': 'heavy-press', 'kit:heavy-projector': 'heavy-projector', 'kit:heavy-water': 'heavy-water',
} as const);
export function gameVehicleKind(id: string): RoverKind | undefined {
  return id === 'kit:scout-rover' ? 'scout' : id === 'kit:crawler-rig' ? 'crawler' : id === 'kit:hauler-transporter' ? 'hauler' : undefined;
}
export function gameRigKit(id: string): { readonly kit: Kit; readonly preset: string } | undefined {
  const vehicle = gameVehicleKind(id);
  if (vehicle) return { kit: VEHICLE_KITS[vehicle], preset: 'vehicle' };
  if (Object.hasOwn(GAME_MACHINE_KINDS, id)) {
    const kind = GAME_MACHINE_KINDS[id as keyof typeof GAME_MACHINE_KINDS];
    return { kit: MACHINE_KITS[kind], preset: 'machine' };
  }
  const genome = creatureGenomeById(id === 'kit:astro-suit' ? 'astro-suit' : id);
  return genome ? { kit: buildCreatureKit(genome), preset: CREATURE_PRESET } : undefined;
}
export function assertPlayablePreset(value: unknown): MultiverseGamePresetSpec {
  const preset = MultiverseGamePresetSchema.parse(value);
  if (!['earth-restored', 'moon-sector', 'moon-plot', 'moon-regolith'].includes(preset.stageBiomeId)) throw new Error(`Unknown stage biome: ${preset.stageBiomeId}`);
  const rig = preset.playerRigId;
  if (!gameVehicleKind(rig) && !Object.hasOwn(GAME_MACHINE_KINDS, rig) && rig !== 'kit:astro-suit' && !creatureGenomeById(rig)) throw new Error(`Unknown player rig: ${rig}`);
  for (const id of preset.rosterOverrides) {
    if (!gameVehicleKind(id) && !Object.hasOwn(GAME_MACHINE_KINDS, id) && !creatureGenomeById(id)) throw new Error(`Unknown roster entry: ${id}`);
  }
  return preset;
}
export interface StandaloneGameOptions { readonly gameId: string; readonly worldSeed?: number; readonly playerRig?: string }
export function resolveStandaloneGame(options: StandaloneGameOptions): MultiverseGamePresetSpec {
  const base = gamePresetById(options.gameId);
  if (!base) throw new Error(`Unknown game preset: ${options.gameId}`);
  return assertPlayablePreset({ ...base, worldSeed: options.worldSeed ?? base.worldSeed, playerRigId: options.playerRig ?? base.playerRigId });
}

/** An active endgame horizon is the same declarative gateway as a Spore card or URL. */
export function gateSandboxPreset(world: 'earth' | 'moon', worldSeed = 7): MultiverseGamePresetSpec {
  return assertPlayablePreset({
    ...PRESET_SANDBOX_BUILDER, id: `gate:${world}-sandbox`, title: world === 'earth' ? 'Earth Endgame Sandbox' : 'Moon Endgame Sandbox',
    worldSeed, stageBiomeId: world === 'earth' ? 'earth-restored' : 'moon-plot',
  });
}
