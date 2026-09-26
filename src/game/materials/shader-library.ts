/**
 * The builder's shader library. A shader blends three seamless textures: layer 1 covers everything,
 * layer 2 is painted over it where the first cloud-noise mask says so, and layer 3 over that where
 * the second mask says so. Each mask has its own seed, size, coverage and softness, so every shader
 * is its own random ground. An optional tile randomiser hides the repeat of a seamless texture.
 *
 * Pure data and normalisation; the three.js material lives in blend-material.ts. Props that wear a
 * shader carry an inline copy (`prop.shader`), so a track keeps its look when it is copied to another
 * machine; the library here is the editable set, saved on this device.
 */

export interface ShaderTexture { readonly id: string; readonly name: string; readonly url: string }

/** The game's seamless tiles (the same files the course materials use). */
export const SHADER_TEXTURES: readonly ShaderTexture[] = [
  { id: 'grass', name: 'Grass', url: '/textures/grass.png' },
  { id: 'dirt', name: 'Dirt', url: '/textures/dirt.png' },
  { id: 'cliff', name: 'Cliff rock', url: '/textures/cliff.png' },
  { id: 'cave', name: 'Cave rock', url: '/textures/caverock.png' },
  { id: 'cobble', name: 'Cobbles', url: '/textures/cobble.png' },
  { id: 'wood', name: 'Timber', url: '/textures/wood.png' },
  { id: 'bark', name: 'Bark', url: '/textures/bark.png' },
  { id: 'iron', name: 'Iron plate', url: '/textures/iron.png' },
  { id: 'lava', name: 'Lava', url: '/textures/lava.png' },
  { id: 'water', name: 'Water', url: '/textures/water.png' },
];
export const textureUrl = (id: string) => (SHADER_TEXTURES.find((t) => t.id === id) ?? SHADER_TEXTURES[0]).url;

export interface ShaderLayer {
  /** A SHADER_TEXTURES id. */
  texture: string;
  /** Size of one tile in world units (the ball is 62 across). */
  tile: number;
  /** Multiplied into the texture, #rrggbb. */
  tint: string;
}

export interface CloudMask {
  /** Any integer; the same seed always makes the same clouds. */
  seed: number;
  /** Size of one cloud in world units. */
  size: number;
  /** 0 = the layer never shows, 1 = it covers everything. */
  coverage: number;
  /** 0 = hard edges, 1 = very soft. */
  softness: number;
  /** Noise octaves: more is more ragged detail. */
  detail: number;
}

/** planar: straight down onto the ground; triplanar: from all three axes (rocks, boxes, walls); uv: the model's own UVs. */
export type ShaderProjection = 'planar' | 'triplanar' | 'uv';

export interface ShaderDef {
  version: 1;
  id: string;
  name: string;
  layers: [ShaderLayer, ShaderLayer, ShaderLayer];
  /** masks[0] lays layer 2 over layer 1; masks[1] lays layer 3 over both. */
  masks: [CloudMask, CloudMask];
  /** Break up the visible repeat of every layer's tile. */
  randomizeTiles: boolean;
  /** How far the randomiser shifts the tile copies, 0..1. */
  tileVariation: number;
  projection: ShaderProjection;
  roughness: number;
  metalness: number;
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
};
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback);
const textureId = (v: unknown, fallback: string) => (typeof v === 'string' && SHADER_TEXTURES.some((t) => t.id === v) ? v : fallback);

function layer(v: unknown, fallback: ShaderLayer): ShaderLayer {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { texture: textureId(o.texture, fallback.texture), tile: clamp(o.tile, 50, 20000, fallback.tile), tint: hex(o.tint, fallback.tint) };
}
function mask(v: unknown, fallback: CloudMask): CloudMask {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    seed: Math.round(clamp(o.seed, 0, 999_999, fallback.seed)),
    size: clamp(o.size, 100, 50000, fallback.size),
    coverage: clamp(o.coverage, 0, 1, fallback.coverage),
    softness: clamp(o.softness, 0, 1, fallback.softness),
    detail: Math.round(clamp(o.detail, 1, 6, fallback.detail)),
  };
}

export const DEFAULT_SHADER: ShaderDef = {
  version: 1,
  id: 'shader-meadow',
  name: 'Alpine meadow',
  layers: [
    { texture: 'grass', tile: 900, tint: '#ffffff' },
    { texture: 'dirt', tile: 700, tint: '#ffffff' },
    { texture: 'cliff', tile: 1200, tint: '#ffffff' },
  ],
  masks: [
    { seed: 1207, size: 2600, coverage: 0.35, softness: 0.35, detail: 4 },
    { seed: 4481, size: 1800, coverage: 0.2, softness: 0.25, detail: 5 },
  ],
  randomizeTiles: true,
  tileVariation: 0.7,
  projection: 'planar',
  roughness: 0.95,
  metalness: 0,
};

/** Any stored or pasted value → a valid shader (unknown fields dropped, numbers clamped). */
export function normalizeShader(v: unknown, fallback: ShaderDef = DEFAULT_SHADER): ShaderDef {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const layers = Array.isArray(o.layers) ? o.layers : [];
  const masks = Array.isArray(o.masks) ? o.masks : [];
  const projection = o.projection === 'triplanar' || o.projection === 'uv' || o.projection === 'planar' ? o.projection : fallback.projection;
  return {
    version: 1,
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 64) : fallback.id,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : fallback.name,
    layers: [layer(layers[0], fallback.layers[0]), layer(layers[1], fallback.layers[1]), layer(layers[2], fallback.layers[2])],
    masks: [mask(masks[0], fallback.masks[0]), mask(masks[1], fallback.masks[1])],
    randomizeTiles: typeof o.randomizeTiles === 'boolean' ? o.randomizeTiles : fallback.randomizeTiles,
    tileVariation: clamp(o.tileVariation, 0, 1, fallback.tileVariation),
    projection,
    roughness: clamp(o.roughness, 0, 1, fallback.roughness),
    metalness: clamp(o.metalness, 0, 1, fallback.metalness),
  };
}

/** The starter set a fresh library begins with. */
export const STARTER_SHADERS: readonly ShaderDef[] = [
  DEFAULT_SHADER,
  normalizeShader({
    id: 'shader-cavern-floor', name: 'Mossy cavern floor', projection: 'planar', randomizeTiles: true, tileVariation: 0.8,
    layers: [{ texture: 'cave', tile: 1100, tint: '#ffffff' }, { texture: 'grass', tile: 800, tint: '#9fb58a' }, { texture: 'dirt', tile: 650, tint: '#d8c8b0' }],
    masks: [{ seed: 3301, size: 1500, coverage: 0.3, softness: 0.3, detail: 5 }, { seed: 7717, size: 2200, coverage: 0.25, softness: 0.4, detail: 3 }],
  }),
  normalizeShader({
    id: 'shader-scrapyard', name: 'Scrapyard plating', projection: 'triplanar', randomizeTiles: true, tileVariation: 0.6, roughness: 0.7, metalness: 0.35,
    layers: [{ texture: 'iron', tile: 600, tint: '#ffffff' }, { texture: 'cobble', tile: 500, tint: '#c8b8a0' }, { texture: 'dirt', tile: 700, tint: '#b09070' }],
    masks: [{ seed: 902, size: 900, coverage: 0.3, softness: 0.2, detail: 4 }, { seed: 5150, size: 1300, coverage: 0.35, softness: 0.45, detail: 5 }],
  }),
  normalizeShader({
    id: 'shader-rock', name: 'Weathered rock', projection: 'triplanar', randomizeTiles: true, tileVariation: 0.7,
    layers: [{ texture: 'cliff', tile: 900, tint: '#ffffff' }, { texture: 'cave', tile: 700, tint: '#ffffff' }, { texture: 'grass', tile: 800, tint: '#a8c08c' }],
    masks: [{ seed: 44, size: 1200, coverage: 0.4, softness: 0.35, detail: 5 }, { seed: 8080, size: 1600, coverage: 0.15, softness: 0.3, detail: 4 }],
  }),
];

/** What decides the compiled program (changing these recompiles; everything else is a uniform). */
export const shaderVariant = (def: ShaderDef) => `${def.projection}:${def.randomizeTiles ? 1 : 0}`;

/** A new, unused id. */
export function newShaderId(existing: Iterable<string>, now = Date.now()): string {
  const taken = new Set(existing);
  let n = 0, id = `shader-${now.toString(36)}`;
  while (taken.has(id)) id = `shader-${now.toString(36)}-${++n}`;
  return id;
}

/* ───────────── The library on this device ───────────── */

export const SHADER_LIBRARY_KEY = 'hm2-builder-shaders-v1';
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const deviceStorage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function loadShaderLibrary(store: StorageLike | null = deviceStorage()): ShaderDef[] {
  try {
    const raw = store?.getItem(SHADER_LIBRARY_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (Array.isArray(list) && list.length) {
      const seen = new Set<string>();
      return list.map((s) => normalizeShader(s)).filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
    }
  } catch { /* fall through to the starters */ }
  return STARTER_SHADERS.map((s) => normalizeShader(s));
}

export function saveShaderLibrary(list: readonly ShaderDef[], store: StorageLike | null = deviceStorage()): boolean {
  try { store?.setItem(SHADER_LIBRARY_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/** Adds shaders found on props that the library does not have yet (a track from another machine). */
export function mergeShadersFromProps(library: readonly ShaderDef[], props: readonly { shader?: unknown }[]): { library: ShaderDef[]; added: number } {
  const out = [...library];
  const ids = new Set(out.map((s) => s.id));
  let added = 0;
  for (const p of props) {
    if (!p.shader || typeof p.shader !== 'object') continue;
    const s = normalizeShader(p.shader);
    if (ids.has(s.id)) continue;
    ids.add(s.id); out.push(s); added++;
  }
  return { library: out, added };
}
