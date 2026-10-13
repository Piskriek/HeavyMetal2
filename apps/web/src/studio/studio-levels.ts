/**
 * The Studio's own loader for a model file by URL: the archived levels and the new ones the bench serves (`/__studio/bench/file`).
 * The game's loader (assets/gen.ts) reads the packed files by id; this one reads any file the Redo panel points at, so
 * an old model and a new one can be shown side by side. Cached per URL. Dev only: the bench's files exist only there.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();

/** The scene of a GLB at a URL. A failed load is not cached, so a retry can succeed. */
export function loadGlbUrl(url: string): Promise<THREE.Group> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => g.scene);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

/** Forgets the cached files of one asset (after a redo wrote new ones). */
export function forgetLevels(id: string): void {
  for (const k of [...cache.keys()]) if (k.includes(`/file/${id}/`)) cache.delete(k);
}
