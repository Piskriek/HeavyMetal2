// The lab you play in (SETMIX_PLAN Phase 2b / Sheet 21 AAA Rebuild):
// A 16 × 12 × 5 m quantum-shielded white-room laboratory on Earth.
// - North wall: wide observation window (14.8 × 3.1 m) framing the void storm as progress (setStorm).
// - Centre: the gate standing free on a walkable square two-step plinth, opening facing the window.
// - West wall (The Power Wall): capacitor bank, breaker panel, 4 relay cabinets, 2 control boxes, console with throw lever.
// - East wall (Studio Corner): preset rack, preset bench, preset combiner, and planet table carrying PlotHolo.
// - South-east (The Armory): armory rail with extraction tool (weapon-frame) and weapon bench.
// - South wall (Her Corner): folding camp cot, her desk with notes and mug, inset wall radio, charts taped on wall.
// - Spawn: beside the cot facing north toward the gate and storm.
// Lab frame: x right (+x), y up (+y), z towards start (+z), north = -z.
import * as THREE from 'three';
import { floorTextures, panelTextures } from '../lab/lab-scene';
import * as kit from '@hm/labkit';
import type { Box, Prop } from '@hm/labkit';
import { operatorConsole as consoleMillOperatorConsole } from '@hm/consolemill';
import { type GenLevel, genLevelFor, getGenSync } from '../assets/gen';
import { createGenFixture } from '../assets/gen-props';

export const ROOM = { left: -8, right: 8, back: -9, front: 3, height: 5 } as const;
const WINDOW = { x0: -7.4, x1: 7.4, y0: 0.4, y1: 3.5 } as const;

/** Where the gate stands and which way its opening faces (north, towards the window). */
export const GATE_AT = { x: 0, z: -1.0 } as const;
export const PLANET_TABLE_AT = { x: 5.0, z: -5.0 } as const;

const PANEL_TILE = 5.12, FLOOR_TILE = 4;

/** How powered the lab is, each 0..1: the power-on sequence drives these. */
export interface Power {
  /** Fraction of the relay lamps lit, in order. */
  readonly relays: number;
  /** Power running along the floor covers. */
  readonly pulse: number;
  /** Fraction of the gate's coils lit, bottom to top. */
  readonly coils: number;
  /** The ceiling lights. */
  readonly main: number;
  /** The orange emergency lamps. */
  readonly emergency: number;
  /** Static in the gate's opening (1 = all static, 0 = a clear picture); the opening shows nothing while coils are 0. */
  readonly static: number;
}
export const POWER_OFF: Power = { relays: 0, pulse: 0, coils: 0, main: 0, emergency: 1, static: 1 };
export const POWER_ON: Power = { relays: 1, pulse: 1, coils: 1, main: 1, emergency: 0, static: 0 };
/** The power-on sequence's length, seconds. */
export const POWER_SECONDS = 6.5;

const ramp = (t: number, a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));

/** The lab at `t` seconds after the main lever is thrown: relays click on in a row, power runs along the floor to the gate,
 *  the coils light bottom to top while the lights dip (the gate draws from everything else), static resolves, the lights recover. */
export function powerAt(t: number): Power {
  if (t >= POWER_SECONDS) return POWER_ON;
  const dip = ramp(t, 2.0, 2.6) * (1 - ramp(t, 5.0, 6.3));
  return {
    relays: ramp(t, 0.4, 1.9),
    pulse: ramp(t, 1.2, 2.4),
    coils: ramp(t, 2.0, 4.4),
    main: ramp(t, 0.9, 1.6) * (1 - 0.65 * dip),
    emergency: 1 - ramp(t, 1.2, 2.2),
    static: 1 - ramp(t, 3.8, 5.4),
  };
}

const STORM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STORM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uStorm;
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
      p = p * 2.05 + vec2(1.7, 2.3);
      a *= 0.5;
    }
    return v;
  }

  // 4x4 Bayer dither matrix
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
    vec2 uv = vUv;
    float p = clamp(uStorm, 0.0, 1.0);
    float stormT = uTime * 1.8;

    // --- 1. Distant skyline and terrain (emerges as storm thins)
    float skylineSeed = floor(uv.x * 24.0);
    float skylineHeight = 0.18 + 0.14 * hash(vec2(skylineSeed, 7.31));
    float isTower = step(0.68, hash(vec2(skylineSeed, 13.89)));
    skylineHeight += isTower * 0.12;

    float hillLine = 0.22 + 0.06 * sin(uv.x * 8.0) + 0.03 * cos(uv.x * 19.0) + 0.02 * fbm(vec2(uv.x * 16.0, 2.0));

    float isSkyline = step(uv.y, skylineHeight) * isTower;
    float isGround = step(uv.y, hillLine);
    float landVis = max(isSkyline, isGround) * smoothstep(0.18, 0.55, p);

    vec3 landGrey = vec3(0.24, 0.26, 0.28) * (0.6 + 0.4 * fbm(uv * 18.0));
    vec3 landGreen = vec3(0.18, 0.42, 0.16) * (0.7 + 0.3 * fbm(uv * 26.0));
    vec3 landCol = mix(landGrey, landGreen, smoothstep(0.48, 0.95, p));

    // --- 2. Sky: Dark void at p=0, breaks to blue sky with soft clouds at p -> 1.0
    vec3 darkVoidSky = mix(vec3(0.04, 0.05, 0.07), vec3(0.14, 0.16, 0.20), uv.y);
    vec3 azureSky = mix(vec3(0.24, 0.54, 0.88), vec3(0.55, 0.78, 0.98), uv.y);
    float cloudNoise = fbm(vec2(uv.x * 4.0 - uTime * 0.08, uv.y * 5.0));
    vec3 cloudCol = vec3(0.92, 0.95, 0.98);
    vec3 cleanSky = mix(azureSky, cloudCol, smoothstep(0.48, 0.78, cloudNoise));

    float skyPatchDist = length((uv - vec2(0.5, 0.72)) * vec2(1.1, 1.8));
    float skyPatchRadius = smoothstep(0.35, 1.0, p) * 0.75;
    float skyOpen = smoothstep(skyPatchRadius + 0.15, skyPatchRadius - 0.08, skyPatchDist) * smoothstep(0.32, 0.85, p);
    vec3 skyCol = mix(darkVoidSky, cleanSky, skyOpen);

    vec3 worldCol = mix(skyCol, landCol, landVis);

    // --- 3. Void storm static & pixel lightning
    float stormClouds = fbm(vec2(uv.x * 6.0 + stormT * 0.5, uv.y * 7.0 - stormT * 0.3));
    float staticNoise = hash(floor(uv * 160.0) + floor(uTime * 30.0));

    float lightningFlashTime = floor(uTime * 6.0);
    float lightningStrike = step(0.94, hash(vec2(lightningFlashTime, 12.34)));
    float lightningBranch = step(0.88, hash(floor(vec2(uv.x * 45.0, uv.y * 30.0) + lightningFlashTime)));
    float lightning = lightningStrike * lightningBranch;

    float stormCover = smoothstep(p * 0.9, p * 0.9 + 0.35, uv.y);
    float staticStrength = (1.0 - p * 0.82) * stormCover;
    float edgeStatic = smoothstep(0.38, 0.48, abs(uv.x - 0.5)) * 0.25;
    staticStrength = max(staticStrength, edgeStatic);

    vec2 ditherCoord = gl_FragCoord.xy * 0.5;
    float ditherVal = bayer4(ditherCoord);

    float stormLuma = clamp(stormClouds * 0.8 + staticNoise * 0.4 + lightning * 0.9, 0.0, 1.0);
    float ditherBit = step(ditherVal, stormLuma);
    vec3 ditherCol = mix(vec3(0.06, 0.08, 0.10), vec3(0.85, 0.90, 0.94), ditherBit);

    vec3 col = mix(worldCol, ditherCol, clamp(staticStrength, 0.0, 1.0));
    col += vec3(lightning * 0.5 * (1.0 - p * 0.8));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Abstract scientific charts texture: line traces, pulse waveforms, bar graphs, taped corners. No letters, no numbers. */
function createChartTexture(): THREE.DataTexture {
  const w = 128, h = 128;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = 237, g = 233, b = 225; // paper base

      // Grid lines
      if (x % 16 === 0 || y % 16 === 0) {
        r = 215; g = 210; b = 200;
      }

      // Sine wave chart
      const targetY1 = Math.floor(96 + 18 * Math.sin(x * 0.1));
      if (Math.abs(y - targetY1) <= 1) {
        r = 45; g = 110; b = 180;
      }

      // Stepped pulse chart
      const pulseBlock = Math.floor(x / 20) % 2;
      const targetY2 = pulseBlock === 0 ? 50 : 66;
      if (y === targetY2 || (x % 20 === 0 && y >= 50 && y <= 66)) {
        r = 190; g = 75; b = 40;
      }

      // Bar chart columns
      const barCol = Math.floor(x / 14);
      const inBar = (x % 14) >= 3 && (x % 14) <= 11;
      const barHeight = 12 + ((barCol * 7 + 5) % 22);
      if (inBar && y >= 12 && y <= barHeight) {
        r = 70; g = 80; b = 90;
      }

      // Dark tape on 4 corners
      if ((x < 8 || x > w - 9) && (y < 8 || y > h - 9)) {
        r = 60; g = 62; b = 65;
      }

      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface LabRoom {
  /** How bright the room's reflections should be (the scene's environment light follows the ceiling lights). */
  envLevel(): number;
  readonly group: THREE.Group;
  /** Walls and props to walk round, in the lab frame. */
  readonly colliders: readonly Box[];
  readonly gate: ReturnType<typeof kit.gate>;
  /** The surface in the gate's opening (two-sided): the planet is drawn on it. */
  readonly portal: THREE.Mesh;
  /** Where the main lever is, in the lab frame (for looking at it to pull it). */
  readonly leverAt: THREE.Vector3;
  readonly lever: THREE.Object3D;
  readonly spawn: { readonly x: number; readonly z: number; readonly yaw: number };
  setPower(p: Power): void;
  setStorm(progress: number): void;
  floorHeight(x: number, z: number): number;
  update(now: number, dt: number): void;
  dispose(): void;
}

export function createLabRoom(o: {
  readonly textureSize: number;
  readonly portalMaterial: THREE.Material;
  readonly quality?: 'low' | 'medium' | 'high' | string;
}): LabRoom {
  const genLevel: GenLevel = genLevelFor(o.quality ?? 'high');
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
  const m = kit.createMaterials();
  const colliders: Box[] = [];

  // ---- The Shell (16 × 12 × 5 m)
  const panels = panelTextures(o.textureSize), floorTex = floorTextures(o.textureSize);
  for (const t of [panels.map, panels.roughnessMap, panels.normalMap]) { keep(t); t.repeat.set(1 / PANEL_TILE, 1 / PANEL_TILE); }
  for (const t of [floorTex.map, floorTex.roughnessMap, floorTex.normalMap]) { keep(t); t.repeat.set(1 / FLOOR_TILE, 1 / FLOOR_TILE); }
  const wallMat = keep(new THREE.MeshStandardMaterial({ ...panels, normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0 }));
  const floorMat = keep(new THREE.MeshStandardMaterial({ ...floorTex, normalScale: new THREE.Vector2(0.5, 0.5), metalness: 0 }));
  const ceilingMat = keep(new THREE.MeshStandardMaterial({ color: '#1b1e22', roughness: 0.85, metalness: 0.2 }));
  const rect = (x0: number, y0: number, x1: number, y1: number): THREE.Shape => new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, f: (mesh: THREE.Mesh) => void = () => undefined): THREE.Mesh => {
    const mesh = new THREE.Mesh(keep(g), mat); f(mesh); group.add(mesh); return mesh;
  };

  const depth = ROOM.front - ROOM.back; // 12 m
  const width = ROOM.right - ROOM.left; // 16 m

  // North wall with observation window cutout
  const back = rect(ROOM.left, 0, ROOM.right, ROOM.height);
  back.holes.push(new THREE.Path([
    new THREE.Vector2(WINDOW.x0, WINDOW.y0),
    new THREE.Vector2(WINDOW.x1, WINDOW.y0),
    new THREE.Vector2(WINDOW.x1, WINDOW.y1),
    new THREE.Vector2(WINDOW.x0, WINDOW.y1),
  ]));
  add(new THREE.ShapeGeometry(back), wallMat, (w) => { w.position.z = ROOM.back; });

  // West wall (Power Wall, x = -8)
  add(new THREE.ShapeGeometry(rect(0, 0, depth, ROOM.height)), wallMat, (w) => {
    w.rotation.y = Math.PI / 2; w.position.set(ROOM.left, 0, ROOM.front);
  });
  // East wall (Studio / Armory wall, x = 8)
  add(new THREE.ShapeGeometry(rect(0, 0, depth, ROOM.height)), wallMat, (w) => {
    w.rotation.y = -Math.PI / 2; w.position.set(ROOM.right, 0, ROOM.back);
  });
  // South wall (Her corner, z = 3)
  add(new THREE.ShapeGeometry(rect(0, 0, width, ROOM.height)), wallMat, (w) => {
    w.rotation.y = Math.PI; w.position.set(ROOM.right, 0, ROOM.front);
  });
  // Floor and ceiling
  add(new THREE.ShapeGeometry(rect(ROOM.left, -ROOM.front, ROOM.right, -ROOM.back)), floorMat, (f) => { f.rotation.x = -Math.PI / 2; });
  add(new THREE.ShapeGeometry(rect(ROOM.left, ROOM.back, ROOM.right, ROOM.front)), ceilingMat, (c) => { c.rotation.x = Math.PI / 2; c.position.y = ROOM.height; });

  // Steel kick band round walls
  const band = (x0: number, x1: number, z0: number, z1: number) => add(new THREE.BoxGeometry(Math.max(0.1, x1 - x0), 0.6, Math.max(0.1, z1 - z0)), m.darkSteel, (b) => {
    b.position.set((x0 + x1) / 2, 0.3, (z0 + z1) / 2);
  });
  band(ROOM.left, ROOM.left + 0.1, ROOM.back, ROOM.front);
  band(ROOM.right - 0.1, ROOM.right, ROOM.back, ROOM.front);
  band(ROOM.left, ROOM.right, ROOM.back, ROOM.back + 0.1);
  band(ROOM.left, ROOM.right, ROOM.front - 0.1, ROOM.front);

  // Outer boundary colliders
  colliders.push(
    { min: [ROOM.left - 1, 0, ROOM.back - 1], max: [ROOM.left + 0.3, 9, ROOM.front + 1] },
    { min: [ROOM.right - 0.3, 0, ROOM.back - 1], max: [ROOM.right + 1, 9, ROOM.front + 1] },
    { min: [ROOM.left - 1, 0, ROOM.back - 1], max: [ROOM.right + 1, 9, ROOM.back + 0.3] },
    { min: [ROOM.left - 1, 0, ROOM.front - 0.3], max: [ROOM.right + 1, 9, ROOM.front + 1] },
  );

  // ---- The Observation Window: square steel frame with three square mullions
  const wx = (WINDOW.x0 + WINDOW.x1) / 2; // 0
  const wy = (WINDOW.y0 + WINDOW.y1) / 2; // 1.95
  const ww = WINDOW.x1 - WINDOW.x0; // 14.8
  const wh = WINDOW.y1 - WINDOW.y0; // 3.1

  // Outer square frame borders
  add(new THREE.BoxGeometry(ww + 0.28, 0.14, 0.32), m.gunmetal, (f) => { f.position.set(wx, WINDOW.y0 - 0.07, ROOM.back); }); // bottom sill
  add(new THREE.BoxGeometry(ww + 0.28, 0.14, 0.32), m.gunmetal, (f) => { f.position.set(wx, WINDOW.y1 + 0.07, ROOM.back); }); // top sill
  add(new THREE.BoxGeometry(0.14, wh + 0.28, 0.32), m.gunmetal, (f) => { f.position.set(WINDOW.x0 - 0.07, wy, ROOM.back); }); // left jamb
  add(new THREE.BoxGeometry(0.14, wh + 0.28, 0.32), m.gunmetal, (f) => { f.position.set(WINDOW.x1 + 0.07, wy, ROOM.back); }); // right jamb

  // Three square steel mullions dividing window into 4 bays (x = -3.7, 0, 3.7)
  for (const mx of [-ww / 4, 0, ww / 4]) {
    add(new THREE.BoxGeometry(0.14, wh, 0.3), m.gunmetal, (f) => { f.position.set(mx, wy, ROOM.back); });
  }

  // Void storm shader background quad (rain dropped per brief)
  const stormUniforms = { uTime: { value: 0 }, uStorm: { value: 0 } };
  const stormMat = keep(new THREE.ShaderMaterial({
    vertexShader: STORM_VERTEX,
    fragmentShader: STORM_FRAGMENT,
    uniforms: stormUniforms,
    toneMapped: false,
  }));
  add(new THREE.PlaneGeometry(50, 24), stormMat, (p) => { p.position.set(wx, wy + 2.0, ROOM.back - 8.0); });
  // Observation window glass
  add(new THREE.PlaneGeometry(ww, wh), m.glass, (p) => { p.position.set(wx, wy, ROOM.back + 0.02); });

  // ---- Helper to place props and register colliders
  const place = (p: Prop, x: number, z: number, yaw = 0, y = 0): Prop => {
    p.group.position.set(x, y, z);
    p.group.rotation.y = yaw;
    group.add(p.group);
    p.group.updateMatrixWorld(true);
    for (const b of p.colliders) {
      const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(p.group.matrixWorld);
      colliders.push({ min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] });
    }
    return p;
  };

  // ---- The Gate & Square Two-Step Plinth (walkable, 0.2m per step)
  // The decks are plain light-grey steel (sheet 21). The hazard is a band along each step's top edge only.
  const edgeBands = (size: number, topY: number): void => {
    const band = 0.22;
    const hz = 0.012;
    const half = size / 2;
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(size, hz, band), m.hazard, (b) => { b.position.set(GATE_AT.x, topY + hz / 2, GATE_AT.z + s * (half - band / 2)); });
      add(new THREE.BoxGeometry(band, hz, size - 2 * band), m.hazard, (b) => { b.position.set(GATE_AT.x + s * (half - band / 2), topY + hz / 2, GATE_AT.z); });
    }
  };
  // Step 1: 5 × 5 m, height = 0.2 m (y = 0 to 0.2)
  add(new THREE.BoxGeometry(5.0, 0.2, 5.0), m.paint, (p1) => { p1.position.set(GATE_AT.x, 0.1, GATE_AT.z); });
  edgeBands(5.0, 0.2);
  // Step 2: 4 × 4 m, height = 0.2 m (y = 0.2 to 0.4)
  add(new THREE.BoxGeometry(4.0, 0.2, 4.0), m.paint, (p2) => { p2.position.set(GATE_AT.x, 0.3, GATE_AT.z); });
  edgeBands(4.0, 0.4);

  const gate = kit.gate(m);
  place(gate, GATE_AT.x, GATE_AT.z, 0, 0.4);

  // Top lintel coil on gate beam
  const topCoilGeo = new THREE.BoxGeometry(1.6, 0.18, 0.22);
  const topCoilMat = keep(new THREE.MeshStandardMaterial({
    color: '#df8438', emissive: '#ff7700', emissiveIntensity: 0, roughness: 0.35, metalness: 0.8,
  }));
  const topCoilMesh = new THREE.Mesh(keep(topCoilGeo), topCoilMat);
  topCoilMesh.position.set(0, 3.25, 0.25);
  gate.group.add(topCoilMesh);
  gate.coils.push(topCoilMesh);

  // Portal surface in opening
  const portal = new THREE.Mesh(keep(new THREE.PlaneGeometry(gate.opening.width, gate.opening.height)), o.portalMaterial);
  portal.position.set(0, gate.opening.sill + gate.opening.height / 2, gate.opening.z);
  portal.visible = false;
  gate.group.add(portal);

  // Step colliders function for walking over the plinth
  const floorHeight = (x: number, z: number): number => {
    const dx = Math.abs(x - GATE_AT.x);
    const dz = Math.abs(z - GATE_AT.z);
    if (dx <= 2.0 && dz <= 2.0) return 0.4;
    if (dx <= 2.5 && dz <= 2.5) return 0.2;
    return 0;
  };

  // ---- West Wall: The Power Wall (panel 44, south to north)
  place(kit.capacitorBank(m), -7.2, 1.0, -Math.PI / 2);
  place(kit.breakerPanel(m), -7.4, -1.0, -Math.PI / 2);
  const relays = [-2.6, -3.5, -4.4, -5.3].map((z) => place(kit.relayCabinet(m), -7.6, z, -Math.PI / 2, 1.0));
  const boxes = [-6.1, -6.7].map((z) => place(kit.controlBox(m), -7.6, z, -Math.PI / 2, 1.4));
  const desk = consoleMillOperatorConsole(m);
  place(desk, -6.5, -7.8, -Math.PI / 2);

  // Square cable tray along west wall at y ≈ 4.2 m
  group.add(kit.cableTray(m, [-7.6, 1.2], [-7.6, -8.2], 4.2, ROOM.height).group);

  // Floor covers carrying power to gate plinth's west side
  const covers = [
    // Main feed from breaker/relays to plinth west side (-2.5, -1.0)
    kit.floorCover(m, [[-7.2, -1.0], [-2.5, -1.0]], 0.32),
    // Capacitor bank to breaker along west wall
    kit.floorCover(m, [[-7.2, 1.0], [-7.2, -1.0]], 0.28),
    // Operator console to relays along west wall
    kit.floorCover(m, [[-6.5, -7.8], [-7.2, -7.8], [-7.2, -5.3]], 0.25),
  ];
  for (const c of covers) group.add(c.group);

  const pulseUniforms = { uTime: { value: 0 }, uPower: { value: 0 } };
  const pulseMat = keep(new THREE.ShaderMaterial({
    uniforms: pulseUniforms, toneMapped: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uPower; varying vec2 vUv;
      void main(){
        float slots = step(0.35, fract(vUv.x * 5.0));
        float travel = pow(max(0.0, sin((vUv.x - uTime * 3.2) * 1.4)), 18.0);
        vec3 amber = vec3(1.0, 0.55, 0.12);
        gl_FragColor = vec4(amber * (0.06 + uPower * (0.35 + 2.2 * travel)) * slots, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  for (const c of covers) c.pulse.material = pulseMat;

  // ---- East Wall: The Studio Corner (panel 45, north to south)
  place(kit.presetRack(m), 7.5, -7.0, Math.PI / 2);
  place(kit.presetBench(m), 7.5, -5.0, Math.PI / 2);
  place(kit.presetCombiner(m), 7.5, -3.4, Math.PI / 2);
  const pTable = place(kit.planetTable(m), PLANET_TABLE_AT.x, PLANET_TABLE_AT.z, 0);
  const tableDisc = pTable.lamps[0];
  if (tableDisc) {
    tableDisc.material = keep(new THREE.MeshStandardMaterial({
      color: '#120c02',
      emissive: new THREE.Color('#ff7700'),
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0.3,
    }));
  }

  // ---- South-East: The Armory Nook (panel 46 left)
  // Armory rail on east wall at z ≈ 0.6 m, rail at about y ≈ 1.3 m
  const railGroup = new THREE.Group();
  const railBar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.06, 1.4)), m.gunmetal);
  railGroup.add(railBar);
  for (const rz of [-0.45, 0.45]) {
    const bracket = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.12, 0.04)), m.darkSteel);
    bracket.position.set(0.06, 0, rz);
    railGroup.add(bracket);
    const peg = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.04, 0.04)), m.gunmetal);
    peg.position.set(-0.06, 0.04, rz);
    railGroup.add(peg);
  }
  // Resting extraction tool (weapon-frame)
  const extractionTool = getGenSync('weapon-frame', genLevel);
  if (extractionTool) {
    extractionTool.scale.setScalar(0.75);
    extractionTool.position.set(-0.08, 0.06, 0);
    extractionTool.rotation.set(0, Math.PI / 2, Math.PI / 4);
    railGroup.add(extractionTool);
  } else {
    const mockTool = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.16, 0.55)), m.paint);
    mockTool.position.set(-0.08, 0.06, 0);
    railGroup.add(mockTool);
  }
  place({ group: railGroup, colliders: [{ min: [-0.2, -0.2, -0.75], max: [0.1, 0.2, 0.75] }], sockets: [], lamps: [] }, 7.75, 0.6, 0, 1.3);

  // Weapon bench against south wall at x ≈ 6.0
  const weaponBenchGen = createGenFixture('weapon-bench', genLevel);
  if (weaponBenchGen) {
    weaponBenchGen.group.position.set(6.0, 0, 2.4);
    weaponBenchGen.group.rotation.y = Math.PI;
    group.add(weaponBenchGen.group);
    colliders.push({ min: [4.8, 0, 2.0], max: [7.2, 1.6, 2.8] });
  } else {
    place(kit.presetBench(m), 6.0, 2.4, Math.PI);
  }

  // ---- South Wall: Her Corner (panel 46 right & panel 41)
  // Folding camp cot along south wall at (-2.5, 2.2)
  const cotGroup = new THREE.Group();
  const cotFrame = new THREE.Mesh(keep(new THREE.BoxGeometry(1.9, 0.35, 0.8)), m.darkSteel);
  cotFrame.position.y = 0.18;
  cotGroup.add(cotFrame);
  const cotPad = new THREE.Mesh(keep(new THREE.BoxGeometry(1.82, 0.10, 0.74)), m.rubber);
  cotPad.position.y = 0.40;
  cotGroup.add(cotPad);
  const cotPillow = new THREE.Mesh(keep(new THREE.BoxGeometry(0.35, 0.06, 0.62)), m.paint);
  cotPillow.position.set(-0.7, 0.46, 0);
  cotGroup.add(cotPillow);
  const cotBlanket = new THREE.Mesh(keep(new THREE.BoxGeometry(0.65, 0.08, 0.74)), m.gunmetal);
  cotBlanket.position.set(0.55, 0.46, 0);
  cotGroup.add(cotBlanket);
  place({ group: cotGroup, colliders: [{ min: [-1.0, 0, -0.45], max: [1.0, 0.6, 0.45] }], sockets: [], lamps: [] }, -2.5, 2.2, 0);

  // Her desk at (1.0, 2.4), facing into room (Math.PI)
  const deskGroup = new THREE.Group();
  const deskBody = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.72, 0.68)), m.paint);
  deskBody.position.y = 0.36;
  deskGroup.add(deskBody);
  const deskTop = new THREE.Mesh(keep(new THREE.BoxGeometry(1.46, 0.05, 0.74)), m.gunmetal);
  deskTop.position.y = 0.74;
  deskGroup.add(deskTop);
  // Stacked paper notes on desk
  const pStack1 = new THREE.Mesh(keep(new THREE.BoxGeometry(0.24, 0.03, 0.30)), m.paint);
  pStack1.position.set(-0.25, 0.78, 0.05);
  deskGroup.add(pStack1);
  const pStack2 = new THREE.Mesh(keep(new THREE.BoxGeometry(0.22, 0.02, 0.28)), m.paint);
  pStack2.position.set(-0.24, 0.81, 0.06);
  pStack2.rotation.y = 0.12;
  deskGroup.add(pStack2);
  // Coffee mug (tiny low-sided cylinder)
  const mug = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12)), m.darkSteel);
  mug.position.set(0.15, 0.80, -0.15);
  deskGroup.add(mug);
  // Small desk terminal screen
  const dTerm = new THREE.Mesh(keep(new THREE.BoxGeometry(0.28, 0.22, 0.18)), m.darkSteel);
  dTerm.position.set(0.42, 0.87, 0.12);
  dTerm.rotation.y = -0.25;
  deskGroup.add(dTerm);
  const dScreen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.22, 0.16)), keep(new THREE.MeshStandardMaterial({
    color: '#0a1a0f', emissive: '#22cc44', emissiveIntensity: 0.6, roughness: 0.4,
  })));
  dScreen.position.set(0.42, 0.87, 0.215);
  dScreen.rotation.y = -0.25;
  deskGroup.add(dScreen);
  place({ group: deskGroup, colliders: [{ min: [-0.75, 0, -0.4], max: [0.75, 1.0, 0.4] }], sockets: [], lamps: [] }, 1.0, 2.4, Math.PI);

  // Inset wall radio in south wall beside desk at about 1.4 m
  const radioGroup = new THREE.Group();
  const radioBox = new THREE.Mesh(keep(new THREE.BoxGeometry(0.48, 0.34, 0.12)), m.gunmetal);
  radioGroup.add(radioBox);
  const radioGrille = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.28, 0.22)), m.darkSteel);
  radioGrille.position.set(-0.06, 0, 0.065);
  radioGroup.add(radioGrille);
  const radioLamp = new THREE.Mesh(keep(new THREE.BoxGeometry(0.04, 0.04, 0.02)), keep(new THREE.MeshStandardMaterial({
    color: '#331a08', emissive: '#ff7700', emissiveIntensity: 1.2,
  })));
  radioLamp.position.set(0.14, 0.06, 0.065);
  radioGroup.add(radioLamp);
  radioGroup.position.set(2.2, 1.4, 2.92);
  radioGroup.rotation.y = Math.PI;
  group.add(radioGroup);

  // Scientific charts taped on wall above desk
  const chartTex = keep(createChartTexture());
  const chartMat = keep(new THREE.MeshStandardMaterial({
    map: chartTex, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide,
  }));
  for (const [cx, cy, cw, ch] of [[0.6, 1.9, 0.65, 0.48], [1.4, 1.85, 0.55, 0.42], [0.95, 2.45, 0.72, 0.52]] as const) {
    const chartQuad = new THREE.Mesh(keep(new THREE.PlaneGeometry(cw, ch)), chartMat);
    chartQuad.position.set(cx, cy, 2.98);
    chartQuad.rotation.y = Math.PI;
    group.add(chartQuad);
  }

  // ---- Light: ceiling strips, one main lamp, emergency amber lamps, gate glow, window light
  const stripMat = keep(new THREE.MeshStandardMaterial({ color: '#202428', emissive: '#eef6ff', emissiveIntensity: 0, roughness: 0.4 }));
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    add(new THREE.BoxGeometry(0.24, 0.06, depth - 2.5), stripMat, (s) => {
      s.position.set(x, ROOM.height - 0.04, (ROOM.back + ROOM.front) / 2);
    });
  }
  // One main lamp standing in for ceiling strips
  const mainLamp = new THREE.PointLight('#e6f2ff', 0, 24, 1.8);
  mainLamp.position.set(0, ROOM.height - 0.6, -2.0);
  group.add(mainLamp);

  // Orange emergency lamps
  const emergencyMat = keep(new THREE.MeshStandardMaterial({ color: '#331a08', emissive: '#ff7a1c', emissiveIntensity: 0, roughness: 0.4 }));
  for (const [x, z, face] of [[-7.9, -3.0, Math.PI / 2], [7.9, -1.0, -Math.PI / 2], [0, 2.92, Math.PI]] as const) {
    add(new THREE.BoxGeometry(0.18, 0.12, 0.1), emergencyMat, (e) => {
      e.position.set(x, 4.4, z); e.rotation.y = face;
    });
  }
  const emergency = new THREE.PointLight('#ff8a3a', 0, 22, 1.6);
  emergency.position.set(0, 4.4, 0);
  group.add(emergency);

  // Gate glow
  const gateGlow = new THREE.PointLight('#ff9a4a', 0, 10, 1.8);
  gateGlow.position.set(GATE_AT.x, 1.8, GATE_AT.z + 0.6);
  group.add(gateGlow);

  // Window storm light (brightest feature in Act I dark)
  const windowLight = new THREE.PointLight('#9fb6cc', 3.5, 16, 1.8);
  windowLight.position.set(wx, wy + 0.4, ROOM.back + 1.2);
  group.add(windowLight);

  const fill = new THREE.HemisphereLight('#d8e2ea', '#2a2e33', 0.10);
  group.add(fill);

  // Power state handlers
  const lamps = {
    relays: relays.flatMap((r) => r.lamps),
    boxes: boxes.flatMap((b) => b.lamps),
    desk: desk.lamps,
  };

  const setPower = (p: Power): void => {
    lamps.relays.forEach((l, i) => kit.setLamp(l, p.relays * lamps.relays.length > i ? 1 : 0));
    lamps.boxes.forEach((l) => kit.setLamp(l, p.relays > 0.5 ? 1 : 0));
    lamps.desk.forEach((l) => kit.setLamp(l, 1));
    gate.coils.forEach((c, i) => kit.setLamp(c, p.coils * gate.coils.length > i ? 1 : 0));

    if (tableDisc && tableDisc.material instanceof THREE.MeshStandardMaterial) {
      tableDisc.material.emissiveIntensity = p.main * 0.22;
    }
    pTable.lamps.slice(1).forEach((l) => kit.setLamp(l, p.main > 0.5 ? 1 : 0));

    pulseUniforms.uPower.value = p.pulse;
    stripMat.emissiveIntensity = p.main * 2.2;
    mainLamp.intensity = p.main * 18;
    fill.intensity = 0.10 + p.main * 0.25;
    emergencyMat.emissiveIntensity = p.emergency * 2.4;
    emergency.intensity = p.emergency * 22;
    gateGlow.intensity = p.coils * 12;
    portal.visible = p.coils > 0.6;
  };
  setPower(POWER_OFF);

  const setStorm = (progress: number): void => {
    stormUniforms.uStorm.value = Math.max(0, Math.min(1, progress));
  };
  setStorm(0);

  return {
    envLevel: () => 0.03 + (stripMat.emissiveIntensity / 2.2) * 0.2,
    group,
    colliders,
    gate,
    portal,
    leverAt: desk.lever.getWorldPosition(new THREE.Vector3()),
    lever: desk.lever,
    spawn: { x: -2.5, z: 1.0, yaw: 0 }, // beside the cot, facing north toward gate & storm
    setPower,
    setStorm,
    floorHeight,
    update(now) {
      pulseUniforms.uTime.value = now;
      stormUniforms.uTime.value = now;
    },
    dispose() {
      for (const x of owned) x.dispose();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
        }
      });
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
    },
  };
}
