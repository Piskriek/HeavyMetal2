// ============================================================================
// File: apps/web/src/play/window-f-lab-and-coop-hooks.ts
// TICKET-19 (Window F):
// Builder and runtime hooks for play-scene.ts Window F:
// - POL-22: Scientist Low-LOD mesh simplification & first-person visibility gate
//   (skip drawing the Scientist in first-person unless shadow casting is active).
// - POL-171: Send the Moon Twin Gate pose with the initial room seed when hosted.
// - POL-172: Send a "left the plot" (inLab: true) presence update when entering
//   the Lab so remote peers immediately hide the stale avatar on the plot.
// - POL-173: Allow both Lead Architect ('owner') and Co-Builder ('cobuilder')
//   roles to sync terrain sculpt strokes through the Outpost session.
// ============================================================================

import type * as THREE from 'three';
import {
  buildInitialHostSeedFrames,
  buildOutboundPresencePacket,
  canRoleSculptTerrain,
  type GatePoseSpec,
  type OutpostRole,
} from '@hm/coopnet/sculpt-and-pad-sync';

export interface ScientistVisibilityOptions {
  readonly where: 'lab' | 'planet' | string;
  readonly cameraView: 'first' | 'third';
  readonly quality: 'low' | 'medium' | 'high' | string;
  readonly castShadowInFirstPerson?: boolean;
  readonly altCamActive?: boolean;
}

/**
 * POL-22: Determines whether the Scientist avatar should be drawn this frame
 * and whether its Low-LOD simplification should be active.
 * In first-person (`cameraView === 'first'`) without an active alternate camera
 * or first-person shadow pass, the Scientist is skipped entirely to save skinning
 * and draw calls in the Lab on Low quality.
 */
export function resolveScientistRenderState(opts: ScientistVisibilityOptions): {
  readonly visible: boolean;
  readonly useLowLod: boolean;
  readonly disableMorphAndSecondaryBones: boolean;
} {
  const isLow = opts.quality === 'low';
  if (opts.cameraView === 'first' && !opts.altCamActive && !opts.castShadowInFirstPerson) {
    return {
      visible: false,
      useLowLod: isLow,
      disableMorphAndSecondaryBones: isLow,
    };
  }
  return {
    visible: true,
    useLowLod: isLow,
    disableMorphAndSecondaryBones: isLow,
  };
}

/**
 * POL-22: Applies the first-person visibility gate and Low-LOD shadow/skinning trim
 * to the Scientist avatar root group in `play-scene.ts` (Window F).
 */
export function applyScientistWindowFGate(
  avatarRoot: THREE.Object3D | null,
  opts: ScientistVisibilityOptions,
): boolean {
  if (!avatarRoot) return false;
  const state = resolveScientistRenderState(opts);
  avatarRoot.visible = state.visible;
  if (state.visible && state.useLowLod) {
    avatarRoot.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
  }
  return state.visible;
}

export interface WindowFCoopSyncController {
  /** POL-171: Call when seeding a newly hosted Outpost room so the Gate pose lands with the seed. */
  buildSeedPayloads<TWorld>(world: TWorld, gate: GatePoseSpec, seed?: number, sculpt?: string): ReturnType<typeof buildInitialHostSeedFrames<TWorld>>;
  /** POL-172: Call each presence tick; sends one `inLab: true` clear packet when stepping into the Lab, then stops sending poses until back on the plot. */
  nextPosePacket(
    where: 'lab' | 'planet' | string,
    pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } | null,
    look?: string,
  ): ReturnType<typeof buildOutboundPresencePacket> | null;
  /** POL-173: Returns true when this player's role ('owner' or 'cobuilder') should broadcast terrain sculpt edits to the room. */
  shouldBroadcastSculpt(role: OutpostRole, beamFieldReady: boolean): boolean;
}

/**
 * Creates the stateful Window F co-op synchronization bridge used by the play screen.
 */
export function createWindowFCoopSyncController(): WindowFCoopSyncController {
  let sentLabExitPacket = false;

  return {
    buildSeedPayloads(world, gate, seed = 7, sculpt = '') {
      return buildInitialHostSeedFrames(world, gate, seed, sculpt);
    },
    nextPosePacket(where, pose, look = 'default') {
      if (where !== 'planet' || pose === null) {
        if (sentLabExitPacket) {
          // Already notified the room that this peer left the plot for the Lab (POL-172)
          return null;
        }
        sentLabExitPacket = true;
        return buildOutboundPresencePacket('lab', null, look);
      }
      sentLabExitPacket = false;
      return buildOutboundPresencePacket('planet', pose, look);
    },
    shouldBroadcastSculpt(role, beamFieldReady) {
      return beamFieldReady && canRoleSculptTerrain(role);
    },
  };
}
