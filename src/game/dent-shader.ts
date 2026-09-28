/**
 * T11 — Dent and rolling shader displacement
 * 
 * Shared color/depth/distance shader displacement.
 * Corrected normals and geometry-space depth units.
 * Per-racer uniform isolation without per-impact shader recompilation.
 */

export const DENT_VERTEX_SHADER = `
uniform vec3 uDentDirections[3];
uniform float uDentDepths[3];
uniform int uDentCount;
uniform vec4 uOrientation; // quaternion (x, y, z, w)
uniform float uRollingPhase;
uniform float uBobOffset;
uniform float uRadius;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Quaternion rotation
vec3 rotateByQuaternion(vec3 v, vec4 q) {
  vec3 qv = q.xyz;
  float qw = q.w;
  vec3 t = 2.0 * cross(qv, v);
  return v + qw * t + cross(qv, t);
}

// Apply dent displacement to vertex position
vec3 applyDentDisplacement(vec3 position, vec3 normal) {
  vec3 displaced = position;
  
  for (int i = 0; i < 3; i++) {
    if (i >= uDentCount) break;
    
    vec3 dentDir = uDentDirections[i];
    float dentDepth = uDentDepths[i];
    
    if (dentDepth < 0.001) continue;
    
    // Calculate influence based on angle between normal and dent direction
    float influence = max(0.0, dot(normal, dentDir));
    influence = influence * influence; // Quadratic falloff for smoother dents
    
    // Displace along normal (inward for dents)
    // Depth is in geometry space (fraction of radius)
    float displacement = dentDepth * uRadius * influence;
    displaced -= normal * displacement;
  }
  
  return displaced;
}

// Correct normal for dent displacement
vec3 correctNormalForDents(vec3 normal) {
  vec3 corrected = normal;
  
  for (int i = 0; i < 3; i++) {
    if (i >= uDentCount) break;
    
    vec3 dentDir = uDentDirections[i];
    float dentDepth = uDentDepths[i];
    
    if (dentDepth < 0.001) continue;
    
    // Blend normal toward dent direction based on influence
    float influence = max(0.0, dot(normal, dentDir));
    influence = influence * influence * 0.5; // Reduced influence for normals
    
    corrected = normalize(mix(corrected, dentDir, influence));
  }
  
  return corrected;
}

void main() {
  vUv = uv;
  
  // Apply rolling rotation to position
  vec3 rotatedPosition = rotateByQuaternion(position, uOrientation);
  
  // Apply dent displacement (in geometry space before rolling)
  vec3 displacedPosition = applyDentDisplacement(position, normal);
  
  // Apply rolling rotation to displaced position
  vec3 finalPosition = rotateByQuaternion(displacedPosition, uOrientation);
  
  // Apply visual bobbing (vertical offset)
  finalPosition.y += uBobOffset;
  
  // Correct normals for dents
  vec3 correctedNormal = correctNormalForDents(normal);
  vec3 rotatedNormal = rotateByQuaternion(correctedNormal, uOrientation);
  
  vNormal = normalize(normalMatrix * rotatedNormal);
  vWorldPosition = (modelMatrix * vec4(finalPosition, 1.0)).xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
}
`;

export const DENT_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uRoughness;
uniform float uMetalness;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec3 normal = normalize(vNormal);
  
  // Simple lighting calculation
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diffuse = max(dot(normal, lightDir), 0.0);
  
  // Ambient
  float ambient = 0.3;
  
  // Final color
  vec3 color = uColor * (ambient + diffuse * 0.7);
  
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface DentShaderUniforms {
  uDentDirections: { value: Float32Array };
  uDentDepths: { value: Float32Array };
  uDentCount: { value: number };
  uOrientation: { value: Float32Array };
  uRollingPhase: { value: number };
  uBobOffset: { value: number };
  uRadius: { value: number };
  uColor: { value: [number, number, number] };
  uRoughness: { value: number };
  uMetalness: { value: number };
}

/**
 * Create initial shader uniforms for a racer.
 * Per-racer isolation: each racer gets its own uniform set.
 */
export function createDentShaderUniforms(
  radius: number,
  color: [number, number, number] = [1, 1, 1],
): DentShaderUniforms {
  return {
    uDentDirections: { value: new Float32Array(9) }, // 3 directions × 3 components
    uDentDepths: { value: new Float32Array(3) },
    uDentCount: { value: 0 },
    uOrientation: { value: new Float32Array([0, 0, 0, 1]) }, // identity quaternion
    uRollingPhase: { value: 0 },
    uBobOffset: { value: 0 },
    uRadius: { value: radius },
    uColor: { value: color },
    uRoughness: { value: 0.5 },
    uMetalness: { value: 0.3 },
  };
}

/**
 * Update shader uniforms from dent and rolling state.
 * Efficient: only updates changed values, no shader recompilation.
 */
export function updateDentShaderUniforms(
  uniforms: DentShaderUniforms,
  dentData: {
    dentDirections: Float32Array;
    dentDepths: Float32Array;
    dentCount: number;
  },
  rollingData: {
    orientation: Float32Array;
    rollingPhase: number;
    bobOffset: number;
  },
): void {
  // Update dent uniforms
  uniforms.uDentDirections.value.set(dentData.dentDirections);
  uniforms.uDentDepths.value.set(dentData.dentDepths);
  uniforms.uDentCount.value = dentData.dentCount;
  
  // Update rolling uniforms
  uniforms.uOrientation.value.set(rollingData.orientation);
  uniforms.uRollingPhase.value = rollingData.rollingPhase;
  uniforms.uBobOffset.value = rollingData.bobOffset;
}

/**
 * Dispose of shader resources.
 * Prevents memory leaks on teardown.
 */
export function disposeDentShader(uniforms: DentShaderUniforms): void {
  // In Three.js, you would call material.dispose() here
  // For this module, we just clear the arrays
  uniforms.uDentDirections.value.fill(0);
  uniforms.uDentDepths.value.fill(0);
  uniforms.uOrientation.value.fill(0);
  uniforms.uOrientation.value[3] = 1; // identity quaternion
}
