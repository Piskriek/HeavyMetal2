/**
 * The player character's instances. The model is Astro (`../astro/astro-model.ts`); the scientist names stay because
 * the lab, the creator and the animator use them. Astro is the procedural suit and plays the scientist set (`adaptClipsForAstro`).
 *
 * TICKET-05 (OPUS_NOTE_12 Item D, STAGE-04): the default level is 'high' (`scientistLevelFor` drops it to 'mid' only on
 * Low graphics with fps under 30), and `thirdPersonLightRig` lights the avatar on AVATAR_LIGHT_LAYER only. The rig's lights
 * are drawn in their own pass by play-scene (three.js lights are not per object, so they cannot sit on the world's pass).
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ASTRO_HIPS_Y, loadAstro, type AstroLevel } from '../astro/astro-model';

export const animsBinUrl = new URL('./anims.bin', import.meta.url);

/**
 * Dedicated Three.js layer for the third-person avatar and held rifle. Layer 1 is RIFT_LAYER (rift.ts), so the avatar takes
 * layer 2: its own pass draws it with the rig lights, and the rift pass never sees it.
 */
export const AVATAR_LIGHT_LAYER = 2;

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
 * The clips an Astro instance plays: its own set first (the procedural suit, JOB-24, carries none), then the scientist set
 * (`clips`), with its centimetre hips brought to Astro's metres (`hipsInMetres`). Before JOB-24 the GLB carried all fourteen;
 * now every clip is a fallback.
 */
export function adaptClipsForAstro(
  root: THREE.Object3D,
  clips: Map<string, THREE.AnimationClip>
): Map<string, THREE.AnimationClip> {
  const own = (root.userData.astroClips as readonly THREE.AnimationClip[] | undefined) ?? [];
  const out = new Map<string, THREE.AnimationClip>();
  for (const c of own) out.set(c.name.toLowerCase(), c);
  for (const [name, clip] of clips) if (!out.has(name)) out.set(name, hipsInMetres(clip));
  return out;
}

/**
 * The scientist set (HMAN v1) carries the Mixamo hips in centimetres, about 100 standing, for a rig the old scientist GLB
 * scaled by 0.01. Astro's procedural rig (JOB-24) is in metres with its hips at ASTRO_HIPS_Y, and since the suit became
 * code it carries no clips of its own, so every idle, gesture and walk is a fallback from that set: played as they are,
 * they stood the player's body and the companion's 100 m above their feet (only the companion's name tag, which hangs
 * off its holder, stayed in view). A hips track in centimetres is scaled by ASTRO_HIPS_Y over the source's 100 cm (the
 * old rifle scaler's rule, TASK-21). Metre tracks (the rifle set, HMAN v2) are left as they are. The shared clip is never
 * changed: the scaled copy is made once per clip and shared by every instance.
 */
const SOURCE_HIPS_CM = 100;
/** A hips height above this many units is centimetres (a metre rig's hips stand near 1). */
const CENTIMETRE_HIPS_ABOVE = 10;
const metreCopies = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();
export function hipsInMetres(clip: THREE.AnimationClip): THREE.AnimationClip {
  const done = metreCopies.get(clip);
  if (done) return done;
  const hips = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  let tall = 0;
  if (hips) for (let i = 1; i < hips.values.length; i += 3) tall = Math.max(tall, Math.abs(hips.values[i]!));
  if (!hips || tall <= CENTIMETRE_HIPS_ABOVE) {
    metreCopies.set(clip, clip);
    return clip;
  }
  const copy = clip.clone();
  const k = ASTRO_HIPS_Y / SOURCE_HIPS_CM;
  for (const track of copy.tracks) {
    if (track.name !== 'mixamorigHips.position') continue;
    for (let i = 0; i < track.values.length; i++) track.values[i] = track.values[i]! * k;
  }
  metreCopies.set(clip, copy);
  return copy;
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
 * Creates a camera-following 3-point light rig (key, rim, and hemisphere fill) on `AVATAR_LIGHT_LAYER` only.
 * The rig hangs off the camera and is never enabled on the camera itself, so the world pass (layer 0) does not collect
 * these lights; play-scene draws the avatar layer in a second pass that does (the avatar and held rifle at 3 m).
 */
export function thirdPersonLightRig(camera: THREE.Camera): ThirdPersonLightRig {
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
