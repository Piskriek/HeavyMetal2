/**
 * High-level engine bindings for the generated 3D assets (TASK-10).
 * Replaces stand-in rovers, fabricator, machines, and fixtures with high-fidelity
 * generated models, respecting plot stage (1-2 low, 3-4 mid, 5-6 high) and Graphics tier.
 */
import * as THREE from 'three';
import {
  type GenLevel,
  loadGen,
  getGenSync,
  genLevelFor,
} from './gen';
import type { RoverKind } from '@hm/rover';
import {
  type Rover as RoverGearMesh,
  type Station as FabricatorStationMesh,
  type LabMaterials,
  createMaterials as createRovergearMaterials,
  scout as fallbackScout,
  hauler as fallbackHauler,
  crawler as fallbackCrawler,
  fabricator as fallbackFabricator,
} from '@hm/rovergear';
import type { MachineKind } from '@hm/plotsim';
import {
  type MachineProp,
  RING_TOP_Y,
  machineProp as fallbackMachineProp,
} from '../play/machine-props';
import type { Box, Socket, KitPieceResult } from '../base/kit-pieces';

export const CORE_GEN_ASSETS = [
  'scout-body',
  'scout-wheel',
  'hauler-body',
  'hauler-wheel',
  'crawler-body',
  'crawler-arm',
  'fabricator-frame',
  'fabricator-head',
  'mill',
  'press-frame',
  'press-ram',
  'projector-mast',
  'projector-head',
  'watermaker',
  'bin',
  'repeater',
  'drafting',
  'weapon-bench',
] as const;

export type CoreGenAsset = typeof CORE_GEN_ASSETS[number];

/**
 * Level selection rule (canon: "Terraforming IS graphical fidelity"):
 * - Stage 1-2: 'low'
 * - Stage 3-4: 'mid'
 * - Stage 5-6: 'high'
 * Capped by profile quality setting ('low' | 'medium' | 'high').
 */
export function genLevelForStage(stage: number, quality: string = 'high'): GenLevel {
  const byStage: GenLevel = stage <= 2 ? 'low' : stage <= 4 ? 'mid' : 'high';
  const cap = genLevelFor(quality);
  if (cap === 'low') return 'low';
  if (cap === 'mid' && byStage === 'high') return 'mid';
  return byStage;
}

/** Preload all core generated assets for a specific fidelity level behind the loading bar. */
export async function preloadAllGenAssets(level: GenLevel = 'low'): Promise<void> {
  const tasks = CORE_GEN_ASSETS.map((id) =>
    loadGen(id, level).catch((err) => {
      console.warn(`Failed to preload gen asset ${id} at level ${level}:`, err);
      return null;
    })
  );
  await Promise.all(tasks);
}

// ---------------------------------------------------------------------------
// VEHICLE FIT & ASSEMBLY
// ---------------------------------------------------------------------------

export interface VehicleFit {
  readonly offset: readonly [number, number, number];
  readonly yaw: number;
  readonly scaleX?: number;
  readonly wheelOffset: readonly [number, number, number];
  readonly wheelRadius: number;
  readonly hubs: readonly (readonly [number, number, number])[];
  readonly lamps: readonly (readonly [number, number, number])[];
  readonly sockets: readonly { readonly name: string; readonly at: readonly [number, number, number] }[];
}

export const VEHICLE_FIT: Record<'scout' | 'hauler' | 'crawler', VehicleFit> = {
  scout: {
    // Scout body size [1.629, 2.143, 3.200], hubs at z = ±1.1, x = ±0.8
    offset: [0, -0.22, 0],
    yaw: 0,
    wheelOffset: [0, -0.44, 0.088],
    wheelRadius: 0.45,
    hubs: [
      [-0.8, 0, 1.1],
      [0.8, 0, 1.1],
      [-0.8, 0, -1.1],
      [0.8, 0, -1.1],
    ],
    lamps: [
      [-0.35, 0.32, 1.55],
      [0.35, 0.32, 1.55],
    ],
    sockets: [
      { name: 'seat', at: [0, 0.27, -0.1] },
    ],
  },
  hauler: {
    // Hauler body size [2.853, 2.931, 5.992], hubs at z = 1.8, -0.6, -1.8, x = ±1.0
    offset: [0, -0.28, 0],
    yaw: 0,
    wheelOffset: [0, -0.549, 0],
    wheelRadius: 0.55,
    hubs: [
      [-1.0, 0, 1.8],
      [1.0, 0, 1.8],
      [-1.0, 0, -0.6],
      [1.0, 0, -0.6],
      [-1.0, 0, -1.8],
      [1.0, 0, -1.8],
    ],
    lamps: [
      [-0.7, 0.72, 2.95],
      [0.7, 0.72, 2.95],
    ],
    sockets: [
      { name: 'seat', at: [-0.45, 0.6, 1.9] },
      { name: 'seat', at: [0.45, 0.6, 1.9] },
      { name: 'dish', at: [0, 1.13, -0.3] },
    ],
  },
  crawler: {
    // Crawler body size [4.567, 4.855, 6.974], physics track is 2.4m
    offset: [0, -0.25, 0],
    yaw: 0,
    scaleX: 2.4 / 4.567,
    wheelOffset: [0, 0, 0],
    wheelRadius: 0.45,
    hubs: [],
    lamps: [
      [-0.7 * (2.4 / 4.567), 0.45, 3.25],
      [0.7 * (2.4 / 4.567), 0.45, 3.25],
    ],
    sockets: [
      { name: 'seat', at: [0, 1.0, 1.6] },
      { name: 'drill', at: [0, 0.4, 4.46] },
      { name: 'mast', at: [0.6 * (2.4 / 4.567), 3.15, 1.3] },
    ],
  },
};

function createLampDisc(pos: readonly [number, number, number]): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x242424,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.userData.isRoverLamp = true;
  return mesh;
}

function createSeatProp(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f242b, roughness: 0.6, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), mat);
  base.position.set(0, 0.06, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.1), mat);
  back.position.set(0, 0.38, -0.2);
  g.add(base, back);
  return g;
}

function createSteeringWheelProp(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.3 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), mat);
  col.rotation.x = -Math.PI / 6;
  col.position.set(0, 0.15, 0.08);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 16), mat);
  rim.position.set(0, 0.28, 0.16);
  rim.rotation.x = -Math.PI / 6;
  g.add(col, rim);
  return g;
}

/**
 * Builds a rover model using generated assets if preloaded, or falling back to @hm/rovergear.
 */
export function createGenRover(
  kind: RoverKind,
  level: GenLevel = 'low',
  stage: number = 6,
  materials?: LabMaterials
): RoverGearMesh {
  const m = materials ?? createRovergearMaterials();
  const fit = VEHICLE_FIT[kind];
  const bodyGen = getGenSync(`${kind}-body`, level);

  if (!bodyGen) {
    if (kind === 'scout') return fallbackScout(m, { stage });
    if (kind === 'hauler') return fallbackHauler(m, { stage });
    return fallbackCrawler(m, { stage });
  }

  const bodyRoot = new THREE.Group();
  bodyRoot.name = `gen-rover-body-${kind}`;

  // Position body inside rover frame
  bodyGen.position.set(fit.offset[0], fit.offset[1], fit.offset[2]);
  if (fit.yaw !== 0) bodyGen.rotation.y = fit.yaw;
  if (fit.scaleX) bodyGen.scale.x = fit.scaleX;
  bodyRoot.add(bodyGen);

  // Mount lamps
  const lamps: THREE.Mesh[] = [];
  for (const lp of fit.lamps) {
    const lampMesh = createLampDisc(lp);
    bodyRoot.add(lampMesh);
    lamps.push(lampMesh);
  }

  // Mount seats
  for (const s of fit.sockets) {
    if (s.name === 'seat') {
      const seat = createSeatProp();
      seat.position.set(s.at[0], s.at[1], s.at[2]);
      bodyRoot.add(seat);
    }
  }

  // Mount steering wheel
  const driverSeat = fit.sockets.find((s) => s.name === 'seat');
  const parts: Record<string, THREE.Object3D> = {};
  if (driverSeat) {
    const sw = createSteeringWheelProp();
    sw.position.set(driverSeat.at[0], driverSeat.at[1] + 0.1, driverSeat.at[2] + 0.35);
    bodyRoot.add(sw);
    parts.steeringWheel = sw;
  }

  // Crawler arm
  if (kind === 'crawler') {
    const armGen = getGenSync('crawler-arm', level);
    if (armGen) {
      armGen.position.set(0, 0.4, 3.35);
      bodyRoot.add(armGen);
      parts.arm = armGen;
    }
  }

  // Wheels
  let wheelRoot: THREE.Group | null = null;
  if (kind !== 'crawler') {
    const wheelGen = getGenSync(`${kind}-wheel`, level);
    if (wheelGen) {
      wheelRoot = new THREE.Group();
      wheelRoot.name = `gen-wheel-${kind}`;
      const inner = wheelGen.clone(true);
      inner.position.set(fit.wheelOffset[0], fit.wheelOffset[1], fit.wheelOffset[2]);
      const orient = new THREE.Group();
      // Turn wheel so axle (z in GLB) aligns along x
      orient.rotation.set(0, Math.PI / 2, 0);
      orient.add(inner);
      wheelRoot.add(orient);
    }
  }

  return {
    body: bodyRoot,
    wheel: wheelRoot,
    wheelRadius: fit.wheelRadius,
    hubs: fit.hubs as [number, number, number][],
    colliders: [{ min: [-1, 0, -2], max: [1, 2, 2] }],
    sockets: fit.sockets as { name: string; at: [number, number, number] }[],
    lamps,
    parts,
  };
}

// ---------------------------------------------------------------------------
// VEHICLE FABRICATOR
// ---------------------------------------------------------------------------

export function createGenFabricator(
  level: GenLevel = 'low',
  stage: number = 6,
  materials?: LabMaterials
): FabricatorStationMesh {
  const m = materials ?? createRovergearMaterials();
  const frameGen = getGenSync('fabricator-frame', level);
  const headGen = getGenSync('fabricator-head', level);

  if (!frameGen || !headGen) {
    return fallbackFabricator(m, { stage });
  }

  const group = new THREE.Group();
  group.name = 'gen-fabricator-station';

  // Frame stands on hardpoint ring (top center)
  frameGen.position.set(0, RING_TOP_Y, 0);
  group.add(frameGen);

  // Print head mounted to gantry beam
  headGen.position.set(0, RING_TOP_Y + 4.75, 0);
  group.add(headGen);

  const lamps = [
    createLampDisc([-2.7, RING_TOP_Y + 4.95, 0]),
    createLampDisc([2.7, RING_TOP_Y + 4.95, 0]),
  ];
  for (const l of lamps) group.add(l);

  return {
    group,
    colliders: [{ min: [-3.7, 0, -3.2], max: [3.7, 5, 3.2] }],
    sockets: [
      { name: 'bed', at: [0, RING_TOP_Y + 0.7, 0] },
      { name: 'power', at: [-2.4, RING_TOP_Y + 0.55, -2.6] },
    ],
    lamps,
    parts: { head: headGen },
  };
}

// ---------------------------------------------------------------------------
// MACHINES ON HARDPOINTS
// ---------------------------------------------------------------------------

export function createGenMachineProp(
  kind: MachineKind,
  level: GenLevel = 'low',
  stage: number = 6,
  materials?: LabMaterials
): MachineProp {
  const m = materials ?? createRovergearMaterials();
  const still = (): void => undefined;
  const lift = new THREE.Vector3(0, RING_TOP_Y, 0);

  switch (kind) {
    case 'mill':
    case 'heavy-mill': {
      const gen = getGenSync('mill', level);
      if (!gen) return fallbackMachineProp(m as any, kind, stage);
      const group = new THREE.Group();
      group.name = `gen-${kind}`;
      gen.position.copy(lift);
      group.add(gen);
      const vent = new THREE.Vector3(0, RING_TOP_Y + 4.0, 0);
      const power = new THREE.Vector3(0, RING_TOP_Y + 0.2, -1.8);
      return {
        group,
        power,
        vent,
        top: null,
        lamps: [],
        animate: still,
        light: still,
      };
    }
    case 'press':
    case 'heavy-press': {
      const frame = getGenSync('press-frame', level);
      const ram1 = getGenSync('press-ram', level);
      const ram2 = getGenSync('press-ram', level);
      if (!frame || !ram1 || !ram2) return fallbackMachineProp(m as any, kind, stage);
      const group = new THREE.Group();
      group.name = `gen-${kind}`;
      frame.position.copy(lift);
      group.add(frame);
      const restY = RING_TOP_Y + 2.1;
      ram1.position.set(-0.55, restY, 0);
      ram2.position.set(0.55, restY, 0);
      group.add(ram1, ram2);
      const vent = new THREE.Vector3(0, RING_TOP_Y + 4.0, 0);
      const power = new THREE.Vector3(0, RING_TOP_Y + 0.2, 0.8);
      return {
        group,
        power,
        vent,
        top: null,
        lamps: [],
        animate: (t, run) => {
          ram1.position.y = restY - Math.max(0, Math.sin(t * 3.1)) * 0.35 * run;
          ram2.position.y = restY - Math.max(0, Math.sin(t * 3.1 + Math.PI)) * 0.35 * run;
        },
        light: still,
      };
    }
    case 'projector':
    case 'heavy-projector': {
      const mast = getGenSync('projector-mast', level);
      const head = getGenSync('projector-head', level);
      if (!mast || !head) return fallbackMachineProp(m as any, kind, stage);
      const group = new THREE.Group();
      group.name = `gen-${kind}`;
      mast.position.copy(lift);
      group.add(mast);
      head.position.set(0, RING_TOP_Y + 2.65, 0);
      group.add(head);
      const vent = new THREE.Vector3(0, RING_TOP_Y + 3.0, 0);
      const power = new THREE.Vector3(0, RING_TOP_Y + 0.2, 0.8);
      return {
        group,
        power,
        vent,
        top: null,
        lamps: [],
        animate: (t, run) => {
          head.rotation.x = Math.sin(t * 0.35) * 0.08 * run;
        },
        light: still,
      };
    }
    case 'water':
    case 'heavy-water': {
      const gen = getGenSync('watermaker', level);
      if (!gen) return fallbackMachineProp(m as any, kind, stage);
      const group = new THREE.Group();
      group.name = `gen-${kind}`;
      gen.position.copy(lift);
      group.add(gen);
      const vent = new THREE.Vector3(0, RING_TOP_Y + 4.0, 0);
      const power = new THREE.Vector3(0, RING_TOP_Y + 0.2, 0.8);
      return {
        group,
        power,
        vent,
        top: null,
        lamps: [],
        animate: still,
        light: still,
      };
    }
    default:
      return fallbackMachineProp(m as any, kind, stage);
  }
}

// ---------------------------------------------------------------------------
// FIXTURES IN STRUCTURES
// ---------------------------------------------------------------------------

export function createGenFixture(
  kind: 'bin' | 'repeater' | 'drafting' | 'weapon-bench',
  level: GenLevel = 'low'
): KitPieceResult | null {
  const mesh = getGenSync(kind, level);
  if (!mesh) return null;

  const group = new THREE.Group();
  group.name = `gen-fixture-${kind}`;
  group.add(mesh);

  let colliders: Box[] = [];
  let sockets: Socket[] = [];

  switch (kind) {
    case 'bin':
      colliders = [{ min: [-1, 0, -1], max: [1, 2, 1] }];
      sockets = [{ name: 'port', at: [0, 1, 0] }];
      break;
    case 'repeater':
      colliders = [{ min: [-1.7, 0, -1.5], max: [1.7, 6, 1.5] }];
      sockets = [{ name: 'power', at: [0, 0.2, -1.5] }];
      break;
    case 'drafting':
      colliders = [{ min: [-1.2, 0, -0.6], max: [1.2, 1.4, 0.6] }];
      sockets = [{ name: 'use', at: [0, 0.8, 0] }];
      break;
    case 'weapon-bench':
      colliders = [{ min: [-1.2, 0, -0.4], max: [1.2, 1.6, 0.4] }];
      sockets = [{ name: 'bench', at: [0, 0.8, 0] }];
      break;
  }

  return {
    group,
    colliders,
    lamps: [],
    sockets,
  };
}
