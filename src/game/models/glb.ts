/**
 * GLB models (the Meshy kit: ramps, bridges, caves…). Each file is fetched and parsed once; every
 * placement gets its own clone that shares the geometry and textures, so a hundred bridges cost one.
 * Presentation only: collision for these pieces comes from simple shapes in the track data, never
 * from the mesh, so the sim stays deterministic.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

/** Loads a GLB once and resolves to its scene (do not add this to a scene: use cloneGlb). */
export function loadGlb(url: string): Promise<THREE.Group> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((gltf) => {
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat?.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      });
      return gltf.scene;
    });
    // A failed load is retried next time instead of being cached as a failure.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** A placement of a loaded model: shares geometry and materials with every other copy. */
export async function cloneGlb(url: string): Promise<THREE.Object3D> {
  return (await loadGlb(url)).clone(true);
}

/** The model's size in its own units (Meshy models are about 2 units across). */
export function glbBounds(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}
