/**
 * Aiming the beam at a kit part (plan 38's part cartridges; OVERWATCH note: "universal cartridge targetability").
 *
 * A kit build is a handful of merged meshes carrying a `partId` per vertex, so a hit names the placed part. Testing every triangle of
 * every machine's every mesh, every frame, is what stops kits from being targetable across a whole plot: a plot holds up to forty
 * machines, a build is a few hundred thousand triangles, and the beam only ever hits one of them.
 *
 * So the aim runs in two cheap stages before any triangle is touched:
 *  1. the build's world AABB (the union of its visible meshes) against the ray, as a slab test — a machine the ray misses costs six
 *     multiplications and no geometry;
 *  2. each visible mesh's own world AABB, again with a slab test, and tested with the running best distance so a hit shortens the
 *     segment every later mesh is tested against.
 * Only the meshes that survive both go to `THREE.Raycaster` for triangles, and the winning hit's face index names its part.
 *
 * The boxes are cached per build and rebuilt only when the build's pose (its world matrix) or its visible mesh set (its detail rank)
 * changes, so a standing plot costs one matrix compare per kit per aim. The counters are there for the perf test and for the Bench:
 * a beam swept across forty machines should reject nearly all of them at stage 1.
 */
import * as THREE from 'three';
import type { KitBuild } from './kit-build';

/** An axis-aligned box in world space (tuples, so a box never allocates a Mat4). */
export interface Aabb {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/** What a beam hit: the kit it belongs to, the placed part's path, the generator that made it, and where. */
export interface KitTarget {
  readonly kit: string;
  readonly path: string;
  readonly gen: string | null;
  readonly distance: number;
  readonly point: readonly [number, number, number];
}

/** A kit in the world, by the id the beam and the overrides use. */
export interface KitTargetable {
  readonly kit: string;
  readonly build: KitBuild;
}

/** What one aim cost, stage by stage (the perf test asserts the culling, not just the milliseconds). */
export interface TargetCounters {
  /** Kits the aim looked at. */
  builds: number;
  /** Kits dropped by their world AABB, without touching a mesh. */
  buildsCulled: number;
  /** Meshes whose own AABB the ray reached. */
  meshes: number;
  /** Meshes dropped by their own AABB. */
  meshesCulled: number;
  /** Meshes that went to the triangle test. */
  triangleTests: number;
  /** Aims that ended on a part. */
  hits: number;
}

const emptyCounters = (): TargetCounters => ({
  builds: 0,
  buildsCulled: 0,
  meshes: 0,
  meshesCulled: 0,
  triangleTests: 0,
  hits: 0,
});

/**
 * Where a ray enters a box, or null when it misses (or the box is entirely behind the origin). A distance of 0 means the origin is
 * inside. Slab test: for each axis, the ray is between the two planes for `t` in [t0, t1]; the intersection of those spans is the hit.
 * A direction component of exactly zero is parallel to that pair of planes: inside them the axis never constrains, outside it never hits.
 */
export function rayBoxEntry(
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  box: Aabb,
  maxDistance = Number.POSITIVE_INFINITY,
): number | null {
  let t0 = 0;
  let t1 = maxDistance;
  for (let axis = 0; axis < 3; axis += 1) {
    const o = origin[axis] as number;
    const d = dir[axis] as number;
    const lo = box.min[axis] as number;
    const hi = box.max[axis] as number;
    if (d === 0) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const inv = 1 / d;
    let near = (lo - o) * inv;
    let far = (hi - o) * inv;
    if (near > far) {
      const t = near;
      near = far;
      far = t;
    }
    if (near > t0) t0 = near;
    if (far < t1) t1 = far;
    if (t0 > t1) return null;
  }
  return t0;
}

/** The world AABB of a mesh: its local bounding box, corners transformed, re-boxed. */
export function meshWorldBox(mesh: THREE.Mesh, into = new THREE.Box3()): THREE.Box3 {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const local = geometry.boundingBox;
  if (!local) return into.makeEmpty();
  mesh.updateWorldMatrix(true, false);
  return into.copy(local).applyMatrix4(mesh.matrixWorld);
}

const boxToAabb = (box: THREE.Box3): Aabb => ({
  min: [box.min.x, box.min.y, box.min.z],
  max: [box.max.x, box.max.y, box.max.z],
});

const EXPAND = 1e-4; // a ray along a face must still count as a hit: a hair of padding costs nothing and saves a missed part
const expand = (box: THREE.Box3, by = EXPAND): THREE.Box3 => box.expandByScalar(by);

interface MeshSlot {
  readonly mesh: THREE.Mesh;
  readonly box: Aabb;
  readonly visible: boolean;
}

interface CachedBuild {
  readonly pose: Float32Array;
  readonly mask: number;
  readonly bounds: Aabb;
  readonly slots: readonly MeshSlot[];
}

/** Which visible meshes a build has, as a 32-bit mask over its children (a kit build is a handful of meshes; a longer one gets a second key). */
const visibleMask = (meshes: readonly THREE.Object3D[]): string => {
  let out = '';
  for (let i = 0; i < meshes.length; i += 1) out += (meshes[i] as THREE.Object3D).visible ? '1' : '0';
  return out;
};

const samePose = (a: Float32Array, b: ArrayLike<number>): boolean => {
  for (let i = 0; i < 16; i += 1) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * A beam's aim over a set of kit builds, with the box cache and the stage counters. One instance per scene: the cache is keyed by
 * build, so a rebuilt machine (a part cartridge applied) simply misses and is re-boxed once.
 */
export class KitTargeter {
  private readonly cache = new WeakMap<KitBuild, CachedBuild>();
  private readonly ray = new THREE.Raycaster();
  private readonly box = new THREE.Box3();
  private readonly scratch = new THREE.Box3();
  private stats: TargetCounters = emptyCounters();

  /** The counters of the last `aim` (accumulated until `reset`). */
  counters(): Readonly<TargetCounters> {
    return this.stats;
  }

  reset(): void {
    this.stats = emptyCounters();
  }

  /**
   * The nearest part one of `targetables` puts under the ray from `origin` along `direction`, within `reach`, or null. Only visible
   * meshes count (the rank cap hides the rest). The scene's own matrices are brought up to date for the kits tested.
   */
  aim(
    targetables: Iterable<KitTargetable>,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    reach: number,
  ): KitTarget | null {
    const dir = this.scratchVec.copy(direction).normalize();
    const o: readonly [number, number, number] = [origin.x, origin.y, origin.z];
    const d: readonly [number, number, number] = [dir.x, dir.y, dir.z];
    this.ray.set(origin, dir);
    this.ray.near = 0;
    this.ray.far = reach;
    let best: KitTarget | null = null;
    for (const t of targetables) {
      this.stats.builds += 1;
      const cached = this.entry(t.build);
      const limit = best ? Math.min(reach, best.distance) : reach;
      if (rayBoxEntry(o, d, cached.bounds, limit) === null) {
        this.stats.buildsCulled += 1;
        continue;
      }
      for (const slot of cached.slots) {
        if (!slot.visible) continue;
        const meshLimit = best ? Math.min(reach, best.distance) : reach;
        if (rayBoxEntry(o, d, slot.box, meshLimit) === null) {
          this.stats.meshesCulled += 1;
          continue;
        }
        this.stats.meshes += 1;
        this.stats.triangleTests += 1;
        const hit = this.ray.intersectObject(slot.mesh, false)[0];
        if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) continue;
        if (best && hit.distance >= best.distance) continue;
        const part = t.build.partAt(slot.mesh, hit.faceIndex);
        if (!part) continue;
        best = {
          kit: t.kit,
          path: part.path,
          gen: part.source.kind === 'param' ? part.source.gen : null,
          distance: hit.distance,
          point: [hit.point.x, hit.point.y, hit.point.z],
        };
      }
    }
    if (best) this.stats.hits += 1;
    return best;
  }

  private readonly scratchVec = new THREE.Vector3();

  /** The cached boxes of one build, rebuilt when its pose or its visible mesh set changed (a rank change, a rebuilt machine). */
  private entry(build: KitBuild): CachedBuild {
    build.group.updateWorldMatrix(true, true);
    const children = build.group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    const mask = visibleMask(children);
    // a pose the caller moves is a new pose: compare the sixteen floats rather than trusting a flag
    const pose = new Float32Array(build.group.matrixWorld.elements);
    const hit = this.cache.get(build);
    if (hit && hit.mask === hashMask(mask) && samePose(hit.pose, pose)) return hit;
    const slots: MeshSlot[] = [];
    const union = this.box.makeEmpty();
    for (const mesh of children) {
      const world = meshWorldBox(mesh, this.scratch);
      if (world.isEmpty()) continue;
      slots.push({ mesh, box: boxToAabb(expand(world)), visible: mesh.visible });
      if (mesh.visible) union.union(world);
    }
    const next: CachedBuild = {
      pose,
      mask: hashMask(mask),
      bounds: union.isEmpty() ? { min: [0, 0, 0], max: [0, 0, 0] } : boxToAabb(expand(union)),
      slots,
    };
    this.cache.set(build, next);
    return next;
  }
}

/** A 32-bit string hash of the visibility mask (collisions only cost a stale box for one aim; the slots carry `visible` anyway). */
function hashMask(mask: string): number {
  let h = 2166136261;
  for (let i = 0; i < mask.length; i += 1) {
    h ^= mask.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let shared: KitTargeter | null = null;

/**
 * The scene-wide targeter. One per page is enough (its cache is keyed by build), and it is what every call site uses so the culling
 * statistics are the whole picture.
 */
export function kitTargeter(): KitTargeter {
  shared ??= new KitTargeter();
  return shared;
}

/** `kitTargeter().aim(...)`, for call sites that do not need the counters. */
export function aimKit(
  targetables: Iterable<KitTargetable>,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  reach: number,
): KitTarget | null {
  return kitTargeter().aim(targetables, origin, direction, reach);
}
