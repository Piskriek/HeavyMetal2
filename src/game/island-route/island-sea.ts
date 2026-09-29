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
 *   (renderer-3d's sky shader). How wide is the Sky window's `horizon.haze` (0: a crisp line); its glow
 *   band fades down onto the water here as it fades up into the sky there.
 */
import * as THREE from 'three';

/**
 * The far sea's colour: what the water averages out to far away (its tint over the pattern, a little of
 * the deep through it). The sea's far edge melts into it and the sky paints it under the horizon, so the
 * sea runs on to the horizon line with no band of haze unless the Sky window asks for one.
 */
export function seaFarColor(look: Pick<SeaLookInput, 'water' | 'deep' | 'seeThrough'>): THREE.Color {
  return new THREE.Color(look.water).multiplyScalar(0.86).lerp(new THREE.Color(look.deep), 0.2 + look.seeThrough * 0.5);
}

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
  /** The ocean's look (the Sky window): colours, how much of the deep shows through, the pattern. */
  setLook(look: SeaLookInput): void;
  /** The horizon (the Sky window): haze width and the glow band. */
  setHorizon(h: SeaHorizonInput): void;
}

export interface SeaHorizonInput {
  haze: number;
  glow: boolean;
  glowColor: string;
  glowStrength: number;
  glowWidth: number;
  glowSoftness: number;
}

export interface SeaLookInput {
  water: string;
  deep: string;
  seeThrough: number;
  texture: 'waves' | 'ripples' | 'shallows' | 'flat';
  tileSize: number;
  waveSpeed: number;
}

export const SEA_SHALLOWS_URL = '/textures/island/shallows.jpg';

/** The rings' repeats round the shore: whole, so they close without a seam. */
export const seaRepeatsAround = (shoreRadius: number, tileSize: number) => Math.max(1, Math.round((2 * Math.PI * shoreRadius) / tileSize));

/**
 * Painted ripples, tileable: pale crescents and soft blotches on a near-white ground, so the water colour
 * alone decides the hue. Browser only.
 */
export function paintRippleCanvas(size = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  let s = 20260928;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  g.fillStyle = '#dfeaea';
  g.fillRect(0, 0, size, size);
  // Every mark is drawn at its eight wrapped copies too, so the tile's edges meet.
  const wrapped = (draw: (x: number, y: number) => void, x: number, y: number) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(x + ox, y + oy);
  };
  for (let k = 0; k < 26; k++) {
    const x = rand() * size, y = rand() * size, r = size * (0.08 + rand() * 0.14);
    const tone = rand() < 0.5 ? 'rgba(150, 178, 180, 0.22)' : 'rgba(255, 255, 255, 0.28)';
    wrapped((px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, tone); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    }, x, y);
  }
  g.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    const x = rand() * size, y = rand() * size, r = size * (0.03 + rand() * 0.05), w = size * (0.004 + rand() * 0.006);
    const a0 = Math.PI * (1.15 + rand() * 0.2), a1 = a0 + Math.PI * (0.35 + rand() * 0.25);
    wrapped((px, py) => {
      g.strokeStyle = 'rgba(120, 150, 156, 0.35)'; g.lineWidth = w * 1.4;
      g.beginPath(); g.arc(px, py + w * 1.2, r, a0, a1); g.stroke();
      g.strokeStyle = `rgba(255, 255, 255, ${0.55 + rand() * 0.35})`; g.lineWidth = w;
      g.beginPath(); g.arc(px, py, r, a0, a1); g.stroke();
    }, x, y);
  }
  return c;
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
  const tile = { value: 3000 };
  const speed = { value: 1 };
  const around = { value: seaRepeatsAround(opts.shoreRadius, tile.value) };
  // The horizon: haze width below the line (0.07 was the old fixed one) and the glow band.
  const hazeW = { value: 0.07 };
  const glowCol = { value: new THREE.Color('#ffffff') };
  const glowAmt = { value: 0 };
  const glowW = { value: 0.016 };
  const glowSoft = { value: 0.85 };
  const farCol = { value: seaFarColor({ water: '#6fc2c0', deep: '#557f78', seeThrough: 0.2 }) };

  /* The water: rings that follow the shore and close in slowly. */
  const water = opts.water.clone();
  if (water.map) { water.map = water.map.clone(); water.map.wrapS = water.map.wrapT = THREE.RepeatWrapping; water.map.needsUpdate = true; }
  // The foam breaks up on the painted waves whatever pattern the water wears.
  const foamNoise = water.map;
  const foamAround = { value: around.value };
  const patterns: Partial<Record<SeaLookInput['texture'], THREE.Texture | null>> = { waves: water.map, flat: null };
  const pattern = (id: SeaLookInput['texture']): THREE.Texture | null => {
    if (id in patterns) return patterns[id] ?? null;
    if (typeof document === 'undefined') return water.map;
    let t: THREE.Texture;
    if (id === 'ripples') t = new THREE.CanvasTexture(paintRippleCanvas());
    else t = new THREE.TextureLoader().load(SEA_SHALLOWS_URL);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    patterns[id] = t;
    return t;
  };
  water.color = new THREE.Color('#6fc2c0');
  water.opacity = 0.8;
  water.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { seaTime: time, seaAround: around, seaRadius: { value: SEA_RADIUS }, seaTile: tile, seaSpeed: speed, seaHazeW: hazeW, seaGlowCol: glowCol, seaGlowAmt: glowAmt, seaGlowW: glowW, seaGlowSoft: glowSoft, seaFarCol: farCol });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSeaWorld;\nuniform float seaTime;\nuniform float seaAround;\nuniform float seaRadius;\nuniform float seaTile;\nuniform float seaSpeed;\nuniform float seaHazeW;\nuniform vec3 seaGlowCol;\nuniform float seaGlowAmt;\nuniform float seaGlowW;\nuniform float seaGlowSoft;\nuniform vec3 seaFarCol;\n${SHORE_GLSL}`)
      .replace('#include <fog_fragment>', /* glsl */ `#include <fog_fragment>
#ifdef USE_FOG
{
  // Horizon haze: within ~4° below the horizon the water fades into the fog's colour (and goes opaque).
  vec3 viewDir = normalize(vSeaWorld - cameraPosition);
  // Near the horizon line, and (seen from high up, where the sea's edge lies well below it) near the
  // sea's far edge: either way the water melts into the fog colour the sky shows at its horizon.
  float edge = smoothstep(0.5, 0.97, length(vSeaWorld.xz - cameraPosition.xz) / seaRadius);
  // The disc's far edge melts into the far-sea colour the sky paints under the horizon (no seam);
  // then the horizon haze (fog colour) as wide as the Sky window asks (0: none, a crisp line).
  // This runs after the colour-space step (fog_fragment follows it), so the colours mixed in here go to
  // the screen's space first: the sky shader converts the same colours, and the two meet with no seam.
  vec3 farOut = sRGBTransferOETF(vec4(seaFarCol, 1.0)).rgb;
  vec3 fogOut = sRGBTransferOETF(vec4(fogColor, 1.0)).rgb;
  vec3 glowOut = sRGBTransferOETF(vec4(seaGlowCol, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, farOut, edge);
  float line = seaHazeW > 0.0005 ? 1.0 - smoothstep(0.0, seaHazeW, -viewDir.y) : 0.0;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogOut, line);
  gl_FragColor.a = mix(gl_FragColor.a, 1.0, max(line, edge));
  // The horizon glow, fading down from the line onto the water (its twin fades up the sky).
  float glow = seaGlowAmt * (1.0 - smoothstep(seaGlowW * (1.0 - seaGlowSoft), seaGlowW, -viewDir.y));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, glowOut, glow);
  gl_FragColor.a = mix(gl_FragColor.a, 1.0, glow);
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
  float v = (rn + seaTime * 160.0 * seaSpeed) / seaTile;
  dx.y = dFdx(v); dy.y = dFdy(v);
  vec4 a = textureGrad(map, vec2(u1, v), dx, dy);
  vec4 b = textureGrad(map, vec2(u1 * 1.7 + 0.37, v * 0.61 + 0.11), dx * vec2(1.7, 0.61), dy * vec2(1.7, 0.61));
  diffuseColor *= mix(a, b, 0.35);
}
#endif
`);
  };
  water.customProgramCacheKey = () => 'island-sea-rings-haze-5';
  const sea = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS, 160), water);
  sea.rotation.x = -Math.PI / 2;
  sea.name = 'Sea';
  sea.renderOrder = 1;
  group.add(sea);

  const floorMat = new THREE.MeshStandardMaterial({ color: '#557f78', roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opts.floorY;
  floor.name = 'Sea floor';
  group.add(floor);

  /* The foam: a lace at the waterline and bands rolling in, broken up by the water texture. */
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f4fbfb', transparent: true, depthWrite: false });
  foamMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { seaTime: time, seaAround: foamAround, shoreR: shore, foamNoise: { value: foamNoise }, seaSpeed: speed });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFoamWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vFoamWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFoamWorld;\nuniform float seaTime;\nuniform float seaAround;\nuniform float shoreR;\nuniform float seaSpeed;\nuniform sampler2D foamNoise;\n${SHORE_GLSL}`)
      .replace('#include <alphamap_fragment>', /* glsl */ `#include <alphamap_fragment>
{
  float ang = atan(vFoamWorld.x, -vFoamWorld.z);
  float rn = length(vFoamWorld.xz) / seaWobble(ang);
  float d = rn - shoreR;                                    // + out to sea, - up the sand
  float u = mod(ang + 6.2831853, 6.2831853) / 6.2831853 * seaAround * 2.0;
  float n = texture2D(foamNoise, vec2(u, (rn + seaTime * 110.0 * seaSpeed) / 1400.0)).r;
  float n2 = texture2D(foamNoise, vec2(u * 0.43 + 0.3, (rn + seaTime * 70.0 * seaSpeed) / 2600.0)).g;
  // The lace where water meets sand.
  float lace = smoothstep(-450.0, -50.0, d) * (1.0 - smoothstep(150.0, 900.0, d)) * (0.55 + 0.45 * n);
  // Bands rolling in to the shore (the same pace as the rings in the water), fading out to sea.
  float wave = pow(0.5 + 0.5 * sin((rn + seaTime * 160.0 * seaSpeed) / 1500.0 * 6.2831853 + n2 * 2.5), 5.0);
  float bands = wave * (1.0 - smoothstep(0.0, 5200.0, d)) * smoothstep(-100.0, 300.0, d) * smoothstep(0.3, 0.7, n * 0.7 + wave * 0.5);
  diffuseColor.a *= clamp(max(lace, bands) * 0.9, 0.0, 1.0);
}`);
  };
  foamMat.customProgramCacheKey = () => 'island-sea-foam-2';
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
    setHorizon(h) {
      hazeW.value = 0.07 * h.haze;
      glowCol.value.set(h.glowColor);
      glowAmt.value = h.glow ? h.glowStrength : 0;
      glowW.value = h.glowWidth;
      glowSoft.value = h.glowSoftness;
    },
    setLook(look) {
      farCol.value.copy(seaFarColor(look));
      water.color.set(look.water);
      floorMat.color.set(look.deep);
      water.opacity = 1 - look.seeThrough;
      tile.value = look.tileSize;
      around.value = seaRepeatsAround(opts.shoreRadius, look.tileSize);
      speed.value = look.waveSpeed;
      const map = pattern(look.texture);
      if (map !== water.map) {
        // With or without a map is another program (USE_MAP).
        if (!map !== !water.map) water.needsUpdate = true;
        water.map = map;
      }
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
