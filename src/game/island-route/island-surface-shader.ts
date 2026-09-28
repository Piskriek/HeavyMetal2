/**
 * ISLAND-ROUTE: GLSL for the island surface set (`island-surfaces.ts`): how a pair of surface IDs and
 * their balance become pixels on the island terrain and on painted 3D models.
 *
 * - **Height blending.** Each tile carries its own height in alpha. Where two surfaces share a texel the
 *   one standing higher *at that pixel* wins, offset by the balance: at 50/50 grass blades stand out of
 *   the sand between them and sand fills the cracks of the rock, and as the balance shifts the lower
 *   one drowns first. A narrow `depth` keeps a little cross-fade so the edge is never a hard cut; each
 *   surface's `contrast` sharpens or softens it.
 * - **No repeats.** Every surface is sampled twice with offsets picked by a smooth noise index and
 *   blended where their heights agree (Inigo Quilez's third technique), mixed texels included, so a
 *   900-unit tile never shows its grid, even from the air.
 * - **Soft borders.** The mask is read as a weighted gather of the four texels around the pixel (every
 *   surface they hold, weighted by distance and share; the two strongest win), at a gently warped
 *   position, so where surfaces meet they fade into each other along a meandering line instead of
 *   stepping along the texel grid. `islSoft` sets how wide the fade is.
 * - **Any slope.** Tiles are projected from above and from both sides and blended by the normal
 *   (triplanar), so a cliff or rock is never smeared and there is no seam where the projection changes.
 * - Explicit gradients (`textureGrad`) on the mipmapped, repeating array: no atlas, no padding, no seams.
 *
 * Uses `surfNoise` from `surface/surface-shader.ts` (included before this in ground shaders).
 */
import * as THREE from 'three';
import { SURFACE_SLOTS } from '../surface/surface-table';
import { ISLAND_SURFACES, ISLAND_LAYER_OF, IslandSurfaceArray } from './island-surfaces';

export const ISLAND_LAYERS = ISLAND_SURFACES.length;

export const SURF_NOISE_GLSL = /* glsl */ `
float surfHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float surfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = surfHash(i);
  float b = surfHash(i + vec2(1.0, 0.0));
  float c = surfHash(i + vec2(0.0, 1.0));
  float d = surfHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
`;

/** The uniforms every island-tile shader needs (ground and painted models alike). */
const ISLAND_UNIFORMS_GLSL = /* glsl */ `
uniform sampler2DArray islSurfaces;
uniform float islLayerOf[${SURFACE_SLOTS}];
// Per layer: world units per repeat, roughness, height contrast, 0.
uniform vec4 islParams[${ISLAND_LAYERS}];
// 0 = crisp, height-led borders; 1 = long soft fades.
uniform float islSoft;
// Every tile's repeat, × (bigger tiles read calmer from the air).
uniform float islScale;
// Faces steeper than this (cos of the angle from level: normal.y) wear the look's cliff tile whatever
// the mask says: the top-down mask barely sees a near-vertical wall. Layer -1: off.
uniform float islCliffLayer;
uniform vec2 islCliffNy; // normal.y where the rock starts, and where it is complete
`;

/** Reading the ground's paint mask. Needs `surfTexel` from `surface/surface-shader.ts`: ground only. */
const ISLAND_GATHER_GLSL = /* glsl */ `
/**
 * (id0, id1, weight of id1) at coord (texel units of a size-wide mask): every surface of the four texels
 * around it, weighted by bilinear distance and by its share, and the two strongest of them.
 */
vec3 islGather(sampler2D mask, vec2 size, vec2 coord) {
  vec2 p = coord - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  float cid[8] = float[8](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  float cw[8] = float[8](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  int n = 0;
  for (int k = 0; k < 4; k++) {
    vec2 o = vec2(float(k & 1), float(k >> 1));
    vec4 t = surfTexel(mask, size, i + o);
    float bw = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);
    float a = floor(t.r * 255.0 + 0.5);
    float b = floor(t.g * 255.0 + 0.5);
    bool solid = a == b;
    for (int s = 0; s < 2; s++) {
      float id = s == 0 ? a : b;
      float ww = solid ? (s == 0 ? bw : 0.0) : (s == 0 ? bw * (1.0 - t.b) : bw * t.b);
      if (ww <= 0.0) continue;
      bool found = false;
      for (int j = 0; j < 8; j++) {
        if (j >= n) break;
        if (cid[j] == id) { cw[j] += ww; found = true; break; }
      }
      if (!found && n < 8) { cid[n] = id; cw[n] = ww; n++; }
    }
  }
  int ia = 0;
  int ib = -1;
  for (int j = 1; j < 8; j++) {
    if (j >= n) break;
    if (cw[j] > cw[ia]) { ib = ia; ia = j; }
    else if (ib < 0 || cw[j] > cw[ib]) ib = j;
  }
  if (ib < 0) return vec3(cid[ia], cid[ia], 0.0);
  return vec3(cid[ia], cid[ib], cw[ib] / max(cw[ia] + cw[ib], 1e-5));
}
`;

/** Tiles by layer: sampling, height blending, triplanar projection. Needs only `surfNoise`. */
const ISLAND_TILE_GLSL = /* glsl */ `
/** The array layer of a surface ID, or -1 when it is not an island tile. */
float islLayer(float id) {
  int i = int(id + 0.5);
  return (i >= 0 && i < ${SURFACE_SLOTS}) ? islLayerOf[i] : -1.0;
}

vec4 islTap(float layer, vec2 uv, vec2 off, vec2 dx, vec2 dy) {
  int ilayer = int(clamp(layer + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  float rep = max(islParams[ilayer].x * islScale, 1.0);
  return textureGrad(islSurfaces, vec3(uv / rep + off, float(ilayer)), dx / rep, dy / rep);
}

/** One surface, never repeating: two offset taps blended by a smooth noise index and their heights. */
vec4 islVaried(float layer, vec2 uv, vec2 dx, vec2 dy) {
  int ilayer = int(clamp(layer + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  float rep = max(islParams[ilayer].x * islScale, 1.0);
  float l = surfNoise(uv / (rep * 2.7) + layer * 3.1) * 8.0;
  float ia = floor(l);
  vec4 a = islTap(layer, uv, sin(vec2(3.0, 7.0) * ia), dx, dy);
  vec4 b = islTap(layer, uv, sin(vec2(3.0, 7.0) * (ia + 1.0)), dx, dy);
  return mix(a, b, smoothstep(0.2, 0.8, fract(l) + (b.a - a.a) * 0.25));
}

/** Two surfaces by height: w is B's share; the one standing higher at this pixel takes the edge. */
vec4 islHeightBlend(vec4 a, vec4 b, float w, float contrast) {
  float ha = a.a + (1.0 - w) * 1.1;
  float hb = b.a + w * 1.1;
  float depth = mix(0.06, 0.6, islSoft) / max(contrast, 0.25);
  float m = max(ha, hb) - depth;
  float ba = max(ha - m, 0.0);
  float bb = max(hb - m, 0.0);
  return (a * ba + b * bb) / max(ba + bb, 1e-4);
}

/** Layers la, lb with B's share w: rgb, and the height where they meet (a). */
vec4 islPair(float la, float lb, float w, vec2 uv, vec2 dx, vec2 dy) {
  vec4 a = islVaried(la, uv, dx, dy);
  if (abs(la - lb) < 0.5 || w < 0.004) return a;
  vec4 b = islVaried(lb, uv, dx, dy);
  if (w > 0.996) return b;
  int ila = int(clamp(la + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  int ilb = int(clamp(lb + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  float contrast = 0.5 * (islParams[ila].z + islParams[ilb].z);
  return islHeightBlend(a, b, w, contrast);
}

/**
 * The pair on any slope: projected from above and from both sides, blended by the normal. Projections
 * under 8% are skipped (most of the island needs one, steep ground two).
 */
vec4 islTriplanar(float la, float lb, float w, vec3 wp, vec3 n, vec3 dwx, vec3 dwy) {
  vec3 bw = pow(abs(n), vec3(4.0));
  bw /= max(bw.x + bw.y + bw.z, 1e-5);
  bw = max(bw - 0.06, 0.0);
  float total = max(bw.x + bw.y + bw.z, 1e-5);
  vec4 acc = vec4(0.0);
  if (bw.y > 0.0) acc += islPair(la, lb, w, wp.xz, dwx.xz, dwy.xz) * bw.y;
  if (bw.x > 0.0) acc += islPair(la, lb, w, wp.zy, dwx.zy, dwy.zy) * bw.x;
  if (bw.z > 0.0) acc += islPair(la, lb, w, wp.xy, dwx.xy, dwy.xy) * bw.z;
  return acc / total;
}

float islRough(float la, float lb, float w) {
  int ila = int(clamp(la + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  int ilb = int(clamp(lb + 0.5, 0.0, float(${ISLAND_LAYERS} - 1)));
  return mix(islParams[ila].y, islParams[ilb].y, w);
}
`;

/** Everything the island ground shader uses (after `surface/surface-shader.ts`). */
export const ISLAND_SURFACE_GLSL = ISLAND_UNIFORMS_GLSL + ISLAND_GATHER_GLSL + ISLAND_TILE_GLSL;

/**
 * What a painted model needs: no paint mask, so no `islGather` (its `surfTexel` lives in the ground's
 * surface shader, and a model shader that called it failed to compile: the model vanished).
 */
export const ISLAND_MODEL_GLSL = SURF_NOISE_GLSL + ISLAND_UNIFORMS_GLSL + ISLAND_TILE_GLSL;

const islandModelPatched = new WeakSet<THREE.Material>();

/** Whether `injectIslandModelShader` has patched this material. */
export const hasIslandModelShader = (material: THREE.Material) => islandModelPatched.has(material);

/**
 * Injects the island surface shader into a model's material using `onBeforeCompile`.
 * Samples the island texture array with world-space triplanar projection and blends
 * it with height blending over the model's own diffuse texture.
 */
export function injectIslandModelShader(
  material: THREE.Material,
  surfaceArray: IslandSurfaceArray = IslandSurfaceArray.getInstance(),
): void {
  // A WeakSet, not a userData flag: clone() copies userData, so a clone of a patched material (the kit
  // look's copy) read as patched while it had no hook, and never showed the paint.
  if (islandModelPatched.has(material)) return;
  islandModelPatched.add(material);

  const prevOnBeforeCompile = material.onBeforeCompile;
  const prevCacheKey = material.customProgramCacheKey.bind(material);
  // The default key is onBeforeCompile's source, the same for every patched material whatever it wraps.
  material.customProgramCacheKey = () => `islModel|${prevCacheKey()}|${prevOnBeforeCompile.toString()}`;

  material.onBeforeCompile = (shader, renderer) => {
    prevOnBeforeCompile?.call(material, shader, renderer);
    // Already in (a clone that kept a patched material's hook, then was patched itself): once is enough.
    if (shader.vertexShader.includes('vIslSurface')) return;

    // Uniforms
    shader.uniforms['islSurfaces'] = { value: surfaceArray.texture };
    shader.uniforms['islLayerOf'] = { value: ISLAND_LAYER_OF };
    shader.uniforms['islParams'] = { value: surfaceArray.params };
    shader.uniforms['islSoft'] = { value: 0.25 };
    shader.uniforms['islScale'] = { value: 1.0 };
    shader.uniforms['islCliffLayer'] = { value: -1.0 };
    shader.uniforms['islCliffNy'] = { value: new THREE.Vector2(0.4, 0.7) };

    // Vertex shader modifications
    shader.vertexShader = `
      attribute vec2 islSurface;
      varying vec3 vIslWorldPos;
      varying vec3 vIslWorldNormal;
      varying vec2 vIslSurface;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vIslWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vIslWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vIslSurface = islSurface;
      `,
    );

    // Fragment shader modifications
    shader.fragmentShader = `
      varying vec3 vIslWorldPos;
      varying vec3 vIslWorldNormal;
      varying vec2 vIslSurface;
      ${ISLAND_MODEL_GLSL}
      ${shader.fragmentShader}
    `;

    // Hook into color output / map fragment
    const colorHook = shader.fragmentShader.includes('#include <map_fragment>')
      ? '#include <map_fragment>'
      : '#include <color_fragment>';

    shader.fragmentShader = shader.fragmentShader.replace(
      colorHook,
      `
      ${colorHook}
      if (vIslSurface.y > 0.001) {
        float surfaceId = vIslSurface.x;
        float surfaceWeight = clamp(vIslSurface.y, 0.0, 1.0);
        float layer = islLayer(surfaceId);
        if (layer >= 0.0) {
          vec3 dwx = dFdx(vIslWorldPos);
          vec3 dwy = dFdy(vIslWorldPos);
          vec4 islandTex = islTriplanar(layer, layer, 0.0, vIslWorldPos, normalize(vIslWorldNormal), dwx, dwy);
          
          // Natural height-weighted blend over the model's base appearance
          float heightFactor = islandTex.a * 0.4 + 0.8;
          float blendT = clamp(surfaceWeight * heightFactor, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, islandTex.rgb, blendT);
        }
      }
      `,
    );

    // Also adjust roughness if roughnessmap_fragment is present
    if (shader.fragmentShader.includes('#include <roughnessmap_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        if (vIslSurface.y > 0.001) {
          float sId = vIslSurface.x;
          float sWeight = clamp(vIslSurface.y, 0.0, 1.0);
          float l = islLayer(sId);
          if (l >= 0.0) {
            float sRough = islRough(l, l, 0.0);
            roughnessFactor = mix(roughnessFactor, sRough, sWeight);
          }
        }
        `,
      );
    }
  };

  material.needsUpdate = true;
}
