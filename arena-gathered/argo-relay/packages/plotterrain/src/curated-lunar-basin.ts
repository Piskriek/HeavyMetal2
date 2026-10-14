// ============================================================================
// File: packages/plotterrain/src/curated-lunar-basin.ts
// Plan: Plan 13 (P1-LAYOUT-04 Curated 1 km Starting Lunar Plot Topology)
// Purity: 100% pure deterministic heightfield & landmark query module.
// ============================================================================

export type PlotLandmarkZone =
  | 'gate-plateau'
  | 'east-hydro-basin'
  | 'nw-ore-ridge'
  | 'perimeter-wreck-rim'
  | 'crater-midlands';

export interface LunarPlotSample {
  heightY: number;
  zone: PlotLandmarkZone;
  oreVeinRichness0to1: number;
  isBelowStage3WaterTable: boolean;
}

export const STAGE3_WATER_TABLE_Y = -1.25;

/**
 * Pure deterministic height & zone sampler for any (x, z) coordinate in meters
 * relative to the Planet Twin Gate at (0, 0).
 */
export function sampleCuratedLunarPlot(x: number, z: number): LunarPlotSample {
  const distFromGate = Math.hypot(x, z);

  // 1. Smooth flat-ish Gate Pad Plateau (0..30m)
  const plateauFlatten = Math.min(1.0, Math.max(0.0, (distFromGate - 26.0) / 14.0));

  // 2. Eastern Low Hydro Basin centered at (x = +62, z = +10), radius ~38m, depth -3.65m
  const distEastBasin = Math.hypot(x - 62.0, z - 10.0);
  const basinBowl =
    distEastBasin < 38.0
      ? -3.65 * Math.pow(Math.cos((distEastBasin / 38.0) * (Math.PI * 0.5)), 2.0)
      : 0.0;

  // 3. North-West Bouldered Ore Ridge centered at (x = -75, z = -65), radius ~45m, height +8.8m
  const distNwRidge = Math.hypot(x - -75.0, z - -65.0);
  const nwRidgeRise =
    distNwRidge < 48.0
      ? 8.8 * Math.pow(Math.cos((distNwRidge / 48.0) * (Math.PI * 0.5)), 1.8)
      : 0.0;

  // 4. Perimeter Wreck & Anomaly Crater Rim (r = 140..220m), peak +14.0m at r = 180m
  const rimDelta = Math.abs(distFromGate - 180.0);
  const perimeterRimRise =
    rimDelta < 55.0
      ? 14.0 * Math.pow(Math.cos((rimDelta / 55.0) * (Math.PI * 0.5)), 2.0)
      : 0.0;

  // Gentle deterministic geological undulation
  const microUndulation =
    (Math.sin(x * 0.045) * Math.cos(z * 0.045) * 0.65 +
      Math.sin((x + z) * 0.11) * 0.22) *
    plateauFlatten;

  const heightY =
    (basinBowl + nwRidgeRise + perimeterRimRise + microUndulation) * plateauFlatten;

  let zone: PlotLandmarkZone = 'crater-midlands';
  if (distFromGate <= 30.0) {
    zone = 'gate-plateau';
  } else if (distEastBasin <= 34.0) {
    zone = 'east-hydro-basin';
  } else if (distNwRidge <= 42.0) {
    zone = 'nw-ore-ridge';
  } else if (distFromGate >= 135.0 && distFromGate <= 225.0) {
    zone = 'perimeter-wreck-rim';
  }

  const oreVeinRichness0to1 =
    zone === 'nw-ore-ridge'
      ? 0.92
      : zone === 'perimeter-wreck-rim'
      ? 0.65
      : zone === 'gate-plateau'
      ? 0.35
      : 0.25;

  return {
    heightY: Number(heightY.toFixed(4)),
    zone,
    oreVeinRichness0to1,
    isBelowStage3WaterTable: heightY < STAGE3_WATER_TABLE_Y,
  };
}
