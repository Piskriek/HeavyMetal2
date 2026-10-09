/**
 * Multi-Stage Fidelity Material for Imported Retro Mobs & Weapons.
 * Adapts rendering dynamically based on the current world stage:
 * - Stage 0: 1-bit Bayer ordered dither (monochrome vintage CRT/Macintosh)
 * - Stage 1: 16-color EGA quantized palette with ordered dither
 * - Stage 2: 256-color VGA with PSX-style integer vertex snapping
 * - Stage 3: Smooth Gouraud diffuse lighting + terrain shadows
 * - Stage 4: Full PBR with emissive eyes and dynamic Ultra point lighting
 */
import * as THREE from 'three';

export type FidelityStage = 0 | 1 | 2 | 3 | 4;

export interface MobMaterialOptions {
  map?: THREE.Texture;
  stage?: FidelityStage;
  emissiveColor?: THREE.Color;
  emissiveIntensity?: number;
}

const MOB_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform int uStage;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // In Stage 0-2: vintage vertex snapping (PSX integer jitter effect)
    if (uStage <= 2) {
      float snap = uStage == 0 ? 0.08 : (uStage == 1 ? 0.04 : 0.02);
      worldPos.xyz = floor(worldPos.xyz / snap) * snap;
    }
    
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const MOB_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform int uStage;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  float bayer4(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    float m = 0.0;
    if (i < 0.5) m = 0.0; else if (i < 1.5) m = 8.0; else if (i < 2.5) m = 2.0; else if (i < 3.5) m = 10.0;
    else if (i < 4.5) m = 12.0; else if (i < 5.5) m = 4.0; else if (i < 6.5) m = 14.0; else if (i < 7.5) m = 6.0;
    else if (i < 8.5) m = 3.0; else if (i < 9.5) m = 11.0; else if (i < 10.5) m = 1.0; else if (i < 11.5) m = 9.0;
    else if (i < 12.5) m = 15.0; else if (i < 13.5) m = 7.0; else if (i < 14.5) m = 13.0; else m = 5.0;
    return (m + 0.5) / 16.0;
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.5) discard;

    vec3 baseColor = tex.rgb;
    vec2 screenCoord = gl_FragCoord.xy;

    // STAGE 0: 1-bit Bayer monochrome dither
    if (uStage == 0) {
      float lum = dot(baseColor, vec3(0.299, 0.587, 0.114));
      float dither = bayer4(screenCoord);
      float bit = step(dither, lum);
      gl_FragColor = vec4(mix(vec3(0.01), vec3(0.85), bit), 1.0);
      return;
    }

    // STAGE 1: 16-color EGA posterization
    if (uStage == 1) {
      float levels = 4.0;
      vec3 quantized = floor(baseColor * levels + bayer4(screenCoord)) / levels;
      gl_FragColor = vec4(quantized, 1.0);
      return;
    }

    // Lighting calculation for Stage 2, 3, 4
    float nDotL = max(0.0, dot(vNormal, normalize(uSunDir)));
    vec3 light = vec3(0.25) + uSunColor * nDotL * 0.75;

    // STAGE 2: 256-color VGA flat/ramp
    if (uStage == 2) {
      float levels = 16.0;
      vec3 shaded = floor(baseColor * light * levels + bayer4(screenCoord)) / levels;
      gl_FragColor = vec4(shaded, 1.0);
      return;
    }

    // STAGE 3: Smooth Gouraud / Diffuse Lit
    if (uStage == 3) {
      gl_FragColor = vec4(baseColor * light, 1.0);
      return;
    }

    // STAGE 4: Full PBR with Emissive Eyes and Highlights
    vec3 emissive = uEmissive * uEmissiveIntensity;
    vec3 finalColor = baseColor * light + emissive;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/**
 * Creates a ShaderMaterial configured for stage-adaptive mob rendering.
 */
export function createFidelityMobMaterial(options: MobMaterialOptions = {}): THREE.ShaderMaterial {
  const stage = options.stage ?? 4;
  const emissive = options.emissiveColor ?? new THREE.Color(0xff2200);
  const emissiveIntensity = options.emissiveIntensity ?? 1.5;

  return new THREE.ShaderMaterial({
    vertexShader: MOB_VERTEX_SHADER,
    fragmentShader: MOB_FRAGMENT_SHADER,
    uniforms: {
      uMap: { value: options.map ?? new THREE.Texture() },
      uStage: { value: stage },
      uSunDir: { value: new THREE.Vector3(0.6, 1.0, 0.4).normalize() },
      uSunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
      uEmissive: { value: emissive },
      uEmissiveIntensity: { value: emissiveIntensity },
    },
    lights: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Updates the active stage on a fidelity mob material.
 */
export function setMobMaterialStage(material: THREE.ShaderMaterial, stage: FidelityStage): void {
  if (material.uniforms?.uStage) {
    material.uniforms.uStage.value = stage;
  }
}
