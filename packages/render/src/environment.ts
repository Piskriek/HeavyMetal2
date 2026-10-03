import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Vec3 } from '@hm/contracts';

/** A scene mood in linear light, structurally the looks package's LookUniforms (render does not import it). */
export interface LookLike {
  sunDir: Vec3; sunColor: Vec3; skyZenith: Vec3; skyHorizon: Vec3; skyGround: Vec3; ambientSky: Vec3; ambientGround: Vec3;
  ambientIntensity: number; fogColor: Vec3; fogDensity: number; exposure: number; bloom: number; saturation: number; contrast: number;
  vignette: number; waterColor: Vec3; waterOpacity: number; cloudCover: number;
  /** Multiplies the fog density (the editor overview uses less fog than the ground-level race camera). */
  fogScale?: number;
}

export interface EnvironmentRig {
  /** Apply a look: sky gradient + sun glow, sun and ambient light, fog, exposure, water tint. */
  setLook(look: LookLike): void;
  update(target: Vec3): void;
  /** Sea mode: the ground disc becomes clear tropical water at y = 0 (used when a terrain island is shown). */
  setSea(on: boolean): void;
  /** Quality tier: shadows on/off and the shadow map size (smaller = faster on phones). */
  setShadows(on: boolean, mapSize?: number): void;
  /** White-out: hides the sky, paints the background and fades everything beyond `far` metres from the camera to `color`. null restores the look. */
  setVeil(veil: { readonly color: number; readonly near: number; readonly far: number } | null): void;
  /** The pieces the lighting rig drives when a light-setup is in charge instead of a look. */
  readonly parts: { readonly sun: THREE.DirectionalLight; readonly hemisphere: THREE.HemisphereLight; readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null };
  /** Point the sun along a unit vector (towards the sun); it casts shadows only while above the horizon. */
  setSunDirection(dir: Vec3): void;
  /** Sea tint, clarity and shine (the sea is the ground disc in sea mode). */
  setWater(color: THREE.Color, opacity: number, roughness: number): void;
  /** Haze colour and density; kept while the focus veil is on and restored after. */
  setFog(color: THREE.Color, density: number): void;
  /**
   * The ground under the sea (the island's height grid). The water reads its depth from it: turquoise where it is shallow, deep blue further
   * out, and foam rolling in where it is under a metre deep. Call again after the ground changes; null forgets it.
   */
  setSeaFloor(floor: { readonly heights: Float32Array; readonly cols: number; readonly rows: number; readonly cell: number; readonly originX: number; readonly originZ: number } | null): void;
  /**
   * Low tier: the sea's foam bands roll in without the noise that breaks them up (the sea covers most of the screen), and with no sky
   * reflections the water takes the sky colour by viewing angle instead (`setSeaSky`).
   */
  setLowDetail(on: boolean): void;
  /** The sky colour the water shows at a glancing angle on the low tier. */
  setSeaSky(color: THREE.Color): void;
  dispose(): void;
}

/** The sea's depth colour and shoreline foam, added to the standard material (only while sea mode is on). */
const SEA_HEADER = /* glsl */ `
uniform sampler2D uSeaFloor;
uniform vec2 uSeaOrigin;
uniform vec2 uSeaSize;
uniform float uSeaTime;
uniform float uSeaHasFloor;
uniform vec3 uSeaSky;
varying vec3 vSeaWorld;
float gSeaSky = 0.0;
float seaHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float seaNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = seaHash(i), b = seaHash(i + vec2(1.0, 0.0)), c = seaHash(i + vec2(0.0, 1.0)), d = seaHash(i + vec2(1.0, 1.0));
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
`;
const SEA_COLOR = /* glsl */ `
#include <color_fragment>
#ifdef SEA
{
  vec2 suv = (vSeaWorld.xz - uSeaOrigin) / uSeaSize;
  bool onGrid = uSeaHasFloor > 0.5 && suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0;
  float depth = onGrid ? max(0.0, vSeaWorld.y - texture2D(uSeaFloor, suv).r) : 12.0;
  // the height grid ends in a square: fade to open sea in a circle inside it so no edge shows
  float inner = onGrid ? 1.0 - smoothstep(0.36, 0.48, length(suv - 0.5)) : 0.0;
  depth = mix(12.0, depth, inner);
  float deepK = smoothstep(0.4, 8.0, depth);
  vec3 shallow = mix(diffuseColor.rgb, vec3(0.16, 0.72, 0.74), 0.55);
  diffuseColor.rgb = mix(shallow, diffuseColor.rgb * 0.72, deepK);
  diffuseColor.a = mix(0.5, min(0.97, diffuseColor.a + 0.2), smoothstep(0.0, 3.5, depth));
  // foam: broken bands that roll in towards the beach, and a bright lip where the water meets the sand
#ifdef SEA_LOW
  float band = 0.5 + 0.5 * sin(depth * 22.0 - uSeaTime * 1.5);
  float foam = (1.0 - smoothstep(0.02, 0.35, depth)) * smoothstep(0.78, 0.95, band) * 0.7;
  foam += (1.0 - smoothstep(0.0, 0.05, depth)) * 0.75;
  // no reflection map on the low tier: the water shows the sky by viewing angle (Fresnel), as the reflection would
  gSeaSky = pow(1.0 - clamp(normalize(cameraPosition - vSeaWorld).y, 0.0, 1.0), 3.0) * 0.85;
  diffuseColor.rgb *= 1.0 - gSeaSky;
  diffuseColor.a = max(diffuseColor.a, gSeaSky);
#else
  float n = seaNoise(vSeaWorld.xz * 0.28 + vec2(uSeaTime * 0.07, -uSeaTime * 0.05));
  float band = 0.5 + 0.5 * sin(depth * 22.0 - uSeaTime * 1.5 + n * 6.0);
  float foam = (1.0 - smoothstep(0.02, 0.35, depth)) * smoothstep(0.78, 0.95, band) * (0.4 + 0.6 * n);
  foam += (1.0 - smoothstep(0.0, 0.05, depth)) * (0.5 + 0.5 * seaNoise(vSeaWorld.xz * 2.1 + uSeaTime * 0.35));
#endif
  foam = clamp(foam, 0.0, 1.0) * inner;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.98, 0.97), foam * 0.8);
  diffuseColor.a = max(diffuseColor.a, foam * 0.85);
}
#endif
`;

const skyVertex = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFragment = `
  varying vec3 vWorld;
  uniform vec3 uCenter;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uCloud;
  void main() {
    vec3 dir = normalize(vWorld - uCenter);
    float h = dir.y;
    vec3 col = mix(uGround, uHorizon, smoothstep(-0.3, 0.02, h));
    col = mix(col, uZenith, smoothstep(0.0, 0.9, pow(max(h, 0.0), 0.65)));
    float s = max(dot(dir, uSunDir), 0.0);
    float sunVis = smoothstep(-0.12, 0.05, uSunDir.y);
    vec3 glow = uSunColor / max(max(uSunColor.r, max(uSunColor.g, uSunColor.b)), 1.0);
    col += glow * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.07) * sunVis;
    col = mix(col, vec3(dot(col, vec3(0.333))) * 0.9 + 0.05, uCloud * 0.55 * smoothstep(-0.1, 0.5, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const makeGridTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#252a2d';
    context.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 16; i += 1) {
      const p = i * 32;
      context.strokeStyle = i % 4 === 0 ? 'rgba(184,199,201,0.17)' : 'rgba(184,199,201,0.07)';
      context.lineWidth = i % 4 === 0 ? 1.5 : 1;
      context.beginPath();
      context.moveTo(p, 0);
      context.lineTo(p, 512);
      context.moveTo(0, p);
      context.lineTo(512, p);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

export function createEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer, background: 'sky' | 'dark', shadows: boolean): EnvironmentRig {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;

  let sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  if (background === 'sky') {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() }, uZenith: { value: new THREE.Vector3(0.055, 0.15, 0.31) }, uHorizon: { value: new THREE.Vector3(0.78, 0.82, 0.82) },
        uGround: { value: new THREE.Vector3(0.3, 0.32, 0.3) }, uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() }, uSunColor: { value: new THREE.Vector3(1, 0.95, 0.85) }, uCloud: { value: 0 },
      },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), material);
    sky.frustumCulled = false;
    // last of the solid objects (before the see-through sea): drawn first, its cloud shader ran for every pixel the island then covered
    sky.renderOrder = 1000;
    scene.add(sky);
    scene.fog = new THREE.FogExp2(0xaebdc3, 0.0022);
  } else {
    scene.background = new THREE.Color(0x090d13);
    scene.fog = new THREE.FogExp2(0x090d13, 0.012);
  }

  const gridTexture = makeGridTexture();
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: gridTexture,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.35,
    // the sea plane sits where the beach meets the water: pull it a hair towards the camera so the two never fight over the same depth
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  // sea mode: depth colour and foam from the ground under the water (see SEA_COLOR)
  const seaUniforms = {
    uSeaFloor: { value: null as THREE.Texture | null }, uSeaOrigin: { value: new THREE.Vector2() }, uSeaSize: { value: new THREE.Vector2(1, 1) },
    uSeaTime: { value: 0 }, uSeaHasFloor: { value: 0 }, uSeaSky: { value: new THREE.Color(0.75, 0.85, 0.92) },
  };
  groundMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seaUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SEA_HEADER}`)
      .replace('#include <color_fragment>', SEA_COLOR)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef SEA_LOW\ntotalEmissiveRadiance += uSeaSky * gSeaSky;\n#endif');
  };
  groundMaterial.customProgramCacheKey = () => (groundMaterial.defines?.['SEA'] ? (groundMaterial.defines?.['SEA_LOW'] ? 'sea-low' : 'sea') : 'ground');
  let seaFloor: THREE.DataTexture | null = null;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 128), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  scene.add(ground);

  // beyond and beneath the island the sea is one deep colour: without it the clear water lets the edge of the terrain grid show as a square
  const deepSea = new THREE.Mesh(new THREE.CircleGeometry(3000, 64), new THREE.MeshBasicMaterial({ color: 0x0d5f6e }));
  deepSea.rotation.x = -Math.PI / 2;
  deepSea.position.y = -9;
  deepSea.visible = false;
  scene.add(deepSea);

  let veilOn = false;
  let savedFog: THREE.Scene["fog"] = null;
  let savedBackground: THREE.Scene['background'] = null;
  let lastLook: LookLike | null = null;
  const hemisphere = new THREE.HemisphereLight(0xb9d7ff, 0x29241f, 0.55);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffddb3, 3.2);
  sun.castShadow = shadows;
  let shadowsOn = shadows;
  let lastSunUp = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.025;
  const camera = sun.shadow.camera;
  camera.left = -35;
  camera.right = 35;
  camera.top = 35;
  camera.bottom = -35;
  camera.near = 1;
  camera.far = 140;
  scene.add(sun, sun.target);

  const seaTint = new THREE.Color(0x1d8fa3);
  const toSrgb = (c: Vec3): THREE.Vector3 => {
    const col = new THREE.Color().setRGB(Math.max(0, c[0]), Math.max(0, c[1]), Math.max(0, c[2]), THREE.LinearSRGBColorSpace);
    const out = { r: 0, g: 0, b: 0 };
    col.getRGB(out, THREE.SRGBColorSpace);
    return new THREE.Vector3(out.r, out.g, out.b);
  };
  const lin = (c: Vec3): THREE.Color => new THREE.Color().setRGB(Math.max(0, c[0]), Math.max(0, c[1]), Math.max(0, c[2]), THREE.LinearSRGBColorSpace);
  let sunDirNow = new THREE.Vector3(32, 48, 24).normalize();
  let seaColor: THREE.Color | null = null;
  let seaOpacity = 0.72;
  let seaRoughness = 0.06;
  let fogStyle: { readonly color: THREE.Color; readonly density: number } | null = null;
  return {
    parts: { sun, hemisphere, sky },
    setSunDirection(dir: Vec3): void {
      sunDirNow = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
      lastSunUp = sunDirNow.y > 0.02;
      sun.castShadow = shadowsOn && lastSunUp;
    },
    setWater(color: THREE.Color, opacity: number, roughness: number): void {
      seaColor = color.clone();
      deepSea.material.color.copy(color).multiplyScalar(0.62);
      seaOpacity = opacity;
      seaRoughness = roughness;
      if (groundMaterial.transparent) { groundMaterial.color.copy(seaColor); groundMaterial.opacity = seaOpacity; groundMaterial.roughness = seaRoughness; }
    },
    setFog(color: THREE.Color, density: number): void {
      fogStyle = { color: color.clone(), density };
      const fog = veilOn ? null : scene.fog;
      if (fog instanceof THREE.FogExp2) { fog.color.copy(color); fog.density = density; }
    },
    setLook(look: LookLike): void {
      lastLook = look;
      sunDirNow = new THREE.Vector3(look.sunDir[0], look.sunDir[1], look.sunDir[2]).normalize();
      if (sky) {
        const u = sky.material.uniforms;
        (u.uZenith!.value as THREE.Vector3).copy(toSrgb(look.skyZenith));
        (u.uHorizon!.value as THREE.Vector3).copy(toSrgb(look.skyHorizon));
        (u.uGround!.value as THREE.Vector3).copy(toSrgb(look.skyGround));
        (u.uSunDir!.value as THREE.Vector3).copy(sunDirNow);
        (u.uSunColor!.value as THREE.Vector3).set(look.sunColor[0], look.sunColor[1], look.sunColor[2]);
        u.uCloud!.value = look.cloudCover;
      }
      const peak = Math.max(look.sunColor[0], look.sunColor[1], look.sunColor[2], 1e-4);
      sun.color.setRGB(look.sunColor[0] / peak, look.sunColor[1] / peak, look.sunColor[2] / peak, THREE.LinearSRGBColorSpace);
      sun.intensity = peak * 0.85;
      lastSunUp = look.sunDir[1] > 0.02 && peak > 0.05;
      sun.castShadow = shadowsOn && lastSunUp;
      hemisphere.color.copy(lin(look.ambientSky));
      hemisphere.groundColor.copy(lin(look.ambientGround));
      hemisphere.intensity = look.ambientIntensity * 0.6;
      scene.environmentIntensity = 0.12 + look.ambientIntensity * 0.12;
      const fog = veilOn ? null : (scene.fog as THREE.FogExp2 | null);
      if (fog) { fog.color.copy(lin(look.fogColor)); fog.density = look.fogDensity * (look.fogScale ?? 1); }
      renderer.toneMappingExposure = look.exposure * 0.95;
      seaColor = lin(look.waterColor);
      seaOpacity = look.waterOpacity;
      if (groundMaterial.transparent) { groundMaterial.color.copy(seaColor); groundMaterial.opacity = seaOpacity; }
    },
    setVeil(veil: { readonly color: number; readonly near: number; readonly far: number } | null): void {
      if (veil) {
        if (!veilOn) { savedFog = scene.fog; savedBackground = scene.background; }
        veilOn = true;
        if (sky) sky.visible = false;
        scene.background = new THREE.Color(veil.color);
        if (scene.fog instanceof THREE.Fog) { scene.fog.color.setHex(veil.color); scene.fog.near = veil.near; scene.fog.far = veil.far; }
        else scene.fog = new THREE.Fog(veil.color, veil.near, veil.far);
      } else if (veilOn) {
        veilOn = false;
        if (sky) sky.visible = true;
        scene.background = savedBackground;
        scene.fog = savedFog;
        savedFog = null; savedBackground = null;
        if (lastLook) this.setLook(lastLook);
        else if (fogStyle) this.setFog(fogStyle.color, fogStyle.density);
      }
    },
    setShadows(on: boolean, mapSize = 2048): void {
      shadowsOn = on && shadows;
      sun.castShadow = shadowsOn && lastSunUp;
      if (sun.shadow.mapSize.x !== mapSize) { sun.shadow.mapSize.set(mapSize, mapSize); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    },
    setSeaFloor(floor): void {
      if (!floor) { seaFloor?.dispose(); seaFloor = null; seaUniforms.uSeaFloor.value = null; seaUniforms.uSeaHasFloor.value = 0; return; }
      const n = floor.cols * floor.rows;
      if (!seaFloor || seaFloor.image.width !== floor.cols || seaFloor.image.height !== floor.rows) {
        seaFloor?.dispose();
        seaFloor = new THREE.DataTexture(new Uint16Array(n), floor.cols, floor.rows, THREE.RedFormat, THREE.HalfFloatType);
        seaFloor.magFilter = seaFloor.minFilter = THREE.LinearFilter;
        seaFloor.wrapS = seaFloor.wrapT = THREE.ClampToEdgeWrapping;
        seaFloor.generateMipmaps = false;
      }
      const data = seaFloor.image.data as Uint16Array;
      for (let i = 0; i < n; i++) data[i] = THREE.DataUtils.toHalfFloat(floor.heights[i] ?? 0);
      seaFloor.needsUpdate = true;
      // texel centres sit on the grid nodes: node 0 at origin, node cols-1 at origin + (cols-1) * cell
      seaUniforms.uSeaOrigin.value.set(floor.originX - floor.cell / 2, floor.originZ - floor.cell / 2);
      seaUniforms.uSeaSize.value.set(floor.cols * floor.cell, floor.rows * floor.cell);
      seaUniforms.uSeaFloor.value = seaFloor;
      seaUniforms.uSeaHasFloor.value = 1;
    },
    setSea(on: boolean): void {
      deepSea.visible = on;
      groundMaterial.defines = { ...(groundMaterial.defines ?? {}) };
      if (on) groundMaterial.defines['SEA'] = 1; else delete groundMaterial.defines['SEA'];
      groundMaterial.map = on ? null : gridTexture;
      groundMaterial.color.copy(on ? (seaColor ?? seaTint) : new THREE.Color(0xffffff));
      groundMaterial.transparent = on;
      groundMaterial.opacity = on ? seaOpacity : 1;
      groundMaterial.roughness = on ? seaRoughness : 0.94;
      groundMaterial.envMapIntensity = on ? 1.2 : 0.35;
      groundMaterial.depthWrite = !on;
      ground.position.y = on ? 0 : -0.012;
      ground.scale.set(on ? 30 : 1, on ? 30 : 1, 1);
      groundMaterial.needsUpdate = true;
    },
    setSeaSky(color: THREE.Color): void {
      seaUniforms.uSeaSky.value.copy(color);
    },
    setLowDetail(on: boolean): void {
      if (on === !!groundMaterial.defines?.['SEA_LOW']) return;
      groundMaterial.defines = { ...(groundMaterial.defines ?? {}) };
      if (on) groundMaterial.defines['SEA_LOW'] = 1; else delete groundMaterial.defines['SEA_LOW'];
      groundMaterial.needsUpdate = true;
    },
    update(target: Vec3): void {
      seaUniforms.uSeaTime.value = performance.now() / 1000;
      sun.target.position.fromArray(target);
      sun.position.set(target[0] + sunDirNow.x * 60, target[1] + sunDirNow.y * 60, target[2] + sunDirNow.z * 60);
      sun.target.updateMatrixWorld();
      if (sky) {
        sky.position.fromArray(target);
        (sky.material.uniforms.uCenter?.value as THREE.Vector3 | undefined)?.fromArray(target);
      }
    },
    dispose(): void {
      scene.remove(ground, hemisphere, sun, sun.target, deepSea);
      deepSea.geometry.dispose();
      deepSea.material.dispose();
      ground.geometry.dispose();
      groundMaterial.dispose();
      seaFloor?.dispose();
      gridTexture.dispose();
      if (sky) {
        scene.remove(sky);
        sky.geometry.dispose();
        sky.material.dispose();
      }
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    },
  };
}