/**
 * The shader library's three.js side: a MeshStandardMaterial whose colour comes from three seamless
 * layers blended by two cloud-noise masks (shader-library.ts). The blend is injected with
 * onBeforeCompile, so lighting, fog, shadows and the builder's placed lights all still apply.
 *
 * Everything a slider moves is a uniform (no recompile). Only the projection and the tile
 * randomiser are compile-time variants (`shaderVariant`), and one program is shared per variant.
 *
 * The tile randomiser is Inigo Quilez's "texture repetition" method 3: a low-frequency noise picks
 * between two offset copies of the tile and blends them where their colours already agree, which
 * hides the repeat without blurring the painted brushwork.
 *
 * `setTileRandomization` applies the same randomiser to any existing material with a map (the
 * course's own grass, rock and dirt), as a toggle that can be undone.
 */
import * as THREE from 'three';
import { shaderVariant, textureUrl, type ShaderDef } from './shader-library';

/* ───────────── GLSL ───────────── */

const NOISE_GLSL = /* glsl */ `
float hm2Hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hm2Noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hm2Hash(i), hm2Hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(hm2Hash(i + vec3(0.0, 1.0, 0.0)), hm2Hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hm2Hash(i + vec3(0.0, 0.0, 1.0)), hm2Hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(hm2Hash(i + vec3(0.0, 1.0, 1.0)), hm2Hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// Texture repetition, method 3 (iquilezles.org): two offset copies chosen by a slow noise.
vec4 hm2NoTile(sampler2D s, vec2 uv, float variation) {
  float k = hm2Noise(vec3(uv * 0.17, 0.5));
  float index = k * 8.0;
  float i = floor(index);
  float f = fract(index);
  vec2 offA = sin(vec2(3.0, 7.0) * i) * variation;
  vec2 offB = sin(vec2(3.0, 7.0) * (i + 1.0)) * variation;
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  vec4 a = textureGrad(s, uv + offA, dx, dy);
  vec4 b = textureGrad(s, uv + offB, dx, dy);
  float d = dot(a.rgb - b.rgb, vec3(1.0));
  return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * d));
}
`;

const BLEND_PARS_FRAGMENT = /* glsl */ `
uniform sampler2D hm2Layer0;
uniform sampler2D hm2Layer1;
uniform sampler2D hm2Layer2;
uniform vec3 hm2Tint0;
uniform vec3 hm2Tint1;
uniform vec3 hm2Tint2;
uniform vec3 hm2Tile;
uniform vec4 hm2MaskA;
uniform vec4 hm2MaskB;
uniform vec3 hm2SeedA;
uniform vec3 hm2SeedB;
uniform float hm2TileVar;
varying vec3 hm2WorldPos;
varying vec3 hm2WorldNormal;
varying vec2 hm2Uv;
${NOISE_GLSL}
vec3 hm2Sample(sampler2D s, vec2 uv) {
#ifdef HM2_NOTILE
  return hm2NoTile(s, uv, hm2TileVar).rgb;
#else
  return texture(s, uv).rgb;
#endif
}
vec3 hm2LayerColor(sampler2D s, float tile) {
#if defined(HM2_TRIPLANAR)
  vec3 w = pow(abs(normalize(hm2WorldNormal)), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  return hm2Sample(s, hm2WorldPos.zy / tile) * w.x
       + hm2Sample(s, hm2WorldPos.xz / tile) * w.y
       + hm2Sample(s, hm2WorldPos.xy / tile) * w.z;
#elif defined(HM2_UV)
  return hm2Sample(s, hm2Uv * (1000.0 / tile));
#else
  return hm2Sample(s, hm2WorldPos.xz / tile);
#endif
}
float hm2Fbm(vec3 p, float octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int o = 0; o < 6; o++) {
    if (float(o) >= octaves) break;
    sum += hm2Noise(p) * amp;
    norm += amp;
    p = p * 2.03 + vec3(17.1, 9.2, 3.7);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}
// x = 1 / cloud size, y = threshold, z = half the edge width, w = octaves. The texture's own
// brightness nudges the edge, so the transition follows the painted detail instead of a smooth blob.
float hm2Mask(vec4 m, vec3 seed, vec3 layerColor) {
  float n = hm2Fbm(hm2WorldPos * m.x + seed, m.w);
  n += (dot(layerColor, vec3(0.333)) - 0.5) * 0.12;
  return smoothstep(m.y - m.z, m.y + m.z, n);
}
`;

const BLEND_FRAGMENT = /* glsl */ `
{
  vec3 c0 = hm2LayerColor(hm2Layer0, hm2Tile.x) * hm2Tint0;
  vec3 c1 = hm2LayerColor(hm2Layer1, hm2Tile.y) * hm2Tint1;
  vec3 c2 = hm2LayerColor(hm2Layer2, hm2Tile.z) * hm2Tint2;
  float mA = hm2Mask(hm2MaskA, hm2SeedA, c1);
  float mB = hm2Mask(hm2MaskB, hm2SeedB, c2);
  diffuseColor.rgb *= mix(mix(c0, c1, mA), c2, mB);
}
`;

const BLEND_PARS_VERTEX = /* glsl */ `
varying vec3 hm2WorldPos;
varying vec3 hm2WorldNormal;
varying vec2 hm2Uv;
`;
const BLEND_VERTEX = /* glsl */ `
hm2WorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
hm2WorldNormal = normalize(mat3(modelMatrix) * objectNormal);
hm2Uv = uv;
`;

/* ───────────── Uniform packing ───────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed → a far-away offset in noise space, so different seeds give unrelated clouds. */
export function seedOffset(seed: number): [number, number, number] {
  const r = mulberry32(seed * 2654435761);
  return [r() * 400 + 11, r() * 400 + 23, r() * 400 + 37];
}

/** Coverage and softness → the smoothstep window on the fBm value (which clusters around 0.5). */
export function maskWindow(coverage: number, softness: number): { threshold: number; halfWidth: number } {
  if (coverage <= 0.001) return { threshold: 9, halfWidth: 0.001 };
  if (coverage >= 0.999) return { threshold: -9, halfWidth: 0.001 };
  return { threshold: 0.5 + (0.5 - coverage) * 0.42, halfWidth: 0.01 + softness * 0.12 };
}

export interface BlendUniforms {
  hm2Layer0: { value: THREE.Texture | null }; hm2Layer1: { value: THREE.Texture | null }; hm2Layer2: { value: THREE.Texture | null };
  hm2Tint0: { value: THREE.Color }; hm2Tint1: { value: THREE.Color }; hm2Tint2: { value: THREE.Color };
  hm2Tile: { value: THREE.Vector3 };
  hm2MaskA: { value: THREE.Vector4 }; hm2MaskB: { value: THREE.Vector4 };
  hm2SeedA: { value: THREE.Vector3 }; hm2SeedB: { value: THREE.Vector3 };
  hm2TileVar: { value: number };
}

function makeUniforms(): BlendUniforms {
  return {
    hm2Layer0: { value: null }, hm2Layer1: { value: null }, hm2Layer2: { value: null },
    hm2Tint0: { value: new THREE.Color(1, 1, 1) }, hm2Tint1: { value: new THREE.Color(1, 1, 1) }, hm2Tint2: { value: new THREE.Color(1, 1, 1) },
    hm2Tile: { value: new THREE.Vector3(1000, 1000, 1000) },
    hm2MaskA: { value: new THREE.Vector4() }, hm2MaskB: { value: new THREE.Vector4() },
    hm2SeedA: { value: new THREE.Vector3() }, hm2SeedB: { value: new THREE.Vector3() },
    hm2TileVar: { value: 0 },
  };
}

function writeUniforms(u: BlendUniforms, def: ShaderDef, texture: (url: string) => THREE.Texture) {
  u.hm2Layer0.value = texture(textureUrl(def.layers[0].texture));
  u.hm2Layer1.value = texture(textureUrl(def.layers[1].texture));
  u.hm2Layer2.value = texture(textureUrl(def.layers[2].texture));
  // Tints are authored in sRGB like every colour picker; the shader works in linear.
  u.hm2Tint0.value.set(def.layers[0].tint).convertSRGBToLinear();
  u.hm2Tint1.value.set(def.layers[1].tint).convertSRGBToLinear();
  u.hm2Tint2.value.set(def.layers[2].tint).convertSRGBToLinear();
  u.hm2Tile.value.set(def.layers[0].tile, def.layers[1].tile, def.layers[2].tile);
  const a = maskWindow(def.masks[0].coverage, def.masks[0].softness);
  const b = maskWindow(def.masks[1].coverage, def.masks[1].softness);
  u.hm2MaskA.value.set(1 / def.masks[0].size, a.threshold, a.halfWidth, def.masks[0].detail);
  u.hm2MaskB.value.set(1 / def.masks[1].size, b.threshold, b.halfWidth, def.masks[1].detail);
  u.hm2SeedA.value.set(...seedOffset(def.masks[0].seed));
  u.hm2SeedB.value.set(...seedOffset(def.masks[1].seed));
  u.hm2TileVar.value = def.tileVariation;
}

function variantDefines(def: ShaderDef): Record<string, string> {
  const d: Record<string, string> = {};
  if (def.projection === 'triplanar') d.HM2_TRIPLANAR = '';
  if (def.projection === 'uv') d.HM2_UV = '';
  if (def.randomizeTiles) d.HM2_NOTILE = '';
  return d;
}

/** Injects the blend into a standard material's shader source (exported for the tests). */
export function injectBlend(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> }, uniforms: BlendUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${BLEND_PARS_VERTEX}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${BLEND_VERTEX}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${BLEND_PARS_FRAGMENT}`)
    .replace('#include <map_fragment>', BLEND_FRAGMENT);
}

/* ───────────── The materials ───────────── */

interface Entry { material: THREE.MeshStandardMaterial; uniforms: BlendUniforms; variant: string; users: number }

/**
 * One material per (shader id, side), shared by every object that wears the shader. `acquire` and
 * `release` count users; `update` pushes an edited shader into its live materials.
 */
export class BlendMaterials {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly texture: (url: string) => THREE.Texture) {}

  acquire(def: ShaderDef, side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
    const key = `${def.id}|${side}`;
    let entry = this.entries.get(key);
    if (!entry) {
      const uniforms = makeUniforms();
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: def.roughness, metalness: def.metalness, side });
      material.name = `Shader: ${def.name}`;
      material.userData.hm2ShaderId = def.id;
      material.onBeforeCompile = (shader) => injectBlend(shader as never, uniforms);
      entry = { material, uniforms, variant: '', users: 0 };
      this.entries.set(key, entry);
      this.apply(entry, def);
    }
    entry.users++;
    return entry.material;
  }

  release(material: THREE.Material | null | undefined) {
    if (!material) return;
    for (const [key, entry] of this.entries) {
      if (entry.material !== material) continue;
      entry.users--;
      if (entry.users <= 0) { entry.material.dispose(); this.entries.delete(key); }
      return;
    }
  }

  /** An edited shader: every live material for its id takes the new values. */
  update(def: ShaderDef) {
    for (const entry of this.entries.values()) if (entry.material.userData.hm2ShaderId === def.id) this.apply(entry, def);
  }

  has(material: THREE.Material | null | undefined): boolean {
    return !!material && [...this.entries.values()].some((e) => e.material === material);
  }

  get size() { return this.entries.size; }

  dispose() {
    for (const entry of this.entries.values()) entry.material.dispose();
    this.entries.clear();
  }

  private apply(entry: Entry, def: ShaderDef) {
    writeUniforms(entry.uniforms, def, this.texture);
    entry.material.roughness = def.roughness;
    entry.material.metalness = def.metalness;
    entry.material.name = `Shader: ${def.name}`;
    const variant = shaderVariant(def);
    if (variant !== entry.variant) {
      entry.variant = variant;
      entry.material.defines = variantDefines(def);
      entry.material.customProgramCacheKey = () => `hm2-blend:${variant}`;
      entry.material.needsUpdate = true;
    }
  }
}

/* ───────────── The course's own tiles, randomised ───────────── */

const TILE_PATCH = Symbol('hm2TilePatch');
interface Patched { original: THREE.MeshStandardMaterial['onBeforeCompile']; originalKey: THREE.Material['customProgramCacheKey']; uniform: { value: number } }

/**
 * Turns the tile randomiser on or off for the given materials (only ones with a map). Off puts back
 * exactly what was there. Returns how many materials changed.
 */
export function setTileRandomization(materials: Iterable<THREE.Material>, on: boolean, variation = 0.7): number {
  let changed = 0;
  for (const material of materials) {
    const std = material as THREE.MeshStandardMaterial & { [TILE_PATCH]?: Patched };
    if (!std.map) continue;
    const patched = std[TILE_PATCH];
    if (on) {
      if (patched) { patched.uniform.value = variation; continue; }
      const uniform = { value: variation };
      const original = std.onBeforeCompile;
      const originalKey = std.customProgramCacheKey;
      std[TILE_PATCH] = { original, originalKey, uniform };
      std.onBeforeCompile = (shader, renderer) => {
        original.call(std, shader, renderer);
        shader.uniforms.hm2TileVar = uniform;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float hm2TileVar;\n${NOISE_GLSL}`)
          .replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= hm2NoTile(map, vMapUv, hm2TileVar);\n#endif');
      };
      std.customProgramCacheKey = () => `${originalKey.call(std)}|hm2-notile`;
      std.needsUpdate = true;
      changed++;
    } else if (patched) {
      std.onBeforeCompile = patched.original;
      std.customProgramCacheKey = patched.originalKey;
      delete std[TILE_PATCH];
      std.needsUpdate = true;
      changed++;
    }
  }
  return changed;
}
