/**
 * Astro, the player character: the Meshy "Armored Space Suit" on a Mixamo skeleton, in three detail levels.
 * The GLBs are packed by `scripts/pack-character.mjs`: 1024² WebP textures, meshopt geometry, walk and run clips.
 * They are the owner's own Meshy generation, so no third-party credit is needed.
 *
 * Only the low level is inlined into the single file, so the game is complete without anything else. Mid and high live
 * in the optional HD pack beside index.html (`hd/astro/`), like the generated assets' upper levels: the single file's
 * 16 MB cap (Argo's DEC-10, Opus's review O5). Without the pack, or opened from disk, they fall back to low.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { probeHd } from '../../assets/gen';

/** low = 6k triangles (Graphics Low, the min-spec laptop), mid = 19k, high = 55k (High, and the avatar creator). */
export type AstroLevel = 'low' | 'mid' | 'high';
const LOW_URL = new URL('./astro-low.glb', import.meta.url);
const hdUrl = (level: Exclude<AstroLevel, 'low'>): string =>
  new URL(`hd/astro/${level}.glb`, typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href;
/** The rest height of Astro's hips, metres: the scale for clips authored on other Mixamo rigs. */
export const ASTRO_HIPS_Y = 0.916;

export interface AstroTemplate { readonly scene: THREE.Group; readonly clips: readonly THREE.AnimationClip[] }
const cache = new Map<AstroLevel, Promise<AstroTemplate>>();

async function read(url: string): Promise<AstroTemplate> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; }
  });
  return { scene: gltf.scene, clips: gltf.animations };
}

/** Astro at a level. Mid and high come from the HD pack; when it is missing or the file fails, they share low's template. */
export function loadAstro(level: AstroLevel): Promise<AstroTemplate> {
  const hit = cache.get(level);
  if (hit) return hit;
  const loading = level === 'low'
    ? read(LOW_URL.href)
    : probeHd()
      .then((hd) => (hd ? read(hdUrl(level)) : Promise.reject(new Error('no HD pack'))))
      .catch(() => loadAstro('low'));
  cache.set(level, loading);
  loading.catch(() => cache.delete(level));
  return loading;
}

/** The level a graphics tier gets: Low on the min-spec laptop, Medium, High. */
export function astroLevelFor(tier: string | undefined): AstroLevel {
  return tier === 'high' || tier === 'ultra' ? 'high' : tier === 'low' || tier === 'potato' ? 'low' : 'mid';
}
