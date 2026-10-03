import { SURFACE_SLOTS } from './surface-set';

/**
 * The island ground shader, ported from the HeavyMetal2 island route (island-surface-shader.ts) and adapted to metres:
 *  - height blending: each tile carries a height in alpha; where two surfaces meet the one standing higher at that pixel wins
 *  - no visible repeats: every surface is sampled twice with noise-picked offsets and blended where their heights agree
 *  - soft borders: the two-surface paint mask is read as a weighted gather of the four texels around the pixel
 *  - any slope: tiles are projected from above and from both sides, blended by the normal (triplanar)
 *  - PBR: a second array holds normal x/y + roughness per tile; the bump tilts the shading normal
 */

export const NOISE_GLSL = /* glsl */ `
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
vec4 surfTexel(sampler2D mask, vec2 size, vec2 cell) {
  cell = clamp(cell, vec2(0.0), size - 1.0);
  return texture(mask, (cell + 0.5) / size);
}
`;

export const uniformsGlsl = (layers: number): string => /* glsl */ `
uniform sampler2DArray islSurfaces;
uniform sampler2DArray islPbr;
uniform sampler2D islFlatPalette;
uniform float islNormalStrength;
uniform float islLayerOf[${SURFACE_SLOTS}];
uniform vec4 islParams[${layers}];
uniform float islSoft;
uniform float islScale;
uniform float islCliffLayer;
uniform vec2 islCliffNy;
uniform sampler2D paintMask;
uniform vec2 paintRes;
uniform vec2 paintOrigin;
uniform float paintCell;
uniform sampler2D islBlocks;
uniform vec2 islBlockOrigin;
uniform vec2 islBlockMax;
`;

export const tileGlsl = (layers: number): string => /* glsl */ `
// total weight of surface \`id\` over the eight slots (four texels x two surfaces)
float islTotal(float id, vec4 ida, vec4 idb, vec4 wa, vec4 wb) {
  return dot(vec4(equal(ida, vec4(id))), wa) + dot(vec4(equal(idb, vec4(id))), wb);
}
void islKeep(float id, float w, inout float bestId, inout float bestW) {
  if (w > bestW) { bestW = w; bestId = id; }
}
// The two strongest surfaces among the four mask texels around the pixel, and the weight of the second.
// Written with vectors and no indexed arrays: ANGLE turns indexed local arrays into slow D3D temp arrays (it halved the frame rate on Intel HD graphics).
vec3 islGather(sampler2D mask, vec2 size, vec2 coord) {
  vec2 p = coord - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec4 t0 = surfTexel(mask, size, i);
  vec4 t1 = surfTexel(mask, size, i + vec2(1.0, 0.0));
  vec4 t2 = surfTexel(mask, size, i + vec2(0.0, 1.0));
  vec4 t3 = surfTexel(mask, size, i + vec2(1.0, 1.0));
  vec4 bw = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 ida = floor(vec4(t0.r, t1.r, t2.r, t3.r) * 255.0 + 0.5);
  vec4 idb = floor(vec4(t0.g, t1.g, t2.g, t3.g) * 255.0 + 0.5);
  vec4 bl = vec4(t0.b, t1.b, t2.b, t3.b);
  vec4 solid = vec4(equal(ida, idb));
  vec4 wa = bw * mix(1.0 - bl, vec4(1.0), solid);
  vec4 wb = bw * bl * (1.0 - solid);
  vec4 ta = vec4(islTotal(ida.x, ida, idb, wa, wb), islTotal(ida.y, ida, idb, wa, wb), islTotal(ida.z, ida, idb, wa, wb), islTotal(ida.w, ida, idb, wa, wb));
  vec4 tb = vec4(islTotal(idb.x, ida, idb, wa, wb), islTotal(idb.y, ida, idb, wa, wb), islTotal(idb.z, ida, idb, wa, wb), islTotal(idb.w, ida, idb, wa, wb));
  // the strongest, earliest slot first on a tie (texel order, first surface before second)
  float aId = 0.0, aW = 0.0;
  islKeep(ida.x, ta.x, aId, aW); islKeep(idb.x, tb.x, aId, aW);
  islKeep(ida.y, ta.y, aId, aW); islKeep(idb.y, tb.y, aId, aW);
  islKeep(ida.z, ta.z, aId, aW); islKeep(idb.z, tb.z, aId, aW);
  islKeep(ida.w, ta.w, aId, aW); islKeep(idb.w, tb.w, aId, aW);
  if (aW <= 0.0) return vec3(0.0, 0.0, 0.0);
  // the strongest other surface
  vec4 ma = vec4(notEqual(ida, vec4(aId))), mb = vec4(notEqual(idb, vec4(aId)));
  ta *= ma; tb *= mb;
  float bId = -1.0, bW = 0.0;
  islKeep(ida.x, ta.x, bId, bW); islKeep(idb.x, tb.x, bId, bW);
  islKeep(ida.y, ta.y, bId, bW); islKeep(idb.y, tb.y, bId, bW);
  islKeep(ida.z, ta.z, bId, bW); islKeep(idb.z, tb.z, bId, bW);
  islKeep(ida.w, ta.w, bId, bW); islKeep(idb.w, tb.w, bId, bW);
  if (bId < 0.0) return vec3(aId, aId, 0.0);
  return vec3(aId, bId, bW / max(aW + bW, 1e-5));
}

float islLayer(float id) {
  int i = int(id + 0.5);
  return (i >= 1 && i < ${SURFACE_SLOTS}) ? islLayerOf[i] : -1.0;
}

vec4 islTap(float layer, vec2 uv, vec2 off, vec2 dx, vec2 dy) {
  int il = int(clamp(layer + 0.5, 0.0, float(${layers} - 1)));
  float rep = max(islParams[il].x * islScale, 0.05);
  return textureGrad(islSurfaces, vec3(uv / rep + off, float(il)), dx / rep, dy / rep);
}

vec4 islVaried(float layer, vec2 uv, vec2 dx, vec2 dy) {
  int il = int(clamp(layer + 0.5, 0.0, float(${layers} - 1)));
  float rep = max(islParams[il].x * islScale, 0.05);
  float l = surfNoise(uv / (rep * 2.7) + layer * 3.1) * 8.0;
  float ia = floor(l);
  vec4 a = islTap(layer, uv, sin(vec2(3.0, 7.0) * ia), dx, dy);
  vec4 b = islTap(layer, uv, sin(vec2(3.0, 7.0) * (ia + 1.0)), dx, dy);
  return mix(a, b, smoothstep(0.2, 0.8, fract(l) + (b.a - a.a) * 0.25));
}

vec4 islHeightBlend(vec4 a, vec4 b, float w, float contrast) {
  float ha = a.a + (1.0 - w) * 1.1;
  float hb = b.a + w * 1.1;
  float depth = mix(0.06, 0.6, islSoft) / max(contrast, 0.25);
  float m = max(ha, hb) - depth;
  float ba = max(ha - m, 0.0);
  float bb = max(hb - m, 0.0);
  return (a * ba + b * bb) / max(ba + bb, 1e-4);
}

vec4 islPair(float la, float lb, float w, vec2 uv, vec2 dx, vec2 dy) {
  vec4 a = islVaried(la, uv, dx, dy);
  if (abs(la - lb) < 0.5 || w < 0.004) return a;
  vec4 b = islVaried(lb, uv, dx, dy);
  if (w > 0.996) return b;
  int ila = int(clamp(la + 0.5, 0.0, float(${layers} - 1)));
  int ilb = int(clamp(lb + 0.5, 0.0, float(${layers} - 1)));
  float contrast = 0.5 * (islParams[ila].z + islParams[ilb].z);
  return islHeightBlend(a, b, w, contrast);
}

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

// the normal/roughness tile, sampled with the SAME anti-repeat offsets as the colour (islVaried), so the bumps sit on the pebbles and blades you see
vec4 islPbrVaried(float layer, vec2 uv, vec2 dx, vec2 dy) {
  int il = int(clamp(layer + 0.5, 0.0, float(${layers} - 1)));
  float rep = max(islParams[il].x * islScale, 0.05);
  float l = surfNoise(uv / (rep * 2.7) + layer * 3.1) * 8.0;
  float ia = floor(l);
  vec2 oa = sin(vec2(3.0, 7.0) * ia), ob = sin(vec2(3.0, 7.0) * (ia + 1.0));
  float ha = textureGrad(islSurfaces, vec3(uv / rep + oa, float(il)), dx / rep, dy / rep).a;
  float hb = textureGrad(islSurfaces, vec3(uv / rep + ob, float(il)), dx / rep, dy / rep).a;
  vec4 a = textureGrad(islPbr, vec3(uv / rep + oa, float(il)), dx / rep, dy / rep);
  vec4 b = textureGrad(islPbr, vec3(uv / rep + ob, float(il)), dx / rep, dy / rep);
  return mix(a, b, smoothstep(0.2, 0.8, fract(l) + (hb - ha) * 0.25));
}

vec4 islPbrAt(float la, float lb, float w, vec3 wp, vec3 n, vec3 dwx, vec3 dwy) {
  vec3 an = abs(n);
  bool top = an.y > 0.55;
  bool xdom = an.x > an.z;
  vec2 puv = top ? wp.xz : (xdom ? wp.zy : wp.xy);
  vec2 pdx = top ? dwx.xz : (xdom ? dwx.zy : dwx.xy);
  vec2 pdy = top ? dwy.xz : (xdom ? dwy.zy : dwy.xy);
  vec3 U = top ? vec3(1.0, 0.0, 0.0) : (xdom ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
  vec3 V = top ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec4 a = islPbrVaried(la, puv, pdx, pdy);
  vec4 b = abs(la - lb) < 0.5 ? a : islPbrVaried(lb, puv, pdx, pdy);
  float has = mix(a.a, b.a, w);
  if (has < 0.5) return vec4(0.0, 0.0, 0.0, -1.0);
  vec2 t = (mix(a.rg, b.rg, w) - 0.5) * 2.0 * islNormalStrength;
  return vec4(U * t.x + V * t.y, mix(a.b, b.b, w));
}

float islRough(float la, float lb, float w) {
  int ila = int(clamp(la + 0.5, 0.0, float(${layers} - 1)));
  int ilb = int(clamp(lb + 0.5, 0.0, float(${layers} - 1)));
  return mix(islParams[ila].y, islParams[ilb].y, w);
}
`;

/** Declared before main(): what the colour stage hands to the roughness and normal stages. */
export const GLOBALS_GLSL = /* glsl */ `
varying vec3 vTWorld;
varying vec3 vTNormal;
float gRough = -1.0;
float gGlow = 0.0;
vec3 gBump = vec3(0.0);
`;

/**
 * Replaces `#include <color_fragment>`: the island surface at this pixel becomes the diffuse colour.
 * ISL_FLAT (defined for the flat skin) compiles only the flat path: a runtime switch kept the whole PBR path in the program,
 * and weak graphics chips paid for it.
 */
export const COLOR_STAGE_GLSL = /* glsl */ `
#include <color_fragment>
{
  vec3 gnrm = normalize(vTNormal);
#ifdef ISL_FLAT
  // the flat skin shows the ground in half-metre blocks, like the voxel goblin; each block's two surfaces are baked (flat-blocks.ts)
  vec3 wp = floor(vTWorld / 0.5) * 0.5 + 0.25;
  vec4 bs = texelFetch(islBlocks, ivec2(clamp(floor(vTWorld.xz / 0.5) - islBlockOrigin, vec2(0.0), islBlockMax)), 0);
  vec3 sm = vec3(floor(bs.rg * 255.0 + 0.5), bs.b);
#else
  vec3 wp = vTWorld;
  vec3 dwx = dFdx(vTWorld);
  vec3 dwy = dFdy(vTWorld);
  vec2 coord = (wp.xz - paintOrigin) / paintCell + 0.5;
  vec2 mwarp = vec2(surfNoise(wp.xz / 9.0), surfNoise(wp.xz / 9.0 + 19.7)) - 0.5;
  vec3 sm = islGather(paintMask, paintRes, coord + mwarp * 1.4);
#endif
  float la = islLayer(sm.x);
  float lb = islLayer(sm.y);
  float lw = sm.x == sm.y ? 0.0 : sm.z;
  if (la < 0.0) { la = lb; lw = 1.0; }
  if (lb < 0.0) { lb = la; lw = 0.0; }
  if (la >= 0.0) {
    float steep = islCliffLayer >= 0.0 ? 1.0 - smoothstep(islCliffNy.y, islCliffNy.x, gnrm.y) : 0.0;
    vec4 tile;
#ifdef ISL_FLAT
    // voxel look: every half-metre block takes one tone of its surface's hand-picked palette; where two surfaces meet, each block picks one of them
    vec3 bk = floor(vTWorld / 0.5);
    float hTone = fract(sin(dot(bk, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float hMix = fract(sin(dot(bk, vec3(39.346, 11.135, 83.155))) * 24634.6345);
    float layer = hMix < lw ? lb : la;
    if (islCliffLayer >= 0.0 && hMix < steep) layer = islCliffLayer;
    tile = vec4(texelFetch(islFlatPalette, ivec2(int(floor(hTone * 5.0)), int(layer + 0.5)), 0).rgb, 1.0);
    gGlow = islParams[int(layer + 0.5)].w * smoothstep(0.1, 0.3, dot(tile.rgb, vec3(0.2126, 0.7152, 0.0722)));
    diffuseColor.rgb = tile.rgb;
    gRough = 0.92;
#else
    tile = islTriplanar(la, lb, lw, wp, gnrm, dwx, dwy);
    // far away a small tile repeats like a checkerboard: blend in the same surface at three times the size, and vary its tone in big patches
    float far = smoothstep(18.0, 80.0, length(cameraPosition - vTWorld));
    if (far > 0.01) tile = mix(tile, islTriplanar(la, lb, lw, wp * 0.31 + 17.3, gnrm, dwx * 0.31, dwy * 0.31), far * 0.55);
    if (steep > 0.01) tile = mix(tile, islTriplanar(islCliffLayer, islCliffLayer, 0.0, wp, gnrm, dwx, dwy), steep);
    tile.rgb *= mix(0.9 + 0.2 * surfNoise(wp.xz / 70.0 + 3.7), 0.8 + 0.4 * surfNoise(wp.xz / 31.0 + 9.1), far);
    diffuseColor.rgb = tile.rgb;
    gRough = islRough(la, lb, lw);
    vec4 pbrTile = islPbrAt(la, lb, lw, wp, gnrm, dwx, dwy);
    if (pbrTile.w >= 0.0) { gRough = pbrTile.w; gBump = pbrTile.xyz; }
#endif
    float wet = 1.0 - smoothstep(0.0, 1.3, wp.y);
    diffuseColor.rgb *= 1.0 - 0.32 * wet;
    gRough = gRough * (1.0 - 0.45 * wet);
  }
}
`;

export const ROUGH_STAGE_GLSL = /* glsl */ `
#include <roughnessmap_fragment>
if (gRough >= 0.0) roughnessFactor = clamp(gRough, 0.04, 1.0);
`;

export const NORMAL_STAGE_GLSL = /* glsl */ `
#include <normal_fragment_maps>
if (dot(gBump, gBump) > 0.0) normal = normalize(normal + (viewMatrix * vec4(gBump, 0.0)).xyz);
`;

/** Replaces `#include <emissivemap_fragment>`: glowing surfaces (lava) give off their own colour. */
export const EMISSIVE_STAGE_GLSL = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * gGlow;
`;
