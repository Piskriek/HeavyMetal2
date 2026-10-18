// ============================================================================
// File: apps/web/src/play/turret-view.ts
// TASK-32 / TICKET-13 (Window C): 3D Split-Part Perimeter Defense Turret Assembly
// (`turret-base`, `turret-yoke`, `turret-gun` + procedural code round barrel &
// square muzzle shroud per 20-turret-s6.png) + #ffc13d Targeting Laser
// ============================================================================

import * as THREE from 'three';
import * as S from '@hm/structure';
import { getGenSync, loadGen, type GenLevel } from '../assets/gen';
import {
  stepTurretBrain,
  type TurretSolidBox,
  TURRET_LASER_HEX,
  TURRET_SOCKET_CONSTANTS,
  type TurretBrainInput,
  type TurretBrainOutput,
} from '@hm/plotsim';

export { TURRET_SOCKET_CONSTANTS, stepTurretBrain };

export interface TurretInstance3D {
  readonly id: number;
  readonly root: THREE.Group;
  readonly baseGroup: THREE.Group;
  readonly yokePivot: THREE.Group;
  readonly gunPivot: THREE.Group;
  readonly barrelGroup: THREE.Group;
  readonly laserLine: THREE.Line;
  update(input: Omit<TurretBrainInput, 'turret'>): TurretBrainOutput;
  /** Puts a generated model on a part, in place of its fallback. */
  setPart(part: TurretPart, obj: THREE.Object3D): void;
  /** Whether a part is the generated model or still the fallback. */
  partSource(part: TurretPart): TurretPartSource;
  disposed(): boolean;
  dispose(): void;
}

/**
 * Builds the procedural round barrel + square muzzle shroud + under-barrel #ffc13d laser emitter
 * box in code (since round tubes break quadric mesh reduction on generated GLBs).
 */
export function createCodeBarrelAndShroud(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'turret-code-barrel';

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x2b3038,
    roughness: 0.45,
    metalness: 0.75,
  });
  const shroudMat = new THREE.MeshStandardMaterial({
    color: 0x3d4450,
    roughness: 0.55,
    metalness: 0.65,
  });
  const amberMat = new THREE.MeshBasicMaterial({ color: TURRET_LASER_HEX });

  // This group's origin is the barrel collar's centre (on the gun's pitch pivot at BARREL_COLLAR_OFFSET_M).
  const len = TURRET_SOCKET_CONSTANTS.BARREL_CYLINDER_LENGTH_M;
  const rad = TURRET_SOCKET_CONSTANTS.BARREL_CYLINDER_RADIUS_M;
  const cylGeo = new THREE.CylinderGeometry(rad, rad, len, 16);
  cylGeo.rotateX(Math.PI / 2);
  cylGeo.translate(0, 0, len / 2);
  const barrelMesh = new THREE.Mesh(cylGeo, barrelMat);
  g.add(barrelMesh);

  // The square collar block the round barrel seats in (0.15 m square, Rule 11)
  const [cw, ch, cd] = TURRET_SOCKET_CONSTANTS.BARREL_COLLAR_SIZE_M;
  const collarMesh = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), shroudMat);
  g.add(collarMesh);

  // Square muzzle shroud on the barrel's front end: it spans the last 0.16 m, so the tip sits MUZZLE_TIP_OFFSET_M from the pivot
  const [sw, sh, sd] = TURRET_SOCKET_CONSTANTS.MUZZLE_SHROUD_SIZE_M;
  const shroudMesh = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), shroudMat);
  shroudMesh.position.set(0, 0, len + sd / 2);
  g.add(shroudMesh);

  // The #ffc13d laser emitter box, under the collar: LASER_EMITTER_OFFSET_M from the pivot, so relative to the collar it is
  // (0, -0.16, 0) (the collar sits at 0.059 m above the pivot and the emitter at -0.101 m).
  const [ex, ey, ez] = TURRET_SOCKET_CONSTANTS.LASER_EMITTER_OFFSET_M;
  const [cx, cy, cz] = TURRET_SOCKET_CONSTANTS.BARREL_COLLAR_OFFSET_M;
  const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), shroudMat);
  laserBox.name = 'turret-laser-emitter';
  laserBox.position.set(ex - cx, ey - cy, ez - cz);
  const lensMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), amberMat);
  lensMesh.position.set(0, 0, 0.075);
  laserBox.add(lensMesh);
  g.add(laserBox);

  return g;
}

/** The three packed parts, by their registry ids (apps/web/src/assets/gen/registry.json). */
export const TURRET_PART_IDS = { base: 'turret-base', yoke: 'turret-yoke', gun: 'turret-gun' } as const;
export const TURRET_PARTS: readonly TurretPart[] = ['base', 'yoke', 'gun'];
export type TurretPart = keyof typeof TURRET_PART_IDS;
export type TurretPartSource = 'gen' | 'fallback';

/**
 * The generated model of a part from the cache (the best level loaded), or null while it is not loaded yet. The
 * preload (CORE_GEN_ASSETS, behind the loading bar) fills the cache; a turret placed before it finished gets the fallback
 * and swaps the model in with loadMissingTurretParts.
 */
export function cachedTurretPart(part: TurretPart): THREE.Group | null {
  const id = TURRET_PART_IDS[part];
  return getGenSync(id, 'high') ?? getGenSync(id, 'mid') ?? getGenSync(id, 'low');
}

/** Loads the generated model of every part still on its fallback and swaps it in (TICKET-13). */
export function loadMissingTurretParts(inst: TurretInstance3D, level: GenLevel = 'low'): void {
  for (const part of TURRET_PARTS) {
    if (inst.partSource(part) === 'gen') continue;
    loadGen(TURRET_PART_IDS[part], level)
      .then((obj) => { if (!inst.disposed()) inst.setPart(part, obj); })
      .catch((err: unknown) => console.warn(`turret part ${part} stays on its fallback:`, err));
  }
}

/**
 * Assembles a 3-part Perimeter Defense Turret on a corner socket (TICKET-13). Each part is the generated model when it is
 * in memory; otherwise it is a complete fallback built from boxes and pins, sized to the packed parts' measured geometry:
 * the base plate and pedestal up to the turntable (0.672 m), the yoke's bridge and two arms up to the trunnions (0.639 m
 * above the turntable), the gun body in the 0.486 m gap between the arms, and a pin from each side of the gun into an arm.
 * So the base, yoke and gun always touch, whichever parts are loaded. Each part's source is in root.userData.partSource.
 */
export function createTurretInstance3D(opts: {
  readonly id: number;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly parent?: THREE.Object3D;
  readonly baseMesh?: THREE.Object3D | null;
  readonly yokeMesh?: THREE.Object3D | null;
  readonly gunMesh?: THREE.Object3D | null;
}): TurretInstance3D {
  const root = new THREE.Group();
  root.name = `perimeter-turret-${opts.id}`;
  root.position.set(opts.position.x, opts.position.y, opts.position.z);
  if (opts.parent) opts.parent.add(root);

  const C = TURRET_SOCKET_CONSTANTS;
  const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x454c57, roughness: 0.65, metalness: 0.45 });
  const piece = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rotZ = 0): THREE.Mesh => {
    const m = new THREE.Mesh(geo, fallbackMat);
    m.position.set(x, y, z);
    m.rotation.z = rotZ;
    m.userData.fallback = true;
    return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => piece(new THREE.BoxGeometry(w, h, d), x, y, z);

  // 1. Fixed base: the plate (0.9 m square, 0.2 m high) and the pedestal up to the turntable top
  const baseGroup = new THREE.Group();
  baseGroup.name = 'turret-base';
  const plateH = 0.2;
  const pedestalH = C.YAW_AXIS_HEIGHT_M - plateH;
  baseGroup.add(box(0.9, plateH, 0.9, 0, plateH / 2, 0), box(0.5, pedestalH, 0.5, 0, plateH + pedestalH / 2, 0));
  root.add(baseGroup);

  // 2. Yawing yoke: its origin is the turntable top; a bridge on the turntable and two arms up to the trunnions
  const yokePivot = new THREE.Group();
  yokePivot.name = 'turret-yoke';
  yokePivot.position.set(0, C.YAW_AXIS_HEIGHT_M, 0);
  const trunnionY = C.TRUNNION_HEIGHT_ON_YOKE_M;
  yokePivot.add(box(0.6, 0.06, 0.34, 0, 0.03, 0));
  for (const side of [-1, 1]) yokePivot.add(box(0.07, trunnionY, 0.12, side * 0.278, trunnionY / 2, 0));
  root.add(yokePivot);

  // 3. Pitching gun at the trunnions: the body (its origin at GUN_MESH_OFFSET_FROM_PIVOT_M, bottom centre), two pins
  const gunPivot = new THREE.Group();
  gunPivot.name = 'turret-gun';
  gunPivot.position.set(0, trunnionY, 0);
  const [gx, gy, gz] = C.GUN_MESH_OFFSET_FROM_PIVOT_M;
  gunPivot.add(box(0.42, 0.508, 0.9, gx, gy + 0.254, gz));
  for (const side of [-1, 1]) gunPivot.add(piece(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), side * 0.23, 0, 0, Math.PI / 2));
  // the procedural round barrel and square shroud, on the collar at BARREL_COLLAR_OFFSET_M
  const barrelGroup = createCodeBarrelAndShroud();
  const [bx, by, bz] = C.BARREL_COLLAR_OFFSET_M;
  barrelGroup.position.set(bx, by, bz);
  gunPivot.add(barrelGroup);
  yokePivot.add(gunPivot);

  // 4. The #ffc13d targeting laser, in the root's frame
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const laserMat = new THREE.LineBasicMaterial({ color: TURRET_LASER_HEX, transparent: true, opacity: 0.88 });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  laserLine.name = 'turret-laser';
  laserLine.visible = false;
  laserLine.frustumCulled = false;
  root.add(laserLine);

  // the part sources, and the swap: a generated model replaces that part's fallback (its boxes and pins are removed)
  const sources: Record<TurretPart, TurretPartSource> = { base: 'fallback', yoke: 'fallback', gun: 'fallback' };
  root.userData.partSource = sources;
  const hosts: Record<TurretPart, THREE.Group> = { base: baseGroup, yoke: yokePivot, gun: gunPivot };
  const setPart = (part: TurretPart, obj: THREE.Object3D): void => {
    const host = hosts[part];
    for (const child of [...host.children]) if (child.userData.fallback === true) host.remove(child);
    // a holder keeps the model's own placement (a tweak wraps it) apart from the part's place on its host
    const holder = new THREE.Group();
    holder.name = `turret-${part}-gen`;
    holder.add(obj);
    if (part === 'gun') holder.position.set(gx, gy, gz);
    host.add(holder);
    sources[part] = 'gen';
  };
  if (opts.baseMesh) setPart('base', opts.baseMesh);
  if (opts.yokeMesh) setPart('yoke', opts.yokeMesh);
  if (opts.gunMesh) setPart('gun', opts.gunMesh);

  let currentYaw = 0;
  let currentPitch = 0;
  let cooldownLeftS = 0;
  let gone = false;

  return {
    id: opts.id,
    root,
    baseGroup,
    yokePivot,
    gunPivot,
    barrelGroup,
    laserLine,
    update(input) {
      const out = stepTurretBrain({
        ...input,
        turret: {
          x: root.position.x,
          y: root.position.y,
          z: root.position.z,
          currentYaw,
          currentPitch,
          cooldownLeftS,
        },
      });
      currentYaw = out.yaw;
      currentPitch = out.pitch;
      cooldownLeftS = out.nextCooldownS;

      yokePivot.rotation.y = currentYaw;
      gunPivot.rotation.x = -currentPitch;

      if (out.laserActive && out.laserTo) {
        laserLine.visible = true;
        const posAttr = laserGeo.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(0, out.laserFrom.x - root.position.x, out.laserFrom.y - root.position.y, out.laserFrom.z - root.position.z);
        posAttr.setXYZ(1, out.laserTo.x - root.position.x, out.laserTo.y - root.position.y, out.laserTo.z - root.position.z);
        posAttr.needsUpdate = true;
      } else {
        laserLine.visible = false;
      }

      return out;
    },
    setPart,
    partSource: (part) => sources[part],
    disposed: () => gone,
    dispose() {
      gone = true;
      laserGeo.dispose();
      laserMat.dispose();
      if (root.parent) root.parent.remove(root);
    },
  };
}

/**
 * The base's solid boxes for a turret's line of fire (TICKET-13): every wall-type edge piece as the thin box along its line,
 * and the fixtures and pillars as small squares at their place. The brain works on the ground plane, so heights are not
 * used. `at` gives a piece's world position (base/world's pieceAt).
 */
export function turretSolidBoxes(
  base: S.Base,
  at: (p: S.Piece) => { readonly x: number; readonly y: number; readonly z: number } | null,
): TurretSolidBox[] {
  const out: TurretSolidBox[] = [];
  const byId = new Map<number, S.Structure>(base.structures.map((st) => [st.id, st] as const));
  const C = S.CELL;
  const HALF = 0.15;
  const WALLS = new Set<string>(['wall', 'airlock', 'halfWall', 'windowWall', 'doorframe', 'door']);
  const FIXTURES = new Set<string>(['bin', 'bench', 'repeater', 'lifeSupport', 'weaponBench']);
  for (const p of base.pieces) {
    const st = byId.get(p.s);
    if (!st) continue;
    if (WALLS.has(p.kind) && (p.r === 0 || p.r === 1)) {
      // an edge runs along u (r 0) from the cell's corner to the next, or along v (r 1)
      const a = S.toWorld(st, p.i * C, p.j * C, p.k);
      const b = p.r === 0 ? S.toWorld(st, (p.i + 1) * C, p.j * C, p.k) : S.toWorld(st, p.i * C, (p.j + 1) * C, p.k);
      out.push({
        minX: Math.min(a.x, b.x) - HALF,
        maxX: Math.max(a.x, b.x) + HALF,
        minZ: Math.min(a.z, b.z) - HALF,
        maxZ: Math.max(a.z, b.z) + HALF,
      });
    } else if (FIXTURES.has(p.kind) || p.kind === 'pillar') {
      const c = at(p);
      if (!c) continue;
      const h = p.kind === 'pillar' ? 0.2 : 0.75;
      out.push({ minX: c.x - h, maxX: c.x + h, minZ: c.z - h, maxZ: c.z + h });
    }
  }
  return out;
}
