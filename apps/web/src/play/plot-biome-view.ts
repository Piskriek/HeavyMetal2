// apps/web/src/play/plot-biome-view.ts
// Plotbiome scatter view (TICKET-02 item F + TICKET-31 foliage ladder, wind, dilated sprig atlas,
// edge-on grazing fade, octahedral far impostor, and Beam Rifle species preset override).

import * as THREE from 'three';
import { bakePlotBiome, type BiomeInput, type ScatterKind, type Tier } from '@hm/plotbiome';
import {
  growTree,
  buildDilatedSprigAtlas,
  FOLIAGE_SPECIES_PRESETS,
  type Species,
  type Tree,
  type TreeSliderParams,
} from '@hm/treegen';
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
  setWindTime?(timeSec: number): void;
  /** Applies a Water Maker (Aq) foliage species preset to the nearest tree(s) within radiusM. Returns count updated. */
  applyTreePresetAt?(
    worldX: number,
    worldZ: number,
    species: Species,
    sliders?: TreeSliderParams,
    radiusM?: number,
  ): number;
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
  items: ScatterItem[];
  trianglesPerInstance: number;
}

const CANOPY_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.25, 0.52, 0.20], // 0: emerald
  [0.72, 0.48, 0.16], // 1: autumn-gold
  [0.42, 0.65, 0.22], // 2: birch-lime
  [0.18, 0.58, 0.48], // 3: hydro-teal
];

export function resolveLeafTintColor(
  defaultColor: readonly [number, number, number],
  sliders?: TreeSliderParams,
): readonly [number, number, number] {
  const tintIdx = sliders?.tint;
  if (typeof tintIdx === 'number' && tintIdx >= 0 && tintIdx < CANOPY_TINTS.length) {
    return CANOPY_TINTS[Math.round(tintIdx)] ?? defaultColor;
  }
  return defaultColor;
}

export function mergeTreeGeometry(
  tree: Tree,
  barkColor: readonly [number, number, number],
  leafColor: readonly [number, number, number],
): { geometry: THREE.BufferGeometry; triangles: number } {
  const g = new THREE.BufferGeometry();
  const barkPos = tree.bark.getAttribute('position') as THREE.BufferAttribute;
  const barkNor = tree.bark.getAttribute('normal') as THREE.BufferAttribute;
  const barkUv = tree.bark.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const barkWind = tree.bark.getAttribute('windAndAo') as THREE.BufferAttribute | undefined;

  const leafPos = tree.leaves.getAttribute('position') as THREE.BufferAttribute;
  const leafNor = (tree.leaves.getAttribute('spherizedNormal') ??
    tree.leaves.getAttribute('normal')) as THREE.BufferAttribute;
  const leafFaceNor = (tree.leaves.getAttribute('faceNormal') ??
    tree.leaves.getAttribute('normal')) as THREE.BufferAttribute;
  const leafUv = (tree.leaves.getAttribute('atlasUv') ??
    tree.leaves.getAttribute('uv')) as THREE.BufferAttribute | undefined;
  const leafWind = tree.leaves.getAttribute('windAndAo') as THREE.BufferAttribute | undefined;

  const totalVerts = barkPos.count + leafPos.count;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const faceNormals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);
  const windAndAo = new Float32Array(totalVerts * 4);

  // Copy bark vertices (windAndAo.w = -1 marks opaque bark so alpha test never clips bark):
  for (let i = 0; i < barkPos.count; i++) {
    const i3 = i * 3;
    const i2 = i * 2;
    const i4 = i * 4;
    const nx = barkNor.getX(i);
    const ny = barkNor.getY(i);
    const nz = barkNor.getZ(i);
    positions[i3] = barkPos.getX(i);
    positions[i3 + 1] = barkPos.getY(i);
    positions[i3 + 2] = barkPos.getZ(i);
    normals[i3] = nx;
    normals[i3 + 1] = ny;
    normals[i3 + 2] = nz;
    faceNormals[i3] = nx;
    faceNormals[i3 + 1] = ny;
    faceNormals[i3 + 2] = nz;
    if (barkUv) {
      uvs[i2] = barkUv.getX(i);
      uvs[i2 + 1] = barkUv.getY(i);
    }
    colors[i3] = barkColor[0];
    colors[i3 + 1] = barkColor[1];
    colors[i3 + 2] = barkColor[2];
    windAndAo[i4] = barkWind ? barkWind.getX(i) : Math.min(1, Math.max(0, barkPos.getY(i) / Math.max(1, tree.height)));
    windAndAo[i4 + 1] = barkWind ? barkWind.getY(i) : 0;
    windAndAo[i4 + 2] = barkWind ? barkWind.getZ(i) : 0.85;
    windAndAo[i4 + 3] = -1.0;
  }

  // Copy leaves vertices with spherized normals, true card faceNormals, and 2x2 sprig atlas UVs:
  const offset = barkPos.count;
  for (let i = 0; i < leafPos.count; i++) {
    const o3 = (offset + i) * 3;
    const o2 = (offset + i) * 2;
    const o4 = (offset + i) * 4;
    positions[o3] = leafPos.getX(i);
    positions[o3 + 1] = leafPos.getY(i);
    positions[o3 + 2] = leafPos.getZ(i);
    normals[o3] = leafNor.getX(i);
    normals[o3 + 1] = leafNor.getY(i);
    normals[o3 + 2] = leafNor.getZ(i);
    faceNormals[o3] = leafFaceNor.getX(i);
    faceNormals[o3 + 1] = leafFaceNor.getY(i);
    faceNormals[o3 + 2] = leafFaceNor.getZ(i);
    if (leafUv) {
      uvs[o2] = leafUv.getX(i);
      uvs[o2 + 1] = leafUv.getY(i);
    }
    const ao = leafWind ? leafWind.getZ(i) : 0.85;
    colors[o3] = leafColor[0] * (0.55 + 0.45 * ao);
    colors[o3 + 1] = leafColor[1] * (0.55 + 0.45 * ao);
    colors[o3 + 2] = leafColor[2] * (0.55 + 0.45 * ao);
    windAndAo[o4] = leafWind ? leafWind.getX(i) : 0.7;
    windAndAo[o4 + 1] = leafWind ? leafWind.getY(i) : 0.3;
    windAndAo[o4 + 2] = ao;
    windAndAo[o4 + 3] = leafWind ? Math.max(0.1, leafWind.getW(i)) : 0.8;
  }

  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('faceNormal', new THREE.BufferAttribute(faceNormals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('windAndAo', new THREE.BufferAttribute(windAndAo, 4));
  g.computeBoundingSphere();
  return { geometry: g, triangles: totalVerts / 3 };
}

/**
 * Builds an ultra-low-overdraw Octahedral Far Impostor (4 triangles tapered trunk +
 * 8 triangles 4-plane star/octahedral canopy cage = 12 triangles total) with spherized
 * dome normals for distant trees (> 60 m) to keep the min-spec GTX 950M smooth.
 */
export function createOctahedralFarImpostorGeometry(
  tree: Tree,
  barkColor: readonly [number, number, number],
  leafColor: readonly [number, number, number],
): { geometry: THREE.BufferGeometry; triangles: number } {
  const g = new THREE.BufferGeometry();
  const h = Math.max(2.0, tree.height);
  const r = Math.max(0.8, tree.radius * 0.85);
  const trunkTop = h * 0.55;
  const trunkR = Math.max(0.12, r * 0.11);
  const crownBase = h * 0.22;
  const crownMid = (crownBase + h) * 0.5;

  const pos: number[] = [];
  const nor: number[] = [];
  const fnor: number[] = [];
  const uvs: number[] = [];
  const col: number[] = [];
  const wind: number[] = [];

  const pushTri = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    na: readonly [number, number, number],
    nb: readonly [number, number, number],
    nc: readonly [number, number, number],
    fna: readonly [number, number, number],
    ua: readonly [number, number],
    ub: readonly [number, number],
    uc: readonly [number, number],
    rgb: readonly [number, number, number],
    w4: readonly [number, number, number, number],
  ): void => {
    for (const [pt, n, uv] of [
      [a, na, ua],
      [b, nb, ub],
      [c, nc, uc],
    ] as const) {
      pos.push(pt[0], pt[1], pt[2]);
      nor.push(n[0], n[1], n[2]);
      fnor.push(fna[0], fna[1], fna[2]);
      uvs.push(uv[0], uv[1]);
      col.push(rgb[0], rgb[1], rgb[2]);
      wind.push(w4[0], w4[1], w4[2], w4[3]);
    }
  };

  // 1. Crossed 2-fin tapered trunk (4 triangles, wind.w = -1 for opaque bark):
  pushTri(
    [-trunkR, 0, 0],
    [trunkR, 0, 0],
    [0, trunkTop, 0],
    [0, 0.2, 0.98],
    [0, 0.2, 0.98],
    [0, 0.4, 0.92],
    [0, 1, 0],
    [0, 0],
    [1, 0],
    [0.5, 1],
    barkColor,
    [0.3, 0, 0.85, -1],
  );
  pushTri(
    [0, 0, -trunkR],
    [0, 0, trunkR],
    [0, trunkTop, 0],
    [0.98, 0.2, 0],
    [0.98, 0.2, 0],
    [0.92, 0.4, 0],
    [0, 1, 0],
    [0, 0],
    [1, 0],
    [0.5, 1],
    barkColor,
    [0.3, 0, 0.85, -1],
  );

  // 2. 4-plane octahedral star canopy (8 triangles) with spherized normals:
  const angles = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75];
  const sphNorm = (x: number, y: number, z: number): readonly [number, number, number] => {
    const dy = (y - crownMid) * 1.15;
    const len = Math.hypot(x, dy, z) || 1;
    return [x / len, dy / len, z / len];
  };

  for (let k = 0; k < angles.length; k++) {
    const ang = angles[k]!;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    // Avoid grazing fade on far impostors by setting faceNormal to UP (0,1,0):
    const fn: readonly [number, number, number] = [0, 1, 0];
    const p00: readonly [number, number, number] = [-ca * r, crownBase, -sa * r];
    const p10: readonly [number, number, number] = [ca * r, crownBase, sa * r];
    const p11: readonly [number, number, number] = [ca * r * 0.72, h, sa * r * 0.72];
    const p01: readonly [number, number, number] = [-ca * r * 0.72, h, -sa * r * 0.72];

    const qx = (k & 1) * 0.5;
    const qy = (k >> 1) * 0.5;
    const w4: readonly [number, number, number, number] = [0.75, k * 0.25, 0.92, 0.5];

    pushTri(
      p00,
      p10,
      p11,
      sphNorm(p00[0], p00[1], p00[2]),
      sphNorm(p10[0], p10[1], p10[2]),
      sphNorm(p11[0], p11[1], p11[2]),
      fn,
      [qx, qy],
      [qx + 0.5, qy],
      [qx + 0.5, qy + 0.5],
      leafColor,
      w4,
    );
    pushTri(
      p00,
      p11,
      p01,
      sphNorm(p00[0], p00[1], p00[2]),
      sphNorm(p11[0], p11[1], p11[2]),
      sphNorm(p01[0], p01[1], p01[2]),
      fn,
      [qx, qy],
      [qx + 0.5, qy + 0.5],
      [qx, qy + 0.5],
      leafColor,
      w4,
    );
  }

  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('faceNormal', new THREE.BufferAttribute(new Float32Array(fnor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('windAndAo', new THREE.BufferAttribute(new Float32Array(wind), 4));
  g.computeBoundingSphere();
  return { geometry: g, triangles: pos.length / 9 };
}

function createSprigAtlasTexture(): THREE.DataTexture {
  const atlas = buildDilatedSprigAtlas(128);
  const tex = new THREE.DataTexture(atlas.rgba, atlas.size, atlas.size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
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

      // Edge-dilate blade RGB into alpha = 0 pixels so mipmaps never halo:
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = isBlade && v < 0.96 ? 255 : 0;
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

  // 1. Shared tree & plant materials with Stage Ladder (0a..6), Wind, Dilated Sprig Atlas & Edge-On Fade:
  const sprigAtlasTexture = createSprigAtlasTexture();
  const foliageUniforms = {
    uStage: { value: 0 },
    uWindTime: { value: 0 },
    uSprigAtlas: { value: sprigAtlasTexture },
  };

  const plantMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: 0.45,
  });

  plantMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uStage = foliageUniforms.uStage;
    shader.uniforms.uWindTime = foliageUniforms.uWindTime;
    shader.uniforms.uSprigAtlas = foliageUniforms.uSprigAtlas;

    shader.vertexShader =
      `
      attribute vec3 faceNormal;
      attribute vec4 windAndAo;
      uniform float uStage;
      uniform float uWindTime;
      varying vec4 vWindAndAo;
      varying float vGrazingFade;
      varying vec2 vSprigUv;
      varying vec3 vWorldPosFoliage;
      ` +
      shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vWindAndAo = windAndAo;
          vSprigUv = uv;
          if (uStage >= 3.0 && windAndAo.w >= 0.0) {
            float swayPhase = uWindTime * 1.8 + windAndAo.y * 6.283185;
            float trunkSway = sin(swayPhase) * 0.14 * windAndAo.x;
            float flutter = sin(uWindTime * 5.2 + windAndAo.y * 19.0) * 0.045 * windAndAo.w;
            transformed.x += trunkSway + flutter;
            transformed.z += cos(swayPhase * 0.85) * 0.10 * windAndAo.x;
          }
          vec4 wpFol = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpFol = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          vWorldPosFoliage = wpFol.xyz;
          vec3 worldFaceN = normalize(mat3(modelMatrix) * faceNormal);
          vec3 viewDirW = normalize(cameraPosition - vWorldPosFoliage);
          float absFaceDot = abs(dot(worldFaceN, viewDirW));
          vGrazingFade = windAndAo.w < 0.0 ? 1.0 : clamp((absFaceDot - 0.05) / 0.14, 0.0, 1.0);
          `,
        );

    shader.fragmentShader =
      `
      uniform float uStage;
      uniform sampler2D uSprigAtlas;
      varying vec4 vWindAndAo;
      varying float vGrazingFade;
      varying vec2 vSprigUv;
      varying vec3 vWorldPosFoliage;
      ` +
      shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        `
        if (vWindAndAo.w >= 0.0) {
          if (uStage < 1.0) {
            // Stage 0b: 1-bit world-locked Bayer stipple (no texture sampling)
            vec2 bCell = floor(vWorldPosFoliage.xz * 6.0);
            float bayer = fract(dot(bCell, vec2(0.5, 0.25)) + floor(vWorldPosFoliage.y * 6.0) * 0.375);
            if (bayer > 0.62) discard;
          } else if (uStage < 4.0) {
            // Stages 1-2 (EGA/VGA) and Stage 3 (Gouraud): crisp binary sprig silhouette
            vec4 sp = texture2D(uSprigAtlas, vSprigUv);
            if (sp.a < 0.5) discard;
            if (uStage < 3.0) {
              diffuseColor.rgb = floor(diffuseColor.rgb * 6.0 + 0.5) / 6.0;
            }
          } else {
            // Stages 4-6 (PBR / Forest / Hydro): full dilated 2x2 sprig atlas + edge-on sliver fade + backscatter
            vec4 sp = texture2D(uSprigAtlas, vSprigUv);
            if (sp.a * vGrazingFade < 0.45) discard;
            diffuseColor.rgb *= (0.78 + 0.32 * sp.g);
          }
        }
        #include <alphatest_fragment>
        `,
      );
  };

  const tuftTexture = createTuftTexture();
  const tuftMaterial = new THREE.MeshLambertMaterial({
    map: tuftTexture,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });

  // 2. Pre-grow models once at load (far trees use octahedral impostor on Low/Mid to save GTX 950M overdraw):
  const pineNearTree = growTree({ species: 'pine', seed: 101, height: 10.0, detail: 1 });
  const pineNear = mergeTreeGeometry(
    pineNearTree,
    FOLIAGE_SPECIES_PRESETS.pine!.barkColor,
    FOLIAGE_SPECIES_PRESETS.pine!.leafColor,
  );
  const pineFar = createOctahedralFarImpostorGeometry(
    growTree({ species: 'pine', seed: 101, height: 10.0, detail: 0 }),
    FOLIAGE_SPECIES_PRESETS.pine!.barkColor,
    FOLIAGE_SPECIES_PRESETS.pine!.leafColor,
  );

  const oakNearTree = growTree({ species: 'oak', seed: 202, height: 8.5, detail: 1 });
  const oakNear = mergeTreeGeometry(
    oakNearTree,
    FOLIAGE_SPECIES_PRESETS.oak!.barkColor,
    FOLIAGE_SPECIES_PRESETS.oak!.leafColor,
  );
  const oakFar = createOctahedralFarImpostorGeometry(
    growTree({ species: 'oak', seed: 202, height: 8.5, detail: 0 }),
    FOLIAGE_SPECIES_PRESETS.oak!.barkColor,
    FOLIAGE_SPECIES_PRESETS.oak!.leafColor,
  );

  const birchNearTree = growTree({ species: 'birch', seed: 303, height: 7.5, detail: 1 });
  const birchNear = mergeTreeGeometry(
    birchNearTree,
    FOLIAGE_SPECIES_PRESETS.birch!.barkColor,
    FOLIAGE_SPECIES_PRESETS.birch!.leafColor,
  );
  const birchFar = createOctahedralFarImpostorGeometry(
    growTree({ species: 'birch', seed: 303, height: 7.5, detail: 0 }),
    FOLIAGE_SPECIES_PRESETS.birch!.barkColor,
    FOLIAGE_SPECIES_PRESETS.birch!.leafColor,
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
    { id: 'tuft', kind: 'tuft', isFar: false, mesh: makeMesh(tuftModel.geometry, tuftMaterial), appears: [], items: [], trianglesPerInstance: tuftModel.triangles },
    { id: 'bush', kind: 'bush', isFar: false, mesh: makeMesh(bushModel.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: bushModel.triangles },
    { id: 'pine_near', kind: 'pine', isFar: false, mesh: makeMesh(pineNear.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: pineNear.triangles },
    { id: 'pine_far', kind: 'pine', isFar: true, mesh: makeMesh(pineFar.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: pineFar.triangles },
    { id: 'oak_near', kind: 'oak', isFar: false, mesh: makeMesh(oakNear.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: oakNear.triangles },
    { id: 'oak_far', kind: 'oak', isFar: true, mesh: makeMesh(oakFar.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: oakFar.triangles },
    { id: 'birch_near', kind: 'birch', isFar: false, mesh: makeMesh(birchNear.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: birchNear.triangles },
    { id: 'birch_far', kind: 'birch', isFar: true, mesh: makeMesh(birchFar.geometry, plantMaterial), appears: [], items: [], trianglesPerInstance: birchFar.triangles },
  ];

  const slotById = new Map<string, MeshSlot>(slots.map((s) => [s.id, s]));

  const applyStage = (stage: number): void => {
    currentStage = stage;
    foliageUniforms.uStage.value = stage;
    plantMaterial.wireframe = stage === 0;

    if (currentTier === 'off' || stage < 2) {
      for (const slot of slots) {
        slot.mesh.count = 0;
        slot.mesh.visible = false;
      }
      return;
    }

    const threshold = Math.min(6, stage + 0.5);
    for (const slot of slots) {
      let c = 0;
      while (c < slot.appears.length && (slot.appears[c] ?? 999) <= threshold) {
        c++;
      }
      slot.mesh.count = c;
      slot.mesh.visible = c > 0;
    }
  };

  const dummy = new THREE.Object3D();

  const populateSlot = (slot: MeshSlot): void => {
    const list = slot.items;
    list.sort((a, b) => a.appear - b.appear);

    slot.appears = list.map((item) => item.appear);
    const n = Math.min(list.length, maxCapacity);

    for (let i = 0; i < n; i++) {
      const item = list[i]!;
      const worldY = o.heightAt(item.worldX, item.worldZ) - 0.05; // sunk 0.05 m so nothing floats
      dummy.position.set(item.worldX, worldY, item.worldZ);
      dummy.rotation.set(0, item.yaw, 0);

      const sc = item.kind === 'bush' ? item.scale * 0.4 : item.scale;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      slot.mesh.setMatrixAt(i, dummy.matrix);
    }
    slot.mesh.instanceMatrix.needsUpdate = true;
  };

  const build = (input: BiomeInput, immediate = true): void => {
    lastInput = input;
    const bakeTier: Tier = currentTier === 'off' ? 'low' : currentTier;

    const bakeInput: BiomeInput = {
      ...input,
      stage: 6,
      tier: bakeTier,
    };
    const { scatter } = bakePlotBiome(bakeInput);

    for (const slot of slots) slot.items = [];

    const originX = o.origin?.x ?? -(input.n * input.cellM) / 2;
    const originZ = o.origin?.z ?? -(input.n * input.cellM) / 2;

    for (const s of scatter) {
      const worldX = originX + s.x;
      const worldZ = originZ + s.z;
      const dist = Math.hypot(worldX, worldZ);

      if (s.kind === 'tuft') {
        const maxDist = bakeTier === 'low' ? 20 : 30;
        if (dist > maxDist) continue;
        slotById.get('tuft')!.items.push({ ...s, worldX, worldZ });
      } else if (s.kind === 'bush') {
        slotById.get('bush')!.items.push({ ...s, worldX, worldZ });
      } else if (s.kind === 'pine' || s.kind === 'oak' || s.kind === 'birch') {
        const targetId = dist < 60 ? `${s.kind}_near` : `${s.kind}_far`;
        slotById.get(targetId)?.items.push({ ...s, worldX, worldZ });
      }
    }

    let slotIdx = 0;
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
    setWindTime(timeSec: number): void {
      foliageUniforms.uWindTime.value = timeSec;
    },
    applyTreePresetAt(
      worldX: number,
      worldZ: number,
      species: Species,
      sliders?: TreeSliderParams,
      radiusM = 6.0,
    ): number {
      const r2 = radiusM * radiusM;
      let changed = 0;
      const nearId = `${species}_near`;
      const farId = `${species}_far`;

      // If custom sliders were supplied on the cartridge, rebuild that species' near geometry:
      if (sliders) {
        const preset = FOLIAGE_SPECIES_PRESETS[species] ?? FOLIAGE_SPECIES_PRESETS.oak!;
        const leafCol = resolveLeafTintColor(preset.leafColor, sliders);
        const h = typeof sliders.height === 'number' && sliders.height > 0 ? sliders.height : preset.params.height ?? 8.5;
        const regrown = mergeTreeGeometry(
          growTree({ species, seed: species === 'pine' ? 101 : species === 'oak' ? 202 : 303, height: h, detail: 1, sliders }),
          preset.barkColor,
          leafCol,
        );
        const targetSlot = slotById.get(nearId);
        if (targetSlot) {
          targetSlot.mesh.geometry.dispose();
          targetSlot.mesh.geometry = regrown.geometry;
          targetSlot.trianglesPerInstance = regrown.triangles;
        }
      }

      // Move any tree within radiusM into the target species slot:
      const treeSlots = slots.filter((s) => s.kind === 'pine' || s.kind === 'oak' || s.kind === 'birch');
      const movedNear: ScatterItem[] = [];
      const movedFar: ScatterItem[] = [];

      for (const s of treeSlots) {
        const kept: ScatterItem[] = [];
        for (const item of s.items) {
          const dx = item.worldX - worldX;
          const dz = item.worldZ - worldZ;
          if (dx * dx + dz * dz <= r2) {
            changed++;
            const updated: ScatterItem = { ...item, kind: species };
            if (s.isFar) movedFar.push(updated);
            else movedNear.push(updated);
          } else {
            kept.push(item);
          }
        }
        s.items = kept;
      }

      if (changed > 0) {
        slotById.get(nearId)?.items.push(...movedNear);
        slotById.get(farId)?.items.push(...movedFar);
        for (const s of treeSlots) populateSlot(s);
        applyStage(currentStage);
      }
      return changed;
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
      sprigAtlasTexture.dispose();
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
