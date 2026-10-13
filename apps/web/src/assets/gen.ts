/**
 * The generated assets (RUN.world source images, local Hunyuan3D models, scripts/runworld-pack.mjs).
 * Owner, 2026-10-11: "Lean file + HD pack". The low level of every asset is inlined into the single-file build, so
 * the game is complete without anything else. The mid and high levels live in the optional HD pack, `hd/<id>/`
 * beside index.html; when the pack is missing (or the page is opened from disk, where the browser blocks fetches),
 * every request falls back to low.
 *
 * Studio tweaks (2026-10-12): every instance of an asset gets its saved tweak (`studio-data/asset-tweaks.json`, written
 * by the Studio's Changes panel) applied to its own clone: offset, scale and turn on a wrapper group, the material
 * fields on cloned materials. An asset without a tweak is returned exactly as its file has it.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import registry from './gen/registry.json';
import tweakFile from '../studio-data/asset-tweaks.json';
import type { AssetTweak, Vec3 } from '../../studio-server/tweak-schema';

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
/**
 * The saved tweak of each asset that has one. Baked into the build; the Studio writes the file in dev. In dev, a saved
 * change is taken in place (this module accepts its own JSON), so the page does not reload and the Studio keeps its
 * undo history. Instances already placed in the game keep their old copy until they are made again.
 */
export const ASSET_TWEAKS: Record<string, AssetTweak> = { ...(tweakFile as unknown as Record<string, AssetTweak>) };
if (import.meta.hot) {
  import.meta.hot.accept('../studio-data/asset-tweaks.json', (mod) => {
    const next = ((mod as { default?: unknown } | undefined)?.default ?? {}) as Record<string, AssetTweak>;
    for (const id of Object.keys(ASSET_TWEAKS)) if (!(id in next)) delete ASSET_TWEAKS[id];
    Object.assign(ASSET_TWEAKS, next);
  });
}

// the low GLBs, inlined by the single-file build (assetsInlineLimit). Read on first use, so node tests can import
// this module (import.meta.glob exists only under Vite).
let lowUrls: Record<string, string> | null = null;
const lowUrl = (id: string): string | undefined => {
  lowUrls ??= import.meta.glob<string>('./gen/*.glb', { eager: true, query: '?url', import: 'default' });
  return lowUrls[`./gen/${id}.glb`];
};

/** The level for a Graphics quality setting, like Astro's. */
export function genLevelFor(quality: 'low' | 'medium' | 'high' | string): GenLevel {
  return quality === 'high' ? 'high' : quality === 'medium' ? 'mid' : 'low';
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();
const resolved = new Map<string, THREE.Group>();

const TUNED_MATERIAL_KEYS = ['tint', 'metalness', 'roughness', 'emissive', 'emissiveIntensity'] as const;

/**
 * One instance of an asset with its tweak applied. The caller passes its own clone. Transform tweaks go on a wrapper
 * group, not the mesh; material tweaks clone each material of this instance, so the shared cache is never changed.
 * With no tweak (or an empty one) the object comes back untouched.
 */
export function applyAssetTweak(obj: THREE.Group, tweak: AssetTweak | undefined): THREE.Group {
  if (!tweak || Object.keys(tweak).length === 0) return obj;
  const wrap = new THREE.Group();
  wrap.add(obj);
  if (tweak.offset) wrap.position.set(tweak.offset[0], tweak.offset[1], tweak.offset[2]);
  if (tweak.scale !== undefined) {
    const s: Vec3 = typeof tweak.scale === 'number' ? [tweak.scale, tweak.scale, tweak.scale] : tweak.scale;
    wrap.scale.set(s[0], s[1], s[2]);
  }
  if (tweak.yaw) wrap.rotation.y = THREE.MathUtils.degToRad(tweak.yaw);
  if (TUNED_MATERIAL_KEYS.some((k) => tweak[k] !== undefined)) {
    wrap.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = Array.isArray(m.material) ? m.material.map((mat) => tuneMaterial(mat, tweak)) : tuneMaterial(m.material, tweak);
    });
  }
  return wrap;
}

function tuneMaterial(src: THREE.Material, t: AssetTweak): THREE.Material {
  const mat = src.clone() as THREE.MeshStandardMaterial;
  const std = (mat as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial === true;
  if (t.tint) mat.color?.set(t.tint);
  if (std && t.metalness !== undefined && t.metalness >= 0) mat.metalness = t.metalness;
  if (std && t.roughness !== undefined && t.roughness >= 0) mat.roughness = t.roughness;
  if (std && t.emissive) mat.emissive.set(t.emissive);
  if (std && t.emissiveIntensity !== undefined) mat.emissiveIntensity = t.emissiveIntensity;
  return mat;
}

/**
 * Returns a cached asset synchronously if already preloaded, or null. The clone carries the asset's saved tweak.
 */
export function getGenSync(id: string, level: GenLevel = 'low'): THREE.Group | null {
  const g = resolved.get(`${id}|${level}`) ?? resolved.get(`${id}|low`);
  return g ? applyAssetTweak(g.clone(true), ASSET_TWEAKS[id]) : null;
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

async function loadRaw(id: string, level: GenLevel): Promise<THREE.Group> {
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
  return loaded;
}

/**
 * One asset at a level, as a fresh clone (geometry and materials are shared between clones). Falls back to low when
 * the HD pack is missing or the level fails to load; rejects only if the asset is unknown. The clone carries the
 * asset's saved tweak.
 */
export async function loadGen(id: string, level: GenLevel = 'low'): Promise<THREE.Group> {
  return applyAssetTweak((await loadRaw(id, level)).clone(true), ASSET_TWEAKS[id]);
}

/** The asset as its file has it, with no tweak: the Studio applies its own (unsaved) values on top of this. */
export async function loadGenRaw(id: string, level: GenLevel = 'low'): Promise<THREE.Group> {
  return (await loadRaw(id, level)).clone(true);
}
