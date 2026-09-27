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
