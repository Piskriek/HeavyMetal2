// Your plot's ground in the first Play (SETMIX_PLAN Phases 3 and 4): the 1 km plot of @hm/plotterrain, drawn in chunks with
// detail by distance out to the horizon, in the six natural materials of @hm/groundshader at the plot's stage, with the
// terrain's boulders. Stage 1 and below are faceted (flat shaded, low poly); from stage 2 the same ground is smooth. The
// planet curves away: every height drops by drop(x, z).
import * as THREE from 'three';
import { chunkMesh, chunksAround, createTerrain, type Terrain } from '@hm/plotterrain';
import { createGroundMaterial, makeGroundTextures, setStage as setGroundStage } from '@hm/groundshader';
import { drop } from '../crafter/planet';
import { smoothModel, type SmoothId } from '../crafter/smooth-models';

export interface PlotGround {
  readonly terrain: Terrain;
  /** The ground's height at x, z, the planet's curve included. */
  heightAt(x: number, z: number): number;
  /** Keeps the chunks round the eye: builds every one now (behind the loading bar) or one per call (while you walk). */
  update(eyeX: number, eyeZ: number, all?: boolean): void;
  setStage(stage: number): void;
  /** Triangles in the chunks now drawn. */
  triangles(): number;
  /** Shows or hides the ground (the tests measure what it costs). */
  setVisible(on: boolean): void;
  dispose(): void;
}

/** Chunk cells and the finest chunk; the horizon is about 4 km away on a 12 km planet. */
const CELLS = 32, MIN_SIZE = 16, SKIRT = 2, EXTENT = 4096;
/** Boulders stand within this square round the gate. */
const BOULDER_SPAN = 320;

export function createPlotGround(scene: THREE.Scene, o: { readonly seed: number; readonly sunDir: THREE.Vector3; readonly stage: number; readonly textureSize: number; readonly budget: number }): PlotGround {
  const terrain = createTerrain({ seed: o.seed });
  const textures = makeGroundTextures({ size: o.textureSize, seed: o.seed });
  const material = createGroundMaterial(textures, { stage: Math.max(1, o.stage), sunDir: o.sunDir });
  const group = new THREE.Group();
  scene.add(group);
  const chunks = new Map<string, THREE.Mesh>();
  let flat = o.stage <= 1, wanted: { key: string; cx: number; cz: number; size: number }[] = [], lastX = Infinity, lastZ = Infinity;

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
    wanted = chunksAround(eyeX, eyeZ, { extent: EXTENT, cells: CELLS, minSize: MIN_SIZE, budget: o.budget }).map((l) => ({ key: `${l.cx},${l.cz},${l.size}`, cx: l.cx, cz: l.cz, size: l.size }));
    lastX = eyeX; lastZ = eyeZ;
  };
  const step = (budget: number): void => {
    let built = 0;
    for (const w of wanted) {
      if (chunks.has(w.key)) continue;
      if (built >= budget) return;
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
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  boulders.forEach((b, i) => {
    const y = terrain.height(b.x, b.z) - drop(b.x, b.z) - b.size * 0.2;
    byShape[i % 3]!.push(m4.compose(p.set(b.x, y, b.z), q.setFromEuler(e.set(0, b.yaw, 0)), s.set(b.size, b.size, b.size)).clone());
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
    setVisible(on) { group.visible = on; },
    triangles() { let n = 0; for (const [, mesh] of chunks) n += (mesh.geometry.index?.count ?? 0) / 3; return n; },
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
