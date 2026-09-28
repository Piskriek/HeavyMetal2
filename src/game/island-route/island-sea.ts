/**
 * ISLAND-ROUTE: the sea around the island.
 *
 * - **Round**: the sea and the sea floor are discs that stay centred under the camera, so no square
 *   corner ever shows, wherever the camera goes.
 * - **Waves run round the island**: the water texture is laid in rings that follow the beach's own
 *   wobbly outline (not straight across), and the rings slowly close in on the island.
 * - **Foam**: a lace of foam at the waterline and bands of it rolling in towards the shore, broken up by
 *   the water texture so they never read as clean stripes.
 * - **Horizon haze**: the sea fades into the fog's colour the nearer it lies to the horizon line (by view
 *   angle, not distance, so it reads at every height), and the sky fades to the same colour just above it
 *   (renderer-3d's sky shader): sea and sky meet in a soft haze, no line.
 */
import * as THREE from 'three';

/** The beach outline's wobble (as island-world's beachHeight): radius multiplier at an angle. */
export function shoreWobble(angle: number): number {
  return 1 + 0.05 * Math.sin(3 * angle + 0.7) + 0.035 * Math.sin(7 * angle + 2.2) + 0.02 * Math.sin(13 * angle + 1.1);
}

/** GLSL twin of shoreWobble, and the ring coordinates every sea shader uses. */
const SHORE_GLSL = /* glsl */ `
float seaWobble(float a) { return 1.0 + 0.05 * sin(3.0 * a + 0.7) + 0.035 * sin(7.0 * a + 2.2) + 0.02 * sin(13.0 * a + 1.1); }
`;

export interface IslandSea {
  readonly group: THREE.Group;
  /** Each frame: the time (seconds), the camera (the discs and the band follow it), the fog colour. */
  update(time: number, camera: THREE.Camera, fogColor: THREE.Color): void;
}

export interface IslandSeaOptions {
  /** Where the beach meets the water, before the wobble (world units from the island's centre). */
  shoreRadius: number;
  /** The sea floor's depth. */
  floorY: number;
  /** The water texture (tiling). */
  water: THREE.MeshStandardMaterial;
}

/** Sea and floor reach this far from the camera. */
export const SEA_RADIUS = 165000;

export function buildIslandSea(opts: IslandSeaOptions): IslandSea {
  const group = new THREE.Group();
  group.name = 'Island sea';
  const time = { value: 0 };
  const shore = { value: opts.shoreRadius };
  // Texture repeats round the island at the shore (a whole number, so the rings close without a seam).
  const around = { value: Math.round((2 * Math.PI * opts.shoreRadius) / 3000) };

  /* The water: rings that follow the shore and close in slowly. */
  const water = opts.water.clone();
  if (water.map) { water.map = water.map.clone(); water.map.wrapS = water.map.wrapT = THREE.RepeatWrapping; water.map.needsUpdate = true; }
  water.color = new THREE.Color('#6fc2c0');
  water.opacity = 0.8;
  water.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { seaTime: time, seaAround: around });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSeaWorld;\nuniform float seaTime;\nuniform float seaAround;\n${SHORE_GLSL}`)
      .replace('#include <fog_fragment>', /* glsl */ `#include <fog_fragment>
#ifdef USE_FOG
{
  // Horizon haze: within ~4° below the horizon the water fades into the fog's colour (and goes opaque).
  vec3 viewDir = normalize(vSeaWorld - cameraPosition);
  float haze = 1.0 - smoothstep(0.0, 0.07, -viewDir.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, haze);
  gl_FragColor.a = mix(gl_FragColor.a, 1.0, haze);
}
#endif
`)
      .replace('#include <map_fragment>', /* glsl */ `
#ifdef USE_MAP
{
  float ang = atan(vSeaWorld.x, -vSeaWorld.z);
  float rn = length(vSeaWorld.xz) / seaWobble(ang);
  // Round the island (u) and in towards it (v): +time moves every ring inward.
  float u1 = ang / 6.2831853 * seaAround;
  float u2 = mod(ang + 6.2831853, 6.2831853) / 6.2831853 * seaAround;
  vec2 dx = vec2(abs(dFdx(u1)) < abs(dFdx(u2)) ? dFdx(u1) : dFdx(u2), 0.0);
  vec2 dy = vec2(abs(dFdy(u1)) < abs(dFdy(u2)) ? dFdy(u1) : dFdy(u2), 0.0);
  float v = (rn + seaTime * 160.0) / 3000.0;
  dx.y = dFdx(v); dy.y = dFdy(v);
  vec4 a = textureGrad(map, vec2(u1, v), dx, dy);
  vec4 b = textureGrad(map, vec2(u1 * 1.7 + 0.37, v * 0.61 + 0.11), dx * vec2(1.7, 0.61), dy * vec2(1.7, 0.61));
  diffuseColor *= mix(a, b, 0.35);
}
#endif
`);
  };
  water.customProgramCacheKey = () => 'island-sea-rings-haze';
  const sea = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS, 160), water);
  sea.rotation.x = -Math.PI / 2;
  sea.name = 'Sea';
  sea.renderOrder = 1;
  group.add(sea);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS, 96), new THREE.MeshStandardMaterial({ color: '#557f78', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opts.floorY;
  floor.name = 'Sea floor';
  group.add(floor);

  /* The foam: a lace at the waterline and bands rolling in, broken up by the water texture. */
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f4fbfb', transparent: true, depthWrite: false });
  foamMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { seaTime: time, seaAround: around, shoreR: shore, foamNoise: { value: water.map } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFoamWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vFoamWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFoamWorld;\nuniform float seaTime;\nuniform float seaAround;\nuniform float shoreR;\nuniform sampler2D foamNoise;\n${SHORE_GLSL}`)
      .replace('#include <alphamap_fragment>', /* glsl */ `#include <alphamap_fragment>
{
  float ang = atan(vFoamWorld.x, -vFoamWorld.z);
  float rn = length(vFoamWorld.xz) / seaWobble(ang);
  float d = rn - shoreR;                                    // + out to sea, - up the sand
  float u = mod(ang + 6.2831853, 6.2831853) / 6.2831853 * seaAround * 2.0;
  float n = texture2D(foamNoise, vec2(u, (rn + seaTime * 110.0) / 1400.0)).r;
  float n2 = texture2D(foamNoise, vec2(u * 0.43 + 0.3, (rn + seaTime * 70.0) / 2600.0)).g;
  // The lace where water meets sand.
  float lace = smoothstep(-450.0, -50.0, d) * (1.0 - smoothstep(150.0, 900.0, d)) * (0.55 + 0.45 * n);
  // Bands rolling in to the shore (the same pace as the rings in the water), fading out to sea.
  float wave = pow(0.5 + 0.5 * sin((rn + seaTime * 160.0) / 1500.0 * 6.2831853 + n2 * 2.5), 5.0);
  float bands = wave * (1.0 - smoothstep(0.0, 5200.0, d)) * smoothstep(-100.0, 300.0, d) * smoothstep(0.3, 0.7, n * 0.7 + wave * 0.5);
  diffuseColor.a *= clamp(max(lace, bands) * 0.9, 0.0, 1.0);
}`);
  };
  foamMat.customProgramCacheKey = () => 'island-sea-foam';
  const foam = new THREE.Mesh(new THREE.RingGeometry(opts.shoreRadius * 0.82, opts.shoreRadius * 1.28, 512, 12), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 4;
  foam.name = 'Shore foam';
  foam.renderOrder = 2;
  group.add(foam);

  return {
    group,
    update(t, camera) {
      time.value = t;
      sea.position.x = floor.position.x = camera.position.x;
      sea.position.z = floor.position.z = camera.position.z;
    },
  };
}

/** Where the beach's surface crosses sea level (y = 0), before the wobble: found once by bisection. */
export function shoreRadiusOf(beachHeightAtRadius: (r: number) => number, lo: number, hi: number): number {
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (beachHeightAtRadius(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
