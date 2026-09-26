/**
 * The course's own 3D scenery (terrain, cliffs, cave walls, rocks, beams, water…) as parts the
 * builder can select, move, hide or re-shade in Primitives mode.
 *
 * The scenery is generated from code on every load, so an edit can't change the geometry itself;
 * it is stored as an override (a `terrain_edit` prop) keyed by a signature of the part: its name,
 * mesh and vertex counts, and its rounded bounds. The same code builds the same signature every
 * time; if the code changes a part, its old edit simply stops matching (it is kept, reported, and
 * harmless) instead of landing on the wrong rock.
 *
 * Scenery is decoration: the race runs on the track data, so moving or hiding a part never changes
 * where the ball can roll. The road surface itself is marked `locked` (it can take a shader but not
 * move, because it shows the race line).
 */
import * as THREE from 'three';

export interface SceneryPart {
  readonly key: string;
  readonly root: THREE.Object3D;
  /** A readable name for lists ("Cliff", "Mountain peak", "Terrain"…). */
  readonly label: string;
  /** Shader only: the part shows the race line. */
  readonly locked: boolean;
  /** Centre of the part's bounds as generated. */
  readonly center: THREE.Vector3;
  readonly original: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };
  /** Every mesh under the root with its generated material (put back when a shader is removed). */
  readonly meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[];
}

/** Scene children that are never scenery. */
const SKIP_NAMES = new Set(['Sky', 'MistZone', 'DebugMarkers', 'GizmoPivotProxy', 'LaneGizmos', 'LaneHandles', 'DecalSideHandlesGroup', 'RotationHandleGroup']);
const LOCKED_NAMES = new Set(['TrackSurface']);

function fnv(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();

const MATERIAL_LABELS: Record<string, string> = {
  grass: 'Grass', dirt: 'Dirt', cliff: 'Cliff', cave: 'Cave rock', boulder: 'Boulder', wood: 'Timber', cobble: 'Cobbles',
  iron: 'Iron', bark: 'Bark', water: 'Water', lava: 'Lava', stone: 'Stone', sand: 'Sand', crowd: 'Crowd',
};

function labelOf(root: THREE.Object3D, mesh: THREE.Mesh | undefined): string {
  if (root.name) return words(root.name);
  if (mesh?.name) return words(mesh.name);
  const mat = mesh ? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) : undefined;
  if (mat?.name) return MATERIAL_LABELS[mat.name] ?? words(mat.name).replace(/^./, (c) => c.toUpperCase());
  const kind = mesh?.geometry?.type?.replace('Geometry', '') ?? 'Part';
  return kind === 'Buffer' ? 'Scenery' : words(kind);
}

export class SceneryIndex {
  private readonly parts: SceneryPart[] = [];
  private readonly byKeyMap = new Map<string, SceneryPart>();
  private readonly byRoot = new Map<THREE.Object3D, SceneryPart>();

  /**
   * Snapshots the scene as it is now: call it before any builder objects are added (the renderer
   * builds all of its scenery before the builder is constructed).
   */
  constructor(scene: THREE.Scene) {
    scene.updateMatrixWorld(true);
    const seen = new Map<string, number>();
    const box = new THREE.Box3();
    for (const root of scene.children) {
      if ((root as THREE.Light).isLight || (root as THREE.Camera).isCamera || SKIP_NAMES.has(root.name)) continue;
      if (root.name.startsWith('PlacedProp_') || root.name.startsWith('TransformControls')) continue;
      const meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
      let vertices = 0;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || (mesh as unknown as THREE.Sprite).isSprite) return;
        meshes.push({ mesh, material: mesh.material });
        vertices += mesh.geometry?.attributes?.position?.count ?? 0;
      });
      if (!meshes.length) continue;
      box.setFromObject(root);
      if (box.isEmpty()) continue;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const r = (v: number) => Math.round(v / 10) * 10;
      const signature = `${root.name}|${meshes.length}|${vertices}|${r(center.x)},${r(center.y)},${r(center.z)}|${r(size.x)},${r(size.y)},${r(size.z)}`;
      const base = `t${fnv(signature)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const key = n === 1 ? base : `${base}-${n}`;
      const part: SceneryPart = {
        key, root, label: labelOf(root, meshes[0].mesh), locked: LOCKED_NAMES.has(root.name), center,
        original: { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() },
        meshes,
      };
      this.parts.push(part);
      this.byKeyMap.set(key, part);
      this.byRoot.set(root, part);
    }
  }

  get all(): readonly SceneryPart[] { return this.parts; }
  byKey(key: string): SceneryPart | undefined { return this.byKeyMap.get(key); }

  /** The part a hit object belongs to (walks up to the scenery root, through a pivot). */
  partOf(object: THREE.Object3D | null): SceneryPart | undefined {
    for (let o = object; o; o = o.parent) {
      const part = this.byRoot.get(o);
      if (part) return part;
    }
    return undefined;
  }

  /** The nearest visible scenery part under a ray. */
  pick(raycaster: THREE.Raycaster): SceneryPart | undefined {
    const roots = this.parts.filter((p) => isShown(p.root)).map((p) => p.root);
    for (const hit of raycaster.intersectObjects(roots, true)) {
      if (!isShown(hit.object)) continue;
      const part = this.partOf(hit.object);
      if (part) return part;
    }
    return undefined;
  }
}

/** Visible, and every parent visible (three.js raycasts hit hidden objects, so this is checked). */
export function isShown(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Puts a part under a pivot at its generated centre, so the gizmo turns and scales it about its
 * middle rather than the world origin its vertices are built around. The part's world transform
 * does not change.
 */
export function wrapInPivot(part: SceneryPart, scene: THREE.Scene): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = `TerrainPivot_${part.key}`;
  pivot.position.copy(part.center);
  scene.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(part.root);
  return pivot;
}

/** Undoes wrapInPivot: the part is back in the scene exactly as generated. */
export function unwrapPivot(part: SceneryPart, pivot: THREE.Object3D, scene: THREE.Scene) {
  scene.add(part.root);
  part.root.position.copy(part.original.position);
  part.root.quaternion.copy(part.original.quaternion);
  part.root.scale.copy(part.original.scale);
  part.root.visible = true;
  part.root.updateMatrixWorld(true);
  scene.remove(pivot);
}

/** Every mesh of the part wears `material` (or its generated material again, when null). */
export function setPartMaterial(part: SceneryPart, material: THREE.Material | null) {
  for (const { mesh, material: generated } of part.meshes) mesh.material = material ?? generated;
}

/** The generated materials the course uses, once each (for the scene-wide tile randomiser). */
export function sceneryMaterials(index: SceneryIndex): THREE.Material[] {
  const set = new Set<THREE.Material>();
  for (const part of index.all) for (const { material } of part.meshes) (Array.isArray(material) ? material : [material]).forEach((m) => set.add(m));
  return [...set];
}
