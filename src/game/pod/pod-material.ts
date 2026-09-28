/**
 * Hoop-Pod material (docs/HOOP_POD.md §Shader).
 *
 * A MeshStandardMaterial patched with onBeforeCompile, so it keeps three's lighting, fog and tone
 * mapping (the track uses ACES + sRGB output and no environment map). Per-instance attributes:
 *
 *   iAnim  vec4  roll, differential, pitch, lean          (dynamic, packed by the fleet each frame)
 *   iPrim / iSec / iTrim / iGlass / iDecal  vec3         (linear colours)
 *   iStyle vec4  hubDecal, bandPattern, wear, bakeLayer+1 (0 = no garage design)
 *
 * When `bakeLayer+1 > 0` the hoop crowns sample the Ball Garage's equirect bake (`podBake`, one
 * layer per design) at `aBakeUv`, keep the atlas' painted rivets/edge AO over it, add the bake's
 * emissive layer, and the hubcaps take the cap finish (iTrim). One program serves every LOD.
 */
import * as THREE from 'three';
import { HUB_CENTER, HUB_RADIUS_UV, type PodTextures } from './pod-atlas';

const VERT_HEAD = /* glsl */ `
attribute vec2 aPart;
attribute vec4 iAnim;
mat3 podRotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 podRotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
mat3 podRot(){
  if (aPart.x > 0.5) return podRotX(iAnim.x + iAnim.y * aPart.y * 0.55);
  return podRotZ(iAnim.w) * podRotX(iAnim.z);
}
`;
const VERT_LIVERY = /* glsl */ `
attribute vec2 aBakeUv;
attribute vec3 iPrim; attribute vec3 iSec; attribute vec3 iTrim; attribute vec3 iGlass; attribute vec3 iDecal; attribute vec4 iStyle;
varying vec3 vPrim; varying vec3 vSec; varying vec3 vTrim; varying vec3 vGlass; varying vec3 vDecal; varying vec4 vStyle;
varying vec2 vBakeUv; varying float vCrown;
`;

const FRAG = /* glsl */ `
#include <map_fragment>
{
  vec2 auv = vMapUv;
  vec4 mk = texture2D(podMask, auv);
  vec3 base = diffuseColor.rgb;
  float gm = min(mk.r, mk.g);
  float pr = mk.r - gm; float se = mk.g - gm; float tr = mk.b;
  float paint = clamp(pr + se, 0.0, 1.0);
  float layer = vStyle.w - 1.0;
  bool baked = layer > -0.5;
  bool hub = auv.x < 0.25 && auv.y > 0.5 && auv.y < 0.75;
  vec3 tint = vec3(1.0);
  tint = mix(tint, (baked && hub) ? vTrim : vPrim, pr);
  tint = mix(tint, vSec, se);
  tint = mix(tint, vTrim, tr);
  tint = mix(tint, vGlass, gm);
  vec3 col = base * tint;
  vec3 glow = vec3(0.0);

  // Sampled unconditionally: implicit-LOD lookups inside per-fragment branches have undefined
  // derivatives on some GPUs (crown vs wall varies within one draw). Garage bake row 0 is v = 1.
  vec3 bakeUvw = vec3(vBakeUv.x, 1.0 - vBakeUv.y, max(layer, 0.0));
  vec3 painted = texture(podBake, bakeUvw).rgb;
  vec3 paintedGlow = texture(podBakeGlow, bakeUvw).rgb;
  vec2 hubP = (auv - vec2(${HUB_CENTER.u.toFixed(4)}, ${HUB_CENTER.v.toFixed(4)})) / ${HUB_RADIUS_UV.toFixed(4)};
  float emblem = floor(vStyle.x + 0.5);
  vec2 emblemUv = (vec2(mod(max(emblem - 1.0, 0.0), 4.0), floor(max(emblem - 1.0, 0.0) / 4.0)) + clamp(hubP / 1.24 + 0.5, 0.004, 0.996)) / 4.0;
  vec4 emblemTexel = texture2D(podDecals, emblemUv);

  if (baked && vCrown > 0.5) {
    float detail = clamp(base.g * 1.22, 0.32, 1.25);          // keeps edge AO, seams and dabs
    col = mix(painted * detail, base * vTrim, tr);             // rivets stay metal
    glow += paintedGlow * 1.2;
  } else if (!baked && auv.y < 0.25) {
    float lv = fract(auv.y * 8.0);
    float u = auv.x;
    float pid = floor(vStyle.y + 0.5);
    float pm = 0.0;
    if (pid == 1.0) pm = abs(step(0.5, fract(u * 24.0)) - step(0.5, lv));
    else if (pid == 2.0) pm = step(abs(lv - 0.5), 0.1);
    else if (pid == 3.0) { float f = fract(u * 14.0); pm = step(lv, 0.28 + 0.5 * pow(1.0 - f, 2.0)) * step(0.2, lv); }
    else if (pid == 4.0) pm = step(fract(u * 20.0 + abs(lv - 0.5) * 1.2), 0.35);
    else if (pid == 5.0) pm = step(length(vec2(fract(u * 20.0) - 0.5, (lv - 0.5) * 0.45)), 0.2);
    else if (pid == 6.0) {
      float line = step(abs(lv - 0.5), 0.035);
      float tick = step(fract(u * 32.0), 0.12) * step(abs(lv - 0.5), 0.16);
      float rune = step(abs(fract(u * 16.0 + lv * 0.5) - 0.5), 0.03) * step(abs(lv - 0.5), 0.14);
      pm = max(line, max(tick, rune));
    }
    pm *= step(0.2, lv) * step(lv, 0.8) * paint;
    vec3 pc = pid == 6.0 ? vDecal : base * vDecal * 1.15;
    col = mix(col, pc, pm);
    if (pid == 6.0) glow += vDecal * pm * 1.4;
  }

  if (hub && emblem > 0.5 && length(hubP) < 0.62) {
    col = mix(col, emblemTexel.rgb * vDecal * clamp(base.g * 1.15, 0.4, 1.2), emblemTexel.a);
  }

  float wear = vStyle.z;
  float gr = (mk.a - 0.25) / 0.75;
  float wm = smoothstep(1.0 - wear, 1.0 - wear + 0.06, gr) * paint * step(0.01, wear);
  vec3 bare = mix(vec3(0.66, 0.64, 0.62), vec3(0.52, 0.24, 0.09), smoothstep(0.4, 0.9, wear));
  col = mix(col, base * bare * 1.25, wm);

  diffuseColor.rgb = col;
  glow += gm * vGlass * base * 1.1;
  totalEmissiveRadiance += glow;
}
`;

export interface PodBakeTextures {
  readonly albedo: THREE.DataArrayTexture;
  readonly glow: THREE.DataArrayTexture;
}

export interface PodMaterials {
  readonly surface: THREE.MeshStandardMaterial;
  readonly depth: THREE.MeshDepthMaterial;
}

export function createPodMaterials(tx: PodTextures, bake: PodBakeTextures): PodMaterials {
  const surface = new THREE.MeshStandardMaterial({ map: tx.base, roughness: 0.55, metalness: 0.12 });
  surface.name = 'HoopPod';
  surface.onBeforeCompile = (shader) => {
    shader.uniforms.podMask = { value: tx.mask };
    shader.uniforms.podDecals = { value: tx.decals };
    shader.uniforms.podBake = { value: bake.albedo };
    shader.uniforms.podBakeGlow = { value: bake.glow };
    shader.vertexShader = (VERT_HEAD + VERT_LIVERY + shader.vertexShader)
      .replace(
        '#include <beginnormal_vertex>',
        'vec3 objectNormal = podRot() * vec3( normal );\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif',
      )
      .replace(
        '#include <begin_vertex>',
        'vec3 transformed = podRot() * vec3( position );\n' +
          'vPrim = iPrim; vSec = iSec; vTrim = iTrim; vGlass = iGlass; vDecal = iDecal; vStyle = iStyle;\n' +
          'vBakeUv = aBakeUv; vCrown = step(1.5, aPart.x);',
      );
    shader.fragmentShader =
      'uniform sampler2D podMask; uniform sampler2D podDecals;\n' +
      'uniform highp sampler2DArray podBake; uniform highp sampler2DArray podBakeGlow;\n' +
      'varying vec3 vPrim; varying vec3 vSec; varying vec3 vTrim; varying vec3 vGlass; varying vec3 vDecal; varying vec4 vStyle;\n' +
      'varying vec2 vBakeUv; varying float vCrown;\n' +
      shader.fragmentShader
        .replace('#include <map_fragment>', FRAG)
        .replace(
          '#include <dithering_fragment>',
          'float podRim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n' +
            'gl_FragColor.rgb += vec3(1.0, 0.9, 0.7) * pow(podRim, 2.6) * 0.28;\n#include <dithering_fragment>',
        );
  };
  surface.customProgramCacheKey = () => 'hoop-pod-v3';

  // Shadow-map pass (the track does not enable shadow maps today; this keeps the pod correct if it does).
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    shader.vertexShader = (VERT_HEAD + shader.vertexShader).replace(
      '#include <begin_vertex>',
      'vec3 transformed = podRot() * vec3( position );',
    );
  };
  depth.customProgramCacheKey = () => 'hoop-pod-depth-v3';
  return { surface, depth };
}
