/**
 * `studio.material.coverage` for the agent API (plan 40 §2, plan 41 §7): the same six-zone report `scripts/material-coverage.mjs`
 * prints and `packages/matstack/tests/coverage.test.ts` asserts on, shaped for an agent — percentages with one decimal, the zone
 * table, and the three questions an agent actually asks before it asks a person to look:
 *
 *  - does a layer read as a patch or as a coat on a face?
 *  - does a worn edge show bare metal?
 *  - is the thing I just painted too dark to see?
 *
 * Pure and deterministic (one atlas, cached), so an agent can call it in a loop while tuning and get the same numbers every time.
 */
import { coverage, resolveMatPreset, type CoverageZone, type MaterialSpec } from '@hm/matstack';
import { atlasNoiseSource, atlasTileSource } from '@hm/texgraph';

const tiles = atlasTileSource();
const noise = atlasNoiseSource();

/** One layer's coverage, as percentages (0..100, one decimal). */
export interface LayerCoveragePercent {
  readonly name: string;
  readonly top: number;
  readonly side: number;
  readonly edge: number;
  readonly crease: number;
  readonly bottom: number;
  readonly splash: number;
}

/** The agent-facing report. */
export interface MaterialCoverageReport {
  readonly ok: boolean;
  readonly why: string;
  /** The shelf id the report was asked for (`''` for a bare spec). */
  readonly preset: string;
  /** The material's own name. */
  readonly material: string;
  readonly age: number;
  readonly grid: number;
  /** Per layer, in stack order, as percentages. */
  readonly layers: readonly LayerCoveragePercent[];
  /** The material's own peak metal on the edge zone (does abrasion expose the metal?), 0..1. */
  readonly edgeMetal: number;
  readonly sideMetal: number;
  /** Mean colour luminance per zone, 0..1: a hopper that reads as a light tray shows up here. */
  readonly luminance: Readonly<Record<CoverageZone, number>>;
  /** Plain-language readings an agent can check itself against. */
  readonly readings: readonly string[];
}

const pct = (x: number): number => Math.round(x * 1000) / 10;
const ZONES: readonly CoverageZone[] = ['top', 'side', 'edge', 'crease', 'bottom', 'splash'];

/** A layer's coverage across the zones, as percentages. */
const asPercent = (layer: { readonly name: string; readonly zones: Readonly<Record<CoverageZone, number>> }): LayerCoveragePercent => ({
  name: layer.name,
  top: pct(layer.zones.top),
  side: pct(layer.zones.side),
  edge: pct(layer.zones.edge),
  crease: pct(layer.zones.crease),
  bottom: pct(layer.zones.bottom),
  splash: pct(layer.zones.splash),
});

/**
 * The report for `preset` (a `mat:` id, resolved through the shelf and its aliases) or for a bare spec. A missing preset is a
 * refusal with the reason, never an empty table an agent could mistake for "0% everywhere".
 */
export function materialCoverageReport(o: { readonly preset?: string; readonly material?: MaterialSpec; readonly grid?: number }): MaterialCoverageReport {
  const grid = Math.max(4, Math.min(64, Math.round(o.grid ?? 24)));
  const found = o.material ?? (o.preset ? resolveMatPreset(o.preset) : undefined);
  if (!found) {
    return {
      ok: false,
      why: o.preset ? `'${o.preset}' is not a material in the shelf` : 'neither a preset id nor a material was given',
      preset: o.preset ?? '',
      material: '',
      age: 0,
      grid,
      layers: [],
      edgeMetal: 0,
      sideMetal: 0,
      luminance: { top: 0, side: 0, edge: 0, crease: 0, bottom: 0, splash: 0 },
      readings: [],
    };
  }
  const report = coverage(found, tiles, noise, grid);
  const layers = report.layers.map(asPercent);
  const readings: string[] = [];
  for (const l of layers) {
    const lower = l.name.toLowerCase();
    if (lower.includes('rust') && lower.includes('bloom')) {
      readings.push(`rust bloom: ${l.side}% of a side face (a patch is 2-15%), ${l.crease}% in creases`);
    } else if (lower.includes('oil')) {
      readings.push(`oil: ${l.side}% of a plain face (want under 5%), ${l.edge}% under edges, ${l.crease}% in crevices`);
    } else if (lower.includes('soot')) {
      readings.push(`soot: ${l.top}% on tops and ${l.bottom}% on undersides (a sooty machine shows both)`);
    } else if (lower.includes('dust')) {
      readings.push(`${l.name}: ${l.top}% on tops, ${l.side}% on sides (dust settles, it does not coat a wall)`);
    } else if (l.side > 60) {
      readings.push(`${l.name}: ${l.side}% of a side face is nearly a coat — check it is meant to be one`);
    }
  }
  if (found.layers.some((l) => /edge wear|paint chips|scratches/i.test(l.name))) {
    readings.push(`a worn edge peaks at metal ${report.edgeMetal.toFixed(2)} (bare metal reads 0.45 or more)`);
  }
  const dark = report.zoneLuminance.top < 0.12;
  if (dark) readings.push(`the top reads at luminance ${report.zoneLuminance.top.toFixed(3)}: the material is very dark up there`);
  return {
    ok: true,
    why: '',
    preset: o.preset ?? '',
    material: found.name,
    age: found.age,
    grid,
    layers,
    edgeMetal: Math.round(report.edgeMetal * 100) / 100,
    sideMetal: Math.round(report.sideMetal * 100) / 100,
    luminance: Object.fromEntries(ZONES.map((z) => [z, Math.round(report.zoneLuminance[z] * 1000) / 1000])) as Readonly<Record<CoverageZone, number>>,
    readings,
  };
}
