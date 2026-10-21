/**
 * The Water Maker's species presets (plan 39 section 6, Aq): named trees first, as the research found players want
 * (docs/PRESET_FACTORIES_RESEARCH.md), each a treegen species plus its slider values. The bench's Species page starts
 * from one and the sliders change it; a species cartridge carries the result. Pure.
 */
import { FOLIAGE_SPECIES_PRESETS, resolveTreeSliderParams, TREE_PARAM_SPECS, type Species, type TreeParamSpec } from '@hm/treegen';
import type { SpeciesSpec } from '@hm/cartlab';
import { resolveLeafTintColor } from './plot-biome-view';

export interface SpeciesPreset {
  readonly id: string;
  readonly name: string;
  readonly species: Species;
  readonly params: Readonly<Record<string, number>>;
}

const base = (s: Species): Readonly<Record<string, number>> => FOLIAGE_SPECIES_PRESETS[s]!.params;
const preset = (id: string, name: string, species: Species, changes: Readonly<Record<string, number>> = {}): SpeciesPreset =>
  ({ id, name, species, params: resolveTreeSliderParams({ ...base(species), ...changes }) });

export const SPECIES_PRESETS: readonly SpeciesPreset[] = [
  preset('alpine-pine', 'Alpine pine', 'pine'),
  preset('broadleaf-oak', 'Broadleaf oak', 'oak'),
  preset('silver-birch', 'Silver birch', 'birch'),
  preset('autumn-oak', 'Autumn oak', 'oak', { height: 11, crownSpread: 1.3, tint: 1 }),
  preset('hydro-birch', 'Hydro birch', 'birch', { height: 9, windSway: 1.6, tint: 3 }),
  preset('dwarf-pine', 'Dwarf pine', 'pine', { height: 4.5, crownSpread: 1.4, crownBase: 0.1 }),
];

export const SPECIES_LABEL: Readonly<Record<Species, string>> = { pine: 'Pine', oak: 'Oak', birch: 'Birch' };

/** The canopy palette's names, in the order of the tint slider's choices. */
export const CANOPY_NAMES: readonly string[] = TREE_PARAM_SPECS.find((s) => s.key === 'tint')?.choices ?? [];

/** A slider value as people read it: the height in metres, the palette by name, the rest as a share of normal. */
export function formatTreeValue(spec: TreeParamSpec, v: number): string {
  if (spec.unit === 'choice') return (spec.choices?.[Math.round(v - spec.min)] ?? String(v)).replace(/-/g, ' ');
  if (spec.key === 'height') return `${v.toFixed(1)} m`;
  if (spec.key === 'trunkLean') return `${Math.round(v * 100)}%`;
  return `${Math.round(v * 100)}%`;
}

const same = (a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean =>
  TREE_PARAM_SPECS.every((s) => Math.abs((a[s.key] ?? s.default) - (b[s.key] ?? s.default)) < 1e-6);

/** A cartridge name: the preset's own when the sliders still match it, else the species, its palette and its height. */
export function speciesName(species: Species, params: Readonly<Record<string, number>>): string {
  const p = resolveTreeSliderParams(params);
  const named = SPECIES_PRESETS.find((x) => x.species === species && same(x.params, p));
  if (named) return named.name;
  const canopy = (CANOPY_NAMES[Math.round(p.tint ?? 0)] ?? 'emerald').replace(/-/g, ' ');
  return `${SPECIES_LABEL[species]}, ${canopy}, ${(p.height ?? 8.5).toFixed(1)} m`;
}

/** The species cartridge for a species and its sliders (resolved, so the saved values are the grown ones). */
export function speciesSpec(species: Species, params: Readonly<Record<string, number>>): SpeciesSpec {
  const p = resolveTreeSliderParams(params);
  return { name: speciesName(species, p), species, params: p };
}

/** The colour a species shows in the rifle's port and on its chip: its canopy's. */
export function speciesHex(spec: Pick<SpeciesSpec, 'species' | 'params'>): string {
  const leaf = resolveLeafTintColor(FOLIAGE_SPECIES_PRESETS[spec.species]?.leafColor ?? [0.25, 0.52, 0.2], spec.params);
  return `#${leaf.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
}
