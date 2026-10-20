// ============================================================================
// File: apps/web/src/play/window-i-orbital-flight-hooks.ts
// TICKET-28 (Window I Hooks for `play-scene.ts` — POL-14 Orbital Multiverse Flight):
// Keeps `play-scene.ts` edits under 14 lines by encapsulating the Orbital Shuttle
// ascent physics, ground-to-orbit crossfade (`PlotGround` <-> 3D celestial globe),
// and `SMX-PLN-XXXX` landing seed/mantle swap inside `createOrbitalFlightDirector`.
// ============================================================================

import {
  CANONICAL_MULTIVERSE_PLANETS,
  computeGroundToOrbitCrossfade,
  findLockedApproachPlanet,
  parsePlanetForgeShareCode,
  stepOrbitalShuttleFlight,
  type OrbitalDestination,
  type ShuttleFlightState,
} from '@hm/orbital/flight-and-transfer';

export {
  CANONICAL_MULTIVERSE_PLANETS,
  computeGroundToOrbitCrossfade,
  findLockedApproachPlanet,
  parsePlanetForgeShareCode,
  stepOrbitalShuttleFlight,
  type OrbitalDestination,
  type ShuttleFlightState,
};

export interface OrbitalFlightDirector {
  isActive(): boolean;
  launch(startPos: { readonly x: number; readonly y: number; readonly z: number }, yaw: number): void;
  step(
    controls: { readonly thrust01: number; readonly climb: number; readonly pitchDelta: number; readonly yawDelta: number },
    dtSec: number,
  ): {
    readonly state: ShuttleFlightState;
    readonly crossfade: ReturnType<typeof computeGroundToOrbitCrossfade>;
    readonly approachTarget: OrbitalDestination | null;
  };
  landOnApproachedPlanet(): OrbitalDestination | null;
}

export function createOrbitalFlightDirector(
  customPlanetCodes: readonly string[] = [],
): OrbitalFlightDirector {
  const customDests = customPlanetCodes
    .map((c, idx) => parsePlanetForgeShareCode(c, idx))
    .filter((d): d is OrbitalDestination => d !== null);
  const destinations: readonly OrbitalDestination[] = [
    ...CANONICAL_MULTIVERSE_PLANETS,
    ...customDests,
  ];

  let active = false;
  let state: ShuttleFlightState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, pitch: 0, yaw: 0 };
  let approachTarget: OrbitalDestination | null = null;

  return {
    isActive: () => active,
    launch(startPos, yaw) {
      active = true;
      state = {
        x: startPos.x,
        y: Math.max(2, startPos.y),
        z: startPos.z,
        vx: 0,
        vy: 8,
        vz: 0,
        pitch: 0.35,
        yaw,
      };
      approachTarget = null;
    },
    step(controls, dtSec) {
      state = stepOrbitalShuttleFlight(state, controls, dtSec);
      const crossfade = computeGroundToOrbitCrossfade(state.y);
      approachTarget = findLockedApproachPlanet(state, destinations);
      return { state, crossfade, approachTarget };
    },
    landOnApproachedPlanet() {
      if (!approachTarget) return null;
      const landed = approachTarget;
      active = false;
      state = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, pitch: 0, yaw: 0 };
      approachTarget = null;
      return landed;
    },
  };
}
