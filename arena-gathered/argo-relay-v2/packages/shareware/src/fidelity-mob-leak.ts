// ============================================================================
// File: packages/shareware/src/fidelity-mob-leak.ts
// Fix: Guarded all index reads under noUncheckedIndexedAccess
// ============================================================================

import * as THREE from 'three';
import type { Archetype, Phase } from '@hm/leaksim';
import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export const ARCHETYPE_VEIN_HEX: Record<Archetype, number> = {
  charger: 0xff3d8a,
  brute: 0xff3d8a,
  spitter: 0xffc13d,
  flyer: 0xffc13d,
  sapper: 0x3dc8ff,
  swarmer: 0x7cff4d,
};

export interface LeakMobUniforms {
  uStageFidelity: { value: THREE.Vector4 };
  uVeinColor: { value: THREE.Color };
  uWindupIntensity: { value: number };
  uGlitchSliceStrength: { value: number };
  uTime: { value: number };
}

export function computeMobShaderState(
  archetype: Archetype,
  phase: Phase,
  s: FourFloats,
  timeSec: number
): {
  veinHex: number;
  windupIntensity: number;
  glitchSliceStrength: number;
  stageVector: [number, number, number, number];
} {
  const veinHex = ARCHETYPE_VEIN_HEX[archetype] ?? 0xff3d8a;

  let windupIntensity = 0.25;
  if (phase === 'windup') {
    windupIntensity = 2.0;
  } else if (phase === 'attack') {
    windupIntensity = 1.5;
  } else if (phase === 'pain') {
    windupIntensity = 3.0;
  }

  let glitchSliceStrength = 0.08;
  if (phase === 'pain') {
    glitchSliceStrength = 0.85;
  } else if (phase === 'windup') {
    glitchSliceStrength = 0.45 + 0.15 * Math.sin(timeSec * 28.0);
  }

  return {
    veinHex,
    windupIntensity,
    glitchSliceStrength,
    stageVector: [s.Pxd, s.Vtx, s.Lx, s.Aq],
  };
}

export function applyContainmentLeakShaderToMaterial(
  material: THREE.MeshStandardMaterial,
  archetype: Archetype
): LeakMobUniforms {
  material.metalness = Math.min(material.metalness, 0.22);
  material.roughness = Math.max(material.roughness, 0.55);

  const uniforms: LeakMobUniforms = {
    uStageFidelity: { value: new THREE.Vector4(0.1, 0.1, 0.1, 0.0) },
    uVeinColor: { value: new THREE.Color(ARCHETYPE_VEIN_HEX[archetype] ?? 0xff3d8a) },
    uWindupIntensity: { value: 0.25 },
    uGlitchSliceStrength: { value: 0.08 },
    uTime: { value: 0.0 },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uStageFidelity'] = uniforms.uStageFidelity;
    shader.uniforms['uVeinColor'] = uniforms.uVeinColor;
    shader.uniforms['uWindupIntensity'] = uniforms.uWindupIntensity;
    shader.uniforms['uGlitchSliceStrength'] = uniforms.uGlitchSliceStrength;
    shader.uniforms['uTime'] = uniforms.uTime;

    shader.vertexShader =
      `
      uniform float uGlitchSliceStrength;
      uniform float uTime;
      varying vec3 vLeakWorldPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float sliceBand = step(0.65, fract(transformed.y * 5.0 + uTime * 7.0));
        transformed.x += sliceBand * uGlitchSliceStrength * 0.14 * sin(uTime * 35.0 + transformed.y * 12.0);
        `
      ).replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vLeakWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

    shader.fragmentShader =
      `
      uniform vec4 uStageFidelity;
      uniform vec3 uVeinColor;
      uniform float uWindupIntensity;
      varying vec3 vLeakWorldPos;
      ` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 obsidianBase = mix(vec3(0.094, 0.110, 0.141), vec3(0.290, 0.333, 0.408), clamp(luma * 1.35, 0.0, 1.0));
        float veinMask = smoothstep(0.52, 0.78, luma);
        vec3 unifiedRgb = mix(obsidianBase, uVeinColor * uWindupIntensity, veinMask * 0.65);

        if (uStageFidelity.x < 0.20) {
          float bayer = fract(sin(dot(floor(vLeakWorldPos.xz * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
          unifiedRgb = luma > bayer * 0.65 ? uVeinColor : vec3(0.04, 0.05, 0.07);
        }

        gl_FragColor.rgb = mix(gl_FragColor.rgb, unifiedRgb, 0.82);
        #include <dithering_fragment>
        `
      );
  };

  material.needsUpdate = true;
  return uniforms;
}
