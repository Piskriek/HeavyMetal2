/**
 * IF-POSTFX: Final composite pass combining tone mapping, vignette, grain, and bloom.
 * Ensures tone mapping is performed exactly once in the pipeline.
 */

import * as THREE from 'three';

export interface CompositeUniforms {
  tDiffuse: { value: THREE.Texture | null };
  tBloom: { value: THREE.Texture | null };
  bloomStrength: { value: number };
  vignetteStrength: { value: number };
  grainStrength: { value: number };
  frameIndex: { value: number };
}

export const CompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tBloom: { value: null },
    bloomStrength: { value: 0.35 },
    vignetteStrength: { value: 0.25 },
    grainStrength: { value: 0.02 },
    frameIndex: { value: 0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float bloomStrength;
    uniform float vignetteStrength;
    uniform float grainStrength;
    uniform float frameIndex;
    varying vec2 vUv;

    // ACES Filmic Tone Mapping approximation
    vec3 acesFilmic(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    // Deterministic pseudo-random grain
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233) + frameIndex)) * 43758.5453);
    }

    void main() {
      vec4 scene = texture2D(tDiffuse, vUv);
      vec4 bloom = texture2D(tBloom, vUv);

      // Additive bloom blend
      vec3 color = scene.rgb + bloom.rgb * bloomStrength;

      // Vignette
      vec2 coord = (vUv - 0.5) * 2.0;
      float vig = 1.0 - dot(coord, coord) * vignetteStrength;
      color *= clamp(vig, 0.0, 1.0);

      // Single ACES Tone Mapping step
      color = acesFilmic(color);

      // Subtle noise grain
      float noise = (hash(vUv * 500.0) - 0.5) * grainStrength;
      color += noise;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), scene.a);
    }
  `,
};
