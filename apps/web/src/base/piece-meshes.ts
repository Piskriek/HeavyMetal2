import * as THREE from 'three';
import * as S from '@hm/structure';
import * as L from '@hm/lattice';
import * as basegear from '@hm/basegear';
import { Batcher, type Part } from '@hm/batcher';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt, structureEnv, BENCH_REACH, relays } from './world';
import { WalkWorld, type PlacedPiece } from './walk';
import { planFrameLegs } from './foundation-legs';
import { FRAME_PAD_HEIGHT_M } from './foundation-frame';
import { slideDoor } from './panel-pieces';
import {
  globalKitPieceCache,
  computeSkirt,
  integrityColorForSupport,
  KIT_PIVOT_OFFSETS,
  type Box,
} from './kit-pieces';

/** The sliding door's run, in seconds, and the leaf's travel (m): its own width, so the doorway is clear once open. */
const DOOR_SLIDE_SECONDS = 0.4;
const DOOR_LEAF_TRAVEL = 1.4;

interface ActivePieceEntry {
  colliders: readonly Box[];
  dynamicRoot?: THREE.Group;
  lamps: readonly THREE.Mesh[];
  kind: S.Kind;
  pos: { x: number; y: number; z: number };
  yaw: number;
  skirt: number;
  parts?: Record<string, THREE.Object3D>;
  /** The sliding door's open state, 0 shut to 1 open (slideDoor), eased toward targetDoorOpen. */
  doorOpen?: number;
  targetDoorOpen?: number;
  isTinted?: boolean;
}

interface CollapsingPiece {
  group: THREE.Group;
  elapsed: number;
  duration: number;
  initialY: number;
}

/**
 * Ensures all geometry attributes are unquantized Float32BufferAttributes.
 * Three.js BufferGeometry.applyMatrix4 and normal/tangent operations corrupt
 * quantized/normalized integer attributes (e.g. KHR_mesh_quantization Int16Array)
 * by writing floats directly into integer typed arrays without normalization.
 */
export function ensureFloatGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const res = geom.clone();
  for (const name of Object.keys(res.attributes)) {
    const attr = res.attributes[name]!;
    if (!(attr.array instanceof Float32Array)) {
      const f32 = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i++) {
        for (let c = 0; c < attr.itemSize; c++) {
          f32[i * attr.itemSize + c] = attr.getComponent(i, c);
        }
      }
      res.setAttribute(name, new THREE.BufferAttribute(f32, attr.itemSize, false));
    }
  }
  return res;
}

/** TASK-26: a foundation's legs and foot pads are batch ids of their own, one pair per corner, above every piece id. */
const FRAME_PART_BASE = 1_000_000_000;
const legBatchId = (pieceId: number, corner: number): number => FRAME_PART_BASE + pieceId * 8 + corner * 2;
const padBatchId = (pieceId: number, corner: number): number => FRAME_PART_BASE + pieceId * 8 + corner * 2 + 1;

export class PieceMeshManager {
  readonly root: THREE.Group;
  readonly walkWorld: WalkWorld = new WalkWorld();
  private pieceMap: Map<number, ActivePieceEntry> = new Map();
  /** The batch ids of each foundation's legs and pads (leg and pad ids alternate per corner). */
  private frameParts = new Map<number, number[]>();
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
      this.frameParts.clear();
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
      // TASK-26: a foundation's deck does not depend on its skirt; its legs are placed per corner below
      const isFrame = piece.kind === 'foundation';
      const key = isFrame ? `foundation|${world.stage}|0` : `${piece.kind}|${world.stage}|${skirt}`;
      const matrix = new THREE.Matrix4().makeRotationY(totalYaw).setPosition(pos.x, pos.y, pos.z);

      // Render static parts through @hm/batcher
      this.batcher.set(piece.id, key, matrix);
      if (isFrame) this.placeFrameLegs(piece.id, world.stage, pos, totalYaw, env);

      if (!entry) {
        let dynamicRoot: THREE.Group | undefined;
        const activeLamps: THREE.Mesh[] = [];
        const parts: Record<string, THREE.Object3D> = {};
        const isDoor = piece.kind === 'door';
        const doorOpen = isDoor && piece.open ? 1 : 0;

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
              slideDoor(leafClone, doorOpen, DOOR_LEAF_TRAVEL);
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
          doorOpen,
          targetDoorOpen: doorOpen,
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
          entry.targetDoorOpen = piece.open ? 1 : 0;
        }
      }

      const colliders = piece.kind === 'door' && !piece.open
        ? [...entry.colliders, { min: [-0.7, 0, -0.125], max: [0.7, 2.3, 0.125] } as Box]
        : entry.colliders;

      placedForWalk.push({
        id: piece.id,
        kind: piece.kind,
        pos,
        yaw: totalYaw,
        colliders,
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
        for (const part of this.frameParts.get(piece.id) ?? []) this.batcher.tint(part, color);
        entry.isTinted = true;
      } else if (entry.isTinted) {
        this.batcher.tint(piece.id, null);
        for (const part of this.frameParts.get(piece.id) ?? []) this.batcher.tint(part, null);
        entry.isTinted = false;
      }
    }

    this.walkWorld.setPieces(placedForWalk);

    // Remove any pieces that disappeared without collapse animation
    for (const [id, entry] of this.pieceMap.entries()) {
      if (!activeIds.has(id)) {
        this.batcher.remove(id);
        this.dropFrameParts(id);
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
    this.dropFrameParts(removedId);
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
      this.dropFrameParts(cId);
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

    // Door slide: the leaf runs sideways into its pocket over DOOR_SLIDE_SECONDS (TICKET-05; the hinge swing is gone)
    for (const entry of this.pieceMap.values()) {
      if (entry.kind === 'door' && entry.parts?.leaf && entry.targetDoorOpen !== undefined) {
        const cur = entry.doorOpen ?? 0;
        const target = entry.targetDoorOpen;
        if (Math.abs(cur - target) > 0.001) {
          const maxStep = dt / DOOR_SLIDE_SECONDS;
          const diff = target - cur;
          const next = Math.abs(diff) <= maxStep ? target : cur + Math.sign(diff) * maxStep;
          entry.doorOpen = next;
          slideDoor(entry.parts.leaf, next, DOOR_LEAF_TRAVEL);
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

  /** TASK-26: the legs and pads of a foundation's frame, one for each corner that needs one. */
  private placeFrameLegs(pieceId: number, stage: number, pos: { readonly x: number; readonly y: number; readonly z: number }, yaw: number, env: WorldEnv): void {
    const legs = planFrameLegs(pos, yaw, (x, z) => env.heightAt(x, z));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const next: number[] = [];
    for (const leg of legs) {
      const legId = legBatchId(pieceId, leg.corner);
      const padId = padBatchId(pieceId, leg.corner);
      const shaft = new THREE.Matrix4().compose(new THREE.Vector3(leg.x, leg.footY, leg.z), q, new THREE.Vector3(1, leg.length, 1));
      this.batcher.set(legId, `foundation-leg|${stage}|0`, shaft);
      const pad = new THREE.Matrix4().compose(new THREE.Vector3(leg.x, leg.groundY - FRAME_PAD_HEIGHT_M / 2, leg.z), q, new THREE.Vector3(1, 1, 1));
      this.batcher.set(padId, `foundation-pad|${stage}|0`, pad);
      next.push(legId, padId);
    }
    for (const old of this.frameParts.get(pieceId) ?? []) if (!next.includes(old)) this.batcher.remove(old);
    this.frameParts.set(pieceId, next);
  }

  /** TASK-26: forgets a removed piece's legs and pads. */
  private dropFrameParts(pieceId: number): void {
    for (const part of this.frameParts.get(pieceId) ?? []) this.batcher.remove(part);
    this.frameParts.delete(pieceId);
  }

  private getBatchParts(key: string): readonly Part[] {
    const [kindStr, stageStr, skirtStr] = key.split('|');
    const kind = kindStr as S.Kind;
    const stage = Number(stageStr);
    const skirt = Number(skirtStr || 0);

    // TASK-26: the frame's legs and pads are unit parts (the batcher places each one)
    const template = kindStr === 'foundation-leg'
      ? { group: globalKitPieceCache.getFoundationPartGroup('leg') }
      : kindStr === 'foundation-pad'
        ? { group: globalKitPieceCache.getFoundationPartGroup('pad') }
        : globalKitPieceCache.getTemplate(kind, stage, skirt);
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
        const geom = ensureFloatGeometry(child.geometry).applyMatrix4(relMat);
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
