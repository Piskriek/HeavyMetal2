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
export async function kitCollisionPatch(
  prop: KitPlacement & { id: string; type: string; roleConfig?: { role?: string; restitution?: number } }, space: TrackSpaceMap,
): Promise<Patch | null> {
  const role = collisionRoleOf(prop);
  const model = kitModelFor(prop.type);
  if (role === 'decoration' || !model) return null;
  const full = await loadGlb(kitModelUrl(model.id));
  const fitted = fitKitModel(full.clone(true), model.size);
  fitted.updateMatrix();
  const placement = placementMatrix(prop);
  const shape = rideMeshInEngineSpace(full.clone(true), fitted.matrix, placement, space, prop.id);
  const solidOf = (mesh: RawMesh | null) => (mesh ? compilePatch(mesh, { fillHoles: false }).solid : undefined);
  let patch: Patch | null = null;
  if (role === 'terrain' && RIDEABLE_KIT.has(model.id)) {
    const drive = await loadGlb(kitDriveUrl(model.id));
    const surface = rideMeshInEngineSpace(drive.clone(true), fitted.matrix, placement, space, prop.id);
    patch = surface ? compilePatch(surface, { fillHoles: true }) : null;
    const solid = solidOf(shape);
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
    }
    else if (!patch && shape) patch = compilePatch(shape, { fillHoles: true });
  } else if (shape) {
    patch = compilePatch(shape, { fillHoles: true });
  }
  if (patch?.solid) patch.solid.restitution = role === 'barrier' ? (prop.roleConfig?.restitution ?? 0.6) : 0.35;
  return patch;
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
