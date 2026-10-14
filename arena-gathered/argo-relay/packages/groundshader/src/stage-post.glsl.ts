// ============================================================================
// File: packages/groundshader/src/stage-post.glsl.ts
// Briefs: Brief 27 (Stage 0a Wireframe & 0b 1-Bit Flat Facets) + Plan 25 (Suit-Cam)
// Purity: Pure deterministic uniform computation + single-pass GLSL fragment shader.
// ============================================================================

export interface FourFloats {
  Pxd: number;
  Vtx: number;
  Lx: number;
  Aq: number;
}

export type HudFidelitySkin = '0a' | '0b' | '1' | '2' | '3' | '4-6';

export interface StagePostUniforms {
  uStageMode: number;        // 0 = 0a Wireframe, 1 = 0b 1-Bit Dither, 2 = EGA, 3 = VGA, 4 = Gouraud, 5 = Suit-Cam PBR
  uWireframeMix: number;     // 1.0 in Stage 0a -> 0.0 once first machine ticks
  uDitherMix: number;        // 1.0 in Stage 0b -> 0.0 by Stage 2
  uEgaMix: number;           // 1.0 in Stage 1 -> 0.0 by Stage 2
  uSuitCamMix: number;       // 0.0 in Stages 0-3 -> 0.35 (S4) -> 0.65 (S5) -> 1.00 (S6)
  uIrisExposure: number;     // Lagging auto-exposure multiplier (blows out +0.85 EV on doorway step-out)
  uWetLensMix: number;       // 0.0..1.0 micro-droplet refraction near Water Makers / lakes
  uGatePos: [number, number, number]; // Planet Twin Gate position for 15m warm #ffc13d amber coil pool
  hudSkin: HudFidelitySkin;
}

/**
 * Pure deterministic mapping from S = (Pxd, Vtx, Lx, Aq) and machine count to post uniforms and HUD skin.
 */
export function computeStagePostUniforms(
  s: FourFloats,
  hasActiveMachineOnPlot: boolean,
  currentIrisEV = 1.0,
  targetIrisEV = 1.0,
  dt = 0.016,
  nearWaterOrPlume = 0.0,
  gatePos: [number, number, number] = [0, 0, 0]
): StagePostUniforms {
  const meanS = (s.Pxd + s.Vtx + s.Lx + s.Aq) * 0.25;

  // Lagging auto-exposure iris (tau = 0.45s stepping into sunlight, 0.85s stepping into shade)
  const tau = targetIrisEV > currentIrisEV ? 0.45 : 0.85;
  const alpha = Math.min(1.0, Math.max(0.0, dt / tau));
  const uIrisExposure = currentIrisEV + (targetIrisEV - currentIrisEV) * alpha;

  // Stage 0a: Cold Boot before the first machine ticks on the Moon
  if (!hasActiveMachineOnPlot && s.Pxd < 0.08 && s.Vtx < 0.08) {
    return {
      uStageMode: 0,
      uWireframeMix: 1.0,
      uDitherMix: 0.0,
      uEgaMix: 0.0,
      uSuitCamMix: 0.0,
      uIrisExposure,
      uWetLensMix: 0.0,
      uGatePos: gatePos,
      hudSkin: '0a',
    };
  }

  // Stage 0b: 1-Bit Flat-Shaded Cylindrical Dither
  if (s.Pxd < 0.20 && s.Vtx < 0.20) {
    return {
      uStageMode: 1,
      uWireframeMix: 0.0,
      uDitherMix: 1.0,
      uEgaMix: 0.0,
      uSuitCamMix: 0.0,
      uIrisExposure,
      uWetLensMix: 0.0,
      uGatePos: gatePos,
      hudSkin: '0b',
    };
  }

  // Stage 1: 16-Color EGA Flat Facets
  if (s.Pxd < 0.45 || s.Lx < 0.35) {
    return {
      uStageMode: 2,
      uWireframeMix: 0.0,
      uDitherMix: 0.35,
      uEgaMix: 1.0,
      uSuitCamMix: 0.0,
      uIrisExposure,
      uWetLensMix: 0.0,
      uGatePos: gatePos,
      hudSkin: '1',
    };
  }

  // Stage 2: 256-Color VGA
  if (s.Vtx < 0.65 || s.Lx < 0.65) {
    return {
      uStageMode: 3,
      uWireframeMix: 0.0,
      uDitherMix: 0.0,
      uEgaMix: 0.0,
      uSuitCamMix: 0.0,
      uIrisExposure,
      uWetLensMix: 0.0,
      uGatePos: gatePos,
      hudSkin: '2',
    };
  }

  // Stage 3: 16-Bit Smooth Gouraud (before Aq >= 0.40 hydro bloom)
  if (s.Aq < 0.40) {
    return {
      uStageMode: 4,
      uWireframeMix: 0.0,
      uDitherMix: 0.0,
      uEgaMix: 0.0,
      uSuitCamMix: 0.0,
      uIrisExposure,
      uWetLensMix: 0.0,
      uGatePos: gatePos,
      hudSkin: '3',
    };
  }

  // Stages 4–6: Hydro Lakes (0.35) -> Coverage Creep (0.65) -> Full Forest Suit-Cam PBR (1.00)
  const suitCamMix =
    meanS >= 0.85 ? 1.0 : meanS >= 0.72 ? 0.65 : 0.35;

  return {
    uStageMode: 5,
    uWireframeMix: 0.0,
    uDitherMix: 0.0,
    uEgaMix: 0.0,
    uSuitCamMix: suitCamMix,
    uIrisExposure,
    uWetLensMix: Math.min(1.0, Math.max(0.0, nearWaterOrPlume)),
    uGatePos: gatePos,
    hudSkin: '4-6',
  };
}

/**
 * Single-Pass Post-Processing Fragment Shader (GLSL ES 3.0 / WebGL2)
 * Reconstructs view-space positions and flat facet normals from tDepth so terrain and all props
 * automatically render as Hidden-Line Wireframe (0a) or Flat-Faceted 1-Bit Dither (0b).
 */
export const STAGE_POST_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform mat4 uInverseProjection;
uniform mat4 uInverseView;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uGatePos;

uniform int uStageMode;
uniform float uWireframeMix;
uniform float uDitherMix;
uniform float uEgaMix;
uniform float uSuitCamMix;
uniform float uIrisExposure;
uniform float uWetLensMix;

varying vec2 vUv;

// 4x4 Ordered Bayer Matrix (0..1)
float bayer4x4(vec2 pos) {
  ivec2 p = ivec2(mod(pos, 4.0));
  int idx = p.y * 4 + p.x;
  float m[16] = float[16](
     0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
    12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
     3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
    15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
  );
  return m[idx];
}

// Reconstruct View-Space Position from Depth Buffer
vec3 getViewPos(vec2 uv) {
  float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
  vec4 clip = vec4(uv * 2.0 - 1.0, z, 1.0);
  vec4 view = uInverseProjection * clip;
  return view.xyz / max(view.w, 0.00001);
}

// ACES Filmic Tone Mapping for Suit-Cam CMOS Pass
vec3 acesFilm(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 baseCol = texture2D(tDiffuse, vUv);
  float rawDepth = texture2D(tDepth, vUv).r;

  // Sky pixels (rawDepth >= 0.9999) bypass geometry facet reconstruction
  bool isSky = (rawDepth >= 0.9999);

  vec3 viewPos = getViewPos(vUv);
  vec3 worldPos = (uInverseView * vec4(viewPos, 1.0)).xyz;

  // Reconstruct flat facet normal from screen-space derivatives of viewPos
  vec3 dPdx = dFdx(viewPos);
  vec3 dPdy = dFdy(viewPos);
  vec3 flatViewNormal = normalize(cross(dPdx, dPdy));
  vec3 flatWorldNormal = normalize((uInverseView * vec4(flatViewNormal, 0.0)).xyz);

  // Depth & Normal discontinuity crease edge detector for Stage 0a & 0b
  float zL = texture2D(tDepth, vUv - vec2(texel.x, 0.0)).r;
  float zR = texture2D(tDepth, vUv + vec2(texel.x, 0.0)).r;
  float zU = texture2D(tDepth, vUv + vec2(0.0, texel.y)).r;
  float zD = texture2D(tDepth, vUv - vec2(0.0, texel.y)).r;
  float depthEdge = step(0.0012, abs(zL - rawDepth) + abs(zR - rawDepth) + abs(zU - rawDepth) + abs(zD - rawDepth));

  // World-space 2m x 2m grid lines for Stage 0a Wireframe ground
  vec2 gridUv = abs(fract(worldPos.xz * 0.5 - 0.5) - 0.5) / max(fwidth(worldPos.xz * 0.5), vec2(0.001));
  float worldGridLine = 1.0 - min(min(gridUv.x, gridUv.y), 1.0);
  float distFade = exp(-length(worldPos - uCameraPos) * 0.012);
  float wireEdge = max(depthEdge, worldGridLine * distFade * 0.75);

  // 15m Twin Gate Amber (#ffc13d) Safe Haven Pool (DEC-06)
  float gateDist = length(worldPos - uGatePos);
  float gateAmberPool = smoothstep(15.0, 2.0, gateDist);

  // Preserve saturated emissive plumes/lasers (#ff3d8a, #7cff4d, #ffc13d, #3dc8ff, #b46bff)
  float maxC = max(max(baseCol.r, baseCol.g), baseCol.b);
  float minC = min(min(baseCol.r, baseCol.g), baseCol.b);
  bool isEmissiveAccent = (maxC - minC > 0.35 && maxC > 0.65);

  // STAGE 0a: Hidden-Line Vector Wireframe
  if (uStageMode == 0 && !isEmissiveAccent) {
    vec3 wireColor = mix(vec3(0.91, 0.93, 0.96), vec3(1.0, 0.76, 0.24), gateAmberPool);
    vec3 bg = vec3(0.02, 0.024, 0.031);
    gl_FragColor = vec4( isSky ? bg : mix(bg, wireColor, wireEdge), 1.0 );
    return;
  }

  // STAGE 0b: 1-Bit Flat-Faceted Cylindrical Obra Dinn Dither
  if (uStageMode == 1 && !isEmissiveAccent) {
    vec3 viewDir = normalize(worldPos - uCameraPos);
    vec2 sphericalUv = vec2(atan(viewDir.x, viewDir.z), asin(clamp(viewDir.y, -1.0, 1.0)));
    vec2 lockedGrid = floor(sphericalUv * 512.0);
    float threshold = bayer4x4(lockedGrid);

    float flatLuma = isSky ? 0.0 : clamp(dot(flatWorldNormal, normalize(uSunDir)) * 0.65 + 0.28, 0.05, 0.95);
    float bit = step(threshold, flatLuma);
    float finalBit = max(bit, depthEdge * 0.85);

    vec3 lightInk = mix(vec3(0.91, 0.93, 0.96), vec3(1.0, 0.76, 0.24), gateAmberPool);
    vec3 darkInk  = vec3(0.02, 0.024, 0.031);
    gl_FragColor = vec4(mix(darkInk, lightInk, finalBit), 1.0);
    return;
  }

  // STAGE 1: 16-Color EGA Flat-Faceted Quantization
  if (uStageMode == 2 && !isEmissiveAccent) {
    vec3 viewDir = normalize(worldPos - uCameraPos);
    vec2 sphericalUv = vec2(atan(viewDir.x, viewDir.z), asin(clamp(viewDir.y, -1.0, 1.0)));
    float dither = (bayer4x4(floor(sphericalUv * 512.0)) - 0.5) * 0.12;
    float facetShade = isSky ? 1.0 : clamp(dot(flatWorldNormal, normalize(uSunDir)) * 0.55 + 0.45, 0.2, 1.15);
    vec3 quant = floor(clamp(baseCol.rgb * facetShade + dither, 0.0, 1.0) * 4.0 + 0.5) / 4.0;
    gl_FragColor = vec4(quant, 1.0);
    return;
  }

  // STAGES 4-6: Suit-Cam CMOS Visor Optics (Plan 25)
  vec3 color = baseCol.rgb;
  if (uSuitCamMix > 0.01) {
    // 1. Radial 2-tap Chromatic Aberration at visor rim
    vec2 centerOffset = vUv - 0.5;
    float rimDist = dot(centerOffset, centerOffset);
    float caShift = rimDist * 0.0045 * uSuitCamMix;
    color.r = texture2D(tDiffuse, vUv + centerOffset * caShift).r;
    color.b = texture2D(tDiffuse, vUv - centerOffset * caShift).b;

    // 2. Wet-lens micro-droplet refraction near hydro basins / Water Makers
    if (uWetLensMix > 0.01) {
      vec2 dropCell = floor(vUv * vec2(28.0, 16.0));
      float cellHash = fract(sin(dot(dropCell, vec2(12.9898, 78.233))) * 43758.5453);
      if (cellHash > 0.78) {
        vec2 localUv = fract(vUv * vec2(28.0, 16.0)) - 0.5;
        float dropMask = smoothstep(0.28, 0.12, length(localUv));
        color = mix(color, texture2D(tDiffuse, vUv + localUv * 0.015 * dropMask * uWetLensMix).rgb, dropMask);
      }
    }

    // 3. Lagging Auto-Exposure Iris + ACES Filmic Curve + Cosine^4 Visor Vignette
    vec3 exposed = color * mix(1.0, uIrisExposure, uSuitCamMix);
    vec3 mapped = acesFilm(exposed);
    float vignette = 1.0 - rimDist * 0.28 * uSuitCamMix;
    color = mix(color, mapped * vignette, uSuitCamMix);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;
