import * as THREE from 'three';
import * as S from '@hm/structure';
import * as L from '@hm/lattice';
import * as basegear from '@hm/basegear';
import { Batcher, type Part } from '@hm/batcher';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt, structureEnv, BENCH_REACH, relays } from './world';
import { WalkWorld, type PlacedPiece } from './walk';
import {
  globalKitPieceCache,
  computeSkirt,
  integrityColorForSupport,
  KIT_PIVOT_OFFSETS,
  type Box,
} from './kit-pieces';

interface ActivePieceEntry {
  colliders: readonly Box[];
  dynamicRoot?: THREE.Group;
  lamps: readonly THREE.Mesh[];
  kind: S.Kind;
  pos: { x: number; y: number; z: number };
  yaw: number;
  skirt: number;
  parts?: Record<string, THREE.Object3D>;
  doorAngle?: number;
  targetDoorAngle?: number;
  isTinted?: boolean;
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
  private lastStage = 1;
  private batcher: Batcher;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'base-pieces-root';
    (this.root.userData as Record<string, unknown>).manager = this;
    this.batcher = new Batcher(this.root, (key) => this.getBatchParts(key));
  }

  get batcherDrawCalls(): number {
    return this.batcher.drawCalls;
  }

  get batcherInstances(): number {
    return this.batcher.instances;
  }

  sync(world: BaseWorld, env: WorldEnv, integrity: boolean): void {
    const activePieces = world.base.pieces;
    const activeIds = new Set<number>();
    const supportMap = integrity ? S.supports(world.base, structureEnv(env)) : null;

    // Stage change: rebuild all pieces from new stage cache, then dispose old cache
    if (world.stage !== this.lastStage) {
      for (const entry of this.pieceMap.values()) {
        if (entry.dynamicRoot) {
          this.root.remove(entry.dynamicRoot);
        }
      }
      this.pieceMap.clear();
      this.batcher.dispose();
      this.batcher = new Batcher(this.root, (key) => this.getBatchParts(key));
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
        piece.kind === 'weaponBench' ||
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

      const skirt = computeSkirt(world, env, piece);
      const key = `${piece.kind}|${world.stage}|${skirt}`;
      const matrix = new THREE.Matrix4().makeRotationY(totalYaw).setPosition(pos.x, pos.y, pos.z);

      // Render static parts through @hm/batcher
      this.batcher.set(piece.id, key, matrix);

      if (!entry) {
        let dynamicRoot: THREE.Group | undefined;
        const activeLamps: THREE.Mesh[] = [];
        const parts: Record<string, THREE.Object3D> = {};
        const isDoor = piece.kind === 'door';
        const doorAngle = isDoor && piece.open ? (-100 * Math.PI) / 180 : 0;

        const template = globalKitPieceCache.getTemplate(piece.kind, world.stage, skirt);

        // Keep dynamic components (lamps and animated door leaves) as separate scene objects
        if (template.lamps.length > 0 || isDoor) {
          dynamicRoot = new THREE.Group();
          dynamicRoot.name = `dynamic-${piece.kind}-${piece.id}`;
          dynamicRoot.userData.pieceId = piece.id;
          dynamicRoot.userData.pieceKind = piece.kind;

          const [ox, oy, oz] = KIT_PIVOT_OFFSETS[piece.kind] ?? [0, 0, 0];
          const offsetGroup = new THREE.Group();
          offsetGroup.position.set(ox, oy, oz);
          dynamicRoot.add(offsetGroup);

          if (isDoor) {
            const templateLeaf = template.group.getObjectByName('door-leaf');
            if (templateLeaf) {
              const leafClone = templateLeaf.clone(true);
              leafClone.rotation.y = doorAngle;
              offsetGroup.add(leafClone);
              parts.leaf = leafClone;
            }
          }

          if (template.lamps.length > 0) {
            for (const lamp of template.lamps) {
              const clonedLamp = new THREE.Mesh(
                lamp.geometry,
                (lamp.material as THREE.Material).clone(),
              );
              clonedLamp.userData.isLamp = true;
              clonedLamp.position.copy(lamp.position);
              clonedLamp.rotation.copy(lamp.rotation);
              clonedLamp.scale.copy(lamp.scale);
              offsetGroup.add(clonedLamp);
              activeLamps.push(clonedLamp);
            }
          }

          dynamicRoot.position.set(pos.x, pos.y, pos.z);
          dynamicRoot.rotation.y = totalYaw;
          dynamicRoot.updateMatrixWorld(true);
          this.root.add(dynamicRoot);
        }

        entry = {
          colliders: template.colliders,
          dynamicRoot,
          lamps: activeLamps,
          kind: piece.kind,
          pos,
          yaw: totalYaw,
          skirt,
          parts: Object.keys(parts).length > 0 ? parts : undefined,
          doorAngle,
          targetDoorAngle: doorAngle,
          isTinted: false,
        };
        this.pieceMap.set(piece.id, entry);
      } else {
        entry.pos = pos;
        entry.yaw = totalYaw;
        if (entry.dynamicRoot) {
          entry.dynamicRoot.position.set(pos.x, pos.y, pos.z);
          entry.dynamicRoot.rotation.y = totalYaw;
          entry.dynamicRoot.updateMatrixWorld(true);
        }
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

      // Update lamp emissive lighting
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
        } else if (piece.kind === 'bench' || piece.kind === 'weaponBench') {
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

      // 5-tier structural integrity tinting via batcher.tint
      if (integrity && supportMap) {
        const sup = supportMap.get(piece.id) ?? 0;
        const color = integrityColorForSupport(sup);
        this.batcher.tint(piece.id, color);
        entry.isTinted = true;
      } else if (entry.isTinted) {
        this.batcher.tint(piece.id, null);
        entry.isTinted = false;
      }
    }

    this.walkWorld.setPieces(placedForWalk);

    // Remove any pieces that disappeared without collapse animation
    for (const [id, entry] of this.pieceMap.entries()) {
      if (!activeIds.has(id)) {
        this.batcher.remove(id);
        if (entry.dynamicRoot) {
          this.root.remove(entry.dynamicRoot);
        }
        this.pieceMap.delete(id);
      }
    }
  }

  handleRemoval(removedId: number, collapsedIds: readonly number[]): void {
    // The removed piece vanishes immediately from batcher and scene
    this.batcher.remove(removedId);
    const removedEntry = this.pieceMap.get(removedId);
    if (removedEntry) {
      if (removedEntry.dynamicRoot) {
        this.root.remove(removedEntry.dynamicRoot);
      }
      this.pieceMap.delete(removedId);
    }

    // Collapsed pieces leave the batch and animate with a temporary cloned group
    for (const cId of collapsedIds) {
      this.batcher.remove(cId);
      const entry = this.pieceMap.get(cId);
      if (entry) {
        if (entry.dynamicRoot) {
          this.root.remove(entry.dynamicRoot);
        }
        this.pieceMap.delete(cId);

        const tempInstance = globalKitPieceCache.instantiate(entry.kind, this.lastStage, entry.skirt);
        tempInstance.group.position.set(entry.pos.x, entry.pos.y, entry.pos.z);
        tempInstance.group.rotation.y = entry.yaw;
        tempInstance.group.updateMatrixWorld(true);

        tempInstance.group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            child.material = (child.material as THREE.Material).clone();
            child.material.transparent = true;
          }
        });

        this.root.add(tempInstance.group);
        this.collapsing.push({
          group: tempInstance.group,
          elapsed: 0,
          duration: 0.6,
          initialY: tempInstance.group.position.y,
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

  pieceIdFromHit(object: THREE.Object3D, instanceId?: number): number | null {
    if (object instanceof THREE.InstancedMesh && instanceId !== undefined) {
      return this.batcher.idAt(object, instanceId);
    }
    return (object.userData?.pieceId as number | undefined) ?? null;
  }

  private getBatchParts(key: string): readonly Part[] {
    const [kindStr, stageStr, skirtStr] = key.split('|');
    const kind = kindStr as S.Kind;
    const stage = Number(stageStr);
    const skirt = Number(skirtStr || 0);

    const template = globalKitPieceCache.getTemplate(kind, stage, skirt);
    template.group.updateMatrixWorld(true);

    const rootInv = template.group.matrixWorld.clone().invert();
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    template.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Skip dynamic elements: lamps and door leaf
        if (child.userData.isLamp) return;
        if (child.name === 'door-leaf' || this.isDescendantOf(child, 'door-leaf')) return;

        // Static part: bake pivot and local transform into geometry
        const relMat = child.matrixWorld.clone().premultiply(rootInv);
        const geom = child.geometry.clone().applyMatrix4(relMat);
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        const mat = child.material;
        const list = byMaterial.get(mat);
        if (list) {
          list.push(geom);
        } else {
          byMaterial.set(mat, [geom]);
        }
      }
    });

    const parts: Part[] = [];
    for (const [mat, geos] of byMaterial) {
      if (geos.length === 1) {
        parts.push({ geometry: geos[0]!, material: mat });
      } else if (geos.length > 1) {
        try {
          const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
          const merged = mergeGeometries(nonIndexed, false);
          if (merged) {
            merged.computeBoundingBox();
            merged.computeBoundingSphere();
            parts.push({ geometry: merged, material: mat });
            for (const g of geos) g.dispose();
          } else {
            for (const g of geos) parts.push({ geometry: g, material: mat });
          }
        } catch {
          for (const g of geos) parts.push({ geometry: g, material: mat });
        }
      }
    }

    return parts;
  }

  private isDescendantOf(obj: THREE.Object3D, name: string): boolean {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.name === name) return true;
      cur = cur.parent;
    }
    return false;
  }

  getMeshes(): THREE.Group {
    return this.root;
  }

  dispose(): void {
    for (const entry of this.pieceMap.values()) {
      if (entry.dynamicRoot) {
        this.root.remove(entry.dynamicRoot);
      }
    }
    this.pieceMap.clear();
    for (const col of this.collapsing) {
      this.root.remove(col.group);
    }
    this.collapsing = [];
    this.batcher.dispose();
    globalKitPieceCache.dispose();
  }
}
