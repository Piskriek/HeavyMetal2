// ============================================================================
// File: apps/web/src/avatar/scientist/scientist-model.ts
// TICKET-05 (OPUS_NOTE_12 Item D — STAGE-04):
// - Default avatar level is 'high' regardless of stage (only drops to 'mid' on
//   Low graphics if fps < 30 via scientistLevelFor).
// - thirdPersonLightRig(camera: THREE.Camera): { update(): void; dispose(): void }
//   Key, rim, and hemisphere fill that follow the third-person camera and light
//   only AVATAR_LIGHT_LAYER (layer 1), keeping the world look untouched.
// ============================================================================

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadAstro, type AstroLevel } from '../astro/astro-model';

export const animsBinUrl = new URL('./anims.bin', import.meta.url);

/** Dedicated Three.js layer for the third-person avatar and held rifle so avatar lights never flatten the world. */
export const AVATAR_LIGHT_LAYER = 1;

/** The detail level new instances get: always 'high' by default (TICKET-05 Item D). */
let defaultLevel: AstroLevel = 'high';
export function setScientistLevel(level: AstroLevel): void {
  defaultLevel = level;
}
export function getScientistLevel(): AstroLevel {
  return defaultLevel;
}

/**
 * Resolves the avatar/rifle mesh detail level: always 'high' at every stage,
 * dropping to 'mid' on the 'low' graphics setting only when measured fps < 30.
 */
export function scientistLevelFor(
  graphicsTier: 'low' | 'mid' | 'high' = 'high',
  fps?: number
): AstroLevel {
  if (graphicsTier === 'low' && fps !== undefined && Number.isFinite(fps) && fps < 30) {
    return 'mid';
  }
  return 'high';
}

/** Enables AVATAR_LIGHT_LAYER on an object and all its descendants (whilst keeping layer 0 for world shadows). */
export function enableAvatarLightLayer(root: THREE.Object3D): void {
  root.traverse((obj) => {
    obj.layers.enable(AVATAR_LIGHT_LAYER);
  });
}

/** The template for a level: Astro at 1.70 m, in metres. */
export async function loadScientistTemplate(level: AstroLevel = defaultLevel): Promise<THREE.Group> {
  return (await loadAstro(level)).scene;
}

/**
 * Prepares an instance for the scene: shadows on, AVATAR_LIGHT_LAYER enabled, and the spine bone the lab leans.
 * Astro's suit is one baked material, so a visor colour has no separate part to tint: `visorMaterials` is empty,
 * and callers that set it change nothing.
 */
export function styleScientistGroup(
  group: THREE.Group,
  _visorHex = '#f59e0b'
): { visorMaterials: THREE.MeshStandardMaterial[]; spine: THREE.Bone | null } {
  const spine = (group.getObjectByName('mixamorigSpine') as THREE.Bone) ?? null;
  group.userData.spine = spine;
  group.traverse((c) => {
    c.layers.enable(AVATAR_LIGHT_LAYER);
    const mesh = c as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { visorMaterials: [], spine };
}

/** A new instance of the character. */
export async function createScientistInstance(
  visorHex = '#f59e0b',
  level: AstroLevel = defaultLevel
): Promise<{
  group: THREE.Group;
  visorMaterials: THREE.MeshStandardMaterial[];
  spine: THREE.Bone | null;
}> {
  const astro = await loadAstro(level);
  const group = SkeletonUtils.clone(astro.scene) as THREE.Group;
  group.userData.astroClips = astro.clips;
  const { visorMaterials, spine } = styleScientistGroup(group, visorHex);
  return { group, visorMaterials, spine };
}

/**
 * The clips an Astro instance plays: its own GLB carries the whole set. Walking and Running are Meshy's; the other twelve
 * are the Mixamo set retargeted onto Astro's rig by `scripts/retarget-astro.ts`. The scientist set (`clips`) is only the
 * fallback for a name Astro lacks.
 */
export function adaptClipsForAstro(
  root: THREE.Object3D,
  clips: Map<string, THREE.AnimationClip>
): Map<string, THREE.AnimationClip> {
  const own = (root.userData.astroClips as readonly THREE.AnimationClip[] | undefined) ?? [];
  const out = new Map<string, THREE.AnimationClip>();
  for (const c of own) out.set(c.name.toLowerCase(), c);
  for (const [name, clip] of clips) if (!out.has(name)) out.set(name, clip);
  return out;
}

export interface ThirdPersonLightRig {
  readonly group: THREE.Group;
  readonly key: THREE.DirectionalLight;
  readonly rim: THREE.DirectionalLight;
  readonly fill: THREE.HemisphereLight;
  readonly layer: number;
  update(): void;
  dispose(): void;
}

/**
 * Creates a camera-following 3-point light rig (key, rim, and hemisphere fill) restricted
 * exclusively to `AVATAR_LIGHT_LAYER` (layer 1) so the avatar and held rifle read clearly
 * at 3 m in third-person without illuminating or flattening the planet/lab world meshes.
 */
export function thirdPersonLightRig(camera: THREE.Camera): ThirdPersonLightRig {
  camera.layers.enable(AVATAR_LIGHT_LAYER);

  const group = new THREE.Group();
  group.name = 'third-person-light-rig';
  group.layers.set(AVATAR_LIGHT_LAYER);

  // Warm key light from upper-right of the camera toward the avatar 3 m ahead
  const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
  key.name = 'avatar-key-light';
  key.position.set(1.35, 1.75, 1.4);
  key.target.position.set(0, -0.35, -3.0);
  key.layers.set(AVATAR_LIGHT_LAYER);
  key.target.layers.set(AVATAR_LIGHT_LAYER);

  // Cool cyan rim light from behind-left of the avatar back toward the camera
  const rim = new THREE.DirectionalLight(0x7dd3fc, 1.65);
  rim.name = 'avatar-rim-light';
  rim.position.set(-1.55, 1.25, -4.8);
  rim.target.position.set(0, -0.35, -3.0);
  rim.layers.set(AVATAR_LIGHT_LAYER);
  rim.target.layers.set(AVATAR_LIGHT_LAYER);

  // Soft sky/ground hemisphere fill for helmet & suit shadow relief
  const fill = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.35);
  fill.name = 'avatar-hemi-fill';
  fill.position.set(0, 2.0, 0);
  fill.layers.set(AVATAR_LIGHT_LAYER);

  group.add(key, key.target, rim, rim.target, fill);
  camera.add(group);

  const update = (): void => {
    camera.layers.enable(AVATAR_LIGHT_LAYER);
    if (group.parent !== camera) {
      group.position.copy(camera.position);
      group.quaternion.copy(camera.quaternion);
    }
    group.updateMatrixWorld(true);
  };

  const dispose = (): void => {
    group.removeFromParent();
    key.dispose?.();
    rim.dispose?.();
    fill.dispose?.();
  };

  update();

  return {
    group,
    key,
    rim,
    fill,
    layer: AVATAR_LIGHT_LAYER,
    update,
    dispose,
  };
}
