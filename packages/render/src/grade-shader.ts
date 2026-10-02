import * as THREE from 'three';

/**
 * Display-space colour grade, run after tone mapping: lift / gamma / gain, contrast, saturation, optional posterise, vignette and film grain.
 * Neutral values (lift 0, gamma 1, gain 1, contrast 1, saturation 1, no posterise, no vignette, no grain) leave the picture unchanged.
 * Adapted from the Light Lab prototype (an Arena model's work), reduced to what the lighting presets need.
 */
export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    lift: { value: new THREE.Vector3(0, 0, 0) },
    gamma: { value: new THREE.Vector3(1, 1, 1) },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    saturation: { value: 1 },
    contrast: { value: 1 },
    posterize: { value: 0 },
    vignetteDarkness: { value: 0 },
    vignetteOffset: { value: 0.5 },
    grain: { value: 0 },
    time: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 lift; uniform vec3 gamma; uniform vec3 gain;
    uniform float saturation; uniform float contrast; uniform float posterize;
    uniform float vignetteDarkness; uniform float vignetteOffset;
    uniform float grain; uniform float time; uniform float aspect;
    varying vec2 vUv;
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = clamp(tex.rgb, 0.0, 1.0);
      c = c + lift * (1.0 - c);
      c = pow(max(c, vec3(0.0)), 1.0 / max(gamma, vec3(0.05)));
      c *= gain;
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      if (posterize > 1.5) {
        c = floor(clamp(c, 0.0, 1.0) * posterize + 0.5) / posterize;
      }
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
      float d = length(q) / max(0.5 * sqrt(aspect * aspect + 1.0), 0.001);
      c *= 1.0 - vignetteDarkness * smoothstep(vignetteOffset, vignetteOffset + 0.75, d);
      if (grain > 0.0) {
        float n = rnd(gl_FragCoord.xy + fract(time * 7.13) * 91.7) - 0.5;
        float mid = 1.0 - abs(l - 0.5) * 1.2;
        c += n * grain * 2.0 * max(mid, 0.25);
      }
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }
  `,
};
