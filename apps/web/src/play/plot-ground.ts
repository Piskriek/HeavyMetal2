// Your plot's ground in the first Play (SETMIX_PLAN Phases 3 and 4): the 1 km plot of @hm/plotterrain, drawn in chunks with
// detail by distance out to the horizon, in the six natural materials of @hm/groundshader at the plot's stage, with the
// terrain's boulders. Stage 1 and below are faceted (flat shaded, low poly); from stage 2 the same ground is smooth. The
// planet curves away: every height drops by drop(x, z).
import * as THREE from 'three';
import { chunkMesh, chunksAround, createTerrain, type Terrain } from '@hm/plotterrain';
import { createGroundMaterial, makeGroundTextures, setCoverage, setGroundPaint, setStage as setGroundStage, type CoverTextures } from '@hm/groundshader';
import { apply as brushApply, decodeField, emptyField, encodeField, heightAt as brushHeightAt, type BrushOp, type Field, type Rules } from '@hm/terrainbrush';
import { drop } from '../crafter/planet';
import { smoothModel, type SmoothId } from '../crafter/smooth-models';
import { boulderBeamRate, runStroke, SCULPT_RULES, STROKE_RADIUS } from './beam-tool';
import { keptOut, type KeepOutZone } from './beam-keepout';
import { presetLook } from './beam-port';

export interface BoulderInfo {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly ore: number;
}

export interface PlotGround {
  readonly terrain: Terrain;
  readonly material: THREE.ShaderMaterial;
  /** Sets or clears the living coverage mask (R dust, G moss, B grass, A wet) on the ground (TICKET-02 Item B). */
  setCoverage(cover: {
    readonly tex: THREE.DataTexture;
    readonly x0: number;
    readonly z0: number;
    readonly size: number;
    readonly tiles?: CoverTextures;
  } | null): void;
  /** The ground's height at x, z, the planet's curve included. */
  heightAt(x: number, z: number): number;
  /** Keeps the chunks round the eye: builds every one now (behind the loading bar) or one per call (while you walk). */
  update(eyeX: number, eyeZ: number, all?: boolean): void;
  setStage(stage: number): void;
  /** A new triangle budget (the display governor's): the chunks are planned again round the eye and built one a call, the old ones standing in. */
  setBudget(budget: number): void;
  /** Triangles in the chunks now drawn. */
  triangles(): number;
  /** Shows or hides the ground (the tests measure what it costs). */
  setVisible(on: boolean): void;
  /** Gathers up to `amount` ore from boulder `id`. Shrinks as taken and crumbles when empty. */
  gather(id: number, amount: number): number;
  /** The held rifle takes ore from boulder `id` for `dt` seconds at the boulder's own rate (about 4 ore a second, more on scree). */
  beamGather(id: number, dt: number): { readonly mined: number; readonly x: number; readonly y: number; readonly z: number } | null;
  /** Finds the boulder with ore aimed at by the ray from `origin` in `dir` within `maxDist`. */
  findAimedBoulder(origin: THREE.Vector3, dir: THREE.Vector3, maxDist?: number): number | null;
  /** Finds the nearest boulder with ore to `origin`. */
  findNearestBoulder(origin: THREE.Vector3): number | null;
  /** Advances boulder regrowth slowly over a few minutes near rock and scree. */
  regrow(dt: number): void;
  /** The held beam paints `preset` on the ground under (x, z), radius 3 m, for `dt` seconds (no ore). Returns the cells it changed. */
  paint(x: number, z: number, preset: string, dt: number): number;
  /** How many cells carry a preset's paint. */
  paintedCells(): number;
  /**
   * A sculpt stroke (TASK-21d): carve, raise or smooth at the op's point, on the cells the keep-out zones leave alone. The ore is
   * the player's: a carve gains it, a raise spends it (never below zero). Returns the ore after the stroke and the cells cut.
   */
  stroke(op: BrushOp, ore: number): { readonly balance: number; readonly cells: number; readonly gained: number };
  /** The zones the sculpt beam keeps out (the gate's apron, the structures, the machines); the scene sets them as the base changes. */
  setKeepOut(zones: readonly KeepOutZone[]): void;
  /** The sculpt edits and the paint as text (encodeField), for the save. */
  exportField(): string;
  /** Loads the edits and the paint from exportField's text. False, and nothing changes, when the text is not this plot's field. */
  importField(text: string): boolean;
  /** The height edit under (x, z) in metres: negative where ground was carved, positive where it was raised, zero where it was not. */
  editAt(x: number, z: number): number;
  /** How many cells carry a height edit. */
  sculptedCells(): number;
  /** The height of the rendered ground under (x, z), read from the chunk meshes (null off the plot): the check that a cut is drawn. */
  surfaceAt(x: number, z: number): number | null;
  /** Whether the ground is settled: the chunks drawn are the wanted ones, all built, none waiting for a cut's rebuild. */
  settled(): boolean;
  /** Returns boulder states for debug and inspection. */
  getBoulders(): readonly BoulderInfo[];
  dispose(): void;
}

/** Chunk cells and the finest chunk; the horizon is about 4 km away on a 12 km planet. */
const CELLS = 32, MIN_SIZE = 16, SKIRT = 2, EXTENT = 4096;
/** Boulders stand within this square round the gate. */
const BOULDER_SPAN = 320;
/** Each boulder holds about 40 ore when full. */
export const BOULDER_INITIAL_ORE = 40;
/**
 * The sculpt's refinement (TASK-21d): the ground a cut touches is flagged in cells of EDIT_FLAG metres, and the chunks under the flags
 * split down to EDIT_REFINE. Without it a 3 m cut sits inside a chunk whose grid is 30 m or more on the low tiers (the budget spreads
 * the leaves over the whole planet), and the cut would not be drawn. 16 m leaves (0.6 m between vertices) draw a cut of 3 m radius.
 * The refinement is bounded (Opus's review): only cut ground within EDIT_REACH metres of the eye is refined, the nearest first, and
 * at most EDIT_LEAF_CAP refined chunks are made. Cut ground farther off keeps its normal chunks and shows the cut through the height
 * offset alone, which is softer but never a hole.
 */
const EDIT_FLAG = 8;
const EDIT_REFINE = 16;
/** Only cut ground within this many metres of the eye is refined. */
const EDIT_REACH = 120;
/** The most refined chunks a cut may make: 48 chunks of 2048 triangles, so at most about 98,000 triangles over the tier's budget. */
const EDIT_LEAF_CAP = 48;

/** Whether a square (centre cx, cz, side size) lies within `reach` metres of the eye, measured to its nearest edge. */
const withinReach = (eyeX: number, eyeZ: number, cx: number, cz: number, size: number, reach: number): boolean => {
  const dx = Math.max(Math.abs(eyeX - cx) - size / 2, 0);
  const dz = Math.max(Math.abs(eyeZ - cz) - size / 2, 0);
  return dx * dx + dz * dz <= reach * reach;
};

interface TrackedBoulder {
  readonly id: number;
  readonly x: number;
  /** Where it sits: moved when the ground under it is cut or raised (TASK-21d). */
  y: number;
  readonly z: number;
  readonly size: number;
  readonly yaw: number;
  readonly shape: number;
  readonly instanceIndex: number;
  baseMatrix: THREE.Matrix4;
  /** The beam's ore a second on this boulder's ground (rock and scree). */
  readonly beamRate: number;
  ore: number;
}

export function createPlotGround(scene: THREE.Scene, o: { readonly seed: number; readonly sunDir: THREE.Vector3; readonly stage: number; readonly textureSize: number; readonly budget: number; readonly cover?: CoverTextures }): PlotGround {
  const terrain = createTerrain({ seed: o.seed });
  const textures = makeGroundTextures({ size: o.textureSize, seed: o.seed });
  const material = createGroundMaterial(textures, { stage: Math.max(1, o.stage), sunDir: o.sunDir, cover: o.cover });
  const group = new THREE.Group();
  scene.add(group);
  const chunks = new Map<string, THREE.Mesh>();
  let flat = o.stage <= 1, budget = o.budget, wanted: { key: string; cx: number; cz: number; size: number }[] = [], lastX = Infinity, lastZ = Infinity;
  /** The chunks a cut or raise has changed (keys), rebuilt a few a frame; the keep-out zones the sculpt beam leaves alone. */
  const dirtyKeys = new Set<string>();
  let keepOut: readonly KeepOutZone[] = [];
  /** The debug surface probe: a ray and its scratch vectors, so a read makes no garbage. */
  const surfaceRay = new THREE.Raycaster();
  const surfaceOrigin = new THREE.Vector3();
  const surfaceDown = new THREE.Vector3(0, -1, 0);

  const build = (cx: number, cz: number, size: number): THREE.Mesh => {
    const m = chunkMesh(terrain, cx, cz, size, CELLS, { flat, skirt: SKIRT, offset: editHeight });
    const pos = m.positions;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = pos[i + 1]! - drop(pos[i]!, pos[i + 2]!);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('matA', new THREE.BufferAttribute(m.matA, 3));
    g.setAttribute('matB', new THREE.BufferAttribute(m.matB, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    group.add(mesh);
    return mesh;
  };

  /** Which chunks the eye wants now; the old ones stay until their replacements are built, so no hole ever opens. */
  const plan = (eyeX: number, eyeZ: number): void => {
    // the ground a sculpt has cut is kept fine near the eye (EDIT_REACH), the nearest first, at most EDIT_LEAF_CAP chunks
    const refine = editFlagged.size > 0
      ? { minSize: EDIT_REFINE, maxLeaves: EDIT_LEAF_CAP, touches: (cx: number, cz: number, size: number): boolean => withinReach(eyeX, eyeZ, cx, cz, size, EDIT_REACH) && touchesEdit(cx, cz, size) }
      : undefined;
    wanted = chunksAround(eyeX, eyeZ, { extent: EXTENT, cells: CELLS, minSize: MIN_SIZE, budget, refine }).map((l) => ({ key: `${l.cx},${l.cz},${l.size}`, cx: l.cx, cz: l.cz, size: l.size }));
    lastX = eyeX; lastZ = eyeZ;
  };
  const step = (most: number): void => {
    let built = 0;
    for (const w of wanted) {
      if (chunks.has(w.key)) continue;
      if (built >= most) return;
      chunks.set(w.key, build(w.cx, w.cz, w.size));
      built++;
    }
    // everything wanted is there: drop what is no longer wanted
    const keys = new Set(wanted.map((w) => w.key));
    for (const [key, mesh] of chunks) if (!keys.has(key)) { group.remove(mesh); mesh.geometry.dispose(); chunks.delete(key); }
  };

  // the paint layer (TASK-21): a grid of 2.5 m cells over the boulder span, painted through @hm/terrainbrush by the beam and
  // shown by the ground shader from two textures (colour with a painted flag, and roughness), so a stroke rewrites texels only
  const PAINT_CELLS = 256, PAINT_CELL = BOULDER_SPAN / PAINT_CELLS, PAINT_ORIGIN = -BOULDER_SPAN / 2;
  /** Frames since a stroke changed the paint (the textures go up about ten times a second while the beam paints). */
  let paintDirtyFrames = -1;
  const PAINT_RULES: Rules = { maxDepth: 0, maxHeight: 0, orePerCubicMetre: 0, ratePerSecond: 0 };
  // The same field carries the sculpt edits (its height, `delta`) and the paint (TASK-21d): one save, one undo, one brush.
  let paintField: Field = emptyField(PAINT_CELLS, PAINT_CELL);
  /** Whether any cell has been cut or raised: until then the ground is the terrain as made, and no chunk pays for the edits. */
  let sculpted = false;
  /**
   * The flagged 8 m cells the sculpt has cut, keyed by cell (gx + gz * EDIT_CELLS_SIDE), and the box they fill (in cell indices): the
   * planner refines the chunks under them, near the eye only (see plan). A set keyed by cell, not a list of rectangles, so that a lookup
   * costs the cells it covers and a new cut costs its own cells.
   */
  const EDIT_CELLS_SIDE = Math.ceil(BOULDER_SPAN / EDIT_FLAG);
  const editFlagged = new Set<number>();
  const editBox = { gx0: Infinity, gx1: -Infinity, gz0: Infinity, gz1: -Infinity };
  /** Flags the cells under a box (planet metres). True when a cell was newly flagged, so the chunks must be planned again. */
  const flagEdit = (x0: number, z0: number, x1: number, z1: number): boolean => {
    let added = false;
    const gx0 = Math.max(0, Math.floor((x0 - PAINT_ORIGIN) / EDIT_FLAG));
    const gx1 = Math.min(EDIT_CELLS_SIDE - 1, Math.floor((x1 - PAINT_ORIGIN) / EDIT_FLAG));
    const gz0 = Math.max(0, Math.floor((z0 - PAINT_ORIGIN) / EDIT_FLAG));
    const gz1 = Math.min(EDIT_CELLS_SIDE - 1, Math.floor((z1 - PAINT_ORIGIN) / EDIT_FLAG));
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const key = gx + gz * EDIT_CELLS_SIDE;
        if (editFlagged.has(key)) continue;
        editFlagged.add(key);
        added = true;
        if (gx < editBox.gx0) editBox.gx0 = gx;
        if (gx > editBox.gx1) editBox.gx1 = gx;
        if (gz < editBox.gz0) editBox.gz0 = gz;
        if (gz > editBox.gz1) editBox.gz1 = gz;
      }
    }
    return added;
  };
  /**
   * Whether a planner square (centre cx, cz, side size) touches a flagged cut cell. It looks up the cells the square covers in the set,
   * or, when the square covers more cells than are flagged, scans the flags: its cost is the smaller of the two, never every cut for
   * every leaf.
   */
  const touchesEdit = (cx: number, cz: number, size: number): boolean => {
    if (editFlagged.size === 0) return false;
    const h = size / 2;
    const gx0 = Math.max(editBox.gx0, Math.floor((cx - h - PAINT_ORIGIN) / EDIT_FLAG));
    const gx1 = Math.min(editBox.gx1, Math.floor((cx + h - PAINT_ORIGIN) / EDIT_FLAG));
    const gz0 = Math.max(editBox.gz0, Math.floor((cz - h - PAINT_ORIGIN) / EDIT_FLAG));
    const gz1 = Math.min(editBox.gz1, Math.floor((cz + h - PAINT_ORIGIN) / EDIT_FLAG));
    if (gx0 > gx1 || gz0 > gz1) return false;
    const covered = (gx1 - gx0 + 1) * (gz1 - gz0 + 1);
    if (covered <= editFlagged.size) {
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) if (editFlagged.has(gx + gz * EDIT_CELLS_SIDE)) return true;
      }
      return false;
    }
    for (const key of editFlagged) {
      const gx = key % EDIT_CELLS_SIDE;
      const gz = Math.floor(key / EDIT_CELLS_SIDE);
      if (gx >= gx0 && gx <= gx1 && gz >= gz0 && gz <= gz1) return true;
    }
    return false;
  };
  /** The planet's x and z of cell i's centre. */
  const cellX = (i: number): number => ((i % PAINT_CELLS) + 0.5) * PAINT_CELL + PAINT_ORIGIN;
  const cellZ = (i: number): number => (Math.floor(i / PAINT_CELLS) + 0.5) * PAINT_CELL + PAINT_ORIGIN;
  /** The height edit under (x, z) (planet metres): bilinear from the field, zero until the ground is sculpted. */
  const editHeight = (x: number, z: number): number => (sculpted ? brushHeightAt(paintField, () => 0, x - PAINT_ORIGIN, z - PAINT_ORIGIN) : 0);
  const paintColourBytes = new Uint8Array(PAINT_CELLS * PAINT_CELLS * 4);
  const paintRoughBytes = new Uint8Array(PAINT_CELLS * PAINT_CELLS * 4);
  const paintColour = new THREE.DataTexture(paintColourBytes, PAINT_CELLS, PAINT_CELLS, THREE.RGBAFormat);
  const paintRough = new THREE.DataTexture(paintRoughBytes, PAINT_CELLS, PAINT_CELLS, THREE.RGBAFormat);
  for (const t of [paintColour, paintRough]) {
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  }
  setGroundPaint(material, { colour: paintColour, rough: paintRough, x0: PAINT_ORIGIN, z0: PAINT_ORIGIN, span: BOULDER_SPAN });
  const writeTexel = (i: number): void => {
    const o = i * 4;
    const look = (paintField.paint[i] ?? '') !== '' ? presetLook(paintField.paint[i]!) : null;
    if (!look) {
      paintColourBytes.fill(0, o, o + 4);
      paintRoughBytes.fill(0, o, o + 4);
      return;
    }
    const v = parseInt(look.colour.slice(1), 16);
    paintColourBytes[o] = (v >> 16) & 255; paintColourBytes[o + 1] = (v >> 8) & 255; paintColourBytes[o + 2] = v & 255; paintColourBytes[o + 3] = 255;
    const rough = Math.round(Math.max(0, Math.min(1, look.roughness)) * 255);
    paintRoughBytes[o] = rough; paintRoughBytes[o + 1] = rough; paintRoughBytes[o + 2] = rough; paintRoughBytes[o + 3] = 255;
  };

  // boulders from the terrain, near the gate, in the smooth boulder shapes, wearing the ground's rock colour
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7d756b', roughness: 0.92, metalness: 0, flatShading: flat });
  const boulders = terrain.boulders(-BOULDER_SPAN / 2, -BOULDER_SPAN / 2, BOULDER_SPAN);
  const byShape: THREE.Matrix4[][] = [[], [], []];
  const trackedBoulders: TrackedBoulder[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  boulders.forEach((b, i) => {
    const y = terrain.height(b.x, b.z) - drop(b.x, b.z) - b.size * 0.2;
    const shape = i % 3;
    const mats = terrain.materials(b.x, b.z);
    const instanceIndex = byShape[shape]!.length;
    const baseMat = m4.compose(p.set(b.x, y, b.z), q.setFromEuler(e.set(0, b.yaw, 0)), s.set(b.size, b.size, b.size)).clone();
    byShape[shape]!.push(baseMat);
    trackedBoulders.push({
      id: i,
      x: b.x,
      y,
      z: b.z,
      size: b.size,
      yaw: b.yaw,
      shape,
      instanceIndex,
      baseMatrix: baseMat,
      beamRate: boulderBeamRate(mats[0], mats[1]),
      ore: BOULDER_INITIAL_ORE,
    });
  });
  const rocks: THREE.InstancedMesh[] = byShape.map((list, shape) => {
    const model = smoothModel(`boulder${shape}` as SmoothId);
    const im = new THREE.InstancedMesh(model.near, rockMat, Math.max(1, list.length));
    list.forEach((mm, k) => im.setMatrixAt(k, mm));
    im.count = list.length;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  });

  /** Takes up to `amount` ore from boulder `id`; the boulder shrinks as it empties and crumbles to nothing. */
  const takeOre = (id: number, amount: number): number => {
    const b = trackedBoulders[id];
    if (!b || b.ore <= 0 || amount <= 0) return 0;
    const mined = Math.min(b.ore, amount);
    b.ore -= mined;
    const im = rocks[b.shape];
    if (im) {
      if (b.ore <= 0) {
        b.ore = 0;
        m4.copy(b.baseMatrix).scale(s.set(0, 0, 0));
      } else {
        const factor = Math.cbrt(b.ore / BOULDER_INITIAL_ORE);
        m4.copy(b.baseMatrix).scale(s.set(factor, factor, factor));
      }
      im.setMatrixAt(b.instanceIndex, m4);
      im.instanceMatrix.needsUpdate = true;
    }
    return mined;
  };

  /** Writes boulder `b`'s instance: its base matrix, shrunk by the ore it still holds (nothing when it is empty). */
  const writeBoulder = (b: TrackedBoulder): void => {
    const im = rocks[b.shape];
    if (!im) return;
    if (b.ore <= 0) {
      m4.copy(b.baseMatrix).scale(s.set(0, 0, 0));
    } else {
      const factor = Math.cbrt(b.ore / BOULDER_INITIAL_ORE);
      m4.copy(b.baseMatrix).scale(s.set(factor, factor, factor));
    }
    im.setMatrixAt(b.instanceIndex, m4);
    im.instanceMatrix.needsUpdate = true;
  };
  /** Seats boulder `b` on the ground under it, cut or raised as it is (TASK-21d): it never hangs over a cut or sinks into a raise. */
  const seatBoulder = (b: TrackedBoulder): void => {
    const y = terrain.height(b.x, b.z) - drop(b.x, b.z) - b.size * 0.2 + editHeight(b.x, b.z);
    if (Math.abs(y - b.y) < 1e-4) return;
    b.y = y;
    b.baseMatrix = m4.compose(p.set(b.x, y, b.z), q.setFromEuler(e.set(0, b.yaw, 0)), s.set(b.size, b.size, b.size)).clone();
    writeBoulder(b);
  };
  /** Marks the chunks that touch a box (planet metres, two cells of margin) for a rebuild. */
  const markDirty = (x0: number, z0: number, x1: number, z1: number): void => {
    const margin = 2 * PAINT_CELL;
    for (const key of chunks.keys()) {
      const [cx = 0, cz = 0, size = 0] = key.split(',').map(Number);
      const h = size / 2;
      if (cx + h < x0 - margin || cx - h > x1 + margin || cz + h < z0 - margin || cz - h > z1 + margin) continue;
      dirtyKeys.add(key);
    }
  };
  /** Rebuilds up to `most` dirty chunks (each one from the current edits), so a long cut spreads over frames. */
  const rebuildDirty = (most: number): void => {
    let n = 0;
    for (const key of [...dirtyKeys]) {
      if (n >= most) return;
      dirtyKeys.delete(key);
      const old = chunks.get(key);
      if (!old) continue;
      const [cx = 0, cz = 0, size = 0] = key.split(',').map(Number);
      group.remove(old);
      old.geometry.dispose();
      chunks.set(key, build(cx, cz, size));
      n += 1;
    }
  };

  return {
    terrain,
    heightAt: (x, z) => terrain.height(x, z) - drop(x, z) + editHeight(x, z),
    update(eyeX, eyeZ, all = false) {
      if (Math.hypot(eyeX - lastX, eyeZ - lastZ) > MIN_SIZE / 2) plan(eyeX, eyeZ);
      step(all ? Infinity : 1);
      rebuildDirty(all ? Infinity : 2);
      // a paint stroke's texels go up once it has settled for six frames (about ten uploads a second while the beam paints)
      if (paintDirtyFrames >= 0 && ++paintDirtyFrames >= 6) {
        paintColour.needsUpdate = true; paintRough.needsUpdate = true;
        paintDirtyFrames = -1;
      }
    },
    setStage(stage) {
      setGroundStage(material, Math.max(1, stage));
      const nextFlat = stage <= 1;
      if (nextFlat !== flat) {
        // faceted below stage 2, smooth from it: every chunk is rebuilt, one a frame, the old ones standing in meanwhile
        flat = nextFlat;
        rockMat.flatShading = flat; rockMat.needsUpdate = true;
        const old = [...chunks.values()];
        chunks.clear();
        for (const mesh of old) { group.remove(mesh); mesh.geometry.dispose(); }
        step(Infinity);
      }
    },
    setBudget(next) {
      if (next === budget) return;
      budget = next;
      if (Number.isFinite(lastX)) plan(lastX, lastZ);
    },
    setVisible(on) { group.visible = on; },
    triangles() { let n = 0; for (const [, mesh] of chunks) n += (mesh.geometry.index?.count ?? 0) / 3; return n; },
    gather: takeOre,
    beamGather(id, dt) {
      const b = trackedBoulders[id];
      if (!b || b.ore <= 0 || !(dt > 0)) return null;
      const mined = takeOre(id, b.beamRate * dt);
      return { mined, x: b.x, y: b.y + b.size * 0.4, z: b.z };
    },
    findAimedBoulder(origin, dir, maxDist = 5.0) {
      let bestT = maxDist;
      let bestId: number | null = null;
      for (const b of trackedBoulders) {
        if (b.ore <= 0) continue;
        const cx = b.x - origin.x;
        const cy = (b.y + b.size * 0.4) - origin.y;
        const cz = b.z - origin.z;
        const t = cx * dir.x + cy * dir.y + cz * dir.z;
        if (t <= 0 || t >= bestT) continue;
        const px = cx - dir.x * t;
        const py = cy - dir.y * t;
        const pz = cz - dir.z * t;
        const distSq = px * px + py * py + pz * pz;
        const hitRadius = b.size * 0.8 + 0.6;
        if (distSq < hitRadius * hitRadius) {
          bestT = t;
          bestId = b.id;
        }
      }
      return bestId;
    },
    findNearestBoulder(origin) {
      let bestDistSq = Infinity;
      let bestId: number | null = null;
      for (const b of trackedBoulders) {
        if (b.ore <= 0) continue;
        const dx = b.x - origin.x;
        const dy = b.y - origin.y;
        const dz = b.z - origin.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestId = b.id;
        }
      }
      return bestId;
    },
    regrow(dt) {
      if (dt <= 0) return;
      let dirty = false;
      const changed = [false, false, false];
      for (const b of trackedBoulders) {
        if (b.ore >= BOULDER_INITIAL_ORE) continue;
        const mats = terrain.materials(b.x, b.z);
        const richness = mats[0] + mats[1]; // rock + scree
        const rate = (BOULDER_INITIAL_ORE / 180) * Math.max(0.12, richness);
        const prevOre = b.ore;
        b.ore = Math.min(BOULDER_INITIAL_ORE, b.ore + rate * dt);
        if (Math.abs(b.ore - prevOre) > 0.01) {
          const factor = Math.cbrt(b.ore / BOULDER_INITIAL_ORE);
          m4.copy(b.baseMatrix).scale(s.set(factor, factor, factor));
          rocks[b.shape]?.setMatrixAt(b.instanceIndex, m4);
          changed[b.shape] = true;
          dirty = true;
        }
      }
      if (dirty) {
        changed.forEach((c, idx) => {
          if (c && rocks[idx]) rocks[idx]!.instanceMatrix.needsUpdate = true;
        });
      }
    },
    paint(x, z, preset, dt) {
      const op: BrushOp = { kind: 'paint', x: x - PAINT_ORIGIN, z: z - PAINT_ORIGIN, radius: STROKE_RADIUS, strength: 1, dt, preset };
      const r = brushApply(paintField, () => 0, op, PAINT_RULES, 0);
      paintField = r.field;
      for (const i of r.changed) writeTexel(i);
      if (r.changed.length > 0) paintDirtyFrames = Math.max(0, paintDirtyFrames);
      return r.changed.length;
    },
    paintedCells() {
      let n = 0;
      for (const p of paintField.paint) if (p) n += 1;
      return n;
    },
    stroke(op, ore) {
      // the op is in the planet's metres; the field is in its own, from PAINT_ORIGIN
      const local: BrushOp = { ...op, x: op.x - PAINT_ORIGIN, z: op.z - PAINT_ORIGIN };
      const r = runStroke(paintField, (x, z) => terrain.height(x + PAINT_ORIGIN, z + PAINT_ORIGIN), local, SCULPT_RULES, ore, (i) => keptOut(keepOut, cellX(i), cellZ(i)));
      if (r.changed.length === 0) return { balance: r.balance, cells: 0, gained: 0 };
      paintField = r.field;
      sculpted = true;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const i of r.changed) {
        const x = cellX(i), z = cellZ(i);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (z < z0) z0 = z;
        if (z > z1) z1 = z;
      }
      const half = PAINT_CELL / 2;
      markDirty(x0 - half, z0 - half, x1 + half, z1 + half);
      // the chunks under a new cut are planned again, so the refined leaves replace the coarse ones (the old stand until then)
      if (flagEdit(x0 - half, z0 - half, x1 + half, z1 + half) && Number.isFinite(lastX)) plan(lastX, lastZ);
      for (const b of trackedBoulders) {
        if (b.x >= x0 - 3 && b.x <= x1 + 3 && b.z >= z0 - 3 && b.z <= z1 + 3) seatBoulder(b);
      }
      return { balance: r.balance, cells: r.changed.length, gained: r.ore };
    },
    setKeepOut(zones) {
      keepOut = zones;
    },
    exportField() {
      return encodeField(paintField);
    },
    importField(text) {
      const next = decodeField(text);
      if (next === null || next.size !== PAINT_CELLS || Math.abs(next.cell - PAINT_CELL) > 1e-6) return false;
      paintField = next;
      sculpted = next.delta.some((d) => d !== 0);
      // the cut cells of a saved field are flagged, so the first plan keeps their chunks fine
      let flaggedAny = false;
      for (let i = 0; i < next.delta.length; i++) {
        if (next.delta[i] === 0) continue;
        const x = cellX(i), z = cellZ(i);
        if (flagEdit(x - PAINT_CELL / 2, z - PAINT_CELL / 2, x + PAINT_CELL / 2, z + PAINT_CELL / 2)) flaggedAny = true;
      }
      if (flaggedAny && Number.isFinite(lastX)) plan(lastX, lastZ);
      for (let i = 0; i < PAINT_CELLS * PAINT_CELLS; i++) writeTexel(i);
      paintColour.needsUpdate = true;
      paintRough.needsUpdate = true;
      for (const b of trackedBoulders) seatBoulder(b);
      for (const key of chunks.keys()) dirtyKeys.add(key);
      return true;
    },
    editAt: (x, z) => editHeight(x, z),
    settled() {
      // the chunks drawn are exactly the ones wanted, all built, and none is waiting for a rebuild (no stale chunk stands over a cut)
      const want = new Set(wanted.map((w) => w.key));
      if (dirtyKeys.size > 0 || chunks.size !== want.size) return false;
      for (const key of want) if (!chunks.has(key)) return false;
      return true;
    },
    surfaceAt(x, z) {
      // the rendered ground under (x, z): a ray down through the chunk meshes, the same triangles the eye sees (null off the plot)
      surfaceRay.set(surfaceOrigin.set(x, 800, z), surfaceDown);
      const hit = surfaceRay.intersectObjects([...chunks.values()], false)[0];
      return hit ? hit.point.y : null;
    },
    sculptedCells() {
      let n = 0;
      for (const d of paintField.delta) if (d !== 0) n += 1;
      return n;
    },
    material,
    setCoverage(cov) {
      setCoverage(material, cov);
    },
    getBoulders() {
      return trackedBoulders.map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, size: b.size, ore: b.ore }));
    },
    dispose() {
      for (const [, mesh] of chunks) mesh.geometry.dispose();
      chunks.clear();
      for (const r of rocks) r.dispose();
      scene.remove(group);
      material.dispose(); rockMat.dispose();
      paintColour.dispose(); paintRough.dispose();
      textures.albedoHeight.dispose();
      textures.normalRough.dispose();
    },
  };
}
