import { armoryRack, shouldShowAmmoBadge, ARMORY_RAIL_POS, ARMORY_PICKUP_REACH, SIDEARM_ITEM_ID, type ArmoryRackResult } from './armory-rack';
export { armoryRack, shouldShowAmmoBadge, ARMORY_RAIL_POS, ARMORY_PICKUP_REACH, SIDEARM_ITEM_ID, type ArmoryRackResult };
import {
  aimLabStation,
  buildCableDrop,
  buildConsoleLeverQuadrant,
  buildGateRibbedCoils,
  buildHardwareFabricatorProp,
  buildRelayBeaconHousing,
  buildRibbedFloorCoverTreads,
  createRightWallMachineRig,
  LAB_STATIONS,
  mergeStaticMeshes,
  nearestLabStation,
  POWER_WALL_SHEET07_ORDER,
  RIGHT_WALL_MACHINES,
  stationById,
  type LabMachineRig,
  type LabStationId,
  type LabStationSpec,
  type RightWallMachineId,
} from './lab-machines';
import { applyMonitorEqualizerNearShotFix } from './window-g-final-qa-hooks';
import { maxRank, type Tier } from '@hm/kitspec';
import { buildKitPreset } from './kit-build';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';
export {
  aimLabStation,
  LAB_STATIONS,
  nearestLabStation,
  RIGHT_WALL_MACHINES,
  stationById,
  type LabStationId,
  type LabStationSpec,
  type RightWallMachineId,
};

// The lab you play in (SETMIX_PLAN Phase 2b / Sheet 21 AAA Rebuild / TICKET-06 Overhaul):
// A 16 × 12 × 5 m quantum-shielded white-room laboratory on Earth.
// - North wall: wide observation window (14.8 × 3.1 m) framing the void storm as progress (setStorm).
// - Centre: the gate standing free on a walkable square two-step plinth, opening facing the window.
// - West wall (The Power Wall): capacitor bank, breaker panel (the isolator and three sub-breakers), 4 grounded relay cabinets,
//   2 control boxes, the operator console (its throw lever and keypad).
// - East wall (Studio & Fabrication Bay): 4 distinct, grounded, cabled, E-interactable machines (Preset Rack, Preset Bench,
//   Preset Combiner, Hardware Fabricator) plus the Planet Table carrying PlotHolo.
// - South-east (The Armory): armory rail with extraction tool (weapon-frame), sidearm rack, and weapon bench.
// - South wall (Her Corner): folding camp cot, her desk with notes and mug, inset wall radio, charts taped on wall.
// - Spawn: beside the cot facing north toward the gate and storm.
// Lab frame: x right (+x), y up (+y), z towards start (+z), north = -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { floorTextures, panelTextures } from '../lab/lab-scene';
import * as kit from '@hm/labkit';
import type { Box, Prop } from '@hm/labkit';
import { operatorConsole as consoleMillOperatorConsole } from '@hm/consolemill';
import { type GenLevel, genLevelFor, getGenSync, loadGen } from '../assets/gen';
import { createLabVista, VISTA_LEVEL, vistaHdModelsMissing, type LabVista, type WindowView } from './lab-vista';
import { CLUTTER, CLUTTER_MODELS, type ClutterItem } from './lab-clutter';
import { createMonitorEqualizer3D, isMonitorOverclockedPlaying, type MonitorEqualizer3D } from '../credits/monitor-jukebox';
import { createPlanetTableHologram, type PlanetTableHologram3D, type FourFloats } from './planet-table-hologram';
import { coilLevels, darkStrobe, POWER_OFF, strobeSweepZ, type Power } from './lab-power';
import { overhangBoxes, type Bounds3D } from './static-colliders';
export {
  coilLevels,
  coilsLitAt,
  GATE_COIL_COUNT,
  IGNITION,
  IGNITION_SECONDS,
  POWER_OFF,
  POWER_ON,
  POWER_SECONDS,
  powerAt,
  type Power,
} from './lab-power';

export const ROOM = { left: -8, right: 8, back: -9, front: 3, height: 5 } as const;
/** The spot the lab's spawn stands on (-2.5, 1.0) and its walk toward the gate: the LAB-10 overhang fit never closes it. */
const SPAWN_CLEAR: Bounds3D = { minX: -3.1, maxX: -1.9, minY: 0, maxY: 3, minZ: 0.4, maxZ: 1.6 };
const WINDOW = { x0: -7.4, x1: 7.4, y0: 0.4, y1: 3.5 } as const;

/** Where the gate stands and which way its opening faces (north, towards the window). */
export const GATE_AT = { x: 0, z: -1.0 } as const;
export const PLANET_TABLE_AT = { x: 5.0, z: -5.0 } as const;

/** The generated gate's doorway (gate.glb, measured in its frame): the portal and the walk-through use it. */
const GEN_GATE_OPENING = { width: 2.0, height: 2.2, sill: 0.33, z: 0 } as const;
/** The labkit props on the west and east walls face the wall in the lab frame; their generated models turn half a turn to face the room. */
const WEST_WALL_TURN = Math.PI;
/** The operator console's throw lever: the bottom of its axle block, in the slot of the guide box on the deck (sheet 07, measured). */
const LEVER_AT: readonly [number, number, number] = [0.336, 0.826, 0.203];
/**
 * The lever's own tilt at rest, about X (radians): it leans slightly toward the operator, so a throw sweeps it back along the slot.
 * The play scene throws the pivot by LEVER_THROW (1.1 rad); the H-slot in the guide box is only 0.18 m long, so the lever travels
 * LEVER_TRAVEL (0.25 rad, about 0.08 m along the slot) for that throw. Without the scale the grip would leave the slot.
 */
// POL-121: Rest tilt +0.42 rad and travel 0.95 rad so OFF -> ON sweeps ~54 deg inside its quadrant slot
const LEVER_REST_TILT = 0.42;
const LEVER_THROW = 1.1;
export const LEVER_TRAVEL = 0.95;
/** The breaker panel's isolator spindle, on the hazard plate's knob, in the panel's frame (sheet 07, measured on the packed model). */
const ISOLATOR_AT: readonly [number, number, number] = [0.262, 1.12, 0.32];
/** The handle's hub centre sits 0.072 m to the left of its origin: the handle is turned to stand on the spindle, with the hub centred on it. */
const ISOLATOR_HUB_X = 0.072;
/** The three sub-breaker sockets' floors, in the panel's frame (the middle left, sheet 07). Each toggle's collar stands on its floor. */
const TOGGLE_SOCKETS: readonly (readonly [number, number, number])[] = [
  [-0.355, 1.443, 0.234],
  [-0.258, 1.443, 0.234],
  [-0.161, 1.443, 0.234],
];
/** The keypad's pocket floor centre in the console's frame, and the hood's tilt about X (the hood leans back 20 degrees). */
const KEYPAD_AT: readonly [number, number, number] = [0.405, 1.093, -0.109];
const HOOD_TILT = -0.356;
/** A sub-breaker's bat, tipped down (off) and up (on), in radians about X. */
const TOGGLE_TIP = 0.5;

/** Eased 0..1 from `a` to `b` (smoothstep), for the breaker's switching as the relays click on. */
function easeBetween(x: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/**
 * The breaker panel's switching, as the relay sweep runs (`relays` 0..1, lab-power.ts): the three sub-breakers flip one after
 * another (0.05 to 0.48), then the isolator turns from off (-90 degrees) to on (0) between 0.5 and 0.9.
 */
function breakerToggleAngle(relays: number, i: number): number {
  const start = 0.05 + 0.14 * i;
  return TOGGLE_TIP * (1 - 2 * easeBetween(relays, start, start + 0.15));
}
function isolatorAngle(relays: number): number {
  return -Math.PI / 2 * (1 - easeBetween(relays, 0.5, 0.9));
}

const PANEL_TILE = 5.12, FLOOR_TILE = 4;

/** The weapon bench's own set (TASK-23c): the jig and printer rest on its top, the tool wall hangs on the wall behind it. */
export const WEAPON_BENCH_SET: readonly string[] = [
  'bench-jig', 'bench-printer', 'tool-wall', 'tool-drill', 'tool-wrench', 'tool-mallet', 'tool-scanner', 'tool-screwdriver',
];

export const LAB_GEN_ASSETS: readonly string[] = [
  'gate', 'capacitor-can', 'breaker-panel', 'breaker-handle', 'relay-cabinet', 'control-box', 'operator-console', 'console-lever',
  'preset-rack', 'preset-bench', 'preset-combiner', 'planet-table', 'her-desk', 'cot', 'wall-radio', 'armory-rail', 'weapon-bench', 'weapon-frame',
  ...WEAPON_BENCH_SET, ...CLUTTER_MODELS,
];

/** The dissolve of a cleared salvage prop, seconds. */
const DISSOLVE_SECONDS = 0.9;

/** Loads the lab's generated models at a level, behind the caller's loading bar. A model that fails stays on its labkit fallback. */
export async function preloadLabGenerated(level: GenLevel): Promise<void> {
  await Promise.all(LAB_GEN_ASSETS.map((id) => loadGen(id, level).catch((err) => {
    console.warn(`Lab piece ${id} stays on its fallback:`, err);
    return null;
  })));
}

/** A small emissive lamp on a generated model's face (the power sequence drives its emissive intensity, as on labkit lamps). */
function lampOverlay(color: string, x: number, y: number, z: number, size: readonly [number, number, number] = [0.034, 0.034, 0.012]): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color: '#17110a', emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.35 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Builds a subdivided wall or floor PlaneGeometry whose origin is at `(x0, y0)` and whose UVs are
 * explicitly scaled in world metres (`u = x / tileM`, `v = y / tileM`). Prevents grazing-angle
 * normal-map / mipmap UV smudges on long walls (TICKET-06 LAB-03 fix).
 */
function createTiledSurfaceGeometry(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  segsX: number,
  segsY: number,
  tileM: number,
): THREE.BufferGeometry {
  const w = x1 - x0;
  const h = y1 - y0;
  const geo = new THREE.PlaneGeometry(w, h, Math.max(1, segsX), Math.max(1, segsY));
  geo.translate(x0 + w / 2, y0 + h / 2, 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (pos && uv && ArrayBuffer.isView(uv.array)) {
    const arr = uv.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      arr[i * 2] = pos.getX(i) / tileM;
      arr[i * 2 + 1] = pos.getY(i) / tileM;
    }
    uv.needsUpdate = true;
  }
  return geo;
}

/** A clutter prop in the lab: its entry, the disc of its dissolve, and the walls it adds (removed with it). */
interface ClutterEntry {
  readonly item: ClutterItem;
  readonly prop: Prop;
  readonly disc: THREE.Mesh;
  readonly boxes: Box[];
  state: 'standing' | 'dissolving' | 'gone';
  t: number;
}

/**
 * Rests a loaded model on a surface (TASK-23c): turns it to `yaw`, centres it on (x, z), and sets its lowest point on the surface.
 */
function restOn(obj: THREE.Object3D, x: number, z: number, yaw: number, surfaceAt: (x: number, z: number) => number): void {
  obj.rotation.set(0, yaw, 0);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  const ox = x - c.x, oz = z - c.z;
  const surface = Math.max(...[b.min.x, b.max.x].flatMap((px) => [b.min.z, b.max.z].map((pz) => surfaceAt(px + ox, pz + oz))));
  obj.position.set(ox, surface - b.min.y, oz);
}

/** Grounds a swapped generated model so its lowest bounding-box point sits at `baseY` (default 0, never floating). */
function groundModelAt(obj: THREE.Object3D, baseY = 0): void {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  if (!b.isEmpty() && Number.isFinite(b.min.y)) {
    obj.position.y += baseY - b.min.y;
  }
}

/** Hangs a model on a flat panel (TASK-23c): its back on the panel's front face, with a small gap, centred on (x, y). */
function hangOn(obj: THREE.Object3D, panelFrontZ: number, x: number, y: number, tiltX = 0): void {
  obj.rotation.set(tiltX, 0, 0);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.set(x - c.x, y - c.y, panelFrontZ + 0.011 - b.min.z);
}

/** The weapon bench's set (TASK-23c). */
function dressWeaponBench(bench: THREE.Group, parts: readonly THREE.Group[]): void {
  const [jig, printer, wall, drill, wrench, mallet, scanner, screwdriver] = parts as unknown as [THREE.Group, THREE.Group, THREE.Group, THREE.Group, THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  const model = bench.children[0] ?? bench;
  const topAt = (x: number, z: number): number => {
    bench.updateMatrixWorld(true);
    const from = bench.localToWorld(new THREE.Vector3(x, 5, z));
    const hit = new THREE.Raycaster(from, new THREE.Vector3(0, -1, 0), 0, 10).intersectObject(model, true)[0];
    return hit ? bench.worldToLocal(hit.point.clone()).y : 1.05;
  };
  restOn(jig, 0, 0, 0, topAt);
  restOn(printer, -0.75, 0, 0, topAt);
  restOn(mallet, 0.42, -0.12, 0.25, topAt);
  restOn(wrench, 0.72, 0.15, -0.1, topAt);
  bench.add(jig, printer, mallet, wrench);
  const panelBox = new THREE.Box3().setFromObject(wall);
  const wallGroup = new THREE.Group();
  wallGroup.position.set(6.0, 1.35, 2.99 + panelBox.min.z);
  wallGroup.rotation.y = Math.PI;
  wallGroup.add(wall);
  wall.position.set(0, 0, 0);
  const front = panelBox.max.z;
  hangOn(drill, front, -0.42, 0.62);
  hangOn(scanner, front, 0.0, 0.66);
  hangOn(screwdriver, front, 0.42, 0.6, Math.PI / 2);
  wallGroup.add(drill, scanner, screwdriver);
  bench.parent?.add(wallGroup);
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
      let r = 237, g = 233, b = 225;
      if (x % 16 === 0 || y % 16 === 0) {
        r = 215; g = 210; b = 200;
      }
      const targetY1 = Math.floor(96 + 18 * Math.sin(x * 0.1));
      if (Math.abs(y - targetY1) <= 1) {
        r = 45; g = 110; b = 180;
      }
      const pulseBlock = Math.floor(x / 20) % 2;
      const targetY2 = pulseBlock === 0 ? 50 : 66;
      if (y === targetY2 || (x % 20 === 0 && y >= 50 && y <= 66)) {
        r = 190; g = 75; b = 40;
      }
      const barCol = Math.floor(x / 14);
      const inBar = (x % 14) >= 3 && (x % 14) <= 11;
      const barHeight = 12 + ((barCol * 7 + 5) % 22);
      if (inBar && y >= 12 && y <= barHeight) {
        r = 70; g = 80; b = 90;
      }
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
  /** All E-interactable Lab stations (the 4 right-wall machines + Planet Table + Weapon Bench). */
  readonly stations: readonly LabStationSpec[];
  /** Finds the Lab station aimed at by `(origin, dir)` within `reach` metres, or null. */
  aimStation(origin: THREE.Vector3, dir: THREE.Vector3, reach?: number): LabStationSpec | null;
  /** Finds the nearest Lab station within reach of `(x, z)`, or null. */
  nearestStation(pos: { readonly x: number; readonly z: number }, maxReach?: number): LabStationSpec | null;
  setPower(p: Power): void;
  /** The power as it was last set. */
  power(): Power;
  /** Which gate coils are lit, bottom to top. */
  coilsLit(): boolean[];
  /** Puts the generated models in place of the labkit fallbacks for every piece that is loaded now (call again after a preload). */
  adoptGenerated(): void;
  /** The storm as progress 0 to 1 (the flat picture in Static; the vista's progress in Full and Lite). */
  setStorm(progress: number): void;
  /** POL-302: sets the old monitor equaliser active or direct bar levels. */
  setMonitorEqualizer(bars?: readonly number[] | boolean): void;
  /** What the window shows (plan §9: Full, Lite or Static). */
  setWindowView(view: WindowView): void;
  /** Shows the flat storm plane in the window's opening whatever the view (the planet seen through the gate: no hole, R8). */
  setPlaneFallback(on: boolean): void;
  /** POL-70: 3D Planet Table Hologram instance. */
  readonly hologram: PlanetTableHologram3D;
  setFloats(floats: FourFloats): void;
  setConsensusCommitted(committed: boolean): void;
  /** POL-141: Gate a right-wall Lab station's 3D pixel plume on whether it is actively operating. */
  setStationOperating(id: RightWallMachineId | LabStationId | 'rack' | 'bench' | 'combiner', on: boolean): void;
  /** The lab clutter (TASK-23c): the prop the ray meets within `reach` metres (a fixture or a salvage prop), or null. Lab metres. */
  aimClutter(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): string | null;
  /** Starts a salvage prop's dissolve (about a second; it then leaves the lab). False for a fixture or a prop that is not standing. */
  dissolveClutter(id: string): boolean;
  /** Takes away the props cleared in an earlier visit, at once (no dissolve). */
  removeClutter(ids: readonly string[]): void;
  /** The view through the window: the 3D wasteland (drawn by the play scene before the lab, see lab-vista.ts). */
  readonly vista: LabVista;
  floorHeight(x: number, z: number): number;
  update(now: number, dt: number): void;
  /** The South-East armory rack (sidearm holster and cradle). */
  readonly armory: ArmoryRackResult;
  dispose(): void;
}

export function createLabRoom(o: {
  readonly textureSize: number;
  readonly portalMaterial: THREE.Material;
  readonly quality?: 'low' | 'medium' | 'high' | string;
  /** The window's view (the Graphics setting): full by default. */
  readonly windowView?: WindowView;
}): LabRoom {
  const genLevel: GenLevel = genLevelFor(o.quality ?? 'high');
  const group = new THREE.Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
  const m = kit.createMaterials();
  const colliders: Box[] = [];

  let swaps: (() => boolean)[] = [];
  let lastPower: Power = POWER_OFF;
  const genFor = (id: string): THREE.Group | null => getGenSync(id, genLevel);
  const genAll = (ids: readonly string[]): THREE.Group[] | null => {
    const out: THREE.Group[] = [];
    for (const id of ids) {
      const g = genFor(id);
      if (!g) return null;
      out.push(g);
    }
    return out;
  };
  /** Replaces a group's visual children with a generated model, keeping the children listed. */
  const replaceVisual = (targetGroup: THREE.Object3D, gen: THREE.Object3D, kept: readonly THREE.Object3D[] = []): void => {
    for (const child of [...targetGroup.children]) {
      if (!kept.includes(child)) {
        child.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
        });
        targetGroup.remove(child);
      }
    }
    targetGroup.add(gen);
  };
  /** LAB-10: overhang collider fit. */
  const fitOverhang = (p: { readonly group: THREE.Group; readonly colliders?: readonly Box[] }, keepClear: readonly Bounds3D[] = []): void => {
    if (!p.colliders) return;
    p.group.updateMatrixWorld(true);
    const vis = new THREE.Box3().setFromObject(p.group);
    if (vis.isEmpty()) return;
    const own = p.colliders.map((b) => {
      const bx = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(p.group.matrixWorld);
      return { minX: bx.min.x, minY: bx.min.y, minZ: bx.min.z, maxX: bx.max.x, maxY: bx.max.y, maxZ: bx.max.z };
    });
    const visible = { minX: vis.min.x, minY: vis.min.y, minZ: vis.min.z, maxX: vis.max.x, maxY: vis.max.y, maxZ: vis.max.z };
    colliders.push(...overhangBoxes(visible, own, [...keepClear, SPAWN_CLEAR], 0.1));
  };
  /** Swaps labkit props for their generated models, grounding each model at y = 0 and keeping any preserved children. */
  const swapAll = (
    items: readonly {
      readonly p: { readonly group: THREE.Group; readonly colliders?: readonly Box[] };
      readonly id: string;
      readonly turn?: number;
      readonly kept?: readonly THREE.Object3D[];
      readonly ground?: boolean;
    }[],
  ): boolean => {
    const gens = genAll(items.map((it) => it.id));
    if (!gens) return false;
    items.forEach((it, i) => {
      const g = gens[i]!;
      g.rotation.y = it.turn ?? 0;
      if (it.ground !== false) {
        groundModelAt(g, 0);
      }
      // POL-104 & POL-105: Merge static meshes inside swapped generated GLBs by material so Lab stays well under 185 draw calls
      mergeStaticMeshes(g, it.kept ?? [], keep);
      replaceVisual(it.p.group, g, it.kept ?? []);
      fitOverhang(it.p);
    });
    return true;
  };
  const lamp = (color: string, x: number, y: number, z: number, size?: readonly [number, number, number]): THREE.Mesh => {
    const mesh = lampOverlay(color, x, y, z, size);
    keep(mesh.material as THREE.Material);
    keep(mesh.geometry);
    return mesh;
  };

  // ---- The Shell (16 × 12 × 5 m)
  const panels = panelTextures(o.textureSize), floorTex = floorTextures(o.textureSize);
  // Keep texture repeat at (1, 1) for subdivided tiled surfaces; ShapeGeometry for north window wall uses explicit UV scaling
  for (const t of [panels.map, panels.roughnessMap, panels.normalMap]) { keep(t); t.repeat.set(1, 1); }
  for (const t of [floorTex.map, floorTex.roughnessMap, floorTex.normalMap]) { keep(t); t.repeat.set(1, 1); }
  const wallMat = keep(new THREE.MeshStandardMaterial({ ...panels, normalScale: new THREE.Vector2(0.55, 0.55), metalness: 0 }));
  const floorMat = keep(new THREE.MeshStandardMaterial({ ...floorTex, normalScale: new THREE.Vector2(0.45, 0.45), metalness: 0 }));
  // TICKET-06 LAB-02 fix: architectural acoustic-steel ceiling panel material (never a pitch-black void)
  const ceilingMat = keep(new THREE.MeshStandardMaterial({
    color: '#5a6470',
    roughness: 0.72,
    metalness: 0.16,
    side: THREE.DoubleSide,
  }));
  const rect = (x0: number, y0: number, x1: number, y1: number): THREE.Shape =>
    new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  // The shell (walls, floor, ceiling, beams, panels) is one group, merged per material before the room returns (TICKET-06 draw-call budget)
  const shell = new THREE.Group();
  shell.name = 'lab-shell';
  group.add(shell);
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, f: (mesh: THREE.Mesh) => void = () => undefined): THREE.Mesh => {
    const mesh = new THREE.Mesh(keep(g), mat); f(mesh); shell.add(mesh); return mesh;
  };

  const depth = ROOM.front - ROOM.back; // 12 m
  const width = ROOM.right - ROOM.left; // 16 m

  // North wall with observation window cutout (scale ShapeGeometry UVs by 1 / PANEL_TILE directly)
  const back = rect(ROOM.left, 0, ROOM.right, ROOM.height);
  back.holes.push(new THREE.Path([
    new THREE.Vector2(WINDOW.x0, WINDOW.y0),
    new THREE.Vector2(WINDOW.x1, WINDOW.y0),
    new THREE.Vector2(WINDOW.x1, WINDOW.y1),
    new THREE.Vector2(WINDOW.x0, WINDOW.y1),
  ]));
  const backGeo = new THREE.ShapeGeometry(back);
  {
    const uv = backGeo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (uv && ArrayBuffer.isView(uv.array)) {
      const arr = uv.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] ?? 0) / PANEL_TILE;
      uv.needsUpdate = true;
    }
  }
  add(backGeo, wallMat, (w) => { w.position.z = ROOM.back; });

  // Subdivided West wall (Power Wall, x = -8) — eliminates grazing-angle stretched UV smudge (LAB-03)
  add(createTiledSurfaceGeometry(0, 0, depth, ROOM.height, 12, 5, PANEL_TILE), wallMat, (w) => {
    w.rotation.y = Math.PI / 2; w.position.set(ROOM.left, 0, ROOM.front);
  });
  // Subdivided East wall (Studio / Armory wall, x = 8)
  add(createTiledSurfaceGeometry(0, 0, depth, ROOM.height, 12, 5, PANEL_TILE), wallMat, (w) => {
    w.rotation.y = -Math.PI / 2; w.position.set(ROOM.right, 0, ROOM.back);
  });
  // Subdivided South wall (Her corner, z = 3)
  add(createTiledSurfaceGeometry(0, 0, width, ROOM.height, 16, 5, PANEL_TILE), wallMat, (w) => {
    w.rotation.y = Math.PI; w.position.set(ROOM.right, 0, ROOM.front);
  });
  // Subdivided Floor and Ceiling
  add(createTiledSurfaceGeometry(ROOM.left, -ROOM.front, ROOM.right, -ROOM.back, 16, 12, FLOOR_TILE), floorMat, (f) => {
    f.rotation.x = -Math.PI / 2;
  });
  add(createTiledSurfaceGeometry(ROOM.left, ROOM.back, ROOM.right, ROOM.front, 8, 6, PANEL_TILE), ceilingMat, (c) => {
    c.rotation.x = Math.PI / 2; c.position.y = ROOM.height;
  });

  // Structural steel ceiling cross-beams spanning x = -8..8 (frames the 3 strip banks cleanly, LAB-02)
  for (const bz of [-7.8, -4.6, -1.4, 1.8]) {
    add(new THREE.BoxGeometry(width, 0.12, 0.18), m.gunmetal, (b) => {
      b.position.set(0, ROOM.height - 0.06, bz);
    });
  }

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

  add(new THREE.BoxGeometry(ww + 0.28, 0.14, 0.32), m.gunmetal, (f) => { f.position.set(wx, WINDOW.y0 - 0.07, ROOM.back); });
  add(new THREE.BoxGeometry(ww + 0.28, 0.14, 0.32), m.gunmetal, (f) => { f.position.set(wx, WINDOW.y1 + 0.07, ROOM.back); });
  add(new THREE.BoxGeometry(0.14, wh + 0.28, 0.32), m.gunmetal, (f) => { f.position.set(WINDOW.x0 - 0.07, wy, ROOM.back); });
  add(new THREE.BoxGeometry(0.14, wh + 0.28, 0.32), m.gunmetal, (f) => { f.position.set(WINDOW.x1 + 0.07, wy, ROOM.back); });

  for (const mx of [-ww / 4, 0, ww / 4]) {
    add(new THREE.BoxGeometry(0.14, wh, 0.3), m.gunmetal, (f) => { f.position.set(mx, wy, ROOM.back); });
  }

  // Void storm shader background quad (only visible in Static view or planeFallback)
  const stormUniforms = { uTime: { value: 0 }, uStorm: { value: 0 } };
  const stormMat = keep(new THREE.ShaderMaterial({
    vertexShader: STORM_VERTEX,
    fragmentShader: STORM_FRAGMENT,
    uniforms: stormUniforms,
    toneMapped: false,
  }));
  const stormPlane = add(new THREE.PlaneGeometry(50, 24), stormMat, (p) => { p.position.set(wx, wy + 2.0, ROOM.back - 8.0); });
  const vista = createLabVista({
    view: o.windowView ?? 'full',
    window: { x0: WINDOW.x0, x1: WINDOW.x1, y0: WINDOW.y0, y1: WINDOW.y1, z: ROOM.back },
    level: VISTA_LEVEL,
  });
  stormPlane.visible = vista.view === 'static';
  const windowGlass = keep(m.glass.clone());
  windowGlass.opacity = 0.08;
  add(new THREE.PlaneGeometry(ww, wh), windowGlass, (p) => { p.position.set(wx, wy, ROOM.back + 0.02); });

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
  const edgeBands = (size: number, topY: number): void => {
    const bnd = 0.22;
    const hz = 0.012;
    const half = size / 2;
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(size, hz, bnd), m.hazard, (b) => { b.position.set(GATE_AT.x, topY + hz / 2, GATE_AT.z + s * (half - bnd / 2)); });
      add(new THREE.BoxGeometry(bnd, hz, size - 2 * bnd), m.hazard, (b) => { b.position.set(GATE_AT.x + s * (half - bnd / 2), topY + hz / 2, GATE_AT.z); });
    }
  };
  add(new THREE.BoxGeometry(5.0, 0.2, 5.0), m.paint, (p1) => { p1.position.set(GATE_AT.x, 0.1, GATE_AT.z); });
  edgeBands(5.0, 0.2);
  add(new THREE.BoxGeometry(4.0, 0.2, 4.0), m.paint, (p2) => { p2.position.set(GATE_AT.x, 0.3, GATE_AT.z); });
  edgeBands(4.0, 0.4);

  // TICKET-06 LAB-09 fix: no top-lintel orange rectangle; only the 6 upright ribbed copper coils (bottom to top)
  const gate = kit.gate(m);
  place(gate, GATE_AT.x, GATE_AT.z, 0, 0.4);

  // Portal surface in opening
  const portal = new THREE.Mesh(keep(new THREE.PlaneGeometry(gate.opening.width, gate.opening.height)), o.portalMaterial);
  portal.position.set(0, gate.opening.sill + gate.opening.height / 2, gate.opening.z);
  portal.visible = false;
  gate.group.add(portal);

  // Swapping in gate.glb: uses 6 recessed 3D ribbed copper field-coil blocks (buildGateRibbedCoils), never flat floating orange rectangles
  swaps.push(() => {
    const gen = genFor('gate');
    if (!gen) return false;
    groundModelAt(gen, 0);
    replaceVisual(gate.group, gen, [portal]);
    Object.assign(gate.opening, GEN_GATE_OPENING);
    portal.geometry = keep(new THREE.PlaneGeometry(GEN_GATE_OPENING.width, GEN_GATE_OPENING.height));
    portal.position.set(0, GEN_GATE_OPENING.sill + GEN_GATE_OPENING.height / 2, GEN_GATE_OPENING.z);
    const { housings, coils } = buildGateRibbedCoils(m, keep);
    gen.add(housings);
    gate.coils.splice(0, gate.coils.length, ...coils);
    fitOverhang(gate, [{
      minX: GATE_AT.x - GEN_GATE_OPENING.width / 2, maxX: GATE_AT.x + GEN_GATE_OPENING.width / 2,
      minY: 0, maxY: 4, minZ: GATE_AT.z - 2.5, maxZ: GATE_AT.z + 2.5,
    }]);
    return true;
  });

  const floorHeight = (x: number, z: number): number => {
    const dx = Math.abs(x - GATE_AT.x);
    const dz = Math.abs(z - GATE_AT.z);
    if (dx <= 2.0 && dz <= 2.0) return 0.4;
    if (dx <= 2.5 && dz <= 2.5) return 0.2;
    return 0;
  };

  // ---- West Wall: The Power Wall (Sheet 07, south to north — grounded & cabled)
  void POWER_WALL_SHEET07_ORDER;
  const bank = place(kit.capacitorBank(m), -7.2, 1.0, -Math.PI / 2);
  const breaker = place(kit.breakerPanel(m), -7.4, -1.0, -Math.PI / 2);

  // Grounded steel support plinth under the 4 Relay Cabinets (y = 0 to 0.72 m) so relay cabinets never float on the wall
  add(new THREE.BoxGeometry(0.56, 0.72, 3.65), m.darkSteel, (pl) => {
    pl.position.set(-7.58, 0.36, -3.95);
  });
  add(new THREE.BoxGeometry(0.02, 0.08, 3.62), m.hazard, (hz) => {
    hz.position.set(-7.29, 0.06, -3.95);
  });

  const relays = [-2.6, -3.5, -4.4, -5.3].map((z) => place(kit.relayCabinet(m), -7.6, z, -Math.PI / 2, 0.72));
  const boxes = [-6.1, -6.7].map((z) => place(kit.controlBox(m), -7.6, z, -Math.PI / 2, 1.4));
  const desk = consoleMillOperatorConsole(m);
  place(desk, -6.5, -7.8, -Math.PI / 2);

  // Vertical square-section conduit drops from West overhead cable tray (y = 4.2) to every West-wall unit
  const westDrops = new THREE.Group();
  for (const [cx, cz, topY] of [
    [-7.49, 1.0, 1.345], // lands on the capacitor bank's wall-side bus bar (kit-capacitor-bank.ts: bar top 1.345 m)
    [-7.45, -1.0, 2.05],
    [-7.6, -2.6, 2.02],
    [-7.6, -3.5, 2.02],
    [-7.6, -4.4, 2.02],
    [-7.6, -5.3, 2.02],
    [-7.65, -6.1, 1.65],
    [-7.65, -6.7, 1.65],
  ] as const) {
    westDrops.add(buildCableDrop(m, cx, cz, topY, 4.2));
  }
  // draw-call budget (TICKET-06): the eight drops are in the shell, so they merge into its meshes, one per material
  shell.add(westDrops);

  // Plan 38 pilot: the bank is a kit (kit-capacitor-bank.ts): one generated can placed six times, the skid, caps, insulators
  // and bus bars as square-section code. The lab is shielded, so it shows its full stage; the Graphics tier sets the
  // detail rank (Low draws ranks 0-1, so the lifting eyes and bolts go).
  const detailTier: Tier = o.quality === 'low' || o.quality === 'medium' ? o.quality : 'high';
  swaps.push(() => {
    const built = buildKitPreset(CAPACITOR_BANK_KIT, 'capacitor-bank', {
      materials: { darkSteel: m.darkSteel, gunmetal: m.gunmetal, copper: m.copper, hazard: m.hazard },
      gen: genFor,
      maxRank: maxRank(6, detailTier),
      keep,
    });
    if (!built) return false;
    replaceVisual(bank.group, built.group);
    fitOverhang(bank);
    return true;
  });
  // The breaker panel (sheet 07): the isolator turns about its spindle (the panel's normal) and the three sub-breakers flip in their sockets.
  // The panel's own model carries the hazard plate, the knob and the sockets; the code adds only the moving parts and the socket collars.
  const isolator = new THREE.Group();
  isolator.name = 'breaker-isolator';
  const toggles = TOGGLE_SOCKETS.map((_, i) => {
    const t = new THREE.Group();
    t.name = `breaker-toggle-${i}`;
    return t;
  });
  swaps.push(() => {
    const panel = genFor('breaker-panel');
    const handle = genFor('breaker-handle');
    if (!panel || !handle) return false;
    panel.rotation.y = WEST_WALL_TURN;
    groundModelAt(panel, 0);
    mergeStaticMeshes(panel, [], keep);
    mergeStaticMeshes(handle, [], keep);
    replaceVisual(breaker.group, panel);
    fitOverhang(breaker);
    // The isolator: the handle's column is turned to the panel's normal and its hub centred on the spindle
    handle.rotation.x = Math.PI / 2;
    handle.position.x = ISOLATOR_HUB_X;
    isolator.clear();
    isolator.add(handle);
    isolator.position.set(ISOLATOR_AT[0], ISOLATOR_AT[1], ISOLATOR_AT[2]);
    panel.add(isolator);
    handleGlow(handle);
    // The sub-breakers: a static collar seated in each socket (merged into one mesh), and a bat pivoting about the collar's top
    const collars = new THREE.Group();
    const batGeo = keep(new THREE.BoxGeometry(0.03, 0.02, 0.06));
    const collarGeo = keep(new THREE.BoxGeometry(0.042, 0.042, 0.012));
    TOGGLE_SOCKETS.forEach(([x, y, z], i) => {
      const collar = new THREE.Mesh(collarGeo, m.darkSteel);
      collar.position.set(x, y, z + 0.006);
      collars.add(collar);
      const pivot = toggles[i]!;
      pivot.clear();
      pivot.position.set(x, y, z + 0.012);
      const bat = new THREE.Mesh(batGeo, m.gunmetal);
      bat.position.set(0, 0, 0.03);
      pivot.add(bat);
      panel.add(pivot);
    });
    mergeStaticMeshes(collars, [], keep);
    panel.add(collars);
    return true;
  });
  // POL-69: Caged amber (#ffc13d) beacon housings mounted on top of the 4 Relay Cabinets
  const relayHousings = relays.map((r) => {
    const bh = buildRelayBeaconHousing(m, keep);
    r.group.add(bh.group);
    r.lamps.push(...bh.beacons);
    return bh;
  });
  swaps.push(() => {
    const gens = genAll(relays.map(() => 'relay-cabinet'));
    if (!gens) return false;
    const relayLamps: THREE.Mesh[] = [];
    relays.forEach((r, i) => {
      const gen = gens[i]!;
      gen.rotation.y = WEST_WALL_TURN;
      groundModelAt(gen, 0);
      mergeStaticMeshes(gen, [], keep);
      const bh = relayHousings[i]!;
      replaceVisual(r.group, gen, [bh.group]);
      const pair = [lamp('#ffc13d', -0.12, 1.13, 0.262), lamp('#ffc13d', 0.12, 1.13, 0.262)];
      gen.add(...pair);
      relayLamps.push(...pair, ...bh.beacons);
    });
    lamps.relays = relayLamps;
    return true;
  });
  swaps.push(() => {
    const gens = genAll(boxes.map(() => 'control-box'));
    if (!gens) return false;
    const boxLamps: THREE.Mesh[] = [];
    boxes.forEach((b, i) => {
      const gen = gens[i]!;
      mergeStaticMeshes(gen, [], keep);
      replaceVisual(b.group, gen);
      gen.rotation.y = WEST_WALL_TURN;
      const pair = [lamp('#22cc44', -0.07, 0.36, 0.13), lamp('#ee2222', 0.07, 0.36, 0.13)];
      gen.add(...pair);
      boxLamps.push(...pair);
    });
    lamps.boxes = boxLamps;
    return true;
  });
  // The lever's swing: the play scene turns the pivot (desk.lever); the swing inside it carries the lever's rest tilt and the throw's travel
  const leverSwing = new THREE.Group();
  leverSwing.name = 'console-lever-swing';
  // The keypad (sheet 07): a 4 x 4 grid of raised square keycaps with no numbers, one merged mesh, set into the hood's pocket.
  const buildKeypad = (): THREE.Group => {
    const pad = new THREE.Group();
    pad.name = 'console-keypad';
    const plate = new THREE.Mesh(keep(new THREE.BoxGeometry(0.18, 0.18, 0.02)), m.paint);
    plate.position.set(0, 0, 0.01);
    pad.add(plate);
    const cap = keep(new THREE.BoxGeometry(0.034, 0.034, 0.012));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const key = new THREE.Mesh(cap, m.paint);
        key.position.set((c - 1.5) * 0.045, (r - 1.5) * 0.045, 0.026);
        pad.add(key);
      }
    }
    mergeStaticMeshes(pad, [], keep);
    pad.position.set(KEYPAD_AT[0], KEYPAD_AT[1], KEYPAD_AT[2]);
    pad.rotation.x = HOOD_TILT;
    return pad;
  };
  swaps.push(() => {
    const body = genFor('operator-console');
    const lever = genFor('console-lever');
    if (!body || !lever) return false;
    body.rotation.y = WEST_WALL_TURN;
    groundModelAt(body, 0);
    mergeStaticMeshes(body, [], keep);
    mergeStaticMeshes(lever, [], keep);
    replaceVisual(desk.group, body);
    fitOverhang(desk);
    // The throw lever (POL-121): widened 0.95 rad sweep through a raised quadrant slot guide
    desk.lever.clear();
    leverSwing.clear();
    lever.rotation.x = LEVER_REST_TILT;
    leverSwing.add(lever);
    desk.lever.add(leverSwing);
    desk.lever.position.set(LEVER_AT[0], LEVER_AT[1], LEVER_AT[2]);
    body.add(desk.lever);
    body.add(buildConsoleLeverQuadrant(m, keep, LEVER_AT));
    body.add(buildKeypad());
    // The hood's CRT is painted on the model, so the console carries no lamp of its own
    lamps.desk = [];
    return true;
  });

  // Overhead square cable trays along BOTH West wall (-7.6) and East wall (+7.55) at y = 4.2 m (in the shell: merged with it per material)
  shell.add(kit.cableTray(m, [-7.6, 1.2], [-7.6, -8.2], 4.2, ROOM.height).group);
  shell.add(kit.cableTray(m, [7.55, -8.2], [7.55, 1.2], 4.2, ROOM.height).group);

  // ---- East Wall: The Four Distinct, Grounded, Cabled, E-Interactable Studio & Fabrication Machines (Sheet 07)
  const rack = place(kit.presetRack(m), 7.45, -7.0, Math.PI / 2);
  const bench = place(kit.presetBench(m), 7.45, -5.0, Math.PI / 2);
  const combiner = place(kit.presetCombiner(m), 7.45, -3.3, Math.PI / 2);
  // the fabricator's glass bay faces the room (-PI/2: its front, +z, turns to -x); at +PI/2 its blank back faced the room (POL-103)
  const fabricator = place(buildHardwareFabricatorProp(m), 7.45, -1.35, -Math.PI / 2);
  const pTable = place(kit.planetTable(m), PLANET_TABLE_AT.x, PLANET_TABLE_AT.z, 0);
  pTable.group.userData.stationId = 'planet-table';

  const machineRigs: readonly LabMachineRig[] = [
    createRightWallMachineRig('preset-rack', rack, m, keep),
    createRightWallMachineRig('preset-bench', bench, m, keep),
    createRightWallMachineRig('preset-combiner', combiner, m, keep),
    createRightWallMachineRig('fabricator', fabricator, m, keep),
  ];

  // Vertical square-section conduit drops from East overhead cable tray (y = 4.2) to all 4 East-wall machines & armory rail
  const eastDrops = new THREE.Group();
  for (const [cx, cz, topY] of [
    [7.55, -7.0, 2.38],
    [7.55, -5.0, 1.35],
    [7.55, -3.3, 1.30],
    [7.55, -1.35, 1.64],
    [7.65, 0.6, 1.92],
  ] as const) {
    eastDrops.add(buildCableDrop(m, cx, cz, topY, 4.2));
  }
  // draw-call budget (TICKET-06): the five drops are in the shell, so they merge into its meshes, one per material
  shell.add(eastDrops);

  // Floor covers carrying power from West Power Wall -> Gate Plinth -> East Studio Bay & Planet Table (nothing wireless!)
  const coverRuns = [
    { points: [[-7.2, -1.0], [-2.5, -1.0]] as const, width: 0.32 },
    { points: [[-7.2, 1.0], [-7.2, -1.0]] as const, width: 0.28 },
    { points: [[-6.5, -7.8], [-7.2, -7.8], [-7.2, -5.3]] as const, width: 0.25 },
    { points: [[2.5, -1.0], [7.0, -1.0]] as const, width: 0.28 },
    { points: [[7.0, -7.0], [7.0, -1.0]] as const, width: 0.26 },
    { points: [[5.0, -1.0], [5.0, -4.0]] as const, width: 0.24 },
  ] as const;
  // The covers and their treads are in the shell (draw-call budget): the six covers' bodies, hazard edges and pulse slots merge across
  // the covers and with the shell, one mesh per material (the pulse slots share one material and carry their own UVs)
  const covers = coverRuns.map((r) => kit.floorCover(m, r.points.map((pt) => [pt[0], pt[1]]), r.width));
  for (const c of covers) shell.add(c.group);
  // POL-68: Transverse ribbed steel tread bars across all floor cable covers (merged into the shell's gunmetal)
  shell.add(buildRibbedFloorCoverTreads(coverRuns, m, keep));

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

  const tableDiscMat = keep(new THREE.MeshStandardMaterial({
    color: '#120c02',
    emissive: new THREE.Color('#ff7700'),
    emissiveIntensity: 0,
    roughness: 0.4,
    metalness: 0.3,
  }));
  const planetTableHolo = createPlanetTableHologram(pTable.group);
  let currentFloats: FourFloats = { Pxd: 0, Vtx: 0, Lx: 0, Aq: 0 };
  let consensusCommitted = false;
  const tableDisc = pTable.lamps[0];
  if (tableDisc) tableDisc.material = tableDiscMat;

  // Keep each machine's distinctive Sheet 07 dressGroup & pixel plume when swapping in generated GLBs!
  swaps.push(() => swapAll([
    { p: rack, id: 'preset-rack', turn: WEST_WALL_TURN, kept: [machineRigs[0]!.dressGroup] },
    { p: bench, id: 'preset-bench', turn: WEST_WALL_TURN, kept: [machineRigs[1]!.dressGroup] },
    { p: combiner, id: 'preset-combiner', turn: WEST_WALL_TURN, kept: [machineRigs[2]!.dressGroup] },
  ]));
  swaps.push(() => {
    const plate = genFor('planet-table');
    if (!plate) return false;
    groundModelAt(plate, 0);
    replaceVisual(pTable.group, plate, [planetTableHolo.group]);
    pTable.lamps.length = 0;
    const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.42, 0.42, 0.01, 32)), tableDiscMat);
    disc.position.set(0, 1.1 + 0.005, 0);
    mergeStaticMeshes(plate, [], keep);
    plate.add(disc);
    plate.add(planetTableHolo.group);
    return true;
  });

  // ---- South-East: The Armory Nook
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
  const mockTool = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.16, 0.55)), m.paint);
  mockTool.position.set(-0.08, 0.06, 0);
  railGroup.add(mockTool);
  place({ group: railGroup, colliders: [{ min: [-0.2, -0.2, -0.75], max: [0.1, 0.2, 0.75] }], sockets: [], lamps: [] }, 7.75, 0.6, 0, 1.3);
  swaps.push(() => {
    const rail = genFor('armory-rail');
    const tool = genFor('weapon-frame');
    if (!rail || !tool) return false;
    railGroup.clear();
    rail.rotation.y = -Math.PI / 2;
    tool.position.set(0, 0.62, 0);
    tool.rotation.y = Math.PI / 2;
    railGroup.add(rail, tool);
    mergeStaticMeshes(railGroup, [], keep);
    return true;
  });

  const armory = armoryRack(m);
  armory.group.getObjectByName('armory-beam-cradle')?.removeFromParent();
  const keptSidearm = [armory.group.getObjectByName('armory-sidearm') ?? armory.group.getObjectByName('sidearm')].filter((x): x is THREE.Object3D => x !== null);
  mergeStaticMeshes(armory.group, keptSidearm, keep);
  place({ group: armory.group, colliders: armory.colliders, sockets: [], lamps: [] }, ARMORY_RAIL_POS.x, ARMORY_RAIL_POS.z, 0, ARMORY_RAIL_POS.y);

  const weaponBench = place(kit.presetBench(m), 6.0, 2.4, Math.PI);
  weaponBench.group.userData.stationId = 'weapon-bench';
  swaps.push(() => {
    const parts = genAll(WEAPON_BENCH_SET);
    if (!parts) return false;
    if (!swapAll([{ p: weaponBench, id: 'weapon-bench' }])) return false;
    colliders.push({ min: [4.8, 0, 2.0], max: [7.2, 1.6, 2.8] });
    dressWeaponBench(weaponBench.group, parts);
    return true;
  });

  // ---- The lab clutter (TASK-23c)
  const clutterEntries = new Map<string, ClutterEntry>();
  const discGeo = keep(new THREE.CircleGeometry(1, 36));
  // the clutter fallbacks' one material: their parts' colours are vertex colours (see the loop)
  const clutterFallbackMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.25 }));
  discGeo.rotateX(-Math.PI / 2);
  // TICKET-14: the old monitor's 4-bar equaliser (lit while the overclocked track plays), mounted on its screen
  let monitorEq: MonitorEqualizer3D | null = null;
  for (const item of CLUTTER) {
    // POL-103: the filing cabinet (LOG-03) leaves the East-wall gap between the Hardware Fabricator (z = -1.35) and the Armory,
    // where its plain box read as a grey block on the wall, and stands on the South wall beside Dr. Haddy's desk, facing north.
    // x = -0.85, not Argo's -0.35: at -0.35 its east edge (x -0.02) blocks the walk north from the south wall at x = 0 (the
    // campaign's beat 6), and the player is 0.3 m wide, so the cabinet's edge must sit below -0.3 with room to spare.
    const placedX = item.id === 'filing-cabinet' ? -0.85 : item.x;
    const placedZ = item.id === 'filing-cabinet' ? 2.48 : item.z;
    const placedYaw = item.id === 'filing-cabinet' ? Math.PI : item.yaw;

    // Articulated fallback (dark-steel plinth, painted body, dark-steel front trim, gunmetal top cap), so no clutter fallback is ever a
    // plain grey box before its generated model swaps in (POL-103). The four parts merge into ONE mesh by vertex colour: one draw call,
    // as the plain box it replaces (the lab's draw-call budget).
    const plinthH = Math.min(0.08, item.h * 0.12);
    const bodyH = Math.max(0.1, item.h - plinthH - 0.04);
    const fallbackParts: readonly { readonly geo: THREE.BufferGeometry; readonly colour: THREE.Color }[] = [
      { geo: new THREE.BoxGeometry(item.w * 0.96, plinthH, item.d * 0.96).translate(0, plinthH / 2, 0), colour: m.darkSteel.color },
      { geo: new THREE.BoxGeometry(item.w * 0.92, bodyH, item.d * 0.92).translate(0, plinthH + bodyH / 2, 0), colour: m.paint.color },
      { geo: new THREE.BoxGeometry(item.w, 0.04, item.d).translate(0, item.h - 0.02, 0), colour: m.gunmetal.color },
      { geo: new THREE.BoxGeometry(item.w * 0.78, bodyH * 0.76, 0.02).translate(0, plinthH + bodyH / 2, item.d * 0.46), colour: m.darkSteel.color },
    ];
    const coloured = fallbackParts.map(({ geo, colour }) => {
      const n = geo.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = colour.r; col[i * 3 + 1] = colour.g; col[i * 3 + 2] = colour.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    });
    const fallbackGeo = mergeGeometries(coloured, false);
    coloured.forEach((geo) => geo.dispose());
    if (!fallbackGeo) throw new Error(`clutter fallback ${item.id}: the parts did not merge`);
    const stand = new THREE.Mesh(keep(fallbackGeo), clutterFallbackMat);
    stand.name = `clutter-fallback:${item.id}`;

    const prop: Prop = { group: new THREE.Group(), colliders: [{ min: [-item.w / 2, 0, -item.d / 2], max: [item.w / 2, item.h, item.d / 2] }], sockets: [], lamps: [] };
    prop.group.add(stand);
    prop.group.userData.clutterId = item.id;
    if (item.id === 'old-monitor') {
      monitorEq = createMonitorEqualizer3D(prop.group);
      // POL-306: seat equaliser bars at z = 0.268 with frustumCulled = false & polygonOffset
      applyMonitorEqualizerNearShotFix(monitorEq.group);
    }
    const before = colliders.length;
    place(prop, placedX, placedZ, placedYaw, 0);
    const disc = new THREE.Mesh(discGeo, keep(new THREE.MeshBasicMaterial({ color: '#ffc13d', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
    disc.position.set(placedX, 0.03, placedZ);
    disc.visible = false;
    group.add(disc);
    clutterEntries.set(item.id, { item, prop, disc, boxes: colliders.slice(before), state: 'standing', t: 0 });
    swaps.push(() => {
      const gen = genFor(item.model);
      if (!gen) return false;
      groundModelAt(gen, 0);
      mergeStaticMeshes(gen, [], keep);
      // the monitor's equaliser stays on the swapped model's screen
      replaceVisual(prop.group, gen, item.id === 'old-monitor' && monitorEq ? [monitorEq.group] : []);
      return true;
    });
  }
  const takeAway = (e: ClutterEntry): void => {
    e.state = 'gone';
    group.remove(e.prop.group, e.disc);
    for (const b of e.boxes) {
      const i = colliders.indexOf(b);
      if (i >= 0) colliders.splice(i, 1);
    }
  };
  const tickClutter = (dt: number): void => {
    for (const e of clutterEntries.values()) {
      if (e.state !== 'dissolving') continue;
      e.t += dt;
      const p = Math.min(1, e.t / DISSOLVE_SECONDS);
      e.prop.group.scale.setScalar(Math.max(0.001, 1 - p * p));
      e.prop.group.position.y = -e.item.h * p * p;
      const r = 0.5 * Math.max(e.item.w, e.item.d) + 0.1;
      e.disc.scale.setScalar(r * (0.7 + 0.5 * p));
      e.disc.visible = true;
      (e.disc.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - p);
      if (p >= 1) takeAway(e);
    }
  };

  // ---- South Wall: Her Corner
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
  const cotProp = place({ group: cotGroup, colliders: [{ min: [-1.0, 0, -0.45], max: [1.0, 0.6, 0.45] }], sockets: [], lamps: [] }, -2.5, 2.2, 0);
  swaps.push(() => swapAll([{ p: cotProp, id: 'cot', turn: Math.PI / 2 }]));

  const deskGroup = new THREE.Group();
  const deskBody = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.72, 0.68)), m.paint);
  deskBody.position.y = 0.36;
  deskGroup.add(deskBody);
  const deskTop = new THREE.Mesh(keep(new THREE.BoxGeometry(1.46, 0.05, 0.74)), m.gunmetal);
  deskTop.position.y = 0.74;
  deskGroup.add(deskTop);
  const pStack1 = new THREE.Mesh(keep(new THREE.BoxGeometry(0.24, 0.03, 0.30)), m.paint);
  pStack1.position.set(-0.25, 0.78, 0.05);
  deskGroup.add(pStack1);
  const pStack2 = new THREE.Mesh(keep(new THREE.BoxGeometry(0.22, 0.02, 0.28)), m.paint);
  pStack2.position.set(-0.24, 0.81, 0.06);
  pStack2.rotation.y = 0.12;
  deskGroup.add(pStack2);
  const mug = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12)), m.darkSteel);
  mug.position.set(0.15, 0.80, -0.15);
  deskGroup.add(mug);
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
  const deskProp = place({ group: deskGroup, colliders: [{ min: [-0.75, 0, -0.4], max: [0.75, 1.0, 0.4] }], sockets: [], lamps: [] }, 1.0, 2.4, Math.PI);
  swaps.push(() => {
    const body = genFor('her-desk');
    if (!body) return false;
    groundModelAt(body, 0);
    deskGroup.remove(deskBody, deskTop);
    deskGroup.add(body);
    fitOverhang(deskProp);
    return true;
  });

  // Inset wall radio in south wall beside desk
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
  swaps.push(() => {
    const gen = genFor('wall-radio');
    if (!gen) return false;
    replaceVisual(radioGroup, gen);
    const lampMesh = lamp('#ff7700', 0.2, 0.08, 0.17, [0.04, 0.04, 0.02]);
    (lampMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
    gen.add(lampMesh);
    return true;
  });

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

  // ---- Light: recessed aluminum ceiling strip troffers in 3 banks (never black boxes when unlit, LAB-02)
  const stripLength = (depth - 2.5) / 3;
  const stripMats = [0, 1, 2].map(() =>
    keep(new THREE.MeshStandardMaterial({
      color: '#c8d6e5',
      emissive: '#eef4ff',
      emissiveIntensity: 0,
      roughness: 0.32,
      metalness: 0.1,
    })),
  );
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    for (let bnk = 0; bnk < 3; bnk++) {
      const zc = (ROOM.back + ROOM.front) / 2 - (depth - 2.5) / 2 + stripLength * (bnk + 0.5);
      // Brushed-steel troffer housing
      add(new THREE.BoxGeometry(0.32, 0.04, stripLength + 0.04), m.paint, (housing) => {
        housing.position.set(x, ROOM.height - 0.02, zc);
      });
      // Diffuser tube
      add(new THREE.BoxGeometry(0.22, 0.04, stripLength - 0.04), stripMats[bnk]!, (s) => {
        s.position.set(x, ROOM.height - 0.045, zc);
      });
    }
  }
  const mainLamp = new THREE.PointLight('#e6f2ff', 0, 24, 1.8);
  mainLamp.position.set(0, ROOM.height - 0.6, -2.0);
  group.add(mainLamp);

  // Flush-mounted wall emergency beacons with gunmetal wall bezels (never floating brown cubes, LAB-02)
  const emergencyMat = keep(new THREE.MeshStandardMaterial({
    color: '#b85c1e',
    emissive: '#ff7a1c',
    emissiveIntensity: 0,
    roughness: 0.35,
  }));
  for (const [x, z, face] of [[-7.96, -3.0, Math.PI / 2], [7.96, -1.0, -Math.PI / 2], [0, 2.96, Math.PI]] as const) {
    add(new THREE.BoxGeometry(0.24, 0.16, 0.03), m.gunmetal, (bezel) => {
      bezel.position.set(x, 4.55, z); bezel.rotation.y = face;
    });
    add(new THREE.BoxGeometry(0.16, 0.09, 0.05), emergencyMat, (e) => {
      e.position.set(x, 4.55, z); e.rotation.y = face;
    });
  }
  const emergency = new THREE.PointLight('#ff8a3a', 0, 22, 1.6);
  emergency.position.set(0, 4.4, 0);
  group.add(emergency);

  const strobe = new THREE.PointLight('#ff2a1a', 0, 7, 1.8);
  strobe.position.set(-7.0, 2.6, -4.0);
  group.add(strobe);

  const gateGlow = new THREE.PointLight('#ff9a4a', 0, 10, 1.8);
  gateGlow.position.set(GATE_AT.x, 1.8, GATE_AT.z + 0.6);
  group.add(gateGlow);

  const windowLight = new THREE.PointLight('#7fe9ff', 3.5, 16, 1.8);
  windowLight.position.set(wx, wy + 0.4, ROOM.back + 1.2);
  group.add(windowLight);

  const fill = new THREE.HemisphereLight('#1a2433', '#2a2e33', 0.08);
  group.add(fill);

  const handleMats: THREE.MeshStandardMaterial[] = [];
  const handleGlow = (h: THREE.Object3D): void => {
    h.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.Material;
      if (!(src instanceof THREE.MeshStandardMaterial)) return;
      const mat = src.clone();
      mat.emissive = new THREE.Color('#ff2a1a');
      mat.emissiveIntensity = 0;
      mesh.material = mat;
      handleMats.push(mat);
    });
  };

  const lamps = {
    relays: relays.flatMap((r) => r.lamps),
    boxes: boxes.flatMap((b) => b.lamps),
    desk: desk.lamps,
  };
  let relayOn: boolean[] = [];

  const setPower = (p: Power): void => {
    lastPower = p;
    toggles.forEach((t, i) => { t.rotation.x = breakerToggleAngle(p.relays, i); });
    isolator.rotation.z = isolatorAngle(p.relays);
    relayOn = lamps.relays.map((_, i) => p.relays * lamps.relays.length > i);
    lamps.relays.forEach((l, i) => { if (!relayOn[i]) kit.setLamp(l, 0); });
    lamps.boxes.forEach((l) => kit.setLamp(l, p.relays > 0.5 ? 1 : 0));
    lamps.desk.forEach((l) => kit.setLamp(l, 1));

    // TICKET-06 Item 7: 3.5 s progressive bottom-to-top gate coil ignition
    const cLevels = coilLevels(p.coils, gate.coils.length);
    gate.coils.forEach((c, i) => {
      const lvl = cLevels[i] ?? 0;
      kit.setLamp(c, lvl * 2.2);
    });

    // Power the 4 right-wall Studio & Fabrication machines and their pixel exhaust plumes
    for (const rig of machineRigs) {
      rig.setPowered(p.main);
    }

    tableDiscMat.emissiveIntensity = p.main * 0.22;
    planetTableHolo.group.visible = p.hologram > 0.001;
    pTable.lamps.slice(1).forEach((l) => kit.setLamp(l, p.main > 0.5 ? 1 : 0));

    pulseUniforms.uPower.value = p.pulse;
    stripMats.forEach((mat, i) => { mat.emissiveIntensity = p.banks[i]! * 2.2; });
    mainLamp.intensity = p.main * 18;
    fill.color.set(p.main > 0.02 ? '#d8e2ea' : '#1a2433');
    fill.groundColor.set(p.main > 0.02 ? '#58626e' : '#2a2e33');
    fill.intensity = p.main > 0.02 ? 0.14 + p.main * 0.28 : 0.08;
    emergencyMat.emissive.set('#ff7a1c');
    emergencyMat.emissiveIntensity = p.emergency * 2.4;
    emergency.color.set('#ff8a3a');
    emergency.intensity = p.emergency * 22;
    gateGlow.intensity = p.coils * 12 + p.arc * 60;
    gateGlow.color.set(p.arc > 0.01 ? '#ffb040' : '#ff9a4a');
    strobe.intensity = 0;
    handleMats.forEach((mat) => { mat.emissiveIntensity = 0; });
    portal.visible = p.coils > 0.6;
  };
  setPower(POWER_OFF);

  const setStorm = (progress: number): void => {
    stormUniforms.uStorm.value = Math.max(0, Math.min(1, progress));
    vista.setProgress(progress);
  };
  setStorm(0);
  let planeFallback = false;
  const syncPlane = (): void => { stormPlane.visible = planeFallback || vista.view === 'static'; };
  const setWindowView = (view: WindowView): void => {
    vista.setView(view);
    syncPlane();
  };
  const setPlaneFallback = (on: boolean): void => {
    planeFallback = on;
    syncPlane();
  };

  const leverAt = desk.lever.getWorldPosition(new THREE.Vector3());
  const adoptGenerated = (): void => {
    swaps = swaps.filter((run) => !run());
    desk.lever.getWorldPosition(leverAt);
    setPower(lastPower);
    vista.adoptGenerated();
  };
  adoptGenerated();
  // after the preload (the lab's and the play screen's both call the room's adoptGenerated then): an HD-pack window model
  // that did not load leaves the window in its Static view, the storm plane with no boxes (T17a, no page error)
  const adoptLoaded = (): void => {
    adoptGenerated();
    if (vistaHdModelsMissing()) setWindowView('static');
  };

  const aimClutter = (origin: THREE.Vector3, dir: THREE.Vector3, reach: number): string | null => {
    const roots = [...clutterEntries.values()].filter((e) => e.state === 'standing').map((e) => e.prop.group);
    for (const r of roots) r.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(origin, dir.clone().normalize(), 0, reach);
    for (const h of ray.intersectObjects(roots, true)) {
      let obj: THREE.Object3D | null = h.object;
      while (obj && obj.userData.clutterId === undefined) obj = obj.parent;
      if (obj) return obj.userData.clutterId as string;
    }
    return null;
  };
  const dissolveClutter = (id: string): boolean => {
    const e = clutterEntries.get(id);
    if (!e || e.state !== 'standing' || e.item.role !== 'salvage') return false;
    e.state = 'dissolving';
    e.t = 0;
    return true;
  };
  const removeClutter = (ids: readonly string[]): void => {
    for (const id of ids) {
      const e = clutterEntries.get(id);
      if (e && e.state !== 'gone') takeAway(e);
    }
  };

  // Draw-call budget (TICKET-06): the shell's panels that share a material become one mesh each. The storm plane stays on its own
  // (syncPlane shows and hides it); the transparent materials are never merged (their draw order matters). The cable trays, the drops,
  // the floor covers and their treads are in the shell too, so they add no draw call of their own. The merged geometry is kept (POL-105).
  mergeStaticMeshes(shell, [stormPlane], keep);

  return {
    envLevel: () => 0.03 + lastPower.main * 0.2,
    aimClutter,
    dissolveClutter,
    removeClutter,
    armory,
    stations: LAB_STATIONS,
    aimStation: (origin, dir, reach = 3.2) => aimLabStation(origin, dir, reach),
    nearestStation: (pos, maxReach) => nearestLabStation(pos, maxReach),
    group,
    colliders,
    gate,
    portal,
    leverAt,
    lever: desk.lever,
    spawn: { x: -2.5, z: 1.0, yaw: 0 },
    setPower,
    power: (): Power => lastPower,
    coilsLit: (): boolean[] => gate.coils.map((c) => ((c.material as THREE.MeshStandardMaterial).emissiveIntensity ?? 0) > 0.5),
    adoptGenerated: adoptLoaded,
    setStorm,
    setMonitorEqualizer: (bars?: readonly number[] | boolean): void => {
      if (monitorEq) {
        if (typeof bars === 'boolean') {
          monitorEq.setActive(bars);
        } else if (Array.isArray(bars)) {
          monitorEq.setActive(true);
          const heights = bars;
          for (let i = 0; i < 4; i++) {
            const b = monitorEq.group.children[i] as THREE.Mesh | undefined;
            if (b) b.scale.y = heights[i] ?? 1;
          }
        } else {
          monitorEq.setActive(false);
        }
      }
    },
    hologram: planetTableHolo,
    setFloats: (f: FourFloats): void => { currentFloats = f; },
    setConsensusCommitted: (committed: boolean): void => { consensusCommitted = committed; },
    setStationOperating: (id: RightWallMachineId | LabStationId | 'rack' | 'bench' | 'combiner', on: boolean): void => {
      const norm = id === 'rack' ? 'preset-rack' : id === 'bench' ? 'preset-bench' : id === 'combiner' ? 'preset-combiner' : id;
      const rig = machineRigs.find((r) => r.spec.id === norm);
      rig?.setOperating(on);
    },
    setWindowView,
    setPlaneFallback,
    vista,
    floorHeight,
    update(now, dt) {
      pulseUniforms.uTime.value = now;
      stormUniforms.uTime.value = now;
      vista.update(now, dt);
      tickClutter(dt);
      if (monitorEq) {
        monitorEq.setActive(isMonitorOverclockedPlaying());
        monitorEq.update(now);
      }
      planetTableHolo.update(now, currentFloats, consensusCommitted);
      // desk.lever carries the play scene's full throw; the swing takes back all but the travel (the swing sits inside desk.lever)
      leverSwing.rotation.x = desk.lever.rotation.x * (LEVER_TRAVEL / LEVER_THROW - 1);
      for (const rig of machineRigs) {
        rig.animate(now, lastPower.main);
      }
      windowLight.intensity = 3.5 + 12 * vista.flashLight;
      if (lastPower.relays === 0) {
        const s = darkStrobe(now);
        strobe.position.z = strobeSweepZ(now);
        strobe.intensity = 5 * s;
        emergencyMat.emissive.set('#ff2a1a');
        emergencyMat.emissiveIntensity = 0.35 + 1.65 * s;
        emergency.color.set('#ff2a1a');
        emergency.intensity = 22 * s;
        handleMats.forEach((mat) => { mat.emissiveIntensity = 1.6 * s; });
      }
      relayOn.forEach((on, i) => { if (on) kit.setLamp(lamps.relays[i]!, 0.7 + 0.3 * Math.sin(now * 4 + i * 1.3)); });
    },
    dispose() {
      vista.dispose();
      planetTableHolo.dispose();
      for (const x of owned) x.dispose();
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
        }
      });
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
    },
  };
}
