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
  engineDistanceFromX, engineFromWorld, engineXFromDistance, getTrackSpace, worldFromCanonical, type TrackSpaceMap,
} from './track-space';
import type { LaneNetwork, LaneNode, LaneNodeKind } from './lane-network';
import { inferKind, laneColorOf } from './lane-network';

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
/** A node in a group selection (amber, the builder's selection colour). */
export const LANE_GROUP_COLOR = 0xffb020;

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

  /**
   * `space` is the course's road (the island's own for the island): handles sit on that road, and a
   * drag lands back on it. The classic courses share one.
   */
  constructor(private readonly parent: THREE.Object3D, private readonly space: () => TrackSpaceMap = getTrackSpace) {
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
    const map = this.space();
    const s = map.trackDistFromEngineDistance(engineDistanceFromX(x));
    const placement = worldFromCanonical(map, { s, laneZ: z, altitude: 0 });
    const { world } = placement;
    return new THREE.Vector3(world.x, world.y + lift, world.z);
  }

  /** A raycast hit in the world → engine (x, z). The inverse of `worldFromEngine`. */
  engineFromWorld(point: THREE.Vector3): { x: number; z: number; residual: number; ambiguous: boolean } {
    const map = this.space();
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
    // The selection ball is kept (hidden) and reused: dropping it here left the old one in the scene,
    // a white wireframe behind every edit that rebuilt the drawing.
    if (this.selected) this.selected.visible = false;
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
      // Vertex colours: each lane its own colour, still one material.
      this.lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true });
      this.stats.materialsCreated += 1;
    }

    const nodeCount = Math.min(network.nodes.length, LANE_HANDLE_CAPACITY);
    // Boxes: flat-shaded, 12 triangles each, easy to see and cheap to draw however many there are.
    const geometry = new THREE.BoxGeometry(LANE_HANDLE_RADIUS * 1.5, LANE_HANDLE_RADIUS * 1.5, LANE_HANDLE_RADIUS * 1.5);
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
      handles.setColorAt(i, this.colorOf(node));
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
    this.handles.setColorAt(instance, this.colorOf(node));
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

  /** Nodes in a group selection: their handles turn the selection colour (no new materials). */
  private group = new Set<string>();
  private colorOf(node: LaneNode): THREE.Color {
    if (this.group.has(node.id)) return new THREE.Color(LANE_GROUP_COLOR);
    // A node coloured by hand keeps its colour.
    if (typeof node.color === 'string') return new THREE.Color(node.color);
    const kind = this.kindOf(node);
    // Splits, merges and out-of-bounds ends keep their kind's colour (red, amber, green); a plain node
    // shows its lane's.
    if (kind !== 'normal') return new THREE.Color(LANE_KIND_COLORS[kind]);
    return new THREE.Color(laneColorOf(this.laneOf(node.id)));
  }

  /** The lane a node carries on along (or, at a lane's end, the one it ends). */
  private laneOf(nodeId: string) {
    const paths = this.network?.paths.filter((path) => path.nodeIds.includes(nodeId)) ?? [];
    return paths.find((path) => path.nodeIds[path.nodeIds.length - 1] !== nodeId) ?? paths[0];
  }

  /**
   * The node nearest the pointer on screen, within `radiusPx`: a handle far from the camera is a few
   * pixels wide, and hitting its sphere exactly made nodes hard to pick, drag or Ctrl-click.
   */
  pickNear(camera: THREE.Camera, ndcX: number, ndcY: number, width: number, height: number, radiusPx = 16): string | null {
    if (!this.network) return null;
    let best: string | null = null; let bestDistance = radiusPx;
    const v = new THREE.Vector3();
    for (const node of this.network.nodes) {
      const world = this.worldPositions.get(node.id);
      if (!world) continue;
      v.copy(world).project(camera);
      if (v.z <= -1 || v.z >= 1) continue;
      const distance = Math.hypot((v.x - ndcX) * width / 2, (v.y - ndcY) * height / 2);
      if (distance < bestDistance) { bestDistance = distance; best = node.id; }
    }
    return best;
  }

  /** Recolours the handles for a group selection (the panel's primary node keeps its wireframe too). */
  setGroupSelection(ids: ReadonlySet<string>): void {
    this.group = new Set(ids);
    if (!this.handles || !this.network) return;
    for (const node of this.network.nodes) {
      const instance = this.index.get(node.id);
      if (instance !== undefined) this.handles.setColorAt(instance, this.colorOf(node));
    }
    if (this.handles.instanceColor) this.handles.instanceColor.needsUpdate = true;
  }

  /** Each handle's point on the screen (normalised device coordinates), for a box selection. */
  handlesInNdc(camera: THREE.Camera): { id: string; x: number; y: number; inFront: boolean }[] {
    if (!this.network) return [];
    const v = new THREE.Vector3();
    return this.network.nodes.map((node) => {
      v.copy(this.worldFromEngine(node.x, node.z)).project(camera);
      return { id: node.id, x: v.x, y: v.y, inFront: v.z > -1 && v.z < 1 };
    });
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
      this.selected = new THREE.Mesh(new THREE.BoxGeometry(LANE_HANDLE_RADIUS * 2.2, LANE_HANDLE_RADIUS * 2.2, LANE_HANDLE_RADIUS * 2.2), this.selectedMaterial);
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

  /**
   * The connection nearest the pointer on screen (within `radiusPx`): the lane and the index of its
   * first node, so a click on a line between two nodes picks that connection.
   */
  pickSegment(camera: THREE.Camera, ndcX: number, ndcY: number, width: number, height: number, radiusPx = 10): { pathId: string; index: number; fromId: string; toId: string } | null {
    if (!this.network) return null;
    let best: { pathId: string; index: number; fromId: string; toId: string } | null = null;
    let bestDistance = radiusPx;
    const px = (ndcX + 1) * width / 2, py = (1 - ndcY) * height / 2;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const path of this.network.paths) {
      for (let i = 0; i < path.nodeIds.length - 1; i++) {
        const na = this.findNode(path.nodeIds[i]), nb = this.findNode(path.nodeIds[i + 1]);
        if (!na || !nb) continue;
        a.copy(this.worldFromEngine(na.x, na.z, LANE_HANDLE_LIFT * 0.4)).project(camera);
        b.copy(this.worldFromEngine(nb.x, nb.z, LANE_HANDLE_LIFT * 0.4)).project(camera);
        if (a.z <= -1 || a.z >= 1 || b.z <= -1 || b.z >= 1) continue;
        const ax = (a.x + 1) * width / 2, ay = (1 - a.y) * height / 2;
        const bx = (b.x + 1) * width / 2, by = (1 - b.y) * height / 2;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
        const d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
        if (d < bestDistance) { bestDistance = d; best = { pathId: path.id, index: i, fromId: path.nodeIds[i], toId: path.nodeIds[i + 1] }; }
      }
    }
    return best;
  }

  private highlight: THREE.Mesh | null = null;
  private highlightMaterial: THREE.MeshBasicMaterial | null = null;

  /**
   * A bright ribbon over the picked connection or line (consecutive node ids of one lane): lines are
   * one pixel wide, so a selection needs something you can see.
   */
  setHighlightedLine(nodeIds: readonly string[] | null): void {
    if (!nodeIds || nodeIds.length < 2 || !this.network) {
      if (this.highlight) this.highlight.visible = false;
      return;
    }
    const points = nodeIds.map((id) => this.findNode(id)).filter((n): n is LaneNode => !!n)
      .map((n) => this.worldFromEngine(n.x, n.z, LANE_HANDLE_LIFT * 0.45));
    const half = 22;
    const positions: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i], q = points[i + 1];
      const dir = new THREE.Vector3().subVectors(q, p);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(half);
      const a1 = p.clone().add(side), a2 = p.clone().sub(side), b1 = q.clone().add(side), b2 = q.clone().sub(side);
      positions.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z, b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (!this.highlight) {
      this.highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
      this.stats.materialsCreated += 1;
      this.highlight = new THREE.Mesh(geometry, this.highlightMaterial);
      this.highlight.name = 'LaneHighlight';
      this.highlight.renderOrder = 30;
      this.highlight.raycast = () => {};
      this.root.add(this.highlight);
    } else {
      this.highlight.geometry.dispose();
      this.highlight.geometry = geometry;
    }
    this.highlight.visible = true;
  }

  private draft: THREE.InstancedMesh | null = null;
  private draftLine: THREE.Line | null = null;

  /**
   * The line being drawn out, before it is let go: hologram boxes where nodes will drop and a line
   * joining them (engine points). Empty hides it.
   */
  setDraft(points: readonly { x: number; z: number }[], material: THREE.Material): void {
    if (!points.length) {
      if (this.draft) this.draft.visible = false;
      if (this.draftLine) this.draftLine.visible = false;
      return;
    }
    if (!this.draft) {
      const size = LANE_HANDLE_RADIUS * 1.5;
      this.draft = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), material, 512);
      this.draft.name = 'LaneDraft';
      this.draft.raycast = () => {};
      this.draft.renderOrder = 40;
      this.root.add(this.draft);
      this.draftLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.9, depthTest: false }));
      this.draftLine.name = 'LaneDraftLine';
      this.draftLine.raycast = () => {};
      this.draftLine.renderOrder = 41;
      this.root.add(this.draftLine);
    }
    const count = Math.min(512, points.length);
    const world = points.slice(0, count).map((p) => this.worldFromEngine(p.x, p.z));
    world.forEach((w, i) => this.draft!.setMatrixAt(i, new THREE.Matrix4().setPosition(w)));
    this.draft.count = count;
    this.draft.instanceMatrix.needsUpdate = true;
    this.draft.visible = true;
    this.draftLine!.geometry.dispose();
    this.draftLine!.geometry = new THREE.BufferGeometry().setFromPoints(world.map((w) => w.clone().setY(w.y - LANE_HANDLE_LIFT * 0.6)));
    this.draftLine!.visible = true;
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

  /** Where each handle is drawn (for picking by screen distance). */
  private readonly worldPositions = new Map<string, THREE.Vector3>();

  private writeHandle(instance: number, node: LaneNode): void {
    if (!this.handles) return;
    const world = this.worldFromEngine(node.x, node.z);
    this.worldPositions.set(node.id, world);
    this.handles.setMatrixAt(instance, new THREE.Matrix4().setPosition(world));
    this.handles.instanceMatrix.needsUpdate = true;
    // The pick sphere is cached from the first raycast: a moved handle must refresh it.
    this.handles.boundingSphere = null;
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
    const colour = new THREE.Color(laneColorOf(path));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(points.flatMap(() => [colour.r, colour.g, colour.b]), 3));
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
