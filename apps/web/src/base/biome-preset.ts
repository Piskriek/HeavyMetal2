/**
 * A plot's **biome preset** (plan 42 section 4.2-4.3, JOB-07 item 3): what the ground is made of, which six tree species
 * presets grow on it, and the sky above it. The Moon plot starts on the regolith preset; once Stage 6 saves Earth
 * (`isEarthSandboxUnlocked`), the owner unlocks the Earth plot and its restored-biosphere preset, and can retune any of its
 * six species slots.
 *
 * Pure data: no three.js, no clock, no randomness, so the save, the panel and the plot's scatter can all read it. The
 * renderer half lives in the play screen (`setSpeciesSlots` on the biome view, the terrain material through `mat:`), which
 * keeps this module usable from `base/` without dragging the renderer in.
 */
import { isEarthSandboxUnlocked, type CardinalLike, type PlotWorldKind } from '@hm/coopnet/gate-dialer';

/** How many species slots a plot's biome preset holds (each is one `@hm/treegen` preset: a species and its sliders). */
export const PLOT_BIOME_SLOTS = 6;

/** The tree species a slot may name (the three `@hm/treegen` species the plot grows). */
export const BIOME_SPECIES: readonly BiomeSpecies[] = Object.freeze(['pine', 'oak', 'birch']);
export type BiomeSpecies = 'pine' | 'oak' | 'birch';

/** One species slot: a species and its `@hm/treegen` slider values. */
export interface BiomeSpeciesSlot {
  readonly species: BiomeSpecies;
  readonly params: Readonly<Record<string, number>>;
  /** How much of the plot's tree scatter this slot takes (0..1); the slots are normalised when they are applied. */
  readonly share: number;
}

export interface PlotBiomePreset {
  readonly v: 1;
  /** 'moon-regolith' or 'earth-restored' for the two shipped presets; a player's retune keeps the preset's id. */
  readonly id: string;
  readonly label: string;
  readonly world: PlotWorldKind;
  /** The ground: a `mat:` layered material (plan 41), its age 0..1, and how much ground cover it carries 0..1. */
  readonly terrain: { readonly material: string; readonly age: number; readonly cover: number };
  /** Exactly `PLOT_BIOME_SLOTS` species slots, in scatter weight order. */
  readonly species: readonly BiomeSpeciesSlot[];
  /** The sky above: its `lx:` cartridge, the sun's Kelvin, the horizon colour and the fog's density. */
  readonly sky: { readonly lamp: string; readonly sunKelvin: number; readonly horizon: string; readonly fog: number };
}

const slot = (species: BiomeSpecies, params: Readonly<Record<string, number>>, share: number): BiomeSpeciesSlot => ({ species, params, share });

/** The Moon as the plot starts: regolith underfoot, three dry species, a hard white sun. */
export const MOON_BIOME_PRESET: PlotBiomePreset = Object.freeze({
  v: 1,
  id: 'moon-regolith',
  label: 'Moon regolith',
  world: 'moon',
  terrain: { material: 'mat:regolith', age: 0.55, cover: 0.15 },
  species: Object.freeze([
    slot('pine', { height: 7.5, crownSpread: 0.85, crownBase: 0.3, tint: 0 }, 0.24),
    slot('birch', { height: 6.0, crownSpread: 0.8, crownBase: 0.34, tint: 0 }, 0.2),
    slot('oak', { height: 6.5, crownSpread: 0.9, crownBase: 0.28, tint: 0 }, 0.2),
    slot('pine', { height: 5.0, crownSpread: 0.7, crownBase: 0.24, tint: 0 }, 0.16),
    slot('birch', { height: 4.2, crownSpread: 0.7, crownBase: 0.4, tint: 0 }, 0.12),
    slot('oak', { height: 4.0, crownSpread: 0.75, crownBase: 0.3, tint: 0 }, 0.08),
  ]),
  sky: { lamp: 'lx:6500:1.15:steady', sunKelvin: 6500, horizon: '#2b2f33', fog: 0.0017 },
});

/** Earth restored: living soil and moss, six lush slots, a warm afternoon sun. */
export const EARTH_BIOME_PRESET: PlotBiomePreset = Object.freeze({
  v: 1,
  id: 'earth-restored',
  label: 'Restored Earth biosphere',
  world: 'earth',
  terrain: { material: 'mat:moss', age: 0.3, cover: 0.85 },
  species: Object.freeze([
    slot('oak', { height: 12.0, crownSpread: 1.35, crownBase: 0.24, branchDensity: 1.15, tint: 0 }, 0.26),
    slot('birch', { height: 10.5, crownSpread: 1.15, crownBase: 0.3, leafScale: 1.1, tint: 0 }, 0.22),
    slot('pine', { height: 13.0, crownSpread: 1.2, crownBase: 0.2, tint: 1 }, 0.18),
    slot('oak', { height: 7.5, crownSpread: 1.0, crownBase: 0.3, tint: 1 }, 0.16),
    slot('birch', { height: 5.5, crownSpread: 0.9, crownBase: 0.36, tint: 0 }, 0.1),
    slot('oak', { height: 4.0, crownSpread: 0.8, crownBase: 0.3, tint: 0 }, 0.08),
  ]),
  sky: { lamp: 'lx:4800:1.0:steady', sunKelvin: 4800, horizon: '#e2b48a', fog: 0.0011 },
});

/** The two shipped presets, by world. */
export const PLOT_BIOME_PRESETS: Readonly<Record<PlotWorldKind, PlotBiomePreset>> = Object.freeze({
  moon: MOON_BIOME_PRESET,
  earth: EARTH_BIOME_PRESET,
});

/** The preset a world starts on. */
export function biomePresetFor(world: PlotWorldKind): PlotBiomePreset {
  return PLOT_BIOME_PRESETS[world];
}

/**
 * Whether the Earth plot is open to this player, and why not when it is not: Stage 6 with all four Cardinal Floats
 * settled (Constitution 1 and 4 — Earth is saved by the fidelity ladder, not by a purchase).
 */
export function earthPlotUnlock(stage: number, cardinals?: CardinalLike): { readonly unlocked: boolean; readonly reason: string } {
  if (isEarthSandboxUnlocked(stage, cardinals)) return { unlocked: true, reason: 'Earth is restored: your Earth plot is open for building.' };
  const n = Number.isFinite(stage) ? Math.trunc(stage) : 0;
  return {
    unlocked: false,
    reason: `Earth opens at Stage 6 with Pxd, Vtx, Lx and Aq settled (you are at Stage ${Math.max(0, Math.min(6, n))}).`,
  };
}

/** Clamp a slot's share into 0..1 (a preset read back from a save may hold anything). */
const shareOf = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0);

/** A slot's slider values: finite numbers, capped to a handful so a hostile save cannot blow the preset up. */
function paramsOf(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, number> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 16) break;
    // the treegen slider keys are camelCase (height, crownSpread, trunkLean ...)
    if (typeof value === 'number' && Number.isFinite(value) && /^[a-zA-Z][a-zA-Z0-9]{1,19}$/.test(key)) {
      out[key] = value;
      n += 1;
    }
  }
  return out;
}

const isSpecies = (value: unknown): value is BiomeSpecies =>
  value === 'pine' || value === 'oak' || value === 'birch';

/**
 * The preset with one species slot retuned (the "customizable PlotBiomePreset" of plan 42 section 4.3): index wraps into
 * the six slots, an unknown species leaves the preset alone, and the result is still exactly six slots.
 */
export function withBiomeSlot(preset: PlotBiomePreset, index: number, slot: Partial<BiomeSpeciesSlot>): PlotBiomePreset {
  const n = preset.species.length;
  if (n === 0) return preset;
  const i = ((Math.trunc(index) % n) + n) % n;
  const current = preset.species[i] as BiomeSpeciesSlot;
  const next: BiomeSpeciesSlot = {
    species: isSpecies(slot.species) ? slot.species : current.species,
    params: slot.params ? paramsOf(slot.params) : current.params,
    share: slot.share === undefined ? current.share : shareOf(slot.share),
  };
  return { ...preset, species: preset.species.map((s, k) => (k === i ? next : s)) };
}

/** The slots normalised to weights that sum to 1 (a preset whose shares are all zero falls back to even weights). */
export function biomeSlotShares(preset: PlotBiomePreset): readonly number[] {
  const total = preset.species.reduce((sum, s) => sum + shareOf(s.share), 0);
  if (!(total > 0)) return preset.species.map(() => 1 / Math.max(1, preset.species.length));
  return preset.species.map((s) => shareOf(s.share) / total);
}

/** The species a slot list grows, in slot order (what the biome view is handed). */
export function biomeSlotSpecies(preset: PlotBiomePreset): readonly BiomeSpecies[] {
  return preset.species.map((s) => s.species);
}

/**
 * A preset read back from a save: six slots of a known species with finite sliders, a `mat:` terrain and an `lx:` sky, or
 * null when it is not one. The caller falls back to the world's own preset, so a damaged save never leaves a bare plot.
 */
export function readBiomePreset(raw: unknown): PlotBiomePreset | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const terrain = o.terrain as Record<string, unknown> | undefined;
  const sky = o.sky as Record<string, unknown> | undefined;
  if (!terrain || !sky) return null;
  if (typeof terrain.material !== 'string' || !/^mat:[a-z0-9-]{2,40}$/.test(terrain.material)) return null;
  if (typeof sky.lamp !== 'string' || !/^lx:\d{4}:\d+(\.\d+)?:(steady|pulse|flicker)$/.test(sky.lamp)) return null;
  const world: PlotWorldKind = o.world === 'earth' ? 'earth' : 'moon';
  const slots: BiomeSpeciesSlot[] = [];
  if (Array.isArray(o.species)) {
    for (const entry of o.species.slice(0, PLOT_BIOME_SLOTS)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (!isSpecies(e.species)) continue;
      slots.push({ species: e.species, params: paramsOf(e.params), share: shareOf(e.share) });
    }
  }
  if (slots.length !== PLOT_BIOME_SLOTS) return null;
  return {
    v: 1,
    id: typeof o.id === 'string' && /^[a-z0-9-]{2,40}$/.test(o.id) ? o.id : 'custom',
    label: typeof o.label === 'string' ? o.label.slice(0, 60) : 'Custom biome',
    world,
    terrain: {
      material: terrain.material,
      age: shareOf(terrain.age),
      cover: shareOf(terrain.cover),
    },
    species: slots,
    sky: {
      lamp: sky.lamp,
      sunKelvin: typeof sky.sunKelvin === 'number' && Number.isFinite(sky.sunKelvin) ? Math.max(1000, Math.min(20000, sky.sunKelvin)) : 6500,
      horizon: typeof sky.horizon === 'string' && /^#[0-9a-f]{6}$/i.test(sky.horizon) ? sky.horizon : '#2b2f33',
      fog: typeof sky.fog === 'number' && Number.isFinite(sky.fog) ? Math.max(0, Math.min(0.02, sky.fog)) : 0.0017,
    },
  };
}
