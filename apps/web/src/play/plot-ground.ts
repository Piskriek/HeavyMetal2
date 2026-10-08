// Your plot's ground in the first Play (SETMIX_PLAN Phases 3 and 4): the 1 km plot of @hm/plotterrain, drawn in chunks with
// detail by distance out to the horizon, in the six natural materials of @hm/groundshader at the plot's stage, with the
// terrain's boulders. Stage 1 and below are faceted (flat shaded, low poly); from stage 2 the same ground is smooth. The
// planet curves away: every height drops by drop(x, z).
import * as THREE from 'three';
import { chunkMesh, chunksAround, createTerrain, type Terrain } from '@hm/plotterrain';
import { createGroundMaterial, makeGroundTextures, setStage as setGroundStage } from '@hm/groundshader';
import { drop } from '../crafter/planet';
import { smoothModel, type SmoothId } from '../crafter/smooth-models';

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
  /** Finds the boulder with ore aimed at by the ray from `origin` in `dir` within `maxDist`. */
  findAimedBoulder(origin: THREE.Vector3, dir: THREE.Vector3, maxDist?: number): number | null;
  /** Finds the nearest boulder with ore to `origin`. */
  findNearestBoulder(origin: THREE.Vector3): number | null;
  /** Advances boulder regrowth slowly over a few minutes near rock and scree. */
  regrow(dt: number): void;
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

interface TrackedBoulder {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly shape: number;
  readonly instanceIndex: number;
  readonly baseMatrix: THREE.Matrix4;
  ore: number;
}

export function createPlotGround(scene: THREE.Scene, o: { readonly seed: number; readonly sunDir: THREE.Vector3; readonly stage: number; readonly textureSize: number; readonly budget: number }): PlotGround {
  const terrain = createTerrain({ seed: o.seed });
  const textures = makeGroundTextures({ size: o.textureSize, seed: o.seed });
  const material = createGroundMaterial(textures, { stage: Math.max(1, o.stage), sunDir: o.sunDir });
  const group = new THREE.Group();
  scene.add(group);
  const chunks = new Map<string, THREE.Mesh>();
  let flat = o.stage <= 1, budget = o.budget, wanted: { key: string; cx: number; cz: number; size: number }[] = [], lastX = Infinity, lastZ = Infinity;

  const build = (cx: number, cz: number, size: number): THREE.Mesh => {
    const m = chunkMesh(terrain, cx, cz, size, CELLS, { flat, skirt: SKIRT });
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
    wanted = chunksAround(eyeX, eyeZ, { extent: EXTENT, cells: CELLS, minSize: MIN_SIZE, budget }).map((l) => ({ key: `${l.cx},${l.cz},${l.size}`, cx: l.cx, cz: l.cz, size: l.size }));
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

  // boulders from the terrain, near the gate, in the smooth boulder shapes, wearing the ground's rock colour
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7d756b', roughness: 0.92, metalness: 0, flatShading: flat });
  const boulders = terrain.boulders(-BOULDER_SPAN / 2, -BOULDER_SPAN / 2, BOULDER_SPAN);
  const byShape: THREE.Matrix4[][] = [[], [], []];
  const trackedBoulders: TrackedBoulder[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  boulders.forEach((b, i) => {
    const y = terrain.height(b.x, b.z) - drop(b.x, b.z) - b.size * 0.2;
    const shape = i % 3;
    const instanceIndex = byShape[shape]!.length;
    const baseMat = m4.compose(p.set(b.x, y, b.z), q.setFromEuler(e.set(0, b.yaw, 0)), s.set(b.size, b.size, b.size)).clone();
    byShape[shape]!.push(baseMat);
    trackedBoulders.push({
      id: i,
      x: b.x,
      y,
      z: b.z,
      size: b.size,
      shape,
      instanceIndex,
      baseMatrix: baseMat,
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

  return {
    terrain,
    heightAt: (x, z) => terrain.height(x, z) - drop(x, z),
    update(eyeX, eyeZ, all = false) {
      if (Math.hypot(eyeX - lastX, eyeZ - lastZ) > MIN_SIZE / 2) plan(eyeX, eyeZ);
      step(all ? Infinity : 1);
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
    gather(id, amount) {
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
    getBoulders() {
      return trackedBoulders.map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, size: b.size, ore: b.ore }));
    },
    dispose() {
      for (const [, mesh] of chunks) mesh.geometry.dispose();
      chunks.clear();
      for (const r of rocks) r.dispose();
      scene.remove(group);
      material.dispose(); rockMat.dispose();
      textures.albedoHeight.dispose();
      textures.normalRough.dispose();
    },
  };
}
