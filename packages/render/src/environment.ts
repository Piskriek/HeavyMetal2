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
  dispose(): void;
}

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
    sky.renderOrder = -100;
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
    setSea(on: boolean): void {
      deepSea.visible = on;
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
    update(target: Vec3): void {
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