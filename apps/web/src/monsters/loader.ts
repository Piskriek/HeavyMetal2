// Loads the monster skins: the sprite atlases (JSON views + WebP) and the 3D models (GLB with glTF clips). The core skins are inlined
// by the single-file build; the rest are fetched from public/monsters/. Each load is cached; a failed one is remembered and never
// retried, and the renderer draws its fallback in its place (adapter.ts fallbackFor). Nothing here blocks: callers preload behind a
// loading bar.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { fallbackFor } from './adapter';
import { SKINS, type SkinInfo } from './roster';
import type { SpriteGroup } from './timing';

export interface SpriteView { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly ox: number; readonly oy: number; readonly mirrored: boolean }
export interface SpriteFrame { readonly letter: string; readonly views: readonly (SpriteView | null)[] }
export interface SpriteGroupData { readonly ticks: number; readonly frames: readonly SpriteFrame[] }

export interface SpriteAsset {
  readonly kind: 'sprite';
  readonly id: string;
  readonly texture: THREE.Texture;
  readonly width: number;
  readonly height: number;
  /** Metres per atlas pixel (the sprite's real size: its pixels times this). */
  readonly mpp: number;
  readonly groups: Readonly<Record<SpriteGroup, SpriteGroupData>>;
}

export interface ModelAsset {
  readonly kind: 'model';
  readonly id: string;
  /** The model, scaled to its real height with its feet on y = 0 and centred on the origin. Instances are clones of it. */
  readonly prototype: THREE.Group;
  /** The glTF clips by group (walk, attack, pain, death). A missing group is held in its first pose. */
  readonly clips: ReadonlyMap<SpriteGroup, THREE.AnimationClip>;
}

export type SkinAsset = SpriteAsset | ModelAsset;

// the core files: the bundler inlines them (single-file build) and returns their URLs or values
const coreSpriteUrl = import.meta.glob('../assets/monsters/*/sprite.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const coreSpriteJson = import.meta.glob('../assets/monsters/*/sprite.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const coreModelUrl = import.meta.glob('../assets/monsters/*/model.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const GROUPS: readonly SpriteGroup[] = ['walk', 'attack', 'pain', 'death'];

const loaded = new Map<string, SkinAsset>();
const pending = new Map<string, Promise<SkinAsset>>();
const failed = new Set<string>();

/** The loaded skin, or null while it is not loaded (or has failed). Synchronous: the renderer asks every frame. */
export function skinAsset(id: string): SkinAsset | null {
  return loaded.get(id) ?? null;
}

/** True once a skin's load has failed (it is never retried). */
export function skinFailed(id: string): boolean {
  return failed.has(id);
}

function infoOf(id: string, roster: readonly SkinInfo[]): SkinInfo {
  const s = roster.find((r) => r.id === id);
  if (!s) throw new Error(`unknown monster skin: ${id}`);
  return s;
}

function urlOf(skin: SkinInfo, file: 'sprite.webp' | 'model.glb'): string {
  if (skin.core) {
    const map = file === 'sprite.webp' ? coreSpriteUrl : coreModelUrl;
    const url = map[`../assets/monsters/${skin.id}/${file}`];
    if (!url) throw new Error(`core file missing: ${skin.id}/${file}`);
    return url;
  }
  return new URL(`monsters/${skin.id}/${file}`, document.baseURI).href;
}

async function readSpriteJson(skin: SkinInfo): Promise<Record<string, unknown>> {
  if (skin.core) {
    const raw = coreSpriteJson[`../assets/monsters/${skin.id}/sprite.json`];
    if (!raw) throw new Error(`core sprite.json missing: ${skin.id}`);
    return raw as Record<string, unknown>;
  }
  const res = await fetch(new URL(`monsters/${skin.id}/sprite.json`, document.baseURI).href);
  if (!res.ok) throw new Error(`${skin.id}: sprite.json ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Parses the packed sprite JSON: each view is [x, y, w, h, originX, originY, mirrored], or null. */
export function parseSpriteJson(raw: Record<string, unknown>): { width: number; height: number; mpp: number; groups: Record<SpriteGroup, SpriteGroupData> } {
  const atlas = raw.atlas as { width: number; height: number };
  const groups = raw.groups as Record<string, { ticks: number; frames: { letter: string; views: (number[] | null)[] }[] }>;
  const out = {} as Record<SpriteGroup, SpriteGroupData>;
  for (const g of GROUPS) {
    const src = groups[g];
    if (!src) throw new Error(`sprite group missing: ${g}`);
    out[g] = {
      ticks: src.ticks,
      frames: src.frames.map((f) => ({
        letter: f.letter,
        views: f.views.map((v) => (v ? { x: v[0]!, y: v[1]!, w: v[2]!, h: v[3]!, ox: v[4]!, oy: v[5]!, mirrored: v[6] === 1 } : null)),
      })),
    };
  }
  return { width: atlas.width, height: atlas.height, mpp: Number(raw.metresPerPixel), groups: out };
}

async function loadSprite(skin: SkinInfo): Promise<SpriteAsset> {
  const json = parseSpriteJson(await readSpriteJson(skin));
  const texture = await new THREE.TextureLoader().loadAsync(urlOf(skin, 'sprite.webp'));
  // the atlas rows run top-down, so the texture is not flipped; pixel art is sampled raw (no colour management, no mipmaps)
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { kind: 'sprite', id: skin.id, texture, width: json.width, height: json.height, mpp: json.mpp, groups: json.groups };
}

async function loadModel(skin: SkinInfo): Promise<ModelAsset> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(urlOf(skin, 'model.glb'));
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  // fit to the real height: the feet on y = 0, the body centred on the origin (the models come in their own units)
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const s = size.y > 0 ? skin.heightM / size.y : 1;
  scene.scale.setScalar(s);
  scene.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
  scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; } });
  const prototype = new THREE.Group();
  prototype.add(scene);
  const clips = new Map<SpriteGroup, THREE.AnimationClip>();
  for (const clip of gltf.animations) {
    const g = GROUPS.find((x) => x === clip.name.toLowerCase());
    if (g && !clips.has(g)) clips.set(g, clip);
  }
  return { kind: 'model', id: skin.id, prototype, clips };
}

/** Loads one skin (cached). Rejects when its files are missing or broken; a rejected skin is marked failed and never retried. */
export function loadSkin(id: string, roster: readonly SkinInfo[] = SKINS): Promise<SkinAsset> {
  const have = loaded.get(id);
  if (have) return Promise.resolve(have);
  const busy = pending.get(id);
  if (busy) return busy;
  const skin = infoOf(id, roster);
  const p = (skin.era === 'sprite' ? loadSprite(skin) : loadModel(skin)).then((asset) => {
    loaded.set(id, asset);
    pending.delete(id);
    return asset;
  }, (err: unknown) => {
    failed.add(id);
    pending.delete(id);
    console.warn(`[monsters] ${id} stays on its fallback:`, err);
    throw err;
  });
  pending.set(id, p);
  return p;
}

export interface PreloadResult { readonly loaded: readonly string[]; readonly failed: readonly string[] }

/**
 * Loads the given skins and their fallbacks, behind the caller's loading bar. Never rejects: a skin that fails is listed in `failed`
 * and its fallback is drawn instead.
 */
export async function preloadSkins(ids: readonly string[], onProgress?: (done: number, total: number) => void, roster: readonly SkinInfo[] = SKINS): Promise<PreloadResult> {
  const all = [...new Set(ids.flatMap((id) => [id, fallbackFor(id, roster)]))];
  let done = 0;
  const results = await Promise.all(all.map((id) => loadSkin(id, roster).then(
    () => { done++; onProgress?.(done, all.length); return { id, ok: true }; },
    () => { done++; onProgress?.(done, all.length); return { id, ok: false }; },
  )));
  return {
    loaded: results.filter((r) => r.ok).map((r) => r.id),
    failed: results.filter((r) => !r.ok).map((r) => r.id),
  };
}
