// apps/web/src/play/plot-biome-view.ts
// Plotbiome scatter view (TICKET-02 item F): trees, bushes, and tufts on the moon plot.
// Monotone instance counts baked once at stage 6 behind loading screen; stage change updates InstancedMesh.count.

import * as THREE from 'three';
import { bakePlotBiome, type BiomeInput, type ScatterKind, type Tier } from '@hm/plotbiome';
import { growTree, type Tree } from '@hm/treegen';
import { renderGrass, defaults as grassDefaults } from '@hm/pbrgrass';

export interface PlotBiomeViewOptions {
  heightAt(x: number, z: number): number;
  tier: 'low' | 'mid' | 'high' | 'off';
  origin?: { x: number; z: number };
}

export interface BiomeInstanceCount {
  total: number;
  trees: number;
  byKind: Record<ScatterKind, number>;
}

export interface PlotBiomeView {
  build(input: BiomeInput, immediate?: boolean): void;
  setStage(stage: number): void;
  setTier(tier: 'low' | 'mid' | 'high' | 'off'): void;
  counts(): BiomeInstanceCount;
  triangles(): number;
  drawCalls(): number;
  dispose(): void;
}

interface ScatterItem {
  kind: ScatterKind;
  worldX: number;
  worldZ: number;
  scale: number;
  yaw: number;
  appear: number;
}

interface MeshSlot {
  id: string;
  kind: ScatterKind;
  isFar: boolean;
  mesh: THREE.InstancedMesh;
  appears: number[];
  trianglesPerInstance: number;
}

function mergeTreeGeometry(
  tree: Tree,
  barkColor: readonly [number, number, number],
  leafColor: readonly [number, number, number],
): { geometry: THREE.BufferGeometry; triangles: number } {
  const g = new THREE.BufferGeometry();
  const barkPos = tree.bark.getAttribute('position') as THREE.BufferAttribute;
  const barkNor = tree.bark.getAttribute('normal') as THREE.BufferAttribute;
  const barkUv = tree.bark.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const leafPos = tree.leaves.getAttribute('position') as THREE.BufferAttribute;
  const leafNor = tree.leaves.getAttribute('normal') as THREE.BufferAttribute;
  const leafUv = tree.leaves.getAttribute('uv') as THREE.BufferAttribute | undefined;

  const totalVerts = barkPos.count + leafPos.count;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);

  // Copy bark vertices
  for (let i = 0; i < barkPos.count; i++) {
    const i3 = i * 3;
    const i2 = i * 2;
    positions[i3] = barkPos.getX(i);
    positions[i3 + 1] = barkPos.getY(i);
    positions[i3 + 2] = barkPos.getZ(i);
    normals[i3] = barkNor.getX(i);
    normals[i3 + 1] = barkNor.getY(i);
    normals[i3 + 2] = barkNor.getZ(i);
    if (barkUv) {
      uvs[i2] = barkUv.getX(i);
      uvs[i2 + 1] = barkUv.getY(i);
    }
    colors[i3] = barkColor[0];
    colors[i3 + 1] = barkColor[1];
    colors[i3 + 2] = barkColor[2];
  }

  // Copy leaves vertices
  const offset = barkPos.count;
  for (let i = 0; i < leafPos.count; i++) {
    const o3 = (offset + i) * 3;
    const o2 = (offset + i) * 2;
    positions[o3] = leafPos.getX(i);
    positions[o3 + 1] = leafPos.getY(i);
    positions[o3 + 2] = leafPos.getZ(i);
    normals[o3] = leafNor.getX(i);
    normals[o3 + 1] = leafNor.getY(i);
    normals[o3 + 2] = leafNor.getZ(i);
    if (leafUv) {
      uvs[o2] = leafUv.getX(i);
      uvs[o2 + 1] = leafUv.getY(i);
    }
    colors[o3] = leafColor[0];
    colors[o3 + 1] = leafColor[1];
    colors[o3 + 2] = leafColor[2];
  }

  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return { geometry: g, triangles: totalVerts / 3 };
}

function createTuftGeometry(): { geometry: THREE.BufferGeometry; triangles: number } {
  const g = new THREE.BufferGeometry();
  const w = 0.28;
  const h = 0.42;
  const positions = new Float32Array([
    // Quad 1: along X
    -w, 0, 0,   w, 0, 0,   w, h, 0,
    -w, 0, 0,   w, h, 0,  -w, h, 0,
    // Quad 2: along Z
    0, 0, -w,   0, 0, w,   0, h, w,
    0, 0, -w,   0, h, w,   0, h, -w,
  ]);
  const normals = new Float32Array([
    0, 0.7, 0.7,  0, 0.7, 0.7,  0, 0.7, 0.7,
    0, 0.7, 0.7,  0, 0.7, 0.7,  0, 0.7, 0.7,
    0.7, 0.7, 0,  0.7, 0.7, 0,  0.7, 0.7, 0,
    0.7, 0.7, 0,  0.7, 0.7, 0,  0.7, 0.7, 0,
  ]);
  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingSphere();
  return { geometry: g, triangles: 4 };
}

function createTuftTexture(): THREE.DataTexture {
  const size = 64;
  const maps = renderGrass(grassDefaults(), size, 42);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const idx = (y * size + x) * 4;
      const r = maps.albedo[idx] ?? 0;
      const g = maps.albedo[idx + 1] ?? 0;
      const b = maps.albedo[idx + 2] ?? 0;

      // 3 spreading grass blades
      const b1 = Math.abs(u - (0.5 - 0.28 * v));
      const b2 = Math.abs(u - 0.5);
      const b3 = Math.abs(u - (0.5 + 0.28 * v));
      const hw = 0.07 * (1 - 0.65 * v);
      const isBlade = b1 < hw || b2 < hw || b3 < hw;

      if (isBlade && v < 0.96) {
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function createPlotBiomeView(
  scene: THREE.Scene,
  o: PlotBiomeViewOptions,
): PlotBiomeView {
  let currentTier: 'low' | 'mid' | 'high' | 'off' = o.tier;
  let currentStage = 0;
  let lastInput: BiomeInput | null = null;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'plot-biome-root';
  scene.add(rootGroup);

  // 1. Shared tree & plant materials
  const plantMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  const tuftTexture = createTuftTexture();
  const tuftMaterial = new THREE.MeshLambertMaterial({
    map: tuftTexture,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });

  // 2. Pre-grow models once at load
  const pineNear = mergeTreeGeometry(
    growTree({ species: 'pine', seed: 101, height: 10.0, detail: 1 }),
    [0.26, 0.18, 0.14],
    [0.12, 0.28, 0.14],
  );
  const pineFar = mergeTreeGeometry(
    growTree({ species: 'pine', seed: 101, height: 10.0, detail: 0 }),
    [0.26, 0.18, 0.14],
    [0.12, 0.28, 0.14],
  );

  const oakNear = mergeTreeGeometry(
    growTree({ species: 'oak', seed: 202, height: 8.5, detail: 1 }),
    [0.34, 0.26, 0.18],
    [0.25, 0.52, 0.20],
  );
  const oakFar = mergeTreeGeometry(
    growTree({ species: 'oak', seed: 202, height: 8.5, detail: 0 }),
    [0.34, 0.26, 0.18],
    [0.25, 0.52, 0.20],
  );

  const birchNear = mergeTreeGeometry(
    growTree({ species: 'birch', seed: 303, height: 7.5, detail: 1 }),
    [0.85, 0.82, 0.75],
    [0.42, 0.65, 0.22],
  );
  const birchFar = mergeTreeGeometry(
    growTree({ species: 'birch', seed: 303, height: 7.5, detail: 0 }),
    [0.85, 0.82, 0.75],
    [0.42, 0.65, 0.22],
  );

  const bushModel = mergeTreeGeometry(
    growTree({ species: 'oak', seed: 505, height: 2.2, detail: 0 }),
    [0.30, 0.22, 0.16],
    [0.28, 0.55, 0.22],
  );

  const tuftModel = createTuftGeometry();

  // 3. Setup InstancedMeshes
  const maxCapacity = 6000;
  const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geo, mat, maxCapacity);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    rootGroup.add(mesh);
    return mesh;
  };

  const slots: MeshSlot[] = [
    { id: 'tuft', kind: 'tuft', isFar: false, mesh: makeMesh(tuftModel.geometry, tuftMaterial), appears: [], trianglesPerInstance: tuftModel.triangles },
    { id: 'bush', kind: 'bush', isFar: false, mesh: makeMesh(bushModel.geometry, plantMaterial), appears: [], trianglesPerInstance: bushModel.triangles },
    { id: 'pine_near', kind: 'pine', isFar: false, mesh: makeMesh(pineNear.geometry, plantMaterial), appears: [], trianglesPerInstance: pineNear.triangles },
    { id: 'pine_far', kind: 'pine', isFar: true, mesh: makeMesh(pineFar.geometry, plantMaterial), appears: [], trianglesPerInstance: pineFar.triangles },
    { id: 'oak_near', kind: 'oak', isFar: false, mesh: makeMesh(oakNear.geometry, plantMaterial), appears: [], trianglesPerInstance: oakNear.triangles },
    { id: 'oak_far', kind: 'oak', isFar: true, mesh: makeMesh(oakFar.geometry, plantMaterial), appears: [], trianglesPerInstance: oakFar.triangles },
    { id: 'birch_near', kind: 'birch', isFar: false, mesh: makeMesh(birchNear.geometry, plantMaterial), appears: [], trianglesPerInstance: birchNear.triangles },
    { id: 'birch_far', kind: 'birch', isFar: true, mesh: makeMesh(birchFar.geometry, plantMaterial), appears: [], trianglesPerInstance: birchFar.triangles },
  ];

  const slotById = new Map<string, MeshSlot>(slots.map((s) => [s.id, s]));

  const applyStage = (stage: number): void => {
    currentStage = stage;
    if (currentTier === 'off' || stage < 2) {
      for (const slot of slots) {
        slot.mesh.count = 0;
        slot.mesh.visible = false;
      }
      return;
    }

    const threshold = Math.min(6, stage + 0.5);
    for (const slot of slots) {
      // Find count where appear <= threshold
      let c = 0;
      while (c < slot.appears.length && (slot.appears[c] ?? 999) <= threshold) {
        c++;
      }
      slot.mesh.count = c;
      slot.mesh.visible = c > 0;
    }
  };

  const dummy = new THREE.Object3D();

  const build = (input: BiomeInput, immediate = true): void => {
    lastInput = input;
    const bakeTier: Tier = currentTier === 'off' ? 'low' : currentTier;

    // Always bake at stage 6 to discover all monotone instances once
    const bakeInput: BiomeInput = {
      ...input,
      stage: 6,
      tier: bakeTier,
    };
    const { scatter } = bakePlotBiome(bakeInput);

    // Group scatter instances
    const groups = new Map<string, ScatterItem[]>();
    for (const slot of slots) groups.set(slot.id, []);

    const originX = o.origin?.x ?? -(input.n * input.cellM) / 2;
    const originZ = o.origin?.z ?? -(input.n * input.cellM) / 2;

    for (const s of scatter) {
      const worldX = originX + s.x;
      const worldZ = originZ + s.z;
      const dist = Math.hypot(worldX, worldZ);

      if (s.kind === 'tuft') {
        // Tufts on Low within 20 m; Mid/High within 30 m
        const maxDist = bakeTier === 'low' ? 20 : 30;
        if (dist > maxDist) continue;
        groups.get('tuft')!.push({ ...s, worldX, worldZ });
      } else if (s.kind === 'bush') {
        groups.get('bush')!.push({ ...s, worldX, worldZ });
      } else if (s.kind === 'pine' || s.kind === 'oak' || s.kind === 'birch') {
        // Near under 60 m, far beyond 60 m
        const targetId = dist < 60 ? `${s.kind}_near` : `${s.kind}_far`;
        groups.get(targetId)?.push({ ...s, worldX, worldZ });
      }
    }

    // Populate each InstancedMesh sorted by appear ascending
    let slotIdx = 0;

    const populateSlot = (slot: MeshSlot): void => {
      const list = groups.get(slot.id) ?? [];
      list.sort((a, b) => a.appear - b.appear);

      slot.appears = list.map((item) => item.appear);
      const n = Math.min(list.length, maxCapacity);

      for (let i = 0; i < n; i++) {
        const item = list[i]!;
        const worldY = o.heightAt(item.worldX, item.worldZ) - 0.05; // sunk 0.05 m so nothing floats
        dummy.position.set(item.worldX, worldY, item.worldZ);
        dummy.rotation.set(0, item.yaw, 0);

        // Bush: oak grown at BUDGET[0] at scale 0.3 to 0.5
        const sc = item.kind === 'bush' ? item.scale * 0.4 : item.scale;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        slot.mesh.setMatrixAt(i, dummy.matrix);
      }
      slot.mesh.instanceMatrix.needsUpdate = true;
    };

    if (immediate) {
      for (const slot of slots) {
        populateSlot(slot);
      }
      applyStage(currentStage);
    } else {
      const stepSlice = (): void => {
        const start = performance.now();
        while (slotIdx < slots.length) {
          populateSlot(slots[slotIdx]!);
          slotIdx++;
          if (performance.now() - start > 8 && slotIdx < slots.length) {
            setTimeout(stepSlice, 0);
            return;
          }
        }
        applyStage(currentStage);
      };
      stepSlice();
    }
  };

  return {
    build,
    setStage(stage: number): void {
      applyStage(stage);
    },
    setTier(tier: 'low' | 'mid' | 'high' | 'off'): void {
      if (currentTier === tier) return;
      currentTier = tier;
      if (lastInput) build(lastInput);
      else applyStage(currentStage);
    },
    counts(): BiomeInstanceCount {
      const byKind: Record<ScatterKind, number> = {
        tuft: slotById.get('tuft')?.mesh.count ?? 0,
        bush: slotById.get('bush')?.mesh.count ?? 0,
        pine: (slotById.get('pine_near')?.mesh.count ?? 0) + (slotById.get('pine_far')?.mesh.count ?? 0),
        oak: (slotById.get('oak_near')?.mesh.count ?? 0) + (slotById.get('oak_far')?.mesh.count ?? 0),
        birch: (slotById.get('birch_near')?.mesh.count ?? 0) + (slotById.get('birch_far')?.mesh.count ?? 0),
      };
      const trees = byKind.pine + byKind.oak + byKind.birch;
      const total = byKind.tuft + byKind.bush + trees;
      return { total, trees, byKind };
    },
    triangles(): number {
      let sum = 0;
      for (const slot of slots) {
        sum += slot.mesh.count * slot.trianglesPerInstance;
      }
      return sum;
    },
    drawCalls(): number {
      let dc = 0;
      for (const slot of slots) {
        if (slot.mesh.count > 0 && slot.mesh.visible) dc++;
      }
      return dc;
    },
    dispose(): void {
      scene.remove(rootGroup);
      tuftTexture.dispose();
      tuftMaterial.dispose();
      plantMaterial.dispose();
      pineNear.geometry.dispose();
      pineFar.geometry.dispose();
      oakNear.geometry.dispose();
      oakFar.geometry.dispose();
      birchNear.geometry.dispose();
      birchFar.geometry.dispose();
      bushModel.geometry.dispose();
      tuftModel.geometry.dispose();
    },
  };
}
