/**
 * The rim term and the hemisphere floor (TASK-21d, P0-LIGHT-01) for the player and the held rifle, in stages 0 to 2. A view-aligned rim
 * lifts the edge of a figure so it reads against dark ground, and a floor of sky and ground light keeps the figure from merging into
 * a crater's shadow. Both are added to the material's own shader (its albedo is kept), and both switch off from stage 3, where the
 * lit ground does the work. The metal cap from TASK-21c stays.
 */
import * as THREE from 'three';

/** Argo's numbers: the rim is (1 - N.V)^2.5 times 0.55, in the sky colour; the floor is 0.65 of a sky and ground hemisphere. */
export const RIM_STRENGTH = 0.55;
export const RIM_POWER = 2.5;
export const FLOOR_STRENGTH = 0.65;
export const FLOOR_SKY = '#8fa8c8';
export const FLOOR_GROUND = '#3d352e';

/** One set of uniforms for every material this touches: the scene switches them on and off with the stage. */
const uniforms = {
  uRimOn: { value: 0 },
  uRimStrength: { value: RIM_STRENGTH },
  uRimPower: { value: RIM_POWER },
  uFloorStrength: { value: FLOOR_STRENGTH },
  uFloorSky: { value: new THREE.Color(FLOOR_SKY) },
  uFloorGround: { value: new THREE.Color(FLOOR_GROUND) },
};

/** On for stages 0 to 2, off above (the scene calls this as the stage changes). */
export function setRimFloorOn(on: boolean): void {
  uniforms.uRimOn.value = on ? 1 : 0;
}

/** Whether the rim and floor are on right now. */
export function rimFloorOn(): boolean {
  return uniforms.uRimOn.value > 0.5;
}

const RIM_FLOOR_UNIFORMS = `
uniform float uRimOn;
uniform float uRimStrength;
uniform float uRimPower;
uniform float uFloorStrength;
uniform vec3 uFloorSky;
uniform vec3 uFloorGround;
`;

/** Added before the final colour is written: the rim (view-aligned) and the floor (world-up hemisphere, on the albedo). */
const RIM_FLOOR_CHUNK = `
{
  float rimFacing = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
  float rim = pow(1.0 - rimFacing, uRimPower) * uRimStrength * uRimOn;
  vec3 worldNormal = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 hemi = mix(uFloorGround, uFloorSky, 0.5 + 0.5 * worldNormal.y);
  outgoingLight += uFloorSky * rim + diffuseColor.rgb * hemi * (uFloorStrength * uRimOn);
}
`;

/**
 * Gives a MeshStandardMaterial the rim and the floor. The material keeps its own albedo, maps and metalness; only the lit colour
 * gains the two terms. Safe to call once per material.
 */
export function applyRimFloor(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimOn = uniforms.uRimOn;
    shader.uniforms.uRimStrength = uniforms.uRimStrength;
    shader.uniforms.uRimPower = uniforms.uRimPower;
    shader.uniforms.uFloorStrength = uniforms.uFloorStrength;
    shader.uniforms.uFloorSky = uniforms.uFloorSky;
    shader.uniforms.uFloorGround = uniforms.uFloorGround;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RIM_FLOOR_UNIFORMS}`)
      .replace('#include <opaque_fragment>', `${RIM_FLOOR_CHUNK}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'hm-rim-floor';
  material.needsUpdate = true;
}
