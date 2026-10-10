import * as THREE from 'three';
import * as basekit from '@hm/basekit';
import * as basekit2 from '@hm/basekit2';
import * as basegear from '@hm/basegear';
import type { Kind } from '@hm/structure';
import * as S from '@hm/structure';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt } from './world';

export type Box = basekit.Box;
export type Socket = basegear.Socket;

export interface KitPieceResult {
  readonly group: THREE.Group;
  readonly colliders: readonly Box[];
  readonly lamps: readonly THREE.Mesh[];
  readonly sockets?: readonly Socket[];
  readonly parts?: Record<string, THREE.Object3D>;
}

export interface KitPieceInstance {
  readonly group: THREE.Group;
  readonly colliders: readonly Box[];
  readonly lamps: readonly THREE.Mesh[];
  readonly sockets?: readonly Socket[];
  readonly parts?: Record<string, THREE.Object3D>;
}

// 5-step Integrity Materials (R3) - bright unlit overlay colors on dark steel
export const INTEGRITY_5_MATERIALS = {
  blue: new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  }),
  green: new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.75,
  }),
  yellow: new THREE.MeshBasicMaterial({
    color: 0xeab308,
    transparent: true,
    opacity: 0.75,
  }),
  orange: new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.75,
  }),
  red: new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.75,
  }),
};

export function integrityMaterialForSupport(support: number): THREE.Material {
  if (support >= 0.999) return INTEGRITY_5_MATERIALS.blue;
  if (support >= 0.6) return INTEGRITY_5_MATERIALS.green;
  if (support >= 0.4) return INTEGRITY_5_MATERIALS.yellow;
  if (support >= 0.28) return INTEGRITY_5_MATERIALS.orange;
  return INTEGRITY_5_MATERIALS.red;
}

export function integrityColorName(support: number): 'blue' | 'green' | 'yellow' | 'orange' | 'red' {
  if (support >= 0.999) return 'blue';
  if (support >= 0.6) return 'green';
  if (support >= 0.4) return 'yellow';
  if (support >= 0.28) return 'orange';
  return 'red';
}

/** Compute foundation skirt height (0..3m clamped, rounded up to 0.25m). */
export function computeSkirt(
  world: BaseWorld,
  env: WorldEnv,
  piece: S.Piece,
): number {
  if (piece.kind !== 'foundation') return 0;
  const st = world.base.structures.find((s) => s.id === piece.s);
  if (!st) return 0;
  const pos = pieceAt(world.base, piece);
  if (!pos) return 0;

  const c0 = S.toWorld(st, piece.i * 4, piece.j * 4, 0);
  const c1 = S.toWorld(st, (piece.i + 1) * 4, piece.j * 4, 0);
  const c2 = S.toWorld(st, piece.i * 4, (piece.j + 1) * 4, 0);
  const c3 = S.toWorld(st, (piece.i + 1) * 4, (piece.j + 1) * 4, 0);

  const minGround = Math.min(
    env.heightAt(c0.x, c0.z),
    env.heightAt(c1.x, c1.z),
    env.heightAt(c2.x, c2.z),
    env.heightAt(c3.x, c3.z),
  );

  const raw = pos.y - 0.5 - minGround;
  const clamped = Math.max(0, Math.min(3, raw));
  const rounded = Math.ceil(clamped / 0.25) * 0.25;
  return rounded;
}

/** Pivot offsets for kit pieces so origin matches pieceAt() cell center. */
export const KIT_PIVOT_OFFSETS: Record<Kind, [number, number, number]> = {
  foundation: [-2, 0, -2],
  floor: [-2, 0, -2],
  ramp: [-2, 0, -2],
  wall: [-2, 0, 0],
  airlock: [-2, 0, 0],
  pillar: [0, 0, 0],
  hardpoint: [-4, 0, -4],
  bin: [-2, 0, -2],
  bench: [-2, 0, -2],
  repeater: [-2, 0, -2],

  // Roof kinds (cell pivot [-2, 0, -2])
  roof: [-2, 0, -2],
  lowRoof: [-2, 0, -2],
  roofOuter: [-2, 0, -2],
  roofInner: [-2, 0, -2],
  // Edge pivot [-2, 0, 0]
  ridgeCap: [-2, 0, 0],
  gable: [-2, 0, 0],

  // 4a kinds
  halfWall: [-2, 0, 0],
  windowWall: [-2, 0, 0],
  doorframe: [-2, 0, 0],
  door: [-2, 0, 0],
  railing: [-2, 0, 0],
  ladder: [-2, 0, 0],
  stairs: [-2, 0, -2],
  lifeSupport: [-2, 0, -2],
  weaponBench: [-2, 0, -2],
};

/**
 * Cache for kit pieces per (kind, stage, skirt) for low-end / GTX 950M GPUs.
 * Geometry and materials are created once and shared across all piece instances.
 */
export class KitPieceCache {
  private basekitMats: basekit.LabMaterials | null = null;
  private basegearMats: basegear.LabMaterials | null = null;
  private templates = new Map<string, KitPieceResult>();

  getBasekitMaterials(): basekit.LabMaterials {
    if (!this.basekitMats) this.basekitMats = basekit.createMaterials();
    return this.basekitMats;
  }

  getBasegearMaterials(): basegear.LabMaterials {
    if (!this.basegearMats) this.basegearMats = basegear.createMaterials();
    return this.basegearMats;
  }

  getTemplate(kind: Kind, stage: number, skirt = 0): KitPieceResult {
    const key = `${kind}:${stage}:${skirt}`;
    const existing = this.templates.get(key);
    if (existing) return existing;

    const bkm = this.getBasekitMaterials();
    const bgm = this.getBasegearMaterials();
    let rawGroup: THREE.Group = new THREE.Group();
    let rawColliders: Box[] = [];
    let rawLamps: THREE.Mesh[] = [];
    let rawSockets: Socket[] | undefined = undefined;

    switch (kind) {
      case 'foundation': {
        const res = basekit.foundation(bkm, { stage, skirt });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'wall': {
        const res = basekit.wall(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'pillar': {
        const res = basekit.pillar(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'floor': {
        const res = basekit.floor(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'ramp': {
        const res = basekit.ramp(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'airlock': {
        const res = basekit.airlock(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'hardpoint': {
        const res = basegear.hardpoint(bgm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        rawSockets = res.sockets;
        break;
      }
      case 'bin': {
        const res = basegear.bin(bgm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        rawSockets = res.sockets;
        break;
      }
      case 'bench': {
        const res = basegear.draftingTable(bgm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        rawSockets = res.sockets;
        break;
      }
      case 'repeater': {
        const res = basegear.repeater(bgm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        rawSockets = res.sockets;
        break;
      }
      case 'roof': {
        const res = basekit.pitchedRoof(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'lowRoof': {
        const res = basekit.lowRoof(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'roofOuter': {
        const res = basekit.roofOuterCorner(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'roofInner': {
        const res = basekit.roofInnerCorner(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'ridgeCap': {
        const res = basekit.ridgeCap(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'gable': {
        const res = basekit.gable(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'halfWall': {
        const res = basekit2.halfWall(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'windowWall': {
        const res = basekit2.windowWall(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'doorframe': {
        const res = basekit2.doorframe(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'door': {
        const res = basekit2.door(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'railing': {
        const res = basekit2.railing(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'ladder': {
        const res = basekit2.ladder(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'stairs': {
        const res = basekit2.stairs(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'lifeSupport': {
        const res = basekit2.lifeSupport(bkm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        break;
      }
      case 'weaponBench': {
        const res = basegear.draftingTable(bgm, { stage });
        rawGroup = res.group;
        rawColliders = res.colliders;
        rawLamps = res.lamps;
        rawSockets = res.sockets;
        break;
      }
      default: {
        throw new Error(`Unknown structural kind: ${kind}`);
      }
    }

    // Mark lamps in raw template so clones can be identified
    for (const lamp of rawLamps) {
      lamp.userData.isLamp = true;
    }

    // Wrap in pivot group
    const [ox, oy, oz] = KIT_PIVOT_OFFSETS[kind] ?? [0, 0, 0];
    const pivot = new THREE.Group();
    pivot.name = `pivot-${kind}`;
    rawGroup.position.set(ox, oy, oz);
    pivot.add(rawGroup);
    pivot.updateMatrixWorld(true);

    // Transform colliders by pivot offset
    const colliders: Box[] = rawColliders.map((c) => ({
      min: [c.min[0] + ox, c.min[1] + oy, c.min[2] + oz],
      max: [c.max[0] + ox, c.max[1] + oy, c.max[2] + oz],
    }));

    // Transform sockets by pivot offset
    const sockets: Socket[] | undefined = rawSockets?.map((s) => ({
      name: s.name,
      at: [s.at[0] + ox, s.at[1] + oy, s.at[2] + oz],
    }));

    const result: KitPieceResult = {
      group: pivot,
      colliders,
      lamps: rawLamps,
      sockets,
    };

    this.templates.set(key, result);
    return result;
  }

  /** Instantiate a piece clone sharing geometry and materials. */
  instantiate(kind: Kind, stage: number, skirt = 0): KitPieceInstance {
    const template = this.getTemplate(kind, stage, skirt);
    const clonedGroup = template.group.clone(true);

    // Discover cloned lamps and store kitMat for integrity restoration
    const lamps: THREE.Mesh[] = [];
    clonedGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.userData.isLamp) {
          lamps.push(child);
        }
        child.userData.kitMat = child.material;
      }
    });

    const parts: Record<string, THREE.Object3D> = {};
    const leaf = clonedGroup.getObjectByName('door-leaf');
    if (leaf) parts.leaf = leaf;

    return {
      group: clonedGroup,
      colliders: template.colliders,
      lamps,
      sockets: template.sockets,
      parts: Object.keys(parts).length > 0 ? parts : undefined,
    };
  }

  /** Dispose all cached geometries and materials across templates. */
  dispose(): void {
    for (const tmpl of this.templates.values()) {
      tmpl.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
        }
      });
    }
    this.templates.clear();

    if (this.basekitMats) {
      for (const mat of Object.values(this.basekitMats)) {
        mat.dispose();
      }
      this.basekitMats = null;
    }

    if (this.basegearMats) {
      for (const mat of Object.values(this.basegearMats)) {
        mat.dispose();
      }
      this.basegearMats = null;
    }
  }
}

/** Global default cache instance for base rendering. */
export const globalKitPieceCache = new KitPieceCache();
