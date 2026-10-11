/**
 * The generated assets (RUN.world source images, local Hunyuan3D models, scripts/runworld-pack.mjs).
 * Owner, 2026-10-11: "Lean file + HD pack". The low level of every asset is inlined into the single-file build, so
 * the game is complete without anything else. The mid and high levels live in the optional HD pack, `hd/<id>/`
 * beside index.html; when the pack is missing (or the page is opened from disk, where the browser blocks fetches),
 * every request falls back to low.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import registry from './gen/registry.json';

export type GenLevel = 'low' | 'mid' | 'high';
export interface GenInfo {
  readonly class: string;
  /** Real size in metres (x, y, z), as fitted by the post step. */
  readonly size: readonly [number, number, number];
  /** Lattice pieces only: the procedural kit piece's box they were fitted to, and the piece kind. */
  readonly box?: readonly [readonly [number, number, number], readonly [number, number, number]];
  readonly kind?: string;
}
export const GEN: Readonly<Record<string, GenInfo>> = registry as unknown as Record<string, GenInfo>;

// the low GLBs, inlined by the single-file build (assetsInlineLimit)
const LOW_URLS = import.meta.glob<string>('./gen/*.glb', { eager: true, query: '?url', import: 'default' });
const lowUrl = (id: string): string | undefined => LOW_URLS[`./gen/${id}.glb`];

/** The level for a Graphics quality setting, like Astro's. */
export function genLevelFor(quality: 'low' | 'medium' | 'high' | string): GenLevel {
  return quality === 'high' ? 'high' : quality === 'medium' ? 'mid' : 'low';
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();
const resolved = new Map<string, THREE.Group>();

/**
 * Returns a cached asset synchronously if already preloaded, or null.
 */
export function getGenSync(id: string, level: GenLevel = 'low'): THREE.Group | null {
  const g = resolved.get(`${id}|${level}`) ?? resolved.get(`${id}|low`);
  return g ? g.clone(true) : null;
}

let hdAvailable: Promise<boolean> | null = null;

/** Whether the HD pack is reachable: one small probe, made once. */
export function probeHd(): Promise<boolean> {
  hdAvailable ??= (async () => {
    const first = Object.keys(GEN)[0];
    if (!first || (typeof location !== 'undefined' && location.protocol === 'file:')) return false;
    try {
      const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
      const r = await fetch(new URL(`hd/${first}/high.gltf`, base), { method: 'HEAD' });
      return r.ok;
    } catch { return false; }
  })();
  return hdAvailable;
}

async function loadScene(url: string): Promise<THREE.Group> {
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return gltf.scene;
}

/**
 * One asset at a level, as a fresh clone (geometry and materials are shared between clones). Falls back to low when
 * the HD pack is missing or the level fails to load; rejects only if the asset is unknown.
 */
export async function loadGen(id: string, level: GenLevel = 'low'): Promise<THREE.Group> {
  const low = lowUrl(id);
  if (!low) throw new Error(`unknown generated asset: ${id}`);
  const want: GenLevel = level !== 'low' && (await probeHd()) ? level : 'low';
  const key = `${id}|${want}`;
  let p = cache.get(key);
  if (!p) {
    p = want === 'low'
      ? loadScene(low)
      : loadScene(new URL(`hd/${id}/${want}.gltf`, typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href).catch(() => loadScene(low));
    cache.set(key, p);
  }
  const loaded = await p;
  resolved.set(key, loaded);
  return loaded.clone(true);
}

