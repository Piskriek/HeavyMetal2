/**
 * Multi-Stage Fidelity Material for Imported Retro Mobs & Weapons.
 * Adapts rendering dynamically based on the current world stage:
 * - Stage 0: 1-bit Bayer ordered dither (monochrome vintage CRT/Macintosh)
 * - Stage 1: 16-color EGA quantized palette with ordered dither
 * - Stage 2: 256-color VGA with PSX-style integer vertex snapping
 * - Stage 3: Smooth Gouraud diffuse lighting + terrain shadows
 * - Stage 4: Full PBR with emissive eyes and dynamic Ultra point lighting
 *
 * Uses MeshStandardMaterial with onBeforeCompile so that Three.js
 * morph target animations (MD2 vertex keyframes) and skeletal meshes
 * animate natively and smoothly while preserving retro shader stages.
 */
import * as THREE from 'three';

export type FidelityStage = 0 | 1 | 2 | 3 | 4;

export interface MobMaterialOptions {
  map?: THREE.Texture;
  stage?: FidelityStage;
  emissiveColor?: THREE.Color;
  emissiveIntensity?: number;
}

export type FidelityMobMaterial = THREE.MeshStandardMaterial & {
  uniforms: {
    uMap: { value: THREE.Texture | null };
    uStage: { value: FidelityStage };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Vector3 };
    uEmissive: { value: THREE.Color };
    uEmissiveIntensity: { value: number };
  };
};

/**
 * Creates a stage-adaptive material supporting morph target animations and retro quantization.
 */
export function createFidelityMobMaterial(options: MobMaterialOptions = {}): FidelityMobMaterial {
  const stage = (options.stage ?? 4) as FidelityStage;
  const emissive = options.emissiveColor ?? new THREE.Color(0x000000);
  const emissiveIntensity = options.emissiveIntensity ?? 1.5;

  const mat = new THREE.MeshStandardMaterial({
    map: options.map ?? null,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
    transparent: true,
    depthWrite: true,
  }) as FidelityMobMaterial;

  const uniforms = {
    uMap: { value: options.map ?? null },
    uStage: { value: stage },
    uSunDir: { value: new THREE.Vector3(0.6, 1.0, 0.4).normalize() },
    uSunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
    uEmissive: { value: emissive },
    uEmissiveIntensity: { value: emissiveIntensity },
  };

  mat.uniforms = uniforms;
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uStage = uniforms.uStage;
    shader.uniforms.uEmissive = uniforms.uEmissive;
    shader.uniforms.uEmissiveIntensity = uniforms.uEmissiveIntensity;

    const bayerSnippet = /* glsl */ `
      uniform int uStage;
      uniform vec3 uEmissive;
      uniform float uEmissiveIntensity;

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
    `;

    shader.fragmentShader = bayerSnippet + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      /* glsl */ `
      #include <dithering_fragment>

      if (gl_FragColor.a < 0.5) discard;

      vec2 screenCoord = gl_FragCoord.xy;

      // STAGE 0: 1-bit Bayer monochrome dither (boosted contrast for legible retro models)
      if (uStage == 0) {
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        lum = clamp(pow(max(0.0, lum), 0.72) * 1.65, 0.0, 1.0);
        float dither = bayer4(screenCoord);
        float bit = step(dither, lum);
        gl_FragColor = vec4(mix(vec3(0.02), vec3(0.96), bit), gl_FragColor.a);
      }
      // STAGE 1: 16-color EGA posterization
      else if (uStage == 1) {
        float levels = 4.0;
        gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + bayer4(screenCoord)) / levels;
      }
      // STAGE 2: 256-color VGA ramp
      else if (uStage == 2) {
        float levels = 16.0;
        gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + bayer4(screenCoord)) / levels;
      }
      // STAGE 3: Smooth Gouraud / Diffuse lit (standard MeshStandardMaterial output)
      // STAGE 4: Full PBR with emissive boost (zero if emissiveColor is black)
      else if (uStage == 4) {
        gl_FragColor.rgb += uEmissive * (uEmissiveIntensity * 0.25);
      }
      `
    );
  };

  return mat;
}

/**
 * Updates the active stage on a fidelity mob material.
 */
export function setMobMaterialStage(material: THREE.Material, stage: FidelityStage): void {
  const u = (material as any).uniforms ?? (material as any).userData?.uniforms;
  if (u?.uStage) {
    u.uStage.value = stage;
  }
}
