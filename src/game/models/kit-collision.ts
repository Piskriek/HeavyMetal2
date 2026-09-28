/**
 * Rideable Meshy models: a placed road piece, bridge, deck, platform or stunt ramp is ridden on its
 * drive surface (`<id>.drive.glb`, a clean top surface baked from the full model). The surface is put
 * where the model stands, turned into engine space (x down the road, z across it, height above it)
 * and compiled into a heightfield patch the physics rides on (collision/terrain-patch.ts).
 */
import * as THREE from 'three';
import type { RawMesh } from '../assets/model-import';
import { compilePatch, type Patch } from '../collision/terrain-patch';
import { engineFromWorld, engineXFromDistance, type TrackSpaceMap } from '../track-space';
import { RADIUS } from '../scene';
import { loadGlb } from './glb';
import { kitModelFor, kitModelUrl } from './kit-catalog';
import { fitKitModel } from './kit-object';

/** The models with a drive surface: the ones a ball can ride. */
export const RIDEABLE_KIT: ReadonlySet<string> = new Set([
  'arch-bridge', 'beach-shelf', 'boardwalk-bridge', 'cliff-block', 'hairpin-turn', 'jump-ramp', 'lagoon-platform',
  'road-straight', 'stunt-cliff-deck', 'stunt-cliff-ramp', 'stunt-half-pipe', 'stunt-landing-deck', 'stunt-launch-ramp',
  'stunt-scaffold-tower', 'stunt-suspension-bridge',
]);
export const isRideableType = (type: string) => RIDEABLE_KIT.has(kitModelFor(type)?.id ?? '');
export const kitDriveUrl = (id: string) => `/models/kit/${id}.drive.glb`;

/** A point further than this from the road it projects onto belongs to no road: its triangle is dropped. */
const MAX_RESIDUAL = 900;
/** Across the road beyond this (engine z) a deck is off the drivable corridor. */
const MAX_LATERAL = 700;

export interface KitPlacement {
  x: number; y: number; z: number; rotY: number; rotX?: number; rotZ?: number; scale: number; flipX?: boolean;
}

/** The placed prop's own transform, as the builder draws it (scene-kit.ts). */
export function placementMatrix(p: KitPlacement): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0, 'YXZ'));
  const s = p.scale || 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3((p.flipX ? -1 : 1) * s, s, s));
}

/**
 * The drive surface in engine space: every vertex taken through the model's fit and the prop's
 * transform into the world, then onto the road. Triangles off the road are dropped.
 */
export function rideMeshInEngineSpace(
  surface: THREE.Object3D, fit: THREE.Matrix4, placement: THREE.Matrix4, space: TrackSpaceMap, name: string,
): RawMesh | null {
  const positions: number[] = [];
  const indices: number[] = [];
  const world = new THREE.Vector3();
  const m = new THREE.Matrix4();
  surface.updateMatrixWorld(true);
  surface.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    m.multiplyMatrices(placement, fit).multiply(mesh.matrixWorld);
    const base = positions.length / 3;
    const ok: boolean[] = [];
    for (let i = 0; i < pos.count; i++) {
      world.fromBufferAttribute(pos, i).applyMatrix4(m);
      const c = engineFromWorld(space, { x: world.x, y: world.y, z: world.z });
      ok.push(c.residual <= MAX_RESIDUAL && Math.abs(c.laneZ) <= MAX_LATERAL && !c.ambiguous);
      positions.push(engineXFromDistance(c.distance), c.altitude + RADIUS, c.laneZ);
    }
    const index = geo.getIndex();
    const tri = (a: number, b: number, c: number) => { if (ok[a] && ok[b] && ok[c]) indices.push(base + a, base + b, base + c); };
    if (index) for (let i = 0; i + 2 < index.count; i += 3) tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    else for (let i = 0; i + 2 < pos.count; i += 3) tri(i, i + 1, i + 2);
  });
  if (!indices.length) return null;
  return { name, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** What a placed model does to a ball: ride on it, bounce off it, or nothing. */
export type KitCollisionRole = 'terrain' | 'barrier' | 'decoration';

/** Solid by default: rocks, walls, the crate and the sea stack (things you drive round, not through). */
const SOLID_KIT: ReadonlySet<string> = new Set(['stone-wall', 'railing-wall', 'iron-crate', 'sea-stack-tall']);

/**
 * A placed model's collision role: the one picked in the Collision tab (drivable, solid or none), else
 * the default: models with a drive surface are drivable, rocks and walls are solid, and the rest (caves,
 * arches, rings and portals you drive through, foliage) are decoration.
 */
export function collisionRoleOf(prop: { type: string; roleConfig?: { role?: string } }): KitCollisionRole {
  const picked = prop.roleConfig?.role;
  if (picked === 'terrain' || picked === 'barrier' || picked === 'decoration') return picked;
  const model = kitModelFor(prop.type);
  if (!model) return 'decoration';
  if (RIDEABLE_KIT.has(model.id)) return 'terrain';
  if (model.shelf === 'rocks_3d' || SOLID_KIT.has(model.id)) return 'barrier';
  return 'decoration';
}

/**
 * The patch a placed model adds to the road, by its role (null: decoration, or nothing of it over the
 * road). Drivable: its drive surface where it has one (else its own shape), with its full shape as the
 * solid sides. Solid: its own shape, sides and top, bouncing harder.
 */
/** A model's triangles in world space (the model's fit, then the prop's placement). */
export function worldMesh(surface: THREE.Object3D, fit: THREE.Matrix4, placement: THREE.Matrix4, name: string): RawMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  surface.updateMatrixWorld(true);
  surface.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    m.multiplyMatrices(placement, fit).multiply(mesh.matrixWorld);
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); positions.push(v.x, v.y, v.z); }
    const index = geo.getIndex();
    if (index) for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  });
  return { name, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/**
 * A world-space mesh onto the road (engine x, height, z); triangles off the road are dropped.
 *
 * Asking the road where each of a model's tens of thousands of vertices lies was the slow part (a search
 * per vertex). Over one model's footprint the road barely bends, so it is asked on a small grid across the
 * footprint (at the model's lowest and highest points, since on a steep or banked stretch going up also
 * moves a point along and across the road) and every vertex is interpolated from that.
 */
export function engineMeshFromWorld(world: RawMesh, space: TrackSpaceMap): RawMesh | null {
  const p = world.positions;
  const n = p.length / 3;
  if (!n) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const sy = y1 - y0 || 1;
  // About one sample every 100 world units, 2..48 per side (tight bends need the density).
  const G = (span: number) => Math.max(2, Math.min(48, Math.ceil(span / 100) + 1));
  const gx = G(x1 - x0), gz = G(z1 - z0);
  const sx = (x1 - x0) / (gx - 1) || 1, sz = (z1 - z0) / (gz - 1) || 1;
  // Two layers: at the model's lowest point (layer 0) and its highest (layer 1).
  const L = gx * gz;
  const ex = new Float64Array(2 * L), lz = new Float64Array(2 * L), alt = new Float64Array(2 * L), good = new Uint8Array(2 * L);
  for (let layer = 0; layer < 2; layer++) {
    for (let j = 0; j < gz; j++) {
      for (let i = 0; i < gx; i++) {
        const c = engineFromWorld(space, { x: x0 + i * sx, y: layer ? y1 : y0, z: z0 + j * sz });
        const k = layer * L + j * gx + i;
        ex[k] = engineXFromDistance(c.distance); lz[k] = c.laneZ; alt[k] = c.altitude;
        good[k] = c.residual <= MAX_RESIDUAL && !c.ambiguous ? 1 : 0;
      }
    }
  }
  // Samples that straddle a jump in the road's distance (two stretches of road) are not interpolated across.
  const out = new Float32Array(p.length);
  const ok = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
    const fx = Math.min(gx - 1.000001, Math.max(0, (x - x0) / sx)), fz = Math.min(gz - 1.000001, Math.max(0, (z - z0) / sz));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, ty = (y - y0) / sy;
    const k00 = j * gx + i, k10 = k00 + 1, k01 = k00 + gx, k11 = k01 + 1;
    const plane = (arr: Float64Array, o: number) => (arr[o + k00] * (1 - tx) + arr[o + k10] * tx) * (1 - tz) + (arr[o + k01] * (1 - tx) + arr[o + k11] * tx) * tz;
    const lerp = (arr: Float64Array) => plane(arr, 0) * (1 - ty) + plane(arr, L) * ty;
    let lo = Infinity, hi = -Infinity, allGood = true;
    for (const o of [0, L]) for (const k of [k00, k10, k01, k11]) { lo = Math.min(lo, ex[o + k]); hi = Math.max(hi, ex[o + k]); if (!good[o + k]) allGood = false; }
    const coherent = allGood && hi - lo < (sx + sz) * 4 + sy * 2;
    const laneZ = lerp(lz);
    ok[v] = coherent && Math.abs(laneZ) <= MAX_LATERAL ? 1 : 0;
    out[v * 3] = lerp(ex);
    out[v * 3 + 1] = lerp(alt) + RADIUS;
    out[v * 3 + 2] = laneZ;
  }
  const indices: number[] = [];
  const f = world.indices;
  for (let t = 0; t + 2 < f.length; t += 3) if (ok[f[t]] && ok[f[t + 1]] && ok[f[t + 2]]) indices.push(f[t], f[t + 1], f[t + 2]);
  if (!indices.length) return null;
  return { name: world.name, positions: out, indices: new Uint32Array(indices) };
}

/**
 * A placed model's collision patch from its world-space meshes (pure, so it runs in the collision
 * worker): by role, as kitCollisionPatch describes.
 */
export function patchFromWorldMeshes(
  full: RawMesh, drive: RawMesh | null, space: TrackSpaceMap, role: KitCollisionRole, restitution: number,
): Patch | null {
  if (role === 'decoration') return null;
  const shape = engineMeshFromWorld(full, space);
  let patch: Patch | null = null;
  if (role === 'terrain' && drive) {
    const surface = engineMeshFromWorld(drive, space);
    patch = surface ? compilePatch(surface, { fillHoles: true }) : null;
    const solid = shape ? compilePatch(shape, { fillHoles: false }).solid : undefined;
    if (patch && solid) {
      // Where the model has a drive surface, that surface is its top (the full model's trim and edges
      // sit a little above it and would read as a step): a slope stays climbable, a sheer back does not.
      for (let i = 0; i < solid.nx; i++) {
        for (let j = 0; j < solid.nz; j++) {
          const di = Math.round((solid.x0 - patch.x0) / patch.cellX) + i;
          const dj = Math.round((solid.z0 - patch.z0) / patch.cellZ) + j;
          if (di < 0 || dj < 0 || di >= patch.nx || dj >= patch.nz) continue;
          const h = patch.heights[di * patch.nz + dj];
          const k = i * solid.nz + j;
          if (!Number.isNaN(h) && !Number.isNaN(solid.top[k])) solid.top[k] = h;
        }
      }
      // Past where a drive surface ends (down the road), the model's lip, kicker and frame are what a ball
      // launches off and over, not a wall it stops dead against: not solid. Its sides and back still are.
      for (let j = 0; j < solid.nz; j++) {
        let seenDrive = false;
        for (let i = 0; i < solid.nx; i++) {
          const di = Math.round((solid.x0 - patch.x0) / patch.cellX) + i;
          const dj = Math.round((solid.z0 - patch.z0) / patch.cellZ) + j;
          const onDrive = di >= 0 && dj >= 0 && di < patch.nx && dj < patch.nz && !Number.isNaN(patch.heights[di * patch.nz + dj]);
          if (onDrive) { seenDrive = true; continue; }
          if (seenDrive) solid.top[i * solid.nz + j] = NaN;
        }
      }
      patch.solid = solid;
    } else if (!patch && shape) patch = compilePatch(shape, { fillHoles: true });
  } else if (shape) {
    patch = compilePatch(shape, { fillHoles: true });
  }
  if (patch?.solid) patch.solid.restitution = restitution;
  return patch;
}

/** What the collision worker needs for one placed model (null: no collision). */
export interface KitCollisionInput {
  full: RawMesh;
  drive: RawMesh | null;
  role: KitCollisionRole;
  restitution: number;
}

/** Loads a placed model's shapes (cached GLBs) and puts them in the world. Main thread; cheap. */
export async function kitCollisionInput(
  prop: KitPlacement & { id: string; type: string; roleConfig?: { role?: string; restitution?: number } },
): Promise<KitCollisionInput | null> {
  const role = collisionRoleOf(prop);
  const model = kitModelFor(prop.type);
  if (role === 'decoration' || !model) return null;
  const full = await loadGlb(kitModelUrl(model.id));
  const fitted = fitKitModel(full.clone(true), model.size);
  fitted.updateMatrix();
  const placement = placementMatrix(prop);
  const driveModel = role === 'terrain' && RIDEABLE_KIT.has(model.id) ? await loadGlb(kitDriveUrl(model.id)) : null;
  return {
    full: worldMesh(full.clone(true), fitted.matrix, placement, prop.id),
    drive: driveModel ? worldMesh(driveModel.clone(true), fitted.matrix, placement, prop.id) : null,
    role,
    restitution: role === 'barrier' ? (prop.roleConfig?.restitution ?? 0.6) : 0.35,
  };
}

/**
 * A placed model's collision, by its role (null: decoration, or nothing of it over the road).
 * Drivable: its drive surface where it has one (else its own shape), with its full shape as the solid
 * sides. Solid: its own shape, sides and top, bouncing harder. The builder runs the heavy half in a
 * worker (collision-worker.ts); this does it all here.
 */
export async function kitCollisionPatch(
  prop: KitPlacement & { id: string; type: string; roleConfig?: { role?: string; restitution?: number } }, space: TrackSpaceMap,
): Promise<Patch | null> {
  const input = await kitCollisionInput(prop);
  return input ? patchFromWorldMeshes(input.full, input.drive, space, input.role, input.restitution) : null;
}

/**
 * The patch a placed rideable model adds to the road, or null (not rideable, or nothing of it over
 * the road). The drive surface is fitted exactly as the full model is, so it lies on what you see.
 */
export async function kitRidePatch(prop: KitPlacement & { id: string; type: string }, space: TrackSpaceMap): Promise<Patch | null> {
  const model = kitModelFor(prop.type);
  if (!model || !RIDEABLE_KIT.has(model.id)) return null;
  const [full, drive] = await Promise.all([loadGlb(kitModelUrl(model.id)), loadGlb(kitDriveUrl(model.id))]);
  // The fit the builder gives the full model (longest side = size, centred, base at 0), as a matrix.
  const fitted = fitKitModel(full.clone(true), model.size);
  fitted.updateMatrix();
  const mesh = rideMeshInEngineSpace(drive.clone(true), fitted.matrix, placementMatrix(prop), space, prop.id);
  if (!mesh) return null;
  return compilePatch(mesh, { fillHoles: true });
}
