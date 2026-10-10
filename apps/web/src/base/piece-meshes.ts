import * as THREE from 'three';
import * as S from '@hm/structure';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt, structureEnv } from './world';
import { createStandInPiece } from './stand-in-pieces';

// Shared materials for Integrity Overlay (Zero per-frame allocations)
const INTEGRITY_MATERIALS = {
  blue: new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }),
  green: new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }),
  yellow: new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }),
  red: new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }),
};

// Default materials per kind for normal gameplay
const DEFAULT_MATERIALS: Record<S.Kind, THREE.Material> = {
  foundation: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }),
  airlock: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5, metalness: 0.4 }),
  pillar: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.2 }),
  ramp: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }),
  hardpoint: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.6 }),
  bin: new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.5, metalness: 0.3 }),
  bench: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6, metalness: 0.2 }),
  repeater: new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4, metalness: 0.5 }),
};

interface CollapsingPiece {
  group: THREE.Group;
  elapsed: number;
  duration: number;
  initialY: number;
}

export class PieceMeshManager {
  readonly root: THREE.Group;
  private pieceMap: Map<number, THREE.Group> = new Map();
  private collapsing: CollapsingPiece[] = [];
  private lastIntegrity = false;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'base-pieces-root';
  }

  sync(world: BaseWorld, env: WorldEnv, integrity: boolean): void {
    const activePieces = world.base.pieces;
    const activeIds = new Set<number>();
    const supportMap = integrity ? S.supports(world.base, structureEnv(env)) : null;

    for (const piece of activePieces) {
      activeIds.add(piece.id);
      let pieceGroup = this.pieceMap.get(piece.id);

      if (!pieceGroup) {
        // Create new mesh
        pieceGroup = createStandInPiece(piece.kind, 'ok');
        pieceGroup.userData.pieceId = piece.id;
        pieceGroup.userData.pieceKind = piece.kind;

        // Position & Rotate
        const st = world.base.structures.find((s) => s.id === piece.s);
        const pos = pieceAt(world.base, piece);
        if (pos && st) {
          pieceGroup.position.set(pos.x, pos.y, pos.z);
          let extraAngle = 0;
          if (piece.kind === 'wall' || piece.kind === 'airlock') {
            if (piece.r === 1) extraAngle = -Math.PI / 2;
          } else if (
            piece.kind === 'ramp' ||
            piece.kind === 'bench' ||
            piece.kind === 'bin' ||
            piece.kind === 'repeater'
          ) {
            extraAngle = -piece.r * (Math.PI / 2);
          }
          pieceGroup.rotation.y = -st.yaw + extraAngle;
        }

        pieceGroup.updateMatrixWorld(true);
        this.root.add(pieceGroup);
        this.pieceMap.set(piece.id, pieceGroup);
      }

      // Material assignment: integrity mode vs default
      if (integrity && supportMap) {
        const sup = supportMap.get(piece.id) ?? 0;
        let mat = INTEGRITY_MATERIALS.red;
        if (sup >= 0.85) mat = INTEGRITY_MATERIALS.blue;
        else if (sup >= 0.5) mat = INTEGRITY_MATERIALS.green;
        else if (sup >= 0.28) mat = INTEGRITY_MATERIALS.yellow;

        this.applyMaterial(pieceGroup, mat);
      } else if (this.lastIntegrity !== integrity) {
        const defaultMat = DEFAULT_MATERIALS[piece.kind] ?? DEFAULT_MATERIALS.foundation;
        this.applyMaterial(pieceGroup, defaultMat);
      }
    }

    this.lastIntegrity = integrity;

    // Remove any pieces that disappeared without collapse animation
    for (const [id, grp] of this.pieceMap.entries()) {
      if (!activeIds.has(id)) {
        this.root.remove(grp);
        this.pieceMap.delete(id);
      }
    }
  }

  handleRemoval(removedId: number, collapsedIds: readonly number[]): void {
    // The removed piece vanishes immediately
    const removedGrp = this.pieceMap.get(removedId);
    if (removedGrp) {
      this.root.remove(removedGrp);
      this.pieceMap.delete(removedId);
    }

    // Collapsed pieces animate: drop 0.5m, tilt, and fade over 0.6s
    for (const cId of collapsedIds) {
      const grp = this.pieceMap.get(cId);
      if (grp) {
        this.pieceMap.delete(cId);
        // Clone materials to allow fading
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
          }
        });
        this.collapsing.push({
          group: grp,
          elapsed: 0,
          duration: 0.6,
          initialY: grp.position.y,
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
        this.collapsing.splice(i, 1);
      }
    }
  }

  private applyMaterial(group: THREE.Group, mat: THREE.Material): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
      }
    });
  }

  getMeshes(): THREE.Group {
    return this.root;
  }
}
