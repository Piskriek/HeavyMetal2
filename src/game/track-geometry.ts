/**
 * Shared track primitives: the world frame, the lane geometry and the small impulse
 * helpers. This module is a LEAF — it imports nothing from the game — which is what lets
 * `scene.ts` and `stage-two.ts` both use these values without a circular import.
 *
 * `scene.ts` re-exports everything here, so existing `from './scene'` imports keep working.
 */
export const HEIGHT = 620;
export const GROUND = 478;
export const START_X = 190;
export const START_Y = 325;
export const RADIUS = 31;
export const GRAVITY = 2400;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 240;
export const PLAYER_LANE = 2;
/** Lateral screen-space depth: `near` is closest to the camera, `far` is the wall side. */
export const LANE = { near: -480, far: 480 };
export const laneZ = (lane: number) => LANE.far - LANE_WIDTH * (lane + 0.5);
export const closestLane = (z: number) => Math.max(0, Math.min(3, Math.round((LANE.far - z) / LANE_WIDTH - 0.5)));
export const TERRAIN = GROUND + 154;
export const GRANDSTAND = { z: 350, base: GROUND + 64, height: 217, foundation: TERRAIN, depth: 138 };
export const LAUNCHER = { x: START_X + 128, tipY: GROUND - 241, halfWidth: 91, baseRear: START_X - 95, baseFront: START_X + 165 };
export const AIM_ANCHOR = { x: LAUNCHER.x + 4, y: LAUNCHER.tipY - 7, maxDraw: 220, fullPowerDraw: 200 };
export const weightImpulse = (weight: number) => Math.max(0.68, Math.min(1.45, Math.sqrt(120 / weight)));
