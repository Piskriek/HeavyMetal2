/**
 * ISLAND-ROUTE: GLSL for the island surface set (`island-surfaces.ts`): how a pair of surface IDs and
 * their balance become pixels on the island terrain.
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
 *   (triplanar), so a cliff is never smeared and there is no seam where the projection changes.
 * - Explicit gradients (`textureGrad`) on the mipmapped, repeating array: no atlas, no padding, no seams.
 *
 * Uses `surfNoise` from `surface/surface-shader.ts` (included before this).
 */
import { SURFACE_SLOTS } from '../surface/surface-table';
import { ISLAND_SURFACES } from './island-surfaces';

export const ISLAND_LAYERS = ISLAND_SURFACES.length;

export const ISLAND_SURFACE_GLSL = /* glsl */ `
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

/** The array layer of a surface ID, or -1 when it is not an island tile. */
float islLayer(float id) {
  int i = int(id + 0.5);
  return (i >= 0 && i < ${SURFACE_SLOTS}) ? islLayerOf[i] : -1.0;
}

vec4 islTap(float layer, vec2 uv, vec2 off, vec2 dx, vec2 dy) {
  float rep = islParams[int(layer + 0.5)].x * islScale;
  return textureGrad(islSurfaces, vec3(uv / rep + off, layer), dx / rep, dy / rep);
}

/** One surface, never repeating: two offset taps blended by a smooth noise index and their heights. */
vec4 islVaried(float layer, vec2 uv, vec2 dx, vec2 dy) {
  float rep = islParams[int(layer + 0.5)].x * islScale;
  float l = surfNoise(uv / (rep * 2.7) + layer * 3.1) * 8.0;
  float ia = floor(l);
  vec4 a = islTap(layer, uv, sin(vec2(3.0, 7.0) * ia), dx, dy);
  vec4 b = islTap(layer, uv, sin(vec2(3.0, 7.0) * (ia + 1.0)), dx, dy);
  return mix(a, b, smoothstep(0.2, 0.8, fract(l) + (b.a - a.a) * 0.25));
}

/** Two surfaces by height: \`w\` is B's share; the one standing higher at this pixel takes the edge. */
vec4 islHeightBlend(vec4 a, vec4 b, float w, float contrast) {
  float ha = a.a + (1.0 - w) * 1.1;
  float hb = b.a + w * 1.1;
  float depth = mix(0.06, 0.6, islSoft) / max(contrast, 0.25);
  float m = max(ha, hb) - depth;
  float ba = max(ha - m, 0.0);
  float bb = max(hb - m, 0.0);
  return (a * ba + b * bb) / max(ba + bb, 1e-4);
}

/** Layers \`la\`, \`lb\` with B's share \`w\`: rgb, and the height where they meet (a). */
vec4 islPair(float la, float lb, float w, vec2 uv, vec2 dx, vec2 dy) {
  vec4 a = islVaried(la, uv, dx, dy);
  if (abs(la - lb) < 0.5 || w < 0.004) return a;
  vec4 b = islVaried(lb, uv, dx, dy);
  if (w > 0.996) return b;
  float contrast = 0.5 * (islParams[int(la + 0.5)].z + islParams[int(lb + 0.5)].z);
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
  return mix(islParams[int(la + 0.5)].y, islParams[int(lb + 0.5)].y, w);
}
`;
