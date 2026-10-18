import * as THREE from 'three';
import * as basekit from '@hm/basekit';
import * as basekit2 from '@hm/basekit2';
import * as basegear from '@hm/basegear';
import type { Kind } from '@hm/structure';
import * as S from '@hm/structure';
import type { BaseWorld, WorldEnv } from './world';
import { pieceAt } from './world';
import { createGenFixture, genLevelForStage } from '../assets/gen-props';
import { getGenSync } from '../assets/gen';
import { latticeGenId } from './lattice-gen';
import { foundationDeckGroup, foundationLegGroup, foundationPadGroup } from './foundation-frame';
import { gunmetalPanel, getPanelMaterials } from './panel-pieces';

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

export const INTEGRITY_COLORS = {
  blue: new THREE.Color(0x38bdf8),
  green: new THREE.Color(0x22c55e),
  yellow: new THREE.Color(0xeab308),
  orange: new THREE.Color(0xf97316),
  red: new THREE.Color(0xef4444),
};

export function integrityColorForSupport(support: number): THREE.Color {
  if (support >= 0.999) return INTEGRITY_COLORS.blue;
  if (support >= 0.6) return INTEGRITY_COLORS.green;
  if (support >= 0.4) return INTEGRITY_COLORS.yellow;
  if (support >= 0.28) return INTEGRITY_COLORS.orange;
  return INTEGRITY_COLORS.red;
}

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

/** TICKET-05 (BB-06, BB-08): the kinds that stand as square-section gunmetal panels (panel-pieces.ts), not white slabs. */
const GUNMETAL_KINDS: ReadonlySet<Kind> = new Set<Kind>(['windowWall', 'door', 'halfWall', 'gable']);
const GUNMETAL_SIZE: Readonly<Record<'windowWall' | 'door' | 'halfWall' | 'gable', { readonly w: number; readonly h: number; readonly d: number }>> = {
  windowWall: { w: 4, h: 3, d: 0.25 },
  door: { w: 4, h: 3, d: 0.25 },
  halfWall: { w: 4, h: 1.5, d: 0.25 },
  gable: { w: 4, h: 3, d: 0.25 },
};

/**
 * TICKET-05: the gunmetal panel replaces the basekit mesh of its kind. The basekit piece keeps its colliders (the caller reads
 * them) and its status lamp, which moves onto the panel; the door's lamp keeps the lintel block it was mounted on.
 */
function gunmetalKit(
  kind: keyof typeof GUNMETAL_SIZE,
  res: { readonly group: THREE.Group; readonly lamps: readonly THREE.Mesh[] },
): { group: THREE.Group; lamps: THREE.Mesh[] } {
  const panel = gunmetalPanel(kind, GUNMETAL_SIZE[kind]);
  const lamps = [...res.lamps];
  if (kind === 'door') {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.2), getPanelMaterials().trim);
    block.name = 'door-lintel-block';
    block.position.set(2, 2.56, 0.025);
    panel.group.add(block);
  }
  for (const child of res.group.children) {
    if (child instanceof THREE.Mesh && !lamps.includes(child)) child.geometry.dispose();
  }
  for (const lamp of lamps) panel.group.add(lamp);
  return { group: panel.group, lamps };
}

/**
 * TASK-10b: the lattice piece's visible mesh becomes its generated model, placed where the procedural mesh was
 * (same group, before the pivot offset). Lamps, colliders and sockets stay procedural. The ramp keeps its own paint
 * (handrails, posts, mid rails) on the generated deck. The TICKET-05 gunmetal kinds are not swapped. Nothing changes when
 * the kind stays procedural or the asset is not loaded yet.
 */
function swapLatticeMesh(
  kind: Kind,
  stage: number,
  skirt: number,
  group: THREE.Group,
  lamps: readonly THREE.Mesh[],
  m: basekit.LabMaterials,
): void {
  // TASK-26: the foundation keeps its industrial frame; its generated model (with a skirt of ribs) is not used.
  // TICKET-05: the gunmetal panels keep their own look; their generated models would paint white over them.
  if (kind === 'foundation' || GUNMETAL_KINDS.has(kind)) return;
  const id = latticeGenId(kind, skirt);
  if (!id) return;
  const gen = getGenSync(id, genLevelForStage(stage));
  if (!gen) return;
  gen.name = `gen-${id}`;

  // the ramp's handrails and posts are paint; everything else on the ramp is the deck, which the generated model replaces
  const keepPaint = kind === 'ramp';
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || lamps.includes(child)) continue;
    if (keepPaint && child.material === m.paint) continue;
    group.remove(child);
    child.geometry.dispose();
  }
  group.add(gen);
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
  // TICKET-13: the turret is drawn by play/turret-view.ts; its origin is the corner socket (pieceAt)
  turret: [0, 0, 0],
};

/**
 * Cache for kit pieces per (kind, stage, skirt) for low-end / GTX 950M GPUs.
 * Geometry and materials are created once and shared across all piece instances.
 */
export class KitPieceCache {
  private basekitMats: basekit.LabMaterials | null = null;
  private basegearMats: basegear.LabMaterials | null = null;
  private templates = new Map<string, KitPieceResult>();
  private foundationParts = new Map<string, THREE.Group>();

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
        // TASK-26: the industrial frame (gunmetal box-section deck, grate, hazard rim, collars) replaces the basekit slab. The legs
        // and foot pads are separate parts (getFoundationPartGroup), one per leg, placed by the piece manager. The basekit call stays
        // for the colliders, which keep the skirt's boxes as before.
        const res = basekit.foundation(bkm, { stage, skirt });
        for (const child of res.group.children) if (child instanceof THREE.Mesh) child.geometry.dispose();
        rawGroup = foundationDeckGroup(stage, bkm.hazard);
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
        const gen = createGenFixture('bin', genLevelForStage(stage));
        if (gen) {
          rawGroup = gen.group;
          rawColliders = gen.colliders as Box[];
          rawLamps = gen.lamps as THREE.Mesh[];
          rawSockets = gen.sockets as Socket[];
        } else {
          const res = basegear.bin(bgm, { stage });
          rawGroup = res.group;
          rawColliders = res.colliders;
          rawLamps = res.lamps;
          rawSockets = res.sockets;
        }
        break;
      }
      case 'bench': {
        const gen = createGenFixture('drafting', genLevelForStage(stage));
        if (gen) {
          rawGroup = gen.group;
          rawColliders = gen.colliders as Box[];
          rawLamps = gen.lamps as THREE.Mesh[];
          rawSockets = gen.sockets as Socket[];
        } else {
          const res = basegear.draftingTable(bgm, { stage });
          rawGroup = res.group;
          rawColliders = res.colliders;
          rawLamps = res.lamps;
          rawSockets = res.sockets;
        }
        break;
      }
      case 'repeater': {
        const gen = createGenFixture('repeater', genLevelForStage(stage));
        if (gen) {
          rawGroup = gen.group;
          rawColliders = gen.colliders as Box[];
          rawLamps = gen.lamps as THREE.Mesh[];
          rawSockets = gen.sockets as Socket[];
        } else {
          const res = basegear.repeater(bgm, { stage });
          rawGroup = res.group;
          rawColliders = res.colliders;
          rawLamps = res.lamps;
          rawSockets = res.sockets;
        }
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
        const panel = gunmetalKit('gable', res);
        rawGroup = panel.group;
        rawColliders = res.colliders;
        rawLamps = panel.lamps;
        break;
      }
      case 'halfWall': {
        const res = basekit2.halfWall(bkm, { stage });
        const panel = gunmetalKit('halfWall', res);
        rawGroup = panel.group;
        rawColliders = res.colliders;
        rawLamps = panel.lamps;
        break;
      }
      case 'windowWall': {
        const res = basekit2.windowWall(bkm, { stage });
        const panel = gunmetalKit('windowWall', res);
        rawGroup = panel.group;
        rawColliders = [
          ...res.colliders,
          { min: [0.8, 1, -0.1], max: [3.2, 2.2, 0.1] },
        ];
        rawLamps = panel.lamps;
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
        // TICKET-05: a sliding door (slideDoor), so its leaf has no hinge knuckles; the leaf is the panel's 'door-leaf'
        const res = basekit2.door(bkm, { stage });
        const panel = gunmetalKit('door', res);
        rawGroup = panel.group;
        rawColliders = res.colliders;
        rawLamps = panel.lamps;
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
        const gen = createGenFixture('weapon-bench', genLevelForStage(stage));
        if (gen) {
          rawGroup = gen.group;
          rawColliders = gen.colliders as Box[];
          rawLamps = gen.lamps as THREE.Mesh[];
          rawSockets = gen.sockets as Socket[];
        } else {
          const res = basegear.draftingTable(bgm, { stage });
          rawGroup = res.group;
          rawColliders = res.colliders;
          rawLamps = res.lamps;
          rawSockets = res.sockets;
        }
        break;
      }
      case 'turret': {
        // TICKET-13: the perimeter turret's parts (base, yoke, gun, barrel) are drawn by its own instance in play/turret-view.ts
        rawGroup = new THREE.Group();
        rawColliders = [];
        rawLamps = [];
        rawSockets = [];
        break;
      }
      default: {
        throw new Error(`Unknown structural kind: ${kind}`);
      }
    }

    swapLatticeMesh(kind, stage, skirt, rawGroup, rawLamps, bkm);

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
  /**
   * The foundation's leg (unit shaft) or foot pad (hazard square), one group each. The piece manager places one per leg.
   * Cached until dispose (their hazard material is the basekit's, which dispose releases).
   */
  getFoundationPartGroup(part: 'leg' | 'pad'): THREE.Group {
    const existing = this.foundationParts.get(part);
    if (existing) return existing;
    const group = part === 'leg' ? foundationLegGroup() : foundationPadGroup(this.getBasekitMaterials().hazard);
    this.foundationParts.set(part, group);
    return group;
  }

  dispose(): void {
    for (const group of this.foundationParts.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry?.dispose();
      });
    }
    this.foundationParts.clear();
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
