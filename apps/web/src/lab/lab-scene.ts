// The SetMix and Goblin Racing home's 3D backdrop (POL-01, 03-menu-lab.md):
// Unified with Play's lab room (createLabRoom) with the free-standing gate, illuminated coils,
// active planet table amber hologram, and the desolate glitching Stage 0/1 wasteland in the window.
// Through the free-standing gate, the edition-specific vista is shown:
// - SetMix: the lush sunlit terraformed planet (docs/concept/setmix/04-menu-setmix.png)
// - Goblin Racing: the goblin planet in deep space (docs/concept/setmix/05-menu-goblin-racing.png)
import * as THREE from 'three';
import { createLabRoom, GATE_AT, POWER_ON, type LabRoom } from '../play/lab-room';
import { createPlotHolo, type PlotHolo } from '../play/plot-holo';
import type { PlotGround } from '../play/plot-ground';
import type { PlotState } from '@hm/plotsim';
import { smoothModel } from '../crafter/smooth-models';
import { EDITION } from '../edition';
import type { StageLook } from '../crafter/looks';
import type { Neighbour } from '../crafter/world';
import { hash } from '../crafter/moon';

export const LAB_AT = { x: 86, z: 30 } as const;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Albedo, roughness and normal textures from a height function over a tile (h 0 in seams .. 1 on faces), drawn once. */
export function surfaceTextures(size: number, at: (px: number, py: number) => { h: number; colour: [number, number, number]; rough: number }, bump: number) {
  const albedo = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = at(x, y), k = (y * size + x) * 4;
    height[y * size + x] = s.h;
    albedo[k] = s.colour[0] * 255; albedo[k + 1] = s.colour[1] * 255; albedo[k + 2] = s.colour[2] * 255; albedo[k + 3] = 255;
    rough[k] = 255; rough[k + 1] = s.rough * 255; rough[k + 2] = 255; rough[k + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (xx: number, yy: number) => height[((yy + size) % size) * size + ((xx + size) % size)]!;
    const dx = (h(x + 1, y) - h(x - 1, y)) * bump, dy = (h(x, y + 1) - h(x, y - 1)) * bump, len = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    normal[k] = (0.5 - 0.5 * dx / len) * 255; normal[k + 1] = (0.5 + 0.5 * dy / len) * 255; normal[k + 2] = (0.5 + 0.5 / len) * 255; normal[k + 3] = 255;
  }
  const tex = (bytes: Uint8Array, colour: boolean) => {
    const t = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(albedo, true), roughnessMap: tex(rough, false), normalMap: tex(normal, false) };
}

/** Test-chamber wall panels: cool white squares with dark seams and a soft bevel. */
export function panelTextures(size: number) {
  const cell = size / 4;
  return surfaceTextures(size, (px, py) => {
    const lx = px % cell, ly = py % cell, edge = Math.min(lx, ly, cell - 1 - lx, cell - 1 - ly);
    const ix = Math.floor(px / cell), iy = Math.floor(py / cell), tint = 0.93 + hash(ix, iy, 3) * 0.07;
    const grime = 1 - 0.05 * (ly / cell) - 0.04 * (1 - smoothstep(0, cell * 0.25, edge));
    const seam = edge < 1.5;
    const c = seam ? 0.13 : tint * grime;
    return { h: smoothstep(0, cell * 0.04, edge), colour: [c * 0.9, c * 0.94, c * 0.95], rough: seam ? 0.9 : 0.38 + hash(ix, iy, 4) * 0.12 };
  }, 2.2);
}

/** Concrete floor tiles: mottled grey, darker seams. */
export function floorTextures(size: number) {
  const cell = size / 2;
  const noise = (x: number, y: number, s: number, seed: number) => {
    const fx = x / s, fy = y / s, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, n = size / s;
    const h = (a: number, b: number) => hash(((a % n) + n) % n, ((b % n) + n) % n, seed);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };
  return surfaceTextures(size, (px, py) => {
    const lx = px % cell, ly = py % cell, edge = Math.min(lx, ly, cell - 1 - lx, cell - 1 - ly);
    const m = 0.6 * noise(px, py, size / 8, 9) + 0.4 * noise(px, py, size / 32, 10);
    const seam = edge < 1.5, c = seam ? 0.1 : 0.27 + m * 0.08;
    return { h: smoothstep(0, 3, edge), colour: [c, c * 1.02, c * 1.05], rough: seam ? 0.95 : 0.42 + m * 0.3 };
  }, 1.4);
}

const PORTAL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PORTAL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIsGoblin;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.04 + vec2(1.5, 2.1);
      a *= 0.5;
    }
    return v;
  }

  vec3 renderGoblinPlanet(vec2 uv) {
    // Deep space with stars
    vec2 spaceCoord = uv * 90.0;
    float star = step(0.985, hash(floor(spaceCoord))) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(spaceCoord)) * 6.28));
    vec3 bg = vec3(0.005, 0.008, 0.02) + vec3(star * 0.9, star * 0.95, star * 1.0);

    // Goblin planet sphere
    vec2 pc = uv - vec2(0.5, 0.52);
    float r = length(pc);
    float R = 0.41;
    if (r > R) {
      float glow = smoothstep(R + 0.08, R, r) * 0.55;
      return bg + vec3(0.15, 0.55, 0.95) * glow;
    }

    float z = sqrt(max(0.0, R * R - r * r));
    vec3 normal = normalize(vec3(pc.x, pc.y, z));
    vec3 sunDir = normalize(vec3(-0.7, 0.6, 0.8));
    float diff = max(0.0, dot(normal, sunDir));

    vec2 sphUv = vec2(atan(normal.x, normal.z) / 3.14159 * 0.5 + 0.5 + uTime * 0.012, normal.y * 0.5 + 0.5);
    float continent = fbm(sphUv * 6.0);
    float isLand = smoothstep(0.46, 0.52, continent);

    vec3 ocean = vec3(0.05, 0.28, 0.65);
    vec3 land = mix(vec3(0.2, 0.55, 0.22), vec3(0.7, 0.52, 0.25), fbm(sphUv * 12.0));
    vec3 surface = mix(ocean, land, isLand);

    float clouds = fbm(sphUv * 9.0 + vec2(uTime * 0.018, 0.0));
    float cloudMask = smoothstep(0.52, 0.68, clouds);
    surface = mix(surface, vec3(0.95, 0.98, 1.0), cloudMask * 0.85);

    float fresnel = pow(1.0 - normal.z, 2.5);
    vec3 atmo = vec3(0.2, 0.65, 1.0) * fresnel * 0.9;

    return surface * (diff * 0.9 + 0.15) + atmo;
  }

  vec3 renderSetmixVista(vec2 uv) {
    float sunDist = length(uv - vec2(0.55, 0.78));
    float sunGlow = smoothstep(0.45, 0.0, sunDist) * 0.85;
    vec3 sky = mix(vec3(0.85, 0.88, 0.75), vec3(0.45, 0.65, 0.88), uv.y);
    sky += vec3(1.0, 0.82, 0.45) * sunGlow;

    float crest1 = 0.58 + 0.10 * sin(uv.x * 5.5) + 0.05 * cos(uv.x * 12.0) + 0.03 * fbm(vec2(uv.x * 10.0, 2.0));
    vec3 col = sky;
    if (uv.y < crest1) {
      vec3 mtn = mix(vec3(0.35, 0.45, 0.48), vec3(0.65, 0.72, 0.60), fbm(vec2(uv.x * 18.0, uv.y * 22.0)));
      col = mix(mtn, sky, 0.35);
    }

    float crest2 = 0.42 + 0.08 * sin(uv.x * 8.5 + 1.2) + 0.04 * cos(uv.x * 19.0);
    if (uv.y < crest2) {
      vec3 forest = mix(vec3(0.12, 0.32, 0.18), vec3(0.22, 0.48, 0.25), fbm(vec2(uv.x * 30.0, uv.y * 35.0)));
      col = forest;
    }

    float crest3 = 0.22 + 0.04 * sin(uv.x * 11.0 + 3.0);
    if (uv.y < crest3) {
      float isWater = smoothstep(0.48, 0.52, fbm(vec2(uv.x * 15.0, uv.y * 20.0)));
      vec3 grass = vec3(0.18, 0.45, 0.15);
      vec3 water = mix(vec3(0.15, 0.4, 0.5), vec3(0.9, 0.85, 0.6), sunGlow);
      col = mix(grass, water, isWater);
    }

    float rays = max(0.0, sin(atan(uv.y - 0.78, uv.x - 0.55) * 8.0 + uTime * 0.2)) * 0.12;
    col += vec3(1.0, 0.9, 0.6) * rays;

    return col;
  }

  void main() {
    vec3 c = uIsGoblin > 0.5 ? renderGoblinPlanet(vUv) : renderSetmixVista(vUv);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface LabScene {
  /** Configures or enriches the gate vista */
  setVista(base: StageLook, plot: StageLook, neighbours: readonly Neighbour[]): void;
  frame(now: number, dt: number): void;
  /** What the last frame drew (for test hooks) */
  stats(): { readonly triangles: number; readonly calls: number };
  resize(width: number, height: number, pixelRatio: number): void;
  /** Where the pointer is, -1..1 across screen: the eye leans towards it */
  lean(x: number, y: number): void;
  dispose(): void;
}

export function createLabScene(o: {
  readonly canvas: HTMLCanvasElement;
  readonly gridSpacing: number;
  readonly antialias: boolean;
  readonly powerPreference: WebGLPowerPreference;
  readonly reducedMotion: boolean;
  readonly textureSize: number;
}): LabScene {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  const isGoblin = EDITION === 'goblin-racing' ? 1.0 : 0.0;
  const portalUniforms = { uTime: { value: 0 }, uIsGoblin: { value: isGoblin } };
  const portalMat = keep(new THREE.ShaderMaterial({
    vertexShader: PORTAL_VERTEX,
    fragmentShader: PORTAL_FRAGMENT,
    uniforms: portalUniforms,
    side: THREE.DoubleSide,
  }));

  const labScene = new THREE.Scene();
  const room: LabRoom = createLabRoom({ textureSize: o.textureSize, portalMaterial: portalMat });
  labScene.add(room.group);
  room.setPower(POWER_ON);
  room.lever.rotation.x = -1.1;

  // ---- Amber hologram planet table in the menu
  const holo: PlotHolo = createPlotHolo();
  room.group.add(holo.group);
  holo.group.position.set(-3.6, 0, -5.2);
  const mockGround = {
    heightAt: (x: number, z: number) => 15 + 4 * Math.sin(x * 0.015) + 3 * Math.cos(z * 0.015),
  } as unknown as PlotGround;
  holo.build(mockGround, { x: 0, z: 0 });

  const demoPlot = {
    machines: [
      { id: 1, kind: 'mill' as const, x: 25, z: 15, yaw: 0, on: true, cartridge: null, built: 0 },
      { id: 2, kind: 'drill' as const, x: -30, z: 20, yaw: 0, on: true, cartridge: null, built: 0 },
      { id: 3, kind: 'press' as const, x: 40, z: -25, yaw: 0, on: true, cartridge: null, built: 0 },
    ],
  } as unknown as PlotState;
  holo.setPlot(demoPlot, new Map([[1, 1], [2, 1], [3, 1]]), new Set([1, 2, 3]));

  // ---- Goblin character looking through the gate threshold
  const goblinGeo = smoothModel('goblin').near;
  const goblinMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }));
  const goblin = new THREE.Mesh(goblinGeo, goblinMat);
  goblin.position.set(GATE_AT.x - 0.7, 0.12, GATE_AT.z + 1.3);
  goblin.rotation.y = Math.PI - 0.4;
  goblin.scale.setScalar(0.9);
  room.group.add(goblin);

  // ---- Camera framing from concept art 04 and 05
  // Left third calm for menu overlay; planet table center; free-standing gate right
  const EYE = new THREE.Vector3(-1.6, 2.1, 2.4);
  const LOOK = new THREE.Vector3(1.1, 2.1, -7.8);
  const EYE_TALL = new THREE.Vector3(-0.6, 2.5, 3.8);
  const LOOK_TALL = new THREE.Vector3(1.5, 2.2, -7.0);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const eye = new THREE.Vector3(), look = new THREE.Vector3();
  const leanTo = new THREE.Vector2(), leanNow = new THREE.Vector2();
  let tall = false;

  return {
    setVista() {
      // Menu vista is driven cleanly by procedural portal shader
    },

    lean(x, y) {
      leanTo.set(x, y);
    },

    stats: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),

    frame(now, dt) {
      const k = Math.min(1, dt * 2.5);
      leanNow.lerp(leanTo, k);
      const sway = o.reducedMotion ? 0 : 1;

      eye.copy(tall ? EYE_TALL : EYE).add(new THREE.Vector3(
        Math.sin(now * 0.31) * 0.05 * sway + leanNow.x * 0.25,
        Math.sin(now * 0.43) * 0.03 * sway - leanNow.y * 0.12,
        0,
      ));
      look.copy(tall ? LOOK_TALL : LOOK).add(new THREE.Vector3(leanNow.x * 0.9, -leanNow.y * 0.5, 0));

      camera.position.copy(eye);
      camera.lookAt(look);

      room.update(now, dt);
      holo.update(now, dt, 1, -1);
      portalUniforms.uTime.value = now;

      renderer.info.autoReset = false;
      renderer.info.reset();
      renderer.clear();
      renderer.render(labScene, camera);
    },

    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      tall = camera.aspect < 0.8;
      camera.fov = tall ? 72 : camera.aspect < 1 ? 60 : 50;
      camera.updateProjectionMatrix();
    },

    dispose() {
      holo.dispose();
      room.dispose();
      for (const x of owned) x.dispose();
      renderer.dispose();
    },
  };
}
