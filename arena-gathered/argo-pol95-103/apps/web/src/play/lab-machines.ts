// ============================================================================
// File: apps/web/src/play/lab-machines.ts
// TICKET-06 (OPUS_NOTE_16 Section 2a — Lab Overhaul):
// - Builds and dresses the 4 distinct, grounded, cabled right-wall Lab machines
//   matching Sheet 07 (Preset Rack, Preset Bench, Preset Combiner, Hardware Fabricator),
//   each with its Sheet 07 pixel exhaust colour (#b46bff, #ff3d8a, #7cff4d) when powered,
//   zero floating parts, and E-interaction metadata (what each machine does).
// - Builds the 6 recessed 3D ribbed copper field coils on the Gate uprights (replacing
//   the floating flat orange rectangles).
// - Builds vertical square-section conduit drops from overhead cable trays to wall machines.
// ============================================================================

import * as THREE from 'three';
import type { Box, LabMaterials, Prop } from '@hm/labkit';

export type RightWallMachineId =
  | 'preset-rack'
  | 'preset-bench'
  | 'preset-combiner'
  | 'fabricator';

export type LabStationId =
  | RightWallMachineId
  | 'planet-table'
  | 'weapon-bench';

export interface LabStationSpec {
  readonly id: LabStationId;
  readonly name: string;
  readonly action: string;
  readonly prompt: string;
  /** Clear explanation of what pressing E on this machine does. */
  readonly summary: string;
  /** Sheet 07 pixel exhaust hex colour when powered (off = spews nothing). */
  readonly pixelColor: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly reach: number;
  readonly footprint: readonly [number, number, number]; // [w, h, d]
}

/**
 * The four right-wall (East wall, x ≈ 7.45) Studio & Fabrication machines from Sheet 07,
 * ordered north to south, plus the Planet Table and Weapon Bench.
 */
export const RIGHT_WALL_MACHINES: readonly LabStationSpec[] = [
  {
    id: 'preset-rack',
    name: 'Preset Rack',
    action: 'open-preset-rack',
    prompt: '[E] Preset Rack — Browse & equip .smx cartridges from the library',
    summary:
      'Cartridge Library: stores unlocked .smx cartridges in an 8×6 illuminated array and slots them into your active Apply Beam loadout.',
    pixelColor: '#b46bff',
    x: 7.45,
    z: -7.0,
    yaw: -Math.PI / 2,
    reach: 2.8,
    footprint: [2.2, 2.4, 0.55],
  },
  {
    id: 'preset-bench',
    name: 'Preset Bench',
    action: 'open-preset-bench',
    prompt: '[E] Preset Bench — Encode texture presets & draft building blueprints',
    summary:
      'Texture Preset & Drafting Bench: writes harvested Pxd substrate onto blank cartridges to create surface texture presets and combines primitives with maps into building blueprints.',
    pixelColor: '#ff3d8a',
    x: 7.45,
    z: -5.0,
    yaw: -Math.PI / 2,
    reach: 2.6,
    footprint: [1.8, 1.5, 0.92],
  },
  {
    id: 'preset-combiner',
    name: 'Preset Combiner',
    action: 'open-preset-combiner',
    prompt: '[E] Preset Combiner — Fuse 2–4 cartridges into a hybrid preset',
    summary:
      'Preset Combiner: mixes 2 to 4 input cartridges inside a containment sphere to synthesize a hybrid .smx cartridge (e.g. mud texture + terrain shaping = road cart).',
    pixelColor: '#b46bff',
    x: 7.45,
    z: -3.3,
    yaw: -Math.PI / 2,
    reach: 2.5,
    footprint: [1.1, 1.45, 1.1],
  },
  {
    id: 'fabricator',
    name: 'Hardware Fabricator',
    action: 'open-fabricator',
    prompt: '[E] Hardware Fabricator — Print tools, suit parts & field kit',
    summary:
      'Hardware Fabricator: prints suit upgrades (visor, rebreather, shield), weapon frames/parts, and field hardware from Vtx shape facets and refined ore.',
    pixelColor: '#7cff4d',
    x: 7.45,
    z: -1.35,
    yaw: -Math.PI / 2,
    reach: 2.6,
    footprint: [1.16, 1.68, 0.88],
  },
];

export const LAB_STATIONS: readonly LabStationSpec[] = [
  ...RIGHT_WALL_MACHINES,
  {
    id: 'planet-table',
    name: 'Planet Table',
    action: 'open-planet-table',
    prompt: '[E] Planet Table — Inspect plot hologram & Planetary Grid co-op',
    summary:
      'Plot Hologram Table: projects a live 3D amber hologram of your lunar plot, active S-Space rifts, and Planetary Grid co-op room codes.',
    pixelColor: '#ffc13d',
    x: 5.0,
    z: -5.0,
    yaw: 0,
    reach: 2.8,
    footprint: [2.4, 1.05, 2.4],
  },
  {
    id: 'weapon-bench',
    name: 'Weapon Bench',
    action: 'open-weapon-bench',
    prompt: '[E] Weapon Bench — Forge & fit beam and sidearm attachments',
    summary:
      'Armory Weapon Bench: forges and fits core, barrel, sight, and cell attachments onto the Extraction Beam and Pulse Sidearm.',
    pixelColor: '#ff7b3d',
    x: 6.0,
    z: 2.4,
    yaw: Math.PI,
    reach: 2.6,
    footprint: [2.0, 1.5, 0.9],
  },
];

export function stationById(id: string): LabStationSpec | null {
  return LAB_STATIONS.find((s) => s.id === id) ?? null;
}

/**
 * Pure helper: finds the nearest E-interactable Lab station within its interaction `reach`
 * (or optional `maxReach` override) of player position `(x, z)`.
 */
export function nearestLabStation(
  pos: { readonly x: number; readonly z: number },
  maxReach?: number,
): LabStationSpec | null {
  let best: LabStationSpec | null = null;
  let bestDist = Infinity;
  for (const st of LAB_STATIONS) {
    const d = Math.hypot(pos.x - st.x, pos.z - st.z);
    const limit = maxReach ?? st.reach;
    if (d <= limit && d < bestDist) {
      best = st;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Pure 3D ray-vs-AABB test to find which Lab station the player's crosshair ray hits within `reach` metres.
 */
export function aimLabStation(
  origin: { readonly x: number; readonly y: number; readonly z: number },
  dir: { readonly x: number; readonly y: number; readonly z: number },
  reach = 3.2,
): LabStationSpec | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len <= 1e-8) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;

  let best: LabStationSpec | null = null;
  let bestT = reach;

  for (const st of LAB_STATIONS) {
    const cos = Math.abs(Math.cos(st.yaw));
    const sin = Math.abs(Math.sin(st.yaw));
    const hw = (st.footprint[0] * cos + st.footprint[2] * sin) / 2 + 0.12;
    const hd = (st.footprint[0] * sin + st.footprint[2] * cos) / 2 + 0.12;
    const minX = st.x - hw;
    const maxX = st.x + hw;
    const minY = 0;
    const maxY = st.footprint[1] + 0.15;
    const minZ = st.z - hd;
    const maxZ = st.z + hd;

    let tmin = 0;
    let tmax = bestT;

    const axes: readonly [number, number, number, number][] = [
      [origin.x, dx, minX, maxX],
      [origin.y, dy, minY, maxY],
      [origin.z, dz, minZ, maxZ],
    ];

    // Only match stations in front of the ray origin
    const toCenterDot = (st.x - origin.x) * dx + (st.z - origin.z) * dz;
    if (toCenterDot <= 0) continue;
    let hit = true;
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) {
          hit = false;
          break;
        }
      } else {
        let t1 = (lo - o) / d;
        let t2 = (hi - o) / d;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) {
          hit = false;
          break;
        }
      }
    }

    if (hit && tmin <= bestT) {
      bestT = tmin;
      best = st;
    }
  }

  return best;
}

export interface LabMachineRig {
  readonly spec: LabStationSpec;
  readonly prop: Prop;
  readonly dressGroup: THREE.Group;
  readonly plumeGroup: THREE.Group;
  setPowered(power01: number): void;
  setOperating(active: boolean): void;
  isOperating(): boolean;
  animate(now: number, power01: number): void;
}

/**
 * Builds the Sheet 07 Pixel Exhaust Plume + distinctive functional 3D accents for one of the 4
 * right-wall Lab machines. Attached onto a dedicated `dressGroup` that is preserved across
 * `adoptGenerated()` so generated models also keep their grounded base, glowing bays, and pixel plumes!
 */
export function createRightWallMachineRig(
  id: RightWallMachineId,
  baseProp: Prop,
  m: LabMaterials,
): LabMachineRig {
  const spec = RIGHT_WALL_MACHINES.find((s) => s.id === id)!;
  baseProp.group.userData.stationId = spec.id;
  baseProp.group.userData.stationAction = spec.action;
  baseProp.group.userData.stationPrompt = spec.prompt;

  const dressGroup = new THREE.Group();
  dressGroup.name = `station-dress:${id}`;
  // rack, bench, combiner are placed at yaw = +Math.PI/2 (labkit convention) and their GLBs turn by Math.PI;
  // rotate their dressGroup by Math.PI so front details (+z) face -x into the room (POL-103).
  dressGroup.rotation.y = id === 'fabricator' ? 0 : Math.PI;
  baseProp.group.add(dressGroup);

  // Grounded bolted dark-steel anchor pad at y = 0 so nothing ever floats even after GLB swap
  const [fw, , fd] = spec.footprint;
  const padMesh = new THREE.Mesh(
    new THREE.BoxGeometry(fw * 0.94, 0.06, fd * 0.94),
    m.darkSteel,
  );
  padMesh.position.set(0, 0.03, 0);
  dressGroup.add(padMesh);

  const hazardFront = new THREE.Mesh(
    new THREE.BoxGeometry(fw * 0.92, 0.04, 0.018),
    m.hazard,
  );
  hazardFront.position.set(0, 0.03, fd * 0.47);
  dressGroup.add(hazardFront);

  // Instanced pixel exhaust plume (1 draw call per station instead of 14 separate meshes;
  // visible ONLY while the station is both powered and actively operating, T06 / Rule 10).
  const PLUME_COUNT = 14;
  const plumeGroup = new THREE.Group();
  plumeGroup.name = `station-plume:${id}`;
  plumeGroup.visible = false;
  const plumeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.pixelColor),
    transparent: true,
    opacity: 0.92,
  });
  const pixelGeo = new THREE.BoxGeometry(0.032, 0.032, 0.032);
  const plumeInstanced = new THREE.InstancedMesh(pixelGeo, plumeMat, PLUME_COUNT);
  plumeInstanced.name = `station-plume-instanced:${id}`;
  plumeInstanced.frustumCulled = false;
  const pixelSeeds: { phase: number; radius: number; speed: number }[] = [];
  const dummyM = new THREE.Matrix4();
  const dummyP = new THREE.Vector3();
  const dummyQ = new THREE.Quaternion();
  const dummyS = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < PLUME_COUNT; i++) {
    const phase = (i / PLUME_COUNT) * Math.PI * 2;
    const radius = 0.04 + (i % 4) * 0.035;
    const speed = 0.65 + (i % 3) * 0.22;
    pixelSeeds.push({ phase, radius, speed });
    dummyP.set(Math.cos(phase) * radius, 0, Math.sin(phase) * radius);
    plumeInstanced.setMatrixAt(i, dummyM.compose(dummyP, dummyQ, dummyS));
  }
  plumeInstanced.instanceMatrix.needsUpdate = true;
  plumeGroup.add(plumeInstanced);
  dressGroup.add(plumeGroup);

  const accentLamps: THREE.MeshStandardMaterial[] = [];
  const makeGlowMat = (hex: string, baseHex = '#10141a'): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({
      color: baseHex,
      emissive: new THREE.Color(hex),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.2,
    });
    accentLamps.push(mat);
    return mat;
  };

  let movingPart: THREE.Object3D | null = null;

  if (id === 'preset-rack') {
    // Sheet 07 Preset Rack: horizontal picker carriage + glowing cartridge slots + violet wisp
    plumeGroup.position.set(0, 1.55, 0.24);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.045, 0.06), m.gunmetal);
    rail.position.set(0, 1.18, 0.22);
    dressGroup.add(rail);

    const carriage = new THREE.Group();
    carriage.position.set(0, 1.18, 0.25);
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.09), m.darkSteel);
    const carLaser = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.04),
      makeGlowMat('#b46bff'),
    );
    carLaser.position.set(0, 0, 0.04);
    const sideBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.05),
      makeGlowMat('#ffc13d'),
    );
    sideBeacon.position.set(0.88, 0, 0);
    carriage.add(carBody, carLaser);
    rail.add(sideBeacon);
    dressGroup.add(carriage);
    movingPart = carriage;
  } else if (id === 'preset-bench') {
    // Sheet 07 Preset Bench: backlit cyan/pink light-table + hazard upper tool hood + pink pixel stream
    plumeGroup.position.set(0.18, 1.12, -0.08);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.42, 0.18), m.gunmetal);
    hood.position.set(0, 1.12, -0.32);
    const hoodHazard = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.05, 0.19), m.hazard);
    hoodHazard.position.set(0, 1.31, -0.32);
    const lightPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.016, 0.46),
      makeGlowMat('#ff3d8a', '#1d1222'),
    );
    lightPad.position.set(-0.12, 0.87, 0.04);
    const writerHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), m.darkSteel);
    writerHead.position.set(0.18, 1.02, -0.08);
    dressGroup.add(hood, hoodHazard, lightPad, writerHead);
    movingPart = writerHead;
  } else if (id === 'preset-combiner') {
    // Sheet 07 Preset Combiner: 4 angled green cartridge injectors + glass dome + spinning violet plasma core
    plumeGroup.position.set(0, 1.32, 0);
    const coreMat = makeGlowMat('#b46bff', '#241038');
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 1), coreMat);
    core.position.set(0, 1.12, 0);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      m.glass,
    );
    dome.position.set(0, 0.96, 0);
    dressGroup.add(core, dome);

    const injMat = makeGlowMat('#7cff4d', '#0e2414');
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const inj = new THREE.Group();
      inj.position.set(Math.cos(ang) * 0.34, 0.92, Math.sin(ang) * 0.34);
      inj.rotation.y = -ang;
      inj.rotation.z = 0.52;
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), m.gunmetal);
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.065), injMat);
      cell.position.y = 0.04;
      inj.add(tube, cell);
      dressGroup.add(inj);
    }
    movingPart = core;
  } else {
    // Sheet 07 Hardware Fabricator: enclosed square cabinet, green print chamber, X-Y print head, green pixels
    plumeGroup.position.set(0, 1.62, 0);
    const chamberGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.62, 0.02),
      makeGlowMat('#7cff4d', '#0c2212'),
    );
    chamberGlow.position.set(0, 0.98, 0.41);
    const sideLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.12),
      makeGlowMat('#7cff4d', '#0c2212'),
    );
    sideLamp.position.set(-0.56, 0.88, 0.18);
    const printHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), m.darkSteel);
    printHead.position.set(0, 1.12, 0.25);
    dressGroup.add(chamberGlow, sideLamp, printHead);
    movingPart = printHead;
  }

  let operating = false;
  let lastPower = 0;

  // Ensure initial height alignment
  return {
    spec,
    prop: baseProp,
    dressGroup,
    plumeGroup,
    setPowered(power01: number): void {
      const p = Math.max(0, Math.min(1, power01));
      lastPower = p;
      plumeGroup.visible = operating && p > 0.25;
      plumeMat.opacity = 0.85 * p;
      for (const mat of accentLamps) {
        mat.emissiveIntensity = 1.8 * p;
      }
      for (const l of baseProp.lamps) {
        const lm = l.material as THREE.MeshStandardMaterial;
        if (lm && 'emissiveIntensity' in lm) {
          lm.emissiveIntensity = 1.4 * p;
        }
      }
    },
    setOperating(active: boolean): void {
      operating = Boolean(active);
      plumeGroup.visible = operating && lastPower > 0.25;
    },
    isOperating(): boolean {
      return operating;
    },
    animate(now: number, power01: number): void {
      const p = Math.max(0, Math.min(1, power01));
      lastPower = p;
      if (p <= 0.05) {
        plumeGroup.visible = false;
        return;
      }
      plumeGroup.visible = operating && p > 0.25;
      if (plumeGroup.visible) {
        for (let i = 0; i < pixelSeeds.length; i++) {
          const pc = pixelSeeds[i]!;
          const cycle = (now * pc.speed + pc.phase / (Math.PI * 2)) % 1;
          const angle = now * 1.8 + pc.phase;
          const spread = pc.radius * (0.4 + cycle * 1.4);
          dummyP.set(
            Math.cos(angle) * spread,
            cycle * 0.55,
            Math.sin(angle) * spread,
          );
          const s = Math.max(0.2, 1 - cycle * 0.65);
          dummyS.set(s, s, s);
          plumeInstanced.setMatrixAt(i, dummyM.compose(dummyP, dummyQ, dummyS));
        }
        plumeInstanced.instanceMatrix.needsUpdate = true;
      }
      if (movingPart) {
        if (id === 'preset-rack') {
          movingPart.position.x = Math.sin(now * 0.9) * 0.62;
        } else if (id === 'preset-bench') {
          movingPart.position.x = 0.12 + Math.sin(now * 2.2) * 0.22;
        } else if (id === 'preset-combiner') {
          movingPart.rotation.y = now * 1.8;
          movingPart.rotation.x = Math.sin(now * 1.3) * 0.35;
        } else if (id === 'fabricator') {
          movingPart.position.x = Math.sin(now * 2.6) * 0.18;
          movingPart.position.y = 0.96 + Math.abs(Math.cos(now * 1.7)) * 0.22;
        }
      }
    },
  };
}

/**
 * Builds the enclosed square-section Hardware Fabricator prop (`fabricator`, Sheet 07 bottom-right)
 * on 4 levelling feet with a hazard-striped base skirt, glass bay window, and print bed.
 */
export function buildHardwareFabricatorProp(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const colliders: Box[] = [];
  const lamps: THREE.Mesh[] = [];

  const W = 1.12;
  const H = 1.64;
  const D = 0.84;
  const footH = 0.08;

  // 4 square-section levelling feet
  for (const fx of [-W / 2 + 0.1, W / 2 - 0.1]) {
    for (const fz of [-D / 2 + 0.1, D / 2 - 0.1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, footH, 0.1), m.darkSteel);
      foot.position.set(fx, footH / 2, fz);
      group.add(foot);
    }
  }

  // Base skirt with hazard band
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, D), m.darkSteel);
  skirt.position.set(0, footH + 0.07, 0);
  group.add(skirt);

  // Main cabinet body
  const bodyH = H - footH - 0.14;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, bodyH, D - 0.04), m.paint);
  body.position.set(0, footH + 0.14 + bodyH / 2, 0);
  group.add(body);

  // Front recessed bay frame + glass window
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.78, 0.04), m.gunmetal);
  bezel.position.set(0, 1.0, D / 2 - 0.01);
  const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.015), m.glass);
  windowPane.position.set(0, 1.0, D / 2 + 0.012);
  group.add(bezel, windowPane);

  colliders.push({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2] });
  return { group, colliders, sockets: [], lamps };
}

/**
 * Builds a vertical square-section steel cable drop from an overhead cable tray (`trayY = 4.2 m`)
 * down into the top of a grounded machine at `(x, z)` with top height `machineTopY`.
 */
export function buildCableDrop(
  m: LabMaterials,
  x: number,
  z: number,
  machineTopY: number,
  trayY = 4.2,
): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(0.2, trayY - machineTopY);
  const midY = machineTopY + h / 2;

  const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.055, h, 0.055), m.darkSteel);
  conduit.position.set(x, midY, z);
  const glandBottom = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.095), m.copper);
  glandBottom.position.set(x, machineTopY + 0.03, z);
  const glandTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.09), m.gunmetal);
  glandTop.position.set(x, trayY - 0.025, z);

  g.add(conduit, glandBottom, glandTop);
  return g;
}

/**
 * Builds the 6 recessed 3D ribbed copper field-coil blocks for the generated Gate (`gate.glb`),
 * ordered strictly bottom to top (`3` pairs: bottom left/right, middle left/right, top left/right)
 * with ZERO floating flat orange rectangles and ZERO top-lintel bar (matching `06-sheet-gate.png`).
 */
export function buildGateRibbedCoils(
  m: LabMaterials,
  keep: <T extends { dispose(): void }>(x: T) => T,
): { readonly housings: THREE.Group; readonly coils: THREE.Mesh[] } {
  const housings = new THREE.Group();
  housings.name = 'gate-ribbed-coils';
  const coils: THREE.Mesh[] = [];

  // 3 vertical tiers on left (-1.34) and right (+1.34) uprights, recessed into the upright face (z = 0.36)
  const positions: readonly (readonly [number, number, number])[] = [
    [-1.34, 1.26, 0.36],
    [1.34, 1.26, 0.36],
    [-1.34, 1.88, 0.36],
    [1.34, 1.88, 0.36],
    [-1.34, 2.50, 0.36],
    [1.34, 2.50, 0.36],
  ];

  const coilW = 0.28;
  const coilH = 0.44;
  const coilD = 0.14;
  const finGeo = keep(new THREE.BoxGeometry(coilW, coilH, coilD));
  const collarGeo = keep(new THREE.BoxGeometry(coilW + 0.05, coilH + 0.05, coilD * 0.65));

  for (const [cx, cy, cz] of positions) {
    const collar = new THREE.Mesh(collarGeo, m.darkSteel);
    collar.position.set(cx, cy, cz - 0.02);
    housings.add(collar);

    const mat = keep(
      new THREE.MeshStandardMaterial({
        color: '#c96f28',
        emissive: new THREE.Color('#ff8811'),
        emissiveIntensity: 0,
        roughness: 0.28,
        metalness: 0.88,
      }),
    );
    const coilBlock = new THREE.Mesh(finGeo, mat);
    coilBlock.position.set(cx, cy, cz);

    // Add 6 dark-steel rib separators so each block reads as a 3D ribbed copper coil stack, never a flat rectangle
    for (let r = 0; r < 6; r++) {
      const ry = -coilH / 2 + ((r + 0.5) * coilH) / 6;
      const rib = new THREE.Mesh(
        keep(new THREE.BoxGeometry(coilW + 0.012, 0.018, coilD + 0.012)),
        m.darkSteel,
      );
      rib.position.set(0, ry, 0);
      coilBlock.add(rib);
    }

    housings.add(coilBlock);
    coils.push(coilBlock);
  }

  return { housings, coils };
}
