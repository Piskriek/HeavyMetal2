import * as THREE from 'three';
import * as S from '@hm/structure';
import * as L from '@hm/lattice';
import * as basegear from '@hm/basegear';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt, structureEnv, BENCH_REACH, relays } from './world';
import { WalkWorld, type PlacedPiece } from './walk';
import {
  globalKitPieceCache,
  computeSkirt,
  integrityMaterialForSupport,
  type Box,
} from './kit-pieces';

interface ActivePieceEntry {
  group: THREE.Group;
  colliders: readonly Box[];
  lamps: readonly THREE.Mesh[];
  kind: S.Kind;
  pos: { x: number; y: number; z: number };
  yaw: number;
  parts?: Record<string, THREE.Object3D>;
  doorAngle?: number;
  targetDoorAngle?: number;
}

interface CollapsingPiece {
  group: THREE.Group;
  elapsed: number;
  duration: number;
  initialY: number;
}

export class PieceMeshManager {
  readonly root: THREE.Group;
  readonly walkWorld: WalkWorld = new WalkWorld();
  private pieceMap: Map<number, ActivePieceEntry> = new Map();
  private collapsing: CollapsingPiece[] = [];
  private lastIntegrity = false;
  private lastStage = 1;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'base-pieces-root';
  }

  sync(world: BaseWorld, env: WorldEnv, integrity: boolean): void {
    const activePieces = world.base.pieces;
    const activeIds = new Set<number>();
    const supportMap = integrity ? S.supports(world.base, structureEnv(env)) : null;

    // Stage change: rebuild all pieces from new stage cache, then dispose old cache
    if (world.stage !== this.lastStage) {
      for (const entry of this.pieceMap.values()) {
        this.root.remove(entry.group);
      }
      this.pieceMap.clear();
      globalKitPieceCache.dispose();
      this.lastStage = world.stage;
    }

    const linkedGroups = L.links(world.boxes, relays(world, env));
    const placedForWalk: PlacedPiece[] = [];

    for (const piece of activePieces) {
      activeIds.add(piece.id);
      let entry = this.pieceMap.get(piece.id);

      const st = world.base.structures.find((s) => s.id === piece.s);
      const pos = pieceAt(world.base, piece);
      if (!pos || !st) continue;

      let extraAngle = 0;
      if (
        piece.kind === 'wall' ||
        piece.kind === 'airlock' ||
        piece.kind === 'halfWall' ||
        piece.kind === 'windowWall' ||
        piece.kind === 'doorframe' ||
        piece.kind === 'door' ||
        piece.kind === 'railing' ||
        piece.kind === 'ladder'
      ) {
        if (piece.r === 1) extraAngle = -Math.PI / 2;
      } else if (piece.kind === 'gable') {
        const roof = S.roofOf(world.base, piece);
        if (roof) {
          const highSides = S.roofSidesOf(roof.kind, roof.r).high;
          const highSide = highSides[0];
          if (piece.r === 0) {
            extraAngle = highSide === '-x' ? Math.PI : 0;
          } else {
            extraAngle = highSide === '+z' ? -Math.PI / 2 : Math.PI / 2;
          }
        }
      } else if (piece.deg !== undefined) {
        extraAngle = -(piece.deg * Math.PI) / 180;
      } else if (
        piece.kind === 'ramp' ||
        piece.kind === 'stairs' ||
        piece.kind === 'bench' ||
        piece.kind === 'bin' ||
        piece.kind === 'repeater' ||
        piece.kind === 'lifeSupport' ||
        piece.kind === 'roof' ||
        piece.kind === 'lowRoof' ||
        piece.kind === 'roofOuter' ||
        piece.kind === 'roofInner' ||
        piece.kind === 'ridgeCap'
      ) {
        extraAngle = -piece.r * (Math.PI / 2);
      }
      const totalYaw = -st.yaw + extraAngle;

      if (!entry) {
        // Compute foundation skirt
        const skirt = computeSkirt(world, env, piece);

        // Instantiate clone from GTX 950M shared cache
        const instance = globalKitPieceCache.instantiate(piece.kind, world.stage, skirt);
        instance.group.userData.pieceId = piece.id;
        instance.group.userData.pieceKind = piece.kind;

        instance.group.position.set(pos.x, pos.y, pos.z);
        instance.group.rotation.y = totalYaw;
        instance.group.updateMatrixWorld(true);

        this.root.add(instance.group);

        const isDoor = piece.kind === 'door';
        const doorAngle = isDoor && piece.open ? (-100 * Math.PI) / 180 : 0;
        if (isDoor && instance.parts?.leaf) {
          instance.parts.leaf.rotation.y = doorAngle;
        }

        entry = {
          group: instance.group,
          colliders: instance.colliders,
          lamps: instance.lamps,
          kind: piece.kind,
          pos,
          yaw: totalYaw,
          parts: instance.parts,
          doorAngle,
          targetDoorAngle: doorAngle,
        };
        this.pieceMap.set(piece.id, entry);
      } else {
        // Update transform if needed
        entry.group.position.set(pos.x, pos.y, pos.z);
        entry.group.rotation.y = totalYaw;
        entry.group.updateMatrixWorld(true);
        entry.pos = pos;
        entry.yaw = totalYaw;
        if (piece.kind === 'door') {
          entry.targetDoorAngle = piece.open ? (-100 * Math.PI) / 180 : 0;
        }
      }

      placedForWalk.push({
        id: piece.id,
        kind: piece.kind,
        pos,
        yaw: totalYaw,
        colliders: entry.colliders,
      });

      // Update lamp lighting
      if (entry.lamps.length > 0) {
        if (piece.kind === 'bin') {
          const isLinked = linkedGroups.some((g: readonly number[]) => g.includes(piece.id));
          for (const lamp of entry.lamps) {
            basegear.setLamp(lamp, isLinked ? 1 : 0);
          }
        } else if (piece.kind === 'repeater') {
          for (const lamp of entry.lamps) {
            basegear.setLamp(lamp, 1);
          }
        } else if (piece.kind === 'bench') {
          const distToPlayer = Math.hypot(world.player.x - pos.x, world.player.z - pos.z);
          const isNear = distToPlayer <= BENCH_REACH;
          for (const lamp of entry.lamps) {
            basegear.setLamp(lamp, isNear ? 1 : 0);
          }
        } else if (piece.kind === 'airlock') {
          for (const lamp of entry.lamps) {
            basegear.setLamp(lamp, 1);
          }
        }
      }

      // Material assignment: 5-step integrity overlay vs restoring kit materials
      if (integrity && supportMap) {
        const sup = supportMap.get(piece.id) ?? 0;
        const mat = integrityMaterialForSupport(sup);
        this.applyOverlayMaterial(entry.group, mat);
      } else if (this.lastIntegrity && !integrity) {
        this.restoreKitMaterials(entry.group);
      }
    }

    this.lastIntegrity = integrity;
    this.walkWorld.setPieces(placedForWalk);

    // Remove any pieces that disappeared without collapse animation
    for (const [id, entry] of this.pieceMap.entries()) {
      if (!activeIds.has(id)) {
        this.root.remove(entry.group);
        this.pieceMap.delete(id);
      }
    }
  }

  handleRemoval(removedId: number, collapsedIds: readonly number[]): void {
    // The removed piece vanishes immediately
    const removedEntry = this.pieceMap.get(removedId);
    if (removedEntry) {
      this.root.remove(removedEntry.group);
      this.pieceMap.delete(removedId);
    }

    // Collapsed pieces animate: drop 0.5m, tilt, and fade over 0.6s
    for (const cId of collapsedIds) {
      const entry = this.pieceMap.get(cId);
      if (entry) {
        this.pieceMap.delete(cId);
        // Clone materials to allow fading
        entry.group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            child.material = (child.material as THREE.Material).clone();
            child.material.transparent = true;
          }
        });
        this.collapsing.push({
          group: entry.group,
          elapsed: 0,
          duration: 0.6,
          initialY: entry.group.position.y,
        });
      }
    }
  }

  update(dt: number): void {
    for (let i = this.collapsing.length - 1; i >= 0; i--) {
      const col = this.collapsing[i]!;
      col.elapsed += dt;
      const progress = Math.min(1, col.elapsed / col.duration);

      col.group.position.y = col.initialY - progress * 0.5;
      col.group.rotation.x += dt * 1.8;
      col.group.rotation.z += dt * 1.2;

      const alpha = 1 - progress;
      col.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          child.material.opacity = alpha;
        }
      });

      if (progress >= 1) {
        this.root.remove(col.group);
        col.group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
        this.collapsing.splice(i, 1);
      }
    }

    // Door swing ease over 0.4s
    for (const entry of this.pieceMap.values()) {
      if (entry.kind === 'door' && entry.parts?.leaf && entry.targetDoorAngle !== undefined) {
        const cur = entry.doorAngle ?? 0;
        const target = entry.targetDoorAngle;
        if (Math.abs(cur - target) > 0.001) {
          const maxStep = ((Math.PI * 100) / 180 / 0.4) * dt;
          const diff = target - cur;
          const next = Math.abs(diff) <= maxStep ? target : cur + Math.sign(diff) * maxStep;
          entry.doorAngle = next;
          entry.parts.leaf.rotation.y = next;
        }
      }
    }
  }

  private applyOverlayMaterial(group: THREE.Group, mat: THREE.Material): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
      }
    });
  }

  private restoreKitMaterials(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.kitMat) {
        child.material = child.userData.kitMat;
      }
    });
  }

  getMeshes(): THREE.Group {
    return this.root;
  }

  dispose(): void {
    for (const entry of this.pieceMap.values()) {
      this.root.remove(entry.group);
    }
    this.pieceMap.clear();
    for (const col of this.collapsing) {
      this.root.remove(col.group);
    }
    this.collapsing = [];
    globalKitPieceCache.dispose();
  }
}
