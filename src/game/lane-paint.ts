/**
 * M01 · T6/T7 dressing — **the lanes you authored, painted on the road you drive.**
 *
 * Until now an authored network was physics and logic: `sim/racer-physics.ts` steered by
 * `sampleLane`, the OOB nodes recovered you, the builder drew its handles — but the race itself still
 * looked like four lanes of legacy corridor. This file closes that: one painted ribbon per path,
 * drawn from the *same* `sampleLane` samples the physics steers by, so what a player sees and what a
 * ball obeys cannot disagree.
 *
 * The laws it keeps, all of which `tests/lane-paint.test.ts` asserts headlessly (three.js builds
 * geometry and materials without a WebGL context):
 *
 *  - **One mesh per path, one material in total.** Colour is per-vertex (`vertexColors`), so the
 *    neutral road paint and the kind tint at a path's end are the same draw call, and a second
 *    document reuses the material — `stats.materialsCreated` can only ever reach 1.
 *  - **A rebuild is decided by identity.** `setNetwork` compares by reference: the render loop hands
 *    it the engine's network every frame and pays nothing unless the document object itself changed
 *    (which is exactly what happens when the builder saves, undoes, imports or switches course).
 *  - **The paint sits on the surface, not in it.** Every vertex is the ribbon point of its engine
 *    (x, z) lifted by `LANE_PAINT_LIFT`, so it cannot z-fight the road or sink into a rise.
 *  - **The end of a path reads as its kind.** The last stretch of each ribbon is tinted by the
 *    terminal node's inferred kind — green for a merge, amber for a split, red for an out-of-bounds
 *    end (the lane that stops) — and the ribbon simply *stops* where the path does, because a painted
 *    lane that carried on past its last node would be a lie about where you can drive.
 *
 * No DOM, no canvas, no React. Importable from a node test.
 */
import * as THREE from 'three';
import {
  engineDistanceFromX, engineXFromDistance, getTrackSpace, worldFromCanonical,
} from './track-space';
import { inferKind, sampleLane, type LaneNetwork, type LaneNodeKind } from './lane-network';

/** How far above the ribbon the paint floats. World units; a lane is 240 wide, a ball 62 across. */
export const LANE_PAINT_LIFT = 8;
/** Painted line width: a centre line down each path, not a filled band (bands would overlap). */
export const LANE_PAINT_HALF_STROKE = 15;
/** Sampling distance along x. The road's own curvature needs no more; 400 keeps the strip small. */
export const LANE_PAINT_STEP = 400;
/** Minimum step: a path spanning a handful of units still gets both its ends and no zero-length quad. */
export const LANE_PAINT_MIN_STEP = 5;
/** How much of a path's end is tinted by its terminal kind. */
export const LANE_PAINT_END_LENGTH = 900;

/** The neutral road paint, and the tint each kind ends in. Readable against the legacy road. */
export const LANE_PAINT_COLOR = 0xfde68a; // warm off-white: painted line
export const LANE_KIND_PAINT: Readonly<Record<LaneNodeKind, number>> = Object.freeze({
  normal: LANE_PAINT_COLOR,
  merge: 0x34d399, // green: two roads become one
  split: 0xfbbf24, // amber: one becomes two
  oob: 0xf87171, // red: the lane that stops
});

export interface LanePaintStats {
  /** Ribbon meshes currently in the scene: one per path. */
  ribbons: number;
  /** Vertices across every ribbon. */
  vertices: number;
  /** Path strips rebuilt since construction. A new document rebuilds all of them, once. */
  rebuilds: number;
  /** Geometries disposed. Every rebuild disposes exactly what it replaces. */
  disposals: number;
  /** Materials constructed. Created once, on the first non-null document, and never again. */
  materialsCreated: number;
}

/** One sample of a path: its centre, its width, and how far along the tinted end it is. */
export interface LanePaintSample {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
}

/**
 * The sampled spine of a path, from its first node to its last, in steps of at most `step`.
 *
 * Pure, and exported, because the two things that could quietly go wrong are measurable here rather
 * than in a screenshot: the strip must **span the path exactly** (first sample at the first node's x,
 * last at the last node's, so no lane is painted short or long) and it must never step further than
 * asked (or a curved path would be painted as a chord).
 */
export function lanePaintSamples(
  network: LaneNetwork, pathId: string, step: number = LANE_PAINT_STEP,
): LanePaintSample[] {
  const path = network.paths.find((candidate) => candidate.id === pathId);
  if (!path) return [];
  const nodes = path.nodeIds
    .map((id) => network.nodes.find((node) => node.id === id))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  if (nodes.length < 2) return [];
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!(last.x > first.x)) return [];

  const safeStep = Math.max(LANE_PAINT_MIN_STEP, Math.min(step, last.x - first.x));
  const samples: LanePaintSample[] = [];
  for (let x = first.x; x < last.x; x += safeStep) {
    const sample = sampleLane(network, pathId, x);
    if (sample) samples.push({ x, z: sample.z, halfWidth: sample.halfWidth });
  }
  const end = sampleLane(network, pathId, last.x);
  if (end) samples.push({ x: last.x, z: end.z, halfWidth: end.halfWidth });
  return samples;
}

/** The kind a path ends in: what its last node's shape says. */
export function lanePathTerminalKind(network: LaneNetwork, pathId: string): LaneNodeKind {
  const path = network.paths.find((candidate) => candidate.id === pathId);
  const last = path?.nodeIds[path.nodeIds.length - 1];
  if (!last) return 'normal';
  const kind = inferKind(network, last);
  return kind === 'orphan' ? 'normal' : kind;
}

/**
 * The painted lane layer. `parent` is the renderer's scene (or a test's `THREE.Scene`); everything it
 * adds lives under `root`, so `dispose()` leaves the parent exactly as it found it.
 */
export class LanePaint {
  readonly root = new THREE.Group();
  readonly stats: LanePaintStats = {
    ribbons: 0, vertices: 0, rebuilds: 0, disposals: 0, materialsCreated: 0,
  };

  private network: LaneNetwork | null = null;
  private material: THREE.MeshBasicMaterial | null = null;
  private readonly meshes = new Map<string, THREE.Mesh>();

  constructor(private readonly parent: THREE.Object3D) {
    this.root.name = 'LanePaint';
    parent.add(this.root);
  }

  /** The document currently painted, or null. */
  get document(): LaneNetwork | null { return this.network; }

  /**
   * Paints `network`. Returns true when work was done, false when the same document object came back
   * — which is the common case: the render loop calls this once per frame with `engine.lanePaths`.
   */
  setNetwork(network: LaneNetwork | null): boolean {
    if (network === this.network) return false;
    this.network = network;
    this.clearRibbons();
    if (!network) return false;

    for (const path of network.paths) this.buildRibbon(network, path.id);
    this.stats.ribbons = this.meshes.size;
    return true;
  }

  /** A path was edited in place (the builder's drag): repaint exactly that path. */
  rebuildPath(network: LaneNetwork, pathId: string): boolean {
    if (network !== this.network) return false;
    const existed = this.meshes.has(pathId);
    this.buildRibbon(network, pathId);
    this.stats.ribbons = this.meshes.size;
    return existed;
  }

  dispose(): void {
    this.clearRibbons();
    this.network = null;
    if (this.material) {
      this.material.dispose();
      this.material = null;
      this.stats.materialsCreated = 0;
    }
    this.parent.remove(this.root);
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /**
   * The one material, built the first time a strip is actually painted. A document with no paths
   * therefore costs nothing at all — not even a material — which is what an empty network means.
   */
  private ensureMaterial(): THREE.MeshBasicMaterial {
    if (this.material) return this.material;
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      // Painted road markings are thin, and the ball's shadow is not a reason to lose them.
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      // Both belts and braces: the lift keeps the paint off the surface, polygonOffset keeps it out
      // of the depth buffer's way when the road's own tessellation wiggles underneath it.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.stats.materialsCreated += 1;
    return this.material;
  }

  private clearRibbons(): void {
    for (const mesh of this.meshes.values()) {
      this.root.remove(mesh);
      mesh.geometry.dispose();
      this.stats.disposals += 1;
    }
    this.meshes.clear();
    this.stats.ribbons = 0;
    this.stats.vertices = 0;
  }

  private buildRibbon(network: LaneNetwork, pathId: string): void {
    const samples = lanePaintSamples(network, pathId);
    const existing = this.meshes.get(pathId);
    if (existing) {
      this.root.remove(existing);
      existing.geometry.dispose();
      this.stats.disposals += 1;
      this.meshes.delete(pathId);
    }
    if (samples.length < 2) return;
    const material = this.ensureMaterial();

    const kind = lanePathTerminalKind(network, pathId);
    const tint = new THREE.Color(LANE_KIND_PAINT[kind]);
    const paint = new THREE.Color(LANE_PAINT_COLOR);
    const endX = samples[samples.length - 1].x;
    const map = getTrackSpace();

    const positions = new Float32Array(samples.length * 2 * 3);
    const colors = new Float32Array(samples.length * 2 * 3);
    const indices: number[] = [];
    const point = (sample: LanePaintSample, side: -1 | 1, out: THREE.Vector3) => {
      const s = map.trackDistFromEngineDistance(engineDistanceFromX(sample.x));
      const placement = worldFromCanonical(map, {
        s, laneZ: sample.z + side * LANE_PAINT_HALF_STROKE, altitude: 0,
      });
      out.set(placement.world.x, placement.world.y + LANE_PAINT_LIFT, placement.world.z);
    };

    const scratch = new THREE.Vector3();
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      // The tint fades in over the last stretch rather than switching at a line: a painted lane that
      // changes colour mid-asphalt reads as a mistake, one that warms toward its end reads as a sign.
      const remaining = endX - sample.x;
      const t = kind === 'normal' || remaining > LANE_PAINT_END_LENGTH ? 0 : 1 - remaining / LANE_PAINT_END_LENGTH;
      for (const side of [-1, 1] as const) {
        point(sample, side, scratch);
        const at = (index * 2 + (side === -1 ? 0 : 1)) * 3;
        positions[at] = scratch.x; positions[at + 1] = scratch.y; positions[at + 2] = scratch.z;
        const r = paint.r + (tint.r - paint.r) * t;
        const g = paint.g + (tint.g - paint.g) * t;
        const b = paint.b + (tint.b - paint.b) * t;
        colors[at] = r; colors[at + 1] = g; colors[at + 2] = b;
      }
      if (index === 0) continue;
      const before = (index - 1) * 2;
      const after = index * 2;
      indices.push(before, before + 1, after + 1, before, after + 1, after);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `LanePaint:${pathId}`;
    mesh.matrixAutoUpdate = false;
    // The paint is decoration: it never occludes the ball, a racer or an effect.
    mesh.renderOrder = 1;
    this.meshes.set(pathId, mesh);
    this.root.add(mesh);
    this.stats.rebuilds += 1;
    this.stats.vertices += samples.length * 2;
  }
}

/** The world point a paint vertex uses — exported so a test can compare it with the road's own surface. */
export function lanePaintWorldPoint(x: number, z: number): THREE.Vector3 {
  const map = getTrackSpace();
  const s = map.trackDistFromEngineDistance(engineDistanceFromX(x));
  const { world } = worldFromCanonical(map, { s, laneZ: z, altitude: 0 });
  return new THREE.Vector3(world.x, world.y, world.z);
}

/** Kept so callers can name the same conversion the paint uses when reporting a path's end. */
export const lanePaintEngineX = (distance: number) => engineXFromDistance(distance);
