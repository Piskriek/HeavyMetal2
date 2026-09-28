/**
 * The surface sampler both painted grounds share: the road ribbon (`road-surface-paint.ts`) and the
 * island terrain (`island-route/island-ground.ts`). One mask format, one atlas, one way to turn
 * `(id0, id1, weight)` into pixels, so a surface painted on the island looks like the same surface
 * painted on a road.
 *
 * - **The mask read** (`surfSample`): four texel taps around the pixel. The IDs come from the texel the
 *   pixel sits in; the weight is the bilinear share of `id1` across the four, so a 47-unit island texel
 *   or a 60-unit road texel never shows as a step. A solid texel next to a different one borrows that
 *   neighbour's ID as its second slot, so a painted edge fades out *across* the boundary instead of
 *   ending in a hard line on the unpainted side.
 * - **The atlas taps** (`surfPair`): explicit gradients (`textureGrad`) over a mipmapped, padded atlas,
 *   clamped to the mip the padding holds. A solid texel spends its two taps on Inigo Quilez's "texture
 *   repetition" (two random offsets picked by a smooth noise index and blended), so a big fill never
 *   shows its 480-unit repeat; a mixed texel spends them on its two surfaces. Two taps either way.
 *
 * GLSL ES 3.0 (three.js is WebGL2-only). Functions take their samplers as arguments, so each material
 * keeps its own uniform names.
 */
import { ATLAS_GRID, ATLAS_PAD, ATLAS_TILE } from './surface-atlas';

export const SURFACE_SAMPLING_GLSL = /* glsl */ `
const float SURF_GRID = ${ATLAS_GRID.toFixed(1)};
const float SURF_PAD = ${ATLAS_PAD.toFixed(6)};
const float SURF_SLOTS = 16.0;
// Largest gradient (atlas uv per pixel) the padding still holds: mip 4 of a ${ATLAS_TILE}-pixel cell.
const float SURF_GRAD_CAP = 16.0 / (SURF_GRID * ${ATLAS_TILE.toFixed(1)});

bool surfIs(float a, float b) { return abs(a - b) < 0.5; }

/** How much of surface \`id\` a texel holds: its id1 share, its id0 share, or all of it when solid. */
float surfPresence(vec4 t, float id) {
  float a = t.r * 255.0, b = t.g * 255.0;
  if (surfIs(a, b)) return surfIs(a, id) ? 1.0 : 0.0;
  float p = 0.0;
  if (surfIs(b, id)) p += t.b;
  if (surfIs(a, id)) p += 1.0 - t.b;
  return p;
}

vec4 surfTexel(sampler2D mask, vec2 size, vec2 cell) {
  cell = clamp(cell, vec2(0.0), size - 1.0);
  return texture(mask, (cell + 0.5) / size);
}

/**
 * (id0, id1, weight of id1) at \`coord\`, in texel units of a \`size\` mask. Four taps.
 */
vec3 surfSample(sampler2D mask, vec2 size, vec2 coord) {
  vec2 p = coord - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec4 t00 = surfTexel(mask, size, i);
  vec4 t10 = surfTexel(mask, size, i + vec2(1.0, 0.0));
  vec4 t01 = surfTexel(mask, size, i + vec2(0.0, 1.0));
  vec4 t11 = surfTexel(mask, size, i + vec2(1.0, 1.0));
  vec4 c = f.y < 0.5 ? (f.x < 0.5 ? t00 : t10) : (f.x < 0.5 ? t01 : t11);
  float id0 = c.r * 255.0;
  float id1 = c.g * 255.0;
  if (surfIs(id0, id1)) {
    // Solid: borrow a neighbour's other surface so the blend fades across the texel edge.
    if (!surfIs(t00.g * 255.0, id0)) id1 = t00.g * 255.0;
    else if (!surfIs(t10.g * 255.0, id0)) id1 = t10.g * 255.0;
    else if (!surfIs(t01.g * 255.0, id0)) id1 = t01.g * 255.0;
    else if (!surfIs(t11.g * 255.0, id0)) id1 = t11.g * 255.0;
    else if (!surfIs(t00.r * 255.0, id0)) id1 = t00.r * 255.0;
    else if (!surfIs(t10.r * 255.0, id0)) id1 = t10.r * 255.0;
    else if (!surfIs(t01.r * 255.0, id0)) id1 = t01.r * 255.0;
    else if (!surfIs(t11.r * 255.0, id0)) id1 = t11.r * 255.0;
  }
  if (surfIs(id0, id1)) return vec3(id0, id1, 0.0);
  float w = mix(mix(surfPresence(t00, id1), surfPresence(t10, id1), f.x),
                mix(surfPresence(t01, id1), surfPresence(t11, id1), f.x), f.y);
  return vec3(id0, id1, w);
}

float surfHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float surfNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(surfHash(i), surfHash(i + vec2(1.0, 0.0)), f.x), mix(surfHash(i + vec2(0.0, 1.0)), surfHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/** One atlas tap: surface \`id\` at \`world\`, one repeat per \`rep\` units, shifted \`off\` repeats. */
vec3 surfTap(sampler2D atlas, float id, vec2 world, float rep, vec2 off, vec2 dx, vec2 dy) {
  float col = mod(id, SURF_GRID);
  float row = floor(id / SURF_GRID);
  float inner = (1.0 - 2.0 * SURF_PAD) / SURF_GRID;
  vec2 uv = (vec2(col, row) + SURF_PAD) / SURF_GRID + fract(world / rep + off) * inner;
  vec2 gx = dx / rep * inner;
  vec2 gy = dy / rep * inner;
  gx *= min(1.0, SURF_GRAD_CAP / max(length(gx), 1e-9));
  gy *= min(1.0, SURF_GRAD_CAP / max(length(gy), 1e-9));
  return textureGrad(atlas, uv, gx, gy).rgb;
}

/**
 * Two surfaces blended by \`w\`, in two taps. \`dx\`/\`dy\` are dFdx/dFdy of \`world\`, taken by the caller
 * outside any branch (derivatives are undefined in non-uniform control flow).
 */
vec3 surfPair(sampler2D atlas, float id0, float id1, float w, vec2 world, float rep, vec2 dx, vec2 dy) {
  float l = surfNoise(world / (rep * 3.0)) * 8.0;
  float ia = floor(l);
  vec2 oa = sin(vec2(3.0, 7.0) * ia);
  if (surfIs(id0, id1)) {
    vec2 ob = sin(vec2(3.0, 7.0) * (ia + 1.0));
    vec3 a = surfTap(atlas, id0, world, rep, oa, dx, dy);
    vec3 b = surfTap(atlas, id0, world, rep, ob, dx, dy);
    return mix(a, b, smoothstep(0.2, 0.8, fract(l) - 0.1 * dot(a - b, vec3(1.0))));
  }
  return mix(surfTap(atlas, id0, world, rep, oa, dx, dy), surfTap(atlas, id1, world, rep, oa, dx, dy), w);
}

/** Per-surface parameters (r roughness, g wet response), one texel per ID. */
vec4 surfParamsOf(sampler2D params, float id) { return texture(params, vec2((id + 0.5) / SURF_SLOTS, 0.5)); }
`;
