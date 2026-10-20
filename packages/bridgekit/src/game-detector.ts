// ============================================================================
// File: packages/bridgekit/src/game-detector.ts
// TICKET-27 (POL-13, POL-23 & 4-Rung Junked-Model Containment Leak Restoration):
// Pure deterministic module for:
// 1. POL-13 (Running-Game Auto-Detector & Cross-Game Asset Bridge, OWNER_ASKS 2026-10-07):
//    Matches OS process names (`UnrealEditor.exe`, `Unity.exe`, `Godot.exe`,
//    `javaw.exe`, `blender.exe`, `hl2.exe`, `quake2.exe`) from a local loopback
//    scan and synthesizes live `.smx` cartridges (`bridge:unreal-lumen`,
//    `bridge:godot-sdfgi`, `bridge:minecraft-voxel`, etc.) that the player can
//    slot directly into the Extraction Beam Rifle.
// 2. Junked-Model Containment Leak Restoration Ladder (OWNER_ASKS 2026-10-12):
//    Advances a wreck site up the 4-rung fidelity ladder (`Rung 0: Broken Junk` ->
//    `Rung 1: Standard Low` -> `Rung 2: RUN.world HD` -> `Rung 3: Meshy.ai Max Tier`)
//    once its containment leak is sealed and the player applies the Fidelity Beam.
// 3. POL-23: Multi-shard square-faceted crystal cluster specs replacing single
//    primitive stand-ins for `pxd`, `vtx`, `lx`, and `aq` anomaly field nodes.
// Zero DOM, zero Three.js, zero Date/Math.random.
// ============================================================================

export interface BridgeGameSignature {
  readonly id: string;
  readonly processTokens: readonly string[];
  readonly displayName: string;
  readonly engine: string;
  readonly unlockedCartridgeId: string;
  readonly unlockedCartridgeName: string;
  readonly metricColour: string;
}

export const KNOWN_BRIDGE_GAMES: readonly BridgeGameSignature[] = [
  {
    id: 'unreal',
    processTokens: ['unrealeditor', 'unrealengine', 'ue4editor'],
    displayName: 'Unreal Engine Editor',
    engine: 'Unreal 5',
    unlockedCartridgeId: 'bridge:unreal-lumen',
    unlockedCartridgeName: 'Lumen Radiance Cartridge (.smx)',
    metricColour: '#ffc13d',
  },
  {
    id: 'godot',
    processTokens: ['godot', 'godot_v4'],
    displayName: 'Godot Engine',
    engine: 'Godot 4',
    unlockedCartridgeId: 'bridge:godot-sdfgi',
    unlockedCartridgeName: 'SDFGI Voxel Cascade Cartridge (.smx)',
    metricColour: '#3dc8ff',
  },
  {
    id: 'minecraft',
    processTokens: ['javaw', 'minecraft'],
    displayName: 'Minecraft (JVM)',
    engine: 'LWJGL / Voxel',
    unlockedCartridgeId: 'bridge:minecraft-voxel',
    unlockedCartridgeName: 'Overworld Block Substrate (.smx)',
    metricColour: '#7cff4d',
  },
  {
    id: 'unity',
    processTokens: ['unity', 'unityhub'],
    displayName: 'Unity Editor',
    engine: 'Unity URP/HDRP',
    unlockedCartridgeId: 'bridge:unity-shadergraph',
    unlockedCartridgeName: 'ShaderGraph Surface Preset (.smx)',
    metricColour: '#ff3d8a',
  },
  {
    id: 'blender',
    processTokens: ['blender'],
    displayName: 'Blender 3D',
    engine: 'Cycles / EEVEE',
    unlockedCartridgeId: 'bridge:blender-geometry-nodes',
    unlockedCartridgeName: 'Geometry Nodes Mesh Splice (.smx)',
    metricColour: '#b46bff',
  },
  {
    id: 'idtech',
    processTokens: ['quake2', 'gzdoom', 'doom', 'hl2'],
    displayName: 'Retro Shareware / Source Engine',
    engine: 'idTech / Source',
    unlockedCartridgeId: 'bridge:shareware-paletted',
    unlockedCartridgeName: '256-ColourColormap Cartridge (.smx)',
    metricColour: '#ff7b3d',
  },
];

/**
 * POL-13: Scans a list of process names or command lines (from `tasklist` / `ps`
 * via `/__studio/bridge/running-games`) and returns all detected bridge games and
 * their auto-mounted `.smx` cartridges.
 */
export function detectRunningBridgeGames(processNames: readonly string[]): {
  readonly connected: boolean;
  readonly detectedGames: readonly BridgeGameSignature[];
  readonly unlockedCartridges: readonly string[];
} {
  const normalized = processNames.map((p) => p.toLowerCase());
  const detected: BridgeGameSignature[] = [];

  for (const sig of KNOWN_BRIDGE_GAMES) {
    const matched = sig.processTokens.some((tok) =>
      normalized.some((line) => line.includes(tok)),
    );
    if (matched) {
      detected.push(sig);
    }
  }

  return {
    connected: detected.length > 0,
    detectedGames: detected,
    unlockedCartridges: detected.map((d) => d.unlockedCartridgeId),
  };
}

// ---- 4-Rung Junked-Model Containment Leak Restoration Ladder (OWNER_ASKS 2026-10-12)

export type WreckRestorationRung = 0 | 1 | 2 | 3;

export interface WreckLadderStepSpec {
  readonly rung: WreckRestorationRung;
  readonly tierName: 'broken-junk' | 'standard-low' | 'runworld-hd' | 'meshy-max';
  readonly assetSubfolder: 'old' | 'low' | 'mid' | 'high';
  readonly beamSecondsToNext: number;
}

export const WRECK_RESTORATION_LADDER: Readonly<Record<WreckRestorationRung, WreckLadderStepSpec>> = {
  0: { rung: 0, tierName: 'broken-junk',  assetSubfolder: 'old',  beamSecondsToNext: 1.5 },
  1: { rung: 1, tierName: 'standard-low', assetSubfolder: 'low',  beamSecondsToNext: 2.0 },
  2: { rung: 2, tierName: 'runworld-hd',  assetSubfolder: 'mid',  beamSecondsToNext: 2.5 },
  3: { rung: 3, tierName: 'meshy-max',    assetSubfolder: 'high', beamSecondsToNext: 0 },
};

/**
 * Computes a wreck site's restoration rung (`0..3`) and progress toward the next tier when
 * the player seals its containment leak and applies the Fidelity Beam for `beamSeconds`.
 */
export function evaluateWreckRestorationRung(params: {
  readonly leakSealed: boolean;
  readonly beamSecondsApplied: number;
  readonly meshyMaxAvailable?: boolean;
}): {
  readonly rung: WreckRestorationRung;
  readonly spec: WreckLadderStepSpec;
  readonly fullyRestored: boolean;
} {
  if (!params.leakSealed) {
    return { rung: 0, spec: WRECK_RESTORATION_LADDER[0], fullyRestored: false };
  }
  const t = Math.max(0, Number.isFinite(params.beamSecondsApplied) ? params.beamSecondsApplied : 0);
  const maxRung: WreckRestorationRung = params.meshyMaxAvailable === false ? 2 : 3;

  let rung: WreckRestorationRung = 1; // Sealing the leak immediately lifts Rung 0 -> Rung 1
  if (t >= 2.0) rung = 2;
  if (t >= 4.5 && maxRung >= 3) rung = 3;

  return {
    rung,
    spec: WRECK_RESTORATION_LADDER[rung],
    fullyRestored: rung === maxRung,
  };
}

// ---- POL-23: Multi-Shard Square-Faceted Anomaly Node Cluster Specs

export interface AnomalyShardSpec {
  readonly offset: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly tiltRad: readonly [number, number, number];
}

export const ANOMALY_CRYSTAL_CLUSTERS: Readonly<Record<'pxd' | 'vtx' | 'lx' | 'aq', readonly AnomalyShardSpec[]>> = {
  pxd: [
    { offset: [0, 0.55, 0], scale: [0.34, 1.1, 0.34], tiltRad: [0.08, 0.2, -0.06] },
    { offset: [0.24, 0.38, 0.14], scale: [0.22, 0.76, 0.22], tiltRad: [-0.22, 0.5, 0.18] },
    { offset: [-0.22, 0.34, -0.16], scale: [0.20, 0.68, 0.20], tiltRad: [0.18, -0.4, -0.24] },
  ],
  vtx: [
    { offset: [0, 0.60, 0], scale: [0.42, 1.2, 0.42], tiltRad: [0, 0.78, 0] },
    { offset: [0.28, 0.40, -0.18], scale: [0.26, 0.80, 0.26], tiltRad: [0.25, 0.1, 0.22] },
    { offset: [-0.26, 0.42, 0.20], scale: [0.24, 0.84, 0.24], tiltRad: [-0.2, 0.3, -0.25] },
  ],
  lx: [
    { offset: [0, 0.65, 0], scale: [0.28, 1.3, 0.28], tiltRad: [0.04, 0, 0.04] },
    { offset: [0.20, 0.48, 0.20], scale: [0.18, 0.96, 0.18], tiltRad: [0.30, 0.4, 0.20] },
    { offset: [-0.20, 0.45, -0.20], scale: [0.18, 0.90, 0.18], tiltRad: [-0.28, -0.4, -0.20] },
  ],
  aq: [
    { offset: [0, 0.50, 0], scale: [0.38, 1.0, 0.38], tiltRad: [-0.06, 0.4, 0.08] },
    { offset: [0.26, 0.35, 0], scale: [0.25, 0.70, 0.25], tiltRad: [0.15, 0.9, 0.28] },
    { offset: [-0.24, 0.32, 0.18], scale: [0.22, 0.64, 0.22], tiltRad: [-0.18, -0.6, -0.22] },
  ],
};
