import type { ScatterRule } from './types';

/**
 * Ready-made rules for the starter island palette. Surface ids: seabed 1, sand 2, wet sand 3, grass 4,
 * rock 5, cliff 6, basalt 7, dunes 8, mud 9, strata 10, moss 11, coral 12, lava 13, scree 14, pumice 15, soil 16.
 * Order matters: earlier rules claim space first.
 */
export const TROPICAL_RULES: ScatterRule[] = [
  { id: 'palm', surfaces: [2, 8, 4], minHeight: 0.8, maxHeight: 9, maxSlopeDeg: 25, density: 34, minSpacing: 4.2, scale: [0.75, 1.45], clump: { size: 38, cover: 0.25 } },
  { id: 'bush', surfaces: [4, 11, 16], minHeight: 0.5, maxHeight: 40, maxSlopeDeg: 30, density: 40, minSpacing: 3, scale: [0.55, 1.15], clump: { size: 24, cover: 0.3 } },
  { id: 'tuft', surfaces: [4, 2], minHeight: 0.3, maxHeight: 40, maxSlopeDeg: 40, density: 22, minSpacing: 1.4, scale: [0.6, 1.2] },
  { id: 'boulder', surfaces: [5, 14, 7, 10, 4], minHeight: 0.5, maxHeight: 40, maxSlopeDeg: 55, density: 2, minSpacing: 6, scale: [0.8, 2.4] },
  { id: 'reeds', surfaces: [3, 9], minHeight: -0.2, maxHeight: 1.2, maxSlopeDeg: 12, density: 10, minSpacing: 2.2, scale: [0.8, 1.2] },
  { id: 'tiki', surfaces: [2], minHeight: 0.4, maxHeight: 6, maxSlopeDeg: 15, density: 0.25, minSpacing: 30, scale: [1, 1.3] },
];
