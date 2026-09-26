/**
 * ISLAND-ROUTE: the Meshy kit placed on Basalt Isle. Presentation only (the race never touches these;
 * KIT-WIRE owns collision). Pieces on the road are placed in the road's own frame (right, up, along),
 * so they stay true to the route when it is re-authored; sea stacks stand in the sea at polar points.
 * Every Meshy model is about 1.9 units at its widest, so `size` is simply the widest extent wanted.
 */
import * as THREE from 'three';
import { loadGlb } from '../models/glb';
import type { TrackSpaceMap } from '../track-space';
import { polar, type PolarPoint } from './geometry';
import { islandBranchSpace, islandTrackSpace } from './island-space';

const MODEL_EXTENT = 1.9;

export interface RoadLandmark {
  readonly model: string;
  /** On a branch's road (section, branch), else the main road. */
  readonly branch?: readonly [string, string];
  /** A waypoint label, and how far past it along the road. */
  readonly at: string;
  readonly ahead?: number;
  /** Across the road (+ is right) and up from the road surface. */
  readonly lateral?: number;
  readonly lift?: number;
  readonly size: number;
  /** Extra turn about the vertical, in degrees (0: the model's depth runs along the road). */
  readonly yaw?: number;
}

export interface SeaLandmark {
  readonly model: string;
  readonly at: PolarPoint;
  readonly size: number;
  readonly yaw: number;
}

/** Midway through a fork's branch, as an `ahead` from its split. */
const mid = (map: TrackSpaceMap, section: string) => (map.distOf(`${section}:merge`) - map.distOf(`${section}:split`)) / 2;

export const ROAD_LANDMARKS: readonly RoadLandmark[] = [
  // The scaffold tower the starter goblin works from, beside the shack.
  { model: 'stunt-scaffold-tower', at: 'shack', ahead: 500, lateral: -1500, lift: -200, size: 2600 },
  // Hoops to ride through on the chute out of the Maw and after the spiral (decoration: the ball rolls on).
  { model: 'stunt-giant-loop', at: 'mawMouth', ahead: 1800, lift: -150, size: 1900 },
  { model: 'stunt-double-loop', at: 'spiral:merge', ahead: 1200, lift: -150, size: 2600, yaw: 90 },
  // The lava tube's mouth, and the waterfall portal the road bursts out of.
  { model: 'basalt-cave', at: 'caveEnter', ahead: 200, lift: -250, size: 3000 },
  { model: 'stunt-waterfall-portal', at: 'caveExit', ahead: 300, lift: -300, size: 3000 },
  // The sea arch spans the Sea Cave branch.
  { model: 'sea-arch', branch: ['arch', 'cave'], at: 'arch:split', ahead: -1, lift: -350, size: 5200 },
  // The lagoon arena.
  { model: 'lagoon-platform', at: 'arena', ahead: 0, lift: -700, size: 6000 },
];

/** Sea stacks off the slalom and round the coast, no two alike. */
export const SEA_LANDMARKS: readonly SeaLandmark[] = [
  { model: 'sea-stack-tall', at: { theta: 664, r: 27400, y: -500 }, size: 3400, yaw: 20 },
  { model: 'sea-stack-tall', at: { theta: 671, r: 28900, y: -700 }, size: 4600, yaw: 140 },
  { model: 'sea-stack-tall', at: { theta: 677, r: 27100, y: -400 }, size: 2600, yaw: 250 },
  { model: 'sea-stack-tall', at: { theta: 684, r: 29300, y: -600 }, size: 3900, yaw: 75 },
  { model: 'sea-stack-tall', at: { theta: 690, r: 27800, y: -500 }, size: 3000, yaw: 310 },
  { model: 'sea-stack-tall', at: { theta: 598, r: 30200, y: -700 }, size: 4200, yaw: 190 },
  { model: 'sea-stack-tall', at: { theta: 618, r: 31500, y: -800 }, size: 5200, yaw: 33 },
  { model: 'sea-stack-tall', at: { theta: 552, r: 29600, y: -600 }, size: 3600, yaw: 280 },
  { model: 'sea-stack-tall', at: { theta: 470, r: 30800, y: -700 }, size: 4400, yaw: 120 },
];

/** Where a road landmark goes: its map, the frame at its spot, and the world transform. */
export function roadLandmarkTransform(l: RoadLandmark): { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number } {
  const map = l.branch ? islandBranchSpace(l.branch[0], l.branch[1]) : islandTrackSpace();
  const ahead = l.ahead === -1 && l.branch ? mid(map, l.branch[0]) : (l.ahead ?? 0);
  const f = map.frameAt(map.distOf(l.at) + ahead);
  const lateral = l.lateral ?? 0;
  const lift = l.lift ?? 0;
  const position = new THREE.Vector3(
    f.pos.x + f.right.x * lateral + f.up.x * lift,
    f.pos.y + f.right.y * lateral + f.up.y * lift,
    f.pos.z + f.right.z * lateral + f.up.z * lift,
  );
  // Level the frame (a landmark stands upright), then turn it so the model's depth runs along the road.
  const forward = new THREE.Vector3(f.tangent.x, 0, f.tangent.z).normalize();
  const yaw = Math.atan2(forward.x, forward.z) + ((l.yaw ?? 0) * Math.PI) / 180;
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return { position, quaternion, scale: l.size / MODEL_EXTENT };
}

/** Loads and places every landmark into `group` as each model arrives (low tier when asked). */
export function placeIslandLandmarks(group: THREE.Group, opts: { performance?: boolean } = {}): Promise<void> {
  const url = (model: string) => `/models/kit/${model}${opts.performance ? '.lod' : ''}.glb`;
  const jobs: Promise<void>[] = [];
  for (const l of ROAD_LANDMARKS) {
    jobs.push(loadGlb(url(l.model)).then((scene) => {
      const object = scene.clone(true);
      const t = roadLandmarkTransform(l);
      object.position.copy(t.position);
      object.quaternion.copy(t.quaternion);
      object.scale.setScalar(t.scale);
      object.name = `Landmark: ${l.model}`;
      group.add(object);
    }).catch(() => undefined));
  }
  for (const l of SEA_LANDMARKS) {
    jobs.push(loadGlb(url(l.model)).then((scene) => {
      const object = scene.clone(true);
      const p = polar(l.at);
      object.position.set(p.x, p.y, p.z);
      object.rotation.y = (l.yaw * Math.PI) / 180;
      object.scale.setScalar(l.size / MODEL_EXTENT);
      object.name = `Landmark: ${l.model}`;
      group.add(object);
    }).catch(() => undefined));
  }
  return Promise.all(jobs).then(() => undefined);
}
