// ============================================================================
// File: packages/shareware/src/fidelity-mob-leak.ts
// Brief: Brief 30 (S-Space Containment Leak Shader, Era Staging & Rift Columns)
// Decision: DEC-02 (Palette Unification + Era Escalation) & POL-23 Rift Upgrade
// ============================================================================

import * as THREE from 'three';

export type LeakArchetype = 'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper';
export type LeakPhase = 'roam' | 'chase' | 'windup' | 'attack' | 'recover' | 'pain' | 'dead';
export type MonsterEraFormat = 'sprite-2d' | 'quake-md1-md2' | 'rigged-glb';

/**
 * Canonical Metric Vein Color per Archetype (DEC-02)
 */
export function getArchetypeVeinHex(archetype: LeakArchetype): number {
  switch (archetype) {
    case 'charger':
    case 'brute':
      return 0xff3d8a; // Pxd Pink
    case 'spitter':
    case 'flyer':
      return 0xffc13d; // Lx Amber
    case 'sapper':
    case 'swarmer':
      return 0x3dc8ff; // Aq Cyan
  }
}

/**
 * Chronological Era Escalation across Fidelity Stages (DEC-02 & P1-MON-05):
 * - Stage 0–1: 1993 2D directional billboard sprites (Freedoom / Blasphemer)
 * - Stage 2–3: 1996 3D vertex-morphed .md1/.md2 meshes (LibreQuake)
 * - Stage 4–6: Full 3D skeletal-rigged .glb models (Quaternius)
 */
export function getAllowedErasForStage(stageIndex0to6: number): MonsterEraFormat[] {
  if (stageIndex0to6 <= 1) return ['sprite-2d'];
  if (stageIndex0to6 <= 3) return ['quake-md1-md2', 'sprite-2d'];
  return ['rigged-glb', 'quake-md1-md2'];
}

export interface LeakMobShaderUniforms {
  uVeinColor: { value: THREE.Color };
  uWindupPulse: { value: number }; // 0.0 -> 2.0 during windup telegraph (P0-MON-02)
  uGlitchSlice: { value: number }; // Horizontal scanline displacement on pain/windup
  uLocalFidelity: { value: number }; // 0.0 (1-bit) -> 1.0 (full PBR)
  uTime: { value: number };
}

/**
 * Injects the S-Space Containment Leak Shader into any SpriteMaterial or MeshStandardMaterial
 * so gory 2D sprites and pastel 3D meshes share the exact same obsidian/gunmetal substrate
 * (#181c24 to #4a5568) and glowing metric veins.
 */
export function applyContainmentLeakShader(
  material: THREE.Material,
  archetype: LeakArchetype
): LeakMobShaderUniforms {
  const uniforms: LeakMobShaderUniforms = {
    uVeinColor: { value: new THREE.Color(getArchetypeVeinHex(archetype)) },
    uWindupPulse: { value: 0.0 },
    uGlitchSlice: { value: 0.08 },
    uLocalFidelity: { value: 0.5 },
    uTime: { value: 0.0 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader =
      `
      uniform float uGlitchSlice;
      uniform float uTime;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float sliceBand = floor(position.y * 14.0 + uTime * 18.0);
        float sliceNoise = fract(sin(sliceBand * 91.7) * 43758.5453);
        if (sliceNoise > 0.82) {
          transformed.x += (sliceNoise - 0.82) * uGlitchSlice * 1.6;
        }
        `
      );

    shader.fragmentShader =
      `
      uniform vec3 uVeinColor;
      uniform float uWindupPulse;
      uniform float uLocalFidelity;
      ` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        // Remap raw gore/pastel albedo into dark obsidian-gunmetal (#181c24 .. #4a5568)
        float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float sat = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) -
                    min(min(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
        vec3 obsidian = mix(vec3(0.094, 0.110, 0.141), vec3(0.290, 0.333, 0.408), clamp(luma * 1.25, 0.0, 1.0));
        float veinMask = smoothstep(0.35, 0.72, sat) + step(0.78, luma) * 0.5;
        vec3veinGlow = uVeinColor * (0.65 + uWindupPulse * 1.35);
        gl_FragColor.rgb = mix(obsidian, veinGlow, clamp(veinMask, 0.0, 1.0));
        #include <dithering_fragment>
        `
      );
  };

  material.needsUpdate = true;
  return uniforms;
}

/**
 * Updates a monster's shader uniforms per tick based on its @hm/leaksim phase.
 */
export function updateLeakMobUniforms(
  uniforms: LeakMobShaderUniforms,
  phase: LeakPhase,
  localFidelity0to1: number,
  elapsedTimeSec: number
): void {
  uniforms.uTime.value = elapsedTimeSec;
  uniforms.uLocalFidelity.value = localFidelity0to1;

  if (phase === 'windup') {
    uniforms.uWindupPulse.value = 1.6 + 0.4 * Math.sin(elapsedTimeSec * 28.0);
    uniforms.uGlitchSlice.value = 0.25;
  } else if (phase === 'pain') {
    uniforms.uWindupPulse.value = 2.0;
    uniforms.uGlitchSlice.value = 0.45;
  } else {
    uniforms.uWindupPulse.value = 0.15;
    uniforms.uGlitchSlice.value = 0.06;
  }
}

/**
 * Builds the 3.5m Vertical Glitch-Sliced Rift Column (POL-23 replacement)
 * As SealProgress goes from 0.0 -> 1.0 (over 3.0s of Beam Seal mode), horizontal slices align and compress.
 */
export function createGlitchRiftColumnMesh(accentHex = 0xff3d8a): {
  group: THREE.Group;
  update: (timeSec: number, sealProgress0to1: number) => void;
} {
  const group = new THREE.Group();
  const sliceCount = 9;
  const slices: THREE.Mesh[] = [];

  const mat = new THREE.MeshBasicMaterial({
    color: accentHex,
    wireframe: false,
    transparent: true,
    opacity: 0.88,
  });

  for (let i = 0; i < sliceCount; i++) {
    const h = 3.5 / sliceCount;
    const w = 0.55 - Math.abs(i - sliceCount * 0.5) * 0.08;
    const geom = new THREE.BoxGeometry(w, h * 0.86, w);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = (i + 0.5) * h;
    group.add(mesh);
    slices.push(mesh);
  }

  const update = (timeSec: number, sealProgress0to1: number) => {
    const openFactor = 1.0 - Math.min(1.0, Math.max(0.0, sealProgress0to1));
    for (let i = 0; i < slices.length; i++) {
      const m = slices[i];
      const jitter = Math.sin(timeSec * 14.0 + i * 2.1) * 0.28 * openFactor;
      m.position.x = jitter;
      m.rotation.y = timeSec * (i % 2 === 0 ? 1.8 : -1.8) * openFactor;
      m.scale.setScalar(Math.max(0.15, openFactor));
    }
  };

  return { group, update };
}
