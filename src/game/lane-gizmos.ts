/**
 * M01 · T7 (IF-BUILDER) — the lane gizmos: the 3D half of the lane tool.
 *
 * The brain is `lane-path-tool.ts` (pure, tested without a canvas). This file is the drawing and the
 * mapping, and it is deliberately kept away from `TrackBuilder3D` so that its own promises can be
 * asserted headlessly — three.js builds geometry and materials fine without a WebGL context:
 *
 *  - **one `InstancedMesh` for every node handle**, capacity 512, coloured per kind through
 *    `instanceColor` (so there is one material, not one per handle);
 *  - **one `Line` per path**, and its geometry is rebuilt only when that path's own node positions
 *    change. Dragging a node touches exactly that node's handle matrix and the geometries of the paths
 *    that contain it — nothing else, and **no new materials, ever** (`stats` counts all three, which is
 *    what AC-4 asks the test to spy on);
 *  - **the engine↔world mapping lives here too** (`worldFromEngine` / `engineFromWorld`), because a
 *    handle's drag is only correct if it lands on the road: engine (x, z) → canonical (s, laneZ) →
 *    ribbon point, and the raycast hit → the inverse. Both come from `track-space.ts`, so the builder
 *    and the physics agree by construction rather than by a copied formula.
 *
 * No DOM, no canvas, no React. Importable from a node test.
 */
import * as THREE from 'three';
import {
  engineDistanceFromX, engineFromWorld, engineXFromDistance, getTrackSpace, worldFromCanonical,
} from './track-space';
import type { LaneNetwork, LaneNode, LaneNodeKind } from './lane-network';
import { inferKind } from './lane-network';

/** How high above the ribbon a handle floats, and how big it is. World units (a lane is 240 wide). */
export const LANE_HANDLE_LIFT = 70;
export const LANE_HANDLE_RADIUS = 46;
/** One mesh, whatever the document: capacity ceiling for authored nodes. */
export const LANE_HANDLE_CAPACITY = 2048;

/** The four kinds, plus the selection ring. Distinct colours, checked by the test. */
export const LANE_KIND_COLORS: Readonly<Record<LaneNodeKind, number>> = Object.freeze({
  normal: 0x60a5fa, // blue
  merge: 0x34d399, // green
  split: 0xfbbf24, // amber
  oob: 0xf87171, // red
});
export const LANE_PATH_COLOR = 0x38bdf8;
export const LANE_SELECTED_COLOR = 0xffffff;

export interface LaneGizmoStats {
  /** Per-instance matrix writes: one per handle moved. */
  handleWrites: number;
  /** Path geometries rebuilt. A drag on a node may only rebuild the paths through that node. */
  pathRebuilds: number;
  /** Materials constructed. Created once, on the first `setNetwork`, and never again. */
  materialsCreated: number;
  /** Live counts, for the panel and for the test's arithmetic. */
  nodes: number;
  paths: number;
}

/**
 * The gizmo layer. `parent` is the builder's own lane group (`scene` works in a test); everything this
 * class adds is under `root`, so `dispose()` can leave the parent exactly as it found it.
 */
export class LaneGizmos {
  readonly root = new THREE.Group();
  readonly stats: LaneGizmoStats = {
    handleWrites: 0, pathRebuilds: 0, materialsCreated: 0, nodes: 0, paths: 0,
  };

  private network: LaneNetwork | null = null;
  private handles: THREE.InstancedMesh | null = null;
  private handleMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly lines = new Map<string, THREE.Line>();
  private lineMaterial: THREE.LineBasicMaterial | null = null;
  private selectedMaterial: THREE.MeshBasicMaterial | null = null;
  private selected: THREE.Mesh | null = null;
  /** Node order in the handle mesh: instance index → node id. */
  private order: string[] = [];
  private index = new Map<string, number>();

  constructor(private readonly parent: THREE.Object3D) {
    this.root.name = 'LaneGizmos';
    parent.add(this.root);
  }

  /** The document currently drawn, or null. */
  get document(): LaneNetwork | null { return this.network; }

  // ---------------------------------------------------------------------------
  // Engine ↔ world. The one place a handle's position is decided.
  // ---------------------------------------------------------------------------

  /** Engine (x, z) → the point on the ribbon a handle floats above. */
  worldFromEngine(x: number, z: number, lift = LANE_HANDLE_LIFT): THREE.Vector3 {
    const map = getTrackSpace();
    const s = map.trackDistFromEngineDistance(engineDistanceFromX(x));
    const placement = worldFromCanonical(map, { s, laneZ: z, altitude: 0 });
    const { world } = placement;
    return new THREE.Vector3(world.x, world.y + lift, world.z);
  }

  /** A raycast hit in the world → engine (x, z). The inverse of `worldFromEngine`. */
  engineFromWorld(point: THREE.Vector3): { x: number; z: number; residual: number; ambiguous: boolean } {
    const map = getTrackSpace();
    const canonical = engineFromWorld(map, { x: point.x, y: point.y, z: point.z });
    return {
      x: engineXFromDistance(canonical.distance),
      z: canonical.laneZ,
      residual: canonical.residual,
      ambiguous: canonical.ambiguous,
    };
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /** Full rebuild: the document itself changed (open, import, undo, course switch). */
  setNetwork(network: LaneNetwork | null): void {
    this.network = network;
    this.selected = null;
    this.disposeHandles();
    for (const line of this.lines.values()) this.disposeLine(line);
    this.lines.clear();
    this.order = [];
    this.index.clear();
    this.stats.nodes = 0;
    this.stats.paths = 0;
    if (!network) return;

    // Materials: once. Every later edit reuses them, which is the "0 new materials" half of AC-4.
    if (!this.handleMaterial) {
      this.handleMaterial = new THREE.MeshBasicMaterial();
      this.stats.materialsCreated += 1;
    }
    if (!this.lineMaterial) {
      this.lineMaterial = new THREE.LineBasicMaterial({ color: LANE_PATH_COLOR });
      this.stats.materialsCreated += 1;
    }

    const nodeCount = Math.min(network.nodes.length, LANE_HANDLE_CAPACITY);
    const geometry = new THREE.SphereGeometry(LANE_HANDLE_RADIUS, 10, 8);
    const handles = new THREE.InstancedMesh(geometry, this.handleMaterial, Math.max(1, nodeCount));
    handles.name = 'LaneHandles';
    handles.count = nodeCount;
    handles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.handles = handles;
    this.root.add(handles);

    for (let i = 0; i < nodeCount; i++) {
      const node = network.nodes[i];
      this.order.push(node.id);
      this.index.set(node.id, i);
      this.writeHandle(i, node);
      handles.setColorAt(i, new THREE.Color(LANE_KIND_COLORS[this.kindOf(node)]));
    }
    if (handles.instanceColor) handles.instanceColor.needsUpdate = true;
    this.stats.nodes = nodeCount;

    for (const path of network.paths) this.buildLine(path.id);
    this.stats.paths = network.paths.length;
  }

  /**
   * One node moved: rewrite that handle's matrix and rebuild the geometries of the paths through it.
   * Reads the position back out of the document, so the gizmo draws where the *network* says the node
   * is (a refused or snapped drag lands where the tool decided, not where the pointer was).
   */
  moveNode(nodeId: string, network?: LaneNetwork): number {
    // The builder replaces its document on every edit (the tool is pure and returns a new network).
    // Without adopting it here this layer kept reading the *old* document: the handle, its path line
    // and the selection wireframe all stayed at the node's old spot until some later full rebuild.
    if (network) this.network = network;
    const node = this.findNode(nodeId);
    const instance = this.index.get(nodeId);
    if (!node || instance === undefined || !this.handles) return 0;
    this.writeHandle(instance, node);
    this.handles.setColorAt(instance, new THREE.Color(LANE_KIND_COLORS[this.kindOf(node)]));
    if (this.handles.instanceColor) this.handles.instanceColor.needsUpdate = true;
    if (this.selected && this.selected.visible && node) {
      this.selected.position.copy(this.worldFromEngine(node.x, node.z));
    }
    let rebuilt = 0;
    for (const pathId of this.pathsWith(nodeId)) {
      this.buildLine(pathId);
      rebuilt += 1;
    }
    return rebuilt;
  }

  /** The paths a node belongs to — the only geometry a drag on it may touch. */
  pathsWith(nodeId: string): string[] {
    if (!this.network) return [];
    return this.network.paths.filter((path) => path.nodeIds.includes(nodeId)).map((path) => path.id);
  }

  /** Highlights the node the panel has selected. Reuses one mesh and one material, created once. */
  setSelectedNode(nodeId: string | null): void {
    const node = nodeId ? this.findNode(nodeId) : null;
    if (!this.selected) {
      if (!node) return;
      if (!this.selectedMaterial) {
        this.selectedMaterial = new THREE.MeshBasicMaterial({
          color: LANE_SELECTED_COLOR, wireframe: true, transparent: true, opacity: 0.9,
        });
        this.stats.materialsCreated += 1;
      }
      this.selected = new THREE.Mesh(new THREE.SphereGeometry(LANE_HANDLE_RADIUS * 1.45, 12, 8), this.selectedMaterial);
      this.selected.name = 'LaneSelectedNode';
      this.root.add(this.selected);
    }
    if (!node) { this.selected.visible = false; return; }
    this.selected.visible = true;
    this.selected.position.copy(this.worldFromEngine(node.x, node.z));
  }

  /** What a ray hit, if it hit a handle: the node id, else null. */
  raycast(raycaster: THREE.Raycaster): string | null {
    if (!this.handles) return null;
    const hits = raycaster.intersectObject(this.handles, false);
    const hit = hits.find((candidate) => (candidate.instanceId ?? -1) >= 0);
    if (!hit) return null;
    return this.order[hit.instanceId as number] ?? null;
  }

  /** Removes everything this layer drew, and nothing else. Materials are kept for reuse. */
  dispose(): void {
    this.disposeHandles();
    for (const line of this.lines.values()) this.disposeLine(line);
    this.lines.clear();
    this.order = [];
    this.index.clear();
    if (this.selected) {
      this.root.remove(this.selected);
      this.selected.geometry.dispose();
      this.selected = null;
    }
    this.parent.remove(this.root);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private findNode(nodeId: string): LaneNode | null {
    return this.network?.nodes.find((node) => node.id === nodeId) ?? null;
  }

  private kindOf(node: LaneNode): LaneNodeKind {
    const inferred = this.network ? inferKind(this.network, node.id) : 'normal';
    return inferred === 'orphan' ? 'normal' : inferred;
  }

  private writeHandle(instance: number, node: LaneNode): void {
    if (!this.handles) return;
    this.handles.setMatrixAt(instance, new THREE.Matrix4().setPosition(this.worldFromEngine(node.x, node.z)));
    this.handles.instanceMatrix.needsUpdate = true;
    this.stats.handleWrites += 1;
  }

  private buildLine(pathId: string): void {
    const path = this.network?.paths.find((candidate) => candidate.id === pathId);
    if (!path || !this.lineMaterial) return;
    const points = path.nodeIds
      .map((nodeId) => this.findNode(nodeId))
      .filter((node): node is LaneNode => node !== null)
      .map((node) => this.worldFromEngine(node.x, node.z, LANE_HANDLE_LIFT * 0.4));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const existing = this.lines.get(pathId);
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geometry;
    } else {
      const line = new THREE.Line(geometry, this.lineMaterial);
      line.name = `LanePath_${pathId}`;
      this.lines.set(pathId, line);
      this.root.add(line);
    }
    this.stats.pathRebuilds += 1;
  }

  private disposeHandles(): void {
    if (!this.handles) return;
    this.root.remove(this.handles);
    this.handles.geometry.dispose();
    this.handles.dispose();
    this.handles = null;
  }

  private disposeLine(line: THREE.Line): void {
    this.root.remove(line);
    line.geometry.dispose();
  }
}
