/**
 * Astro, the player character: the Meshy "Armored Space Suit" on a Mixamo skeleton, in three detail levels.
 * The GLBs are packed by `scripts/pack-character.mjs`: 1024² WebP textures, meshopt geometry, walk and run clips.
 * They are the owner's own Meshy generation, so no third-party credit is needed.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** low = 6k triangles (Graphics Low, the min-spec laptop), mid = 19k, high = 55k (High, and the avatar creator). */
export type AstroLevel = 'low' | 'mid' | 'high';
const URLS: Record<AstroLevel, URL> = {
  low: new URL('./astro-low.glb', import.meta.url),
  mid: new URL('./astro-mid.glb', import.meta.url),
  high: new URL('./astro-high.glb', import.meta.url),
};
/** The rest height of Astro's hips, metres: the scale for clips authored on other Mixamo rigs. */
export const ASTRO_HIPS_Y = 0.916;

export interface AstroTemplate { readonly scene: THREE.Group; readonly clips: readonly THREE.AnimationClip[] }
const cache = new Map<AstroLevel, Promise<AstroTemplate>>();

export function loadAstro(level: AstroLevel): Promise<AstroTemplate> {
  const hit = cache.get(level);
  if (hit) return hit;
  const loading = (async (): Promise<AstroTemplate> => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(URLS[level].href);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; }
    });
    return { scene: gltf.scene, clips: gltf.animations };
  })();
  cache.set(level, loading);
  loading.catch(() => cache.delete(level));
  return loading;
}

/** The level a graphics tier gets: Low on the min-spec laptop, Medium, High. */
export function astroLevelFor(tier: string | undefined): AstroLevel {
  return tier === 'high' || tier === 'ultra' ? 'high' : tier === 'low' || tier === 'potato' ? 'low' : 'mid';
}
