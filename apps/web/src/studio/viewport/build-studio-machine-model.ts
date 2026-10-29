/**
 * @file apps/web/src/studio/viewport/build-studio-machine-model.ts
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Phase 1 & Aspects 1–5, 7–8):
 * Constructs a live Three.js `THREE.Group` directly from any `@hm/kitspec` modular `Kit` +
 * `@hm/partgen` generators + `@hm/meshops` non-destructive operator stack + `@hm/matstack`
 * spatial `DataTexture` evaluation + Stage S0..S6 shader modes + 3D Triad Socket gizmos +
 * AABB collider wireframes.
 */

import * as THREE from 'three';
import type { Box3, DetailRank, Kit, OpRef, Overrides } from '@hm/kitspec';
import { flatten, presetBounds, sourceBounds, transformBox } from '@hm/kitspec';
import type { MaterialSpec, NoiseSource, SamplePoint, TileSource } from '@hm/matstack';
import {
  FLAT_TILE,
  layerWeight,
  MATERIAL_SHELF,
  materialAt,
  resolveMatPreset,
  surfaceAt,
} from '@hm/matstack';
import type { MeshData, Rank } from '@hm/partgen';
import { buildPart } from '@hm/partgen';
import type { StudioTileBank } from './layered-material-bridge';
import type { KitPickTable } from './raycast-picker';
import { buildKitPickTable } from './raycast-picker';
import type { SocketPin } from './socket-gizmos';
import { enumerateAssemblySockets } from './socket-gizmos';

const DEFAULT_NOISE: NoiseSource = {
  sample(kind, u, v) {
    const x = Math.sin((u * 12.9898 + v * 78.233) * (kind === 'cells' ? 3.0 : 1.7)) * 43758.5453;
    return x - Math.floor(x);
  },
};
const DEFAULT_TILE_SOURCE: TileSource = { sample: () => FLAT_TILE };

export type StudioStageLook = 'lab-neutral' | 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BuildStudioMachineOptions {
  readonly kit: Kit;
  readonly presetId: string;
  readonly rank?: DetailRank;
  readonly overrides?: Overrides;
  readonly materials?: Readonly<Record<string, MaterialSpec>>;
  readonly activeMaterialId?: string;
  readonly hoveredMaterialId?: string | null;
  readonly maskViewLayerIndex?: number | null;
  readonly wireframe?: boolean;
  readonly showSockets?: boolean;
  readonly showColliders?: boolean;
  readonly activePartPath?: string | null;
  readonly activeSocketPinId?: string | null;
  readonly stageLook?: StudioStageLook;
  readonly tileBank?: StudioTileBank;
}

export interface BuiltStudioMachineModel {
  readonly group: THREE.Group;
  readonly pickTable: KitPickTable;
  readonly socketPins: readonly SocketPin[];
  readonly bounds: Box3;
  readonly partCount: number;
  readonly triangleCount: number;
  dispose(): void;
}

const SAMPLE_PROBE: SamplePoint = {
  uv: [0.35, 0.35],
  pos: [0.2, 1.1, 0.2],
  normal: [0, 0.5, 0.866],
  edge: 0.018,
  cavity: 0.025,
};

const toSrgbByte = (v: number): number => {
  const c = Math.max(0, Math.min(1, v));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
};

const toSrgbHex = (rgb: readonly [number, number, number]): string => {
  const ch = (v: number): string => toSrgbByte(v).toString(16).padStart(2, '0');
  return `#${ch(rgb[0])}${ch(rgb[1])}${ch(rgb[2])}`;
};

/** Quantizes linear RGB to 16-color EGA palette for Stage 1 preview. */
function quantizeEga16(rgb: readonly [number, number, number]): readonly [number, number, number] {
  const q = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 3) / 3;
  return [q(rgb[0]), q(rgb[1]), q(rgb[2])];
}

/**
 * Executes a non-destructive `@hm/meshops` operator stack (`OpRef[]`) on a `@hm/partgen` `MeshData`.
 * Preserves base grounding (`y = 0`) when deforming so parts stay grounded on their sockets.
 */
export function applyMeshOpsToMeshData(md: MeshData, ops?: readonly OpRef[]): MeshData {
  if (!ops || ops.length === 0) return md;
  const pos = new Float32Array(md.positions);
  const norm = new Float32Array(md.normals);
  const nVerts = Math.floor(pos.length / 3);
  if (nVerts === 0) return md;

  let minX = md.min[0], minY = md.min[1], minZ = md.min[2];
  let maxX = md.max[0], maxY = md.max[1], maxZ = md.max[2];
  const spanY = Math.max(0.001, maxY - minY);
  const cx = 0.5 * (minX + maxX);
  const cz = 0.5 * (minZ + maxZ);

  for (const opRef of ops) {
    const p = opRef.params ?? {};
    switch (opRef.op) {
      case 'taper-flare': {
        const topScale = p.topScale ?? 1.25;
        const bottomScale = p.bottomScale ?? 0.85;
        const bulge = p.bulge ?? 0.0;
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const x = pos[idx]!;
          const y = pos[idx + 1]!;
          const z = pos[idx + 2]!;
          const t = Math.max(0, Math.min(1, (y - minY) / spanY));
          const s = bottomScale + (topScale - bottomScale) * t + bulge * Math.sin(t * Math.PI);
          pos[idx] = cx + (x - cx) * s;
          pos[idx + 2] = cz + (z - cz) * s;
        }
        break;
      }
      case 'extender-mid-slice': {
        const axis = Math.round(p.axis ?? 1);
        const deltaM = p.deltaM ?? 0.25;
        const mid =
          axis === 0 ? 0.5 * (minX + maxX) : axis === 2 ? 0.5 * (minZ + maxZ) : 0.5 * (minY + maxY);
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3 + Math.max(0, Math.min(2, axis));
          const val = pos[idx]!;
          if (axis === 1) {
            if (val > mid) pos[idx] = val + deltaM;
          } else {
            pos[idx] = val >= mid ? val + 0.5 * deltaM : val - 0.5 * deltaM;
          }
        }
        break;
      }
      case 'smooth-taubin': {
        const iterations = Math.min(12, Math.max(1, Math.round(p.iterations ?? 4)));
        const factor = 0.18;
        const cy = 0.5 * (minY + maxY);
        for (let it = 0; it < iterations; it++) {
          for (let i = 0; i < nVerts; i++) {
            const idx = i * 3;
            const y = pos[idx + 1]!;
            // Keep bottom mounting base flat at minY
            if (y <= minY + 0.004) continue;
            pos[idx] = pos[idx]! + (cx - pos[idx]!) * factor * 0.15;
            pos[idx + 1] = y + (cy - y) * factor * 0.08;
            pos[idx + 2] = pos[idx + 2]! + (cz - pos[idx + 2]!) * factor * 0.15;
          }
        }
        break;
      }
      case 'chamfer-hard-edges': {
        const width = Math.max(0.002, Math.min(0.12, p.width ?? 0.018));
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const y = pos[idx + 1]!;
          if (y >= maxY - width * 1.5) {
            pos[idx] = cx + (pos[idx]! - cx) * (1 - width * 1.8);
            pos[idx + 2] = cz + (pos[idx + 2]! - cz) * (1 - width * 1.8);
          }
        }
        break;
      }
      case 'inset-outset-faces': {
        const depth = Math.max(-0.08, Math.min(0.08, p.depth ?? -0.012));
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const y = pos[idx + 1]!;
          if (y > minY + 0.02 && y < maxY - 0.02) {
            pos[idx] = pos[idx]! + norm[idx]! * depth;
            pos[idx + 2] = pos[idx + 2]! + norm[idx + 2]! * depth;
          }
        }
        break;
      }
      case 'surface-edge-wear-ao': {
        const band = Math.max(0.005, Math.min(0.08, p.bandWidthM ?? 0.025));
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const y = pos[idx + 1]!;
          if (y > minY + 0.01) {
            pos[idx] = pos[idx]! + norm[idx]! * (band * 0.15);
            pos[idx + 2] = pos[idx + 2]! + norm[idx + 2]! * (band * 0.15);
          }
        }
        break;
      }
      case 'bend-arc': {
        const angleRad = ((p.angleDeg ?? 25) * Math.PI) / 180;
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const x = pos[idx]!;
          const y = pos[idx + 1]!;
          const t = Math.max(0, Math.min(1, (y - minY) / spanY));
          const theta = t * angleRad;
          pos[idx] = x + Math.sin(theta) * spanY * 0.25;
          pos[idx + 1] = minY + (y - minY) * Math.cos(theta * 0.5);
        }
        break;
      }
      case 'twist-helix': {
        const angleRad = ((p.angleDeg ?? 35) * Math.PI) / 180;
        for (let i = 0; i < nVerts; i++) {
          const idx = i * 3;
          const dx = pos[idx]! - cx;
          const y = pos[idx + 1]!;
          const dz = pos[idx + 2]! - cz;
          const t = Math.max(0, Math.min(1, (y - minY) / spanY));
          const a = t * angleRad;
          const c = Math.cos(a);
          const s = Math.sin(a);
          pos[idx] = cx + dx * c - dz * s;
          pos[idx + 2] = cz + dx * s + dz * c;
        }
        break;
      }
      default:
        break;
    }
  }

  // Recompute bounding box after modifiers
  let nMinX = Infinity, nMinY = Infinity, nMinZ = Infinity;
  let nMaxX = -Infinity, nMaxY = -Infinity, nMaxZ = -Infinity;
  for (let i = 0; i < nVerts; i++) {
    const x = pos[i * 3]!;
    const y = pos[i * 3 + 1]!;
    const z = pos[i * 3 + 2]!;
    if (x < nMinX) nMinX = x;
    if (y < nMinY) nMinY = y;
    if (z < nMinZ) nMinZ = z;
    if (x > nMaxX) nMaxX = x;
    if (y > nMaxY) nMaxY = y;
    if (z > nMaxZ) nMaxZ = z;
  }

  return {
    positions: pos,
    normals: norm,
    uvs: md.uvs,
    indices: md.indices,
    slots: md.slots,
    min: [nMinX, nMinY, nMinZ],
    max: [nMaxX, nMaxY, nMaxZ],
  };
}

/**
 * Bakes a 24x24 spatial RGBA `THREE.DataTexture` from `@hm/matstack` so `paint1`, `paint2`,
 * `age` (weathering), `layers`, and `@hm/texgraph` tiles visibly render across the 3D machine.
 */
function bakeMatstackDataTexture(
  spec: MaterialSpec,
  tiles: TileSource,
  noise: NoiseSource,
  maskViewLayerIndex: number | null | undefined,
  stageLook: StudioStageLook | undefined,
): THREE.DataTexture {
  const size = 24;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    // Simulate edge proximity near UV borders and cavities in inner bands
    const edgeDist = Math.min(v, 1 - v) * 0.12;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const borderEdge = Math.min(edgeDist, Math.min(u, 1 - u) * 0.12);
      const cavityDist = Math.abs(u - 0.5) < 0.08 || Math.abs(v - 0.5) < 0.08 ? 0.008 : 0.06;
      const pt: SamplePoint = {
        uv: [u, v],
        pos: [u * 1.5, v * 2.0, 0.25],
        normal: [0, v > 0.7 ? 0.9 : 0.2, 0.85],
        edge: borderEdge,
        cavity: cavityDist,
      };

      const off = (y * size + x) * 4;
      if (
        maskViewLayerIndex !== undefined &&
        maskViewLayerIndex !== null &&
        maskViewLayerIndex >= 0 &&
        maskViewLayerIndex < spec.layers.length
      ) {
        const layer = spec.layers[maskViewLayerIndex]!;
        const surf = surfaceAt(layer.surface, pt, spec.paint, tiles);
        const w = layerWeight(layer, surf.height, pt, spec.age, noise);
        const b = toSrgbByte(w);
        data[off] = b;
        data[off + 1] = b;
        data[off + 2] = b;
        data[off + 3] = 255;
      } else {
        const ch = materialAt(spec, pt, tiles, noise);
        let rgb: readonly [number, number, number] = ch.colour;
        if (stageLook === 0) {
          const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
          const bayer = ((x & 1) * 2 + (y & 1)) / 4;
          const bw = lum > bayer ? 0.92 : 0.06;
          rgb = [bw, bw, bw];
        } else if (stageLook === 1) {
          rgb = quantizeEga16(rgb);
        }
        data[off] = toSrgbByte(rgb[0]);
        data[off + 1] = toSrgbByte(rgb[1]);
        data[off + 2] = toSrgbByte(rgb[2]);
        data[off + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (stageLook === 0 || stageLook === 1 || stageLook === 2) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  } else {
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * The plain names kits give a glowing part, as the lamp codes play draws them with (play-scene's violet, the capacitor bank's lamp),
 * so the Studio lights them instead of painting them with the shelf's default.
 */
export const KIT_GLOW_NAMES: Readonly<Record<string, string>> = {
  violet: 'lx:6500:2:steady:b84dff',
  lamp: 'lx:4200:1.4:steady:3eff8b',
};

function makeMatstackThreeMaterial(
  matId: string,
  opts: BuildStudioMachineOptions,
  disposableTextures: THREE.DataTexture[],
): THREE.MeshStandardMaterial {
  const isStage0 = opts.stageLook === 0;
  const isStage1 = opts.stageLook === 1;

  // 1. Handle emissive Lx lamp codes ('lx:<kelvin>:<intensity>:<pattern>[:<hex>]'), and the kits' plain names for a glow
  matId = KIT_GLOW_NAMES[matId] ?? matId;
  if (matId.startsWith('lx:')) {
    const parts = matId.split(':');
    const intensity = Number(parts[2] ?? 1.5) || 1.5;
    const rawHex = parts[4] ? (parts[4].startsWith('#') ? parts[4] : `#${parts[4]}`) : '#ffc13d';
    return new THREE.MeshStandardMaterial({
      color: rawHex,
      emissive: rawHex,
      emissiveIntensity: intensity,
      roughness: 0.2,
      metalness: 0.1,
      wireframe: Boolean(opts.wireframe || isStage0),
    });
  }

  // 2. Resolve effective MaterialSpec (with non-destructive hover try-on support!)
  const normId = matId.startsWith('mat:') ? matId : `mat:${matId}`;
  const effectiveId =
    opts.hoveredMaterialId && (!opts.activeMaterialId || opts.activeMaterialId === normId)
      ? opts.hoveredMaterialId
      : normId;

  const spec: MaterialSpec =
    opts.materials?.[effectiveId] ??
    resolveMatPreset(effectiveId) ??
    MATERIAL_SHELF['mat:field-worn-hazard']!;

  const tiles = opts.tileBank?.tileSource ?? DEFAULT_TILE_SOURCE;
  const noise = opts.tileBank?.noiseSource ?? DEFAULT_NOISE;
  const dataTex = bakeMatstackDataTexture(
    spec,
    tiles,
    noise,
    opts.maskViewLayerIndex,
    opts.stageLook,
  );
  disposableTextures.push(dataTex);

  // 3. Mask B&W diagnostic mode
  if (
    opts.maskViewLayerIndex !== undefined &&
    opts.maskViewLayerIndex !== null &&
    opts.maskViewLayerIndex >= 0 &&
    opts.maskViewLayerIndex < spec.layers.length
  ) {
    const layer = spec.layers[opts.maskViewLayerIndex]!;
    const surf = surfaceAt(layer.surface, SAMPLE_PROBE, spec.paint, tiles);
    const w = layerWeight(layer, surf.height, SAMPLE_PROBE, spec.age, noise);
    const greyHex = toSrgbHex([w, w, w]);
    return new THREE.MeshStandardMaterial({
      color: greyHex,
      map: dataTex,
      roughness: 0.9,
      metalness: 0.0,
      wireframe: Boolean(opts.wireframe),
    });
  }

  // 4. Standard Lit @hm/matstack evaluation
  const ch = materialAt(spec, SAMPLE_PROBE, tiles, noise);
  const rgb = isStage1 ? quantizeEga16(ch.colour) : ch.colour;
  const colorHex = isStage0 ? '#e2e8f0' : toSrgbHex(rgb);
  const emitHex = toSrgbHex(ch.emit);
  const hasEmit = ch.emit[0] + ch.emit[1] + ch.emit[2] > 0.01;
  // Clamp metalness when in low-stage lighting so meshes never turn pitch-black (P0-LIGHT-01)
  const clampedMetal = isStage0 || isStage1 ? Math.min(0.25, ch.metal) : Math.min(0.65, ch.metal);

  if (ch.coat > 0.05 && !isStage0 && !isStage1) {
    const phys = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      map: dataTex,
      roughness: Math.max(0.15, ch.rough),
      metalness: clampedMetal,
      clearcoat: ch.coat,
      clearcoatRoughness: ch.coatRough,
      ...(hasEmit ? { emissive: emitHex, emissiveIntensity: 1.0 } : {}),
      wireframe: Boolean(opts.wireframe),
    });
    return phys;
  }

  const std = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: dataTex,
    roughness: Math.max(0.18, ch.rough),
    metalness: clampedMetal,
    ...(hasEmit ? { emissive: emitHex, emissiveIntensity: 1.0 } : {}),
    wireframe: Boolean(opts.wireframe || isStage0),
  });
  if (isStage1) {
    (std as unknown as { flatShading: boolean }).flatShading = true;
  }
  return std;
}

/**
 * Builds a complete, grounded Three.js `THREE.Group` for any modular `Kit` preset (`MILL_V2_KIT`,
 * `STARGATE_V2_KIT`, `CAPACITOR_BANK_PURE_KIT`, `ROVER_SCOUT_V2_KIT`, etc.), replacing `loadGenRaw()`.
 */
export function buildStudioMachineModel(
  opts: BuildStudioMachineOptions,
): BuiltStudioMachineModel {
  const maxRank: DetailRank = opts.rank ?? 2;
  const placed = flatten(opts.kit, opts.presetId, opts.overrides);
  const pickTable = buildKitPickTable(opts.kit, opts.presetId, maxRank, opts.overrides);
  const socketPins = opts.showSockets
    ? enumerateAssemblySockets(opts.kit, opts.presetId, opts.overrides)
    : [];
  const kitBounds = presetBounds(opts.kit, placed) ?? { min: [0, 0, 0], max: [1, 1, 1] };

  const group = new THREE.Group();
  group.name = `studio-kit:${opts.presetId}`;
  group.userData = {
    kitId: opts.presetId,
    pickTable,
    socketPins,
  };

  const disposableGeoms: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTextures: THREE.DataTexture[] = [];

  for (const p of placed) {
    if (p.rank > maxRank) continue;
    const isSelectedPart = Boolean(opts.activePartPath && p.path === opts.activePartPath);

    if (p.source.kind === 'param') {
      const rawMd = buildPart(p.source.gen, p.source.params, maxRank as Rank);
      if (rawMd) {
        const md = applyMeshOpsToMeshData(rawMd, p.source.ops);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(md.normals, 3));
        geom.setAttribute('uv', new THREE.BufferAttribute(md.uvs, 2));
        geom.setIndex(new THREE.BufferAttribute(md.indices, 1));

        const slotMats: THREE.MeshStandardMaterial[] = [];
        md.slots.forEach((s, sIdx) => {
          geom.addGroup(s.start, s.count, sIdx);
          const mId = p.slotMaterials?.[s.name] ?? p.material;
          const mat = makeMatstackThreeMaterial(mId, opts, disposableTextures);
          slotMats.push(mat);
          disposableMats.push(mat);
        });

        const mesh = new THREE.Mesh(
          geom,
          slotMats.length === 1 ? slotMats[0]! : (slotMats as unknown as THREE.MeshStandardMaterial),
        );
        mesh.name = p.path;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const m4 = new THREE.Matrix4().fromArray(p.matrix);
        mesh.applyMatrix4(m4);
        mesh.userData = {
          partPath: p.path,
          partId: p.part,
          rank: p.rank,
          slotNames: md.slots.map((s) => s.name),
          bounds: transformBox({ min: md.min, max: md.max }, p.matrix),
        };
        group.add(mesh);
        disposableGeoms.push(geom);

        // Selection or Collider AABB Wireframe Overlay
        if (isSelectedPart || opts.showColliders) {
          const b = transformBox({ min: md.min, max: md.max }, p.matrix);
          const bw = Math.max(0.02, b.max[0] - b.min[0]);
          const bh = Math.max(0.02, b.max[1] - b.min[1]);
          const bd = Math.max(0.02, b.max[2] - b.min[2]);
          const boxGeom = new THREE.BoxGeometry(bw + 0.015, bh + 0.015, bd + 0.015);
          const boxMat = new THREE.MeshBasicMaterial({
            color: isSelectedPart ? '#38bdf8' : '#10b981',
            wireframe: true,
          });
          const boxMesh = new THREE.Mesh(boxGeom, boxMat);
          boxMesh.name = `collider-box:${p.path}`;
          boxMesh.position.set(
            0.5 * (b.min[0] + b.max[0]),
            0.5 * (b.min[1] + b.max[1]),
            0.5 * (b.min[2] + b.max[2]),
          );
          boxMesh.userData = { isHelper: true };
          group.add(boxMesh);
          disposableGeoms.push(boxGeom);
          disposableMats.push(boxMat);
        }
        continue;
      }
    }

    // Box source fallback. A kitspec box stands on its origin (y from 0 to its height), as kit-build draws it, so the geometry
    // is lifted by half its height (centred, every box part sat half a part low in the Studio)
    const size = p.source.kind === 'box' ? p.source.size : ([0.5, 0.5, 0.5] as const);
    const boxGeom = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (p.source.kind === 'box') boxGeom.translate(0, size[1] / 2, 0);
    const mat = makeMatstackThreeMaterial(p.material, opts, disposableTextures);
    const mesh = new THREE.Mesh(boxGeom, mat);
    mesh.name = p.path;
    const m4 = new THREE.Matrix4().fromArray(p.matrix);
    mesh.applyMatrix4(m4);
    const bounds = transformBox(sourceBounds(p.source), p.matrix);
    mesh.userData = {
      partPath: p.path,
      partId: p.part,
      rank: p.rank,
      slotNames: ['default'],
      bounds,
    };
    group.add(mesh);
    disposableGeoms.push(boxGeom);
    disposableMats.push(mat);

    // a box part's selection or collider overlay, as a param part's (plan 57 §14.2: the salvaged box kits had none)
    if (isSelectedPart || opts.showColliders) {
      const bw = Math.max(0.02, bounds.max[0] - bounds.min[0]);
      const bh = Math.max(0.02, bounds.max[1] - bounds.min[1]);
      const bd = Math.max(0.02, bounds.max[2] - bounds.min[2]);
      const overlayGeom = new THREE.BoxGeometry(bw + 0.015, bh + 0.015, bd + 0.015);
      const overlayMat = new THREE.MeshBasicMaterial({ color: isSelectedPart ? '#38bdf8' : '#10b981', wireframe: true });
      const overlay = new THREE.Mesh(overlayGeom, overlayMat);
      overlay.name = `collider-box:${p.path}`;
      overlay.position.set(0.5 * (bounds.min[0] + bounds.max[0]), 0.5 * (bounds.min[1] + bounds.max[1]), 0.5 * (bounds.min[2] + bounds.max[2]));
      overlay.userData = { isHelper: true };
      group.add(overlay);
      disposableGeoms.push(overlayGeom);
      disposableMats.push(overlayMat);
    }
  }

  // Render 3D Triad Socket Pins if enabled (Red = Input, Blue = Output, Gold = Power, Green = Mount)
  if (opts.showSockets) {
    for (const pin of socketPins) {
      const isSelectedPin = opts.activeSocketPinId === pin.pinId;
      const pinRadius = isSelectedPin ? 0.068 : 0.048;
      const pinGeom = new THREE.SphereGeometry(pinRadius);
      const pinMat = new THREE.MeshBasicMaterial({
        color: isSelectedPin ? '#ffffff' : pin.colorHex,
      });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.name = `socket-pin:${pin.pinId}`;
      pinMesh.position.set(pin.worldPos[0], pin.worldPos[1], pin.worldPos[2]);
      pinMesh.userData = { isSocketPin: true, socketPin: pin };
      group.add(pinMesh);
      disposableGeoms.push(pinGeom);
      disposableMats.push(pinMat);

      // Directional Triad Stem along socket's local +Y (worldUpDir)
      const stemLen = 0.14;
      const stemGeom = new THREE.CylinderGeometry(0.012, 0.022, stemLen);
      const stemMat = new THREE.MeshBasicMaterial({ color: pin.colorHex });
      const stemMesh = new THREE.Mesh(stemGeom, stemMat);
      stemMesh.name = `socket-stem:${pin.pinId}`;
      stemMesh.position.set(
        pin.worldPos[0] + pin.worldUpDir[0] * (stemLen * 0.5),
        pin.worldPos[1] + pin.worldUpDir[1] * (stemLen * 0.5),
        pin.worldPos[2] + pin.worldUpDir[2] * (stemLen * 0.5),
      );
      stemMesh.userData = { isSocketPin: true, socketPin: pin };
      group.add(stemMesh);
      disposableGeoms.push(stemGeom);
      disposableMats.push(stemMat);
    }
  }

  return {
    group,
    pickTable,
    socketPins,
    bounds: kitBounds,
    partCount: placed.filter((p) => p.rank <= maxRank).length,
    triangleCount: pickTable.totalTriangles,
    dispose() {
      for (const g of disposableGeoms) g.dispose();
      for (const m of disposableMats) m.dispose();
      for (const t of disposableTextures) t.dispose();
    },
  };
}
