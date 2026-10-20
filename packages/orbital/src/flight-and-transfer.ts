// ============================================================================
// File: packages/orbital/src/flight-and-transfer.ts
// TICKET-28 (POL-14 — Inter-Planetary Spaceflight & Multiverse Orbital Traversal):
// Pure deterministic orbital ascent, ground-to-orbit crossfade, and Multiverse
// `SMX-PLN-XXXX` planet landing transfer engine:
// 1. Altitude Bands:
//    - Surface Flight (`0..120 m`): standard lunar gravity and chunked PlotGround.
//    - Atmospheric Pitch-Up Crossfade (`120..420 m`): seamlessly cross-fades
//      `PlotGround` into the 3D spherical `PlanetForge` globe and orbital starfield.
//    - Orbital Starfield Cruise (`> 420 m`): zero-G orbital flight between
//      published Planet Forge worlds (`SMX-PLN-XXXX`).
// 2. Approach & Landing Transfer:
//    Flying within `approachRadiusM` (`180 m`) of an orbital planet locks its
//    approach ring and transfers the session to that world's procedural terrain
//    `seed`, `mantleCartridge` (`@hm/vault`), and `atmosphereHueDeg`.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

export const SURFACE_CEILING_M = 120;
export const ORBIT_INSERTION_M = 420;
export const PLANET_APPROACH_RADIUS_M = 180;

export interface OrbitalDestination {
  readonly code: string;
  readonly name: string;
  readonly seed: number;
  readonly mantleCartridge: 'anorthosite' | 'basalt' | 'olivine' | 'obsidian' | 'quartz';
  readonly atmosphereHueDeg: number;
  readonly hasRings: boolean;
  readonly orbitPos: { readonly x: number; readonly y: number; readonly z: number };
}

export const CANONICAL_MULTIVERSE_PLANETS: readonly OrbitalDestination[] = [
  {
    code: 'SMX-PLN-0001-SELENE',
    name: 'Selene Outpost (Lunar Sector 4)',
    seed: 7,
    mantleCartridge: 'anorthosite',
    atmosphereHueDeg: 205,
    hasRings: false,
    orbitPos: { x: 0, y: 600, z: 0 },
  },
  {
    code: 'SMX-PLN-1042-IGNIS',
    name: 'Ignis-IV',
    seed: 1042,
    mantleCartridge: 'obsidian',
    atmosphereHueDeg: 18,
    hasRings: true,
    orbitPos: { x: 1450, y: 780, z: -1820 },
  },
  {
    code: 'SMX-PLN-2088-VERDANT',
    name: 'Verdant-Prime',
    seed: 2088,
    mantleCartridge: 'olivine',
    atmosphereHueDeg: 135,
    hasRings: false,
    orbitPos: { x: -1680, y: 840, z: -1540 },
  },
  {
    code: 'SMX-PLN-3110-THALASSA',
    name: 'Thalassa-Atoll',
    seed: 3110,
    mantleCartridge: 'quartz',
    atmosphereHueDeg: 195,
    hasRings: true,
    orbitPos: { x: 2100, y: 920, z: 1120 },
  },
  {
    code: 'SMX-PLN-4096-LUMEN',
    name: 'Lumen-IX',
    seed: 4096,
    mantleCartridge: 'basalt',
    atmosphereHueDeg: 285,
    hasRings: true,
    orbitPos: { x: -1950, y: 960, z: 1640 },
  },
];

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * POL-14: Computes the continuous ground-to-orbit visual crossfade parameters
 * for a given shuttle altitude `altitudeM` above the lunar surface.
 */
export function computeGroundToOrbitCrossfade(altitudeM: number): {
  readonly phase: 'surface' | 'ascent-crossfade' | 'orbit';
  readonly orbitBlend01: number;
  readonly groundChunkOpacity: number;
  readonly starfieldOpacity: number;
  readonly planetGlobeScale: number;
  readonly gravityScale: number;
} {
  const y = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0;
  if (y <= SURFACE_CEILING_M) {
    return {
      phase: 'surface',
      orbitBlend01: 0,
      groundChunkOpacity: 1,
      starfieldOpacity: 0,
      planetGlobeScale: 0,
      gravityScale: 1,
    };
  }
  if (y >= ORBIT_INSERTION_M) {
    return {
      phase: 'orbit',
      orbitBlend01: 1,
      groundChunkOpacity: 0,
      starfieldOpacity: 1,
      planetGlobeScale: 1,
      gravityScale: 0,
    };
  }
  const u = (y - SURFACE_CEILING_M) / (ORBIT_INSERTION_M - SURFACE_CEILING_M);
  const blend = Number(smoothstep01(u).toFixed(4));
  return {
    phase: 'ascent-crossfade',
    orbitBlend01: blend,
    groundChunkOpacity: Number((1 - blend).toFixed(4)),
    starfieldOpacity: blend,
    planetGlobeScale: blend,
    gravityScale: Number((1 - blend).toFixed(4)),
  };
}

export interface ShuttleFlightState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly pitch: number;
  readonly yaw: number;
}

/**
 * POL-14: Steps the Orbital Shuttle's 3D position and velocity under thrust (`0..1`),
 * vertical climb (`-1..1`), pitch, and yaw for `dtSec` seconds.
 */
export function stepOrbitalShuttleFlight(
  state: ShuttleFlightState,
  controls: {
    readonly thrust01: number;
    readonly climb: number;
    readonly pitchDelta: number;
    readonly yawDelta: number;
  },
  dtSec: number,
): ShuttleFlightState {
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? Math.min(0.25, dtSec) : 0;
  if (dt <= 0) return state;

  const pitch = Math.max(-1.35, Math.min(1.35, state.pitch + controls.pitchDelta));
  const yaw = state.yaw + controls.yawDelta;
  const thrust = Math.max(0, Math.min(1, controls.thrust01)) * 48; // m/s^2 main thruster
  const verticalBoost = Math.max(-1, Math.min(1, controls.climb)) * 28;

  const { gravityScale } = computeGroundToOrbitCrossfade(state.y);
  const lunarGravity = 3.2 * gravityScale;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  const ax = sinY * cosP * thrust;
  const ay = sinP * thrust + verticalBoost - lunarGravity;
  const az = -cosY * cosP * thrust;

  const drag = Math.pow(0.92, dt * 10);
  const vx = (state.vx + ax * dt) * drag;
  const vy = (state.vy + ay * dt) * drag;
  const vz = (state.vz + az * dt) * drag;

  const x = state.x + vx * dt;
  const y = Math.max(0, state.y + vy * dt);
  const z = state.z + vz * dt;

  return { x, y, z, vx, vy, vz, pitch, yaw };
}

/**
 * Parses a Planet Forge share code (`SMX-PLN-XXXX-NAME`) into an `OrbitalDestination`.
 */
export function parsePlanetForgeShareCode(
  code: string,
  index = 0,
): OrbitalDestination | null {
  const clean = code.trim().toUpperCase();
  const m = /^SMX-PLN-(\d{4})-([A-Z0-9_-]{2,20})$/.exec(clean);
  if (!m) return null;
  const seed = parseInt(m[1]!, 10);
  const rawName = m[2]!.replace(/[-_]+/g, ' ');
  const mantles = ['anorthosite', 'basalt', 'olivine', 'obsidian', 'quartz'] as const;
  const mantleCartridge = mantles[seed % mantles.length]!;
  const angle = ((seed * 137.5) * Math.PI) / 180 + index * 1.1;
  const radius = 1600 + (seed % 7) * 280;
  return {
    code: clean,
    name: rawName,
    seed,
    mantleCartridge,
    atmosphereHueDeg: (seed * 47) % 360,
    hasRings: seed % 2 === 0,
    orbitPos: {
      x: Math.round(Math.cos(angle) * radius),
      y: 750 + (seed % 5) * 60,
      z: Math.round(Math.sin(angle) * radius),
    },
  };
}

/**
 * Checks whether the shuttle at `(x, y, z)` has entered the orbital approach lock ring
 * (`<= 180 m`) of any destination planet in `destinations`.
 */
export function findLockedApproachPlanet(
  shuttlePos: { readonly x: number; readonly y: number; readonly z: number },
  destinations: readonly OrbitalDestination[] = CANONICAL_MULTIVERSE_PLANETS,
  approachRadiusM = PLANET_APPROACH_RADIUS_M,
): OrbitalDestination | null {
  if (shuttlePos.y < ORBIT_INSERTION_M) return null;
  let best: OrbitalDestination | null = null;
  let bestDist = approachRadiusM;
  for (const dest of destinations) {
    const d = Math.hypot(
      shuttlePos.x - dest.orbitPos.x,
      shuttlePos.y - dest.orbitPos.y,
      shuttlePos.z - dest.orbitPos.z,
    );
    if (d <= bestDist) {
      bestDist = d;
      best = dest;
    }
  }
  return best;
}
