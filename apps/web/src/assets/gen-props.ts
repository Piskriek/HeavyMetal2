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
  type LabMaterials as RovergearMaterials,
  createMaterials as createRovergearMaterials,
  scout as fallbackScout,
  hauler as fallbackHauler,
  crawler as fallbackCrawler,
  fabricator as fallbackFabricator,
} from '@hm/rovergear';
import { MODULAR_SCOUT_SOCKETS, snapAerialToShellY, SCOUT_REAR_SOCKETS, HAULER_REAR_SOCKETS } from '@hm/plotsim';
import { RING_TOP_Y } from '../play/machine-props';
import type { Box, Socket, KitPieceResult } from '../base/kit-pieces';
import { latticeGenAssets } from '../base/lattice-gen';
import { kitFabricator } from '../play/plot-kits';

// ---------------------------------------------------------------------------
// THE SCOUT, ASSEMBLED FROM PARTS (TASK-15)
// ---------------------------------------------------------------------------

/**
 * The assembled scout is OFF: players get the one-piece `scout-body` until Opus reviews the shots and flips this.
 * `?scout=modular` turns it on for testing (read when the page loads, so the preload includes its parts).
 */
export const USE_MODULAR_SCOUT = true;

/** Whether the assembled scout is on: the switch above, or the ?scout=modular URL override. */
export function modularScoutOn(): boolean {
  if (USE_MODULAR_SCOUT) return true;
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('scout') === 'modular';
}

export const SCOUT_PART_ASSETS: readonly string[] = ['scout-chassis', 'scout-shell', 'headlight', 'vehicle-seat'];

/**
 * Every offset and scale of the assembled scout, in metres, in the rover frame: the origin at the hub height, +y up,
 * +z forward, +x across. The hubs stay at x ±0.8, z ±1.1 (@hm/rover: track 1.6, wheelbase 2.2), so the physics does not
 * change. The part sizes are measured from the packed GLBs' own vertices (world bounds, metres):
 *   scout-chassis  1.688 x 0.584 x 2.996: x ±0.843, y 0.005..0.589, z ±1.498; its hub housings sit at z ±1.005
 *   scout-shell    1.290 x 1.180 x 2.398: x ±0.645, y 0.003..1.183, z ±1.199
 *   headlight      0.206 x 0.298 x 0.147
 *   vehicle-seat   0.765 x 1.098 x 0.853
 *   scout-wheel    0.865 x 0.891 x 0.423 (the registry says 0.46 wide; the file measures 0.423)
 * Each scale is per axis; the ones that differ from 1 are listed in the report.
 */
export const SCOUT_ASSEMBLY = {
  // the wheel's inner faces: 0.8 - 0.423 / 2 = 0.5885. The chassis width fits between them (x ±0.5885), and its
  // length puts the housings on the hubs (z ±1.005 scaled to ±1.1). Its y puts the housings' centre on the hub height.
  chassis: { offset: [0, -0.297, 0], scale: [0.6977, 1, 1.0945] },
  // the cab sits on the deck (the chassis top 0.589 less 0.297 = 0.292, and the cab's floor is 0.003 above its origin),
  // its width fitted to the deck (x ±0.5885); its length (2.4) fits the 3.28 m deck between the bumpers
  shell: { offset: [0, 0.289, 0], scale: [0.9124, 1, 1] },
  // work lamps on the two front-bumper pads (z at the front end of the chassis, +z is forward), the second one mirrored
  headlight: { x: 0.394, y: -0.1, z: 1.55 },
  // the driver's seat on the cab floor (y 0.289) at the centre, and the yoke at hand height in front of it
  seat: { y: 0.286, z: -0.25 },
  yoke: { at: [0, 0.98, 0.2] },
  // a thin square mast on a small square base, on the roof at the rear-right (facing +z, the right hand is -x)
  aerial: { x: -0.3, z: -0.8, roofY: 1.472, baseSize: 0.14, mastWidth: 0.035, mastHeight: 1.2 },
} as const;

export const CORE_GEN_ASSETS: readonly string[] = [
  ...latticeGenAssets(),
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
  // TICKET-13: the perimeter turret's three packed parts (turret-view.ts), preloaded behind the same loading bar
  'turret-base',
  'turret-yoke',
  'turret-gun',
];

export type CoreGenAsset = string;

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
      ...SCOUT_REAR_SOCKETS.map((s) => ({ name: s.id, at: s.offsetM })),
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
      ...HAULER_REAR_SOCKETS.map((s) => ({ name: s.id, at: s.offsetM })),
    ],
  },
  crawler: {
    // Crawler body (TASK-15): 2.40 x 2.20 x 6.20 m, centred on x and z, bottom at 0 in its own frame, no squash.
    // The GLB already faces +z: the low nose (the hinge bracket, the drill arm and the lamps) is at +z, the tall cab
    // at -z, so yaw is 0. The rover's origin is wheelRadius above the ground, so the body's bottom sits on the
    // ground at -wheelRadius. Body frame y = rover y + 0.45.
    offset: [0, -0.45, 0],
    yaw: 0,
    wheelOffset: [0, 0, 0],
    wheelRadius: 0.45,
    hubs: [],
    lamps: [
      [-0.7, 0.45, 3.0],
      [0.7, 0.45, 3.0],
    ],
    sockets: [
      // the cab: its floor on the deck (body y 1.0), at the centre of the cab (x 0.35, z -1.5)
      { name: 'seat', at: [0.35, 0.55, -1.5] },
      { name: 'drill', at: [0, 0.45, 3.6] },
      { name: 'mast', at: [0.4, 1.75, -1.5] },
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

function createSeatProp(level: GenLevel = 'low'): THREE.Object3D {
  const gen = getGenSync('vehicle-seat', level);
  if (gen) return gen;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f242b, roughness: 0.6, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), mat);
  base.position.set(0, 0.06, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.1), mat);
  back.position.set(0, 0.38, -0.2);
  g.add(base, back);
  return g;
}

function createSteeringWheelProp(level: GenLevel = 'low'): THREE.Object3D {
  const gen = getGenSync('steering-wheel', level);
  if (gen) return gen;
  const g = new THREE.Group();
  g.name = 'scout-square-yoke';
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.3 });
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.045), mat);
  col.rotation.x = -Math.PI / 6;
  col.position.set(0, 0.15, 0.08);
  // Square [-u-] yoke (POL-50: no round torus steering wheel)
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0, 0.28, 0.16);
  yokeGroup.rotation.x = -Math.PI / 6;
  const barBottom = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.035), mat);
  barBottom.position.set(0, -0.08, 0);
  const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.035), mat);
  gripL.position.set(-0.1425, 0, 0);
  const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.035), mat);
  gripR.position.set(0.1425, 0, 0);
  yokeGroup.add(barBottom, gripL, gripR);
  g.add(col, yokeGroup);
  return g;
}

/** The aerial: a square mast on a square base, built here (it is not a packed asset: the owner's rule, no thin rods). */
function scoutAerial(a: typeof SCOUT_ASSEMBLY.aerial): THREE.Group {
  const g = new THREE.Group();
  g.name = 'scout-aerial';
  const snappedY = snapAerialToShellY(a.roofY, a.roofY);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.45, metalness: 0.55 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(a.baseSize, 0.05, a.baseSize), mat);
  base.position.set(a.x, snappedY + 0.025, a.z);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(a.mastWidth, a.mastHeight, a.mastWidth), mat);
  mast.position.set(a.x, snappedY + 0.05 + a.mastHeight / 2, a.z);
  g.add(base, mast);
  void MODULAR_SCOUT_SOCKETS;
  return g;
}

/**
 * The scout body assembled from its parts (chassis, cab, two headlights, seat, yoke, aerial), placed by
 * SCOUT_ASSEMBLY. Returns null when a packed part is missing, so the caller falls back to the one-piece body.
 */
function assembleScoutBody(level: GenLevel): { body: THREE.Group; lamps: THREE.Mesh[]; yoke: THREE.Object3D } | null {
  const chassisGen = getGenSync('scout-chassis', level);
  const shellGen = getGenSync('scout-shell', level);
  const lampGen = getGenSync('headlight', level);
  if (!chassisGen || !shellGen || !lampGen) return null;
  const A = SCOUT_ASSEMBLY;

  const body = new THREE.Group();
  body.name = 'gen-rover-body-scout-modular';

  const chassis = new THREE.Group();
  chassis.name = 'scout-chassis';
  chassis.position.set(A.chassis.offset[0], A.chassis.offset[1], A.chassis.offset[2]);
  chassis.scale.set(A.chassis.scale[0], A.chassis.scale[1], A.chassis.scale[2]);
  chassis.add(chassisGen);
  body.add(chassis);

  const shell = new THREE.Group();
  shell.name = 'scout-shell';
  shell.position.set(A.shell.offset[0], A.shell.offset[1], A.shell.offset[2]);
  shell.scale.set(A.shell.scale[0], A.shell.scale[1], A.shell.scale[2]);
  shell.add(shellGen);
  body.add(shell);

  // each lamp is its own mesh with its own material, so setRoverLamp lights one lamp only
  const lamps: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const lampRoot = getGenSync('headlight', level) ?? lampGen.clone(true);
    const holder = new THREE.Group();
    holder.name = side > 0 ? 'scout-headlight-r' : 'scout-headlight-l';
    holder.position.set(side * A.headlight.x, A.headlight.y, A.headlight.z);
    if (side < 0) holder.scale.x = -1;
    const meshes: THREE.Mesh[] = [];
    lampRoot.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
    const lens = meshes[0];
    if (lens) {
      lens.material = (lens.material as THREE.Material).clone();
      lens.userData.isRoverLamp = true;
      lamps.push(lens);
    }
    holder.add(lampRoot);
    body.add(holder);
  }

  const seat = getGenSync('vehicle-seat', level) ?? createSeatProp(level);
  seat.position.set(0, A.seat.y, A.seat.z);
  body.add(seat);

  const yoke = createSteeringWheelProp(level);
  yoke.position.set(A.yoke.at[0], A.yoke.at[1], A.yoke.at[2]);
  body.add(yoke);

  body.add(scoutAerial(A.aerial));
  return { body, lamps, yoke };
}

/** The rover's wheel, turned so its axle runs along x (the wheels are the same at every stage). Null for a crawler. */
function wheelRootFor(kind: RoverKind, fit: VehicleFit, level: GenLevel): THREE.Group | null {
  if (kind === 'crawler') return null;
  const wheelGen = getGenSync(`${kind}-wheel`, level);
  if (!wheelGen) return null;
  const wheelRoot = new THREE.Group();
  wheelRoot.name = `gen-wheel-${kind}`;
  const inner = wheelGen.clone(true);
  inner.position.set(fit.wheelOffset[0], fit.wheelOffset[1], fit.wheelOffset[2]);
  const orient = new THREE.Group();
  // Turn wheel so axle (z in GLB) aligns along x
  orient.rotation.set(0, Math.PI / 2, 0);
  orient.add(inner);
  wheelRoot.add(orient);
  return wheelRoot;
}

/**
 * Builds a rover model using generated assets if preloaded, or falling back to @hm/rovergear.
 * The scout is assembled from its parts when modularScoutOn() (or opts.modular) and every part is loaded.
 */
export function createGenRover(
  kind: RoverKind,
  level: GenLevel = 'low',
  stage: number = 6,
  materials?: RovergearMaterials,
  opts: { readonly modular?: boolean } = {}
): RoverGearMesh {
  const m = materials ?? createRovergearMaterials();
  const fit = VEHICLE_FIT[kind];
  const fallback = kind === 'scout'
    ? fallbackScout(m, { stage })
    : kind === 'hauler'
      ? fallbackHauler(m, { stage })
      : fallbackCrawler(m, { stage });

  if (kind === 'scout' && (opts.modular ?? modularScoutOn())) {
    const assembled = assembleScoutBody(level);
    if (assembled) {
      return {
        body: assembled.body,
        wheel: wheelRootFor(kind, fit, level),
        wheelRadius: fit.wheelRadius,
        hubs: fit.hubs as [number, number, number][],
        colliders: fallback.colliders,
        sockets: [{ name: 'seat', at: [0, SCOUT_ASSEMBLY.seat.y + 0.6, SCOUT_ASSEMBLY.seat.z] }],
        lamps: assembled.lamps,
        parts: { steeringWheel: assembled.yoke },
      };
    }
  }

  const bodyGen = getGenSync(`${kind}-body`, level);
  if (!bodyGen) {
    return fallback;
  }

  const bodyRoot = new THREE.Group();
  bodyRoot.name = `gen-rover-body-${kind}`;

  // Position body inside rover frame
  bodyGen.position.set(fit.offset[0], fit.offset[1], fit.offset[2]);
  if (fit.yaw !== 0) bodyGen.rotation.y = fit.yaw;
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
      const seat = createSeatProp(level);
      seat.position.set(s.at[0], s.at[1], s.at[2]);
      bodyRoot.add(seat);
    }
  }

  // Mount steering wheel
  const driverSeat = fit.sockets.find((s) => s.name === 'seat');
  const parts: Record<string, THREE.Object3D> = {};
  if (driverSeat) {
    const sw = createSteeringWheelProp(level);
    sw.position.set(driverSeat.at[0], driverSeat.at[1] + 0.1, driverSeat.at[2] + 0.35);
    bodyRoot.add(sw);
    parts.steeringWheel = sw;
  }

  // Crawler arm
  if (kind === 'crawler') {
    const armGen = getGenSync('crawler-arm', level);
    if (armGen) {
      // on the hinge bracket: its back face at the nose (z 3.1), at the nose's height
      armGen.position.set(0, 0.0, 3.35);
      bodyRoot.add(armGen);
      parts.arm = armGen;
    }
  }

  // Wheels
  const wheelRoot = wheelRootFor(kind, fit, level);

  return {
    body: bodyRoot,
    wheel: wheelRoot,
    wheelRadius: fit.wheelRadius,
    hubs: fit.hubs as [number, number, number][],
    colliders: fallback.colliders,
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
  materials?: RovergearMaterials
): FabricatorStationMesh {
  // Argo's frame kit (TICKET-39) when the kit frames are on: the same sockets, its carriage as the sliding head
  const kit = kitFabricator(level, stage, RING_TOP_Y);
  if (kit) {
    const lampAt = (name: string, fallback: readonly [number, number, number]): readonly [number, number, number] => {
      const s = kit.sockets[name]?.at;
      return s ? [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0] : fallback;
    };
    const lamps = [createLampDisc(lampAt('lampLeft', [-2.7, RING_TOP_Y + 4.95, 0])), createLampDisc(lampAt('lampRight', [2.7, RING_TOP_Y + 4.95, 0]))];
    for (const l of lamps) kit.group.add(l);
    return {
      group: kit.group,
      colliders: [{ min: [-3.7, 0, -3.2], max: [3.7, 5, 3.2] }],
      sockets: [
        { name: 'bed', at: [0, RING_TOP_Y + 0.7, 0] },
        { name: 'power', at: [-2.4, RING_TOP_Y + 0.55, -2.6] },
      ],
      lamps,
      parts: { head: kit.head },
    };
  }
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
