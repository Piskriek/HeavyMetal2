/**
 * T05 — public release API.
 *
 * Everything here is pure: no DOM, no canvas, no three.js, no React. The engine's release
 * flow goes through these modules, and the test suites exercise them headlessly.
 *
 * Import path: `import { buildFrozenGrid, computeReleasePlan, GoClock } from '@/game/release';`
 */

export * from './grid';
export * from './scheduler';
export * from './go-clock';
