/**
 * Material coverage (plan 41 §7, TICKET-41 review; the Bench's and the agent API's measuring stick).
 *
 * "How much of a machine does this layer paint?" is the question every weathering preset lives or dies by, and it is not visible
 * from the spec: a mask is a stack of inputs, levels and the age curve, and a rust bloom that reads as 5% on a face at age 0.2 can
 * be 70% at age 0.7. `coverage` samples a synthetic 2.8 m machine box in six places and reports, per layer, the mean weight there —
 * the same numbers `scripts/material-coverage.mjs` prints and `studio.material.coverage` will hand an agent, so a preset can be
 * tuned against them instead of against a screenshot.
 *
 * The zones (a machine 2.8 m tall, its body 2.4 m wide and 2.4 m deep, its foot at y = 0):
 *  - top:    an up-facing face at the top, 2.6 m up;
 *  - side:   a big side face at chest height, far from any edge or crease;
 *  - edge:   a side face within 5 mm of a sharp convex edge (0 to 5 mm across the grid);
 *  - crease: a side face within 5 mm of a concave crease;
 *  - bottom: a down-facing face under the machine, 0.25 m up (the soot and drip side);
 *  - splash: a side face 10 cm above the foot (the mud and splash side).
 *
 * Pure and deterministic: it reads the same noise and tile sources as `materialAt`, at 24 x 24 points per zone, and returns plain
 * numbers (0 to 1) so a test, a script or an agent can assert on them.
 */

import type { Channels, MaterialSpec, NoiseSource, SamplePoint, TileSource } from './index';
import { EDGE_BAND } from './constants';
import { layerWeight, materialAt, surfaceAt } from './index';

/** The places a coverage report samples. */
export const COVERAGE_ZONES = ['top', 'side', 'edge', 'crease', 'bottom', 'splash'] as const;
export type CoverageZone = (typeof COVERAGE_ZONES)[number];

/** Points across each zone's grid (24 x 24 = 576 samples per zone: enough to see a patch, cheap enough for a slider). */
export const COVERAGE_GRID = 24;

/** The machine the report is taken on, in metres. */
export const COVERAGE_MACHINE = Object.freeze({ width: 2.4, depth: 2.4, height: 2.8, foot: 0.1 });

/** What one layer covers, 0 to 1, per zone. */
export interface LayerCoverage {
  readonly name: string;
  readonly zones: Readonly<Record<CoverageZone, number>>;
}

/** A material's report: its layers' coverage, and the blended look at the four probes a check cares about. */
export interface MaterialCoverage {
  readonly layers: readonly LayerCoverage[];
  /** Highest metal found anywhere on the edge zone (does the abrasion expose bare metal?), 0 to 1. */
  readonly edgeMetal: number;
  /** Mean metal on the edge zone, 0 to 1. */
  readonly edgeMetalMean: number;
  /** Mean metal on a plain side face, 0 to 1. */
  readonly sideMetal: number;
  /** Mean roughness on the top and on the splash zone, 0 to 1. */
  readonly topRough: number;
  readonly splashRough: number;
  /** Mean colour luminance (linear) per zone, 0 to 1: a hopper that reads as a light tray shows up here. */
  readonly zoneLuminance: Readonly<Record<CoverageZone, number>>;
}

/** The sample points of one zone, on the synthetic machine. */
export function coveragePoints(zone: CoverageZone, grid = COVERAGE_GRID): SamplePoint[] {
  const { width, depth, height, foot } = COVERAGE_MACHINE;
  const points: SamplePoint[] = [];
  for (let i = 0; i < grid; i += 1) {
    for (let j = 0; j < grid; j += 1) {
      const u = (i + 0.5) / grid, v = (j + 0.5) / grid;
      switch (zone) {
        case 'side':
          points.push({ uv: [u * width, v * height], pos: [u * width, foot + v * (height - foot), depth], normal: [0, 0, 1], edge: 1, cavity: 1 });
          break;
        case 'edge':
          // the right-hand edge of that face: 0 to EDGE_BAND across the grid, so the wear's falloff is sampled, not just its peak
          points.push({ uv: [u * width, v * height], pos: [u * width, foot + v * (height - foot), depth], normal: [0, 0, 1], edge: u * EDGE_BAND, cavity: 1 });
          break;
        case 'crease':
          points.push({ uv: [u * width, v * height], pos: [u * width, foot + v * (height - foot), depth], normal: [0, 0, 1], edge: 1, cavity: u * EDGE_BAND });
          break;
        case 'top':
          points.push({ uv: [u * width, v * depth], pos: [u * width, height - 0.2, v * depth], normal: [0, 1, 0], edge: 1, cavity: 1 });
          break;
        case 'bottom':
          points.push({ uv: [u * width, v * depth], pos: [u * width, foot + 0.15, v * depth], normal: [0, -1, 0], edge: 1, cavity: 1 });
          break;
        case 'splash':
          points.push({ uv: [u * width, v * 0.2], pos: [u * width, foot, depth], normal: [0, 0, 1], edge: 1, cavity: 1 });
          break;
      }
    }
  }
  return points;
}

const luminance = (c: Channels['colour']): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The coverage report for a material, on the synthetic machine. */
export function coverage(m: MaterialSpec, tiles: TileSource, noise: NoiseSource, grid = COVERAGE_GRID): MaterialCoverage {
  const points = Object.fromEntries(COVERAGE_ZONES.map((zone) => [zone, coveragePoints(zone, grid)])) as Record<CoverageZone, SamplePoint[]>;
  const layers = m.layers.slice(0, 6).map((layer) => {
    const zones = {} as Record<CoverageZone, number>;
    for (const zone of COVERAGE_ZONES) {
      let total = 0;
      for (const p of points[zone]) total += layerWeight(layer, surfaceAt(layer.surface, p, m.paint, tiles).height, p, m.age, noise);
      zones[zone] = total / points[zone].length;
    }
    return { name: layer.name, zones };
  });

  const stat = (zone: CoverageZone): { metal: number; peak: number; rough: number; lum: number } => {
    let metal = 0, peak = 0, rough = 0, lum = 0;
    for (const p of points[zone]) {
      const c = materialAt(m, p, tiles, noise);
      metal += c.metal;
      rough += c.rough;
      lum += luminance(c.colour);
      peak = Math.max(peak, c.metal);
    }
    const n = points[zone].length;
    return { metal: metal / n, peak, rough: rough / n, lum: lum / n };
  };
  const edge = stat('edge'), side = stat('side'), top = stat('top'), splash = stat('splash');
  const zoneLuminance = {} as Record<CoverageZone, number>;
  for (const zone of COVERAGE_ZONES) zoneLuminance[zone] = stat(zone).lum;

  return {
    layers,
    edgeMetal: edge.peak,
    edgeMetalMean: edge.metal,
    sideMetal: side.metal,
    topRough: top.rough,
    splashRough: splash.rough,
    zoneLuminance,
  };
}

/** The mean weight of the named layer in a zone, 0 to 1; 0 when no layer has that name. */
export function coverageOf(report: MaterialCoverage, layerName: string, zone: CoverageZone): number {
  return report.layers.find((l) => l.name === layerName)?.zones[zone] ?? 0;
}
