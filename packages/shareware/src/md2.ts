/**
 * Quake 2 MD2 3D Model and Animation Loader.
 * Uses Three.js MD2Loader to construct BufferGeometry with morph targets and animation clips.
 */
import * as THREE from 'three';
import { MD2Loader } from 'three/examples/jsm/loaders/MD2Loader.js';

export interface Md2AnimationInfo {
  readonly name: string;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly fps: number;
}

export interface Md2ParsedModel {
  readonly geometry: THREE.BufferGeometry;
  readonly animations: readonly THREE.AnimationClip[];
  readonly animationNames: readonly string[];
  readonly totalFrames: number;
}

/**
 * Standard Quake 2 animation table for MD2 character models.
 */
export const MD2_ANIMATIONS: readonly Md2AnimationInfo[] = Object.freeze([
  { name: 'stand', startFrame: 0, endFrame: 39, fps: 9 },
  { name: 'run', startFrame: 40, endFrame: 45, fps: 10 },
  { name: 'attack', startFrame: 46, endFrame: 53, fps: 10 },
  { name: 'pain_a', startFrame: 54, endFrame: 57, fps: 7 },
  { name: 'pain_b', startFrame: 58, endFrame: 61, fps: 7 },
  { name: 'pain_c', startFrame: 62, endFrame: 65, fps: 7 },
  { name: 'jump', startFrame: 66, endFrame: 71, fps: 7 },
  { name: 'flip', startFrame: 72, endFrame: 83, fps: 7 },
  { name: 'salute', startFrame: 84, endFrame: 94, fps: 7 },
  { name: 'taunt', startFrame: 95, endFrame: 111, fps: 10 },
  { name: 'wave', startFrame: 112, endFrame: 122, fps: 7 },
  { name: 'point', startFrame: 123, endFrame: 134, fps: 7 },
  { name: 'cr_stand', startFrame: 135, endFrame: 153, fps: 10 },
  { name: 'cr_walk', startFrame: 154, endFrame: 159, fps: 7 },
  { name: 'cr_attack', startFrame: 160, endFrame: 168, fps: 10 },
  { name: 'cr_pain', startFrame: 169, endFrame: 172, fps: 7 },
  { name: 'cr_death', startFrame: 173, endFrame: 177, fps: 7 },
  { name: 'death_a', startFrame: 178, endFrame: 183, fps: 7 },
  { name: 'death_b', startFrame: 184, endFrame: 189, fps: 7 },
  { name: 'death_c', startFrame: 190, endFrame: 197, fps: 7 },
]);

/**
 * Parses an MD2 model ArrayBuffer into geometry and animations.
 */
export function parseMd2(buffer: ArrayBuffer): Md2ParsedModel {
  const loader = new MD2Loader();
  const geometry = loader.parse(buffer);

  const geomWithAnim = geometry as THREE.BufferGeometry & { animations?: THREE.AnimationClip[] };
  const animations: THREE.AnimationClip[] = (geomWithAnim.animations || []) as THREE.AnimationClip[];
  const animationNames = animations.map((a) => a.name);
  const totalFrames = geometry.morphAttributes.position?.length ?? 0;

  return {
    geometry,
    animations: Object.freeze(animations),
    animationNames: Object.freeze(animationNames),
    totalFrames,
  };
}

/**
 * Creates an animated Three.js Mesh from an MD2 model with a diffuse texture.
 */
export function createMd2Mesh(
  model: Md2ParsedModel,
  texture?: THREE.Texture
): { mesh: THREE.Mesh; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction> } {
  const material = new THREE.MeshStandardMaterial({
    map: texture ?? null,
    roughness: 0.8,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(model.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const mixer = new THREE.AnimationMixer(mesh);
  const actions = new Map<string, THREE.AnimationAction>();

  for (const clip of model.animations) {
    const action = mixer.clipAction(clip);
    actions.set(clip.name, action);
  }

  return { mesh, mixer, actions };
}
